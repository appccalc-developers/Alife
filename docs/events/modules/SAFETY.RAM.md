# SAFETY.RAM

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Identify Event hazards, record controls and emergency planning, enforce independent review, and connect safety evidence to readiness and publication.

## Target contract

### Activation

Required when `safety.requiresRam == true` (`ram-policy-triggered`). Unknown or candidate risk facts cannot deactivate RAM.

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

Bilingual hazards and controls, risk scoring, emergency contacts, transport/weather checks, versioned policy evidence, independent approval, expiry/re-review, incidents, and close-out follow-up.

### Roles and authority

At least one `ram.author` from the Event team and one separate `ram.approver` with `admin.events.audit`. Authors cannot approve their own RAM.

### Data classification

`roleRestricted` and `approvalEvidence`; private/no-store and excluded from shared projections, logs, and AI prompts.

### Workflow contribution

`ram.draft`, `ram.submit`, `ram.approve`, `incident.record`. RAM remains a dedicated authoritative flow synchronised with the single general Event workflow engine.

### Readiness

`ram-complete`, `ram-submitted`, and `ram-approved`. Public visibility remains gated by approved RAM where current policy requires it.

### Event Package contribution

Contributes RAM version, policy version, status, approval decision reference, residual-risk summary, expiry, emergency/weather/transport-check summary, and blockers. The Package never owns or replaces the RAM decision. Revocation, expiry, or a RAM-relevant material change invalidates affected Package gates and requires RAM re-review according to policy.

### User experience

Authors edit a non-destructive draft; submission freezes the reviewed version; an independent approver records a decision. Rejection and re-review preserve history and explain blockers.

## Current implementation

Current core flow. `EventRamAssessment`, draft/save/submit/approve, bilingual hazards and controls, risk scoring, outing transport/weather checks, independent approval, public visibility gate, protected APIs, and reachable `EventRamEditor` exist.

## Open contract gaps

A general versioned policy source, explicit exception rules, expiry and change-triggered re-review, occurrence incident register, and close-out follow-up remain open.

## Next useful vertical slice

`versioned-ram-policy-evidence`: policy version, evaluation result, evidence snapshot, expiry, change-triggered re-review, and approval audit.
