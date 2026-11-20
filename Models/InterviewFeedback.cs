using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models;

public class InterviewFeedback
{
    public int Id { get; set; }
    [Required] public int InterviewId { get; set; }
    public Interview? Interview { get; set; }
    [Required, StringLength(450)] public string SubmittedByUserId { get; set; } = string.Empty;
    [Range(1, 5)] public int OverallRating { get; set; }
    [Range(1, 5)] public int? TechnicalRating { get; set; }
    [Range(1, 5)] public int? CommunicationRating { get; set; }
    [Range(1, 5)] public int? ProblemSolvingRating { get; set; }
    [Required, StringLength(30)] public string Recommendation { get; set; } = "Undecided";
    [StringLength(2000)] public string? Strengths { get; set; }
    [StringLength(2000)] public string? AreasToImprove { get; set; }
    [StringLength(3000)] public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
