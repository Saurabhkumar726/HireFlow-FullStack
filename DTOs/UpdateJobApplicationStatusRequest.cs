using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class UpdateJobApplicationStatusRequest
    {
        [Required, StringLength(40)]
        public string Status { get; set; } = string.Empty;

        [StringLength(1000)]
        public string? RejectionReason { get; set; }
    }
}
