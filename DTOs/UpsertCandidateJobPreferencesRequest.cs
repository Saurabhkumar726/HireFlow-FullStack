using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class UpsertCandidateJobPreferencesRequest
{
    [MaxLength(20)]
    public List<string> PreferredRoles { get; set; } = new();

    [MaxLength(20)]
    public List<string> PreferredIndustries { get; set; } = new();

    [MaxLength(50)]
    public List<string> PreferredSkills { get; set; } = new();

    [MaxLength(20)]
    public List<string> PreferredLocations { get; set; } = new();

    [MaxLength(10)]
    public List<string> EmploymentTypes { get; set; } = new();

    [MaxLength(5)]
    public List<string> WorkModes { get; set; } = new();

    [StringLength(40)]
    public string? ExperienceLevel { get; set; }

    [Range(0, 100000000)]
    public decimal? ExpectedSalary { get; set; }

    [StringLength(3, MinimumLength = 3)]
    [RegularExpression("^[A-Za-z]{3}$")]
    public string SalaryCurrency { get; set; } = "INR";

    [StringLength(20)]
    public string SalaryPeriod { get; set; } = "Yearly";
}
