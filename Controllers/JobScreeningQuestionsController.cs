using System.Security.Claims;
using System.Text.Json;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers;

[ApiController]
[Route("api/Jobs/{jobId:int}/screening-questions")]
public class JobScreeningQuestionsController : ControllerBase
{
    private static readonly string[] SupportedTypes = ["Text", "YesNo", "SingleChoice", "MultipleChoice"];
    private readonly HireFlowDbContext _context;

    public JobScreeningQuestionsController(HireFlowDbContext context) => _context = context;

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetForJob(int jobId, CancellationToken cancellationToken)
    {
        var job = await _context.Jobs.AsNoTracking().FirstOrDefaultAsync(item => item.Id == jobId, cancellationToken);
        if (job == null || !job.IsActive || !string.Equals(job.PublicationStatus, "Published", StringComparison.OrdinalIgnoreCase))
            return NotFound();

        var questions = await _context.JobScreeningQuestions.AsNoTracking()
            .Where(item => item.JobId == jobId && item.IsActive)
            .OrderBy(item => item.SortOrder).ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
        return Ok(questions.Select(ToResponse));
    }

    // HR management endpoint also returns questions for unpublished or inactive owned jobs.
    [HttpGet("manage")]
    [Authorize(Policy = "ApprovedHR")]
    public async Task<IActionResult> GetForManagement(int jobId, CancellationToken cancellationToken)
    {
        if (await GetOwnedJobAsync(jobId, cancellationToken) == null) return NotFound();
        var questions = await _context.JobScreeningQuestions.AsNoTracking()
            .Where(item => item.JobId == jobId)
            .OrderBy(item => item.SortOrder).ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
        return Ok(questions.Select(ToResponse));
    }

    [HttpPost]
    [Authorize(Policy = "ApprovedHR")]
    public async Task<IActionResult> Create(int jobId, [FromBody] UpsertJobScreeningQuestionRequest request, CancellationToken cancellationToken)
    {
        var job = await GetOwnedJobAsync(jobId, cancellationToken);
        if (job == null) return NotFound(new { message = "Job not found or you do not own this job." });
        var validation = Validate(request);
        if (validation != null) return BadRequest(new { message = validation });

        var question = new JobScreeningQuestion { JobId = jobId };
        Apply(question, request);
        _context.JobScreeningQuestions.Add(question);
        await _context.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetForJob), new { jobId }, ToResponse(question));
    }

    [HttpPut("{questionId:int}")]
    [Authorize(Policy = "ApprovedHR")]
    public async Task<IActionResult> Update(int jobId, int questionId, [FromBody] UpsertJobScreeningQuestionRequest request, CancellationToken cancellationToken)
    {
        if (await GetOwnedJobAsync(jobId, cancellationToken) == null) return NotFound();
        var question = await _context.JobScreeningQuestions.FirstOrDefaultAsync(item => item.Id == questionId && item.JobId == jobId, cancellationToken);
        if (question == null) return NotFound();
        var validation = Validate(request);
        if (validation != null) return BadRequest(new { message = validation });
        Apply(question, request);
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(question));
    }

    [HttpDelete("{questionId:int}")]
    [Authorize(Policy = "ApprovedHR")]
    public async Task<IActionResult> Deactivate(int jobId, int questionId, CancellationToken cancellationToken)
    {
        if (await GetOwnedJobAsync(jobId, cancellationToken) == null) return NotFound();
        var question = await _context.JobScreeningQuestions.FirstOrDefaultAsync(item => item.Id == questionId && item.JobId == jobId, cancellationToken);
        if (question == null) return NotFound();
        // Questions are deactivated, not deleted, so old applicant answer records remain auditable.
        question.IsActive = false;
        question.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<Job?> GetOwnedJobAsync(int jobId, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId)) return null;
        return await _context.Jobs.FirstOrDefaultAsync(job => job.Id == jobId && job.CreatedByUserId == userId, cancellationToken);
    }

    private static string? Validate(UpsertJobScreeningQuestionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.QuestionText) || request.QuestionText.Trim().Length < 5 || request.QuestionText.Trim().Length > 500)
            return "Question text must contain between 5 and 500 non-whitespace characters.";
        if (!SupportedTypes.Contains(request.QuestionType, StringComparer.Ordinal))
            return "Question type must be Text, YesNo, SingleChoice, or MultipleChoice.";
        if (request.QuestionType is "SingleChoice" or "MultipleChoice")
        {
            var options = (request.Options ?? new List<string>()).Where(item => item != null).Select(item => item.Trim()).Where(item => item.Length > 0).Distinct(StringComparer.Ordinal).ToList();
            if (options.Count < 2 || options.Count > 20) return "Choice questions need between 2 and 20 unique options.";
            if (options.Any(item => item.Length > 160)) return "Each option must be 160 characters or fewer.";
        }
        return null;
    }

    private static void Apply(JobScreeningQuestion question, UpsertJobScreeningQuestionRequest request)
    {
        question.QuestionText = request.QuestionText.Trim();
        question.QuestionType = request.QuestionType;
        question.OptionsJson = request.QuestionType is "SingleChoice" or "MultipleChoice"
            ? JsonSerializer.Serialize((request.Options ?? new List<string>()).Where(item => item != null).Select(item => item.Trim()).Where(item => item.Length > 0).Distinct(StringComparer.Ordinal).ToList())
            : null;
        question.IsRequired = request.IsRequired;
        question.SortOrder = Math.Clamp(request.SortOrder, 0, 500);
        question.IsActive = request.IsActive;
        question.UpdatedAtUtc = DateTime.UtcNow;
    }

    private static object ToResponse(JobScreeningQuestion question) => new
    {
        question.Id,
        question.JobId,
        question.QuestionText,
        question.QuestionType,
        options = string.IsNullOrWhiteSpace(question.OptionsJson)
            ? new List<string>()
            : JsonSerializer.Deserialize<List<string>>(question.OptionsJson) ?? new List<string>(),
        question.IsRequired,
        question.IsActive,
        question.SortOrder,
        question.CreatedAtUtc,
        question.UpdatedAtUtc
    };
}
