using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs;

public class CreateSavedJobCollectionRequest
{
    [Required, StringLength(40, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;
}
