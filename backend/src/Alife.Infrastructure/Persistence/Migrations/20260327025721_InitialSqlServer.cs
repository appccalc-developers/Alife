using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSqlServer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "groups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    parent_group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    access_type = table.Column<int>(type: "int", nullable: false),
                    is_church = table.Column<bool>(type: "bit", nullable: false),
                    is_closed = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_groups", x => x.id);
                    table.ForeignKey(
                        name: "fk_groups_groups_parent_group_id",
                        column: x => x.parent_group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "members",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    display_name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    sex = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    age = table.Column<int>(type: "int", nullable: true),
                    email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    phone_e164 = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    phone_verified_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    is_registered = table.Column<bool>(type: "bit", nullable: false),
                    is_admin = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_members", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "group_memberships",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    role = table.Column<int>(type: "int", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_group_memberships", x => x.id);
                    table.ForeignKey(
                        name: "fk_group_memberships_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_group_memberships_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    scope = table.Column<int>(type: "int", nullable: false),
                    owner_group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    tags_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    title_display_style = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    slug = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    language = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    visibility = table.Column<int>(type: "int", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pages", x => x.id);
                    table.ForeignKey(
                        name: "fk_pages_groups_owner_group_id",
                        column: x => x.owner_group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pages_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    page_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order = table.Column<int>(type: "int", nullable: false),
                    type = table.Column<int>(type: "int", nullable: false),
                    content_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    style_json = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sections", x => x.id);
                    table.ForeignKey(
                        name: "fk_sections_pages_page_id",
                        column: x => x.page_id,
                        principalTable: "pages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "links",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    owner_section_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    type = table.Column<int>(type: "int", nullable: false),
                    target_group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    target_page_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    image_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_links", x => x.id);
                    table.ForeignKey(
                        name: "fk_links_sections_owner_section_id",
                        column: x => x.owner_section_id,
                        principalTable: "sections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_group_memberships_group_id_member_id",
                table: "group_memberships",
                columns: new[] { "group_id", "member_id" },
                unique: true,
                filter: "[status] = 2");

            migrationBuilder.CreateIndex(
                name: "ix_group_memberships_group_id_role",
                table: "group_memberships",
                columns: new[] { "group_id", "role" },
                unique: true,
                filter: "[status] = 2 AND [role] = 2");

            migrationBuilder.CreateIndex(
                name: "ix_group_memberships_member_id",
                table: "group_memberships",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "ix_groups_parent_group_id",
                table: "groups",
                column: "parent_group_id");

            migrationBuilder.CreateIndex(
                name: "ix_links_owner_section_id",
                table: "links",
                column: "owner_section_id");

            migrationBuilder.CreateIndex(
                name: "ix_members_phone_e164",
                table: "members",
                column: "phone_e164",
                unique: true,
                filter: "[phone_e164] IS NOT NULL AND [is_registered] = 1");

            migrationBuilder.CreateIndex(
                name: "ix_pages_created_by_member_id",
                table: "pages",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_pages_owner_group_id",
                table: "pages",
                column: "owner_group_id");

            migrationBuilder.CreateIndex(
                name: "ix_pages_scope_owner_group_id_slug_language",
                table: "pages",
                columns: new[] { "scope", "owner_group_id", "slug", "language" },
                unique: true,
                filter: "[owner_group_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_sections_page_id",
                table: "sections",
                column: "page_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "group_memberships");

            migrationBuilder.DropTable(
                name: "links");

            migrationBuilder.DropTable(
                name: "sections");

            migrationBuilder.DropTable(
                name: "pages");

            migrationBuilder.DropTable(
                name: "groups");

            migrationBuilder.DropTable(
                name: "members");
        }
    }
}
