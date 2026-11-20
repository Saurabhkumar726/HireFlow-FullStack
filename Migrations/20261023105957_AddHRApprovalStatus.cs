using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HireFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHRApprovalStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HRApprovalStatus",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "HRDecisionAt",
                table: "AspNetUsers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HRDecisionByUserId",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);

            // Preserve existing HR account approval states.
            migrationBuilder.Sql(
                """
                UPDATE [AspNetUsers]
                SET [HRApprovalStatus] =
                    CASE
                        WHEN [IsActive] = 1 THEN N'Approved'
                        ELSE N'Pending'
                    END
                WHERE [AccountRole] = N'HR';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HRApprovalStatus",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "HRDecisionAt",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "HRDecisionByUserId",
                table: "AspNetUsers");
        }
    }
}