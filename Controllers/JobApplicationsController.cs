using System.Security.Claims;
using System.Text.Json;
using HireFlow.Api.Authentication;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class JobApplicationsController : ControllerBase
    {
        private static readonly string[] AllowedHrStatuses =
        {
            "Pending",
            "Under Review",
            "Shortlisted",
            "Interview Scheduled",
            "Selected",
            "Rejected"
        };

        private readonly HireFlowDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILiveEventsService _liveEvents;

        public JobApplicationsController(
            HireFlowDbContext context,
            UserManager<ApplicationUser> userManager,
            ILiveEventsService liveEvents)
        {
            _context = context;
            _userManager = userManager;
            _liveEvents = liveEvents;
        }

        private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

        // GET: api/JobApplications
        // Students receive their own applications; approved HR receives applications
        // for their own jobs. The legacy route and response fields remain compatible.
        [HttpGet]
        public async Task<IActionResult> GetApplications(CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
            if (User.IsInRole("Admin")) return Forbid();

            if (User.IsInRole("HR"))
            {
                if (!User.HasClaim("is_active", "true")) return Forbid();

                var hrApplications = await _context.JobApplications
                    .AsNoTracking()
                    .Include(application => application.Job)
                    .Include(application => application.StatusHistory)
                    .Include(application => application.Interviews)
                    .Include(application => application.ScreeningAnswers)
                    .Where(application => application.Job != null && application.Job.CreatedByUserId == userId)
                    .OrderByDescending(application => application.AppliedAt)
                    .ToListAsync(cancellationToken);

                return Ok(hrApplications.Select(application => ToResponse(application, includeRecruiterNotes: true)));
            }

            if (!User.IsInRole("Student")) return Forbid();

            var studentApplications = await _context.JobApplications
                .AsNoTracking()
                .Include(application => application.Job)
                .Include(application => application.StatusHistory)
                .Include(application => application.Interviews)
                    .Include(application => application.ScreeningAnswers)
                .Where(application => application.UserId == userId)
                .OrderByDescending(application => application.AppliedAt)
                .ToListAsync(cancellationToken);

            return Ok(studentApplications.Select(application => ToResponse(application, includeRecruiterNotes: false)));
        }

        // GET: api/JobApplications/{id}
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetApplication(int id, CancellationToken cancellationToken)
        {
            if (User.IsInRole("Admin")) return Forbid();

            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var application = await _context.JobApplications
                .AsNoTracking()
                .Include(item => item.Job)
                .Include(item => item.StatusHistory)
                .Include(item => item.Revisions)
                .Include(item => item.Interviews)
                .Include(item => item.ScreeningAnswers)
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (application == null) return NotFound();

            if (User.IsInRole("HR"))
            {
                if (!User.HasClaim("is_active", "true")) return Forbid();
                if (application.Job == null || application.Job.CreatedByUserId != userId) return NotFound();
                return Ok(ToResponse(application, includeRecruiterNotes: true, includeRevisionHistory: true));
            }

            if (!User.IsInRole("Student")) return Forbid();
            if (application.UserId != userId) return NotFound();

            return Ok(ToResponse(application, includeRecruiterNotes: false, includeRevisionHistory: true));
        }

        // POST: api/JobApplications — Student creates a new application.
        [HttpPost]
        [Authorize(Roles = "Student")]
        public async Task<IActionResult> CreateApplication(
            [FromBody] CreateJobApplicationRequest request,
            CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound(new { message = "Student account was not found." });

            var job = await _context.Jobs.FirstOrDefaultAsync(item => item.Id == request.JobId, cancellationToken);
            if (job == null) return NotFound(new { message = "This job could not be found." });

            var now = DateTime.UtcNow;
            if (!string.Equals(job.PublicationStatus, "Published", StringComparison.OrdinalIgnoreCase) ||
                !job.IsActive ||
                (job.ApplicationDeadlineUtc.HasValue && job.ApplicationDeadlineUtc.Value < now))
            {
                return Conflict(new { message = "This job is closed or its application deadline has passed." });
            }

            // These contact fields are required for every new application.
            // Trim first so whitespace-only values are rejected as empty.
            var applicantPhoneNumber = Clean(request.ApplicantPhoneNumber);
            if (string.IsNullOrWhiteSpace(applicantPhoneNumber))
            {
                return BadRequest(new { message = "Phone number is required. Add your contact number before applying." });
            }

            var applicantLocation = Clean(request.ApplicantLocation);
            if (string.IsNullOrWhiteSpace(applicantLocation))
            {
                return BadRequest(new { message = "Current location is required. Enter your city and state before applying." });
            }

            // A resume is mandatory for every application. A resume already saved
            // to the Student profile is accepted when no replacement URL is supplied.
            var effectiveResumeUrl = string.IsNullOrWhiteSpace(request.ResumeUrl)
                ? user.ResumeUrl
                : request.ResumeUrl;

            if (string.IsNullOrWhiteSpace(effectiveResumeUrl))
            {
                return BadRequest(new { message = "A resume is required. Add a resume to your profile or provide a resume URL before applying." });
            }

            if (!IsSafeResumeReference(effectiveResumeUrl))
                return BadRequest(new { message = "Enter a valid resume URL or use the resume uploaded to your HireFlow profile." });

            if (!IsSafeOptionalUrl(request.ApplicantLinkedInUrl) || !IsSafeOptionalUrl(request.ApplicantPortfolioUrl))
                return BadRequest(new { message = "LinkedIn and portfolio links must use a valid http or https URL." });

            var activeQuestions = await _context.JobScreeningQuestions
                .Where(question => question.JobId == job.Id && question.IsActive)
                .OrderBy(question => question.SortOrder)
                .ToListAsync(cancellationToken);

            var submittedAnswers = request.ScreeningAnswers ?? new List<ScreeningAnswerRequest>();
            if (submittedAnswers.Select(answer => answer.QuestionId).Distinct().Count() != submittedAnswers.Count)
                return BadRequest(new { message = "Each screening question can only be answered once." });

            var questionIds = activeQuestions.Select(question => question.Id).ToHashSet();
            if (submittedAnswers.Any(answer => !questionIds.Contains(answer.QuestionId)))
                return BadRequest(new { message = "One or more screening questions are invalid for this job." });

            foreach (var question in activeQuestions)
            {
                var answer = submittedAnswers.FirstOrDefault(item => item.QuestionId == question.Id);
                var answerText = answer?.AnswerText?.Trim() ?? string.Empty;
                if (question.IsRequired && string.IsNullOrWhiteSpace(answerText))
                    return BadRequest(new { message = $"Please answer the required question: {question.QuestionText}" });
                if (string.IsNullOrWhiteSpace(answerText)) continue;
                if (answerText.Length > 4000)
                    return BadRequest(new { message = "A screening answer exceeds the allowed length." });

                if (question.QuestionType is "SingleChoice" or "MultipleChoice")
                {
                    var options = string.IsNullOrWhiteSpace(question.OptionsJson)
                        ? new List<string>()
                        : JsonSerializer.Deserialize<List<string>>(question.OptionsJson) ?? new List<string>();
                    List<string> selected;
                    if (question.QuestionType == "MultipleChoice")
                    {
                        try
                        {
                            selected = JsonSerializer.Deserialize<List<string>>(answerText) ?? new List<string>();
                        }
                        catch (JsonException)
                        {
                            return BadRequest(new { message = $"Choose valid responses for: {question.QuestionText}" });
                        }
                    }
                    else
                    {
                        selected = new List<string> { answerText };
                    }

                    if (selected.Count == 0 || selected.Distinct(StringComparer.Ordinal).Count() != selected.Count ||
                        selected.Any(value => !options.Contains(value, StringComparer.Ordinal)))
                        return BadRequest(new { message = $"Choose a valid response for: {question.QuestionText}" });
                }
                else if (question.QuestionType == "YesNo" && answerText is not ("Yes" or "No"))
                {
                    return BadRequest(new { message = $"Choose Yes or No for: {question.QuestionText}" });
                }
            }

            // A withdrawn application remains in history. It does not block a new application.
            var activeDuplicate = await _context.JobApplications.AnyAsync(application =>
                application.JobId == request.JobId &&
                application.UserId == userId &&
                application.Status != "Withdrawn", cancellationToken);

            if (activeDuplicate)
                return Conflict(new { message = "You already have an active application for this job. You can track it from My Applications." });

            var application = new JobApplication
            {
                JobId = job.Id,
                UserId = userId,
                ApplicantName = request.ApplicantName.Trim(),
                ApplicantEmail = request.ApplicantEmail.Trim(),
                ApplicantPhoneNumber = applicantPhoneNumber,
                ApplicantLocation = applicantLocation,
                ApplicantLinkedInUrl = Clean(request.ApplicantLinkedInUrl),
                ApplicantPortfolioUrl = Clean(request.ApplicantPortfolioUrl),
                ResumeUrl = Clean(effectiveResumeUrl),
                CoverLetter = request.CoverLetter?.Trim() ?? string.Empty,
                Status = "Pending",
                AppliedAt = now,
                LastUpdatedAtUtc = now
            };

            application.StatusHistory.Add(new JobApplicationStatusHistory
            {
                PreviousStatus = null,
                NewStatus = "Pending",
                ChangedByUserId = userId,
                ChangedByRole = "Student",
                ChangedAtUtc = now
            });

            _context.JobApplications.Add(application);

            foreach (var answer in submittedAnswers.Where(item => !string.IsNullOrWhiteSpace(item.AnswerText)))
            {
                var question = activeQuestions.First(item => item.Id == answer.QuestionId);
                application.ScreeningAnswers.Add(new JobApplicationScreeningAnswer
                {
                    JobScreeningQuestionId = question.Id,
                    QuestionTextSnapshot = question.QuestionText,
                    AnswerText = answer.AnswerText.Trim(),
                    AnsweredAtUtc = now
                });
            }

            await NotificationWriter.AddInAppAsync(
                _context,
                job.CreatedByUserId,
                "ApplicationReceived",
                "New application received",
                $"{application.ApplicantName} applied for {job.Title}.",
                "/hr/applicants",
                "Job",
                job.Id,
                cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            await _context.Entry(application).Reference(item => item.Job).LoadAsync(cancellationToken);

            _liveEvents.Publish(new LiveEventDto
            {
                Type = "ApplicationReceived",
                Title = "New Candidate Application 📄",
                Message = $"{application.ApplicantName} applied for {job.Title} at {job.Company}.",
                TargetRole = "HR",
                TargetUserId = job.CreatedByUserId,
                Payload = new { applicationId = application.Id, jobTitle = job.Title, applicantName = application.ApplicantName }
            });

            return CreatedAtAction(
                nameof(GetApplication),
                new { id = application.Id },
                ToResponse(application, includeRecruiterNotes: false));
        }

        // PUT: api/JobApplications/{id} — editable only while the application is New/Pending.
        [HttpPut("{id:int}")]
        [Authorize(Roles = "Student")]
        public async Task<IActionResult> UpdateApplication(
            int id,
            [FromBody] UpdateJobApplicationRequest request,
            CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var application = await _context.JobApplications
                .Include(item => item.Job)
                .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);

            if (application == null) return NotFound();
            if (!IsNewStatus(application.Status))
                return Conflict(new { message = "This application can no longer be edited because the recruiter has started reviewing it." });

            if (application.Job?.RequireResume == true && string.IsNullOrWhiteSpace(request.ResumeUrl))
                return BadRequest(new { message = "A resume is required for this job." });

            if (!IsSafeResumeReference(request.ResumeUrl) ||
                !IsSafeOptionalUrl(request.ApplicantLinkedInUrl) ||
                !IsSafeOptionalUrl(request.ApplicantPortfolioUrl))
                return BadRequest(new { message = "Check the resume, LinkedIn, and portfolio URLs and try again." });

            var snapshot = JsonSerializer.Serialize(new
            {
                application.ApplicantName,
                application.ApplicantEmail,
                application.ApplicantPhoneNumber,
                application.ApplicantLocation,
                application.ApplicantLinkedInUrl,
                application.ApplicantPortfolioUrl,
                application.ResumeUrl,
                application.CoverLetter,
                application.RevisionNumber
            });

            var nextRevision = application.RevisionNumber + 1;
            _context.JobApplicationRevisions.Add(new JobApplicationRevision
            {
                JobApplicationId = application.Id,
                RevisionNumber = nextRevision,
                SnapshotJson = snapshot,
                ChangedByUserId = userId,
                ChangedAtUtc = DateTime.UtcNow
            });

            application.ApplicantName = request.ApplicantName.Trim();
            application.ApplicantEmail = request.ApplicantEmail.Trim();
            application.ApplicantPhoneNumber = Clean(request.ApplicantPhoneNumber);
            application.ApplicantLocation = Clean(request.ApplicantLocation);
            application.ApplicantLinkedInUrl = Clean(request.ApplicantLinkedInUrl);
            application.ApplicantPortfolioUrl = Clean(request.ApplicantPortfolioUrl);
            application.ResumeUrl = Clean(request.ResumeUrl);
            application.CoverLetter = request.CoverLetter?.Trim() ?? string.Empty;
            application.RevisionNumber = nextRevision;
            application.LastUpdatedAtUtc = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);
            return Ok(new { message = "Application details updated.", revisionNumber = application.RevisionNumber });
        }

        // POST: api/JobApplications/{id}/withdraw
        [HttpPost("{id:int}/withdraw")]
        [Authorize(Roles = "Student")]
        public async Task<IActionResult> WithdrawApplication(
            int id,
            [FromBody] WithdrawJobApplicationRequest? request,
            CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var application = await _context.JobApplications
                .Include(item => item.Job)
                .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);
            if (application == null) return NotFound();

            if (string.Equals(application.Status, "Selected", StringComparison.OrdinalIgnoreCase))
                return Conflict(new { message = "An application marked Selected cannot be withdrawn." });
            if (string.Equals(application.Status, "Withdrawn", StringComparison.OrdinalIgnoreCase))
                return Conflict(new { message = "This application has already been withdrawn." });

            var previousStatus = NormalizeStatus(application.Status);
            var reason = Clean(request?.Reason);
            var now = DateTime.UtcNow;

            application.Status = "Withdrawn";
            application.WithdrawalReason = reason;
            application.WithdrawnAtUtc = now;
            application.LastUpdatedAtUtc = now;

            _context.JobApplicationStatusHistory.Add(new JobApplicationStatusHistory
            {
                JobApplicationId = application.Id,
                PreviousStatus = previousStatus,
                NewStatus = "Withdrawn",
                Reason = reason,
                ChangedByUserId = userId,
                ChangedByRole = "Student",
                ChangedAtUtc = now
            });

            await NotificationWriter.AddInAppAsync(
                _context,
                application.Job?.CreatedByUserId,
                "ApplicationWithdrawn",
                "Candidate withdrew an application",
                $"{application.ApplicantName} withdrew their application for {application.Job?.Title ?? "your job"}.",
                "/hr/applicants",
                "Application",
                application.Id,
                cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            return Ok(new { message = "Your application has been withdrawn.", status = "Withdrawn" });
        }

        // GET: api/JobApplications/job/{jobId} — HR sees applicants for owned jobs.
        [HttpGet("job/{jobId:int}")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> GetApplicationsByJob(int jobId, CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var ownsJob = await _context.Jobs.AnyAsync(job => job.Id == jobId && job.CreatedByUserId == userId, cancellationToken);
            if (!ownsJob) return NotFound(new { message = "Job not found or you do not own this job." });

            var applications = await _context.JobApplications
                .AsNoTracking()
                .Include(application => application.Job)
                .Include(application => application.StatusHistory)
                .Include(application => application.Interviews)
                    .Include(application => application.ScreeningAnswers)
                .Where(application => application.JobId == jobId)
                .OrderByDescending(application => application.AppliedAt)
                .ToListAsync(cancellationToken);

            return Ok(applications.Select(application => ToResponse(application, includeRecruiterNotes: true)));
        }

        // Legacy route retained for current HR clients. New clients should use status-details
        // so a rejection reason can be supplied and recorded.
        [HttpPut("{id:int}/status")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> UpdateApplicationStatusLegacy(
            int id,
            [FromBody] string status,
            CancellationToken cancellationToken)
        {
            return await ApplyHrStatusAsync(id, new UpdateJobApplicationStatusRequest { Status = status }, cancellationToken);
        }

        [HttpPut("{id:int}/status-details")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> UpdateApplicationStatus(
            int id,
            [FromBody] UpdateJobApplicationStatusRequest request,
            CancellationToken cancellationToken)
        {
            return await ApplyHrStatusAsync(id, request, cancellationToken);
        }

        [HttpPut("{id:int}/notes")]
        [Authorize(Policy = "ApprovedHR")]
        public async Task<IActionResult> UpdateRecruiterNotes(
            int id,
            [FromBody] UpdateJobApplicationNotesRequest request,
            CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var application = await _context.JobApplications
                .Include(item => item.Job)
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (application == null || application.Job?.CreatedByUserId != userId) return NotFound();

            application.RecruiterNotes = Clean(request.Notes);
            application.LastUpdatedAtUtc = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
            return NoContent();
        }

        private async Task<IActionResult> ApplyHrStatusAsync(
            int id,
            UpdateJobApplicationStatusRequest request,
            CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var normalizedStatus = NormalizeRequestedHrStatus(request.Status);
            if (normalizedStatus == null)
                return BadRequest(new { message = "Choose Pending, Under Review, Shortlisted, Interview Scheduled, Selected, or Rejected." });

            var rejectionReason = Clean(request.RejectionReason);
            if (normalizedStatus == "Rejected" && string.IsNullOrWhiteSpace(rejectionReason))
                return BadRequest(new { message = "A rejection reason is required." });

            var application = await _context.JobApplications
                .Include(item => item.Job)
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (application == null || application.Job?.CreatedByUserId != userId) return NotFound();

            if (string.Equals(application.Status, "Withdrawn", StringComparison.OrdinalIgnoreCase))
                return Conflict(new { message = "A withdrawn application cannot be changed." });

            if (string.Equals(application.Status, "Selected", StringComparison.OrdinalIgnoreCase) && normalizedStatus != "Selected")
                return Conflict(new { message = "A Selected application is final and cannot be moved to another status." });

            var previousStatus = NormalizeStatus(application.Status);
            if (string.Equals(previousStatus, normalizedStatus, StringComparison.OrdinalIgnoreCase) &&
                (normalizedStatus != "Rejected" || string.Equals(application.RejectionReason, rejectionReason, StringComparison.Ordinal)))
                return NoContent();

            var now = DateTime.UtcNow;
            application.Status = normalizedStatus;
            application.RejectionReason = normalizedStatus == "Rejected" ? rejectionReason : null;
            application.LastUpdatedAtUtc = now;

            _context.JobApplicationStatusHistory.Add(new JobApplicationStatusHistory
            {
                JobApplicationId = application.Id,
                PreviousStatus = previousStatus,
                NewStatus = normalizedStatus,
                Reason = normalizedStatus == "Rejected" ? rejectionReason : null,
                ChangedByUserId = userId,
                ChangedByRole = "HR",
                ChangedAtUtc = now
            });

            var studentMessage = normalizedStatus == "Rejected" && !string.IsNullOrWhiteSpace(rejectionReason)
                ? $"Your application for {application.Job?.Title ?? "this job"} was not selected. Reason: {rejectionReason}"
                : $"Your application for {application.Job?.Title ?? "this job"} is now {normalizedStatus}.";

            await NotificationWriter.AddInAppAsync(
                _context,
                application.UserId,
                "ApplicationStatusChanged",
                normalizedStatus == "Rejected" ? "Application update" : "Application status updated",
                studentMessage,
                "/candidate/applications",
                "Application",
                application.Id,
                cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            return Ok(new { message = "Application status updated.", status = normalizedStatus });
        }

        // GET: api/JobApplications/{id}/offer
        [HttpGet("{id:int}/offer")]
        public async Task<IActionResult> GetOffer(int id, CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var application = await _context.JobApplications
                .AsNoTracking()
                .Include(item => item.Job)
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (application == null || application.Job == null) return NotFound();

            var isOwnerHr = User.IsInRole("HR") && application.Job.CreatedByUserId == userId;
            var isOwnerStudent = User.IsInRole("Student") && application.UserId == userId;

            if (!isOwnerHr && !isOwnerStudent) return Forbid();

            if (string.IsNullOrWhiteSpace(application.RecruiterNotes) || !application.RecruiterNotes.TrimStart().StartsWith("{"))
                return NotFound(new { message = "No offer letter found for this application." });

            try
            {
                using var doc = JsonDocument.Parse(application.RecruiterNotes);
                if (doc.RootElement.TryGetProperty("offer", out var offerProp) && offerProp.ValueKind == JsonValueKind.Object)
                {
                    var offer = JsonSerializer.Deserialize<OfferDetailsDto>(offerProp.GetRawText());
                    return Ok(offer);
                }
            }
            catch { }

            return NotFound(new { message = "No offer letter found for this application." });
        }

        // POST: api/JobApplications/{id}/respond-offer
        [HttpPost("{id:int}/respond-offer")]
        [Authorize(Roles = "Student")]
        public async Task<IActionResult> RespondOffer(
            int id,
            [FromBody] RespondOfferRequest request,
            CancellationToken cancellationToken)
        {
            var userId = CurrentUserId;
            if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

            var application = await _context.JobApplications
                .Include(item => item.Job)
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (application == null || application.Job == null) return NotFound();
            if (application.UserId != userId) return Forbid();

            if (string.IsNullOrWhiteSpace(application.RecruiterNotes) || !application.RecruiterNotes.TrimStart().StartsWith("{"))
                return BadRequest(new { message = "There is no pending offer letter to respond to." });

            Dictionary<string, object>? metadata = null;
            OfferDetailsDto? offer = null;
            try
            {
                metadata = JsonSerializer.Deserialize<Dictionary<string, object>>(application.RecruiterNotes);
                if (metadata != null && metadata.TryGetValue("offer", out var offerObj))
                {
                    offer = JsonSerializer.Deserialize<OfferDetailsDto>(offerObj.ToString()!);
                }
            }
            catch { }

            if (offer == null) return BadRequest(new { message = "Offer details could not be found." });

            var now = DateTime.UtcNow;
            var isAccept = string.Equals(request.Decision?.Trim(), "Accept", StringComparison.OrdinalIgnoreCase);

            offer.RespondedAtUtc = now;
            offer.CandidateDecision = isAccept ? "Accepted" : "Declined";
            offer.CandidateNote = request.CandidateNote?.Trim();
            offer.Status = isAccept ? "Accepted" : "Declined";

            metadata!["offer"] = offer;
            application.RecruiterNotes = JsonSerializer.Serialize(metadata);

            var previousStatus = application.Status;
            var nextStatus = isAccept ? "Selected" : "Rejected";
            application.Status = nextStatus;
            application.LastUpdatedAtUtc = now;

            _context.JobApplicationStatusHistory.Add(new JobApplicationStatusHistory
            {
                JobApplicationId = application.Id,
                PreviousStatus = previousStatus,
                NewStatus = nextStatus,
                Reason = isAccept
                    ? "Candidate accepted formal job offer letter."
                    : $"Candidate declined offer: {request.CandidateNote?.Trim() ?? "No reason specified"}",
                ChangedByUserId = userId,
                ChangedByRole = "Student",
                ChangedAtUtc = now
            });

            if (!string.IsNullOrWhiteSpace(application.Job.CreatedByUserId))
            {
                await NotificationWriter.AddInAppAsync(
                    _context,
                    application.Job.CreatedByUserId,
                    "OfferResponseReceived",
                    isAccept ? "Offer Accepted! 🎊" : "Offer Response: Declined",
                    $"{application.ApplicantName} has {(isAccept ? "accepted" : "declined")} the job offer for {application.Job.Title}.",
                    $"/hr/applicants/{application.Id}",
                    "Application",
                    application.Id,
                    cancellationToken);
            }

            await _context.SaveChangesAsync(cancellationToken);

            _liveEvents.Publish(new LiveEventDto
            {
                Type = isAccept ? "OfferAccepted" : "OfferDeclined",
                Title = isAccept ? "Offer Accepted! 🎊" : "Offer Response: Declined",
                Message = $"{application.ApplicantName} has {(isAccept ? "accepted" : "declined")} the job offer for {application.Job.Title}.",
                TargetRole = "HR",
                TargetUserId = application.Job.CreatedByUserId,
                Payload = new { applicationId = application.Id, decision = isAccept ? "Accepted" : "Declined", applicantName = application.ApplicantName, jobTitle = application.Job.Title }
            });

            return Ok(new { message = isAccept ? "Offer successfully accepted!" : "Offer decline recorded.", offer });
        }

        private static object ToResponse(
            JobApplication application,
            bool includeRecruiterNotes,
            bool includeRevisionHistory = false)
        {
            var job = application.Job;
            object? offerObj = null;
            object? assessmentObj = null;
            string? displayNotes = application.RecruiterNotes;

            if (!string.IsNullOrWhiteSpace(application.RecruiterNotes) && application.RecruiterNotes.TrimStart().StartsWith("{"))
            {
                try
                {
                    using var doc = JsonDocument.Parse(application.RecruiterNotes);
                    if (doc.RootElement.TryGetProperty("offer", out var offerProp) && offerProp.ValueKind == JsonValueKind.Object)
                    {
                        offerObj = JsonSerializer.Deserialize<object>(offerProp.GetRawText());
                    }
                    if (doc.RootElement.TryGetProperty("assessment", out var assessProp) && assessProp.ValueKind == JsonValueKind.Object)
                    {
                        assessmentObj = JsonSerializer.Deserialize<object>(assessProp.GetRawText());
                    }
                    if (doc.RootElement.TryGetProperty("notes", out var notesProp) && notesProp.ValueKind == JsonValueKind.String)
                    {
                        displayNotes = notesProp.GetString();
                    }
                }
                catch { /* Fallback to raw recruiter notes */ }
            }

            return new
            {
                application.Id,
                application.JobId,
                application.UserId,
                application.ApplicantName,
                application.ApplicantEmail,
                application.ApplicantPhoneNumber,
                application.ApplicantLocation,
                application.ApplicantLinkedInUrl,
                application.ApplicantPortfolioUrl,
                application.ResumeUrl,
                application.CoverLetter,
                application.Status,
                application.RejectionReason,
                application.WithdrawalReason,
                application.RevisionNumber,
                application.AppliedAt,
                application.LastUpdatedAtUtc,
                application.WithdrawnAtUtc,
                recruiterNotes = includeRecruiterNotes ? displayNotes : null,
                offer = offerObj,
                assessment = assessmentObj,
                job = job == null ? null : new
                {
                    job.Id,
                    job.Title,
                    job.Company,
                    job.Location,
                    job.JobType,
                    job.Salary,
                    job.SalaryMax,
                    job.SalaryMode,
                    job.SalaryCurrency,
                    job.SalaryPeriod,
                    job.WorkMode,
                    job.IsActive,
                    job.PublicationStatus,
                    job.ApplicationDeadlineUtc
                },
                screeningAnswers = application.ScreeningAnswers
                    .OrderBy(item => item.Id)
                    .Select(item => new
                    {
                        item.Id,
                        item.JobScreeningQuestionId,
                        item.QuestionTextSnapshot,
                        item.AnswerText,
                        item.AnsweredAtUtc
                    }),
                statusHistory = application.StatusHistory
                    .OrderBy(item => item.ChangedAtUtc)
                    .Select(item => new
                    {
                        item.Id,
                        item.PreviousStatus,
                        item.NewStatus,
                        item.Reason,
                        item.ChangedByRole,
                        item.ChangedAtUtc
                    }),
                revisions = includeRevisionHistory
                    ? application.Revisions.OrderBy(item => item.RevisionNumber).Select(item => new
                    {
                        item.RevisionNumber,
                        item.ChangedAtUtc
                    })
                    : null,
                interviews = application.Interviews
                    .OrderByDescending(item => item.ScheduledAt)
                    .Select(item => new
                    {
                        item.Id,
                        item.ScheduledAt,
                        item.InterviewType,
                        item.MeetingLink,
                        item.Notes,
                        item.Status,
                        item.CandidateResponseStatus,
                        item.CandidateResponseAtUtc,
                        item.CandidateResponseNote,
                        item.ProposedScheduledAtUtc,
                        item.CreatedAt,
                        item.UpdatedAt
                    })
            };
        }

        private static bool IsNewStatus(string? status) =>
            string.Equals(status, "Pending", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(status, "New", StringComparison.OrdinalIgnoreCase);

        private static string NormalizeStatus(string? status) =>
            string.Equals(status, "Reviewed", StringComparison.OrdinalIgnoreCase) ? "Under Review" : (status ?? "Pending");

        private static string? NormalizeRequestedHrStatus(string? status)
        {
            var value = status?.Trim();
            if (string.Equals(value, "Reviewed", StringComparison.OrdinalIgnoreCase)) value = "Under Review";
            return AllowedHrStatuses.FirstOrDefault(item => string.Equals(item, value, StringComparison.OrdinalIgnoreCase));
        }

        private static string? Clean(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static bool IsSafeResumeReference(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return true;
            var candidate = value.Trim();
            if (Uri.TryCreate(candidate, UriKind.Absolute, out var absolute))
                return absolute.Scheme == Uri.UriSchemeHttps || absolute.Scheme == Uri.UriSchemeHttp;

            var normalized = candidate.Replace('\\', '/').TrimStart('/');
            return normalized.StartsWith("Uploads/Resumes/", StringComparison.OrdinalIgnoreCase) &&
                   !normalized.Split('/').Any(segment => segment == "..");
        }

        private static bool IsSafeOptionalUrl(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return true;
            return Uri.TryCreate(value.Trim(), UriKind.Absolute, out var absolute) &&
                   (absolute.Scheme == Uri.UriSchemeHttps || absolute.Scheme == Uri.UriSchemeHttp);
        }
    }
}
