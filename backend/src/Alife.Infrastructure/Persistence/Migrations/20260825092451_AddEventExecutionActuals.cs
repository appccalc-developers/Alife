using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventExecutionActuals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_attendance_records",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_occurrence_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_enrollment_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    attended_units = table.Column<int>(type: "int", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    recorded_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_attendance_records", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_attendance_records_event_enrollments_event_enrollment_id",
                        column: x => x.event_enrollment_id,
                        principalTable: "event_enrollments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_attendance_records_event_occurrences_event_occurrence_id",
                        column: x => x.event_occurrence_id,
                        principalTable: "event_occurrences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_event_attendance_records_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_attendance_records_members_recorded_by_member_id",
                        column: x => x.recorded_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_finance_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    type = table.Column<int>(type: "int", nullable: false),
                    category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    description_en = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    description_zh = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    occurred_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    recorded_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_finance_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_event_finance_entries_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_finance_entries_members_recorded_by_member_id",
                        column: x => x.recorded_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "event_finance_reconciliations",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    notes_en = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    notes_zh = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    leader_confirmed = table.Column<bool>(type: "bit", nullable: false),
                    confirmed_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    confirmed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_finance_reconciliations", x => x.event_id);
                    table.ForeignKey(
                        name: "fk_event_finance_reconciliations_group_events_event_id",
                        column: x => x.event_id,
                        principalTable: "group_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_finance_reconciliations_members_confirmed_by_member_id",
                        column: x => x.confirmed_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_attendance_records_event_enrollment_id",
                table: "event_attendance_records",
                column: "event_enrollment_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_attendance_records_event_id_updated_utc",
                table: "event_attendance_records",
                columns: new[] { "event_id", "updated_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_attendance_records_event_occurrence_id_event_enrollment_id",
                table: "event_attendance_records",
                columns: new[] { "event_occurrence_id", "event_enrollment_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_attendance_records_recorded_by_member_id",
                table: "event_attendance_records",
                column: "recorded_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_finance_entries_event_id_occurred_utc",
                table: "event_finance_entries",
                columns: new[] { "event_id", "occurred_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_finance_entries_recorded_by_member_id",
                table: "event_finance_entries",
                column: "recorded_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_finance_reconciliations_confirmed_by_member_id",
                table: "event_finance_reconciliations",
                column: "confirmed_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_finance_reconciliations_leader_confirmed_updated_utc",
                table: "event_finance_reconciliations",
                columns: new[] { "leader_confirmed", "updated_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_attendance_records");

            migrationBuilder.DropTable(
                name: "event_finance_entries");

            migrationBuilder.DropTable(
                name: "event_finance_reconciliations");
        }
    }
}
