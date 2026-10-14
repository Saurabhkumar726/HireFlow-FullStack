using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HireFlow.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class JobApplicationsController : ControllerBase
    {
        private readonly HireFlowDbContext _context;

        public JobApplicationsController(HireFlowDbContext context)
        {
            _context = context;
        }

        // GET: api/JobApplications
        // Students see their own applications.
        // Approved HR sees applications for their own jobs.
        [HttpGet]
        public async Task<ActionResult<IEnumerable<JobApplication>>> GetApplications()
        {
            if (User.IsInRole("Admin"))
            {
                return Forbid();
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            if (User.IsInRole("HR"))
            {
                if (!User.HasClaim("is_active", "true"))
                {
                    return Forbid();
                }

                return await _context.JobApplications
                    .Where(a => a.Job != null &&
                                a.Job.CreatedByUserId == userId)
                    .OrderByDescending(a => a.AppliedAt)
                    .ToListAsync();
            }

            if (!User.IsInRole("Student"))
            {
                return Forbid();
            }

            return await _context.JobApplications
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.AppliedAt)
                .ToListAsync();
        }

        // GET: api/JobApplications/{id}
        // Students see their own application.
        // HR sees an application only if they own its job.
        [HttpGet("{id:int}")]
        public async Task<ActionResult<JobApplication>> GetApplication(int id)
        {
            var application = await _context.JobApplications
                .Include(a => a.Job)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (application == null)
            {
                return NotFound();
            }

            if (User.IsInRole("Admin"))
            {
                return Forbid();
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            if (User.IsInRole("HR"))
            {
                if (!User.HasClaim("is_active", "true"))
                {
                    return Forbid();
                }

                if (application.Job == null ||
                    application.Job.CreatedByUserId != userId)
                {
                    return NotFound();
                }

                return application;
            }

            if (!User.IsInRole("Student"))
            {
                return Forbid();
            }

            if (application.UserId != userId)
            {
                return Forbid();
            }

            return application;
        }

        // POST: api/JobApplications
        // Only authenticated students can apply.
        [HttpPost]
        [Authorize(Roles = "Student")]
        public async Task<ActionResult<JobApplication>> CreateApplication(
            [FromBody] CreateJobApplicationRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var applicantName = User.FindFirstValue(ClaimTypes.Name);
            var applicantEmail = User.FindFirstValue(ClaimTypes.Email);

            if (string.IsNullOrWhiteSpace(userId) ||
                string.IsNullOrWhiteSpace(applicantEmail))
            {
                return Unauthorized(new
                {
                    message = "Required user information is missing from the token."
                });
            }

            var jobExists = await _context.Jobs
                .AnyAsync(j => j.Id == request.JobId);

            if (!jobExists)
            {
                return BadRequest(new
                {
                    message = "The specified job does not exist."
                });
            }

            var alreadyApplied = await _context.JobApplications
                .AnyAsync(a => a.JobId == request.JobId &&
                               a.UserId == userId);

            if (alreadyApplied)
            {
                return Conflict(new
                {
                    message = "You have already applied for this job."
                });
            }

            var application = new JobApplication
            {
                JobId = request.JobId,
                UserId = userId,
                ApplicantName = applicantName ?? applicantEmail,
                ApplicantEmail = applicantEmail,
                CoverLetter = request.CoverLetter?.Trim() ?? string.Empty,
                Status = "Pending",
                AppliedAt = DateTime.UtcNow
            };

            _context.JobApplications.Add(application);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetApplication),
                new { id = application.Id },
                application);
        }

        // GET: api/JobApplications/job/{jobId}
        // Approved HR can view applications for their own job only.
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

            var ownsJob = await _context.Jobs
                .AnyAsync(j => j.Id == jobId &&
                               j.CreatedByUserId == userId);

            if (!ownsJob)
            {
                return NotFound(new
                {
                    message = "Job not found or you do not own this job."
                });
            }

            return await _context.JobApplications
                .Where(a => a.JobId == jobId)
                .OrderByDescending(a => a.AppliedAt)
                .ToListAsync();
        }

        // PUT: api/JobApplications/{id}/status
        // Approved HR can update status only for applications
        // belonging to their own jobs.
        [HttpPut("{id:int}/status")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> UpdateApplicationStatus(
            int id,
            [FromBody] string status)
        {
            var allowedStatuses = new[]
            {
                "Pending",
                "Reviewed",
                "Shortlisted",
                "Rejected"
            };

            if (string.IsNullOrWhiteSpace(status) ||
                !allowedStatuses.Contains(
                    status,
                    StringComparer.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message = "Invalid application status."
                });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var application = await _context.JobApplications
                .Include(a => a.Job)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (application == null)
            {
                return NotFound();
            }

            if (application.Job == null ||
                application.Job.CreatedByUserId != userId)
            {
                return NotFound(new
                {
                    message = "Application not found or you do not own its job."
                });
            }

            application.Status = allowedStatuses.First(
                s => string.Equals(
                    s,
                    status,
                    StringComparison.OrdinalIgnoreCase));

            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
