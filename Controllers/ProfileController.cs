using HireFlow.Api.Authentication;
using HireFlow.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HireFlow.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Student,HR")]
    public class ProfileController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IWebHostEnvironment _environment;

        private static readonly HashSet<string> AllowedExtensions =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ".jpg",
                ".jpeg",
                ".png",
                ".webp"
            };

        private const long MaxPictureSize = 2 * 1024 * 1024;

        public ProfileController(
            UserManager<ApplicationUser> userManager,
            IWebHostEnvironment environment)
        {
            _userManager = userManager;
            _environment = environment;
        }

        // GET: api/Profile
        [HttpGet]
        public async Task<IActionResult> GetProfile()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
            {
                return NotFound(new { message = "User profile not found." });
            }

            return Ok(new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.PhoneNumber,
                user.ProfilePictureUrl,
                user.ResumeUrl,
                user.CreatedAt,
                user.ProfileLastUpdatedAt,
                user.ResumeLastUpdatedAt
            });
        }

        // PUT: api/Profile
        [HttpPut]
        public async Task<IActionResult> UpdateProfile(
            [FromBody] UpdateProfileRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
            {
                return NotFound(new { message = "User profile not found." });
            }

            user.FullName = request.FullName.Trim();
            user.PhoneNumber = request.PhoneNumber?.Trim();
            user.ProfileLastUpdatedAt = DateTime.UtcNow;

            var result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
            {
                return BadRequest(new
                {
                    message = "Unable to update profile.",
                    errors = result.Errors.Select(error => error.Description)
                });
            }

            return Ok(new
            {
                message = "Profile updated successfully.",
                user.FullName,
                user.Email,
                user.PhoneNumber,
                user.ProfilePictureUrl,
                user.ResumeUrl,
                user.ProfileLastUpdatedAt,
                user.ResumeLastUpdatedAt
            });
        }

        // POST: api/Profile/upload-picture
        [HttpPost("upload-picture")]
        [RequestSizeLimit(10 * 1024 * 1024)]
        public async Task<IActionResult> UploadPicture(
            IFormFile file,
            CancellationToken cancellationToken)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "Please select a profile picture." });
            }

            if (file.Length > MaxPictureSize)
            {
                return BadRequest(new { message = "Profile picture cannot exceed 2 MB." });
            }

            var extension = Path.GetExtension(file.FileName);

            if (string.IsNullOrWhiteSpace(extension) ||
                !AllowedExtensions.Contains(extension))
            {
                return BadRequest(new
                {
                    message = "Only JPG, JPEG, PNG, and WebP images are allowed."
                });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
            {
                return NotFound(new { message = "Account not found." });
            }

            var uploadDirectory = Path.Combine(
                _environment.ContentRootPath,
                "Uploads",
                "ProfilePictures");

            Directory.CreateDirectory(uploadDirectory);

            var storedFileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
            var filePath = Path.Combine(uploadDirectory, storedFileName);

            await using (var stream = new FileStream(
                filePath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                81920,
                useAsync: true))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            var relativePath = Path.Combine(
                    "Uploads",
                    "ProfilePictures",
                    storedFileName)
                .Replace('\\', '/');

            var previousPictureUrl = user.ProfilePictureUrl;
            user.ProfilePictureUrl = relativePath;
            user.ProfileLastUpdatedAt = DateTime.UtcNow;

            var updateResult = await _userManager.UpdateAsync(user);

            if (!updateResult.Succeeded)
            {
                System.IO.File.Delete(filePath);

                return BadRequest(new
                {
                    message = "Picture was uploaded, but the profile could not be updated.",
                    errors = updateResult.Errors.Select(error => error.Description)
                });
            }

            DeleteOwnedUpload(previousPictureUrl, uploadDirectory, "Uploads/ProfilePictures/");

            return Ok(new
            {
                message = "Profile picture uploaded successfully.",
                profilePictureUrl = user.ProfilePictureUrl,
                user.ProfileLastUpdatedAt,
                user.ResumeLastUpdatedAt
            });
        }

        // DELETE: api/Profile/picture
        [HttpDelete("picture")]
        public async Task<IActionResult> DeletePicture()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
                return NotFound(new { message = "Account not found." });

            var previousPictureUrl = user.ProfilePictureUrl;

            if (string.IsNullOrWhiteSpace(previousPictureUrl))
            {
                return Ok(new
                {
                    message = "No profile picture is currently saved.",
                    profilePictureUrl = (string?)null
                });
            }

            // Clear the database first so the UI and profile record remain consistent.
            user.ProfilePictureUrl = null;
            user.ProfileLastUpdatedAt = DateTime.UtcNow;
            var updateResult = await _userManager.UpdateAsync(user);

            if (!updateResult.Succeeded)
            {
                return BadRequest(new
                {
                    message = "Unable to remove the profile picture from your profile.",
                    errors = updateResult.Errors.Select(error => error.Description)
                });
            }

            var uploadDirectory = Path.Combine(
                _environment.ContentRootPath,
                "Uploads",
                "ProfilePictures");

            DeleteOwnedUpload(previousPictureUrl, uploadDirectory, "Uploads/ProfilePictures/");

            return Ok(new
            {
                message = "Profile picture deleted successfully.",
                profilePictureUrl = (string?)null,
                user.ProfileLastUpdatedAt,
                user.ResumeLastUpdatedAt
            });
        }

        private static void DeleteOwnedUpload(
            string? storedUrl,
            string uploadDirectory,
            string expectedRelativePrefix)
        {
            if (string.IsNullOrWhiteSpace(storedUrl))
                return;

            // Only delete files whose stored relative URL belongs to this upload folder.
            var normalized = storedUrl.Replace('\\', '/');
            var markerIndex = normalized.IndexOf(
                expectedRelativePrefix,
                StringComparison.OrdinalIgnoreCase);

            if (markerIndex < 0)
                return;

            var remainder = normalized[(markerIndex + expectedRelativePrefix.Length)..];
            var fileName = Path.GetFileName(remainder);

            if (string.IsNullOrWhiteSpace(fileName) ||
                fileName != remainder ||
                fileName is "." or "..")
                return;

            var root = Path.GetFullPath(uploadDirectory);
            var fullPath = Path.GetFullPath(Path.Combine(root, fileName));

            if (!fullPath.StartsWith(
                    root + Path.DirectorySeparatorChar,
                    StringComparison.OrdinalIgnoreCase))
                return;

            if (System.IO.File.Exists(fullPath))
                System.IO.File.Delete(fullPath);
        }
    }
}
