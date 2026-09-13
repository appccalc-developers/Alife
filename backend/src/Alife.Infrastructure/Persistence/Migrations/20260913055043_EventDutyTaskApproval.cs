using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EventDutyTaskApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_event_operations_tasks_assigned_member_id",
                table: "event_operations_tasks");

            migrationBuilder.AddColumn<int>(
                name: "approval_round",
                table: "event_operations_tasks",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "approval_status",
                table: "event_operations_tasks",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "reviewer_member_id",
                table: "event_operations_tasks",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "source_id",
                table: "event_operations_tasks",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_type",
                table: "event_operations_tasks",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_version",
                table: "event_operations_tasks",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "event_task_approval_actions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_task_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    round = table.Column<int>(type: "int", nullable: false),
                    action = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reviewer_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    snapshot_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_task_approval_actions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_task_approval_actions_event_tasks_event_task_id",
                        column: x => x.event_task_id,
                        principalTable: "event_operations_tasks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_tasks_assigned_member_id_status",
                table: "event_operations_tasks",
                columns: new[] { "assigned_member_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_tasks_reviewer_member_id_approval_status",
                table: "event_operations_tasks",
                columns: new[] { "reviewer_member_id", "approval_status" });

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_tasks_source_type_source_id",
                table: "event_operations_tasks",
                columns: new[] { "source_type", "source_id" });

            migrationBuilder.CreateIndex(
                name: "ix_event_task_approval_actions_event_task_id_round_action",
                table: "event_task_approval_actions",
                columns: new[] { "event_task_id", "round", "action" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_event_operations_tasks_members_reviewer_member_id",
                table: "event_operations_tasks",
                column: "reviewer_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            // Preserve completed legacy tasks and never invent review history. Only the existing
            // condition FK proves a historical source association; titles are not evidence.
            migrationBuilder.Sql("""
                UPDATE t SET source_type = N'packageCondition', source_id = c.id,
                    source_version = REPLACE(CONVERT(nvarchar(36), c.event_package_id), N'-', N'')
                FROM event_operations_tasks t
                INNER JOIN event_package_conditions c ON c.readiness_task_id = t.id;
                UPDATE t SET source_type = N'packageReview', source_id = o.id,
                    source_version = N'legacy-occurrence-reference'
                FROM event_operations_tasks t
                INNER JOIN event_composition_occurrences o ON o.event_id = t.event_id
                CROSS APPLY OPENJSON(CASE WHEN ISJSON(o.exceptions_json) = 1 THEN o.exceptions_json ELSE N'[]' END)
                    WITH (review_task_id nvarchar(36) '$.reviewTaskId') j
                WHERE TRY_CONVERT(uniqueidentifier, j.review_task_id) = t.id AND t.source_type IS NULL;
                UPDATE event_operations_tasks SET approval_status = 1
                WHERE requires_approval = 1 AND status NOT IN (3, 4) AND source_type IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_event_operations_tasks_members_reviewer_member_id",
                table: "event_operations_tasks");

            migrationBuilder.DropTable(
                name: "event_task_approval_actions");

            migrationBuilder.DropIndex(
                name: "ix_event_operations_tasks_assigned_member_id_status",
                table: "event_operations_tasks");

            migrationBuilder.DropIndex(
                name: "ix_event_operations_tasks_reviewer_member_id_approval_status",
                table: "event_operations_tasks");

            migrationBuilder.DropIndex(
                name: "ix_event_operations_tasks_source_type_source_id",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "approval_round",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "approval_status",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "reviewer_member_id",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "source_id",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "source_type",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "source_version",
                table: "event_operations_tasks");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_tasks_assigned_member_id",
                table: "event_operations_tasks",
                column: "assigned_member_id");
        }
    }
}
