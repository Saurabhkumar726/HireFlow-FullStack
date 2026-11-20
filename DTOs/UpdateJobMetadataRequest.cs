using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    /// <summary>
    /// Replaces the structured discovery metadata for a job.
    /// Existing title/company/description fields remain managed by the legacy
    /// Jobs PUT endpoint so older HR forms keep working unchanged.
    /// </summary>
    public class UpdateJobMetadataRequest
    {
        [StringLength(100)]
        public string? Category { get; set; }

        [Required]
        [StringLength(30)]
        [RegularExpression("(?i)^(Remote|Hybrid|On-site|Not specified)$")]
        public string WorkMode { get; set; } = "Not specified";

        [StringLength(50)]
        public string? ExperienceLevel { get; set; }

        [StringLength(150)]
        public string? EducationRequirement { get; set; }

        [Range(0, 50)]
        public int? MinimumExperienceYears { get; set; }

        [Range(0, 50)]
        public int? MaximumExperienceYears { get; set; }

        [Range(0, 100000000)]
        public decimal Salary { get; set; }

        [Range(0, 100000000)]
        public decimal? SalaryMax { get; set; }

        [Required]
        [StringLength(30)]
        [RegularExpression("(?i)^(Range|StartingAt|Negotiable|NotDisclosed)$")]
        public string SalaryMode { get; set; } = "Range";

        [Required]
        [StringLength(3, MinimumLength = 3)]
        [RegularExpression("^[A-Z]{3}$")]
        public string SalaryCurrency { get; set; } = "INR";

        [Required]
        [StringLength(20)]
        [RegularExpression("(?i)^(Yearly|Monthly|Weekly|Hourly)$")]
        public string SalaryPeriod { get; set; } = "Monthly";

        [StringLength(4000)]
        public string? Responsibilities { get; set; }

        [StringLength(4000)]
        public string? Requirements { get; set; }

        [StringLength(3000)]
        public string? Benefits { get; set; }

        public DateTime? ApplicationDeadlineUtc { get; set; }

        public bool RequireResume { get; set; } = false;
    }
}
