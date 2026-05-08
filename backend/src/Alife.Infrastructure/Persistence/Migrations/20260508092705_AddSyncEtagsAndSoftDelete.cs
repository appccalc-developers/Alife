using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSyncEtagsAndSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_groups_parent_group_id",
                table: "groups");

            migrationBuilder.DropIndex(
                name: "ix_group_memberships_member_id",
                table: "group_memberships");

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "sermons",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "updated_utc",
                table: "sermons",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "sections",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "pages",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "updated_utc",
                table: "members",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.Sql("UPDATE [sermons] SET [updated_utc] = [synced_utc]");
            migrationBuilder.Sql("UPDATE [members] SET [updated_utc] = [created_utc]");

            migrationBuilder.CreateIndex(
                name: "ix_sermons_updated_utc",
                table: "sermons",
                column: "updated_utc");

            migrationBuilder.CreateIndex(
                name: "ix_pages_scope_owner_group_id_language_updated_utc",
                table: "pages",
                columns: new[] { "scope", "owner_group_id", "language", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_members_updated_utc",
                table: "members",
                column: "updated_utc");

            migrationBuilder.CreateIndex(
                name: "ix_groups_parent_group_id_updated_utc",
                table: "groups",
                columns: new[] { "parent_group_id", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_group_memberships_group_id_updated_utc",
                table: "group_memberships",
                columns: new[] { "group_id", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_group_memberships_member_id_updated_utc",
                table: "group_memberships",
                columns: new[] { "member_id", "updated_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_sermons_updated_utc",
                table: "sermons");

            migrationBuilder.DropIndex(
                name: "ix_pages_scope_owner_group_id_language_updated_utc",
                table: "pages");

            migrationBuilder.DropIndex(
                name: "ix_members_updated_utc",
                table: "members");

            migrationBuilder.DropIndex(
                name: "ix_groups_parent_group_id_updated_utc",
                table: "groups");

            migrationBuilder.DropIndex(
                name: "ix_group_memberships_group_id_updated_utc",
                table: "group_memberships");

            migrationBuilder.DropIndex(
                name: "ix_group_memberships_member_id_updated_utc",
                table: "group_memberships");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "sermons");

            migrationBuilder.DropColumn(
                name: "updated_utc",
                table: "sermons");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "sections");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "pages");

            migrationBuilder.DropColumn(
                name: "updated_utc",
                table: "members");

            migrationBuilder.CreateIndex(
                name: "ix_groups_parent_group_id",
                table: "groups",
                column: "parent_group_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_memberships_member_id",
                table: "group_memberships",
                column: "member_id");
        }
    }
}
