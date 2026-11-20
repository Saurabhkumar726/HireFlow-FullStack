using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models;

/// <summary>
/// Student-owned job discovery preferences. Lists are stored as JSON text to keep
/// the model portable across the existing SQL Server schema and EF Core setup.
/// </summary>
public class CandidateJobPreference
{
    public int Id { get; set; }

    [Required]
    [StringLength(450)]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [StringLength(3000)]
    public string PreferredRolesJson { get; set; } = "[]";

    [Required]
    [StringLength(2200)]
    public string PreferredIndustriesJson { get; set; } = "[]";

    [Required]
    [StringLength(6000)]
    public string PreferredSkillsJson { get; set; } = "[]";

    [Required]
    [StringLength(3000)]
    public string PreferredLocationsJson { get; set; } = "[]";

    [Required]
    [StringLength(1500)]
    public string EmploymentTypesJson { get; set; } = "[]";

    [Required]
    [StringLength(750)]
    public string WorkModesJson { get; set; } = "[]";

    [StringLength(40)]
    public string? ExperienceLevel { get; set; }

    [Range(0, 100000000)]
    public decimal? ExpectedSalary { get; set; }

    [Required]
    [StringLength(3, MinimumLength = 3)]
    public string SalaryCurrency { get; set; } = "INR";

    [Required]
    [StringLength(20)]
    public string SalaryPeriod { get; set; } = "Yearly";

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
