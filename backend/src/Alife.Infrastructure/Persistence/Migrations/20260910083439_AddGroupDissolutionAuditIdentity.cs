using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupDissolutionAuditIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_dissolved",
                table: "groups",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM [groups] WHERE [is_dissolved] = 1) THROW 51000, 'Retained dissolution audit identities must be handled before rollback.', 1;");
            migrationBuilder.DropColumn(
                name: "is_dissolved",
                table: "groups");
        }
    }
}
