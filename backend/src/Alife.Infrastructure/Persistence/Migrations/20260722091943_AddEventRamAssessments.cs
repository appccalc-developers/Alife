using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventRamAssessments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_ram_assessments",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ram_data_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    submitted_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    submitted_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    approved_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    approved_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_ram_assessments", x => x.event_id);
                    table.ForeignKey(
                        name: "fk_event_ram_assessments_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_ram_assessments_members_approved_by_member_id",
                        column: x => x.approved_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_ram_assessments_members_submitted_by_member_id",
                        column: x => x.submitted_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.Sql(
                """
                INSERT INTO [event_ram_assessments]
                    ([event_id], [ram_data_json], [status], [submitted_by_member_id], [submitted_utc], [approved_by_member_id], [approved_utc], [created_utc], [updated_utc])
                SELECT [id], N'{}', 0, NULL, NULL, NULL, NULL, [created_utc], [updated_utc]
                FROM [group_events];
                """);

            migrationBuilder.CreateIndex(
                name: "ix_event_ram_assessments_approved_by_member_id",
                table: "event_ram_assessments",
                column: "approved_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_ram_assessments_status_updated_utc",
                table: "event_ram_assessments",
                columns: new[] { "status", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_ram_assessments_submitted_by_member_id",
                table: "event_ram_assessments",
                column: "submitted_by_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_ram_assessments");
        }
    }
}
