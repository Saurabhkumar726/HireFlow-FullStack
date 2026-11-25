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

            var uploadRootDirectory = Path.Combine(
                _environment.ContentRootPath,
                "Uploads",
                "Resumes");

            Directory.CreateDirectory(uploadRootDirectory);

            // Keep each upload in its own unpredictable folder so two users with
            // the same name (or repeated uploads) never overwrite one another.
            // The actual file name remains readable in the URL and in the UI.
            var uploadVersionDirectory = Path.Combine(
                uploadRootDirectory,
                Guid.NewGuid().ToString("N"));

            Directory.CreateDirectory(uploadVersionDirectory);

            var storedFileName = BuildResumeFileName(user.FullName, extension);
            var filePath = Path.Combine(uploadVersionDirectory, storedFileName);

            try
            {
                await using var stream = new FileStream(
                    filePath,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.None,
                    81920,
                    useAsync: true);

                await file.CopyToAsync(stream, cancellationToken);
            }
            catch
            {
                if (System.IO.File.Exists(filePath))
                    System.IO.File.Delete(filePath);

                DeleteEmptyDirectoryTree(uploadVersionDirectory, uploadRootDirectory);
                throw;
            }

            var relativePath = Path.Combine(
                    "Uploads",
                    "Resumes",
                    Path.GetFileName(uploadVersionDirectory),
                    storedFileName)
                .Replace('\\', '/');

            var previousResumeUrl = user.ResumeUrl;
            user.ResumeUrl = relativePath;
            user.ResumeLastUpdatedAt = DateTime.UtcNow;

            var updateResult = await _userManager.UpdateAsync(user);

            if (!updateResult.Succeeded)
            {
                if (System.IO.File.Exists(filePath))
                    System.IO.File.Delete(filePath);

                DeleteEmptyDirectoryTree(uploadVersionDirectory, uploadRootDirectory);

                return BadRequest(new
                {
                    message = "Resume was uploaded, but the profile could not be updated.",
                    errors = updateResult.Errors.Select(error => error.Description)
                });
            }

            // Delete the previous resume only after the database points to the new file.
            DeleteOwnedResume(previousResumeUrl, uploadRootDirectory);

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

            var uploadRootDirectory = Path.Combine(
                _environment.ContentRootPath,
                "Uploads",
                "Resumes");

            DeleteOwnedResume(previousResumeUrl, uploadRootDirectory);

            return Ok(new
            {
                message = "Resume deleted successfully.",
                resumeUrl = (string?)null,
                user.ResumeLastUpdatedAt
            });
        }

        private static string BuildResumeFileName(string? fullName, string extension)
        {
            var nameParts = (fullName ?? string.Empty)
                .Trim()
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Select(part => new string(
                    part.Where(char.IsLetterOrDigit).ToArray()))
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Take(8);

            var safeName = string.Join("_", nameParts);

            if (string.IsNullOrWhiteSpace(safeName))
                safeName = "Candidate";

            if (safeName.Length > 80)
                safeName = safeName[..80].Trim('_');

            return $"{safeName}_Resume{extension.ToLowerInvariant()}";
        }

        private static void DeleteOwnedResume(
            string? storedUrl,
            string uploadRootDirectory)
        {
            if (string.IsNullOrWhiteSpace(storedUrl))
                return;

            var normalized = storedUrl.Replace('\\', '/').TrimStart('/');
            const string expectedPrefix = "Uploads/Resumes/";
            var markerIndex = normalized.IndexOf(
                expectedPrefix,
                StringComparison.OrdinalIgnoreCase);

            if (markerIndex < 0)
                return;

            var relativePath = normalized[(markerIndex + expectedPrefix.Length)..];
            var segments = relativePath.Split('/');

            if (segments.Length == 0 ||
                segments.Any(segment =>
                    string.IsNullOrWhiteSpace(segment) ||
                    segment is "." or ".." ||
                    segment.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0))
            {
                return;
            }

            var root = Path.GetFullPath(uploadRootDirectory);
            var rootPrefix = Path.TrimEndingDirectorySeparator(root) + Path.DirectorySeparatorChar;
            var fullPath = Path.GetFullPath(Path.Combine(
                root,
                Path.Combine(segments)));

            // Ensure the resolved file remains inside Uploads/Resumes.
            if (!fullPath.StartsWith(
                    rootPrefix,
                    StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (System.IO.File.Exists(fullPath))
                System.IO.File.Delete(fullPath);

            var containingDirectory = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrWhiteSpace(containingDirectory))
                DeleteEmptyDirectoryTree(containingDirectory, root);
        }

        private static void DeleteEmptyDirectoryTree(
            string directoryPath,
            string uploadRootDirectory)
        {
            var root = Path.GetFullPath(uploadRootDirectory);
            var rootPrefix = Path.TrimEndingDirectorySeparator(root) + Path.DirectorySeparatorChar;
            var currentDirectory = Path.GetFullPath(directoryPath);

            while (currentDirectory.StartsWith(
                       rootPrefix,
                       StringComparison.OrdinalIgnoreCase) &&
                   Directory.Exists(currentDirectory))
            {
                if (Directory.EnumerateFileSystemEntries(currentDirectory).Any())
                    break;

                Directory.Delete(currentDirectory);
                currentDirectory = Path.GetDirectoryName(currentDirectory) ?? string.Empty;
            }
        }
    }
}
