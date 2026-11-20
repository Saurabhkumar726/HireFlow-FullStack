using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class ReviewCandidateInterviewRequest
{
    [Required, RegularExpression("^(ApproveReschedule|DeclineReschedule)$")] public string Action { get; set; } = string.Empty;
    [StringLength(1000)] public string? Note { get; set; }
}
