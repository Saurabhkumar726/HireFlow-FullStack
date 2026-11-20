using System.Security.Claims;
using System.Text.Json;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Student")]
public class CandidateJobPreferencesController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly HashSet<string> AllowedSalaryPeriods = new(StringComparer.OrdinalIgnoreCase)
    {
        "Yearly", "Monthly", "Weekly", "Hourly"
    };

    private static readonly HashSet<string> AllowedWorkModes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Remote", "Hybrid", "On-site"
    };

    private static readonly HashSet<string> AllowedEmploymentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Full-time", "Part-time", "Internship", "Contract", "Freelance", "Temporary"
    };

    private static readonly HashSet<string> AllowedExperienceLevels = new(StringComparer.OrdinalIgnoreCase)
    {
        "Fresher", "Entry", "Mid", "Senior", "Lead"
    };

    private readonly HireFlowDbContext _context;

    public CandidateJobPreferencesController(HireFlowDbContext context)
    {
        _context = context;
    }

    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    /// <summary>
    /// Returns saved preferences. If no preference record exists yet, existing
    /// career-profile fields and CandidateSkill rows are returned as defaults.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPreferences(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var snapshot = await LoadSnapshotAsync(userId, cancellationToken);
        if (snapshot == null) return NotFound(new { message = "Student account was not found." });

        return Ok(new
        {
            hasPreferences = snapshot.HasPreferences,
            source = snapshot.SavedRecordExists ? "saved" : "profile",
            preferences = snapshot.ToResponse()
        });
    }

    /// <summary>
    /// Creates or updates only the signed-in Student's discovery preferences.
    /// Existing ApplicationUser career fields are used as initial defaults but
    /// are not overwritten, keeping profile data independent from discovery choices.
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> SavePreferences(
        [FromBody] UpsertCandidateJobPreferencesRequest request,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var user = await _context.Users.FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user == null) return NotFound(new { message = "Student account was not found." });

        var roles = NormalizeList(request.PreferredRoles, 20, 100, "preferred roles");
        var industries = NormalizeList(request.PreferredIndustries, 20, 100, "preferred industries");
        var skills = NormalizeList(request.PreferredSkills, 50, 100, "preferred skills");
        var locations = NormalizeList(request.PreferredLocations, 20, 120, "preferred locations");
        var employmentTypes = NormalizeList(request.EmploymentTypes, 10, 40, "employment types");
        var workModes = NormalizeList(request.WorkModes, 5, 30, "work modes");

        if (!roles.IsValid || !industries.IsValid || !skills.IsValid || !locations.IsValid ||
            !employmentTypes.IsValid || !workModes.IsValid)
        {
            return BadRequest(new
            {
                message = roles.Error ?? industries.Error ?? skills.Error ?? locations.Error ?? employmentTypes.Error ?? workModes.Error
            });
        }

        var invalidEmployment = employmentTypes.Values.FirstOrDefault(value => !AllowedEmploymentTypes.Contains(value));
        if (invalidEmployment != null)
            return BadRequest(new { message = $"'{invalidEmployment}' is not a supported employment type." });

        var invalidWorkMode = workModes.Values.FirstOrDefault(value => !AllowedWorkModes.Contains(value));
        if (invalidWorkMode != null)
            return BadRequest(new { message = $"'{invalidWorkMode}' is not a supported work mode." });

        var experienceLevel = string.IsNullOrWhiteSpace(request.ExperienceLevel)
            ? null
            : request.ExperienceLevel.Trim();
        if (experienceLevel != null && !AllowedExperienceLevels.Contains(experienceLevel))
            return BadRequest(new { message = "Choose a valid experience level." });

        var salaryCurrency = (request.SalaryCurrency ?? "INR").Trim().ToUpperInvariant();
        if (salaryCurrency.Length != 3 || salaryCurrency.Any(character => !char.IsLetter(character)))
            return BadRequest(new { message = "Salary currency must be a three-letter currency code." });

        var salaryPeriod = (request.SalaryPeriod ?? "Yearly").Trim();
        if (!AllowedSalaryPeriods.Contains(salaryPeriod))
            return BadRequest(new { message = "Choose Yearly, Monthly, Weekly, or Hourly as the salary period." });

        var preference = await _context.CandidateJobPreferences
            .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken);

        if (preference == null)
        {
            preference = new CandidateJobPreference { UserId = userId };
            _context.CandidateJobPreferences.Add(preference);
        }

        preference.PreferredRolesJson = JsonSerializer.Serialize(roles.Values, JsonOptions);
        preference.PreferredIndustriesJson = JsonSerializer.Serialize(industries.Values, JsonOptions);
        preference.PreferredSkillsJson = JsonSerializer.Serialize(skills.Values, JsonOptions);
        preference.PreferredLocationsJson = JsonSerializer.Serialize(locations.Values, JsonOptions);
        preference.EmploymentTypesJson = JsonSerializer.Serialize(employmentTypes.Values, JsonOptions);
        preference.WorkModesJson = JsonSerializer.Serialize(workModes.Values, JsonOptions);
        preference.ExperienceLevel = experienceLevel;
        preference.ExpectedSalary = request.ExpectedSalary is > 0 ? request.ExpectedSalary : null;
        preference.SalaryCurrency = salaryCurrency;
        preference.SalaryPeriod = salaryPeriod;
        preference.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var hasPreferences = roles.Values.Count + industries.Values.Count + skills.Values.Count +
            locations.Values.Count + employmentTypes.Values.Count + workModes.Values.Count > 0 ||
            experienceLevel != null || preference.ExpectedSalary.HasValue;

        return Ok(new
        {
            message = "Your job preferences have been saved.",
            hasPreferences,
            source = "saved",
            preferences = ToResponse(preference)
        });
    }

    /// <summary>
    /// Returns public, active jobs ranked using an explainable weighted rule set.
    /// The score only includes criteria for which both job and candidate data exist.
    /// </summary>
    [HttpGet("recommendations")]
    public async Task<IActionResult> GetRecommendations(
        [FromQuery] int limit = 8,
        CancellationToken cancellationToken = default)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var snapshot = await LoadSnapshotAsync(userId, cancellationToken);
        if (snapshot == null) return NotFound(new { message = "Student account was not found." });

        var now = DateTime.UtcNow;
        var jobs = await _context.Jobs
            .AsNoTracking()
            .Where(job => job.PublicationStatus == "Published" &&
                          job.IsActive &&
                          (!job.ApplicationDeadlineUtc.HasValue || job.ApplicationDeadlineUtc.Value >= now))
            .OrderByDescending(job => job.IsFeatured)
            .ThenByDescending(job => job.CreatedAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        var safeLimit = Math.Clamp(limit, 1, 20);
        if (!snapshot.HasPreferences)
        {
            var popular = jobs
                .OrderByDescending(job => job.IsFeatured)
                .ThenByDescending(job => job.CreatedAt)
                .Take(safeLimit)
                .Select(job => new
                {
                    job,
                    matchPercentage = (int?)null,
                    coveragePercentage = 0,
                    matchLabel = (string?)null,
                    criteria = Array.Empty<object>(),
                    matchedSkills = Array.Empty<string>(),
                    missingSkills = Array.Empty<string>(),
                    salaryPreferenceMatch = false,
                    signals = new[] { "Recently published opportunity" }
                });

            return Ok(new
            {
                hasPreferences = false,
                preferences = snapshot.ToResponse(),
                items = popular
            });
        }

        var candidateSkills = await _context.CandidateSkills
            .AsNoTracking()
            .Where(skill => skill.UserId == userId)
            .Select(skill => skill.SkillName)
            .ToListAsync(cancellationToken);

        candidateSkills = candidateSkills
            .Concat(snapshot.PreferredSkills)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var employments = await _context.CandidateEmployments
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .ToListAsync(cancellationToken);
        var education = await _context.CandidateEducations
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .ToListAsync(cancellationToken);

        var experienceYears = CalculateExperienceYears(employments);
        if (experienceYears == null)
            experienceYears = MapExperienceLevel(snapshot.ExperienceLevel);

        var ranked = jobs.Select(job => BuildMatch(job, snapshot, candidateSkills, experienceYears, education))
            .OrderByDescending(item => item.MatchPercentage ?? -1)
            .ThenByDescending(item => item.SalaryPreferenceMatch)
            .ThenByDescending(item => item.SecondarySignalCount)
            .ThenByDescending(item => item.Job.IsFeatured)
            .ThenByDescending(item => item.Job.CreatedAt)
            .Take(safeLimit)
            .Select(item => new
            {
                job = item.Job,
                matchPercentage = item.MatchPercentage,
                coveragePercentage = item.CoveragePercentage,
                matchLabel = item.MatchLabel,
                criteria = item.Criteria,
                matchedSkills = item.MatchedSkills,
                missingSkills = item.MissingSkills,
                salaryPreferenceMatch = item.SalaryPreferenceMatch,
                signals = item.Signals
            });

        return Ok(new
        {
            hasPreferences = true,
            preferences = snapshot.ToResponse(),
            items = ranked
        });
    }

    private async Task<PreferenceSnapshot?> LoadSnapshotAsync(string userId, CancellationToken cancellationToken)
    {
        var user = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user == null) return null;

        var saved = await _context.CandidateJobPreferences.AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken);

        if (saved != null)
        {
            return new PreferenceSnapshot
            {
                SavedRecordExists = true,
                PreferredRoles = DeserializeList(saved.PreferredRolesJson),
                PreferredIndustries = DeserializeList(saved.PreferredIndustriesJson),
                PreferredSkills = DeserializeList(saved.PreferredSkillsJson),
                PreferredLocations = DeserializeList(saved.PreferredLocationsJson),
                EmploymentTypes = DeserializeList(saved.EmploymentTypesJson),
                WorkModes = DeserializeList(saved.WorkModesJson),
                ExperienceLevel = saved.ExperienceLevel,
                ExpectedSalary = saved.ExpectedSalary,
                SalaryCurrency = saved.SalaryCurrency,
                SalaryPeriod = saved.SalaryPeriod
            };
        }

        var profileSkills = await _context.CandidateSkills.AsNoTracking()
            .Where(skill => skill.UserId == userId)
            .OrderBy(skill => skill.SkillName)
            .Select(skill => skill.SkillName)
            .ToListAsync(cancellationToken);

        var defaults = new PreferenceSnapshot
        {
            PreferredRoles = SplitProfileValue(user.DesiredRole, splitComma: true),
            PreferredIndustries = SplitProfileValue(user.DesiredIndustry, splitComma: true),
            PreferredSkills = profileSkills,
            PreferredLocations = SplitProfileValue(user.PreferredLocations, splitComma: false),
            EmploymentTypes = SplitProfileValue(user.EmploymentType, splitComma: true),
            WorkModes = SplitProfileValue(user.WorkMode, splitComma: true),
            ExpectedSalary = user.ExpectedSalary,
            SalaryCurrency = "INR",
            SalaryPeriod = "Yearly"
        };

        return defaults;
    }

    private static object ToResponse(CandidateJobPreference preference) => new
    {
        preferredRoles = DeserializeList(preference.PreferredRolesJson),
        preferredIndustries = DeserializeList(preference.PreferredIndustriesJson),
        preferredSkills = DeserializeList(preference.PreferredSkillsJson),
        preferredLocations = DeserializeList(preference.PreferredLocationsJson),
        employmentTypes = DeserializeList(preference.EmploymentTypesJson),
        workModes = DeserializeList(preference.WorkModesJson),
        experienceLevel = preference.ExperienceLevel,
        expectedSalary = preference.ExpectedSalary,
        salaryCurrency = preference.SalaryCurrency,
        salaryPeriod = preference.SalaryPeriod,
        updatedAtUtc = preference.UpdatedAtUtc
    };

    private static object ToResponse(PreferenceSnapshot preference) => new
    {
        preferredRoles = preference.PreferredRoles,
        preferredIndustries = preference.PreferredIndustries,
        preferredSkills = preference.PreferredSkills,
        preferredLocations = preference.PreferredLocations,
        employmentTypes = preference.EmploymentTypes,
        workModes = preference.WorkModes,
        experienceLevel = preference.ExperienceLevel,
        expectedSalary = preference.ExpectedSalary,
        salaryCurrency = preference.SalaryCurrency,
        salaryPeriod = preference.SalaryPeriod
    };

    private static List<string> DeserializeList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<string>();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }

    private static List<string> SplitProfileValue(string? value, bool splitComma)
    {
        if (string.IsNullOrWhiteSpace(value)) return new List<string>();
        var separators = splitComma ? new[] { ';', '|', ',' } : new[] { ';', '|' };
        return value.Split(separators, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(20)
            .ToList();
    }

    private static (bool IsValid, List<string> Values, string? Error) NormalizeList(
        IEnumerable<string>? source, int maximumCount, int maximumLength, string label)
    {
        var values = (source ?? Enumerable.Empty<string>())
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (values.Count > maximumCount)
            return (false, values, $"You can select up to {maximumCount} {label}.");

        if (values.Any(value => value.Length > maximumLength))
            return (false, values, $"Each of your {label} must be {maximumLength} characters or fewer.");

        return (true, values, null);
    }

    private static MatchResult BuildMatch(
        Job job,
        PreferenceSnapshot preferences,
        IReadOnlyCollection<string> candidateSkills,
        double? experienceYears,
        IReadOnlyCollection<CandidateEducation> education)
    {
        var text = string.Join(" ", new[]
        {
            job.Title, job.Category, job.Description, job.Requirements, job.Responsibilities
        }.Where(value => !string.IsNullOrWhiteSpace(value)));

        var criteria = new List<CriterionResult>();
        var matchedSkills = candidateSkills
            .Where(skill => skill.Trim().Length >= 2 && text.Contains(skill, StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (candidateSkills.Count > 0 && !string.IsNullOrWhiteSpace(text))
        {
            var score = matchedSkills.Count * 100d / candidateSkills.Count;
            criteria.Add(new CriterionResult(
                "Skills", 40, score,
                matchedSkills.Count == 0
                    ? "None of the skills in your profile were explicitly found in this job description."
                    : $"{matchedSkills.Count} of {candidateSkills.Count} profile skills are mentioned in this listing."));
        }

        if (experienceYears.HasValue && HasExperienceRequirement(job))
        {
            var (minimum, maximum) = GetExperienceRange(job);
            var score = ScoreExperience(experienceYears.Value, minimum, maximum);
            criteria.Add(new CriterionResult(
                "Experience", 25, score,
                $"Your estimated experience is {experienceYears.Value:0.#} years; this listing indicates {FormatExperienceRange(minimum, maximum)}."));
        }

        if (!string.IsNullOrWhiteSpace(job.EducationRequirement) && education.Count > 0)
        {
            var requirement = job.EducationRequirement.Trim();
            var educationText = string.Join(" ", education.Select(item =>
                $"{item.EducationLevel} {item.Degree} {item.Specialization}"));
            var score = ContainsMeaningfulPhrase(educationText, requirement) ? 100d : 0d;
            criteria.Add(new CriterionResult(
                "Education", 15, score,
                score >= 100
                    ? "Your education profile contains the qualification listed for this role."
                    : $"The listed qualification is '{requirement}', which was not found in your education profile."));
        }

        if (preferences.PreferredLocations.Count > 0 && !string.IsNullOrWhiteSpace(job.Location))
        {
            var locationMatch = preferences.PreferredLocations.Any(location =>
                job.Location.Contains(location, StringComparison.OrdinalIgnoreCase) ||
                location.Contains(job.Location, StringComparison.OrdinalIgnoreCase));
            criteria.Add(new CriterionResult(
                "Location", 10, locationMatch ? 100 : 0,
                locationMatch
                    ? $"{job.Location} matches one of your preferred locations."
                    : $"{job.Location} is not among your preferred locations."));
        }

        if (preferences.WorkModes.Count > 0 &&
            !string.IsNullOrWhiteSpace(job.WorkMode) &&
            !string.Equals(job.WorkMode, "Not specified", StringComparison.OrdinalIgnoreCase))
        {
            var workModeMatch = preferences.WorkModes.Any(mode =>
                string.Equals(mode, job.WorkMode, StringComparison.OrdinalIgnoreCase));
            criteria.Add(new CriterionResult(
                "Work mode", 10, workModeMatch ? 100 : 0,
                workModeMatch
                    ? $"{job.WorkMode} matches your work-mode preference."
                    : $"This role is {job.WorkMode}; it does not match your selected work modes."));
        }

        var evaluatedWeight = criteria.Sum(item => item.Weight);
        var percentage = evaluatedWeight == 0
            ? (int?)null
            : (int)Math.Round(criteria.Sum(item => item.Weight * item.Score) / evaluatedWeight, MidpointRounding.AwayFromZero);
        var coverage = evaluatedWeight;

        var signals = new List<string>();
        var roleMatch = preferences.PreferredRoles.Any(role =>
            !string.IsNullOrWhiteSpace(role) &&
            (job.Title.Contains(role, StringComparison.OrdinalIgnoreCase) ||
             (job.Category?.Contains(role, StringComparison.OrdinalIgnoreCase) ?? false)));
        if (roleMatch) signals.Add("Matches one of your preferred job roles");

        var industryMatch = preferences.PreferredIndustries.Any(industry =>
            !string.IsNullOrWhiteSpace(industry) && text.Contains(industry, StringComparison.OrdinalIgnoreCase));
        if (industryMatch) signals.Add("Matches one of your preferred industries");

        if (preferences.EmploymentTypes.Any(type => string.Equals(type, job.JobType, StringComparison.OrdinalIgnoreCase)))
            signals.Add($"Matches your {job.JobType} preference");

        var salaryPreferenceMatch = MatchesSalaryPreference(job, preferences);
        if (salaryPreferenceMatch)
            signals.Add("The published salary range is compatible with your expected compensation");

        if (matchedSkills.Count > 0)
            signals.Add($"Mentions {string.Join(", ", matchedSkills.Take(4))}");

        if (signals.Count == 0) signals.Add("Recently published opportunity matching your discovery feed");

        return new MatchResult
        {
            Job = job,
            MatchPercentage = percentage,
            CoveragePercentage = coverage,
            MatchLabel = percentage.HasValue
                ? percentage.Value >= 80 ? "Strong match" : percentage.Value >= 60 ? "Good match" : "Partial match"
                : null,
            Criteria = criteria,
            MatchedSkills = matchedSkills,
            MissingSkills = candidateSkills.Except(matchedSkills, StringComparer.OrdinalIgnoreCase).ToList(),
            Signals = signals,
            RolePreferenceMatch = roleMatch,
            SalaryPreferenceMatch = salaryPreferenceMatch,
            SecondarySignalCount = signals.Count
        };
    }

    private static bool HasExperienceRequirement(Job job)
    {
        if (job.MinimumExperienceYears.HasValue || job.MaximumExperienceYears.HasValue)
            return true;

        var range = GetExperienceRange(job);
        return range.Minimum.HasValue || range.Maximum.HasValue;
    }

    private static (double? Minimum, double? Maximum) GetExperienceRange(Job job)
    {
        if (job.MinimumExperienceYears.HasValue || job.MaximumExperienceYears.HasValue)
            return (job.MinimumExperienceYears, job.MaximumExperienceYears);

        return (job.ExperienceLevel ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "fresher" => (0, 0),
            "entry" or "junior" => (0, 2),
            "mid" or "mid-level" => (3, 5),
            "senior" => (6, 9),
            "lead" or "principal" => (10, null),
            _ => (null, null)
        };
    }

    private static double ScoreExperience(double years, double? minimum, double? maximum)
    {
        if (minimum.HasValue && years < minimum.Value)
            return minimum.Value - years <= 1 ? 50 : 0;
        if (maximum.HasValue && years > maximum.Value)
            return years - maximum.Value <= 3 ? 90 : 80;
        return 100;
    }

    private static string FormatExperienceRange(double? minimum, double? maximum)
    {
        if (minimum.HasValue && maximum.HasValue) return $"{minimum:0.#}–{maximum:0.#} years";
        if (minimum.HasValue) return $"at least {minimum:0.#} years";
        if (maximum.HasValue) return $"up to {maximum:0.#} years";
        return "an unspecified level";
    }

    private static double? CalculateExperienceYears(IEnumerable<CandidateEmployment> employments)
    {
        var today = DateTime.UtcNow.Date;
        var ranges = employments
            .Select(item =>
            {
                var start = item.StartDate.Date;
                var end = item.IsCurrentlyWorking || !item.EndDate.HasValue
                    ? today
                    : item.EndDate.Value.Date;
                return (Start: start, End: end < start ? start : end);
            })
            .OrderBy(range => range.Start)
            .ToList();

        if (ranges.Count == 0) return null;

        // Merge overlapping employment periods so concurrent roles are not
        // counted twice when estimating total professional experience.
        var totalDays = 0d;
        var mergedStart = ranges[0].Start;
        var mergedEnd = ranges[0].End;

        foreach (var range in ranges.Skip(1))
        {
            if (range.Start <= mergedEnd)
            {
                if (range.End > mergedEnd) mergedEnd = range.End;
                continue;
            }

            totalDays += (mergedEnd - mergedStart).TotalDays;
            mergedStart = range.Start;
            mergedEnd = range.End;
        }

        totalDays += (mergedEnd - mergedStart).TotalDays;
        return Math.Round(totalDays / 365.25d, 1, MidpointRounding.AwayFromZero);
    }

    private static double? MapExperienceLevel(string? level) => (level ?? string.Empty).Trim().ToLowerInvariant() switch
    {
        "fresher" => 0,
        "entry" => 1,
        "mid" => 4,
        "senior" => 7,
        "lead" => 11,
        _ => null
    };

    private static decimal? ToAnnualSalary(decimal? amount, string period)
    {
        if (!amount.HasValue) return null;
        var multiplier = (period ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "monthly" => 12m,
            "weekly" => 52m,
            "hourly" => 2080m,
            _ => 1m
        };
        return amount.Value * multiplier;
    }

    private static bool MatchesSalaryPreference(Job job, PreferenceSnapshot preferences)
    {
        if (!preferences.ExpectedSalary.HasValue || job.Salary <= 0 ||
            string.IsNullOrWhiteSpace(job.SalaryCurrency) ||
            !string.Equals(job.SalaryCurrency, preferences.SalaryCurrency, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(job.SalaryMode, "NotDisclosed", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(job.SalaryMode, "Negotiable", StringComparison.OrdinalIgnoreCase))
            return false;

        var expectedAnnual = ToAnnualSalary(preferences.ExpectedSalary, preferences.SalaryPeriod);
        var jobMinimumAnnual = ToAnnualSalary(job.Salary, job.SalaryPeriod);
        var jobMaximumAnnual = job.SalaryMax.HasValue
            ? ToAnnualSalary(job.SalaryMax, job.SalaryPeriod)
            : jobMinimumAnnual;

        if (!expectedAnnual.HasValue || !jobMinimumAnnual.HasValue || !jobMaximumAnnual.HasValue)
            return false;

        // Treat expected salary as a target floor. A range is compatible when its
        // upper end reaches the target; starting-at salaries must meet the target.
        if (string.Equals(job.SalaryMode, "StartingAt", StringComparison.OrdinalIgnoreCase))
            return jobMinimumAnnual.Value >= expectedAnnual.Value;

        return jobMaximumAnnual.Value >= expectedAnnual.Value;
    }

    private static bool ContainsMeaningfulPhrase(string source, string phrase)
    {
        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(phrase)) return false;
        if (source.Contains(phrase, StringComparison.OrdinalIgnoreCase)) return true;

        var meaningfulWords = phrase.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(word => word.Length >= 4)
            .ToList();
        return meaningfulWords.Count > 0 && meaningfulWords.Any(word => source.Contains(word, StringComparison.OrdinalIgnoreCase));
    }

    private sealed class PreferenceSnapshot
    {
        public bool SavedRecordExists { get; set; }
        public List<string> PreferredRoles { get; set; } = new();
        public List<string> PreferredIndustries { get; set; } = new();
        public List<string> PreferredSkills { get; set; } = new();
        public List<string> PreferredLocations { get; set; } = new();
        public List<string> EmploymentTypes { get; set; } = new();
        public List<string> WorkModes { get; set; } = new();
        public string? ExperienceLevel { get; set; }
        public decimal? ExpectedSalary { get; set; }
        public string SalaryCurrency { get; set; } = "INR";
        public string SalaryPeriod { get; set; } = "Yearly";

        public bool HasPreferences => PreferredRoles.Count + PreferredIndustries.Count + PreferredSkills.Count +
            PreferredLocations.Count + EmploymentTypes.Count + WorkModes.Count > 0 ||
            ExperienceLevel != null || ExpectedSalary.HasValue;

        public object ToResponse() => CandidateJobPreferencesController.ToResponse(this);
    }

    private sealed record CriterionResult(string Name, int Weight, double Score, string Explanation);

    private sealed class MatchResult
    {
        public Job Job { get; set; } = null!;
        public int? MatchPercentage { get; set; }
        public int CoveragePercentage { get; set; }
        public string? MatchLabel { get; set; }
        public List<CriterionResult> Criteria { get; set; } = new();
        public List<string> MatchedSkills { get; set; } = new();
        public List<string> MissingSkills { get; set; } = new();
        public List<string> Signals { get; set; } = new();
        public bool RolePreferenceMatch { get; set; }
        public bool SalaryPreferenceMatch { get; set; }
        public int SecondarySignalCount { get; set; }
    }
}
