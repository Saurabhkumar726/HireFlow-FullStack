using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HireFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddJobOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserId",
                table: "Jobs",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_CreatedByUserId",
                table: "Jobs",
                column: "CreatedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Jobs_AspNetUsers_CreatedByUserId",
                table: "Jobs",
                column: "CreatedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Jobs_AspNetUsers_CreatedByUserId",
                table: "Jobs");

            migrationBuilder.DropIndex(
                name: "IX_Jobs_CreatedByUserId",
                table: "Jobs");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Jobs");
        }
    }
}
