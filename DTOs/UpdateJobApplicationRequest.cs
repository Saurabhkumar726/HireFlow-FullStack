using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class UpdateJobApplicationRequest
    {
        [Required, StringLength(100, MinimumLength = 2)]
        public string ApplicantName { get; set; } = string.Empty;

        [Required, EmailAddress, StringLength(254)]
        public string ApplicantEmail { get; set; } = string.Empty;

        [StringLength(32)]
        public string? ApplicantPhoneNumber { get; set; }

        [StringLength(150)]
        public string? ApplicantLocation { get; set; }

        [StringLength(500)]
        public string? ApplicantLinkedInUrl { get; set; }

        [StringLength(500)]
        public string? ApplicantPortfolioUrl { get; set; }

        [StringLength(2048)]
        public string? ResumeUrl { get; set; }

        [StringLength(3000)]
        public string? CoverLetter { get; set; }
    }
}
