using System.Security.Claims;
using System.Text.Json;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HireFlow.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LiveEventsController : ControllerBase
{
    private readonly ILiveEventsService _eventsService;

    public LiveEventsController(ILiveEventsService eventsService)
    {
        _eventsService = eventsService;
    }

    [HttpGet("stream")]
    public async Task GetStream([FromQuery] string? token, CancellationToken cancellationToken)
    {
        // Try getting user info from Claims or Query Token
        var userId = CurrentUserId;
        var role = CurrentUserRole;

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache, no-transform");
        Response.Headers.Append("Connection", "keep-alive");
        Response.Headers.Append("X-Accel-Buffering", "no");

        // Send initial connected heartbeat
        await Response.WriteAsync($"data: {JsonSerializer.Serialize(new { type = "Connected", message = "HireFlow Realtime Active", timestamp = DateTime.UtcNow })}\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);

        try
        {
            await foreach (var evt in _eventsService.SubscribeAsync(userId, role, cancellationToken))
            {
                var json = JsonSerializer.Serialize(evt);
                await Response.WriteAsync($"data: {json}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            // Client closed connection cleanly
        }
    }

    [HttpGet("recent")]
    public IActionResult GetRecent([FromQuery] int limit = 10)
    {
        var events = _eventsService.GetRecentEvents(limit);
        return Ok(events);
    }

    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
    private string? CurrentUserRole => User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role");
}
