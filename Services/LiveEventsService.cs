using System.Collections.Concurrent;
using System.Text.Json.Serialization;
using System.Threading.Channels;

namespace HireFlow.Api.Services;

public record LiveEventDto
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = Guid.NewGuid().ToString("N");

    [JsonPropertyName("type")]
    public string Type { get; init; } = "General"; // "ApplicationReceived", "OfferAccepted", "OfferDeclined", "InterviewScheduled", "StatusUpdated", "ScorecardSaved"

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("message")]
    public string Message { get; init; } = string.Empty;

    [JsonPropertyName("timestampUtc")]
    public DateTime TimestampUtc { get; init; } = DateTime.UtcNow;

    [JsonPropertyName("targetRole")]
    public string? TargetRole { get; init; } // null = all, "HR", "Student"

    [JsonPropertyName("targetUserId")]
    public string? TargetUserId { get; init; }

    [JsonPropertyName("payload")]
    public object? Payload { get; init; }
}

public interface ILiveEventsService
{
    void Publish(LiveEventDto evt);
    IAsyncEnumerable<LiveEventDto> SubscribeAsync(string? userId, string? role, CancellationToken cancellationToken);
    IReadOnlyList<LiveEventDto> GetRecentEvents(int limit = 15);
}

public class LiveEventsService : ILiveEventsService
{
    private readonly ConcurrentDictionary<Guid, (Channel<LiveEventDto> Channel, string? UserId, string? Role)> _subscribers = new();
    private readonly ConcurrentQueue<LiveEventDto> _recentEvents = new();
    private const int MaxHistory = 50;

    public void Publish(LiveEventDto evt)
    {
        // Enqueue to recent history
        _recentEvents.Enqueue(evt);
        while (_recentEvents.Count > MaxHistory && _recentEvents.TryDequeue(out _)) { }

        // Broadcast to matching subscribers
        foreach (var (subId, sub) in _subscribers)
        {
            // Role filter check
            if (!string.IsNullOrEmpty(evt.TargetRole) && !string.Equals(evt.TargetRole, sub.Role, StringComparison.OrdinalIgnoreCase) && !string.Equals(sub.Role, "Admin", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            // User ID filter check
            if (!string.IsNullOrEmpty(evt.TargetUserId) && !string.Equals(evt.TargetUserId, sub.UserId, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            sub.Channel.Writer.TryWrite(evt);
        }
    }

    public async IAsyncEnumerable<LiveEventDto> SubscribeAsync(string? userId, string? role, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var subId = Guid.NewGuid();
        var channel = Channel.CreateUnbounded<LiveEventDto>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });

        _subscribers.TryAdd(subId, (channel, userId, role));

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                LiveEventDto evt;
                try
                {
                    evt = await channel.Reader.ReadAsync(cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                yield return evt;
            }
        }
        finally
        {
            _subscribers.TryRemove(subId, out _);
            channel.Writer.TryComplete();
        }
    }

    public IReadOnlyList<LiveEventDto> GetRecentEvents(int limit = 15)
    {
        return _recentEvents.ToArray().Reverse().Take(Math.Clamp(limit, 1, 50)).ToList();
    }
}
