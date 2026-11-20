using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models;

/// <summary>Unique record prevents a reminder interval from being queued twice.</summary>
public class InterviewReminderLog
{
    public int Id { get; set; }
    [Required] public int InterviewId { get; set; }
    [Required] public int ReminderMinutes { get; set; }
    // A rescheduled interview gets a new reminder set for its new scheduled timestamp.
    [Required] public DateTime ScheduledAtUtc { get; set; }
    [StringLength(450)] public string? RecipientUserId { get; set; }
    [Required] public DateTime ProcessedAtUtc { get; set; } = DateTime.UtcNow;
}
