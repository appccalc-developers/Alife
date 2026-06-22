# Alife Project Development Timeline

## Source And Scope

This timeline reconstructs Alife's development history from GitHub issues in `appccalc-developers/Alife`.

- Source: GitHub issues exported with `gh issue list --repo appccalc-developers/Alife --state all --limit 1000`.
- Date span: 2026-04-15 to 2026-06-19 UTC.
- Issue count: 165 total; 162 closed and 3 open.
- Interpretation: issue creation dates show when work was planned or tracked. They are close to the development sequence, but they are not the same as PR merge dates or deployment dates.

The project evolved from authentication, API, and PWA foundations into a layered alpha product with group management, bilingual content, Cloudflare edge caching, AI-assisted event workflows, image services, notification workflows, and maintainable deployment documentation.

## Executive Timeline

| Phase | Dates | Issues | Main Theme | Product And Architecture Value |
|---|---:|---:|---|---|
| 1 | 2026-04-15 to 2026-04-22 | 11 | Backend, auth, API, and deployment foundations | Established a cleaner backend/API boundary, safer auth model, PWA baseline, LINE-first login direction, and deployable runtime options. |
| 2 | 2026-04-28 to 2026-05-01 | 13 | App shell and group navigation | Moved the frontend toward a mobile-first product shell with leader tools, group pages, contextual navigation, and responsive layout. |
| 3 | 2026-05-03 to 2026-05-08 | 8 | PWA, cache, images, and sync | Added the first serious client/edge performance layer: service worker cleanup, conditional requests, proxy cache, image worker, and TanStack DB sync. |
| 4 | 2026-05-11 to 2026-05-20 | 18 | AI and event domain foundations | Introduced event modeling, enrollment, AI session planning, image upload, and domain consolidation around `ccalc.live`. |
| 5 | 2026-05-23 to 2026-05-29 | 40 | Page editing, bilingual content, cache hardening, and event review | Turned pages and events into real leader-facing workflows, with WYSIWYG editing, i18n, subgroup/member UX, AI review, and cache safety. |
| 6 | 2026-06-02 to 2026-06-05 | 10 | Page Builder V2 and speed-layer architecture | Simplified page sections, added Spotlight data binding, split the speed layer from the app, and clarified CI/CD ownership. |
| 7 | 2026-06-07 to 2026-06-10 | 24 | Guest access, cache correctness, management, and notifications | Opened public/guest content safely, tightened edge authorization, improved management workflows, and added notification plumbing. |
| 8 | 2026-06-11 to 2026-06-13 | 19 | AI bilingual helpers, workflow polish, and navigation state | Improved bilingual authoring, AI-assisted content completion, enrollment defaults, review UX, and stored navigation context. |
| 9 | 2026-06-15 to 2026-06-19 | 22 | Alpha polish, infrastructure docs, security fixes, and cleanup | Refined alpha documentation, Terraform, leadership transfer, AI session auth, image/CORS/304 handling, public visibility, and local startup. |

## Development Narrative

### Phase 1: Backend, Auth, API, And Deployment Foundations

From 2026-04-15 through 2026-04-22, the project focused on stabilizing the basic application platform. Early issues cleaned up sermon retrieval behavior, removed unnecessary guest GUID tracking, added PWA support, introduced test-friendly Twilio bypass configuration, and implemented LINE login.

This phase also clarified the backend as a pure API by removing SPA concerns and switching to Swagger. The Azure Functions and Dockerization issues show that hosting and operations were being considered early, not left until the end.

Representative issues:

- [#1](https://github.com/appccalc-developers/Alife/issues/1) GetSermons should not update YouTube playlist before returning sermons from data source.
- [#3](https://github.com/appccalc-developers/Alife/issues/3) Stop issuing Guest GUID; use NULL when no member token is present.
- [#9](https://github.com/appccalc-developers/Alife/issues/9) Implement LINE Login via OAuth 2.0 Authorization Code Flow.
- [#11](https://github.com/appccalc-developers/Alife/issues/11) Refactor Alife.API: remove SPA and switch to Swagger.
- [#21](https://github.com/appccalc-developers/Alife/issues/21) Set LINE as primary authentication and remove Phone/SMS auth.

Portfolio framing: this phase demonstrates authentication design, API separation, deployment thinking, and careful handling of anonymous vs registered identity.

### Phase 2: App Shell And Group Navigation

From 2026-04-28 through 2026-05-01, development shifted strongly into user experience. The frontend moved from basic screens toward a richer app shell with bottom navigation, side navigation, a drawer, FAB actions, group detail restructuring, and responsive behavior across mobile and desktop.

The work also separated normal reading flows from leader tools. Group pages became embedded, navigable content instead of a flat detail screen.

Representative issues:

- [#25](https://github.com/appccalc-developers/Alife/issues/25) Convert frontend to rich shell with BottomNav/SideNav, NavigationDrawer, and FAB.
- [#29](https://github.com/appccalc-developers/Alife/issues/29) Refactor Group Detail into pages-focused content with contextual Group Tools drawer.
- [#30](https://github.com/appccalc-developers/Alife/issues/30) Responsive Sidebar: mobile drawer and desktop fixed UI.
- [#38](https://github.com/appccalc-developers/Alife/issues/38) Refactor group page list into tabbed embedded page views.
- [#47](https://github.com/appccalc-developers/Alife/issues/47) Refactor frontend navigation and group shell UI.

Portfolio framing: this phase shows product thinking: the app became navigable for members while preserving management affordances for leaders.

### Phase 3: PWA, Cache, Images, And Sync

From 2026-05-03 through 2026-05-08, the project invested in performance and offline-adjacent behavior. The service worker was refactored, global conditional request caching was introduced, a smart Cloudflare proxy cache was added, and the image API worker moved into the repository.

This phase is important because it created the foundation for the later speed-layer architecture. It also introduced high-efficiency sync concepts for TanStack DB and enhanced section list sources.

Representative issues:

- [#53](https://github.com/appccalc-developers/Alife/issues/53) Implement Resilient PWA Sync Engine.
- [#56](https://github.com/appccalc-developers/Alife/issues/56) Built-in global conditional request cache strategy.
- [#58](https://github.com/appccalc-developers/Alife/issues/58) Refactor frontend PWA service worker to vite-plugin-pwa.
- [#61](https://github.com/appccalc-developers/Alife/issues/61) Implement Smart Proxy Middleware with Cache API and Passive Invalidation.
- [#62](https://github.com/appccalc-developers/Alife/issues/62) Move images API Worker into this repo.
- [#65](https://github.com/appccalc-developers/Alife/issues/65) Implement High-Efficiency Sync Layer for TanStack DB.

Portfolio framing: this phase is a practical example of multi-layer caching and edge-aware frontend architecture.

### Phase 4: AI And Event Domain Foundations

From 2026-05-11 through 2026-05-20, Alife began to move beyond group pages into event workflows and AI assistance. The event entity was introduced across backend and frontend, leaders gained event editing, users gained enrollment, and the API gained event CRUD operations.

The AI work started as broader epics and then narrowed into shared AI session infrastructure and event enrollment rework. Image upload and domain consolidation also arrived in this phase.

Representative issues:

- [#70](https://github.com/appccalc-developers/Alife/issues/70) Secure AI Interaction Engine and Semantic Event Modeling.
- [#79](https://github.com/appccalc-developers/Alife/issues/79) Secure AI Interaction Engine and Stateful Semantic Hub.
- [#81](https://github.com/appccalc-developers/Alife/issues/81) Introduce domain entity: Event.
- [#84](https://github.com/appccalc-developers/Alife/issues/84) User Event Enrollment Pipeline via Frontend, Cloudflare, and Backend.
- [#93](https://github.com/appccalc-developers/Alife/issues/93) Combine `api.ccalc.live` and `app.ccalc.live` into `ccalc.live`.
- [#106](https://github.com/appccalc-developers/Alife/issues/106) Implement Mobile Image Upload with Cropping and Compression.
- [#109](https://github.com/appccalc-developers/Alife/issues/109) AI Enrollment Rework and Shared AI Session Facility.

Portfolio framing: this phase connects product workflow, domain modeling, cloud routing, image handling, and AI assistance into one coherent feature direction.

### Phase 5: Pages, Bilingual Content, Cache Hardening, And Event Review

From 2026-05-23 through 2026-05-29, the project produced its densest phase. Page rendering and editing were unified, WYSIWYG section editing matured, stale-cache bugs were addressed, multilingual page content was added, and frontend/backend/cache boundaries were aligned.

This phase also refined subgroup navigation, group metadata, list sections, event enrollment endpoints, payment file storage, and AI-powered event review. Backend controllers were moved toward MediatR commands and queries, and frontend i18n became a first-class concern.

Representative issues:

- [#111](https://github.com/appccalc-developers/Alife/issues/111) Implement shared AI session infrastructure for event planning and enrollment.
- [#117](https://github.com/appccalc-developers/Alife/issues/117) Unify page content rendering and WYSIWYG section editing.
- [#127](https://github.com/appccalc-developers/Alife/issues/127) Track Page aggregate API, multilingual page content, and local dev proxy changes.
- [#133](https://github.com/appccalc-developers/Alife/issues/133) Align Cloudflare, frontend, and Azure API cache boundaries.
- [#135](https://github.com/appccalc-developers/Alife/issues/135) Support bilingual section content without refetching on language switch.
- [#143](https://github.com/appccalc-developers/Alife/issues/143) Harden cache management across Azure API, Cloudflare proxy, and PWA.
- [#147](https://github.com/appccalc-developers/Alife/issues/147) Add KV authorization mirror for shared group detail edge cache.
- [#174](https://github.com/appccalc-developers/Alife/issues/174) Implement AI-powered event review module.
- [#178](https://github.com/appccalc-developers/Alife/issues/178) Refactor controllers to use MediatR queries and commands.
- [#190](https://github.com/appccalc-developers/Alife/issues/190) Add member language preference to profile and JWT.

Portfolio framing: this phase shows the hard middle of real product work: editing UX, multilingual data shape, cache invalidation, authorization mirrors, and API architecture all had to be made consistent.

### Phase 6: Page Builder V2 And Speed-Layer Architecture

From 2026-06-02 through 2026-06-05, the project simplified page building and reorganized the Cloudflare speed layer. Page Builder V2 reduced the editable section model to clearer primitives, added shared section headers, normalized legacy content, and introduced richer Spotlight behavior.

At the same time, the Cloudflare Worker speed layer was refactored into vertical slices and then decoupled from the frontend app as an independent package. CI/CD workflows were updated to match the new boundaries.

Representative issues:

- [#199](https://github.com/appccalc-developers/Alife/issues/199) Implement Page Builder V2 refactor.
- [#201](https://github.com/appccalc-developers/Alife/issues/201) Support manual and data-bound Spotlight sections.
- [#203](https://github.com/appccalc-developers/Alife/issues/203) Embed YouTube video in sermon Spotlight sections.
- [#207](https://github.com/appccalc-developers/Alife/issues/207) Speed Layer Refactoring: Vertical Slices and Middleware Pipeline.
- [#209](https://github.com/appccalc-developers/Alife/issues/209) Decouple Frontend and Speed-Layer.
- [#212](https://github.com/appccalc-developers/Alife/issues/212) Update CI/CD workflows and add speed-layer workflow.
- [#216](https://github.com/appccalc-developers/Alife/issues/216) Move alife-app and speed-layer to Cloudflare and update workflow.

Portfolio framing: this phase demonstrates architectural refactoring without changing the product goal: simpler authoring on the frontend and cleaner operational ownership at the edge.

### Phase 7: Guest Access, Cache Correctness, Management, And Notifications

From 2026-06-07 through 2026-06-10, Alife focused on making public and guest access useful without weakening cache security. Anonymous church lookup and guest church content were added, while authorization was enforced before group edge cache reads.

The cache backend moved from Workers KV to the Cache API, revalidation was optimized, and member-scoped profile cache behavior was improved. The same phase added major leader workflows: membership approvals, invitations, role management, maintenance operations, and notification center APIs/UI.

Representative issues:

- [#221](https://github.com/appccalc-developers/Alife/issues/221) Allow anonymous church lookup and align CODEOWNERS location.
- [#223](https://github.com/appccalc-developers/Alife/issues/223) Allow guest access to church content.
- [#225](https://github.com/appccalc-developers/Alife/issues/225) Enforce authorization before group edge cache reads.
- [#235](https://github.com/appccalc-developers/Alife/issues/235) Switch cache backend from Workers KV to Cache API.
- [#240](https://github.com/appccalc-developers/Alife/issues/240) Optimize speed-layer Cache API revalidation.
- [#255](https://github.com/appccalc-developers/Alife/issues/255) Add group membership approvals and invitations.
- [#257](https://github.com/appccalc-developers/Alife/issues/257) Allow church leaders and co-leaders to manage roles and maintenance.
- [#261](https://github.com/appccalc-developers/Alife/issues/261) Add Notification Center backend APIs.
- [#267](https://github.com/appccalc-developers/Alife/issues/267) Add membership workflow notifications.

Portfolio framing: this phase is useful for explaining authorization-aware caching, role-based group operations, and notification-driven user workflows.

### Phase 8: AI Bilingual Helpers, Workflow Polish, And Navigation State

From 2026-06-11 through 2026-06-13, the project polished workflows that alpha users would actually touch. Event review bugs were fixed, subgroup cache invalidation was corrected, group deletion moved to a danger zone, and enrollment was simplified.

The bilingual model was tightened by moving page title fields to bilingual values, standardizing writes on the `zh` key, removing legacy `cn` compatibility, and adding AI-assisted bilingual autofill/completion. The app language setting moved to local storage, and navigation began using stored active entity context.

Representative issues:

- [#271](https://github.com/appccalc-developers/Alife/issues/271) Fix event review photo duplication and simplify review UI.
- [#275](https://github.com/appccalc-developers/Alife/issues/275) Fix subgroup management access and membership cache invalidation.
- [#281](https://github.com/appccalc-developers/Alife/issues/281) Update page title editor to bilingual fields.
- [#283](https://github.com/appccalc-developers/Alife/issues/283) Standardize localized text writes on `zh` key.
- [#287](https://github.com/appccalc-developers/Alife/issues/287) Add AI bilingual text autofill for settings.
- [#289](https://github.com/appccalc-developers/Alife/issues/289) Add AI bilingual completion to page editor.
- [#291](https://github.com/appccalc-developers/Alife/issues/291) Add AI mission and event context to event workflows.
- [#297](https://github.com/appccalc-developers/Alife/issues/297) Move app language setting to localStorage.
- [#299](https://github.com/appccalc-developers/Alife/issues/299) Use stored active entity context for frontend navigation.

Portfolio framing: this phase shows mature product cleanup: reducing old compatibility paths, improving bilingual authoring, and making navigation state predictable.

### Phase 9: Alpha Polish, Infrastructure Docs, Security Fixes, And Cleanup

From 2026-06-15 through 2026-06-19, the project moved into alpha hardening. Documentation and infrastructure were refreshed, including architecture docs and Terraform. Leadership workflows improved through subgroup leader assignment and leadership transfer.

The team also hardened Cloudflare AI session auth, fixed public image CORS and HEAD behavior, repaired SpeedLayer 304 CORS headers, supported video section media, fixed public page visibility, made sermon links visible to guests, removed unused components and compatibility adapters, and added a local dev startup workflow.

Representative issues:

- [#307](https://github.com/appccalc-developers/Alife/issues/307) Refresh alpha project documentation.
- [#309](https://github.com/appccalc-developers/Alife/issues/309) Add Terraform infrastructure script.
- [#311](https://github.com/appccalc-developers/Alife/issues/311) Document Alife architecture layers.
- [#313](https://github.com/appccalc-developers/Alife/issues/313) Add subgroup leader assignment in group management.
- [#318](https://github.com/appccalc-developers/Alife/issues/318) Show group leader and allow leadership transfer.
- [#322](https://github.com/appccalc-developers/Alife/issues/322) Harden Cloudflare AI session auth and cleanup.
- [#326](https://github.com/appccalc-developers/Alife/issues/326) Fix CORS headers for public image object URLs.
- [#330](https://github.com/appccalc-developers/Alife/issues/330) Fix SpeedLayer 304 CORS headers.
- [#337](https://github.com/appccalc-developers/Alife/issues/337) Fix public page visibility publishing and access.
- [#351](https://github.com/appccalc-developers/Alife/issues/351) Add local dev startup workflow.
Portfolio framing: this phase demonstrates alpha readiness: documentation, infrastructure, access-control fixes, local developer experience, and removal of obsolete frontend compatibility layers.

## Open Roadmap Items

Three issues were still open at the time of export. All were created on 2026-05-11 and read as roadmap epics rather than immediate alpha blockers.

| Issue | Title | Roadmap Meaning |
|---|---|---|
| [#71](https://github.com/appccalc-developers/Alife/issues/71) | Real-time Edge Distribution and Deep-Link Response Chain | Future real-time/deep-link response flows across the edge layer. |
| [#72](https://github.com/appccalc-developers/Alife/issues/72) | Enrollment State Machine and Multi-modal Verification | Future richer enrollment/payment/verification state model. |
| [#73](https://github.com/appccalc-developers/Alife/issues/73) | Memory Harvesting and Automated Witness Walls | Future post-event reflection/testimony workflow. |

## Architecture Story For Portfolio Review

The issue history tells a coherent architecture story:

1. The backend was shaped into a standalone API with explicit auth, Swagger, Azure Functions hosting, EF Core, and later MediatR-based command/query handling.
2. The frontend became a real PWA shell, not a collection of pages: responsive navigation, role-aware leader tools, page editing, event enrollment, notifications, and local navigation state.
3. The Cloudflare speed layer evolved from proxy/cache experiments into a separate vertical-slice Worker package with safe edge caching, authorization mirrors, AI Durable Objects, and independent CI/CD.
4. Content modeling matured from basic pages into bilingual structured sections with Page Builder V2, Spotlight/ListView normalization, video support, and AI-assisted bilingual completion.
5. Product safety improved over time: HttpOnly JWT cookies, backend authorization checks, edge authorization before shared cache reads, cache invalidation fixes, public/private visibility corrections, and CORS/304 hardening.
6. AI was kept in controlled workflows: event planning, enrollment, review, translation/completion, and session cleanup, with persistence still tied to explicit user flows.

For an interview or portfolio discussion, the strongest narrative is not "many features were added." It is that Alife repeatedly moved complexity into clearer layers:

- identity and authorization belong to the backend;
- shared cache acceleration belongs to the speed layer;
- image storage belongs to the image worker and R2;
- authoring and reading belong to the frontend PWA;
- AI assists user-controlled workflows instead of automatically publishing content.

## Complete Issue Index By Phase

### Phase 1 Issues

- [#1](https://github.com/appccalc-developers/Alife/issues/1) GetSermons should not update YouTube playlist before returning sermons from data source.
- [#3](https://github.com/appccalc-developers/Alife/issues/3) Stop issuing Guest GUID; Use NULL when no member token is present.
- [#5](https://github.com/appccalc-developers/Alife/issues/5) Add PWA support for alife-demo with focus on old iOS/iPhone compatibility.
- [#7](https://github.com/appccalc-developers/Alife/issues/7) Add configuration `Twilio:Skip` to bypass SMS verification in backend.
- [#9](https://github.com/appccalc-developers/Alife/issues/9) Implement LINE Login via OAuth 2.0 Authorization Code Flow.
- [#11](https://github.com/appccalc-developers/Alife/issues/11) Refactor Alife.API: Remove SPA and Switch to Swagger.
- [#13](https://github.com/appccalc-developers/Alife/issues/13) Convert backend from Web App to Azure Functions.
- [#15](https://github.com/appccalc-developers/Alife/issues/15) Switched auth cookie policy from environment-based to request-transport-based.
- [#17](https://github.com/appccalc-developers/Alife/issues/17) Fix service worker error for unsupported POST in Cache.
- [#19](https://github.com/appccalc-developers/Alife/issues/19) Enable Dockerization for backend and frontend.
- [#21](https://github.com/appccalc-developers/Alife/issues/21) Set LINE as Primary Authentication and Remove Phone/SMS Auth.

### Phase 2 Issues

- [#25](https://github.com/appccalc-developers/Alife/issues/25) Convert frontend to rich shell with BottomNav/SideNav, NavigationDrawer, and FAB.
- [#26](https://github.com/appccalc-developers/Alife/issues/26) Enable login with display name on OnBoarding page.
- [#29](https://github.com/appccalc-developers/Alife/issues/29) Refactor Group Detail into pages-focused content with contextual Group Tools drawer.
- [#30](https://github.com/appccalc-developers/Alife/issues/30) Responsive Sidebar: Mobile Drawer and Desktop Fixed UI.
- [#36](https://github.com/appccalc-developers/Alife/issues/36) Add `referrerPolicy` for embedded videos.
- [#38](https://github.com/appccalc-developers/Alife/issues/38) Refactor group page list into tabbed embedded page views.
- [#40](https://github.com/appccalc-developers/Alife/issues/40) Fix Group Tools Sidebar Overflow.
- [#42](https://github.com/appccalc-developers/Alife/issues/42) Make Group Tools Drawer More Concise.
- [#44](https://github.com/appccalc-developers/Alife/issues/44) Refactor Group Page Navigation Through Shell Nav.
- [#45](https://github.com/appccalc-developers/Alife/issues/45) Refactor Group Page Navigation Through Shell Nav.
- [#47](https://github.com/appccalc-developers/Alife/issues/47) Refactor frontend navigation and group shell UI.
- [#49](https://github.com/appccalc-developers/Alife/issues/49) Inline group page view/edit tools and active page card.
- [#51](https://github.com/appccalc-developers/Alife/issues/51) Hide hamburger menu and FAB on desktop.

### Phase 3 Issues

- [#53](https://github.com/appccalc-developers/Alife/issues/53) Implement Resilient PWA Sync Engine.
- [#54](https://github.com/appccalc-developers/Alife/issues/54) Remedy page editor layout and field visibility changes.
- [#56](https://github.com/appccalc-developers/Alife/issues/56) Built-in global conditional request cache strategy.
- [#58](https://github.com/appccalc-developers/Alife/issues/58) Refactor frontend PWA service worker to vite-plugin-pwa.
- [#61](https://github.com/appccalc-developers/Alife/issues/61) Implement Smart Proxy Middleware with Cache API and Passive Invalidation.
- [#62](https://github.com/appccalc-developers/Alife/issues/62) Move images API Worker into this repo.
- [#63](https://github.com/appccalc-developers/Alife/issues/63) Enhance ListView Section to Support Polymorphic List Sources.
- [#65](https://github.com/appccalc-developers/Alife/issues/65) Implement High-Efficiency Sync Layer for TanStack DB.

### Phase 4 Issues

- [#70](https://github.com/appccalc-developers/Alife/issues/70) Secure AI Interaction Engine and Semantic Event Modeling.
- [#71](https://github.com/appccalc-developers/Alife/issues/71) Real-time Edge Distribution and Deep-Link Response Chain.
- [#72](https://github.com/appccalc-developers/Alife/issues/72) Enrollment State Machine and Multi-modal Verification.
- [#73](https://github.com/appccalc-developers/Alife/issues/73) Memory Harvesting and Automated Witness Walls.
- [#79](https://github.com/appccalc-developers/Alife/issues/79) Secure AI Interaction Engine and Stateful Semantic Hub.
- [#81](https://github.com/appccalc-developers/Alife/issues/81) Introduce domain entity: Event.
- [#83](https://github.com/appccalc-developers/Alife/issues/83) Enable Editing of Events for Leader/Co-Leader from Sidebar.
- [#84](https://github.com/appccalc-developers/Alife/issues/84) User Event Enrollment Pipeline via Frontend, Cloudflare, and Backend.
- [#85](https://github.com/appccalc-developers/Alife/issues/85) Introduce EventsController in API for CRUD operations for events in group.
- [#88](https://github.com/appccalc-developers/Alife/issues/88) Rename repository and frontend directory.
- [#90](https://github.com/appccalc-developers/Alife/issues/90) Set CACHE_TTL_SECONDS to 24 hours.
- [#93](https://github.com/appccalc-developers/Alife/issues/93) Combine api.ccalc.live and app.ccalc.live into ccalc.live.
- [#96](https://github.com/appccalc-developers/Alife/issues/96) Optimize Image Loading Architecture for List Views.
- [#97](https://github.com/appccalc-developers/Alife/issues/97) Optimize API/Cache Performance.
- [#100](https://github.com/appccalc-developers/Alife/issues/100) Upgrade images-api worker for hierarchical image management.
- [#102](https://github.com/appccalc-developers/Alife/issues/102) Map ccalc.live images API paths through the proxy.
- [#106](https://github.com/appccalc-developers/Alife/issues/106) Implement Mobile Image Upload with Cropping and Compression.
- [#109](https://github.com/appccalc-developers/Alife/issues/109) AI Enrollment Rework and Shared AI Session Facility.

### Phase 5 Issues

- [#111](https://github.com/appccalc-developers/Alife/issues/111) Implement shared AI session infrastructure for event planning and enrollment.
- [#113](https://github.com/appccalc-developers/Alife/issues/113) Unify member and leader group interfaces.
- [#115](https://github.com/appccalc-developers/Alife/issues/115) Group detail page no longer shows group header or join action.
- [#117](https://github.com/appccalc-developers/Alife/issues/117) Unify page content rendering and WYSIWYG section editing.
- [#119](https://github.com/appccalc-developers/Alife/issues/119) Refine WYSIWYG section editor chrome.
- [#121](https://github.com/appccalc-developers/Alife/issues/121) Fix group page editor save and return target page handling.
- [#123](https://github.com/appccalc-developers/Alife/issues/123) Fix stale frontend cache after page edits and login.
- [#125](https://github.com/appccalc-developers/Alife/issues/125) Route ccalc.live/images through the Cloudflare image proxy.
- [#127](https://github.com/appccalc-developers/Alife/issues/127) Track Page aggregate API, multilingual page content, and local dev proxy changes.
- [#129](https://github.com/appccalc-developers/Alife/issues/129) Page editor loads empty sections when editing an existing group page.
- [#131](https://github.com/appccalc-developers/Alife/issues/131) WYSIWYG page title/description editing and titled page tabs.
- [#133](https://github.com/appccalc-developers/Alife/issues/133) Align Cloudflare, frontend, and Azure API cache boundaries.
- [#135](https://github.com/appccalc-developers/Alife/issues/135) Support bilingual section content without refetching on language switch.
- [#137](https://github.com/appccalc-developers/Alife/issues/137) Polish page editor FABs and page detail cache reuse.
- [#139](https://github.com/appccalc-developers/Alife/issues/139) Keep group page navigation selected while editing from FAB.
- [#141](https://github.com/appccalc-developers/Alife/issues/141) Localize static app UI text for English and Chinese.
- [#143](https://github.com/appccalc-developers/Alife/issues/143) Harden cache management across Azure API, Cloudflare proxy, and PWA.
- [#145](https://github.com/appccalc-developers/Alife/issues/145) Event editor assistant intro should follow selected language.
- [#147](https://github.com/appccalc-developers/Alife/issues/147) Add KV authorization mirror for shared group detail edge cache.
- [#150](https://github.com/appccalc-developers/Alife/issues/150) Add subgroup hamburger menu navigation and join flow.
- [#152](https://github.com/appccalc-developers/Alife/issues/152) Use camelCase enum names in API payloads.
- [#154](https://github.com/appccalc-developers/Alife/issues/154) Normalize membership enum casing for group UI authorization.
- [#156](https://github.com/appccalc-developers/Alife/issues/156) Support multilingual group metadata and compact management header.
- [#158](https://github.com/appccalc-developers/Alife/issues/158) Refine sermon ordering and consolidate list sections.
- [#160](https://github.com/appccalc-developers/Alife/issues/160) Add ordering and filtering controls for ListView sections.
- [#162](https://github.com/appccalc-developers/Alife/issues/162) Group Members: show display names and add member-picker invite page.
- [#164](https://github.com/appccalc-developers/Alife/issues/164) Route ListView events to enrollment page.
- [#166](https://github.com/appccalc-developers/Alife/issues/166) Normalize API help and event enrollment endpoints.
- [#168](https://github.com/appccalc-developers/Alife/issues/168) Refine group management navigation and event back FAB behavior.
- [#170](https://github.com/appccalc-developers/Alife/issues/170) Close AI Durable Object sessions after successful event or enrollment commit.
- [#172](https://github.com/appccalc-developers/Alife/issues/172) Store enrollment payment files by group event enrollment path.
- [#174](https://github.com/appccalc-developers/Alife/issues/174) Implement AI-powered event review module.
- [#176](https://github.com/appccalc-developers/Alife/issues/176) Use Cloudflare KV as shared cache for Groups API and remove Azure-side 304 checks.
- [#178](https://github.com/appccalc-developers/Alife/issues/178) Refactor controllers to use MediatR queries and commands.
- [#180](https://github.com/appccalc-developers/Alife/issues/180) Centralise all hardcoded Chinese UI strings into uiText.ts.
- [#182](https://github.com/appccalc-developers/Alife/issues/182) Internationalize frontend UI text.
- [#184](https://github.com/appccalc-developers/Alife/issues/184) Internationalize frontend UI strings and translate Chinese comments.
- [#186](https://github.com/appccalc-developers/Alife/issues/186) Internalize sermon playback navigation and localize AI event titles.
- [#188](https://github.com/appccalc-developers/Alife/issues/188) Stabilize current group loading around translated error handling.
- [#190](https://github.com/appccalc-developers/Alife/issues/190) Add member language preference to profile and JWT.

### Phase 6 Issues

- [#192](https://github.com/appccalc-developers/Alife/issues/192) Refine page section rendering and clean up unreachable page editor flows.
- [#194](https://github.com/appccalc-developers/Alife/issues/194) Simplify page builder section model.
- [#199](https://github.com/appccalc-developers/Alife/issues/199) Implement Page Builder V2 refactor.
- [#201](https://github.com/appccalc-developers/Alife/issues/201) Support manual and data-bound Spotlight sections.
- [#203](https://github.com/appccalc-developers/Alife/issues/203) Embed YouTube video of the sermon when source is sermons.
- [#205](https://github.com/appccalc-developers/Alife/issues/205) Implement animation using Framer Motion.
- [#207](https://github.com/appccalc-developers/Alife/issues/207) Speed Layer Refactoring: Vertical Slices and Middleware Pipeline.
- [#209](https://github.com/appccalc-developers/Alife/issues/209) Decouple Frontend and Speed-Layer.
- [#212](https://github.com/appccalc-developers/Alife/issues/212) Update CI/CD workflows and add speed-layer workflow.
- [#216](https://github.com/appccalc-developers/Alife/issues/216) Move alife-app and speed-layer to Cloudflare and update workflow.

### Phase 7 Issues

- [#219](https://github.com/appccalc-developers/Alife/issues/219) ProfileView: add logout action with localized labels.
- [#221](https://github.com/appccalc-developers/Alife/issues/221) Allow anonymous church lookup and align CODEOWNERS location.
- [#223](https://github.com/appccalc-developers/Alife/issues/223) Allow guest access to church content.
- [#225](https://github.com/appccalc-developers/Alife/issues/225) Enforce authorization before group edge cache reads.
- [#227](https://github.com/appccalc-developers/Alife/issues/227) Add @cloudflare/workers-types to speed-layer.
- [#229](https://github.com/appccalc-developers/Alife/issues/229) Improve API cache revalidation and debug group fetch.
- [#231](https://github.com/appccalc-developers/Alife/issues/231) Improve member-scoped profile cache revalidation.
- [#233](https://github.com/appccalc-developers/Alife/issues/233) Deduplicate group startup API calls.
- [#235](https://github.com/appccalc-developers/Alife/issues/235) Switch cache backend from Workers KV to Cache API.
- [#236](https://github.com/appccalc-developers/Alife/issues/236) Require Gemini Worker secret during deploy.
- [#240](https://github.com/appccalc-developers/Alife/issues/240) Optimize speed-layer Cache API revalidation.
- [#242](https://github.com/appccalc-developers/Alife/issues/242) Support multiple event reviews per event.
- [#244](https://github.com/appccalc-developers/Alife/issues/244) Simplify enrollment and preserve review photo previews.
- [#246](https://github.com/appccalc-developers/Alife/issues/246) Normalize event image URLs and direct image navigation.
- [#249](https://github.com/appccalc-developers/Alife/issues/249) Document Alife shipit workflow.
- [#251](https://github.com/appccalc-developers/Alife/issues/251) Update church management operations.
- [#253](https://github.com/appccalc-developers/Alife/issues/253) Add local leader UI display preferences.
- [#255](https://github.com/appccalc-developers/Alife/issues/255) Add group membership approvals and invitations.
- [#257](https://github.com/appccalc-developers/Alife/issues/257) Allow church leaders and co-leaders to manage roles and maintenance.
- [#259](https://github.com/appccalc-developers/Alife/issues/259) Improve group management member workflows.
- [#261](https://github.com/appccalc-developers/Alife/issues/261) Add Notification Center backend APIs.
- [#263](https://github.com/appccalc-developers/Alife/issues/263) Add frontend notification center host.
- [#265](https://github.com/appccalc-developers/Alife/issues/265) Fix frontend notification read endpoint.
- [#267](https://github.com/appccalc-developers/Alife/issues/267) Add membership workflow notifications.

### Phase 8 Issues

- [#269](https://github.com/appccalc-developers/Alife/issues/269) Move review session state context to POST JSON.
- [#271](https://github.com/appccalc-developers/Alife/issues/271) Fix event review photo duplication and simplify review UI.
- [#273](https://github.com/appccalc-developers/Alife/issues/273) Fix subgroup deletion cache invalidation.
- [#275](https://github.com/appccalc-developers/Alife/issues/275) Fix subgroup management access and membership cache invalidation.
- [#277](https://github.com/appccalc-developers/Alife/issues/277) Move group deletion into management danger zone.
- [#279](https://github.com/appccalc-developers/Alife/issues/279) Fix event review edit draft preservation.
- [#281](https://github.com/appccalc-developers/Alife/issues/281) Update page title editor to bilingual fields.
- [#283](https://github.com/appccalc-developers/Alife/issues/283) Standardize localized text writes on zh key.
- [#285](https://github.com/appccalc-developers/Alife/issues/285) Remove legacy cn localized text compatibility.
- [#287](https://github.com/appccalc-developers/Alife/issues/287) Add AI bilingual text autofill for settings.
- [#289](https://github.com/appccalc-developers/Alife/issues/289) Add AI bilingual completion to page editor.
- [#291](https://github.com/appccalc-developers/Alife/issues/291) Add AI mission and event context to event workflows.
- [#293](https://github.com/appccalc-developers/Alife/issues/293) Default enrollment name and make payment proof optional.
- [#295](https://github.com/appccalc-developers/Alife/issues/295) Restrict review photo uploads to supported image formats.
- [#297](https://github.com/appccalc-developers/Alife/issues/297) Move app language setting to localStorage.
- [#299](https://github.com/appccalc-developers/Alife/issues/299) Use stored active entity context for frontend navigation.
- [#301](https://github.com/appccalc-developers/Alife/issues/301) Fix reserved group route segments polluting active group context.
- [#303](https://github.com/appccalc-developers/Alife/issues/303) Remove account-backed profile language setting.
- [#305](https://github.com/appccalc-developers/Alife/issues/305) Remove group page tabs from event detail nav.

### Phase 9 Issues

- [#307](https://github.com/appccalc-developers/Alife/issues/307) Refresh alpha project documentation.
- [#309](https://github.com/appccalc-developers/Alife/issues/309) Add Terraform infrastructure script.
- [#311](https://github.com/appccalc-developers/Alife/issues/311) Document Alife architecture layers.
- [#313](https://github.com/appccalc-developers/Alife/issues/313) Add subgroup leader assignment in group management.
- [#316](https://github.com/appccalc-developers/Alife/issues/316) Hide group management danger zone and protected badges.
- [#318](https://github.com/appccalc-developers/Alife/issues/318) Show group leader and allow leadership transfer.
- [#320](https://github.com/appccalc-developers/Alife/issues/320) Increase group description editor height and guard unsaved group profile edits.
- [#322](https://github.com/appccalc-developers/Alife/issues/322) Harden Cloudflare AI session auth and cleanup.
- [#324](https://github.com/appccalc-developers/Alife/issues/324) Update group management navigation order and subgroup Chinese label.
- [#326](https://github.com/appccalc-developers/Alife/issues/326) Fix CORS headers for public image object URLs.
- [#328](https://github.com/appccalc-developers/Alife/issues/328) Fix image HEAD requests returning 404.
- [#330](https://github.com/appccalc-developers/Alife/issues/330) Fix SpeedLayer 304 CORS headers.
- [#333](https://github.com/appccalc-developers/Alife/issues/333) Support video section media and clarify group management header action.
- [#335](https://github.com/appccalc-developers/Alife/issues/335) Set English as initial app language.
- [#337](https://github.com/appccalc-developers/Alife/issues/337) Fix public page visibility publishing and access.
- [#339](https://github.com/appccalc-developers/Alife/issues/339) Make sermon watch links visible to guests.
- [#341](https://github.com/appccalc-developers/Alife/issues/341) Remove unused PageMetaForm component.
- [#343](https://github.com/appccalc-developers/Alife/issues/343) Improve page section editing workflow and remove unused subgroup members code.
- [#345](https://github.com/appccalc-developers/Alife/issues/345) Remove frontend src/api compatibility adapters.
- [#347](https://github.com/appccalc-developers/Alife/issues/347) Simplify page content header and preserve inline editing spaces.
- [#349](https://github.com/appccalc-developers/Alife/issues/349) Hide duplicate page header in group page tabs.
- [#351](https://github.com/appccalc-developers/Alife/issues/351) Add local dev startup workflow.
