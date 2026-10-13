# ALIFE Event Management core contract

<a id="alife-event-management-architecture-contract"></a>

> Normative core. Read this compact contract once, then only the affected topic/module sections using [the task reading matrix](AGENTS.md#task-reading-matrix). This reorganization changes documentation ownership, not business rules, wire values or runtime behavior.

## Authority and change rule

Repository [security, privacy, compatibility and publishing rules](../../AGENTS.md) remain in force. This core delegates detailed business meaning to the topics and modules below; [event-contract.json](event-contract.json) remains co-authoritative for exact codes, enums, references and API contracts. Explicitly versioned exceptions apply only in their stated scope. A later dated implementation note or convenient implementation cannot silently replace a normative rule. Stop affected implementation and report unresolved normative conflicts unless the task authorizes the required product decision.

[Current status](IMPLEMENTATION-STATUS.md) describes delivery, not product authority. [Historical evidence](../../archive/pending-docs-review/2026-10-10/docs/events/IMPLEMENTATION-HISTORY.md), old proposals and generated presentations are not current contracts or evidence of a freshly verified build.

## Topic ownership and reading map

| Topic | Authoritative source | JSON sections when relevant |
| --- | --- | --- |
| Facts, deterministic composition, structures, templates, module catalogue | [Composition](EVENT-COMPOSITION.md) | composition, aggregates, archetypes, activityTypes, modules |
| Package policy, scope, decisions, conditions, gates, invalidation, rollout | [Package approval](EVENT-PACKAGE-APPROVAL.md) | eventPackageApproval, policyContracts |
| Stages, role-specific entry, common reports and handoffs | [Workspaces](EVENT-WORKSPACES.md) | eventWorkspaces, surfaceRegistry |
| Nonlinear preparation, saved routes, freeze/reopen, poster and publication interaction | [Preparation](EVENT-SETUP-FLOW.md) | eventSetupFlow |
| Arrangement forms, atomic creation, confirmations and save compatibility | [Creation arrangements](CREATION-ARRANGEMENTS.md) | eventCreationArrangements |
| Personal duty projection, ordinary task review and delegation | [Duties](EVENT-DUTIES.md) | eventDuties |
| AI details and task/registration form assistants | [AI form assistance](AI-DETAILS-ASSISTANT.md) | eventDetailsAssistant, eventFormAssistant |
| Module operations, eligibility, privacy and version exceptions | [Module catalogue](EVENT-COMPOSITION.md#capability-modules) | affected module, authorizationRules, cachePolicies, apis |
| Event UI presentation | [Design](design/EVENT-WORKSPACE-DESIGN.md), read by task type | no new wire semantics |
| Event 2.0 instance reset boundary, one-time production operation and migration safety | [Event 2.0 reset](EVENT-2-RESET.md) | event2Reset, schemaVersion, acceptedLegacySchemaVersions |

Do not load every linked source. API changes also read the matching apis/enums/authorization/cache entries; account- or role-sensitive work must retain all applicable visibility dimensions.

## Core thesis

An Event is a composition, not a rigid runtime type.

```text
Event Plan
  = Event Facts
  + Structural Units
  + Capability Modules
  + Governance Rules
  + Human Decisions
```

- Facts drive composition.
- Archetypes and Activity Types supply versioned defaults, not confirmed facts.
- Composition produces a proposal and has no persistence side effect.
- Explicit human acceptance creates the authoritative Event Plan.
- Every accepted plan is a versioned, immutable snapshot that retains its referenced archetype, Activity Type, module, and policy versions.
- Later definition changes never rewrite an accepted plan, materialised occurrence, or historical role.

## Governance decisions

### ADR-01 — Official sponsorship

Visibility and sponsorship are separate dimensions. A group leader or co-leader may request official sponsorship. Only a root-church leader/co-leader or an administrator with `admin.events.sponsor` may approve it. Visibility never grants official status.

### ADR-02 — Accountability

Every Event has one `owningGroupId` and one accountable owner. Other groups and ministry teams are contributors within explicit capability scopes; they do not become co-owners.

### ADR-03 — Child Event depth

Child Events stop at one level and require a genuine independent lifecycle boundary. Otherwise use Session or Zone.

### ADR-04 — Module ownership

The system owns capability codes, integration executors, and surface keys. Runtime modules or component paths are never supplied by church configuration, an API payload, or AI output.

### ADR-05 — Safe configuration

Churches may name bilingual role templates inside controlled capability packages. Permission codes, sensitive data scopes, separation of duties, and executable behaviour remain system-controlled.

### ADR-06 — Policy exceptions

Policy is non-waivable by default. An exception may be requested only when a versioned policy says `exceptionAllowed`; the reason, expiry, independent approver, and audit trail are required.

### ADR-07 — Recurrence

Recurring series store local recurrence in an IANA time zone and maintain a rolling 12-week occurrence window. Later dates may be materialised for rosters or exceptions without unbounded pre-generation.

### ADR-08 — Event template catalogue

The four archetype categories are fixed. Specifically authorised administrators manage immutable template versions inside them. Template code and category are immutable; activation changes are audited versions and never rewrite history.

### ADR-09 — Event Package Approval

Plan acceptance creates an Event and immutable Event Plan Snapshot; it is not organisational approval. When the applicable governance policy requires approval, only an active decision on the current Event Package may unlock publication, registration, payment/fee acceptance, or execution readiness. RAM, safeguarding, finance, sponsorship, and policy-exception decisions remain independently authoritative.

### ADR-10 — Package scope and recurrence

The Event is the default Package governance boundary. An occurrence-scoped Package is allowed only for an occurrence-local exception or evidence set. A Series is never approved directly. A recurring Event may use policy-versioned `planBoundSeriesWindow` coverage; a future occurrence inherits approval only while it uses the approved Plan and Series defaults, falls within the recorded validity window, and has no Package-relevant exception. A Child Event with an independent lifecycle has its own Package and gates.

### ADR-11 — Consistent immutable approval evidence

A Package is generated from a canonical manifest and a complete, ordered source-version vector. The server revalidates the Plan, governance policy, and every required source inside the persistence boundary. If any source changed, generation or submission fails with a conflict and no submittable mixed-time Package is written.

### ADR-12 — Approval validity and lifecycle gates

Package lifecycle and approval validity are separate. An approval may become invalid, expire, or be revoked without rewriting its Package or original decision. One server-side evaluator owns publish, unpublish, registration open/close, payment/fee acceptance, and execute decisions. Approval never performs those actions automatically.

### ADR-13 — Compatible enforcement rollout

The authorised pre-launch Event reset removes every Event instance and its dependent operational history before Event 2.0 becomes writable. It preserves versioned Event templates, RAM/Package/safeguarding policies, workflow templates, venue resources and non-Event data. Composition schema `2.0.0` is the new baseline; Event 1.x payloads are rejected with `event.schema.unsupported`, retired routes return `404`, and old browser or edge sessions cannot write back. From `2.0.0` onward Package, Plan, RAM and operational history again follow normal immutable-history and version-governance rules.

The former protected production reset and recovery workflows are retired. The user has separately authorised this one-time deletion of production Event test instances without SQL/R2 recovery copies or rollback. The operation requires an exact target, frozen Event writes, reviewed live preview fingerprint and post-operation proof that Event-scoped records are empty while preserved domains are unchanged. Neither application startup nor ordinary deployment may purge Event instances. A pending migration that removes legacy Event storage must fail closed while Event instance data is nonempty; a syntactically valid reset run ID is not evidence of an empty database. Templates, policies, venue resources and non-Event data stay outside the deletion scope. No production completion is claimed until the target is verified after apply and the API 2.0 deployment is checked.

The one-time production forward migration uses the isolated Event 2.0 migration-only entry point after an empty-instance inspection. It must not run the ordinary DbMigrator's non-Event seed, normalization or cache work. The exact production chain is the project-operations prerequisite followed by Event 2.0 storage removal, with the reviewed 67→75→2.0 schema transitions and retained/retired storage verification at each step.

Ordinary API deployment checks the exact production SQL target and fails before runtime changes if the Event 2.0 storage migration is pending. It requires an already configured current Event data epoch and explicit open/frozen write mode; it never infers a pre-reset epoch or applies the one-time destructive migration through a deployment switch.

### ADR-14 — Project-scoped Event composition

The sixteen versioned Event templates own editable bilingual preset projects and fixed-question answer defaults. Creating an Event copies them into independent stable project IDs; the organiser reviews and confirms each project before creation. An accepted Event never follows later template edits. In composition schema `2.0.0`, eight common project arrangements are explicit yes/no switches (unchecked means `no`), and eight specialist questions appear only for applicable combinations of seven independent attributes. Overall risk review, participant notices/follow-up and multi-zone operations are answered once in Event Details as tri-state Event facts. Applicable project `yes` answers and confirmed Event facts form a union of required modules; `no` in another project cannot cancel a requirement, and an Event `unknown` never means `no`. Module dependencies and mandatory safety policy still apply. The Event keeps one module owner, report and approval, while distinct meals, journeys, stays, spaces and participant rules retain separate project/occurrence records. Pre-reset Event 1.x Plans have no runtime compatibility contract after the destructive reset.

## Roles, policy, duties, and readiness

- Event roles are explicit assignments with scope, state, and version. A title or group membership alone does not grant module authority.
- Controlled permission packages constrain what templates may express. Server-side handlers enforce every permission, group, owner, role, and purpose boundary.
- Policy evaluations record the policy version, evidence, result, exception capability, and decisions. Unknown or unsupported policy values fail closed.
- Readiness is a projection over the accepted plan and current evidence. A blocked or unknown requirement cannot be displayed as ready.
- Generic `EventWorkflowRun`, `EventWorkflowStep` and `EventArtifact` instances are retired from the active product and removed by the post-purge forward migration. Versioned `EventWorkflowTemplate` definitions remain preserved and readable.
- Dedicated flows such as RAM remain authoritative and expose current work through narrowly scoped Church Life lists and Personal Center duty notifications; they do not synchronise to a generic workflow engine.

## Authorisation, privacy, and caching invariants

- Frontend visibility never replaces server authorisation.
- Every protected operation checks ownership, group membership, accepted role, purpose, and platform permission as applicable.
- Responses are classified as `public`, `churchOrGroupVisible`, `eventTeam`, `roleRestricted`, `approvalEvidence`, or `userSpecific`.
- Only an approved, sanitised public allow-list projection may use shared caching.
- Church/group, team, restricted, approval, and user-specific responses are `private, no-store` and never share viewer ETags.
- Sensitive data never enters shared cache, logs, analytics payloads, or AI prompts.
- Unknown enum, module, policy, permission, or surface values fail closed.
- Mutations that can be retried use idempotency and mutations of versioned state use `If-Match`/ETag concurrency.
- Cache invalidation covers publication, withdrawal, visibility, sponsorship, membership, role, plan, and protected-record changes according to the data class.

The exact authorisation rules, cache policies, data classifications, and surface registry are in [event-contract.json](event-contract.json).

## API and persistence compatibility

Event 2.0 is a deliberately destructive, pre-launch boundary:

- `GroupEvent` and `EventDataJson` remain the current persistence root and current business payload. The JSON shape is strictly validated and excludes retired `optionalActivities`, `legacySummary` and other Event 1.x fields.
- Create and update requests provide the complete `2.0.0` composition, Event facts, Activity Plan, project answers and module confirmations. Event 1.x or missing-version requests fail with HTTP `400` and code `event.schema.unsupported`.
- Current RAM authoring remains on its independent schema version 2. Package policy and RAM policy schema versions do not change merely because composition becomes 2.0.
- Retired Event edit, setup/workflow alias, legacy enrollment/capacity and old RAM request routes return `404`. Current registration application, participant and project-selection APIs own new data.
- Current Event templates receive a new 2.0-capable version. Older template and policy versions remain immutable and readable, but cannot create a new Event or participate in current calculation.
- New sensitive projections use dedicated DTOs; persistence details never leak into frontend contracts. Authentication, authorisation, ETag, idempotency, privacy and private-cache behavior remain mandatory.
- Forward migrations may remove storage used only by pre-reset Event instances. They must retain migration history, current Event business tables, templates, policies, workflow templates, venues and non-Event structures.
- From schema `2.0.0` onward, later changes require ordinary compatible migration or an explicitly authorised future cutover. The pre-launch reset exception cannot be reused implicitly.

The exact endpoint contract and empty accepted-legacy-version list are defined in [event-contract.json](event-contract.json). Reset procedure and evidence requirements are in [Event 2.0 reset](EVENT-2-RESET.md).

## Human and AI authority boundary

AI is an assistant, never an authority. It may:

- extract or propose candidate facts;
- recommend modules or structure with explanations;
- draft bilingual content for human review.

AI may not:

- confirm a fact or treat missing information as false;
- assign roles or authority;
- approve, waive policy, sponsor, or mark readiness complete;
- persist an Event Plan or operational decision;
- publish an Event or generated content.

Form filling and time adoption follow [AI assistance](AI-DETAILS-ASSISTANT.md#draft-authority-and-time-adoption). The explicitly authorized [RAM background candidate exception](modules/SAFETY.RAM.md#authorized-synchronization-exception) permits unreviewed candidate persistence only; it grants no scoring, signature, approval or publication authority.

Human confirmation must be explicit, attributable, and auditable. AI prompts contain only the minimum necessary data and never include restricted child, financial, approval, contact, or health information.

## Interface composition

The accepted Event Plan determines which controlled surfaces are reachable. The frontend resolves `surfaceKey` through a compile-time registry. API or AI data may never supply an import path, component name, executable definition, URL, or arbitrary route.

Every reachable surface provides appropriate loading, empty, error, success, blocked, and disabled states. Language switching changes presentation without changing entity identity or triggering avoidable refetches. Product wire text remains `{ "en": "...", "zh": "..." }`; a Traditional Chinese document locale does not change the wire key.

Stage identifiers stay `preparation`, `registration`, `execution`, `followup`; preparation is nonlinear. Navigation grants no authority. Explicit creation, submission, specialist/Package decisions, publication, registration opening and occurrence execution retain their server gates. Plan B and a fifth Review/Reflection stage are not current capabilities. [Workspace entry](EVENT-WORKSPACES.md) and [route compatibility](EVENT-SETUP-FLOW.md#lifecycle-and-routing-compatibility) own the detailed behavior.

## Documentation projections

The three-language [README](README.md) is a human overview and topic index. Its generated overview and the generated historical handbook cannot add normative rules. Module documents own operational requirements; the status summary owns delivery labels/gaps; history retains dated verification. Source changes and validation follow [AGENTS.md](AGENTS.md#documentation-update-triggers).

## Moved sections and compatible bookmarks

Old top-level topic headings are retained below as anchors; their rules now live at the linked authoritative destination. This table is a migration index, not an additional reading requirement.

| Previous section | Current location |
| --- | --- |
| <a id="event-facts-and-deterministic-composition"></a>Event facts and deterministic composition | [Authoritative section](EVENT-COMPOSITION.md#event-facts-and-deterministic-composition) |
| <a id="structural-model"></a>Structural model | [Authoritative section](EVENT-COMPOSITION.md#structural-model) |
| <a id="archetypes-and-activity-types"></a>Archetypes and Activity Types | [Authoritative section](EVENT-COMPOSITION.md#archetypes-and-activity-types) |
| <a id="capability-modules"></a>Capability modules | [Authoritative section](EVENT-COMPOSITION.md#capability-modules) |
| <a id="normative-acceptance-scenarios"></a>Normative acceptance scenarios | [Authoritative section](EVENT-COMPOSITION.md#normative-acceptance-scenarios) |
| <a id="collaboration-workspaces-version-1"></a>Collaboration workspaces version 1 | [Authoritative section](EVENT-WORKSPACES.md) |
| <a id="event-package-approval-and-lifecycle-gates"></a>Event Package Approval and lifecycle gates | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#event-package-approval-and-lifecycle-gates) |
| <a id="versioned-ram-governance"></a>Versioned RAM governance | [RAM policy](modules/SAFETY.RAM.md#policy-and-assessment-compatibility), [module confirmation compatibility](CREATION-ARRANGEMENTS.md#module-confirmation-compatibility) |
| <a id="creator-ownership-and-role-based-staffing"></a>Creator ownership and role-based staffing | [Ownership](modules/TEAM.WORK.md#creator-and-series-ownership), [candidates](modules/SERVICE.ROSTER.md#candidate-authority), [details/time compatibility](EVENT-SETUP-FLOW.md#details-placement-and-timestamp-compatibility) |
| <a id="personal-center-duties-and-task-approval"></a>Personal Center duties and task approval | [Authoritative section](EVENT-DUTIES.md#projection-compatibility) |
| <a id="preparation-first-round-contract-extension--2026-09-13"></a>Preparation first-round contract extension — 2026-09-13 | [Version scope](EVENT-WORKSPACES.md#capability-availability-and-version-boundaries), [RAM authoring](modules/SAFETY.RAM.md#manual-ai-authoring-boundary), [registration](modules/PEOPLE.REGISTRATION.md#version-0-seat-and-waitlist-compatibility), [manual roster](modules/SERVICE.ROSTER.md#atomic-manual-scheduling), [approval coverage](modules/SERVICE.ROSTER.md#default-requirements-and-approval-coverage) |
| <a id="ram-synchronization-extension--2026-09-15"></a>RAM synchronization extension — 2026-09-15 | [Authoritative section](modules/SAFETY.RAM.md#authorized-synchronization-exception) |
| <a id="activity-plan-authority-and-ram-review-2026-09-15"></a>Activity-plan authority and RAM review (2026-09-15) | [Authoritative section](modules/TEAM.WORK.md#activity-authority-across-modules) |
| <a id="eventseries"></a>EventSeries | [Authoritative section](EVENT-COMPOSITION.md#eventseries) |
| <a id="event"></a>Event | [Authoritative section](EVENT-COMPOSITION.md#event) |
| <a id="eventoccurrence"></a>EventOccurrence | [Authoritative section](EVENT-COMPOSITION.md#eventoccurrence) |
| <a id="childevent"></a>ChildEvent | [Authoritative section](EVENT-COMPOSITION.md#childevent) |
| <a id="session--track-and-programitem"></a>Session / Track and ProgramItem | [Authoritative section](EVENT-COMPOSITION.md#session--track-and-programitem) |
| <a id="zone"></a>Zone | [Authoritative section](EVENT-COMPOSITION.md#zone) |
| <a id="serviceslot--shift"></a>ServiceSlot / Shift | [Authoritative section](EVENT-COMPOSITION.md#serviceslot--shift) |
| <a id="purpose-and-concept-boundaries"></a>Purpose and concept boundaries | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#purpose-and-concept-boundaries) |
| <a id="governance-policy-version-1"></a>Governance policy version 1 | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#governance-policy-version-1) |
| <a id="scope-and-coverage"></a>Scope and coverage | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#scope-and-coverage) |
| <a id="governance-policy-administration"></a>Governance policy administration | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#governance-policy-administration) |
| <a id="canonical-generation-and-submission"></a>Canonical generation and submission | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#canonical-generation-and-submission) |
| <a id="package-lifecycle-decisions-and-conditions"></a>Package lifecycle, decisions, and conditions | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#package-lifecycle-decisions-and-conditions) |
| <a id="lifecycle-gates"></a>Lifecycle gates | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#lifecycle-gates) |
| <a id="material-change-and-re-approval"></a>Material change and re-approval | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#material-change-and-re-approval) |
| <a id="privacy-retention-and-caching"></a>Privacy, retention, and caching | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#privacy-retention-and-caching) |
| <a id="compatible-rollout"></a>Compatible rollout | [Authoritative section](EVENT-PACKAGE-APPROVAL.md#compatible-rollout) |
