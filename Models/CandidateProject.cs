using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class CandidateProject
    {
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        public string ProjectTitle { get; set; } = string.Empty;

        [StringLength(150)]
        public string? ClientName { get; set; }

        [StringLength(100)]
        public string? Role { get; set; }

        [StringLength(2000)]
        public string? Description { get; set; }

        [StringLength(500)]
        public string? TechnologiesUsed { get; set; }

        [StringLength(500)]
        public string? ProjectUrl { get; set; }

        public DateTime? StartDate { get; set; }

        public DateTime? EndDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}