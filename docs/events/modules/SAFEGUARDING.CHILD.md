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

Core flow. Explicit child records link to either a historical `EventEnrollment` or a version-1 `EventRegistrationParticipant` for the same Event. A version-1 participant must be explicitly marked as a child and must not have a cancelled or expired seat; a Member account is optional. A named guardian's application field alone never grants authority: the safeguarding lead establishes the relationship and the named guardian confirms it. Policy-bound consent, guardian-managed collectors, occurrence check-in/verified check-out, worker evidence, policy-backed readiness, ETag/idempotency, append-only minimal audit, exact server authorisation, minimum projections, private APIs, and reachable `EventSafeguardingWorkspace` remain in force.

An Event may include both child-eligible and adult-only projects. A project's `minorsParticipate=yes` contributes SAFEGUARDING.CHILD to the single Event module and report; Event-level age rules remain the upper bound. A participant's explicit guardian relationship is required before a guardian acts for that participant. Hiking, water and overnight offers require consent bound to the concrete project and occurrence in addition to any Event-level child process. Unknown age or missing consent cannot be treated as an adult or as approval. Birth date, relationship/consent evidence and health detail are private and do not enter Event JSON, shared caches or AI prompts.

Project eligibility measures age on the offer date in the Event's IANA time zone, including the birthday boundary; a February 29 birth date reaches its boundary on February 28 in a non-leap year. Only the participant or a confirmed guardian may submit/read birth-date evidence. A manager sees a server result, not the date. A child selection requires an explicit, active, confirmed relationship to that actual Event registration participant; a supplied guardian ID or application proxy alone grants nothing. Hiking, water, overnight or explicitly consent-required offers need consent for the current project policy version. A named guardian may consent online; an authorised manager can record verified offline consent with its actual confirmed guardian, method/time and evidence. Neither AI nor a general Event consent substitutes for this project/occurrence record.

For child selection and completion, that exact project's `minorsParticipate` answer must be confirmed `yes`, SAFEGUARDING.CHILD enabled, and the child's own active registration profile linked to a confirmed guardian and the latest granted consent under the current published child policy. Additional high-risk or policy-required project consent binds the actual participation, project, offer, occurrence, current attributes/conditions, offer interval and policy version through a private scope hash. A changed scope requires fresh consent; historical plain-text evidence remains readable but is not accepted as current proof.

Before Event-wide or occurrence execution confirmation, the server rechecks each confirmed child project participation in that scope. An unconfirmed parent Event seat, incomplete procedure, changed project policy, invalid current child safeguarding state or missing current project consent returns only `event.execute.childProjectConsentRequired`. The same current blocker appears in lifecycle readiness and replay/save responses, including when governance is `Off` or `DryRun`; no child identity or evidence is projected there.
