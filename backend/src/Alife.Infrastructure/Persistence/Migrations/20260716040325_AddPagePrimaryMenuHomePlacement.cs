using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPagePrimaryMenuHomePlacement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "home_placement",
                table: "page_primary_menus",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_page_primary_menus_home_placement",
                table: "page_primary_menus",
                column: "home_placement",
                unique: true,
                filter: "[home_placement] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_page_primary_menus_home_placement",
                table: "page_primary_menus");

            migrationBuilder.DropColumn(
                name: "home_placement",
                table: "page_primary_menus");
        }
    }
}
