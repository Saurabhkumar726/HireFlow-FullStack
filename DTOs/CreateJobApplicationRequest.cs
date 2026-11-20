using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class CreateJobApplicationRequest
    {
        [Range(1, int.MaxValue)]
        public int JobId { get; set; }

        [Required, StringLength(100, MinimumLength = 2)]
        public string ApplicantName { get; set; } = string.Empty;

        [Required, EmailAddress, StringLength(254)]
        public string ApplicantEmail { get; set; } = string.Empty;

        [Required, StringLength(32)]
        public string ApplicantPhoneNumber { get; set; } = string.Empty;

        [Required, StringLength(150)]
        public string ApplicantLocation { get; set; } = string.Empty;

        [StringLength(500)]
        public string? ApplicantLinkedInUrl { get; set; }

        [StringLength(500)]
        public string? ApplicantPortfolioUrl { get; set; }

        // Optional in the request so the API can use the Student's saved profile resume.
        // The application endpoint rejects the request if neither source has a resume.
        [StringLength(2048)]
        public string? ResumeUrl { get; set; }

        [StringLength(3000)]
        public string? CoverLetter { get; set; }

        [MaxLength(50)]
        public List<ScreeningAnswerRequest> ScreeningAnswers { get; set; } = new();
    }
}
