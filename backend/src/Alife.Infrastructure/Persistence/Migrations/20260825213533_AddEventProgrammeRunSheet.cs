using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventProgrammeRunSheet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_programme_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    roster_shift_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    owner_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    start_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    end_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    title_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    title_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    instructions_en = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    instructions_zh = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    requires_handover = table.Column<bool>(type: "bit", nullable: false),
                    handover_en = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    handover_zh = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    updated_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_programme_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_programme_items_event_occurrences_event_occurrence_id",
                        column: x => x.event_occurrence_id,
                        principalTable: "event_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_programme_items_event_roster_shifts_roster_shift_id",
                        column: x => x.roster_shift_id,
                        principalTable: "event_roster_shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_programme_items_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_programme_items_members_owner_member_id",
                        column: x => x.owner_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_programme_items_members_updated_by_member_id",
                        column: x => x.updated_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_programme_items_event_id_start_utc_sort_order",
                table: "event_programme_items",
                columns: new[] { "event_id", "start_utc", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_event_programme_items_event_occurrence_id",
                table: "event_programme_items",
                column: "event_occurrence_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_programme_items_owner_member_id",
                table: "event_programme_items",
                column: "owner_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_programme_items_roster_shift_id",
                table: "event_programme_items",
                column: "roster_shift_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_programme_items_updated_by_member_id",
                table: "event_programme_items",
                column: "updated_by_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_programme_items");
        }
    }
}
