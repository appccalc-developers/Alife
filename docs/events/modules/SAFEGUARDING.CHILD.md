# SAFEGUARDING.CHILD

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Protect children through explicit relationships, versioned consent, controlled collection authority, eligible duty access, minimum disclosure, attendance state, and escalation.

## Target contract

### Activation

Required when confirmed `people.childrenPresent == true` (`children-present`). Child or guardian status is never inferred from age, surname, contact data, or enrollment JSON.

### Dependencies

`TEAM.WORK` and `PEOPLE.REGISTRATION`.

### Domain responsibilities

Explicit child registration, guardian relationship, policy-version consent, authorised collectors, occurrence check-in/out, worker eligibility, policy-supplied ratios, minimum audit, health-reference boundaries, and escalation.

### Roles and authority

At least one accepted `safeguarding.lead` with controlled eligibility. `check-in.worker` eligibility and occurrence duty come from a versioned policy. Guardians manage only their own confirmed relationship, consent, and collector authority. Ordinary Event managers/team members are not implicit readers.

### Data classification

`roleRestricted` and `approvalEvidence`, with minimum `userSpecific` self projections. Every response is private/no-store. Audit excludes names, health, contact, and document content.

### Workflow contribution

`safeguarding.guardian-consent`, `safeguarding.worker-check`, `safeguarding.check-in-out`, `safeguarding.escalate`.

### Readiness

`current-policy-loaded`, `guardianship-complete`, and `eligible-workers-and-policy-ratios-satisfied`. Unknown policy requirements fail closed; ratios and legal rules are never hard-coded from examples or AI output.

### Event Package contribution

Contributes only policy version, configuration/consent completeness, eligible-worker coverage, safeguarding decision reference, expiry, and blocker counts. It never copies child identity, health, guardian, collector, attendance, or document content. Only independently authorised safeguarding viewers may follow a protected source reference beyond the minimum Package summary.

### User experience

Leads receive the minimum full operational workspace; assigned check-in workers receive only duty-essential identity, consent, collector, and occurrence state; guardians and participants receive only explicitly related self context.

## Current implementation

Current core flow. Explicit Enrollment-linked child records, confirmed guardian relationships, policy-bound consent, guardian-managed collectors, occurrence check-in/verified check-out, worker evidence, policy-backed readiness, ETag/idempotency, append-only minimal audit, exact server authorisation, minimum projections, private APIs, and reachable `EventSafeguardingWorkspace` exist.

## Open contract gaps

Full health-record integration, incident escalation, cross-Event worker-certification lifecycle, advanced policy administration, and policy-authorised re-entry remain open.

## Next useful vertical slice

`safeguarding-incident-escalation`: a minimum role-restricted incident record linked to the existing workflow and RAM evidence; full health records and broad policy/certification administration remain deferred.
