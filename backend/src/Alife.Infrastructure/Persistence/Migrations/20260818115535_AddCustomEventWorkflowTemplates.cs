using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomEventWorkflowTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "created_by_member_id",
                table: "event_workflow_templates",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "owner_group_id",
                table: "event_workflow_templates",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_templates_created_by_member_id",
                table: "event_workflow_templates",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_workflow_templates_owner_group_id_is_active_updated_utc",
                table: "event_workflow_templates",
                columns: new[] { "owner_group_id", "is_active", "updated_utc" });

            migrationBuilder.AddForeignKey(
                name: "fk_event_workflow_templates_groups_owner_group_id",
                table: "event_workflow_templates",
                column: "owner_group_id",
                principalTable: "groups",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_event_workflow_templates_members_created_by_member_id",
                table: "event_workflow_templates",
                column: "created_by_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_event_workflow_templates_groups_owner_group_id",
                table: "event_workflow_templates");

            migrationBuilder.DropForeignKey(
                name: "fk_event_workflow_templates_members_created_by_member_id",
                table: "event_workflow_templates");

            migrationBuilder.DropIndex(
                name: "ix_event_workflow_templates_created_by_member_id",
                table: "event_workflow_templates");

            migrationBuilder.DropIndex(
                name: "ix_event_workflow_templates_owner_group_id_is_active_updated_utc",
                table: "event_workflow_templates");

            migrationBuilder.DropColumn(
                name: "created_by_member_id",
                table: "event_workflow_templates");

            migrationBuilder.DropColumn(
                name: "owner_group_id",
                table: "event_workflow_templates");
        }
    }
}
