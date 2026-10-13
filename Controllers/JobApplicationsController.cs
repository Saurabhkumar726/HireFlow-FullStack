
using HireFlow.Api.Data;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class JobApplicationsController : ControllerBase
    {
        private readonly HireFlowDbContext _context;

        public JobApplicationsController(HireFlowDbContext context)
        {
            _context = context;
        }

        // GET: api/JobApplications
        [HttpGet]
        public async Task<ActionResult<IEnumerable<JobApplication>>> GetApplications()
        {
            return await _context.JobApplications
                .OrderByDescending(a => a.AppliedAt)
                .ToListAsync();
        }

        // GET: api/JobApplications/1
        [HttpGet("{id}")]
        public async Task<ActionResult<JobApplication>> GetApplication(int id)
        {
            var application = await _context.JobApplications
                .FindAsync(id);

            if (application == null)
                return NotFound();

            return application;
        }

        // POST: api/JobApplications
        [HttpPost]
        public async Task<ActionResult<JobApplication>> CreateApplication(
            [FromBody] JobApplication application)
        {
            var jobExists = await _context.Jobs
                .AnyAsync(j => j.Id == application.JobId);

            if (!jobExists)
                return BadRequest("The specified job does not exist.");

            _context.JobApplications.Add(application);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetApplication),
                new { id = application.Id },
                application);
        }

        // GET: api/JobApplications/job/2
        [HttpGet("job/{jobId}")]
        public async Task<ActionResult<IEnumerable<JobApplication>>> GetApplicationsByJob(
            int jobId)
        {
            var jobExists = await _context.Jobs
                .AnyAsync(j => j.Id == jobId);

            if (!jobExists)
                return NotFound("Job not found.");

            return await _context.JobApplications
                .Where(a => a.JobId == jobId)
                .OrderByDescending(a => a.AppliedAt)
                .ToListAsync();
        }

        // PUT: api/JobApplications/1/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateApplicationStatus(
            int id,
            [FromBody] string status)
        {
            var allowedStatuses = new[]
            {
                "Pending",
                "Reviewed",
                "Shortlisted",
                "Rejected"
            };

            if (string.IsNullOrWhiteSpace(status) ||
                !allowedStatuses.Contains(status))
            {
                return BadRequest("Invalid application status.");
            }

            var application = await _context.JobApplications
                .FindAsync(id);

            if (application == null)
                return NotFound();

            application.Status = status;
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
