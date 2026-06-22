using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations;

public partial class RemoveMemberIsAdminAndRenameSuperAdmin : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.UpdateData(
            table: "platform_roles",
            keyColumn: "id",
            keyValue: 100,
            column: "name_json",
            value: "{\"en\":\"System Admin\",\"zh\":\"系统管理员\"}");

        migrationBuilder.DropColumn(
            name: "is_admin",
            table: "members");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "is_admin",
            table: "members",
            type: "bit",
            nullable: false,
            defaultValue: false);

        migrationBuilder.UpdateData(
            table: "platform_roles",
            keyColumn: "id",
            keyValue: 100,
            column: "name_json",
            value: "{\"en\":\"Super Admin\",\"zh\":\"超级管理员\"}");
    }
}
