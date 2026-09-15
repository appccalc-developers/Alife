# PEOPLE.REGISTRATION

> Normative module contract. Owns module-specific behavior, authority and compatibility. [Current delivery and gaps](../IMPLEMENTATION-STATUS.md#people-registration) are maintained centrally; [exact machine values](../event-contract.json) remain unchanged. Read only affected sections.

## Collaboration version 1

Preparation defines versioned purpose, audience, real-person capacity, terms/privacy, deadlines, channels, fixed material steps and optional manual fees. List handling uses an independent registration page. Actual participants, explicit proxy/guardian authority, consent evidence, materials, fees and seat/procedure state are distinct. Families enter FIFO together unless the organizer explicitly permits splitting. Internal lists precede approval; directed invitations require a fresh approved Package and reserve actual places until completion or expiry. Private material downloads reauthorize through the backend, including generic file entry points. Legacy IDs and child associations survive; unknown family and consent evidence are never invented. Exact states, API and migration boundaries are in [EVENT-WORKSPACES.md](../EVENT-WORKSPACES.md).

## Purpose

Manage invitation, registration, participant state, capacity, cancellation, attendance, and the privacy boundary between a participant and Event managers.

## Target contract

### Activation

Required when `people.registrationMode != none`; recommended for public visibility (`public-discovery`).

Saved-draft choices, preservation and submission revalidation follow [optional preparation tools](../EVENT-SETUP-FLOW.md#optional-tools-during-saved-preparation).

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

Direct invitations, public registration, household/guest relationships, capacity, waitlist, cancellation, tickets, occurrence attendance, and reconciliation.

### Roles and authority

At least one `registration.manager` who is an Event team member. Participants manage only their own allowed fields; manager lists and state transitions require server-side Event authority.

### Data classification

`churchOrGroupVisible`, `roleRestricted`, and `userSpecific`. Participant identity and responses never enter shared cache.

### Workflow contribution

`registration.configure`, `registration.open`, `registration.close`, `attendance.reconcile`.

### Readiness

`registration-window-valid`, `capacity-defined`, and `privacy-notice-confirmed`.

### Event Package contribution

Contributes registration mode, scope, opening/deadline state, capacity/waitlist summary, privacy notice/consent version, cancellation/refund terms, and blockers. It never contributes participant identities or answers. Open/close and every enrolment mutation use the Event lifecycle gate; an old public URL or QR cannot accept an enrolment while the gate is closed.

### User experience

Participants see their own registration state and safe actions. Managers receive an authorised list and explicit capacity/waitlist controls. The bilingual wire shape remains `{ en, zh }`.

During saved preparation, the existing authorized tool is embedded directly in **Arrangements → People and volunteers → Invitations and registration**. It shares its operational API and permissions with the independent workspace route; there is no separate Team and tools preparation step. See [integrated preparation](../EVENT-SETUP-FLOW.md).

## AI form assistance

Preparation rules use the shared [AI form assistant](../AI-DETAILS-ASSISTANT.md#tasks-and-registration-form-assistants) for rule text/settings, material requirement definitions and fee instructions. Eligible group selection remains manual. All bilingual rule/material/fee fields show the current language first with an expandable translation and Added/Missing marker. AI changes only the local draft; Save registration plan remains explicit. Participant lists, invitations, uploaded materials, consent, payment verification and approvals remain in their existing authorized workflows and outside assistant context.

## Operational behavior

core flow includes server-owned confirmed/waitlisted/cancelled states, capacity summary, self queue position and manager lists, FIFO eligible promotion, transactional in-app notifications, retained cancellation/answer history, and serializable Event-lock concurrency. Existing enrollment IDs, bilingual JSON and linked child evidence survive cancellation/rejoining. Reopening and approved capacity increases reconcile the queue; closed/expired/blocked enrollment retains waiters. New clients explicitly opt into waiting; old full-capacity clients receive an upgrade conflict. RAM gating follows current Plan/safety requirements. See [the first-round contract](#version-0-seat-and-waitlist-compatibility).





## Version 0 seat and waitlist compatibility

The following account-seat contract applies to the first-round / collaboration-version-0 flow. Version 1 actual-person and household rules are specified below; do not apply the old one-account seat rule to that flow.

one account occupies one Event seat. Server-owned states are `confirmed`, `waitlisted`, `cancelled`. A serializable transaction locks the Event before membership/lifecycle checks, queue reads, seat allocation, cancellation, promotion and notification writes. Eligible waiters have FIFO priority over newcomers; cancellation/rejoining retains the enrollment ID and related evidence but obtains a new queue time. Cancellation preserves prior JSON in history. Closed/expired/ineligible/approval-blocked registration never promotes; reopening and approved capacity increases reconcile under the same lock. Capacity cannot shrink below confirmed count, and pre-existing excess is displayed without removing people. Legacy rows become confirmed with no fabricated queue/decision timestamps or notifications. Only clients explicitly opting into `X-Enrollment-Waitlist: 1` may join a full queue; old clients receive `event.enrollment.waitlistUpgradeRequired`. RAM requirements come from current Plan/safety rules, including v2 validity, rather than an unconditional approval check.


## Registration rules and actual participants

The owner configures versioned rules in preparation; list handling moves to `/events/:eventId/registration-work`. Rules contain purpose, responsible role, audience (`invited`, `group`, `church`, `public`), eligibility text and optional manual check, actual-person capacity, opening/deadline, waitlist, terms/privacy/cancellation, App/manual channels, fixed text/file requirements, optional fee and refund terms. Public eligibility is still bounded by the Event's published visibility. Capacity and deadline on upgraded Events are managed through these rules, not legacy Event writes.

Procedure status, seat status and payment totals are separate. Creating or submitting a form is not final confirmation. Completion verifies applicable consent, required answers/material verification, eligibility check and current fee payment. Fees are minor-unit integers with an explicit currency; the UI displays currency units. Material types are JPG, PNG, PDF and TXT, with per-requirement count/size limits and server MIME/content validation.

Applications distinguish the organizer from actual participants. Seats, consent, materials, fees and status belong to each person. The default is all-or-nothing family placement in FIFO order; the organizer must explicitly opt into splitting. A whole family waiting for enough places cannot silently be bypassed by a smaller group. Explicitly named adults/guardians and proxy authority are recorded without surname/contact inference. An adult organizer's data entry is not another adult's consent. Account holders confirm themselves; named guardians confirm children. For offline guests, the registration manager records the actual organizer, verified consent method/time/evidence and verifying actor. Revoking proxy authority denies subsequent application/material reads and writes through that proxy, including old links; revocation remains possible after expiry or rule changes.

Before formal approval the manager may prepare internal invitation lists only. Sending requires a fresh approved Package. Before publication, invitees may complete procedures using a restricted invitation view. Invitations distinguish `now` and `byDeadline`, always with a deadline; both reserve actual-person places. Reserves count toward capacity and cannot jump existing waiters. Rejection, cancellation or expiry releases places. A minute-triggered server expiry job rechecks within the same Event capacity transaction, records changes once and promotes the FIFO queue. Application ETags, idempotency and an Event row lock protect repeated requests and the last place. Registration remains Event-wide; attendance and rosters remain occurrence-specific.

Rules changing after applications exist require replacement/reconfirmation, not fabricated consent. Legacy enrollment IDs and child links remain. Upgrade creates only the one participant identifiable from each old enrollment record, retains unknown family JSON unchanged, and never synthesizes consent, payment or additional family members. Once versioned rules exist, legacy mutation paths cannot overwrite participant/capacity state.


## Private registration materials

Purpose `EventRegistrationMaterial` uses the existing private storage infrastructure with purpose-specific authorization. Upload checks current participant/proxy/registration responsibility and validates size and content. Generic file registration cannot create this purpose or private prefix, and generic file lists cannot enumerate it. Opening a material returns an authenticated backend download endpoint, not a reusable storage capability. The backend checks current access again when streaming. Storage accepts only authenticated backend requests; even a generic signed private URL cannot bypass this boundary. Removal soft-deletes the file and invalidates material verification. Participant/proxy/role revocation applies equally to dedicated and generic file entry points.
