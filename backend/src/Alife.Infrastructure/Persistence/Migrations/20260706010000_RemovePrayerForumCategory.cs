using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemovePrayerForumCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE [forum_categories]
                SET [is_enabled] = 0,
                    [updated_utc] = SYSUTCDATETIME()
                WHERE [id] = 'f0f00000-0000-4000-8000-000000000004';

                UPDATE [forum_categories]
                SET [sort_order] = 40,
                    [updated_utc] = SYSUTCDATETIME()
                WHERE [id] = 'f0f00000-0000-4000-8000-000000000005';

                UPDATE [forum_categories]
                SET [sort_order] = 50,
                    [updated_utc] = SYSUTCDATETIME()
                WHERE [id] = 'f0f00000-0000-4000-8000-000000000006';

                UPDATE [forum_categories]
                SET [sort_order] = 60,
                    [updated_utc] = SYSUTCDATETIME()
                WHERE [id] = 'f0f00000-0000-4000-8000-000000000007';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE [forum_categories]
                SET [is_enabled] = 1,
                    [sort_order] = 40,
                    [updated_utc] = SYSUTCDATETIME()
                WHERE [id] = 'f0f00000-0000-4000-8000-000000000004';

                UPDATE [forum_categories]
                SET [sort_order] = 50,
                    [updated_utc] = SYSUTCDATETIME()
                WHERE [id] = 'f0f00000-0000-4000-8000-000000000005';

                UPDATE [forum_categories]
                SET [sort_order] = 60,
                    [updated_utc] = SYSUTCDATETIME()
                WHERE [id] = 'f0f00000-0000-4000-8000-000000000006';

                UPDATE [forum_categories]
                SET [sort_order] = 70,
                    [updated_utc] = SYSUTCDATETIME()
                WHERE [id] = 'f0f00000-0000-4000-8000-000000000007';
                """);
        }
    }
}
