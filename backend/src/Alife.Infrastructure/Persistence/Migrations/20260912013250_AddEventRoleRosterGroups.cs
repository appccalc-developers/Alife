using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventRoleRosterGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_roster_groups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role_code = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    module_code = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    member_ids_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_roster_groups", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_roster_groups_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_roster_groups_event_id_role_code",
                table: "event_roster_groups",
                columns: new[] { "event_id", "role_code" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_roster_groups");
        }
    }
}
