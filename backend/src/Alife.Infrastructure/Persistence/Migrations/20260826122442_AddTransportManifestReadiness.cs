using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTransportManifestReadiness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_travel_drivers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    licence_class = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    licence_expires_on = table.Column<DateOnly>(type: "date", nullable: true),
                    licence_confirmed = table.Column<bool>(type: "bit", nullable: false),
                    fit_to_drive_confirmed = table.Column<bool>(type: "bit", nullable: false),
                    evidence_notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    verified_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    verified_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_travel_drivers", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_travel_drivers_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_drivers_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_drivers_members_verified_by_member_id",
                        column: x => x.verified_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_travel_vehicles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    registration_reference = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    seat_capacity = table.Column<int>(type: "int", nullable: false),
                    registration_confirmed = table.Column<bool>(type: "bit", nullable: false),
                    registration_expires_on = table.Column<DateOnly>(type: "date", nullable: true),
                    wof_confirmed = table.Column<bool>(type: "bit", nullable: false),
                    wof_expires_on = table.Column<DateOnly>(type: "date", nullable: true),
                    evidence_notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    verified_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    verified_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_travel_vehicles", x => x.id);
                    table.CheckConstraint("ck_event_travel_vehicles_seat_capacity", "[seat_capacity] > 0");
                    table.ForeignKey(
                        name: "fk_event_travel_vehicles_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_vehicles_members_verified_by_member_id",
                        column: x => x.verified_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_travel_journeys",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    driver_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    vehicle_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    manifest_confirmed = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_travel_journeys", x => x.id);
                    table.CheckConstraint("ck_event_travel_journeys_interval", "[end_utc] > [start_utc]");
                    table.ForeignKey(
                        name: "fk_event_travel_journeys_event_occurrences_event_occurrence_id",
                        column: x => x.event_occurrence_id,
                        principalTable: "event_composition_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_journeys_event_travel_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "event_travel_drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_journeys_event_travel_vehicles_vehicle_id",
                        column: x => x.vehicle_id,
                        principalTable: "event_travel_vehicles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_journeys_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_journeys_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_travel_pickup_stops",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    journey_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    address_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    address_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    pickup_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_travel_pickup_stops", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_travel_pickup_stops_event_travel_journeys_journey_id",
                        column: x => x.journey_id,
                        principalTable: "event_travel_journeys",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_travel_passenger_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    journey_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    pickup_stop_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    assigned_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    assigned_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ended_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ended_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_travel_passenger_assignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_travel_passenger_assignments_event_travel_journeys_journey_id",
                        column: x => x.journey_id,
                        principalTable: "event_travel_journeys",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_passenger_assignments_event_travel_pickup_stops_pickup_stop_id",
                        column: x => x.pickup_stop_id,
                        principalTable: "event_travel_pickup_stops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_passenger_assignments_members_assigned_by_member_id",
                        column: x => x.assigned_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_passenger_assignments_members_ended_by_member_id",
                        column: x => x.ended_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_travel_passenger_assignments_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_drivers_event_id_is_active",
                table: "event_travel_drivers",
                columns: new[] { "event_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_drivers_event_id_member_id",
                table: "event_travel_drivers",
                columns: new[] { "event_id", "member_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_drivers_member_id",
                table: "event_travel_drivers",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_drivers_verified_by_member_id",
                table: "event_travel_drivers",
                column: "verified_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_journeys_created_by_member_id",
                table: "event_travel_journeys",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_journeys_driver_id",
                table: "event_travel_journeys",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_journeys_event_id_status",
                table: "event_travel_journeys",
                columns: new[] { "event_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_journeys_event_occurrence_id_status_start_utc",
                table: "event_travel_journeys",
                columns: new[] { "event_occurrence_id", "status", "start_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_journeys_vehicle_id",
                table: "event_travel_journeys",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_passenger_assignments_assigned_by_member_id",
                table: "event_travel_passenger_assignments",
                column: "assigned_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_passenger_assignments_ended_by_member_id",
                table: "event_travel_passenger_assignments",
                column: "ended_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_passenger_assignments_journey_id_member_id",
                table: "event_travel_passenger_assignments",
                columns: new[] { "journey_id", "member_id" },
                unique: true,
                filter: "[ended_utc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_passenger_assignments_member_id_ended_utc",
                table: "event_travel_passenger_assignments",
                columns: new[] { "member_id", "ended_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_passenger_assignments_pickup_stop_id",
                table: "event_travel_passenger_assignments",
                column: "pickup_stop_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_pickup_stops_journey_id_sort_order",
                table: "event_travel_pickup_stops",
                columns: new[] { "journey_id", "sort_order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_vehicles_event_id_is_active",
                table: "event_travel_vehicles",
                columns: new[] { "event_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_vehicles_event_id_registration_reference",
                table: "event_travel_vehicles",
                columns: new[] { "event_id", "registration_reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_travel_vehicles_verified_by_member_id",
                table: "event_travel_vehicles",
                column: "verified_by_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_travel_passenger_assignments");

            migrationBuilder.DropTable(
                name: "event_travel_pickup_stops");

            migrationBuilder.DropTable(
                name: "event_travel_journeys");

            migrationBuilder.DropTable(
                name: "event_travel_drivers");

            migrationBuilder.DropTable(
                name: "event_travel_vehicles");
        }
    }
}
