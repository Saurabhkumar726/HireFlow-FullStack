using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class BulkUpdateApplicationsRequest
{
    [Required, MinLength(1), MaxLength(200)] public List<int> ApplicationIds { get; set; } = new();
    [Required, StringLength(40)] public string Status { get; set; } = string.Empty;
    [StringLength(1000)] public string? RejectionReason { get; set; }
}
