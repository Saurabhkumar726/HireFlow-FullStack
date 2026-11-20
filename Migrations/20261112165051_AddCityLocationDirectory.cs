using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HireFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCityLocationDirectory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CityLocations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CityName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    StateName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    NormalizedCityName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NormalizedStateName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    NormalizedDisplayName = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    LastSyncedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CityLocations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CityLocations_IsActive_NormalizedCityName",
                table: "CityLocations",
                columns: new[] { "IsActive", "NormalizedCityName" });

            migrationBuilder.CreateIndex(
                name: "IX_CityLocations_NormalizedCityName",
                table: "CityLocations",
                column: "NormalizedCityName");

            migrationBuilder.CreateIndex(
                name: "IX_CityLocations_NormalizedDisplayName",
                table: "CityLocations",
                column: "NormalizedDisplayName",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CityLocations");
        }
    }
}
