using System;
using System.Collections.Generic;

namespace HireFlow.Api.DTOs
{
    public class AiChatRequest
    {
        public string Message { get; set; } = string.Empty;
        public List<AiChatMessageDto>? History { get; set; }
        public string? CurrentRoute { get; set; }
        public int? ActiveJobId { get; set; }
    }

    public class AiChatMessageDto
    {
        public string Role { get; set; } = "user"; // "user", "assistant", "system"
        public string Content { get; set; } = string.Empty;
    }

    public class JobSummaryDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public decimal Salary { get; set; }
        public decimal? SalaryMax { get; set; }
        public string SalaryMode { get; set; } = "Range";
        public string SalaryCurrency { get; set; } = "INR";
        public string SalaryPeriod { get; set; } = "Monthly";
        public string JobType { get; set; } = "Full-time";
        public string WorkMode { get; set; } = "Not specified";
        public string? ExperienceLevel { get; set; }
        public bool IsFeatured { get; set; }
        public string? Description { get; set; }
    }

    public class TrendingSkillDto
    {
        public string Skill { get; set; } = string.Empty;
        public int JobCount { get; set; }
        public double DemandPercentage { get; set; }
    }

    public class TrendingRoleDto
    {
        public string RoleTitle { get; set; } = string.Empty;
        public int OpenCount { get; set; }
        public string AvgSalaryRange { get; set; } = string.Empty;
    }

    public class TrendingCategoryDto
    {
        public string Name { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class TrendingCompanyDto
    {
        public string CompanyName { get; set; } = string.Empty;
        public int ActiveJobsCount { get; set; }
    }

    public class HiringTrendsDto
    {
        public int TotalActiveJobs { get; set; }
        public int TotalCompaniesHiring { get; set; }
        public int TotalApplicationsCount { get; set; }
        public List<TrendingSkillDto> TopSkills { get; set; } = new();
        public List<TrendingRoleDto> TopJobRoles { get; set; } = new();
        public List<TrendingCategoryDto> TopJobTypes { get; set; } = new();
        public List<TrendingCategoryDto> TopWorkModes { get; set; } = new();
        public List<TrendingCompanyDto> TopHiringCompanies { get; set; } = new();
        public string SalaryInsights { get; set; } = string.Empty;
        public List<string> IndustryInsights { get; set; } = new();
    }

    public class ApplicationSummaryDto
    {
        public int Id { get; set; }
        public int JobId { get; set; }
        public string JobTitle { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending";
        public DateTime AppliedAt { get; set; }
        public DateTime? LastUpdatedAtUtc { get; set; }
        public string? RejectionReason { get; set; }
        public string? InterviewDetails { get; set; }
    }

    public class JobDraftDto
    {
        public string Title { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string JobType { get; set; } = "Full-time";
        public string WorkMode { get; set; } = "Hybrid";
        public decimal? Salary { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Requirements { get; set; } = string.Empty;
        public string? Responsibilities { get; set; }
    }

    public class ApplicantHighlightDto
    {
        public int ApplicationId { get; set; }
        public string ApplicantName { get; set; } = string.Empty;
        public string ApplicantEmail { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime AppliedAt { get; set; }
        public string? Location { get; set; }
        public string? ResumeUrl { get; set; }
    }

    public class ApplicantSummaryResultDto
    {
        public int? JobId { get; set; }
        public string? JobTitle { get; set; }
        public int TotalApplicants { get; set; }
        public Dictionary<string, int> StatusBreakdown { get; set; } = new();
        public List<ApplicantHighlightDto> RecentApplicants { get; set; } = new();
        public string SummaryText { get; set; } = string.Empty;
    }

    public class AiChatResponse
    {
        public string Reply { get; set; } = string.Empty;
        public List<JobSummaryDto>? Jobs { get; set; }
        public HiringTrendsDto? Trends { get; set; }
        public List<ApplicationSummaryDto>? Applications { get; set; }
        public JobDraftDto? JobDraft { get; set; }
        public ApplicantSummaryResultDto? ApplicantSummary { get; set; }
        public AtsMatchResultDto? AtsMatch { get; set; }
        public List<string>? SuggestedActions { get; set; }
    }

    public class AtsMatchRequest
    {
        public int JobId { get; set; }
        public string? ResumeText { get; set; }
        public List<string>? CandidateSkills { get; set; }
    }

    public class AtsMatchResultDto
    {
        public int JobId { get; set; }
        public string JobTitle { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public int MatchPercentage { get; set; }
        public string FitLevel { get; set; } = "Good Match";
        public List<string> MatchedSkills { get; set; } = new();
        public List<string> MissingSkills { get; set; } = new();
        public List<string> TopRecommendations { get; set; } = new();
        public string Summary { get; set; } = string.Empty;
        public bool IsProfileBased { get; set; }
    }

    public class MockInterviewQuestionDto
    {
        public int Id { get; set; }
        public string Question { get; set; } = string.Empty;
        public string Category { get; set; } = "Technical"; // "Technical", "Behavioral", "System Design", "Problem Solving"
        public string Competency { get; set; } = string.Empty;
        public string Tips { get; set; } = string.Empty;
    }

    public class MockInterviewGenerateRequest
    {
        public int? JobId { get; set; }
        public string? RoleTitle { get; set; }
        public string? JobDescription { get; set; }
        public List<string>? Skills { get; set; }
    }

    public class MockInterviewEvaluateRequest
    {
        public string Question { get; set; } = string.Empty;
        public string CandidateAnswer { get; set; } = string.Empty;
        public string? RoleTitle { get; set; }
        public string? Category { get; set; }
    }

    public class MockInterviewEvaluationDto
    {
        public int Score { get; set; } // 1 - 10
        public string Summary { get; set; } = string.Empty;
        public List<string> Strengths { get; set; } = new();
        public List<string> Improvements { get; set; } = new();
        public string ModelAnswer { get; set; } = string.Empty;
    }

    public class PipelineFunnelDto
    {
        public int TotalApplicants { get; set; }
        public int PendingCount { get; set; }
        public int UnderReviewCount { get; set; }
        public int ShortlistedCount { get; set; }
        public int InterviewScheduledCount { get; set; }
        public int SelectedCount { get; set; }
        public int RejectedCount { get; set; }
        public int WithdrawnCount { get; set; }
        public double ReviewConversionRate { get; set; }
        public double ShortlistConversionRate { get; set; }
        public double InterviewConversionRate { get; set; }
        public double OfferConversionRate { get; set; }
        public double AvgDaysToHire { get; set; }
        public Dictionary<string, int> RejectionReasons { get; set; } = new();
    }
}
