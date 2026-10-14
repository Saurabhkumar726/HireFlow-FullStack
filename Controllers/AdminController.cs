using HireFlow.Api.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HireFlow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;

        public AdminController(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        // Get all HR accounts awaiting approval
        [HttpGet("pending-hr")]
        public async Task<IActionResult> GetPendingHR()
        {
            var users = _userManager.Users
                .Where(user => user.AccountRole == "HR" && !user.IsActive)
                .ToList();

            var pendingHR = users
                .Select(user => new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.CreatedAt
                });

            return Ok(pendingHR);
        }

        // Approve an HR account
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

            if (user.IsActive)
            {
                return BadRequest(new
                {
                    message = "This HR account is already active."
                });
            }

            user.IsActive = true;

            var result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
            {
                return BadRequest(new
                {
                    errors = result.Errors.Select(error => error.Description)
                });
            }

            return Ok(new
            {
                message = "HR account approved successfully."
            });
        }

        // Reject an HR account
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

            if (user.IsActive)
            {
                return BadRequest(new
                {
                    message = "An active HR account cannot be rejected."
                });
            }

            var result = await _userManager.DeleteAsync(user);

            if (!result.Succeeded)
            {
                return BadRequest(new
                {
                    errors = result.Errors.Select(error => error.Description)
                });
            }

            return Ok(new
            {
                message = "HR registration rejected."
            });
        }
    }
}