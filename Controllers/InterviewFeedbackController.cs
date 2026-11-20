using System.Security.Claims;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers;

[ApiController]
[Route("api/InterviewFeedback")]
[Authorize(Policy = "ApprovedHR")]
public class InterviewFeedbackController : ControllerBase
{
    private readonly HireFlowDbContext _context;
    public InterviewFeedbackController(HireFlowDbContext context) => _context = context;

    [HttpGet("{interviewId:int}")]
    public async Task<IActionResult> Get(int interviewId, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var ownsInterview = await _context.Interviews.AnyAsync(item => item.Id == interviewId && item.JobApplication != null && item.JobApplication.Job != null && item.JobApplication.Job.CreatedByUserId == userId, cancellationToken);
        if (!ownsInterview) return NotFound();
        var items = await _context.InterviewFeedback.AsNoTracking()
            .Where(item => item.InterviewId == interviewId)
            .OrderByDescending(item => item.UpdatedAtUtc)
            .Select(item => new
            {
                item.Id,
                item.InterviewId,
                item.SubmittedByUserId,
                item.OverallRating,
                item.TechnicalRating,
                item.CommunicationRating,
                item.ProblemSolvingRating,
                item.Recommendation,
                item.Strengths,
                item.AreasToImprove,
                item.Notes,
                item.CreatedAtUtc,
                item.UpdatedAtUtc
            }).ToListAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPost("{interviewId:int}")]
    public async Task<IActionResult> Save(int interviewId, [FromBody] SaveInterviewFeedbackRequest request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var interview = await _context.Interviews.Include(item => item.JobApplication).ThenInclude(application => application!.Job)
            .FirstOrDefaultAsync(item => item.Id == interviewId && item.JobApplication != null && item.JobApplication.Job != null && item.JobApplication.Job.CreatedByUserId == userId, cancellationToken);
        if (interview == null) return NotFound();
        if (interview.Status != "Completed") return Conflict(new { message = "Interview feedback can be submitted after the interview is marked Completed." });

        var feedback = await _context.InterviewFeedback.FirstOrDefaultAsync(item => item.InterviewId == interviewId && item.SubmittedByUserId == userId, cancellationToken);
        if (feedback == null)
        {
            feedback = new InterviewFeedback { InterviewId = interviewId, SubmittedByUserId = userId, CreatedAtUtc = DateTime.UtcNow };
            _context.InterviewFeedback.Add(feedback);
        }
        feedback.OverallRating = request.OverallRating;
        feedback.TechnicalRating = request.TechnicalRating;
        feedback.CommunicationRating = request.CommunicationRating;
        feedback.ProblemSolvingRating = request.ProblemSolvingRating;
        feedback.Recommendation = request.Recommendation;
        feedback.Strengths = Clean(request.Strengths);
        feedback.AreasToImprove = Clean(request.AreasToImprove);
        feedback.Notes = Clean(request.Notes);
        feedback.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "Interview feedback saved.", feedback.Id, feedback.InterviewId, feedback.OverallRating, feedback.Recommendation, feedback.UpdatedAtUtc });
    }

    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
