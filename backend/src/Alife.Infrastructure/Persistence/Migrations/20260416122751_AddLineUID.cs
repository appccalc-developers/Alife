using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLineUID : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "line_uid",
                table: "members",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_members_line_uid",
                table: "members",
                column: "line_uid",
                unique: true,
                filter: "[line_uid] IS NOT NULL AND [is_registered] = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_members_line_uid",
                table: "members");

            migrationBuilder.DropColumn(
                name: "line_uid",
                table: "members");
        }
    }
}
