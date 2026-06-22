using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformRolesAndAuditLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    action = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    entity_type = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    target_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    before_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    after_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    metadata_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ip_address = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    user_agent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    occurred_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_audit_logs", x => x.id);
                    table.ForeignKey(
                        name: "fk_audit_logs_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_audit_logs_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_audit_logs_members_actor_member_id",
                        column: x => x.actor_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_audit_logs_members_target_member_id",
                        column: x => x.target_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "platform_roles",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false),
                    code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    level = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_platform_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "member_platform_roles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role_id = table.Column<int>(type: "int", nullable: false),
                    assigned_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    assigned_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    revoked_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_member_platform_roles", x => x.id);
                    table.ForeignKey(
                        name: "fk_member_platform_roles_members_assigned_by_member_id",
                        column: x => x.assigned_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_member_platform_roles_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_member_platform_roles_platform_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "platform_roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "platform_roles",
                columns: new[] { "id", "code", "name_json", "level" },
                values: new object[,]
                {
                    { 0, "user", "{\"en\":\"User\",\"zh\":\"普通用户\"}", 0 },
                    { 10, "admin", "{\"en\":\"Admin\",\"zh\":\"联合管理员\"}", 10 },
                    { 100, "superadmin", "{\"en\":\"Super Admin\",\"zh\":\"超级管理员\"}", 100 }
                });

            migrationBuilder.Sql("""
                                 INSERT INTO [member_platform_roles] ([id], [member_id], [role_id], [assigned_by_member_id], [assigned_utc], [revoked_utc])
                                 SELECT NEWID(), [id], 10, NULL, SYSUTCDATETIME(), NULL
                                 FROM [members] AS [m]
                                 WHERE [m].[is_admin] = CAST(1 AS bit)
                                   AND NOT EXISTS (
                                       SELECT 1
                                       FROM [member_platform_roles] AS [mpr]
                                       WHERE [mpr].[member_id] = [m].[id]
                                         AND [mpr].[role_id] = 10
                                         AND [mpr].[revoked_utc] IS NULL
                                   );
                                 """);

            migrationBuilder.CreateIndex(
                name: "ix_audit_logs_action_occurred_utc",
                table: "audit_logs",
                columns: new[] { "action", "occurred_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_logs_actor_member_id_occurred_utc",
                table: "audit_logs",
                columns: new[] { "actor_member_id", "occurred_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_logs_event_id_occurred_utc",
                table: "audit_logs",
                columns: new[] { "event_id", "occurred_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_logs_group_id_occurred_utc",
                table: "audit_logs",
                columns: new[] { "group_id", "occurred_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_logs_target_member_id_occurred_utc",
                table: "audit_logs",
                columns: new[] { "target_member_id", "occurred_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_member_platform_roles_assigned_by_member_id",
                table: "member_platform_roles",
                column: "assigned_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_member_platform_roles_member_id_role_id",
                table: "member_platform_roles",
                columns: new[] { "member_id", "role_id" },
                unique: true,
                filter: "[revoked_utc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_member_platform_roles_role_id_revoked_utc",
                table: "member_platform_roles",
                columns: new[] { "role_id", "revoked_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_platform_roles_code",
                table: "platform_roles",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_platform_roles_level",
                table: "platform_roles",
                column: "level");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_logs");

            migrationBuilder.DropTable(
                name: "member_platform_roles");

            migrationBuilder.DropTable(
                name: "platform_roles");
        }
    }
}
