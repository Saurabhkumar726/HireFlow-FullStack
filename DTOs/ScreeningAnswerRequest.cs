using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class ScreeningAnswerRequest
{
    [Range(1, int.MaxValue)] public int QuestionId { get; set; }
    [Required, StringLength(4000)] public string AnswerText { get; set; } = string.Empty;
}
