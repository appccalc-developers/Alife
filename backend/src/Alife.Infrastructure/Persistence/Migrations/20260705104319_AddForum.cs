using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddForum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "forum_categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    description_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    is_enabled = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_categories", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "forum_posts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    category_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    author_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    title_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    body_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    visibility = table.Column<int>(type: "int", nullable: false),
                    is_pinned = table.Column<bool>(type: "bit", nullable: false),
                    is_locked = table.Column<bool>(type: "bit", nullable: false),
                    is_hidden = table.Column<bool>(type: "bit", nullable: false),
                    comment_count = table.Column<int>(type: "int", nullable: false),
                    last_comment_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_comment_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    deleted_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_posts", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_posts_forum_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "forum_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_forum_posts_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_forum_posts_members_author_member_id",
                        column: x => x.author_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_forum_posts_members_last_comment_member_id",
                        column: x => x.last_comment_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "forum_comments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    post_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    author_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    body_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_hidden = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    deleted_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_comments", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_comments_forum_posts_post_id",
                        column: x => x.post_id,
                        principalTable: "forum_posts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_forum_comments_members_author_member_id",
                        column: x => x.author_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_forum_categories_is_enabled_sort_order",
                table: "forum_categories",
                columns: new[] { "is_enabled", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_forum_comments_author_member_id",
                table: "forum_comments",
                column: "author_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_comments_post_id_created_utc",
                table: "forum_comments",
                columns: new[] { "post_id", "created_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_forum_posts_author_member_id",
                table: "forum_posts",
                column: "author_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_posts_category_id_visibility_updated_utc",
                table: "forum_posts",
                columns: new[] { "category_id", "visibility", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_forum_posts_group_id_updated_utc",
                table: "forum_posts",
                columns: new[] { "group_id", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_forum_posts_last_comment_member_id",
                table: "forum_posts",
                column: "last_comment_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_posts_visibility_is_hidden_is_pinned_updated_utc",
                table: "forum_posts",
                columns: new[] { "visibility", "is_hidden", "is_pinned", "updated_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "forum_comments");

            migrationBuilder.DropTable(
                name: "forum_posts");

            migrationBuilder.DropTable(
                name: "forum_categories");
        }
    }
}
