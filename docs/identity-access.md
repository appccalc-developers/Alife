# Membership applications, invitations, and account recovery

## Product contract

An applicant may omit their phone number. The leader verifies the person in person
and compares the application reference displayed on that person's phone before
approving. Identity verification and telephone verification are separate facts;
neither membership approval nor WebAuthn registration verifies a phone number.

The original browser can check the application, supplement information, and start
first activation after approval. Scanning an active group QR again resumes the
browser's application for that group. A public group QR, application reference,
name, or phone number never authorizes account activation by itself. An existing
registered account must sign in or use the separately authorized recovery path. A
pre-created account with elevated roles also requires the administrator recovery path.

The public group QR offers joining, account recovery without contact details, and
continuing an application from another browser. Recovery requests never search for
accounts anonymously. The leader checks the exact request on the person's phone,
selects the original member from the group directory, and explicitly verifies identity.
Approval binds a ten-minute recovery invitation to that request and browser; it does
not create a member or change memberships. The member checks the account name on
their phone before creating the replacement Passkey.

For a lost browser receipt, the new browser submits a continuation request. A leader
explicitly associates the original application from the same group after checking
the current request. This transfers the receipt, revokes old activation/response
links, preserves the original approval state and history, and does not duplicate
memberships. A pending original application still needs approval. Registered accounts
and accounts with historical credentials require recovery instead. The new request
reference continues to resolve to the original application for that browser only.

The member list also retains its personal recovery QR. Leaders and co-leaders may recover
approved ordinary members of their own open group. A target holding an approved
leader/co-leader role in any group, or any platform role other than `user`, requires
a platform administrator. Self-issuance is forbidden. A valid authenticated session,
including ordinary Alpha login, is sufficient for issuance; the actor must explicitly
confirm in-person identity verification. Ordinary Alpha login still cannot directly
register a Passkey, and the first-credential bootstrap invariant is unchanged.

Recovery QR invitations expire after ten minutes and can be consumed once. A member
scans on their personal phone, verifies the displayed account, and creates a Passkey.
Registration atomically saves the new credential, revokes all old credentials, consumes
the invitation, and invalidates other pending registrations and activation invitations.
Issuance, scanning, cancellation, expiry, and failed registration do not revoke existing
credentials. Issuer authority and target roles are checked again before completion.
**Existing login sessions on other devices are not revoked by this feature.**
They keep their existing expiry. The member ID, group relationships, and activity
records remain unchanged.

## Pre-registration and delivery

Pre-registration accepts a name and phone and/or email. `approvalRequired: true`
means only a list entry exists: accepting its invitation records consent, but both
registration authorization and completion remain blocked until a qualified operator
verifies and approves it. `approvalRequired: false` means the issuer already approved
the invitation. The management form defaults to requiring approval; the legacy API
default remains approved for compatibility with existing authorized issuers.
`IsRegistered` changes only on successful Passkey activation. Opening a link, email
security scanning, or accepting an invitation does not consume the link.

New first-activation links expire after 24 hours; recovery links expire after ten
minutes. Existing issued links retain their stored expiry. Reissuing revokes previous
invitations and preserves the pending-review requirement. Each link can complete once.
SMS delivery is manual: copy the phone and bilingual message in member management.
No Twilio integration is used. Email through the configured provider is sent explicitly by an authorized
operator to the address recorded on the invitation. Sending generates a fresh link;
the previous link becomes invalid. Secrets are never retrievable from list responses.
An email failure is visible and does not register the account or revoke Passkeys.

### Deployment administrator

Configure an existing seeded platform administrator's immutable member ID and an
operator-verified email address using `AdministratorActivation:MemberId` and `:Email`.
With `AdministratorActivation:Enabled=true`, DbMigrator's initialization sends
**Activate your ALIFE administrator account** only if that administrator has neither
a historical credential nor a previous deployment invitation. Ordinary API restarts
do not send mail. Multiple initialization executions use the serializable invitation
transaction. A failed or interrupted send is not automatically retried on restart;
the operator uses explicit recovery, preventing repeated unsolicited emails.

For a lost/expired/failed administrator invitation or loss of all Passkeys, run the
deployment executable with `--AdministratorActivation:Recover=true`. This path skips
migrations, seeding, and public-cache invalidation. It sends a new ten-minute link only
to the deployment-configured address, and requires that the configured member still
has a platform administrator role. Do not save the Recover switch in persistent
configuration. There is no HTTP endpoint for this operation. Completion rechecks the
configured account, mailbox, and administrator role. Historical credentials are
allowed only through the recovery purpose; Alpha bootstrap rules are unchanged.

Run the deployed executable with its normal database and secret configuration:

```text
dotnet Alife.DbMigrator.dll --AdministratorActivation:Recover=true
```

Recovery is accepted only as this explicit command-line switch; a persistent
environment setting alone is rejected before database work. Missing administrator
configuration returns `administrator_configuration_required` and exit code 1.

### Email configuration

Email delivery is optional and provider-neutral. Set `IdentityEmail:Provider` to `smtp`,
`microsoft365`, or `disabled`, and `IdentityEmail:Sender` to a sender mailbox authorized
by that provider. No church domain is assumed. Invitations and deployment administrator
activation/recovery use the same selected provider; the administrator recipient remains
bound separately by `AdministratorActivation:Email`. Unknown providers fail closed;
delivery never falls back to another provider or retries automatically. For compatibility,
an omitted/blank provider retains the original Graph selection (unavailable unless fully
configured). All values use deployment configuration; passwords and client secrets belong
in deployment secret storage. Environment variables replace `:` with `__`.

**SMTP / Gmail:** set `IdentityEmail:Smtp:Host`, `:Port` (default `587`), `:Username`
and `:Password`. Both credentials must be provided, or both omitted for a relay that
authorizes the deployment by IP. STARTTLS is mandatory, certificate validation remains
enabled, and there is no plaintext fallback. The built-in .NET SMTP transport supports
STARTTLS submission, including Gmail and other compatible SMTP services, without an
additional dependency. Implicit TLS/SMTPS on port 465 and OAuth-only SMTP authentication
are not supported; use the provider's STARTTLS endpoint with SMTP credentials or an
authorized relay. A configured port of 465 is rejected before sending. See
[.NET STARTTLS support](https://learn.microsoft.com/en-us/dotnet/api/system.net.mail.smtpclient.enablessl?view=net-10.0).

For Gmail, use `smtp.gmail.com`, port `587`, the full Gmail address as username and an
app password (not the normal account password). App passwords require two-step
verification and may be unavailable under account/organization policies. Verify eligibility
and the authorized sender with the mailbox administrator before enabling email. See
[Google SMTP settings](https://support.google.com/mail/answer/7104828) and
[Google app passwords](https://support.google.com/accounts/answer/185833).

**Microsoft 365 Graph (optional):** set `IdentityEmail:Provider=microsoft365`,
`IdentityEmail:TenantId`, `:ClientId`, `:ClientSecret`, and `:Sender`.
Use an Entra application authorized for Graph application `Mail.Send`, with Exchange
mailbox scope restricted to the intended sender. Tenant permission consent must be
verified before enabling delivery. This implementation uses client credentials and
Graph v1.0 `sendMail`, without adding an SDK or service dependency. HttpClient logging
is disabled for this sender. See [Microsoft sendMail documentation](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).

SMTP bounds each send attempt to 30 seconds; Graph bounds each HTTP request to 30 seconds.
Both providers return controlled error codes;
SMTP protocol traffic, credentials, provider responses and invitation secrets are never
logged by these senders or included in errors. `Sent` means server acceptance (SMTP
submission completion or Graph 202), not guaranteed inbox delivery. Timeouts can occur
after acceptance, so an unconfirmed send requires explicit reissue, which invalidates
the prior invitation. Opening an email link still does not consume it.

部署邮件服务可选 SMTP（含 Gmail STARTTLS）或 Microsoft 365 Graph，不限制教会邮箱域名。
邀请和管理员激活／恢复共用所选服务，管理员收件地址仍由部署配置单独绑定。
Gmail 使用 `smtp.gmail.com:587`、完整邮箱地址及应用密码；普通帐号密码不可代替应用密码。
SMTP 强制 STARTTLS，不支持仅提供 465 隐式 TLS 或仅允许 OAuth 的 SMTP 服务。
密码存入部署秘密配置；发送成功只表示服务器接受邮件，并不保证收件箱送达。

## Interfaces and storage

- `POST /api/onboarding/group-applications` accepts an omitted/null/blank `phoneE164`;
  supplied nonblank numbers must validate. The existing response is retained and the
  response sets `alife_application`, an HttpOnly, SameSite=Lax cookie (Secure on HTTPS),
  with a 72-hour lifetime. This is separate from the 30-minute onboarding cookie.
- The additive `intent` field accepts `join` (default), `recovery`, or `continuation`.
  Recovery and continuation require an anonymous browser receipt. Existing paginated,
  filtered and sorted management lists distinguish their `source` values. Approval
  requires `identityVerified: true` and respectively `linkedMemberId` or
  `originalApplicationId`, in addition to the current `rowVersion`.
- `POST /api/onboarding/activation/accept` records acceptance without granting access.
  `POST /api/admin/member-activations/{id}/approve` requires explicit identity verification;
  `POST .../{id}/email` reissues and sends an eligible first-activation invitation.
  Context and invitation DTOs add `approvalRequired` and `accepted`.
  Management invitation DTOs also indicate `hasEmail` without exposing the address.
- Each application stores only the browser token hash, expiry, and consumption time.
  One browser token may own several applications; each association expires 72 hours
  after submission, even if the cookie is refreshed by another submission.
- `POST /api/onboarding/browser-applications/status` takes `applicationId` or `inviteId`.
  It returns `{ application, canActivate }` only with the associated valid cookie.
  Invite lookup also requires a currently active, unexpired group invite. Applicant
  history excludes internal decision notes and actor identifiers.
- `POST /api/onboarding/browser-applications/{applicationId}/supplements` accepts
  `{ note, rowVersion }`; it supplements only the caller's `needsInfo` application.
- `POST /api/onboarding/browser-applications/{applicationId}/activate` sets the existing
  onboarding cookie and returns activation context with the target member ID and name.
  It never returns the activation secret. Approval creates the source-bound first
  activation invitation; a revoked invitation cannot be recreated by its applicant.
- Approval accepts `identityVerified` separately from legacy `contactVerified`. The
  legacy combined verification assertion remains supported for older clients. New
  identity verification records the actor and time; historic contact verification
  is migrated without inventing an actor or timestamp.
- `POST /api/groups/{groupId}/members/{memberId}/passkey-recovery` accepts
  `{ identityVerified: true }` and returns `{ id, memberId, displayName, url, expiresUtc }`.
  `POST .../passkey-recovery/{invitationId}/revoke` revokes an active invitation.
  The raw URL exists only in the authorized issuance response, with the secret in
  its fragment. Lists and audit records never expose the secret. Reissuance revokes
  earlier active/pending invitations for the same member.
- The legacy admin recovery API is restricted to platform administrators and uses
  the same credential replacement transaction. Legacy recovery creation requires `identityVerified: true`; legacy recovery resend returns `recovery_reissue_requires_verification`, requiring a fresh verified issuance. The new member-list API supports
  recovery without a phone number. First-activation links remain a fallback.

Anonymous duplicate checks use browser + group and, when supplied, phone + group;
signed-in duplicates retain member + group checks. Empty phones never share a hash
or a deduplication key. Names never automatically link accounts. Leaders may explicitly
associate a verified existing member; phone ambiguity continues to fail closed.

All new endpoints and submission require the configured frontend Origin and are rate
limited. They return private/no-store responses. Browser credentials and QR secrets
are not placed in localStorage, persisted client query caches, shared edge responses,
or logs. Existing content caching and JWT session lifetimes are unchanged.

## User experience and verification

The waiting page shows the application reference and a check-results button, refreshing
on window focus without background polling. Chinese and English are supported without
language-only refetches. Changing browsers, clearing cookies, expiry, or lost continuation
requires reverified browser association or a leader-issued personal QR. A phone does not guarantee
one browser context: users should consistently use Safari on iPhone.

Exercise: no-phone submission; pending/needs-info/rejected/approved states; rescan;
cross-browser and cross-application isolation; wrong/expired cookies; recovery authorization
including cross-group elevated roles; reissue/revoke/expiry/replay; registration rollback;
new credential success and old credential rejection; unchanged existing sessions;
no-store and Origin rejection; mobile/desktop layouts and both languages. Real iPhone
Safari registration and Windows hybrid authentication require physical-device testing.

Implementation verification: 134 focused backend identity tests cover existing flows,
recovery approval and completion, cross-group rejection, browser transfer, pending
email-only invitations, administrator initialization/recovery, mocked Graph
acceptance/failure, provider selection, SMTP message/credential configuration and error
handling. A local SMTP protocol test verifies that lack of STARTTLS stops delivery before
credentials or message content are sent. Successful SMTP submission is mocked; a real
provider is still required to verify authentication, TLS negotiation and inbox delivery.
The browser preview uses isolated API fixtures and verifies the
Chinese/English recovery entry at 390px and the pending invitation at desktop width.
It does not establish real-device WebAuthn, SQL concurrency, or actual email delivery.
The explicit deployment command was exercised with invalid administrator configuration
and returned the expected failure without entering migration or seed execution.

## Migration and rollout

Apply `BrowserApplicationAndPasskeyRecovery` and then `AccountApplicationInvitations`
before deploying the backend and frontend.
It makes application phone fields nullable and adds browser receipt, identity verification,
and recovery/source binding fields. No existing credential is revoked by the migration.
The new additive migration records invitation review/acceptance, delivery email,
deployment issuance and browser continuation references. Its down migration refuses
to remove workflow data that older code could misinterpret. Retain the additive
schema for production rollback; never restore revoked credentials.
Production migration and deployment require separate authorization.

For rollback, remove the new UI entry points while keeping the compatible backend and
additive schema. Do not restore revoked credentials. A down migration refuses to run
while phoneless applications exist, rather than fabricating phone values; retain the
schema in production. Legacy clients may continue using their existing phone-based flow.
