using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddChildConsentCheckIn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_safeguarding_child_registrations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    enrollment_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    child_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    photo_url = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ended_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ended_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_safeguarding_child_registrations", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_registrations_event_enrollments_enrollment_id",
                        column: x => x.enrollment_id,
                        principalTable: "event_enrollments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_registrations_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_registrations_members_child_member_id",
                        column: x => x.child_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_registrations_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_registrations_members_ended_by_member_id",
                        column: x => x.ended_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_safeguarding_policy_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    policy_code = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    requirements_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_published = table.Column<bool>(type: "bit", nullable: false),
                    effective_from_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    retired_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_safeguarding_policy_versions", x => x.id);
                    table.CheckConstraint("ck_event_safeguarding_policy_versions_version", "[version] > 0");
                    table.ForeignKey(
                        name: "fk_event_safeguarding_policy_versions_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_policy_versions_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_safeguarding_guardian_relationships",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    child_registration_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    guardian_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    relationship_label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    confirmed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ended_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_safeguarding_guardian_relationships", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_guardian_relationships_event_safeguarding_child_registrations_child_registration_id",
                        column: x => x.child_registration_id,
                        principalTable: "event_safeguarding_child_registrations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_guardian_relationships_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_guardian_relationships_members_guardian_member_id",
                        column: x => x.guardian_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_safeguarding_configurations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    policy_version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    configured_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    configured_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_safeguarding_configurations", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_configurations_event_safeguarding_policy_versions_policy_version_id",
                        column: x => x.policy_version_id,
                        principalTable: "event_safeguarding_policy_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_configurations_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_configurations_members_configured_by_member_id",
                        column: x => x.configured_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_safeguarding_worker_eligibility",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    policy_version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role_requirement_key = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    eligibility_evidence_code = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    evidence_reference = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    is_eligible = table.Column<bool>(type: "bit", nullable: false),
                    verified_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    verified_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_safeguarding_worker_eligibility", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_worker_eligibility_event_safeguarding_policy_versions_policy_version_id",
                        column: x => x.policy_version_id,
                        principalTable: "event_safeguarding_policy_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_worker_eligibility_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_worker_eligibility_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_worker_eligibility_members_verified_by_member_id",
                        column: x => x.verified_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_safeguarding_authorised_collectors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    child_registration_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    authorised_by_guardian_relationship_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    display_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    relationship_label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    authorised_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    revoked_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    revoked_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_safeguarding_authorised_collectors", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_authorised_collectors_event_safeguarding_child_registrations_child_registration_id",
                        column: x => x.child_registration_id,
                        principalTable: "event_safeguarding_child_registrations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_authorised_collectors_event_safeguarding_guardian_relationships_authorised_by_guardian_relationship_id",
                        column: x => x.authorised_by_guardian_relationship_id,
                        principalTable: "event_safeguarding_guardian_relationships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_authorised_collectors_members_revoked_by_member_id",
                        column: x => x.revoked_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_safeguarding_child_consents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    child_registration_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    guardian_relationship_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    policy_version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    decision = table.Column<int>(type: "int", nullable: false),
                    recorded_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    recorded_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_safeguarding_child_consents", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_consents_event_safeguarding_child_registrations_child_registration_id",
                        column: x => x.child_registration_id,
                        principalTable: "event_safeguarding_child_registrations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_consents_event_safeguarding_guardian_relationships_guardian_relationship_id",
                        column: x => x.guardian_relationship_id,
                        principalTable: "event_safeguarding_guardian_relationships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_consents_event_safeguarding_policy_versions_policy_version_id",
                        column: x => x.policy_version_id,
                        principalTable: "event_safeguarding_policy_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_consents_members_recorded_by_member_id",
                        column: x => x.recorded_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_safeguarding_child_attendance",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    child_registration_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    state = table.Column<int>(type: "int", nullable: false),
                    checked_in_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    checked_in_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    checked_out_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    checked_out_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    collector_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_safeguarding_child_attendance", x => x.id);
                    table.CheckConstraint("ck_event_safeguarding_child_attendance_checkout", "([state] = 0 AND [checked_out_utc] IS NULL AND [checked_out_by_member_id] IS NULL AND [collector_id] IS NULL) OR ([state] = 1 AND [checked_out_utc] IS NOT NULL AND [checked_out_by_member_id] IS NOT NULL AND [collector_id] IS NOT NULL)");
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_attendance_event_composition_occurrences_event_occurrence_id",
                        column: x => x.event_occurrence_id,
                        principalTable: "event_composition_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_attendance_event_safeguarding_authorised_collectors_collector_id",
                        column: x => x.collector_id,
                        principalTable: "event_safeguarding_authorised_collectors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_attendance_event_safeguarding_child_registrations_child_registration_id",
                        column: x => x.child_registration_id,
                        principalTable: "event_safeguarding_child_registrations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_attendance_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_attendance_members_checked_in_by_member_id",
                        column: x => x.checked_in_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_safeguarding_child_attendance_members_checked_out_by_member_id",
                        column: x => x.checked_out_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_authorised_collectors_authorised_by_guardian_relationship_id",
                table: "event_safeguarding_authorised_collectors",
                column: "authorised_by_guardian_relationship_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_authorised_collectors_child_registration_id_is_active_display_name",
                table: "event_safeguarding_authorised_collectors",
                columns: new[] { "child_registration_id", "is_active", "display_name" });

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_authorised_collectors_revoked_by_member_id",
                table: "event_safeguarding_authorised_collectors",
                column: "revoked_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_attendance_checked_in_by_member_id",
                table: "event_safeguarding_child_attendance",
                column: "checked_in_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_attendance_checked_out_by_member_id",
                table: "event_safeguarding_child_attendance",
                column: "checked_out_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_attendance_child_registration_id",
                table: "event_safeguarding_child_attendance",
                column: "child_registration_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_attendance_collector_id",
                table: "event_safeguarding_child_attendance",
                column: "collector_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_attendance_event_id",
                table: "event_safeguarding_child_attendance",
                column: "event_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_attendance_event_occurrence_id_child_registration_id",
                table: "event_safeguarding_child_attendance",
                columns: new[] { "event_occurrence_id", "child_registration_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_attendance_event_occurrence_id_state",
                table: "event_safeguarding_child_attendance",
                columns: new[] { "event_occurrence_id", "state" });

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_consents_child_registration_id_policy_version_id_recorded_utc",
                table: "event_safeguarding_child_consents",
                columns: new[] { "child_registration_id", "policy_version_id", "recorded_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_consents_guardian_relationship_id",
                table: "event_safeguarding_child_consents",
                column: "guardian_relationship_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_consents_policy_version_id",
                table: "event_safeguarding_child_consents",
                column: "policy_version_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_consents_recorded_by_member_id",
                table: "event_safeguarding_child_consents",
                column: "recorded_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_child_member_id",
                table: "event_safeguarding_child_registrations",
                column: "child_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_created_by_member_id",
                table: "event_safeguarding_child_registrations",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_ended_by_member_id",
                table: "event_safeguarding_child_registrations",
                column: "ended_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_enrollment_id",
                table: "event_safeguarding_child_registrations",
                column: "enrollment_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_child_member_id",
                table: "event_safeguarding_child_registrations",
                columns: new[] { "event_id", "child_member_id" },
                unique: true,
                filter: "[is_active] = 1");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_enrollment_id",
                table: "event_safeguarding_child_registrations",
                columns: new[] { "event_id", "enrollment_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_configurations_configured_by_member_id",
                table: "event_safeguarding_configurations",
                column: "configured_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_configurations_event_id",
                table: "event_safeguarding_configurations",
                column: "event_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_configurations_policy_version_id",
                table: "event_safeguarding_configurations",
                column: "policy_version_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_guardian_relationships_child_registration_id_guardian_member_id",
                table: "event_safeguarding_guardian_relationships",
                columns: new[] { "child_registration_id", "guardian_member_id" },
                unique: true,
                filter: "[status] <> 2");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_guardian_relationships_created_by_member_id",
                table: "event_safeguarding_guardian_relationships",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_guardian_relationships_guardian_member_id",
                table: "event_safeguarding_guardian_relationships",
                column: "guardian_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_policy_versions_created_by_member_id",
                table: "event_safeguarding_policy_versions",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_policy_versions_group_id_is_published_effective_from_utc",
                table: "event_safeguarding_policy_versions",
                columns: new[] { "group_id", "is_published", "effective_from_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_policy_versions_group_id_policy_code_version",
                table: "event_safeguarding_policy_versions",
                columns: new[] { "group_id", "policy_code", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_worker_eligibility_event_id_policy_version_id_member_id_role_requirement_key_eligibility_evidence_code",
                table: "event_safeguarding_worker_eligibility",
                columns: new[] { "event_id", "policy_version_id", "member_id", "role_requirement_key", "eligibility_evidence_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_worker_eligibility_member_id",
                table: "event_safeguarding_worker_eligibility",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_worker_eligibility_policy_version_id",
                table: "event_safeguarding_worker_eligibility",
                column: "policy_version_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_worker_eligibility_verified_by_member_id",
                table: "event_safeguarding_worker_eligibility",
                column: "verified_by_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_safeguarding_child_attendance");

            migrationBuilder.DropTable(
                name: "event_safeguarding_child_consents");

            migrationBuilder.DropTable(
                name: "event_safeguarding_configurations");

            migrationBuilder.DropTable(
                name: "event_safeguarding_worker_eligibility");

            migrationBuilder.DropTable(
                name: "event_safeguarding_authorised_collectors");

            migrationBuilder.DropTable(
                name: "event_safeguarding_policy_versions");

            migrationBuilder.DropTable(
                name: "event_safeguarding_guardian_relationships");

            migrationBuilder.DropTable(
                name: "event_safeguarding_child_registrations");
        }
    }
}
