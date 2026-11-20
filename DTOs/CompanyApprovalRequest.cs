using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class CompanyApprovalRequest
{
    [Required, RegularExpression("^(Approved|Rejected|NeedsInfo)$")]
    public string Status { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Reason { get; set; }
}
