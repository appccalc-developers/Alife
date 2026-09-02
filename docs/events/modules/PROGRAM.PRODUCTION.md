# PROGRAM.PRODUCTION

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Plan and deliver the occurrence programme, content, people, rehearsals, and technical cues without turning a Session into a separate Event lifecycle.

## Target contract

### Activation

Required when `programme.productionRequired == true` (`managed-programme`).

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

Sessions/Tracks, ordered ProgramItems, speakers and performers, owners, run sheets, content confirmation, rehearsal, audio/visual cues, streaming, and presentation delivery.

### Roles and authority

At least one accepted `programme.lead` who is an Event team member. The lead or Event manager administers an occurrence's programme on the server; contributors receive only their scoped work.

### Data classification

`eventTeam` and `approvalEvidence`; protected programme management responses are private/no-store.

### Workflow contribution

`programme.build`, `programme.confirm-content`, `programme.rehearse`, `programme.deliver`.

### Readiness

`programme-owner-assigned`, `required-items-confirmed`, and `production-check-complete`.

### Event Package contribution

Contributes occurrence/session structure, programme version, owner coverage, required-item/content confirmation, rehearsal/production readiness, and blockers. Public copy remains a draft until the Publish gate passes. Programme-only cosmetic changes do not automatically invalidate overall approval; policy-classified operational or governance-critical changes identify the affected scope.

### User experience

An occurrence-first editor supports ordered Sessions and minute-level ProgramItems, explicit ownership, conflict-safe updates, print/run-sheet output, and bilingual display.

## Current implementation

Current core flow. Occurrence Session and ProgramItem CRUD, owners, reordering, occurrence ETags/If-Match, print run sheet, series-occurrence isolation, protected APIs, and reachable `EventProgrammePanel` exist.

## Open contract gaps

Typed speakers/performers, content approval, rehearsals, technical cues, livestream, and presentation mode remain open.

## Next useful vertical slice

`programme-cue-approval`: content confirmation, technical cues, rehearsal checklist, and contributions to the existing Event workflow.
