using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddContentPosts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "content_posts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    owner_group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    title_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    summary_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    body_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    category = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    visibility = table.Column<int>(type: "int", nullable: false),
                    slug = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    cover_image_url = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: true),
                    byline = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    published_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    source_url = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: true),
                    source_key = table.Column<string>(type: "nchar(64)", fixedLength: true, maxLength: 64, nullable: true),
                    source_checksum = table.Column<string>(type: "nchar(64)", fixedLength: true, maxLength: 64, nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_content_posts", x => x.id);
                    table.ForeignKey(
                        name: "fk_content_posts_groups_owner_group_id",
                        column: x => x.owner_group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_content_posts_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_content_posts_created_by_member_id",
                table: "content_posts",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_content_posts_owner_group_id_slug",
                table: "content_posts",
                columns: new[] { "owner_group_id", "slug" },
                unique: true,
                filter: "[is_deleted] = 0");

            migrationBuilder.CreateIndex(
                name: "ix_content_posts_owner_group_id_source_key",
                table: "content_posts",
                columns: new[] { "owner_group_id", "source_key" },
                unique: true,
                filter: "[source_key] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_content_posts_owner_group_id_status_visibility_published_utc",
                table: "content_posts",
                columns: new[] { "owner_group_id", "status", "visibility", "published_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "content_posts");
        }
    }
}
