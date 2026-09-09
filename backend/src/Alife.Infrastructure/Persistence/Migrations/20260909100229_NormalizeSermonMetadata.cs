using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeSermonMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "metadata_version",
                table: "sermons",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "published_at_utc",
                table: "sermons",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_title",
                table: "sermons",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "metadata_version",
                table: "sermons");

            migrationBuilder.DropColumn(
                name: "published_at_utc",
                table: "sermons");

            migrationBuilder.DropColumn(
                name: "source_title",
                table: "sermons");
        }
    }
}
