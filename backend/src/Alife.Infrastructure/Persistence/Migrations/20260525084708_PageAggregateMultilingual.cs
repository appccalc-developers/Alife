using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PageAggregateMultilingual : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_pages_scope_owner_group_id_language_updated_utc",
                table: "pages");

            migrationBuilder.DropIndex(
                name: "ix_pages_scope_owner_group_id_slug_language",
                table: "pages");

            migrationBuilder.DropColumn(
                name: "language",
                table: "pages");

            migrationBuilder.DropColumn(
                name: "slug",
                table: "pages");

            migrationBuilder.DropColumn(
                name: "title",
                table: "pages");

            migrationBuilder.RenameColumn(
                name: "description",
                table: "pages",
                newName: "description_json");

            migrationBuilder.AddColumn<string>(
                name: "title_json",
                table: "pages",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_pages_scope_owner_group_id_updated_utc",
                table: "pages",
                columns: new[] { "scope", "owner_group_id", "updated_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_pages_scope_owner_group_id_updated_utc",
                table: "pages");

            migrationBuilder.DropColumn(
                name: "title_json",
                table: "pages");

            migrationBuilder.RenameColumn(
                name: "description_json",
                table: "pages",
                newName: "description");

            migrationBuilder.AddColumn<string>(
                name: "language",
                table: "pages",
                type: "nvarchar(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "slug",
                table: "pages",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "title",
                table: "pages",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_pages_scope_owner_group_id_language_updated_utc",
                table: "pages",
                columns: new[] { "scope", "owner_group_id", "language", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_pages_scope_owner_group_id_slug_language",
                table: "pages",
                columns: new[] { "scope", "owner_group_id", "slug", "language" },
                unique: true,
                filter: "[owner_group_id] IS NOT NULL");
        }
    }
}
