using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using HireFlow.Api.DTOs;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace HireFlow.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ResumeVersionsController : ControllerBase
{
    private static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, ResumeVersionDto>> UserVersions = new();
    private static readonly ConcurrentDictionary<string, PublicPortfolioProfileDto> PublicPortfolios = new();
    private readonly ILiveEventsService _liveEvents;

    public ResumeVersionsController(ILiveEventsService liveEvents)
    {
        _liveEvents = liveEvents;
    }

    private string CurrentUserId => User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? "default_student";

    private ConcurrentDictionary<string, ResumeVersionDto> GetUserVersions(string userId)
    {
        return UserVersions.GetOrAdd(userId, _ =>
        {
            var dict = new ConcurrentDictionary<string, ResumeVersionDto>();
            dict["fullstack"] = new ResumeVersionDto
            {
                VersionKey = "fullstack",
                Title = "Full-Stack Software Engineer",
                Summary = "Results-driven Full Stack Engineer with 3+ years of experience designing and deploying high-throughput cloud microservices with ASP.NET Core, React, and PostgreSQL.",
                ResumeData = JsonSerializer.SerializeToElement(new
                {
                    title = "Full-Stack Software Engineer",
                    skills = new[] { "React", "TypeScript", "C#", "ASP.NET Core", "PostgreSQL", "Docker", "Redis" }
                })
            };
            dict["frontend"] = new ResumeVersionDto
            {
                VersionKey = "frontend",
                Title = "Frontend / UI Engineer",
                Summary = "Frontend Engineer specializing in React 19, TypeScript, high-performance UI component systems, and Core Web Vitals optimization.",
                ResumeData = JsonSerializer.SerializeToElement(new
                {
                    title = "Frontend / UI Engineer",
                    skills = new[] { "React", "TypeScript", "Tailwind CSS", "Next.js", "Redux Toolkit", "Storybook" }
                })
            };
            dict["backend"] = new ResumeVersionDto
            {
                VersionKey = "backend",
                Title = "Backend & Cloud Engineer",
                Summary = "Backend Engineer focused on ASP.NET Core, distributed microservices, RabbitMQ message queues, and EF Core query optimization.",
                ResumeData = JsonSerializer.SerializeToElement(new
                {
                    title = "Backend & Cloud Engineer",
                    skills = new[] { "C#", ".NET 10", "ASP.NET Core", "Microservices", "PostgreSQL", "Redis", "Docker" }
                })
            };
            return dict;
        });
    }

    [HttpGet]
    public IActionResult GetVersions()
    {
        var versions = GetUserVersions(CurrentUserId);
        return Ok(versions.Values.OrderBy(v => v.VersionKey).ToList());
    }

    [HttpGet("{versionKey}")]
    public IActionResult GetVersion(string versionKey)
    {
        var versions = GetUserVersions(CurrentUserId);
        if (versions.TryGetValue(versionKey.ToLowerInvariant(), out var version))
        {
            return Ok(version);
        }
        return NotFound(new { message = $"Resume version '{versionKey}' not found." });
    }

    [HttpPost]
    public IActionResult SaveVersion([FromBody] SaveResumeVersionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.VersionKey))
            return BadRequest(new { message = "Version key is required (e.g. 'fullstack', 'frontend', 'backend')." });

        var versions = GetUserVersions(CurrentUserId);
        var key = dto.VersionKey.Trim().ToLowerInvariant();

        var record = new ResumeVersionDto
        {
            VersionKey = key,
            Title = string.IsNullOrWhiteSpace(dto.Title) ? $"{char.ToUpper(key[0])}{key[1..]} Resume" : dto.Title.Trim(),
            ResumeData = dto.ResumeData,
            UpdatedAtUtc = DateTime.UtcNow
        };

        versions[key] = record;

        _liveEvents.Publish(new LiveEventDto
        {
            Type = "ResumeVersionSaved",
            Title = $"Resume Version Saved: {record.Title}",
            Message = $"Profile variant '{record.Title}' updated and ready for 1-click tailored application.",
            TargetRole = "Student"
        });

        return Ok(record);
    }

    [HttpGet("portfolio/{username}")]
    public IActionResult GetPortfolio(string username)
    {
        var normalized = string.IsNullOrWhiteSpace(username) ? "alexmorgan" : username.Trim().ToLowerInvariant();

        var portfolio = PublicPortfolios.GetOrAdd(normalized, key => new PublicPortfolioProfileDto
        {
            Username = key,
            FullName = "Alex Morgan",
            Title = "Full-Stack Software Engineer",
            Location = "Bengaluru, India",
            Email = "alex.morgan@hireflow.app",
            Summary = "Full-Stack Software Engineer with 2+ years of experience designing and deploying high-performance cloud applications using ASP.NET Core, React, and PostgreSQL.",
            ResumeData = new
            {
                skills = new[] { "React", "TypeScript", "C#", ".NET 10", "ASP.NET Core", "PostgreSQL", "Docker", "AWS" }
            },
            IsAvailableForHire = true,
            LastUpdatedUtc = DateTime.UtcNow
        });

        return Ok(portfolio);
    }

    [HttpPost("portfolio/{username}/contact")]
    public IActionResult ContactCandidate(string username, [FromBody] Dictionary<string, string> form)
    {
        var senderName = form.GetValueOrDefault("name", "Recruiter");
        var company = form.GetValueOrDefault("company", "Tech Hiring Team");
        var message = form.GetValueOrDefault("message", "We liked your portfolio!");

        _liveEvents.Publish(new LiveEventDto
        {
            Type = "CandidateContacted",
            Title = $"Interview Inquiry from {company}",
            Message = $"{senderName} from {company} sent you a message through your public portfolio link.",
            TargetRole = "Student"
        });

        return Ok(new
        {
            success = true,
            message = $"Inquiry sent to {username}. The candidate will receive your note and contact details.",
            deliveredAtUtc = DateTime.UtcNow
        });
    }
}
