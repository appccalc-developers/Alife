# Browser application continuation and personal Passkey recovery

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

- `POST /api/onboarding/group-applications` accepts an omitted/null/blank `phoneE164`;
  supplied nonblank numbers must validate. The existing response is retained and the
  response sets `alife_application`, an HttpOnly, SameSite=Lax cookie (Secure on HTTPS),
  with a 72-hour lifetime. This is separate from the 30-minute onboarding cookie.
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
requires the original browser or a leader-issued personal QR. A phone does not guarantee
one browser context: users should consistently use Safari on iPhone.

Exercise: no-phone submission; pending/needs-info/rejected/approved states; rescan;
cross-browser and cross-application isolation; wrong/expired cookies; recovery authorization
including cross-group elevated roles; reissue/revoke/expiry/replay; registration rollback;
new credential success and old credential rejection; unchanged existing sessions;
no-store and Origin rejection; mobile/desktop layouts and both languages. Real iPhone
Safari registration and Windows hybrid authentication require physical-device testing.

## Migration and rollout

Apply `BrowserApplicationAndPasskeyRecovery` before deploying the backend and frontend.
It makes application phone fields nullable and adds browser receipt, identity verification,
and recovery/source binding fields. No existing credential is revoked by the migration.
Production migration and deployment require separate authorization.

For rollback, remove the new UI entry points while keeping the compatible backend and
additive schema. Do not restore revoked credentials. A down migration refuses to run
while phoneless applications exist, rather than fabricating phone values; retain the
schema in production. Legacy clients may continue using their existing phone-based flow.
