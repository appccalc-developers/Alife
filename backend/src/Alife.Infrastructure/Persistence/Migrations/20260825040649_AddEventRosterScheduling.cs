using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventRosterScheduling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_roster_shifts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role_key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    required_people = table.Column<int>(type: "int", nullable: false),
                    required_labels_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_roster_shifts", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_roster_shifts_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "group_member_scheduling_profiles",
                columns: table => new
                {
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    preferred_role_keys_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    unavailable_windows_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    max_assignments_per_day = table.Column<int>(type: "int", nullable: false),
                    self_notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    manager_labels_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    manager_notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    member_updated_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    manager_updated_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_group_member_scheduling_profiles", x => new { x.group_id, x.member_id });
                    table.ForeignKey(
                        name: "fk_group_member_scheduling_profiles_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_group_member_scheduling_profiles_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_roster_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    shift_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    confirmed_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    based_on_smart_suggestion = table.Column<bool>(type: "bit", nullable: false),
                    confirmation_notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    confirmed_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_roster_assignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_roster_assignments_event_roster_shifts_shift_id",
                        column: x => x.shift_id,
                        principalTable: "event_roster_shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_roster_assignments_members_confirmed_by_member_id",
                        column: x => x.confirmed_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_roster_assignments_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_roster_assignments_confirmed_by_member_id",
                table: "event_roster_assignments",
                column: "confirmed_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_roster_assignments_member_id_status_confirmed_utc",
                table: "event_roster_assignments",
                columns: new[] { "member_id", "status", "confirmed_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_roster_assignments_shift_id_member_id",
                table: "event_roster_assignments",
                columns: new[] { "shift_id", "member_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_roster_shifts_event_id_start_utc_role_key",
                table: "event_roster_shifts",
                columns: new[] { "event_id", "start_utc", "role_key" });

            migrationBuilder.CreateIndex(
                name: "ix_group_member_scheduling_profiles_group_id_manager_updated_utc",
                table: "group_member_scheduling_profiles",
                columns: new[] { "group_id", "manager_updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_group_member_scheduling_profiles_member_id",
                table: "group_member_scheduling_profiles",
                column: "member_id");

            migrationBuilder.Sql("""
                DECLARE @roster_plans TABLE (event_id uniqueidentifier PRIMARY KEY);
                INSERT INTO @roster_plans (event_id)
                SELECT e.id
                FROM group_events e
                CROSS APPLY (SELECT CASE WHEN ISJSON(e.event_data_json) = 1 THEN e.event_data_json ELSE N'{}' END) f(safe_json)
                WHERE e.is_deleted = 0
                  AND (JSON_VALUE(f.safe_json, '$.requiresRoster') = N'true'
                       OR COALESCE(JSON_QUERY(f.safe_json, '$.rosterRoles'), N'[]') <> N'[]')
                  AND EXISTS (SELECT 1 FROM event_plans p WHERE p.event_id = e.id)
                  AND NOT EXISTS (SELECT 1 FROM event_module_instances m WHERE m.event_plan_id = e.id AND m.module_key = N'roster');

                INSERT INTO event_module_instances
                    (id, event_plan_id, module_key, module_version, is_required, status, configuration_json,
                     added_by_member_id, created_utc, updated_utc)
                SELECT NEWID(), e.id, N'roster', 1, 1, 0, N'{}', e.created_by_member_id, e.created_utc, e.updated_utc
                FROM group_events e INNER JOIN @roster_plans selected ON selected.event_id = e.id;

                INSERT INTO event_readiness_gates
                    (id, event_plan_id, module_instance_id, gate_key, name_en, name_zh,
                     is_required, status, explanation_json, updated_utc)
                SELECT NEWID(), m.event_plan_id, m.id, N'roster.configured',
                    N'Volunteer roster confirmed', N'同工排班已确认', 1, 0, N'{}', m.updated_utc
                FROM event_module_instances m INNER JOIN @roster_plans selected ON selected.event_id = m.event_plan_id
                WHERE m.module_key = N'roster';

                UPDATE p SET p.current_revision = p.current_revision + 1, p.updated_utc = SYSUTCDATETIME()
                FROM event_plans p INNER JOIN @roster_plans selected ON selected.event_id = p.event_id;

                INSERT INTO event_plan_revisions
                    (id, event_plan_id, revision, schema_version, facts_json, composition_json,
                     change_reason, created_by_member_id, created_utc)
                SELECT NEWID(), p.id, p.current_revision, 1, e.event_data_json,
                    CONCAT(N'{"schemaVersion":1,"modules":',
                        (SELECT m.module_key AS [key], m.module_version AS [version]
                         FROM event_module_instances m WHERE m.event_plan_id = p.id AND m.is_required = 1
                         ORDER BY m.module_key FOR JSON PATH),
                        N',"occurrences":["main"]}'),
                    N'Roster module added during scheduling migration', e.created_by_member_id, p.updated_utc
                FROM event_plans p
                INNER JOIN group_events e ON e.id = p.event_id
                INNER JOIN @roster_plans selected ON selected.event_id = p.event_id;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_roster_assignments");

            migrationBuilder.DropTable(
                name: "group_member_scheduling_profiles");

            migrationBuilder.DropTable(
                name: "event_roster_shifts");
        }
    }
}
