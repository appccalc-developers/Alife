using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPagePrimaryMenuName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "primary_menu_name_json",
                table: "page_publication_reviews",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE [page_publication_reviews] " +
                "SET [primary_menu_name_json] = N'{\"en\":\"Ministries\",\"zh\":\"事工\"}' " +
                "WHERE [status] = 1 AND [primary_menu_name_json] IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "primary_menu_name_json",
                table: "page_publication_reviews");
        }
    }
}
