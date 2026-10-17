using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.Models
{
    public class CandidateSkill
    {
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string SkillName { get; set; } = string.Empty;

        // Supported categories: KeySkill and ITSkill
        [Required]
        [StringLength(30)]
        public string Category { get; set; } = "KeySkill";

        [StringLength(100)]
        public string? Proficiency { get; set; }

        [StringLength(100)]
        public string? Version { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
