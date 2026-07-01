using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AlifeDbContext))]
[Migration("20260629162000_GrantAdminAssignCustomRoles")]
/// <inheritdoc />
public partial class GrantAdminAssignCustomRoles : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE [platform_roles]
            SET [permissions_json] = JSON_MODIFY(
                CASE WHEN ISJSON([permissions_json]) = 1 THEN [permissions_json] ELSE N'[]' END,
                'append $',
                N'admin.members.assignPlatformRoles')
            WHERE [code] = N'admin'
              AND NOT EXISTS (
                  SELECT 1
                  FROM OPENJSON(CASE WHEN ISJSON([permissions_json]) = 1 THEN [permissions_json] ELSE N'[]' END)
                  WHERE [value] = N'admin.members.assignPlatformRoles'
              );
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE [platform_roles]
            SET [permissions_json] = COALESCE((
                SELECT N'[' + STRING_AGG(N'"' + STRING_ESCAPE(CONVERT(nvarchar(max), [value]), 'json') + N'"', N',') + N']'
                FROM OPENJSON(CASE WHEN ISJSON([permissions_json]) = 1 THEN [permissions_json] ELSE N'[]' END)
                WHERE [value] <> N'admin.members.assignPlatformRoles'
            ), N'[]')
            WHERE [code] = N'admin';
            """);
    }
}
