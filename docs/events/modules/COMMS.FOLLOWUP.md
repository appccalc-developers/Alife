# COMMS.FOLLOWUP

> Normative module contract. Owns module-specific behavior, authority and compatibility. [Current delivery and gaps](../IMPLEMENTATION-STATUS.md#comms-followup) are maintained centrally; [exact machine values](../event-contract.json) remain unchanged. Read only affected sections.

## Collaboration version 1 — preparation and execution

Uses the [shared report and handoff contract](../EVENT-WORKSPACES.md#tasks-and-reports): accepted module lead, versioned submission and owner adoption. Module-specific operations and privacy below still apply; a report neither certifies specialist facts nor grants participant-data access.

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

## Operational behavior

Partial. Bilingual Event content, public/group projections, poster preparation/publication, in-app notification foundations and Event Review CRUD exist. They do not form a complete Event communications workspace or audited broadcast lifecycle. The retired generic workflow surface is not a current communications capability.

The [continuous preparation flow](../EVENT-SETUP-FLOW.md) provides a separate post-creation poster studio after formal approval. It reuses the existing AI/image services, requires human preview/adoption, and saves only the poster association through an authorized, no-store, ETag/idempotency-protected API. Poster drafts remain local until adopted. Explicit publication after active approval uses existing audience-filtered projections. Poster artwork is outside formal approval by product contract; adoption preserves Package validity. Audited broadcasts remain incomplete.





## Availability presentation — 2026-09-13

Current catalogue status is `partial` (**部分提供 / Partly available**) at all preparation and direct entries. The UI names existing Event content, poster and publication tools and links to the post-approval poster/publish stages. It explicitly identifies missing broadcast/audience/delivery/follow-up workflows and provides no fictional broadcast action. Enabled/details-confirmed/readiness states remain separate.
