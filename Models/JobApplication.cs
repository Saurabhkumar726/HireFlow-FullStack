using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class JobApplication
    {
        public int Id { get; set; }

        public int JobId { get; set; }

        // Kept nullable for compatibility with older application records.
        public string? UserId { get; set; }

        [Required, StringLength(100)]
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
        public string CoverLetter { get; set; } = string.Empty;

        [Required, StringLength(40)]
        public string Status { get; set; } = "Pending";

        [StringLength(1000)]
        public string? RejectionReason { get; set; }

        [StringLength(1000)]
        public string? WithdrawalReason { get; set; }

        // Private to the owning HR recruiter. Never returned in Student responses.
        [StringLength(4000)]
        public string? RecruiterNotes { get; set; }

        public int RevisionNumber { get; set; }

        public DateTime AppliedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastUpdatedAtUtc { get; set; }

        public DateTime? WithdrawnAtUtc { get; set; }

        public Job? Job { get; set; }

        public List<JobApplicationStatusHistory> StatusHistory { get; set; } = new();

        public List<JobApplicationRevision> Revisions { get; set; } = new();

        public List<Interview> Interviews { get; set; } = new();

        public List<JobApplicationScreeningAnswer> ScreeningAnswers { get; set; } = new();
    }
}
