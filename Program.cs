using System.Text;
using HireFlow.Api.Authentication;
using HireFlow.Api.Data;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Swagger with JWT Bearer authentication
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer",
        new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "Paste your JWT access token here."
        });

    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});

// CORS for React/Vite frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowHireFlowFrontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// SQL Server database
builder.Services.AddDbContext<HireFlowDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

// ASP.NET Core Identity
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.User.RequireUniqueEmail = true;

        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireNonAlphanumeric = false;

        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan =
            TimeSpan.FromMinutes(15);
    })
    .AddEntityFrameworkStores<HireFlowDbContext>()
    .AddDefaultTokenProviders();

// JWT configuration
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException(
        "JWT secret is not configured.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException(
        "JWT issuer is not configured.");
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException(
        "JWT audience is not configured.");

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme =
            JwtBearerDefaults.AuthenticationScheme;

        options.DefaultChallengeScheme =
            JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,

                ValidateAudience = true,
                ValidAudience = jwtAudience,

                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),

                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(jwtSecret))
            };
    });

builder.Services.AddScoped<JwtService>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ApprovedHR", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole("HR");
        policy.RequireAssertion(context =>
            context.User.HasClaim("is_active", "true"));
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;

    var userManager =
        services.GetRequiredService<UserManager<ApplicationUser>>();

    var configuration =
        services.GetRequiredService<IConfiguration>();

    var adminEmail = configuration["Admin:Email"];
    var adminPassword = configuration["Admin:Password"];

    if (string.IsNullOrWhiteSpace(adminEmail) ||
        string.IsNullOrWhiteSpace(adminPassword))
    {
        throw new InvalidOperationException(
            "Admin credentials are missing from User Secrets.");
    }

    var admin = await userManager.FindByEmailAsync(adminEmail);

    if (admin == null)
    {
        admin = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            EmailConfirmed = true,
            FullName = "HireFlow Admin",
            AccountRole = "Admin",
            IsActive = true
        };

        var result = await userManager.CreateAsync(admin, adminPassword);

        if (!result.Succeeded)
        {
            var errors = string.Join(
                "; ",
                result.Errors.Select(error => error.Description));

            throw new InvalidOperationException(
                $"Failed to create the initial Admin account: {errors}");
        }
    }
    else if (admin.AccountRole != "Admin")
    {
        throw new InvalidOperationException(
            "The configured Admin email already belongs to a non-Admin account.");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowHireFlowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();