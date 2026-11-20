using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models;

public class JobScreeningQuestion
{
    public int Id { get; set; }
    [Required] public int JobId { get; set; }
    [Required, StringLength(500)] public string QuestionText { get; set; } = string.Empty;
    [Required, StringLength(30)] public string QuestionType { get; set; } = "Text";
    // JSON array for SingleChoice and MultipleChoice options.
    public string? OptionsJson { get; set; }
    public bool IsRequired { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
