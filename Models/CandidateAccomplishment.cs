using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class CandidateAccomplishment
    {
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;

        // Examples: Certification, Award, Achievement, Publication
        [Required]
        [StringLength(50)]
        public string Category { get; set; } = "Certification";

        [Required]
        [StringLength(200)]
        public string Title { get; set; } = string.Empty;

        [StringLength(200)]
        public string? IssuingOrganization { get; set; }

        [StringLength(1000)]
        public string? Description { get; set; }

        public DateTime? IssueDate { get; set; }

        [StringLength(500)]
        public string? CredentialUrl { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}