using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFileStorageProviders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "storage_provider_id",
                table: "file_assets",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "file_storage_providers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    kind = table.Column<int>(type: "int", nullable: false),
                    display_name_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    is_default = table.Column<bool>(type: "bit", nullable: false),
                    bucket_name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    region = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    endpoint = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    public_base_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    private_base_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    upload_api_base_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    public_path_prefix = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    private_path_prefix = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    supports_public_url = table.Column<bool>(type: "bit", nullable: false),
                    supports_signed_read = table.Column<bool>(type: "bit", nullable: false),
                    supports_server_side_move = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_file_storage_providers", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_file_assets_storage_provider_id",
                table: "file_assets",
                column: "storage_provider_id");

            migrationBuilder.CreateIndex(
                name: "ix_file_storage_providers_code",
                table: "file_storage_providers",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_file_storage_providers_is_active_is_default",
                table: "file_storage_providers",
                columns: new[] { "is_active", "is_default" });

            migrationBuilder.AddForeignKey(
                name: "fk_file_assets_file_storage_providers_storage_provider_id",
                table: "file_assets",
                column: "storage_provider_id",
                principalTable: "file_storage_providers",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_file_assets_file_storage_providers_storage_provider_id",
                table: "file_assets");

            migrationBuilder.DropTable(
                name: "file_storage_providers");

            migrationBuilder.DropIndex(
                name: "ix_file_assets_storage_provider_id",
                table: "file_assets");

            migrationBuilder.DropColumn(
                name: "storage_provider_id",
                table: "file_assets");
        }
    }
}
