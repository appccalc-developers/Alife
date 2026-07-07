using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(AlifeDbContext))]
    [Migration("20260707100904_RetirePageScope")]
    public partial class RetirePageScope : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_pages_owner_group_id",
                table: "pages");

            migrationBuilder.DropIndex(
                name: "ix_pages_scope_owner_group_id_updated_utc",
                table: "pages");

            migrationBuilder.DropColumn(
                name: "scope",
                table: "pages");

            migrationBuilder.CreateIndex(
                name: "ix_pages_owner_group_id_updated_utc",
                table: "pages",
                columns: new[] { "owner_group_id", "updated_utc" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_pages_owner_group_id_updated_utc",
                table: "pages");

            migrationBuilder.AddColumn<int>(
                name: "scope",
                table: "pages",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.Sql(
                "UPDATE [pages] SET [scope] = CASE WHEN [owner_group_id] IS NULL THEN 0 ELSE 1 END");

            migrationBuilder.CreateIndex(
                name: "ix_pages_owner_group_id",
                table: "pages",
                column: "owner_group_id");

            migrationBuilder.CreateIndex(
                name: "ix_pages_scope_owner_group_id_updated_utc",
                table: "pages",
                columns: new[] { "scope", "owner_group_id", "updated_utc" });
        }
    }
}
