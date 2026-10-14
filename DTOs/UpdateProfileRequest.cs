using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class UpdateProfileRequest
    {
        [Required]
        [StringLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Phone]
        [StringLength(20)]
        public string? PhoneNumber { get; set; }
    }
}
