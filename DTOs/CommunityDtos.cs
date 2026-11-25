using System;
using System.Collections.Generic;

namespace HireFlow.Api.DTOs;

public class DiscussionPostDto
{
    public int Id { get; set; }
    public string Company { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public bool IsAnonymous { get; set; } = true;
    public int Upvotes { get; set; }
    public string TimeAgo { get; set; } = "Just now";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class CreateDiscussionDto
{
    public string Company { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public bool IsAnonymous { get; set; } = true;
    public string? AuthorName { get; set; }
}

public class UpvoteResponseDto
{
    public int PostId { get; set; }
    public int Upvotes { get; set; }
    public bool HasUpvoted { get; set; }
}

public class AlumniProfileDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string GradYear { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Domain { get; set; } = string.Empty;
    public string College { get; set; } = string.Empty;
    public bool OpenToReferrals { get; set; } = true;
    public string LinkedIn { get; set; } = string.Empty;
}

public class ReferralRequestDto
{
    public int AlumniId { get; set; }
    public string ResumeUrl { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public string TargetRole { get; set; } = string.Empty;
    public string CandidateName { get; set; } = string.Empty;
}

public class ChatContactDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string Avatar { get; set; } = string.Empty;
    public bool Unread { get; set; }
    public List<ChatMessageDto> Messages { get; set; } = new();
}

public class ChatMessageDto
{
    public int Id { get; set; }
    public int ContactId { get; set; }
    public string Sender { get; set; } = "candidate"; // "candidate" or "recruiter"
    public string Text { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class SendChatMessageDto
{
    public int ContactId { get; set; }
    public string Text { get; set; } = string.Empty;
}
