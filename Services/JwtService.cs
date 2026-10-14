
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HireFlow.Api.Authentication;
using Microsoft.IdentityModel.Tokens;

namespace HireFlow.Api.Services
{
    public class JwtService
    {
        private readonly IConfiguration _configuration;

        public JwtService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string GenerateToken(ApplicationUser user)
        {
            var secret = _configuration["Jwt:Secret"]
                ?? throw new InvalidOperationException(
                    "JWT secret is not configured.");

            var issuer = _configuration["Jwt:Issuer"]
                ?? throw new InvalidOperationException(
                    "JWT issuer is not configured.");

            var audience = _configuration["Jwt:Audience"]
                ?? throw new InvalidOperationException(
                    "JWT audience is not configured.");

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(secret));

            var credentials = new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(
                    ClaimTypes.NameIdentifier,
                    user.Id),

                new Claim(
                    ClaimTypes.Name,
                    user.FullName ?? string.Empty),

                new Claim(
                    ClaimTypes.Email,
                    user.Email ?? string.Empty),

                new Claim(
                    ClaimTypes.Role,
                    user.AccountRole),

                new Claim(
                    "is_active",
                    user.IsActive ? "true" : "false")
            };

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler()
                .WriteToken(token);
        }
    }
}
