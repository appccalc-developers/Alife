using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RetirePageScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DECLARE @church_count int;
                DECLARE @church_id uniqueidentifier;

                SELECT @church_count = COUNT(*)
                FROM [groups]
                WHERE [is_church] = 1;

                IF @church_count <> 1
                BEGIN
                    THROW 51001, 'RetirePageScope requires exactly one church group.', 1;
                END;

                SELECT TOP (1) @church_id = [id]
                FROM [groups]
                WHERE [is_church] = 1;

                UPDATE [pages]
                SET [owner_group_id] = @church_id
                WHERE [owner_group_id] IS NULL;

                UPDATE [reviews]
                SET
                    [status] = 0,
                    [access_name_json] = NULL,
                    [return_reason] = NULL,
                    [reviewed_by_member_id] = NULL,
                    [reviewed_utc] = NULL,
                    [updated_utc] = SYSUTCDATETIME()
                FROM [page_publication_reviews] AS [reviews]
                INNER JOIN [pages] AS [pages]
                    ON [pages].[id] = [reviews].[page_id]
                WHERE [pages].[visibility] = 2;
                """);

            migrationBuilder.DropIndex(
                name: "ix_pages_owner_group_id",
                table: "pages");

            migrationBuilder.DropIndex(
                name: "ix_pages_scope_owner_group_id_updated_utc",
                table: "pages");

            migrationBuilder.DropColumn(
                name: "scope",
                table: "pages");

            migrationBuilder.AlterColumn<Guid>(
                name: "owner_group_id",
                table: "pages",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_pages_owner_group_id_updated_utc",
                table: "pages",
                columns: new[] { "owner_group_id", "updated_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_pages_owner_group_id_updated_utc",
                table: "pages");

            migrationBuilder.AlterColumn<Guid>(
                name: "owner_group_id",
                table: "pages",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<int>(
                name: "scope",
                table: "pages",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateIndex(
                name: "ix_pages_owner_group_id",
                table: "pages",
                column: "owner_group_id");

            migrationBuilder.CreateIndex(
                name: "ix_pages_scope_owner_group_id_updated_utc",
                table: "pages",
                columns: new[] { "scope", "owner_group_id", "updated_utc" });
        }
    }
}
