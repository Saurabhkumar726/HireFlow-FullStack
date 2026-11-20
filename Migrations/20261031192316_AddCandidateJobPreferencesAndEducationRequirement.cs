using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HireFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateJobPreferencesAndEducationRequirement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EducationRequirement",
                table: "Jobs",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CandidateJobPreferences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    PreferredRolesJson = table.Column<string>(type: "nvarchar(3000)", maxLength: 3000, nullable: false),
                    PreferredIndustriesJson = table.Column<string>(type: "nvarchar(2200)", maxLength: 2200, nullable: false),
                    PreferredSkillsJson = table.Column<string>(type: "nvarchar(max)", maxLength: 6000, nullable: false),
                    PreferredLocationsJson = table.Column<string>(type: "nvarchar(3000)", maxLength: 3000, nullable: false),
                    EmploymentTypesJson = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: false),
                    WorkModesJson = table.Column<string>(type: "nvarchar(750)", maxLength: 750, nullable: false),
                    ExperienceLevel = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    ExpectedSalary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    SalaryCurrency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false, defaultValue: "INR"),
                    SalaryPeriod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "Yearly"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateJobPreferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateJobPreferences_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateJobPreferences_UserId",
                table: "CandidateJobPreferences",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidateJobPreferences");

            migrationBuilder.DropColumn(
                name: "EducationRequirement",
                table: "Jobs");
        }
    }
}
