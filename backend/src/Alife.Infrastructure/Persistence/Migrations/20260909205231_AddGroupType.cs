using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "group_type",
                table: "groups",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "group_type",
                table: "groups");
        }
    }
}
