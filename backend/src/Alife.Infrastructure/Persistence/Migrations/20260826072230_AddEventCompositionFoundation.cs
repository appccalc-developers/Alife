using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventCompositionFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "accountable_owner_member_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "active_plan_version",
                table: "group_events",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "composition_series_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "governance_mode",
                table: "group_events",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<Guid>(
                name: "parent_event_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "plan_concurrency_token",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWSEQUENTIALID()");

            migrationBuilder.AddColumn<int>(
                name: "sponsorship_status",
                table: "group_events",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "event_approval_decisions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    subject_type = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    subject_version = table.Column<int>(type: "int", nullable: false),
                    decision = table.Column<int>(type: "int", nullable: false),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    decided_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_approval_decisions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_approval_decisions_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_approval_decisions_members_actor_member_id",
                        column: x => x.actor_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_fact_sets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    schema_version = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    facts_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    source_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    is_legacy_backfill = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_fact_sets", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_fact_sets_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_fact_sets_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_idempotency_records",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    operation = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    scope_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    key = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    request_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    result_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    expires_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_idempotency_records", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "event_composition_occurrences",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    local_date = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    attendance_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    exceptions_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    incidents_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_legacy_backfill = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_composition_occurrences", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_composition_occurrences_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_role_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role_requirement_key = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    scope_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    scope_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    assigned_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    accepted_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ended_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_role_assignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_role_assignments_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_role_assignments_members_assigned_by_member_id",
                        column: x => x.assigned_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_role_assignments_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_composition_series",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    owning_group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    recurrence_rule = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    time_zone = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    exception_dates_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    default_facts_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    default_team_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    rolling_occurrence_weeks = table.Column<int>(type: "int", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_composition_series", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_composition_series_groups_owning_group_id",
                        column: x => x.owning_group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_composition_series_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_plan_snapshots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    source_fact_set_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    schema_version = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    proposal_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    e_tag = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    archetype_code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    archetype_version = table.Column<int>(type: "int", nullable: true),
                    snapshot_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    accepted_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    accepted_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    is_legacy_backfill = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_plan_snapshots", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_plan_snapshots_event_fact_sets_source_fact_set_id",
                        column: x => x.source_fact_set_id,
                        principalTable: "event_fact_sets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_plan_snapshots_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_plan_snapshots_members_accepted_by_member_id",
                        column: x => x.accepted_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    title_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    title_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    place_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    lead_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    local_requirements_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_sessions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_sessions_event_occurrences_occurrence_id",
                        column: x => x.occurrence_id,
                        principalTable: "event_composition_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_sessions_members_lead_member_id",
                        column: x => x.lead_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_zones",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    title_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    title_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    capacity = table.Column<int>(type: "int", nullable: true),
                    lead_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    operating_state = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_zones", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_zones_event_occurrences_occurrence_id",
                        column: x => x.occurrence_id,
                        principalTable: "event_composition_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_zones_members_lead_member_id",
                        column: x => x.lead_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_program_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    session_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    start_offset_minutes = table.Column<int>(type: "int", nullable: false),
                    duration_minutes = table.Column<int>(type: "int", nullable: false),
                    content_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    owner_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_program_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_program_items_event_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "event_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_program_items_members_owner_member_id",
                        column: x => x.owner_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_service_slots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    session_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    zone_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    role_code = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    required_count = table.Column<int>(type: "int", nullable: false),
                    eligibility_code = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_service_slots", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_service_slots_event_occurrences_occurrence_id",
                        column: x => x.occurrence_id,
                        principalTable: "event_composition_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_service_slots_event_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "event_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_service_slots_event_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "event_zones",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Compatibility backfill: preserve GroupEvent as the event root, use
            // only facts already present in legacy rows, and create one initial
            // occurrence plus an explicitly marked legacy plan snapshot.
            const string legacyBackfillSql =
                """
                UPDATE group_events
                SET accountable_owner_member_id = created_by_member_id,
                    plan_concurrency_token = NEWID();

                INSERT INTO event_composition_occurrences
                    (id, event_id, start_utc, end_utc, local_date, status,
                     attendance_json, exceptions_json, incidents_json,
                     is_legacy_backfill, created_utc, updated_utc)
                SELECT NEWID(), e.id, e.start_date, e.end_date, CAST(e.start_date AS date), 0,
                       N'{}', N'[]', N'[]', 1, e.created_utc, e.updated_utc
                FROM group_events e
                WHERE e.is_deleted = 0
                  AND NOT EXISTS (
                      SELECT 1 FROM event_composition_occurrences o WHERE o.event_id = e.id);

                DECLARE @legacy_fact_sets TABLE (event_id uniqueidentifier, fact_set_id uniqueidentifier);

                INSERT INTO event_fact_sets
                    (id, event_id, version, schema_version, facts_json, source_hash,
                     created_by_member_id, is_legacy_backfill, created_utc)
                OUTPUT INSERTED.event_id, INSERTED.id
                    INTO @legacy_fact_sets(event_id, fact_set_id)
                SELECT NEWID(), e.id, 1, N'1.0.0',
                       N'[{"code":"event.exists","certainty":"confirmed","value":true,"source":"legacyBackfill"}]',
                       LOWER(CONVERT(varchar(64), HASHBYTES('SHA2_256',
                           CONVERT(varchar(max), N'[{"code":"event.exists","certainty":"confirmed","value":true,"source":"legacyBackfill"}]')), 2)),
                       e.created_by_member_id, 1, e.created_utc
                FROM group_events e
                WHERE e.is_deleted = 0
                  AND NOT EXISTS (
                      SELECT 1 FROM event_fact_sets f WHERE f.event_id = e.id);

                INSERT INTO event_plan_snapshots
                    (id, event_id, source_fact_set_id, version, schema_version,
                     proposal_hash, e_tag, archetype_code, archetype_version,
                     snapshot_json, accepted_by_member_id, accepted_utc,
                     is_active, is_legacy_backfill, created_utc)
                SELECT NEWID(), e.id, f.fact_set_id, 1, N'1.0.0',
                       LOWER(CONVERT(varchar(64), HASHBYTES('SHA2_256', CONCAT('legacy-plan:', CONVERT(varchar(36), e.id))), 2)),
                       CONCAT('"plan-1-', LEFT(LOWER(CONVERT(varchar(64), HASHBYTES('SHA2_256', CONVERT(varchar(36), e.id)), 2)), 16), '"'),
                       NULL, NULL,
                       N'{"schemaVersion":"1.0.0","isLegacyBackfill":true}',
                       NULL, NULL, 1, 1, e.created_utc
                FROM group_events e
                INNER JOIN @legacy_fact_sets f ON f.event_id = e.id
                WHERE NOT EXISTS (
                    SELECT 1 FROM event_plan_snapshots p WHERE p.event_id = e.id);

                UPDATE e
                SET active_plan_version = 1
                FROM group_events e
                WHERE EXISTS (
                    SELECT 1 FROM event_plan_snapshots p
                    WHERE p.event_id = e.id AND p.is_active = 1);
                """;

            // Defer compilation until after the additive columns and tables above
            // exist. This keeps both MigrateAsync and generated SQL scripts valid.
            migrationBuilder.Sql(
                $"EXEC sys.sp_executesql N'{legacyBackfillSql.Replace("'", "''")}';");

            migrationBuilder.AlterColumn<Guid>(
                name: "accountable_owner_member_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_group_events_accountable_owner_member_id",
                table: "group_events",
                column: "accountable_owner_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_events_composition_series_id",
                table: "group_events",
                column: "composition_series_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_events_parent_event_id",
                table: "group_events",
                column: "parent_event_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_approval_decisions_actor_member_id",
                table: "event_approval_decisions",
                column: "actor_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_approval_decisions_event_id_subject_type_decided_utc",
                table: "event_approval_decisions",
                columns: new[] { "event_id", "subject_type", "decided_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_fact_sets_created_by_member_id",
                table: "event_fact_sets",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_fact_sets_event_id_version",
                table: "event_fact_sets",
                columns: new[] { "event_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_idempotency_records_expires_utc",
                table: "event_idempotency_records",
                column: "expires_utc");

            migrationBuilder.CreateIndex(
                name: "ix_event_idempotency_records_operation_scope_id_key",
                table: "event_idempotency_records",
                columns: new[] { "operation", "scope_id", "key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_composition_occurrences_event_id_start_utc",
                table: "event_composition_occurrences",
                columns: new[] { "event_id", "start_utc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_composition_occurrences_status_start_utc",
                table: "event_composition_occurrences",
                columns: new[] { "status", "start_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_plan_snapshots_accepted_by_member_id",
                table: "event_plan_snapshots",
                column: "accepted_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_plan_snapshots_event_id",
                table: "event_plan_snapshots",
                column: "event_id",
                unique: true,
                filter: "[is_active] = 1");

            migrationBuilder.CreateIndex(
                name: "ix_event_plan_snapshots_event_id_version",
                table: "event_plan_snapshots",
                columns: new[] { "event_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_plan_snapshots_source_fact_set_id",
                table: "event_plan_snapshots",
                column: "source_fact_set_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_program_items_owner_member_id",
                table: "event_program_items",
                column: "owner_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_program_items_session_id_sort_order",
                table: "event_program_items",
                columns: new[] { "session_id", "sort_order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_role_assignments_assigned_by_member_id",
                table: "event_role_assignments",
                column: "assigned_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_role_assignments_event_id_role_requirement_key_member_id",
                table: "event_role_assignments",
                columns: new[] { "event_id", "role_requirement_key", "member_id" },
                unique: true,
                filter: "[ended_utc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_role_assignments_member_id_ended_utc",
                table: "event_role_assignments",
                columns: new[] { "member_id", "ended_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_composition_series_created_by_member_id",
                table: "event_composition_series",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_composition_series_owning_group_id_updated_utc",
                table: "event_composition_series",
                columns: new[] { "owning_group_id", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_service_slots_occurrence_id_start_utc_role_code",
                table: "event_service_slots",
                columns: new[] { "occurrence_id", "start_utc", "role_code" });

            migrationBuilder.CreateIndex(
                name: "ix_event_service_slots_session_id",
                table: "event_service_slots",
                column: "session_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_service_slots_zone_id",
                table: "event_service_slots",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_sessions_lead_member_id",
                table: "event_sessions",
                column: "lead_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_sessions_occurrence_id_start_utc",
                table: "event_sessions",
                columns: new[] { "occurrence_id", "start_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_zones_lead_member_id",
                table: "event_zones",
                column: "lead_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_zones_occurrence_id_title_en",
                table: "event_zones",
                columns: new[] { "occurrence_id", "title_en" });

            migrationBuilder.AddForeignKey(
                name: "fk_group_events_event_composition_series_composition_series_id",
                table: "group_events",
                column: "composition_series_id",
                principalTable: "event_composition_series",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_group_events_group_events_parent_event_id",
                table: "group_events",
                column: "parent_event_id",
                principalTable: "group_events",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_group_events_members_accountable_owner_member_id",
                table: "group_events",
                column: "accountable_owner_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_group_events_event_composition_series_composition_series_id",
                table: "group_events");

            migrationBuilder.DropForeignKey(
                name: "fk_group_events_group_events_parent_event_id",
                table: "group_events");

            migrationBuilder.DropForeignKey(
                name: "fk_group_events_members_accountable_owner_member_id",
                table: "group_events");

            migrationBuilder.DropTable(
                name: "event_approval_decisions");

            migrationBuilder.DropTable(
                name: "event_idempotency_records");

            migrationBuilder.DropTable(
                name: "event_plan_snapshots");

            migrationBuilder.DropTable(
                name: "event_program_items");

            migrationBuilder.DropTable(
                name: "event_role_assignments");

            migrationBuilder.DropTable(
                name: "event_composition_series");

            migrationBuilder.DropTable(
                name: "event_service_slots");

            migrationBuilder.DropTable(
                name: "event_fact_sets");

            migrationBuilder.DropTable(
                name: "event_sessions");

            migrationBuilder.DropTable(
                name: "event_zones");

            migrationBuilder.DropTable(
                name: "event_composition_occurrences");

            migrationBuilder.DropIndex(
                name: "ix_group_events_accountable_owner_member_id",
                table: "group_events");

            migrationBuilder.DropIndex(
                name: "ix_group_events_composition_series_id",
                table: "group_events");

            migrationBuilder.DropIndex(
                name: "ix_group_events_parent_event_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "accountable_owner_member_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "active_plan_version",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "composition_series_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "governance_mode",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "parent_event_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "plan_concurrency_token",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "sponsorship_status",
                table: "group_events");
        }
    }
}
