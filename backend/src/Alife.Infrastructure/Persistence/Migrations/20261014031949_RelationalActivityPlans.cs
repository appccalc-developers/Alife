using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RelationalActivityPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // There is deliberately no data backfill. Never let an ordinary deployment
            // discard an existing Event plan, or attach operational rows to no project.
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM [dbo].[group_events])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_composition_occurrences])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_activity_plans])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_activity_policy_versions])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_activity_offers])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_activity_participations])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_activity_payments])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_activity_consents])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_activity_space_requests])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_activity_module_configurations])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_operations_tasks])
                    THROW 51001, 'Relational activity plans require empty Event instance data; migration stopped without deleting data.', 1;
                """);

            migrationBuilder.DropColumn(
                name: "data_json",
                table: "event_activity_plans");

            migrationBuilder.AddColumn<bool>(
                name: "is_high_risk",
                table: "event_activity_plans",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_outing",
                table: "event_activity_plans",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_overnight",
                table: "event_activity_plans",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "participant_count",
                table: "event_activity_plans",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "questionnaire_version",
                table: "event_activity_plans",
                type: "int",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<string>(
                name: "weather_confirmation_en",
                table: "event_activity_plans",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "weather_confirmation_zh",
                table: "event_activity_plans",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "event_activity_projects",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    activity_id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    conditions_en = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    conditions_zh = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    source_preset_key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    source_template_version = table.Column<int>(type: "int", nullable: true),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    preset_confirmed = table.Column<bool>(type: "bit", nullable: false),
                    repeat_for_each_occurrence = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_projects", x => new { x.event_id, x.activity_id });
                    table.ForeignKey(
                        name: "fk_event_activity_projects_event_activity_plans_event_id",
                        column: x => x.event_id,
                        principalTable: "event_activity_plans",
                        principalColumn: "event_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_activity_projects_event_occurrences_occurrence_id",
                        column: x => x.occurrence_id,
                        principalTable: "event_composition_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_activity_project_answers",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    activity_id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    question_code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    value = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    source = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    confirmed = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_project_answers", x => new { x.event_id, x.activity_id, x.question_code });
                    table.CheckConstraint("ck_event_activity_project_answers_source", "[source] IN (N'template', N'human')");
                    table.CheckConstraint("ck_event_activity_project_answers_value", "[value] IN (N'yes', N'no', N'unknown')");
                    table.ForeignKey(
                        name: "fk_event_activity_project_answers_event_activity_projects_event_id_activity_id",
                        columns: x => new { x.event_id, x.activity_id },
                        principalTable: "event_activity_projects",
                        principalColumns: new[] { "event_id", "activity_id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_activity_project_attributes",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    activity_id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    attribute_code = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_project_attributes", x => new { x.event_id, x.activity_id, x.attribute_code });
                    table.CheckConstraint("ck_event_activity_project_attributes_code", "[attribute_code] IN (N'hiking', N'water', N'sport', N'transport', N'camp', N'meal', N'outdoor')");
                    table.ForeignKey(
                        name: "fk_event_activity_project_attributes_event_activity_projects_event_id_activity_id",
                        columns: x => new { x.event_id, x.activity_id },
                        principalTable: "event_activity_projects",
                        principalColumns: new[] { "event_id", "activity_id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_activity_project_defaults",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    activity_id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    eligibility_en = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    eligibility_zh = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    minimum_age = table.Column<int>(type: "int", nullable: true),
                    maximum_age = table.Column<int>(type: "int", nullable: true),
                    capacity = table.Column<int>(type: "int", nullable: true),
                    allow_waitlist = table.Column<bool>(type: "bit", nullable: true),
                    requires_guardian_consent = table.Column<bool>(type: "bit", nullable: true),
                    fee_minor = table.Column<long>(type: "bigint", nullable: true),
                    currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    fee_charge_scope = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    terms_en = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    terms_zh = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_activity_project_defaults", x => new { x.event_id, x.activity_id });
                    table.ForeignKey(
                        name: "fk_event_activity_project_defaults_event_activity_projects_event_id_activity_id",
                        columns: x => new { x.event_id, x.activity_id },
                        principalTable: "event_activity_projects",
                        principalColumns: new[] { "event_id", "activity_id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_operations_tasks_event_id_activity_id",
                table: "event_operations_tasks",
                columns: new[] { "event_id", "activity_id" });

            migrationBuilder.AddCheckConstraint(
                name: "ck_event_activity_plans_questionnaire_version",
                table: "event_activity_plans",
                sql: "[questionnaire_version] = 2");

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_projects_event_id_sort_order",
                table: "event_activity_projects",
                columns: new[] { "event_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_event_activity_projects_occurrence_id",
                table: "event_activity_projects",
                column: "occurrence_id");

            migrationBuilder.AddForeignKey(
                name: "fk_event_activity_module_configurations_event_activity_projects_event_id_activity_id",
                table: "event_activity_module_configurations",
                columns: new[] { "event_id", "activity_id" },
                principalTable: "event_activity_projects",
                principalColumns: new[] { "event_id", "activity_id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_event_activity_offers_event_activity_projects_event_id_activity_id",
                table: "event_activity_offers",
                columns: new[] { "event_id", "activity_id" },
                principalTable: "event_activity_projects",
                principalColumns: new[] { "event_id", "activity_id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_event_activity_policy_versions_event_activity_projects_event_id_activity_id",
                table: "event_activity_policy_versions",
                columns: new[] { "event_id", "activity_id" },
                principalTable: "event_activity_projects",
                principalColumns: new[] { "event_id", "activity_id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_event_operations_tasks_event_activity_projects_event_id_activity_id",
                table: "event_operations_tasks",
                columns: new[] { "event_id", "activity_id" },
                principalTable: "event_activity_projects",
                principalColumns: new[] { "event_id", "activity_id" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM [dbo].[group_events])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_activity_plans])
                   OR EXISTS (SELECT 1 FROM [dbo].[event_activity_projects])
                    THROW 51002, 'Cannot roll back relational activity plans while Event data exists.', 1;
                """);

            migrationBuilder.DropForeignKey(
                name: "fk_event_activity_module_configurations_event_activity_projects_event_id_activity_id",
                table: "event_activity_module_configurations");

            migrationBuilder.DropForeignKey(
                name: "fk_event_activity_offers_event_activity_projects_event_id_activity_id",
                table: "event_activity_offers");

            migrationBuilder.DropForeignKey(
                name: "fk_event_activity_policy_versions_event_activity_projects_event_id_activity_id",
                table: "event_activity_policy_versions");

            migrationBuilder.DropForeignKey(
                name: "fk_event_operations_tasks_event_activity_projects_event_id_activity_id",
                table: "event_operations_tasks");

            migrationBuilder.DropTable(
                name: "event_activity_project_answers");

            migrationBuilder.DropTable(
                name: "event_activity_project_attributes");

            migrationBuilder.DropTable(
                name: "event_activity_project_defaults");

            migrationBuilder.DropTable(
                name: "event_activity_projects");

            migrationBuilder.DropIndex(
                name: "ix_event_operations_tasks_event_id_activity_id",
                table: "event_operations_tasks");

            migrationBuilder.DropCheckConstraint(
                name: "ck_event_activity_plans_questionnaire_version",
                table: "event_activity_plans");

            migrationBuilder.DropColumn(
                name: "is_high_risk",
                table: "event_activity_plans");

            migrationBuilder.DropColumn(
                name: "is_outing",
                table: "event_activity_plans");

            migrationBuilder.DropColumn(
                name: "is_overnight",
                table: "event_activity_plans");

            migrationBuilder.DropColumn(
                name: "participant_count",
                table: "event_activity_plans");

            migrationBuilder.DropColumn(
                name: "questionnaire_version",
                table: "event_activity_plans");

            migrationBuilder.DropColumn(
                name: "weather_confirmation_en",
                table: "event_activity_plans");

            migrationBuilder.DropColumn(
                name: "weather_confirmation_zh",
                table: "event_activity_plans");

            migrationBuilder.AddColumn<string>(
                name: "data_json",
                table: "event_activity_plans",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }
    }
}
