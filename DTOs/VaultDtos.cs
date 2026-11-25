using System;
using System.Collections.Generic;

namespace HireFlow.Api.DTOs;

public class VaultDocumentDto
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = "Academic Transcript"; // Academic Transcript, Letter of Recommendation, Certificate, Identity Proof
    public string FileUrl { get; set; } = string.Empty;
    public string IssueDate { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd");
    public bool VerifiedByCollege { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class AddVaultDocumentDto
{
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = "Academic Transcript";
    public string? FileUrl { get; set; }
}

public class VaultBundleDto
{
    public string BundleId { get; set; } = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
    public string CandidateName { get; set; } = "Alex Morgan";
    public string College { get; set; } = "National Institute of Technology";
    public DateTime GeneratedAtUtc { get; set; } = DateTime.UtcNow;
    public List<VaultDocumentDto> Documents { get; set; } = new();
    public string VerificationStatus { get; set; } = "Verified Authenticated Bundle";
}
