using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class GenerateOfferRequest
    {
        [Required]
        public int ApplicationId { get; set; }

        [Required, StringLength(150)]
        public string RoleTitle { get; set; } = string.Empty;

        [Required, StringLength(100)]
        public string BaseSalary { get; set; } = string.Empty;

        [StringLength(100)]
        public string? Bonus { get; set; }

        [Required, StringLength(50)]
        public string JoiningDate { get; set; } = string.Empty;

        [StringLength(50)]
        public string? ExpiryDate { get; set; }

        [StringLength(100)]
        public string? ReportingManager { get; set; }

        [StringLength(100)]
        public string? WorkMode { get; set; }

        [StringLength(2000)]
        public string? Terms { get; set; }
    }

    public class OfferDetailsDto
    {
        public int ApplicationId { get; set; }
        public string ApplicantName { get; set; } = string.Empty;
        public string ApplicantEmail { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public string RoleTitle { get; set; } = string.Empty;
        public string BaseSalary { get; set; } = string.Empty;
        public string? Bonus { get; set; }
        public string JoiningDate { get; set; } = string.Empty;
        public string? ExpiryDate { get; set; }
        public string? ReportingManager { get; set; }
        public string? WorkMode { get; set; }
        public string? Terms { get; set; }
        public string Status { get; set; } = "Offered"; // "Offered", "Accepted", "Declined"
        public DateTime OfferedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? RespondedAtUtc { get; set; }
        public string? CandidateDecision { get; set; } // "Accepted", "Declined"
        public string? CandidateNote { get; set; }
    }

    public class RespondOfferRequest
    {
        [Required]
        public string Decision { get; set; } = "Accept"; // "Accept" or "Decline"

        [StringLength(1000)]
        public string? CandidateNote { get; set; }
    }
}
