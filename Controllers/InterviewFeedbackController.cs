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
[Route("api/InterviewFeedback")]
[Authorize(Policy = "ApprovedHR")]
public class InterviewFeedbackController : ControllerBase
{
    private readonly HireFlowDbContext _context;
    private readonly ILiveEventsService _liveEvents;

    public InterviewFeedbackController(HireFlowDbContext context, ILiveEventsService liveEvents)
    {
        _context = context;
        _liveEvents = liveEvents;
    }

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

    [HttpGet("application/{applicationId:int}")]
    public async Task<IActionResult> GetByApplication(int applicationId, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var application = await _context.JobApplications
            .AsNoTracking()
            .Include(a => a.Job)
            .Include(a => a.Interviews)
            .FirstOrDefaultAsync(a => a.Id == applicationId, cancellationToken);

        if (application == null || application.Job == null || application.Job.CreatedByUserId != userId)
            return NotFound(new { message = "Application not found or unauthorized." });

        var interviewIds = application.Interviews.Select(i => i.Id).ToList();
        var feedbackList = await _context.InterviewFeedback
            .AsNoTracking()
            .Where(f => interviewIds.Contains(f.InterviewId))
            .OrderByDescending(f => f.UpdatedAtUtc)
            .ToListAsync(cancellationToken);

        if (feedbackList.Count == 0)
        {
            return Ok(new
            {
                applicationId,
                totalReviews = 0,
                averageOverall = 0.0,
                averageTechnical = 0.0,
                averageCommunication = 0.0,
                averageProblemSolving = 0.0,
                consensusRecommendation = "Not Evaluated",
                reviews = Array.Empty<object>()
            });
        }

        var avgOverall = Math.Round(feedbackList.Average(f => (double)f.OverallRating), 1);
        var techRatings = feedbackList.Where(f => f.TechnicalRating.HasValue).Select(f => (double)f.TechnicalRating!.Value).ToList();
        var avgTech = techRatings.Count > 0 ? Math.Round(techRatings.Average(), 1) : avgOverall;
        var commRatings = feedbackList.Where(f => f.CommunicationRating.HasValue).Select(f => (double)f.CommunicationRating!.Value).ToList();
        var avgComm = commRatings.Count > 0 ? Math.Round(commRatings.Average(), 1) : avgOverall;
        var probRatings = feedbackList.Where(f => f.ProblemSolvingRating.HasValue).Select(f => (double)f.ProblemSolvingRating!.Value).ToList();
        var avgProblem = probRatings.Count > 0 ? Math.Round(probRatings.Average(), 1) : avgOverall;

        var topRecommendation = feedbackList
            .GroupBy(f => f.Recommendation)
            .OrderByDescending(g => g.Count())
            .First().Key;

        return Ok(new
        {
            applicationId,
            totalReviews = feedbackList.Count,
            averageOverall = avgOverall,
            averageTechnical = avgTech,
            averageCommunication = avgComm,
            averageProblemSolving = avgProblem,
            consensusRecommendation = topRecommendation,
            reviews = feedbackList.Select(f => new
            {
                f.Id,
                f.InterviewId,
                f.SubmittedByUserId,
                f.OverallRating,
                f.TechnicalRating,
                f.CommunicationRating,
                f.ProblemSolvingRating,
                f.Recommendation,
                f.Strengths,
                f.AreasToImprove,
                f.Notes,
                f.CreatedAtUtc,
                f.UpdatedAtUtc
            })
        });
    }

    [HttpPost("{interviewId:int}")]
    public async Task<IActionResult> Save(int interviewId, [FromBody] SaveInterviewFeedbackRequest request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var interview = await _context.Interviews
            .Include(item => item.JobApplication)
            .ThenInclude(application => application!.Job)
            .FirstOrDefaultAsync(item => item.Id == interviewId && item.JobApplication != null && item.JobApplication.Job != null && item.JobApplication.Job.CreatedByUserId == userId, cancellationToken);

        if (interview == null) return NotFound();

        // If interview was scheduled, submitting a complete evaluation marks it Completed
        if (interview.Status != "Completed")
        {
            interview.Status = "Completed";
        }

        var feedback = await _context.InterviewFeedback.FirstOrDefaultAsync(item => item.InterviewId == interviewId && item.SubmittedByUserId == userId, cancellationToken);
        if (feedback == null)
        {
            feedback = new InterviewFeedback { InterviewId = interviewId, SubmittedByUserId = userId, CreatedAtUtc = DateTime.UtcNow };
            _context.InterviewFeedback.Add(feedback);
        }

        // Security: strictly clamp ratings between 1 and 5
        feedback.OverallRating = Math.Clamp(request.OverallRating, 1, 5);
        feedback.TechnicalRating = request.TechnicalRating.HasValue ? Math.Clamp(request.TechnicalRating.Value, 1, 5) : null;
        feedback.CommunicationRating = request.CommunicationRating.HasValue ? Math.Clamp(request.CommunicationRating.Value, 1, 5) : null;
        feedback.ProblemSolvingRating = request.ProblemSolvingRating.HasValue ? Math.Clamp(request.ProblemSolvingRating.Value, 1, 5) : null;
        feedback.Recommendation = Clean(request.Recommendation) ?? "Hire";
        feedback.Strengths = Clean(request.Strengths);
        feedback.AreasToImprove = Clean(request.AreasToImprove);
        feedback.Notes = Clean(request.Notes);
        feedback.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        // Broadcast live event to HR subscribers
        var candidateName = interview.JobApplication?.ApplicantName ?? "Candidate";
        var jobRole = interview.JobApplication?.Job?.Title ?? "Position";
        _liveEvents.Publish(new LiveEventDto
        {
            Type = "ScorecardSaved",
            Title = "Interview Scorecard Recorded",
            Message = $"{candidateName} evaluated for {jobRole}: {feedback.OverallRating}/5 ({feedback.Recommendation})",
            TargetRole = "HR",
            Payload = new { interviewId, applicationId = interview.JobApplicationId, rating = feedback.OverallRating, recommendation = feedback.Recommendation }
        });

        return Ok(new
        {
            message = "Interview feedback saved.",
            feedback.Id,
            feedback.InterviewId,
            feedback.OverallRating,
            feedback.Recommendation,
            feedback.UpdatedAtUtc
        });
    }

    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
