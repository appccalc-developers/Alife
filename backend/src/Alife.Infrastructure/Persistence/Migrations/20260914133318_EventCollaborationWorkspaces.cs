using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EventCollaborationWorkspaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "collaboration_version",
                table: "group_events",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "kind",
                table: "event_resource_venues",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "venue");

            migrationBuilder.AddColumn<string>(
                name: "time_zone",
                table: "event_resource_venues",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "Pacific/Auckland");

            migrationBuilder.AddColumn<string>(
                name: "event_plan_context_hash",
                table: "event_ram_revisions",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "event_plan_context_json",
                table: "event_ram_revisions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "event_plan_version",
                table: "event_ram_revisions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "event_occurrence_id",
                table: "event_operations_tasks",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "stage",
                table: "event_operations_tasks",
                type: "nvarchar(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "preparation");

            migrationBuilder.CreateTable(
                name: "event_module_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    module_code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    draft_en = table.Column<string>(type: "nvarchar(max)", maxLength: 20000, nullable: false),
                    draft_zh = table.Column<string>(type: "nvarchar(max)", maxLength: 20000, nullable: false),
                    status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    revision = table.Column<int>(type: "int", nullable: false),
                    submitted_revision_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    adopted_revision_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    updated_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_module_reports", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_module_reports_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_registration_actions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    application_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    participant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    operation = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    evidence = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    snapshot_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_registration_actions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_registration_actions_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_registration_applications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    organiser_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    manual_organiser_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    proxy_authority_evidence = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    legacy_enrollment_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    allow_split = table.Column<bool>(type: "bit", nullable: false),
                    is_invitation = table.Column<bool>(type: "bit", nullable: false),
                    invitation_mode = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    invited_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    reservation_expires_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    policy_version = table.Column<int>(type: "int", nullable: false),
                    channel = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    queued_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_registration_applications", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_registration_applications_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_registration_policies",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    rules_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    fee_approval_status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    fee_approved_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    fee_submitted_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_registration_policies", x => x.event_id);
                    table.ForeignKey(
                        name: "fk_event_registration_policies_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_venue_weekly_bookings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    venue_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    first_date = table.Column<DateOnly>(type: "date", nullable: false),
                    last_date = table.Column<DateOnly>(type: "date", nullable: true),
                    start_minute = table.Column<int>(type: "int", nullable: false),
                    end_minute = table.Column<int>(type: "int", nullable: false),
                    time_zone = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    required_capacity = table.Column<int>(type: "int", nullable: false),
                    replaces_rule_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    previous_last_date = table.Column<DateOnly>(type: "date", nullable: true),
                    change_reason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_venue_weekly_bookings", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_venue_weekly_bookings_event_venues_venue_id",
                        column: x => x.venue_id,
                        principalTable: "event_resource_venues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_venue_weekly_bookings_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_module_report_actions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    report_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    revision_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    operation = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_module_report_actions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_module_report_actions_event_module_reports_report_id",
                        column: x => x.report_id,
                        principalTable: "event_module_reports",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_module_report_revisions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    report_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    text_en = table.Column<string>(type: "nvarchar(max)", maxLength: 20000, nullable: false),
                    text_zh = table.Column<string>(type: "nvarchar(max)", maxLength: 20000, nullable: false),
                    author_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_plan_version = table.Column<int>(type: "int", nullable: true),
                    submitted_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_module_report_revisions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_module_report_revisions_event_module_reports_report_id",
                        column: x => x.report_id,
                        principalTable: "event_module_reports",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_registration_participants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    application_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    display_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    is_child = table.Column<bool>(type: "bit", nullable: false),
                    guardian_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    guardian_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    proxy_access_revoked = table.Column<bool>(type: "bit", nullable: false),
                    seat_status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    procedure_status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    consent_method = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    consent_evidence = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    consented_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    consent_recorded_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    eligibility_verified = table.Column<bool>(type: "bit", nullable: false),
                    materials_verified = table.Column<bool>(type: "bit", nullable: false),
                    answers_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    paid_minor = table.Column<long>(type: "bigint", nullable: false),
                    refunded_minor = table.Column<long>(type: "bigint", nullable: false),
                    is_legacy = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_registration_participants", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_registration_participants_event_registration_applications_application_id",
                        column: x => x.application_id,
                        principalTable: "event_registration_applications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_venue_booking_exceptions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    weekly_booking_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    local_date = table.Column<DateOnly>(type: "date", nullable: false),
                    released = table.Column<bool>(type: "bit", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_venue_booking_exceptions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_venue_booking_exceptions_event_venue_weekly_bookings_weekly_booking_id",
                        column: x => x.weekly_booking_id,
                        principalTable: "event_venue_weekly_bookings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_registration_materials",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    participant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    file_asset_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    requirement_id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    uploaded_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_registration_materials", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_registration_materials_event_registration_participants_participant_id",
                        column: x => x.participant_id,
                        principalTable: "event_registration_participants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_registration_materials_file_assets_file_asset_id",
                        column: x => x.file_asset_id,
                        principalTable: "file_assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_tasks_event_occurrence_id",
                table: "event_operations_tasks",
                column: "event_occurrence_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_module_report_actions_report_id_created_utc",
                table: "event_module_report_actions",
                columns: new[] { "report_id", "created_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_module_report_revisions_report_id_version",
                table: "event_module_report_revisions",
                columns: new[] { "report_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_module_reports_event_id_module_code",
                table: "event_module_reports",
                columns: new[] { "event_id", "module_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_registration_actions_event_id_created_utc",
                table: "event_registration_actions",
                columns: new[] { "event_id", "created_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_registration_applications_event_id_queued_utc",
                table: "event_registration_applications",
                columns: new[] { "event_id", "queued_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_registration_applications_legacy_enrollment_id",
                table: "event_registration_applications",
                column: "legacy_enrollment_id",
                unique: true,
                filter: "[legacy_enrollment_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_registration_materials_file_asset_id",
                table: "event_registration_materials",
                column: "file_asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_registration_materials_participant_id_file_asset_id",
                table: "event_registration_materials",
                columns: new[] { "participant_id", "file_asset_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_registration_participants_application_id",
                table: "event_registration_participants",
                column: "application_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_venue_booking_exceptions_weekly_booking_id_local_date_created_utc",
                table: "event_venue_booking_exceptions",
                columns: new[] { "weekly_booking_id", "local_date", "created_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_venue_weekly_bookings_event_id",
                table: "event_venue_weekly_bookings",
                column: "event_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_venue_weekly_bookings_venue_id_first_date",
                table: "event_venue_weekly_bookings",
                columns: new[] { "venue_id", "first_date" });

            migrationBuilder.AddForeignKey(
                name: "fk_event_operations_tasks_event_composition_occurrences_event_occurrence_id",
                table: "event_operations_tasks",
                column: "event_occurrence_id",
                principalTable: "event_composition_occurrences",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_event_operations_tasks_event_composition_occurrences_event_occurrence_id",
                table: "event_operations_tasks");

            migrationBuilder.DropTable(
                name: "event_module_report_actions");

            migrationBuilder.DropTable(
                name: "event_module_report_revisions");

            migrationBuilder.DropTable(
                name: "event_registration_actions");

            migrationBuilder.DropTable(
                name: "event_registration_materials");

            migrationBuilder.DropTable(
                name: "event_registration_policies");

            migrationBuilder.DropTable(
                name: "event_venue_booking_exceptions");

            migrationBuilder.DropTable(
                name: "event_module_reports");

            migrationBuilder.DropTable(
                name: "event_registration_participants");

            migrationBuilder.DropTable(
                name: "event_venue_weekly_bookings");

            migrationBuilder.DropTable(
                name: "event_registration_applications");

            migrationBuilder.DropIndex(
                name: "ix_event_operations_tasks_event_occurrence_id",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "collaboration_version",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "event_resource_venues");

            migrationBuilder.DropColumn(
                name: "time_zone",
                table: "event_resource_venues");

            migrationBuilder.DropColumn(
                name: "event_plan_context_hash",
                table: "event_ram_revisions");

            migrationBuilder.DropColumn(
                name: "event_plan_context_json",
                table: "event_ram_revisions");

            migrationBuilder.DropColumn(
                name: "event_plan_version",
                table: "event_ram_revisions");

            migrationBuilder.DropColumn(
                name: "event_occurrence_id",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "stage",
                table: "event_operations_tasks");
        }
    }
}
