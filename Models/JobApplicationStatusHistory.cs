using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class JobApplicationStatusHistory
    {
        public int Id { get; set; }

        [Required]
        public int JobApplicationId { get; set; }

        [StringLength(40)]
        public string? PreviousStatus { get; set; }

        [Required]
        [StringLength(40)]
        public string NewStatus { get; set; } = "Pending";

        [StringLength(1000)]
        public string? Reason { get; set; }

        [Required]
        [StringLength(450)]
        public string ChangedByUserId { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string ChangedByRole { get; set; } = string.Empty;

        public DateTime ChangedAtUtc { get; set; } = DateTime.UtcNow;

        public JobApplication? JobApplication { get; set; }
    }
}
