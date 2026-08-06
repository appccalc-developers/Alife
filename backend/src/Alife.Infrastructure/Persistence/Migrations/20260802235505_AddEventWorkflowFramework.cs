using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventWorkflowFramework : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_workflow_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    description_en = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    description_zh = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    definition_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_workflow_templates", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "event_workflow_runs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    template_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    template_version = table.Column<int>(type: "int", nullable: false),
                    template_snapshot_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    current_step_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    started_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    completed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_workflow_runs", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_workflow_runs_event_workflow_templates_template_id",
                        column: x => x.template_id,
                        principalTable: "event_workflow_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_workflow_runs_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_workflow_steps",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    workflow_run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    step_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    requires_approval = table.Column<bool>(type: "bit", nullable: false),
                    integration_key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    status = table.Column<int>(type: "int", nullable: false),
                    assigned_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    due_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    completed_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    completed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_workflow_steps", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_workflow_steps_event_workflow_runs_workflow_run_id",
                        column: x => x.workflow_run_id,
                        principalTable: "event_workflow_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_workflow_steps_members_assigned_member_id",
                        column: x => x.assigned_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_workflow_steps_members_completed_by_member_id",
                        column: x => x.completed_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_artifacts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    workflow_step_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    artifact_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    title_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    title_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    visibility = table.Column<int>(type: "int", nullable: false),
                    file_asset_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    data_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    approved_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    approved_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_artifacts", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_artifacts_event_workflow_steps_workflow_step_id",
                        column: x => x.workflow_step_id,
                        principalTable: "event_workflow_steps",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_artifacts_file_assets_file_asset_id",
                        column: x => x.file_asset_id,
                        principalTable: "file_assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_artifacts_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_artifacts_members_approved_by_member_id",
                        column: x => x.approved_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_artifacts_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_artifacts_approved_by_member_id",
                table: "event_artifacts",
                column: "approved_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_artifacts_created_by_member_id",
                table: "event_artifacts",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_artifacts_event_id_updated_utc",
                table: "event_artifacts",
                columns: new[] { "event_id", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_artifacts_file_asset_id",
                table: "event_artifacts",
                column: "file_asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_artifacts_workflow_step_id",
                table: "event_artifacts",
                column: "workflow_step_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_runs_event_id",
                table: "event_workflow_runs",
                column: "event_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_runs_status_updated_utc",
                table: "event_workflow_runs",
                columns: new[] { "status", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_runs_template_id",
                table: "event_workflow_runs",
                column: "template_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_steps_assigned_member_id",
                table: "event_workflow_steps",
                column: "assigned_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_steps_completed_by_member_id",
                table: "event_workflow_steps",
                column: "completed_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_steps_workflow_run_id_sort_order",
                table: "event_workflow_steps",
                columns: new[] { "workflow_run_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_steps_workflow_run_id_step_key",
                table: "event_workflow_steps",
                columns: new[] { "workflow_run_id", "step_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_templates_code_version",
                table: "event_workflow_templates",
                columns: new[] { "code", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_templates_is_active_code",
                table: "event_workflow_templates",
                columns: new[] { "is_active", "code" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_artifacts");

            migrationBuilder.DropTable(
                name: "event_workflow_steps");

            migrationBuilder.DropTable(
                name: "event_workflow_runs");

            migrationBuilder.DropTable(
                name: "event_workflow_templates");
        }
    }
}
