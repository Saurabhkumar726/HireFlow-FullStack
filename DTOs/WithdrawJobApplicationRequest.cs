using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class WithdrawJobApplicationRequest
    {
        [StringLength(1000)]
        public string? Reason { get; set; }
    }
}
