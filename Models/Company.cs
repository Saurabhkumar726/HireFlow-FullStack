using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models;

public class Company
{
    public int Id { get; set; }

    [Required, StringLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(160)]
    public string NormalizedName { get; set; } = string.Empty;

    [Required, StringLength(180)]
    public string Slug { get; set; } = string.Empty;

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

    // Each approved HR account manages one company profile in this first release.
    public string? OwnerUserId { get; set; }

    [Required, StringLength(30)]
    public string ApprovalStatus { get; set; } = "Pending";

    [StringLength(1000)]
    public string? ReviewReason { get; set; }

    public DateTime? ReviewedAtUtc { get; set; }

    [StringLength(450)]
    public string? ReviewedByUserId { get; set; }

    public bool IsFeatured { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
