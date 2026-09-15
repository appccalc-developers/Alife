# SERVICE.ROSTER

> Normative module contract. Owns module-specific behavior, authority and compatibility. [Current delivery and gaps](../IMPLEMENTATION-STATUS.md#service-roster) are maintained centrally; [exact machine values](../event-contract.json) remain unchanged. Read only affected sections.

## Collaboration version 1

The accepted **volunteer scheduling coordinator / 同工排班协调人** manually consolidates module needs, invites individuals, handles acceptance/decline and arranges replacements in an independent page. Preparation retains default demands, candidate configuration and early single-occurrence arrangements. The four-date batch scheduler is a version-1 coordinator responsibility after publication; ownership alone does not grant it. Publication does not stop scheduling. Version-0 owner/coordinator batch authority remains compatible on the independent route. Each occurrence has its own roster entry, including future twelve-week materialization. Demand is not confirmed personnel. Ordinary future shortages do not block plan approval; occurrence delivery still requires its applicable staff and specialist eligibility. Work and handoffs follow [EVENT-WORKSPACES.md](../EVENT-WORKSPACES.md).

## Purpose

Turn service demand into eligible, confirmed occurrence-level assignments while preserving availability, substitutions, and history.

## Target contract

### Activation

Required when `people.volunteersRequired == true` (`service-slots-required`). Activity Type slot presets are editable defaults, not confirmed assignments or policy.

Saved-draft choices, preservation and submission revalidation follow [optional preparation tools](../EVENT-SETUP-FLOW.md#optional-tools-during-saved-preparation).

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

## Operational behavior

Four-date pages provide role/response filters, desktop date/position tables and mobile date groups. The tool waits for the server's current batch-authority projection before rendering, so an owner-only or assignee visit never flashes a coordinator tool. Coordinators stage assignments, replacements and cancellations in memory. Version-1 batch submission rechecks accepted coordinator status and publication; a revoked role or withdrawn publication rejects a stale link. The [atomic manual scheduling contract](#atomic-manual-scheduling) owns batch versions, authorization, limits, conflict preservation and notifications. Reads/writes remain private/no-store.

## Personal Center handoff

Current approved invited assignees see live non-cancelled slot responsibilities through [Event duties](../EVENT-DUTIES.md), including occurrence and deadline. Response, replacement, ending and loss of group membership or slot qualification remove the previous duty. Uncovered required positions without a qualified pending invite surface coordinator/owner arrangement work; a confirmed member who leaves or loses the required role no longer fills the position. Responses revalidate current membership, slot eligibility and cancellation on the server using the same eligibility predicate as the projection. General task completion cannot replace roster consent. No email or external push channel is introduced.

## Rule 2 and default positions — 2026-09-13

[Default requirements and approval coverage](#default-requirements-and-approval-coverage) owns rule-2 behavior and frozen rule-1 compatibility. Default times are start/end offsets. Repeated extension is harmless. Recurring execution must identify a date and recheck current qualification, candidate membership, availability and personal confirmation.

## Whole-Event roster entry (2026-09-15)

The main SERVICE.ROSTER preparation editor aggregates roles from every module, including SAFETY.RAM, retaining module grouping, eligible candidates and personal shift responses. The former safety-only roster embedded beneath RAM is removed. Existing shifts are neither migrated nor deleted, and each role’s original module permission is still checked server-side. Other specialist entries can keep their module filters.


## Candidate authority

[Explicit candidate groups](#explicit-candidate-groups) own membership, ordering, eligibility and consent. Candidate-list changes use concurrency checks and invalidate affected preparation/Package evidence without rewriting history; candidate membership never grants authority.

## Atomic manual scheduling

future occurrences are sorted ascending, four per page. Managers stage choices in memory, review one summary and submit one idempotent batch carrying each occurrence and candidate-group ETag. Any conflict rejects the entire batch, including notifications. The server validates current group qualification, availability, duplicate member and pending-plus-confirmed count for every position. Old single-date assignment uses the same batch service. Invitees alone accept/decline; declined/ended/replaced records remain historical, and replacements require new consent. In-app invitations/results/end notices commit with business changes. Results go only to the still-authorized assigner and current Event owner. Existing duty projections and old links revalidate current authority and assignment state.


## Default requirements and approval coverage

Event-scoped immutable default versions contain role/count/relative time/eligibility only. Initial creation may adopt explicitly reviewed demands; old Events require explicit selection of a source occurrence. Extending 12 weeks creates missing dates and empty positions, respecting recurrence/time zone/exceptions and preserving existing rows/responses. A v2 Package freezes requirements, candidate configuration and default version; ordinary staffing and replies are live execution data and do not alter its source hash. Ordinary future vacancies do not block Plan approval, while execution of each recurring date requires enough currently eligible, available, personally confirmed members. Critical RAM/child/transport/command/on-site/qualified duties and unknown qualifications retain specialist review/invalidation; roster APIs cannot grant professional authority or change signers. Config/candidate changes still require reopening. Legacy frozen Packages keep rule 1; replacement after reopening uses rule 2. A Package retains its explicitly approved date window when further dates are materialized: extension neither invalidates nor silently expands that coverage. Newly uncovered dates need a covering occurrence approval before execution.


## Saved preparation compatibility

### Shared preparation editor

Saved creation-form edits preserve slot IDs, programme links and member responses; slots with responses cannot be removed. The occurrence-scoped read and atomic Plan/arrangement save are specified in [EVENT-SETUP-FLOW.md](../EVENT-SETUP-FLOW.md).

### Explicit candidate groups

`GET/PUT /api/events/{id}/roster/groups` manages an ordered, at-most-200-member candidate list per role and its owning module. Only the accountable owner or accepted roster coordinator can manage/read full groups. PUT requires `If-Match` (`"new"` for first creation); all candidates must be approved members of the Event's owning group. Lists do not grant module permissions or accept invitations. New assignments and substitutes must belong to the explicit role group and pass eligibility/availability checks; no group means no new assignment. Existing assignments remain intact. Full candidate IDs appear only in manager roster responses; other viewers receive a self-candidate flag. Approved candidate members may read their personal roster state before assignment and record their own availability, without receiving other members’ assignments or candidate identities.

The new migration creates candidate-group storage only and invents no groups or members. Review and apply it only to an authorized environment. Configuration respects preparation freezing, audits changes, renews occurrence ETags and uses group concurrency during assignment. Candidate ordering is manual and does not implement rotation.
