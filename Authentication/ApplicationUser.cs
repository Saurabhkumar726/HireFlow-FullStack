using Microsoft.AspNetCore.Identity;

namespace HireFlow.Api.Authentication;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;

    public string AccountRole { get; set; } = "Student";

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? ProfilePictureUrl { get; set; }

    public string? ResumeUrl { get; set; }

    public string? GoogleSubject { get; set; }

    // UTC timestamps tracked independently for profile and resume changes.
    public DateTime? ProfileLastUpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ResumeLastUpdatedAt { get; set; }
}
