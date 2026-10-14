using HireFlow.Api.Authentication;
using HireFlow.Api.DTOs;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HireFlow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly JwtService _jwtService;

        public AuthController(
            UserManager<ApplicationUser> userManager,
            JwtService jwtService)
        {
            _userManager = userManager;
            _jwtService = jwtService;
        }

        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<IActionResult> Register(
            RegisterRequest request)
        {
            if (request.Role != "Student" && request.Role != "HR")
            {
                return BadRequest(new
                {
                    message = "Role must be Student or HR."
                });
            }

            var existingUser = await _userManager
                .FindByEmailAsync(request.Email);

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

            var result = await _userManager
                .CreateAsync(user, request.Password);

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
            var user = await _userManager
                .FindByEmailAsync(request.Email);

            if (user == null || !user.IsActive)
            {
                return Unauthorized(new
                {
                    message = "Invalid email or password."
                });
            }

            var passwordValid = await _userManager
                .CheckPasswordAsync(user, request.Password);

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
    }
}