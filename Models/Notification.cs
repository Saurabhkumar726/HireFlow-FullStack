using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class Notification
    {
        public int Id { get; set; }

        [Required, StringLength(450)]
        public string RecipientUserId { get; set; } = string.Empty;

        [Required, StringLength(40)]
        public string Type { get; set; } = "General";

        [Required, StringLength(160)]
        public string Title { get; set; } = string.Empty;

        [Required, StringLength(600)]
        public string Message { get; set; } = string.Empty;

        [StringLength(500)]
        public string? ActionUrl { get; set; }

        [StringLength(40)]
        public string? RelatedEntityType { get; set; }

        public int? RelatedEntityId { get; set; }

        public bool IsRead { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        public DateTime? ReadAtUtc { get; set; }
    }
}