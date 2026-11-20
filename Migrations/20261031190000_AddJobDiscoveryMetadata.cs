using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HireFlow.Api.Migrations
{
    public partial class AddJobDiscoveryMetadata : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApplicationDeadlineUtc",
                table: "Jobs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Benefits",
                table: "Jobs",
                type: "nvarchar(3000)",
                maxLength: 3000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Jobs",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExperienceLevel",
                table: "Jobs",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Jobs",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsFeatured",
                table: "Jobs",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "MaximumExperienceYears",
                table: "Jobs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MinimumExperienceYears",
                table: "Jobs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublicationStatus",
                table: "Jobs",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Published");

            migrationBuilder.AddColumn<string>(
                name: "Requirements",
                table: "Jobs",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Responsibilities",
                table: "Jobs",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SalaryMax",
                table: "Jobs",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SalaryCurrency",
                table: "Jobs",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "INR");

            migrationBuilder.AddColumn<string>(
                name: "SalaryMode",
                table: "Jobs",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Range");

            migrationBuilder.AddColumn<string>(
                name: "SalaryPeriod",
                table: "Jobs",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Monthly");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Jobs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WorkMode",
                table: "Jobs",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Not specified");

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_IsFeatured_PublicationStatus_IsActive",
                table: "Jobs",
                columns: new[] { "IsFeatured", "PublicationStatus", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_PublicationStatus_IsActive_ApplicationDeadlineUtc_CreatedAt",
                table: "Jobs",
                columns: new[] { "PublicationStatus", "IsActive", "ApplicationDeadlineUtc", "CreatedAt" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Jobs_IsFeatured_PublicationStatus_IsActive",
                table: "Jobs");

            migrationBuilder.DropIndex(
                name: "IX_Jobs_PublicationStatus_IsActive_ApplicationDeadlineUtc_CreatedAt",
                table: "Jobs");

            migrationBuilder.DropColumn(name: "ApplicationDeadlineUtc", table: "Jobs");
            migrationBuilder.DropColumn(name: "Benefits", table: "Jobs");
            migrationBuilder.DropColumn(name: "Category", table: "Jobs");
            migrationBuilder.DropColumn(name: "ExperienceLevel", table: "Jobs");
            migrationBuilder.DropColumn(name: "IsActive", table: "Jobs");
            migrationBuilder.DropColumn(name: "IsFeatured", table: "Jobs");
            migrationBuilder.DropColumn(name: "MaximumExperienceYears", table: "Jobs");
            migrationBuilder.DropColumn(name: "MinimumExperienceYears", table: "Jobs");
            migrationBuilder.DropColumn(name: "PublicationStatus", table: "Jobs");
            migrationBuilder.DropColumn(name: "Requirements", table: "Jobs");
            migrationBuilder.DropColumn(name: "Responsibilities", table: "Jobs");
            migrationBuilder.DropColumn(name: "SalaryMax", table: "Jobs");
            migrationBuilder.DropColumn(name: "SalaryCurrency", table: "Jobs");
            migrationBuilder.DropColumn(name: "SalaryMode", table: "Jobs");
            migrationBuilder.DropColumn(name: "SalaryPeriod", table: "Jobs");
            migrationBuilder.DropColumn(name: "UpdatedAt", table: "Jobs");
            migrationBuilder.DropColumn(name: "WorkMode", table: "Jobs");
        }
    }
}
