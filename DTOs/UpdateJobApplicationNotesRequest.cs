using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class UpdateJobApplicationNotesRequest
    {
        [StringLength(4000)]
        public string? Notes { get; set; }
    }
}
