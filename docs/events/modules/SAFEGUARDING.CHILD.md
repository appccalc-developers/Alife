# SAFEGUARDING.CHILD

> Normative module contract. Owns module-specific behavior, authority and compatibility. [Current delivery and gaps](../IMPLEMENTATION-STATUS.md#safeguarding-child) are maintained centrally; [exact machine values](../event-contract.json) remain unchanged. Read only affected sections.

## Collaboration version 1 — preparation and execution

Uses the [shared report and handoff contract](../EVENT-WORKSPACES.md#tasks-and-reports): accepted module lead, versioned submission and owner adoption. Module-specific operations and privacy below still apply; a report neither certifies specialist facts nor grants participant-data access.

## Purpose

Protect children through explicit relationships, versioned consent, controlled collection authority, eligible duty access, minimum disclosure, attendance state, and escalation.

## Target contract

### Activation

Required when confirmed `people.childrenPresent == true` (`children-present`). Child or guardian status is never inferred from age, surname, contact data, or enrollment JSON.

Saved-draft choices, preservation and submission revalidation follow [optional preparation tools](../EVENT-SETUP-FLOW.md#optional-tools-during-saved-preparation).

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

Preparation configuration follows the [formal-approval freeze and reopening contract](../EVENT-SETUP-FLOW.md). Approved preparation cannot be edited until reopening is authorised. Operational responses, consent and safety records retain their existing controls.

During saved preparation, the existing authorized tool is embedded directly in **Arrangements → Safety → Children participation / Child safeguarding**. It shares its operational API and permissions with the independent workspace route; there is no separate Team and tools preparation step. See [integrated preparation](../EVENT-SETUP-FLOW.md).

## Operational behavior

core flow. Explicit Enrollment-linked child records, confirmed guardian relationships, policy-bound consent, guardian-managed collectors, occurrence check-in/verified check-out, worker evidence, policy-backed readiness, ETag/idempotency, append-only minimal audit, exact server authorisation, minimum projections, private APIs, and reachable `EventSafeguardingWorkspace` exist.
