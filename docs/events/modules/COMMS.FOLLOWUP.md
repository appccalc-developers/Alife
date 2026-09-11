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

### Event Package contribution

Contributes public-copy draft versions, audience category and count, channel plan, privacy/retention purpose, human approval state, and blockers. Poster artwork is created after formal approval and is excluded from the Package. It never copies recipient identities into the Package. Approval can unlock publication eligibility but never sends content; invalidation creates a human-reviewed change/cancellation draft and delivery work without automatically notifying anyone.

### User experience

Owners review bilingual content and an immutable audience snapshot before send. Delivery result, retry, withdrawal, and retention state are visible without auto-publishing AI drafts.

## Current implementation

Partial. Bilingual Event content, public/group projections, in-app notification foundations, Event Review CRUD, Workflow/Artifact support, and a generic controlled surface exist. They do not form a complete Event communications workspace or audited broadcast lifecycle.

The [continuous preparation flow](../EVENT-SETUP-FLOW.md) provides a separate post-creation poster studio after formal approval. It reuses the existing AI/image services, requires human preview/adoption, and saves only the poster association through an authorized, no-store, ETag/idempotency-protected API. Poster drafts remain local until adopted. Explicit publication after active approval uses existing audience-filtered projections. Poster artwork is outside formal approval by product contract; adoption preserves Package validity. Audited broadcasts remain incomplete.

## Open contract gaps

Audience snapshot, approved publish/change broadcast, delivery state, newcomer/prayer purpose controls, incident follow-up, retention, and dedicated module UI/API remain open.

## Next useful vertical slice

`audited-event-change-broadcast`: explicit human confirmation, in-app delivery, audience snapshot, message version, delivery result, non-destructive retry, and withdrawal audit.
