# PEOPLE.REGISTRATION

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Manage invitation, registration, participant state, capacity, cancellation, attendance, and the privacy boundary between a participant and Event managers.

## Target contract

### Activation

Required when `people.registrationMode != none`; recommended for public visibility (`public-discovery`).

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

## Current implementation

Current core flow. `EventEnrollment` persistence, CRUD APIs, self-versus-manager visibility, lifecycle and RAM gates, bilingual enrollment JSON, and reachable `EventEnrollmentView` exist.

## Open contract gaps

Direct invitation, household/guest modelling, atomic capacity, waitlist promotion, tickets, general occurrence check-in, and attendance reconciliation remain open.

## Next useful vertical slice

`registration-capacity-waitlist`: implement a concurrency-safe capacity/waitlist state machine, manager and participant projections, notifications, and positive/negative role tests.
