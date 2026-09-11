# PLACE.RESOURCE

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Coordinate venue capacity, bookings, equipment, setup, handover, return, and conflicts while keeping legacy Session place data compatible.

## Target contract

### Activation

Required when `place.resourcesRequired == true` (`managed-place-or-resource`).

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

Reusable venues, rooms, authoritative capacity, Event/Occurrence reservations, conflict detection, equipment quantities, setup, close-down, handover, and return history.

### Roles and authority

At least one `resource.coordinator` who is an Event team member. Catalogue authority is scoped to the managing group; reservation authority is scoped to the Event and enforced on the server.

### Data classification

`eventTeam` and `approvalEvidence`; catalogue/reservation management is private/no-store.

### Workflow contribution

`resource.reserve`, `resource.prepare`, `resource.handover`, `resource.close`.

### Readiness

`capacity-sufficient`, `bookings-confirmed`, and `conflicts-resolved`.

### Event Package contribution

Contributes venue/reservation identity and version, occurrence coverage, capacity comparison, booking status, conflict result, setup/resource readiness, and blockers. It does not copy unrelated catalogue or booking data. Event-wide venue, time, or capacity changes invalidate all affected coverage. An occurrence-bound reservation change uses the occurrence source vector, creates a local review/task, invalidates the prior occurrence Package, and preserves unrelated series occurrences until the scoped Package is approved.

### User experience

Coordinators select active group venues, see capacity and actual UTC conflicts, reserve or release without deleting history, and recover from stale ETags. Touching half-open boundaries do not conflict.

During [event creation](../CREATION-ARRANGEMENTS.md), the Arrangements page supports inline Yes/No activation and collapsible editing of existing or new group venues, capacity and booking times. Required activation stays locked. Final confirmation validates venue authority, capacity, half-open conflicts and concurrency, then saves venues/reservations atomically with the Event.

Preparation configuration follows the [formal-approval freeze and reopening contract](../EVENT-SETUP-FLOW.md). Approved preparation cannot be edited until reopening is authorised. Operational responses, consent and safety records retain their existing controls.

## Current implementation

Current venue slice. Reusable venue catalogue/capacity, Event and occurrence reservations, history-preserving release, half-open overlap detection, ETags, idempotency, exact coordinator authorisation, readiness, occurrence-local Package invalidation/review, private APIs, reachable `EventVenueWorkspaceSurface`, and legacy `Session.PlaceJson` compatibility exist.

## Open contract gaps

Equipment catalogue/allocation, setup, close-down, handover, return, and optional typed Session → Venue linking remain open.

## Next useful vertical slice

`resource-equipment-allocation`: equipment catalogue, quantity allocation, availability conflict, and existing-workflow contribution; setup/handover/return remain deferred.

### Shared preparation editor

Saved creation-form edits retain booking IDs, release removed bookings and revalidate venue ETags, capacity and overlapping reservations within Plan acceptance. The occurrence-scoped read and atomic Plan/arrangement save are specified in [EVENT-SETUP-FLOW.md](../EVENT-SETUP-FLOW.md).
