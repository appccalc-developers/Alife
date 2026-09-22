# Event implementation status

> Current repository summary, reviewed against documentation and targeted source inspection on **2026-09-16**. This documentation-only task does not rerun application tests or establish deployment/database state. Dated test results remain in [history](IMPLEMENTATION-HISTORY.md). Business authority is in [the core and its topics](EVENT-CONTRACT.md).

<a id="evidence-rule"></a>

## Evidence and version scope

### Translation and responsibility refinement — 2026-09-22

Event details and allowlisted public registration copy reuse the existing field-translation entry, retaining manual text and requiring explicit save. Role management now distinguishes platform/group/Event authority and filters Event permissions. The user confirmed owner-only formal submission; both command and capabilities require current accountable ownership and approved owning-group membership. Existing narrower Package-withdrawal and shared-venue catalogue/reservation boundaries are reflected in the machine/topic rules. Historical decisions, independent approval, private caching and default platform grants are unchanged. See the [scope, responsibility map and resolved discrepancies](EVENT-AUTHORIZATION-REVIEW-2026-09-22.md).

This publishing slice excludes concurrent editorial/header, global-navigation and virtual-church work. Verification against the isolated branch: 135 focused backend cases, six bilingual/translation unit cases, and 12 browser cases (translation, permission guide and creation-to-saved details; zh/en × 320/1280px) passed. Complete frontend TypeScript, production/PWA build, Event documentation generation/check and staged diff checks passed. The existing saved-details fixture now waits for the asynchronously loaded RAM heading before asserting its count. Build checks used the Node equivalents of the package scripts because npm was unavailable; an imported, hoisted verification-only install is not a dependency/lockfile change in this slice. No migration, real role assignment, live-provider/account test or deployment is implied. Tracking: [#812](https://github.com/appccalc-developers/Alife/issues/812).

A capability is implemented only when matching persistence, server-authorized API and a reachable user flow exist. A catalogue, migration or placeholder alone is insufficient. **Current** means a dedicated core flow, not complete target scope; **Partial** means a bounded usable portion; **Unavailable / target** means no supported operational flow.

New Events use collaboration version 1. Version 0 retains legacy interpretation until explicit adoption of version-1 reports/rules. In particular, version-0 account-seat enrollment is not the version-1 actual-person/household model. Rule-1 frozen roster Packages remain compatible until reopening/reapproval; rule 2 separates ordinary staffing from approved requirements. Historical descriptions of unavailable finance/food must not replace the current version-1 scope below.

<a id="module-status"></a>
<a id="open-implementation-gaps"></a>

## Module status and gaps

Read the affected entry, then its linked module for behavioral details. Scope and gaps are maintained here rather than in repeated module delivery summaries.

| Module | Status and supported scope | Remaining scope |
| --- | --- | --- |
| <a id="team-work"></a>[TEAM.WORK](modules/TEAM.WORK.md) | **Current**: fixed owner, accepted team/roles, enabled-module responsibilities, activities/conditions, tasks/dependencies, personal acceptance, preparation updates and independent task review | Reusable task templates, general artifact repository and external delivery |
| <a id="people-registration"></a>[PEOPLE.REGISTRATION](modules/PEOPLE.REGISTRATION.md) | **Current**: version-0 enrollment/capacity/waitlist; version-1 rules, actual participants, households/proxies/guardians, private materials, invitations/reservations and FIFO handling | Tickets, general occurrence check-in and attendance reconciliation; scope of legacy clients remains version-specific |
| <a id="service-roster"></a>[SERVICE.ROSTER](modules/SERVICE.ROSTER.md) | **Current**: candidate groups, occurrence slots, version-1 post-publication coordinator-only atomic four-date batches, personal responses/replacements, defaults and 12-week extension; version-0 owner/coordinator route remains compatible | Leave windows and separately versioned external eligibility; automatic rotation, email/device push remain outside scope |
| <a id="safety-ram"></a>[SAFETY.RAM](modules/SAFETY.RAM.md) | **Current**: versioned church policy, assessment/confirmation, independent review, source synchronization and final owner review, restricted plan context/history/printing | External venue/trail/weather/tide queries, automatic expiry, separate incident register and wider incident close-out; current question completeness is disabled while historical answers remain |
| <a id="safeguarding-child"></a>[SAFEGUARDING.CHILD](modules/SAFEGUARDING.CHILD.md) | **Current**: child/guardian/consent/collector records, worker eligibility, occurrence check-in/out and minimum-disclosure duty access; version-1 planning report | Full health integration, incident escalation, cross-Event certification lifecycle, advanced policy administration and policy-authorized re-entry |
| <a id="program-production"></a>[PROGRAM.PRODUCTION](modules/PROGRAM.PRODUCTION.md) | **Current**: occurrence sessions/items, ordering, run-sheet printing and version-1 planning report | Typed speakers/performers, content approval, rehearsal, technical cues, livestream and presentation mode |
| <a id="place-resource"></a>[PLACE.RESOURCE](modules/PLACE.RESOURCE.md) | **Current**: venue catalogue, root-church venue sharing to descendant-group Events, capacity, reservations/conflicts and independent recurring room calendars with release/restore/history | Equipment allocation, setup/close-down/handover/return and typed Session-to-Venue linking |
| <a id="move-stay"></a>[MOVE.STAY](modules/MOVE.STAY.md) | **Current transport core**: driver/vehicle evidence, journeys/stops, restricted manifests, self projection, capacity/readiness and version-1 planning report | Parking, accommodation/rooms/check-in/out, overnight duty and provider integration |
| <a id="comms-followup"></a>[COMMS.FOLLOWUP](modules/COMMS.FOLLOWUP.md) | **Partial**: bilingual content/posters, explicit publication, existing Event reviews and version-1 report adoption | Audience snapshots, reviewed change broadcasts, delivery state, purpose-controlled newcomer/prayer and incident follow-up, retention; adopting a report sends nothing |
| <a id="money-finance"></a>[MONEY.FINANCE](modules/MONEY.FINANCE.md) | **Partial, version 1**: independently approved registration-fee rules, manual receipts/refunds and private audit/evidence | Provider payments, budgets, purchasing, claims, ledger reconciliation and wider financial close-out |
| <a id="food-hospitality"></a>[FOOD.HOSPITALITY](modules/FOOD.HOSPITALITY.md) | **Partial, version 1**: accepted lead and bilingual report draft/submission/return/immutable adoption | Operational menus/headcounts, dietary/allergy records, purchasing, kitchen/safety/vendor/serving/cleanup tools |
| <a id="festival-operations"></a>[FESTIVAL.OPERATIONS](modules/FESTIVAL.OPERATIONS.md) | **Unavailable / target**: structural definitions only; cannot be enabled in version 1 | Live zones/stalls/crowd flow, first aid/lost child, command log, weather/evacuation and escalation |

## Cross-module delivery and evidence

- **Composition / Package:** immutable Plan and Package snapshots, role/policy-aware decisions/conditions, explicit lifecycle gates, occurrence exceptions, reopening, delegated approval and policy administration. Current contracts: [composition](EVENT-COMPOSITION.md), [Package](EVENT-PACKAGE-APPROVAL.md), [preparation](EVENT-SETUP-FLOW.md). Source: [Package service](../../backend/src/Alife.Application/Events/Services/EventPackageService.cs), [gate evaluator](../../backend/src/Alife.Application/Events/Services/EventPackageGateEvaluator.cs). Tests: [Package foundation](../../backend/tests/Alife.Tests.Unit/Events/EventPackageFoundationTests.cs).
- **Collaboration:** persistent personal Event work, stage/occurrence tasks, module reports, registration work and calendars. Source: [work service](../../backend/src/Alife.Application/Events/Services/EventWorkService.cs), [report service](../../backend/src/Alife.Application/Events/Services/EventModuleReportService.cs), [registration service](../../backend/src/Alife.Application/Events/Services/EventRegistrationWorkService.cs), [manual fee service](../../backend/src/Alife.Application/Events/Services/EventRegistrationWorkService.Fees.cs). Tests: [collaboration](../../backend/tests/Alife.Tests.Unit/Events/EventCollaborationTests.cs), [opt-in SQL](../../backend/tests/Alife.Tests.Unit/Events/EventCollaborationSqlTests.cs). [2026-09-14 evidence](IMPLEMENTATION-HISTORY.md#2026-09-14--role-and-stage-collaboration-workspaces) records the actual historical runs and limitations.
- **Roster:** [batch service](../../backend/src/Alife.Application/Events/Services/EventOperationsService.RosterBatch.cs) and [rule tests](../../backend/tests/Alife.Tests.Unit/Events/EventPreparationRosterRulesTests.cs).
- **RAM:** [synchronization service](../../backend/src/Alife.Application/Events/Services/EventRamSyncService.cs) and [Package synchronization tests](../../backend/tests/Alife.Tests.Unit/Events/EventRamSyncPackageTests.cs). [2026-09-15 source/synchronization evidence](IMPLEMENTATION-HISTORY.md#2026-09-15--ram-background-synchronization-and-final-owner-review) remains dated evidence.
- **PWA and assistance:** nonlinear preparation overview/details pilot, compact responsibilities and shared details/task/registration form assistance. [2026-09-15 assistant evidence](IMPLEMENTATION-HISTORY.md#2026-09-15--shared-details-task-and-registration-form-assistants) records historical fixture/build results. The visual guidance is not a claim of full Workspace rollout; the task-form AI exception is scoped by [its assistant contract](AI-DETAILS-ASSISTANT.md#tasks-and-registration-form-assistants).

<a id="generated-migration-sources"></a>
<a id="current-verification-status"></a>

## Migrations, release and verification limits

Migration source files, historical SQL/rehearsal results and environment limitations are preserved in [history](IMPLEMENTATION-HISTORY.md). Creation of a migration is not proof it was applied. The 2026-09-14 collaboration record documents disposable SQL checks and explicitly excludes shared migration/deployment. Older dedicated-development rehearsals remain dated to their original database and cannot establish today's database state. Subsequent RAM/activity/task migrations likewise require environment-specific verification before release.

Browser/API/speech/provider fixtures do not establish live multi-account behavior, microphone accuracy, Gemini semantics, private provider uploads or deployed timers. Live church-account acceptance, deployment and shared database work remain separate authorized operations. Provider payments, Plan B and a fifth Review/Reflection stage are not introduced.

For documentation-only changes, use the [documentation checks](AGENTS.md#proportional-verification). Application testing is selected by the next code change; do not rerun all application suites merely to rewrite a status summary. New results must name their actual scope and environment rather than copying historical counts.
