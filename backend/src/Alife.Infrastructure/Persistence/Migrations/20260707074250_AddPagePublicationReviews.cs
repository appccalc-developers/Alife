using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPagePublicationReviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "page_publication_reviews",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    page_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    access_name_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    return_reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    reviewed_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reviewed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_page_publication_reviews", x => x.id);
                    table.ForeignKey(
                        name: "fk_page_publication_reviews_members_reviewed_by_member_id",
                        column: x => x.reviewed_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_page_publication_reviews_pages_page_id",
                        column: x => x.page_id,
                        principalTable: "pages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_page_publication_reviews_page_id",
                table: "page_publication_reviews",
                column: "page_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_page_publication_reviews_reviewed_by_member_id_reviewed_utc",
                table: "page_publication_reviews",
                columns: new[] { "reviewed_by_member_id", "reviewed_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_page_publication_reviews_status_updated_utc",
                table: "page_publication_reviews",
                columns: new[] { "status", "updated_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "page_publication_reviews");
        }
    }
}
