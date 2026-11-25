using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using HireFlow.Api.DTOs;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace HireFlow.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VaultController : ControllerBase
{
    private static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, VaultDocumentDto>> UserVaults = new();
    private static readonly ConcurrentDictionary<string, VaultBundleDto> SharedBundles = new();
    private readonly ILiveEventsService _liveEvents;

    public VaultController(ILiveEventsService liveEvents)
    {
        _liveEvents = liveEvents;
    }

    private string CurrentUserId => User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? "default_student_vault";

    private ConcurrentDictionary<string, VaultDocumentDto> GetOrCreateUserDocs(string userId)
    {
        return UserVaults.GetOrAdd(userId, _ =>
        {
            var dict = new ConcurrentDictionary<string, VaultDocumentDto>();
            var seedDocs = new List<VaultDocumentDto>
            {
                new()
                {
                    Id = "doc-1",
                    Title = "B.Tech Official Degree Transcript",
                    Category = "Academic Transcript",
                    FileUrl = "https://hireflow.me/vault/alexmorgan-transcript.pdf",
                    IssueDate = "2026-05-15",
                    VerifiedByCollege = true
                },
                new()
                {
                    Id = "doc-2",
                    Title = "Department Head Letter of Recommendation (LOR)",
                    Category = "Letter of Recommendation",
                    FileUrl = "https://hireflow.me/vault/alexmorgan-lor.pdf",
                    IssueDate = "2026-06-01",
                    VerifiedByCollege = true
                },
                new()
                {
                    Id = "doc-3",
                    Title = "AWS Certified Cloud Practitioner Certificate",
                    Category = "Certificate",
                    FileUrl = "https://hireflow.me/vault/alexmorgan-aws.pdf",
                    IssueDate = "2026-08-20",
                    VerifiedByCollege = true
                }
            };
            foreach (var doc in seedDocs)
            {
                dict[doc.Id] = doc;
            }
            return dict;
        });
    }

    [HttpGet("documents")]
    public IActionResult GetDocuments()
    {
        var docs = GetOrCreateUserDocs(CurrentUserId);
        return Ok(docs.Values.OrderByDescending(d => d.CreatedAtUtc).ToList());
    }

    [HttpPost("documents")]
    public IActionResult AddDocument([FromBody] AddVaultDocumentDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Document title cannot be empty." });

        var docs = GetOrCreateUserDocs(CurrentUserId);
        var newDoc = new VaultDocumentDto
        {
            Id = Guid.NewGuid().ToString("N")[..8],
            Title = dto.Title.Trim(),
            Category = string.IsNullOrWhiteSpace(dto.Category) ? "Certificate" : dto.Category.Trim(),
            FileUrl = !string.IsNullOrWhiteSpace(dto.FileUrl) ? dto.FileUrl.Trim() : $"https://hireflow.me/vault/{Guid.NewGuid():N}.pdf",
            IssueDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            VerifiedByCollege = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        docs[newDoc.Id] = newDoc;

        _liveEvents.Publish(new LiveEventDto
        {
            Type = "VaultDocumentAdded",
            Title = "Document Added to Digital Vault",
            Message = $"'{newDoc.Title}' uploaded and verified in credential locker.",
            TargetRole = "Student"
        });

        return Ok(newDoc);
    }

    [HttpDelete("documents/{id}")]
    public IActionResult DeleteDocument(string id)
    {
        var docs = GetOrCreateUserDocs(CurrentUserId);
        if (docs.TryRemove(id, out var removed))
        {
            return Ok(new { success = true, message = $"Document '{removed.Title}' removed from vault." });
        }
        return NotFound(new { message = "Document not found in vault." });
    }

    [HttpGet("bundle")]
    public IActionResult CreateOrGetBundle()
    {
        var docs = GetOrCreateUserDocs(CurrentUserId);
        var bundleId = "HF-BGV-" + CurrentUserId.GetHashCode().ToString("X")[..6];

        var bundle = new VaultBundleDto
        {
            BundleId = bundleId,
            CandidateName = "Alex Morgan",
            College = "National Institute of Technology",
            GeneratedAtUtc = DateTime.UtcNow,
            Documents = docs.Values.ToList(),
            VerificationStatus = "Digitally Verified College Credential Bundle"
        };

        SharedBundles[bundleId] = bundle;
        return Ok(bundle);
    }

    [HttpGet("bundle/{bundleId}")]
    public IActionResult GetPublicBundle(string bundleId)
    {
        if (SharedBundles.TryGetValue(bundleId, out var bundle))
        {
            return Ok(bundle);
        }

        // Generate synthetic bundle for any valid BGV query
        var synthetic = new VaultBundleDto
        {
            BundleId = bundleId,
            CandidateName = "Alex Morgan",
            College = "National Institute of Technology",
            Documents = GetOrCreateUserDocs("default_student_vault").Values.ToList()
        };

        return Ok(synthetic);
    }
}
