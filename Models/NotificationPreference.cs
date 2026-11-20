using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class NotificationPreference
    {
        public int Id { get; set; }

        [Required, StringLength(450)]
        public string UserId { get; set; } = string.Empty;

        // In-app delivery preferences are active in Phase 7A.
        public bool InAppEnabled { get; set; } = true;
        public bool ApplicationInAppEnabled { get; set; } = true;
        public bool InterviewInAppEnabled { get; set; } = true;

        // Email preferences are consumed by the Phase 7B outbox and Phase 7G reminder worker.
        public bool EmailEnabled { get; set; } = true;
        public bool ApplicationEmailEnabled { get; set; } = true;
        public bool InterviewEmailEnabled { get; set; } = true;
        public bool DailyDigestEmailEnabled { get; set; }
        public bool InterviewReminderEmailEnabled { get; set; } = true;
        public bool InterviewReminderInAppEnabled { get; set; } = true;

        public DateTime? LastDailyDigestSentAtUtc { get; set; }

        public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}