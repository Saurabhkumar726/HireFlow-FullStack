namespace HireFlow.Api.Models;

public class SavedJobCollection
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<SavedJobCollectionItem> Items { get; set; } = new List<SavedJobCollectionItem>();
}
