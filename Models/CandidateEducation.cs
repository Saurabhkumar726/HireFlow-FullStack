using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class CandidateEducation
    {
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        public string Institution { get; set; } = string.Empty;

        [StringLength(150)]
        public string Degree { get; set; } = string.Empty;

        [StringLength(150)]
        public string Specialization { get; set; } = string.Empty;

        [StringLength(100)]
        public string EducationLevel { get; set; } = string.Empty;

        [Range(0, 100)]
        public decimal? Grade { get; set; }

        [StringLength(30)]
        public string? GradeType { get; set; }

        public int? StartYear { get; set; }

        public int? EndYear { get; set; }

        [StringLength(2000)]
        public string? Description { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
