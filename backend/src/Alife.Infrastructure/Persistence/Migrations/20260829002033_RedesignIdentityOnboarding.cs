using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RedesignIdentityOnboarding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "privacy_consent_version",
                table: "visit_contact_requests",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "privacy_consented_utc",
                table: "visit_contact_requests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "reply_preference",
                table: "visit_contact_requests",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "request_kind",
                table: "visit_contact_requests",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "visitorMessage");

            migrationBuilder.AddColumn<byte[]>(
                name: "web_authn_user_handle",
                table: "members",
                type: "varbinary(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "church_person_applications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    applicant_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    linked_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    display_name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    phone_e164 = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    phone_lookup_hash = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    reply_preference = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    preferred_language = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    declaration = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    privacy_consent_version = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    privacy_consented_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    is_contact_verified = table.Column<bool>(type: "bit", nullable: false),
                    match_state = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    submitted_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_church_person_applications", x => x.id);
                    table.ForeignKey(
                        name: "fk_church_person_applications_members_applicant_member_id",
                        column: x => x.applicant_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_church_person_applications_members_linked_member_id",
                        column: x => x.linked_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "group_join_invites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    selector = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    expires_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_used_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    submission_count = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_group_join_invites", x => x.id);
                    table.ForeignKey(
                        name: "fk_group_join_invites_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_group_join_invites_members_created_by_member_id",
                        column: x => x.created_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "member_activation_invitations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    issued_by_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    selector = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    secret_hash = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    purpose = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    delivery_status = table.Column<int>(type: "int", nullable: false),
                    delivery_error_code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    expires_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    sent_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    used_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    revoked_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_member_activation_invitations", x => x.id);
                    table.ForeignKey(
                        name: "fk_member_activation_invitations_members_issued_by_member_id",
                        column: x => x.issued_by_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_member_activation_invitations_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "member_passkey_credentials",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    credential_id = table.Column<byte[]>(type: "varbinary(1024)", maxLength: 1024, nullable: false),
                    public_key = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    user_handle = table.Column<byte[]>(type: "varbinary(64)", maxLength: 64, nullable: false),
                    signature_counter = table.Column<long>(type: "bigint", nullable: false),
                    transports_json = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    is_backup_eligible = table.Column<bool>(type: "bit", nullable: false),
                    is_backed_up = table.Column<bool>(type: "bit", nullable: false),
                    display_name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_used_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    revoked_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_member_passkey_credentials", x => x.id);
                    table.ForeignKey(
                        name: "fk_member_passkey_credentials_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "onboarding_flows",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    token_hash = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    intent = table.Column<int>(type: "int", nullable: false),
                    return_path = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    is_public_device = table.Column<bool>(type: "bit", nullable: false),
                    activation_invitation_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    group_join_invite_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    application_response_token_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    line_o_auth_state_hash = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    expires_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    consumed_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_onboarding_flows", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "rate_limit_buckets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    scope = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    key_hash = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    window_started_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    expires_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    count = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rate_limit_buckets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "group_membership_applications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    church_person_application_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_join_invite_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    applicant_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    deduplication_key = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    source = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    submitted_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_group_membership_applications", x => x.id);
                    table.ForeignKey(
                        name: "fk_group_membership_applications_church_person_applications_church_person_application_id",
                        column: x => x.church_person_application_id,
                        principalTable: "church_person_applications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_group_membership_applications_group_join_invites_group_join_invite_id",
                        column: x => x.group_join_invite_id,
                        principalTable: "group_join_invites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_group_membership_applications_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_group_membership_applications_members_applicant_member_id",
                        column: x => x.applicant_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "activation_group_grants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    activation_invitation_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    conflict_code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activation_group_grants", x => x.id);
                    table.ForeignKey(
                        name: "fk_activation_group_grants_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_activation_group_grants_member_activation_invitations_activation_invitation_id",
                        column: x => x.activation_invitation_id,
                        principalTable: "member_activation_invitations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "passkey_ceremonies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    kind = table.Column<int>(type: "int", nullable: false),
                    member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    onboarding_flow_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    options_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    expires_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    consumed_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_passkey_ceremonies", x => x.id);
                    table.ForeignKey(
                        name: "fk_passkey_ceremonies_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_passkey_ceremonies_onboarding_flows_onboarding_flow_id",
                        column: x => x.onboarding_flow_id,
                        principalTable: "onboarding_flows",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "application_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_membership_application_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    actor_member_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    kind = table.Column<int>(type: "int", nullable: false),
                    from_status = table.Column<int>(type: "int", nullable: false),
                    to_status = table.Column<int>(type: "int", nullable: false),
                    note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_application_history", x => x.id);
                    table.ForeignKey(
                        name: "fk_application_history_group_membership_applications_group_membership_application_id",
                        column: x => x.group_membership_application_id,
                        principalTable: "group_membership_applications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_application_history_members_actor_member_id",
                        column: x => x.actor_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "application_response_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    group_membership_application_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    selector = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    secret_hash = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    delivery_status = table.Column<int>(type: "int", nullable: false),
                    created_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    expires_utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    consumed_utc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    revoked_utc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_application_response_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_application_response_tokens_group_membership_applications_group_membership_application_id",
                        column: x => x.group_membership_application_id,
                        principalTable: "group_membership_applications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_members_web_authn_user_handle",
                table: "members",
                column: "web_authn_user_handle",
                unique: true,
                filter: "[web_authn_user_handle] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_activation_group_grants_activation_invitation_id_group_id",
                table: "activation_group_grants",
                columns: new[] { "activation_invitation_id", "group_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_activation_group_grants_group_id",
                table: "activation_group_grants",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "ix_application_history_actor_member_id",
                table: "application_history",
                column: "actor_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_application_history_group_membership_application_id_created_utc",
                table: "application_history",
                columns: new[] { "group_membership_application_id", "created_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_application_response_tokens_expires_utc",
                table: "application_response_tokens",
                column: "expires_utc");

            migrationBuilder.CreateIndex(
                name: "ix_application_response_tokens_group_membership_application_id",
                table: "application_response_tokens",
                column: "group_membership_application_id");

            migrationBuilder.CreateIndex(
                name: "ix_application_response_tokens_selector",
                table: "application_response_tokens",
                column: "selector",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_church_person_applications_applicant_member_id",
                table: "church_person_applications",
                column: "applicant_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_church_person_applications_linked_member_id",
                table: "church_person_applications",
                column: "linked_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_church_person_applications_phone_lookup_hash_status",
                table: "church_person_applications",
                columns: new[] { "phone_lookup_hash", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_group_join_invites_created_by_member_id",
                table: "group_join_invites",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_join_invites_group_id",
                table: "group_join_invites",
                column: "group_id",
                unique: true,
                filter: "[status] IN (0, 1)");

            migrationBuilder.CreateIndex(
                name: "ix_group_join_invites_selector",
                table: "group_join_invites",
                column: "selector",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_group_membership_applications_applicant_member_id",
                table: "group_membership_applications",
                column: "applicant_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_membership_applications_church_person_application_id",
                table: "group_membership_applications",
                column: "church_person_application_id");

            migrationBuilder.CreateIndex(
                name: "ix_group_membership_applications_deduplication_key",
                table: "group_membership_applications",
                column: "deduplication_key",
                unique: true,
                filter: "[status] IN (0, 1, 2)");

            migrationBuilder.CreateIndex(
                name: "ix_group_membership_applications_group_id_status_submitted_utc",
                table: "group_membership_applications",
                columns: new[] { "group_id", "status", "submitted_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_group_membership_applications_group_join_invite_id",
                table: "group_membership_applications",
                column: "group_join_invite_id");

            migrationBuilder.CreateIndex(
                name: "ix_member_activation_invitations_expires_utc",
                table: "member_activation_invitations",
                column: "expires_utc");

            migrationBuilder.CreateIndex(
                name: "ix_member_activation_invitations_issued_by_member_id",
                table: "member_activation_invitations",
                column: "issued_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_member_activation_invitations_member_id_status",
                table: "member_activation_invitations",
                columns: new[] { "member_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_member_activation_invitations_selector",
                table: "member_activation_invitations",
                column: "selector",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_member_passkey_credentials_credential_id",
                table: "member_passkey_credentials",
                column: "credential_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_member_passkey_credentials_member_id_revoked_utc",
                table: "member_passkey_credentials",
                columns: new[] { "member_id", "revoked_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_onboarding_flows_expires_utc",
                table: "onboarding_flows",
                column: "expires_utc");

            migrationBuilder.CreateIndex(
                name: "ix_onboarding_flows_token_hash",
                table: "onboarding_flows",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_passkey_ceremonies_expires_utc",
                table: "passkey_ceremonies",
                column: "expires_utc");

            migrationBuilder.CreateIndex(
                name: "ix_passkey_ceremonies_member_id",
                table: "passkey_ceremonies",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "ix_passkey_ceremonies_onboarding_flow_id",
                table: "passkey_ceremonies",
                column: "onboarding_flow_id");

            migrationBuilder.CreateIndex(
                name: "ix_rate_limit_buckets_expires_utc",
                table: "rate_limit_buckets",
                column: "expires_utc");

            migrationBuilder.CreateIndex(
                name: "ix_rate_limit_buckets_scope_key_hash_window_started_utc",
                table: "rate_limit_buckets",
                columns: new[] { "scope", "key_hash", "window_started_utc" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "activation_group_grants");

            migrationBuilder.DropTable(
                name: "application_history");

            migrationBuilder.DropTable(
                name: "application_response_tokens");

            migrationBuilder.DropTable(
                name: "member_passkey_credentials");

            migrationBuilder.DropTable(
                name: "passkey_ceremonies");

            migrationBuilder.DropTable(
                name: "rate_limit_buckets");

            migrationBuilder.DropTable(
                name: "member_activation_invitations");

            migrationBuilder.DropTable(
                name: "group_membership_applications");

            migrationBuilder.DropTable(
                name: "onboarding_flows");

            migrationBuilder.DropTable(
                name: "church_person_applications");

            migrationBuilder.DropTable(
                name: "group_join_invites");

            migrationBuilder.DropIndex(
                name: "ix_members_web_authn_user_handle",
                table: "members");

            migrationBuilder.DropColumn(
                name: "privacy_consent_version",
                table: "visit_contact_requests");

            migrationBuilder.DropColumn(
                name: "privacy_consented_utc",
                table: "visit_contact_requests");

            migrationBuilder.DropColumn(
                name: "reply_preference",
                table: "visit_contact_requests");

            migrationBuilder.DropColumn(
                name: "request_kind",
                table: "visit_contact_requests");

            migrationBuilder.DropColumn(
                name: "web_authn_user_handle",
                table: "members");
        }
    }
}
