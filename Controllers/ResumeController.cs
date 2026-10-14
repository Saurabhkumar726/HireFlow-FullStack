using HireFlow.Api.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
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
                return BadRequest(new
                {
                    message = "Please select a resume file."
                });
            }

            if (file.Length > MaxFileSize)
            {
                return BadRequest(new
                {
                    message = "Resume file size cannot exceed 5 MB."
                });
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

            var userId = User.FindFirstValue(
                ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
            {
                return NotFound(new
                {
                    message = "Student account not found."
                });
            }

            var uploadDirectory = Path.Combine(
                _environment.ContentRootPath,
                "Uploads",
                "Resumes");

            Directory.CreateDirectory(uploadDirectory);

            // Generate a server-side filename; never trust the supplied filename.
            var storedFileName =
                $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";

            var filePath = Path.Combine(
                uploadDirectory,
                storedFileName);

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

            // Store a relative path, not an absolute server path.
            var relativePath = Path.Combine(
                    "Uploads",
                    "Resumes",
                    storedFileName)
                .Replace('\\', '/');

            var previousResumeUrl = user.ResumeUrl;
            user.ResumeUrl = relativePath;

            var updateResult = await _userManager.UpdateAsync(user);

            if (!updateResult.Succeeded)
            {
                // Avoid leaving an orphaned file if the profile update fails.
                System.IO.File.Delete(filePath);

                return BadRequest(new
                {
                    message = "Resume was uploaded, but the profile could not be updated.",
                    errors = updateResult.Errors.Select(
                        error => error.Description)
                });
            }

            // Remove the previous resume only if it belongs to this upload folder.
            if (!string.IsNullOrWhiteSpace(previousResumeUrl))
            {
                var previousFileName =
                    Path.GetFileName(previousResumeUrl);

                if (!string.IsNullOrWhiteSpace(previousFileName) &&
                    previousFileName == previousResumeUrl.Replace('\\', '/')
                        .Split('/')
                        .Last())
                {
                    var previousPath = Path.Combine(
                        uploadDirectory,
                        previousFileName);

                    if (!string.Equals(
                            filePath,
                            previousPath,
                            StringComparison.OrdinalIgnoreCase) &&
                        System.IO.File.Exists(previousPath))
                    {
                        System.IO.File.Delete(previousPath);
                    }
                }
            }

            return Ok(new
            {
                message = "Resume uploaded successfully.",
                resumeUrl = user.ResumeUrl
            });
        }
    }
}