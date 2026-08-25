using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVenueCatalogAndBookings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "venues",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    church_group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    description_en = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    description_zh = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    address_en = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    address_zh = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    time_zone_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_venues", x => x.id);
                    table.ForeignKey(
                        name: "fk_venues_groups_church_group_id",
                        column: x => x.church_group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_venues_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_venues_members_updated_by_member_id",
                        column: x => x.updated_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "venue_spaces",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    venue_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    capacity = table.Column<int>(type: "int", nullable: false),
                    resources_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    booking_policy_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_venue_spaces", x => x.id);
                    table.ForeignKey(
                        name: "fk_venue_spaces_venues_venue_id",
                        column: x => x.venue_id,
                        principalTable: "venues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_venue_bookings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    venue_space_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    requested_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reviewed_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    purpose_en = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    purpose_zh = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    decision_notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    attendee_count = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    submitted_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    reviewed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_venue_bookings", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_venue_bookings_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_venue_bookings_members_requested_by_member_id",
                        column: x => x.requested_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_venue_bookings_members_reviewed_by_member_id",
                        column: x => x.reviewed_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_venue_bookings_venue_spaces_venue_space_id",
                        column: x => x.venue_space_id,
                        principalTable: "venue_spaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_venue_bookings_event_id_updated_utc",
                table: "event_venue_bookings",
                columns: new[] { "event_id", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_venue_bookings_requested_by_member_id",
                table: "event_venue_bookings",
                column: "requested_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_venue_bookings_reviewed_by_member_id",
                table: "event_venue_bookings",
                column: "reviewed_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_venue_bookings_venue_space_id_status_start_utc_end_utc",
                table: "event_venue_bookings",
                columns: new[] { "venue_space_id", "status", "start_utc", "end_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_venue_spaces_venue_id_is_active",
                table: "venue_spaces",
                columns: new[] { "venue_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "ix_venues_church_group_id_is_active_updated_utc",
                table: "venues",
                columns: new[] { "church_group_id", "is_active", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_venues_created_by_member_id",
                table: "venues",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_venues_updated_by_member_id",
                table: "venues",
                column: "updated_by_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_venue_bookings");

            migrationBuilder.DropTable(
                name: "venue_spaces");

            migrationBuilder.DropTable(
                name: "venues");
        }
    }
}
