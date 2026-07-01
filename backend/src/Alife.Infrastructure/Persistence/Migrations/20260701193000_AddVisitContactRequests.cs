using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(AlifeDbContext))]
    [Migration("20260701193000_AddVisitContactRequests")]
    public partial class AddVisitContactRequests : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "visit_contact_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    display_name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    phone = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    preferred_language = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    message = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    source_page = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    submitted_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    handled_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    handled_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ip_address = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    user_agent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_visit_contact_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_visit_contact_requests_members_handled_by_member_id",
                        column: x => x.handled_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_visit_contact_requests_handled_by_member_id",
                table: "visit_contact_requests",
                column: "handled_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_visit_contact_requests_status_submitted_utc",
                table: "visit_contact_requests",
                columns: new[] { "status", "submitted_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_visit_contact_requests_submitted_utc",
                table: "visit_contact_requests",
                column: "submitted_utc");

            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM platform_roles WHERE id = 6 OR code = 'visitor_contact_receiver')
                BEGIN
                    INSERT INTO platform_roles (id, code, name_json, permissions_json, level)
                    VALUES (
                        6,
                        'visitor_contact_receiver',
                        N'{"en":"Visitor Contact Receiver","zh":"访客联系接待"}',
                        N'["admin.access","admin.visitRequests.receive"]',
                        6
                    )
                END
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM platform_roles
                WHERE id = 6
                  AND code = 'visitor_contact_receiver'
                  AND NOT EXISTS (
                      SELECT 1 FROM member_platform_roles
                      WHERE role_id = 6 AND revoked_utc IS NULL
                  )
                """);

            migrationBuilder.DropTable(
                name: "visit_contact_requests");
        }
    }
}
