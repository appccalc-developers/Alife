using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventPackageApprovalDelegation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_package_approval_delegations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    organisation_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    scope_type = table.Column<int>(type: "int", nullable: false),
                    scope_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    permission_code = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    delegated_to_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    starts_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    expires_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    granted_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    granted_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    revoked_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    revoked_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    revocation_reason_en = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    revocation_reason_zh = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_package_approval_delegations", x => x.id);
                    table.CheckConstraint("ck_event_package_approval_delegations_scope", "([scope_type] = 0 AND [scope_id] IS NULL) OR ([scope_type] IN (1, 2) AND [scope_id] IS NOT NULL)");
                    table.ForeignKey(
                        name: "fk_event_package_approval_delegations_groups_organisation_id",
                        column: x => x.organisation_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_package_approval_delegations_members_delegated_to_member_id",
                        column: x => x.delegated_to_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_package_approval_delegations_members_granted_by_member_id",
                        column: x => x.granted_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_package_approval_delegations_members_revoked_by_member_id",
                        column: x => x.revoked_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_package_approval_delegations_delegated_to_member_id_starts_utc_expires_utc_revoked_utc",
                table: "event_package_approval_delegations",
                columns: new[] { "delegated_to_member_id", "starts_utc", "expires_utc", "revoked_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_package_approval_delegations_granted_by_member_id",
                table: "event_package_approval_delegations",
                column: "granted_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_package_approval_delegations_organisation_id_scope_type_scope_id_delegated_to_member_id_permission_code_expires_utc",
                table: "event_package_approval_delegations",
                columns: new[] { "organisation_id", "scope_type", "scope_id", "delegated_to_member_id", "permission_code", "expires_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_package_approval_delegations_revoked_by_member_id",
                table: "event_package_approval_delegations",
                column: "revoked_by_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_package_approval_delegations");
        }
    }
}
