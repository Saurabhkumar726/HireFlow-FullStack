using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class UpdateNotificationPreferencesRequest
    {
        public bool InAppEnabled { get; set; } = true;
        public bool ApplicationInAppEnabled { get; set; } = true;
        public bool InterviewInAppEnabled { get; set; } = true;
        public bool EmailEnabled { get; set; } = true;
        public bool ApplicationEmailEnabled { get; set; } = true;
        public bool InterviewEmailEnabled { get; set; } = true;
        public bool DailyDigestEmailEnabled { get; set; }
        public bool InterviewReminderEmailEnabled { get; set; } = true;
        public bool InterviewReminderInAppEnabled { get; set; } = true;
    }
}