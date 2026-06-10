using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationMessages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "notification_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    recipient_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    occurred_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    action_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    action_data_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    response_data_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    replied_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_messages", x => x.id);
                    table.ForeignKey(
                        name: "fk_notification_messages_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_notification_messages_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_notification_messages_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_notification_messages_members_recipient_member_id",
                        column: x => x.recipient_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_notification_messages_created_by_member_id",
                table: "notification_messages",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_messages_event_id",
                table: "notification_messages",
                column: "event_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_messages_group_id_updated_utc",
                table: "notification_messages",
                columns: new[] { "group_id", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_messages_recipient_member_id_replied_utc_occurred_utc",
                table: "notification_messages",
                columns: new[] { "recipient_member_id", "replied_utc", "occurred_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notification_messages");
        }
    }
}
