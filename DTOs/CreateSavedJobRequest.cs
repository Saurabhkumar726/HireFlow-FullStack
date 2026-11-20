using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class CreateSavedJobRequest
{
    [Range(1, int.MaxValue)]
    public int JobId { get; set; }
}
