using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventProjectOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_enrollment_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.AlterColumn<Guid>(
                name: "enrollment_id",
                table: "event_safeguarding_child_registrations",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AlterColumn<Guid>(
                name: "child_member_id",
                table: "event_safeguarding_child_registrations",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "registration_participant_id",
                table: "event_safeguarding_child_registrations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "preset_projects_json",
                table: "event_activity_template_versions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "event_activity_module_configurations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    activity_id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    kind = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    details_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_module_configurations", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_activity_module_configurations_event_occurrences_occurrence_id",
                        column: x => x.occurrence_id,
                        principalTable: "event_composition_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_activity_module_configurations_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_activity_policy_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    activity_id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    is_current = table.Column<bool>(type: "bit", nullable: false),
                    rules_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    fee_approval_status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    fee_submitted_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    fee_approved_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_policy_versions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_activity_policy_versions_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_participant_private_data",
                columns: table => new
                {
                    participant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    birth_date = table.Column<DateOnly>(type: "date", nullable: true),
                    provided_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_participant_private_data", x => x.participant_id);
                    table.ForeignKey(
                        name: "fk_event_participant_private_data_event_registration_participants_participant_id",
                        column: x => x.participant_id,
                        principalTable: "event_registration_participants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_activity_offers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    activity_id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    policy_version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_offers", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_activity_offers_event_activity_policy_versions_policy_version_id",
                        column: x => x.policy_version_id,
                        principalTable: "event_activity_policy_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_activity_offers_event_occurrences_occurrence_id",
                        column: x => x.occurrence_id,
                        principalTable: "event_composition_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_activity_offers_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_activity_participations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    offer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    participant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    policy_version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    fee_policy_version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    charge_participation_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    fee_minor = table.Column<long>(type: "bigint", nullable: false),
                    currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    seat_status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    procedure_status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    eligibility = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    eligibility_verified = table.Column<bool>(type: "bit", nullable: false),
                    requested_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    queued_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    reserved_until_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_participations", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_activity_participations_event_activity_offers_offer_id",
                        column: x => x.offer_id,
                        principalTable: "event_activity_offers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_activity_participations_event_activity_participations_charge_participation_id",
                        column: x => x.charge_participation_id,
                        principalTable: "event_activity_participations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_activity_participations_event_activity_policy_versions_fee_policy_version_id",
                        column: x => x.fee_policy_version_id,
                        principalTable: "event_activity_policy_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_activity_participations_event_activity_policy_versions_policy_version_id",
                        column: x => x.policy_version_id,
                        principalTable: "event_activity_policy_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_activity_participations_event_registration_participants_participant_id",
                        column: x => x.participant_id,
                        principalTable: "event_registration_participants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_activity_space_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    offer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    reservation_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    evidence = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    recorded_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    recorded_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_space_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_activity_space_requests_event_activity_offers_offer_id",
                        column: x => x.offer_id,
                        principalTable: "event_activity_offers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_activity_space_requests_event_venue_reservations_reservation_id",
                        column: x => x.reservation_id,
                        principalTable: "event_resource_venue_reservations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_activity_consents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    participation_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    policy_version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    method = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    evidence = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    consented_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_consents", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_activity_consents_event_activity_participations_participation_id",
                        column: x => x.participation_id,
                        principalTable: "event_activity_participations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_activity_payments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    participation_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    operation = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    amount_minor = table.Column<long>(type: "bigint", nullable: false),
                    evidence = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_payments", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_activity_payments_event_activity_participations_participation_id",
                        column: x => x.participation_id,
                        principalTable: "event_activity_participations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("0c5d8b03-b9f6-41e7-0599-a459601fd1ec"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("16b10dbb-e7cb-8814-1a32-353989a3cf8b"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("18d70aa5-682b-b09c-dbd6-62c11e36d563"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("2b8d4491-7e09-2ef0-34fe-d01a676bd67b"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("2e746361-5926-7397-4a33-150f76052fe7"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("301ace24-8398-3db6-bbdf-2ca24ee40774"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("42dd88b6-1562-6fc7-5c6a-98fe7a5b1fe5"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("4b7b57cd-65c0-69e5-e9aa-c6d7954c6c67"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("5b2c8a47-42ea-02be-ea55-bbe87090bf70"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("a23304b8-e5dd-fc01-90bd-d42da5705a65"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("ae474f4f-239f-322a-0332-8c832924ab45"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("b40de5e1-953b-ee6f-8788-04e58d9ef3e8"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("e937f772-f4dd-1f0e-4813-ba46532dbb3d"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("ea4884f4-bce2-c92c-5131-845083ca110f"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("f4136549-9494-1b7f-54ce-25ccaa925534"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.UpdateData(
                table: "event_activity_template_versions",
                keyColumn: "id",
                keyValue: new Guid("fb233223-3e78-9532-071a-9ec5cade1366"),
                column: "preset_projects_json",
                value: null);

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_enrollment_id",
                table: "event_safeguarding_child_registrations",
                columns: new[] { "event_id", "enrollment_id" },
                unique: true,
                filter: "[enrollment_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_registration_participant_id",
                table: "event_safeguarding_child_registrations",
                columns: new[] { "event_id", "registration_participant_id" },
                unique: true,
                filter: "[registration_participant_id] IS NOT NULL AND [is_active] = 1");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_registration_participant_id",
                table: "event_safeguarding_child_registrations",
                column: "registration_participant_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_consents_participation_id",
                table: "event_activity_consents",
                column: "participation_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_module_configurations_event_id_activity_id_occurrence_id_kind",
                table: "event_activity_module_configurations",
                columns: new[] { "event_id", "activity_id", "occurrence_id", "kind" },
                unique: true,
                filter: "[occurrence_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_module_configurations_project_level",
                table: "event_activity_module_configurations",
                columns: new[] { "event_id", "activity_id", "kind" },
                unique: true,
                filter: "[occurrence_id] IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_module_configurations_occurrence_id",
                table: "event_activity_module_configurations",
                column: "occurrence_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_offers_event_id_activity_id_occurrence_id",
                table: "event_activity_offers",
                columns: new[] { "event_id", "activity_id", "occurrence_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_offers_occurrence_id",
                table: "event_activity_offers",
                column: "occurrence_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_offers_policy_version_id",
                table: "event_activity_offers",
                column: "policy_version_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_participations_charge_participation_id",
                table: "event_activity_participations",
                column: "charge_participation_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_participations_fee_policy_version_id",
                table: "event_activity_participations",
                column: "fee_policy_version_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_participations_offer_id_participant_id",
                table: "event_activity_participations",
                columns: new[] { "offer_id", "participant_id" },
                unique: true,
                filter: "[seat_status] <> N'cancelled' AND [seat_status] <> N'expired'");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_participations_offer_id_queued_utc",
                table: "event_activity_participations",
                columns: new[] { "offer_id", "queued_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_participations_participant_id",
                table: "event_activity_participations",
                column: "participant_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_participations_policy_version_id",
                table: "event_activity_participations",
                column: "policy_version_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_payments_participation_id",
                table: "event_activity_payments",
                column: "participation_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_policy_versions_event_id_activity_id_is_current",
                table: "event_activity_policy_versions",
                columns: new[] { "event_id", "activity_id", "is_current" },
                unique: true,
                filter: "[is_current] = 1");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_policy_versions_event_id_activity_id_version",
                table: "event_activity_policy_versions",
                columns: new[] { "event_id", "activity_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_space_requests_offer_id",
                table: "event_activity_space_requests",
                column: "offer_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_space_requests_reservation_id",
                table: "event_activity_space_requests",
                column: "reservation_id");

            migrationBuilder.AddForeignKey(
                name: "fk_event_safeguarding_child_registrations_event_registration_participants_registration_participant_id",
                table: "event_safeguarding_child_registrations",
                column: "registration_participant_id",
                principalTable: "event_registration_participants",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_event_safeguarding_child_registrations_event_registration_participants_registration_participant_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.DropTable(
                name: "event_activity_consents");

            migrationBuilder.DropTable(
                name: "event_activity_module_configurations");

            migrationBuilder.DropTable(
                name: "event_activity_payments");

            migrationBuilder.DropTable(
                name: "event_activity_space_requests");

            migrationBuilder.DropTable(
                name: "event_participant_private_data");

            migrationBuilder.DropTable(
                name: "event_activity_participations");

            migrationBuilder.DropTable(
                name: "event_activity_offers");

            migrationBuilder.DropTable(
                name: "event_activity_policy_versions");

            migrationBuilder.DropIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_enrollment_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.DropIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_registration_participant_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.DropIndex(
                name: "ix_event_safeguarding_child_registrations_registration_participant_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.DropColumn(
                name: "registration_participant_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.DropColumn(
                name: "preset_projects_json",
                table: "event_activity_template_versions");

            migrationBuilder.AlterColumn<Guid>(
                name: "enrollment_id",
                table: "event_safeguarding_child_registrations",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "child_member_id",
                table: "event_safeguarding_child_registrations",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_enrollment_id",
                table: "event_safeguarding_child_registrations",
                columns: new[] { "event_id", "enrollment_id" },
                unique: true);
        }
    }
}
