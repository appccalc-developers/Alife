# SERVICE.ROSTER

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Turn service demand into eligible, confirmed occurrence-level assignments while preserving availability, substitutions, and history.

## Target contract

### Activation

Required when `people.volunteersRequired == true` (`service-slots-required`). Activity Type slot presets are editable defaults, not confirmed assignments or policy.

During saved, unfrozen draft preparation this tool remains a Yes/No choice, including when the rule above applies. Disabling retains facts, ownership and saved records. Formal submission revalidates activation and dependencies and blocks missing required tools; see [optional preparation tools](../EVENT-SETUP-FLOW.md#optional-tools-during-saved-preparation).

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

ServiceSlot demand, role eligibility, availability, manually ordered candidate groups, assignment, confirmation/decline, leave, substitutes, and history.

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

During [event creation](../CREATION-ARRANGEMENTS.md), the Arrangements page supports inline Yes/No activation and collapsible editing of template slot demand, counts and shift times. Required activation stays locked; reviewed demand is saved atomically with the Event, without assigning members.

Preparation configuration follows the [formal-approval freeze and reopening contract](../EVENT-SETUP-FLOW.md). Approved preparation cannot be edited until reopening is authorised. Operational responses, consent and safety records retain their existing controls.

During saved preparation, role candidate groups and shifts appear inside each owning module in Arrangements. SERVICE.ROSTER retains coordinator configuration and unclassified roles; its private response is shared in React memory across the embedded panels. Template demand is also grouped by module during creation. It shares its operational API and permissions with the independent workspace route; there is no separate Team and tools preparation step. See [integrated preparation](../EVENT-SETUP-FLOW.md).

## Current implementation

Current core flow. Occurrence ServiceSlot CRUD, Session/ProgramItem links, self availability, coordinator assignment, confirm/decline, history-preserving substitution, eligibility checks, x-of-y readiness, ETags, no-store APIs, and reachable `EventRosterWorkspace` exist.

## Open contract gaps

Leave windows, versioned eligibility evidence, invitation notifications, and safe cross-occurrence copy remain open.

## Next useful vertical slice

Versioned eligibility evidence and safe cross-occurrence copy; automatic rotation is outside the product scope.

### Shared preparation editor

Saved creation-form edits preserve slot IDs, programme links and member responses; slots with responses cannot be removed. The occurrence-scoped read and atomic Plan/arrangement save are specified in [EVENT-SETUP-FLOW.md](../EVENT-SETUP-FLOW.md).

### Explicit candidate groups

`GET/PUT /api/events/{id}/roster/groups` manages an ordered, at-most-200-member candidate list per role and its owning module. Only the accountable owner or accepted roster coordinator can manage/read full groups. PUT requires `If-Match` (`"new"` for first creation); all candidates must be approved members of the Event's owning group. Lists do not grant module permissions or accept invitations. New assignments and substitutes must belong to the explicit role group and pass eligibility/availability checks; no group means no new assignment. Existing assignments remain intact. Full candidate IDs appear only in manager roster responses; other viewers receive a self-candidate flag. Approved candidate members may read their personal roster state before assignment and record their own availability, without receiving other members’ assignments or candidate identities.

The new migration creates candidate-group storage only and invents no groups or members. Review and apply it only to an authorized environment. Configuration respects preparation freezing, audits changes, renews occurrence ETags and uses group concurrency during assignment. Candidate ordering is manual and does not implement rotation.
