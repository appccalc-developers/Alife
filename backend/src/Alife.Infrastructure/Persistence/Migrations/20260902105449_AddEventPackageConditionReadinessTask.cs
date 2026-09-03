using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventPackageConditionReadinessTask : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "readiness_task_id",
                table: "event_package_conditions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_package_conditions_readiness_task_id",
                table: "event_package_conditions",
                column: "readiness_task_id",
                unique: true,
                filter: "[readiness_task_id] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "fk_event_package_conditions_event_tasks_readiness_task_id",
                table: "event_package_conditions",
                column: "readiness_task_id",
                principalTable: "event_operations_tasks",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_event_package_conditions_event_tasks_readiness_task_id",
                table: "event_package_conditions");

            migrationBuilder.DropIndex(
                name: "ix_event_package_conditions_readiness_task_id",
                table: "event_package_conditions");

            migrationBuilder.DropColumn(
                name: "readiness_task_id",
                table: "event_package_conditions");
        }
    }
}
