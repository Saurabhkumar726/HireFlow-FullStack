using System.Security.Claims;
using HireFlow.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CandidateInterviewsController : ControllerBase
    {
        private readonly HireFlowDbContext _context;

        public CandidateInterviewsController(HireFlowDbContext context)
        {
            _context = context;
        }

        // GET: api/CandidateInterviews
        // Returns only interviews linked to applications using the signed-in student's email.
        [HttpGet]
        public async Task<IActionResult> GetMyInterviews()
        {
            var role = User.FindFirstValue(ClaimTypes.Role)
                ?? User.FindFirstValue("role");

            if (!string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase)
                && !User.IsInRole("Student"))
            {
                return Forbid();
            }

            var email = User.FindFirstValue(ClaimTypes.Email)
                ?? User.FindFirstValue("email")
                ?? User.FindFirstValue("preferred_username");

            if (string.IsNullOrWhiteSpace(email))
            {
                return Unauthorized(new { message = "Your account email could not be identified. Please sign in again." });
            }

            var normalizedEmail = email.Trim().ToLower();

            var interviews = await _context.Interviews
                .AsNoTracking()
                .Where(interview =>
                    interview.JobApplication != null &&
                    interview.JobApplication.ApplicantEmail != null &&
                    interview.JobApplication.ApplicantEmail.ToLower() == normalizedEmail)
                .OrderByDescending(interview => interview.ScheduledAt)
                .Select(interview => new
                {
                    interview.Id,
                    interview.JobApplicationId,
                    interview.ScheduledAt,
                    interview.InterviewType,
                    interview.MeetingLink,
                    interview.Notes,
                    interview.Status,
                    interview.CreatedAt,
                    interview.UpdatedAt,
                    JobTitle = interview.JobApplication!.Job != null
                        ? interview.JobApplication.Job.Title
                        : "Job opportunity",
                    Company = interview.JobApplication!.Job != null
                        ? interview.JobApplication.Job.Company
                        : "Company",
                    ApplicantEmail = interview.JobApplication!.ApplicantEmail
                })
                .ToListAsync();

            return Ok(interviews);
        }
    }
}
