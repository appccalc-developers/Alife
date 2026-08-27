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

### User experience

Coordinators select active group venues, see capacity and actual UTC conflicts, reserve or release without deleting history, and recover from stale ETags. Touching half-open boundaries do not conflict.

## Current implementation

Current venue slice. Reusable venue catalogue/capacity, Event and occurrence reservations, history-preserving release, half-open overlap detection, ETags, idempotency, exact coordinator authorisation, readiness, private APIs, reachable `EventVenueWorkspaceSurface`, and legacy `Session.PlaceJson` compatibility exist.

## Open contract gaps

Equipment catalogue/allocation, setup, close-down, handover, return, and optional typed Session → Venue linking remain open.

## Next useful vertical slice

`resource-equipment-allocation`: equipment catalogue, quantity allocation, availability conflict, and existing-workflow contribution; setup/handover/return remain deferred.
