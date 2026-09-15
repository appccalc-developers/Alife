# Event implementation history

> Historical evidence, not current capability or current verification. Read only the relevant dated entry. The following snapshot preserves the former status document in full, including superseded statements; use [current status](IMPLEMENTATION-STATUS.md) for current delivery. Test results below belong to their recorded worktree/date and have not been rerun by this documentation task.

## Snapshot retained on 2026-09-16

# Event Management Implementation Status

## 2026-09-15 — Shared details, task and registration form assistants

Tracked in [Issue #792](https://github.com/appccalc-developers/Alife/issues/792).

Implemented locally: Event details, the current new-task form and preparation's Registration rules and procedures share conversation, speech, error/retry, completion, pending-field focus and update feedback. Desktop columns stretch together; only the conversation consumes spare height and scrolls. Event details ends at Visibility and registration, including bilingual disclosure changes. Send is left and Voice input right below the text box; the redundant form-return link is removed. Narrow screens retain form/assistant tabs. Module, collapse and language changes retain input/conversation; hiding the assistant stops speech. Registration bilingual fields, including requirement labels, payment instructions and refund terms, now use current-language-first disclosure with Added/Missing markers. Unrelated venue-editor fields retain their existing presentation.

The new stateless `POST /api/events/form-assistance` uses the existing Gemini configuration, strict task/registration field allowlists, bounded messages/history, local form time zone and draft revision. Backend team/registration authority is checked on every request, including preparation freeze when a task's stage changes. Responses are private/no-store and vary by Cookie/Authorization. Backend member, participant, material and approval records are excluded from model context; manual person/group/occurrence selections also stay local. Invalid or stale replies preserve the draft and input. Material IDs, including historical non-GUID IDs, survive edits; translation-only updates preserve existing text, order, type and limits. Empty or incomplete replies are rejected. AI adoption only changes the draft; Add task and Save registration plan remain explicit commits with existing server validation. No dependency, schema migration or new AI provider was introduced.

Verification: 84 frontend Event unit tests and 12 focused tests against the rebuilt Worker pass. English/Chinese fixtures pass at 320/768/1280px for new and saved details plus both module assistants; final desktop regressions cover natural sizing, disclosure and AI updates. Voice/chat fixtures cover recognition failure, cleanup and retained input. Module fixtures cover scoped adoption, manual saves, bilingual fee/material fields, stale/retry behavior, language/module continuity, read-only forms and hidden speech. TypeScript/Vite/PWA production build and Wrangler dry-run build pass. The pre-existing idb-keyval mixed-import warning remains. Desktop/mobile screenshots were inspected. Event documentation generation/check validates 12 modules, 175 API contracts and equivalent three-language overview structures.

Limits: browser APIs, speech and provider replies are fixtures. Live Gemini semantics, real microphone recognition and production persistence/deployment were not exercised. No deployment or database migration was performed.


## 2026-09-15 — Upstream activity plans and compact RAM review

Issue #790 / Draft PR #791 now includes an owner-only activity-plan record/API in TEAM.WORK, separate from preparation tasks, with optional task activity links and atomic creation drafts. Exact ETags, Event locking, current membership/ownership, same-Event occurrences and preparation freeze protect writes. RAM uses authoritative source mirrors and adopted MOVE.STAY reports; legacy real activities require explicit adoption. Source changes invalidate RAM and Package context, while removed activities retain linked risks (including untouched AI risks) for reassignment.

AI uses request-local real activity keys/types plus aggregate signals and cannot create activities, ratings, confirmations or approvals. Manual recalculation permits fresh inputs, warns about signature invalidation, rejects an active job, and retains human edits/failures. RAM has compact activity/risk disclosures, numeric initial/residual scores, immediate policy-matrix previews, unrated/colour-pending states and a prominent overall summary. Required Questions and its current completeness/policy-bank gates are removed; historical answers and printing remain. History is a latest-first table. Main SERVICE.ROSTER includes all module slots including safety; the RAM-only embedded roster is removed.

Verification on the integrated source: 191 backend RAM/workflow/Package/composition/operations/duty tests; 77 frontend composition and 6 duty tests; 3 new rating/draft tests; 3 Worker contract/privacy/provider-failure tests. The complete Worker entry bundles. Frontend production build passes with the existing idb-keyval mixed-import warning. Chinese/English Chromium fixtures at 320px/1280px exercise upstream bilingual drafts, read-only RAM sources, collapsed risk scores and immediate arithmetic, and existing final-review freshness/acknowledgment reset. Screenshots were inspected. Provider and browser APIs are fixtures; no real-account, live model or deployed timer behavior is claimed.

Migration `20260915101331_EventActivityPlanningSources` is additive: one activity-plan table and one nullable task column. Its incremental SQL was reviewed and EF reports no pending model changes; it was not applied. Existing Worker project-wide TypeScript errors remain in unrelated eventDetailsTime, aiSession, generateEventPoster and enrolment files. Matched origin/Worker activation, SQL execution and live-provider verification remain release work. Generated documentation validates 174 APIs and three equivalent overview structures.

## 2026-09-15 — RAM background synchronization and final owner review

Tracked together with task delegation in [Issue #790](https://github.com/appccalc-developers/Alife/issues/790) and [PR #791](https://github.com/appccalc-developers/Alife/pull/791), on `codex/790-task-delegation`. Combined publication verification also passes 31 operations/duty backend tests, 77 frontend composition tests and 6 personal-duty tests against the integrated source.

RAM is ordered after upstream module cards and has a live downstream status panel. Upstream invalidation persists a debounced background job on the RAM row. The Azure Functions consumer uses a concurrency claim, captured-context hash, bounded retry and stale-result rejection. The existing Cloudflare/Gemini integration receives only locally derived enum signals and aggregate counts; English kayaking and Chinese water/overnight/transport signals are covered. AI writes unreviewed bilingual candidate risks with incomplete ratings, preserving manual hazards and human overrides. Legacy records require explicit editor upgrade without provider calls. No new provider or dependency is introduced.

The new synchronization state is exposed at `assessment.sync.status` alongside freshness/evaluation/review metadata; existing independent-approval status remains compatible. Before formal submission, the owner must review the latest risks in a bilingual disclosure modal. Pending sync or a changed ETag blocks continuation and clears acknowledgment. The server separately enforces current membership/ownership, context freshness, final owner review, independent RAM approval and Package source vectors. Manual overrides use the authorized RAM editor; concurrent unsaved input is retained with reload/reapply instructions. Final owner review alone does not approve or publish the Event.

Verification: 152 focused RAM, Package and composition backend tests pass, including concurrent writers, stale AI results, pure-Chinese signals, legacy upgrade, privacy projection, revoked membership, ETags and direct submission gates. Frontend TypeScript/production build passes with the existing `idb-keyval` mixed-import warning. Worker sync tests pass 3/3 and the complete Worker entry bundles with esbuild. The Worker project-wide TypeScript check still fails in untouched `eventDetailsTime`, `aiSession`, `generateEventPoster` and `enrolment` files; no errors were reported in the new sync code. The isolated modal/panel fixture passes Chinese/English at 320px/1280px, including sync waiting, language switching without refetch, changed-version acknowledgment reset and final review; mobile/desktop screenshots were inspected. APIs and Gemini responses are fixtures.

Additive migration `20260915074357_AddRamBackgroundSynchronization` contains ten columns and one index. EF reports no pending model changes and its incremental SQL was reviewed without applying it. Local launcher syntax passes and the new timer defaults off locally. Event documentation generation/check validates 12 modules and 171 API contracts with equivalent overview structures. Activation requires the migration, a dedicated backend/Worker secret pair and enabled timer storage; see [setup instructions](RAM-INITIALIZATION.md#background-synchronization-setup--后台同步配置). No deployment, shared/disposable SQL execution, live provider call or real-account acceptance test was performed for this feature.

## 2026-09-15 — Compact enabled-module responsibilities

Tracked with custom delegation in [Issue #790](https://github.com/appccalc-developers/Alife/issues/790). Publication checks on the integrated source pass 77 Event composition tests and 6 personal-duty tests; the production frontend build also passes with the existing `idb-keyval` mixed-import warning.

The preparation responsibility section starts collapsed; each enabled module has a compact summary of assignees and response status, with role actions inside its disclosure. Redundant invitation copy is hidden while bilingual accessible labels remain. Draft module deactivation removes its row immediately without a request or deletion; a saved plan revision reloads the server list. Re-enabling a previously saved module preserves existing invitations and history. TEAM.WORK continues to exclude the roster editor.

Verification: TypeScript and the isolated browser fixture pass in English and Chinese at 320px and 1280px, including collapse/expand, invitations, draft off/on, saved-plan refresh, bilingual delegation, preparation retry and publication material. Compact summary screenshots were inspected. APIs were fixtures; real-account and deployment verification are not included.

## 2026-09-15 — ALIFE Prism Glass capability-card material

The preparation/details pilot and its material refinement are tracked in [Issue #788](https://github.com/appccalc-developers/Alife/issues/788).

Applied the user's Prism Glass definition to the preparation pilot's Event module cards: translucent domain-coloured surfaces, fixed reflected light, glass edges and existing resting/hover/selection depth. Capability, enabled, confirmation and unsaved markers retain their separate meaning. Narrow cards place the graphic above the title according to actual card width, preventing ordinary English module names from splitting. Reduced transparency uses opaque domain surfaces; forced colours preserves system text and outlines. The form, conversation material, APIs and business actions are unchanged by this refinement. Design tokens, workspace/reference guidance, cheatsheet, arrangement presentation, machine presentation description and all three overview languages now record the material and its intended object scope.

Verification: Chinese/English fixture browsers pass at 320/768/1024/1280px after the final CSS change, including word wrapping, existing details interactions and composited glass text contrast (minimum 5.61:1). Desktop English additionally checks hover/selected depth, focus, reduced transparency and forced colours; reduced-motion feedback remains static. TypeScript/build passed, followed by a final Vite/PWA rebuild after the CSS wrapping adjustment. Refreshed [pilot screenshots and source manifest](design/references/preparation-pilot/README.md) record synthetic data and pending user visual acceptance. No wider material rollout or deployment is claimed.

## 2026-09-15 — Preparation overview and details/AI pilot

Implemented the user-selected pilot for creation and saved preparation: compact domain-coloured module cards at 2/3/4/6 columns, indigo Event context, state-specific markers and selected/inspector depth; current-language-first bilingual fields in three groups; 60:40 form/assistant columns only at desktop >=1024px and content >=880px, otherwise one accessible tablist. The existing warm conversation remains, with pending-field reveal/focus, static reduced-motion feedback and expandable AI sufficiency. Collapse, module and language switches preserve conversation and input; hidden assistants stop voice recognition. Read-only controls remain browsable. The global stage rail and other module interiors have not been redesigned.

Removed the saved-preparation debounce write discovered during implementation: details and module selections now use explicit Save event details / Save arrangements with the existing APIs, concurrency and permission checks. AI adoption only changes the draft. Save-validation error targets are structured internally, preserving existing messages and single-language acceptance; completion still requires both languages. Saved registration-rule capacity ownership, approval freeze, old routes, draft versions and private/no-store boundaries remain unchanged. No dependency, migration, live provider call or deployment was added.

Verification: 36 focused unit tests pass; production frontend build passes (existing mixed static/dynamic idb-keyval import warning remains). New/saved details fixtures pass in Chinese and English at 320/768/1024/1280px; voice/chat checks pass at 320/768/1280px with mocked recognition, including failure and cleanup. The Chinese 1280px creation arrangements fixture passes, including RAM/venue and retry checks. Domain contrast, keyboard tab navigation and reduced motion were checked in targeted browser cases. Event documentation generation/check passes with 12 modules, 163 API contracts and three equivalent overview structures. [Pilot screenshots and reproduction notes](design/references/preparation-pilot/README.md) distinguish inspection from pending user acceptance. The older full saved-flow fixture remains unsuitable for specialist regression because its registration payload predates the current rules editor; the focused saved pilot covers this change. Live Gemini semantics and deployment are unverified.
## 2026-09-15 — Tasks and handoffs: module responsibilities and custom delegation

Tasks and handoffs now lists enabled-module responsibilities, collaborator invitations and custom tasks. It reuses existing role/team invitation APIs and removes organizer shift editors from this module in both saved and creation flows. No AI assistant is present in this module. Task title/description and preparation use the selected language first with the other language collapsed; Event details uses the same opt-in bilingual field presentation.

The current custom-task form sends `requireAcceptance=true`; assignees are accepted, current Event participants. Personal accept/decline and preparation actions use task ETags, idempotency and server authorization. Declines create owner reassignment duties. Accepted delegations require preparation before completion, and required preparation tasks contribute readiness blockers while awaiting acceptance/preparation. The owner can select unrestricted bilingual preparation as publication material; the publication step supports manual review/copy. A separate nullable selection concurrency token preserves the approved task source vector while protecting concurrent curation. Preparation and definition changes clear selection. Legacy clients/records retain prior acceptance semantics and existing task IDs/history.

Migration `20260915051804_EventTaskDelegationPreparation` adds delegation, bilingual preparation and private publication-selection fields. EF reports no pending model changes. The migration has not been applied to any database; no deployment or real-account handoff verification occurred.

Verification: frontend Event composition 76/76 and personal-duty tests 6/6 passed. The focused browser fixture passed English/Chinese at 320px and 1280px using current source: module invitations, bilingual task creation and stage/occurrence/deadline payloads, language switching without data refetch or draft loss, personal acceptance, preparation save failure/retry, and no horizontal overflow. Screenshots were inspected from `artifacts/event-task-handoffs/`; all APIs used isolated fixtures. Backend operations/duty/composition regression passed 57/57, including four delegation tests for personal acceptance, preparation/readiness, decline/reassignment, restricted visibility, membership revocation, legacy payloads and publication-selection isolation. Backend API build passed with zero warnings/errors; TypeScript and production build passed with the existing `idb-keyval` mixed-import warning. Publication-material selection and primary/secondary-language rendering also passed the four browser combinations. The generated additive SQL script was reviewed; Event documentation generation/check validates 12 modules, 4 archetypes, 16 activity types, 167 API contracts and three equivalent overview language structures.

## 2026-09-15 — Event visual direction and nonlinear preparation guidance

Adopted the user's five design decisions in [Event Workspace design](design/EVENT-WORKSPACE-DESIGN.md), visual tokens, reference specifications and a short cheatsheet. The existing four global stages remain; preparation is nonlinear without a required owner six-step wizard, while real submission/approval/publication/execution gates remain. Plan B is not planned. Graphics and simple icons carry state with concise necessary text and accessible detail. Safeguarding retains Magenta/Plum, and all Event guidance uses six depth levels. Frontend/Event agent instructions and the Alife design skill now route to this scoped direction.

This is guidance and contract alignment, not a completed UI rollout. Current preparation areas already allow revisiting modules, while `EventSetupPipeline` still renders the legacy `EventFlowRail`. Existing setup identifiers and numeric mappings remain compatibility details. No pilot area is selected, implemented or visually accepted by this documentation change; one part must be exercised before expanding the style. No application code, API payload, migration or deployment is changed. Earlier delivery entries describe their source at the recorded time and do not reinstate the superseded six-step design requirement.

Verification of the documentation change: generated Event documentation and the generator's `--check` passed against current sources; the Simplified Chinese, Traditional Chinese and English overview additions were reviewed for equivalent meaning. Local links in the four design files and the affected instruction/skill files resolve. Domain text/light-surface and white/deep-surface contrast calculations exceed 4.5:1; muted text was adjusted to pass on the subtle surface. Machine-contract sections outside the targeted invariants/setup guidance are unchanged from this task's pre-edit baseline. `git diff --check` passed. The skill's standard Python validator could not run successfully because PyYAML is absent in both available Python runtimes; unchanged frontmatter and scoped guidance/references were checked separately. No browser/UI verification or application tests were run for this documentation-only change.

## 2026-09-14 — Preparation module summary/detail cards

Creation and saved preparation now share vertically stacked configuration cards inside each module. Settings and responsibilities opens initially; other areas start collapsed and can expand independently, including a module with only one area. Native summary controls retain mounted drafts and independent expansion across module/language switches and remain usable in read-only fieldsets. Summaries show current configuration, labelled counts and explicit loading/failure states. Invalid enabled fields reveal their enclosing details before focus. Module navigation, independent confirmation, operational saves, permissions, private caches and stored payloads remain unchanged; no dependency or migration was added. Tracked in [Issue #782](https://github.com/appccalc-developers/Alife/issues/782).

Integration with main through #781 preserves the newer RAM authoring/checks, waitlists, manual rosters, template header and Event time-zone fixes. Required-question summaries now live in the extracted shared component, RAM check links reveal collapsed configuration cards, and registration summaries include confirmed/waitlisted capacity. Browser fixtures retain the latest permission fields and public-payload privacy checks, wait for focus and selection autosaves, and use reduced motion with service workers blocked for reliable production-preview API fixtures.

Post-integration verification: Event composition tests pass 76/76 and the TypeScript/Vite/PWA production build passes with the existing idb-keyval mixed-import warning. Creation and saved-module fixtures pass Chinese/English at 320/768/1280px, covering initial/single/multiple disclosure, keyboard focus, invalid collapsed controls, RAM check links, disable/re-enable retention, asynchronous errors/retry, read-only fieldsets, module/language switching, confirmations, candidate groups and isolated RAM/programme printing. Standalone RAM fixtures pass Chinese/English at 320/1280px, including authoring, signatures, AI outage isolation and protected printing. Mobile and desktop screenshots were visually inspected. After those functional runs, a CSS-only correction replaced inherited summary corner radii with an explicit radius: the browser had computed the inherited radius as zero. The final rebuilt stylesheet separately passes hover, open/closed corners, wrapping, touch-height and keyboard-focus smoke checks in both languages at 320/768/1280px.

The complete saved-preparation fixture passes in Chinese at 1280px: repeated edits, automatic selection saves, role acceptance, return/amend/approve, frozen entry routes, poster adoption, publication and reopening/reapproval. The toggle test shows inactive modules and permits a restored original selection to be a no-op. Event documentation generation/check validates 12 modules, 147 API contracts and three equivalent overview language structures.

Browser APIs are fixtures; live accounts, providers, database behavior and deployment are not verified by this presentation change. No deployment or database migration was performed.

## 2026-09-14 — Role and stage collaboration workspaces

Implemented [collaboration version 1](EVENT-WORKSPACES.md) across application services, protected APIs, PWA work pages and private file storage. Personal Center has persistent My event work; the owner sees current preparation blockers and retains the preparation rail. Task and handoff records retain `TEAM.WORK` and add phase/occurrence scope. Accepted module leads have independent bilingual report submission/return/adoption with immutable adopted versions. RAM review receives the submitted RAM and corresponding complete plan, including adopted reports, registration rules and programme/venue/staffing arrangements; changed context and revoked authors invalidate review actions.

Registration supports versioned rules, actual participants, explicit organizers/proxies/guardians, offline evidence, private materials, whole-household FIFO and optional splitting, approval-gated invitations, actual-person reservations and idempotent expiry. Finance is limited to independently approved manual registration receipts/refunds. Purpose-specific material authorization also applies to generic file entry points; downloads stream through the authenticated backend, and the storage Worker denies reusable generic signed URLs for this purpose. Independent venue/room calendars support indefinite local weekly reservations, date release/restore, future changes, visibility-filtered titles, operation history and serial conflict checks. Catalogue authority is separate from Event ownership. Existing specialist execution pages and occurrence rosters remain; ordinary future gaps do not block preparation approval. Food and finance are partial, festival is unavailable and cannot be enabled.

The additive `20260914133318_EventCollaborationWorkspaces` migration retains legacy IDs, child associations, family payloads and approval evidence. Model/snapshot consistency and the generated incremental SQL script were checked. Local opt-in SQL tests used randomized disposable databases, exercised the actual migration and parallel last-place/weekly-booking writes, and cleaned up their databases. No shared database was migrated. Current membership checks now also apply to the legacy owner-management helper; older tests explicitly seed the memberships they previously represented only through authorization substitutes.

Verification: 299 affected Event/FileAsset backend checks passed, including the SQL tests; the subsequently added persistent-entry/role-revocation test passed separately (300 total). Frontend composition 76/76, duties 6/6, and blocking-dialog check 1/1 passed. Private registration-storage and existing bulletin Worker tests passed 6/6. TypeScript and Vite/PWA production build passed. The browser collaboration fixture covers Chinese/English at 320/1280px: report authors and owners, immutable adoption, keyboard use, language changes without report refetch, retained drafts on retry, RAM plan background, denied private access, in-session account switching, consent-gated participant completion, weekly release and conflicting restoration. All four combinations passed against the rebuilt production preview, and mobile/desktop report, registration, review-context and calendar screenshots were visually inspected. The final legacy RAM/role authorization changes additionally passed 81 focused backend checks.

Validation uses isolated browser identities/API fixtures, not live multi-user accounts or real storage-provider uploads. The expiry service was tested, but a deployed timer host/provider was not exercised. Shared migration, Worker/API/PWA deployment and live church-account acceptance remain release work; no invitations or external communications were sent by this implementation task.

## 2026-09-14 — AI details time-only corrections and zone binding

Implemented on `codex/ai-details-timezone` from main containing #779. The existing offsetless-UTC read fix remains. The Details assistant now recognizes bounded time-only ranges using the current Event start date and zone, correcting stale/UTC-shaped AI values without device-zone conversion. Other missing/mismatched model zones block time adoption. Explicit zone changes require user evidence; server merge validates the time tuple atomically and the client checks it again before changing any draft fields. Invalid replies preserve input with bilingual feedback; missing dates require clarification. Wire shapes, provider, permissions, cache policies, database and historical Event data are unchanged.

Verification: 76 frontend Event tests and 12 rebuilt Worker details tests pass; browser fixtures pass Chinese/English at 320/1280px in both Los Angeles and Perth zones (8 scenarios), exercising creation and saved AI edits, invalid/old reply retention, 08:00–16:00 → 00:00Z–08:00Z saves, offsetless reloads and no repeated writes. Production frontend and Worker dry-run builds and Event document generation/checks accompany the change. Browser/API and Gemini responses are fixtures; no live provider, database migration or deployment was exercised. Delivery is tracked in [Issue #780](https://github.com/appccalc-developers/Alife/issues/780); publication does not imply deployment.

## 2026-09-14 — Preparation card heading and saved-time round trip

Creation and saved Arrangements now place Show all/related modules at the upper right of the first card and use the selected template's bilingual name as its heading. The control remains independent of opening the details editor. Saved preparation previously passed offsetless SQL UTC timestamps directly to `new Date`, which interpreted them in the device time zone before converting them to the Event time zone. It now reuses the existing explicit-UTC parser for Event dates and occurrence-relative arrangement rows. Persistence still sends explicit UTC and retains the Event's IANA time zone; no stored dates, API shape, permissions, cache policy or database schema are changed.

Verification after integrating current main: 74 frontend Event tests pass, including Event-time round trips with/without a UTC suffix across Los Angeles, Perth and Auckland device zones and Auckland DST boundaries. Browser fixtures pass Chinese/English at 320/1280px: creation/saved card heading and upper-right toggle, saving Perth 10:00–20:00 from a Los Angeles browser, two reloads of offsetless SQL-style responses and no repeat writes. Browser APIs are isolated fixtures; no production Event was edited. Production build and current-source Event documentation checks are included in this slice, tracked in [Issue #778](https://github.com/appccalc-developers/Alife/issues/778).

## 2026-09-13 — RAM authoring, capability status, capacity/waitlist and manual recurring roster

Implemented locally in four acceptance slices:

- Creation and saved RAM use the same memory-only authoring editor, bilingual fields, filtered/expandable risks, copy/delete/discard, required questions, server draft checks and saved/submitted/history comparisons. The existing Cloudflare/Gemini route accepts only a reviewed non-sensitive brief and selected risk text. Strict input/output fields, current creation/edit authorization, source versions and bounded timeouts protect explicit per-field adoption followed by Save/Create. AI cannot save ratings, identities, signatures or approvals.
- The live capability catalogue and creation, overview and direct module surfaces distinguish availability from enablement, details confirmation and readiness. Finance, catering and festival operations are unavailable; communications/follow-up provides content, posters and publication only. Required unavailable modules still block formal submission. Historical Plan snapshots/hashes are unchanged.
- Registration now has server-owned confirmed/waitlisted/cancelled states, FIFO eligibility-aware promotion, participant queue positions and manager capacity/lists. All writers serialize on the Event, including reopening/increasing capacity and transactional promotion notices. Cancellation retains enrollment IDs, previous JSON and child-consent references; rejoining gets a new queue time. Legacy clients must explicitly upgrade/opt into waitlisting. Current Plan/safety rules determine whether RAM approval is needed for registration and explicit publication, including public cache-hit revalidation.
- The roster provides four future dates per page, manual candidate choices, retained multi-page drafts, one reviewed atomic/idempotent invitation batch, personal accept/decline, replacement history and in-app notifications/duties. Invitation links resolve their date's page. Explicit versioned default requirements generate missing dates and empty positions over the next 12 weeks, respecting local time, recurrence and exceptions. Package rule 2 freezes configuration but keeps ordinary staffing/responses live; execution still needs enough eligible, available, personally confirmed staff. Critical roles retain specialist rules, candidate/configuration edits remain frozen, and legacy packages keep rule 1 until reopened and reapproved. Adding dates preserves rather than expands the original approval window.

Migration `20260913135531_EventPreparationAuthoringCapacityRoster` adds enrollment lifecycle/history, roster defaults/links, package rule version and nullable series timing anchors. Real SQL Server tests use uniquely named disposable databases: last-seat concurrency, repeated cancellations, FIFO promotion, eligibility loss, close/reopen and historical evidence pass. A populated preceding schema is upgraded using the additive migration; legacy enrollments remain confirmed with original JSON/timestamps, child references survive, old packages keep rule 1 and no historical notifications/defaults are fabricated. Shared/production databases have not been migrated.

Verification: the Event backend regression passes 265 tests, including both disposable-SQL tests; a subsequent 76-test approval/duty regression covers the final approval-window and critical-duty adjustments. The frontend Event suite passes 73 tests, production TypeScript/Vite/PWA build passes, and the six RAM Worker tests plus Worker build pass. Browser fixtures exercise creation, saved RAM, capability availability across all entries, capacity/waitlist and two-actor batch invitation/notification/response flows in Chinese and English at 320px and 1280px. They verify language changes without lost drafts or unnecessary reads, conflicts without partial writes/notices, explicit AI adoption and retained manual input, actual waitlist feedback, pagination and responsive layout. These browser APIs are isolated fixtures; live authenticated-account/backend/Gemini end-to-end acceptance remains outstanding. EF reports no pending model changes. Event documentation is regenerated and checked from the authoritative contract.

No deployment or shared migration was performed. Publication and the remaining live acceptance are tracked in [Issue #774](https://github.com/appccalc-developers/Alife/issues/774). Automatic rotation/recommendations, family/guest/per-occurrence enrollment, email/device push and catering delivery remain outside this round.

## 2026-09-13 — Seeded Event owner foreign-key failure

The deployment seeder created new Event fixtures with `CreatedByMemberId` but omitted the required `AccountableOwnerMemberId`, leaving `Guid.Empty`. The production SQL foreign key `fk_group_events_members_accountable_owner_member_id` correctly rejected the insert after migrations completed. Read-only inspection confirmed the latest Event-duty migration was applied, the demo creator/participant existed, the failed picnic fixture was absent, and no existing Event had an orphaned owner. The same constraint failure appears in deployment logs preceding the duty feature; saving memberships earlier does not initialize the missing Event owner.

New seeded Events now assign their creator as accountable owner; reseeding preserves existing owners. The existing EF InMemory test missed the relational constraint. Added owner/real-member assertions first reproduced the empty GUID, then both the seed/idempotency and existing-owner preservation regressions passed after the fix. No database schema or production data change is required for this correction. Production was queried only; seeding, migrations and deployment were not rerun there.

## 2026-09-13 — Controller route initialization repair

The constrained task-action route used MVC's reserved `action` route parameter. Building the shared controller endpoint table threw an `InvalidOperationException`, causing unrelated requests, including `GET /api/onboarding/capabilities`, to return 500. The task, RAM governance and group join-invite operation parameters now use non-reserved names. Existing operation URLs, request bodies, GUID/action constraints, authorization, ETags, idempotency and private/no-store behavior remain unchanged. Tracked in [Issue #772](https://github.com/appccalc-developers/Alife/issues/772).

Regression coverage exercises MVC discovery and route matching across the API controller assembly, including onboarding, all ordinary task/RAM/invite operation URLs, rejected task operations/invalid IDs, and protected endpoint metadata. These checks do not invoke business mutations or require a database.

Verification: the onboarding route regression first reproduced the same initialization exception as the local Functions log. After repair, the task/identity/routing selection passed 56/56; the final expanded routing/RAM selection passed 58/58, including 19 routing cases. The rebuilt local API returns 200 for onboarding capabilities directly and through the speed layer and frontend, retaining private/no-store headers. Anonymous task, RAM and invite operations return 401; an unsupported task operation returns 404. The browser loads the authenticated Event preparation/approval page after refresh. No authenticated business mutation, database migration or deployment was performed.

## 2026-09-13 — Event duties and ordinary task approval

[Event duties and personal handoffs](EVENT-DUTIES.md) now projects existing invitations, roster, ordinary task execution/review, RAM preparation/confirmation/review, Package approval/conditions, sponsorship, reopening and owner progression into the current-notifications response. No notification record or new generic workflow runtime is required. Stable actor/source/version keys, private restricted handlers, account-isolated refresh and exact-version checks drive handoffs. Personal Center keeps three cards and a filtered/sorted 20-item full list; direct actions return to the original filters.

Ordinary tasks add an independent reviewer, separate approval state and immutable submission/action rounds. Completion, return, withdrawal, reassignments, current membership and source-owned specialist tasks are enforced by the server. Additive migration `20260913055043_EventDutyTaskApproval` preserves old completed tasks, backfills only proven condition/occurrence references and invents no historical approvals. It has been generated but not applied to a shared or production database. Database application and deployment remain separately authorized steps. This implementation is tracked in [Issue #764](https://github.com/appccalc-developers/Alife/issues/764).

Verification on 2026-09-13: the complete backend suite reports 770 passed, one real-SQL test skipped (no configured disposable SQL instance), and one known date-sensitive failure: `PublicProjection_RevalidatesCurrentGateBeforeReturningSharedCachedContent` uses a September 12 sample event that is no longer upcoming. Frontend task tests pass 6/6; Event composition tests pass 72/72; TypeScript and production build pass (the existing `idb-keyval` mixed-import warning remains). Browser fixtures pass Chinese/English at 320px and 1280px: three home cards, 20-item pagination, retained filters, language changes without refetch, opening without writes, submitted-task handoff, automatic refresh, stale links, empty and failed states. These are isolated API fixtures, not live-account/database end-to-end verification. The additive SQL migration script and foreign keys/indexes were reviewed, and EF reports no pending model changes. No database migration was applied. Event documentation generation/check passes for 12 modules, 4 archetypes, 16 activity types, 137 API contracts and equivalent overview language structures.


The final targeted backend regression passes 71/71 after the roster qualification and vacancy handoff changes, including revoked role confirmation rejection, departed confirmed staff returning to coordinator/owner work, and stale occurrence-version links. The complete-suite count above is from the preceding full regression; the final targeted run covers the subsequent changes.

## 2026-09-13 — Generic workflow retired; independent RAM review duties surfaced

The generic Workflow & outputs surface was not reliably reachable because Workspace management visibility and workflow-template catalogue authorisation used different viewer rules. The feature is now retired instead of widening access: `workspace.workflow`, its frontend components/services, active Event workflow/template/artifact endpoints, creation binding, runtime synchronisation and seed templates are removed. Old `?section=workflow` bookmarks redirect to Workspace Overview. Historical workflow tables, migrations and stored Plan fields remain untouched for non-destructive compatibility, but new Events do not create or synchronise generic workflow records.

When an organiser requests independent review of a confirmed RAM revision, every eligible reviewer in the same root church receives one `event.ram.reviewRequested` notification. Pending revisions appear in Church Life / Independent RAM review and as a Personal Center Duty. The direct action page presents the complete accepted Event Plan as private, read-only decision context above the restricted RAM report and independent-review controls; it grants no Event editing authority. The current-duty query revalidates the exact revision, `admin.events.audit`, approved church membership and author/submitter/on-site separation on every read; resolved or no-longer-eligible work disappears without deleting notification history. Discovery responses remain minimal authenticated `no-store` projections. Event Package submission waits for independent review only when the accepted Plan enables RAM or safety facts/policy make it mandatory; an explicit No is allowed when no higher-priority trigger applies.

The `EventPlanningSession` Durable Object class name remains as the existing thin adapter for `/api/events/details-session/*`. Stored Event JSON, Plan v1-v4 history, database schema, migrations and production data are not rewritten.

Current-source verification: the focused backend composition, Event CRUD, RAM governance, Church Life and current-duty filters pass 96 tests; the frontend Event composition suite passes 72 tests, current-task suite passes 3 tests, and workspace-layout suite passes 4 tests. The backend solution and frontend TypeScript/Vite/PWA production build pass with the existing `idb-keyval` mixed-import warning. Documentation generation/check validates 12 modules, 130 API contracts and three equivalent overview structures. The Church Life Node test command is blocked before test discovery by its pre-existing extensionless `src/db/httpError` import under Node 24; the production TypeScript build covers the changed navigation and view. The full backend suite passes 756 tests with one skipped and one unrelated date-sensitive public-projection failure: its fixed event starts at `2026-09-12T00:00Z`, which is already earlier than the test's moving cutoff on 2026-09-13. Browser-fixture syntax passes, but no browser fixture, live provider, database migration, deployment or production-data change was performed in this slice.

## 2026-09-12 — Alpha Demo RAM matrix and bilingual scales — Issue #758

System Management now offers an explicit Alpha Demo action that fills the editable 25-cell RAM matrix with the legacy-editor three-colour projection: scores 1–5 Green, 6–19 Yellow and 20–25 Red, combining the former Amber/Orange bands as Yellow. An application confirmation explains that the action overwrites only the current draft; it does not save, publish or replace cell-by-cell review by the church safety authority. The existing per-cell Green/Yellow/Red controls, immutable publication and server-owned matrix evaluation remain authoritative.

Initial and residual likelihood/impact selectors now contain the accurate five-level English and Chinese names plus complete definitions. The selected definition is repeated in a wrapping bilingual panel for mobile readability. Published church definitions take precedence; manual-derived defaults provide guidance during pre-creation or when no policy is available and never determine server colour.

Verification: all 71 frontend Event composition tests pass, including focused preset-boundary, non-mutation and bilingual-definition tests. TypeScript checking, the Vite/PWA production build, browser-fixture syntax, machine-contract JSON parsing and `git diff --check` pass. The production build retains the existing idb-keyval chunk warning. The updated English/Chinese × 375/1280 RAM browser fixture could not run because the local Playwright Node package is unavailable; its fixture APIs do not touch a live service, database or policy publication.

## 2026-09-12 — Event details inside Arrangements

New and saved preparation now place Event details first as a full-row card with title, event-local times/time zone and the fixed creator/accountable owner. Details form and AI assistant are retained child work areas. Twelve policy confirmations remain unchanged; legacy Details URLs open the card. Footer navigation is reduced to Back to top, with rail validation and explicit save/create actions preserved. No backend or database change in this follow-up.

Verification: frontend composition suite (71 tests), production build, and fixture browser regressions for new/saved flows in English and Chinese at 320/1280 px. Provider calls, deployment and shared migrations were not performed.


> Documentation class: **Operational**. Captured from the current worktree on 2026-09-02 at branch baseline `eb1a4b9`. This file describes repository delivery state, not timeless architecture. The target contract remains [EVENT-CONTRACT.md](EVENT-CONTRACT.md).

## Arrangement module overview and independent confirmation — 2026-09-12

Implemented locally: creation and saved preparation share twelve category-coloured tiles, 3/4/6 responsive columns, initially collapsed, and one visible module editor. Independent work areas use the same pattern with mounted drafts and focus return. Settings include responsibilities; RAM exposes conditions, risk details/scoring, questions, personal review, history and applicable shifts. Repeated form cards use compact dividers. The owner is a compact global row, and Review reports all twelve module confirmations and responsible people.

Optional `moduleConfirmations` participates in compose/Plan JSON, hashes, ETags and saves without a table or migration. Legacy section flags remain derived summaries; old flags never confirm modules. Omission by an old client is rejected after upgrade; absent fields retain legacy serialization/hash behavior. Operational audit records identify the owning module, including role shifts and both sides of candidate-group moves. Scoped and RAM-dependent reviews invalidate; unknown legacy audit scopes fail closed. Historical snapshots, formal approval, authorization and private caches remain authoritative. RAM remains in controlled memory and outside browser draft persistence.

Verification: 245 backend Event tests and 71 frontend composition tests pass; TypeScript/Vite/PWA production build passes (existing idb-keyval chunk warning). Creation and full saved-preparation browser fixtures pass English/Chinese at 320/375/768/1280 pixels. Additional saved-tile checks at 320/1280 in both languages cover candidate ordering, retained RAM/programme/venue drafts and isolated RAM/Programme printing. Standalone RAM policy/assessment fixtures pass both languages at 375/1280, including manual save, AI outage, personal confirmation and draft PDF. Desktop/mobile screenshots were inspected. Documentation generation/check reports twelve modules, 129 API contracts and three equivalent overview structures.

Limits: browser APIs are fixtures; persistence tests use EF InMemory. Live accounts, SQL Server concurrency and deployment remain unverified. No deployment, shared database migration, policy publication or Git publishing performed for this slice.

## Creator ownership and module role staffing — Issue #752 (2026-09-12)

Reviewed together under [Issue #752](https://github.com/appccalc-developers/Alife/issues/752), from baseline `5dcb1fc`. New Event ownership is fixed to the authenticated creator. Foreign owner payloads and legacy owner-transfer invitations are rejected; existing Event ownership and historical approvals are not rewritten. Plan editing is owner-only, including legacy workflow/artifact routes and linked series changes. An optional accepted on-site lead and RAM author/reviewer have their own duties without Event-plan edit authority; the RAM author can edit RAM and independent review rules remain enforced. Existing module-specific operational permissions remain separate.

Team and tasks now emphasizes cross-module coordination, with generic membership and history collapsed. Template demand and saved shifts appear under the owning functional module in Arrangements. Ordered role candidate groups are private to the owner/accepted roster coordinator; assignment and substitution require membership of the explicit group plus existing eligibility and availability checks. Candidate members can read their personal roster state and record their own availability without receiving other candidates' identities or management rights. Candidate order is manual; automatic rotation is out of scope. The shared roster editor retains module boundaries, refreshes candidate/roster ETags after writes, and ignores stale occurrence loads.

Initialization: review migration `20260912013250_AddEventRoleRosterGroups` and apply it only in an authorized environment before using the updated API. It creates one group per Event/role and does not populate candidates, alter owners, or rewrite past assignments. Existing roles need an explicit candidate group before a new assignment/replacement. Module versions TEAM.WORK 2, SERVICE.ROSTER 2 and SAFETY.RAM 3 describe the tightened role contract. Candidate configuration participates in Package source versions without copying candidate IDs into the Package.

Verification: 238 backend Event tests and 69 frontend composition tests pass. Backend tests cover creator ownership, role and group-leader plan-edit denial, rejected transfer and series bypass, candidate-group scope/order/concurrency, assignment/substitution restrictions, personal response isolation and private/no-store group APIs. TypeScript/Vite/PWA production build passes with the existing idb-keyval chunk warning. Both creation and saved-preparation browser suites pass English/Chinese at 320/1280 pixels, including module placement, candidate editing, collapse, draft retention and responsive inputs; the mobile roster screenshot was inspected. Documentation generation/check validates 129 APIs and three equivalent language structures. Migration SQL was generated and reviewed without execution; EF reports no pending model changes. Browser APIs are fixtures and backend persistence tests use EF InMemory; SQL Server concurrency/constraints and live accounts remain unverified. One registration-gate fixture used an Event that expired during verification; its dates now remain in the future so it continues testing approval gates. The authorized publication is one commit and a Draft PR against main under Issue #752. Deployment, shared database migration and policy publication are excluded.

## Consolidated delivery review — Issue #750 (2026-09-12)

All Event Workspace/RAM changes are reviewed together under [Issue #750](https://github.com/appccalc-developers/Alife/issues/750), based on `82abd4e0`. The final flow embeds operational tools and their derived roles in Arrangements, retains a global accountable owner, removes duplicate tri-state questions, and exposes seven default-false section confirmations plus responsibility summaries before creation. Confirmation metadata survives save/reload and invalidates on relevant edits without changing historical snapshots or weakening formal safety gates.

Current-source verification: 232 backend Event tests, 69 frontend composition tests and 123 bundled Worker tests pass. The backend solution warning guard reports zero warnings/errors; TypeScript/Vite/PWA production build and Worker dry-run bundling pass. The existing frontend idb-keyval chunk warning remains. RAM browser fixtures pass English/Chinese at 375/1280, including matrix publication, question pagination, manual drafting, provider failure, personal confirmation and protected printing. Legacy-entry browser fixtures also pass English/Chinese at 375/1280 after replacing their obsolete empty Plan fixture with the current contract; they cover workflow artifacts, catalogue failure, embedded RAM saves and legacy redirects without a retired AI session. Existing current-source creation/arrangement and role-summary browser coverage passes English/Chinese at 320/1280; details/voice coverage passes English/Chinese at 320/768/1280. Browser APIs and providers are fixtures, and backend persistence tests use EF InMemory.

Migration SQL was regenerated for review without applying it; EF reports no pending model changes. Real SQL Server constraints/concurrency, live providers and deployed accounts still require environment verification. No deployment, shared migration or administrator policy publication is authorized by this delivery. Documentation generation/check validates 127 API contracts and three equivalent language structures.

## Integrated Arrangements and team tools (2026-09-12)

- Merged the preparation Team and tools step into Arrangements. Seven-step rail; creation and legacy setup links return to Arrangements, with module focus retained.
- Existing authorized team, enrollment, roster, programme, venue, safeguarding and travel editors render under their corresponding groups alongside RAM. Planning-only modules retain their existing scope. Enrollment uses the same extracted panel as Event detail.
- Saved tools own their operational writes. Selection acceptance omits row arrays; tool saves refresh Event concurrency and summaries. Collapsing and navigating saved steps preserve mounted editors. Existing server permissions and approval freezing remain authoritative.
- Verification: current-source TypeScript/Vite/PWA build and 67 event-composition tests pass. Creation fixtures pass English/Chinese at 320/1280; RAM fixtures pass English/Chinese at 375/1280. Full preparation regression exercises return/reapproval, frozen routes, poster/publication and reopening at 320/1280. Integrated-tool fixtures cover task and programme writes, row preservation, Event concurrency refresh, legacy module focus, collapse/navigation retention and isolated programme printing. Mobile screenshots were inspected and input clipping corrected. Documentation generation and trilingual overview validation pass. Browser APIs are fixtures; no live database or deployment verification is claimed. No deployment or database migration is part of this UI merge.

## Evidence rule

A business capability counts as implemented only when matching persistence, server-side authorised API, and a reachable user flow exist in the current worktree. Composition metadata, a migration-only structure, a Surface Registry entry, or a generic placeholder does not make a business module usable.

`Current` means a dedicated core flow exists, not that the complete target scope is finished. `Partial` means at least one real flow exists but the module contract is not end-to-end complete. `Target only` means only contract, shared foundation, or generic surface behaviour exists.

## Inline RAM and collapsible arrangements (2026-09-11)

Safety now pairs the children question with Child safeguarding, then the RAM question with the embedded RAM assessment. All seven arrangement groups and individual module headers have top-right expand/collapse controls that retain mounted content. This supersedes the intermediate Open RAM assessment link below. Saved Events render the full RAM workspace inline; dirty RAM blocks step navigation and other preparation saves, and a RAM save refreshes the Event revision without replacing unsaved Event fields. Pending Event edits block RAM confirmation/review while allowing draft saves.

New Event creation uses the same activity/risk fields with a separate memory-only RAM draft; it never enters ordinary browser draft storage or the AI details snapshot. Explicit creation sends it in the existing private ramDataJson and the same transaction. The server computes scores with only the owning church policy, records the authenticated author, keeps Draft status, and disables implicit publication for version-2-RAM creation. Malformed drafts fail without partial Event records; identical retries retain one Event. Questions and signatures continue after Event creation.

Verification: frontend TypeScript/Vite/PWA build and 67 event-composition tests pass. Creation browser fixtures pass all six English/Chinese × 320/768/1280 scenarios: every group/module collapse control, split safety layout, retained RAM after collapse and No→Yes, RAM excluded from localStorage/public JSON/AI event context, and private creation payload/retry preservation. Saved-preparation fixtures pass four English/Chinese × 320/1280 scenarios, including inline RAM saving while retaining an unsaved title and refreshed Event concurrency. The independent RAM browser suite passes four English/Chinese × 375/1280 scenarios including policy, AI outage, signatures and printing after the shared-field extraction. Mobile RAM/safety and desktop arrangement screenshots were inspected.

Backend focused creation/governance tests passed 65 tests; the final creation/legacy-RAM run passes 31 tests after adding the version-2 no-implicit-publication case. Tests cover atomic private RAM persistence, server score overwrite, incomplete drafts, no duplicate on retry, invalid payload rollback and legacy compatibility. A test enum typo was corrected; a later generated Functions dependency restore was blocked by the sandbox and succeeded with approved NuGet access. No migration or deployment was performed. Browser APIs remain fixtures; live account/database behavior is not claimed. Documentation generation, trilingual overview checks and `git diff --check` pass.

## RAM discovery from Arrangements (2026-09-11)

The Arrangements RAM card previously offered only Yes/No and a reason, although the full assessment was available in the saved preparation tool selector. It now describes the assessment and exposes Open RAM assessment for enabled saved Events. The action selects the existing `stage=setup&module=safety.ram` tool and retains the same Event and saved preparation draft. Unsaved changes block the action with save instructions. New, unsaved Events explain Create → Team and tools → RAM and safety; disabled saved tools explain re-enabling without deleting records. No new RAM persistence, permission or publication behavior is introduced.

Verification: frontend TypeScript/Vite/PWA build and all 67 event-composition tests pass. Saved-preparation browser fixtures pass all four English/Chinese × 320/1280 scenarios and exercise the saved Arrangements button, the dirty-form guard and the actual RAM workspace including editable participant count, risk details and Add risk with no published policy. Creation fixtures pass all six English/Chinese × 320/768/1280 scenarios, including pre-creation guidance. The mobile RAM entry screenshot was inspected. These tests do not verify a deployed account or database; deployment and shared migrations remain unapplied.

## Details assistant chat styling (2026-09-11)

The conversation now uses left white assistant bubbles and right soft-green user bubbles, speech tails, a warm dotted background and a bilingual empty state. The oldest exchange remains at the top and the newest at the bottom, with automatic bottom scrolling. The send action uses the existing green primary button; field completion, pending/default checks and the return-to-form action are grouped below it. Existing session, voice, error, draft and API behavior remain unchanged. The return-action placement here supersedes the earlier send-row placement recorded below.

Verification: `npm run build` passes TypeScript, Vite and PWA generation. `tests/eventDetailsVoice.browser.cjs` passes English/Chinese at 320/768/1280 pixels, checking opposite bubble alignment, chronological exchanges, scroll-to-bottom after viewing older messages, completion below send, return below completion, and no horizontal overflow. Voice failure/cleanup and unsupported-browser scenarios remain covered. Mobile and desktop chat screenshots and the mobile completion panel were visually inspected. The first browser navigation timed out while the build was running; rerunning after the build passed. Tests use fixture APIs and speech, with no live AI request or deployment.

## Details time adoption and reply placement (2026-09-11)

The details assistant now recognizes bounded explicit date/time-range statements in the selected Event zone, including Chinese numeral dictation, and adopts both wall-clock fields even when model evidence quotes only the hours or returns the old 10:00–12:00 defaults/UTC-shaped times. Invalid, negated, conditional and DST-ambiguous statements remain outside deterministic adoption. The form states the Event time zone and labels unconfirmed prefilled times. The conversation is above the message input in chronological user/assistant order, automatically scrolling to the bottom after new messages to guide the next turn. This supersedes the earlier latest-first presentation below. Manual form edits, session continuity and existing submission/approval boundaries remain unchanged.

Verification: `npm run build` passes TypeScript, Vite and PWA generation; `npm run test:event-composition` passes 67 tests. The Worker dry-run bundle and all 123 `index.test.mjs` tests pass, including hour-only evidence, stale defaults, UTC-shaped model output and Chinese numeral dates. `tests/eventDetailsVoice.browser.cjs` passes English/Chinese at 320/768/1280 pixels using Los Angeles/Perth browser zones: Auckland inputs retain 19 September 13:00–16:00, exchanges remain chronological above the input, and a new reply scrolls to the bottom after manually scrolling up. Voice failure/cleanup and unsupported-browser checks also pass. Phone and desktop screenshots were inspected. Browser AI/speech responses are fixtures; no live provider request or deployment was performed.

## Workspace RAM entry correction (2026-09-11)

The user's decision supersedes the interim saved-editor restoration below: saved Events use Event Workspace, and the old AI event editor is retired. The `safety.ram` renderer now embeds the complete versioned assessment instead of linking out to the old editor. Saved preparation embeds the same component. Travel, publication and detail RAM links use Workspace; old saved-edit bookmarks redirect to Workspace RAM or saved Details without starting an AI planning session. Personal-signature links remain independent, and server RAM authority is unchanged.

Verification: frontend production build and 66 Event composition tests pass. `ramGovernance.browser.cjs` and `eventEditorRecovery.browser.cjs` each pass English/Chinese at 375/1280 px, including navigation from Workspace into RAM, no language-triggered RAM refetch, saving, personal confirmation, printing, preparation embedding, legacy redirects and no retired AI session calls. Saved preparation also passes English/Chinese at 375/1280 px, including ordinary saved-edit redirection to Details. An initial concurrent run failed a tool-selection assertion once; the isolated rerun passed. Browser APIs are fixtures. This entry correction adds no backend or database migration.

## Interim Event/RAM editor restoration (2026-09-11)

At the user's request, the original tabbed Event editor is restored from the parent of `de9aa093` while future consolidation is deferred. Existing edit URLs open Basic details, AI assistance, Notice and RAM; `step=ram` opens the RAM form directly. RAM links from workflow outputs, the independent workspace, preparation and the audit action reach that form, with a return to preparation when `flow=setup` is present. Query-based Event selection remains supported. The creation wizard and saved preparation pipeline remain available, and server authorization, independent RAM approval and preparation freezes are unchanged.

Workflow loading now passes the owning group to the template catalogue and preserves an existing workflow and its artifacts if catalogue loading fails. The catalogue error stays visible. That editor-restoration slice introduced no backend, migration or deployment changes; the subsequent RAM slice below adds backend and migration code.

Verification: `npm run build` and all 66 `npm run test:event-composition` tests pass. Focused backend filters for EventRamWorkflowTests/EventWorkflowFrameworkTests and preparation cover 10 + 16 passing tests, including independent review and frozen/stale detail updates. `tests/eventEditorRecovery.browser.cjs` passes all four English/Chinese × 375/1280 fixtures: workflow menu and artifact links, catalogue failure isolation, original editor tabs, bilingual notice/RAM saves, direct/query edit routes and workspace/preparation return links. `tests/eventSetupFlow.browser.cjs` also passes all four English/Chinese × 375/1280 fixtures with its saved-edit entry updated to the explicit preparation route; coverage includes creation, approval/reopening, frozen routes, poster and publication. Phone and desktop RAM screenshots were inspected. Browser APIs use fixtures and backend tests use in-memory persistence. The documentation generator and `--check` validate 116 API contracts and three equivalent overview structures. Live service/database, AI provider and deployment verification are not performed.

## Versioned RAM and church policy (2026-09-11)

Implements the approved manual/SOP plan through church-scoped policy versions, an explicitly unconfirmed 25-cell initial matrix, bilingual questions/categories, initial and residual scoring, per-activity mandatory answers, personal snapshot confirmation, independent review, return/re-submit, material-change invalidation, Red Enhanced Package enforcement and protected printing. Restored edit/RAM URLs remain usable; a dedicated signer route and system policy page are added. AI only receives enum context for optional question guidance; previous model-generated RAM scoring/overwrites are removed. Shared workflow/Package summaries exclude private RAM details.

The reviewable `20260911120019_AddVersionedRamGovernance` migration preserves original legacy JSON/status and genuine historical decisions; its SQL was generated and inspected without execution. No shared database migration, deployment, policy publication or real AI call was performed. Follow [RAM initialization](RAM-INITIALIZATION.md), including disposable SQL verification and explicit administrator confirmation of every matrix cell.

Current verification: 104 focused backend RAM/Package/preparation/workflow tests pass; frontend TypeScript/Vite/PWA build and 66 Event composition tests pass; Worker dry-run bundle and 122 Worker tests pass. RAM browser fixtures pass English/Chinese at 375/1280 px, covering matrix publication, question pagination, manual save, AI outage, personal confirmation and draft print/PDF. Backend persistence tests use EF InMemory and browser APIs are fixtures; SQL transaction/concurrency execution, real service integration and live providers are unverified. The wider Event regression passes 222 cases with one date-sensitive recurring-occurrence assertion failing (expected 11, actual 12); its test and recurrence implementation are unchanged. Worker standalone `tsc --noEmit` still reports five existing FormData/File errors in aiSession.ts, generateEventPoster.ts and enrolment.ts; these files are unchanged. Old editor recovery and saved preparation browser fixtures each pass all four English/Chinese × 375/1280 scenarios. PDF pagination and representative phone/desktop screenshots were inspected. Documentation generation/check validates 127 API contracts and three equivalent overview structures.

## Shared Event Composition foundation

The current branch contains:

- compatible `GroupEvent` persistence with `EventDataJson` retained;
- `EventSeries`, `EventOccurrence`, Session, ProgramItem, Zone, and ServiceSlot structures;
- versioned Event facts, proposals, immutable accepted snapshots, and deterministic composition;
- four fixed archetypes and sixteen versioned system-preset Activity Types;
- an authorised, audited Event-template catalogue UI and API;
- governance, sponsorship, Event roles, readiness, ETag, and idempotency foundations;
- a compile-time controlled frontend Surface Registry and role-aware Event workspace;
- dormant historical `EventWorkflowRun` / Step / Artifact persistence, with no active UI, API, seeding, creation or synchronisation;
- server-side visibility controls and private/no-store handling for protected workspaces.

## Event creation workspace

The [continuous preparation flow](EVENT-SETUP-FLOW.md) now uses eight steps: **Template → Details → Arrangements → Confirm creation → Team and tools → Formal approval → Poster → Publish**. The first four retain the creation draft; successful creation continues on the same saved Event. Categories and their active templates share one compact selection screen; selection stays on that screen until the user continues. Bilingual copy, dates, visibility, registration and capacity are entered together. Weekly recurrence supports intervals of 1–52 weeks and retains its existing 12-week window. All creation dates use the visible event time zone.

Arrangements group factual questions with the server-composed management tools and readable reasons. Template defaults, explicit user overrides and confirmed/candidate/unknown facts remain separate. Before creation, only actual tool overrides are sent as `humanSelections` and required server decisions cannot be disabled. After saving, the draft preparation selector sends every displayed Yes/No choice, including previously required tools; explicit No is persisted without deleting existing records. Formal submission rechecks required activation/dependencies. Optional modules have inline Yes/No choices. Roster demand, bilingual programme sessions/items and existing/new venue bookings can be expanded, edited and summarized on this page before Review. Turning modules off retains their scoped local drafts but omits their operational rows. Preparation checklists remain optional. Finance, hospitality and festival operations are labelled as planning support rather than complete operational tools.

Template changes preserve entered copy, facts, arrangement edits and explicit overrides; untouched defaults follow the new template. Composition previews debounce changes by 400ms, discard outdated responses and block review while loading, stale or failed. Copy/arrangement-only edits do not refetch composition. Entering review validates details and enabled arrangement editors and recomposes; creation requires the exact reviewed input and explicit human submission. Duplicate requests are guarded and retries reuse an idempotency key only for identical input, including the proposal hash and arrangements. Creation does not publish an Event.

New local drafts use format version 3 (version 2 fields are preserved with unconfirmed sources and interval 1) and keys scoped to both member and owning group. Optional nested arrangements preserve incomplete drafts with structural validation. Earlier unscoped legacy drafts are not read or migrated. The independent poster studio is now a post-creation step after formal approval; the original Event edit entry remains available. The original four-step UI slice did not change APIs; the subsequent [arrangements contract](CREATION-ARRANGEMENTS.md) adds optional `arrangements` to Event creation and saves existing operational entities in the same database save. The continuous flow adds protected GET/PUT poster operations. Reopening adds protected preparation/request/review operations and migration `20260911023825_AddEventPreparationReopenRequests`; shared-cache classification is unchanged. The details-assistant API is documented below.

Composition-backed creation explicitly starts unpublished (`draft`) with registration `closed`; clients without composition and existing records retain legacy compatibility. The initial eight-step rail (superseded by integrated Arrangements above) continued into existing team/module editors, preserves the same Event identity and resolves refreshes to the URL stage. The Details input uses the assistant's existing explanatory copy beside its voice control. Poster upload/generation remains a local candidate until human adoption; the protected save updates only the poster association with Event ETag/idempotency checks, preserves other data/approvals, and invalidates Event/Church Life caches. Stale brief adoption requires refresh and re-review. Local candidate files survive stage navigation, but not full reload. Poster artwork is deliberately excluded from formal approval and is produced afterward.

Formal approval reuses the existing Package workspace. Its pipeline presentation delegates publication to the final step, which requires active approval, server publication capability and satisfied requirements, followed by explicit human confirmation. The existing server command, specialist approvals, configured enforcement modes and public/church/group audience projections remain authoritative; approval does not publish or open registration. RAM/detail/enrollment screens link back to preparation.

Arrangement persistence validates active modules, row/time/text limits, owning-group active venues, current venue ETags, capacity and half-open booking conflicts. Venue token updates detect concurrent booking writes. Explicit roster arrays replace template demand, while omitted arrays preserve the old preset behavior and omitted arrangements preserve existing idempotency hashes. Initial series occurrences receive the same relative arrangements; future rolling generation does not yet inherit these drafts. Drafts and review survive validation/network failures, and conflicts return to Arrangements for correction. Operational detail stays out of public Event JSON and AI details prompts.

Focused arrangement unit verification: six frontend cases cover DST conversion, payload exclusion, template/draft preservation, validation, venue boundaries and draft recovery; fifteen backend cases cover persisted operational rows, idempotency, rejected partial creation, authorization, venue group/active/ETag/conflict checks, recurrence and legacy preset compatibility. Backend persistence tests use EF InMemory; SQL transaction rollback and simultaneous real database writers are not exercised by those tests.

Arrangement browser fixtures exercise both languages at 320px, 768px and 1280px: required locking, Yes/No, expansion/collapse, retained edits, enabled-editor validation, bilingual programme input, venue capacity, same-page/review summaries, final payload, conflict recovery, identical-key retry and no language-only venue/composition refetch. Screenshots were inspected for Chinese and English phone/desktop/tablet layouts. These fixtures do not create live Events or exercise a real database. Successful-create navigation is covered by the continuous-flow fixtures below; real simultaneous venue bookings remain unverified end-to-end. Footer spacing keeps creation actions clear of floating navigation controls.

Earlier continuous-flow browser verification (before the approval-boundary revision, 2026-09-11): `tests/eventSetupFlow.browser.cjs` passes English/Chinese at 320px, 768px and 1280px, covering successful create navigation, same saved Event identity, local-only poster generation/file selection, explicit adoption, preserved stage drafts, stale-brief 412 refresh/re-review, formal submission/decision, publication blocking before approval, no automatic publication, cancel/confirm publication and refresh resumption. Language switching triggers no stage refetch. The arrangement browser suite passes all six cases; `tests/eventDetailsVoice.browser.cjs` passes all six layouts plus permission/device/network/language/start errors, unsupported-browser typing, stop timeout, length cap and lifecycle cleanup. Screenshots include inspection and correction of narrow-screen explanatory-label wrapping. Every browser mutation and AI/image call is a fixture; no live Event, upload, provider request or publication was performed.

Earlier continuous-flow frontend verification: `npm run test:event-composition` passes 63 tests and `npm run build` passes TypeScript plus Vite/PWA generation against the final source. Documentation generation and `--check` validate 111 API contracts and three equivalent overview structures. Existing NuGet pruning and Vite mixed-import warnings remain. No migration, shared/production database operation, deployment or Git publication was performed.

Earlier continuous-flow backend verification: `dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj --no-restore --filter "FullyQualifiedName~EventPosterTests|FullyQualifiedName~EventCreationArrangementsTests|FullyQualifiedName~EventPackage|FullyQualifiedName~EventVisibility" --verbosity quiet` passes 72 tests. Poster cases cover manager/team/outsider boundaries, private/no-store and Cookie/Authorization variation, invalid URLs, minimal projections, ETag conflicts, idempotency, cache invalidation, preserved RAM/other Event data and unchanged Package source evidence. Creation cases cover explicit draft/closed initialization, suppression despite RAM approval, legacy lifecycle compatibility and current-state idempotent replay. The wider Events namespace regression run passed 151 cases before the final focused additions. Persistence tests use EF InMemory; SQL locking and real service integration remain unverified.

Verification for inline arrangements (2026-09-11): `npm run build` passes TypeScript and Vite/PWA generation; `npm run test:event-composition` passes 60 tests. `dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Release --no-restore --filter "FullyQualifiedName~EventCompositionArchitectureTests|FullyQualifiedName~EventCreationArrangementsTests|FullyQualifiedName~EventVenue|FullyQualifiedName~EventOperations"` passes 54 tests. The arrangement browser script passes six language/viewport cases; the voice browser script also passes its focused error, cleanup and unsupported-browser checks. Documentation generation, `--check`, and `git diff --check` pass. Existing NuGet package-pruning and Vite mixed-import warnings remain.

Verification for the original four-step UI slice (2026-09-10): `npm run test:event-composition` passes 44 tests, including draft/override/candidate semantics, stale-request sequencing, duplicate-submission/retry handling and the retained poster edit entry. `dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Release --no-restore --filter FullyQualifiedName~EventCompositionArchitectureTests` passes 26 tests. Release output was used because the running local API locks Debug assemblies. `npm run build` passes TypeScript and the Vite/PWA production build; existing NuGet package-pruning and `idb-keyval` mixed-import warnings remain.

Signed-in local browser checks of that original slice exercised category/template selection without automatic navigation, draft recovery, bilingual language switching, preserving edited copy and visibility through a recurring-template switch, server-required hospitality locking, and entering/leaving final review. English/Chinese layout samples were inspected at 320px, 768px and 1280px; the new screens use the configured `md`/`desktop` breakpoints instead of the previously undefined `tablet` variant. No Event was submitted or published during browser checks. Live AI/poster generation, creation persistence and navigation after a successful create, and injected network/conflict failures were not exercised end-to-end. Documentation generation and `--check` pass, including the three-language overview structure validation.

## Approval boundary and reopening (2026-09-11)

The initial saved pipeline exposed details, arrangements, creation review and team/tools as repeatable steps before formal approval; the team/tools step is now merged into Arrangements as recorded above, including while submitted or returned/rejected. Approved preparation is frozen on the server. Pending reopening preserves the freeze; an eligible reviewer can reject or grant the request. Granting appends revocation history, invalidates occurrence approvals/execution, withdraws publication and closes new registration while preserving existing registrations. Poster production follows approval and is excluded from the Package. Direct stage URLs and the legacy detail editor enforce the same boundary. The route transition policy preserves mounted drafts across preparation stages; language changes retain entity state.

Migration `20260911023825_AddEventPreparationReopenRequests` has been generated and inspected, but not applied to any database. It creates only the request table, restricted foreign keys, concurrency field and filtered unique pending-request index. Deploying the preparation endpoints requires applying this migration through the authorised deployment process. SQL locking/concurrency, real AI/image services and deployed cache propagation remain unverified. No live Event, upload, approval/publication, shared database operation or Git publication is performed by the fixture checks.

Final backend verification: `dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj --no-restore --filter "FullyQualifiedName~Alife.Tests.Unit.Events" --logger "console;verbosity=minimal"` passes 170 tests. New cases cover repeatable submitted/returned/rejected preparation, freezing, reopening/reapproval, retained registrations, review authority, stale approval targets, ETags, idempotency, expiry, owner detail edits, submitted-copy freshness, saved visibility/registration facts, poster approval requirements, publication approval under off/dryRun/enforced modes, and private/no-store responses. `dotnet ef migrations has-pending-model-changes --project backend/src/Alife.Infrastructure --startup-project backend/src/Alife.Api --context AlifeDbContext --no-build` reports no pending model changes; it does not apply a migration.

Final frontend verification: `npm run test:event-composition` passes 65 tests; `npm run test:navigation-policy` passes 18. `npm run build` passes TypeScript and Vite/PWA production generation. The fixture flow exercises both languages at 320/768/1280px, repeated saved-detail edits, explicit module preview/acceptance, returned approval and resubmission, frozen direct routes, post-approval poster draft/adoption and conflict recovery, explicit publication, pending reopening, granted reopening and reapproval on the same Event. Language switching makes no stage refetch. Phone/desktop screenshots were inspected. Documentation generation and `--check` validate 114 API contracts and three equivalent overview structures. Existing NuGet pruning, EF tool/runtime version and Vite mixed-import warnings remain.

## Optional saved preparation tools (2026-09-11)

The saved draft Arrangements selector now exposes Yes/No for every module, including the five formerly locked required decisions: TEAM.WORK, PEOPLE.REGISTRATION, SERVICE.ROSTER, SAFETY.RAM and SAFEGUARDING.CHILD. Existing enabled choices stay selected. Recomposition and explicit acceptance honor No using the server-derived draft phase and preserve immutable snapshots, confirmed facts, owner and saved operational records. Formal Package manifests recheck required activation/dependencies, and submission/approval block missing required tools. Creation composition, non-draft retirement protections, freeze checks, API payloads and cache classifications remain unchanged; this slice adds no migration.

Verification against this source: the focused backend Event suite passes **172 tests**, including disable/reload/re-enable persistence with existing RAM/enrollments and mandatory submission/dependency checks. `npm run test:event-composition` passes **65 tests** and `npm run build` passes TypeScript and Vite/PWA generation. `tests/eventSetupFlow.browser.cjs` passes all **six** English/Chinese × 320/768/1280 scenarios, now exercising all five Yes/No controls, accepted payloads, reload, re-enabling and the existing approval/reopening sequence. Phone/desktop screenshots were inspected. Documentation generation and `--check` pass (114 API contracts; three equivalent overview structures). Browser APIs are fixtures and backend persistence uses an in-memory database; live SQL/service integration and the previously pending reopening migration remain unverified/unapplied.
## Shared preparation form and policy-based reply time (2026-09-11)

Creation and saved preparation use the same Details, Arrangements and Review components. The initial delivery redirected legacy edit routes into the saved pipeline; the interim compatibility restoration above supersedes that routing decision. The alternate workspace Plan editor remains replaced by a preparation link. The backend rejects changes to an existing template code/category. Saved creation-shaped roster/programme/venue rows use a manager-only occurrence read, retained IDs and ETags, and an optional atomic arrangements payload on Plan acceptance. Assigned slots, programme metadata and venue records survive edits. Recurring settings reuse the existing materializer through an optional transactional Event update; existing occurrences and exceptions remain, and frozen Events cannot change through the Series API.

Formal approval reads the effective published governance policy and explains matching Enhanced/Standard/Light conditions, including confirmed facts, enabled tools and template codes. The strictest matching tier applies. Its expected latest reply is precisely the Event/Occurrence start minus `preEventConfirmationWindowHours`, with policy version, hours, exact local time/timezone and overdue follow-up copy. Approval-validity durations remain separate; this expected date is not a new hard submission or decision gate. The read-only assessment is also included as an additive Package manifest snapshot.

Verification: `dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj --no-restore --filter FullyQualifiedName~Events --verbosity minimal` passes **188 tests**. Coverage includes group-policy priority, custom 24/96-hour reply windows, occurrence dates, candidate-fact exclusion, read authorization, overdue submission, fixed templates, arrangement identity/metadata, stale and foreign rows, preserved responses, idempotent acceptance, recurrence history and direct Series freeze protection. `npm run test:event-composition` passes **66 tests** and `npm run build` passes TypeScript and Vite/PWA generation. A static test for the removed legacy poster editor was replaced by browser coverage of the redirect and independent post-approval poster flow. The documentation generator validates **116 API contracts** and three equivalent overview structures.

Browser verification: `tests/eventSetupFlow.browser.cjs` passes all six English/Chinese × 320/768/1280 full-flow fixtures, including legacy edit redirects, locked template navigation, repeated detail and arrangement saves, persisted roster/session/item/booking IDs, retained venue capacity, exact policy-based reply date, returned approval, freeze/reopening, poster adoption, publication, language switching and overflow checks. A focused follow-up with `ALIFE_QA_WIDTHS=1280` and `ALIFE_QA_STOP_AFTER_ARRANGEMENTS=1` passes in both languages and additionally verifies that newly added slots use the selected later occurrence date. Phone and desktop approval-assessment screenshots were inspected. The final build and 66 frontend tests also pass after the occurrence-context change. `git diff --check` and documentation `--check` pass.

No new migration is required for this refinement. The earlier reopening migration remains unapplied. Backend checks use an in-memory database; live SQL transaction behavior, microphone/AI providers, deployed policy records and external publication were not exercised.


## Conversational event details assistant

The Details form header and AI assistant heading both display the selected template. The assistant heading omits “optional”; its input/send row stays above the latest-first conversation and includes a right-aligned return-to-form action with focus and reduced-motion support. Successful replies reveal the newest message. These presentation changes preserve the existing bilingual draft, session lifetime and API contract.

Presentation verification (2026-09-11): `npm run typecheck` passed; `node --test --experimental-strip-types tests/eventDetailsAssistant.test.ts tests/eventCreationDraft.test.ts` passed 15 tests. A temporary Playwright scenario against the current Vite source passed in English and Chinese at 320, 768 and 1280 pixels: both template labels, latest-first replies, input above history, return-to-form scrolling/focus (including reduced motion), preserved unsent text/conversation across template changes, and no horizontal overflow. Screenshots were inspected. All browser API responses were fixtures; no live AI request, Event creation or publication was performed.

The message label now includes Web Speech API dictation (`SpeechRecognition` / `webkitSpeechRecognition`, `zh-CN` / `en-NZ`). Final text appends to the editable message while interim text is previewed separately; only a later explicit send invokes the existing text API. Recognition stops on step/language changes, assistant collapse, page hiding/leaving and unmount; typed/final text survives failures. Unsupported browsers retain typing. No package, backend route, audio storage, paid service or API contract was added. The browser may use an online speech service, disclosed beside the control.

Voice verification (2026-09-11): `npm run typecheck` and the same 15 focused tests passed. `tests/eventDetailsVoice.browser.cjs` provides fixtures for standard/prefixed recognition and APIs. Its six English/Chinese layout scenarios passed at 320, 768 and 1280 pixels, covering explicit activation, interim/final deduplication, manual edits, final results during stop, repeat dictation and explicit text submission. A focused rerun with `ALIFE_VOICE_SKIP_LAYOUT=1` passed permission/device/silence/network/language/start failures, stop timeout, length limits, step/collapse/tab/language/unmount cleanup, late-result rejection and unsupported-browser typing. The script uses `ALIFE_PLAYWRIGHT_MODULE` for the existing Playwright installation and `ALIFE_BROWSER_BASE_URL` for the Vite URL. Screenshots and three-language generated documentation were checked. Real microphone capture and browser speech-provider accuracy/availability were not exercised.

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
| Current | `TEAM.WORK` | Event team, accepted roles, cross-module tasks/dependencies/blockers, protected APIs, ETags, readiness, and reachable team UI |
| Current | `PEOPLE.REGISTRATION` | Enrollment persistence and CRUD, self/manager projections, lifecycle/RAM gates, and reachable enrollment UI |
| Current | `SERVICE.ROSTER` | Occurrence slots, availability, assignment/response/substitution, eligibility/readiness, protected APIs, and reachable roster UI |
| Current | `SAFETY.RAM` | Church policy/matrix/question versions, dual assessment, personal confirmation, independent review, re-review, minimal Package evidence and protected version printing |
| Current | `SAFEGUARDING.CHILD` | Explicit child/guardian/consent/collector records, occurrence check-in/out, policy-backed worker evidence, minimum projections, private APIs, and reachable workspace |
| Current | `PROGRAM.PRODUCTION` | Occurrence Sessions and ProgramItems, ordering, run sheet, concurrency, protected APIs, and reachable programme UI |
| Current | `PLACE.RESOURCE` | Venue catalogue/capacity, Event/Occurrence reservations, overlap checks, release history, private APIs, and reachable resource UI |
| Current | `MOVE.STAY` | Driver/vehicle evidence, occurrence journeys and stops, restricted manifest, self projection, capacity/readiness, private APIs, and reachable travel UI |
| Partial | `COMMS.FOLLOWUP` | Bilingual Event content, public/group projections, notification foundation and Event review CRUD; no complete module workspace or delivery audit |
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
- RAM automatic expiry, a separate incident register and wider incident close-out remain outside this delivery; versioned policy, explicit review rules and material-change re-review are implemented.
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


### Arrangement section confirmation and module role placement

Implemented in the worktree: duplicate fact controls removed; seven default-false section review markers persist through Plan composition/acceptance and invalidate on edits; module roles/invitations moved to their owning modules, with global accountable owner and Review summary. Existing authorization, personal acceptance and approval gates remain. Additive Plan JSON and audit records require no new migration. Local verification is recorded in the implementation delivery; no deployment or shared-database migration performed.


## Module operational notes retained on 2026-09-16

These original module snapshots and proposed next slices are historical, not a fresh implementation or test result. Normative behavioral details remain in their modules.

### COMMS.FOLLOWUP — Current implementation

Partial. Bilingual Event content, public/group projections, poster preparation/publication, in-app notification foundations and Event Review CRUD exist. They do not form a complete Event communications workspace or audited broadcast lifecycle. The retired generic workflow surface is not a current communications capability.

The [continuous preparation flow](EVENT-SETUP-FLOW.md) provides a separate post-creation poster studio after formal approval. It reuses the existing AI/image services, requires human preview/adoption, and saves only the poster association through an authorized, no-store, ETag/idempotency-protected API. Poster drafts remain local until adopted. Explicit publication after active approval uses existing audience-filtered projections. Poster artwork is outside formal approval by product contract; adoption preserves Package validity. Audited broadcasts remain incomplete.

### COMMS.FOLLOWUP — Open contract gaps

Audience snapshot, approved publish/change broadcast, delivery state, newcomer/prayer purpose controls, incident follow-up, retention, and dedicated module UI/API remain open.

### COMMS.FOLLOWUP — Next useful vertical slice

`audited-event-change-broadcast`: explicit human confirmation, in-app delivery, audience snapshot, message version, delivery result, non-destructive retry, and withdrawal audit.

### FESTIVAL.OPERATIONS — Current implementation

Target only. Zone and ServiceSlot persistence foundations, multi-zone composition, dependency/role/readiness definitions, and a generic controlled surface exist. A live festival operations API and reachable business flow do not.

### FESTIVAL.OPERATIONS — Open contract gaps

Zone/stall operational state, crowd flow, first aid, lost-child handling, command log, weather/evacuation, incident escalation, and all dedicated API/UI behaviour.

### FESTIVAL.OPERATIONS — Next useful vertical slice

`festival-zone-command`: zone plan and lead, open/paused/closed state, command-level incident escalation, and overall readiness; a live map remains deferred.

### FOOD.HOSPITALITY — Current implementation

Partial report support: accepted lead, bilingual drafting/submission/return/adoption, immutable history and independent work page. Menus, dietary/allergy records and kitchen operations remain target work.

### FOOD.HOSPITALITY — Open contract gaps

Menu, headcount, dietary/allergy summary, purchasing, kitchen shifts, food-safety evidence, vendor, serving, cleanup, and all dedicated API/UI behaviour.

### FOOD.HOSPITALITY — Next useful vertical slice

`dietary-menu-safety`: registration-derived dietary needs, an authorised minimum allergy summary, menu/servings, food-lead safety sign-off, and no health-record duplication.

### MONEY.FINANCE — Current implementation

Partial registration-fee support: versioned rules, independent approval, manual receipts/refunds, current authorization, audit and a dedicated registration/finance work page. Broader finance capabilities below remain target work.

### MONEY.FINANCE — Open contract gaps

Budget, purchasing, claims, ledger reconciliation and wider financial close-out remain deferred; registration fees, their approval and manual refund evidence are provided in version 1.

### MONEY.FINANCE — Next useful vertical slice

`event-budget-expense-closeout`: minor-unit budget lines, expense claim, independent approval, reconciliation, role-restricted no-store responses, and no payment-provider dependency.

### MOVE.STAY — Current implementation

Current transport slice. Driver/vehicle evidence, occurrence pickup journeys, ordered stops, history-preserving passenger assignment, capacity validation, exact coordinator authorisation, restricted/full and personal/minimum projections, ETags/idempotency, RAM/readiness integration, private APIs, and reachable `EventTravelWorkspace` exist.

### MOVE.STAY — Open contract gaps

Parking, accommodation, room allocation, accommodation check-in/out, overnight duty, and hotel/provider integration remain open.

### MOVE.STAY — Next useful vertical slice

`accommodation-room-allocation`: provider record, room capacity/allocation, check-in/out, and overnight duty without external provider integration.

### PEOPLE.REGISTRATION — Current implementation

Current core flow includes server-owned confirmed/waitlisted/cancelled states, capacity summary, self queue position and manager lists, FIFO eligible promotion, transactional in-app notifications, retained cancellation/answer history, and serializable Event-lock concurrency. Existing enrollment IDs, bilingual JSON and linked child evidence survive cancellation/rejoining. Reopening and approved capacity increases reconcile the queue; closed/expired/blocked enrollment retains waiters. New clients explicitly opt into waiting; old full-capacity clients receive an upgrade conflict. RAM gating follows current Plan/safety requirements. See [the first-round contract](EVENT-CONTRACT.md#preparation-first-round-contract-extension--2026-09-13).

### PEOPLE.REGISTRATION — Open contract gaps

Direct invitation, household/guest modelling, tickets, general occurrence check-in, and attendance reconciliation remain open. Enrollment remains one account per Event, not per occurrence.

### PEOPLE.REGISTRATION — Next useful vertical slice

General occurrence check-in and attendance reconciliation, after validating the current account-based capacity flow in an authorized environment.

### PLACE.RESOURCE — Current implementation

Current venue slice. Reusable venue catalogue/capacity, Event and occurrence reservations, history-preserving release, half-open overlap detection, ETags, idempotency, exact coordinator authorisation, readiness, occurrence-local Package invalidation/review, private APIs, reachable `EventVenueWorkspaceSurface`, and legacy `Session.PlaceJson` compatibility exist.

### PLACE.RESOURCE — Open contract gaps

Equipment catalogue/allocation, setup, close-down, handover, return, and optional typed Session → Venue linking remain open.

### PLACE.RESOURCE — Next useful vertical slice

`resource-equipment-allocation`: equipment catalogue, quantity allocation, availability conflict, and existing-workflow contribution; setup/handover/return remain deferred.

### Shared preparation editor

Saved creation-form edits retain booking IDs, release removed bookings and revalidate venue ETags, capacity and overlapping reservations within Plan acceptance. The occurrence-scoped read and atomic Plan/arrangement save are specified in [EVENT-SETUP-FLOW.md](EVENT-SETUP-FLOW.md).

### PROGRAM.PRODUCTION — Current implementation

Current core flow. Occurrence Session and ProgramItem CRUD, owners, reordering, occurrence ETags/If-Match, print run sheet, series-occurrence isolation, protected APIs, and reachable `EventProgrammePanel` exist.

### PROGRAM.PRODUCTION — Open contract gaps

Typed speakers/performers, content approval, rehearsals, technical cues, livestream, and presentation mode remain open.

### PROGRAM.PRODUCTION — Next useful vertical slice

`programme-cue-approval`: content confirmation, technical cues, rehearsal checklist, and contributions to the existing Event workflow.

### Shared preparation editor

Saved creation-form edits preserve session/item IDs, lead/owner assignments and advanced content; retained service-slot references prevent removal. The occurrence-scoped read and atomic Plan/arrangement save are specified in [EVENT-SETUP-FLOW.md](EVENT-SETUP-FLOW.md).

### SAFEGUARDING.CHILD — Current implementation

Current core flow. Explicit Enrollment-linked child records, confirmed guardian relationships, policy-bound consent, guardian-managed collectors, occurrence check-in/verified check-out, worker evidence, policy-backed readiness, ETag/idempotency, append-only minimal audit, exact server authorisation, minimum projections, private APIs, and reachable `EventSafeguardingWorkspace` exist.

### SAFEGUARDING.CHILD — Open contract gaps

Full health-record integration, incident escalation, cross-Event worker-certification lifecycle, advanced policy administration, and policy-authorised re-entry remain open.

### SAFEGUARDING.CHILD — Next useful vertical slice

`safeguarding-incident-escalation`: a minimum role-restricted incident record linked to the existing workflow and RAM evidence; full health records and broad policy/certification administration remain deferred.

### SERVICE.ROSTER — Current implementation

Current core flow includes four-date pages, role/response filters, desktop date/position tables and mobile date groups. Managers stage assignments/replacements/cancellations in memory, review a summary and send one atomic idempotent batch with occurrence and candidate-group versions. Pending and confirmed assignments together cannot exceed demand; all selections must pass current group/qualification/availability checks. Any conflict retains the draft and commits no assignments or notifications. Single-date compatibility APIs use the same batch service. Invitations, self responses, replacement-end and manager-result notices use in-app notifications and current personal duties; all reads/writes are private/no-store.

### SERVICE.ROSTER — Open contract gaps

Leave windows and separately versioned external eligibility evidence remain open. Automatic rotation/recommendations, email and device push are outside this round.

### SERVICE.ROSTER — Next useful vertical slice

Versioned external eligibility evidence after validating manual staffing in an authorized environment.

### Shared preparation editor

Saved creation-form edits preserve slot IDs, programme links and member responses; slots with responses cannot be removed. The occurrence-scoped read and atomic Plan/arrangement save are specified in [EVENT-SETUP-FLOW.md](EVENT-SETUP-FLOW.md).

### Explicit candidate groups

`GET/PUT /api/events/{id}/roster/groups` manages an ordered, at-most-200-member candidate list per role and its owning module. Only the accountable owner or accepted roster coordinator can manage/read full groups. PUT requires `If-Match` (`"new"` for first creation); all candidates must be approved members of the Event's owning group. Lists do not grant module permissions or accept invitations. New assignments and substitutes must belong to the explicit role group and pass eligibility/availability checks; no group means no new assignment. Existing assignments remain intact. Full candidate IDs appear only in manager roster responses; other viewers receive a self-candidate flag. Approved candidate members may read their personal roster state before assignment and record their own availability, without receiving other members’ assignments or candidate identities.

The new migration creates candidate-group storage only and invents no groups or members. Review and apply it only to an authorized environment. Configuration respects preparation freezing, audits changes, renews occurrence ETags and uses group concurrency during assignment. Candidate ordering is manual and does not implement rotation.

### TEAM.WORK — Current implementation

Current. Event team invitations, accepted roles, dependencies, blockers and deadlines retain their domain APIs. Ordinary tasks now have a named independent reviewer, approval status and immutable submission/action rounds; ETags, idempotency, current membership and specialist-source guards enforce handoff. Personal Center discovers live duties without notification records and opens restricted task details. Approved configuration remains frozen.

### TEAM.WORK — Open contract gaps

Reusable task templates and a general artifact repository remain outside this slice. In-site invitation discovery, ordinary task approval history and current duty handoffs are implemented; external delivery is not included.

### TEAM.WORK — Next useful vertical slice

Apply the additive task-approval migration to an approved environment, then exercise multi-account business handoffs against that database. See [Event duties](EVENT-DUTIES.md) for the complete current contract.

## Documentation ownership migration — 2026-09-16

This task changes documentation only. Core composition and Package sections moved to their named topics; core ADRs, privacy and compatibility remain. Detailed split-section destinations:

| Previous section | Destination |
| --- | --- |
| Versioned RAM governance (policy and assessment) | [Source of truth](modules/SAFETY.RAM.md#policy-and-assessment-compatibility) |
| Versioned RAM governance (module confirmations) | [Source of truth](CREATION-ARRANGEMENTS.md#module-confirmation-compatibility) |
| Creator ownership and role-based staffing (ownership) | [Source of truth](modules/TEAM.WORK.md#creator-and-series-ownership) |
| Creator ownership and role-based staffing (candidates) | [Source of truth](modules/SERVICE.ROSTER.md#candidate-authority) |
| Creator ownership and role-based staffing (details and timestamps) | [Source of truth](EVENT-SETUP-FLOW.md#details-placement-and-timestamp-compatibility) |
| Personal Center duties and task approval | [Source of truth](EVENT-DUTIES.md#projection-compatibility) |
| Preparation first-round extension: RAM authoring | [Source of truth](modules/SAFETY.RAM.md#manual-ai-authoring-boundary) |
| Preparation first-round extension: registration | [Source of truth](modules/PEOPLE.REGISTRATION.md#version-0-seat-and-waitlist-compatibility) |
| Preparation first-round extension: manual staffing | [Source of truth](modules/SERVICE.ROSTER.md#atomic-manual-scheduling) |
| Preparation first-round extension: defaults and approval | [Source of truth](modules/SERVICE.ROSTER.md#default-requirements-and-approval-coverage) |
| Preparation first-round extension: availability and compatibility | [Source of truth](EVENT-WORKSPACES.md#capability-availability-and-version-boundaries) |
| RAM synchronization extension — 2026-09-15 | [Source of truth](modules/SAFETY.RAM.md#authorized-synchronization-exception) |
| Activity-plan authority and RAM review (2026-09-15) | [Source of truth](modules/TEAM.WORK.md#activity-authority-across-modules) |
| EVENT-WORKSPACES: RAM context and handoff | [Source of truth](modules/SAFETY.RAM.md#ram-context-and-handoff) |
| EVENT-WORKSPACES: Registration rules and actual participants | [Source of truth](modules/PEOPLE.REGISTRATION.md#registration-rules-and-actual-participants) |
| EVENT-WORKSPACES: Private registration materials | [Source of truth](modules/PEOPLE.REGISTRATION.md#private-registration-materials) |
| EVENT-WORKSPACES: Manual registration fees | [Source of truth](modules/MONEY.FINANCE.md#manual-registration-fees) |
| EVENT-WORKSPACES: Independent venues and rooms | [Source of truth](modules/PLACE.RESOURCE.md#independent-venues-and-rooms) |
| EVENT-SETUP-FLOW: module confirmation semantics | [Source of truth](CREATION-ARRANGEMENTS.md#independent-module-confirmation) |
| Human and AI authority boundary (details assistant) | [Source of truth](AI-DETAILS-ASSISTANT.md#draft-authority-and-time-adoption) |
| Interface composition (lifecycle and routes) | [Source of truth](EVENT-SETUP-FLOW.md#lifecycle-and-routing-compatibility) |

## Documentation simplification verification — 2026-09-16

Documentation, reading policy, the frontend skill and documentation validation only; no application code, machine-contract values, database or deployment changed. The original status snapshot is retained in full above. Module history is preserved separately; nested saved-editor/candidate compatibility clauses remain normative in the modules. Core split destinations and old bookmarks are recorded above/in the core map. Duplicate report rules point to the shared report contract. Version-1 finance/food/registration and the explicitly scoped new-task assistant supersede older descriptions only in their documented scope.

| Reading set | Before characters | After characters | Reduction |
| --- | --- | --- | --- |
| Core contract + current status | 170,628 | 29,082 | 83.0% |
| Same baseline reading set (root/Event AGENTS + core/status) | 182,994 | 43,768 | 76.1% |
| Three-language overview | 26,019 | 8,665 | 66.7% |

Counts use Unicode characters with normalized newlines. For mostly English core/status, the prior 3–5-character/token estimate falls from roughly 34,000–57,000 to 6,000–10,000 tokens for one full read. This is a document-size estimate, not measured token billing, account usage or total task latency. Topic-specific sections and implementation/tests remain additional reading; no hard token gate was introduced.

Verification against the reorganized sources:

- Generation and `node docs/events/scripts/generate-event-docs.mjs --check` passed: 12 modules, 4 archetypes, 16 activity types, 175 API contracts and three equivalent overview structures. The pre-existing stale handbook was regenerated through the script.
- `node --test docs/events/scripts/generate-event-docs.test.mjs` passed four focused tests: valid compact overview; missing locale/link/structure rejection; bilingual/duplicate/legacy anchors; missing destination/fragment rejection. All Event Markdown/HTML file links and Markdown fragments were checked, including moved core anchors.
- Playwright exercised the generated local overview in Simplified Chinese, Traditional Chinese and English at 320/1280px (six combinations), checking single visible panel, six topic headings, twelve module links, no horizontal overflow, keyboard language switching and no script errors. Desktop/mobile screenshots and the three-language content were inspected. This covers documentation presentation, not application workflows.
- The official skill quick validator could not run because PyYAML is absent in both existing Python runtimes. No dependency was installed. Fallback checks confirmed unchanged frontmatter, valid existing name/description constraints, intact local links, balanced fences and no unfinished placeholders; the new reading-matrix anchor was checked separately.
- `git diff --check` passed. Historical application test counts were not rerun or relabeled as current results. No shared migration, provider call, external communication, Git publication or deployment was performed.
