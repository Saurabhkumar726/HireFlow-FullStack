using System.Security.Claims;
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

    public ApplicantManagementController(HireFlowDbContext context) => _context = context;

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

    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
}
