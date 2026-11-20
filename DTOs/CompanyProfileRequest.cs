using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class CompanyProfileRequest
{
    [Required, StringLength(150, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [StringLength(3000)]
    public string? Description { get; set; }

    [StringLength(120)]
    public string? Industry { get; set; }

    [StringLength(150)]
    public string? Location { get; set; }

    [StringLength(500)]
    public string? Website { get; set; }

    [StringLength(1000)]
    public string? LogoUrl { get; set; }
}
