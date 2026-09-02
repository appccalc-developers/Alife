using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventPackageApprovalFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_package_governance_policy_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    organisation_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    version = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    schema_version = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    rules_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    enforcement_mode = table.Column<int>(type: "int", nullable: false),
                    effective_from_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    retired_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    is_published = table.Column<bool>(type: "bit", nullable: false),
                    published_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    published_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_package_governance_policy_versions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_package_governance_policy_versions_groups_organisation_id",
                        column: x => x.organisation_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_package_governance_policy_versions_members_published_by_member_id",
                        column: x => x.published_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_packages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    scope_type = table.Column<int>(type: "int", nullable: false),
                    scope_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    coverage_mode = table.Column<int>(type: "int", nullable: false),
                    covered_occurrence_ids_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    event_plan_version = table.Column<int>(type: "int", nullable: false),
                    package_schema_version = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    governance_policy_version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    governance_policy_version = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    governance_tier = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    approval_validity_status = table.Column<int>(type: "int", nullable: false),
                    content_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    source_vector_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    manifest_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    supersedes_package_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    generated_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    generated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    submitted_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    submitted_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_packages", x => x.id);
                    table.CheckConstraint("ck_event_packages_scope", "([scope_type] = 0 AND [scope_id] IS NULL) OR ([scope_type] = 1 AND [scope_id] IS NOT NULL)");
                    table.ForeignKey(
                        name: "fk_event_packages_event_composition_occurrences_scope_id",
                        column: x => x.scope_id,
                        principalTable: "event_composition_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_packages_event_package_governance_policy_versions_governance_policy_version_id",
                        column: x => x.governance_policy_version_id,
                        principalTable: "event_package_governance_policy_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_packages_event_packages_supersedes_package_id",
                        column: x => x.supersedes_package_id,
                        principalTable: "event_packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_packages_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_packages_members_generated_by_member_id",
                        column: x => x.generated_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_packages_members_submitted_by_member_id",
                        column: x => x.submitted_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_package_source_references",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_package_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    module_code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    subject_type = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    subject_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    subject_version = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    source_decision_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    valid_until_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    data_class = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    required_for_decision = table.Column<bool>(type: "bit", nullable: false),
                    captured_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_package_source_references", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_package_source_references_event_packages_event_package_id",
                        column: x => x.event_package_id,
                        principalTable: "event_packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_package_governance_policy_versions_organisation_id_is_published_effective_from_utc",
                table: "event_package_governance_policy_versions",
                columns: new[] { "organisation_id", "is_published", "effective_from_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_package_governance_policy_versions_organisation_id_version",
                table: "event_package_governance_policy_versions",
                columns: new[] { "organisation_id", "version" },
                unique: true,
                filter: "[organisation_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_package_governance_policy_versions_published_by_member_id",
                table: "event_package_governance_policy_versions",
                column: "published_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_package_governance_policy_versions_version",
                table: "event_package_governance_policy_versions",
                column: "version",
                unique: true,
                filter: "[organisation_id] IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_package_source_references_event_package_id_module_code_subject_type_subject_id",
                table: "event_package_source_references",
                columns: new[] { "event_package_id", "module_code", "subject_type", "subject_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_packages_event_id_scope_type_scope_id_status_generated_utc",
                table: "event_packages",
                columns: new[] { "event_id", "scope_type", "scope_id", "status", "generated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_packages_event_id_scope_type_scope_id_version",
                table: "event_packages",
                columns: new[] { "event_id", "scope_type", "scope_id", "version" },
                unique: true,
                filter: "[scope_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_packages_event_id_scope_type_version",
                table: "event_packages",
                columns: new[] { "event_id", "scope_type", "version" },
                unique: true,
                filter: "[scope_id] IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_packages_generated_by_member_id",
                table: "event_packages",
                column: "generated_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_packages_governance_policy_version_id",
                table: "event_packages",
                column: "governance_policy_version_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_packages_scope_id",
                table: "event_packages",
                column: "scope_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_packages_submitted_by_member_id",
                table: "event_packages",
                column: "submitted_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_packages_supersedes_package_id",
                table: "event_packages",
                column: "supersedes_package_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_package_source_references");

            migrationBuilder.DropTable(
                name: "event_packages");

            migrationBuilder.DropTable(
                name: "event_package_governance_policy_versions");
        }
    }
}
