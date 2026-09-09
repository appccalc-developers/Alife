using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AccountApplicationInvitations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "accepted_utc",
                table: "member_activation_invitations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "approval_required",
                table: "member_activation_invitations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "delivery_email",
                table: "member_activation_invitations",
                type: "nvarchar(254)",
                maxLength: 254,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deployment_administrator",
                table: "member_activation_invitations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "continued_application_id",
                table: "group_membership_applications",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM member_activation_invitations WHERE approval_required = 1 OR is_deployment_administrator = 1)
                   OR EXISTS (SELECT 1 FROM group_membership_applications WHERE continued_application_id IS NOT NULL OR source IN ('recoveryQr', 'continuationQr'))
                    THROW 51000, 'Account workflow data exists. Retain the additive schema when rolling back application code.', 1;
                """);
            migrationBuilder.DropColumn(
                name: "accepted_utc",
                table: "member_activation_invitations");

            migrationBuilder.DropColumn(
                name: "approval_required",
                table: "member_activation_invitations");

            migrationBuilder.DropColumn(
                name: "delivery_email",
                table: "member_activation_invitations");

            migrationBuilder.DropColumn(
                name: "is_deployment_administrator",
                table: "member_activation_invitations");

            migrationBuilder.DropColumn(
                name: "continued_application_id",
                table: "group_membership_applications");
        }
    }
}
