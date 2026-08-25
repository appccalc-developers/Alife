using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkVenueBookingsToEventOccurrences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "event_occurrence_id",
                table: "event_venue_bookings",
                type: "uniqueidentifier",
                nullable: true);

            // Preserve every existing request by attaching it to the first migrated session.
            // The column remains nullable for deleted legacy events that intentionally have no plan.
            migrationBuilder.Sql("""
                UPDATE booking
                SET event_occurrence_id = occurrence.id
                FROM event_venue_bookings booking
                INNER JOIN event_plans event_plan ON event_plan.event_id = booking.event_id
                CROSS APPLY (
                    SELECT TOP (1) candidate.id
                    FROM event_occurrences candidate
                    WHERE candidate.event_plan_id = event_plan.id
                    ORDER BY candidate.sort_order, candidate.id
                ) occurrence
                WHERE booking.event_occurrence_id IS NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_event_venue_bookings_event_occurrence_id",
                table: "event_venue_bookings",
                column: "event_occurrence_id");

            migrationBuilder.AddForeignKey(
                name: "fk_event_venue_bookings_event_occurrences_event_occurrence_id",
                table: "event_venue_bookings",
                column: "event_occurrence_id",
                principalTable: "event_occurrences",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_event_venue_bookings_event_occurrences_event_occurrence_id",
                table: "event_venue_bookings");

            migrationBuilder.DropIndex(
                name: "ix_event_venue_bookings_event_occurrence_id",
                table: "event_venue_bookings");

            migrationBuilder.DropColumn(
                name: "event_occurrence_id",
                table: "event_venue_bookings");
        }
    }
}
