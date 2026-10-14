using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HireFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddJobApplicationUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "JobApplications",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_JobApplications_UserId",
                table: "JobApplications",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_JobApplications_AspNetUsers_UserId",
                table: "JobApplications",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_JobApplications_AspNetUsers_UserId",
                table: "JobApplications");

            migrationBuilder.DropIndex(
                name: "IX_JobApplications_UserId",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "JobApplications");
        }
    }
}
