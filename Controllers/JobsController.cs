using System.Security.Claims;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class JobsController : ControllerBase
    {
        private static readonly string[] AllowedSalaryModes =
        {
            "Range",
            "StartingAt",
            "Negotiable",
            "NotDisclosed"
        };

        private static readonly string[] AllowedWorkModes =
        {
            "Remote",
            "Hybrid",
            "On-site",
            "Not specified"
        };

        private readonly HireFlowDbContext _context;

        public JobsController(HireFlowDbContext context)
        {
            _context = context;
        }

        // Public visitors and Students see only jobs that are available to apply for.
        // Approved HR sees only their own jobs (including closed jobs).
        // Admin can review all jobs, including unpublished moderation states.
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<Job>>> GetJobs()
        {
            var query = _context.Jobs.AsNoTracking();

            if (User.IsInRole("Admin"))
            {
                return Ok(await query
                    .OrderByDescending(job => job.CreatedAt)
                    .ToListAsync());
            }

            if (User.IsInRole("HR"))
            {
                if (!User.HasClaim("is_active", "true"))
                {
                    return Forbid();
                }

                var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrWhiteSpace(ownerId))
                {
                    return Unauthorized();
                }

                return Ok(await query
                    .Where(job => job.CreatedByUserId == ownerId)
                    .OrderByDescending(job => job.CreatedAt)
                    .ToListAsync());
            }

            var now = DateTime.UtcNow;
            return Ok(await query
                .Where(job =>
                    job.PublicationStatus == "Published" &&
                    job.IsActive &&
                    (!job.ApplicationDeadlineUtc.HasValue ||
                     job.ApplicationDeadlineUtc.Value >= now))
                .OrderByDescending(job => job.IsFeatured)
                .ThenByDescending(job => job.CreatedAt)
                .ToListAsync());
        }

        // Public homepage endpoint: featured jobs first, then newest published jobs.
        [HttpGet("featured")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<Job>>> GetFeaturedJobs(
            [FromQuery] int count = 6)
        {
            var take = Math.Clamp(count, 1, 12);
            var now = DateTime.UtcNow;

            var jobs = await _context.Jobs
                .AsNoTracking()
                .Where(job =>
                    job.PublicationStatus == "Published" &&
                    job.IsActive &&
                    (!job.ApplicationDeadlineUtc.HasValue ||
                     job.ApplicationDeadlineUtc.Value >= now))
                .OrderByDescending(job => job.IsFeatured)
                .ThenByDescending(job => job.CreatedAt)
                .Take(take)
                .ToListAsync();

            return Ok(jobs);
        }

        // Published job details remain viewable after a job closes or expires.
        // Unpublished jobs are visible only to their owning approved HR or Admin.
        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<ActionResult<Job>> GetJob(int id)
        {
            var job = await _context.Jobs
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == id);

            if (job == null)
            {
                return NotFound();
            }

            var isAdmin = User.IsInRole("Admin");
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var isApprovedOwner = User.IsInRole("HR") &&
                                  User.HasClaim("is_active", "true") &&
                                  !string.IsNullOrWhiteSpace(userId) &&
                                  job.CreatedByUserId == userId;

            if (job.PublicationStatus != "Published" &&
                !isAdmin &&
                !isApprovedOwner)
            {
                return NotFound();
            }

            return Ok(job);
        }

        // Only approved HR users can create jobs. The existing publication behaviour
        // is preserved in this phase; new moderation rules can be layered on later.
        [HttpPost]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<ActionResult<Job>> CreateJob([FromBody] Job job)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var metadataError = ValidateMetadata(
                job.MinimumExperienceYears,
                job.MaximumExperienceYears,
                job.Salary,
                job.SalaryMax,
                job.SalaryMode,
                job.WorkMode);

            if (metadataError != null)
            {
                return BadRequest(new { message = metadataError });
            }

            job.Id = 0;
            job.CreatedByUserId = userId;
            job.CreatedAt = DateTime.UtcNow;
            job.UpdatedAt = null;
            job.ApplicationDeadlineUtc = ToUtc(job.ApplicationDeadlineUtc);

            // These fields are controlled by the API/Admin, not the HR request body.
            job.IsFeatured = false;
            job.IsActive = true;
            job.PublicationStatus = "Published";

            NormalizeSalary(job);
            NormalizeMetadata(job);

            _context.Jobs.Add(job);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetJob),
                new { id = job.Id },
                job);
        }

        // Legacy update endpoint retained for existing HR forms.
        // Structured metadata and moderation fields are preserved unless the
        // dedicated metadata/availability endpoints are used.
        [HttpPut("{id:int}")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> UpdateJob(int id, [FromBody] Job updatedJob)
        {
            if (id != updatedJob.Id)
            {
                return BadRequest("The route ID does not match the job ID.");
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var job = await _context.Jobs.FirstOrDefaultAsync(item =>
                item.Id == id && item.CreatedByUserId == userId);

            if (job == null)
            {
                return NotFound(new
                {
                    message = "Job not found or you do not own this job."
                });
            }

            job.Title = updatedJob.Title.Trim();
            job.Company = updatedJob.Company.Trim();
            job.Location = updatedJob.Location.Trim();
            job.Description = updatedJob.Description.Trim();
            job.JobType = updatedJob.JobType.Trim();
            job.Salary = updatedJob.Salary;
            job.RequireResume = updatedJob.RequireResume;
            if (job.Salary <= 0)
            {
                job.SalaryMode = "NotDisclosed";
                job.SalaryMax = null;
            }
            else if (job.SalaryMode == "NotDisclosed")
            {
                job.SalaryMode = "StartingAt";
            }
            job.UpdatedAt = DateTime.UtcNow;

            // Keep the existing structured metadata, IsFeatured, IsActive,
            // PublicationStatus, owner, and CreatedAt untouched.
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Replace the structured discovery metadata without breaking the legacy
        // title/company/description update contract.
        [HttpPut("{id:int}/metadata")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> UpdateJobMetadata(
            int id,
            [FromBody] UpdateJobMetadataRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var job = await _context.Jobs.FirstOrDefaultAsync(item =>
                item.Id == id && item.CreatedByUserId == userId);

            if (job == null)
            {
                return NotFound(new
                {
                    message = "Job not found or you do not own this job."
                });
            }

            var metadataError = ValidateMetadata(
                request.MinimumExperienceYears,
                request.MaximumExperienceYears,
                request.Salary,
                request.SalaryMax,
                request.SalaryMode,
                request.WorkMode);

            if (metadataError != null)
            {
                return BadRequest(new { message = metadataError });
            }

            job.Category = Clean(request.Category);
            job.WorkMode = NormalizeWorkMode(request.WorkMode);
            job.ExperienceLevel = Clean(request.ExperienceLevel);
            job.EducationRequirement = Clean(request.EducationRequirement);
            job.MinimumExperienceYears = request.MinimumExperienceYears;
            job.MaximumExperienceYears = request.MaximumExperienceYears;
            job.Salary = request.Salary;
            job.SalaryMax = request.SalaryMax;
            job.SalaryMode = NormalizeSalaryMode(request.SalaryMode);
            job.SalaryCurrency = request.SalaryCurrency.Trim().ToUpperInvariant();
            job.SalaryPeriod = NormalizeSalaryPeriod(request.SalaryPeriod);
            job.Responsibilities = Clean(request.Responsibilities);
            job.Requirements = Clean(request.Requirements);
            job.Benefits = Clean(request.Benefits);
            job.ApplicationDeadlineUtc = ToUtc(request.ApplicationDeadlineUtc);
            job.RequireResume = request.RequireResume;
            job.UpdatedAt = DateTime.UtcNow;

            NormalizeSalary(job);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // HR owners can close/reopen their own published job.
        // Closed jobs remain available through their direct details URL.
        [HttpPut("{id:int}/availability")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> UpdateJobAvailability(
            int id,
            [FromBody] UpdateJobAvailabilityRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var job = await _context.Jobs.FirstOrDefaultAsync(item =>
                item.Id == id && item.CreatedByUserId == userId);

            if (job == null)
            {
                return NotFound(new
                {
                    message = "Job not found or you do not own this job."
                });
            }

            if (request.IsActive && job.ApplicationDeadlineUtc.HasValue &&
                job.ApplicationDeadlineUtc.Value <= DateTime.UtcNow)
            {
                return Conflict(new
                {
                    message = "This job's application deadline has passed. Update the deadline before reopening it."
                });
            }

            job.IsActive = request.IsActive;
            job.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Admin alone controls homepage featuring.
        [HttpPut("{id:int}/featured")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SetJobFeatured(
            int id,
            [FromBody] SetJobFeaturedRequest request)
        {
            var job = await _context.Jobs.FirstOrDefaultAsync(item => item.Id == id);
            if (job == null)
            {
                return NotFound();
            }

            if (request.IsFeatured &&
                (job.PublicationStatus != "Published" ||
                 !job.IsActive ||
                 (job.ApplicationDeadlineUtc.HasValue &&
                  job.ApplicationDeadlineUtc.Value <= DateTime.UtcNow)))
            {
                return Conflict(new
                {
                    message = "Only active, published jobs with an open application window can be featured."
                });
            }

            job.IsFeatured = request.IsFeatured;
            job.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Existing destructive delete contract retained for compatibility.
        // The HR management UI should prefer the availability endpoint to close jobs
        // so applications and interview history remain available.
        [HttpDelete("{id:int}")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> DeleteJob(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var job = await _context.Jobs.FirstOrDefaultAsync(item =>
                item.Id == id && item.CreatedByUserId == userId);

            if (job == null)
            {
                return NotFound(new
                {
                    message = "Job not found or you do not own this job."
                });
            }

            _context.Jobs.Remove(job);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Approved HR who own a job can view its applicants only.
        [HttpGet("job/{jobId:int}")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<ActionResult<IEnumerable<JobApplication>>> GetApplicationsByJob(
            int jobId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var job = await _context.Jobs.FirstOrDefaultAsync(item =>
                item.Id == jobId && item.CreatedByUserId == userId);

            if (job == null)
            {
                return NotFound(new
                {
                    message = "Job not found or you do not own this job."
                });
            }

            var applications = await _context.JobApplications
                .Where(application => application.JobId == jobId)
                .OrderByDescending(application => application.AppliedAt)
                .ToListAsync();

            return Ok(applications);
        }

        private static string? ValidateMetadata(
            int? minimumExperience,
            int? maximumExperience,
            decimal salary,
            decimal? salaryMax,
            string? salaryMode,
            string? workMode)
        {
            if (minimumExperience.HasValue && maximumExperience.HasValue &&
                maximumExperience.Value < minimumExperience.Value)
            {
                return "Maximum experience cannot be lower than minimum experience.";
            }

            if (salary < 0 || (salaryMax.HasValue && salaryMax.Value < 0))
            {
                return "Salary values cannot be negative.";
            }

            var normalizedSalaryMode = salaryMode?.Trim();
            if (!AllowedSalaryModes.Any(value =>
                    string.Equals(value, normalizedSalaryMode, StringComparison.OrdinalIgnoreCase)))
            {
                return "Select a valid salary display mode.";
            }

            var normalizedWorkMode = workMode?.Trim();
            if (!AllowedWorkModes.Any(value =>
                    string.Equals(value, normalizedWorkMode, StringComparison.OrdinalIgnoreCase)))
            {
                return "Select a valid work mode.";
            }

            if (string.Equals(normalizedSalaryMode, "Range", StringComparison.OrdinalIgnoreCase) &&
                salaryMax.HasValue &&
                salaryMax.Value < salary)
            {
                return "Maximum salary cannot be lower than the minimum salary.";
            }

            return null;
        }

        private static void NormalizeSalary(Job job)
        {
            job.SalaryMode = NormalizeSalaryMode(job.SalaryMode);
            if (job.SalaryMode is "Negotiable" or "NotDisclosed" || job.Salary <= 0)
            {
                job.Salary = 0;
                job.SalaryMax = null;
                if (job.SalaryMode is "Range" or "StartingAt")
                {
                    job.SalaryMode = "NotDisclosed";
                }
            }
            else if (job.SalaryMode == "StartingAt")
            {
                job.SalaryMax = null;
            }
        }

        private static void NormalizeMetadata(Job job)
        {
            job.Category = Clean(job.Category);
            job.WorkMode = NormalizeWorkMode(job.WorkMode);
            job.ExperienceLevel = Clean(job.ExperienceLevel);
            job.EducationRequirement = Clean(job.EducationRequirement);
            job.SalaryCurrency = string.IsNullOrWhiteSpace(job.SalaryCurrency)
                ? "INR"
                : job.SalaryCurrency.Trim().ToUpperInvariant();
            job.SalaryPeriod = NormalizeSalaryPeriod(job.SalaryPeriod);
            job.Responsibilities = Clean(job.Responsibilities);
            job.Requirements = Clean(job.Requirements);
            job.Benefits = Clean(job.Benefits);
        }

        private static string NormalizeSalaryMode(string? value)
        {
            var trimmed = value?.Trim();
            return AllowedSalaryModes.FirstOrDefault(item =>
                       string.Equals(item, trimmed, StringComparison.OrdinalIgnoreCase))
                   ?? "Range";
        }

        private static string NormalizeWorkMode(string? value)
        {
            var trimmed = value?.Trim();
            return AllowedWorkModes.FirstOrDefault(item =>
                       string.Equals(item, trimmed, StringComparison.OrdinalIgnoreCase))
                   ?? "Not specified";
        }

        private static string NormalizeSalaryPeriod(string? value)
        {
            var allowed = new[] { "Yearly", "Monthly", "Weekly", "Hourly" };
            var trimmed = value?.Trim();
            return allowed.FirstOrDefault(item =>
                       string.Equals(item, trimmed, StringComparison.OrdinalIgnoreCase))
                   ?? "Monthly";
        }

        private static DateTime? ToUtc(DateTime? value)
        {
            if (!value.HasValue)
            {
                return null;
            }

            return value.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
                : value.Value.ToUniversalTime();
        }

        private static string? Clean(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
    }
}
