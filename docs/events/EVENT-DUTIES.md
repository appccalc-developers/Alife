# Event duties and personal handoffs

This is the authoritative contract for saved Event responsibilities in Personal Center. It complements [TEAM.WORK](modules/TEAM.WORK.md), [SAFETY.RAM](modules/SAFETY.RAM.md) and existing Package governance. It does not introduce a generic workflow engine, document repository or external delivery channel.

## Discovery and handling

`GET /api/notifications/current` keeps its existing response array. Current business records project duties even when no notification has ever existed. Every Event duty has `completionMode=workflow`, a stable actor-bound `taskKey`, `sourceType`, `sourceId`, `sourceVersion`, Event/group identifiers, optional occurrence/deadline, and bilingual `actionLabel`. Opening or marking a notification read never changes a business responsibility.

The read-only Event application projection batches relevant invitations, roles, tasks, RAM revisions, occurrences, Packages and conditions. It uses existing Package authority, delegation, quorum, source freshness and lifecycle policy checks without invoking expiry-persisting GET paths or full workspaces. No separate persisted to-do completion state exists. Event queries apply normal soft-delete/group filters. Projection responses and the restricted handler are `private, no-store` and vary by Cookie and Authorization; clients use account-specific memory query keys, focus refresh and 60-second polling. Successful Event mutations invalidate the current account immediately. Changing language does not request data again.

`/events/:eventId/duties/:sourceType/:sourceId?taskKey=...` resolves through the matching protected API. The source must belong to that Event, still be current, and still be actionable by that viewer. It reuses the relevant task, RAM, Package or reopening component without requiring general workspace access. Old versions, completed responsibilities and revoked access produce an explicit stale/unavailable state and refresh current tasks. Domain writes still enforce their own permissions and concurrency checks.

Summaries contain action and Event identity, occurrence, date and deadline only, plus the ordinary task title. They never include RAM hazards, child data, contact information or condition evidence. Restricted task details expose immutable submission history to the current owner, executor and reviewer only. The owner receives a server-filtered list of eligible participants for responsibility configuration.

## Handoff rules

| Source | Current actor | Exit or next actor |
| --- | --- | --- |
| Team / role invitation | Current approved invited member | Response or ending removes it; missing required responsibilities are owner coordination work |
| Roster assignment | Current approved invited assignee for a non-cancelled live slot | Response removes it; replacement ends old assignment; an uncovered required position goes to the coordinator/owner |
| Ordinary task | Current eligible executor | Completion removes a task without approval; submission hands approval tasks to the named reviewer |
| Task review | Current eligible named independent reviewer | Approve completes; return with a reason hands work back; withdrawal or responsibility changes invalidate that submission |
| RAM preparation | Current eligible author; owner coordinates when no other qualified author exists | Draft, returned and re-review work persists; request for confirmation hands the immutable revision to its onsite signer; confirmation hands submission back to the author |
| RAM review | Current same-church reviewer qualified under existing RAM policy | Excludes author, submitter and onsite signer; approval, return or revision invalidation ends the old duty |
| Package approval | Existing policy-resolved authority | A person's active decision removes their duty; reaching quorum removes remaining review duties; returned/stale preparation goes to the owner |
| Package condition | Accepted owner role, then policy-resolved verifier | Evidence is not verification; rejection returns work; verification or waiver resolves it; expired conditions require owner recovery |
| Church sponsorship | Existing root-church leadership or platform sponsorship permission | The current decision ends the request |
| Reopening | Existing current approval authority and separation rules | Approval restores owner preparation work; rejection ends the request and preserves a result notification |
| Material change | Owner, scoped to the affected Event/occurrence | Repair, resubmit or recover preparation; linked technical tasks do not duplicate the primary responsibility |

The owner gets at most one primary progression duty per Event: fix invalid/returned approval, complete preparation/responsibilities, generate and submit, publish, open configured registration, confirm execution. Waiting for another actor is not an owner duty. Registration requires enabled capacity and a valid deadline. Execution uses the existing policy window and appropriate non-cancelled occurrence. Explicit unpublication and registration closure do not trigger a reopening reminder. After all applicable occurrences end, publication, registration opening and onsite/execution confirmation reminders stop; actionable tasks and follow-up approvals remain.

## Ordinary task approval

Existing progress values remain `todo`, `inProgress`, `blocked`, `done`, `cancelled`. Add independent approval values `notRequired`, `notSubmitted`, `pendingReview`, `approved`, `returned`, a reviewer and submission round.

The Event owner configures executor and reviewer. Candidates are the owner or approved owning-group members with accepted active Event team/role participation. Reviewer and executor must differ. A new task defaults to the owner as reviewer when independent. Saving without a reviewer is allowed; submission requires a currently eligible independent reviewer. `clearReviewer=true` explicitly removes the reviewer while omitted new fields preserve older PUT clients.

`GET /api/events/{id}/tasks/{taskId}` returns restricted details, history and server capabilities. POST actions `submit-completion`, `withdraw-completion`, `approve`, `return` require task `If-Match`, `Idempotency-Key` and the current responsible actor. They run in a serializable transaction with optimistic concurrency. Each submission appends an immutable bilingual definition/people/deadline/prerequisite snapshot and round; subsequent actions append evidence, never overwrite history. Return requires a reason. Only approval sets an approval task to Done. Generic PUT cannot bypass approval. Definition, responsibility or dependency changes invalidate a pending round; restarting approved work starts another round without erasing prior evidence. Configuration remains subject to preparation freezing.

Specialist-linked tasks cannot be completed through ordinary task APIs. `sourceType/sourceId/sourceVersion` records traceable provenance. RAM author work closes or changes assignee through RAM actions; condition status controls its readiness task; scoped/whole Package approval closes linked change-review tasks. Such projections do not enter their own Package source vector or generic readiness blockers. The migration backfills only existing condition FKs and explicit occurrence exception `reviewTaskId` references. Unprovable historical tasks remain ordinary tasks: no title matching, fabricated approval, or automatic historical completion. Old Done tasks retain their state.

## User interface and verification

Personal Center keeps three cards maximum. Current tasks support Event/type filtering, deadline/newest/oldest ordering and 20-item pages. Direct handling preserves the original filter/page on return. Chinese and English actions, deadlines, overdue, loading, empty, error and stale states remain available at 320px and desktop widths.

Review screenshots from isolated fixture data: [Chinese at 320px](../assets/event-duties/zh-320.png) and [English at 1280px](../assets/event-duties/en-1280.png). They show the filtered second page after a submitted task has handed off; no real member data is included.

Formal coverage lives in `EventDutyProjectionTests`, `EventOperationsCoreTests.TaskApproval`, `EventPackageFoundationTests.Duties`, existing RAM/Package suites, and frontend `eventDuties.test.ts` / `eventDuties.browser.cjs`. Browser fixtures isolate all requests from real identities, providers and database writes. Migration generation and SQL script review are separate from applying a migration; shared/production application and deployment need separate authorization.

Run `npm run test:event-duties` and `npm run test:event-composition` in `cloudflare/alife-app`, then `npm run build`. The browser fixture accepts `ALIFE_BROWSER_BASE_URL`, `ALIFE_PLAYWRIGHT_MODULE` and optional `ALIFE_BROWSER_OUTPUT`; run `node tests/eventDuties.browser.cjs` against the local app. Backend regression uses `dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj`. See [implementation status](IMPLEMENTATION-STATUS.md) for actual results and the separately recorded fixed-date failure.
