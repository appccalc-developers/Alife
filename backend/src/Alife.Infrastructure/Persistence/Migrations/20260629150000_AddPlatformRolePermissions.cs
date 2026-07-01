using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AlifeDbContext))]
[Migration("20260629150000_AddPlatformRolePermissions")]
public partial class AddPlatformRolePermissions : Migration
{
    private const string UserPermissions = "[]";
    private const string AdminPermissions = "[\"admin.access\",\"admin.auditLogs.view\",\"admin.cloudflareCache.refresh\",\"admin.groups.view\",\"admin.messages.manage\",\"admin.members.view\",\"admin.sermons.sync\"]";
    private const string SuperAdminPermissions = "[\"admin.access\",\"admin.auditLogs.view\",\"admin.cloudflareCache.refresh\",\"admin.groups.view\",\"admin.messages.manage\",\"admin.members.assignPlatformRoles\",\"admin.members.view\",\"admin.roles.managePermissions\",\"admin.sermons.sync\"]";

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "permissions_json",
            table: "platform_roles",
            type: "nvarchar(max)",
            nullable: false,
            defaultValue: UserPermissions);

        migrationBuilder.Sql($"UPDATE [platform_roles] SET [permissions_json] = N'{UserPermissions}' WHERE [id] = 0");
        migrationBuilder.Sql($"UPDATE [platform_roles] SET [permissions_json] = N'{AdminPermissions}' WHERE [id] = 10");
        migrationBuilder.Sql($"UPDATE [platform_roles] SET [permissions_json] = N'{SuperAdminPermissions}' WHERE [id] = 100");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "permissions_json",
            table: "platform_roles");
    }
}
