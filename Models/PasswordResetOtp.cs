
using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class PasswordResetOtp
    {
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;

        // Store a password-hashed OTP, never the plain six-digit code.
        [Required]
        public string OtpHash { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime ExpiresAt { get; set; }

        public int FailedAttempts { get; set; }

        public DateTime? VerifiedAt { get; set; }

        // A random, one-time reset token is issued after OTP verification.
        public string? ResetTokenHash { get; set; }

        public DateTime? ResetTokenExpiresAt { get; set; }

        public DateTime? UsedAt { get; set; }
    }
}
