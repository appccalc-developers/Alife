using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventOperationsCore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_event_program_items_session_id_sort_order",
                table: "event_program_items");

            migrationBuilder.AddColumn<int>(
                name: "status",
                table: "event_sessions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "program_item_id",
                table: "event_service_slots",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "declined_utc",
                table: "event_role_assignments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "status",
                table: "event_role_assignments",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "description_en",
                table: "event_program_items",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "description_zh",
                table: "event_program_items",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "title_en",
                table: "event_program_items",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "title_zh",
                table: "event_program_items",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "programme_concurrency_token",
                table: "event_composition_occurrences",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "roster_concurrency_token",
                table: "event_composition_occurrences",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "event_operations_roster_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    service_slot_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    assigned_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    replaces_assignment_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    confirmed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    declined_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ended_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_operations_roster_assignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_operations_roster_assignments_event_operations_roster_assignments_replaces_assignment_id",
                        column: x => x.replaces_assignment_id,
                        principalTable: "event_operations_roster_assignments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_operations_roster_assignments_event_service_slots_service_slot_id",
                        column: x => x.service_slot_id,
                        principalTable: "event_service_slots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_operations_roster_assignments_members_assigned_by_member_id",
                        column: x => x.assigned_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_operations_roster_assignments_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_operations_roster_availability",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    service_slot_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_operations_roster_availability", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_operations_roster_availability_event_service_slots_service_slot_id",
                        column: x => x.service_slot_id,
                        principalTable: "event_service_slots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_operations_roster_availability_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_operations_tasks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    workflow_step_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    title_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    title_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    description_en = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    description_zh = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    assigned_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    status = table.Column<int>(type: "int", nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    requires_approval = table.Column<bool>(type: "bit", nullable: false),
                    is_restricted = table.Column<bool>(type: "bit", nullable: false),
                    due_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    completed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_operations_tasks", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_operations_tasks_event_workflow_steps_workflow_step_id",
                        column: x => x.workflow_step_id,
                        principalTable: "event_workflow_steps",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_operations_tasks_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_operations_tasks_members_assigned_member_id",
                        column: x => x.assigned_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_operations_team_members",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    invited_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    joined_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    declined_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ended_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_operations_team_members", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_operations_team_members_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_operations_team_members_members_invited_by_member_id",
                        column: x => x.invited_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_operations_team_members_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_operations_task_blockers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_task_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    resolved_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    resolution = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    resolved_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_operations_task_blockers", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_operations_task_blockers_event_operations_tasks_event_task_id",
                        column: x => x.event_task_id,
                        principalTable: "event_operations_tasks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_operations_task_blockers_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_operations_task_blockers_members_resolved_by_member_id",
                        column: x => x.resolved_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_operations_task_dependencies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_task_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    depends_on_event_task_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    dependency_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_operations_task_dependencies", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_operations_task_dependencies_event_operations_tasks_depends_on_event_task_id",
                        column: x => x.depends_on_event_task_id,
                        principalTable: "event_operations_tasks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_operations_task_dependencies_event_operations_tasks_event_task_id",
                        column: x => x.event_task_id,
                        principalTable: "event_operations_tasks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_service_slots_program_item_id",
                table: "event_service_slots",
                column: "program_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_program_items_session_id_sort_order",
                table: "event_program_items",
                columns: new[] { "session_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_roster_assignments_assigned_by_member_id",
                table: "event_operations_roster_assignments",
                column: "assigned_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_roster_assignments_member_id",
                table: "event_operations_roster_assignments",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_roster_assignments_replaces_assignment_id",
                table: "event_operations_roster_assignments",
                column: "replaces_assignment_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_roster_assignments_service_slot_id_member_id",
                table: "event_operations_roster_assignments",
                columns: new[] { "service_slot_id", "member_id" },
                unique: true,
                filter: "[ended_utc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_roster_availability_member_id",
                table: "event_operations_roster_availability",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_roster_availability_service_slot_id_member_id",
                table: "event_operations_roster_availability",
                columns: new[] { "service_slot_id", "member_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_task_blockers_created_by_member_id",
                table: "event_operations_task_blockers",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_task_blockers_event_task_id",
                table: "event_operations_task_blockers",
                column: "event_task_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_task_blockers_resolved_by_member_id",
                table: "event_operations_task_blockers",
                column: "resolved_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_task_dependencies_depends_on_event_task_id",
                table: "event_operations_task_dependencies",
                column: "depends_on_event_task_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_task_dependencies_event_task_id_depends_on_event_task_id",
                table: "event_operations_task_dependencies",
                columns: new[] { "event_task_id", "depends_on_event_task_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_tasks_assigned_member_id",
                table: "event_operations_tasks",
                column: "assigned_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_tasks_event_id_status_due_utc",
                table: "event_operations_tasks",
                columns: new[] { "event_id", "status", "due_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_tasks_workflow_step_id",
                table: "event_operations_tasks",
                column: "workflow_step_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_team_members_event_id_member_id",
                table: "event_operations_team_members",
                columns: new[] { "event_id", "member_id" },
                unique: true,
                filter: "[ended_utc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_team_members_invited_by_member_id",
                table: "event_operations_team_members",
                column: "invited_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_team_members_member_id",
                table: "event_operations_team_members",
                column: "member_id");

            migrationBuilder.AddForeignKey(
                name: "fk_event_service_slots_event_program_items_program_item_id",
                table: "event_service_slots",
                column: "program_item_id",
                principalTable: "event_program_items",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_event_service_slots_event_program_items_program_item_id",
                table: "event_service_slots");

            migrationBuilder.DropTable(
                name: "event_operations_roster_assignments");

            migrationBuilder.DropTable(
                name: "event_operations_roster_availability");

            migrationBuilder.DropTable(
                name: "event_operations_task_blockers");

            migrationBuilder.DropTable(
                name: "event_operations_task_dependencies");

            migrationBuilder.DropTable(
                name: "event_operations_team_members");

            migrationBuilder.DropTable(
                name: "event_operations_tasks");

            migrationBuilder.DropIndex(
                name: "ix_event_service_slots_program_item_id",
                table: "event_service_slots");

            migrationBuilder.DropIndex(
                name: "ix_event_program_items_session_id_sort_order",
                table: "event_program_items");

            migrationBuilder.DropColumn(
                name: "status",
                table: "event_sessions");

            migrationBuilder.DropColumn(
                name: "program_item_id",
                table: "event_service_slots");

            migrationBuilder.DropColumn(
                name: "declined_utc",
                table: "event_role_assignments");

            migrationBuilder.DropColumn(
                name: "status",
                table: "event_role_assignments");

            migrationBuilder.DropColumn(
                name: "description_en",
                table: "event_program_items");

            migrationBuilder.DropColumn(
                name: "description_zh",
                table: "event_program_items");

            migrationBuilder.DropColumn(
                name: "title_en",
                table: "event_program_items");

            migrationBuilder.DropColumn(
                name: "title_zh",
                table: "event_program_items");

            migrationBuilder.DropColumn(
                name: "programme_concurrency_token",
                table: "event_composition_occurrences");

            migrationBuilder.DropColumn(
                name: "roster_concurrency_token",
                table: "event_composition_occurrences");

            migrationBuilder.CreateIndex(
                name: "ix_event_program_items_session_id_sort_order",
                table: "event_program_items",
                columns: new[] { "session_id", "sort_order" },
                unique: true);
        }
    }
}
