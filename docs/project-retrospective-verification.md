# ALIFE Engineering Retrospective verification

**Scope:** proposed March–September 2026 history
**Repository state inspected:** `main` at `9a4055e1`, 16 September 2026
**Purpose:** separate repository-supported history from plans, current source, deployment claims, and personal context.

## Executive findings

1. **The repository does not support a March start date.** There are no commits on `main` in March 2026. The first reachable commit is `aa40bda3` on 14 April. The migration named `20260327025721_InitialSqlServer.cs` was first committed on 14 April (`d6cac408`), so its filename is not evidence of March project activity.
2. **The proposed two-phase interpretation is directionally useful but too coarse.** A better evidence-based division is:
   - 14 April–15 May: platform foundation and feasibility;
   - 17 May–26 August: integrated alpha productisation;
   - 27 August–16 September: governance-heavy identity and Event domain engineering.
3. **The original July retrospective is now materially stale.** Passkeys, account applications and recovery, publication snapshots, Event composition, Event Package Approval, recurrence, operational modules, rosters, collaboration workspaces, and governed RAM all landed after its evidence window.
4. **Current source is not the same as deployed or user-validated capability.** The repository contains substantial implementation and tests, but production deployment, shared-database migration state, live provider behaviour, and real-user outcomes were not established by this audit.
5. **The issue totals in the old retrospective cannot be independently verified from the present environment.** GitHub CLI credentials are expired and the repository is not available through the public web index. Local history supports 398 distinct merged-PR identifiers and 528 distinct `#` references in commit subjects, but not current issue state.

## Evidence method and limits

Evidence was reconstructed from reachable `main` history, commit bodies and diffs, current source, migrations, tests, architecture documents, Event status/history documents, package manifests, routes, controllers, and removed implementations. Commit dates below are Git committer dates (`%cs`).

The following distinctions are used throughout:

- **Implemented:** persistence or durable state where required, server-authorised API, and reachable application flow are present.
- **Partially implemented:** a usable bounded slice exists, but named scope remains absent.
- **Documented/planned:** contracts, prompts, schemas, or status documents exist without a supported end-to-end flow.
- **Historically implemented, now retired:** code landed and was later removed from the supported product.
- **Operationally unverified:** source and tests exist, but deployment/provider/shared-database state was not verified.

Issue and PR numbers are included only when recoverable from commit subjects or bodies. A closed issue or merged PR is not treated as proof of production deployment.

## Verified timeline

### March 2026

**Major capabilities introduced:** none supported by Git history.

**Major changes and architecture decisions:** none supported by Git history.

**Evidence:** `git log main --since=2026-03-01 --until=2026-04-01` returns no commits. `20260327025721_InitialSqlServer.cs` entered the repository only in `d6cac408` on 14 April.

**Correction:** describe March as unverified pre-repository work, if Stephen confirms it, rather than as an engineering phase established by Git.

### April 2026 — repository bootstrap, identity choice, and deployable boundaries

**Major capabilities introduced**

- Initial .NET domain/API and SQL persistence, including `Page`, structured `Section`, `Member`, group and sermon models (`d6cac408`, 14 April).
- YouTube playlist-backed sermon ingestion and asynchronous read behaviour (`e7833c74`, `5c4901d4`, 15 April).
- React demo frontend (`bf368830`, 15 April) and PWA assets/service worker (`bbc2fe9a`, merged by `caa6a0d9`, 16 April).
- LINE OAuth authorization-code login, `LineUID`, JWT claims, and onboarding integration (`8b0df29b`, 16 April; PR #10 merged by `fc8b983e`).
- Rich responsive shell with bottom/side navigation, drawer, FABs, and early page templates (`adadc3ee`, PR #28; `abb87069`).

**Major changes**

- Guest-member GUID creation was removed (`f5a27ec7`, PR #4).
- A short-lived Twilio/SMS path was first made skippable (`d8b482b7`, PR #8) and then removed when LINE became the only registration route (`d0e5ad29`, PR #22, 22 April).
- The API stopped hosting SPA concerns and exposed Swagger (`40be5cec`, PR #12).
- Backend hosting moved to Azure Functions isolated worker (`739b259a`, PR #14); container/local architecture work followed (`b78237a1`, PR #20).

**Architecture direction**

- Separate browser application, API, persistence, and deployment concerns.
- Use server-issued JWTs in HttpOnly cookies rather than browser-held identity tokens (`AuthCookie.cs`; `JwtTokenService.cs`; commit `60c19236`).
- Preserve Pages as structured aggregates, not unstructured HTML blobs: the initial `Page` had a collection of typed `Section` records with `ContentJson`, `StyleJson`, ordering, and links (`d6cac408`).

**Technologies introduced or removed:** React/Vite, PWA service worker, LINE OAuth, JWT/cookies, Azure Functions, Docker support; Twilio phone verification removed.

### May 2026 — caching, Cloudflare, Events, AI sessions, bilingual editing

**Major capabilities introduced**

- `vite-plugin-pwa` service-worker management (`de632148`, PR #59).
- Cloudflare Worker proxy/configuration and a separate image Worker (`14752e3c`, `18c830b4`, PRs #57/#68).
- TanStack React Query, React DB, and query-db collections (`898ab5cf`, 8 May); ETag/soft-delete sync support (`824df204`, PR #66).
- Semantic Event extraction/creation UI (`f43f4f2f`, 11 May), durable AI state (`5708c850`, PR #80), persisted `GroupEvent` CRUD (`c77a60d0`, PR #82; dedicated controller/tests in `21048c41`, PR #86).
- Leader Event editing (`c350f817`, PR #104), end-to-end enrollment (`198964af`, issue/PR #105), and Durable Object AI sessions for planning/enrollment (`faaa0a47`, PR #110; `936f0c23`, PR #112).
- Shared page rendering/editing and WYSIWYG section workflow (`5fd762f8`, PR #118), bilingual Page aggregate (`b2e84aeb`, PR #128), bilingual sections without language refetch (`6730afba`, PR #136).
- Persisted Event review with AI-assisted drafting (`847eac1f`, issue #174; PR #175).

**Major changes**

- Group views moved from profile-like screens to page-centred content and separate leader tools (`67f59776`, PR #35; `9f1857de`, PR #39; `4c2c5240`, PR #48).
- Cache responsibility was divided across browser conditional storage, Cloudflare, and origin rather than duplicated blindly (`df568d00`, PR #134; `9d2b5ea0`, PR #144).
- Group cache reads gained a KV-based membership authorization mirror (`1c4ff681`, PR #148).
- Controllers began moving toward MediatR commands/queries (`f2208277`, PR #179).

**Architecture direction**

- AI conversation state stayed temporary in Cloudflare Durable Objects; accepted Event/enrollment/review records were committed through backend APIs.
- Bilingual content shifted from a single Page `Language`/plain title model to `{ en, zh }` JSON contracts (`20260525084708_PageAggregateMultilingual.cs`).
- The client adopted both TanStack Query and TanStack DB; it is inaccurate to describe the May change as React Query alone.

**Technologies introduced or removed:** Cloudflare Workers, Cache API proxying, image Worker, TanStack Query/DB, ETags, Gemini extraction at the edge, Durable Objects, MediatR.

### June 2026 — Page Builder V2, independent speed layer, roles, and public governance foundation

**Major capabilities introduced**

- Page Builder V2 normalisation, shared headers, simplified section types, and Spotlight (`f6fb2ae1`, `965937b1`, `113fa7a5`, `3608b67c`, 2–3 June).
- Independent `speed-layer` package and deployment boundary (`b1e8821f`, PR #208; `952ce976`, PR #210; workflow changes in PRs #212/#217).
- Anonymous church lookup/guest content with authorization before group cache reads (`17f34391`, `683dff54`, `bd39410d`, PR #226).
- Multiple Event reviews and a fuller Event detail view (`feb475f6`, PR #243).
- Membership approvals/invitations, role administration, and notification APIs/UI (`b70adb9e`, #256; `515e8c33`, #258; `c0706765`, #262; `4e485c13`, #264; `bfe45b5b`, #268).
- Terraform, architecture documents, and one-command local startup (`a2cf850c`, #310; `ddf741bc`, #312; `ae79ef6f`, #352).
- Platform roles/audit data, role claims, admin APIs, and an admin shell foundation (`ed500364`, #364; `ef2e8ccb`, #366; `363313c6`, #372; `605cf73a`, #374).
- TinyMCE-backed rich text/image support (`05bfc74b`, #402) and graceful save when AI translation fails (`979a4b1f`, #404).

**Major changes**

- Shared edge storage changed from Workers KV to Cache API for local shared caching (`5b069fa5`, PR #239), while later work reintroduced KV for a different purpose: cross-PoP L2 storage for public pages.
- App language moved from account/JWT state to local browser state (`503ff06a`, #298; account field removed by `a6f51622`, #304).
- A global Page ownership path was added (`02fb88fd`, #370). This was an intermediate model, not the final public CMS architecture.

**Architecture direction**

- Frontend and edge runtime became separately buildable and deployable packages.
- Public/guest access and group-shared caching were treated as authorization-sensitive, not merely as route visibility.
- Page building moved from content-specific types toward display-pattern primitives with legacy normalization (`docs/codex/page-builder-v2.md`).

### July 2026 — governed public CMS, broader community features, cache hardening, and first RAM gate

**Major capabilities introduced**

- Page reviewer role and review queue (`34d17fc7`, #406), FileAsset APIs/migrations (`78510410`, #426), and visitor contact flow (`48f7be35`, #427).
- Public forum MVP (`b8cbb556`, #448), public shell (`e38786a0`, #450), sermon discussions (`573451b7`, #468), Bible reader/progress (`ad3c28ad`, #490), announcements (`decefd9b`, #493), albums (`7509a6ed`, #499), contacts/inquiries (`e076e61b`, #505), and content archive/import (`706efa74`, #532; `df9f51f8`, #534).
- Configurable public page menus and homepage placement (`337b4b50`, #509; `586336c1`, #513; `08771bee`, #517).
- Event lifecycle action rules (`c369f1e9`, #562) and initial RAM draft/submission/approval gate (`09f95fe1`, #566; refined in `3374d6d4`, #568; `93209966`, #570).

**Major changes**

- The global-page ownership model was retired. Pages remained group-owned while review/publication became separate governance state (`21cf1187`, #455; `6469525f`, #458; migration `20260707100904_RetirePageScope.cs`).
- Editing and review interactions were unified and protected against unsaved navigation (`7f431baf`, #452; `388df270`, #477; `0c9d6159`, #479).
- Bilingual validation and media selection hardened the authoring path (`cdc8e101`, #481; `ddcca56f`, #487).
- Public cache invalidation was corrected for sermon query variants/cross-PoP behaviour (`a0052fef`, #550). Public pages gained Cache API L1 plus KV L2 prewarming (`4ce018cc`, #554).

**Architecture direction**

- Public publication became a governed projection of group-owned content.
- Public cache entries, group-shared entries, and member-specific responses received distinct storage and invalidation policies.
- “Review” still meant post-Event reviews or RAM review; it was not a fifth Event lifecycle stage.

### August 2026 — navigation consolidation, identity redesign, publication snapshots, and Event architecture prototype

**Major capabilities introduced**

- A group-owned generic Event workflow/artifact implementation (`a3981bba`, #592) and custom templates (`fab57ae4`, #652). This implementation was later retired.
- Privacy-safe group forums (`1ff8ccff`, #614), cached public homepage (`306c7399`, #626), unified workspace/navigation changes (`b2982aac`, #640; `8752a574`, #645; `b265b9c1`, #647).
- Phone-based alpha account login replacing display-name matching (`c8e4d9fe`, #667).
- Event composition prototype: archetypes/activity templates, plans, series/occurrences, roles, venues/conflicts, safeguarding, transport, and operations (`efcda7ef`, #693, 27 August; multiple additive migrations).
- Working/submitted/published Page snapshots, optimistic concurrency, public/working-copy separation, and cache invalidation (`57d2ce1b`, #697, 31 August; migration `20260830083534_AddPagePublicationSnapshots.cs`).
- Redesigned identity/onboarding with Passkey persistence, ceremonies, invitations, internal alpha login, and management APIs (`e84f34f5`, #695); first Passkey bootstrap/release metadata (`338409e8`, #699).

**Major changes**

- The CMS gained actual publication-copy isolation. Before 31 August, “versioning” should not be claimed beyond current page state and review records.
- Event Management changed from CRUD plus a generic workflow toward deterministic composition and controlled capability modules. The August 27 commit was both code and a target architecture; later September commits made more of that target reachable.

**Architecture direction**

- Published content no longer had to change immediately when a working copy entered review.
- Identity shifted from LINE/alpha convenience toward WebAuthn credentials, explicit invitation/activation state, rate limiting, and auditable recovery.
- Release metadata (`VERSION`, `CHANGELOG.md`) appeared, but the repository still has no Git tags; these version labels are not independently verified GitHub releases.

### September 2026 through 16 September — Passkey recovery and capability-oriented Event domain engineering

**Major capabilities introduced**

- Safe Passkey diagnostics (`bb3ad544`, #701) and manual first-activation delivery (`eb1a4b9e`, #703).
- Event Package Approval with immutable Package evidence, governance policy, delegation, conditions, and lifecycle gates (`1ec35845`, #705, 3 September; seven migrations).
- Browser continuation and member Passkey recovery (`f34d3496`, #715); email/provider and activation/account recovery (`945db2db`, #721); public church applications and phone-oriented Passkey entry (`46d952bf`, #723).
- Group types and multi-group directory (`b77d9b99`, #727; `8a05ea3f`, #729).
- Conversational Event details assistant (`79a1dcc9`, #745), nonlinear preparation and approval/reopen gates (`de9aa093`, #747), versioned RAM and arrangements (`5dcb1fcd`, #751), creator ownership/role staffing (`55098f7b`, #753), module confirmations (`63c4942e`, #757).
- Event duties/task approval (`d49b29cb`, #765), RAM authoring plus capacity/waitlist/manual rosters (`f34b01c6`, #775), collaboration workspaces (`a8d3095f`, #786), activity planning/delegation/RAM synchronisation (`9380b057`, #791), shared AI form assistants (`271f271c`, #793).

**Major changes**

- The generic `EventWorkflowRun`/step/template/artifact application flow was removed on 13 September (`c4110cb4`, #763). Historical tables were retained for compatibility, while supported work moved to dedicated RAM, duty, preparation, report, registration, venue, safeguarding, travel, roster, and Package flows.
- Event management moved into a shared workspace (`848e16b5`, #761) and preparation became explicitly nonlinear. Plan B remained excluded.

**Architecture direction**

- Event = accepted facts + structures + capability modules + policy + human decisions, with immutable accepted Plan/Package evidence.
- AI remains a draft assistant; it cannot confirm facts, assign authority, approve, publish, or persist an accepted Plan.
- Sensitive Event data is `private, no-store`; only sanitised public projections are share-cacheable (`docs/events/EVENT-CONTRACT.md`).

## Phase interpretation

### Proposed Phase 1: “Architecture Exploration and Product Feasibility,” March–May

**Partly supported, with corrections.** April through mid-May clearly explored deployment, identity, PWA, caching, Cloudflare, TanStack, AI extraction, and the first Event model. March is unsupported. By 17–27 May the repository already contained persisted CRUD, enrollment, review, WYSIWYG editing, bilingual storage, server authorization, and tests, which is more than feasibility work.

### Proposed Phase 2: “Productisation and Domain Engineering,” June–September

**Supported in direction, but the start is late.** Productisation was underway in the second half of May. June–July established independent edge architecture, role administration, a governed public CMS, broader workflows, and operational hardening. The strongest “domain engineering” boundary is 27 August, when the Event composition model and operational modules landed, followed by Package Approval and specialist workspaces in September.

### More accurate division

| Phase | Dates | Evidence-based description |
| --- | --- | --- |
| Foundation and feasibility | 14 April–15 May | Initial domain/API/PWA, LINE identity, Azure Functions, Cloudflare/TanStack experiments, first AI Event creator and persisted Event root |
| Integrated alpha productisation | 17 May–26 August | CRUD/enrollment/review, bilingual CMS, independent edge layer, roles, publishing governance, community features, cache/privacy fixes, early RAM and workflow experiments |
| Governance-heavy domain engineering | 27 August–16 September | Publication snapshots, Passkeys/activation/recovery, Event composition/recurrence/modules, Package Approval, duties, rosters, collaboration, versioned RAM; generic workflow retired |

## Verification of specific technical claims

### Early architecture

| Claim | Finding | Evidence / correction |
| --- | --- | --- |
| LINE authentication | **Implemented 16 April; made exclusive 22 April; still retained as configurable legacy entry.** | `8b0df29b`, `d0e5ad29`; `LineLoginService.cs`; `IdentityAccessConfiguration.LineLegacyEnabled`. It is no longer the whole current identity architecture. |
| TanStack Query | **Implemented 8 May, alongside TanStack DB.** | `898ab5cf`; current `package.json`, `AppProviders.tsx`, collections and `useQuery` usage. Do not describe it as only a server-state cache. |
| Client-side caching | **Implemented and repeatedly redesigned.** | May conditional/IndexedDB helpers; current `httpCache.ts`, React Query/DB; `docs/pwa.md`. Service worker explicitly avoids replaying `/api/*` responses. |
| Structured Page Sections | **Implemented in the initial 14 April commit.** | `d6cac408`: `Page`, typed `Section`, `ContentJson`, `StyleJson`, ordering and links. |
| YouTube channel integration | **Implemented from the initial repository and corrected 15 April.** | `YoutubeService.cs`; `e7833c74`, `5c4901d4`; later metadata/cache fixes `e9d705de`, `a0052fef`, `ae827e70`. It is playlist synchronisation, not a general channel-management integration. |
| Cloudflare architecture/caching | **Introduced 7–8 May; separated 4 June; materially redesigned through July.** | `14752e3c`, `32994da0`, `952ce976`, `5b069fa5`, `4ce018cc`; `docs/speed-layer_architecture.md`. |
| Early CMS | **Implemented as structured Page/Section CRUD from 14 April, but not yet the later governed public CMS.** | `d6cac408`; WYSIWYG `5fd762f8`; V2 `113fa7a5`; publication governance July; snapshots August. |
| Early Event create → enrol → review lifecycle | **Implemented incrementally in May, but “review” was post-event review, not a lifecycle stage.** | create/CRUD `c77a60d0`/`21048c41`; enrollment `198964af`; review `847eac1f`; multiple reviews `feb475f6`. Current lifecycle stages are preparation, registration, execution, followup. |

### CMS evolution and present maturity

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| Page model | **Implemented** | Initial Page in `d6cac408`; current group-owned `Page.cs`; global `Page.Scope` removed by `6469525f`. |
| Section model | **Implemented** | Structured `Section.cs` from 14 April; V2 schema/normalisation in early June; controlled rendering/editing components in `cloudflare/alife-app/src/components/page-sections` and `page-editor`. |
| Content storage | **Implemented** | Bilingual Page JSON columns, per-section content/style JSON, links, SQL persistence. This is structured JSON in relational aggregates, not a headless-CMS product. |
| Bilingual content | **Implemented** | `20260525084708_PageAggregateMultilingual.cs`, `6730afba`, `065ea1ce`, `cdc8e101`; current `{ en, zh }` DTOs and validators. |
| Editing | **Implemented** | Shared WYSIWYG in `5fd762f8`; V2 in `113fa7a5`; TinyMCE `05bfc74b`; current `PageEditorView.tsx`. |
| Review | **Implemented** | Reviewer role/review state July; current admin review commands and `PageReviewView.tsx`. |
| Publishing | **Implemented in source** | Group-owned public visibility plus reviewer approval, menus and public routes; `PagesController` public endpoints and `ApprovePagePublicationCommandHandler`. Deployment/user acceptance not verified. |
| Versioning | **Limited implementation** | Since `57d2ce1b`, working, submitted, and published snapshots are separated. This is not a general revision history or arbitrary rollback/version catalogue. |
| Media | **Implemented, with several paths** | Image Worker May, FileAsset platform July, TinyMCE/media picker, R2-backed access paths. Provider/deployed storage not tested in this audit. |
| Public-site delivery | **Implemented in source** | Public shell, menu-name routes, homepage placements, snapshot-backed public projections, Cache API L1/KV L2. |
| Worker separation | **Implemented** | `952ce976`: `cloudflare/alife-app`, `cloudflare/speed-layer`; image Worker remains separate. |
| Public/private boundaries | **Implemented and tested** | Public snapshot endpoints are shared-cacheable; working copies and identity/member/Event sensitive APIs are private/no-store. Worker tests cover authorization-before-cache and viewer isolation. |
| Full CMS revision history, scheduling, workflow engine | **Not established** | No evidence of a generic content-version timeline, scheduled publication, or arbitrary rollback workflow. |

### Authentication evolution and present maturity

| Period | Implemented change | Evidence / limitation |
| --- | --- | --- |
| 14–16 April | Initial Member/JWT path, brief Twilio bypass, LINE OAuth | `d6cac408`, `d8b482b7`, `8b0df29b` |
| 22 April | Phone/SMS registration removed; LINE only | `d0e5ad29`; reason is not recorded beyond the change itself. **Motivation requires confirmation from Stephen.** |
| May–July | HttpOnly JWT cookie hardening, membership invitations/approvals, LINE login creating join requests | `60c19236`, `b70adb9e`, `f5ca60ec` |
| 21 August | Alpha account login moved from display name to phone lookup | `c8e4d9fe`. This is an alpha convenience path, not proof that the phone is verified. |
| 31 August | Onboarding/identity redesign, Passkey credentials and ceremonies, invitations, internal alpha login | `e84f34f5`; `MemberPasskeyCredential.cs`; `PasskeyService.cs`; migration `20260829002033_RedesignIdentityOnboarding.cs` |
| 31 August–1 September | First Passkey bootstrap, diagnostics, manual activation | `338409e8`, `bb3ad544`, `eb1a4b9e` |
| 5–9 September | Browser continuation, QR recovery, email/provider delivery, public applications and first activation | `f34d3496`, `945db2db`, `46d952bf`; `docs/identity-access.md` |

Current implementation stores WebAuthn public credential material, counters, transports, backup flags, display name, and revocation/use times; it does not store private keys. Activation and recovery secrets are hashed, expire, and are one-time. JWTs remain server-issued and normally travel in HttpOnly cookies. LINE remains configurable legacy functionality rather than the exclusive current model.

Cross-device claims need precision. Desktop WebAuthn authentication may offer a hybrid phone hint, and Passkeys may sync through a user's platform provider, but browser/provider behaviour is outside ALIFE's control. ALIFE implements browser-bound applications, QR continuation/recovery, and credential replacement; this audit did not prove live cross-device provider behaviour. Existing sessions on other devices are explicitly not revoked by Passkey replacement.

### Event Management evolution and present maturity

| Capability | Status on 16 September | Evidence and boundary |
| --- | --- | --- |
| Creation and CRUD | **Implemented** | May `GroupEvent` CRUD; current `EventsController`; later composition/creation flow preserves compatibility. |
| Enrollment | **Implemented; legacy and v1 models coexist** | May enrollment, current `EventEnrollmentsController` and v1 `EventRegistrationWorkService`. v1 adds actual-person/household handling; legacy account-seat semantics remain version-specific. |
| Post-event review | **Implemented** | May/June Event review records/controllers/UI. It is not a fifth lifecycle stage. |
| Templates | **Implemented** | Activity template catalogue/admin controller, immutable versions and controlled categories introduced 27 August. |
| Recurrence | **Implemented in source** | `EventSeries`, materialised occurrences, recurrence services, rolling window and tests; introduced in `efcda7ef`. |
| Teams and roles | **Implemented** | Accepted role assignments, team membership, owner/accountability, scoped permissions; Event Composition and Operations controllers/services. |
| Rostering | **Implemented bounded core** | Occurrence slots, candidate groups, atomic batches, responses/replacements, defaults/extension; September services/tests. Automatic rotation and external eligibility are absent. |
| Specialist and Package approval | **Implemented in source; rollout operationally unverified** | Event Package Approval `1ec35845`, RAM governance, conditions, delegation, lifecycle gates, source invalidation. Shared DB/deployment state not checked. |
| Event Package Approval | **Implemented M0–M4 backbone** | `EventPackageService`, `EventPackageGateEvaluator`, `EventPackagesController`, migrations and `EventPackageFoundationTests`. Approval does not auto-publish. |
| Resource management / PLACE.RESOURCE | **Partially implemented** | Venue catalogue, capacity, reservations/conflicts, recurring calendars and history are current. Equipment allocation, setup/return and typed Session-to-Venue linking remain gaps. |
| SAFEGUARDING.CHILD | **Implemented bounded core** | Child/guardian/consent/collector, worker evidence and occurrence check-in/out exist. Broader health/incident/certification scope remains. |
| MOVE.STAY | **Partially implemented** | Transport drivers, vehicles, journeys, stops, restricted manifests and readiness exist. Accommodation/parking/provider integration do not. |
| COMMS.FOLLOWUP | **Partially implemented** | Bilingual content/posters, explicit publication, Event reviews and report adoption exist. Audience snapshots, delivery state, reviewed change broadcasts and purpose-controlled follow-up do not. |
| Plan B / contingency | **Not implemented by deliberate current decision** | Core/status/design docs explicitly say “Plan B is not planned.” Any retrospective claim otherwise is false. |
| Publishing readiness | **Implemented in source** | Package gate evaluator governs publish/unpublish, registration and execution transitions. Provider/live rollout was not verified. |
| Scheduling/resource conflicts | **Implemented for venues and roster rules, not all resources** | Venue reservation conflict and recurring calendar services/tests. Do not generalise this to equipment, transport providers, accommodation, or every module. |
| FESTIVAL.OPERATIONS | **Documented/structural only** | Current status marks it unavailable/target. |
| MONEY.FINANCE and FOOD.HOSPITALITY | **Partial v1 slices** | Manual fee/receipt/refund and report flows exist; provider payments, budgets, operational food planning and related scope remain absent. |

## Engineering decision points

| Before | Problem | Change | Evidence | Current state |
| --- | --- | --- | --- | --- |
| Twilio/phone verification path | Repository shows a bypass and then removal, but not a recorded product rationale. **Motivation requires confirmation from Stephen.** | LINE became the only registration route on 22 April. | `d8b482b7`; `d0e5ad29` removed Twilio service, handlers and tests. | LINE remains legacy-configurable; Passkeys, invitations, applications and recovery now form the primary identity architecture. |
| API also carried SPA hosting concerns | Commit explicitly removed SPA hosting to separate backend responsibility. | API became API/Swagger only; frontend deployed independently. | `40be5cec`, PR #12. | React PWA, .NET API, speed layer and image Worker are separate boundaries. |
| Frontend Worker bundled proxy/AI/cache code | Deployment/build ownership was coupled. The commit records decoupling, but broader motivation is not stated. **Motivation requires confirmation from Stephen.** | Worker code moved to an independent `speed-layer` package and workflow. | `b1e8821f`; `952ce976`; #208/#210/#212. | Separate frontend and speed-layer packages. |
| Workers KV used as the shared cache backend | Local edge caching and revalidation were better matched to Cache API. The exact decision rationale is not in the commit. **Motivation requires confirmation from Stephen.** | Group/shared cache switched to Cache API. Later, KV returned as global L2 for public pages only. | `5b069fa5`, #239; `4ce018cc`, #554; `docs/speed-layer_architecture.md`. | Cache API L1 + KV L2 for public pages; sensitive/viewer-specific APIs bypass shared caching. |
| Global Pages could own public content | Ownership and publication responsibility were conflated. The migration/diff proves the correction; stakeholder rationale is not recorded. **Motivation requires confirmation from Stephen.** | Global Page creation and `Page.Scope` were removed; group-owned pages gained separate publication review. | `21cf1187`, #455; `6469525f`, #458. | All Pages are group-owned; reviewer state/menu/public projection are separate. |
| Approved public pages could still depend on mutable working rows | Editing/review could disturb live public content. | Persist distinct submitted and published snapshots; public reads use the approved snapshot. | `57d2ce1b`, #697; `20260830083534_AddPagePublicationSnapshots.cs`; publication-copy tests. | Working, submitted and published copies are isolated; not a general revision-history system. |
| LINE/display-name/phone alpha access | Existing paths did not provide a durable passwordless invitation/recovery model. Commit and docs establish the redesign; stakeholder reasoning beyond security/product rules needs confirmation. | Add Passkeys, activation invitations, application receipts, QR continuation/recovery, email/manual delivery, and auditable credential replacement. | `e84f34f5`, `338409e8`, `f34d3496`, `945db2db`, `46d952bf`; `docs/identity-access.md`. | Implemented in source/tests; live multi-device/provider acceptance remains unverified. |
| Simple Event CRUD plus AI chats | Domain scope expanded beyond one event record and ad-hoc workflow steps. | Add deterministic Plan composition, recurrence, roles, modules and Package governance. | `efcda7ef`, #693; `1ec35845`, #705. | Capability-oriented model coexists with `GroupEvent` for compatibility. |
| Generic Event workflow/templates/artifacts (August) | Generic steps duplicated specialist authority and did not remain the supported domain abstraction. The removal is explicit; why the prototype was rejected needs personal context. **Motivation requires confirmation from Stephen.** | Remove supported generic workflow APIs/UI and surface dedicated RAM, duties, reports, registration and module workspaces. | Added `a3981bba`, #592; retired `c4110cb4`, #763. | Historical tables remain; current product uses dedicated capability flows. |

## Development activity metrics

Metrics are repository scale and traceability indicators, not quality or productivity scores.

### Commits and locally recoverable merged PRs

| Month (committer date) | Reachable commits on `main` | Distinct merged-PR identifiers recoverable from commit subjects |
| --- | ---: | ---: |
| March | 0 | 0 |
| April | 86 | 15 |
| May | 160 | 81 |
| June | 119 | 105 |
| July | 96 | 96 |
| August | 52 | 52 |
| September through 16th | 49 | 49 |
| **Total** | **562** | **398** |

There are 528 distinct `#` references in commit subjects across the period, but issue and PR numbers share one sequence. Without GitHub API access, an exact issue count/open-state split is not defensible.

### Contributors and AI traceability

- Git contains nine author identities in the period: six human-looking identities/aliases and three automation/bot identities. These are identities, not deduplicated people.
- 33 commits are authored by the two Copilot identities; two are Cloudflare automation. At least 21 commit messages contain `Agent-Logs-Url`, 23 contain “Copilot,” and one commit explicitly records `OpenAI Codex` as co-author. These sets overlap and undercount sessions whose squash metadata omitted AI markers.
- Repository-wide `AGENTS.md`, scoped frontend/Event instructions, planning prompts, and agent workflow docs are direct evidence that AI-assisted engineering became an explicit development practice. Git cannot determine which architectural decisions were human-originated without Stephen's account.

### Current repository scale

| Measure | Count / scale | Method and caveat |
| --- | ---: | --- |
| EF migration source files | 79 | Excludes Designer and ModelSnapshot; first-commit month: Apr 3, May 7, Jun 7, Jul 26, Aug 14, Sep 22 |
| Backend projects | 6 | Five production `.csproj` plus one test project |
| Cloudflare npm packages | 2 | PWA and speed layer; image Worker has Wrangler config but no separate package manifest |
| API controllers | 45 | Current `Alife.Api/Controllers` |
| HTTP endpoint attributes | 351 | Static count of `[HttpGet/Post/Put/Patch/Delete]`; not unique externally supported contracts |
| React route declarations | 95 | Includes compatibility/redirect/admin routes |
| Test declarations | 978 | Static 646 xUnit `[Fact]/[Theory]` plus 332 Node `test`/`it` declarations; parameterised cases differ |
| Markdown files | 82 | Includes plans, scoped instructions and generated-source documentation |
| Production C# scale | 743 files / ~57,834 lines | Excludes migration designers/model snapshot and generated frontend data |
| Production TypeScript/TSX scale | 429 files / ~56,247 lines | PWA, speed layer and image Worker source only |
| Git tags | 0 | `VERSION`/`CHANGELOG` labels exist, but no repository tag proves a release |

The current `VERSION` is `0.1.1.3`, while `CHANGELOG.md` contains a `0.1.1.4` heading. Treat release metadata as needing reconciliation before using it as evidence.

## Disputed or weak retrospective claims

- **NEEDS CORRECTION — “March–September development timeline.”** Git begins 14 April. March can only be included as Stephen-supplied pre-repository context.
- **NEEDS EVIDENCE — “272 issues, 270 closed, two open as of 23 July.”** This may reflect a historical export, but current GitHub state could not be queried. Do not present it as independently reverified.
- **NEEDS CORRECTION — “Two issues remain open: #420 and #421” as a current boundary.** Visitor contact and FileAsset implementations landed on 2 July in `48f7be35` (#427) and `78510410` (#426). Their historical issue state may still have been open, but the feature-gap statement is stale.
- **NEEDS CORRECTION — “CMS versioning” before 31 August.** July had publication review, but separate submitted/published snapshots arrived in `57d2ce1b`. Even now, this is copy isolation, not a general revision history.
- **NEEDS CORRECTION — any claim that Plan B/contingency is implemented.** Current Event contract and source deliberately exclude it.
- **NEEDS CORRECTION — “LINE is the current/only authentication model.”** True on 22 April, not on 16 September. LINE is retained, while Passkeys, activation, applications, recovery and alpha login now coexist.
- **NEEDS EVIDENCE — “complete Event Management system.”** Many serious flows are implemented, but `FESTIVAL.OPERATIONS` is unavailable; `COMMS.FOLLOWUP`, `MONEY.FINANCE`, `FOOD.HOSPITALITY`, `PLACE.RESOURCE` and `MOVE.STAY` are partial; live rollout is unverified.
- **NEEDS CORRECTION — “Event review” as a fifth lifecycle stage.** Post-event review records exist, but the current lifecycle is preparation, registration, execution and followup.
- **NEEDS EVIDENCE — “production-ready,” “production-proven,” or “real-user validated.”** Source, migrations and tests do not establish adoption, availability, provider behaviour, production data, security assessment or operational SLOs.
- **NEEDS EVIDENCE — “cross-device Passkey authentication works.”** The source supports WebAuthn, hybrid hints, QR continuation/recovery and provider-synchronisable credentials, but this audit did not run a multi-device browser/provider matrix.
- **NEEDS EVIDENCE — “all migrations deployed.”** Migration source files are present; five opt-in SQL tests were skipped in the fresh run; shared/production database state was not inspected.
- **NEEDS EVIDENCE — “AI produced X% of the product.”** Git records bot authors, agent logs, instructions and one Codex co-author marker, but cannot measure decision ownership or the amount of generated versus reviewed code.
- **NEEDS STEPHEN'S CONTEXT — why Twilio was abandoned, why global Pages were judged wrong, why the generic Event workflow was rejected, and which stakeholder/user observations drove each pivot.** The diffs prove the pivots, not all motivations.
- **NEEDS STEPHEN'S CONTEXT — personal leadership and collaboration attribution.** Git identities and AI markers do not establish who defined requirements, made trade-offs, reviewed output, or owned production outcomes.

## Missing information needed for a fully defensible retrospective

1. A GitHub export or restored API access for issue state, PR discussion, review participation, and GitHub Releases.
2. Deployment records for Azure Functions, Cloudflare Workers/Pages, R2/KV/Durable Objects, and environment/version dates.
3. The actual database migration ledger for development, staging, and production-like environments.
4. Real-user evidence: trial dates, participating groups, task-completion observations, incidents, adoption and retention.
5. Provider acceptance evidence for LINE, Gemini, YouTube, Microsoft 365/SMTP, WebAuthn across target devices, and email delivery.
6. Security review/penetration testing, privacy review, backup/restore evidence, observability and operational SLOs.
7. Stephen's explanation of decision motives and stakeholder conversations that are not recorded in ADRs/issues.
8. A clear authorship statement covering Stephen, other contributors, Copilot/Codex, and review responsibility.

## Strong senior-engineering interview case studies

### 1. Re-layering cache performance around privacy

**Problem:** several layers—PWA, TanStack, origin HTTP validators, Cloudflare and backend cache—could replay stale or viewer-inappropriate data.

**Constraints:** public pages benefit from global reuse; group content needs current membership; profiles, identity and Event operational records are viewer-specific; invalidation must cross PoPs.

**Decision:** classify data by audience. Use browser IndexedDB/ETags, Cache API L1, KV L2 only for sanitised public projections, authorization mirrors before shared group hits, backend HybridCache, and `private/no-store` for sensitive families.

**Implementation/evidence:** `9d2b5ea0`, `1c4ff681`, `bd39410d`, `5b069fa5`, `a0052fef`, `4ce018cc`; `apiCache.ts`, `authCache.ts`, `speed-layer_architecture.md`.

**Outcome:** current Worker tests pass 119/119, including authorization-before-cache, cross-viewer isolation, query-key separation, invalidation and KV fallback. Production hit-rate/cost impact is not measured.

**Likely questions:** Why not cache everything privately? How are membership revocations handled? What is the failure mode when KV is stale? How would you observe cache poisoning or key collisions?

### 2. Correcting public CMS ownership without breaking group content

**Problem:** the intermediate global Page model mixed ownership with public placement and review.

**Constraints:** groups must retain authorship; reviewers control public exposure; existing data/routes must survive; protected groups may still publish a safe page.

**Decision:** retire `Page.Scope`, keep Pages group-owned, and put review/menu/public metadata in separate records.

**Implementation/evidence:** `02fb88fd` added global pages; `21cf1187` introduced publication review; `6469525f` removed global ownership; `337b4b50`/`586336c1` added menus; `21ff926d` allowed safe reviewed content from protected groups.

**Outcome:** the current model has clearer ownership and public projection boundaries. User acceptance and governance turnaround time are unknown.

**Likely questions:** How did the migration preserve old pages? Why use JSON bilingual fields? What prevents a protected section from leaking through a public snapshot?

### 3. Separating live public content from work in progress

**Problem:** editing or resubmitting an approved page could couple the live site to mutable working data.

**Constraints:** volunteers need continued editing; reviewers need an exact submitted copy; public visitors need stable content; cache invalidation must cover all projections.

**Decision:** persist working, submitted and published copies, with optimistic concurrency and public reads from the approved snapshot.

**Implementation/evidence:** `57d2ce1b`, migration `20260830083534_AddPagePublicationSnapshots.cs`, `PagePublicationSnapshot.cs`, `PagePublicationCopyTests.cs`.

**Outcome:** current backend tests and frontend build pass. This solves publication isolation, not full document history.

**Likely questions:** Why snapshot JSON instead of normalised versions? How do you migrate malformed legacy JSON? How would rollback or diff work later?

### 4. Evolving identity from LINE-only alpha access to Passkeys and recoverable onboarding

**Problem:** LINE-only and alpha login paths did not cover invitation, first activation, lost credentials, browser continuation, or auditable recovery.

**Constraints:** no passwords; phone and identity verification are distinct; recovery must not be anonymously searchable; elevated users need stricter authority; secrets must not enter shared caches/logs.

**Decision:** use WebAuthn public-key credentials, hashed one-time activation/recovery secrets, browser receipts, QR-bound continuation, explicit human identity verification, and provider-neutral email/manual delivery.

**Implementation/evidence:** `e84f34f5`, `338409e8`, `f34d3496`, `945db2db`, `46d952bf`; `docs/identity-access.md`; identity entities/services/controllers.

**Outcome:** 19/19 focused frontend identity tests and the relevant backend suite pass. Live multi-device and email-provider behaviour remains unverified.

**Likely questions:** Why are existing sessions not revoked? How are Passkey counters/backup flags used? What stops recovery privilege escalation? Why retain LINE?

### 5. Replacing a generic Event workflow with capability-oriented domain flows

**Problem:** the August generic workflow/template/artifact abstraction did not remain the right authority model for RAM, registration, rosters, safeguarding, venues and approvals.

**Constraints:** preserve historical records; avoid silent data loss; specialist decisions need independent authorization/versioning; the frontend needs controlled surfaces, not server-provided component paths.

**Decision:** retire generic workflow APIs/UI, retain historical tables, and use dedicated capability services plus a compile-time surface registry.

**Implementation/evidence:** generic workflow added in `a3981bba`; target composition in `efcda7ef`; workflow retired in `c4110cb4`; current `EVENT-CONTRACT.md` and service/controller set.

**Outcome:** current source exposes dedicated RAM, duty, report, registration, venue, travel, safeguarding, roster and Package flows. Operational rollout remains to be proven.

**Likely questions:** What signals showed the abstraction was wrong? How did you avoid breaking stored records? Which concepts remain shared and which stay module-specific?

### 6. Turning Event approval into immutable, version-bound evidence

**Problem:** accepting an Event plan, approving RAM, publishing, opening registration and confirming execution are distinct decisions; a mutable “approved” flag is insufficient.

**Constraints:** recurrence, occurrence exceptions, delegated authority, separation of duties, changing source records, legacy Events and reversible rollout.

**Decision:** canonical Event Packages with ordered source-version vectors, scoped decisions/conditions, lifecycle gate evaluation, invalidation on material source changes, and `off/dryRun/enforced` rollout.

**Implementation/evidence:** `1ec35845`; Event Package migrations; `EventPackageService`, canonicalizer, gate evaluator, invalidation service; Package tests.

**Outcome:** source and focused tests establish the backbone; no shared database/deployment or church-account acceptance was performed in this audit.

**Likely questions:** How is mixed-time evidence prevented? What makes a source change material? How do recurring occurrences inherit approval? How does rollback work?

### 7. Keeping AI subordinate to human authority

**Problem:** AI can reduce input/translation effort but can invent safety facts or accidentally become an approval mechanism.

**Constraints:** bilingual drafting, private data minimisation, temporary chat state, explicit commitment, RAM accountability, provider failure and cost.

**Decision:** allow candidate facts and draft text only; keep accepted records behind server APIs and human confirmation; prohibit AI from assigning roles, approving, publishing, or inventing sensitive evidence; allow core save paths to survive AI failure.

**Implementation/evidence:** Durable Object sessions `faaa0a47`/`936f0c23`; graceful page save `979a4b1f`; RAM `09f95fe1` and September governance; `EVENT-CONTRACT.md`; form-assistant Worker tests.

**Outcome:** the current tests cover allowlists, authentication, owner isolation, forbidden output and provider failures. Real model quality/cost metrics are absent.

**Likely questions:** How are prompts minimised? How do you detect fabricated evidence? What happens on model truncation? Why use Durable Objects instead of persisting every message?

### 8. Preserving compatibility while deepening the Event model

**Problem:** a simple `GroupEvent` and legacy enrollment/review payloads already existed when recurrence, actual participants, roles, modules and Packages were introduced.

**Constraints:** do not rewrite accepted history, silently reinterpret old enrollments, or require a big-bang migration.

**Decision:** retain `GroupEvent` as the compatible root, introduce typed facts/snapshots/occurrences alongside legacy JSON, and make collaboration/version semantics explicit.

**Implementation/evidence:** `efcda7ef`; additive migrations from 27 August onward; `EVENT-CONTRACT.md` compatibility section; `IMPLEMENTATION-STATUS.md` version boundaries.

**Outcome:** current backend suite passes 845 tests with five opt-in SQL tests skipped. Production migration state remains unknown.

**Likely questions:** Which writes are dual-written? How is version 0 isolated from version 1? What is the eventual cutover strategy? How do you test migration preservation?

## Suggested corrections to the retrospective

1. Change the historical range to **14 April–16 September 2026**, or explicitly label March as unverified pre-repository context.
2. Replace the two broad phases with the three evidence-based phases above, or move the productisation boundary into late May and identify 27 August as the Event-domain inflection point.
3. Replace current issue-state claims with local Git metrics unless a fresh GitHub export is supplied.
4. Describe CMS “versioning” as **working/submitted/published copy isolation introduced on 31 August**, not general revision history.
5. Describe LINE as the April identity choice and a retained legacy path, not the current whole authentication architecture.
6. Separate **post-event reviews**, **RAM review**, and **Event Package Approval**; do not call review a fifth lifecycle stage.
7. State Event modules with their actual status. In particular: venue resources, safeguarding and transport have bounded cores; communications/finance/food are partial; festival operations and Plan B are unavailable.
8. Use “implemented in repository and covered by tests” instead of “production-ready” or “proven” unless deployment and user evidence is added.
9. State AI involvement as traceable collaboration and workflow design, while distinguishing Stephen's product/architecture/review ownership from generated implementation only when Stephen can substantiate it.
10. Lead interview stories with pivots and constraints—the cache privacy model, group-owned publishing, publication snapshots, identity recovery, Event Package evidence, and retiring the generic workflow—rather than raw issue volume.

## Fresh verification performed for this audit

- `dotnet test backend\Alife.sln --no-restore --nologo`: **845 passed, 5 skipped, 0 failed**. The skipped tests require opt-in SQL infrastructure and include migration/concurrency checks.
- `npm.cmd run test:identity`: **19 passed, 0 failed**.
- `npm.cmd run test:event-composition`: **85 passed, 0 failed**.
- `node --test index.test.mjs` in `cloudflare/speed-layer`: **119 passed, 0 failed**.
- `npm.cmd run build` in `cloudflare/alife-app`: production TypeScript/Vite/PWA build succeeded. Vite reported one non-fatal warning that `idb-keyval` is both statically and dynamically imported.

Not verified: browser interaction, live LINE/Gemini/YouTube/email providers, shared or production database migrations, deployed Cloudflare/Azure state, GitHub issue state, GitHub Releases, or real-user acceptance.
