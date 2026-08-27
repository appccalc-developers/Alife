using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVenueReservationConflict : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_resource_venues",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    managing_group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    address_en = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    address_zh = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    capacity = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_resource_venues", x => x.id);
                    table.CheckConstraint("ck_event_resource_venues_capacity", "[capacity] > 0");
                    table.ForeignKey(
                        name: "fk_event_resource_venues_groups_managing_group_id",
                        column: x => x.managing_group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_resource_venues_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_resource_venue_reservations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    venue_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    required_capacity = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    reserved_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    released_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    released_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_resource_venue_reservations", x => x.id);
                    table.CheckConstraint("ck_event_resource_venue_reservations_capacity", "[required_capacity] > 0");
                    table.CheckConstraint("ck_event_resource_venue_reservations_interval", "[end_utc] > [start_utc]");
                    table.CheckConstraint("ck_event_resource_venue_reservations_release", "([status] = 0 AND [released_utc] IS NULL AND [released_by_member_id] IS NULL) OR ([status] = 1 AND [released_utc] IS NOT NULL AND [released_by_member_id] IS NOT NULL)");
                    table.ForeignKey(
                        name: "fk_event_resource_venue_reservations_event_composition_occurrences_event_occurrence_id",
                        column: x => x.event_occurrence_id,
                        principalTable: "event_composition_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_resource_venue_reservations_event_resource_venues_venue_id",
                        column: x => x.venue_id,
                        principalTable: "event_resource_venues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_resource_venue_reservations_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_resource_venue_reservations_members_released_by_member_id",
                        column: x => x.released_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_resource_venue_reservations_members_reserved_by_member_id",
                        column: x => x.reserved_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_resource_venue_reservations_event_id_status_start_utc",
                table: "event_resource_venue_reservations",
                columns: new[] { "event_id", "status", "start_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_resource_venue_reservations_event_occurrence_id_status",
                table: "event_resource_venue_reservations",
                columns: new[] { "event_occurrence_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_event_resource_venue_reservations_released_by_member_id",
                table: "event_resource_venue_reservations",
                column: "released_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_resource_venue_reservations_reserved_by_member_id",
                table: "event_resource_venue_reservations",
                column: "reserved_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_resource_venue_reservations_venue_id_status_start_utc_end_utc",
                table: "event_resource_venue_reservations",
                columns: new[] { "venue_id", "status", "start_utc", "end_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_resource_venues_created_by_member_id",
                table: "event_resource_venues",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_resource_venues_managing_group_id_is_active_name_en",
                table: "event_resource_venues",
                columns: new[] { "managing_group_id", "is_active", "name_en" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_resource_venue_reservations");

            migrationBuilder.DropTable(
                name: "event_resource_venues");
        }
    }
}
