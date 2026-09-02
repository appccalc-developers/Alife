# MOVE.STAY

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Coordinate safe transport and accommodation through qualified people/assets, occurrence journeys, restricted manifests, rooms, and overnight responsibility.

## Target contract

### Activation

Required when `move.transportRequired == true` (`transport-required`) or `move.accommodationRequired == true` (`accommodation-required`). Unknown travel/stay facts remain blockers rather than confirmed absence.

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

Event-scoped driver/vehicle evidence, occurrence journeys and pickup stops, passenger assignments, parking, accommodation, room allocation, check-in/out, overnight duty, and provider records.

### Roles and authority

At least one accepted `travel.coordinator` who is an Event team member. Coordinators and accountable Event authorities manage restricted manifests; passengers and drivers receive only their own journey projection.

### Data classification

`eventTeam`, `roleRestricted`, and `userSpecific`. Full manifests and personal journeys are private/no-store and never exposed to ordinary Event-team membership by default.

### Workflow contribution

`travel.plan`, `travel.verify-drivers`, `stay.allocate`, `travel.confirm-manifests`.

### Readiness

`transport-and-stay-facts-confirmed`, `drivers-and-vehicles-qualified`, and `manifests-and-night-roles-complete`, integrated with rather than duplicating RAM evidence.

### Event Package contribution

Contributes transport/accommodation requirement, occurrence journey coverage, driver/vehicle qualification summary, capacity/manifests completeness, overnight-duty state, source versions, and blockers. It never copies passenger identities, personal journeys, room occupants, contact data, or documents. Route, vehicle, driver, accommodation, and overnight-responsibility changes are classified for scoped re-approval and RAM impact.

### User experience

Coordinators manage bilingual stops, vehicle capacity, and restricted passengers with ETag/idempotency protection. Participants see only their own journey. Accommodation will use the same minimum-disclosure pattern.

## Current implementation

Current transport slice. Driver/vehicle evidence, occurrence pickup journeys, ordered stops, history-preserving passenger assignment, capacity validation, exact coordinator authorisation, restricted/full and personal/minimum projections, ETags/idempotency, RAM/readiness integration, private APIs, and reachable `EventTravelWorkspace` exist.

## Open contract gaps

Parking, accommodation, room allocation, accommodation check-in/out, overnight duty, and hotel/provider integration remain open.

## Next useful vertical slice

`accommodation-room-allocation`: provider record, room capacity/allocation, check-in/out, and overnight duty without external provider integration.
