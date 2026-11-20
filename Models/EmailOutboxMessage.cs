using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models;

/// <summary>Durable email queue row. SMTP retries never roll back the business operation.</summary>
public class EmailOutboxMessage
{
    public long Id { get; set; }

    [Required, StringLength(320)]
    public string RecipientEmail { get; set; } = string.Empty;

    [Required, StringLength(220)]
    public string Subject { get; set; } = string.Empty;

    [Required]
    public string HtmlBody { get; set; } = string.Empty;

    [Required, StringLength(40)]
    public string Status { get; set; } = "Pending";

    [Required, StringLength(180)]
    public string DedupeKey { get; set; } = Guid.NewGuid().ToString("N");

    public int AttemptCount { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime NextAttemptAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessingStartedAtUtc { get; set; }
    public DateTime? LastAttemptAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    [StringLength(2000)] public string? LastError { get; set; }
}
