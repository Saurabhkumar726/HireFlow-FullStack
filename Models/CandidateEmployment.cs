using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class CandidateEmployment
    {
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        public string CompanyName { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        public string JobTitle { get; set; } = string.Empty;

        [StringLength(100)]
        public string? EmploymentType { get; set; }

        [StringLength(100)]
        public string? Location { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime? EndDate { get; set; }

        public bool IsCurrentlyWorking { get; set; }

        [StringLength(3000)]
        public string? Description { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}