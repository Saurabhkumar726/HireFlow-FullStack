using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    /// <summary>Stores a before-change snapshot when a Student edits a New application.</summary>
    public class JobApplicationRevision
    {
        public int Id { get; set; }

        [Required]
        public int JobApplicationId { get; set; }

        public int RevisionNumber { get; set; }

        [Required]
        public string SnapshotJson { get; set; } = "{}";

        [Required]
        [StringLength(450)]
        public string ChangedByUserId { get; set; } = string.Empty;

        public DateTime ChangedAtUtc { get; set; } = DateTime.UtcNow;

        public JobApplication? JobApplication { get; set; }
    }
}
