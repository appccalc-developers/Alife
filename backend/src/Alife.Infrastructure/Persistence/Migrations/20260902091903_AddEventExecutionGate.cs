using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventExecutionGate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "execution_concurrency_token",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWSEQUENTIALID()");

            migrationBuilder.AddColumn<Guid>(
                name: "execution_confirmed_by_member_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "execution_confirmed_utc",
                table: "group_events",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "execution_gate_mode",
                table: "group_events",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "execution_package_id",
                table: "group_events",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "execution_status",
                table: "group_events",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "ix_group_events_execution_confirmed_by_member_id",
                table: "group_events",
                column: "execution_confirmed_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_events_execution_package_id",
                table: "group_events",
                column: "execution_package_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_events_execution_status_start_date_end_date",
                table: "group_events",
                columns: new[] { "execution_status", "start_date", "end_date" });

            migrationBuilder.AddForeignKey(
                name: "fk_group_events_event_packages_execution_package_id",
                table: "group_events",
                column: "execution_package_id",
                principalTable: "event_packages",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_group_events_members_execution_confirmed_by_member_id",
                table: "group_events",
                column: "execution_confirmed_by_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_group_events_event_packages_execution_package_id",
                table: "group_events");

            migrationBuilder.DropForeignKey(
                name: "fk_group_events_members_execution_confirmed_by_member_id",
                table: "group_events");

            migrationBuilder.DropIndex(
                name: "ix_group_events_execution_confirmed_by_member_id",
                table: "group_events");

            migrationBuilder.DropIndex(
                name: "ix_group_events_execution_package_id",
                table: "group_events");

            migrationBuilder.DropIndex(
                name: "ix_group_events_execution_status_start_date_end_date",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "execution_concurrency_token",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "execution_confirmed_by_member_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "execution_confirmed_utc",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "execution_gate_mode",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "execution_package_id",
                table: "group_events");

            migrationBuilder.DropColumn(
                name: "execution_status",
                table: "group_events");
        }
    }
}
