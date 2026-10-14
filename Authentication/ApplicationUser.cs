using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Authentication
{
    public class ApplicationUser : IdentityUser
    {
        [StringLength(100)]
        public string? FullName { get; set; }

        public string AccountRole { get; set; } = "Student";

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Student profile picture path or URL
        [StringLength(500)]
        public string? ProfilePictureUrl { get; set; }

        // Student resume path or URL
        [StringLength(500)]
        public string? ResumeUrl { get; set; }
    }
}