using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventOccurrenceExecutionAndEvidenceRetention : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "evidence_expires_utc",
                table: "event_package_conditions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "evidence_reference_hash",
                table: "event_package_conditions",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "evidence_unavailable_utc",
                table: "event_package_conditions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "execution_concurrency_token",
                table: "event_composition_occurrences",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWSEQUENTIALID()");

            migrationBuilder.AddColumn<Guid>(
                name: "execution_confirmed_by_member_id",
                table: "event_composition_occurrences",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "execution_confirmed_utc",
                table: "event_composition_occurrences",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "execution_gate_mode",
                table: "event_composition_occurrences",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "execution_package_id",
                table: "event_composition_occurrences",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "execution_status",
                table: "event_composition_occurrences",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "ix_event_composition_occurrences_event_id_execution_status_start_utc",
                table: "event_composition_occurrences",
                columns: new[] { "event_id", "execution_status", "start_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_event_composition_occurrences_execution_confirmed_by_member_id",
                table: "event_composition_occurrences",
                column: "execution_confirmed_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_composition_occurrences_execution_package_id",
                table: "event_composition_occurrences",
                column: "execution_package_id");

            migrationBuilder.AddForeignKey(
                name: "fk_event_composition_occurrences_event_packages_execution_package_id",
                table: "event_composition_occurrences",
                column: "execution_package_id",
                principalTable: "event_packages",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_event_composition_occurrences_members_execution_confirmed_by_member_id",
                table: "event_composition_occurrences",
                column: "execution_confirmed_by_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_event_composition_occurrences_event_packages_execution_package_id",
                table: "event_composition_occurrences");

            migrationBuilder.DropForeignKey(
                name: "fk_event_composition_occurrences_members_execution_confirmed_by_member_id",
                table: "event_composition_occurrences");

            migrationBuilder.DropIndex(
                name: "ix_event_composition_occurrences_event_id_execution_status_start_utc",
                table: "event_composition_occurrences");

            migrationBuilder.DropIndex(
                name: "ix_event_composition_occurrences_execution_confirmed_by_member_id",
                table: "event_composition_occurrences");

            migrationBuilder.DropIndex(
                name: "ix_event_composition_occurrences_execution_package_id",
                table: "event_composition_occurrences");

            migrationBuilder.DropColumn(
                name: "evidence_expires_utc",
                table: "event_package_conditions");

            migrationBuilder.DropColumn(
                name: "evidence_reference_hash",
                table: "event_package_conditions");

            migrationBuilder.DropColumn(
                name: "evidence_unavailable_utc",
                table: "event_package_conditions");

            migrationBuilder.DropColumn(
                name: "execution_concurrency_token",
                table: "event_composition_occurrences");

            migrationBuilder.DropColumn(
                name: "execution_confirmed_by_member_id",
                table: "event_composition_occurrences");

            migrationBuilder.DropColumn(
                name: "execution_confirmed_utc",
                table: "event_composition_occurrences");

            migrationBuilder.DropColumn(
                name: "execution_gate_mode",
                table: "event_composition_occurrences");

            migrationBuilder.DropColumn(
                name: "execution_package_id",
                table: "event_composition_occurrences");

            migrationBuilder.DropColumn(
                name: "execution_status",
                table: "event_composition_occurrences");
        }
    }
}
