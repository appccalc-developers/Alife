using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddForumCommentReplies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "parent_comment_id",
                table: "forum_comments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_forum_comments_parent_comment_id",
                table: "forum_comments",
                column: "parent_comment_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_comments_post_id_parent_comment_id_created_utc",
                table: "forum_comments",
                columns: new[] { "post_id", "parent_comment_id", "created_utc" });

            migrationBuilder.AddForeignKey(
                name: "fk_forum_comments_forum_comments_parent_comment_id",
                table: "forum_comments",
                column: "parent_comment_id",
                principalTable: "forum_comments",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_forum_comments_forum_comments_parent_comment_id",
                table: "forum_comments");

            migrationBuilder.DropIndex(
                name: "ix_forum_comments_parent_comment_id",
                table: "forum_comments");

            migrationBuilder.DropIndex(
                name: "ix_forum_comments_post_id_parent_comment_id_created_utc",
                table: "forum_comments");

            migrationBuilder.DropColumn(
                name: "parent_comment_id",
                table: "forum_comments");
        }
    }
}
