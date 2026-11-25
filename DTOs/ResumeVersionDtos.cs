using System;
using System.Text.Json;

namespace HireFlow.Api.DTOs;

public class ResumeVersionDto
{
    public string VersionKey { get; set; } = "fullstack"; // "fullstack", "frontend", "backend"
    public string Title { get; set; } = "Full-Stack Engineer";
    public string Summary { get; set; } = string.Empty;
    public JsonElement ResumeData { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class SaveResumeVersionDto
{
    public string VersionKey { get; set; } = "fullstack";
    public string Title { get; set; } = string.Empty;
    public JsonElement ResumeData { get; set; }
}

public class PublicPortfolioProfileDto
{
    public string Username { get; set; } = "alexmorgan";
    public string FullName { get; set; } = "Alex Morgan";
    public string Title { get; set; } = "Full-Stack Software Engineer";
    public string Location { get; set; } = "Bengaluru, India";
    public string Email { get; set; } = "alex.morgan@hireflow.app";
    public string Summary { get; set; } = string.Empty;
    public object? ResumeData { get; set; }
    public bool IsAvailableForHire { get; set; } = true;
    public DateTime LastUpdatedUtc { get; set; } = DateTime.UtcNow;
}
