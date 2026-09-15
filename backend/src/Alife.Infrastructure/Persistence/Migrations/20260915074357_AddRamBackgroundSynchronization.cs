using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRamBackgroundSynchronization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ai_risk_draft_json",
                table: "event_ram_assessments",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "evaluated_context_hash",
                table: "event_ram_assessments",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_updated",
                table: "event_ram_assessments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_evaluated_at",
                table: "event_ram_assessments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "sync_attempts",
                table: "event_ram_assessments",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "sync_due_utc",
                table: "event_ram_assessments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sync_error",
                table: "event_ram_assessments",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "sync_reviewed_at",
                table: "event_ram_assessments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "sync_reviewed_by_member_id",
                table: "event_ram_assessments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sync_status",
                table: "event_ram_assessments",
                type: "nvarchar(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "Draft");

            migrationBuilder.CreateIndex(
                name: "ix_event_ram_assessments_is_updated_sync_due_utc",
                table: "event_ram_assessments",
                columns: new[] { "is_updated", "sync_due_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_event_ram_assessments_is_updated_sync_due_utc",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "ai_risk_draft_json",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "evaluated_context_hash",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "is_updated",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "last_evaluated_at",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "sync_attempts",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "sync_due_utc",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "sync_error",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "sync_reviewed_at",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "sync_reviewed_by_member_id",
                table: "event_ram_assessments");

            migrationBuilder.DropColumn(
                name: "sync_status",
                table: "event_ram_assessments");
        }
    }
}
