# Alife Project Retrospective: From an Idea to a Useful Alpha Product

## Executive summary

Alife began with a concrete problem: for overseas Chinese churches, groups, members, web pages, sermons, events, enrollment, and bilingual content are often fragmented across unrelated tools, chat histories, and the personal knowledge of a few volunteers. My goal was not to build another information website. It was to create a community platform in which visitors, members, group leaders, content volunteers, reviewers, and platform administrators could complete real tasks.

Between 15 April and 23 July 2026, the project recorded 271 GitHub issues. Of those, 269 are closed and two remain open. The count is not the achievement by itself. The stronger evidence of zero-to-one product ability is that the work documented by those issues gradually formed complete workflows:

- Visitors can browse public pages, sermons, events, discussions, and historical articles.
- Members can join groups, enroll in events, participate in discussions, read a bilingual Bible, and preserve reading progress across devices.
- Leaders can manage members, subgroups, announcements, albums, contacts, pages, and events.
- Non-technical content volunteers can build and maintain a bilingual public website through a WYSIWYG page builder.
- Reviewers can govern publication, public navigation, and homepage placement.
- AI can assist with event planning, enrollment, review, translation, and risk assessment while leaving approval and responsibility with people.
- The backend, Cloudflare edge, and PWA cache layers balance performance, cost, privacy, authorization, and freshness.

At the time of this retrospective, Alife is no longer a concept prototype. It is an alpha product with real business boundaries, role-based access, content governance, operational tooling, and a traceable history of iteration.

## Evidence base

- Repository: [`appccalc-developers/Alife`](https://github.com/appccalc-developers/Alife)
- Scope: all 271 open and closed issues
- Date range: 15 April to 23 July 2026
- Monthly distribution: 22 issues in April, 68 in May, 98 in June, and 83 in July
- Current state: 269 closed, two open, or 99.3% closed

Issue volume represents traceable work, not 271 independent features or a direct measure of engineering speed. GitHub issues and pull requests share one numbering sequence, so issue numbers extend from #1 to #575. The corpus also contains an explicit test issue ([#416](https://github.com/appccalc-developers/Alife/issues/416)). This retrospective treats issue bodies, acceptance criteria, state, and chronology as evidence of product evolution rather than using the raw count as a marketing claim.

## The product’s zero-to-one growth

### Stage 1: Build a trustworthy foundation

The first work did not maximize feature count. It addressed the foundations a community product needed before people could trust it: identity, access, mobile behavior, and deployment.

The project removed a sermon-read delay caused by synchronous YouTube updates ([#1](https://github.com/appccalc-developers/Alife/issues/1)), stopped issuing unnecessary guest identifiers ([#3](https://github.com/appccalc-developers/Alife/issues/3)), added PWA support with older iPhone considerations ([#5](https://github.com/appccalc-developers/Alife/issues/5)), and established LINE OAuth with JWTs in HttpOnly cookies ([#9](https://github.com/appccalc-developers/Alife/issues/9), [#21](https://github.com/appccalc-developers/Alife/issues/21)).

I also separated the backend from SPA concerns ([#11](https://github.com/appccalc-developers/Alife/issues/11)), moved it to Azure Functions ([#13](https://github.com/appccalc-developers/Alife/issues/13)), and added container support ([#19](https://github.com/appccalc-developers/Alife/issues/19)).

This stage shows that I approached zero-to-one work by making identity, API boundaries, mobile access, and the deployment path dependable before pursuing breadth.

### Stage 2: Turn screens into a usable group product

The next stage focused on how members and leaders would use Alife each day. The frontend evolved into a mobile-first app shell with bottom navigation, side navigation, drawers, and contextual actions ([#25](https://github.com/appccalc-developers/Alife/issues/25), [#30](https://github.com/appccalc-developers/Alife/issues/30)).

Group detail changed from a static profile into a page-centered content entry point, while leader tools moved into a separate management context ([#29](https://github.com/appccalc-developers/Alife/issues/29), [#38](https://github.com/appccalc-developers/Alife/issues/38), [#47](https://github.com/appccalc-developers/Alife/issues/47)).

The product decision was simple but important: members primarily want to read and participate; leaders need to manage people and content. Separating those modes better matched real roles than placing every action on one screen.

### Stage 3: Make performance and media an architecture, not a patch

As content and list views grew, performance could no longer be handled independently by each screen. I consolidated service-worker behavior and conditional requests ([#53](https://github.com/appccalc-developers/Alife/issues/53), [#56](https://github.com/appccalc-developers/Alife/issues/56), [#58](https://github.com/appccalc-developers/Alife/issues/58)), then added a Cloudflare proxy, Cache API behavior, passive invalidation, and a separate image Worker ([#61](https://github.com/appccalc-developers/Alife/issues/61), [#62](https://github.com/appccalc-developers/Alife/issues/62)).

The edge layer later moved into vertical slices and middleware ([#207](https://github.com/appccalc-developers/Alife/issues/207)), then became an independent package and CI/CD unit ([#209](https://github.com/appccalc-developers/Alife/issues/209), [#212](https://github.com/appccalc-developers/Alife/issues/212)).

The design was never “cache everything publicly.” Alife progressively distinguished public, group-shared, member-specific, and browser-local data, and required authorization before shared group-cache reads ([#133](https://github.com/appccalc-developers/Alife/issues/133), [#143](https://github.com/appccalc-developers/Alife/issues/143), [#147](https://github.com/appccalc-developers/Alife/issues/147), [#225](https://github.com/appccalc-developers/Alife/issues/225)).

This demonstrates that I can optimize latency and cost while still reasoning about privacy leakage, stale authorization, and invalidation.

### Stage 4: Build a complete event lifecycle and place AI inside it

Events began as a domain entity and CRUD API ([#81](https://github.com/appccalc-developers/Alife/issues/81), [#85](https://github.com/appccalc-developers/Alife/issues/85)), then expanded into leader editing, member enrollment, payment files, post-event review, and multiple review entries ([#83](https://github.com/appccalc-developers/Alife/issues/83), [#84](https://github.com/appccalc-developers/Alife/issues/84), [#172](https://github.com/appccalc-developers/Alife/issues/172), [#174](https://github.com/appccalc-developers/Alife/issues/174), [#242](https://github.com/appccalc-developers/Alife/issues/242)).

AI was not built as an isolated chat box. Shared AI session infrastructure used Cloudflare Durable Objects for temporary conversation state, while reviewed business records were persisted through backend APIs only after the user committed them ([#109](https://github.com/appccalc-developers/Alife/issues/109), [#111](https://github.com/appccalc-developers/Alife/issues/111)).

The workflow later added bilingual Risk Assessment and Management drafts, risk scoring, leader confirmation, and auditor approval ([#565](https://github.com/appccalc-developers/Alife/issues/565), [#567](https://github.com/appccalc-developers/Alife/issues/567)). The AI is explicitly prohibited from inventing responsible people, phone numbers, first-aid qualifications, driver licences, registrations, WOF status, or vehicle condition. Events cannot accept enrollment until the RAM is approved.

This shows how I turn AI into a useful component of a governed workflow: it reduces cognitive load, while people retain truth, accountability, and final authority.

### Stage 5: Let non-technical volunteers maintain bilingual content

Pages evolved from structured sections into a real WYSIWYG builder: shared rendering and editing ([#117](https://github.com/appccalc-developers/Alife/issues/117)), bilingual data contracts ([#127](https://github.com/appccalc-developers/Alife/issues/127), [#135](https://github.com/appccalc-developers/Alife/issues/135)), a simplified section model with legacy normalization ([#194](https://github.com/appccalc-developers/Alife/issues/194), [#199](https://github.com/appccalc-developers/Alife/issues/199)), and manual or data-bound Spotlight sections ([#201](https://github.com/appccalc-developers/Alife/issues/201)).

Later iterations focused less on adding section types and more on reducing authoring friction:

- A section-type-first add flow with sensible source defaults ([#399](https://github.com/appccalc-developers/Alife/issues/399)).
- TinyMCE plus R2-backed image and video selection ([#401](https://github.com/appccalc-developers/Alife/issues/401), [#486](https://github.com/appccalc-developers/Alife/issues/486)).
- Saving remains available when AI translation fails, so an assistant cannot block the core task ([#403](https://github.com/appccalc-developers/Alife/issues/403)).
- Invalid bilingual structures and text placed in the wrong language field are detected ([#480](https://github.com/appccalc-developers/Alife/issues/480)).
- Unsaved-change protection, autosave, and more direct section editing reduce data-loss risk and extra clicks ([#478](https://github.com/appccalc-developers/Alife/issues/478), [#527](https://github.com/appccalc-developers/Alife/issues/527)).

This stage is strong product evidence because the target user is a non-technical group leader. Success means that person can understand the editor, use it confidently, and avoid losing content or corrupting bilingual data.

### Stage 6: Grow from an internal group tool into a governed public website

Once group pages could become public, Alife needed more than a `Public` flag. It needed governance. The project added platform roles, permissions, administration APIs, and an admin console ([#363](https://github.com/appccalc-developers/Alife/issues/363), [#371](https://github.com/appccalc-developers/Alife/issues/371), [#375](https://github.com/appccalc-developers/Alife/issues/375), [#419](https://github.com/appccalc-developers/Alife/issues/419)).

Publication then went through several deliberate refinements. It started with global pages and a review queue ([#369](https://github.com/appccalc-developers/Alife/issues/369), [#405](https://github.com/appccalc-developers/Alife/issues/405)), changed so pages remained owned by their groups with separate approval and return records ([#443](https://github.com/appccalc-developers/Alife/issues/443), [#454](https://github.com/appccalc-developers/Alife/issues/454)), and ultimately retired the global-page ownership model ([#457](https://github.com/appccalc-developers/Alife/issues/457)).

Approved pages now feed configurable bilingual primary menus, child menus, and homepage placements ([#508](https://github.com/appccalc-developers/Alife/issues/508), [#512](https://github.com/appccalc-developers/Alife/issues/512), [#516](https://github.com/appccalc-developers/Alife/issues/516)). A reviewed public page may come from a protected group, but only its public projection becomes anonymous-safe; member content remains protected ([#518](https://github.com/appccalc-developers/Alife/issues/518)).

This history demonstrates an important zero-to-one skill: I can acknowledge that an early model is wrong, migrate toward clearer ownership and review boundaries, and preserve compatibility instead of forcing users to carry an architectural mistake.

### Stage 7: Complete the content and collaboration needs of a community product

Once the platform foundation stabilized, Alife expanded into a more complete set of church-life workflows:

- Membership requests, invitations, role management, and notifications ([#255](https://github.com/appccalc-developers/Alife/issues/255), [#257](https://github.com/appccalc-developers/Alife/issues/257), [#261](https://github.com/appccalc-developers/Alife/issues/261), [#267](https://github.com/appccalc-developers/Alife/issues/267)).
- A site-wide forum, sermon discussions, and anonymous browsing ([#447](https://github.com/appccalc-developers/Alife/issues/447), [#467](https://github.com/appccalc-developers/Alife/issues/467)).
- Bilingual YouVersion Bible reading with cross-device progress ([#488](https://github.com/appccalc-developers/Alife/issues/488)).
- Announcements with audience, status, priority, and expiry rules ([#492](https://github.com/appccalc-developers/Alife/issues/492)).
- Nested albums and authorization-aware media ([#498](https://github.com/appccalc-developers/Alife/issues/498)).
- Group and event contacts with inquiry notifications ([#504](https://github.com/appccalc-developers/Alife/issues/504)).
- A historical content archive with repeatable import and a public index ([#531](https://github.com/appccalc-developers/Alife/issues/531), [#533](https://github.com/appccalc-developers/Alife/issues/533)).
- Migration of legacy About Us content into the current website builder ([#541](https://github.com/appccalc-developers/Alife/issues/541)).

These are not disconnected menu items. They reuse the same ownership, bilingual, visibility, review, media, and caching rules. That is evidence that Alife grew from a feature collection into an extensible product platform.

### Stage 8: Move into alpha reliability and operability

Many late issues are not new features. They are the kinds of failures and refinements that only appear in a real, integrated system:

- Production HTML and asset freshness, profile authorization, and phone normalization ([#496](https://github.com/appccalc-developers/Alife/issues/496)).
- Privacy boundaries for imported source URLs ([#539](https://github.com/appccalc-developers/Alife/issues/539)).
- Production migration and dependency-injection failures in DbMigrator ([#385](https://github.com/appccalc-developers/Alife/issues/385), [#545](https://github.com/appccalc-developers/Alife/issues/545)).
- PWA safe areas around mobile notches and home indicators ([#547](https://github.com/appccalc-developers/Alife/issues/547)).
- Sermon pagination cache-key collisions and global invalidation across Cloudflare points of presence ([#549](https://github.com/appccalc-developers/Alife/issues/549)).
- L1 Cache API, L2 KV, and prewarming for public pages ([#553](https://github.com/appccalc-developers/Alife/issues/553)).
- Permission-gated cache diagnostics and an honest unavailable state for sermon transcripts ([#573](https://github.com/appccalc-developers/Alife/issues/573)).

The project also added Terraform, architecture documentation, one-command local startup, and component-aligned CI/CD ([#309](https://github.com/appccalc-developers/Alife/issues/309), [#311](https://github.com/appccalc-developers/Alife/issues/311), [#351](https://github.com/appccalc-developers/Alife/issues/351)).

This stage shows that I do not stop at launching features. I take responsibility for making a product diagnosable, deployable, maintainable, transferable, and safe to evolve.

## Three case studies that best demonstrate product ability

### 1. Page builder: from “editable” to “safe for volunteers to publish”

This capability spans the data model, API, WYSIWYG editor, bilingual validation, media library, autosave, publication review, menu configuration, public caching, and legacy-content migration. The outcome is not a large list of section types. It is an understandable and governable path from “leader writes content” to “reviewer approves it” to “visitor sees it.”

It demonstrates that I can:

- Design from a user task instead of exposing database tables.
- Simplify a model while keeping existing pages readable.
- Support authors, reviewers, and visitors as distinct roles.
- Treat bilingual content, media, authorization, and caching as product concerns.

### 2. Multi-layer caching: performance, cost, and privacy in one design

Alife’s caching evolved through service workers, ETags, IndexedDB, backend HybridCache, Cloudflare Cache API, authorization mirrors, and global KV. The project also encountered query-key collisions, 304 CORS problems, authorization-order mistakes, and cross-PoP invalidation gaps.

I did not avoid the complexity by disabling caching. I classified data instead:

- Public content may be shared across users and edge locations.
- Group content may be shared only after current authorization is established.
- Member profiles must be isolated per user.
- Browser API caching must not replay private data after an identity change.

This demonstrates root-cause analysis and the ability to turn production fixes into architectural rules and regression coverage.

### 3. AI event workflows: useful assistance with human accountability

The event assistant evolved from description generation into planning, enrollment, review, poster and reference-document reading, bilingual notices, and RAM risk assessment. The system preserves temporary sessions, editable drafts, missing-information markers, leader confirmation, and auditor approval.

The key product decision is that AI neither publishes automatically nor invents safety facts. An unapproved RAM prevents enrollment. This turns AI from a demo feature into an assistant that can enter a real workflow without crossing the boundary of human responsibility.

## What the issue history demonstrates

| Capability | Observable evidence |
|---|---|
| Product definition from an ambiguous problem | Fragmented group, content, event, and communication needs became role-specific workflows for visitors, members, leaders, reviewers, and administrators |
| End-to-end delivery | Issues regularly span entities, migrations, APIs, authorization, frontend UX, edge caching, tests, and deployment |
| Iteration over attachment to the first design | LINE replaced SMS, group ownership replaced global pages, section types were consolidated, and caches were re-layered by workload |
| User-experience judgment | Mobile-first navigation, safe areas, WYSIWYG editing, media selection, autosave, leave protection, honest empty states, and bilingual copy |
| Security and privacy awareness | HttpOnly cookies, server-side role checks, authorization before shared caching, public DTO projections, and hidden private source URLs |
| AI product judgment | Editable drafts, human confirmation, non-invention rules, approval gates, and graceful degradation when AI translation fails |
| Operability and maintainability | Terraform, independent CI/CD, local startup automation, architecture docs, cache diagnostics, migration tooling, and regression tests |

## What went well

1. **The work stayed anchored to real roles.** Features consistently identify who creates, reviews, sees, and owns the result.
2. **Weak abstractions were revised.** Page ownership, cache storage, language preference, and section modeling all changed when real constraints exposed problems.
3. **Non-functional requirements were treated as product behavior.** Authorization, freshness, PWA safe areas, migration, and diagnostics directly affect user trust.
4. **AI stayed subordinate to the workflow.** It reduced input and translation effort without replacing business authorization or human accountability.
5. **The evolution remained traceable.** Issues, acceptance criteria, validation commands, tests, and architecture documents make decisions explainable and reviewable.

## What I would do earlier if I started again

1. **Define product metrics sooner.** The issue history proves delivery scope, but it does not yet prove active use, task-completion rates, publishing lead time, or retention.
2. **Introduce end-to-end tests sooner.** Backend, Worker, and build checks are substantial, but login, joining, publication, and enrollment still need stable browser-level regression coverage.
3. **Model publication governance earlier.** The move away from global pages was the right correction, but an earlier definition of author, owner, review state, and public projection would have reduced intermediate rework.
4. **Establish observability earlier.** Cache diagnostics arrived late. Structured logs, traces, and business events should be part of the alpha foundation.
5. **Create stability windows.** High issue density accelerated product breadth but also increased regression risk. The next phase should favor real-user feedback, smaller release batches, and deliberate stabilization.

## Current boundary and next step

Two issues remain open:

- [#420 Visitor contact requests](https://github.com/appccalc-developers/Alife/issues/420): allow public-site visitors to submit contact requests with managed status tracking.
- [#421 File asset management](https://github.com/appccalc-developers/Alife/issues/421): formalize file assets, storage providers, signed URLs, access control, and backfill operations.

The highest-value next phase is not another set of menu items. It is to:

1. Run structured alpha trials with one or two real church groups.
2. Measure the time and failure points for building a page, publishing an announcement, and creating an event.
3. Add end-to-end tests and business-event telemetry for those critical journeys.
4. Close the visitor-contact and file-asset platform gaps.
5. Use real adoption and task data to define the beta scope.

## One-minute interview version

> I started Alife from a real problem in overseas Chinese churches: group operations, bilingual content, events, and communication were fragmented across unrelated tools. In roughly one hundred days, I took it from a basic API and PWA to a usable alpha community platform covering LINE authentication, group and member management, bilingual page building and publication review, sermons, event enrollment and review, forums, announcements, albums, contacts, historical-content migration, and AI-assisted event planning and RAM risk assessment.
>
> The strongest evidence is not the 271 issues. It is that I delivered complete workflows across React, .NET, SQL, Azure Functions, Cloudflare Workers, R2, Durable Objects, and several cache layers. I also changed course when early models were wrong: I retired global page ownership, re-layered caching by data sensitivity, and kept AI behind human confirmation and authorization. The product now has the governance, security, operations, and maintainability expected of an alpha. The next step is to validate the beta with real user metrics.

## Evidence-use note

This document is suitable for a portfolio or interview narrative, with the following boundaries:

- It is fair to say, “I built and iterated a complete alpha product with end-to-end workflows.”
- It is fair to say, “269 closed issues demonstrate scope and traceability.”
- Issue close times should not be presented as actual engineering duration without reviewing pull requests and deployment records.
- Market success should not be claimed until there is active-user, task-completion, and retention evidence.
- If parts of the work involved collaborators or AI assistance, the interview account should accurately distinguish product decisions, architecture responsibility, implementation scope, and review ownership.
