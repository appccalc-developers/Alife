using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventPackageDecisionAndPublishGate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "publication_concurrency_token",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWSEQUENTIALID()");

            migrationBuilder.AddColumn<int>(
                name: "publication_gate_mode",
                table: "group_events",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "publication_status",
                table: "group_events",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "published_by_member_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "published_package_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "published_utc",
                table: "group_events",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "event_package_decisions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_package_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    decision_type = table.Column<int>(type: "int", nullable: false),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reason_en = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    reason_zh = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    decided_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    decision_authority_snapshot_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    effective_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    expires_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    revoked_by_decision_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    invalidated_reason_code = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    request_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_package_decisions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_package_decisions_event_package_decisions_revoked_by_decision_id",
                        column: x => x.revoked_by_decision_id,
                        principalTable: "event_package_decisions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_package_decisions_event_packages_event_package_id",
                        column: x => x.event_package_id,
                        principalTable: "event_packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_package_decisions_members_actor_member_id",
                        column: x => x.actor_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_package_conditions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_package_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    text_en = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    text_zh = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    applies_to_gate = table.Column<int>(type: "int", nullable: false),
                    owner_role_requirement_key = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    due_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    expired_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    waived_by_decision_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    evidence_reference = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    satisfied_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    satisfied_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    verified_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    verified_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_package_conditions", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_package_conditions_event_package_decisions_waived_by_decision_id",
                        column: x => x.waived_by_decision_id,
                        principalTable: "event_package_decisions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_package_conditions_event_packages_event_package_id",
                        column: x => x.event_package_id,
                        principalTable: "event_packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_package_conditions_members_satisfied_by_member_id",
                        column: x => x.satisfied_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_package_conditions_members_verified_by_member_id",
                        column: x => x.verified_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_group_events_publication_status_start_date_end_date",
                table: "group_events",
                columns: new[] { "publication_status", "start_date", "end_date" });

            migrationBuilder.CreateIndex(
                name: "ix_group_events_published_by_member_id",
                table: "group_events",
                column: "published_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_events_published_package_id",
                table: "group_events",
                column: "published_package_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_package_conditions_event_package_id_status_due_utc",
                table: "event_package_conditions",
                columns: new[] { "event_package_id", "status", "due_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_package_conditions_satisfied_by_member_id",
                table: "event_package_conditions",
                column: "satisfied_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_package_conditions_verified_by_member_id",
                table: "event_package_conditions",
                column: "verified_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_package_conditions_waived_by_decision_id",
                table: "event_package_conditions",
                column: "waived_by_decision_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_package_decisions_actor_member_id",
                table: "event_package_decisions",
                column: "actor_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_package_decisions_event_package_id_decided_utc",
                table: "event_package_decisions",
                columns: new[] { "event_package_id", "decided_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_package_decisions_revoked_by_decision_id",
                table: "event_package_decisions",
                column: "revoked_by_decision_id");

            migrationBuilder.AddForeignKey(
                name: "fk_group_events_event_packages_published_package_id",
                table: "group_events",
                column: "published_package_id",
                principalTable: "event_packages",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_group_events_members_published_by_member_id",
                table: "group_events",
                column: "published_by_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_group_events_event_packages_published_package_id",
                table: "group_events");

            migrationBuilder.DropForeignKey(
                name: "fk_group_events_members_published_by_member_id",
                table: "group_events");

            migrationBuilder.DropTable(
                name: "event_package_conditions");

            migrationBuilder.DropTable(
                name: "event_package_decisions");

            migrationBuilder.DropIndex(
                name: "ix_group_events_publication_status_start_date_end_date",
                table: "group_events");

            migrationBuilder.DropIndex(
                name: "ix_group_events_published_by_member_id",
                table: "group_events");

            migrationBuilder.DropIndex(
                name: "ix_group_events_published_package_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "publication_concurrency_token",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "publication_gate_mode",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "publication_status",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "published_by_member_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "published_package_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "published_utc",
                table: "group_events");
        }
    }
}
