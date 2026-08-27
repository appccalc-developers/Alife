# ALIFE Event Management Architecture Contract

> Documentation class: **Normative**. This document defines stable product and architecture meaning. [event-contract.json](event-contract.json) is co-authoritative for exact machine values. Current delivery state belongs in [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md), not here.

## Authority and change rule

Repository security, privacy, compatibility, bilingual, and publishing rules in [AGENTS.md](../../AGENTS.md) remain in force. Within Event Management, authority is:

1. the architecture decisions and invariants in this contract;
2. exact codes, enums, references, rules, and API contracts in [event-contract.json](event-contract.json);
3. explanatory examples and generated presentations.

Implementation convenience must not silently alter this contract. If code and a normative rule disagree, report the conflict and stop unless the task explicitly authorises the product or architecture decision needed to resolve it.

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

## Event facts and deterministic composition

Facts cover purpose and outcomes, owning identity, time and recurrence, people, place, money, transport, safeguarding, programme, food, scale, visibility, and real risk. Each fact records certainty and source. Candidate or unknown values remain distinct from confirmed `false`.

Composition uses this precedence, defined exactly in the machine contract:

1. confirmed facts;
2. mandatory policies and prohibitions;
3. still-valid human selections;
4. Activity Type presets;
5. archetype structure defaults;
6. explainable recommendations;
7. dependency closure and conflict resolution.

For the same confirmed facts, definition versions, and valid human selections, composition produces the same proposal and `proposalHash`. Compose and recompose never mutate stored Event state. On acceptance the server recomputes, validates the proposal hash and `If-Match`, applies idempotency, and writes a new immutable snapshot.

A module with operational data, money, files, roles, submissions, or approvals cannot disappear silently. Its removal enters a blocking retirement workflow with preservation, cancellation, or transfer decisions and explicit human confirmation.

## Structural model

```text
EventSeries 0..1 ─── 1..* Event
Event       1    ─── 1..* EventOccurrence
Event       0..1 ─── 0..* ChildEvent (one parent level only)
Occurrence  1    ─── 0..* Session / Track
Session     1    ─── 0..* ProgramItem
Occurrence  1    ─── 0..* Zone
Occurrence  1    ─── 0..* ServiceSlot / Shift
```

### EventSeries

Stores reusable identity, an IANA time zone, local recurrence, exception dates, default team, and reusable settings. A recurring series maintains a rolling 12-week materialisation window. Later Series changes do not rewrite already materialised occurrences.

### Event

The ownership, visibility, governance, registration, and Event Plan boundary. During compatible migration the target `Event` concept maps to the existing `GroupEvent` persistence root. Each Event has exactly one owning group, one accountable owner, and at least one occurrence.

### EventOccurrence

One real delivery with resolved UTC start and end instants, programme, roster, attendance, exceptions, and incidents. A one-off Event has one initial occurrence. A recurring Event may materialise additional dates for rosters or exceptions without unbounded generation.

### ChildEvent

Used only when a unit needs an independent lifecycle boundary such as separate registration, RAM, fees, access, cancellation, or closure. Child Events stop at one parent level. Otherwise use a Session or Zone.

### Session / Track and ProgramItem

A Session or Track is a time/programme subdivision inside one occurrence. A ProgramItem is an ordered item within a Session. Neither creates an independent Event lifecycle.

### Zone

A spatial or operational subdivision inside one occurrence. A Zone may have an owner and operational state but does not independently own registration or governance.

### ServiceSlot / Shift

Role demand for an occurrence, optionally linked to a Session or ProgramItem. Preset slot counts are editable planning defaults only. They never establish safeguarding ratios, eligibility policy, or member assignment.

Stable GUIDs identify records. Titles and language changes never change identity. Money uses integer `amountMinor` plus ISO 4217 `currency`, never floating point as the authoritative value.

## Archetypes and Activity Types

The four archetypes are immutable system categories. Their codes, structural semantics, and safety boundaries cannot be edited or extended through administration.

| Archetype | Structural intent | Initial Activity Types |
| --- | --- | --- |
| `simple-social` | One light occurrence; no default sessions or zones | `shared-meal`, `fellowship-social`, `local-outing`, `outdoor-activity` |
| `camp-retreat` | One multi-session camp or retreat | `church-camp`, `spiritual-retreat`, `children-youth-camp`, `training-camp` |
| `recurring-gathering` | Series with a rolling 12-week occurrence window | `small-group-fellowship`, `worship-service`, `bible-study-course`, `prayer-meeting` |
| `festival-celebration` | Multi-session, multi-zone live operation | `community-festival`, `church-celebration`, `public-outreach`, `concert-performance` |

Activity Types are immutable, versioned templates inside one fixed archetype. The catalogue begins with sixteen system presets at version 2. Authorised system administrators may create, edit, deactivate, or reactivate templates within the four categories. A template's code and archetype never change after creation; every edit creates an audited next version.

Only a current active version may be used for a new schema 1.1 compose, recompose, or create operation. Deactivation fails closed for new composition but never invalidates historical Events or snapshots. Templates never confirm child, RAM, transport, money, venue, or capacity facts. `MONEY.FINANCE` is never type-preselected.

Workflow templates such as `camp` and `outreach` describe preparation workflows. They may be recommended by an Activity Type but are never archetypes or Activity Types.

## Capability modules

The system owns these twelve capability codes:

| Module | Target responsibility |
| --- | --- |
| [TEAM.WORK](modules/TEAM.WORK.md) | Teams, roles, tasks, artifacts, blockers, hand-offs, and accountable delivery |
| [PEOPLE.REGISTRATION](modules/PEOPLE.REGISTRATION.md) | Invitations, registration, capacity, waitlist, cancellation, tickets, and attendance |
| [SERVICE.ROSTER](modules/SERVICE.ROSTER.md) | Service demand, eligibility, availability, assignment, confirmation, and substitution |
| [MONEY.FINANCE](modules/MONEY.FINANCE.md) | Budget, fees, purchasing, claims, refunds, reconciliation, and close-out |
| [SAFETY.RAM](modules/SAFETY.RAM.md) | Hazards, controls, emergency planning, independent approval, and incidents |
| [SAFEGUARDING.CHILD](modules/SAFEGUARDING.CHILD.md) | Guardianship, consent, collection authority, duty access, check-in/out, and escalation |
| [PROGRAM.PRODUCTION](modules/PROGRAM.PRODUCTION.md) | Sessions, run sheets, contributors, rehearsal, technical cues, and content confirmation |
| [PLACE.RESOURCE](modules/PLACE.RESOURCE.md) | Venues, capacity, equipment, booking, conflict, setup, handover, and return |
| [MOVE.STAY](modules/MOVE.STAY.md) | Drivers, vehicles, journeys, manifests, parking, accommodation, and overnight duty |
| [FOOD.HOSPITALITY](modules/FOOD.HOSPITALITY.md) | Menus, dietary needs, procurement, kitchen shifts, food safety, serving, and cleaning |
| [FESTIVAL.OPERATIONS](modules/FESTIVAL.OPERATIONS.md) | Zones, stalls, crowd flow, command, first aid, weather, evacuation, and escalation |
| [COMMS.FOLLOWUP](modules/COMMS.FOLLOWUP.md) | Notices, public copy, change broadcasts, feedback, follow-up, and retention |

Each module has an immutable versioned contract containing:

- `ActivationRules`
- `Dependencies`
- `RoleRequirements`
- `WorkflowContributions`
- `DataClassification`
- `ReadinessRules`
- `Version`

Modules are designed, security-reviewed, and tested product capabilities. Churches and AI cannot add arbitrary module codes, component paths, permissions, or executable integrations. Unknown module codes and surface keys fail closed.

## Governance decisions

### ADR-01 — Official sponsorship

Visibility and sponsorship are separate dimensions. A group leader or co-leader may request official sponsorship. Only a root-church leader/co-leader or an administrator with `admin.events.sponsor` may approve it. Visibility never grants official status.

### ADR-02 — Accountability

Every Event has one `owningGroupId` and one accountable owner. Other groups and ministry teams are contributors within explicit workflow scopes; they do not become co-owners.

### ADR-03 — Child Event depth

Child Events stop at one level and require a genuine independent lifecycle boundary. Otherwise use Session or Zone.

### ADR-04 — Module ownership

The system owns capability codes, integration executors, and surface keys. Runtime modules or component paths are never supplied by church configuration, an API payload, or AI output.

### ADR-05 — Safe configuration

Churches may name bilingual role and workflow templates inside controlled capability packages. Permission codes, sensitive data scopes, separation of duties, and executable behaviour remain system-controlled.

### ADR-06 — Policy exceptions

Policy is non-waivable by default. An exception may be requested only when a versioned policy says `exceptionAllowed`; the reason, expiry, independent approver, and audit trail are required.

### ADR-07 — Recurrence

Recurring series store local recurrence in an IANA time zone and maintain a rolling 12-week occurrence window. Later dates may be materialised for rosters or exceptions without unbounded pre-generation.

### ADR-08 — Event template catalogue

The four archetype categories are fixed. Specifically authorised administrators manage immutable template versions inside them. Template code and category are immutable; activation changes are audited versions and never rewrite history.

## Roles, policy, workflow, and readiness

- Event roles are explicit assignments with scope, state, and version. A title or group membership alone does not grant module authority.
- Controlled permission packages constrain what templates may express. Server-side handlers enforce every permission, group, owner, role, and purpose boundary.
- Policy evaluations record the policy version, evidence, result, exception capability, and decisions. Unknown or unsupported policy values fail closed.
- Readiness is a projection over the accepted plan and current evidence. A blocked or unknown requirement cannot be displayed as ready.
- Module workflows compile into the existing `EventWorkflowRun`, `EventWorkflowStep`, and `EventArtifact` engine. That remains the single general Event workflow engine.
- Dedicated flows such as RAM keep their authoritative handlers and synchronise with the general workflow rather than being duplicated.

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

Human confirmation must be explicit, attributable, and auditable. AI prompts contain only the minimum necessary data and never include restricted child, financial, approval, contact, or health information.

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

## Interface composition

The accepted Event Plan determines which controlled surfaces are reachable. The frontend resolves `surfaceKey` through a compile-time registry. API or AI data may never supply an import path, component name, executable definition, URL, or arbitrary route.

Every reachable surface provides appropriate loading, empty, error, success, blocked, and disabled states. Language switching changes presentation without changing entity identity or triggering avoidable refetches. Product wire text remains `{ "en": "...", "zh": "..." }`; a Traditional Chinese document locale does not change the wire key.

## API and persistence compatibility

Migration is additive:

- `GroupEvent` remains the compatible persistence root until a separately authorised cutover.
- Existing routes, DTO fields, readable enum names, enrollment, review, RAM, workflow, and public projection behaviour remain compatible.
- `EventDataJson` remains readable and must not disappear silently.
- Typed facts, snapshots, occurrences, structures, and module records are introduced alongside legacy structures, with dual-write only where explicitly implemented.
- Backfill marks its source and never invents child, transport, safety, money, capacity, or sponsorship facts. Unknown remains unknown.
- New sensitive projections use dedicated DTOs; persistence details never leak into frontend contracts.
- Historical plans, occurrences, roles, and Activity Type references are never rewritten by later templates, archetypes, policies, or Series defaults.
- Migration application is limited to an explicitly approved disposable/local database unless the user separately authorises a shared or production target.

Exact endpoint contracts and accepted legacy schema versions are defined in [event-contract.json](event-contract.json). New endpoint implementation must preserve the authentication, authorisation, cache, ETag, and idempotency properties specified there.

## Normative acceptance scenarios

Implementations must cover at least:

- a simple meal that stays light while unknown safety or finance facts remain visible for confirmation;
- a remote hike requiring RAM and transport readiness evidence;
- a child camp with role-restricted safeguarding data and versioned policy inputs;
- a recurring fellowship with a 12-week window and occurrence-local exceptions;
- a public festival whose public projection waits for root-church sponsorship and all readiness gates;
- cross-viewer cache isolation for anonymous, church, team, restricted, and self projections;
- venue reservation capacity, overlap, release history, concurrency, and private caching;
- transport manifest capacity, restricted visibility, personal projection, RAM evidence, and concurrency;
- child consent, collector authority, minimum-disclosure duty projection, check-in/out state, and append-only audit;
- template administration with fixed categories, immutable codes, versioning, dedicated permission, ETags, audit, and historical readability.

The exact scenario assertions are in [event-contract.json](event-contract.json).

## Documentation projections

- [README.md](README.md) is the compact normative overview.
- [EventManagement-About.html](EventManagement-About.html) is generated from the three equivalent README language sections.
- [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) is operational and may change without altering this contract.
- [modules](modules/TEAM.WORK.md) contains focused module contracts with clearly labelled operational status sections.
- [generated/alife-event-composition-model.zh-TW-en.html](generated/alife-event-composition-model.zh-TW-en.html) is the generated long-form presentation. Its presentation template and retained historical prose are never an independent source of truth.
