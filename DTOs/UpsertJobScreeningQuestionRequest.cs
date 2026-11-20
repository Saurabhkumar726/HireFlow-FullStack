using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class UpsertJobScreeningQuestionRequest
{
    [Required, StringLength(500, MinimumLength = 5)] public string QuestionText { get; set; } = string.Empty;
    [Required, RegularExpression("^(Text|YesNo|SingleChoice|MultipleChoice)$")] public string QuestionType { get; set; } = "Text";
    public List<string> Options { get; set; } = new();
    public bool IsRequired { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
