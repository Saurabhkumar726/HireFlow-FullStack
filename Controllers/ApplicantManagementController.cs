using System.Security.Claims;
using System.Text.Json;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers;

[ApiController]
[Route("api/ApplicantManagement")]
[Authorize(Policy = "ApprovedHR")]
public class ApplicantManagementController : ControllerBase
{
    private static readonly string[] EditableStatuses = ["Pending", "Under Review", "Shortlisted", "Interview Scheduled", "Selected", "Rejected"];
    private readonly HireFlowDbContext _context;
    private readonly ILiveEventsService _liveEvents;

    public ApplicantManagementController(HireFlowDbContext context, ILiveEventsService liveEvents)
    {
        _context = context;
        _liveEvents = liveEvents;
    }

    [HttpGet("pipeline-funnel")]
    public async Task<ActionResult<PipelineFunnelDto>> GetPipelineFunnel([FromQuery] int? jobId = null, CancellationToken cancellationToken = default)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var query = _context.JobApplications.AsNoTracking()
            .Include(item => item.Job)
            .Where(item => item.Job != null && item.Job.CreatedByUserId == userId);

        if (jobId.HasValue && jobId.Value > 0)
        {
            query = query.Where(item => item.JobId == jobId.Value);
        }

        var applications = await query.ToListAsync(cancellationToken);

        var total = applications.Count;
        var pending = applications.Count(a => string.Equals(a.Status, "Pending", StringComparison.OrdinalIgnoreCase));
        var underReview = applications.Count(a => string.Equals(a.Status, "Under Review", StringComparison.OrdinalIgnoreCase) || string.Equals(a.Status, "Reviewed", StringComparison.OrdinalIgnoreCase));
        var shortlisted = applications.Count(a => string.Equals(a.Status, "Shortlisted", StringComparison.OrdinalIgnoreCase));
        var interviewScheduled = applications.Count(a => string.Equals(a.Status, "Interview Scheduled", StringComparison.OrdinalIgnoreCase));
        var selected = applications.Count(a => string.Equals(a.Status, "Selected", StringComparison.OrdinalIgnoreCase));
        var rejected = applications.Count(a => string.Equals(a.Status, "Rejected", StringComparison.OrdinalIgnoreCase));
        var withdrawn = applications.Count(a => string.Equals(a.Status, "Withdrawn", StringComparison.OrdinalIgnoreCase));

        var divisor = Math.Max(1, total);
        var advancedPastPending = underReview + shortlisted + interviewScheduled + selected;
        var advancedPastReview = shortlisted + interviewScheduled + selected;
        var advancedToInterview = interviewScheduled + selected;

        var reasons = applications
            .Where(a => !string.IsNullOrWhiteSpace(a.RejectionReason))
            .GroupBy(a => a.RejectionReason!.Trim())
            .OrderByDescending(g => g.Count())
            .Take(5)
            .ToDictionary(g => g.Key, g => g.Count());

        var hireDurations = applications
            .Where(a => string.Equals(a.Status, "Selected", StringComparison.OrdinalIgnoreCase) && a.LastUpdatedAtUtc.HasValue)
            .Select(a => (a.LastUpdatedAtUtc!.Value - a.AppliedAt).TotalDays)
            .Where(days => days >= 0)
            .ToList();

        var avgDaysToHire = hireDurations.Count > 0 ? Math.Round(hireDurations.Average(), 1) : 4.5;

        return Ok(new PipelineFunnelDto
        {
            TotalApplicants = total,
            PendingCount = pending,
            UnderReviewCount = underReview,
            ShortlistedCount = shortlisted,
            InterviewScheduledCount = interviewScheduled,
            SelectedCount = selected,
            RejectedCount = rejected,
            WithdrawnCount = withdrawn,
            ReviewConversionRate = Math.Round((double)advancedPastPending / divisor * 100, 1),
            ShortlistConversionRate = Math.Round((double)advancedPastReview / divisor * 100, 1),
            InterviewConversionRate = Math.Round((double)advancedToInterview / divisor * 100, 1),
            OfferConversionRate = Math.Round((double)selected / divisor * 100, 1),
            AvgDaysToHire = avgDaysToHire,
            RejectionReasons = reasons
        });
    }

    [HttpPost("bulk-status")]
    public async Task<IActionResult> BulkUpdateStatus([FromBody] BulkUpdateApplicationsRequest request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var status = EditableStatuses.FirstOrDefault(item => string.Equals(item, request.Status?.Trim(), StringComparison.OrdinalIgnoreCase));
        if (status == null) return BadRequest(new { message = "Choose a supported application status." });
        if (status == "Rejected" && string.IsNullOrWhiteSpace(request.RejectionReason))
            return BadRequest(new { message = "A rejection reason is required for a bulk rejection." });

        var ids = request.ApplicationIds.Distinct().ToList();
        if (ids.Count == 0 || ids.Count > 200) return BadRequest(new { message = "Select between 1 and 200 applicants." });
        var applications = await _context.JobApplications.Include(item => item.Job)
            .Where(item => ids.Contains(item.Id) && item.Job != null && item.Job.CreatedByUserId == userId)
            .ToListAsync(cancellationToken);
        if (applications.Count != ids.Count)
            return NotFound(new { message = "One or more selected applications were not found in your own job postings." });

        if (applications.Any(item => string.Equals(item.Status, "Withdrawn", StringComparison.OrdinalIgnoreCase)
            || string.Equals(item.Status, "Selected", StringComparison.OrdinalIgnoreCase)))
            return Conflict(new { message = "Selected or withdrawn applications cannot be changed in bulk. Remove them from the selection and try again." });

        var now = DateTime.UtcNow;
        var updatedCount = 0;
        foreach (var application in applications)
        {
            var previous = application.Status;
            if (string.Equals(previous, status, StringComparison.OrdinalIgnoreCase)) continue;
            application.Status = status;
            application.RejectionReason = status == "Rejected" ? request.RejectionReason?.Trim() : null;
            application.LastUpdatedAtUtc = now;
            updatedCount++;
            _context.JobApplicationStatusHistory.Add(new JobApplicationStatusHistory
            {
                JobApplicationId = application.Id,
                PreviousStatus = previous,
                NewStatus = status,
                Reason = status == "Rejected" ? request.RejectionReason?.Trim() : null,
                ChangedByUserId = userId,
                ChangedByRole = "HR",
                ChangedAtUtc = now
            });
            if (!string.IsNullOrWhiteSpace(application.UserId))
            {
                await NotificationWriter.AddInAppAsync(_context, application.UserId,
                    "ApplicationStatusChanged", "Application status updated",
                    $"Your application for {application.Job?.Title ?? "this job"} is now {status}.",
                    "/candidate/applications", "Application", application.Id, cancellationToken);
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        if (updatedCount > 0)
        {
            _liveEvents.Publish(new LiveEventDto
            {
                Type = "StatusUpdated",
                Title = "Pipeline Status Updated",
                Message = $"{updatedCount} applicant(s) moved to '{status}'.",
                TargetRole = "HR",
                Payload = new { updatedCount, status }
            });
        }

        return Ok(new { updatedCount, selectedCount = applications.Count, status, applicationIds = applications.Select(item => item.Id) });
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] string format = "csv", [FromQuery] string? status = null, [FromQuery] int? jobId = null, CancellationToken cancellationToken = default)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var query = _context.JobApplications.AsNoTracking()
            .Include(item => item.Job)
            .Include(item => item.ScreeningAnswers)
            .Where(item => item.Job != null && item.Job.CreatedByUserId == userId);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(item => item.Status == status);
        if (jobId.HasValue) query = query.Where(item => item.JobId == jobId.Value);

        var applications = await query.OrderByDescending(item => item.AppliedAt).ToListAsync(cancellationToken);
        var rows = new List<string[]>
        {
            new[]
            {
                "Application ID", "Applicant Name", "Email", "Phone", "Location",
                "Job Title", "Company", "Status", "Applied At (UTC)", "Resume URL",
                "LinkedIn URL", "Portfolio URL", "Cover Letter", "Recruiter Notes",
                "Screening Answers"
            }
        };
        rows.AddRange(applications.Select(item => new[]
        {
            item.Id.ToString(), item.ApplicantName, item.ApplicantEmail, item.ApplicantPhoneNumber ?? "",
            item.ApplicantLocation ?? "", item.Job?.Title ?? "", item.Job?.Company ?? "", item.Status,
            item.AppliedAt.ToString("yyyy-MM-dd HH:mm:ss 'UTC'"), item.ResumeUrl ?? "", item.ApplicantLinkedInUrl ?? "",
            item.ApplicantPortfolioUrl ?? "", item.CoverLetter, item.RecruiterNotes ?? "",
            string.Join(" | ", item.ScreeningAnswers.OrderBy(answer => answer.Id)
                .Select(answer => $"{answer.QuestionTextSnapshot}: {answer.AnswerText}"))
        }));

        if (string.Equals(format, "xlsx", StringComparison.OrdinalIgnoreCase))
            return File(SpreadsheetExportService.BuildXlsx(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"hireflow-applicants-{DateTime.UtcNow:yyyyMMdd-HHmm}.xlsx");
        if (!string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Export format must be csv or xlsx." });
        return File(SpreadsheetExportService.BuildCsv(rows), "text/csv; charset=utf-8", $"hireflow-applicants-{DateTime.UtcNow:yyyyMMdd-HHmm}.csv");
    }

    [HttpPost("applications/{id:int}/generate-offer")]
    public async Task<ActionResult<OfferDetailsDto>> GenerateOffer(
        int id,
        [FromBody] GenerateOfferRequest request,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var application = await _context.JobApplications
            .Include(item => item.Job)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (application == null || application.Job == null || application.Job.CreatedByUserId != userId)
            return NotFound(new { message = "Application not found in your job postings." });

        if (string.Equals(application.Status, "Withdrawn", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Cannot issue an offer for a withdrawn application." });

        var now = DateTime.UtcNow;
        var offer = new OfferDetailsDto
        {
            ApplicationId = application.Id,
            ApplicantName = application.ApplicantName,
            ApplicantEmail = application.ApplicantEmail,
            Company = application.Job.Company,
            RoleTitle = string.IsNullOrWhiteSpace(request.RoleTitle) ? application.Job.Title : request.RoleTitle.Trim(),
            BaseSalary = request.BaseSalary.Trim(),
            Bonus = request.Bonus?.Trim(),
            JoiningDate = request.JoiningDate.Trim(),
            ExpiryDate = request.ExpiryDate?.Trim(),
            ReportingManager = request.ReportingManager?.Trim(),
            WorkMode = string.IsNullOrWhiteSpace(request.WorkMode) ? (application.Job.WorkMode ?? "Onsite") : request.WorkMode.Trim(),
            Terms = request.Terms?.Trim(),
            Status = "Offered",
            OfferedAtUtc = now
        };

        var metadata = new Dictionary<string, object>();
        if (!string.IsNullOrWhiteSpace(application.RecruiterNotes) && application.RecruiterNotes.TrimStart().StartsWith("{"))
        {
            try
            {
                var existing = JsonSerializer.Deserialize<Dictionary<string, object>>(application.RecruiterNotes);
                if (existing != null) metadata = existing;
            }
            catch { }
        }
        else if (!string.IsNullOrWhiteSpace(application.RecruiterNotes))
        {
            metadata["notes"] = application.RecruiterNotes;
        }

        metadata["offer"] = offer;
        application.RecruiterNotes = JsonSerializer.Serialize(metadata);

        var previousStatus = application.Status;
        application.Status = "Selected";
        application.LastUpdatedAtUtc = now;

        _context.JobApplicationStatusHistory.Add(new JobApplicationStatusHistory
        {
            JobApplicationId = application.Id,
            PreviousStatus = previousStatus,
            NewStatus = "Selected",
            Reason = $"Official offer letter issued for {offer.RoleTitle} ({offer.BaseSalary}).",
            ChangedByUserId = userId,
            ChangedByRole = "HR",
            ChangedAtUtc = now
        });

        if (!string.IsNullOrWhiteSpace(application.UserId))
        {
            await NotificationWriter.AddInAppAsync(_context, application.UserId,
                "OfferReceived", "Job offer received! 🎉",
                $"Congratulations! {application.Job.Company} has extended a formal job offer for {offer.RoleTitle}.",
                "/candidate/applications", "Application", application.Id, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);

        _liveEvents.Publish(new LiveEventDto
        {
            Type = "OfferIssued",
            Title = "Job Offer Extended 📜",
            Message = $"Offer issued to {application.ApplicantName} for {offer.RoleTitle} ({offer.BaseSalary}) at {offer.Company}.",
            TargetRole = "HR",
            Payload = new { applicationId = application.Id, role = offer.RoleTitle, company = offer.Company }
        });

        return Ok(offer);
    }

    [HttpGet("applications/{id:int}/email-preview")]
    public async Task<ActionResult<EmailPreviewDto>> GetEmailPreview(
        int id,
        [FromQuery] string type = "JobOffer",
        CancellationToken cancellationToken = default)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var application = await _context.JobApplications
            .AsNoTracking()
            .Include(item => item.Job)
            .Include(item => item.Interviews)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (application == null || application.Job == null || application.Job.CreatedByUserId != userId)
            return NotFound(new { message = "Application not found in your job postings." });

        var company = application.Job.Company ?? "HireFlow";
        var jobTitle = application.Job.Title ?? "Position";
        var applicant = application.ApplicantName ?? "Candidate";
        var email = application.ApplicantEmail;

        string subject;
        string body;

        switch (type.ToLowerInvariant())
        {
            case "interviewinvitation":
                var latestInterview = application.Interviews.OrderByDescending(i => i.ScheduledAt).FirstOrDefault();
                var timeStr = latestInterview?.ScheduledAt.ToString("f") ?? "To be coordinated";
                var link = latestInterview?.MeetingLink ?? "https://hireflow.internal/interviews";
                subject = $"Interview Invitation: {jobTitle} at {company}";
                body = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e8f2; border-radius: 12px;'>
                        <div style='border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 20px;'>
                            <h2 style='color: #1f2037; margin: 0;'>Interview Invitation</h2>
                            <p style='color: #6366f1; margin: 4px 0 0; font-weight: bold;'>{company}</p>
                        </div>
                        <p style='color: #374151; font-size: 15px;'>Dear <strong>{applicant}</strong>,</p>
                        <p style='color: #4b5563; font-size: 14px; line-height: 1.6;'>
                            Thank you for your application for the <strong>{jobTitle}</strong> position. Our hiring team was impressed by your profile and would love to invite you to an interview.
                        </p>
                        <div style='background: #f8f9fd; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 6px;'>
                            <p style='margin: 0 0 8px; font-size: 14px;'><strong>📅 Date & Time:</strong> {timeStr}</p>
                            <p style='margin: 0 0 8px; font-size: 14px;'><strong>💼 Role:</strong> {jobTitle}</p>
                            <p style='margin: 0; font-size: 14px;'><strong>🔗 Meeting Link:</strong> <a href='{link}' style='color: #6366f1;'>{link}</a></p>
                        </div>
                        <p style='color: #6b7280; font-size: 13px;'>We look forward to speaking with you! If you need to reschedule, please notify us via your HireFlow candidate portal.</p>
                    </div>";
                break;

            case "applicationreceived":
                subject = $"Application Received: {jobTitle} at {company}";
                body = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e8f2; border-radius: 12px;'>
                        <div style='border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px;'>
                            <h2 style='color: #1f2037; margin: 0;'>Application Received</h2>
                            <p style='color: #10b981; margin: 4px 0 0; font-weight: bold;'>{company}</p>
                        </div>
                        <p style='color: #374151; font-size: 15px;'>Dear <strong>{applicant}</strong>,</p>
                        <p style='color: #4b5563; font-size: 14px; line-height: 1.6;'>
                            Your application for the <strong>{jobTitle}</strong> position has been safely received. Our recruitment team is currently reviewing your resume and technical qualifications.
                        </p>
                        <div style='background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 8px; margin: 18px 0; color: #166534; font-size: 13.5px;'>
                            ✓ Application Reference ID: <strong>#{application.Id}</strong><br/>
                            ✓ Live status tracking available in your HireFlow portal.
                        </div>
                        <p style='color: #6b7280; font-size: 13px;'>Best regards,<br/><strong>{company} Recruitment Team</strong></p>
                    </div>";
                break;

            case "statusupdate":
                subject = $"Update on your application for {jobTitle} at {company}";
                body = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e8f2; border-radius: 12px;'>
                        <div style='border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 20px;'>
                            <h2 style='color: #1f2037; margin: 0;'>Application Status Update</h2>
                            <p style='color: #6366f1; margin: 4px 0 0; font-weight: bold;'>{company}</p>
                        </div>
                        <p style='color: #374151; font-size: 15px;'>Dear <strong>{applicant}</strong>,</p>
                        <p style='color: #4b5563; font-size: 14px; line-height: 1.6;'>
                            We are writing to provide you with an update regarding your application for the <strong>{jobTitle}</strong> role.
                        </p>
                        <div style='background: #fdf4ff; border-left: 4px solid #a855f7; padding: 16px; margin: 20px 0; border-radius: 6px;'>
                            <p style='margin: 0; font-size: 14px; color: #6b21a8;'><strong>Current Status:</strong> {application.Status}</p>
                        </div>
                        <p style='color: #6b7280; font-size: 13px;'>Thank you for your patience and interest in building the future with {company}.</p>
                    </div>";
                break;

            default:
                subject = $"Formal Job Offer: {jobTitle} at {company}! 🎉";
                body = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e8f2; border-radius: 12px;'>
                        <div style='border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px;'>
                            <h2 style='color: #1f2037; margin: 0;'>Official Offer of Employment</h2>
                            <p style='color: #10b981; margin: 4px 0 0; font-weight: bold;'>{company}</p>
                        </div>
                        <p style='color: #374151; font-size: 15px;'>Dear <strong>{applicant}</strong>,</p>
                        <p style='color: #4b5563; font-size: 14px; line-height: 1.6;'>
                            On behalf of <strong>{company}</strong>, we are thrilled to offer you the position of <strong>{jobTitle}</strong>! We were deeply impressed by your experience and enthusiasm during the interview process.
                        </p>
                        <div style='background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 20px 0;'>
                            <h4 style='margin: 0 0 10px; color: #166534;'>Offer Summary</h4>
                            <p style='margin: 0 0 6px; font-size: 13.5px;'><strong>Role:</strong> {jobTitle}</p>
                            <p style='margin: 0 0 6px; font-size: 13.5px;'><strong>Work Mode:</strong> {application.Job.WorkMode ?? "Flexible"}</p>
                            <p style='margin: 0; font-size: 13.5px;'><strong>Next Steps:</strong> Please review and accept your offer letter directly via the HireFlow portal.</p>
                        </div>
                        <p style='color: #4b5563; font-size: 14px;'>We look forward to welcoming you to the team!</p>
                    </div>";
                break;
        }

        return Ok(new EmailPreviewDto
        {
            Subject = subject,
            RecipientName = applicant,
            RecipientEmail = email,
            TemplateType = type,
            HtmlContent = body.Trim()
        });
    }

    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
}
