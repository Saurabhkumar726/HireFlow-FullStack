using HireFlow.Api.Data;
using HireFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Services;

/// <summary>Queues one reminder per interview at 24h, 1h and 15m before the scheduled time.</summary>
public sealed class InterviewReminderWorker : BackgroundService
{
    private static readonly int[] ReminderOffsetsMinutes = [1440, 60, 15];
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InterviewReminderWorker> _logger;

    public InterviewReminderWorker(IServiceScopeFactory scopeFactory, ILogger<InterviewReminderWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await QueueDueRemindersAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { _logger.LogError(ex, "HireFlow interview reminder scan failed."); }
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }

    private async Task QueueDueRemindersAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<HireFlowDbContext>();
        var now = DateTime.UtcNow;
        var interviews = await context.Interviews
            .Include(item => item.JobApplication)
            .ThenInclude(application => application!.Job)
            .Where(item => item.Status == "Scheduled" &&
                item.CandidateResponseStatus != "Declined" &&
                item.CandidateResponseStatus != "RescheduleRequested" &&
                item.ScheduledAt > now && item.ScheduledAt <= now.AddHours(24).AddMinutes(2))
            .ToListAsync(cancellationToken);

        foreach (var interview in interviews)
        {
            foreach (var offset in ReminderOffsetsMinutes)
            {
                var dueAt = interview.ScheduledAt.AddMinutes(-offset);
                // Allow a short recovery window for brief restarts, but do not send
                // several stale reminders together just before the interview begins.
                if (now < dueAt || now > dueAt.AddMinutes(5) || now >= interview.ScheduledAt) continue;
                if (await context.InterviewReminderLogs.AnyAsync(log =>
                    log.InterviewId == interview.Id &&
                    log.ScheduledAtUtc == interview.ScheduledAt &&
                    log.ReminderMinutes == offset, cancellationToken)) continue;

                var application = interview.JobApplication;
                if (application == null) continue;
                context.InterviewReminderLogs.Add(new InterviewReminderLog
                {
                    InterviewId = interview.Id,
                    ReminderMinutes = offset,
                    ScheduledAtUtc = interview.ScheduledAt,
                    RecipientUserId = application.UserId,
                    ProcessedAtUtc = now
                });

                var label = offset switch { 1440 => "24 hours", 60 => "1 hour", _ => "15 minutes" };
                var title = $"Interview reminder: {label} to go";
                var message = $"Your interview for {application.Job?.Title ?? "your application"} starts in {label}.";
                if (!string.IsNullOrWhiteSpace(application.UserId))
                {
                    await NotificationWriter.AddInAppAsync(context, application.UserId,
                        "InterviewReminder", title, message, "/candidate/interviews", "Interview", interview.Id, cancellationToken);
                }
                else
                {
                    NotificationWriter.AddEmailOnly(context, application.ApplicantEmail,
                        $"{title} | HireFlow", $"<p>{System.Net.WebUtility.HtmlEncode(message)}</p>",
                        $"interview-reminder-{interview.Id}-{interview.ScheduledAt.Ticks}-{offset}");
                }

                try { await context.SaveChangesAsync(cancellationToken); }
                catch (DbUpdateException ex)
                {
                    _logger.LogDebug(ex, "Interview reminder {InterviewId}/{Offset} was already claimed by another worker.", interview.Id, offset);
                    context.ChangeTracker.Clear();
                }
            }
        }
    }
}
