# PEOPLE.REGISTRATION

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Collaboration version 1

Preparation defines versioned purpose, audience, real-person capacity, terms/privacy, deadlines, channels, fixed material steps and optional manual fees. List handling uses an independent registration page. Actual participants, explicit proxy/guardian authority, consent evidence, materials, fees and seat/procedure state are distinct. Families enter FIFO together unless the organizer explicitly permits splitting. Internal lists precede approval; directed invitations require a fresh approved Package and reserve actual places until completion or expiry. Private material downloads reauthorize through the backend, including generic file entry points. Legacy IDs and child associations survive; unknown family and consent evidence are never invented. Exact states, API and migration boundaries are in [EVENT-WORKSPACES.md](../EVENT-WORKSPACES.md).

## Purpose

Manage invitation, registration, participant state, capacity, cancellation, attendance, and the privacy boundary between a participant and Event managers.

## Target contract

### Activation

Required when `people.registrationMode != none`; recommended for public visibility (`public-discovery`).

During saved, unfrozen draft preparation this tool remains a Yes/No choice, including when the rule above applies. Disabling retains facts, ownership and saved records. Formal submission revalidates activation and dependencies and blocks missing required tools; see [optional preparation tools](../EVENT-SETUP-FLOW.md#optional-tools-during-saved-preparation).

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

## Current implementation

Current core flow includes server-owned confirmed/waitlisted/cancelled states, capacity summary, self queue position and manager lists, FIFO eligible promotion, transactional in-app notifications, retained cancellation/answer history, and serializable Event-lock concurrency. Existing enrollment IDs, bilingual JSON and linked child evidence survive cancellation/rejoining. Reopening and approved capacity increases reconcile the queue; closed/expired/blocked enrollment retains waiters. New clients explicitly opt into waiting; old full-capacity clients receive an upgrade conflict. RAM gating follows current Plan/safety requirements. See [the first-round contract](../EVENT-CONTRACT.md#preparation-first-round-contract-extension--2026-09-13).

## Open contract gaps

Direct invitation, household/guest modelling, tickets, general occurrence check-in, and attendance reconciliation remain open. Enrollment remains one account per Event, not per occurrence.

## Next useful vertical slice

General occurrence check-in and attendance reconciliation, after validating the current account-based capacity flow in an authorized environment.
