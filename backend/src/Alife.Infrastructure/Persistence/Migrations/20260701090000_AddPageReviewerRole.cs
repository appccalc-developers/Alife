using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPageReviewerRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                                 IF NOT EXISTS (
                                     SELECT 1
                                     FROM [platform_roles]
                                     WHERE [id] = 5 OR [code] = N'page_reviewer'
                                 )
                                 BEGIN
                                     INSERT INTO [platform_roles] ([id], [code], [name_json], [level])
                                     VALUES (5, N'page_reviewer', N'{"en":"Page Reviewer","zh":"发布审核者"}', 5);
                                 END
                                 """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                                 DELETE FROM [member_platform_roles]
                                 WHERE [role_id] = 5;

                                 DELETE FROM [platform_roles]
                                 WHERE [id] = 5 AND [code] = N'page_reviewer';
                                 """);
        }
    }
}
