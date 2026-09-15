using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EventTaskDelegationPreparation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "publication_selection_token", table: "event_operations_tasks", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<DateTime>(
                name: "assignment_responded_utc",
                table: "event_operations_tasks",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "assignment_status",
                table: "event_operations_tasks",
                type: "nvarchar(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "accepted");

            migrationBuilder.AddColumn<string>(
                name: "preparation_en",
                table: "event_operations_tasks",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "preparation_publication_candidate",
                table: "event_operations_tasks",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "preparation_updated_utc",
                table: "event_operations_tasks",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "preparation_zh",
                table: "event_operations_tasks",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "publication_selection_token", table: "event_operations_tasks");
            migrationBuilder.DropColumn(
                name: "assignment_responded_utc",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "assignment_status",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "preparation_en",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "preparation_publication_candidate",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "preparation_updated_utc",
                table: "event_operations_tasks");

            migrationBuilder.DropColumn(
                name: "preparation_zh",
                table: "event_operations_tasks");
        }
    }
}
