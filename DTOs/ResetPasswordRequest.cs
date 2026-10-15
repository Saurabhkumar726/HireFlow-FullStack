
using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class ResetPasswordRequest
    {
        [Required]
        public string ResetToken { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string NewPassword { get; set; } = string.Empty;
    }
}
