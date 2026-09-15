# MOVE.STAY

> Normative module contract. Owns module-specific behavior, authority and compatibility. [Current delivery and gaps](../IMPLEMENTATION-STATUS.md#move-stay) are maintained centrally; [exact machine values](../event-contract.json) remain unchanged. Read only affected sections.

## Collaboration version 1 — preparation and execution

Uses the [shared report and handoff contract](../EVENT-WORKSPACES.md#tasks-and-reports): accepted module lead, versioned submission and owner adoption. Module-specific operations and privacy below still apply; a report neither certifies specialist facts nor grants participant-data access.

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

Preparation configuration follows the [formal-approval freeze and reopening contract](../EVENT-SETUP-FLOW.md). Approved preparation cannot be edited until reopening is authorised. Operational responses, consent and safety records retain their existing controls.

During saved preparation, the existing authorized tool is embedded directly in **Arrangements → Travel and accommodation → Travel and stay**. It shares its operational API and permissions with the independent workspace route; there is no separate Team and tools preparation step. See [integrated preparation](../EVENT-SETUP-FLOW.md).

## Operational behavior

transport slice. Driver/vehicle evidence, occurrence pickup journeys, ordered stops, history-preserving passenger assignment, capacity validation, exact coordinator authorisation, restricted/full and personal/minimum projections, ETags/idempotency, RAM/readiness integration, private APIs, and reachable `EventTravelWorkspace` exist.
