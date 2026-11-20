using System.ComponentModel.DataAnnotations;
using System.Net;
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
                    interview.CandidateResponseStatus,
                    interview.CandidateResponseAtUtc,
                    interview.CandidateResponseNote,
                    interview.ProposedScheduledAtUtc,
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
                    item.CandidateResponseStatus,
                    item.CandidateResponseAtUtc,
                    item.CandidateResponseNote,
                    item.ProposedScheduledAtUtc,
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

            // Load the owning application so its recruitment stage can be updated
            // together with the interview record.
            var application = await _context.JobApplications
                .Include(item => item.Job)
                .FirstOrDefaultAsync(item => item.Id == request.JobApplicationId);

            if (application == null || application.Job?.CreatedByUserId != userId)
            {
                return NotFound(new
                {
                    message = "Job application not found."
                });
            }

            if (new[] { "Selected", "Rejected", "Withdrawn" }.Contains(
                application.Status, StringComparer.OrdinalIgnoreCase))
            {
                return Conflict(new
                {
                    message = "An interview cannot be scheduled for an application that is Selected, Rejected, or Withdrawn."
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

            if (!IsSafeHttpUrl(request.MeetingLink))
            {
                return BadRequest(new { message = "Meeting links must be absolute HTTP or HTTPS URLs." });
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

            var previousApplicationStatus = application.Status;
            application.Status = "Interview Scheduled";
            application.LastUpdatedAtUtc = DateTime.UtcNow;

            if (!string.Equals(previousApplicationStatus, "Interview Scheduled", StringComparison.OrdinalIgnoreCase))
            {
                _context.JobApplicationStatusHistory.Add(new JobApplicationStatusHistory
                {
                    JobApplicationId = application.Id,
                    PreviousStatus = previousApplicationStatus,
                    NewStatus = "Interview Scheduled",
                    ChangedByUserId = userId,
                    ChangedByRole = "HR",
                    ChangedAtUtc = DateTime.UtcNow
                });
            }

            _context.Interviews.Add(interview);

            await NotificationWriter.AddInAppAsync(
                _context,
                application.UserId,
                "InterviewScheduled",
                "Interview scheduled",
                $"An interview for {application.Job?.Title ?? "your application"} has been scheduled for {interview.ScheduledAt.ToLocalTime():dd MMM yyyy, hh:mm tt}.",
                "/candidate/interviews",
                "Interview",
                null);

            await _context.SaveChangesAsync();

            // Email is sent only after the interview has been saved. An email failure
            // does not roll back or misreport the successfully saved interview.
            var emailSent = false;
            string? emailMessage = null;

            var applicantEmail = application.ApplicantEmail;
            var jobTitle = application.Job?.Title ?? "HireFlow opportunity";
            if (!string.IsNullOrWhiteSpace(applicantEmail))
            {
                var emailAllowed = await IsInterviewEmailEnabledAsync(application.UserId);
                if (!emailAllowed)
                {
                    emailMessage = "Interview saved. The candidate has disabled interview email notifications.";
                }
                else
                {
                    try
                    {
                        await _emailService.SendInterviewConfirmationAsync(
                            applicantEmail,
                            application.ApplicantName,
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
                            "Interview {InterviewId} was saved, but confirmation email could not be sent to {Recipient}; queuing a retry.",
                            interview.Id,
                            applicantEmail);
                        NotificationWriter.AddEmailOnly(
                            _context,
                            applicantEmail,
                            "Interview scheduled | HireFlow",
                            BuildInterviewEmailBody(application.ApplicantName, jobTitle, interview),
                            $"interview-confirmation-{interview.Id}-created");
                        await _context.SaveChangesAsync();
                        emailMessage = "Interview saved. Confirmation email has been queued for retry.";
                    }
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

            if (!IsSafeHttpUrl(request.MeetingLink))
            {
                return BadRequest(new { message = "Meeting links must be absolute HTTP or HTTPS URLs." });
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
            var previousInterviewStatus = interview.Status;

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

            if (validStatus == "Scheduled" &&
                (scheduleDetailsChanged || !string.Equals(previousInterviewStatus, "Scheduled", StringComparison.OrdinalIgnoreCase)))
            {
                // A new schedule must receive a fresh candidate decision.
                interview.CandidateResponseStatus = "Pending";
                interview.CandidateResponseAtUtc = null;
                interview.CandidateResponseNote = null;
                interview.ProposedScheduledAtUtc = null;
            }

            var application = interview.JobApplication;
            if (application != null &&
                !new[] { "Selected", "Rejected", "Withdrawn" }.Contains(application.Status, StringComparer.OrdinalIgnoreCase))
            {
                if (validStatus == "Scheduled" && !string.Equals(application.Status, "Interview Scheduled", StringComparison.OrdinalIgnoreCase))
                {
                    var previousApplicationStatus = application.Status;
                    application.Status = "Interview Scheduled";
                    application.LastUpdatedAtUtc = DateTime.UtcNow;
                    _context.JobApplicationStatusHistory.Add(new JobApplicationStatusHistory
                    {
                        JobApplicationId = application.Id,
                        PreviousStatus = previousApplicationStatus,
                        NewStatus = "Interview Scheduled",
                        ChangedByUserId = userId,
                        ChangedByRole = "HR",
                        ChangedAtUtc = DateTime.UtcNow
                    });
                }
                else if (validStatus == "Cancelled" && string.Equals(application.Status, "Interview Scheduled", StringComparison.OrdinalIgnoreCase))
                {
                    var anotherScheduledInterview = await _context.Interviews.AnyAsync(item =>
                        item.JobApplicationId == application.Id &&
                        item.Id != interview.Id &&
                        item.Status == "Scheduled");

                    if (!anotherScheduledInterview)
                    {
                        var previousStage = await _context.JobApplicationStatusHistory
                            .Where(item => item.JobApplicationId == application.Id && item.NewStatus != "Interview Scheduled")
                            .OrderByDescending(item => item.ChangedAtUtc)
                            .Select(item => item.NewStatus)
                            .FirstOrDefaultAsync() ?? "Shortlisted";

                        application.Status = previousStage;
                        application.LastUpdatedAtUtc = DateTime.UtcNow;
                        _context.JobApplicationStatusHistory.Add(new JobApplicationStatusHistory
                        {
                            JobApplicationId = application.Id,
                            PreviousStatus = "Interview Scheduled",
                            NewStatus = previousStage,
                            Reason = "The scheduled interview was cancelled.",
                            ChangedByUserId = userId,
                            ChangedByRole = "HR",
                            ChangedAtUtc = DateTime.UtcNow
                        });
                    }
                }
            }

            // Notify the Student in-app when the schedule changes, is cancelled, or is completed.
            if (application != null && !string.IsNullOrWhiteSpace(application.UserId))
            {
                if (validStatus == "Cancelled" && !string.Equals(previousInterviewStatus, "Cancelled", StringComparison.OrdinalIgnoreCase))
                {
                    await NotificationWriter.AddInAppAsync(
                        _context,
                        application.UserId,
                        "InterviewCancelled",
                        "Interview cancelled",
                        $"The interview for {application.Job?.Title ?? "your application"} has been cancelled by the recruiter.",
                        "/candidate/interviews",
                        "Interview",
                        interview.Id);
                }
                else if (validStatus == "Scheduled" &&
                         (scheduleDetailsChanged || !string.Equals(previousInterviewStatus, "Scheduled", StringComparison.OrdinalIgnoreCase)))
                {
                    await NotificationWriter.AddInAppAsync(
                        _context,
                        application.UserId,
                        "InterviewUpdated",
                        scheduleDetailsChanged ? "Interview rescheduled" : "Interview scheduled",
                        $"The interview for {application.Job?.Title ?? "your application"} is scheduled for {interview.ScheduledAt.ToLocalTime():dd MMM yyyy, hh:mm tt}.",
                        "/candidate/interviews",
                        "Interview",
                        interview.Id);
                }
                else if (validStatus == "Completed" && !string.Equals(previousInterviewStatus, "Completed", StringComparison.OrdinalIgnoreCase))
                {
                    await NotificationWriter.AddInAppAsync(
                        _context,
                        application.UserId,
                        "InterviewCompleted",
                        "Interview marked completed",
                        $"Your interview for {application.Job?.Title ?? "this job"} has been marked as completed.",
                        "/candidate/interviews",
                        "Interview",
                        interview.Id);
                }
            }

            // Save first. If email delivery fails, the interview changes remain saved.
            await _context.SaveChangesAsync();

            var emailSent = false;
            string? emailMessage = null;
            var jobTitle = application?.Job?.Title ?? "HireFlow opportunity";
            var applicantEmail = application?.ApplicantEmail;
            var applicantName = application?.ApplicantName ?? "Applicant";

            // Send an update only if a meaningful schedule detail changed and the
            // interview remains scheduled. Notes-only edits do not trigger email.
            if ((scheduleDetailsChanged || !string.Equals(previousInterviewStatus, "Scheduled", StringComparison.OrdinalIgnoreCase)) && validStatus == "Scheduled")
            {
                if (!string.IsNullOrWhiteSpace(applicantEmail))
                {
                    var emailAllowed = await IsInterviewEmailEnabledAsync(application?.UserId);
                    if (!emailAllowed)
                    {
                        emailMessage = "Interview updated. The candidate has disabled interview email notifications.";
                    }
                    else
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
                                "Interview {InterviewId} was updated, but the update email could not be sent to {Recipient}; queuing a retry.",
                                interview.Id,
                                applicantEmail);
                            NotificationWriter.AddEmailOnly(
                                _context,
                                applicantEmail,
                                "Interview updated | HireFlow",
                                BuildInterviewEmailBody(applicantName, jobTitle, interview),
                                $"interview-confirmation-{interview.Id}-{interview.ScheduledAt.Ticks}");
                            await _context.SaveChangesAsync();
                            emailMessage = "Interview updated. Confirmation email has been queued for retry.";
                        }
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

            if (string.Equals(interview.Status, "Cancelled", StringComparison.OrdinalIgnoreCase))
            {
                return Ok(new { message = "This interview is already cancelled.", status = "Cancelled" });
            }

            interview.Status = "Cancelled";
            interview.UpdatedAt = DateTime.UtcNow;

            var application = interview.JobApplication;
            if (application != null && string.Equals(application.Status, "Interview Scheduled", StringComparison.OrdinalIgnoreCase))
            {
                var anotherScheduledInterview = await _context.Interviews.AnyAsync(item =>
                    item.JobApplicationId == application.Id &&
                    item.Id != interview.Id &&
                    item.Status == "Scheduled");

                if (!anotherScheduledInterview)
                {
                    var previousStage = await _context.JobApplicationStatusHistory
                        .Where(item => item.JobApplicationId == application.Id && item.NewStatus != "Interview Scheduled")
                        .OrderByDescending(item => item.ChangedAtUtc)
                        .Select(item => item.NewStatus)
                        .FirstOrDefaultAsync() ?? "Shortlisted";

                    application.Status = previousStage;
                    application.LastUpdatedAtUtc = DateTime.UtcNow;
                    _context.JobApplicationStatusHistory.Add(new JobApplicationStatusHistory
                    {
                        JobApplicationId = application.Id,
                        PreviousStatus = "Interview Scheduled",
                        NewStatus = previousStage,
                        Reason = "The scheduled interview was cancelled.",
                        ChangedByUserId = userId,
                        ChangedByRole = "HR",
                        ChangedAtUtc = DateTime.UtcNow
                    });
                }
            }

            await NotificationWriter.AddInAppAsync(
                _context,
                application?.UserId,
                "InterviewCancelled",
                "Interview cancelled",
                $"The interview for {application?.Job?.Title ?? "your application"} has been cancelled by the recruiter.",
                "/candidate/interviews",
                "Interview",
                interview.Id);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Interview cancelled and retained in interview history.",
                status = "Cancelled"
            });
        }

        private async Task<bool> IsInterviewEmailEnabledAsync(string? candidateUserId)
        {
            // Legacy applications without a linked user ID still use their application email.
            if (string.IsNullOrWhiteSpace(candidateUserId)) return true;
            var preference = await _context.NotificationPreferences.AsNoTracking()
                .FirstOrDefaultAsync(item => item.UserId == candidateUserId);
            return preference?.EmailEnabled != false && preference?.InterviewEmailEnabled != false;
        }

        private static string BuildInterviewEmailBody(string applicantName, string jobTitle, Interview interview)
        {
            var name = WebUtility.HtmlEncode(applicantName);
            var job = WebUtility.HtmlEncode(jobTitle);
            var date = WebUtility.HtmlEncode(interview.ScheduledAt.ToLocalTime().ToString("dd MMM yyyy, hh:mm tt"));
            var type = WebUtility.HtmlEncode(interview.InterviewType);
            var safeMeetingLink = IsSafeHttpUrl(interview.MeetingLink) ? interview.MeetingLink : null;
            var link = string.IsNullOrWhiteSpace(safeMeetingLink)
                ? string.Empty
                : $"<p><strong>Meeting link:</strong> <a href=\"{WebUtility.HtmlEncode(safeMeetingLink)}\">Join interview</a></p>";
            var notes = string.IsNullOrWhiteSpace(interview.Notes)
                ? string.Empty
                : $"<p><strong>Notes:</strong> {WebUtility.HtmlEncode(interview.Notes)}</p>";
            return $"<p>Hello {name},</p><p>Your interview for <strong>{job}</strong> is scheduled for <strong>{date}</strong>.</p><p>Interview type: {type}</p>{link}{notes}<p>— HireFlow</p>";
        }

        private static bool IsSafeHttpUrl(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return true;
            return Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
                && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
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
}
