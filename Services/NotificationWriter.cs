using System.Net;
using HireFlow.Api.Data;
using HireFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Services;

/// <summary>Persists in-app notifications and queues eligible email delivery in the same DbContext unit of work.</summary>
public static class NotificationWriter
{
    public static async Task AddInAppAsync(
        HireFlowDbContext context,
        string? recipientUserId,
        string type,
        string title,
        string message,
        string? actionUrl,
        string? relatedEntityType,
        int? relatedEntityId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(recipientUserId)) return;

        var preference = await context.NotificationPreferences
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == recipientUserId, cancellationToken);

        var normalizedType = string.IsNullOrWhiteSpace(type) ? "General" : type.Trim();
        var isApplicationEvent = normalizedType.StartsWith("Application", StringComparison.OrdinalIgnoreCase);
        var isInterviewEvent = normalizedType.StartsWith("Interview", StringComparison.OrdinalIgnoreCase);
        var isReminder = normalizedType.Contains("Reminder", StringComparison.OrdinalIgnoreCase);

        var inAppAllowed = preference?.InAppEnabled != false;
        if (isApplicationEvent && preference?.ApplicationInAppEnabled == false) inAppAllowed = false;
        if (isInterviewEvent && preference?.InterviewInAppEnabled == false) inAppAllowed = false;
        if (isReminder && preference?.InterviewReminderInAppEnabled == false) inAppAllowed = false;

        if (inAppAllowed)
        {
            context.Notifications.Add(new Notification
            {
                RecipientUserId = recipientUserId,
                Type = normalizedType,
                Title = title.Trim(),
                Message = message.Trim(),
                ActionUrl = string.IsNullOrWhiteSpace(actionUrl) ? null : actionUrl.Trim(),
                RelatedEntityType = string.IsNullOrWhiteSpace(relatedEntityType) ? null : relatedEntityType.Trim(),
                RelatedEntityId = relatedEntityId,
                CreatedAtUtc = DateTime.UtcNow,
                IsRead = false
            });
        }

        // Interview create/reschedule already uses the existing rich confirmation email.
        // Queue other event emails here; the outbox handles SMTP retries separately.
        var legacyConfirmationAlreadySent = normalizedType.Equals("InterviewScheduled", StringComparison.OrdinalIgnoreCase)
            || normalizedType.Equals("InterviewUpdated", StringComparison.OrdinalIgnoreCase);

        var emailAllowed = preference?.EmailEnabled != false;
        if (isApplicationEvent && preference?.ApplicationEmailEnabled == false) emailAllowed = false;
        if (isInterviewEvent && preference?.InterviewEmailEnabled == false) emailAllowed = false;
        if (isReminder && preference?.InterviewReminderEmailEnabled == false) emailAllowed = false;

        if (emailAllowed && !legacyConfirmationAlreadySent)
        {
            var recipientEmail = await context.Users
                .Where(user => user.Id == recipientUserId)
                .Select(user => user.Email)
                .FirstOrDefaultAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(recipientEmail) && MailAddressIsValid(recipientEmail))
            {
                context.EmailOutboxMessages.Add(new EmailOutboxMessage
                {
                    RecipientEmail = recipientEmail,
                    Subject = $"{title.Trim()} | HireFlow",
                    HtmlBody = BuildNotificationEmail(title, message, actionUrl),
                    DedupeKey = Guid.NewGuid().ToString("N"),
                    Status = "Pending",
                    CreatedAtUtc = DateTime.UtcNow,
                    NextAttemptAtUtc = DateTime.UtcNow
                });
            }
        }
    }

    public static void AddEmailOnly(
        HireFlowDbContext context,
        string recipientEmail,
        string subject,
        string htmlBody,
        string? dedupeKey = null)
    {
        if (!MailAddressIsValid(recipientEmail)) return;
        context.EmailOutboxMessages.Add(new EmailOutboxMessage
        {
            RecipientEmail = recipientEmail,
            Subject = subject,
            HtmlBody = htmlBody,
            DedupeKey = string.IsNullOrWhiteSpace(dedupeKey) ? Guid.NewGuid().ToString("N") : dedupeKey,
            Status = "Pending",
            CreatedAtUtc = DateTime.UtcNow,
            NextAttemptAtUtc = DateTime.UtcNow
        });
    }

    private static bool MailAddressIsValid(string value) =>
        System.Net.Mail.MailAddress.TryCreate(value, out _);

    private static string BuildNotificationEmail(string title, string message, string? actionUrl)
    {
        var safeTitle = WebUtility.HtmlEncode(title);
        var safeMessage = WebUtility.HtmlEncode(message);
        var safePath = WebUtility.HtmlEncode(actionUrl ?? "/candidate/notifications");
        return $"""
            <!doctype html><html><body style="margin:0;padding:24px;background:#f4f5fa;font-family:Arial,sans-serif;color:#202337;line-height:1.6">
              <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e6ef;border-radius:14px;overflow:hidden">
                <div style="padding:20px 24px;background:#6557e8;color:#fff"><strong style="font-size:22px">HireFlow</strong></div>
                <div style="padding:26px"><h2 style="margin:0 0 12px">{safeTitle}</h2><p>{safeMessage}</p>
                  <p style="font-size:12px;color:#68708a">Open HireFlow and visit Notifications to review this update. Destination: {safePath}</p>
                  <hr style="border:0;border-top:1px solid #ececf2;margin:24px 0" />
                  <p style="font-size:12px;color:#777">This is an automated message from HireFlow.</p>
                </div>
              </div></body></html>
            """;
    }
}
