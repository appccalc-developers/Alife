# ALIFE Engineering Retrospective — April–September 2026

> Repository evidence begins on 14 April 2026. There are no March commits on `main`; any March activity should be presented separately as pre-repository context supplied by Stephen, not as Git-verified history.

## Executive summary

Between 14 April and 16 September 2026, ALIFE evolved from an initial .NET API, SQL model and React demo into a broad alpha-stage community platform. The repository records working paths for group and member management, bilingual structured pages, publication review, sermons, events, enrollment, post-event review, announcements, albums, contacts, forums, identity applications, Passkeys, recovery, and a multi-layer Cloudflare delivery architecture.

The most important engineering story is not the number of features. It is the sequence of corrections:

- A short-lived phone/SMS registration path was removed in favour of LINE, then identity expanded again into Passkeys, invitation, activation and recovery when the product needed more than a single social-login route.
- A simple Page/Section CMS became bilingual and WYSIWYG, then gained group-owned publication governance, and finally separated working, submitted and published copies so edits no longer had to disturb live content.
- A Cloudflare proxy became an independent speed layer whose cache policy distinguishes public, group-shared and viewer-specific data.
- Event Management moved from CRUD, enrollment and post-event review into accepted Plans, recurrence, roles, specialist capability modules, immutable Package evidence and explicit lifecycle gates.
- A generic Event workflow implementation was built, evaluated and then retired in favour of dedicated domain flows rather than being preserved merely because it already existed.

This is credible evidence of product and architecture iteration. It is not evidence by itself of market adoption, production SLOs, completion of every Event module, or live provider behaviour. The current source is best described as a substantial, test-covered alpha implementation whose deployment and real-user outcomes still require separate evidence.

## Evidence base and boundaries

This account uses reachable `main` history, commit messages and diffs, migrations, source, tests, package manifests, routes, architecture documents, Event implementation status, and removed code visible in Git.

The period contains 562 reachable commits on `main` by committer date: 86 in April, 160 in May, 119 in June, 96 in July, 52 in August and 49 through 16 September. Commit subjects expose 398 distinct merged-PR identifiers. Exact issue totals and current open/closed state were not reverified because GitHub credentials were unavailable; issue and PR numbers share one sequence, so commit references are not a safe substitute for a server-side issue report.

Current repository scale is useful only as context: 79 EF migration source files, five production backend projects plus one test project, two npm packages, 45 API controllers, 351 HTTP endpoint attributes, and 95 React route declarations. The repository has no Git tags. `VERSION` and `CHANGELOG.md` began to record release labels on 31 August, but those labels should not be presented as independently verified GitHub releases.

## The architecture evolved in three phases

### 1. Foundation and feasibility — 14 April to 15 May

The first phase established whether the product could combine community identity, structured content, sermons, mobile delivery and AI-assisted Event creation without collapsing those concerns into one application.

The initial repository already contained relational `Page` and typed `Section` aggregates, group/member models and sermon persistence (`d6cac408`, 14 April). YouTube playlist synchronisation was corrected so sermon reads did not wait for a provider refresh (`e7833c74`, `5c4901d4`, 15 April). A React frontend and PWA baseline followed (`bf368830`, `bbc2fe9a`).

Identity changed quickly. LINE OAuth with JWT claims and onboarding landed on 16 April (`8b0df29b`). A temporary Twilio/phone-verification path was removed on 22 April when LINE became the sole registration path (`d0e5ad29`). The API stopped hosting SPA concerns (`40be5cec`), moved to Azure Functions isolated worker (`739b259a`), and gained container/local architecture support (`b78237a1`).

In early May, the frontend adopted TanStack React Query and React DB (`898ab5cf`), the backend added ETag and soft-delete support (`824df204`), and Cloudflare proxy/image Workers entered the repository (`14752e3c`, `18c830b4`). The first semantic Event creator and Gemini integration landed on 11 May (`f43f4f2f`), followed by Durable Object session state and the persisted `GroupEvent` root (`5708c850`, `c77a60d0`).

This phase was exploratory, but it produced real architectural commitments: separate browser/API/edge/storage responsibilities, HttpOnly-cookie sessions, structured content rather than HTML-only pages, and temporary AI conversation state separated from accepted business records.

### 2. Integrated alpha productisation — 17 May to 26 August

By 17 May the work had moved beyond feasibility. A dedicated Event controller and tested CRUD handlers existed (`21048c41`); leader editing followed (`c350f817`), then end-to-end enrollment (`198964af`) and AI-assisted post-event review (`847eac1f`). The May lifecycle was create, enroll and record reviews—not the later governance model, and not a fifth “Review” stage.

The CMS also became a product workflow. Shared page rendering and WYSIWYG editing landed in `5fd762f8`; bilingual Page storage in migration `20260525084708_PageAggregateMultilingual.cs`; bilingual section switching in `6730afba`. Page Builder V2 simplified the model around reusable display patterns and legacy normalisation in early June (`f6fb2ae1`, `113fa7a5`, `3608b67c`). TinyMCE support arrived on 30 June (`05bfc74b`).

The Cloudflare architecture became an independent package on 4 June (`952ce976`). Shared group caching first moved from Workers KV to the Cache API (`5b069fa5`), while authorization-before-cache was enforced for group reads (`bd39410d`). Later production-style failures led to query-key fixes, global invalidation and a more deliberate public cache: Cache API as L1 and KV as cross-PoP L2 for reviewed public pages (`a0052fef`, `4ce018cc`). This was not “cache everything.” Identity, member profiles, enrollment lists and protected Event records remained private and viewer-specific.

Public publishing required a larger correction. Platform roles and administration foundations arrived in June (`ed500364`, `363313c6`). A global Page model was introduced (`02fb88fd`) but retired on 7 July (`6469525f`). The replacement kept content owned by its group and stored publication review separately. Public menus, homepage placement and safe reviewed pages from protected groups followed (`337b4b50`, `586336c1`, `21ff926d`).

July also expanded the platform around the same ownership, bilingual, visibility and cache rules: FileAssets and visitor contact (`78510410`, `48f7be35`), forum (`b8cbb556`), sermon discussions (`573451b7`), Bible reading progress (`ad3c28ad`), announcements (`decefd9b`), albums (`7509a6ed`), contacts (`e076e61b`) and historical content import (`706efa74`, `df9f51f8`).

Events gained lifecycle action rules and the first RAM gate on 22 July (`c369f1e9`, `09f95fe1`). In August a generic workflow/template/artifact system was implemented (`a3981bba`) while the rest of the application consolidated navigation, privacy-safe forums, public homepage caching and administrative workspaces.

This phase demonstrates productisation more clearly than the original June boundary suggests. It began in the second half of May and combined UI workflows, persistence, authorization, caching, tests, deployment boundaries and operational fixes.

### 3. Governance-heavy identity and Event domain engineering — 27 August to 16 September

The clearest domain-engineering inflection point is 27 August. Commit `efcda7ef` introduced Event composition and supporting schema for archetypes, activity templates, accepted Plans, series/occurrences, role assignments, venues and conflicts, safeguarding, transport and operational work. It preserved `GroupEvent` as a compatibility root rather than forcing a big-bang rewrite.

On 31 August, the CMS gained a comparable governance boundary. Commit `57d2ce1b` added persisted submitted and published snapshots, working-copy/public-copy endpoints, optimistic concurrency, and cache invalidation. A group can continue editing or resubmit a Page while visitors keep reading the last approved copy. This is publication-copy isolation, not a full arbitrary revision-history system.

Identity was redesigned in the same week. Commit `e84f34f5` added Passkey credentials and ceremonies, invitations, internal alpha login, management APIs and auditable onboarding state. Subsequent work added safe diagnostics and manual activation (`bb3ad544`, `eb1a4b9e`), browser continuation and Passkey recovery (`f34d3496`), email/provider-backed activation and account recovery (`945db2db`), and public church applications with phone-oriented Passkey entry (`46d952bf`). LINE remained as a configurable legacy entry rather than the whole identity model.

Event Package Approval landed on 3 September (`1ec35845`). Its purpose was to avoid treating “Plan accepted,” “RAM approved,” “publish,” “registration open,” and “ready to execute” as one mutable Boolean. The current source builds immutable Package evidence from versioned sources, records scoped decisions and conditions, supports delegation and occurrence exceptions, and evaluates publication, registration and execution through server-side gates.

The rest of September moved specialist work into reachable flows: conversational details assistance (`79a1dcc9`), nonlinear preparation and reopening (`de9aa093`), versioned RAM and arrangements (`5dcb1fcd`), creator ownership and scoped staffing (`55098f7b`), module confirmation (`63c4942e`), duties and task approval (`d49b29cb`), manual rosters and waitlists (`f34b01c6`), collaboration workspaces (`a8d3095f`) and activity planning/delegation/RAM synchronisation (`9380b057`).

The strongest architectural correction in this phase was removal, not addition. On 13 September, the generic Event workflow APIs, services and UI were retired (`c4110cb4`). Historical tables remained for compatibility, but current work moved to dedicated RAM, duty, registration, report, venue, safeguarding, transport, roster and Package services. That decision is more defensible than carrying a generic abstraction after specialist authority and privacy rules had outgrown it.

## Five engineering decisions that matter

### 1. Cache by audience, not only by URL

ALIFE's caches evolved through service workers, IndexedDB/ETags, TanStack, backend HybridCache, Cloudflare Cache API and KV. Bugs exposed query-key collisions, authorization-order mistakes and cross-PoP invalidation gaps. The resulting architecture classifies responses:

- reviewed public projections may use shared L1/L2 edge storage;
- group-shared data is reused only after current authorization is established;
- profiles, identity, enrollment and protected Event operations are private/no-store;
- the service worker does not replay API responses independently of those rules.

The important result is not the number of cache layers. It is that performance, privacy, revocation and invalidation became one design problem.

### 2. Separate content ownership from public governance

The repository records an intermediate global Page approach and its removal. The final direction keeps a Page owned by its group while reviewers manage publication, menus and public placement. The August snapshot work then separated live content from work in progress.

This sequence is a useful interview story because it shows willingness to replace a plausible but weak model, preserve existing data, and clarify author, owner, reviewer and visitor responsibilities.

### 3. Treat recovery as part of authentication

LINE login proved a social identity path, but it did not solve first activation, invitation, lost credentials, browser continuation or elevated-account recovery. The Passkey design stores public credential material and one-time hashed invitation secrets, rechecks issuer authority, distinguishes identity verification from phone verification, and keeps recovery responses private/no-store.

The repository supports QR/browser-bound continuation and recovery. It does not prove that every browser or Passkey provider will offer the same cross-device experience; that requires a real device matrix.

### 4. Replace Event CRUD with versioned domain evidence without breaking compatibility

ALIFE retained its original `GroupEvent` root and legacy payloads while adding accepted Plans, materialised occurrences, modules, roles and Packages alongside them. Existing Events are not assigned invented approval, and version-0 enrollment semantics are not silently reinterpreted as the version-1 participant model.

That additive strategy reduced migration risk and made the domain transition reviewable. It also leaves explicit follow-up work: shared-database rehearsals, rollout policy, live account testing, and eventual decisions about legacy cutover.

### 5. Keep AI below the authority boundary

AI assists with Event details, enrollment, post-event review, bilingual content, posters, task forms and RAM drafts. The supported pattern is consistent: temporary session, evidence-limited prompt, editable candidate output, explicit human adoption, and backend authorization for durable records.

AI cannot confirm a safety fact, assign a role, approve a Package, publish content or make an Event ready. Page saving also remains available when AI translation fails (`979a4b1f`). This is a better measure of AI product maturity than the number of AI entry points.

## Current capability boundary

As of 16 September, repository evidence supports the following description:

**Implemented in current source**

- LINE legacy login, JWT/HttpOnly-cookie sessions, Passkeys, invitation/activation, public applications, browser continuation and recovery;
- bilingual Page/Section editing, review, menus, public snapshots and cached delivery;
- Event CRUD, enrollment, post-event review, recurrence, accepted Plans, teams/roles, Package Approval, lifecycle gates, duties, rosters, versioned RAM, venues/conflicts, safeguarding core, transport core and collaboration/report workspaces;
- public and member community features including sermons, Bible progress, announcements, albums, contacts and forums.

**Partially implemented**

- `PLACE.RESOURCE`: venue catalogue, reservations, conflicts and recurring calendars exist; equipment and full handover/return workflows do not;
- `MOVE.STAY`: transport core exists; parking and accommodation do not;
- `COMMS.FOLLOWUP`: content, posters, publication and reviews exist; delivery tracking and purpose-controlled follow-up do not;
- `MONEY.FINANCE` and `FOOD.HOSPITALITY`: bounded manual/report slices exist, not full operational modules.

**Documented or unavailable**

- `FESTIVAL.OPERATIONS` remains structural target material;
- Plan B/contingency is explicitly not planned in the current Event contract;
- a fifth Review/Reflection lifecycle stage is not part of the product;
- provider payments, full content revision history and complete Event-module coverage should not be claimed.

## Engineering activity and verification

The codebase is roughly balanced between C# and TypeScript/TSX production source after excluding generated migration designers: about 57,800 C# lines and 56,200 TypeScript/TSX lines. This is repository scale, not a quality measure.

Fresh checks run against the 16 September source produced:

- 845 backend tests passed, five opt-in SQL tests skipped, zero failed;
- 19 focused identity frontend tests passed;
- 85 Event composition/frontend tests passed;
- 119 speed-layer Worker tests passed;
- the production TypeScript/Vite/PWA build succeeded.

These checks support current source claims. They do not establish live LINE, Gemini, YouTube or email behaviour, shared/production migration state, browser/device acceptance, or deployment availability.

Git also records substantial AI-assisted engineering. Thirty-three commits are authored by Copilot identities, at least 21 commit messages include agent-session URLs, the repository contains explicit agent instructions and planning prompts, and one August commit records OpenAI Codex as co-author. Those markers undercount sessions whose squash metadata omitted AI attribution. They establish AI participation, not the division of product judgment, implementation authorship and review responsibility; Stephen should describe that division explicitly in an interview.

## What this work demonstrates

The strongest evidence for a senior engineering discussion is:

1. **Architecture was revised when domain constraints changed.** Global Pages and the generic Event workflow were removed rather than defended.
2. **Security and caching were designed together.** Authorization order, shared keys, revocation, public projections and invalidation are visible in code and tests.
3. **Compatibility was treated as a product constraint.** Page JSON normalisation, `GroupEvent` continuity, versioned Event semantics and additive migrations avoid silent rewrites.
4. **AI was integrated into accountable workflows.** Draft assistance degrades safely and does not replace human approval.
5. **The work spans product and operations.** The history includes mobile/PWA behaviour, identity, domain models, SQL migrations, Cloudflare Workers, Azure Functions, CI/CD, Terraform, diagnostics and recovery paths.

The claims that still need Stephen's own evidence are equally important: why particular pivots were made, what stakeholder feedback drove them, how collaboration was divided, which environments were deployed, and what real users completed successfully.

## What should happen next

The next phase should prioritise evidence over breadth:

1. Reconcile `VERSION`, changelog entries and release/tag practice.
2. Run the skipped SQL migration/concurrency suites against an approved disposable database, then rehearse the current additive migration chain.
3. Execute a real browser/device identity matrix covering Passkey creation, hybrid sign-in, cancellation, continuation and recovery.
4. Test live provider paths with controlled accounts and explicit cost/privacy limits.
5. Run structured alpha trials for page publication, membership activation and Event preparation; capture task completion, failures and support needs.
6. Stabilise the implemented Event core before expanding partial modules or revisiting deliberately excluded Plan B.

## One-minute interview version

> ALIFE began in Git on 14 April 2026 as a .NET/SQL API with a React demo, structured pages and sermon integration. By mid-September it had become a substantial alpha implementation spanning bilingual content publishing, group/member workflows, Passkey identity and recovery, Event enrollment and review, Cloudflare edge delivery, and a capability-oriented Event model with recurrence, roles, RAM and version-bound Package Approval.
>
> The strongest engineering examples are the changes of direction. Public content moved from global ownership to group-owned review and then to isolated published snapshots. Caching moved from ad-hoc layers to audience-classified Cache API/KV/HybridCache behaviour with authorization before shared reads. Event Management moved from CRUD and a generic workflow prototype to dedicated capability services and immutable approval evidence, while preserving legacy records. AI was useful for drafting and bilingual assistance but stayed behind explicit human adoption and server authorization.
>
> The repository and fresh tests support those implementation claims. I would not claim production maturity or market success without deployment records, live provider/device testing and real-user metrics. The next engineering step is to gather that evidence and stabilise the alpha around its critical journeys.

## Audit companion

The detailed evidence table, disputed claims, missing context, metrics method, module-by-module status and interview case studies are in [`project-retrospective-verification.md`](project-retrospective-verification.md).
