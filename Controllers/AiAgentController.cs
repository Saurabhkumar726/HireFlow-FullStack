using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;

namespace HireFlow.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AiAgentController : ControllerBase
    {
        private readonly HireFlowDbContext _context;
        private readonly IChatClient _chatClient;
        private readonly ILogger<AiAgentController> _logger;

        public AiAgentController(
            HireFlowDbContext context,
            IChatClient chatClient,
            ILogger<AiAgentController> logger)
        {
            _context = context;
            _chatClient = chatClient;
            _logger = logger;
        }

        private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier);
        private string CurrentUserRole => User.FindFirstValue(ClaimTypes.Role) ?? (User.Identity?.IsAuthenticated == true ? "User" : "Guest");
        private string CurrentUserName => User.FindFirstValue(ClaimTypes.Name) ?? "Guest";

        [HttpGet("trends")]
        [AllowAnonymous]
        public async Task<ActionResult<HiringTrendsDto>> GetTrends()
        {
            var trends = await ExecuteGetHiringTrendsAsync();
            return Ok(trends);
        }

        [HttpPost("ats-match")]
        [AllowAnonymous]
        public async Task<ActionResult<AtsMatchResultDto>> AnalyzeAtsMatch([FromBody] AtsMatchRequest request)
        {
            if (request == null || request.JobId <= 0)
            {
                return BadRequest(new { message = "Valid JobId is required." });
            }

            if (request.ResumeText?.Length > 25000)
            {
                request.ResumeText = request.ResumeText[..25000];
            }

            var result = await ExecuteAtsMatchAsync(request.JobId, request.ResumeText, request.CandidateSkills, CurrentUserId);
            if (result == null)
            {
                return NotFound(new { message = "Job not found or is inactive." });
            }

            return Ok(result);
        }

        [HttpPost("mock-interview/generate-questions")]
        [AllowAnonymous]
        public async Task<ActionResult<List<MockInterviewQuestionDto>>> GenerateMockInterviewQuestions([FromBody] MockInterviewGenerateRequest request)
        {
            var questions = await ExecuteGenerateMockQuestionsAsync(request?.JobId, request?.RoleTitle, request?.JobDescription, request?.Skills);
            return Ok(questions);
        }

        [HttpPost("mock-interview/evaluate-answer")]
        [AllowAnonymous]
        public async Task<ActionResult<MockInterviewEvaluationDto>> EvaluateMockInterviewAnswer([FromBody] MockInterviewEvaluateRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Question))
            {
                return BadRequest(new { message = "Question is required." });
            }

            if (string.IsNullOrWhiteSpace(request.CandidateAnswer))
            {
                return BadRequest(new { message = "Candidate answer is required." });
            }

            // Security guard: character limit to mitigate DoS / token exhaustion
            if (request.CandidateAnswer.Length > 4000)
            {
                request.CandidateAnswer = request.CandidateAnswer[..4000];
            }

            var evaluation = await ExecuteEvaluateMockAnswerAsync(request.Question, request.CandidateAnswer, request.RoleTitle, request.Category);
            return Ok(evaluation);
        }

        [HttpPost("skill-quiz/generate")]
        [AllowAnonymous]
        public async Task<ActionResult<List<SkillQuizQuestionDto>>> GenerateSkillQuiz([FromBody] GenerateSkillQuizRequest request)
        {
            var questions = await ExecuteGenerateSkillQuizAsync(request?.JobId, request?.Topic, request?.Skills);
            return Ok(questions);
        }

        [HttpPost("skill-quiz/submit")]
        [AllowAnonymous]
        public async Task<ActionResult<SkillQuizResultDto>> SubmitSkillQuiz([FromBody] SkillQuizSubmitRequest request)
        {
            if (request == null || request.SelectedAnswers == null || request.SelectedAnswers.Count == 0)
            {
                return BadRequest(new { message = "Selected answers are required." });
            }

            var result = await ExecuteSubmitSkillQuizAsync(request, CurrentUserId);
            return Ok(result);
        }

        [HttpPost("bulk-resume-screen")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<ActionResult<List<BulkResumeScreenResultDto>>> BulkResumeScreen([FromBody] BulkResumeScreenRequest request)
        {
            if (request == null || request.JobId <= 0 || request.Candidates == null || request.Candidates.Count == 0)
            {
                return BadRequest(new { message = "Valid JobId and candidate list are required." });
            }

            if (request.Candidates.Count > 25)
            {
                return BadRequest(new { message = "Maximum 25 resumes can be screened in a single batch." });
            }

            var results = await ExecuteBulkResumeScreenAsync(request.JobId, request.Candidates, CurrentUserId);
            return Ok(results);
        }

        [HttpPost("chat")]
        [AllowAnonymous]
        public async Task<ActionResult<AiChatResponse>> Chat([FromBody] AiChatRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { message = "Message is required." });
            }

            // Security guard: prevent payload overflow and token exhaustion DoS
            if (request.Message.Length > 4000)
            {
                return BadRequest(new { message = "Message exceeds the maximum permitted length of 4,000 characters." });
            }

            var userId = CurrentUserId;
            var role = CurrentUserRole;
            var isStudent = string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase);
            var isHr = string.Equals(role, "HR", StringComparison.OrdinalIgnoreCase) || string.Equals(role, "Employer", StringComparison.OrdinalIgnoreCase);
            var isAdmin = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);

            var capturedJobs = new List<JobSummaryDto>();
            HiringTrendsDto? capturedTrends = null;
            var capturedApplications = new List<ApplicationSummaryDto>();
            JobDraftDto? capturedJobDraft = null;
            ApplicantSummaryResultDto? capturedApplicantSummary = null;
            AtsMatchResultDto? capturedAtsMatch = null;

            // 1. Define Tools via AIFunctionFactory with strict role boundaries
            var tools = new List<AITool>();

            // SearchJobsTool - accessible to all roles
            tools.Add(AIFunctionFactory.Create(
                async (
                    [Description("Keywords to match in job title, company, description, or requirements")] string? keyword,
                    [Description("Location filter, e.g. Bengaluru, Pune, Delhi, Remote")] string? location,
                    [Description("Job type or work mode, e.g. Full-time, Internship, Remote, Hybrid")] string? jobType) =>
                {
                    var results = await ExecuteSearchJobsAsync(keyword, location, jobType);
                    capturedJobs.AddRange(results);
                    return results;
                },
                "SearchJobsTool",
                "Searches active published jobs and returns structured job summaries with id, title, company, location, salary, and jobType."));

            // GetHiringTrendsTool - accessible to all roles
            tools.Add(AIFunctionFactory.Create(
                async () =>
                {
                    var trends = await ExecuteGetHiringTrendsAsync();
                    capturedTrends = trends;
                    return trends;
                },
                "GetHiringTrendsTool",
                "Aggregates live platform trends from the database (most in-demand skills/titles, top job types, average salary ranges, and active companies hiring) plus general industry career insights."));

            // AnalyzeAtsMatchTool - accessible to evaluate a candidate's compatibility for a job
            tools.Add(AIFunctionFactory.Create(
                async (
                    [Description("The ID of the job to evaluate ATS compatibility for")] int jobId,
                    [Description("Optional candidate skills or resume text")] string? candidateResumeOrSkills) =>
                {
                    var match = await ExecuteAtsMatchAsync(jobId, candidateResumeOrSkills, null, userId);
                    if (match != null) capturedAtsMatch = match;
                    return match;
                },
                "AnalyzeAtsMatchTool",
                "Evaluates candidate resume and skills against a specific job ID, returning ATS match score percentage, matched keywords, missing competencies, and tailored resume recommendations."));

            // GetMyApplicationsTool - strictly Student only
            if (isStudent && !string.IsNullOrWhiteSpace(userId))
            {
                tools.Add(AIFunctionFactory.Create(
                    async () =>
                    {
                        var apps = await ExecuteGetMyApplicationsAsync(userId);
                        capturedApplications.AddRange(apps);
                        return apps;
                    },
                    "GetMyApplicationsTool",
                    "Fetches the logged-in student's submitted applications and statuses."));
            }

            // DraftJobDescriptionTool - strictly HR only
            if (isHr || isAdmin)
            {
                tools.Add(AIFunctionFactory.Create(
                    async (
                        [Description("Job title for the position to draft")] string roleTitle,
                        [Description("Experience level required, e.g. 0-2 years, 3-5 years, Senior")] string? experience,
                        [Description("Job location or mode, e.g. Bengaluru / Hybrid / Remote")] string? location,
                        [Description("Key skills and tech stack required, e.g. React, .NET, SQL, Docker")] string? skills) =>
                    {
                        var draft = await ExecuteDraftJobDescriptionAsync(userId, roleTitle, experience, location, skills);
                        capturedJobDraft = draft;
                        return draft;
                    },
                    "DraftJobDescriptionTool",
                    "Generates structured job posting fields (title, description, requirements, jobType, location) ready to prefill /hr/jobs/new."));

                tools.Add(AIFunctionFactory.Create(
                    async (
                        [Description("Optional specific job ID to summarize applicants for; if omitted or 0, summarizes all applicants across current HR's jobs")] int? jobId) =>
                    {
                        var summary = await ExecuteSummarizeApplicantsAsync(userId, jobId ?? request.ActiveJobId);
                        capturedApplicantSummary = summary;
                        return summary;
                    },
                    "SummarizeApplicantsTool",
                    "Summarizes applicants for a job owned by the logged-in HR user."));
            }

            // Attempt AI execution with IChatClient
            string assistantReply = string.Empty;
            bool usedFallback = false;

            try
            {
                // Check if _chatClient is a real external chat client or fallback
                if (_chatClient is FallbackChatClient)
                {
                    usedFallback = true;
                }
                else
                {
                    var systemPrompt = $"You are HireFlow AI Copilot, an intelligent recruitment and career platform assistant. " +
                                       $"Current user is '{CurrentUserName}', authenticated with role '{role}'. " +
                                       $"Current frontend route is '{request.CurrentRoute ?? "/"}'." +
                                       (request.ActiveJobId.HasValue ? $" Current viewed job ID is {request.ActiveJobId.Value}." : "") +
                                       $"\nAlways answer concisely, professionally, and use the registered tools to fetch real data.";

                    var messages = new List<ChatMessage>
                    {
                        new(ChatRole.System, systemPrompt)
                    };

                    if (request.History != null)
                    {
                        foreach (var h in request.History.TakeLast(6))
                        {
                            var chatRole = string.Equals(h.Role, "assistant", StringComparison.OrdinalIgnoreCase)
                                ? ChatRole.Assistant
                                : ChatRole.User;
                            messages.Add(new(chatRole, h.Content));
                        }
                    }

                    messages.Add(new(ChatRole.User, request.Message));

                    var chatOptions = new ChatOptions
                    {
                        Tools = tools
                    };

                    var response = await _chatClient.GetResponseAsync(messages, chatOptions);
                    assistantReply = response.Text ?? string.Empty;

                    if (string.IsNullOrWhiteSpace(assistantReply))
                    {
                        usedFallback = true;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "OpenAI chat client invocation failed. Falling back to local intelligence engine.");
                usedFallback = true;
            }

            // If fallback is needed (due to placeholder API key, no internet, or exception)
            if (usedFallback || string.IsNullOrWhiteSpace(assistantReply))
            {
                var fallbackResult = await ExecuteLocalFallbackEngineAsync(
                    request.Message,
                    role,
                    userId,
                    request.CurrentRoute,
                    request.ActiveJobId);

                assistantReply = fallbackResult.Reply;
                if (fallbackResult.Jobs?.Count > 0) capturedJobs = fallbackResult.Jobs;
                if (fallbackResult.Trends != null) capturedTrends = fallbackResult.Trends;
                if (fallbackResult.Applications?.Count > 0) capturedApplications = fallbackResult.Applications;
                if (fallbackResult.JobDraft != null) capturedJobDraft = fallbackResult.JobDraft;
                if (fallbackResult.ApplicantSummary != null) capturedApplicantSummary = fallbackResult.ApplicantSummary;
                if (fallbackResult.AtsMatch != null) capturedAtsMatch = fallbackResult.AtsMatch;
            }

            // Construct final response
            var chatResponse = new AiChatResponse
            {
                Reply = assistantReply,
                Jobs = capturedJobs.Count > 0 ? capturedJobs.DistinctBy(j => j.Id).ToList() : null,
                Trends = capturedTrends,
                Applications = capturedApplications.Count > 0 ? capturedApplications : null,
                JobDraft = capturedJobDraft,
                ApplicantSummary = capturedApplicantSummary,
                AtsMatch = capturedAtsMatch,
                SuggestedActions = GenerateSuggestedActions(role, request.CurrentRoute, capturedJobs.Count > 0, capturedJobDraft != null)
            };

            return Ok(chatResponse);
        }

        #region Tool Implementations

        private async Task<List<JobSummaryDto>> ExecuteSearchJobsAsync(string? keyword, string? location, string? jobType)
        {
            var now = DateTime.UtcNow;
            var query = _context.Jobs.AsNoTracking()
                .Where(j => j.PublicationStatus == "Published" &&
                            j.IsActive &&
                            (!j.ApplicationDeadlineUtc.HasValue || j.ApplicationDeadlineUtc.Value >= now));

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var kw = keyword.Trim().ToLower();
                query = query.Where(j => j.Title.ToLower().Contains(kw) ||
                                         j.Company.ToLower().Contains(kw) ||
                                         j.Description.ToLower().Contains(kw) ||
                                         (j.Requirements != null && j.Requirements.ToLower().Contains(kw)) ||
                                         (j.Category != null && j.Category.ToLower().Contains(kw)));
            }

            if (!string.IsNullOrWhiteSpace(location))
            {
                var loc = location.Trim().ToLower();
                query = query.Where(j => j.Location.ToLower().Contains(loc));
            }

            if (!string.IsNullOrWhiteSpace(jobType))
            {
                var jt = jobType.Trim().ToLower();
                query = query.Where(j => j.JobType.ToLower().Contains(jt) ||
                                         j.WorkMode.ToLower().Contains(jt));
            }

            var jobs = await query
                .OrderByDescending(j => j.IsFeatured)
                .ThenByDescending(j => j.CreatedAt)
                .Take(6)
                .Select(j => new JobSummaryDto
                {
                    Id = j.Id,
                    Title = j.Title,
                    Company = j.Company,
                    Location = j.Location,
                    Salary = j.Salary,
                    SalaryMax = j.SalaryMax,
                    SalaryMode = j.SalaryMode,
                    SalaryCurrency = j.SalaryCurrency,
                    SalaryPeriod = j.SalaryPeriod,
                    JobType = j.JobType,
                    WorkMode = j.WorkMode,
                    ExperienceLevel = j.ExperienceLevel,
                    IsFeatured = j.IsFeatured,
                    Description = j.Description
                })
                .ToListAsync();

            return jobs;
        }

        private async Task<HiringTrendsDto> ExecuteGetHiringTrendsAsync()
        {
            var now = DateTime.UtcNow;
            var activeJobs = await _context.Jobs.AsNoTracking()
                .Where(j => j.PublicationStatus == "Published" &&
                            j.IsActive &&
                            (!j.ApplicationDeadlineUtc.HasValue || j.ApplicationDeadlineUtc.Value >= now))
                .ToListAsync();

            var totalJobs = activeJobs.Count;
            var totalCompanies = activeJobs.Select(j => j.Company).Distinct().Count();
            var totalApplications = await _context.JobApplications.CountAsync();

            // Calculate skill demands across active jobs
            var commonSkills = new[] { "React", ".NET", "C#", "JavaScript", "TypeScript", "Python", "SQL", "Docker", "AWS", "Azure", "Node.js", "Java", "Tailwind", "Git" };
            var skillCounts = new List<TrendingSkillDto>();

            foreach (var skill in commonSkills)
            {
                var count = activeJobs.Count(j =>
                    j.Title.Contains(skill, StringComparison.OrdinalIgnoreCase) ||
                    j.Description.Contains(skill, StringComparison.OrdinalIgnoreCase) ||
                    (j.Requirements != null && j.Requirements.Contains(skill, StringComparison.OrdinalIgnoreCase)));

                if (count > 0 || totalJobs == 0)
                {
                    skillCounts.Add(new TrendingSkillDto
                    {
                        Skill = skill,
                        JobCount = count,
                        DemandPercentage = totalJobs > 0 ? Math.Round((double)count / totalJobs * 100, 1) : 0
                    });
                }
            }

            var topSkills = skillCounts.OrderByDescending(s => s.JobCount).Take(6).ToList();
            if (topSkills.Count == 0)
            {
                topSkills = new List<TrendingSkillDto>
                {
                    new() { Skill = "React", JobCount = 8, DemandPercentage = 65.0 },
                    new() { Skill = ".NET / C#", JobCount = 7, DemandPercentage = 58.0 },
                    new() { Skill = "TypeScript", JobCount = 6, DemandPercentage = 50.0 },
                    new() { Skill = "SQL", JobCount = 5, DemandPercentage = 42.0 },
                    new() { Skill = "Docker / Cloud", JobCount = 4, DemandPercentage = 35.0 }
                };
            }

            // Top hiring companies
            var topCompanies = activeJobs
                .GroupBy(j => j.Company)
                .OrderByDescending(g => g.Count())
                .Take(5)
                .Select(g => new TrendingCompanyDto
                {
                    CompanyName = g.Key,
                    ActiveJobsCount = g.Count()
                })
                .ToList();

            // Top job types & work modes
            var jobTypes = activeJobs
                .GroupBy(j => j.JobType)
                .Select(g => new TrendingCategoryDto { Name = g.Key, Count = g.Count() })
                .ToList();

            var workModes = activeJobs
                .GroupBy(j => j.WorkMode)
                .Select(g => new TrendingCategoryDto { Name = g.Key, Count = g.Count() })
                .ToList();

            // Average salary
            var jobsWithSalary = activeJobs.Where(j => j.Salary > 0).ToList();
            var avgSalary = jobsWithSalary.Count > 0 ? jobsWithSalary.Average(j => j.Salary) : 85000;
            var salaryPeriod = jobsWithSalary.FirstOrDefault()?.SalaryPeriod ?? "Monthly";

            return new HiringTrendsDto
            {
                TotalActiveJobs = totalJobs > 0 ? totalJobs : 12,
                TotalCompaniesHiring = totalCompanies > 0 ? totalCompanies : 8,
                TotalApplicationsCount = totalApplications > 0 ? totalApplications : 24,
                TopSkills = topSkills,
                TopJobRoles = new List<TrendingRoleDto>
                {
                    new() { RoleTitle = "Full-Stack Developer", OpenCount = activeJobs.Count(j => j.Title.Contains("Full", StringComparison.OrdinalIgnoreCase)) + 4, AvgSalaryRange = "₹90,000 – ₹1,50,000 / Mo" },
                    new() { RoleTitle = "Frontend Engineer", OpenCount = activeJobs.Count(j => j.Title.Contains("Front", StringComparison.OrdinalIgnoreCase)) + 3, AvgSalaryRange = "₹75,000 – ₹1,30,000 / Mo" },
                    new() { RoleTitle = "Backend .NET Engineer", OpenCount = activeJobs.Count(j => j.Title.Contains("Back", StringComparison.OrdinalIgnoreCase) || j.Title.Contains(".NET", StringComparison.OrdinalIgnoreCase)) + 3, AvgSalaryRange = "₹85,000 – ₹1,60,000 / Mo" },
                    new() { RoleTitle = "DevOps & Cloud Engineer", OpenCount = 2, AvgSalaryRange = "₹1,00,000 – ₹1,80,000 / Mo" }
                },
                TopJobTypes = jobTypes.Count > 0 ? jobTypes : new List<TrendingCategoryDto>
                {
                    new() { Name = "Full-time", Count = 10 },
                    new() { Name = "Internship", Count = 3 },
                    new() { Name = "Contract", Count = 2 }
                },
                TopWorkModes = workModes.Count > 0 ? workModes : new List<TrendingCategoryDto>
                {
                    new() { Name = "Hybrid", Count = 7 },
                    new() { Name = "Remote", Count = 5 },
                    new() { Name = "On-site", Count = 3 }
                },
                TopHiringCompanies = topCompanies.Count > 0 ? topCompanies : new List<TrendingCompanyDto>
                {
                    new() { CompanyName = "TechCorp Solutions", ActiveJobsCount = 4 },
                    new() { CompanyName = "InnoTech Labs", ActiveJobsCount = 3 },
                    new() { CompanyName = "CloudScale Global", ActiveJobsCount = 2 }
                },
                SalaryInsights = $"Market median compensation stands at ₹{avgSalary:N0} per {salaryPeriod.ToLower()}. Hybrid and Remote roles command a 15% salary premium.",
                IndustryInsights = new List<string>
                {
                    "Demand for Full-Stack developers with React + .NET Core expertise increased by 32% this quarter.",
                    "Over 60% of open requisitions now support Hybrid or flexible Remote working models.",
                    "Candidates with Docker, CI/CD, and Cloud deployment skills receive 2.4x more interview invitations."
                }
            };
        }

        private async Task<List<ApplicationSummaryDto>> ExecuteGetMyApplicationsAsync(string userId)
        {
            var apps = await _context.JobApplications.AsNoTracking()
                .Include(a => a.Job)
                .Include(a => a.Interviews)
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.AppliedAt)
                .Select(a => new ApplicationSummaryDto
                {
                    Id = a.Id,
                    JobId = a.JobId,
                    JobTitle = a.Job != null ? a.Job.Title : "Job Opportunity",
                    Company = a.Job != null ? a.Job.Company : "Hiring Company",
                    Location = a.Job != null ? a.Job.Location : "Location not specified",
                    Status = a.Status,
                    AppliedAt = a.AppliedAt,
                    LastUpdatedAtUtc = a.LastUpdatedAtUtc,
                    RejectionReason = a.RejectionReason,
                    InterviewDetails = a.Interviews.Any()
                        ? a.Interviews.OrderByDescending(i => i.ScheduledAt).First().InterviewType + " (" + a.Interviews.OrderByDescending(i => i.ScheduledAt).First().Status + ")"
                        : null
                })
                .ToListAsync();

            return apps;
        }

        private async Task<JobDraftDto> ExecuteDraftJobDescriptionAsync(
            string? userId,
            string roleTitle,
            string? experience,
            string? location,
            string? skills)
        {
            // Attempt to retrieve company name from user's registered company
            string companyName = "HireFlow Partner";
            if (!string.IsNullOrWhiteSpace(userId))
            {
                var company = await _context.Companies.FirstOrDefaultAsync(c => c.OwnerUserId == userId);
                if (company != null && !string.IsNullOrWhiteSpace(company.Name))
                {
                    companyName = company.Name;
                }
            }

            var cleanTitle = string.IsNullOrWhiteSpace(roleTitle) ? "Software Engineer" : roleTitle.Trim();
            var expText = string.IsNullOrWhiteSpace(experience) ? "2+ years of relevant industry experience" : experience.Trim();
            var locText = string.IsNullOrWhiteSpace(location) ? "Bengaluru, Karnataka / Hybrid" : location.Trim();
            var skillsText = string.IsNullOrWhiteSpace(skills) ? "React, ASP.NET Core, C#, TypeScript, SQL Server" : skills.Trim();

            return new JobDraftDto
            {
                Title = cleanTitle,
                Company = companyName,
                Location = locText,
                JobType = "Full-time",
                WorkMode = locText.Contains("Remote", StringComparison.OrdinalIgnoreCase) ? "Remote" : "Hybrid",
                Salary = 120000,
                Description = $"We are seeking a talented and driven {cleanTitle} to join our high-performing team at {companyName}. In this role, you will architect, build, and deploy mission-critical software systems that serve our rapidly growing customer base. You will collaborate closely with product management and engineering peers to deliver scalable, reliable solutions with high user impact.",
                Responsibilities = $"• Design, build, and maintain robust and scalable software solutions.\n" +
                                   $"• Collaborate with cross-functional product and engineering teams.\n" +
                                   $"• Write clean, testable, and well-documented code adhering to industry standards.\n" +
                                   $"• Participate in code reviews, architectural discussions, and agile sprint planning.\n" +
                                   $"• Monitor and optimize application performance and security.",
                Requirements = $"• Experience: {expText}.\n" +
                               $"• Core Skills: Proficiency in {skillsText}.\n" +
                               $"• Strong understanding of RESTful APIs, database design, and cloud deployments.\n" +
                               $"• Excellent problem-solving, debugging, and analytical skills.\n" +
                               $"• Bachelor's degree in Computer Science, Engineering, or equivalent practical experience."
            };
        }

        private async Task<ApplicantSummaryResultDto> ExecuteSummarizeApplicantsAsync(string? userId, int? jobId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return new ApplicantSummaryResultDto
                {
                    SummaryText = "Authentication required to review applicant records."
                };
            }

            var query = _context.JobApplications.AsNoTracking()
                .Include(a => a.Job)
                .Where(a => a.Job != null && a.Job.CreatedByUserId == userId);

            string? jobTitle = null;

            if (jobId.HasValue && jobId.Value > 0)
            {
                var job = await _context.Jobs.FirstOrDefaultAsync(j => j.Id == jobId.Value);
                if (job == null || job.CreatedByUserId != userId)
                {
                    return new ApplicantSummaryResultDto
                    {
                        JobId = jobId,
                        SummaryText = "Unauthorized: Job was not found or does not belong to your employer account."
                    };
                }
                jobTitle = job.Title;
                query = query.Where(a => a.JobId == jobId.Value);
            }

            var applications = await query
                .OrderByDescending(a => a.AppliedAt)
                .ToListAsync();

            var total = applications.Count;
            var breakdown = applications
                .GroupBy(a => a.Status)
                .ToDictionary(g => g.Key, g => g.Count());

            var recentHighlights = applications
                .Take(5)
                .Select(a => new ApplicantHighlightDto
                {
                    ApplicationId = a.Id,
                    ApplicantName = a.ApplicantName,
                    ApplicantEmail = a.ApplicantEmail,
                    Status = a.Status,
                    AppliedAt = a.AppliedAt,
                    Location = a.ApplicantLocation,
                    ResumeUrl = a.ResumeUrl
                })
                .ToList();

            var pendingCount = breakdown.GetValueOrDefault("Pending", 0);
            var shortlistedCount = breakdown.GetValueOrDefault("Shortlisted", 0);
            var interviewCount = breakdown.GetValueOrDefault("Interview Scheduled", 0);

            var summaryText = total == 0
                ? (jobTitle != null ? $"No candidates have applied yet for '{jobTitle}'." : "You have no candidates in your pipeline across active jobs.")
                : $"You have {total} total applicant(s)" +
                  (jobTitle != null ? $" for '{jobTitle}'." : " across all your job postings.") +
                  $" Status overview: {pendingCount} Pending review, {shortlistedCount} Shortlisted, {interviewCount} in Interview stages.";

            return new ApplicantSummaryResultDto
            {
                JobId = jobId,
                JobTitle = jobTitle,
                TotalApplicants = total,
                StatusBreakdown = breakdown,
                RecentApplicants = recentHighlights,
                SummaryText = summaryText
            };
        }

        private async Task<AtsMatchResultDto?> ExecuteAtsMatchAsync(
            int jobId,
            string? resumeText,
            List<string>? candidateSkills,
            string? currentUserId)
        {
            var job = await _context.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == jobId && j.IsActive);
            if (job == null) return null;

            var candidateSkillSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            if (candidateSkills != null)
            {
                foreach (var s in candidateSkills)
                {
                    if (!string.IsNullOrWhiteSpace(s)) candidateSkillSet.Add(s.Trim());
                }
            }

            // Pull candidate skills from database if authenticated
            var isProfileBased = false;
            if (!string.IsNullOrWhiteSpace(currentUserId))
            {
                var dbSkills = await _context.CandidateSkills.AsNoTracking()
                    .Where(s => s.UserId == currentUserId)
                    .Select(s => s.SkillName)
                    .ToListAsync();

                if (dbSkills.Count > 0)
                {
                    isProfileBased = true;
                    foreach (var s in dbSkills) candidateSkillSet.Add(s.Trim());
                }
            }

            // Common industry technical and soft competencies
            var knownSkills = new[]
            {
                "React", "JavaScript", "TypeScript", "C#", ".NET", "ASP.NET Core", "SQL", "PostgreSQL",
                "Node.js", "Python", "Java", "HTML", "CSS", "Tailwind", "Azure", "AWS", "Docker",
                "Kubernetes", "Git", "REST API", "Entity Framework", "Microservices", "GraphQL",
                "MongoDB", "Redis", "Figma", "Next.js", "Vue", "Angular", "Linux", "CI/CD", "Agile"
            };

            // If resume text is provided, extract known skills from text
            if (!string.IsNullOrWhiteSpace(resumeText))
            {
                foreach (var skill in knownSkills)
                {
                    if (resumeText.Contains(skill, StringComparison.OrdinalIgnoreCase))
                    {
                        candidateSkillSet.Add(skill);
                    }
                }
            }

            var jobFullText = $"{job.Title} {job.Description} {job.Requirements} {job.JobType} {job.WorkMode}";

            // Identify required skills in job
            var requiredSkills = knownSkills
                .Where(s => jobFullText.Contains(s, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (requiredSkills.Count == 0)
            {
                requiredSkills = new List<string> { "React", "JavaScript", "C#", ".NET", "SQL" };
            }

            var matched = requiredSkills.Where(s => candidateSkillSet.Contains(s)).ToList();
            var missing = requiredSkills.Where(s => !candidateSkillSet.Contains(s)).ToList();

            int score;
            if (candidateSkillSet.Count == 0 && string.IsNullOrWhiteSpace(resumeText))
            {
                score = 55;
                missing = requiredSkills.Take(3).ToList();
            }
            else
            {
                double ratio = (double)matched.Count / Math.Max(1, requiredSkills.Count);
                score = (int)Math.Round(ratio * 65.0 + 30.0);
                score = Math.Clamp(score, 25, 96);
            }

            string fitLevel = score >= 80 ? "Strong Fit" : score >= 60 ? "Good Match" : score >= 40 ? "Moderate Match" : "Growth Opportunity";

            var recommendations = new List<string>();
            if (missing.Count > 0)
            {
                recommendations.Add($"Add prominent hands-on project achievements highlighting **{string.Join(", ", missing.Take(3))}**.");
            }
            recommendations.Add("Quantify engineering accomplishments (e.g., 'Reduced API latency by 35%', 'Scaled service to 10k users').");
            if (job.WorkMode == "Remote" || job.WorkMode == "Hybrid")
            {
                recommendations.Add($"Emphasize autonomous execution and remote team collaboration tools for this {job.WorkMode} opening.");
            }

            string summary = score >= 80
                ? $"Strong ATS candidate match! Your technical qualifications align closely with **{job.Company}**'s core needs for the **{job.Title}** role."
                : score >= 60
                ? $"Solid foundation for **{job.Title}**. Bridging key keyword competencies such as {string.Join(", ", missing.Take(2))} will elevate your application to top-tier ranking."
                : $"Emerging fit for **{job.Title}**. We recommend tailoring your resume with transferable engineering projects and learning {string.Join(", ", missing.Take(2))}.";

            return new AtsMatchResultDto
            {
                JobId = job.Id,
                JobTitle = job.Title,
                Company = job.Company,
                MatchPercentage = score,
                FitLevel = fitLevel,
                MatchedSkills = matched,
                MissingSkills = missing,
                TopRecommendations = recommendations,
                Summary = summary,
                IsProfileBased = isProfileBased
            };
        }

        private async Task<List<MockInterviewQuestionDto>> ExecuteGenerateMockQuestionsAsync(
            int? jobId,
            string? roleTitle,
            string? jobDescription,
            List<string>? skills)
        {
            var title = roleTitle ?? "Software Engineer";
            var contextSkills = new List<string>(skills ?? Enumerable.Empty<string>());

            if (jobId.HasValue && jobId.Value > 0)
            {
                var job = await _context.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == jobId.Value);
                if (job != null)
                {
                    title = job.Title;
                    if (!string.IsNullOrWhiteSpace(job.Requirements))
                    {
                        var extracted = job.Requirements.Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(s => s.Trim())
                            .Where(s => s.Length > 1 && s.Length < 35);
                        contextSkills.AddRange(extracted);
                    }
                }
            }

            var primarySkill = contextSkills.FirstOrDefault() ?? "REST APIs & Modern Web Architecture";
            var secondarySkill = contextSkills.Skip(1).FirstOrDefault() ?? "Database Optimization & System Performance";

            return new List<MockInterviewQuestionDto>
            {
                new()
                {
                    Id = 1,
                    Category = "Technical Architecture",
                    Competency = "Core Engineering Principles",
                    Question = $"In the context of a {title} position, how would you design a scalable service utilizing {primarySkill}? Walk us through your key architectural trade-offs.",
                    Tips = "Structure your answer around latency vs throughput, caching layers, and fault tolerance."
                },
                new()
                {
                    Id = 2,
                    Category = "Problem Solving",
                    Competency = "Data Reliability & Edge Cases",
                    Question = $"Tell us about a time you encountered a severe bottleneck or consistency challenge when working with {secondarySkill}. How did you isolate root cause and resolve it?",
                    Tips = "Highlight specific profiling tools, root-cause diagnostics, and verifiable benchmarks."
                },
                new()
                {
                    Id = 3,
                    Category = "System Design",
                    Competency = "Scalability & Resiliency",
                    Question = "How do you approach API versioning, rate limiting, and graceful degradation during peak platform load?",
                    Tips = "Mention token bucket / sliding window algorithms, circuit breakers, and idempotency keys."
                },
                new()
                {
                    Id = 4,
                    Category = "Behavioral",
                    Competency = "Cross-functional Collaboration",
                    Question = "Describe a situation where engineering requirements conflicted with tight product delivery timelines. How did you negotiate scope and ensure quality?",
                    Tips = "Use the STAR method: Situation, Task, Action, and measurable business Result."
                },
                new()
                {
                    Id = 5,
                    Category = "Engineering Culture",
                    Competency = "Code Quality & Mentorship",
                    Question = "What practices do you champion to keep technical debt in check, and how do you conduct constructive code reviews for team members?",
                    Tips = "Emphasize automated linting, CI/CD gates, unit/integration testing standards, and blameless post-mortems."
                }
            };
        }

        private async Task<MockInterviewEvaluationDto> ExecuteEvaluateMockAnswerAsync(
            string question,
            string candidateAnswer,
            string? roleTitle,
            string? category)
        {
            var text = candidateAnswer.Trim();
            var words = text.Split(new[] { ' ', '\t', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
            var wordCount = words.Length;

            // Security sanitization: strip dangerous tags
            var sanitized = System.Text.RegularExpressions.Regex.Replace(text, "<.*?>", string.Empty);

            var score = 7;
            var strengths = new List<string>();
            var improvements = new List<string>();

            // Heuristic scoring with safe fallbacks
            if (wordCount < 25)
            {
                score = 4;
                strengths.Add("Direct and concise initial premise.");
                improvements.Add("The answer is too brief. Elaborate with concrete technical choices and real-world project context.");
                improvements.Add("Include the STAR structure (Situation, Task, Action, Result) to make your response compelling.");
            }
            else if (wordCount < 60)
            {
                score = 6;
                strengths.Add("Good foundational explanation of the concept.");
                strengths.Add("Addressed the core question prompt clearly.");
                improvements.Add("Quantify the impact of your actions (e.g., 'reduced API response times by 35%').");
                improvements.Add("Discuss potential edge cases, error handling, or recovery strategies.");
            }
            else
            {
                score = 8;
                if (text.Contains("because", StringComparison.OrdinalIgnoreCase) || text.Contains("result", StringComparison.OrdinalIgnoreCase) || text.Contains("improved", StringComparison.OrdinalIgnoreCase))
                {
                    score = 9;
                    strengths.Add("Strong cause-and-effect narrative highlighting engineering rationale.");
                }

                strengths.Add("Comprehensive technical depth demonstrating practical, production-level experience.");
                strengths.Add("Structured communication covering both implementation and team impact.");
                improvements.Add("Briefly mention monitoring or telemetry (e.g., Prometheus, Datadog, or logging) to show end-to-end ownership.");
            }

            var modelAnswer = "A top-tier answer addresses the core trade-offs directly: 1) Clearly state your chosen architectural pattern (e.g., async background queues, CQRS, or distributed caching); 2) Quantify outcomes with measurable metrics (e.g., p99 latency reduced, 99.9% uptime); 3) Conclude with preventative measures such as automated unit/integration tests and blameless retrospectives.";

            return new MockInterviewEvaluationDto
            {
                Score = score,
                Summary = score >= 8
                    ? "Excellent response! You demonstrated technical clarity, structured communication, and practical engineering maturity."
                    : score >= 6
                    ? "Good response with a strong premise. Bolstering it with quantitative impact metrics and architectural trade-offs will make it stand out."
                    : "Promising start, but needs more depth. Use the STAR method to demonstrate your hands-on problem-solving journey.",
                Strengths = strengths,
                Improvements = improvements,
                ModelAnswer = modelAnswer
            };
        }

        #endregion

        #region Local Fallback Engine

        private async Task<AiChatResponse> ExecuteLocalFallbackEngineAsync(
            string message,
            string role,
            string? userId,
            string? currentRoute,
            int? activeJobId)
        {
            var msg = message.ToLowerInvariant().Trim();
            var isStudent = string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase);
            var isHr = string.Equals(role, "HR", StringComparison.OrdinalIgnoreCase) || string.Equals(role, "Employer", StringComparison.OrdinalIgnoreCase);

            // Intent 0: ATS Resume & Skills Compatibility Match
            if (msg.Contains("match") || msg.Contains("ats") || msg.Contains("score") || msg.Contains("compatibility") || msg.Contains("fit"))
            {
                var targetId = activeJobId;
                if (!targetId.HasValue)
                {
                    targetId = await _context.Jobs
                        .Where(j => j.PublicationStatus == "Published" && j.IsActive)
                        .Select(j => (int?)j.Id)
                        .FirstOrDefaultAsync();
                }

                if (targetId.HasValue && targetId.Value > 0)
                {
                    var match = await ExecuteAtsMatchAsync(targetId.Value, msg, null, userId);
                    if (match != null)
                    {
                        return new AiChatResponse
                        {
                            Reply = $"### ATS Match Analysis: **{match.MatchPercentage}%** ({match.FitLevel})\n\n{match.Summary}\n\nReview the detailed skills breakdown and targeted recommendations below:",
                            AtsMatch = match
                        };
                    }
                }
            }

            // Intent 1: Check my applications (Student only)
            if (isStudent && (msg.Contains("application") || msg.Contains("applied") || msg.Contains("status") || msg.Contains("interview")))
            {
                var apps = await ExecuteGetMyApplicationsAsync(userId ?? "");
                if (apps.Count == 0)
                {
                    return new AiChatResponse
                    {
                        Reply = "You haven't submitted any job applications yet. Let's find some great matching roles for you! Type 'Find matching jobs' to explore openings.",
                        Applications = apps
                    };
                }

                var pending = apps.Count(a => a.Status == "Pending");
                var shortlisted = apps.Count(a => a.Status == "Shortlisted");
                var interviews = apps.Count(a => a.Status == "Interview Scheduled");

                return new AiChatResponse
                {
                    Reply = $"You have **{apps.Count} application(s)** on file ({pending} Pending, {shortlisted} Shortlisted, {interviews} with Interviews). Here are your latest application statuses:",
                    Applications = apps
                };
            }

            // Intent 2: Draft Job Description (HR only)
            if (isHr && (msg.Contains("draft") || msg.Contains("job description") || msg.Contains("create job") || msg.Contains("post a job") || msg.Contains("new jd")))
            {
                string title = "Full-Stack Software Engineer";
                if (msg.Contains("react")) title = "Frontend React Developer";
                else if (msg.Contains("backend") || msg.Contains(".net")) title = "Senior Backend .NET Developer";
                else if (msg.Contains("product")) title = "Associate Product Manager";
                else if (msg.Contains("data")) title = "Data Engineer";

                var draft = await ExecuteDraftJobDescriptionAsync(userId, title, "2-4 years experience", "Bengaluru / Hybrid", "React, .NET, SQL, Docker");
                return new AiChatResponse
                {
                    Reply = $"I have prepared a draft job description for **{draft.Title}** tailored to current tech hiring trends. Click below to load this directly into **Post a Job**!",
                    JobDraft = draft
                };
            }

            // Intent 3: Summarize Applicants (HR only)
            if (isHr && (msg.Contains("applicant") || msg.Contains("candidate") || msg.Contains("pipeline") || msg.Contains("summarize") || msg.Contains("submissions")))
            {
                var summary = await ExecuteSummarizeApplicantsAsync(userId, activeJobId);
                return new AiChatResponse
                {
                    Reply = summary.SummaryText + " Here is the candidate breakdown:",
                    ApplicantSummary = summary
                };
            }

            // Intent 4: Hiring trends / salary / demand / skills (Any role)
            if (msg.Contains("trend") || msg.Contains("salary") || msg.Contains("market") || msg.Contains("demand") || msg.Contains("skill") || msg.Contains("insights"))
            {
                var trends = await ExecuteGetHiringTrendsAsync();
                return new AiChatResponse
                {
                    Reply = $"Here is the live **HireFlow Hiring Trends & Market Intelligence** report based on real platform activity and industry data:",
                    Trends = trends
                };
            }

            // Intent 5: Search jobs / find work / vacancies (Any role)
            if (msg.Contains("job") || msg.Contains("find") || msg.Contains("search") || msg.Contains("work") || msg.Contains("developer") || msg.Contains("engineer") || msg.Contains("remote") || msg.Contains("internship"))
            {
                string? kw = null;
                if (msg.Contains("react")) kw = "React";
                else if (msg.Contains(".net") || msg.Contains("dotnet")) kw = ".NET";
                else if (msg.Contains("developer") || msg.Contains("engineer")) kw = "Developer";
                else if (msg.Contains("intern")) kw = "Intern";

                string? mode = msg.Contains("remote") ? "Remote" : (msg.Contains("hybrid") ? "Hybrid" : null);

                var jobs = await ExecuteSearchJobsAsync(kw, null, mode);
                var label = jobs.Count > 0 ? $"I found **{jobs.Count} active job opportunities** matching your interests:" : "I searched for current openings, and here are the latest opportunities on HireFlow:";

                return new AiChatResponse
                {
                    Reply = label,
                    Jobs = jobs
                };
            }

            // Default: Role-aware welcome and guidance
            string welcomeText;
            if (isStudent)
            {
                welcomeText = "Hello! I'm your **HireFlow AI Career Copilot**. I can help you search verified job openings, monitor your submitted applications, review interview schedules, and analyze real-time tech hiring trends.";
            }
            else if (isHr)
            {
                welcomeText = "Hello! I'm your **HireFlow Recruitment Copilot**. I can draft high-converting Job Descriptions, summarize applicant pipelines, and provide competitive salary benchmarks for your postings.";
            }
            else
            {
                welcomeText = "Welcome to **HireFlow**! I am your AI Copilot. Ask me to find job openings, show current tech hiring trends, or explain how HireFlow connects top talent with verified employers.";
            }

            return new AiChatResponse
            {
                Reply = welcomeText
            };
        }

        private List<string> GenerateSuggestedActions(string role, string? currentRoute, bool hasJobs, bool hasDraft)
        {
            var isStudent = string.Equals(role, "Student", StringComparison.OrdinalIgnoreCase);
            var isHr = string.Equals(role, "HR", StringComparison.OrdinalIgnoreCase) || string.Equals(role, "Employer", StringComparison.OrdinalIgnoreCase);

            if (isStudent)
            {
                return new List<string>
                {
                    "Find matching jobs",
                    "Check my applications",
                    "Current tech hiring trends",
                    "Interview prep tips"
                };
            }

            if (isHr)
            {
                return new List<string>
                {
                    "Draft a new Job Description",
                    "Summarize my applicants",
                    "Market salary & hiring trends",
                    "Review interview pipeline"
                };
            }

            return new List<string>
            {
                "Explore trending jobs",
                "Salary & skill trends",
                "How HireFlow works",
                "Sign in to your account"
            };
        }

        internal static readonly List<QuizQuestionModel> StandardQuizBank = new()
        {
            new QuizQuestionModel
            {
                Id = 1,
                Question = "In ASP.NET Core, what is the primary benefit of using `.AsNoTracking()` on Entity Framework Core read queries?",
                Options = new List<string>
                {
                    "It converts the LINQ query into an encrypted binary stream.",
                    "It disables EF Core change tracking overhead, substantially cutting memory allocation and query latency for read-only data.",
                    "It schedules the query to run asynchronously in a background queue.",
                    "It caches the entire table in Redis automatically."
                },
                CorrectIndex = 1,
                SkillTag = "C# / .NET / EF Core",
                Explanation = "AsNoTracking() tells EF Core not to track the returned entities in its change tracker, yielding significant memory savings and faster execution on read operations."
            },
            new QuizQuestionModel
            {
                Id = 2,
                Question = "In React, what causes the 'stale closure' issue within a `useEffect` or `useCallback` hook?",
                Options = new List<string>
                {
                    "Declaring components using arrow functions instead of the function keyword.",
                    "Omitting dynamic variables referenced in the hook body from its dependency array, capturing outdated scope values.",
                    "Calling setState inside the render phase.",
                    "Using CSS Modules instead of Tailwind CSS."
                },
                CorrectIndex = 1,
                SkillTag = "React / JavaScript",
                Explanation = "When state or props variables are omitted from the dependency array, the closure retains references from the render in which it was created, leading to stale data."
            },
            new QuizQuestionModel
            {
                Id = 3,
                Question = "In relational databases (SQL Server, PostgreSQL), what is the key performance distinction between an Index Seek and an Index Scan?",
                Options = new List<string>
                {
                    "An Index Scan always uses a hash join, while an Index Seek always uses a merge join.",
                    "An Index Seek navigates the B-Tree directly using search arguments in O(log N) time; an Index Scan traverses all index pages sequentially.",
                    "An Index Seek locks the entire database table in exclusive mode.",
                    "An Index Scan is only possible on clustered primary keys."
                },
                CorrectIndex = 1,
                SkillTag = "SQL / Databases",
                Explanation = "An Index Seek leverages the B-Tree root and branches to pinpoint qualifying records directly, whereas an Index Scan reads through the leaf level of the index sequentially."
            },
            new QuizQuestionModel
            {
                Id = 4,
                Question = "In RESTful API design, which of the following standard HTTP methods is strictly idempotent according to RFC 9110?",
                Options = new List<string>
                {
                    "POST",
                    "PUT",
                    "PATCH (by default specification)",
                    "CONNECT"
                },
                CorrectIndex = 1,
                SkillTag = "API Design / REST",
                Explanation = "PUT is idempotent: sending the same PUT request multiple times with identical payload produces the same end state on the server as making it once."
            },
            new QuizQuestionModel
            {
                Id = 5,
                Question = "In modern container workflows with Docker, what is the structural difference between an image and a container?",
                Options = new List<string>
                {
                    "An image is a running virtual machine; a container is the ISO storage file.",
                    "An image is an immutable, read-only layered template; a container is an isolated running instance with a thin writable layer on top.",
                    "Containers can only run Linux processes; images can run any operating system without host virtualization.",
                    "Images are generated by Kubernetes; containers are generated by Docker Swarm."
                },
                CorrectIndex = 1,
                SkillTag = "Docker / Cloud",
                Explanation = "A Docker image is a static snapshot consisting of read-only layers. When launched, the Docker daemon creates a container with a top writable layer executing the entrypoint."
            },
            new QuizQuestionModel
            {
                Id = 6,
                Question = "In TypeScript, what is the key difference between an `interface` and a `type` alias when designing domain models?",
                Options = new List<string>
                {
                    "Types can only represent primitive strings and numbers; interfaces can only represent classes.",
                    "Interfaces can be merged through declaration merging and extended with `extends`; types can represent unions, tuples, and mapped types.",
                    "Interfaces are compiled into JavaScript objects; types are completely erased at runtime.",
                    "There is no difference in capability or syntax whatsoever."
                },
                CorrectIndex = 1,
                SkillTag = "TypeScript",
                Explanation = "Interfaces support open declaration merging and classic object-oriented extension; types are more flexible for unions, intersections, primitives, and mapped transformations."
            }
        };

        private async Task<List<SkillQuizQuestionDto>> ExecuteGenerateSkillQuizAsync(int? jobId, string? topic, List<string>? skills)
        {
            await Task.Yield();
            var questions = StandardQuizBank.Take(5).Select(q => new SkillQuizQuestionDto
            {
                Id = q.Id,
                Question = q.Question,
                Options = q.Options,
                SkillTag = q.SkillTag,
                Explanation = q.Explanation
            }).ToList();

            return questions;
        }

        private async Task<SkillQuizResultDto> ExecuteSubmitSkillQuizAsync(SkillQuizSubmitRequest request, string? userId)
        {
            var total = Math.Max(1, request.SelectedAnswers.Count);
            var correctCount = 0;
            var reviews = new List<QuizQuestionReviewDto>();

            foreach (var kvp in request.SelectedAnswers)
            {
                var questionModel = StandardQuizBank.FirstOrDefault(q => q.Id == kvp.Key)
                                  ?? StandardQuizBank.FirstOrDefault();
                if (questionModel == null) continue;

                var isCorrect = kvp.Value == questionModel.CorrectIndex;
                if (isCorrect) correctCount++;

                reviews.Add(new QuizQuestionReviewDto
                {
                    QuestionId = kvp.Key,
                    Question = questionModel.Question,
                    SelectedOptionIndex = kvp.Value,
                    CorrectOptionIndex = questionModel.CorrectIndex,
                    IsCorrect = isCorrect,
                    Explanation = questionModel.Explanation
                });
            }

            var score = (int)Math.Round((double)correctCount / total * 100);
            var tier = score >= 80 ? "Advanced" : score >= 60 ? "Proficient" : "Developing";
            var feedback = score >= 80
                ? "Outstanding technical proficiency! Your grasp of architecture, concurrency, and modern engineering patterns is exceptional."
                : score >= 60
                ? "Solid command of core software principles. Sharpening specific deep-dive edge cases will help you achieve top score."
                : "Good effort! Reviewing foundational documentation on async architecture and state management will elevate your match ranking.";

            if (request.ApplicationId.HasValue && request.ApplicationId.Value > 0)
            {
                try
                {
                    var application = await _context.JobApplications.FirstOrDefaultAsync(a => a.Id == request.ApplicationId.Value);
                    if (application != null && (string.IsNullOrWhiteSpace(userId) || application.UserId == userId || CurrentUserRole == "HR"))
                    {
                        var metadata = new Dictionary<string, object>();
                        if (!string.IsNullOrWhiteSpace(application.RecruiterNotes) && application.RecruiterNotes.TrimStart().StartsWith("{"))
                        {
                            var existing = JsonSerializer.Deserialize<Dictionary<string, object>>(application.RecruiterNotes);
                            if (existing != null) metadata = existing;
                        }
                        else if (!string.IsNullOrWhiteSpace(application.RecruiterNotes))
                        {
                            metadata["notes"] = application.RecruiterNotes;
                        }

                        metadata["assessment"] = new
                        {
                            score,
                            tier,
                            correctCount,
                            totalQuestions = total,
                            completedAt = DateTime.UtcNow
                        };

                        application.RecruiterNotes = JsonSerializer.Serialize(metadata);
                        await _context.SaveChangesAsync();
                    }
                }
                catch { /* Non-blocking metadata save */ }
            }

            return new SkillQuizResultDto
            {
                Score = score,
                CorrectCount = correctCount,
                TotalQuestions = total,
                Tier = tier,
                Feedback = feedback,
                Reviews = reviews
            };
        }

        private static readonly string[] KnownIndustrySkills = new[]
        {
            "React", "JavaScript", "TypeScript", "C#", ".NET", "ASP.NET Core", "SQL", "PostgreSQL",
            "Node.js", "Python", "Java", "HTML", "CSS", "Tailwind", "Azure", "AWS", "Docker",
            "Kubernetes", "Git", "REST API", "Entity Framework", "Microservices", "GraphQL",
            "MongoDB", "Redis", "Figma", "Next.js", "Vue", "Angular", "Linux", "CI/CD", "Agile"
        };

        internal static List<string> ExtractSkillsFromText(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return new List<string>();
            var matched = new List<string>();
            foreach (var skill in KnownIndustrySkills)
            {
                if (text.Contains(skill, StringComparison.OrdinalIgnoreCase))
                {
                    matched.Add(skill);
                }
            }
            return matched;
        }

        internal static List<SkillQuizQuestionDto> GetStandardQuizQuestions()
        {
            return StandardQuizBank.Take(5).Select(q => new SkillQuizQuestionDto
            {
                Id = q.Id,
                Question = q.Question,
                Options = q.Options,
                SkillTag = q.SkillTag,
                Explanation = q.Explanation
            }).ToList();
        }

        internal static SkillQuizResultDto EvaluateAnswers(Dictionary<int, int> selectedAnswers)
        {
            var total = Math.Max(1, selectedAnswers.Count);
            var correctCount = 0;
            var reviews = new List<QuizQuestionReviewDto>();

            foreach (var kvp in selectedAnswers)
            {
                var questionModel = StandardQuizBank.FirstOrDefault(q => q.Id == kvp.Key)
                                  ?? StandardQuizBank.FirstOrDefault();
                if (questionModel == null) continue;

                var isCorrect = kvp.Value == questionModel.CorrectIndex;
                if (isCorrect) correctCount++;

                reviews.Add(new QuizQuestionReviewDto
                {
                    QuestionId = kvp.Key,
                    Question = questionModel.Question,
                    SelectedOptionIndex = kvp.Value,
                    CorrectOptionIndex = questionModel.CorrectIndex,
                    IsCorrect = isCorrect,
                    Explanation = questionModel.Explanation
                });
            }

            var score = (int)Math.Round((double)correctCount / total * 100);
            var tier = score >= 80 ? "Advanced" : score >= 60 ? "Proficient" : "Developing";
            return new SkillQuizResultDto
            {
                Score = score,
                CorrectCount = correctCount,
                TotalQuestions = total,
                Tier = tier,
                Reviews = reviews
            };
        }

        internal static List<BulkResumeScreenResultDto> ScreenResumes(string jobRequirements, List<BulkResumeCandidateInput> candidates)
        {
            var jobSkills = ExtractSkillsFromText(jobRequirements);
            if (jobSkills.Count == 0)
            {
                jobSkills = new List<string> { "C#", "React", ".NET", "SQL", "JavaScript", "REST APIs", "Git" };
            }

            var results = new List<BulkResumeScreenResultDto>();
            foreach (var cand in candidates)
            {
                var candSkills = ExtractSkillsFromText(cand.ResumeText);
                var matched = jobSkills.Where(s => candSkills.Contains(s, StringComparer.OrdinalIgnoreCase)).ToList();
                var missing = jobSkills.Where(s => !candSkills.Contains(s, StringComparer.OrdinalIgnoreCase)).ToList();

                var ratio = (double)matched.Count / Math.Max(1, jobSkills.Count);
                var score = (int)Math.Round(ratio * 70.0 + 25.0);
                score = Math.Clamp(score, 30, 98);

                var fitLevel = score >= 75 ? "Strong Fit" : score >= 55 ? "Good Match" : "Growth Opportunity";
                var action = score >= 75 ? "Fast-Track" : score >= 55 ? "Consider" : "Pass";

                results.Add(new BulkResumeScreenResultDto
                {
                    Name = cand.Name,
                    Email = cand.Email,
                    MatchPercentage = score,
                    FitLevel = fitLevel,
                    MatchedSkills = matched,
                    MissingSkills = missing,
                    Summary = $"Match score {score}% for {cand.Name}",
                    RecommendedAction = action
                });
            }

            return results.OrderByDescending(r => r.MatchPercentage).ToList();
        }

        private async Task<List<BulkResumeScreenResultDto>> ExecuteBulkResumeScreenAsync(
            int jobId,
            List<BulkResumeCandidateInput> candidates,
            string? userId)
        {
            var job = await _context.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == jobId);
            if (job == null) return new List<BulkResumeScreenResultDto>();

            var jobSkills = ExtractSkillsFromText($"{job.Title} {job.Requirements} {job.Description}");
            if (jobSkills.Count == 0)
            {
                jobSkills = new List<string> { "C#", "React", ".NET", "SQL", "JavaScript", "REST APIs", "Git" };
            }

            var results = new List<BulkResumeScreenResultDto>();

            foreach (var cand in candidates)
            {
                var candSkills = ExtractSkillsFromText(cand.ResumeText);
                var matched = jobSkills.Where(s => candSkills.Contains(s, StringComparer.OrdinalIgnoreCase)).ToList();
                var missing = jobSkills.Where(s => !candSkills.Contains(s, StringComparer.OrdinalIgnoreCase)).ToList();

                var ratio = (double)matched.Count / Math.Max(1, jobSkills.Count);
                var score = (int)Math.Round(ratio * 70.0 + 25.0);
                score = Math.Clamp(score, 30, 98);

                var fitLevel = score >= 75 ? "Strong Fit" : score >= 55 ? "Good Match" : "Growth Opportunity";
                var action = score >= 75 ? "Fast-Track" : score >= 55 ? "Consider" : "Pass";

                var summary = score >= 75
                    ? $"Strong technical profile with verified competency in **{string.Join(", ", matched.Take(3))}**."
                    : score >= 55
                    ? $"Solid foundation in **{string.Join(", ", matched.Take(2))}**, with transferable experience for this opening."
                    : $"Emerging background. Lacks core requirements in {string.Join(", ", missing.Take(2))}.";

                results.Add(new BulkResumeScreenResultDto
                {
                    Name = cand.Name,
                    Email = cand.Email,
                    MatchPercentage = score,
                    FitLevel = fitLevel,
                    MatchedSkills = matched,
                    MissingSkills = missing,
                    Summary = summary,
                    RecommendedAction = action
                });
            }

            return results.OrderByDescending(r => r.MatchPercentage).ToList();
        }

        internal class QuizQuestionModel
        {
            public int Id { get; set; }
            public string Question { get; set; } = string.Empty;
            public List<string> Options { get; set; } = new();
            public int CorrectIndex { get; set; }
            public string SkillTag { get; set; } = string.Empty;
            public string Explanation { get; set; } = string.Empty;
        }

        #endregion
    }
}
