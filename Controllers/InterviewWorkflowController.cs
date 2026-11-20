using System.Security.Claims;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers;

[ApiController]
[Route("api/InterviewWorkflow")]
[Authorize]
public class InterviewWorkflowController : ControllerBase
{
    private readonly HireFlowDbContext _context;
    public InterviewWorkflowController(HireFlowDbContext context) => _context = context;

    [HttpPost("{interviewId:int}/candidate-response")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> CandidateResponse(int interviewId, [FromBody] CandidateInterviewResponseRequest request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
        var interview = await _context.Interviews.Include(item => item.JobApplication).ThenInclude(application => application!.Job)
            .FirstOrDefaultAsync(item => item.Id == interviewId, cancellationToken);
        if (interview?.JobApplication == null) return NotFound();
        var application = interview.JobApplication;
        var isOwner = application.UserId == userId || (application.UserId == null && !string.IsNullOrWhiteSpace(email) && string.Equals(application.ApplicantEmail, email, StringComparison.OrdinalIgnoreCase));
        if (!isOwner) return NotFound();
        if (interview.Status != "Scheduled" || interview.ScheduledAt <= DateTime.UtcNow)
            return Conflict(new { message = "This interview is no longer open for candidate responses." });
        if (interview.CandidateResponseStatus is "Accepted" or "Declined" or "RescheduleRequested" or "RescheduleApproved")
            return Conflict(new { message = "You have already responded to this interview. Contact the hiring team if you need to change your response." });

        var action = request.Action;
        var title = "Candidate responded to interview";
        string message;
        switch (action)
        {
            case "Accept":
                interview.CandidateResponseStatus = "Accepted";
                message = $"{application.ApplicantName} accepted the interview for {application.Job?.Title ?? "your job"}.";
                break;
            case "Decline":
                interview.CandidateResponseStatus = "Declined";
                message = $"{application.ApplicantName} declined the interview for {application.Job?.Title ?? "your job"}.";
                break;
            case "RequestReschedule":
                if (!request.ProposedScheduledAtUtc.HasValue || request.ProposedScheduledAtUtc.Value <= DateTime.UtcNow)
                    return BadRequest(new { message = "Choose a proposed reschedule time in the future." });
                if (request.ProposedScheduledAtUtc.Value == interview.ScheduledAt)
                    return BadRequest(new { message = "The proposed time must differ from the current interview time." });
                interview.CandidateResponseStatus = "RescheduleRequested";
                interview.ProposedScheduledAtUtc = request.ProposedScheduledAtUtc.Value;
                message = $"{application.ApplicantName} requested a new time for {application.Job?.Title ?? "the interview"}: {request.ProposedScheduledAtUtc.Value:dd MMM yyyy HH:mm} UTC.";
                title = "Candidate requested an interview reschedule";
                break;
            default:
                return BadRequest(new { message = "Choose Accept, Decline, or RequestReschedule." });
        }

        interview.CandidateResponseAtUtc = DateTime.UtcNow;
        interview.CandidateResponseNote = Clean(request.Note);
        if (!string.IsNullOrWhiteSpace(application.Job?.CreatedByUserId))
            await NotificationWriter.AddInAppAsync(_context, application.Job.CreatedByUserId,
                "InterviewCandidate" + action, title, message, "/hr/interviews", "Interview", interview.Id, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "Your interview response was sent to the hiring team.", interview.CandidateResponseStatus, interview.CandidateResponseAtUtc });
    }

    [HttpGet("hr")]
    [Authorize(Policy = "ApprovedHR")]
    public async Task<IActionResult> GetHrResponses(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var items = await _context.Interviews.AsNoTracking()
            .Where(item => item.JobApplication != null && item.JobApplication.Job != null && item.JobApplication.Job.CreatedByUserId == userId)
            .OrderByDescending(item => item.CandidateResponseAtUtc ?? item.ScheduledAt)
            .Select(item => new
            {
                item.Id,
                item.JobApplicationId,
                item.ScheduledAt,
                item.Status,
                item.CandidateResponseStatus,
                item.CandidateResponseAtUtc,
                item.CandidateResponseNote,
                item.ProposedScheduledAtUtc,
                ApplicantName = item.JobApplication!.ApplicantName,
                ApplicantEmail = item.JobApplication!.ApplicantEmail,
                JobTitle = item.JobApplication!.Job!.Title
            }).ToListAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPost("{interviewId:int}/hr-response")]
    [Authorize(Policy = "ApprovedHR")]
    public async Task<IActionResult> ReviewReschedule(int interviewId, [FromBody] ReviewCandidateInterviewRequest request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var interview = await _context.Interviews.Include(item => item.JobApplication).ThenInclude(application => application!.Job)
            .FirstOrDefaultAsync(item => item.Id == interviewId && item.JobApplication != null && item.JobApplication.Job != null && item.JobApplication.Job.CreatedByUserId == userId, cancellationToken);
        if (interview?.JobApplication == null) return NotFound();
        if (!string.Equals(interview.Status, "Scheduled", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Only a scheduled interview can have its reschedule request reviewed." });
        if (interview.CandidateResponseStatus != "RescheduleRequested" || !interview.ProposedScheduledAtUtc.HasValue)
            return Conflict(new { message = "There is no pending reschedule request for this interview." });

        if (request.Action == "ApproveReschedule")
        {
            if (interview.ProposedScheduledAtUtc.Value <= DateTime.UtcNow)
                return Conflict(new { message = "The proposed date has passed. Ask the candidate to submit another time." });
            interview.ScheduledAt = interview.ProposedScheduledAtUtc.Value;
            interview.CandidateResponseStatus = "RescheduleApproved";
        }
        else if (request.Action == "DeclineReschedule")
        {
            interview.CandidateResponseStatus = "RescheduleDeclined";
        }
        else return BadRequest(new { message = "Choose ApproveReschedule or DeclineReschedule." });

        interview.CandidateResponseNote = Clean(request.Note) ?? interview.CandidateResponseNote;
        interview.CandidateResponseAtUtc = DateTime.UtcNow;
        interview.UpdatedAt = DateTime.UtcNow;
        var approved = request.Action == "ApproveReschedule";
        var candidateTitle = approved ? "Interview reschedule approved" : "Interview reschedule declined";
        var candidateMessage = approved
            ? $"Your interview has been moved to {ToIndiaTime(interview.ScheduledAt):dd MMM yyyy, hh:mm tt} IST."
            : "The hiring team could not approve your requested interview time. Your original time remains scheduled.";
        if (!string.IsNullOrWhiteSpace(interview.JobApplication.UserId))
        {
            await NotificationWriter.AddInAppAsync(_context, interview.JobApplication.UserId,
                approved ? "InterviewRescheduleApproved" : "InterviewRescheduleDeclined",
                candidateTitle, candidateMessage,
                "/candidate/interviews", "Interview", interview.Id, cancellationToken);
        }
        else
        {
            NotificationWriter.AddEmailOnly(_context, interview.JobApplication.ApplicantEmail,
                $"{candidateTitle} | HireFlow",
                $"<p>{System.Net.WebUtility.HtmlEncode(candidateMessage)}</p>",
                $"interview-reschedule-review-{interview.Id}-{(approved ? "approved" : "declined")}-{interview.ScheduledAt.Ticks}");
        }
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "Candidate reschedule request reviewed.", interview.CandidateResponseStatus, interview.ScheduledAt });
    }

    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static DateTime ToIndiaTime(DateTime value)
    {
        var utc = value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        TimeZoneInfo zone;
        try { zone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"); }
        catch (TimeZoneNotFoundException) { zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"); }
        return TimeZoneInfo.ConvertTimeFromUtc(utc, zone);
    }
}
