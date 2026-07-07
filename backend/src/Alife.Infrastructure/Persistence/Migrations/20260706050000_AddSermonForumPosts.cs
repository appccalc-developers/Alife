using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSermonForumPosts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "sermon_id",
                table: "forum_posts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_forum_posts_sermon_id",
                table: "forum_posts",
                column: "sermon_id",
                unique: true,
                filter: "[sermon_id] IS NOT NULL AND [deleted_utc] IS NULL");

            migrationBuilder.AddForeignKey(
                name: "fk_forum_posts_sermons_sermon_id",
                table: "forum_posts",
                column: "sermon_id",
                principalTable: "sermons",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_forum_posts_sermons_sermon_id",
                table: "forum_posts");

            migrationBuilder.DropIndex(
                name: "ix_forum_posts_sermon_id",
                table: "forum_posts");

            migrationBuilder.DropColumn(
                name: "sermon_id",
                table: "forum_posts");
        }
    }
}
