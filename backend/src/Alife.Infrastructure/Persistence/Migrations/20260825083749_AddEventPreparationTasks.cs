using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventPreparationTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_preparation_tasks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    module_key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    title_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    title_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    description_en = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    description_zh = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    assigned_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    due_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_preparation_tasks", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_preparation_tasks_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_preparation_tasks_members_assigned_member_id",
                        column: x => x.assigned_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_preparation_tasks_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_preparation_tasks_members_updated_by_member_id",
                        column: x => x.updated_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_preparation_task_dependencies",
                columns: table => new
                {
                    task_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    depends_on_task_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_preparation_task_dependencies", x => new { x.task_id, x.depends_on_task_id });
                    table.ForeignKey(
                        name: "fk_event_preparation_task_dependencies_event_preparation_tasks_depends_on_task_id",
                        column: x => x.depends_on_task_id,
                        principalTable: "event_preparation_tasks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_preparation_task_dependencies_event_preparation_tasks_task_id",
                        column: x => x.task_id,
                        principalTable: "event_preparation_tasks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_preparation_task_dependencies_depends_on_task_id",
                table: "event_preparation_task_dependencies",
                column: "depends_on_task_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_preparation_tasks_assigned_member_id_status_due_utc",
                table: "event_preparation_tasks",
                columns: new[] { "assigned_member_id", "status", "due_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_preparation_tasks_created_by_member_id",
                table: "event_preparation_tasks",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_preparation_tasks_event_id_status_due_utc",
                table: "event_preparation_tasks",
                columns: new[] { "event_id", "status", "due_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_preparation_tasks_updated_by_member_id",
                table: "event_preparation_tasks",
                column: "updated_by_member_id");

            // Every active composed plan exposes task coordination, but it remains optional
            // until a leader marks at least one preparation task as required.
            migrationBuilder.Sql("""
                DECLARE @task_plans TABLE (event_plan_id uniqueidentifier PRIMARY KEY);
                INSERT INTO @task_plans (event_plan_id)
                SELECT p.id
                FROM event_plans p
                INNER JOIN group_events e ON e.id = p.event_id AND e.is_deleted = 0
                WHERE NOT EXISTS (
                    SELECT 1 FROM event_module_instances m
                    WHERE m.event_plan_id = p.id AND m.module_key = N'tasks'
                );

                INSERT INTO event_module_instances
                    (id, event_plan_id, module_key, module_version, is_required, status, configuration_json,
                     added_by_member_id, created_utc, updated_utc)
                SELECT NEWID(), p.id, N'tasks', 1, 0, 0, N'{}', e.created_by_member_id, p.updated_utc, p.updated_utc
                FROM event_plans p
                INNER JOIN group_events e ON e.id = p.event_id
                INNER JOIN @task_plans selected ON selected.event_plan_id = p.id;

                INSERT INTO event_readiness_gates
                    (id, event_plan_id, module_instance_id, gate_key, name_en, name_zh,
                     is_required, status, explanation_json, updated_utc)
                SELECT NEWID(), m.event_plan_id, m.id, N'tasks.completed',
                    N'Required preparation tasks completed', N'必要筹备任务已完成',
                    0, 0, N'{}', m.updated_utc
                FROM event_module_instances m
                INNER JOIN @task_plans selected ON selected.event_plan_id = m.event_plan_id
                WHERE m.module_key = N'tasks';

                UPDATE p
                SET current_revision = current_revision + 1, updated_utc = SYSUTCDATETIME()
                FROM event_plans p INNER JOIN @task_plans selected ON selected.event_plan_id = p.id;

                INSERT INTO event_plan_revisions
                    (id, event_plan_id, revision, schema_version, facts_json, composition_json,
                     change_reason, created_by_member_id, created_utc)
                SELECT NEWID(), p.id, p.current_revision, 1, e.event_data_json,
                    CONCAT(N'{"schemaVersion":1,"modules":',
                        (SELECT m.module_key AS [key], m.module_version AS [version]
                         FROM event_module_instances m
                         WHERE m.event_plan_id = p.id AND m.is_required = 1
                         ORDER BY m.module_key FOR JSON PATH),
                        N',"occurrences":',
                        COALESCE((SELECT CONCAT(N'[', STRING_AGG(
                            CONCAT(N'"', STRING_ESCAPE(o.occurrence_key, 'json'), N'"'), N','), N']')
                            FROM event_occurrences o WHERE o.event_plan_id = p.id), N'[]'), N'}'),
                    N'Preparation task coordination added during migration', e.created_by_member_id, p.updated_utc
                FROM event_plans p
                INNER JOIN group_events e ON e.id = p.event_id
                INNER JOIN @task_plans selected ON selected.event_plan_id = p.id;

                IF EXISTS (
                    SELECT 1 FROM event_plans p
                    INNER JOIN group_events e ON e.id = p.event_id AND e.is_deleted = 0
                    WHERE NOT EXISTS (SELECT 1 FROM event_module_instances m WHERE m.event_plan_id = p.id AND m.module_key = N'tasks')
                ) THROW 51003, 'An active event plan is missing task coordination.', 1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM event_plan_revisions
                WHERE change_reason = N'Preparation task coordination added during migration';

                UPDATE p
                SET current_revision = COALESCE((SELECT MAX(r.revision) FROM event_plan_revisions r WHERE r.event_plan_id = p.id), 1),
                    updated_utc = SYSUTCDATETIME()
                FROM event_plans p
                WHERE EXISTS (SELECT 1 FROM event_module_instances m WHERE m.event_plan_id = p.id AND m.module_key = N'tasks');

                DELETE FROM event_readiness_gates WHERE gate_key = N'tasks.completed';
                DELETE FROM event_module_instances WHERE module_key = N'tasks';
                """);

            migrationBuilder.DropTable(
                name: "event_preparation_task_dependencies");

            migrationBuilder.DropTable(
                name: "event_preparation_tasks");
        }
    }
}
