using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AlifeDbContext))]
    [Migration("20260527000000_GroupMultilingual")]
    public partial class GroupMultilingual : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "description_json",
                table: "groups",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "name_json",
                table: "groups",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.Sql("""
                UPDATE [groups]
                SET [name_json] = (
                    SELECT [groups].[name] AS [en], [groups].[name] AS [cn]
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                )
                """);

            migrationBuilder.DropColumn(
                name: "name",
                table: "groups");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "name",
                table: "groups",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE [groups]
                SET [name] = COALESCE(JSON_VALUE([name_json], '$.en'), JSON_VALUE([name_json], '$.cn'), '')
                """);

            migrationBuilder.DropColumn(
                name: "description_json",
                table: "groups");

            migrationBuilder.DropColumn(
                name: "name_json",
                table: "groups");
        }
    }
}
