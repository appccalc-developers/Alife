using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBibleReadingProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bible_reading_progresses",
                columns: table => new
                {
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    book = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    chapter = table.Column<int>(type: "int", nullable: false),
                    language = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    zh_version = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    en_version = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_bible_reading_progresses", x => x.member_id);
                    table.ForeignKey(
                        name: "fk_bible_reading_progresses_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bible_reading_progresses");
        }
    }
}
