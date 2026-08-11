using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddForumCommentVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "visibility",
                table: "forum_comments",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.Sql(
                """
                UPDATE comments
                SET comments.visibility = 3
                FROM forum_comments AS comments
                INNER JOIN forum_posts AS posts ON posts.id = comments.post_id
                WHERE posts.group_id IS NOT NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_forum_comments_post_id_visibility_is_hidden_created_utc",
                table: "forum_comments",
                columns: new[] { "post_id", "visibility", "is_hidden", "created_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_forum_comments_post_id_visibility_is_hidden_created_utc",
                table: "forum_comments");

            migrationBuilder.DropColumn(
                name: "visibility",
                table: "forum_comments");
        }
    }
}
