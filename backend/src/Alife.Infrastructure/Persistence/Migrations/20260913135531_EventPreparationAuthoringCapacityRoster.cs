using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EventPreparationAuthoringCapacityRoster : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "default_requirement_index",
                table: "event_service_slots",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "roster_defaults_id",
                table: "event_service_slots",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "roster_rules_version",
                table: "event_packages",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<Guid>(
                name: "concurrency_token",
                table: "event_enrollments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<DateTime>(
                name: "queued_utc",
                table: "event_enrollments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "event_enrollments",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "confirmed");

            migrationBuilder.AddColumn<DateTime>(
                name: "status_changed_utc",
                table: "event_enrollments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "duration_minutes",
                table: "event_composition_series",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "first_start_local",
                table: "event_composition_series",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "event_enrollment_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    enrollment_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    enrollment_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    queued_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    status_changed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    archived_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_enrollment_history", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_enrollment_history_event_enrollments_enrollment_id",
                        column: x => x.enrollment_id,
                        principalTable: "event_enrollments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_roster_defaults",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    requirements_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_roster_defaults", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_roster_defaults_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_service_slots_roster_defaults_id",
                table: "event_service_slots",
                column: "roster_defaults_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_enrollments_event_id_status_queued_utc",
                table: "event_enrollments",
                columns: new[] { "event_id", "status", "queued_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_enrollment_history_enrollment_id_archived_utc",
                table: "event_enrollment_history",
                columns: new[] { "enrollment_id", "archived_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_roster_defaults_event_id_version",
                table: "event_roster_defaults",
                columns: new[] { "event_id", "version" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_event_service_slots_event_roster_defaults_roster_defaults_id",
                table: "event_service_slots",
                column: "roster_defaults_id",
                principalTable: "event_roster_defaults",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_event_service_slots_event_roster_defaults_roster_defaults_id",
                table: "event_service_slots");

            migrationBuilder.DropTable(
                name: "event_enrollment_history");

            migrationBuilder.DropTable(
                name: "event_roster_defaults");

            migrationBuilder.DropIndex(
                name: "ix_event_service_slots_roster_defaults_id",
                table: "event_service_slots");

            migrationBuilder.DropIndex(
                name: "ix_event_enrollments_event_id_status_queued_utc",
                table: "event_enrollments");

            migrationBuilder.DropColumn(
                name: "default_requirement_index",
                table: "event_service_slots");

            migrationBuilder.DropColumn(
                name: "roster_defaults_id",
                table: "event_service_slots");

            migrationBuilder.DropColumn(
                name: "roster_rules_version",
                table: "event_packages");

            migrationBuilder.DropColumn(
                name: "concurrency_token",
                table: "event_enrollments");

            migrationBuilder.DropColumn(
                name: "queued_utc",
                table: "event_enrollments");

            migrationBuilder.DropColumn(
                name: "status",
                table: "event_enrollments");

            migrationBuilder.DropColumn(
                name: "status_changed_utc",
                table: "event_enrollments");

            migrationBuilder.DropColumn(
                name: "duration_minutes",
                table: "event_composition_series");

            migrationBuilder.DropColumn(
                name: "first_start_local",
                table: "event_composition_series");
        }
    }
}
