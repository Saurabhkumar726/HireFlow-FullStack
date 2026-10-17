using Microsoft.AspNetCore.Identity;

namespace HireFlow.Api.Authentication;

public class ApplicationUser : IdentityUser
{
    // Basic account information
    public string FullName { get; set; } = string.Empty;

    public string AccountRole { get; set; } = "Student";

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Profile picture and resume
    public string? ProfilePictureUrl { get; set; }

    public string? ResumeUrl { get; set; }

    public string? GoogleSubject { get; set; }

    // Independent update timestamps
    public DateTime? ProfileLastUpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ResumeLastUpdatedAt { get; set; }

    // Naukri-style candidate profile
    public string? ResumeHeadline { get; set; }

    public string? ProfileSummary { get; set; }

    // Career profile
    public string? DesiredRole { get; set; }

    public string? DesiredIndustry { get; set; }

    public string? EmploymentType { get; set; }

    public string? PreferredLocations { get; set; }

    public string? WorkMode { get; set; }

    public decimal? ExpectedSalary { get; set; }

    public string? NoticePeriod { get; set; }
}
