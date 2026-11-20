using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class CandidateInterviewResponseRequest
{
    [Required, RegularExpression("^(Accept|Decline|RequestReschedule)$")] public string Action { get; set; } = string.Empty;
    public DateTime? ProposedScheduledAtUtc { get; set; }
    [StringLength(1000)] public string? Note { get; set; }
}
