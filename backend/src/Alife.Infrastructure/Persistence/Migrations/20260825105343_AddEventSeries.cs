using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventSeries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "event_series_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "series_occurrence_date",
                table: "group_events",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "event_series",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    name_zh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    description_en = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    description_zh = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    time_zone_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    anchor_local_date = table.Column<DateOnly>(type: "date", nullable: false),
                    weekday = table.Column<int>(type: "int", nullable: false),
                    start_time_minutes = table.Column<int>(type: "int", nullable: false),
                    duration_minutes = table.Column<int>(type: "int", nullable: false),
                    interval_weeks = table.Column<int>(type: "int", nullable: false),
                    generation_horizon_weeks = table.Column<int>(type: "int", nullable: false),
                    low_horizon_weeks = table.Column<int>(type: "int", nullable: false),
                    visibility = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    default_modules_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_series", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_series_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_series_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_group_events_event_series_id_series_occurrence_date",
                table: "group_events",
                columns: new[] { "event_series_id", "series_occurrence_date" },
                unique: true,
                filter: "[event_series_id] IS NOT NULL AND [series_occurrence_date] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_event_series_created_by_member_id",
                table: "event_series",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_series_group_id_is_active_updated_utc",
                table: "event_series",
                columns: new[] { "group_id", "is_active", "updated_utc" });

            migrationBuilder.AddForeignKey(
                name: "fk_group_events_event_series_event_series_id",
                table: "group_events",
                column: "event_series_id",
                principalTable: "event_series",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_group_events_event_series_event_series_id",
                table: "group_events");

            migrationBuilder.DropTable(
                name: "event_series");

            migrationBuilder.DropIndex(
                name: "ix_group_events_event_series_id_series_occurrence_date",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "event_series_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "series_occurrence_date",
                table: "group_events");
        }
    }
}
