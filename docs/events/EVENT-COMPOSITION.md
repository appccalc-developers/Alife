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

Legacy workflow-recommendation fields remain readable in stored Activity Types and Plan snapshots, but new composition ignores them and new templates persist no recommendation.

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
- legacy `WorkflowContributions` (read-only compatibility; new Plans emit an empty list)
- `DataClassification`
- `ReadinessRules`
- `Version`

Modules are designed, security-reviewed, and tested product capabilities. Churches and AI cannot add arbitrary module codes, component paths, permissions, or executable integrations. Unknown module codes and surface keys fail closed.

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
