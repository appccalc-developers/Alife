# Browser application continuation and personal Passkey recovery

## Product contract

The public ALIFE entry offers membership application separately from existing-member
Passkey sign-in. Selecting “Enter my ALIFE” opens a choice/confirmation screen; only
an explicit Passkey action invokes the system authenticator. Failure or cancellation
does not imply that someone is a new applicant: sign-in, application and recovery
remain distinct choices.

“Would you like to join ALIFE?” shows a public QR/address on desktop. The applicant
opens it on their personal phone. Before showing a form, the original browser resumes
an existing application receipt. Without a receipt, a live session check directs an
authenticated member to their existing account; a failed check offers retry, not a
new form. Other visitors see explicit Passkey sign-in, assistance for prior applicants,
and a first-application confirmation. Cancellation or authentication failure never
automatically opens the form. WebAuthn does not expose a silent credential-presence
check: this reduces duplicate submissions but cannot enforce one application per
physical phone across browsers, expired receipts, or cleared cookies. First-time
applicants explicitly continue, then fill in name, sex (including “prefer not to say”),
required email, optional phone, and message. Email or SMS is selected for follow-up;
SMS requires a valid phone. Two unchecked confirmations are required: use of details
to process the application, and SMS/email delivery of results and registration
instructions. Both consent records use `church-application-v1`; no religious or
membership-rule declaration is inferred. Submission alone creates no Member,
membership, credentials, or authenticated session.

Public applications target only the configured open church group and enter Member
Management's expanded “Membership applications · Pending approval” table. Reviewers
can filter, sort, paginate and expand rows to inspect submitted details. Existing
church-management authorization, in-person identity verification, explicit account
association and optimistic concurrency still govern decisions. Approval creates the
ordinary church identity and a source-bound first-activation invitation, unless the
linked account already exists/is registered or elevated. Newly created members retain
the submitted sex/email; existing linked profiles are never overwritten.

Notifications are **manual**, not automatically sent: approval returns a one-time
message plus the authorized recipient phone/email and channel for the reviewer to
copy and send. Authorized regeneration supports email-only applicants and preserves
the source application while revoking the previous link. It does not claim delivery. Requests for information and rejections
also require manual follow-up. On the original phone browser the applicant may
refresh progress and, after approval, create a Passkey there. Rescanning the public
QR on that same browser resumes its latest public church application. The QR carries
no personal information or identity capability. Browser receipts still expire after
72 hours; changing browsers or expiry requires administrator assistance or the
separately delivered activation link.

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

The member list offers a personal recovery QR. Leaders and co-leaders may recover
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

## Interfaces and storage

- `POST /api/onboarding/church-applications` reuses the application request with
  additional `sex`, `email`, and `notificationConsent`. It requires a live sign-in
  onboarding flow, the exact current privacy-consent version, trusted Origin,
  honeypot/timing checks and existing application rate limits. The backend selects
  the church; clients cannot select a target group or bypass a group QR.
- `ChurchPersonApplication` adds nullable sex/email and notification-consent version
  and time. `GroupMembershipApplication.GroupJoinInviteId` becomes nullable only to
  represent the new `publicChurchApplication` source; existing QR submissions still
  require an active invitation. DTO additions are optional for existing clients.
- Browser status requests without application/invite IDs resume only the receipt
  owner's public church application. Full submitted email is available only to the
  receipt owner or authorized application reviewers; responses remain private/no-store.
  Raw activation links are never returned by list/status APIs or persisted in client
  caches. No contact information is used as proof of account ownership.

- `POST /api/onboarding/group-applications` accepts an omitted/null/blank `phoneE164`;
  supplied nonblank numbers must validate. The existing response is retained and the
  response sets `alife_application`, an HttpOnly, SameSite=Lax cookie (Secure on HTTPS),
  with a 72-hour lifetime. This is separate from the 30-minute onboarding cookie.
- Each application stores only the browser token hash, expiry, and consumption time.
  One browser token may own several applications; each association expires 72 hours
  after submission, even if the cookie is refreshed by another submission.
- `POST /api/onboarding/browser-applications/status` takes `applicationId` or `inviteId`.
  Omitting both resumes the receipt owner's latest public church application only.
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

Passkey registration is offered only on personal mobile devices. The shared browser
registration function rejects desktop devices before fetching options or calling
WebAuthn; Windows remains classified as desktop even with touch or a mobile hint.
Both registration API endpoints also reject requests identifying Windows through
User-Agent or Sec-CH-UA-Platform with `passkey_phone_required` and private/no-store.
These platform signals guide supported usage; they are not cryptographic proof of
where a credential is stored. Authentication and registration authorization remain
unchanged. Desktop authentication retains the hybrid phone hint, which browsers
may ignore; ALIFE cannot control the password manager's complete picker or sync.

New credentials use the member's trimmed display name for both WebAuthn `user.name`
and `user.displayName`, with `ALIFE member` as the blank-name fallback. The random
`user.id` remains unchanged and is the identity key, so equal display names do not
merge accounts. The optional credential nickname in ALIFE is separate. Existing
credentials are not automatically renamed, recreated, deleted, or revoked.
Obsolete laptop credentials are cleaned up manually in the owning password manager;
Google Password Manager entries may be synced with the phone, so only confirmed
obsolete ALIFE credentials should be removed.

The waiting page shows the application reference and a check-results button, refreshing
on window focus without background polling. Chinese and English are supported without
language-only refetches. Changing browsers, clearing cookies, expiry, or lost continuation
requires the original browser or a leader-issued personal QR. A phone does not guarantee
one browser context: users should consistently use Safari on iPhone.

Exercise: no-phone submission; pending/needs-info/rejected/approved states; rescan;
cross-browser and cross-application isolation; wrong/expired cookies; recovery authorization
including cross-group elevated roles; reissue/revoke/expiry/replay; registration rollback;
new credential success and old credential rejection; unchanged existing sessions;
no-store and Origin rejection; mobile/desktop layouts and both languages. Real iPhone
Safari registration and Windows hybrid authentication require physical-device testing.

## Migration and rollout

Apply `PublicChurchApplications` before deploying this public application UI/backend.
It is additive except for relaxing the invitation FK's nullability. Existing records
receive null new fields, not invented consent. Its down migration refuses to run while
public applications or new-field data exist; retain the additive schema for rollback.
Generation and SQL review do not apply the migration to a shared database.

Apply `BrowserApplicationAndPasskeyRecovery` before deploying the backend and frontend.
It makes application phone fields nullable and adds browser receipt, identity verification,
and recovery/source binding fields. No existing credential is revoked by the migration.
Production migration and deployment require separate authorization.

For rollback, remove the new UI entry points while keeping the compatible backend and
additive schema. Do not restore revoked credentials. A down migration refuses to run
while phoneless applications exist, rather than fabricating phone values; retain the
schema in production. Legacy clients may continue using their existing phone-based flow.
