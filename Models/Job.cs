using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using HireFlow.Api.Authentication;

namespace HireFlow.Api.Models
{
    public class Job
    {
        public int Id { get; set; }

        [Required]
        [StringLength(150)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        public string Company { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Location { get; set; } = string.Empty;

        [Required]
        [StringLength(3000)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string JobType { get; set; } = string.Empty;

        // Legacy salary field retained for existing React screens and API clients.
        // Salary represents the displayed amount or the lower end of a range.
        [Range(0, 100000000)]
        public decimal Salary { get; set; }

        // Structured discovery metadata. These fields are additive so older
        // clients can continue creating and updating jobs without supplying them.
        [StringLength(100)]
        public string? Category { get; set; }

        [StringLength(30)]
        [RegularExpression("(?i)^(Remote|Hybrid|On-site|Not specified)$")]
        public string WorkMode { get; set; } = "Not specified";

        [StringLength(50)]
        public string? ExperienceLevel { get; set; }

        // Optional structured qualification requirement used by explainable
        // candidate/job matching. Legacy job forms may omit this field.
        [StringLength(150)]
        public string? EducationRequirement { get; set; }

        [Range(0, 50)]
        public int? MinimumExperienceYears { get; set; }

        [Range(0, 50)]
        public int? MaximumExperienceYears { get; set; }

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

        // Recruiter can require a resume for this posting. Defaults to optional for legacy jobs.
        public bool RequireResume { get; set; } = false;

        // Admin-controlled homepage presentation flag.
        public bool IsFeatured { get; set; } = false;

        // Existing jobs are migrated as Published and Active to avoid hiding
        // current listings. These fields support the upcoming moderation flow.
        [Required]
        [StringLength(30)]
        public string PublicationStatus { get; set; } = "Published";

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        // HR user who created this job.
        public string? CreatedByUserId { get; set; }

        [JsonIgnore]
        public ApplicationUser? CreatedByUser { get; set; }

        [JsonIgnore]
        public List<JobApplication> Applications { get; set; } = new();
    }
}
