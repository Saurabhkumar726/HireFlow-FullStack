namespace HireFlow.Api.Models;

public class SavedJobCollectionItem
{
    public int SavedJobCollectionId { get; set; }
    public int SavedJobId { get; set; }
    public DateTime AddedAtUtc { get; set; } = DateTime.UtcNow;

    public SavedJobCollection Collection { get; set; } = null!;
    public SavedJob SavedJob { get; set; } = null!;
}
