using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPageMenuLayout : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "menu_sort_order",
                table: "page_publication_reviews",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "primary_menu_id",
                table: "page_publication_reviews",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "page_primary_menus",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_page_primary_menus", x => x.id);
                });

            migrationBuilder.Sql(
                """
                INSERT INTO page_primary_menus (id, name_json, sort_order, created_utc, updated_utc)
                SELECT
                    NEWID(),
                    source.primary_menu_name_json,
                    CAST(ROW_NUMBER() OVER (ORDER BY source.first_created_utc, source.primary_menu_name_json) - 1 AS int),
                    SYSUTCDATETIME(),
                    SYSUTCDATETIME()
                FROM
                (
                    SELECT primary_menu_name_json, MIN(created_utc) AS first_created_utc
                    FROM page_publication_reviews
                    WHERE status = 1
                      AND primary_menu_name_json IS NOT NULL
                      AND LTRIM(RTRIM(primary_menu_name_json)) <> ''
                    GROUP BY primary_menu_name_json
                ) AS source;

                UPDATE review
                SET primary_menu_id = menu.id
                FROM page_publication_reviews AS review
                INNER JOIN page_primary_menus AS menu
                    ON menu.name_json = review.primary_menu_name_json
                WHERE review.status = 1;

                WITH ranked_reviews AS
                (
                    SELECT
                        id,
                        CAST(ROW_NUMBER() OVER
                        (
                            PARTITION BY primary_menu_id
                            ORDER BY reviewed_utc, created_utc, page_id
                        ) - 1 AS int) AS menu_sort_order
                    FROM page_publication_reviews
                    WHERE primary_menu_id IS NOT NULL
                )
                UPDATE review
                SET menu_sort_order = ranked.menu_sort_order
                FROM page_publication_reviews AS review
                INNER JOIN ranked_reviews AS ranked ON ranked.id = review.id;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_page_publication_reviews_primary_menu_id_menu_sort_order",
                table: "page_publication_reviews",
                columns: new[] { "primary_menu_id", "menu_sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_page_primary_menus_sort_order",
                table: "page_primary_menus",
                column: "sort_order");

            migrationBuilder.AddForeignKey(
                name: "fk_page_publication_reviews_page_primary_menus_primary_menu_id",
                table: "page_publication_reviews",
                column: "primary_menu_id",
                principalTable: "page_primary_menus",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_page_publication_reviews_page_primary_menus_primary_menu_id",
                table: "page_publication_reviews");

            migrationBuilder.DropTable(
                name: "page_primary_menus");

            migrationBuilder.DropIndex(
                name: "ix_page_publication_reviews_primary_menu_id_menu_sort_order",
                table: "page_publication_reviews");

            migrationBuilder.DropColumn(
                name: "menu_sort_order",
                table: "page_publication_reviews");

            migrationBuilder.DropColumn(
                name: "primary_menu_id",
                table: "page_publication_reviews");
        }
    }
}
