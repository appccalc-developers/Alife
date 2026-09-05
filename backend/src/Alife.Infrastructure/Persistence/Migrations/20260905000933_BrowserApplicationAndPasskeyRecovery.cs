using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BrowserApplicationAndPasskeyRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "recovery_group_id",
                table: "member_activation_invitations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "source_application_id",
                table: "member_activation_invitations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "browser_token_consumed_utc",
                table: "group_membership_applications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "browser_token_expires_utc",
                table: "group_membership_applications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "browser_token_hash",
                table: "group_membership_applications",
                type: "varbinary(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AlterColumn<byte[]>(
                name: "phone_lookup_hash",
                table: "church_person_applications",
                type: "varbinary(32)",
                maxLength: 32,
                nullable: true,
                oldClrType: typeof(byte[]),
                oldType: "varbinary(32)",
                oldMaxLength: 32);

            migrationBuilder.AlterColumn<string>(
                name: "phone_e164",
                table: "church_person_applications",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(30)",
                oldMaxLength: 30);

            migrationBuilder.AddColumn<Guid>(
                name: "identity_verified_by_member_id",
                table: "church_person_applications",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "identity_verified_utc",
                table: "church_person_applications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_identity_verified",
                table: "church_person_applications",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // The former flag represented both identity and contact verification.
            // Preserve that evidence without inventing an actor or timestamp.
            migrationBuilder.Sql("UPDATE church_person_applications SET is_identity_verified = 1 WHERE is_contact_verified = 1");

            migrationBuilder.CreateIndex(
                name: "ix_group_membership_applications_browser_token_hash_group_id",
                table: "group_membership_applications",
                columns: new[] { "browser_token_hash", "group_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Never manufacture telephone values during rollback. Keep the additive
            // schema in production; a destructive down migration requires remediation.
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM church_person_applications WHERE phone_e164 IS NULL OR phone_lookup_hash IS NULL) THROW 51000, 'Cannot roll back while phoneless applications exist; retain this schema.', 1;");
            migrationBuilder.DropIndex(
                name: "ix_group_membership_applications_browser_token_hash_group_id",
                table: "group_membership_applications");

            migrationBuilder.DropColumn(
                name: "recovery_group_id",
                table: "member_activation_invitations");

            migrationBuilder.DropColumn(
                name: "source_application_id",
                table: "member_activation_invitations");

            migrationBuilder.DropColumn(
                name: "browser_token_consumed_utc",
                table: "group_membership_applications");

            migrationBuilder.DropColumn(
                name: "browser_token_expires_utc",
                table: "group_membership_applications");

            migrationBuilder.DropColumn(
                name: "browser_token_hash",
                table: "group_membership_applications");

            migrationBuilder.DropColumn(
                name: "identity_verified_by_member_id",
                table: "church_person_applications");

            migrationBuilder.DropColumn(
                name: "identity_verified_utc",
                table: "church_person_applications");

            migrationBuilder.DropColumn(
                name: "is_identity_verified",
                table: "church_person_applications");

            migrationBuilder.AlterColumn<byte[]>(
                name: "phone_lookup_hash",
                table: "church_person_applications",
                type: "varbinary(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: new byte[0],
                oldClrType: typeof(byte[]),
                oldType: "varbinary(32)",
                oldMaxLength: 32,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "phone_e164",
                table: "church_person_applications",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(30)",
                oldMaxLength: 30,
                oldNullable: true);
        }
    }
}
