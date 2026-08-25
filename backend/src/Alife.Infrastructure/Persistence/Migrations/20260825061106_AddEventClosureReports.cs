using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventClosureReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_closure_reports",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    summary_en = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    summary_zh = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    attendance_notes = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    finance_notes = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    incident_notes = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    follow_up_notes = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    reusable_learnings_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    leader_confirmed = table.Column<bool>(type: "bit", nullable: false),
                    confirmed_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    confirmed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_closure_reports", x => x.event_id);
                    table.ForeignKey(
                        name: "fk_event_closure_reports_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_closure_reports_members_confirmed_by_member_id",
                        column: x => x.confirmed_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_closure_reports_confirmed_by_member_id",
                table: "event_closure_reports",
                column: "confirmed_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_closure_reports_leader_confirmed_updated_utc",
                table: "event_closure_reports",
                columns: new[] { "leader_confirmed", "updated_utc" });

            migrationBuilder.Sql("""
                DECLARE @closure_plans TABLE (event_id uniqueidentifier PRIMARY KEY);
                INSERT INTO @closure_plans (event_id)
                SELECT e.id
                FROM group_events e
                INNER JOIN event_plans p ON p.event_id = e.id
                WHERE e.is_deleted = 0
                  AND NOT EXISTS (SELECT 1 FROM event_module_instances m
                                  WHERE m.event_plan_id = p.id AND m.module_key = N'closure');

                INSERT INTO event_module_instances
                    (id, event_plan_id, module_key, module_version, is_required, status, configuration_json,
                     added_by_member_id, created_utc, updated_utc)
                SELECT NEWID(), e.id, N'closure', 1,
                    CASE WHEN e.end_date <= SYSUTCDATETIME() THEN 1 ELSE 0 END,
                    0, N'{}', e.created_by_member_id, e.created_utc, SYSUTCDATETIME()
                FROM group_events e INNER JOIN @closure_plans selected ON selected.event_id = e.id;

                INSERT INTO event_readiness_gates
                    (id, event_plan_id, module_instance_id, gate_key, name_en, name_zh,
                     is_required, status, explanation_json, updated_utc)
                SELECT NEWID(), m.event_plan_id, m.id, N'closure.configured',
                    N'Closure report confirmed', N'活动总结已确认',
                    m.is_required, 0, N'{}', m.updated_utc
                FROM event_module_instances m
                INNER JOIN @closure_plans selected ON selected.event_id = m.event_plan_id
                WHERE m.module_key = N'closure';

                UPDATE p SET p.current_revision = p.current_revision + 1, p.updated_utc = SYSUTCDATETIME()
                FROM event_plans p INNER JOIN @closure_plans selected ON selected.event_id = p.event_id;

                INSERT INTO event_plan_revisions
                    (id, event_plan_id, revision, schema_version, facts_json, composition_json,
                     change_reason, created_by_member_id, created_utc)
                SELECT NEWID(), p.id, p.current_revision, 1, e.event_data_json,
                    CONCAT(N'{"schemaVersion":1,"modules":',
                        (SELECT m.module_key AS [key], m.module_version AS [version]
                         FROM event_module_instances m WHERE m.event_plan_id = p.id AND m.is_required = 1
                         ORDER BY m.module_key FOR JSON PATH),
                        N',"occurrences":["main"]}'),
                    N'Closure module added during closure-report migration', e.created_by_member_id, p.updated_utc
                FROM event_plans p
                INNER JOIN group_events e ON e.id = p.event_id
                INNER JOIN @closure_plans selected ON selected.event_id = p.event_id;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM event_plan_revisions
                WHERE change_reason = N'Closure module added during closure-report migration';

                UPDATE p SET current_revision = COALESCE(
                    (SELECT MAX(r.revision) FROM event_plan_revisions r WHERE r.event_plan_id = p.id), 1)
                FROM event_plans p
                WHERE EXISTS (SELECT 1 FROM event_module_instances m
                              WHERE m.event_plan_id = p.id AND m.module_key = N'closure');

                DELETE FROM event_readiness_gates WHERE gate_key = N'closure.configured';
                DELETE FROM event_module_instances WHERE module_key = N'closure';
                """);

            migrationBuilder.DropTable(
                name: "event_closure_reports");
        }
    }
}
