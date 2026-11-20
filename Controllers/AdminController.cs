using HireFlow.Api.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using HireFlow.Api.Services;

namespace HireFlow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AdminController> _logger;

        public AdminController(
            UserManager<ApplicationUser> userManager,
            IEmailService emailService,
            IConfiguration configuration,
            ILogger<AdminController> logger)
        {
            _userManager = userManager;
            _emailService = emailService;
            _configuration = configuration;
            _logger = logger;
        }

        // Get HR accounts awaiting approval.
        [HttpGet("pending-hr")]
        public async Task<IActionResult> GetPendingHR()
        {
            var users = await _userManager.Users
                .Where(user =>
                    user.AccountRole == "HR" &&
                    !user.IsActive &&
                    user.HRApprovalStatus == "Pending")
                .Select(user => new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.CreatedAt
                })
                .ToListAsync();

            return Ok(users);
        }

        // Approve a pending HR account.
        [HttpPost("hr/{id}/approve")]
        public async Task<IActionResult> ApproveHR(string id)
        {
            var user = await _userManager.FindByIdAsync(id);

            if (user == null || user.AccountRole != "HR")
            {
                return NotFound(new
                {
                    message = "HR account not found."
                });
            }

            if (user.HRApprovalStatus != "Pending" || user.IsActive)
            {
                return BadRequest(new
                {
                    message = "Only pending HR accounts can be approved."
                });
            }

            var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(adminId))
            {
                return Unauthorized(new
                {
                    message = "Unable to identify the administrator."
                });
            }

            user.HRApprovalStatus = "Approved";
            user.IsActive = true;
            user.HRDecisionAt = DateTime.UtcNow;
            user.HRDecisionByUserId = adminId;

            var result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
            {
                return BadRequest(new
                {
                    errors = result.Errors.Select(error => error.Description)
                });
            }

            // Send after the database update; SMTP failures must not reverse approval.
            if (!string.IsNullOrWhiteSpace(user.Email))
            {
                try
                {
                    await _emailService.SendHRApprovalAsync(user.Email, user.FullName);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "HR account {UserId} was approved, but the approval email failed.", user.Id);
                }
            }

            return Ok(new
            {
                message = "HR account approved successfully."
            });
        }

        // Reject a pending HR account without deleting its registration.
        [HttpPost("hr/{id}/reject")]
        public async Task<IActionResult> RejectHR(string id)
        {
            var user = await _userManager.FindByIdAsync(id);

            if (user == null || user.AccountRole != "HR")
            {
                return NotFound(new
                {
                    message = "HR account not found."
                });
            }

            if (user.HRApprovalStatus != "Pending" || user.IsActive)
            {
                return BadRequest(new
                {
                    message = "Only pending HR accounts can be rejected."
                });
            }

            var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(adminId))
            {
                return Unauthorized(new
                {
                    message = "Unable to identify the administrator."
                });
            }

            user.HRApprovalStatus = "Rejected";
            user.IsActive = false;
            user.HRDecisionAt = DateTime.UtcNow;
            user.HRDecisionByUserId = adminId;

            var result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
            {
                return BadRequest(new
                {
                    errors = result.Errors.Select(error => error.Description)
                });
            }

            // Phase 1 sends a courteous default explanation. Persisted rejection reasons
            // will be added with the HR lifecycle/resubmission phase.
            if (!string.IsNullOrWhiteSpace(user.Email))
            {
                try
                {
                    await _emailService.SendHRRejectionAsync(user.Email, user.FullName, null);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "HR account {UserId} was rejected, but the rejection email failed.", user.Id);
                }
            }

            return Ok(new
            {
                message = "HR registration rejected. The registration record has been retained."
            });
        }
    }
}