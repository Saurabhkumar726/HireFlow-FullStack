
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using HireFlow.Api.Data;
using HireFlow.Api.Models;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "ApprovedHR")]
    public class InterviewsController : ControllerBase
    {
        private readonly HireFlowDbContext _context;
        private readonly IEmailService _emailService;
        private readonly ILogger<InterviewsController> _logger;

        public InterviewsController(
            HireFlowDbContext context,
            IEmailService emailService,
            ILogger<InterviewsController> logger)
        {
            _context = context;
            _emailService = emailService;
            _logger = logger;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");
        }

        private static readonly string[] AllowedStatuses =
        {
            "Scheduled",
            "Completed",
            "Cancelled"
        };

        private static readonly string[] AllowedInterviewTypes =
        {
            "Online",
            "In-person",
            "Phone"
        };

        // GET: api/Interviews
        // Returns interviews belonging to the current HR user's jobs.
        [HttpGet]
        public async Task<IActionResult> GetInterviews()
        {
            var userId = GetCurrentUserId();

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var interviews = await (
                from interview in _context.Interviews.AsNoTracking()
                join application in _context.JobApplications.AsNoTracking()
                    on interview.JobApplicationId equals application.Id
                join job in _context.Jobs.AsNoTracking()
                    on application.JobId equals job.Id
                where job.CreatedByUserId == userId
                orderby interview.ScheduledAt descending
                select new
                {
                    interview.Id,
                    interview.JobApplicationId,
                    interview.ScheduledAt,
                    interview.InterviewType,
                    interview.MeetingLink,
                    interview.Notes,
                    interview.Status,
                    interview.CreatedAt,
                    interview.UpdatedAt,
                    JobId = job.Id,
                    JobTitle = job.Title,
                    application.ApplicantName,
                    application.ApplicantEmail,
                    ApplicationStatus = application.Status
                }
            ).ToListAsync();

            return Ok(interviews);
        }

        // GET: api/Interviews/5
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetInterview(int id)
        {
            var userId = GetCurrentUserId();

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var interview = await (
                from item in _context.Interviews.AsNoTracking()
                join application in _context.JobApplications.AsNoTracking()
                    on item.JobApplicationId equals application.Id
                join job in _context.Jobs.AsNoTracking()
                    on application.JobId equals job.Id
                where item.Id == id && job.CreatedByUserId == userId
                select new
                {
                    item.Id,
                    item.JobApplicationId,
                    item.ScheduledAt,
                    item.InterviewType,
                    item.MeetingLink,
                    item.Notes,
                    item.Status,
                    item.CreatedAt,
                    item.UpdatedAt,
                    JobId = job.Id,
                    JobTitle = job.Title,
                    application.ApplicantName,
                    application.ApplicantEmail,
                    ApplicationStatus = application.Status
                }
            ).FirstOrDefaultAsync();

            if (interview == null)
            {
                return NotFound(new
                {
                    message = "Interview not found."
                });
            }

            return Ok(interview);
        }

        // POST: api/Interviews
        [HttpPost]
        public async Task<IActionResult> CreateInterview(
            [FromBody] CreateInterviewRequest request)
        {
            var userId = GetCurrentUserId();

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            // Check that the application belongs to a job owned by this HR user.
            // The explicit null check avoids dereferencing a missing Job navigation.
            var application = await _context.JobApplications
                .AsNoTracking()
                .Where(item => item.Id == request.JobApplicationId)
                .Select(item => new
                {
                    item.Id,
                    item.JobId,
                    item.ApplicantName,
                    item.ApplicantEmail,
                    JobTitle = item.Job != null ? item.Job.Title : "HireFlow opportunity",
                    CreatedByUserId = item.Job != null
                        ? item.Job.CreatedByUserId
                        : null
                })
                .FirstOrDefaultAsync();

            if (application == null ||
                application.CreatedByUserId != userId)
            {
                return NotFound(new
                {
                    message = "Job application not found."
                });
            }

            if (!AllowedInterviewTypes.Contains(
                request.InterviewType,
                StringComparer.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message = "Interview type must be Online, In-person, or Phone."
                });
            }

            var interviewType = AllowedInterviewTypes.First(
                type => string.Equals(
                    type,
                    request.InterviewType,
                    StringComparison.OrdinalIgnoreCase));

            var scheduledAt = request.ScheduledAt;

            if (scheduledAt <= DateTime.UtcNow)
            {
                return BadRequest(new
                {
                    message = "Please choose a future interview date and time."
                });
            }

            var interview = new Interview
            {
                JobApplicationId = request.JobApplicationId,
                ScheduledAt = scheduledAt,
                InterviewType = interviewType,
                MeetingLink = request.MeetingLink?.Trim(),
                Notes = request.Notes?.Trim(),
                Status = "Scheduled",
                CreatedAt = DateTime.UtcNow
            };

            _context.Interviews.Add(interview);
            await _context.SaveChangesAsync();

            // Email is sent only after the interview has been saved. An email failure
            // does not roll back or misreport the successfully saved interview.
            var emailSent = false;
            string? emailMessage = null;

            if (!string.IsNullOrWhiteSpace(application.ApplicantEmail))
            {
                try
                {
                    await _emailService.SendInterviewConfirmationAsync(
                        application.ApplicantEmail,
                        application.ApplicantName,
                        application.JobTitle,
                        interview.ScheduledAt,
                        interview.InterviewType,
                        interview.MeetingLink,
                        interview.Notes);

                    emailSent = true;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Interview {InterviewId} was saved, but confirmation email could not be sent to {Recipient}.",
                        interview.Id,
                        application.ApplicantEmail);
                    emailMessage = "Interview saved, but the confirmation email could not be sent. Check the API logs and Gmail SMTP configuration.";
                }
            }
            else
            {
                emailMessage = "Interview saved, but the candidate has no email address on the application.";
            }

            return CreatedAtAction(
                nameof(GetInterview),
                new { id = interview.Id },
                new
                {
                    message = emailSent
                        ? "Interview scheduled successfully. Confirmation email sent."
                        : "Interview scheduled successfully.",
                    emailSent,
                    emailMessage,
                    interview.Id,
                    interview.JobApplicationId,
                    interview.ScheduledAt,
                    interview.InterviewType,
                    interview.MeetingLink,
                    interview.Notes,
                    interview.Status,
                    interview.CreatedAt
                });
        }

        // PUT: api/Interviews/5
        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateInterview(
            int id,
            [FromBody] UpdateInterviewRequest request)
        {
            var userId = GetCurrentUserId();

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var interview = await _context.Interviews
                .Include(item => item.JobApplication)
                .ThenInclude(application => application!.Job)
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    item.JobApplication != null &&
                    item.JobApplication.Job != null &&
                    item.JobApplication.Job.CreatedByUserId == userId);

            if (interview == null)
            {
                return NotFound(new
                {
                    message = "Interview not found."
                });
            }

            if (!AllowedInterviewTypes.Contains(
                request.InterviewType,
                StringComparer.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message = "Interview type must be Online, In-person, or Phone."
                });
            }

            var validStatus = AllowedStatuses.FirstOrDefault(
                status => string.Equals(
                    status,
                    request.Status,
                    StringComparison.OrdinalIgnoreCase));

            if (validStatus == null)
            {
                return BadRequest(new
                {
                    message = "Status must be Scheduled, Completed, or Cancelled."
                });
            }

            if (validStatus == "Scheduled" &&
                request.ScheduledAt <= DateTime.UtcNow)
            {
                return BadRequest(new
                {
                    message = "A scheduled interview must have a future date and time."
                });
            }

            // Keep the previous details so we can email the applicant only when
            // an important interview detail changes.
            var previousScheduledAt = interview.ScheduledAt;
            var previousInterviewType = interview.InterviewType;
            var previousMeetingLink = interview.MeetingLink;
            var previousStatus = interview.Status;

            var updatedInterviewType = AllowedInterviewTypes.First(
                type => string.Equals(
                    type,
                    request.InterviewType,
                    StringComparison.OrdinalIgnoreCase));
            var updatedMeetingLink = request.MeetingLink?.Trim();

            var scheduleDetailsChanged =
                previousScheduledAt != request.ScheduledAt ||
                !string.Equals(previousInterviewType, updatedInterviewType, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(previousMeetingLink?.Trim(), updatedMeetingLink, StringComparison.Ordinal);

            interview.ScheduledAt = request.ScheduledAt;
            interview.InterviewType = updatedInterviewType;
            interview.MeetingLink = updatedMeetingLink;
            interview.Notes = request.Notes?.Trim();
            interview.Status = validStatus;
            interview.UpdatedAt = DateTime.UtcNow;

            // Save first. If email delivery fails, the interview changes remain saved.
            await _context.SaveChangesAsync();

            var emailSent = false;
            string? emailMessage = null;
            var application = interview.JobApplication;
            var jobTitle = application?.Job?.Title ?? "HireFlow opportunity";
            var applicantEmail = application?.ApplicantEmail;
            var applicantName = application?.ApplicantName ?? "Applicant";

            // Send an update only if a meaningful schedule detail changed and the
            // interview remains scheduled. Notes-only edits do not trigger email.
            if (scheduleDetailsChanged && validStatus == "Scheduled")
            {
                if (!string.IsNullOrWhiteSpace(applicantEmail))
                {
                    try
                    {
                        await _emailService.SendInterviewConfirmationAsync(
                            applicantEmail,
                            applicantName,
                            jobTitle,
                            interview.ScheduledAt,
                            interview.InterviewType,
                            interview.MeetingLink,
                            interview.Notes);

                        emailSent = true;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex,
                            "Interview {InterviewId} was updated, but the update email could not be sent to {Recipient}.",
                            interview.Id,
                            applicantEmail);
                        emailMessage = "Interview updated, but the email could not be sent. Check the API logs and Gmail SMTP configuration.";
                    }
                }
                else
                {
                    emailMessage = "Interview updated, but the candidate has no email address on the application.";
                }
            }

            return Ok(new
            {
                message = emailSent
                    ? "Interview updated successfully. Updated details email sent."
                    : "Interview updated successfully.",
                emailSent,
                emailMessage,
                interview.Id,
                interview.JobApplicationId,
                interview.ScheduledAt,
                interview.InterviewType,
                interview.MeetingLink,
                interview.Notes,
                interview.Status,
                interview.UpdatedAt
            });
        }

        // DELETE: api/Interviews/5
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteInterview(int id)
        {
            var userId = GetCurrentUserId();

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var interview = await _context.Interviews
                .Include(item => item.JobApplication)
                .ThenInclude(application => application!.Job)
                .FirstOrDefaultAsync(item =>
                    item.Id == id &&
                    item.JobApplication != null &&
                    item.JobApplication.Job != null &&
                    item.JobApplication.Job.CreatedByUserId == userId);

            if (interview == null)
            {
                return NotFound(new
                {
                    message = "Interview not found."
                });
            }

            _context.Interviews.Remove(interview);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Interview deleted successfully."
            });
        }
    }

    public class CreateInterviewRequest
    {
        [Range(1, int.MaxValue)]
        public int JobApplicationId { get; set; }

        [Required]
        public DateTime ScheduledAt { get; set; }

        [Required]
        [MaxLength(100)]
        public string InterviewType { get; set; } = "Online";

        [MaxLength(500)]
        public string? MeetingLink { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }
    }

    public class UpdateInterviewRequest
    {
        [Required]
        public DateTime ScheduledAt { get; set; }

        [Required]
        [MaxLength(100)]
        public string InterviewType { get; set; } = "Online";

        [MaxLength(500)]
        public string? MeetingLink { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Scheduled";
    }
}
