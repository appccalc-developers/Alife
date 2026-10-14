# Event composition and structure

> Normative topic delegated by [the core contract](EVENT-CONTRACT.md). Owns facts, composition, structure and template semantics. Exact definitions and wire values remain in [event-contract.json](event-contract.json). Read only the affected section; delivery evidence is in [current status](IMPLEMENTATION-STATUS.md).

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

For the same confirmed facts, definition versions, server-derived preparation phase and valid human selections, composition produces the same proposal and `proposalHash`. Compose and recompose never mutate stored Event state. On acceptance the server recomputes, validates the proposal hash and `If-Match`, applies idempotency, and writes a new immutable snapshot.

Saved, unfrozen Events with `publicationStatus = draft` allow explicit Yes/No choices for every preparation tool, including TEAM.WORK, PEOPLE.REGISTRATION, SERVICE.ROSTER, SAFETY.RAM and SAFEGUARDING.CHILD. In this phase, an explicit No takes precedence over activation/default/dependency choices for the enabled tool list. It never changes confirmed facts, ownership or permissions. Formal Package submission and approval revalidate mandatory activation and dependency closure; disabled required tools appear as bilingual manifest blockers. Existing creation composition and non-draft retirement rules remain unchanged. See [the preparation flow](EVENT-SETUP-FLOW.md).

A module with operational data, money, files, roles, submissions, or approvals cannot disappear silently. Its removal enters a blocking retirement workflow with preservation, cancellation, or transfer decisions and explicit human confirmation. Explicitly disabling a tool in saved draft preparation only changes the new Plan's enabled tools: all underlying records and prior snapshots remain, and re-enabling restores access through the existing authorised tools. This is not operational data retirement.

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

The ownership, visibility, governance, registration, and Event Plan boundary. Event 2.0 continues to map this concept to the existing `GroupEvent` persistence root. Each Event has exactly one owning group, one accountable owner, and at least one occurrence.

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

The historical `Activity Type` contract names Event templates, not the concrete projects in an Event. These templates are immutable, versioned records inside one fixed archetype. The catalogue began with sixteen system presets at version 2; reviewed project presets and the questionnaire were introduced in later immutable versions. Event 2.0 creates a new current version from each administrator-owned current definition without rewriting its history. Authorised system administrators may create, edit, deactivate, or reactivate templates within the four categories. A template's code and archetype never change after creation; every edit creates an audited next version.

Only a current active 2.0-capable version may be used for a new creation operation. Deactivation fails closed for new composition. Saved Event recomposition uses its accepted version and actual Activity Plan. Templates never confirm child, RAM, transport, money, venue, or capacity facts. `MONEY.FINANCE` comes from an applicable project-fee answer or confirmed Event money fact, never direct template preselection. Historical template and policy versions remain read-only and do not participate in current calculation.

Retired workflow-recommendation fields may remain in immutable historical template bodies, but Event 2.0 creation and composition reject them as current inputs and new templates persist no recommendation.

### Concrete projects, answers and module demand

Each current template version may hold an ordered list of editable bilingual preset projects. A project has its own template-local preset key, name, conditions, seven independent attributes, fixed-question default answers, occurrence repetition hint and optional configuration defaults. Version-4 presets may also carry `eventFactSuggestions` using only the three moved Event fact codes when a previous version-3 project default was `yes`; these are pending organiser suggestions, never confirmed facts or direct module triggers. Defaults may suggest eligibility, capacity, waitlist, fee and terms; they are not actual Event policy, a room reservation, a payment approval or a safety fact. Creation copies selected presets to independent string project IDs. The organiser may edit, duplicate, reorder or remove the copies and must explicitly confirm every retained preset and every selected template switch before creation. Switching templates asks before replacing only preset-derived projects; manually added projects remain. Existing Events and their accepted Plan versions do not follow later template edits.

A new schema `2.0.0` creation proposal pins the reviewed template using `activityTypeVersion`. When that template has preset projects, the version is required and must equal its current 2.0-capable version; an outdated version returns HTTP 412 so the organiser reloads and reviews it. Every preset key must appear exactly once, either on a retained project from that version or in explicit `removedPresetKeys`. Unknown, duplicate, overlapping or missing keys fail validation; removal is not silently inferred. The sorted removal list enters the proposal hash and creation audit. Saved Event recomposition reads its own saved Activity Plan and accepted version; publishing a later compatible template version does not invalidate that Event or block its recompose.

The fixed question directory and answer codes belong to the system. In schema `2.0.0`, required `questionnaireVersion: 2` identifies eight project-wide yes/no arrangement switches (`projectSelection`, `ageEligibility`, `capacityLimit`, `projectFee`, `minorsParticipate`, `spaceReservation`, `serviceTeam`, `programmeProduction`) and eight specialist questions filtered by the selected attributes. An unchecked switch immediately writes a human `no`; a checked switch writes `yes`. The switches are independent: selection is not implied by age, capacity, fee, minors, space, roster or programme arrangements. A project policy and draft occurrence offer may be saved while selection is off. Attribute selection does not infer another attribute, Event template, module answer or Event-level fact. Specialist answers retain `yes`, `no` and `unknown` with template/human provenance and confirmation. Removing an attribute makes its specialist answers inactive in the current calculation without erasing Event 2.0 audit history. Missing questionnaire version is invalid; no Event 1.x draft conversion runs at runtime. Template-preselected `yes` switches still require explicit organiser confirmation.

Overall risk review, participant notices/follow-up and multi-zone operations are Event-level tri-state facts `safety.requiresRam`, `comms.followupRequired` and `scale.multiZone`, edited once in Event Details. They are not project answers. Formal confirmation requires human-sourced `certainty=confirmed` with a boolean value. Current project `yes` answers and confirmed Event facts combine by union, so another project's `no` cannot cancel a required module. Dependencies and mandatory safety policy still apply. `scale.multiZone=yes` retains FESTIVAL.OPERATIONS demand and blocks formal submission while the module is unavailable. Event 1.x answer-promotion and historical-hash branches are not part of the 2.0 runtime.

An Event can be created and saved in preparation while specialist project answers or Event-level facts remain unknown. For schema `2.0.0`, formal Package submission requires the three Event-level facts to be human-confirmed true/false, each currently applicable specialist project question to be human-confirmed `yes` or `no`, and each template-origin project's review and selected default `yes` switches to be human-confirmed. The eight common project switches already have explicit yes/no values. Missing, unknown or unconfirmed applicable answers produce visible blockers; a saved draft or a default from a template is not formal confirmation. The server rejects a switch-off only when its own effective setting or record still requires that arrangement; a saved project policy or draft offer alone does not require `projectSelection=yes`. Closing `projectFee` conflicts with active charged participation or net-unrefunded historical project payments even if the current policy fee is zero. Conflicts remain visible and never silently erase operational module demand.

There is one module responsibility, report and approval per Event. Project/occurrence policy, selections and typed arrangements refer to the stable project ID and may have separate records for different meals, journeys, stays, spaces or participant rules. A project answer alone does not publish an offer, book a venue, enrol a person or create a specialist approval. Operational rules are in the owning [registration](modules/PEOPLE.REGISTRATION.md#project-selection-and-eligibility), [finance](modules/MONEY.FINANCE.md#manual-registration-fees), [safeguarding](modules/SAFEGUARDING.CHILD.md#operational-behavior) and [space](modules/PLACE.RESOURCE.md#independent-venues-and-rooms) modules.

Once any person has participated in or selected a project, keep that project in the Event Activity Plan, including after cancellation. Its policy, offer, payment and consent history refer to its stable string ID; removing the source project would lose the bilingual name and conditions needed to understand that history. The organiser cancels its offer, sends the applicable notice and settles fees/refunds, then creates a new project for a different occurrence or rules. An Activity Plan edit cannot delete or rebind the historical project directly. The current plan is stored as a one-to-optional-one Event header with ordered project rows, fixed attribute rows, question-answer rows and optional typed template hints. Operational policy, offer and module-configuration rows, plus optional task links, reference the composite Event/project key with restricted deletion; the API still exchanges the same `ActivityPlanData` shape. Historical Plan, RAM, Package and audit snapshots remain immutable JSON. The schema-only cutover has no old-plan backfill and stops before removing the former JSON column if Event instance data exists.

## Capability modules

The system owns these twelve capability codes:

| Module | Target responsibility |
| --- | --- |
| [TEAM.WORK](modules/TEAM.WORK.md) | Enabled-module responsibilities, collaborator invitations, custom task delegation, bilingual preparation, blockers and hand-offs; organizers have continuing responsibility |
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
- retained template metadata `WorkflowContributions` (historical template read only; 2.0 Plans emit an empty list)
- `DataClassification`
- `ReadinessRules`
- `Version`

Modules are designed, security-reviewed, and tested product capabilities. Churches and AI cannot add arbitrary module codes, component paths, permissions, or executable integrations. Unknown module codes and surface keys fail closed.

## Normative acceptance scenarios

Implementations must cover at least:

- a simple meal that stays light while unknown safety or finance facts remain visible for confirmation;
- a remote hike requiring RAM and transport readiness evidence;
- a child camp with role-restricted safeguarding data and versioned policy inputs;
- a schema-2.0 generic project with eight unchecked common switches, plus meal/outdoor and water/outdoor projects whose applicable specialist questions and RAM checks follow the selected attributes;
- several projects whose affirmative needs union with three Event-level decisions, including multi-zone unavailability and a conflicting attempt to close a switch backed by active project records;
- a recurring fellowship with a 12-week window and occurrence-local exceptions;
- a public festival whose public projection waits for root-church sponsorship and all readiness gates;
- cross-viewer cache isolation for anonymous, church, team, restricted, and self projections;
- venue reservation capacity, overlap, release history, concurrency, and private caching;
- transport manifest capacity, restricted visibility, personal projection, RAM evidence, and concurrency;
- child consent, collector authority, minimum-disclosure duty projection, check-in/out state, and append-only audit;
- template administration with fixed categories, immutable codes, versioning, dedicated permission, ETags, audit, and historical readability.

The exact scenario assertions are in [event-contract.json](event-contract.json).
