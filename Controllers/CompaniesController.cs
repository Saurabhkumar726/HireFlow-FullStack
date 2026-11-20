using System.Security.Claims;
using System.Text.RegularExpressions;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CompaniesController : ControllerBase
{
    private readonly HireFlowDbContext _context;

    public CompaniesController(HireFlowDbContext context)
    {
        _context = context;
    }

    // Public directory. Legacy companies continue to be discoverable from
    // current job listings even before an employer creates a full profile.
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetCompanies(
        [FromQuery] string? search,
        [FromQuery] string? industry,
        [FromQuery] string? location,
        CancellationToken cancellationToken)
    {
        var result = await BuildPublicDirectoryAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(search))
            result = result.Where(company =>
                company.Name.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase) ||
                (company.Industry?.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase) ?? false)).ToList();

        if (!string.IsNullOrWhiteSpace(industry))
            result = result.Where(company =>
                string.Equals(company.Industry, industry.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();

        if (!string.IsNullOrWhiteSpace(location))
            result = result.Where(company =>
                company.Location?.Contains(location.Trim(), StringComparison.OrdinalIgnoreCase) == true).ToList();

        return Ok(result
            .OrderByDescending(company => company.IsFeatured)
            .ThenByDescending(company => company.ActiveJobsCount)
            .ThenBy(company => company.Name)
            .ToList());
    }

    [HttpGet("featured")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFeaturedCompanies(
        [FromQuery] int count = 6,
        CancellationToken cancellationToken = default)
    {
        var take = Math.Clamp(count, 1, 12);
        var companies = await BuildPublicDirectoryAsync(cancellationToken);
        return Ok(companies
            .Where(company => company.ActiveJobsCount > 0)
            .OrderByDescending(company => company.IsFeatured)
            .ThenByDescending(company => company.ActiveJobsCount)
            .ThenBy(company => company.Name)
            .Take(take)
            .ToList());
    }

    [HttpGet("mine")]
    [Authorize(Policy = "ApprovedHR")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var company = await _context.Companies.AsNoTracking()
            .FirstOrDefaultAsync(item => item.OwnerUserId == userId, cancellationToken);
        if (company == null) return NotFound(new { message = "You have not created a company profile yet." });

        return Ok(await BuildManagementResponseAsync(company, cancellationToken));
    }

    [HttpGet("{slug}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCompany(string slug, CancellationToken cancellationToken)
    {
        var normalizedSlug = slug.Trim().ToLowerInvariant();
        var profile = await _context.Companies.AsNoTracking()
            .FirstOrDefaultAsync(company =>
                company.Slug == normalizedSlug && company.IsActive && company.ApprovalStatus == "Approved",
                cancellationToken);

        if (profile != null)
            return Ok(await BuildPublicProfileAsync(profile, cancellationToken));

        // Keep old job-based company links working, but expose only public job
        // data when no approved company profile exists.
        var jobs = await GetPublicJobsAsync(cancellationToken);
        var matchingJobs = jobs
            .Where(job => Slugify(job.Company) == normalizedSlug)
            .ToList();

        if (matchingJobs.Count == 0) return NotFound(new { message = "Company not found." });

        var name = matchingJobs[0].Company;
        return Ok(new
        {
            id = (int?)null,
            name,
            slug = normalizedSlug,
            description = (string?)null,
            industry = (string?)null,
            location = matchingJobs.Select(job => job.Location).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)),
            website = (string?)null,
            logoUrl = (string?)null,
            isVerified = false,
            isFeatured = false,
            approvalStatus = "Profile not verified",
            activeJobsCount = matchingJobs.Count,
            jobs = matchingJobs.Select(ToJobSummary).ToList()
        });
    }

    [HttpPost]
    [Authorize(Policy = "ApprovedHR")]
    public async Task<IActionResult> CreateCompanyProfile(
        [FromBody] CompanyProfileRequest request,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var ownedProfile = await _context.Companies.AnyAsync(company => company.OwnerUserId == userId, cancellationToken);
        if (ownedProfile)
            return Conflict(new { message = "Your HR account already manages a company profile. Update that profile instead." });

        var name = request.Name.Trim();
        var normalizedName = NormalizeName(name);
        var duplicate = await _context.Companies.AnyAsync(company => company.NormalizedName == normalizedName, cancellationToken);
        if (duplicate)
            return Conflict(new { message = "A company profile with this name already exists. Contact support if it belongs to your organization." });

        var urlError = ValidateOptionalUrl(request.Website, "Company website") ?? ValidateOptionalUrl(request.LogoUrl, "Logo URL");
        if (urlError != null) return BadRequest(new { message = urlError });

        var company = new Company
        {
            Name = name,
            NormalizedName = normalizedName,
            Slug = await CreateUniqueSlugAsync(name, cancellationToken),
            Description = Clean(request.Description),
            Industry = Clean(request.Industry),
            Location = Clean(request.Location),
            Website = Clean(request.Website),
            LogoUrl = Clean(request.LogoUrl),
            OwnerUserId = userId,
            ApprovalStatus = "Pending",
            IsActive = true,
            IsFeatured = false,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.Companies.Add(company);

        // Keep the legacy Job.Company text field aligned with the approved
        // employer's declared company name without changing existing job IDs.
        var ownedJobs = await _context.Jobs
            .Where(job => job.CreatedByUserId == userId)
            .ToListAsync(cancellationToken);
        foreach (var job in ownedJobs)
        {
            job.Company = name;
            job.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetMine), new { }, await BuildManagementResponseAsync(company, cancellationToken));
    }

    [HttpPut("mine")]
    [Authorize(Policy = "ApprovedHR")]
    public async Task<IActionResult> UpdateMine(
        [FromBody] CompanyProfileRequest request,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var company = await _context.Companies.FirstOrDefaultAsync(item => item.OwnerUserId == userId, cancellationToken);
        if (company == null) return NotFound(new { message = "Create your company profile before updating it." });

        var name = request.Name.Trim();
        var normalizedName = NormalizeName(name);
        var duplicate = await _context.Companies.AnyAsync(
            item => item.Id != company.Id && item.NormalizedName == normalizedName,
            cancellationToken);
        if (duplicate)
            return Conflict(new { message = "Another company profile already uses this name." });

        var urlError = ValidateOptionalUrl(request.Website, "Company website") ?? ValidateOptionalUrl(request.LogoUrl, "Logo URL");
        if (urlError != null) return BadRequest(new { message = urlError });

        var previousName = company.Name;
        company.Name = name;
        company.NormalizedName = normalizedName;
        company.Slug = await CreateUniqueSlugAsync(name, cancellationToken, company.Id);
        company.Description = Clean(request.Description);
        company.Industry = Clean(request.Industry);
        company.Location = Clean(request.Location);
        company.Website = Clean(request.Website);
        company.LogoUrl = Clean(request.LogoUrl);
        company.UpdatedAtUtc = DateTime.UtcNow;
        company.ApprovalStatus = "Pending";
        company.ReviewReason = null;
        company.ReviewedAtUtc = null;
        company.ReviewedByUserId = null;
        company.IsFeatured = false;

        // Keep existing job records connected by their legacy company string.
        if (!string.Equals(previousName, name, StringComparison.OrdinalIgnoreCase))
        {
            var ownedJobs = await _context.Jobs
                .Where(job => job.CreatedByUserId == userId && job.Company == previousName)
                .ToListAsync(cancellationToken);
            foreach (var job in ownedJobs)
            {
                job.Company = name;
                job.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        return Ok(await BuildManagementResponseAsync(company, cancellationToken));
    }

    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetCompaniesForAdmin(
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var query = _context.Companies.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(company => company.ApprovalStatus == status.Trim());

        var companies = await query
            .OrderBy(company => company.ApprovalStatus)
            .ThenByDescending(company => company.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var jobCounts = await GetActiveJobCountsAsync(cancellationToken);
        return Ok(companies.Select(company => ToManagementDto(company, jobCounts.GetValueOrDefault(company.NormalizedName))));
    }

    [HttpPut("{id:int}/approval")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetCompanyApproval(
        int id,
        [FromBody] CompanyApprovalRequest request,
        CancellationToken cancellationToken)
    {
        var company = await _context.Companies.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (company == null) return NotFound(new { message = "Company profile not found." });

        if ((request.Status is "Rejected" or "NeedsInfo") && string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(new { message = "A review reason is required when rejecting a profile or requesting more information." });

        company.ApprovalStatus = request.Status;
        company.ReviewReason = Clean(request.Reason);
        company.ReviewedAtUtc = DateTime.UtcNow;
        company.ReviewedByUserId = CurrentUserId();
        company.UpdatedAtUtc = DateTime.UtcNow;
        if (request.Status != "Approved") company.IsFeatured = false;

        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { message = $"Company profile marked as {request.Status}.", company.Id, company.ApprovalStatus, company.ReviewReason });
    }

    [HttpPut("{id:int}/featured")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetCompanyFeatured(
        int id,
        [FromBody] CompanyFeaturedRequest request,
        CancellationToken cancellationToken)
    {
        var company = await _context.Companies.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (company == null) return NotFound(new { message = "Company profile not found." });
        if (request.IsFeatured && (!company.IsActive || company.ApprovalStatus != "Approved"))
            return BadRequest(new { message = "Only active, approved company profiles can be featured." });

        company.IsFeatured = request.IsFeatured;
        company.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { message = request.IsFeatured ? "Company featured." : "Company unfeatured.", company.Id, company.IsFeatured });
    }

    [HttpPut("{id:int}/active")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetCompanyActive(
        int id,
        [FromBody] CompanyActiveRequest request,
        CancellationToken cancellationToken)
    {
        var company = await _context.Companies.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (company == null) return NotFound(new { message = "Company profile not found." });

        company.IsActive = request.IsActive;
        company.UpdatedAtUtc = DateTime.UtcNow;
        if (!request.IsActive) company.IsFeatured = false;
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { message = request.IsActive ? "Company profile activated." : "Company profile deactivated.", company.Id, company.IsActive });
    }

    private string? CurrentUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    private async Task<List<CompanyPublicDto>> BuildPublicDirectoryAsync(CancellationToken cancellationToken)
    {
        var jobs = await GetPublicJobsAsync(cancellationToken);
        var profiles = await _context.Companies.AsNoTracking()
            .Where(company => company.IsActive && company.ApprovalStatus == "Approved")
            .ToListAsync(cancellationToken);

        var jobsByCompany = jobs
            .Where(job => !string.IsNullOrWhiteSpace(job.Company))
            .GroupBy(job => NormalizeName(job.Company))
            .ToDictionary(group => group.Key, group => group.OrderByDescending(job => job.CreatedAt).ToList());

        var profilesByName = profiles.ToDictionary(company => company.NormalizedName, StringComparer.Ordinal);
        var result = new List<CompanyPublicDto>();

        foreach (var profile in profiles)
        {
            jobsByCompany.TryGetValue(profile.NormalizedName, out var companyJobs);
            result.Add(ToPublicDto(profile, companyJobs ?? new List<Job>()));
        }

        // Legacy job listings without an approved profile remain discoverable
        // with basic public information and an explicit unverified profile state.
        foreach (var group in jobsByCompany)
        {
            if (profilesByName.ContainsKey(group.Key)) continue;
            var firstJob = group.Value[0];
            result.Add(new CompanyPublicDto
            {
                Id = null,
                Name = firstJob.Company.Trim(),
                Slug = Slugify(firstJob.Company),
                Location = group.Value.Select(job => job.Location).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)),
                ApprovalStatus = "Profile not verified",
                IsVerified = false,
                IsFeatured = false,
                ActiveJobsCount = group.Value.Count,
                Jobs = group.Value.Select(ToJobSummary).ToList()
            });
        }

        return result;
    }

    private async Task<List<Job>> GetPublicJobsAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        return await _context.Jobs.AsNoTracking()
            .Where(job => job.PublicationStatus == "Published" && job.IsActive &&
                (!job.ApplicationDeadlineUtc.HasValue || job.ApplicationDeadlineUtc.Value >= now))
            .OrderByDescending(job => job.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    private async Task<Dictionary<string, int>> GetActiveJobCountsAsync(CancellationToken cancellationToken)
    {
        var jobs = await GetPublicJobsAsync(cancellationToken);
        return jobs.Where(job => !string.IsNullOrWhiteSpace(job.Company))
            .GroupBy(job => NormalizeName(job.Company))
            .ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);
    }

    private async Task<object> BuildPublicProfileAsync(Company company, CancellationToken cancellationToken)
    {
        var jobs = await GetPublicJobsAsync(cancellationToken);
        var companyJobs = jobs
            .Where(job => NormalizeName(job.Company) == company.NormalizedName)
            .ToList();
        return new
        {
            id = company.Id,
            name = company.Name,
            slug = company.Slug,
            description = company.Description,
            industry = company.Industry,
            location = company.Location ?? companyJobs.Select(job => job.Location).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)),
            website = company.Website,
            logoUrl = company.LogoUrl,
            approvalStatus = company.ApprovalStatus,
            isVerified = true,
            isFeatured = company.IsFeatured,
            activeJobsCount = companyJobs.Count,
            jobs = companyJobs.Select(ToJobSummary).ToList()
        };
    }

    private async Task<object> BuildManagementResponseAsync(Company company, CancellationToken cancellationToken)
    {
        var counts = await GetActiveJobCountsAsync(cancellationToken);
        return ToManagementDto(company, counts.GetValueOrDefault(company.NormalizedName));
    }

    private static CompanyManagementDto ToManagementDto(Company company, int activeJobCount) => new()
    {
        Id = company.Id,
        Name = company.Name,
        Slug = company.Slug,
        Description = company.Description,
        Industry = company.Industry,
        Location = company.Location,
        Website = company.Website,
        LogoUrl = company.LogoUrl,
        OwnerUserId = company.OwnerUserId,
        ApprovalStatus = company.ApprovalStatus,
        ReviewReason = company.ReviewReason,
        ReviewedAtUtc = company.ReviewedAtUtc,
        IsFeatured = company.IsFeatured,
        IsActive = company.IsActive,
        CreatedAtUtc = company.CreatedAtUtc,
        UpdatedAtUtc = company.UpdatedAtUtc,
        ActiveJobsCount = activeJobCount
    };

    private static CompanyPublicDto ToPublicDto(Company company, List<Job> jobs) => new()
    {
        Id = company.Id,
        Name = company.Name,
        Slug = company.Slug,
        Description = company.Description,
        Industry = company.Industry,
        Location = company.Location ?? jobs.Select(job => job.Location).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)),
        Website = company.Website,
        LogoUrl = company.LogoUrl,
        ApprovalStatus = company.ApprovalStatus,
        IsVerified = true,
        IsFeatured = company.IsFeatured,
        ActiveJobsCount = jobs.Count,
        Jobs = jobs.Select(ToJobSummary).ToList()
    };

    private static CompanyJobDto ToJobSummary(Job job) => new()
    {
        Id = job.Id,
        Title = job.Title,
        Company = job.Company,
        Location = job.Location,
        JobType = job.JobType,
        Salary = job.Salary,
        SalaryMax = job.SalaryMax,
        SalaryMode = job.SalaryMode,
        SalaryCurrency = job.SalaryCurrency,
        SalaryPeriod = job.SalaryPeriod,
        CreatedAt = job.CreatedAt,
        ApplicationDeadlineUtc = job.ApplicationDeadlineUtc
    };

    private async Task<string> CreateUniqueSlugAsync(string name, CancellationToken cancellationToken, int? currentId = null)
    {
        var baseSlug = Slugify(name);
        var slug = baseSlug;
        var suffix = 2;
        while (await _context.Companies.AnyAsync(company => company.Slug == slug && company.Id != currentId, cancellationToken))
        {
            slug = $"{baseSlug}-{suffix}";
            suffix++;
        }
        return slug;
    }

    private static string NormalizeName(string value) =>
        Regex.Replace(value.Trim(), @"\s+", " ").ToUpperInvariant();

    private static string Slugify(string value)
    {
        var slug = Regex.Replace(value.Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? "company" : slug;
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? ValidateOptionalUrl(string? value, string label)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return $"{label} must be a valid HTTP or HTTPS URL.";
        return null;
    }
}

public class CompanyPublicDto
{
    public int? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Industry { get; set; }
    public string? Location { get; set; }
    public string? Website { get; set; }
    public string? LogoUrl { get; set; }
    public string ApprovalStatus { get; set; } = string.Empty;
    public bool IsVerified { get; set; }
    public bool IsFeatured { get; set; }
    public int ActiveJobsCount { get; set; }
    public List<CompanyJobDto> Jobs { get; set; } = new();
}

public class CompanyJobDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string JobType { get; set; } = string.Empty;
    public decimal Salary { get; set; }
    public decimal? SalaryMax { get; set; }
    public string SalaryMode { get; set; } = string.Empty;
    public string SalaryCurrency { get; set; } = "INR";
    public string SalaryPeriod { get; set; } = "Monthly";
    public DateTime CreatedAt { get; set; }
    public DateTime? ApplicationDeadlineUtc { get; set; }
}

public class CompanyManagementDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Industry { get; set; }
    public string? Location { get; set; }
    public string? Website { get; set; }
    public string? LogoUrl { get; set; }
    public string? OwnerUserId { get; set; }
    public string ApprovalStatus { get; set; } = string.Empty;
    public string? ReviewReason { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public int ActiveJobsCount { get; set; }
}
