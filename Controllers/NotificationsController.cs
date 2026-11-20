using System.Security.Claims;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly HireFlowDbContext _context;

        public NotificationsController(HireFlowDbContext context)
        {
            _context = context;
        }

        private string? CurrentUserId =>
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

        // GET: api/Notifications?unreadOnly=false&take=30
        [HttpGet]
        public async Task<IActionResult> GetNotifications(
            [FromQuery] bool unreadOnly = false,
            [FromQuery] int take = 30,
            CancellationToken cancellationToken = default)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var pageSize = Math.Clamp(take, 1, 100);
            var query = _context.Notifications.AsNoTracking()
                .Where(item => item.RecipientUserId == userId);

            if (unreadOnly) query = query.Where(item => !item.IsRead);

            var totalCount = await query.CountAsync(cancellationToken);
            var unreadCount = await _context.Notifications.CountAsync(
                item => item.RecipientUserId == userId && !item.IsRead,
                cancellationToken);

            // SQL Server datetime2 does not retain DateTime.Kind. EF Core therefore
            // materializes these UTC values as DateTimeKind.Unspecified. Mark them as
            // UTC after materialization so System.Text.Json emits the trailing 'Z'.
            // The browser can then convert the timestamp to the viewer's local time.
            var databaseItems = await query
                .OrderByDescending(item => item.CreatedAtUtc)
                .Take(pageSize)
                .Select(item => new
                {
                    item.Id,
                    item.Type,
                    item.Title,
                    item.Message,
                    item.ActionUrl,
                    item.RelatedEntityType,
                    item.RelatedEntityId,
                    item.IsRead,
                    item.CreatedAtUtc,
                    item.ReadAtUtc
                })
                .ToListAsync(cancellationToken);

            var items = databaseItems.Select(item => new
            {
                item.Id,
                item.Type,
                item.Title,
                item.Message,
                item.ActionUrl,
                item.RelatedEntityType,
                item.RelatedEntityId,
                item.IsRead,
                CreatedAtUtc = DateTime.SpecifyKind(item.CreatedAtUtc, DateTimeKind.Utc),
                ReadAtUtc = item.ReadAtUtc.HasValue
                    ? DateTime.SpecifyKind(item.ReadAtUtc.Value, DateTimeKind.Utc)
                    : (DateTime?)null
            }).ToList();

            return Ok(new { items, totalCount, unreadCount });
        }

        // GET: api/Notifications/unread-count
        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount(CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var count = await _context.Notifications.CountAsync(
                item => item.RecipientUserId == userId && !item.IsRead,
                cancellationToken);

            return Ok(new { unreadCount = count });
        }

        // PUT: api/Notifications/{id}/read
        [HttpPut("{id:int}/read")]
        public async Task<IActionResult> MarkAsRead(int id, CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var notification = await _context.Notifications.FirstOrDefaultAsync(
                item => item.Id == id && item.RecipientUserId == userId,
                cancellationToken);

            if (notification == null) return NotFound();

            if (!notification.IsRead)
            {
                notification.IsRead = true;
                notification.ReadAtUtc = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }

            return NoContent();
        }

        // POST: api/Notifications/read-all
        [HttpPost("read-all")]
        public async Task<IActionResult> MarkAllAsRead(CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var unread = await _context.Notifications
                .Where(item => item.RecipientUserId == userId && !item.IsRead)
                .ToListAsync(cancellationToken);

            var now = DateTime.UtcNow;
            foreach (var item in unread)
            {
                item.IsRead = true;
                item.ReadAtUtc = now;
            }

            if (unread.Count > 0) await _context.SaveChangesAsync(cancellationToken);
            return Ok(new { updated = unread.Count });
        }

        // DELETE: api/Notifications/{id}
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteNotification(int id, CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var notification = await _context.Notifications.FirstOrDefaultAsync(
                item => item.Id == id && item.RecipientUserId == userId,
                cancellationToken);

            if (notification == null) return NotFound();

            _context.Notifications.Remove(notification);
            await _context.SaveChangesAsync(cancellationToken);
            return NoContent();
        }

        // GET: api/Notifications/preferences
        [HttpGet("preferences")]
        public async Task<IActionResult> GetPreferences(CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var preference = await _context.NotificationPreferences.AsNoTracking()
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken);

            return Ok(preference ?? new NotificationPreference { UserId = userId });
        }

        // PUT: api/Notifications/preferences
        [HttpPut("preferences")]
        public async Task<IActionResult> UpdatePreferences(
            [FromBody] UpdateNotificationPreferencesRequest request,
            CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var preference = await _context.NotificationPreferences
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken);

            if (preference == null)
            {
                preference = new NotificationPreference { UserId = userId };
                _context.NotificationPreferences.Add(preference);
            }

            preference.InAppEnabled = request.InAppEnabled;
            preference.ApplicationInAppEnabled = request.ApplicationInAppEnabled;
            preference.InterviewInAppEnabled = request.InterviewInAppEnabled;
            preference.EmailEnabled = request.EmailEnabled;
            preference.ApplicationEmailEnabled = request.ApplicationEmailEnabled;
            preference.InterviewEmailEnabled = request.InterviewEmailEnabled;
            preference.DailyDigestEmailEnabled = request.DailyDigestEmailEnabled;
            preference.InterviewReminderEmailEnabled = request.InterviewReminderEmailEnabled;
            preference.InterviewReminderInAppEnabled = request.InterviewReminderInAppEnabled;
            preference.UpdatedAtUtc = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                message = "Notification preferences saved.",
                preference.InAppEnabled,
                preference.ApplicationInAppEnabled,
                preference.InterviewInAppEnabled,
                preference.EmailEnabled,
                preference.ApplicationEmailEnabled,
                preference.InterviewEmailEnabled,
                preference.DailyDigestEmailEnabled,
                preference.InterviewReminderEmailEnabled,
                preference.InterviewReminderInAppEnabled,
                preference.LastDailyDigestSentAtUtc,
                preference.UpdatedAtUtc
            });
        }
    }
}