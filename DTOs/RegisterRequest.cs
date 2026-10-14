using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class RegisterRequest
    {
        [Required]
        [StringLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string Password { get; set; } = string.Empty;

        [Required]
        [RegularExpression("Student|HR",
            ErrorMessage = "Role must be Student or HR.")]
        public string Role { get; set; } = "Student";
    }
}
