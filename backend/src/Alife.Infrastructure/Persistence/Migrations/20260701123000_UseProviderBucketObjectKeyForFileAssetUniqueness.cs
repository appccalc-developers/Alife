using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AlifeDbContext))]
    [Migration("20260701123000_UseProviderBucketObjectKeyForFileAssetUniqueness")]
    public partial class UseProviderBucketObjectKeyForFileAssetUniqueness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_file_assets_object_key",
                table: "file_assets");

            migrationBuilder.CreateIndex(
                name: "ix_file_assets_storage_provider_bucket_name_object_key",
                table: "file_assets",
                columns: new[] { "storage_provider", "bucket_name", "object_key" },
                unique: true,
                filter: "[is_deleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_file_assets_storage_provider_bucket_name_object_key",
                table: "file_assets");

            migrationBuilder.CreateIndex(
                name: "ix_file_assets_object_key",
                table: "file_assets",
                column: "object_key",
                unique: true,
                filter: "[is_deleted] = 0");
        }
    }
}
