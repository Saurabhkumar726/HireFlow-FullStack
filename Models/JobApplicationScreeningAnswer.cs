using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models;

public class JobApplicationScreeningAnswer
{
	public int Id { get; set; }
	[Required] public int JobApplicationId { get; set; }
	public JobApplication? JobApplication { get; set; }
	[Required] public int JobScreeningQuestionId { get; set; }
	public JobScreeningQuestion? Question { get; set; }
	[Required, StringLength(500)] public string QuestionTextSnapshot { get; set; } = string.Empty;
	[Required, StringLength(4000)] public string AnswerText { get; set; } = string.Empty;
	public DateTime AnsweredAtUtc { get; set; } = DateTime.UtcNow;
}
