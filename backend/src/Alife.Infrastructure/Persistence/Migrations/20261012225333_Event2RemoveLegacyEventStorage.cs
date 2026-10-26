using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Event2RemoveLegacyEventStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                -- EVENT2_DESTRUCTIVE_RESET_REQUIRED
                DECLARE @event2HasInstanceRows bit = 0;
                DECLARE @event2GuardSql nvarchar(max) = N'';

                SELECT @event2GuardSql = @event2GuardSql +
                    N'IF EXISTS (SELECT TOP (1) 1 FROM ' + QUOTENAME(SCHEMA_NAME(t.[schema_id])) +
                    N'.' + QUOTENAME(t.[name]) + N') SET @hasRows = 1;' + CHAR(10)
                FROM sys.tables AS t
                WHERE t.[name] = N'group_events'
                   OR (t.[name] LIKE N'event[_]%'
                       AND t.[name] NOT IN
                       (
                           N'event_activity_template_versions',
                           N'event_package_governance_policy_versions',
                           N'event_ram_policy_versions',
                           N'event_resource_venues',
                           N'event_safeguarding_policy_versions',
                           N'event_workflow_templates',
                           N'event_package_approval_delegations'
                       ));

                EXEC sys.sp_executesql
                    @event2GuardSql,
                    N'@hasRows bit OUTPUT',
                    @hasRows = @event2HasInstanceRows OUTPUT;

                IF EXISTS
                (
                    SELECT TOP (1) 1
                    FROM [event_package_approval_delegations]
                    WHERE [scope_type] IN (1, 2)
                )
                    SET @event2HasInstanceRows = 1;

                IF @event2HasInstanceRows = 1
                BEGIN
                    THROW 51020,
                        'EVENT2_DESTRUCTIVE_RESET_REQUIRED: Event instance rows remain. Clear them through a separately authorized operation before applying this migration.',
                        1;
                END;
                """);

            migrationBuilder.DropForeignKey(
                name: "fk_event_operations_tasks_event_workflow_steps_workflow_step_id",
                table: "event_operations_tasks");

            migrationBuilder.DropForeignKey(
                name: "fk_event_safeguarding_child_registrations_event_enrollments_enrollment_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.DropTable(
                name: "event_artifacts");

            migrationBuilder.DropTable(
                name: "event_enrollment_history");

            migrationBuilder.DropTable(
                name: "event_workflow_steps");

            migrationBuilder.DropTable(
                name: "event_enrollments");

            migrationBuilder.DropTable(
                name: "event_workflow_runs");

            migrationBuilder.DropIndex(
                name: "ix_event_safeguarding_child_registrations_enrollment_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.DropIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_enrollment_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.DropIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_registration_participant_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.DropIndex(
                name: "ix_event_registration_applications_legacy_enrollment_id",
                table: "event_registration_applications");

            migrationBuilder.DropIndex(
                name: "ix_event_operations_tasks_workflow_step_id",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "collaboration_version",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "enrollment_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.DropColumn(
                name: "is_legacy",
                table: "event_registration_participants");

            migrationBuilder.DropColumn(
                name: "legacy_enrollment_id",
                table: "event_registration_applications");

            migrationBuilder.DropColumn(
                name: "is_legacy_backfill",
                table: "event_plan_snapshots");

            migrationBuilder.DropColumn(
                name: "workflow_step_id",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "is_legacy_backfill",
                table: "event_fact_sets");

            migrationBuilder.DropColumn(
                name: "is_legacy_backfill",
                table: "event_composition_occurrences");

            migrationBuilder.AlterColumn<Guid>(
                name: "registration_participant_id",
                table: "event_safeguarding_child_registrations",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "validity",
                table: "event_ram_assessments",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Draft",
                oldClrType: typeof(string),
                oldType: "nvarchar(32)",
                oldMaxLength: 32,
                oldDefaultValue: "Legacy");

            migrationBuilder.AlterColumn<int>(
                name: "schema_version",
                table: "event_ram_assessments",
                type: "int",
                nullable: false,
                defaultValue: 2,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 1);

            migrationBuilder.AlterColumn<int>(
                name: "roster_rules_version",
                table: "event_packages",
                type: "int",
                nullable: false,
                defaultValue: 2,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 1);

            migrationBuilder.CreateIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_registration_participant_id",
                table: "event_safeguarding_child_registrations",
                columns: new[] { "event_id", "registration_participant_id" },
                unique: true,
                filter: "[is_active] = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_event_safeguarding_child_registrations_event_id_registration_participant_id",
                table: "event_safeguarding_child_registrations");

            migrationBuilder.AddColumn<int>(
                name: "collaboration_version",
                table: "group_events",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<Guid>(
                name: "registration_participant_id",
                table: "event_safeguarding_child_registrations",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "enrollment_id",
                table: "event_safeguarding_child_registrations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_legacy",
                table: "event_registration_participants",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "legacy_enrollment_id",
                table: "event_registration_applications",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "validity",
                table: "event_ram_assessments",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Legacy",
                oldClrType: typeof(string),
                oldType: "nvarchar(32)",
                oldMaxLength: 32,
                oldDefaultValue: "Draft");

            migrationBuilder.AlterColumn<int>(
                name: "schema_version",
                table: "event_ram_assessments",
                type: "int",
                nullable: false,
                defaultValue: 1,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 2);

            migrationBuilder.AddColumn<bool>(
                name: "is_legacy_backfill",
                table: "event_plan_snapshots",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<int>(
                name: "roster_rules_version",
                table: "event_packages",
                type: "int",
                nullable: false,
                defaultValue: 1,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 2);

            migrationBuilder.AddColumn<Guid>(
                name: "workflow_step_id",
                table: "event_operations_tasks",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_legacy_backfill",
                table: "event_fact_sets",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_legacy_backfill",
                table: "event_composition_occurrences",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "event_enrollments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    enrollment_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    queued_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false, defaultValue: "confirmed"),
                    status_changed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_enrollments", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_enrollments_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_enrollments_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_enrollments_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_workflow_runs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    template_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    completed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    current_step_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    started_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    template_snapshot_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    template_version = table.Column<int>(type: "int", nullable: false),
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
                name: "event_enrollment_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    enrollment_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    archived_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    enrollment_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    queued_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    status_changed_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_enrollment_history", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_enrollment_history_event_enrollments_enrollment_id",
                        column: x => x.enrollment_id,
                        principalTable: "event_enrollments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_workflow_steps",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    assigned_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    completed_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    workflow_run_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    completed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    due_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    integration_key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    requires_approval = table.Column<bool>(type: "bit", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    step_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
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
                    approved_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    file_asset_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    workflow_step_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    approved_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    artifact_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    data_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    title_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    title_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    visibility = table.Column<int>(type: "int", nullable: false)
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
                name: "ix_event_safeguarding_child_registrations_enrollment_id",
                table: "event_safeguarding_child_registrations",
                column: "enrollment_id");

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
                name: "ix_event_registration_applications_legacy_enrollment_id",
                table: "event_registration_applications",
                column: "legacy_enrollment_id",
                unique: true,
                filter: "[legacy_enrollment_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_tasks_workflow_step_id",
                table: "event_operations_tasks",
                column: "workflow_step_id");

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
                name: "ix_event_enrollment_history_enrollment_id_archived_utc",
                table: "event_enrollment_history",
                columns: new[] { "enrollment_id", "archived_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_enrollments_event_id_member_id",
                table: "event_enrollments",
                columns: new[] { "event_id", "member_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_enrollments_event_id_status_queued_utc",
                table: "event_enrollments",
                columns: new[] { "event_id", "status", "queued_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_enrollments_group_id_updated_utc",
                table: "event_enrollments",
                columns: new[] { "group_id", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_enrollments_member_id",
                table: "event_enrollments",
                column: "member_id");

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

            migrationBuilder.AddForeignKey(
                name: "fk_event_operations_tasks_event_workflow_steps_workflow_step_id",
                table: "event_operations_tasks",
                column: "workflow_step_id",
                principalTable: "event_workflow_steps",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_event_safeguarding_child_registrations_event_enrollments_enrollment_id",
                table: "event_safeguarding_child_registrations",
                column: "enrollment_id",
                principalTable: "event_enrollments",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
