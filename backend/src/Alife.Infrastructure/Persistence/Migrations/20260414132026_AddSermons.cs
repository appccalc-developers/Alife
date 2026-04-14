using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSermons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sermons",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    youtube_video_id = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    title = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    speaker_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    thumbnail_url = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    video_url = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    preached_at_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    synced_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sermons", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_sermons_sort_order",
                table: "sermons",
                column: "sort_order");

            migrationBuilder.CreateIndex(
                name: "ix_sermons_youtube_video_id",
                table: "sermons",
                column: "youtube_video_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sermons");
        }
    }
}
