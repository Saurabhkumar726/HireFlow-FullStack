
using HireFlow.Api.Data;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HireFlow.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class JobsController : ControllerBase
    {
        private readonly HireFlowDbContext _context;

        public JobsController(HireFlowDbContext context)
        {
            _context = context;
        }

        // Public: browse all jobs
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<Job>>> GetJobs()
        {
            return await _context.Jobs
                .OrderByDescending(j => j.CreatedAt)
                .ToListAsync();
        }

        // Public: view a job
        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<ActionResult<Job>> GetJob(int id)
        {
            var job = await _context.Jobs.FindAsync(id);

            if (job == null)
            {
                return NotFound();
            }

            return job;
        }

        // Only approved HR users can create jobs
        [HttpPost]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<ActionResult<Job>> CreateJob(Job job)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            // Never trust ownership information sent by the client.
            job.Id = 0;
            job.CreatedByUserId = userId;
            job.CreatedAt = DateTime.UtcNow;

            _context.Jobs.Add(job);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetJob),
                new { id = job.Id },
                job);
        }

        // Only the HR owner can update their job
        [HttpPut("{id:int}")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> UpdateJob(int id, Job updatedJob)
        {
            if (id != updatedJob.Id)
            {
                return BadRequest(
                    "The route ID does not match the job ID.");
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var job = await _context.Jobs
                .FirstOrDefaultAsync(j =>
                    j.Id == id && j.CreatedByUserId == userId);

            if (job == null)
            {
                return NotFound(new
                {
                    message = "Job not found or you do not own this job."
                });
            }

            job.Title = updatedJob.Title;
            job.Company = updatedJob.Company;
            job.Location = updatedJob.Location;
            job.Description = updatedJob.Description;
            job.JobType = updatedJob.JobType;
            job.Salary = updatedJob.Salary;

            // Preserve CreatedByUserId and CreatedAt.
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // Only the HR owner can delete their job
        [HttpDelete("{id:int}")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> DeleteJob(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var job = await _context.Jobs
                .FirstOrDefaultAsync(j =>
                    j.Id == id && j.CreatedByUserId == userId);

            if (job == null)
            {
                return NotFound(new
                {
                    message = "Job not found or you do not own this job."
                });
            }

            _context.Jobs.Remove(job);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // Only approved HR who own the job can view its applicants
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

            var job = await _context.Jobs
                .FirstOrDefaultAsync(j =>
                    j.Id == jobId && j.CreatedByUserId == userId);

            if (job == null)
            {
                return NotFound(new
                {
                    message = "Job not found or you do not own this job."
                });
            }

            var applications = await _context.JobApplications
                .Where(a => a.JobId == jobId)
                .OrderByDescending(a => a.AppliedAt)
                .ToListAsync();

            return Ok(applications);
        }
    }
}
