using HireFlow.Api.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HireFlow.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Student")]
    public class ResumeController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IWebHostEnvironment _environment;

        private static readonly HashSet<string> AllowedExtensions =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ".pdf",
                ".doc",
                ".docx"
            };

        private const long MaxFileSize = 5 * 1024 * 1024;

        public ResumeController(
            UserManager<ApplicationUser> userManager,
            IWebHostEnvironment environment)
        {
            _userManager = userManager;
            _environment = environment;
        }

        // POST: api/Resume/upload
        [HttpPost("upload")]
        [RequestSizeLimit(10 * 1024 * 1024)]
        public async Task<IActionResult> UploadResume(
            IFormFile file,
            CancellationToken cancellationToken)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "Please select a resume file." });
            }

            if (file.Length > MaxFileSize)
            {
                return BadRequest(new { message = "Resume file size cannot exceed 5 MB." });
            }

            var extension = Path.GetExtension(file.FileName);

            if (string.IsNullOrWhiteSpace(extension) ||
                !AllowedExtensions.Contains(extension))
            {
                return BadRequest(new
                {
                    message = "Only PDF, DOC, and DOCX files are allowed."
                });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
                return NotFound(new { message = "Student account not found." });

            var uploadDirectory = Path.Combine(
                _environment.ContentRootPath,
                "Uploads",
                "Resumes");

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
                    "Resumes",
                    storedFileName)
                .Replace('\\', '/');

            var previousResumeUrl = user.ResumeUrl;
            user.ResumeUrl = relativePath;
            user.ResumeLastUpdatedAt = DateTime.UtcNow;

            var updateResult = await _userManager.UpdateAsync(user);

            if (!updateResult.Succeeded)
            {
                System.IO.File.Delete(filePath);

                return BadRequest(new
                {
                    message = "Resume was uploaded, but the profile could not be updated.",
                    errors = updateResult.Errors.Select(error => error.Description)
                });
            }

            DeleteOwnedResume(previousResumeUrl, uploadDirectory);

            return Ok(new
            {
                message = "Resume uploaded successfully.",
                resumeUrl = user.ResumeUrl,
                user.ResumeLastUpdatedAt
            });
        }

        // DELETE: api/Resume
        [HttpDelete]
        public async Task<IActionResult> DeleteResume()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
                return NotFound(new { message = "Student account not found." });

            var previousResumeUrl = user.ResumeUrl;

            if (string.IsNullOrWhiteSpace(previousResumeUrl))
            {
                return Ok(new
                {
                    message = "No resume is currently saved.",
                    resumeUrl = (string?)null,
                    user.ResumeLastUpdatedAt
                });
            }

            // Clear the profile record first, then remove the owned file.
            user.ResumeUrl = null;
            user.ResumeLastUpdatedAt = DateTime.UtcNow;
            var updateResult = await _userManager.UpdateAsync(user);

            if (!updateResult.Succeeded)
            {
                return BadRequest(new
                {
                    message = "Unable to remove the resume from your profile.",
                    errors = updateResult.Errors.Select(error => error.Description)
                });
            }

            var uploadDirectory = Path.Combine(
                _environment.ContentRootPath,
                "Uploads",
                "Resumes");

            DeleteOwnedResume(previousResumeUrl, uploadDirectory);

            return Ok(new
            {
                message = "Resume deleted successfully.",
                resumeUrl = (string?)null,
                user.ResumeLastUpdatedAt
            });
        }

        private static void DeleteOwnedResume(
            string? storedUrl,
            string uploadDirectory)
        {
            if (string.IsNullOrWhiteSpace(storedUrl))
                return;

            var normalized = storedUrl.Replace('\\', '/');
            const string expectedPrefix = "Uploads/Resumes/";
            var markerIndex = normalized.IndexOf(
                expectedPrefix,
                StringComparison.OrdinalIgnoreCase);

            if (markerIndex < 0)
                return;

            var remainder = normalized[(markerIndex + expectedPrefix.Length)..];
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
