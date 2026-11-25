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
public class CommunityController : ControllerBase
{
    private static readonly ConcurrentDictionary<int, DiscussionPostDto> Discussions = new();
    private static readonly ConcurrentDictionary<int, AlumniProfileDto> Alumni = new();
    private static readonly ConcurrentDictionary<int, ChatContactDto> Contacts = new();
    private static readonly ConcurrentDictionary<string, HashSet<int>> UserUpvotes = new();
    private static int _nextDiscussionId = 1;
    private static int _nextMessageId = 100;
    private readonly ILiveEventsService _liveEvents;

    static CommunityController()
    {
        SeedData();
    }

    public CommunityController(ILiveEventsService liveEvents)
    {
        _liveEvents = liveEvents;
    }

    public static void SeedData()
    {
        if (Discussions.IsEmpty)
        {
            var seedPosts = new List<DiscussionPostDto>
            {
                new()
                {
                    Id = _nextDiscussionId++,
                    Company = "Amazon",
                    Role = "SDE-1 (6-Month Intern)",
                    Text = "Amazon OA consisted of 2 coding questions on HackerRank. Q1 was a variation of Sliding Window Maximum, and Q2 was a Graph BFS problem on server network clusters. Time limit was 70 mins. Work on edge cases!",
                    AuthorName = "NIT Batch of '25",
                    IsAnonymous = true,
                    Upvotes = 24,
                    TimeAgo = "2 hours ago"
                },
                new()
                {
                    Id = _nextDiscussionId++,
                    Company = "Google India",
                    Role = "Software Engineering Intern",
                    Text = "Round 1 focused heavily on clean code and Big-O trade-offs. The problem was Interval Scheduling and Prefix Sums. Interviewer was very collaborative and appreciated writing test cases before coding.",
                    AuthorName = "Student Peer",
                    IsAnonymous = true,
                    Upvotes = 18,
                    TimeAgo = "5 hours ago"
                },
                new()
                {
                    Id = _nextDiscussionId++,
                    Company = "Microsoft",
                    Role = "SWE Graduate",
                    Text = "System Design behavioral round: Asked about handling race conditions in inventory booking with optimistic concurrency vs distributed locks in Redis. Practice explaining trade-offs aloud!",
                    AuthorName = "Campus Senior",
                    IsAnonymous = false,
                    Upvotes = 31,
                    TimeAgo = "1 day ago"
                }
            };

            foreach (var post in seedPosts)
            {
                Discussions[post.Id] = post;
            }
        }

        if (Alumni.IsEmpty)
        {
            var seedAlumni = new List<AlumniProfileDto>
            {
                new()
                {
                    Id = 1,
                    Name = "Karan Mehra",
                    GradYear = "2023",
                    Company = "Google India",
                    Role = "Software Engineer II (L4)",
                    Domain = "Cloud Infrastructure & SRE",
                    College = "National Institute of Technology",
                    OpenToReferrals = true,
                    LinkedIn = "linkedin.com/in/karanmehra"
                },
                new()
                {
                    Id = 2,
                    Name = "Sneha Patel",
                    GradYear = "2024",
                    Company = "Microsoft",
                    Role = "Software Development Engineer",
                    Domain = "Azure Cosmos DB Core",
                    College = "National Institute of Technology",
                    OpenToReferrals = true,
                    LinkedIn = "linkedin.com/in/snehapatel"
                },
                new()
                {
                    Id = 3,
                    Name = "Rahul Deshmukh",
                    GradYear = "2022",
                    Company = "Amazon AWS",
                    Role = "SDE-2",
                    Domain = "Amazon DynamoDB Scaling",
                    College = "National Institute of Technology",
                    OpenToReferrals = true,
                    LinkedIn = "linkedin.com/in/rahuldeshmukh"
                }
            };

            foreach (var a in seedAlumni)
            {
                Alumni[a.Id] = a;
            }
        }

        if (Contacts.IsEmpty)
        {
            var seedContacts = new List<ChatContactDto>
            {
                new()
                {
                    Id = 1,
                    Name = "Sarah Jenkins",
                    Company = "TechFlow Systems",
                    Avatar = "SJ",
                    Unread = false,
                    Messages = new List<ChatMessageDto>
                    {
                        new() { Id = 1, ContactId = 1, Sender = "recruiter", Text = "Hi Alex! We reviewed your HireFlow resume and your 400+ GitHub commits. The team is very interested in scheduling a technical round.", Time = "10:30 AM" },
                        new() { Id = 2, ContactId = 1, Sender = "candidate", Text = "Thank you Sarah! I am available this week between 2 PM and 5 PM IST.", Time = "10:45 AM" },
                        new() { Id = 3, ContactId = 1, Sender = "recruiter", Text = "Great, I have scheduled Round 1 for Friday at 2:30 PM. Let me know if you need any prep tips!", Time = "11:00 AM" }
                    }
                },
                new()
                {
                    Id = 2,
                    Name = "David Kumar",
                    Company = "Innovate Labs",
                    Avatar = "DK",
                    Unread = true,
                    Messages = new List<ChatMessageDto>
                    {
                        new() { Id = 4, ContactId = 2, Sender = "recruiter", Text = "Hello Alex, your React & .NET skill quiz score was outstanding. Can you share your portfolio link?", Time = "Yesterday" }
                    }
                }
            };

            foreach (var c in seedContacts)
            {
                Contacts[c.Id] = c;
            }
        }
    }

    [HttpGet("discussions")]
    public IActionResult GetDiscussions()
    {
        var list = Discussions.Values
            .OrderByDescending(d => d.Id)
            .ToList();
        return Ok(list);
    }

    [HttpPost("discussions")]
    public IActionResult CreateDiscussion([FromBody] CreateDiscussionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Text))
            return BadRequest(new { message = "Discussion content cannot be empty." });

        var newPost = new DiscussionPostDto
        {
            Id = System.Threading.Interlocked.Increment(ref _nextDiscussionId),
            Company = string.IsNullOrWhiteSpace(dto.Company) ? "Tech Industry" : dto.Company.Trim(),
            Role = string.IsNullOrWhiteSpace(dto.Role) ? "Software Engineer" : dto.Role.Trim(),
            Text = dto.Text.Trim(),
            AuthorName = dto.IsAnonymous ? "Campus Peer (Anonymous)" : (!string.IsNullOrWhiteSpace(dto.AuthorName) ? dto.AuthorName.Trim() : "HireFlow Student"),
            IsAnonymous = dto.IsAnonymous,
            Upvotes = 1,
            TimeAgo = "Just now",
            CreatedAtUtc = DateTime.UtcNow
        };

        Discussions[newPost.Id] = newPost;

        _liveEvents.Publish(new LiveEventDto
        {
            Type = "CommunityPostAdded",
            Title = $"New Interview Insight: {newPost.Company}",
            Message = $"{newPost.Company} {newPost.Role} experience shared by {newPost.AuthorName}",
            TargetRole = "Student"
        });

        return Ok(newPost);
    }

    [HttpPost("discussions/{id:int}/upvote")]
    public IActionResult UpvoteDiscussion(int id)
    {
        if (!Discussions.TryGetValue(id, out var post))
            return NotFound(new { message = "Discussion post not found." });

        var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? "guest_session";
        var userSet = UserUpvotes.GetOrAdd(userId, _ => new HashSet<int>());

        bool hasUpvoted;
        lock (userSet)
        {
            if (userSet.Contains(id))
            {
                userSet.Remove(id);
                post.Upvotes = Math.Max(0, post.Upvotes - 1);
                hasUpvoted = false;
            }
            else
            {
                userSet.Add(id);
                post.Upvotes += 1;
                hasUpvoted = true;
            }
        }

        return Ok(new UpvoteResponseDto
        {
            PostId = id,
            Upvotes = post.Upvotes,
            HasUpvoted = hasUpvoted
        });
    }

    [HttpGet("alumni")]
    public IActionResult GetAlumni()
    {
        return Ok(Alumni.Values.OrderBy(a => a.Id).ToList());
    }

    [HttpPost("referrals/request")]
    public IActionResult RequestReferral([FromBody] ReferralRequestDto dto)
    {
        if (dto.AlumniId <= 0 || !Alumni.TryGetValue(dto.AlumniId, out var alum))
            return NotFound(new { message = "Selected alumni contact not found." });

        _liveEvents.Publish(new LiveEventDto
        {
            Type = "ReferralRequested",
            Title = "Referral Request Dispatched",
            Message = $"Referral inquiry for {alum.Company} ({alum.Role}) delivered to {alum.Name}.",
            TargetRole = "Student"
        });

        return Ok(new
        {
            success = true,
            message = $"Referral inquiry successfully delivered to {alum.Name} ({alum.Company}).",
            deliveredAtUtc = DateTime.UtcNow
        });
    }

    [HttpGet("contacts")]
    public IActionResult GetContacts()
    {
        return Ok(Contacts.Values.OrderBy(c => c.Id).ToList());
    }

    [HttpGet("messages/{contactId:int}")]
    public IActionResult GetMessages(int contactId)
    {
        if (!Contacts.TryGetValue(contactId, out var contact))
            return NotFound(new { message = "Contact not found." });

        contact.Unread = false;
        return Ok(contact.Messages);
    }

    [HttpPost("messages")]
    public IActionResult SendMessage([FromBody] SendChatMessageDto dto)
    {
        if (dto.ContactId <= 0 || !Contacts.TryGetValue(dto.ContactId, out var contact))
            return NotFound(new { message = "Contact not found." });

        if (string.IsNullOrWhiteSpace(dto.Text))
            return BadRequest(new { message = "Message text cannot be empty." });

        var msg = new ChatMessageDto
        {
            Id = System.Threading.Interlocked.Increment(ref _nextMessageId),
            ContactId = dto.ContactId,
            Sender = "candidate",
            Text = dto.Text.Trim(),
            Time = DateTime.Now.ToString("h:mm tt"),
            CreatedAtUtc = DateTime.UtcNow
        };

        lock (contact.Messages)
        {
            contact.Messages.Add(msg);
        }

        _liveEvents.Publish(new LiveEventDto
        {
            Type = "ChatMessageSent",
            Title = $"Message sent to {contact.Name}",
            Message = dto.Text.Length > 50 ? dto.Text[..47] + "..." : dto.Text,
            TargetRole = "Student"
        });

        return Ok(msg);
    }
}
