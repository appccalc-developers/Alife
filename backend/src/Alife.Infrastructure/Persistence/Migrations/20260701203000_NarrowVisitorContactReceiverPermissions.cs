using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(AlifeDbContext))]
    [Migration("20260701203000_NarrowVisitorContactReceiverPermissions")]
    public partial class NarrowVisitorContactReceiverPermissions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE [platform_roles]
                SET [permissions_json] = N'["admin.access","admin.visitRequests.receive"]'
                WHERE [code] = N'visitor_contact_receiver';
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE [platform_roles]
                SET [permissions_json] = N'["admin.access","admin.messages.manage","admin.visitRequests.receive"]'
                WHERE [code] = N'visitor_contact_receiver';
                """);
        }
    }
}
