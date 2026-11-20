using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class SaveInterviewFeedbackRequest
{
    [Range(1, 5)] public int OverallRating { get; set; }
    [Range(1, 5)] public int? TechnicalRating { get; set; }
    [Range(1, 5)] public int? CommunicationRating { get; set; }
    [Range(1, 5)] public int? ProblemSolvingRating { get; set; }
    [Required, RegularExpression("^(StrongHire|Hire|Undecided|NoHire|StrongNoHire)$")] public string Recommendation { get; set; } = "Undecided";
    [StringLength(2000)] public string? Strengths { get; set; }
    [StringLength(2000)] public string? AreasToImprove { get; set; }
    [StringLength(3000)] public string? Notes { get; set; }
}
