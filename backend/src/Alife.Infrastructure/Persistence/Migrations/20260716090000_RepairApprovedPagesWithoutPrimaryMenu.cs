using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AlifeDbContext))]
[Migration("20260716090000_RepairApprovedPagesWithoutPrimaryMenu")]
public partial class RepairApprovedPagesWithoutPrimaryMenu : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE page_publication_reviews
            SET status = 0,
                menu_sort_order = 0,
                primary_menu_name_json = NULL,
                reviewed_by_member_id = NULL,
                reviewed_utc = NULL,
                updated_utc = SYSUTCDATETIME()
            WHERE status = 1
              AND primary_menu_id IS NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // The previous approval state cannot be restored safely without a valid primary menu.
    }
}
