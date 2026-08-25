using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupRosterCapabilityCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "group_roster_capabilities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    description_en = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    description_zh = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    requires_expiry = table.Column<bool>(type: "bit", nullable: false),
                    default_validity_days = table.Column<int>(type: "int", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_group_roster_capabilities", x => x.id);
                    table.ForeignKey(
                        name: "fk_group_roster_capabilities_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_group_roster_capabilities_group_id_is_active",
                table: "group_roster_capabilities",
                columns: new[] { "group_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "ix_group_roster_capabilities_group_id_key",
                table: "group_roster_capabilities",
                columns: new[] { "group_id", "key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "group_roster_capabilities");
        }
    }
}
