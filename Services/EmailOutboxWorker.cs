using System.Net;
using System.Security.Cryptography;
using System.Text;
using HireFlow.Api.Data;
using HireFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Services;

/// <summary>Background SMTP worker with persisted retries and an India-local daily digest.</summary>
public sealed class EmailOutboxWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EmailOutboxWorker> _logger;

    public EmailOutboxWorker(IServiceScopeFactory scopeFactory, ILogger<EmailOutboxWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await QueueDailyDigestsAsync(stoppingToken);
                await ProcessOutboxBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "HireFlow email outbox cycle failed.");
            }

            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
        }
    }

    private async Task ProcessOutboxBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<HireFlowDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var now = DateTime.UtcNow;

        var batch = await context.EmailOutboxMessages
            .Where(item =>
                (item.Status == "Pending" && item.NextAttemptAtUtc <= now) ||
                (item.Status == "Processing" && item.ProcessingStartedAtUtc < now.AddMinutes(-15)))
            .OrderBy(item => item.CreatedAtUtc)
            .Take(10)
            .ToListAsync(cancellationToken);

        foreach (var item in batch)
        {
            item.Status = "Processing";
            item.ProcessingStartedAtUtc = now;
            item.LastAttemptAtUtc = now;
            item.AttemptCount++;
        }
        if (batch.Count == 0) return;
        await context.SaveChangesAsync(cancellationToken);

        foreach (var item in batch)
        {
            try
            {
                await emailService.SendNotificationEmailAsync(item.RecipientEmail, item.Subject, item.HtmlBody);
                item.Status = "Sent";
                item.SentAtUtc = DateTime.UtcNow;
                item.LastError = null;
                item.ProcessingStartedAtUtc = null;
            }
            catch (Exception ex)
            {
                item.LastError = ex.Message.Length > 1900 ? ex.Message[..1900] : ex.Message;
                item.ProcessingStartedAtUtc = null;
                if (item.AttemptCount >= 5)
                {
                    item.Status = "Failed";
                    _logger.LogError(ex, "Email outbox message {MessageId} exhausted retries for {Recipient}.", item.Id, item.RecipientEmail);
                }
                else
                {
                    item.Status = "Pending";
                    var delay = item.AttemptCount switch
                    {
                        1 => TimeSpan.FromMinutes(1),
                        2 => TimeSpan.FromMinutes(5),
                        3 => TimeSpan.FromMinutes(15),
                        _ => TimeSpan.FromHours(1)
                    };
                    item.NextAttemptAtUtc = DateTime.UtcNow.Add(delay);
                    _logger.LogWarning(ex, "Email outbox message {MessageId} will retry at {RetryAtUtc}.", item.Id, item.NextAttemptAtUtc);
                }
            }
            await context.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task QueueDailyDigestsAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<HireFlowDbContext>();
        var utcNow = DateTime.UtcNow;
        var indiaNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, GetIndiaTimeZone());
        if (indiaNow.Hour != 9 || indiaNow.Minute >= 15) return;

        var preferences = await context.NotificationPreferences
            .Where(item => item.EmailEnabled && item.DailyDigestEmailEnabled &&
                (item.LastDailyDigestSentAtUtc == null || item.LastDailyDigestSentAtUtc < utcNow.AddHours(-20)))
            .ToListAsync(cancellationToken);

        foreach (var preference in preferences)
        {
            var email = await context.Users.Where(user => user.Id == preference.UserId)
                .Select(user => user.Email).FirstOrDefaultAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(email) || !System.Net.Mail.MailAddress.TryCreate(email, out _))
            {
                preference.LastDailyDigestSentAtUtc = utcNow;
                continue;
            }

            var notificationsQuery = context.Notifications.AsNoTracking()
                .Where(item => item.RecipientUserId == preference.UserId && !item.IsRead && item.CreatedAtUtc >= utcNow.AddDays(-1));
            if (!preference.ApplicationEmailEnabled)
                notificationsQuery = notificationsQuery.Where(item => !item.Type.StartsWith("Application"));
            if (!preference.InterviewEmailEnabled)
                notificationsQuery = notificationsQuery.Where(item => !item.Type.StartsWith("Interview"));

            var notifications = await notificationsQuery
                .OrderByDescending(item => item.CreatedAtUtc)
                .Take(25)
                .ToListAsync(cancellationToken);

            if (notifications.Count == 0)
            {
                preference.LastDailyDigestSentAtUtc = utcNow;
                continue;
            }

            var rows = string.Join("", notifications.Select(item =>
                $"<li style='margin:0 0 12px'><strong>{WebUtility.HtmlEncode(item.Title)}</strong><br/>{WebUtility.HtmlEncode(item.Message)}</li>"));
            var body = $"""
                <!doctype html><html><body style="margin:0;padding:24px;background:#f4f5fa;font-family:Arial,sans-serif;color:#202337;line-height:1.6">
                <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e5e6ef;border-radius:14px;overflow:hidden">
                <div style="padding:20px 24px;background:#6557e8;color:#fff"><strong style="font-size:22px">HireFlow</strong><div>Daily notification digest</div></div>
                <div style="padding:26px"><p>Here are your unread updates from the last 24 hours.</p><ul style="padding-left:20px">{rows}</ul>
                <p style="font-size:12px;color:#68708a">Manage email and digest preferences in HireFlow → Notifications.</p></div></div></body></html>
                """;
            var digestKey = $"digest-{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(preference.UserId)))}-{indiaNow:yyyyMMdd}";
            var digestAlreadyQueued = await context.EmailOutboxMessages
                .AnyAsync(item => item.DedupeKey == digestKey, cancellationToken);
            if (!digestAlreadyQueued)
            {
                NotificationWriter.AddEmailOnly(context, email, "Your HireFlow daily digest", body, digestKey);
            }
            preference.LastDailyDigestSentAtUtc = utcNow;
        }

        if (preferences.Count > 0) await context.SaveChangesAsync(cancellationToken);
    }

    private static TimeZoneInfo GetIndiaTimeZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"); }
    }
}
