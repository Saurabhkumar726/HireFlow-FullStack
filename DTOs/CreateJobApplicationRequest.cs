
using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class CreateJobApplicationRequest
    {
        [Range(1, int.MaxValue)]
        public int JobId { get; set; }

        [StringLength(2000)]
        public string CoverLetter { get; set; } = string.Empty;
    }
}
