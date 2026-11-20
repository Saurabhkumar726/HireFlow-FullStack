using System.Security.Claims;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Student")]
public class SavedJobsController : ControllerBase
{
    private readonly HireFlowDbContext _context;

    public SavedJobsController(HireFlowDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetSavedJobs(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var savedJobs = await _context.SavedJobs
            .AsNoTracking()
            .Include(saved => saved.Job)
            .Where(saved => saved.UserId == userId)
            .OrderByDescending(saved => saved.SavedAtUtc)
            .ToListAsync(cancellationToken);

        var savedIds = savedJobs.Select(saved => saved.Id).ToArray();
        var memberships = await _context.SavedJobCollectionItems
            .AsNoTracking()
            .Include(item => item.Collection)
            .Where(item => savedIds.Contains(item.SavedJobId) && item.Collection.UserId == userId)
            .ToListAsync(cancellationToken);

        var membershipsBySavedId = memberships
            .GroupBy(item => item.SavedJobId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(item => new
                {
                    id = item.Collection.Id,
                    name = item.Collection.Name
                }).OrderBy(item => item.name).ToArray());

        var now = DateTime.UtcNow;
        var result = savedJobs.Select(saved => new
        {
            savedJobId = saved.Id,
            jobId = saved.JobId,
            savedAtUtc = saved.SavedAtUtc,
            isAvailable = IsAvailable(saved.Job, now),
            unavailableReason = GetUnavailableReason(saved.Job, now),
            collections = membershipsBySavedId.TryGetValue(saved.Id, out var collections)
                ? collections
                : Array.Empty<object>(),
            job = ToJobResponse(saved.Job)
        });

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> SaveJob(
        [FromBody] CreateSavedJobRequest request,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var job = await _context.Jobs
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == request.JobId, cancellationToken);

        if (job == null || !IsAvailable(job, DateTime.UtcNow))
            return BadRequest(new { message = "This job is not currently available to save." });

        var existing = await _context.SavedJobs.FirstOrDefaultAsync(
            saved => saved.UserId == userId && saved.JobId == request.JobId,
            cancellationToken);

        if (existing != null)
            return Ok(new { message = "This job is already in your saved jobs.", jobId = job.Id });

        var savedJob = new SavedJob
        {
            UserId = userId,
            JobId = job.Id,
            SavedAtUtc = DateTime.UtcNow
        };

        _context.SavedJobs.Add(savedJob);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetSavedJobs), new { }, new
        {
            message = "Job saved successfully.",
            jobId = savedJob.JobId,
            savedAtUtc = savedJob.SavedAtUtc
        });
    }

    [HttpDelete("{jobId:int}")]
    public async Task<IActionResult> RemoveSavedJob(int jobId, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var savedJob = await _context.SavedJobs.FirstOrDefaultAsync(
            saved => saved.UserId == userId && saved.JobId == jobId,
            cancellationToken);

        if (savedJob == null) return NotFound(new { message = "This job is not in your saved jobs." });

        _context.SavedJobs.Remove(savedJob);
        await _context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("collections")]
    public async Task<IActionResult> GetCollections(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var collections = await _context.SavedJobCollections
            .AsNoTracking()
            .Where(collection => collection.UserId == userId)
            .OrderBy(collection => collection.Name)
            .Select(collection => new
            {
                collection.Id,
                collection.Name,
                collection.CreatedAtUtc,
                collection.UpdatedAtUtc,
                jobCount = collection.Items.Count
            })
            .ToListAsync(cancellationToken);

        return Ok(collections);
    }

    [HttpGet("collections/{collectionId:int}")]
    public async Task<IActionResult> GetCollection(int collectionId, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var collection = await _context.SavedJobCollections
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == collectionId && item.UserId == userId, cancellationToken);

        if (collection == null) return NotFound(new { message = "Collection not found." });

        var items = await _context.SavedJobCollectionItems
            .AsNoTracking()
            .Include(item => item.SavedJob)
            .ThenInclude(saved => saved.Job)
            .Where(item => item.SavedJobCollectionId == collectionId && item.Collection.UserId == userId)
            .OrderByDescending(item => item.AddedAtUtc)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        return Ok(new
        {
            collection.Id,
            collection.Name,
            collection.CreatedAtUtc,
            collection.UpdatedAtUtc,
            jobs = items.Select(item => new
            {
                savedJobId = item.SavedJob.Id,
                jobId = item.SavedJob.JobId,
                addedAtUtc = item.AddedAtUtc,
                isAvailable = IsAvailable(item.SavedJob.Job, now),
                unavailableReason = GetUnavailableReason(item.SavedJob.Job, now),
                job = ToJobResponse(item.SavedJob.Job)
            })
        });
    }

    [HttpPost("collections")]
    public async Task<IActionResult> CreateCollection(
        [FromBody] CreateSavedJobCollectionRequest request,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var name = request.Name.Trim();
        var exists = await _context.SavedJobCollections.AnyAsync(
            collection => collection.UserId == userId && collection.Name == name,
            cancellationToken);
        if (exists) return Conflict(new { message = "A collection with this name already exists." });

        var collection = new SavedJobCollection
        {
            UserId = userId,
            Name = name,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        _context.SavedJobCollections.Add(collection);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetCollection), new { collectionId = collection.Id }, new
        {
            collection.Id,
            collection.Name,
            collection.CreatedAtUtc,
            collection.UpdatedAtUtc,
            jobCount = 0
        });
    }

    [HttpPut("collections/{collectionId:int}")]
    public async Task<IActionResult> RenameCollection(
        int collectionId,
        [FromBody] UpdateSavedJobCollectionRequest request,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var collection = await _context.SavedJobCollections.FirstOrDefaultAsync(
            item => item.Id == collectionId && item.UserId == userId,
            cancellationToken);
        if (collection == null) return NotFound(new { message = "Collection not found." });

        var name = request.Name.Trim();
        var duplicate = await _context.SavedJobCollections.AnyAsync(
            item => item.UserId == userId && item.Id != collectionId && item.Name == name,
            cancellationToken);
        if (duplicate) return Conflict(new { message = "A collection with this name already exists." });

        collection.Name = name;
        collection.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { collection.Id, collection.Name, collection.UpdatedAtUtc });
    }

    [HttpDelete("collections/{collectionId:int}")]
    public async Task<IActionResult> DeleteCollection(int collectionId, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var collection = await _context.SavedJobCollections.FirstOrDefaultAsync(
            item => item.Id == collectionId && item.UserId == userId,
            cancellationToken);
        if (collection == null) return NotFound(new { message = "Collection not found." });

        // Delete only membership links. The SavedJob rows remain in All Saved Jobs.
        var memberships = await _context.SavedJobCollectionItems
            .Where(item => item.SavedJobCollectionId == collectionId)
            .ToListAsync(cancellationToken);
        _context.SavedJobCollectionItems.RemoveRange(memberships);
        _context.SavedJobCollections.Remove(collection);
        await _context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("collections/{collectionId:int}/jobs/{jobId:int}")]
    public async Task<IActionResult> AddJobToCollection(
        int collectionId,
        int jobId,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var collection = await _context.SavedJobCollections.FirstOrDefaultAsync(
            item => item.Id == collectionId && item.UserId == userId,
            cancellationToken);
        if (collection == null) return NotFound(new { message = "Collection not found." });

        var savedJob = await _context.SavedJobs.FirstOrDefaultAsync(
            item => item.UserId == userId && item.JobId == jobId,
            cancellationToken);
        if (savedJob == null)
            return BadRequest(new { message = "Save this job before adding it to a collection." });

        var exists = await _context.SavedJobCollectionItems.AnyAsync(
            item => item.SavedJobCollectionId == collectionId && item.SavedJobId == savedJob.Id,
            cancellationToken);
        if (exists) return Ok(new { message = "This job is already in the collection." });

        _context.SavedJobCollectionItems.Add(new SavedJobCollectionItem
        {
            SavedJobCollectionId = collectionId,
            SavedJobId = savedJob.Id,
            AddedAtUtc = DateTime.UtcNow
        });
        collection.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "Job added to collection." });
    }

    [HttpDelete("collections/{collectionId:int}/jobs/{jobId:int}")]
    public async Task<IActionResult> RemoveJobFromCollection(
        int collectionId,
        int jobId,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        var item = await _context.SavedJobCollectionItems
            .Include(link => link.Collection)
            .Include(link => link.SavedJob)
            .FirstOrDefaultAsync(link =>
                link.SavedJobCollectionId == collectionId &&
                link.Collection.UserId == userId &&
                link.SavedJob.JobId == jobId &&
                link.SavedJob.UserId == userId,
                cancellationToken);

        if (item == null) return NotFound(new { message = "This job is not in the selected collection." });

        item.Collection.UpdatedAtUtc = DateTime.UtcNow;
        _context.SavedJobCollectionItems.Remove(item);
        await _context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private string? CurrentUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    private static bool IsAvailable(Job job, DateTime now) =>
        job.PublicationStatus.Equals("Published", StringComparison.OrdinalIgnoreCase) &&
        job.IsActive &&
        (!job.ApplicationDeadlineUtc.HasValue || job.ApplicationDeadlineUtc.Value >= now);

    private static string? GetUnavailableReason(Job job, DateTime now)
    {
        if (!job.PublicationStatus.Equals("Published", StringComparison.OrdinalIgnoreCase)) return "Not published";
        if (!job.IsActive) return "Closed";
        if (job.ApplicationDeadlineUtc.HasValue && job.ApplicationDeadlineUtc.Value < now) return "Expired";
        return null;
    }

    private static object ToJobResponse(Job job) => new
    {
        job.Id,
        job.Title,
        job.Company,
        job.Location,
        job.Description,
        job.JobType,
        job.Salary,
        job.SalaryMax,
        job.SalaryMode,
        job.SalaryCurrency,
        job.SalaryPeriod,
        job.Category,
        job.WorkMode,
        job.ExperienceLevel,
        job.MinimumExperienceYears,
        job.MaximumExperienceYears,
        job.Responsibilities,
        job.Requirements,
        job.Benefits,
        job.ApplicationDeadlineUtc,
        job.PublicationStatus,
        job.IsActive,
        job.CreatedAt,
        job.UpdatedAt,
        job.IsFeatured
    };
}
