using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddContactProfilesAndInquiries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "contact_profiles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    owner_group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    role_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    photo_url = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: true),
                    notes_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    phone = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    visibility = table.Column<int>(type: "int", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_contact_profiles", x => x.id);
                    table.ForeignKey(
                        name: "fk_contact_profiles_groups_owner_group_id",
                        column: x => x.owner_group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_contact_profiles_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "contact_inquiries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    contact_profile_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    owner_group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    submitted_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    display_name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    phone = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    message = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    preferred_language = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    source_page = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ip_address = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    user_agent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    submitted_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_contact_inquiries", x => x.id);
                    table.ForeignKey(
                        name: "fk_contact_inquiries_contact_profiles_contact_profile_id",
                        column: x => x.contact_profile_id,
                        principalTable: "contact_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_contact_inquiries_groups_owner_group_id",
                        column: x => x.owner_group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_contact_inquiries_members_submitted_by_member_id",
                        column: x => x.submitted_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_contact_profiles",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    contact_profile_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_contact_profiles", x => new { x.event_id, x.contact_profile_id });
                    table.ForeignKey(
                        name: "fk_event_contact_profiles_contact_profiles_contact_profile_id",
                        column: x => x.contact_profile_id,
                        principalTable: "contact_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_contact_profiles_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_contact_inquiries_contact_profile_id_submitted_utc",
                table: "contact_inquiries",
                columns: new[] { "contact_profile_id", "submitted_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_contact_inquiries_owner_group_id_submitted_utc",
                table: "contact_inquiries",
                columns: new[] { "owner_group_id", "submitted_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_contact_inquiries_submitted_by_member_id",
                table: "contact_inquiries",
                column: "submitted_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_contact_profiles_member_id",
                table: "contact_profiles",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "ix_contact_profiles_owner_group_id_member_id",
                table: "contact_profiles",
                columns: new[] { "owner_group_id", "member_id" },
                unique: true,
                filter: "[is_deleted] = 0");

            migrationBuilder.CreateIndex(
                name: "ix_contact_profiles_owner_group_id_visibility_updated_utc",
                table: "contact_profiles",
                columns: new[] { "owner_group_id", "visibility", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_contact_profiles_contact_profile_id",
                table: "event_contact_profiles",
                column: "contact_profile_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "contact_inquiries");

            migrationBuilder.DropTable(
                name: "event_contact_profiles");

            migrationBuilder.DropTable(
                name: "contact_profiles");
        }
    }
}
