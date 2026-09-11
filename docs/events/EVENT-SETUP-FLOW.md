# Continuous Event preparation

> Documentation class: **Normative feature contract**. Read with [EVENT-CONTRACT.md](EVENT-CONTRACT.md), [event-contract.json](event-contract.json), [TEAM.WORK](modules/TEAM.WORK.md), and [COMMS.FOLLOWUP](modules/COMMS.FOLLOWUP.md). Delivery evidence belongs in [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md).

## User flow

The preparation rail is **Template → Details → Arrangements → Confirm creation → Team and tools → Formal approval → Poster → Publish**. Chinese labels are **选择模板 → 活动资料 → 活动安排 → 确认创建 → 团队与功能 → 正式审批 → 海报制作 → 发布活动**. Creation saves one Event and its accepted Plan/arrangements. It continues directly to that saved Event's team/tool settings. Returning to later stages never creates another Event.

The first four stages retain the scoped local draft and explicit creation confirmation. After creation they display as saved. Saved stages use `/groups/{groupId}/events/{eventId}/workspace?flow=setup&stage=details|arrangements|review|setup|approval|poster|publish`. The optional `module` query selects a known, enabled surface through the existing compile-time registry. Unknown stages fall back to setup. Reloading retains the stage and reads the same Event; navigation is not a new business-state machine.

Team/tools reuse existing accepted arrangements, invitations, assignments, tasks and operational editors. RAM and enrollment management provide a return to preparation. The ordinary workspace remains reachable for operational management, with its former alternate Plan editor replaced by a link into preparation. Changing UI language preserves entity identity and does not refetch stage data.

The Details assistant uses its existing explanation as the input label: “Explicit details fill the draft; uncertain details prompt a follow-up. Review before creating.” / “明确提供的资料会填入草稿；不确定之处会继续询问。请在创建前审阅。” The voice control remains beside it. The template labels, newest-first conversation and return-to-form action remain as described in [AI-DETAILS-ASSISTANT.md](AI-DETAILS-ASSISTANT.md).

## One creation and editing interface

Creation and saved preparation share the same `DetailsStep`, `ArrangementsStep` and `ReviewStep` components, including the Details AI/voice assistant and inline roster, programme and venue editors. The separate legacy edit form is removed. Existing Event edit routes redirect into Details (legacy RAM links open its tool). Once an Event exists, Template is unavailable; both recomposition and acceptance reject changing its saved template code/category. Existing template version activation rules remain in force. Draft values survive navigation between saved steps. Save/discard remains explicit, and stale Event/Plan/arrangement tokens require reload and review rather than overwriting newer data.

`GET /api/events/{eventId}/preparation/arrangements?occurrenceId=...` is manager-only and returns private saved creation-shaped rows, persisted row IDs, current venue name/address/capacity, aggregate ETag, occurrence dates and optional existing Series metadata/ETag. A recurring Event chooses the occurrence to edit. The optional `arrangements` field on `AcceptEventPlanRequest` carries `occurrenceId`, `eTag`, and optional `serviceSlots`, `sessions`, `venueBookings`; each row has nullable `id` plus creation `details`, and each session has ordered nullable `itemIds`. Null IDs add rows. Non-null IDs must be unique and belong to that occurrence/session. Plan acceptance and arrangement persistence share one serializable transaction and idempotency key.

Omitted arrays preserve saved data when a tool is off. Editing rows preserves their IDs, assignments, programme owners, content and other metadata. Deleting slots with member responses or sessions/items linked to retained slots conflicts. Removed sessions are cancelled and removed bookings released; venue validation excludes only the bookings being replaced and still checks other reservations, capacity and current venue ETags. Protected reads remain private/no-store; successful acceptance invalidates the server Event cache and the client Event/Church Life queries before reloading details and their update timestamp. If post-save reads fail, editing pauses until reload so new rows cannot be submitted twice. Nothing is copied into public Event JSON or AI prompts.

Saved Details retains unrelated Event JSON, contacts and poster association and supplies the existing optional Event update ETag. The additive `seriesUpdate: { eTag, details: UpdateEventSeriesRequest }` on Event PUT supports editing the existing single-Event recurring schedule in the same transaction. It preserves exception dates, rolling horizon and existing occurrences; the established materializer adds future occurrences without rewriting their history. The form explains this behavior. A Series shared by multiple Events continues to require series management. Both direct Series edits and saved Details reject changes affecting frozen preparation.

## Explain approval policy and expected reply time

Before formal submission, `GET /api/events/{eventId}/packages/assessment?scopeType=event|occurrence&scopeId=...` resolves the actual current published policy (effective group policy before global fallback), the accepted Plan and its authoritative sources. It has the same read authorization as Package views and private/no-store responses; it does not generate or persist a Package. Invalid/missing policy or out-of-range dates fail closed with an actionable error.

The assessment lists Enhanced, Standard and Light separately, explaining each matching confirmed-true fact, enabled module and activity-template condition in both languages. Candidate/unknown facts do not trigger a tier. Multiple matches use the strictest tier; Light is the baseline. The panel shows the policy version, matching reasons and the selected tier. Package manifests carry an optional `approvalAssessment` snapshot while retaining prior trigger reason codes for compatibility.

**Expected latest approval reply = the scoped Event/Occurrence start minus the effective policy's `preEventConfirmationWindowHours`.** This is the same instant at which final confirmation opens. The UI displays the exact date, time, time zone and policy hours; an overdue expectation prompts follow-up. `approvalValidityByTier` is a separate post-decision validity setting and is never used for this calculation. The expected reply date does not create an additional submission/approval rejection gate or promise that an approver has committed to that date. Publication continues to require actual valid formal approval.

## Approval freezes preparation

### Optional tools during saved preparation

Every tool row in **Arrangements** has Yes/No controls while the saved Event remains an unfrozen publication draft. This includes Team and tasks, Invitations and registration, Roles and shifts, RAM and safety, and Child safeguarding, even when its accepted decision was previously `required`. Existing enabled choices start at Yes. No is preserved through preview, explicit save, navigation and reload; enabling the tool again restores its saved arrangements. Turning off all tools has an explicit empty preview. Edits after return or an approved reopening use the same behavior.

The server derives this phase from the saved Event, recomputes the full selection with the current Plan ETag, and persists an immutable snapshot only on human acceptance. Draft deselection changes the enabled tools without deleting module records, roles, RAM, enrollment, confirmed facts or the accountable owner. It does not waive formal requirements: Package manifests explain missing required tools/dependencies in both languages, and submission/approval reject those blockers. Managers may enable them or correct the relevant facts before submitting. Approved preparation is still frozen; existing creation composition and non-draft retirement behavior are unchanged.

### Editable sources and frozen approval

Before approval, including while a Package is submitted or returned/rejected, managers may revisit steps 2–5: saved details, arrangements, saved-creation review, and team/tools. Step 4 never creates a second Event. Configuration saves remain explicit. Any detail save changes the Package source token, so a previously submitted snapshot cannot approve older copy. When saved visibility/registration differs from the confirmed facts in the accepted Plan, Package generation/decision requires plan review. Recomposition and acceptance derive those two facts from the saved human-reviewed brief; Arrangements exposes preview and explicit confirmation even without manual module toggles. Older plans without confirmed brief facts retain compatibility. Unsaved details and tool choices survive stage navigation and must be saved or discarded before opening approval. Submission makes the Package snapshot immutable; it does not freeze its source preparation. Source changes require a fresh Package submission. Only approval (including approval with conditions) freezes preparation.

Frozen Event-scope approvals block changes to Event details/RAM, accepted Plan/module choices, team invitations and role assignments, task configuration/dependencies, workflow initialization/assignment, sponsorship submission, programme, roster, venue reservations, travel configuration and safeguarding policy. The check and configuration save run inside a serializable transaction with formal approval. Operational progress, invitation/availability responses, consent and safety reporting keep their existing authorised commands. Expiry or invalidation blocks later eligibility without silently unlocking preparation.

Steps 7–8 are reachable only after active formal approval, including current decision quorum/expiry checks. Earlier preparation steps are then unavailable, including direct URLs. Step 6 remains reachable for decision history, conditions and reopening. Server mutation checks protect other editors as well.

### Request reopening

An Event manager submits a bilingual reason requesting revocation of the frozen Event approval. The pending request leaves preparation frozen. A reviewer eligible under the Package's existing governance tier accepts or rejects it with a bilingual reason; Standard/Enhanced requests also require separation from the requester. Rejection preserves approval and allows a new request. A request for an older approval cannot revoke a newer approval.

Approval of reopening appends revocation decisions to Event approvals, invalidates dependent occurrence approvals and execution confirmations, restores editing, sets publication to `draft`, and closes new registration. Existing enrollments, previous decisions and timestamps remain available. The group Event cache and client Event/Church Life queries are invalidated. Revised preparation requires a new Package and explicit publication again. Request/review actions are audited, idempotent and accompanied by the existing in-app notification records.

| Operation | Contract |
| --- | --- |
| `GET /api/events/{eventId}/preparation` | Event manager, authorised approver or accepted Event team/role access. Returns `isFrozen`, `isApproved`, `canManage`, `canEdit`, approved Package ID and latest reopening request with reviewer capability. |
| `POST /api/events/{eventId}/preparation/reopen-requests` | Manager; `{ reason: { en, zh } }`, each language 1–2,000 characters; `Idempotency-Key` required. At most one pending request per Event. |
| `POST /api/events/{eventId}/preparation/reopen-requests/{requestId}/review` | Eligible reviewer; `{ approve: boolean, reason: { en, zh } }`; request `If-Match` and `Idempotency-Key` required. Stale request returns 412, conflicting/reused payload returns 409. |

All preparation responses are `private, no-store` with `Vary: Cookie, Authorization`. The new `event_preparation_reopen_requests` table stores request/review actors, bilingual reasons, timestamps, status and a concurrency token; its filtered unique index permits one pending request. Migration `20260911023825_AddEventPreparationReopenRequests` must be applied before this flow is served. No historical Event lifecycle rows are rewritten by that migration.

## Poster after formal approval

The independent poster studio follows formal approval and reads the approved bilingual title, description, purpose, location and dates. A manager may select an existing poster or explicitly request a draft from the existing AI poster service using a base image and design guidance. Generation and file selection only produce a local preview. **Adopt and save** is the separate human action that uploads and associates the reviewed image with the Event. Skipping a poster remains possible. Unadopted drafts and guidance survive moving between preparation stages in the same mounted workspace; a full reload discards those local files.

Failed generation leaves saved data intact. A stale adoption returns 412 and preserves the candidate. Refresh reads the latest brief; changed brief fields require explicit re-review or regeneration before another adoption. Pending image requests disable stage navigation. A retry of an identical adoption reuses its uploaded URL and idempotency key.

Poster adoption changes only `EventDataJson.posterImageUrl`, update time and an idempotency record. It does not replace arrangements, RAM, contacts, visibility, Plan or Package decisions. The Plan concurrency token is part of Package source evidence and is preserved by cosmetic poster writes. Poster artwork is explicitly outside formal approval and is not bound into the Package. Adoption does not invalidate the approved preparation; human review and publication confirmation still apply. An adopted poster is not automatically published or sent.

## Protected poster API

| Operation | Access and result |
| --- | --- |
| `GET /api/events/{eventId}/poster` | Authenticated Event manager or accepted Event team/role member. Returns minimal bilingual brief, poster URL, visibility, registration mode, ETag and `canManage`. No contact profiles, member lists, RAM or task details. |
| `PUT /api/events/{eventId}/poster` | Event manager with active formal approval only; `{ posterImageUrl: string | null }`, current `If-Match` and `Idempotency-Key` required. Nonempty URLs must be absolute HTTPS, without user information, maximum 2,048 characters. Null removes the association. |

Both responses are protected `private, no-store` with Cookie/Authorization variation. Authorization is checked again on every read, write and retry. The ETag covers saved Event JSON, titles, dates and update time. Identical request/key returns the current projection; a different request using the key conflicts. Stale ETags return 412. Poster writes use a serializable transaction and their own ETag. The saved-details editor passes the optional `If-Match` update timestamp on whole-Event PUT; existing callers may omit it. The backend checks accountable-owner/group-leadership authority and frozen status regardless of that header. Successful mutation invalidates the group Event cache; the browser invalidates Event and Church Life queries. No AI provider or shared-cache policy is added; the reopening table requires the migration above.

## Approval and visibility

New creations carrying an accepted composition start at `publicationStatus = draft`, `registrationStatus = closed`. Old clients omitting composition retain `legacyImplicit`; existing records are not migrated. Create retries return the original Event identity with its current publication projection.

The formal approval stage reuses existing Package generation, review, submission, tier-aware decisions and condition controls. The separate Publish stage requires an active approved/conditionally approved current Package, server publication capability and satisfied publish requirements. The publication command remains server-authoritative, including RAM, sponsorship, scope, source freshness, conditions, ETags, authorization and configured enforcement mode. Explicit lifecycle Events require formal approval for publication even under `off` or `dryRun`; `legacyImplicit` compatibility retains existing rollout semantics. Approval itself never publishes, sends content or opens registration.

After an authorized person confirms publication, existing projections apply these visibility rules:

- `public`: public website and applicable Church Life/Group Life views.
- `churchVisible`: authorized church/owning-group members; no anonymous access.
- `groupVisible`: authorized members of the owning group.

Publication or approval does not widen the chosen audience. Expired/invalidated required evidence continues to suppress visibility through existing lifecycle checks. Opening registration remains an explicit governed action.

## Acceptance and verification

- Use the same form before/after creation, redirect legacy edit routes, lock template selection, preserve saved row identities and reject stale/foreign IDs. Match effective policy conditions and exact confirmation-window reply dates, including group overrides and occurrence scopes.
- Confirm creation once; revisit details/arrangements/setup, then proceed through approval, poster and publication on that same Event, including reload and backward navigation.
- Toggle all five formerly required tools off and on; save/reload choices, retain operational records and confirmed facts, and block formal submission with missing mandatory tools/dependencies.
- While submitted or returned, revise sources and submit a new approval version; freeze on approval. Request reopening, reject/approve it, preserve history, and require fresh approval/publication. Reject stale approval targets and unauthorised or non-independent reviews.
- Select/generate a poster after approval without saving; confirm adoption separately. Preserve unsaved candidate after failures and require review against changed details.
- Reject outsider reads and non-manager writes; preserve unrelated Event JSON and approval state, and invalidate caches on successful saves.
- Block publication without active approval or satisfied server checks; approval alone produces no publication request. Canceling publication makes no mutation.
- Exercise English/Chinese at 320, 768 and 1280 pixels without page overflow; language-only changes make no stage API calls.
- Fixture browser tests do not prove live AI/image service behavior, SQL concurrency or deployed public-site cache propagation.
