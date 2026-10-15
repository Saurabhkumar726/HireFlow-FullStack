
using Google.Apis.Auth;
using HireFlow.Api.Authentication;
using HireFlow.Api.DTOs;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly JwtService _jwtService;
        private readonly IConfiguration _configuration;
        private readonly IPasswordResetService _passwordResetService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            UserManager<ApplicationUser> userManager,
            JwtService jwtService,
            IConfiguration configuration,
            IPasswordResetService passwordResetService,
            ILogger<AuthController> logger)
        {
            _userManager = userManager;
            _jwtService = jwtService;
            _configuration = configuration;
            _passwordResetService = passwordResetService;
            _logger = logger;
        }

        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<IActionResult> Register(RegisterRequest request)
        {
            if (request.Role != "Student" && request.Role != "HR")
            {
                return BadRequest(new
                {
                    message = "Role must be Student or HR."
                });
            }

            var existingUser = await _userManager.FindByEmailAsync(request.Email);

            if (existingUser != null)
            {
                return Conflict(new
                {
                    message = "An account with this email already exists."
                });
            }

            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                FullName = request.FullName.Trim(),
                AccountRole = request.Role,
                IsActive = request.Role != "HR"
            };

            var result = await _userManager.CreateAsync(user, request.Password);

            if (!result.Succeeded)
            {
                return BadRequest(new
                {
                    errors = result.Errors.Select(e => e.Description)
                });
            }

            var message = request.Role == "HR"
                ? "Registration successful. Your HR account is pending admin approval."
                : "Registration successful. Please log in.";

            return Ok(new { message });
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login(LoginRequest request)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);

            if (user == null || !user.IsActive)
            {
                return Unauthorized(new
                {
                    message = "Invalid email or password."
                });
            }

            var passwordValid = await _userManager.CheckPasswordAsync(
                user, request.Password);

            if (!passwordValid)
            {
                return Unauthorized(new
                {
                    message = "Invalid email or password."
                });
            }

            var token = _jwtService.GenerateToken(user);

            return Ok(new
            {
                token,
                user = new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    role = user.AccountRole
                }
            });
        }

        // Step 1: Request an OTP by email.
        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword(
            [FromBody] ForgotPasswordRequest request)
        {
            try
            {
                await _passwordResetService.RequestOtpAsync(request.Email);
            }
            catch (Exception ex)
            {
                // Never expose internal errors or account existence.
                _logger.LogError(ex, "Password reset OTP request failed.");
            }

            return Ok(new
            {
                message = "If an eligible account exists for this email, " +
                          "a verification code will be sent."
            });
        }

        // Step 2: Verify the OTP and issue a temporary reset token.
        [HttpPost("verify-reset-otp")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyResetOtp(
            [FromBody] VerifyResetOtpRequest request)
        {
            var resetToken = await _passwordResetService.VerifyOtpAsync(
                request.Email,
                request.Otp);

            if (string.IsNullOrWhiteSpace(resetToken))
            {
                return BadRequest(new
                {
                    message = "Invalid or expired verification code."
                });
            }

            return Ok(new
            {
                resetToken,
                message = "Code verified. You can now reset your password."
            });
        }

        // Step 3: Reset the password using the temporary token.
        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword(
            [FromBody] ResetPasswordRequest request)
        {
            var success = await _passwordResetService.ResetPasswordAsync(
                request.ResetToken,
                request.NewPassword);

            if (!success)
            {
                return BadRequest(new
                {
                    message = "The reset session is invalid or expired, " +
                              "or the new password does not meet the requirements."
                });
            }

            return Ok(new
            {
                message = "Password reset successfully. Please log in."
            });
        }

        // Google sign-in: Google ID token -> HireFlow JWT.
        [HttpPost("google")]
        [AllowAnonymous]
        public async Task<IActionResult> GoogleLogin(
            [FromBody] GoogleLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Credential))
            {
                return BadRequest(new
                {
                    message = "Google credential is required."
                });
            }

            var clientId = _configuration[
                "Authentication:Google:ClientId"];

            if (string.IsNullOrWhiteSpace(clientId))
            {
                return StatusCode(500, new
                {
                    message = "Google authentication is not configured."
                });
            }

            GoogleJsonWebSignature.Payload payload;

            try
            {
                payload = await GoogleJsonWebSignature.ValidateAsync(
                    request.Credential,
                    new GoogleJsonWebSignature.ValidationSettings
                    {
                        Audience = new[] { clientId }
                    });
            }
            catch (InvalidJwtException)
            {
                return Unauthorized(new
                {
                    message = "The Google credential is invalid or expired."
                });
            }

            if (string.IsNullOrWhiteSpace(payload.Subject) ||
                string.IsNullOrWhiteSpace(payload.Email) ||
                payload.EmailVerified != true)
            {
                return Unauthorized(new
                {
                    message = "Google must provide a verified email address."
                });
            }

            var googleSubject = payload.Subject;
            var email = payload.Email.Trim();

            var user = await _userManager.Users
                .FirstOrDefaultAsync(u => u.GoogleSubject == googleSubject);

            if (user == null)
            {
                var existingEmailUser = await _userManager.FindByEmailAsync(email);

                if (existingEmailUser != null)
                {
                    return Conflict(new
                    {
                        message =
                            "An account with this email already exists. " +
                            "Sign in using your existing method before linking Google."
                    });
                }

                user = new ApplicationUser
                {
                    UserName = email,
                    Email = email,
                    FullName = string.IsNullOrWhiteSpace(payload.Name)
                        ? email
                        : payload.Name.Trim(),
                    GoogleSubject = googleSubject,
                    AccountRole = "Student",
                    IsActive = true,
                    EmailConfirmed = true
                };

                var createResult = await _userManager.CreateAsync(user);

                if (!createResult.Succeeded)
                {
                    return BadRequest(new
                    {
                        errors = createResult.Errors.Select(e => e.Description)
                    });
                }
            }

            if (!user.IsActive)
            {
                return Unauthorized(new
                {
                    message = "This account is inactive. Contact support."
                });
            }

            var token = _jwtService.GenerateToken(user);

            return Ok(new
            {
                token,
                user = new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    role = user.AccountRole
                }
            });
        }
    }

    public class GoogleLoginRequest
    {
        public string Credential { get; set; } = string.Empty;
    }
}
