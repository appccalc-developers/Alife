using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PublicChurchApplications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "group_join_invite_id",
                table: "group_membership_applications",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<string>(
                name: "email",
                table: "church_person_applications",
                type: "nvarchar(320)",
                maxLength: 320,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "notification_consent_version",
                table: "church_person_applications",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "notification_consented_utc",
                table: "church_person_applications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sex",
                table: "church_person_applications",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM group_membership_applications WHERE group_join_invite_id IS NULL)
                    OR EXISTS (SELECT 1 FROM church_person_applications WHERE email IS NOT NULL OR sex IS NOT NULL OR notification_consented_utc IS NOT NULL OR notification_consent_version IS NOT NULL)
                    THROW 51000, 'Public church applications contain data. Retain the additive schema when rolling back the application.', 1;
                """);
            migrationBuilder.DropColumn(
                name: "email",
                table: "church_person_applications");

            migrationBuilder.DropColumn(
                name: "notification_consent_version",
                table: "church_person_applications");

            migrationBuilder.DropColumn(
                name: "notification_consented_utc",
                table: "church_person_applications");

            migrationBuilder.DropColumn(
                name: "sex",
                table: "church_person_applications");

            migrationBuilder.AlterColumn<Guid>(
                name: "group_join_invite_id",
                table: "group_membership_applications",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);
        }
    }
}
