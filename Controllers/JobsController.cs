using HireFlow.Api.Data;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Job>>> GetJobs()
        {
            return await _context.Jobs
                .OrderByDescending(j => j.CreatedAt)
                .ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Job>> GetJob(int id)
        {
            var job = await _context.Jobs.FindAsync(id);

            if (job == null)
                return NotFound();

            return job;
        }

        [HttpPost]
        public async Task<ActionResult<Job>> CreateJob(Job job)
        {
            _context.Jobs.Add(job);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetJob),
                new { id = job.Id },
                job);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateJob(int id, Job updatedJob)
        {
            var job = await _context.Jobs.FindAsync(id);

            if (job == null)
                return NotFound();

            job.Title = updatedJob.Title;
            job.Company = updatedJob.Company;
            job.Location = updatedJob.Location;
            job.Description = updatedJob.Description;
            job.JobType = updatedJob.JobType;
            job.Salary = updatedJob.Salary;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteJob(int id)
        {
            var job = await _context.Jobs.FindAsync(id);

            if (job == null)
                return NotFound();

            _context.Jobs.Remove(job);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/JobApplications/job/2
        [HttpGet("job/{jobId}")]
        public async Task<ActionResult<IEnumerable<JobApplication>>> GetApplicationsByJob(int jobId)
        {
            var jobExists = await _context.Jobs.AnyAsync(j => j.Id == jobId);

            if (!jobExists)
                return NotFound("Job not found.");

            return await _context.JobApplications
                .Where(a => a.JobId == jobId)
                .OrderByDescending(a => a.AppliedAt)
                .ToListAsync();
        }
    }
}