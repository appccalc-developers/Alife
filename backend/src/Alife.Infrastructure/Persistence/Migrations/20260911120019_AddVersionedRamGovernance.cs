using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVersionedRamGovernance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "author_member_id",
                table: "event_ram_assessments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "concurrency_token",
                table: "event_ram_assessments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "current_revision_id",
                table: "event_ram_assessments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "policy_version_id",
                table: "event_ram_assessments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "residual_level",
                table: "event_ram_assessments",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Incomplete");

            migrationBuilder.AddColumn<bool>(
                name: "review_requested",
                table: "event_ram_assessments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "schema_version",
                table: "event_ram_assessments",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "validity",
                table: "event_ram_assessments",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Legacy");

            migrationBuilder.CreateTable(
                name: "event_ram_policy_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    church_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    policy_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_published = table.Column<bool>(type: "bit", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    published_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    published_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_ram_policy_versions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_ram_policy_versions_groups_church_id",
                        column: x => x.church_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_ram_revisions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    schema_version = table.Column<int>(type: "int", nullable: false),
                    policy_version_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ram_data_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    content_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    residual_level = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    author_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    onsite_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_ram_revisions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_ram_revisions_event_ram_policy_versions_policy_version_id",
                        column: x => x.policy_version_id,
                        principalTable: "event_ram_policy_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_ram_revisions_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_ram_actions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    revision_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    action = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    idempotency_key = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    request_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    health_safety_signed = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_ram_actions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_ram_actions_event_ram_revisions_revision_id",
                        column: x => x.revision_id,
                        principalTable: "event_ram_revisions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Preserve legacy content and existing decisions without inventing residual ratings,
            // attendance signatures or a policy reference. No policy is published by migration.
            migrationBuilder.Sql("""
                UPDATE event_ram_assessments SET concurrency_token = NEWID();
                INSERT INTO event_ram_revisions
                    (id, event_id, version, schema_version, policy_version_id, ram_data_json, content_hash,
                     residual_level, author_member_id, onsite_member_id, created_utc)
                SELECT r.concurrency_token, r.event_id, 1, 1, NULL, r.ram_data_json,
                    CONVERT(varchar(64), HASHBYTES('SHA2_256', CONVERT(varbinary(max), r.ram_data_json)), 2),
                    'Incomplete', COALESCE(r.submitted_by_member_id, e.created_by_member_id), NULL, r.updated_utc
                FROM event_ram_assessments r INNER JOIN group_events e ON e.id = r.event_id;
                UPDATE event_ram_assessments SET current_revision_id = concurrency_token;
                INSERT INTO event_ram_actions
                    (id, event_id, revision_id, actor_member_id, action, reason, idempotency_key,
                     request_hash, health_safety_signed, created_utc)
                SELECT NEWID(), r.event_id, r.concurrency_token, r.submitted_by_member_id,
                    'legacy-submitted', 'Preserved existing submission', CONCAT('legacy-submit-', r.event_id),
                    v.content_hash, 0, COALESCE(r.submitted_utc, r.updated_utc)
                FROM event_ram_assessments r INNER JOIN event_ram_revisions v ON v.id = r.concurrency_token
                WHERE r.submitted_by_member_id IS NOT NULL;
                INSERT INTO event_ram_actions
                    (id, event_id, revision_id, actor_member_id, action, reason, idempotency_key,
                     request_hash, health_safety_signed, created_utc)
                SELECT NEWID(), r.event_id, r.concurrency_token, r.approved_by_member_id,
                    'legacy-approved', 'Preserved existing approval', CONCAT('legacy-approve-', r.event_id),
                    v.content_hash, 0, COALESCE(r.approved_utc, r.updated_utc)
                FROM event_ram_assessments r INNER JOIN event_ram_revisions v ON v.id = r.concurrency_token
                WHERE r.approved_by_member_id IS NOT NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_event_ram_actions_event_id_actor_member_id_idempotency_key",
                table: "event_ram_actions",
                columns: new[] { "event_id", "actor_member_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_ram_actions_revision_id",
                table: "event_ram_actions",
                column: "revision_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_ram_policy_versions_church_id_version",
                table: "event_ram_policy_versions",
                columns: new[] { "church_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_ram_revisions_event_id_version",
                table: "event_ram_revisions",
                columns: new[] { "event_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_ram_revisions_policy_version_id",
                table: "event_ram_revisions",
                column: "policy_version_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_ram_actions");

            migrationBuilder.DropTable(
                name: "event_ram_revisions");

            migrationBuilder.DropTable(
                name: "event_ram_policy_versions");

            migrationBuilder.DropColumn(
                name: "author_member_id",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "concurrency_token",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "current_revision_id",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "policy_version_id",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "residual_level",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "review_requested",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "schema_version",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "validity",
                table: "event_ram_assessments");
        }
    }
}
