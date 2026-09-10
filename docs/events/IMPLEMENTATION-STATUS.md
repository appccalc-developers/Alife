# Event Management Implementation Status

> Documentation class: **Operational**. Captured from the current worktree on 2026-09-02 at branch baseline `eb1a4b9`. This file describes repository delivery state, not timeless architecture. The target contract remains [EVENT-CONTRACT.md](EVENT-CONTRACT.md).

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

## Event creation workspace

The creation flow now uses four steps: **Template → Details → Arrangements → Review** (`选择模板 → 活动资料 → 活动安排 → 确认创建`). Categories and their active templates share one compact selection screen; selection stays on that screen until the user continues. Bilingual copy, dates, visibility, registration and capacity are entered together. Weekly recurrence supports intervals of 1–52 weeks and retains its existing 12-week window. All creation dates use the visible event time zone.

Arrangements group factual questions with the server-composed management tools and readable reasons. Template defaults, explicit user overrides and confirmed/candidate/unknown facts remain separate. Only actual tool overrides are sent as `humanSelections`; required server decisions cannot be disabled. Optional tools live in an expandable adjustment area, preparation checklists are optional, and role presets appear only when the current proposal includes rosters. Finance, hospitality and festival operations are labelled as planning support rather than complete operational tools.

Template changes preserve entered copy, facts and explicit overrides; untouched defaults follow the new template. Composition previews debounce changes by 400ms, discard outdated responses and block review while loading, stale or failed. Copy-only edits do not refetch composition. Entering review validates details and recomposes; creation requires the exact reviewed input and explicit human submission. Duplicate requests are guarded and retries reuse an idempotency key only for identical input, including the proposal hash. Creation does not publish an Event.

New local drafts use format version 3 (version 2 fields are preserved with unconfirmed sources and interval 1) and keys scoped to both member and owning group. Earlier unscoped legacy drafts are not read or migrated. The existing independent poster workspace remains in the Event edit flow, including upload, generation, preview and explicit adoption; it is not part of creation. The original four-step UI slice did not change APIs, database schema, approval policy or shared-cache contracts; the subsequent details-assistant API is documented below.

Verification for this slice (2026-09-10): `npm run test:event-composition` passes 44 tests, including draft/override/candidate semantics, stale-request sequencing, duplicate-submission/retry handling and the retained poster edit entry. `dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Release --no-restore --filter FullyQualifiedName~EventCompositionArchitectureTests` passes 26 tests. Release output was used because the running local API locks Debug assemblies. `npm run build` passes TypeScript and the Vite/PWA production build; existing NuGet package-pruning and `idb-keyval` mixed-import warnings remain.

Signed-in local browser checks exercised category/template selection without automatic navigation, draft recovery, bilingual language switching, preserving edited copy and visibility through a recurring-template switch, server-required hospitality locking, and entering/leaving final review. English/Chinese layout samples were inspected at 320px, 768px and 1280px; the new screens use the configured `md`/`desktop` breakpoints instead of the previously undefined `tablet` variant. No Event was submitted or published during browser checks. Live AI/poster generation, creation persistence and navigation after a successful create, and injected network/conflict failures were not exercised end-to-end. Documentation generation and `--check` pass, including the three-language overview structure validation.

## Conversational event details assistant

The creation details step now uses the isolated [v1 details assistant contract](AI-DETAILS-ASSISTANT.md). Every turn sends the latest form and presentation provenance; evidence-backed fields update the draft while missing, conflicting and ambiguous details remain questions. It returns a bilingual reply and AI sufficiency assessment, separately from deterministic conditional field completion. Defaults require user confirmation to count. It does not generate RAM or alter composition facts. All event/enrollment/review sessions share policy 1.0.0 with separate scenario definitions; legacy response contracts remain unchanged.

The form now exposes the event time zone for one-off events and a 1–52-week series interval. UTC serialization uses the selected IANA zone and rejects DST gaps/folds. The 12-week rolling window and explicit final human creation remain. Local v2 drafts migrate to v3 without discarding entered details. No database migration or new Durable Object binding is required.

Verification (2026-09-11): the Worker build and 119 Worker tests pass; the frontend production build and 54 event-composition tests pass; 27 focused backend tests pass, including fortnightly Auckland materialization across DST. Documentation generation and `--check` pass with three equivalent overview structures. Standalone Worker `tsc --noEmit` remains blocked by five existing FormData/File typing errors, reproduced from HEAD in an isolated baseline (the pre-existing recursive-return annotation was corrected in the touched session class).

Browser checks used the real details components with a local mocked AI endpoint: Chinese/English, two-turn clarification and date/interval adoption, default confirmation, and retaining the form/input after a simulated 502. Layout samples were inspected at 320px, 768px and 1280px. The 320px standalone harness inherits the existing global minimum body width and a desktop scrollbar; full application-shell mobile verification remains outstanding. No live Gemini call, signed-in full-stack creation, production persistence or deployment was performed.


## Event Package Approval status

**Usable M0–M4 approval backbone implemented in the current source; operational rollout verification remains.** The normative human and machine contracts describe an immutable, version-bound Event Package, explicit Event/occurrence coverage, three governance tiers, independent decisions and conditions, material-change invalidation, lifecycle gates, privacy-minimised module contributions, and compatible `off` / `dryRun` / `enforced` rollout. The detailed Chinese [execution goal](EVENT-PACKAGE-APPROVAL-EXECUTION-GOAL.zh-CN.md) is a non-normative delivery brief and explicitly excludes Plan B.

M1 adds Event Package, source-reference, and versioned governance-policy persistence; a reversible migration; canonical JSON/hash generation; a serializable double-read consistency boundary; immutable version history; Event/Occurrence/Series-window/Child Event scope; legacy transition classification; owner/leader generation and Event-team read authorisation; and `private, no-store` generate/list/current/detail APIs.

M2 adds append-only decision and structured-condition persistence; submit/withdraw/approve/approve-with-conditions/return/reject/revoke commands; condition evidence submission, independent verification, policy-controlled waiver and persisted expiry; condition-linked restricted Readiness tasks with one-way state projection; tier-resolved server authority with standard/enhanced submitter separation and enhanced specialist-author separation; bilingual reasons and notifications; ETag, idempotency and audit records; and an exact actor-capability projection used by the UI.

M3 uses one evaluator for explicit Publish/Unpublish, Registration open/close, Payment and Execute gates. Both enrollment command paths enforce Registration state; payment is deliberately fail-closed/unavailable without adding a provider; and execution confirmation is Package/scope-bound and limited by the policy-defined pre-event window. Structured gate results expose stable reason codes, bilingual explanations, responsible roles and next actions. Public and signed-in group lists revalidate lifecycle authority after cache reads. Accepted Plan, Event core, role, task, programme, roster, RAM, venue, travel and safeguarding mutations invoke Package invalidation hooks according to their authoritative source. History and enrollments are preserved while bound publication, registration and execution states safely converge. Presentation-only Event content is excluded from the governance source hash.

Recurring Events now freeze occurrence-versioned programme, roster, venue and travel source references. An occurrence-bound venue change records a persistent scoped review in the occurrence, creates an accountable-owner task and audit/notification, invalidates the old occurrence Package, and leaves the series baseline and unrelated occurrences active. An approved replacement occurrence Package resolves the review and its task. Occurrence execution confirmation is persisted independently instead of changing Event-wide execution state. Exact scope filtering, history pagination/sort/status filters and occurrence lifecycle queries are reachable in the bilingual Package workspace.

Package manifests now include stable trigger reasons, required specialist decisions, warnings and seven ordered bilingual summary sections rendered with section navigation. Condition evidence references become inaccessible after the 90-day post-Event retention boundary while preserving only their irreversible hash and audit timestamps; audit entries never copy the reference content.

The remaining verification work is operational rollout/backfill evidence, broader public-URL/SEO/cache and role-matrix regression coverage, and signed-in browser verification at target breakpoints. A real payment boundary remains intentionally unavailable and is outside this target unless separately authorised. The existing `EventApprovalDecision` flow still records official sponsorship decisions only and is not reused as Package Approval authority.

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
- `20260902081531_AddEventPackageApprovalFoundation`
- `20260902085209_AddEventPackageDecisionAndPublishGate`
- `20260902091325_AddEventRegistrationGate`
- `20260902091903_AddEventExecutionGate`
- `20260902094710_AddEventPackageApprovalDelegation`
- `20260902105449_AddEventPackageConditionReadinessTask`
- `20260902115816_AddEventOccurrenceExecutionAndEvidenceRetention`

On 2026-09-03 the seven Event Package migrations were applied to the configured dedicated Azure development database, rolled back together to `20260830122558_NormalizePageImageUrls`, and then reapplied successfully. The database was initially behind by eleven prerequisite migrations; those prerequisites were applied once before the isolated seven-migration rollback rehearsal. The DbMigrator then completed against the restored current schema. No production database or application deployment was involved.

## Recently completed vertical slices present in source

- Event Composition foundation: compatible structures, facts → proposal → acceptance, Series materialisation, governance, sponsorship, role assignments, readiness, and workspace.
- Event Operations Core: first usable slices for `TEAM.WORK`, `PROGRAM.PRODUCTION`, and `SERVICE.ROSTER`.
- Venue reservation conflict: first usable `PLACE.RESOURCE` slice.
- Transport manifest readiness: first usable transport portion of `MOVE.STAY`; accommodation remains open.
- Child consent and check-in: first usable `SAFEGUARDING.CHILD` slice.
- Activity Type planning and Event-template administration: four immutable categories, sixteen presets, immutable versions, active-template resolution, and dedicated admin permission.
- Event Package M2 first usable slice: immutable source-derived snapshots, formal submit/decision history, tier/separation authorization, explicit publication state, enforced Publish gate, cache invalidation, and bilingual workspace controls.

## Open implementation gaps

- Event Package Approval still needs expanded URL/SEO/cache and platform-emergency role regression tests plus signed-in browser/end-to-end verification. Payment remains explicitly unavailable rather than silently bypassed.
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

Checks run against the current source during the Event Package Approval contract slice:

- `node docs/events/scripts/generate-event-docs.mjs` — passed and regenerated the three-language overview and long handbook from authoritative sources.
- `node docs/events/scripts/generate-event-docs.mjs --check` — passed; also matched backend module, Activity Type/archetype, and Surface Registry definitions and validated the Event Package contract additions.
- Direct Node execution of the seven Event Composition frontend suites plus the application-dialog guard — 35 passed, 0 failed. The tests cover controlled surfaces, the top-level Governance tab, seven-section Package navigation, scoped history, formal confirmation modals, mutation concurrency headers, operations state, venue, travel, safeguarding, template administration and the ban on blocking browser dialogs.
- `node --test cloudflare/speed-layer/index.test.mjs` — 103 passed, 0 failed, including anonymous/member Event-cache separation, public upcoming Event caching, user-specific enrollment bypass, event-mutation eviction and conditional revalidation behavior.
- `dotnet restore backend/Alife.sln` followed by `dotnet build backend/Alife.sln --no-restore` — passed with 0 errors; two existing `NU1510` package-pruning warnings remain.
- `dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj --no-restore --filter FullyQualifiedName~Alife.Tests.Unit.Events` — 107 passed, 0 failed, including eleven Event Package foundation/decision/Publish-gate tests.
- `dotnet test backend/Alife.sln --no-restore` — 507 passed, 0 failed against the current source after the condition-retention, seven-section manifest, top-level Governance surface and occurrence-local execution changes. The focused `EventPackageFoundationTests` run passes 31/31.
- EF generated `20260902081531_AddEventPackageApprovalFoundation`; forward and reverse SQL generation both passed. Inspection confirmed only the three intended Package/policy/source tables, scope checks, foreign keys, and filtered uniqueness indexes.
- EF generated `20260902085209_AddEventPackageDecisionAndPublishGate`; forward and reverse SQL generation both passed. Inspection confirmed the intended decision/condition tables plus backward-compatible `legacyImplicit` publication fields and restrictive foreign keys.
- EF generated `20260902091325_AddEventRegistrationGate` and `20260902091903_AddEventExecutionGate`; forward and combined reverse SQL generation passed. Inspection confirmed six lifecycle fields per gate, sequential concurrency-token defaults, indexes, and restrictive Package/Member foreign keys.
- EF generated `20260902094710_AddEventPackageApprovalDelegation`; forward and reverse SQL generation passed after rebuilding the migration assembly. Inspection confirmed the scoped delegation check constraint, four restrictive foreign keys, bounded text fields, concurrency token and authority/expiry lookup indexes.
- EF generated `20260902105449_AddEventPackageConditionReadinessTask`; inspection confirms the nullable restrictive FK and filtered unique index linking one authoritative condition to one restricted task. It has not been applied to a database.
- EF generated `20260902115816_AddEventOccurrenceExecutionAndEvidenceRetention`; forward/reverse/idempotent SQL generation passed. Inspection confirms occurrence-local execution columns, sequential concurrency token, restrictive Package/Member foreign keys and evidence hash/expiry/unavailable fields. `dotnet ef migrations has-pending-model-changes` reports no pending model changes.
- Dedicated Azure development database rehearsal — passed: all pending prerequisites and the seven Package migrations applied; the seven Package migrations then reverted in reverse order to `20260830122558_NormalizePageImageUrls` and reapplied in forward order. DbMigrator completed afterward with the current schema and seed path.
- Dedicated Azure development legacy rehearsal — passed: a fixed legacy Event/Plan cohort generated a real Package through `IEventPackageService`, and the persisted `dryRun` policy resolved to `timeLimitedCompatibility`. A fixed Demo Leader account and a three-occurrence complex Event with registration, children, transport, venue, programme, roster and RAM modules remain available for signed-in browser acceptance.
- Current forward SQL from the pre-Package baseline through the latest Package migration, reverse SQL for the latest migration, and an idempotent Package migration script were regenerated successfully and inspected during final verification. Migration listing could not query the configured SQL Server, so applied/pending database state remains intentionally unverified and no database was changed.
- Frontend `tsc -p cloudflare/alife-app/tsconfig.json --noEmit` — passed against the current source, including the scoped Package workspace, structured gate cards, history controls and confirmation flow. The composite `tsc -b` check still stops on pre-existing TanStack collection declaration incompatibilities and downstream `unknown` projections outside the Event Package files; the independent Vite production build below was run successfully.
- Direct `vite build` — passed after 3,245 modules transformed and generated the PWA service worker. Existing bundle-size and mixed static/dynamic `idb-keyval` warnings remain; no deployment was performed.
- `git diff --check -- docs/events` — passed with line-ending notices only and no whitespace error.

The long-form template retains historical verification prose for presentation continuity. Those old counts are not current verification evidence and are subordinate to this file. A local production preview loaded successfully in the in-app browser, but the available session stopped at onboarding without an authenticated API/test Event, so the signed-in Governance workflow and its 320px/tablet/desktop matrix remain explicitly unverified. The development-database rehearsal above is complete; no application deployment is claimed.

## Historical-document inconsistencies resolved

- The old handbook's same module overview listed `SAFEGUARDING.CHILD` as both `Current` and “not yet implemented.” Current persistence, authorised APIs, a reachable React workspace, and focused tests support `Current`; the target-only occurrence is treated as a stale presentation error.
- Operational fields (`baseline`, `implementationInventory`, `migrationPhases`, and `verificationEvidence`) were embedded inside the supposedly normative JSON. They have moved here and are rejected by the JSON validator if reintroduced.
- The old handbook described its embedded JSON and its own Codex brief as authoritative. Authority now belongs to `EVENT-CONTRACT.md`, `event-contract.json`, and repository `AGENTS.md`; generated HTML is a projection.
- The old baseline pointed to `main` at `8f09dac`, while the Event Composition implementation is present on `agent/692-event-management-prototype` at `1fb1cc5`. This status reflects the current worktree rather than the historical baseline label.

## Recommended next slices

1. Run and document the legacy dry-run cohort exercise, enforced transition and rollback-read path without applying migrations to a shared database.
2. Expand automated bypass tests across anonymous URLs, signed-in group lists, enrollment routes, shared-cache revalidation, and exact role/delegation negative cases.
3. Complete signed-in browser verification in English and Chinese at 320px, tablet and desktop widths, including occurrence switching, conflict/retry, condition and history controls.
4. Verify the condition evidence retention boundary with a disposable evidence record in the development database and review any jurisdiction-specific change to the default 90-day policy before production rollout.
5. Resume the existing module roadmap after the approval backbone is hardened: registration capacity/waitlist, versioned RAM evidence, audited communication delivery, then finance core.


## Governance policy editor (2026-09-10 local worktree)

The global policy administration page now uses bilingual business fields, a version dropdown, read-only history, restoration into a new publication, server-owned initialization defaults and an explicit impact-review dialog. It exposes only supported controls, labels software recommendations separately from the SOP draft, and retains group overrides. Publication uses the existing permission and idempotency contract with serializable transaction protection, optional expected-current/impact preconditions and source-version audit metadata. No migration or actual policy publication was performed.

Verification: 50 Event Composition frontend tests and 47 policy/Foundation backend tests passed; TypeScript and production build passed. The isolated Playwright scenario covers Chinese/English at 320, 768 and 1280 pixels, initial load failure/retry/loading, no automatic publication, preview failure/retry, modal keyboard focus, stable publication retry keys, read-only history, unsaved-change confirmation and restore lineage. Browser APIs are fixtures: this does not establish live database publication or multi-connection SQL concurrency. Production build retains the existing idb-keyval chunk warning; backend build retains NU1510 dependency warnings.

See [policy editor verification](POLICY-EDITOR-VERIFICATION.md) for commands, constraints and administrator initialization steps. The creation wizard and independent poster workspace were not changed by this policy-editor slice.


### Approval decision tabs

The policy form presents one shared tier editor in descending decision order: **If enhanced → Else if standard → Else light**. Enhanced is selected initially; each tier retains independent draft values when tabs change. Light is the unconditional fallback and has no trigger-option table, while its approver count and validity remain available. Historical policies permit tab navigation with all policy fields read-only. Tabs support arrows/Home/End and remain on one horizontally scrollable row on mobile. This is a presentation change; server highest-tier matching and stored policy payloads are unchanged.
