using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class BulkResumeCandidateInput
    {
        [Required, StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required, EmailAddress, StringLength(254)]
        public string Email { get; set; } = string.Empty;

        [Required, StringLength(5000)]
        public string ResumeText { get; set; } = string.Empty;
    }

    public class BulkResumeScreenRequest
    {
        [Required]
        public int JobId { get; set; }

        [Required]
        public List<BulkResumeCandidateInput> Candidates { get; set; } = new();
    }

    public class BulkResumeScreenResultDto
    {
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int MatchPercentage { get; set; }
        public string FitLevel { get; set; } = "Good Match";
        public List<string> MatchedSkills { get; set; } = new();
        public List<string> MissingSkills { get; set; } = new();
        public string Summary { get; set; } = string.Empty;
        public string RecommendedAction { get; set; } = "Consider"; // "Fast-Track", "Consider", "Pass"
    }

    public class EmailPreviewDto
    {
        public string Subject { get; set; } = string.Empty;
        public string RecipientName { get; set; } = string.Empty;
        public string RecipientEmail { get; set; } = string.Empty;
        public string TemplateType { get; set; } = string.Empty;
        public string HtmlContent { get; set; } = string.Empty;
    }
}
