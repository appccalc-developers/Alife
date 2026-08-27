# COMMS.FOLLOWUP

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Deliver reviewed bilingual Event communications and purpose-limited follow-up with explicit audiences, delivery evidence, withdrawal, and retention.

## Target contract

### Activation

Required when `comms.followupRequired == true`; recommended whenever an Event exists (`event-communications`).

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

Notices, public Event copy, audience snapshots, change broadcasts, newcomer/prayer/feedback follow-up, incident follow-up references, delivery state, withdrawal, and retention review.

### Roles and authority

At least one `comms.owner` who is an Event team member. Public copy requires the applicable human approval; protected follow-up audiences and purposes are enforced on the server.

### Data classification

`public`, `churchOrGroupVisible`, `roleRestricted`, and `userSpecific`. Only an approved sanitised public allow-list is shared-cacheable; every protected communication projection is private/no-store.

### Workflow contribution

`comms.notice`, `comms.change-broadcast`, `comms.follow-up`, `comms.retention-review`.

### Readiness

`audience-and-channels-confirmed`, `public-copy-approved-when-applicable`, and `retention-purpose-defined`.

### User experience

Owners review bilingual content and an immutable audience snapshot before send. Delivery result, retry, withdrawal, and retention state are visible without auto-publishing AI drafts.

## Current implementation

Partial. Bilingual Event content, public/group projections, in-app notification foundations, Event Review CRUD, Workflow/Artifact support, and a generic controlled surface exist. They do not form a complete Event communications workspace or audited broadcast lifecycle.

## Open contract gaps

Audience snapshot, approved publish/change broadcast, delivery state, newcomer/prayer purpose controls, incident follow-up, retention, and dedicated module UI/API remain open.

## Next useful vertical slice

`audited-event-change-broadcast`: explicit human confirmation, in-app delivery, audience snapshot, message version, delivery result, non-destructive retry, and withdrawal audit.
