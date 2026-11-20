using HireFlow.Api.Authentication;

namespace HireFlow.Api.Models;

public class SavedJob
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int JobId { get; set; }
    public DateTime SavedAtUtc { get; set; } = DateTime.UtcNow;

    public Job Job { get; set; } = null!;
}
