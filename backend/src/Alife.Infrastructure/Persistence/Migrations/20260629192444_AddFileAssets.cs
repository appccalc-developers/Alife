using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFileAssets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "file_assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    storage_provider = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    bucket_name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    object_key = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: false),
                    public_url = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: true),
                    original_file_name = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: false),
                    stored_file_name = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: false),
                    content_type = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    e_tag = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    visibility = table.Column<int>(type: "int", nullable: false),
                    purpose = table.Column<int>(type: "int", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    owner_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    related_entity_type = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    related_entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    uploaded_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false),
                    deleted_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_file_assets", x => x.id);
                    table.ForeignKey(
                        name: "fk_file_assets_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_file_assets_members_owner_member_id",
                        column: x => x.owner_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_file_assets_group_id_visibility_uploaded_utc",
                table: "file_assets",
                columns: new[] { "group_id", "visibility", "uploaded_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_file_assets_object_key",
                table: "file_assets",
                column: "object_key",
                unique: true,
                filter: "[is_deleted] = 0");

            migrationBuilder.CreateIndex(
                name: "ix_file_assets_owner_member_id_uploaded_utc",
                table: "file_assets",
                columns: new[] { "owner_member_id", "uploaded_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_file_assets_related_entity_type_related_entity_id",
                table: "file_assets",
                columns: new[] { "related_entity_type", "related_entity_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "file_assets");
        }
    }
}
