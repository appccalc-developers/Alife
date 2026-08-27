# FESTIVAL.OPERATIONS

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Coordinate multi-zone live operations, command, crowd flow, first aid, weather, evacuation, and escalation for festivals and large celebrations.

## Target contract

### Activation

Required when `scale.multiZone == true` (`multi-zone-live-operation`).

### Dependencies

`TEAM.WORK`, `SAFETY.RAM`, `PROGRAM.PRODUCTION`, and `PLACE.RESOURCE`.

### Domain responsibilities

Zones and stalls, operational state, zone leads, crowd flow, first aid, lost-child escalation, parking coordination, command log, weather decisions, evacuation, and live incident escalation.

### Roles and authority

Exactly one `operations.commander` with controlled `eventCommandApproved` eligibility. Zone leads receive scoped control; safeguarding and RAM authorities retain their own protected records and approvals.

### Data classification

`eventTeam`, `roleRestricted`, and `approvalEvidence`; live operational and incident responses are private/no-store unless separately projected through an approved public allow-list.

### Workflow contribution

`festival.zone-plan`, `festival.command-plan`, `festival.live-status`, `festival.incident-escalation`.

### Readiness

`zone-leads-assigned`, `command-and-escalation-confirmed`, and `evacuation-and-first-aid-confirmed`.

### User experience

The command workspace shows zone state, accountable owners, unresolved incidents, weather/evacuation decisions, and readiness. It does not expose child or medical detail outside the authorised specialist flow.

## Current implementation

Target only. Zone and ServiceSlot persistence foundations, multi-zone composition, dependency/role/readiness definitions, and a generic controlled surface exist. A live festival operations API and reachable business flow do not.

## Open contract gaps

Zone/stall operational state, crowd flow, first aid, lost-child handling, command log, weather/evacuation, incident escalation, and all dedicated API/UI behaviour.

## Next useful vertical slice

`festival-zone-command`: zone plan and lead, open/paused/closed state, command-level incident escalation, and overall readiness; a live map remains deferred.
