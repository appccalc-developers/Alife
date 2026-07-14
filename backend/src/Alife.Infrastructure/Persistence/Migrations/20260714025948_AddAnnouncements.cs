using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAnnouncements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "announcement_id",
                table: "notification_messages",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "announcements",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    title_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    summary_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    content_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    audience = table.Column<int>(type: "int", nullable: false),
                    priority = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    publish_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    expire_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    is_pinned = table.Column<bool>(type: "bit", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_announcements", x => x.id);
                    table.ForeignKey(
                        name: "fk_announcements_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_announcements_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_notification_messages_announcement_id",
                table: "notification_messages",
                column: "announcement_id");

            migrationBuilder.CreateIndex(
                name: "ix_announcements_created_by_member_id",
                table: "announcements",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_announcements_group_id_status_publish_utc_expire_utc",
                table: "announcements",
                columns: new[] { "group_id", "status", "publish_utc", "expire_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_announcements_is_pinned_priority_publish_utc",
                table: "announcements",
                columns: new[] { "is_pinned", "priority", "publish_utc" });

            migrationBuilder.AddForeignKey(
                name: "fk_notification_messages_announcements_announcement_id",
                table: "notification_messages",
                column: "announcement_id",
                principalTable: "announcements",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_notification_messages_announcements_announcement_id",
                table: "notification_messages");

            migrationBuilder.DropTable(
                name: "announcements");

            migrationBuilder.DropIndex(
                name: "ix_notification_messages_announcement_id",
                table: "notification_messages");

            migrationBuilder.DropColumn(
                name: "announcement_id",
                table: "notification_messages");
        }
    }
}
