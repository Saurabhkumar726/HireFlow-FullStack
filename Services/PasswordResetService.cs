
using System.Security.Cryptography;
using System.Text;
using HireFlow.Api.Authentication;
using HireFlow.Api.Data;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Services
{
    public interface IPasswordResetService
    {
        Task RequestOtpAsync(string email);

        Task<string?> VerifyOtpAsync(string email, string otp);

        Task<bool> ResetPasswordAsync(
            string resetToken,
            string newPassword);
    }

    public class PasswordResetService : IPasswordResetService
    {
        private readonly HireFlowDbContext _db;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IPasswordHasher<ApplicationUser> _passwordHasher;
        private readonly IEmailService _emailService;
        private readonly ILogger<PasswordResetService> _logger;

        public PasswordResetService(
            HireFlowDbContext db,
            UserManager<ApplicationUser> userManager,
            IPasswordHasher<ApplicationUser> passwordHasher,
            IEmailService emailService,
            ILogger<PasswordResetService> logger)
        {
            _db = db;
            _userManager = userManager;
            _passwordHasher = passwordHasher;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task RequestOtpAsync(string email)
        {
            var user = await _userManager.FindByEmailAsync(email.Trim());

            // Do not create password-reset flows for Google-only accounts.
            // They can continue signing in with Google.
            if (user == null || string.IsNullOrWhiteSpace(user.Email))
                return;

            var now = DateTime.UtcNow;

            // Allow at most one request per minute and five per hour.
            var recentRequests = await _db.PasswordResetOtps
                .Where(x => x.UserId == user.Id &&
                            x.CreatedAt >= now.AddHours(-1))
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            if (recentRequests.Count > 0 &&
                recentRequests[0].CreatedAt > now.AddMinutes(-1))
                return;

            if (recentRequests.Count >= 5)
                return;

            // Invalidate earlier unused reset requests.
            var oldRequests = await _db.PasswordResetOtps
                .Where(x => x.UserId == user.Id && x.UsedAt == null)
                .ToListAsync();

            foreach (var oldRequest in oldRequests)
                oldRequest.UsedAt = now;

            var otp = RandomNumberGenerator
                .GetInt32(0, 1_000_000)
                .ToString("D6");

            var resetRequest = new PasswordResetOtp
            {
                UserId = user.Id,
                OtpHash = _passwordHasher.HashPassword(user, otp),
                CreatedAt = now,
                ExpiresAt = now.AddMinutes(10),
                FailedAttempts = 0
            };

            _db.PasswordResetOtps.Add(resetRequest);
            await _db.SaveChangesAsync();

            try
            {
                await _emailService.SendPasswordResetOtpAsync(
                    user.Email!,
                    otp);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to send a password-reset email.");

                _db.PasswordResetOtps.Remove(resetRequest);
                await _db.SaveChangesAsync();

                throw;
            }
        }

        public async Task<string?> VerifyOtpAsync(
            string email,
            string otp)
        {
            var user = await _userManager.FindByEmailAsync(email.Trim());

            if (user == null || string.IsNullOrWhiteSpace(user.Email))
                return null;


            var now = DateTime.UtcNow;

            var request = await _db.PasswordResetOtps
                .Where(x => x.UserId == user.Id &&
                            x.UsedAt == null &&
                            x.VerifiedAt == null)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync();

            if (request == null ||
                request.ExpiresAt <= now ||
                request.FailedAttempts >= 5)
                return null;

            var verification = _passwordHasher.VerifyHashedPassword(
                user,
                request.OtpHash,
                otp);

            if (verification == PasswordVerificationResult.Failed)
            {
                request.FailedAttempts++;
                await _db.SaveChangesAsync();
                return null;
            }

            request.VerifiedAt = now;

            // Generate a cryptographically random, one-time reset token.
            var resetToken = Convert.ToBase64String(
                    RandomNumberGenerator.GetBytes(32))
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');

            request.ResetTokenHash = HashToken(resetToken);
            request.ResetTokenExpiresAt = now.AddMinutes(10);

            await _db.SaveChangesAsync();

            return resetToken;
        }

        public async Task<bool> ResetPasswordAsync(
            string resetToken,
            string newPassword)
        {
            if (string.IsNullOrWhiteSpace(resetToken) ||
                string.IsNullOrWhiteSpace(newPassword))
                return false;

            var tokenHash = HashToken(resetToken);
            var now = DateTime.UtcNow;

            var request = await _db.PasswordResetOtps
                .FirstOrDefaultAsync(x =>
                    x.ResetTokenHash == tokenHash &&
                    x.VerifiedAt != null &&
                    x.UsedAt == null &&
                    x.ResetTokenExpiresAt > now);

            if (request == null)
                return false;

            var user = await _userManager.FindByIdAsync(request.UserId);

            if (user == null)
                return false;

            // Validate the existing ASP.NET Identity password policy.
            var passwordValidation = await _userManager
                .PasswordValidators
                .First()
                .ValidateAsync(_userManager, user, newPassword);

            if (!passwordValidation.Succeeded)
                throw new InvalidOperationException(
                    string.Join(
                        " ",
                        passwordValidation.Errors.Select(e => e.Description)));

            IdentityResult result;

            if (user.PasswordHash == null)
            {
                // Allows setting an initial password only when a valid
                // reset request exists. Google-only accounts are not
                // issued reset OTPs by RequestOtpAsync.
                result = await _userManager.AddPasswordAsync(
                    user,
                    newPassword);
            }
            else
            {
                var identityToken = await _userManager
                    .GeneratePasswordResetTokenAsync(user);

                result = await _userManager.ResetPasswordAsync(
                    user,
                    identityToken,
                    newPassword);
            }

            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    string.Join(
                        " ",
                        result.Errors.Select(e => e.Description)));
            }

            request.UsedAt = now;
            request.ResetTokenHash = null;
            request.ResetTokenExpiresAt = null;

            await _db.SaveChangesAsync();

            // Invalidate other outstanding reset requests for this user.
            var otherRequests = await _db.PasswordResetOtps
                .Where(x => x.UserId == user.Id &&
                            x.Id != request.Id &&
                            x.UsedAt == null)
                .ToListAsync();

            foreach (var other in otherRequests)
                other.UsedAt = now;

            await _db.SaveChangesAsync();

            return true;
        }

        private static string HashToken(string token)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            return Convert.ToHexString(bytes);
        }
    }
}
