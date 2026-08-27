# Event Management Implementation Status

> Documentation class: **Operational**. Captured from the current worktree on 2026-08-27 at branch baseline `1fb1cc5`. This file describes repository delivery state, not timeless architecture. The target contract remains [EVENT-CONTRACT.md](EVENT-CONTRACT.md).

## Evidence rule

A business capability counts as implemented only when matching persistence, server-side authorised API, and a reachable user flow exist in the current worktree. Composition metadata, a migration-only structure, a Surface Registry entry, or a generic placeholder does not make a business module usable.

`Current` means a dedicated core flow exists, not that the complete target scope is finished. `Partial` means at least one real flow exists but the module contract is not end-to-end complete. `Target only` means only contract, shared foundation, or generic surface behaviour exists.

## Shared Event Composition foundation

The current branch contains:

- compatible `GroupEvent` persistence with `EventDataJson` retained;
- `EventSeries`, `EventOccurrence`, Session, ProgramItem, Zone, and ServiceSlot structures;
- versioned Event facts, proposals, immutable accepted snapshots, and deterministic composition;
- four fixed archetypes and sixteen versioned system-preset Activity Types;
- an authorised, audited Event-template catalogue UI and API;
- governance, sponsorship, Event roles, readiness, ETag, and idempotency foundations;
- a compile-time controlled frontend Surface Registry and role-aware Event workspace;
- the existing `EventWorkflowRun` / Step / Artifact engine as the single general workflow engine;
- server-side visibility controls and private/no-store handling for protected workspaces.

## Module status

| Status | Modules | Repository evidence summary |
| --- | --- | --- |
| Current | `TEAM.WORK` | Event team, accepted roles, tasks/dependencies/blockers, workflow artifacts, protected APIs, ETags, readiness, and reachable team UI |
| Current | `PEOPLE.REGISTRATION` | Enrollment persistence and CRUD, self/manager projections, lifecycle/RAM gates, and reachable enrollment UI |
| Current | `SERVICE.ROSTER` | Occurrence slots, availability, assignment/response/substitution, eligibility/readiness, protected APIs, and reachable roster UI |
| Current | `SAFETY.RAM` | Dedicated draft/save/submit/independent-approve flow, public visibility gate, and reachable RAM editor |
| Current | `SAFEGUARDING.CHILD` | Explicit child/guardian/consent/collector records, occurrence check-in/out, policy-backed worker evidence, minimum projections, private APIs, and reachable workspace |
| Current | `PROGRAM.PRODUCTION` | Occurrence Sessions and ProgramItems, ordering, run sheet, concurrency, protected APIs, and reachable programme UI |
| Current | `PLACE.RESOURCE` | Venue catalogue/capacity, Event/Occurrence reservations, overlap checks, release history, private APIs, and reachable resource UI |
| Current | `MOVE.STAY` | Driver/vehicle evidence, occurrence journeys and stops, restricted manifest, self projection, capacity/readiness, private APIs, and reachable travel UI |
| Partial | `COMMS.FOLLOWUP` | Bilingual Event content, public/group projections, notification foundation, Event review CRUD, workflow/artifact contribution; no complete module workspace or delivery audit |
| Target only | `MONEY.FINANCE` | Composition definition, separation-of-duty contract, classification, readiness, and generic controlled surface only |
| Target only | `FOOD.HOSPITALITY` | Composition definition, role/classification/readiness contract, and generic controlled surface only |
| Target only | `FESTIVAL.OPERATIONS` | Zone/ServiceSlot structural foundation, composition dependencies, command role contract, and generic controlled surface only |

Detailed target/current/gap notes are maintained in [modules](modules/TEAM.WORK.md).

## Generated migration sources

The branch contains these Event Composition migrations:

- `20260826072230_AddEventCompositionFoundation`
- `20260826094328_AddEventOperationsCore`
- `20260826110634_AddVenueReservationConflict`
- `20260826122442_AddTransportManifestReadiness`
- `20260826184322_AddChildConsentCheckIn`
- `20260826215739_AddEventActivityTypePlanning`
- `20260827002820_AddEventActivityTemplateCatalog`

This documentation refactor did not apply a migration or inspect any database migration history. Historical branch evidence says these migrations were generated and SQL generation was checked but no database was changed; that external application state is **not re-verified here**.

## Recently completed vertical slices present in source

- Event Composition foundation: compatible structures, facts → proposal → acceptance, Series materialisation, governance, sponsorship, role assignments, readiness, and workspace.
- Event Operations Core: first usable slices for `TEAM.WORK`, `PROGRAM.PRODUCTION`, and `SERVICE.ROSTER`.
- Venue reservation conflict: first usable `PLACE.RESOURCE` slice.
- Transport manifest readiness: first usable transport portion of `MOVE.STAY`; accommodation remains open.
- Child consent and check-in: first usable `SAFEGUARDING.CHILD` slice.
- Activity Type planning and Event-template administration: four immutable categories, sixteen presets, immutable versions, active-template resolution, and dedicated admin permission.

## Open implementation gaps

- No finance business persistence/API/UI for budgets, fees, claims, refunds, reconciliation, or close-out.
- No food/hospitality business persistence/API/UI for dietary summaries, menus, service, safety, or cleanup.
- No live festival operations flow for zone state, crowd flow, first aid, command log, weather, or evacuation.
- `COMMS.FOLLOWUP` lacks an audience snapshot, human-confirmed change broadcast, delivery state, and retention workflow.
- Registration lacks household/guest modelling, atomic capacity/waitlist promotion, tickets, and general occurrence attendance reconciliation.
- RAM lacks a general versioned policy source, explicit exception rules, expiry/re-review, and incident close-out.
- `MOVE.STAY` lacks accommodation, rooms, check-in/out, overnight duty, and provider integration.
- Current modules retain the focused gaps listed in their module documents; `Current` is not a claim of complete target delivery.

## Current verification status

Repository inspection for this documentation refactor confirmed matching domain entities, DbSets/migrations, protected controller routes, frontend routes/components, and focused tests for every module marked `Current` above. Documentation validation is performed by:

```powershell
node docs/events/scripts/generate-event-docs.mjs --check
```

The generator validates JSON parsing, exact module/archetype counts and order, uniqueness, module dependencies, archetype → Activity Type references, surface → module references, bilingual `{ en, zh }` names/labels, API method/path uniqueness, local documentation links, generated-output freshness, and three-language overview structure.

Checks run against the current source during this refactor:

- `node docs/events/scripts/generate-event-docs.mjs --check` — passed; also matched backend module, Activity Type/archetype, and Surface Registry definitions.
- `npm run test:event-composition` — 31 passed, 0 failed.
- Local browser render at 390px and desktop width — the three-language overview switched among all languages with no horizontal overflow; the long handbook validated its machine contract, opened mobile navigation, switched Traditional Chinese/English, and had no horizontal overflow.

The long-form template retains historical verification prose for presentation continuity. Those old counts are not current verification evidence and are subordinate to this file. No migration, deployment, or signed-in browser matrix is claimed by this documentation refactor.

## Historical-document inconsistencies resolved

- The old handbook's same module overview listed `SAFEGUARDING.CHILD` as both `Current` and “not yet implemented.” Current persistence, authorised APIs, a reachable React workspace, and focused tests support `Current`; the target-only occurrence is treated as a stale presentation error.
- Operational fields (`baseline`, `implementationInventory`, `migrationPhases`, and `verificationEvidence`) were embedded inside the supposedly normative JSON. They have moved here and are rejected by the JSON validator if reintroduced.
- The old handbook described its embedded JSON and its own Codex brief as authoritative. Authority now belongs to `EVENT-CONTRACT.md`, `event-contract.json`, and repository `AGENTS.md`; generated HTML is a projection.
- The old baseline pointed to `main` at `8f09dac`, while the Event Composition implementation is present on `agent/692-event-management-prototype` at `1fb1cc5`. This status reflects the current worktree rather than the historical baseline label.

## Recommended next slices

1. `PEOPLE.REGISTRATION`: atomic capacity and waitlist state transitions with participant/manager projections and notifications.
2. `SAFETY.RAM`: versioned policy evidence, expiry, change-triggered review, and exception audit.
3. `COMMS.FOLLOWUP`: human-confirmed Event change broadcasts using existing in-app notification infrastructure.
4. `MONEY.FINANCE`: minor-unit budget, expense claim, independent approval, and close-out without adding a payment provider.
