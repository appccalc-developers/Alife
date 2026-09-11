using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventPreparationReopenRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_preparation_reopen_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_package_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    requested_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reason_en = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    reason_zh = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    requested_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    reviewed_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reviewed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    review_reason_en = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    review_reason_zh = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_preparation_reopen_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_preparation_reopen_requests_event_packages_event_package_id",
                        column: x => x.event_package_id,
                        principalTable: "event_packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_preparation_reopen_requests_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_preparation_reopen_requests_members_requested_by_member_id",
                        column: x => x.requested_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_preparation_reopen_requests_members_reviewed_by_member_id",
                        column: x => x.reviewed_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_preparation_reopen_requests_event_id",
                table: "event_preparation_reopen_requests",
                column: "event_id",
                unique: true,
                filter: "[status] = 0");

            migrationBuilder.CreateIndex(
                name: "ix_event_preparation_reopen_requests_event_id_requested_utc",
                table: "event_preparation_reopen_requests",
                columns: new[] { "event_id", "requested_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_preparation_reopen_requests_event_package_id",
                table: "event_preparation_reopen_requests",
                column: "event_package_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_preparation_reopen_requests_requested_by_member_id",
                table: "event_preparation_reopen_requests",
                column: "requested_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_preparation_reopen_requests_reviewed_by_member_id",
                table: "event_preparation_reopen_requests",
                column: "reviewed_by_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_preparation_reopen_requests");
        }
    }
}
