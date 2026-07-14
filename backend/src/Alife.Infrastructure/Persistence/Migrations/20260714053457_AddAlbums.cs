using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAlbums : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "albums",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    parent_album_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    name_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    description_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    visibility = table.Column<int>(type: "int", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_albums", x => x.id);
                    table.ForeignKey(
                        name: "fk_albums_albums_parent_album_id",
                        column: x => x.parent_album_id,
                        principalTable: "albums",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_albums_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "album_photos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    album_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    file_asset_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    caption_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_album_photos", x => x.id);
                    table.ForeignKey(
                        name: "fk_album_photos_albums_album_id",
                        column: x => x.album_id,
                        principalTable: "albums",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_album_photos_file_assets_file_asset_id",
                        column: x => x.file_asset_id,
                        principalTable: "file_assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_album_photos_album_id_file_asset_id",
                table: "album_photos",
                columns: new[] { "album_id", "file_asset_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_album_photos_album_id_sort_order",
                table: "album_photos",
                columns: new[] { "album_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_album_photos_file_asset_id",
                table: "album_photos",
                column: "file_asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_albums_group_id_parent_album_id_sort_order",
                table: "albums",
                columns: new[] { "group_id", "parent_album_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_albums_parent_album_id",
                table: "albums",
                column: "parent_album_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "album_photos");

            migrationBuilder.DropTable(
                name: "albums");
        }
    }
}
