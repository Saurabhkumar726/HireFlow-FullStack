
using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class Interview
    {
        public int Id { get; set; }

        [Required]
        public int JobApplicationId { get; set; }

        public JobApplication? JobApplication { get; set; }

        [Required]
        public DateTime ScheduledAt { get; set; }

        [Required]
        [MaxLength(100)]
        public string InterviewType { get; set; } = "Online";

        [MaxLength(500)]
        public string? MeetingLink { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Scheduled";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }
    }
}
