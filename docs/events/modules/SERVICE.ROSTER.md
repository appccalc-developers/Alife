# SERVICE.ROSTER

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Turn service demand into eligible, confirmed occurrence-level assignments while preserving availability, substitutions, and history.

## Target contract

### Activation

Required when `people.volunteersRequired == true` (`service-slots-required`). Activity Type slot presets are editable defaults, not confirmed assignments or policy.

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

ServiceSlot demand, role eligibility, availability, fair rotation, assignment, confirmation/decline, leave, substitutes, and history.

### Roles and authority

At least one `roster.coordinator` from the Event team. Coordinators manage occurrence slots and assignments; members respond only to their own availability and assignment.

### Data classification

`eventTeam` and `userSpecific`; all roster management and personal availability responses are private/no-store.

### Workflow contribution

`roster.define-demand`, `roster.collect-availability`, `roster.confirm`, `roster.handle-substitutes`.

### Readiness

`required-slots-filled`, `assignees-eligible`, and `assignees-confirmed`.

### Event Package contribution

Contributes occurrence-scoped counts for required, eligible, accepted, confirmed, and missing critical roles plus source versions. It does not copy ordinary member availability or unrelated assignment history. A governance-critical lead/qualified-role change identifies the affected occurrence and may invalidate its execution gate.

### User experience

The coordinator workspace is occurrence-first. Members see only their own requests and responses. Time editing uses the occurrence's resolved time boundary and preserves history during substitution.

## Current implementation

Current core flow. Occurrence ServiceSlot CRUD, Session/ProgramItem links, self availability, coordinator assignment, confirm/decline, history-preserving substitution, eligibility checks, x-of-y readiness, ETags, no-store APIs, and reachable `EventRosterWorkspace` exist.

## Open contract gaps

Fair-rotation suggestions, leave windows, versioned eligibility evidence, invitation notifications, and safe cross-occurrence copy remain open.

## Next useful vertical slice

`roster-rotation-evidence`: provide an explainable rotation suggestion and versioned eligibility evidence, with the coordinator retaining final confirmation.
