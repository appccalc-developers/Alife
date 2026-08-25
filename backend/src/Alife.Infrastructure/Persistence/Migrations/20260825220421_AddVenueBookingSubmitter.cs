using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVenueBookingSubmitter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "submitted_by_member_id",
                table: "event_venue_bookings",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE event_venue_bookings
                SET submitted_by_member_id = requested_by_member_id
                WHERE submitted_utc IS NOT NULL
                  AND submitted_by_member_id IS NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_event_venue_bookings_submitted_by_member_id",
                table: "event_venue_bookings",
                column: "submitted_by_member_id");

            migrationBuilder.AddForeignKey(
                name: "fk_event_venue_bookings_members_submitted_by_member_id",
                table: "event_venue_bookings",
                column: "submitted_by_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_event_venue_bookings_members_submitted_by_member_id",
                table: "event_venue_bookings");

            migrationBuilder.DropIndex(
                name: "ix_event_venue_bookings_submitted_by_member_id",
                table: "event_venue_bookings");

            migrationBuilder.DropColumn(
                name: "submitted_by_member_id",
                table: "event_venue_bookings");
        }
    }
}
