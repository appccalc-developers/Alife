# PEOPLE.REGISTRATION

> Normative module contract. Owns module-specific behavior, authority and compatibility. [Current delivery and gaps](../IMPLEMENTATION-STATUS.md#people-registration) are maintained centrally; [exact machine values](../event-contract.json) remain unchanged. Read only affected sections.

## Current Event 2.0 contract

Preparation defines versioned purpose, audience, real-person capacity, terms/privacy, deadlines, channels, fixed material steps and optional manual fees. List handling uses an independent registration page. Actual participants, explicit proxy/guardian authority, consent evidence, materials, fees and seat/procedure state are distinct. Families enter FIFO together unless the organizer explicitly permits splitting. Internal lists precede approval; directed invitations require a fresh approved Package and reserve actual places until completion or expiry. Private material downloads reauthorize through the backend, including generic file entry points. Application and participant identities plus explicit child associations remain auditable throughout the Event; unknown family and consent evidence are never invented. Exact states, API and persistence boundaries are in [EVENT-WORKSPACES.md](../EVENT-WORKSPACES.md).

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

Contributes registration mode, scope, opening/deadline state, capacity/waitlist summary, privacy notice/consent version, cancellation/refund terms, and blockers. It never contributes participant identities or answers. Open/close and every registration mutation use the Event lifecycle gate; a stale public URL or QR cannot accept an application while the gate is closed.

### User experience

Participants see their own registration state and safe actions. Managers receive an authorised list and explicit capacity/waitlist controls. The bilingual wire shape remains `{ en, zh }`.

During saved preparation, the existing authorized tool is embedded directly in **Arrangements → People and volunteers → Invitations and registration**. It shares its operational API and permissions with the independent workspace route; there is no separate Team and tools preparation step. See [integrated preparation](../EVENT-SETUP-FLOW.md).

## AI form assistance

Preparation rules use the shared [AI form assistant](../AI-DETAILS-ASSISTANT.md#tasks-and-registration-form-assistants) for rule text/settings, material requirement definitions and fee instructions. Eligible group selection remains manual. All bilingual rule/material/fee fields show the current language first with an expandable translation and Added/Missing marker. AI changes only the local draft; Save registration plan remains explicit. Participant lists, invitations, uploaded materials, consent, payment verification and approvals remain in their existing authorized workflows and outside assistant context.

## Operational behavior

The current flow includes server-owned confirmed/waitlisted/cancelled application and participant states, capacity summary, self queue position and manager lists, FIFO eligible promotion, transactional in-app notifications, retained cancellation/answer history, and serializable Event-lock concurrency. Application and participant IDs, bilingual JSON and linked child evidence survive cancellation/rejoining. Reopening and approved capacity increases reconcile the queue; closed, expired or blocked registration retains waiters. A participant must explicitly choose to enter a full-capacity waitlist. RAM gating follows current Plan and safety requirements. See [capacity and queue concurrency](#capacity-and-queue-concurrency).





<a id="version-0-seat-and-waitlist-compatibility"></a>

## Capacity and queue concurrency

Each actual participant occupies one Event seat. Server-owned application and participant states control confirmed, waitlisted and cancelled participation. A serializable transaction locks the Event before eligibility/lifecycle checks, queue reads, seat allocation, cancellation, promotion and notification writes. Eligible waiters have FIFO priority over newcomers. Closed, expired, ineligible or approval-blocked registration never promotes; reopening and approved capacity increases reconcile under the same lock. Capacity cannot shrink below confirmed participant count. RAM requirements come from the current Plan and safety rules, including RAM schema-2 validity, rather than an unconditional approval check.


## Registration rules and actual participants

The owner configures versioned rules in preparation; list handling uses `/events/:eventId/registration-work`. Rules contain purpose, responsible role, audience (`invited`, `group`, `church`, `public`), eligibility text and optional manual check, actual-person capacity, opening/deadline, waitlist, terms/privacy/cancellation, App/manual channels, fixed text/file requirements, optional fee and refund terms. Public eligibility is still bounded by the Event's published visibility. Capacity and deadline are versioned with these rules.

Procedure status, seat status and payment totals are separate. Creating or submitting a form is not final confirmation. Completion verifies applicable consent, required answers/material verification, eligibility check and current fee payment. Fees are minor-unit integers with an explicit currency; the UI displays currency units. Material types are JPG, PNG, PDF and TXT, with per-requirement count/size limits and server MIME/content validation.

Applications distinguish the organizer from actual participants. Seats, consent, materials, fees and status belong to each person. The default is all-or-nothing family placement in FIFO order; the organizer must explicitly opt into splitting. A whole family waiting for enough places cannot silently be bypassed by a smaller group. Explicitly named adults/guardians and proxy authority are recorded without surname/contact inference. An adult organizer's data entry is not another adult's consent. Account holders confirm themselves; named guardians confirm children. For offline guests, the registration manager records the actual organizer, verified consent method/time/evidence and verifying actor. Revoking proxy authority denies subsequent application/material reads and writes through that proxy, including old links; revocation remains possible after expiry or rule changes.

Before formal approval the manager may prepare internal invitation lists only. Sending requires a fresh approved Package. Before publication, invitees may complete procedures using a restricted invitation view. Invitations distinguish `now` and `byDeadline`, always with a deadline; both reserve actual-person places. Reserves count toward capacity and cannot jump existing waiters. Rejection, cancellation or expiry releases places. A minute-triggered server expiry job rechecks within the same Event capacity transaction, records changes once and promotes the FIFO queue. Application ETags, idempotency and an Event row lock protect repeated requests and the last place. Registration remains Event-wide; attendance and rosters remain occurrence-specific.

Rules changing after applications exist require replacement or reconfirmation, never fabricated consent. Participant, guardian, consent and payment identities remain explicit, and current mutation paths cannot overwrite another participant's capacity or evidence state.


## Project selection and eligibility

An Event may have multiple activity projects, each with independent offers tied to an existing Event occurrence and a stable activity-plan ID. The Event's registration choice and participant record come first. In questionnaire version 2, the selection, age, capacity, fee, minors, space, roster and programme switches are independent. Saving a project policy or draft occurrence offer does not require `projectSelection=yes`, and any of these arrangements may be prepared while Event registration is `none`. Only opening project selection requires confirmed `projectSelection=yes`, explicitly enabled Event registration and the current approval gate; selection preview/apply also require a confirmed Event participant seat. An Event may have no overall seat limit; each project offer can independently limit places and manage a FIFO waitlist under the Event lock. One project's `no` answer cannot cancel another's registration need.

Each current project policy version records bilingual eligibility/terms, inclusive minimum/maximum ages, capacity (`0` means unlimited), waitlist choice, guardian-consent requirement, minor-unit fee/currency and collection window. One offer binds that policy to one Event occurrence and a contained UTC interval. Policy and offer edits preserve earlier versions, return the offer to draft and require current participants to reconfirm without erasing their quoted fee. A participant previews adds/removals before applying a selection; the preview token binds their actual Event participant, current policies, prices, occupancy and source version. Submission rechecks it under the Event lock with an idempotency key. Selection and procedure completion are separate; a confirmed Event seat and current open Event/project gate are required before a project place is completed. Cancelling a selected project preserves participation/payment history and may require notice/refund review.

Preview and apply also require the actual participant's Event seat to be confirmed; an invitation, waitlist or draft application cannot select a project. For a child, the specific project's `minorsParticipate` answer must be confirmed `yes`, SAFEGUARDING.CHILD must be enabled, and that participant's active child profile, confirmed guardian relationship and current published child-policy consent must exist. These checks repeat on project completion and queue reconciliation. All active project fee policies and existing quoted charges must use the Event registration fee currency; opening an offer or previewing/applying a selection fails on a mismatch rather than silently converting money.

Current policy, offer and participant-selection changes create limited bilingual in-app project notices through the existing notification system. They do not contain birthday, health, consent evidence or fee amount, and they are not an external delivery channel. An activity with any participation history cannot be deleted or rebound to a different occurrence by simply editing the Activity Plan; cancelling its offers/selections and handling any refund remains an explicit workflow.
Current policy, offer and participant-selection changes create limited bilingual in-app project notices through the existing notification system. They do not contain birthday, health, consent evidence or fee amount, and they are not an external delivery channel. A project with any participation history, including cancelled selections, must remain in the Activity Plan. Its stable string ID connects offers, fee and consent records to the bilingual project name and conditions. The organiser cancels the old offer, notifies affected people and resolves payment/refund obligations; a different occurrence or materially different arrangement uses a new project ID. Direct deletion or occurrence rebinding is rejected.

The Event's eligibility is an upper bound. A project may narrow age, fitness self-declaration or manual review, never admit somebody the Event excludes. Age is measured on the project occurrence's local date in the Event time zone, including the birthday boundary; a February 29 birthday maps to February 28 in a non-leap year. Birth date is provided only by the participant or an authorised guardian and returned only as a server-side eligibility result to ordinary organisers. Existing participants cannot be removed merely by deleting the project; cancellation, notices and refund handling must preserve the record. Changed project rules require reconfirmation instead of inventing consent or retroactively repricing a confirmed participant.

Private project policies, selection previews/submissions, participation state and sensitive eligibility operations use authenticated `private, no-store` routes. The public Event representation contains no birth date, health detail, guardian evidence or payment proof.

## Private registration materials

Purpose `EventRegistrationMaterial` uses the existing private storage infrastructure with purpose-specific authorization. Upload checks current participant/proxy/registration responsibility and validates size and content. Generic file registration cannot create this purpose or private prefix, and generic file lists cannot enumerate it. Opening a material returns an authenticated backend download endpoint, not a reusable storage capability. The backend checks current access again when streaming. Storage accepts only authenticated backend requests; even a generic signed private URL cannot bypass this boundary. Removal soft-deletes the file and invalidates material verification. Participant/proxy/role revocation applies equally to dedicated and generic file entry points.
