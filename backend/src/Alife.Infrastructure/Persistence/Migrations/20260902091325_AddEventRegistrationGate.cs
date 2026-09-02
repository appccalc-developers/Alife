using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventRegistrationGate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "registration_concurrency_token",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWSEQUENTIALID()");

            migrationBuilder.AddColumn<int>(
                name: "registration_gate_mode",
                table: "group_events",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "registration_opened_by_member_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "registration_opened_utc",
                table: "group_events",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "registration_package_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "registration_status",
                table: "group_events",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "ix_group_events_registration_opened_by_member_id",
                table: "group_events",
                column: "registration_opened_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_events_registration_package_id",
                table: "group_events",
                column: "registration_package_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_events_registration_status_start_date_end_date",
                table: "group_events",
                columns: new[] { "registration_status", "start_date", "end_date" });

            migrationBuilder.AddForeignKey(
                name: "fk_group_events_event_packages_registration_package_id",
                table: "group_events",
                column: "registration_package_id",
                principalTable: "event_packages",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_group_events_members_registration_opened_by_member_id",
                table: "group_events",
                column: "registration_opened_by_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_group_events_event_packages_registration_package_id",
                table: "group_events");

            migrationBuilder.DropForeignKey(
                name: "fk_group_events_members_registration_opened_by_member_id",
                table: "group_events");

            migrationBuilder.DropIndex(
                name: "ix_group_events_registration_opened_by_member_id",
                table: "group_events");

            migrationBuilder.DropIndex(
                name: "ix_group_events_registration_package_id",
                table: "group_events");

            migrationBuilder.DropIndex(
                name: "ix_group_events_registration_status_start_date_end_date",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "registration_concurrency_token",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "registration_gate_mode",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "registration_opened_by_member_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "registration_opened_utc",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "registration_package_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "registration_status",
                table: "group_events");
        }
    }
}
