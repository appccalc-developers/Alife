using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AlifeDbContext))]
    [Migration("20260609000000_AllowMultipleEventReviewsPerMember")]
    public partial class AllowMultipleEventReviewsPerMember : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_event_reviews_event_id_member_id",
                table: "event_reviews");

            migrationBuilder.CreateIndex(
                name: "ix_event_reviews_event_id_member_id",
                table: "event_reviews",
                columns: new[] { "event_id", "member_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_event_reviews_event_id_member_id",
                table: "event_reviews");

            migrationBuilder.CreateIndex(
                name: "ix_event_reviews_event_id_member_id",
                table: "event_reviews",
                columns: new[] { "event_id", "member_id" },
                unique: true);
        }
    }
}
