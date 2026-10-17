using HireFlow.Api.Authentication;
using HireFlow.Api.Data;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace HireFlow.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Student")]
    public class CandidateProfileController : ControllerBase
    {
        private readonly HireFlowDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public CandidateProfileController(
            HireFlowDbContext context,
            UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        private string? CurrentUserId =>
            User.FindFirstValue(ClaimTypes.NameIdentifier);

        // GET: api/CandidateProfile
        [HttpGet]
        public async Task<IActionResult> GetProfile()
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(CurrentUserId);

            if (user == null)
                return NotFound(new { message = "Candidate profile not found." });

            var userId = CurrentUserId;

            return Ok(new
            {
                user.ResumeHeadline,
                user.ProfileSummary,
                user.DesiredRole,
                user.DesiredIndustry,
                user.EmploymentType,
                user.PreferredLocations,
                user.WorkMode,
                user.ExpectedSalary,
                user.NoticePeriod,
                employments = await _context.CandidateEmployments
                    .Where(x => x.UserId == userId)
                    .OrderByDescending(x => x.StartDate)
                    .ToListAsync(),
                education = await _context.CandidateEducations
                    .Where(x => x.UserId == userId)
                    .OrderByDescending(x => x.EndYear)
                    .ToListAsync(),
                projects = await _context.CandidateProjects
                    .Where(x => x.UserId == userId)
                    .OrderByDescending(x => x.CreatedAt)
                    .ToListAsync(),
                skills = await _context.CandidateSkills
                    .Where(x => x.UserId == userId)
                    .OrderBy(x => x.Category)
                    .ThenBy(x => x.SkillName)
                    .ToListAsync(),
                accomplishments = await _context.CandidateAccomplishments
                    .Where(x => x.UserId == userId)
                    .OrderByDescending(x => x.IssueDate)
                    .ToListAsync()
            });
        }

        // PUT: api/CandidateProfile
        [HttpPut]
        public async Task<IActionResult> UpdateProfile(
            [FromBody] CandidateProfileUpdateRequest request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(CurrentUserId);

            if (user == null)
                return NotFound(new { message = "Candidate profile not found." });

            user.ResumeHeadline = request.ResumeHeadline?.Trim();
            user.ProfileSummary = request.ProfileSummary?.Trim();
            user.DesiredRole = request.DesiredRole?.Trim();
            user.DesiredIndustry = request.DesiredIndustry?.Trim();
            user.EmploymentType = request.EmploymentType?.Trim();
            user.PreferredLocations = request.PreferredLocations?.Trim();
            user.WorkMode = request.WorkMode?.Trim();
            user.ExpectedSalary = request.ExpectedSalary;
            user.NoticePeriod = request.NoticePeriod?.Trim();
            user.ProfileLastUpdatedAt = DateTime.UtcNow;

            var result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
                return BadRequest(new
                {
                    message = "Unable to update candidate profile.",
                    errors = result.Errors.Select(x => x.Description)
                });

            return Ok(new
            {
                message = "Candidate profile updated successfully.",
                user.ResumeHeadline,
                user.ProfileSummary,
                user.DesiredRole,
                user.DesiredIndustry,
                user.EmploymentType,
                user.PreferredLocations,
                user.WorkMode,
                user.ExpectedSalary,
                user.NoticePeriod,
                user.ProfileLastUpdatedAt
            });
        }

        // EMPLOYMENT
        [HttpPost("employment")]
        public async Task<IActionResult> AddEmployment(
            [FromBody] CandidateEmployment request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            if (request.EndDate.HasValue &&
                request.EndDate.Value.Date < request.StartDate.Date)
                return BadRequest(new { message = "End date cannot be before start date." });

            var item = new CandidateEmployment
            {
                UserId = CurrentUserId,
                CompanyName = request.CompanyName.Trim(),
                JobTitle = request.JobTitle.Trim(),
                EmploymentType = request.EmploymentType?.Trim(),
                Location = request.Location?.Trim(),
                StartDate = request.StartDate,
                EndDate = request.IsCurrentlyWorking ? null : request.EndDate,
                IsCurrentlyWorking = request.IsCurrentlyWorking,
                Description = request.Description?.Trim()
            };

            _context.CandidateEmployments.Add(item);
            await SaveCandidateChangeAsync();
            return Ok(item);
        }

        [HttpPut("employment/{id:int}")]
        public async Task<IActionResult> UpdateEmployment(
            int id, [FromBody] CandidateEmployment request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = await _context.CandidateEmployments
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);

            if (item == null)
                return NotFound();

            if (request.EndDate.HasValue &&
                request.EndDate.Value.Date < request.StartDate.Date)
                return BadRequest(new { message = "End date cannot be before start date." });

            item.CompanyName = request.CompanyName.Trim();
            item.JobTitle = request.JobTitle.Trim();
            item.EmploymentType = request.EmploymentType?.Trim();
            item.Location = request.Location?.Trim();
            item.StartDate = request.StartDate;
            item.EndDate = request.IsCurrentlyWorking ? null : request.EndDate;
            item.IsCurrentlyWorking = request.IsCurrentlyWorking;
            item.Description = request.Description?.Trim();

            await SaveCandidateChangeAsync();
            return Ok(item);
        }

        [HttpDelete("employment/{id:int}")]
        public async Task<IActionResult> DeleteEmployment(int id)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = await _context.CandidateEmployments
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);

            if (item == null)
                return NotFound();

            _context.CandidateEmployments.Remove(item);
            await SaveCandidateChangeAsync();
            return NoContent();
        }

        // EDUCATION
        [HttpPost("education")]
        public async Task<IActionResult> AddEducation(
            [FromBody] CandidateEducation request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = new CandidateEducation
            {
                UserId = CurrentUserId,
                Institution = request.Institution.Trim(),
                Degree = request.Degree?.Trim() ?? string.Empty,
                Specialization = request.Specialization?.Trim() ?? string.Empty,
                EducationLevel = request.EducationLevel?.Trim() ?? string.Empty,
                Grade = request.Grade,
                GradeType = request.GradeType?.Trim(),
                StartYear = request.StartYear,
                EndYear = request.EndYear,
                Description = request.Description?.Trim()
            };

            _context.CandidateEducations.Add(item);
            await SaveCandidateChangeAsync();
            return Ok(item);
        }

        [HttpPut("education/{id:int}")]
        public async Task<IActionResult> UpdateEducation(
            int id, [FromBody] CandidateEducation request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = await _context.CandidateEducations
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);

            if (item == null)
                return NotFound();

            item.Institution = request.Institution.Trim();
            item.Degree = request.Degree?.Trim() ?? string.Empty;
            item.Specialization = request.Specialization?.Trim() ?? string.Empty;
            item.EducationLevel = request.EducationLevel?.Trim() ?? string.Empty;
            item.Grade = request.Grade;
            item.GradeType = request.GradeType?.Trim();
            item.StartYear = request.StartYear;
            item.EndYear = request.EndYear;
            item.Description = request.Description?.Trim();

            await SaveCandidateChangeAsync();
            return Ok(item);
        }

        [HttpDelete("education/{id:int}")]
        public async Task<IActionResult> DeleteEducation(int id)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = await _context.CandidateEducations
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);

            if (item == null)
                return NotFound();

            _context.CandidateEducations.Remove(item);
            await SaveCandidateChangeAsync();
            return NoContent();
        }

        // PROJECTS
        [HttpPost("projects")]
        public async Task<IActionResult> AddProject(
            [FromBody] CandidateProject request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = new CandidateProject
            {
                UserId = CurrentUserId,
                ProjectTitle = request.ProjectTitle.Trim(),
                ClientName = request.ClientName?.Trim(),
                Role = request.Role?.Trim(),
                Description = request.Description?.Trim(),
                TechnologiesUsed = request.TechnologiesUsed?.Trim(),
                ProjectUrl = request.ProjectUrl?.Trim(),
                StartDate = request.StartDate,
                EndDate = request.EndDate
            };

            _context.CandidateProjects.Add(item);
            await SaveCandidateChangeAsync();
            return Ok(item);
        }

        [HttpPut("projects/{id:int}")]
        public async Task<IActionResult> UpdateProject(
            int id, [FromBody] CandidateProject request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = await _context.CandidateProjects
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);

            if (item == null)
                return NotFound();

            item.ProjectTitle = request.ProjectTitle.Trim();
            item.ClientName = request.ClientName?.Trim();
            item.Role = request.Role?.Trim();
            item.Description = request.Description?.Trim();
            item.TechnologiesUsed = request.TechnologiesUsed?.Trim();
            item.ProjectUrl = request.ProjectUrl?.Trim();
            item.StartDate = request.StartDate;
            item.EndDate = request.EndDate;

            await SaveCandidateChangeAsync();
            return Ok(item);
        }

        [HttpDelete("projects/{id:int}")]
        public async Task<IActionResult> DeleteProject(int id)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = await _context.CandidateProjects
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);

            if (item == null)
                return NotFound();

            _context.CandidateProjects.Remove(item);
            await SaveCandidateChangeAsync();
            return NoContent();
        }

        // KEY SKILLS AND IT SKILLS
        [HttpPost("skills")]
        public async Task<IActionResult> AddSkill(
            [FromBody] CandidateSkill request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var category = NormalizeSkillCategory(request.Category);

            if (category == null)
                return BadRequest(new { message = "Category must be KeySkill or ITSkill." });

            var name = request.SkillName.Trim();

            var exists = await _context.CandidateSkills.AnyAsync(x =>
                x.UserId == CurrentUserId &&
                x.Category == category &&
                x.SkillName == name);

            if (exists)
                return Conflict(new { message = "This skill is already saved." });

            var item = new CandidateSkill
            {
                UserId = CurrentUserId,
                SkillName = name,
                Category = category,
                Proficiency = request.Proficiency?.Trim(),
                Version = request.Version?.Trim()
            };

            _context.CandidateSkills.Add(item);
            await SaveCandidateChangeAsync();
            return Ok(item);
        }

        [HttpPut("skills/{id:int}")]
        public async Task<IActionResult> UpdateSkill(
            int id, [FromBody] CandidateSkill request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var category = NormalizeSkillCategory(request.Category);

            if (category == null)
                return BadRequest(new { message = "Category must be KeySkill or ITSkill." });

            var item = await _context.CandidateSkills
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);

            if (item == null)
                return NotFound();

            var name = request.SkillName.Trim();

            var duplicate = await _context.CandidateSkills.AnyAsync(x =>
                x.Id != id &&
                x.UserId == CurrentUserId &&
                x.Category == category &&
                x.SkillName == name);

            if (duplicate)
                return Conflict(new { message = "This skill is already saved." });

            item.SkillName = name;
            item.Category = category;
            item.Proficiency = request.Proficiency?.Trim();
            item.Version = request.Version?.Trim();

            await SaveCandidateChangeAsync();
            return Ok(item);
        }

        [HttpDelete("skills/{id:int}")]
        public async Task<IActionResult> DeleteSkill(int id)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = await _context.CandidateSkills
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);

            if (item == null)
                return NotFound();

            _context.CandidateSkills.Remove(item);
            await SaveCandidateChangeAsync();
            return NoContent();
        }

        // ACCOMPLISHMENTS
        [HttpPost("accomplishments")]
        public async Task<IActionResult> AddAccomplishment(
            [FromBody] CandidateAccomplishment request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = new CandidateAccomplishment
            {
                UserId = CurrentUserId,
                Category = request.Category.Trim(),
                Title = request.Title.Trim(),
                IssuingOrganization = request.IssuingOrganization?.Trim(),
                Description = request.Description?.Trim(),
                IssueDate = request.IssueDate,
                CredentialUrl = request.CredentialUrl?.Trim()
            };

            _context.CandidateAccomplishments.Add(item);
            await SaveCandidateChangeAsync();
            return Ok(item);
        }

        [HttpPut("accomplishments/{id:int}")]
        public async Task<IActionResult> UpdateAccomplishment(
            int id, [FromBody] CandidateAccomplishment request)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = await _context.CandidateAccomplishments
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);

            if (item == null)
                return NotFound();

            item.Category = request.Category.Trim();
            item.Title = request.Title.Trim();
            item.IssuingOrganization = request.IssuingOrganization?.Trim();
            item.Description = request.Description?.Trim();
            item.IssueDate = request.IssueDate;
            item.CredentialUrl = request.CredentialUrl?.Trim();

            await SaveCandidateChangeAsync();
            return Ok(item);
        }

        [HttpDelete("accomplishments/{id:int}")]
        public async Task<IActionResult> DeleteAccomplishment(int id)
        {
            if (string.IsNullOrWhiteSpace(CurrentUserId))
                return Unauthorized();

            var item = await _context.CandidateAccomplishments
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);

            if (item == null)
                return NotFound();

            _context.CandidateAccomplishments.Remove(item);
            await SaveCandidateChangeAsync();
            return NoContent();
        }

        // Persist the section change and profile timestamp together.
        private async Task SaveCandidateChangeAsync()
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(x => x.Id == CurrentUserId);

            if (user == null)
                throw new InvalidOperationException("Candidate profile not found.");

            user.ProfileLastUpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        private static string? NormalizeSkillCategory(string? category)
        {
            if (string.Equals(category, "KeySkill", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(category, "Key Skills", StringComparison.OrdinalIgnoreCase))
                return "KeySkill";

            if (string.Equals(category, "ITSkill", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(category, "IT Skills", StringComparison.OrdinalIgnoreCase))
                return "ITSkill";

            return null;
        }
    }

    public class CandidateProfileUpdateRequest
    {
        [StringLength(250)]
        public string? ResumeHeadline { get; set; }

        [StringLength(5000)]
        public string? ProfileSummary { get; set; }

        [StringLength(150)]
        public string? DesiredRole { get; set; }

        [StringLength(150)]
        public string? DesiredIndustry { get; set; }

        [StringLength(100)]
        public string? EmploymentType { get; set; }

        [StringLength(500)]
        public string? PreferredLocations { get; set; }

        [StringLength(50)]
        public string? WorkMode { get; set; }

        [Range(0, 100000000)]
        public decimal? ExpectedSalary { get; set; }

        [StringLength(100)]
        public string? NoticePeriod { get; set; }
    }
}