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

### ADR-09 — Event Package Approval

Plan acceptance creates an Event and immutable Event Plan Snapshot; it is not organisational approval. When the applicable governance policy requires approval, only an active decision on the current Event Package may unlock publication, registration, payment/fee acceptance, or execution readiness. RAM, safeguarding, finance, sponsorship, and policy-exception decisions remain independently authoritative.

### ADR-10 — Package scope and recurrence

The Event is the default Package governance boundary. An occurrence-scoped Package is allowed only for an occurrence-local exception or evidence set. A Series is never approved directly. A recurring Event may use policy-versioned `planBoundSeriesWindow` coverage; a future occurrence inherits approval only while it uses the approved Plan and Series defaults, falls within the recorded validity window, and has no Package-relevant exception. A Child Event with an independent lifecycle has its own Package and gates.

### ADR-11 — Consistent immutable approval evidence

A Package is generated from a canonical manifest and a complete, ordered source-version vector. The server revalidates the Plan, governance policy, and every required source inside the persistence boundary. If any source changed, generation or submission fails with a conflict and no submittable mixed-time Package is written.

### ADR-12 — Approval validity and lifecycle gates

Package lifecycle and approval validity are separate. An approval may become invalid, expire, or be revoked without rewriting its Package or original decision. One server-side evaluator owns publish, unpublish, registration open/close, payment/fee acceptance, and execute decisions. Approval never performs those actions automatically.

### ADR-13 — Compatible enforcement rollout

Event Package enforcement is versioned and rollout-controlled. Existing Events never receive invented approval. Before enforcement, dry-run evaluation records non-sensitive differences without changing existing visibility or registration behaviour. Explicit transition, a policy deadline, or a safety-critical fail-closed rule moves a legacy Event into enforcement; rollout is reversible without deleting Package history.

## Event Package Approval and lifecycle gates

### Purpose and concept boundaries

`EventPackage` is the immutable, structured approval projection of one Event or occurrence scope. It is assembled from the accepted Event Plan and authoritative module summaries; it is not another data-entry form. The following remain distinct:

- Plan acceptance: human confirmation of the composed Plan and creation of an immutable Plan Snapshot.
- Event Package Approval: an authorised human decision on one Package version.
- Specialist approval: a RAM, safeguarding, finance, sponsorship, or exception decision owned by its domain.
- Readiness: a projection of current evidence and blockers, never a human decision.
- Ready to Proceed: a lifecycle-gate result derived from active Package approval, specialist decisions, conditions, and pre-event confirmation; clients cannot set it directly.
- Workflow task or artifact: a discoverability and coordination record that links to the Package; completing it cannot create or change the authoritative decision.

AI may propose text or candidate facts but cannot generate an authoritative Package, submit, decide, satisfy or verify conditions, publish, open registration, accept payment, or confirm execution.

### Governance policy version 1

Governance is evaluated from confirmed facts and one immutable policy version. Unknown required facts never count as false. Multiple triggers take the strictest result.

- `light`: group-visible, no registration or money flow, and no confirmed child, transport, accommodation, outdoor/remote, public-impact, or specialist-approval trigger. The accountable owner makes one explicit confirmation.
- `standard`: public or expanded visibility, registration, church resources, sponsorship consideration, money flow below any policy escalation, or another standard policy trigger. One owning-group leader/co-leader who is not the submitter decides; when no eligible separate actor exists, the decision escalates to the root church.
- `enhanced`: child/safeguarding, outdoor or remote risk, transport, accommodation/overnight duty, high-risk RAM, large-public-impact, external-partner, or policy-escalated finance facts. One root-church leader/co-leader or actor with `admin.events.approvePackages` decides and must be separate from the submitter and affected specialist authors.

Version 1 requires one eligible overall approver, not a multi-person quorum. A later policy version may require quorum without changing historical decisions. Delegation is valid only when the policy permits it and records organisation, Package scope, granted permission, start, expiry, grantor, revocation, and audit. Conflicted actors recuse and the decision escalates. The server derives actor and authority from the authenticated context; clients never supply the effective approver identity or authority snapshot.

Numerical attendance, amount, and risk thresholds are policy data, not hard-coded application constants. Missing or unsupported governance policy fails closed for new enforcement decisions.

### Scope and coverage

Each Package records `eventId`, `scopeType`, optional `scopeId`, `coverageMode`, covered occurrence information, Plan version, Package schema version, governance policy version, validity window, and supersession link.

- A one-off Event uses Event scope and covers its initial occurrence.
- A recurring Event uses either explicit occurrence IDs or `planBoundSeriesWindow` with a recorded start/end and baseline fingerprint.
- A newly materialised occurrence inherits only when it is inside that window, uses the same accepted Plan and Series defaults, and introduces no Package-relevant exception.
- Occurrence-versioned module sources are frozen per covered occurrence. An occurrence-local change creates a persisted open scoped review and required task, invalidates an earlier Package for that occurrence, and removes only that occurrence's inherited execution authority. The Event-level baseline and unrelated occurrences remain valid; an approved occurrence-scoped Package resolves the review. Packages created before granular occurrence source references fail closed at Event scope.
- An Event-level governance-critical change invalidates every affected occurrence coverage.
- A Child Event owns its own Package. A parent Package may reference the child's status but cannot approve it.

### Canonical generation and submission

The server validates `If-Match` for the current Event Plan, reads only system-defined module contribution contracts, orders source references deterministically, canonicalises JSON, and calculates `sourceVectorHash` and `contentHash`. The Package schema, policy, Plan, source vector, scope, and content all participate in the hash contract. Before commit, every required source version is revalidated. A changed source returns `event.package.sourceChanged`; a retry with the same idempotency key and request hash returns the same result, while key reuse with different input is rejected.

A draft may be regenerated. Submission freezes the Package. Returned or rejected content is never edited in place; corrected source data produces a new Package version. Historical templates, policies, source summaries, decisions, and hashes are not rewritten.

### Package lifecycle, decisions, and conditions

Package lifecycle values are `draft`, `submitted`, `returnedForAmendment`, `rejected`, `approvedWithConditions`, `approved`, `withdrawn`, and `superseded`. `Under Review` is the user-facing label for `submitted` unless a later contract introduces a real review-claim transition. History queries are server-paged and can filter by status and exact Event/Occurrence scope without changing which Package is current.

Approval validity values are `notDecided`, `active`, `invalidated`, `expired`, and `revoked`. Only the machine-contract-approved combination of lifecycle and validity can satisfy a gate. Source-decision revocation/expiry, a governance-critical change, policy expiry, or an expired required condition recalculates validity immediately. Revocation and correction append new decisions; they never update the original decision.

Decision types are `approve`, `approveWithConditions`, `returnForAmendment`, `reject`, `revoke`, and the dedicated `conditionWaiver` exception decision. Revocation and condition waiver use separate append-only endpoints and cannot be smuggled through the ordinary decision command. Every decision binds Event, scope, Plan version, Package version, content hash, authenticated actor, authority snapshot, UTC time, and bilingual reason where a reason is required.

Condition states are `open`, `evidenceSubmitted`, `verified`, `rejected`, `expired`, and `waived`. Conditions record affected gates, bilingual text, owner role, due time, minimum evidence reference, satisfaction actor/time, verification actor/time, and a linked restricted Readiness task. Evidence submission is not verification. An overdue unresolved condition is persisted as `expired`, audited without copying evidence content, and immediately recalculates every affected gate. Waiver exists only when the immutable governing policy explicitly enables it and policy-resolved authority is independent from the condition owner and evidence actors. Condition state projects one-way into its task; completing or editing the task cannot mark the condition verified or create a decision.

### Lifecycle gates

One evaluator returns `gate`, scope, `allowed`, evaluated time, Plan/Package/policy versions, stable blockers and warnings, bilingual messages, responsible role, and next-action code. A protected, viewer-specific Package capability projection recomputes Package, lifecycle, delegation, and per-condition actions from current server authority; frontends never infer permission from display text or expose controls merely because a Package is visible.

- Publish requires an active approved current Package, verified publish conditions, current specialist decisions, approved sponsorship when required, approved public copy/assets, no publication blocker, and an authorised explicit Publish command.
- Registration requires the applicable Package gate, enabled and complete registration configuration, capacity, deadline, privacy notice and consent, current RAM/safeguarding/sponsorship decisions, and an authorised explicit Open Registration command.
- Payment or fee acceptance, whenever implemented, additionally requires the Registration gate and current Finance approval/policy. Missing payment capability remains unavailable; this contract does not add a provider.
- Execute requires an active Package and specialist decisions, verified execute conditions, critical roles/evidence, no safety blocker, and an Event Lead confirmation made within the policy-defined pre-event window for the exact scope and Package version. An Event baseline can support an unaffected covered occurrence, but an open occurrence review returns `event.execute.occurrenceReviewRequired` until an approved occurrence Package resolves it.

Before Publish, public Event lists, public projections, search/SEO metadata, sitemaps, shared caches, anonymous URLs, and usable QR codes expose nothing. Draft copy, posters, and forms remain protected previews. An old URL cannot accept a registration while the Registration gate is closed.

If an already published or registration-open Event loses approval, policy chooses from `blockNewPublication`, `withdrawPublicProjection`, `pauseRegistration`, `blockExecution`, and `requireHumanNotificationReview`. Safety-critical or unclassified governance changes fail closed. Existing enrolments and audit history are preserved. Cancellation, postponement, unpublish, registration close, and reopen are explicit authorised, idempotent, audited commands with cache invalidation.

Governance policies are immutable published versions managed through the dedicated `admin.events.managePackagePolicies` permission. Publishing a replacement retires the prior effective version, is idempotent and audited, and invalidates affected active approvals without rewriting their history. Approval validity durations come from that policy. Delegation is disabled unless the bound policy explicitly enables it for the Package tier; a delegation records organisation, Event/Occurrence scope, delegate, permission, start/end, grantor, revocation, concurrency token and audit history. The delegate must remain an approved organisation member, and delegation never bypasses submitter or specialist-author separation. During `dryRun`, lifecycle commands persist non-sensitive would-block reason codes in audit metadata; the policy workspace aggregates those observations over a bounded window before administrators choose `enforced`.

### Material change and re-approval

Change evaluation is policy-versioned and produces field-level differences, classification, affected scopes/modules/specialist decisions, Package validity impact, gate actions, Workflow responsibilities, and whether a human-reviewed participant notification is required.

- `cosmetic`: presentation-only changes that do not alter meaning; record history without overall re-approval.
- `operational`: non-governance-critical programme, staffing, or resource changes; revalidate only affected modules or occurrence scope.
- `governanceCritical`: date, venue, capacity, child involvement, transport, accommodation, money flow, visibility, sponsor identity, accountable roles, risk, emergency, or policy-triggering changes; invalidate affected approval and require re-review.

An unknown classification fails closed. Governance-critical RAM, venue, safeguarding, and transport source mutations invalidate only the applicable active Package coverage in the same unit of work, safely withdraw/pause/block bound lifecycle states, notify the accountable owner, and create a required re-review task while preserving enrolments and history. Runtime participant enrolment and child attendance records are not themselves governance source versions. Plan B, contingency decision cases, timers, fallback actors, and automated contingency activation are deferred and are not introduced by this change.

### Privacy, retention, and caching

Packages, decisions, conditions, and source references are `approvalEvidence` and `private, no-store`; role-restricted module data keeps its stricter access rules. Package manifests contain minimum summaries and immutable references, never participant lists, child/health/contact records, passenger manifests, or full financial detail. The manifest carries stable governance trigger reasons, required specialist-decision codes, seven ordered bilingual summary sections, and warnings so reviewers can understand the decision without reading mutable source data. Only approved sanitised public allow-list projections use shared caching.

Immutable audit means retaining the minimum decision chain, identifiers, versions, hashes, reason codes, and authority evidence. It does not authorise permanent retention of personal content. A condition's minimum evidence reference is `approvalEvidence`: it becomes inaccessible 90 days after the later of evidence submission or Event end; the irreversible SHA-256 hash, expiry/unavailable timestamps, actor and decision chain remain. Audit events never copy the reference content. Source modules may impose stricter expiry, deletion or anonymisation on the underlying evidence. Free-text reasons and condition evidence are length-limited and must not invite unnecessary sensitive data.

An occurrence-scoped execution confirmation is persisted on that `EventOccurrence`, bound to its Package, actor, timestamp, enforcement mode and concurrency token. Confirming one occurrence never confirms the Event or sibling occurrences; a local material change invalidates that occurrence confirmation while preserving unrelated occurrence state.

### Compatible rollout

Enforcement modes are `off`, `dryRun`, and `enforced`. Existing Events start as `legacyUnassessed`; they keep current RAM, sponsorship, visibility, and registration behaviour during `dryRun`, while the new evaluator records only non-sensitive differences. A versioned rollout policy classifies each Event as `formalPackageRequired`, `legacyReadOnlyPackage`, `timeLimitedCompatibility`, or `safetyCriticalBlocked`. No classification invents missing facts or approval. Transition deadlines, exceptions, and changes of mode are audited. Rollback changes enforcement behaviour but never deletes Package records or makes a previously invalid Package active.

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
