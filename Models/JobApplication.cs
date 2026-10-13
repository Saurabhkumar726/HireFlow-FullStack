namespace HireFlow.Api.Models
{
    public class JobApplication
    {
        public int Id { get; set; }

        public int JobId { get; set; }

        public string ApplicantName { get; set; } = string.Empty;

        public string ApplicantEmail { get; set; } = string.Empty;

        public string ResumeUrl { get; set; } = string.Empty;

        public string CoverLetter { get; set; } = string.Empty;

        public string Status { get; set; } = "Pending";

        public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
    }
}