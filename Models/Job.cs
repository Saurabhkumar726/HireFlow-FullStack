using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using HireFlow.Api.Authentication;

namespace HireFlow.Api.Models
{
    public class Job
    {
        public int Id { get; set; }

        [Required]
        [StringLength(150)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        public string Company { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Location { get; set; } = string.Empty;

        [Required]
        [StringLength(3000)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string JobType { get; set; } = string.Empty;

        [Range(0, 100000000)]
        public decimal Salary { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // HR user who created this job
        public string? CreatedByUserId { get; set; }

        // Avoid serializing the full HR user object
        [JsonIgnore]
        public ApplicationUser? CreatedByUser { get; set; }

        // Avoid circular references between Job and JobApplication
        [JsonIgnore]
        public List<JobApplication> Applications { get; set; } = new();
    }
}