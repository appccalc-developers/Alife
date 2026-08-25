using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddComposableEventPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_plans",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    current_revision = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_plans", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_plans_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_module_instances",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_plan_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    module_key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    module_version = table.Column<int>(type: "int", nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    configuration_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    added_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_module_instances", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_module_instances_event_plans_event_plan_id",
                        column: x => x.event_plan_id,
                        principalTable: "event_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_module_instances_members_added_by_member_id",
                        column: x => x.added_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_occurrences",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_plan_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    occurrence_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    time_zone_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_occurrences", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_occurrences_event_plans_event_plan_id",
                        column: x => x.event_plan_id,
                        principalTable: "event_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_plan_revisions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_plan_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    revision = table.Column<int>(type: "int", nullable: false),
                    schema_version = table.Column<int>(type: "int", nullable: false),
                    facts_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    composition_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    change_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_plan_revisions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_plan_revisions_event_plans_event_plan_id",
                        column: x => x.event_plan_id,
                        principalTable: "event_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_plan_revisions_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_decision_records",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_plan_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    module_instance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    decision_key = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    requested_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    decided_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    request_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    decision_notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    requested_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    decided_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_decision_records", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_decision_records_event_module_instances_module_instance_id",
                        column: x => x.module_instance_id,
                        principalTable: "event_module_instances",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_decision_records_event_plans_event_plan_id",
                        column: x => x.event_plan_id,
                        principalTable: "event_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_decision_records_members_decided_by_member_id",
                        column: x => x.decided_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_decision_records_members_requested_by_member_id",
                        column: x => x.requested_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_readiness_gates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_plan_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    module_instance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    gate_key = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    explanation_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_readiness_gates", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_readiness_gates_event_module_instances_module_instance_id",
                        column: x => x.module_instance_id,
                        principalTable: "event_module_instances",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_readiness_gates_event_plans_event_plan_id",
                        column: x => x.event_plan_id,
                        principalTable: "event_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_decision_records_decided_by_member_id",
                table: "event_decision_records",
                column: "decided_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_decision_records_event_plan_id_decision_key_requested_utc",
                table: "event_decision_records",
                columns: new[] { "event_plan_id", "decision_key", "requested_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_decision_records_module_instance_id",
                table: "event_decision_records",
                column: "module_instance_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_decision_records_requested_by_member_id",
                table: "event_decision_records",
                column: "requested_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_module_instances_added_by_member_id",
                table: "event_module_instances",
                column: "added_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_module_instances_event_plan_id_module_key",
                table: "event_module_instances",
                columns: new[] { "event_plan_id", "module_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_occurrences_event_plan_id_occurrence_key",
                table: "event_occurrences",
                columns: new[] { "event_plan_id", "occurrence_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_plan_revisions_created_by_member_id",
                table: "event_plan_revisions",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_plan_revisions_event_plan_id_revision",
                table: "event_plan_revisions",
                columns: new[] { "event_plan_id", "revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_plans_event_id",
                table: "event_plans",
                column: "event_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_plans_status_updated_utc",
                table: "event_plans",
                columns: new[] { "status", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_readiness_gates_event_plan_id_gate_key",
                table: "event_readiness_gates",
                columns: new[] { "event_plan_id", "gate_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_readiness_gates_module_instance_id",
                table: "event_readiness_gates",
                column: "module_instance_id");

            // Replace the old fixed workflow contract for every existing, non-deleted event.
            // The original event_data_json remains the canonical compatibility snapshot, so
            // rolling the migration back removes only the composed projection, not event data.
            migrationBuilder.Sql("""
                INSERT INTO event_plans (id, event_id, current_revision, status, created_utc, updated_utc)
                SELECT e.id, e.id, 1, 0, e.created_utc, e.updated_utc
                FROM group_events e
                WHERE e.is_deleted = 0
                  AND NOT EXISTS (SELECT 1 FROM event_plans p WHERE p.event_id = e.id);

                INSERT INTO event_occurrences
                    (id, event_plan_id, occurrence_key, name_en, name_zh, start_utc, end_utc, time_zone_id, sort_order)
                SELECT NEWID(), e.id, N'main', e.title_en, e.title_zh, e.start_date, e.end_date,
                    COALESCE(NULLIF(JSON_VALUE(f.safe_json, '$.timeZoneId'), N''), N'UTC'), 1
                FROM group_events e
                CROSS APPLY (SELECT CASE WHEN ISJSON(e.event_data_json) = 1 THEN e.event_data_json ELSE N'{}' END) f(safe_json)
                WHERE e.is_deleted = 0
                  AND EXISTS (SELECT 1 FROM event_plans p WHERE p.event_id = e.id)
                  AND NOT EXISTS (SELECT 1 FROM event_occurrences o WHERE o.event_plan_id = e.id AND o.occurrence_key = N'main');

                INSERT INTO event_module_instances
                    (id, event_plan_id, module_key, module_version, is_required, status, configuration_json,
                     added_by_member_id, created_utc, updated_utc)
                SELECT NEWID(), e.id, module.module_key, 1, 1,
                    CASE WHEN module.module_key = N'core'
                                   AND (NULLIF(LTRIM(RTRIM(e.title_en)), N'') IS NOT NULL
                                        OR NULLIF(LTRIM(RTRIM(e.title_zh)), N'') IS NOT NULL)
                                   AND e.end_date > e.start_date
                                   AND (JSON_VALUE(f.safe_json, '$.visibility') IS NULL
                                        OR JSON_VALUE(f.safe_json, '$.visibility') IN (N'groupVisible', N'churchVisible', N'public'))
                              THEN 2 ELSE 0 END,
                    N'{}', e.created_by_member_id, e.created_utc, e.updated_utc
                FROM group_events e
                CROSS APPLY (SELECT CASE WHEN ISJSON(e.event_data_json) = 1 THEN e.event_data_json ELSE N'{}' END) f(safe_json)
                CROSS APPLY (VALUES
                    (N'core', 1),
                    (N'communications', 1),
                    (N'venue', CASE WHEN NULLIF(JSON_VALUE(f.safe_json, '$.locationName.en'), N'') IS NOT NULL
                                         OR NULLIF(JSON_VALUE(f.safe_json, '$.locationName.zh'), N'') IS NOT NULL THEN 1 ELSE 0 END),
                    (N'registration', CASE WHEN TRY_CONVERT(decimal(18,2), JSON_VALUE(f.safe_json, '$.maxCapacity')) > 0
                                                OR NULLIF(JSON_VALUE(f.safe_json, '$.registrationDeadline'), N'') IS NOT NULL THEN 1 ELSE 0 END),
                    (N'finance', CASE WHEN TRY_CONVERT(decimal(18,2), JSON_VALUE(f.safe_json, '$.baseFeePerAdult')) > 0
                                          OR TRY_CONVERT(decimal(18,2), JSON_VALUE(f.safe_json, '$.baseFeePerChild')) > 0
                                          OR EXISTS (SELECT 1 FROM OPENJSON(COALESCE(JSON_QUERY(f.safe_json, '$.optionalActivities'), N'[]')) option_json
                                                     WHERE TRY_CONVERT(decimal(18,2), JSON_VALUE(option_json.value, '$.extraFee')) > 0)
                                     THEN 1 ELSE 0 END),
                    (N'ram', CASE WHEN COALESCE(JSON_QUERY(f.safe_json, '$.hardConstraints'), N'[]') <> N'[]'
                                      OR EXISTS (SELECT 1 FROM event_ram_assessments r
                                                 WHERE r.event_id = e.id
                                                   AND (JSON_VALUE(r.ram_data_json, '$.isOuting') = N'true'
                                                        OR COALESCE(JSON_QUERY(r.ram_data_json, '$.hazards'), N'[]') <> N'[]'
                                                        OR COALESCE(JSON_QUERY(r.ram_data_json, '$.emergencyContacts'), N'[]') <> N'[]'))
                                 THEN 1 ELSE 0 END)
                ) module(module_key, selected)
                WHERE e.is_deleted = 0
                  AND module.selected = 1
                  AND EXISTS (SELECT 1 FROM event_plans p WHERE p.event_id = e.id)
                  AND NOT EXISTS (SELECT 1 FROM event_module_instances m WHERE m.event_plan_id = e.id AND m.module_key = module.module_key);

                INSERT INTO event_readiness_gates
                    (id, event_plan_id, module_instance_id, gate_key, name_en, name_zh,
                     is_required, status, explanation_json, updated_utc)
                SELECT NEWID(), m.event_plan_id, m.id, CONCAT(m.module_key, N'.configured'),
                    CASE m.module_key
                        WHEN N'core' THEN N'Basic information confirmed'
                        WHEN N'communications' THEN N'Communication material ready'
                        WHEN N'venue' THEN N'Venue confirmed'
                        WHEN N'registration' THEN N'Registration ready'
                        WHEN N'finance' THEN N'Finance setup confirmed'
                        WHEN N'ram' THEN N'Risk assessment approved'
                        ELSE CONCAT(m.module_key, N' ready') END,
                    CASE m.module_key
                        WHEN N'core' THEN N'基本资料已确认'
                        WHEN N'communications' THEN N'通知与海报已准备'
                        WHEN N'venue' THEN N'场地已确认'
                        WHEN N'registration' THEN N'报名已准备'
                        WHEN N'finance' THEN N'费用设置已确认'
                        WHEN N'ram' THEN N'风险评估已批准'
                        ELSE CONCAT(m.module_key, N' 已准备') END,
                    1, CASE WHEN m.status = 2 THEN 1 ELSE 0 END, N'{}', m.updated_utc
                FROM event_module_instances m
                WHERE NOT EXISTS (SELECT 1 FROM event_readiness_gates g
                                  WHERE g.event_plan_id = m.event_plan_id AND g.gate_key = CONCAT(m.module_key, N'.configured'));

                INSERT INTO event_plan_revisions
                    (id, event_plan_id, revision, schema_version, facts_json, composition_json,
                     change_reason, created_by_member_id, created_utc)
                SELECT NEWID(), e.id, 1, 1, e.event_data_json,
                    CONCAT(N'{"schemaVersion":1,"modules":',
                        (SELECT m.module_key AS [key], m.module_version AS [version]
                         FROM event_module_instances m
                         WHERE m.event_plan_id = e.id AND m.is_required = 1
                         ORDER BY m.module_key
                         FOR JSON PATH),
                        N',"occurrences":["main"]}'),
                    N'Legacy event converted to composed plan', e.created_by_member_id, e.updated_utc
                FROM group_events e
                WHERE e.is_deleted = 0
                  AND EXISTS (SELECT 1 FROM event_plans p WHERE p.event_id = e.id)
                  AND NOT EXISTS (SELECT 1 FROM event_plan_revisions r WHERE r.event_plan_id = e.id AND r.revision = 1);

                INSERT INTO event_decision_records
                    (id, event_plan_id, module_instance_id, decision_key, status,
                     requested_by_member_id, decided_by_member_id, request_json, decision_notes,
                     requested_utc, decided_utc)
                SELECT NEWID(), r.event_id, m.id, N'ram.approval',
                    CASE WHEN r.status = 2 THEN 1 ELSE 0 END,
                    COALESCE(r.submitted_by_member_id, e.created_by_member_id),
                    CASE WHEN r.status = 2 THEN COALESCE(r.approved_by_member_id, e.created_by_member_id) ELSE NULL END,
                    CONCAT(N'{"migrated":true,"planRevision":1,"ramUpdatedUtc":"',
                           CONVERT(nvarchar(33), r.updated_utc, 127), N'"}'),
                    N'Migrated from the previous RAM review status.',
                    COALESCE(r.submitted_utc, r.updated_utc),
                    CASE WHEN r.status = 2 THEN COALESCE(r.approved_utc, r.updated_utc) ELSE NULL END
                FROM event_ram_assessments r
                INNER JOIN group_events e ON e.id = r.event_id AND e.is_deleted = 0
                INNER JOIN event_module_instances m ON m.event_plan_id = r.event_id AND m.module_key = N'ram'
                WHERE r.status IN (1, 2)
                  AND NOT EXISTS (
                      SELECT 1 FROM event_decision_records d
                      WHERE d.event_plan_id = r.event_id AND d.decision_key = N'ram.approval'
                  );

                IF EXISTS (
                    SELECT 1
                    FROM group_events e
                    WHERE e.is_deleted = 0
                      AND NOT EXISTS (SELECT 1 FROM event_plans p WHERE p.event_id = e.id)
                )
                    THROW 51000, 'Composable event plan migration did not cover every active event.', 1;

                IF EXISTS (
                    SELECT 1
                    FROM group_events e
                    WHERE e.is_deleted = 0
                      AND (
                          NOT EXISTS (SELECT 1 FROM event_occurrences o WHERE o.event_plan_id = e.id)
                          OR NOT EXISTS (SELECT 1 FROM event_module_instances m WHERE m.event_plan_id = e.id AND m.module_key = N'core' AND m.is_required = 1)
                          OR NOT EXISTS (SELECT 1 FROM event_module_instances m WHERE m.event_plan_id = e.id AND m.module_key = N'communications' AND m.is_required = 1)
                          OR NOT EXISTS (SELECT 1 FROM event_plan_revisions r WHERE r.event_plan_id = e.id AND r.revision = 1)
                      )
                )
                    THROW 51001, 'A migrated event is missing its core composed plan structure.', 1;

                IF EXISTS (
                    SELECT 1
                    FROM event_ram_assessments r
                    INNER JOIN group_events e ON e.id = r.event_id AND e.is_deleted = 0
                    WHERE r.status IN (1, 2)
                      AND NOT EXISTS (
                          SELECT 1 FROM event_decision_records d
                          WHERE d.event_plan_id = r.event_id AND d.decision_key = N'ram.approval'
                      )
                )
                    THROW 51002, 'A submitted or approved RAM is missing its migrated decision record.', 1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_decision_records");

            migrationBuilder.DropTable(
                name: "event_occurrences");

            migrationBuilder.DropTable(
                name: "event_plan_revisions");

            migrationBuilder.DropTable(
                name: "event_readiness_gates");

            migrationBuilder.DropTable(
                name: "event_module_instances");

            migrationBuilder.DropTable(
                name: "event_plans");
        }
    }
}
