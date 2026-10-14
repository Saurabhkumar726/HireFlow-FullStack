
using Microsoft.AspNetCore.Identity;

namespace HireFlow.Api.Authentication
{
    public class ApplicationUser : IdentityUser
    {
        public string? FullName { get; set; }

        public string AccountRole { get; set; } = "Student";

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
