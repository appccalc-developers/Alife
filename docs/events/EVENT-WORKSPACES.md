# Event collaboration workspaces, version 1

> Normative topic delegated by [the core contract](EVENT-CONTRACT.md). Read only relevant sections using [the task matrix](AGENTS.md#task-reading-matrix). Exact interfaces remain in [event-contract.json](event-contract.json); delivery evidence is maintained in [current status](IMPLEMENTATION-STATUS.md).

## Entry and authority

Personal Center links permanently to `/event-work`. The list and `/events/:eventId/work` derive current responsibilities from existing Event, role, team, participant, RAM-review and duty records. Completing a to-do does not remove an accepted responsibility. The four navigation stages are `preparation`, `registration`, `execution`, `followup`; they organize work and never grant authority. Recurring delivery and follow-up apply to an occurrence, without closing the series.

The accountable owner alone edits the overall plan, configures responsibilities, adopts reports, submits the formal Package and confirms publication. Accepted module leads read the complete plan and edit their own authorized records. Accepted team/read-only access grants no plan or specialist-data editing. Ordinary membership alone does not disclose unpublished plans. Church Life and Group Life keep the configured published audience. Invitation-only participants receive the information required to complete their procedures, not the private plan.

For collaboration version 1, the user, state and use case determine the entry surface:

| Viewer and current state | Entry and use case |
| --- | --- |
| Accountable owner during preparation | Preparation flow: Event facts, plan, module requirements, candidate groups, responsibilities, formal approval, poster and explicit publication. No four-date batch scheduler is mounted here. |
| Accepted `SERVICE.ROSTER:roster.coordinator` after publication | The Published (`registration`) and Delivery (`execution`) work stages link to the independent roster page and its **Schedule across dates / 多场次手工排班** tool. A live shortage duty links directly to the affected occurrence. The work page also links to the published Event detail. |
| Accountable owner after publication without that accepted role | Owns plan/governance and assigns a missing coordinator, requesting preparation reopening first when approval freezes role changes. Ownership alone does not confer four-date batch scheduling. An owner who also accepts the coordinator role uses the same coordinator page and duty. |
| Invited assignee for a current occurrence | Responds to their own invitation or availability; no coordinator batch or private candidate list is shown. |
| Delivery or follow-up viewer | Work stays occurrence-scoped. A finished date does not close a recurring Event or reveal another role's work. |

`registration` remains the compatible stage identifier for the published period. Publication and opening registration are separate gates; stage navigation performs neither action. Version-0 owner/coordinator batch authority remains available through its independent route for legacy compatibility.

`GET /api/events/work` and `GET /api/events/{eventId}/work` return filtered work links, actions, stages, occurrence pagination and duty summaries. The latter includes plan context only when authorized, and live preparation blockers for the owner. Registration and fee approval can be entered during preparation as well as their later stages; roster requirements and early arrangements remain in preparation, while version-1 four-date batch work appears after publication. Finance reconciliation remains reachable during follow-up. Clients must not fetch an unrestricted management workspace merely to discover permissions. Existing preparation cards and operational routes remain supported. The owner retains access to preparation areas and formal approval through the existing entry points; role-specific work pages and the stage overview use separate pages rather than nested tabs.

All permissions are rechecked on the server using current membership, role acceptance, ownership, record scope, stage and approval freeze. Complete plan access excludes participant materials, child identities and finance transactions. Sensitive responses use `private, no-store`, varying by Cookie and Authorization. Client queries include account and Event identity, refresh after actions and preserve drafts on language switches. Old links confer no continuing access after revocation.

## Tasks and reports

`TEAM.WORK` is displayed as **Tasks and handoffs / 任务与交接**. Its identifier, historical team memberships and task IDs remain. Owner identity remains fixed on the Event; this workspace lists enabled modules and reuses their role invitations alongside collaborator invitations and custom task delegation. Organizers have continuing responsibility, with no organizer shift editor. The only AI form exception is the [new-task draft assistant](AI-DETAILS-ASSISTANT.md#tasks-and-registration-form-assistants). Optional `event.lead` remains an onsite responsibility in Safety. Cross-module tasks keep executor, deadline, dependency, blocker, result and independent review. New tasks specify a stage and optionally an occurrence; old task writes preserve those new fields. Only preparation tasks affect preparation readiness. An ordinary task never approves RAM, a Package or a specialist condition.

`SAFEGUARDING.CHILD`, `PROGRAM.PRODUCTION`, `MOVE.STAY`, `FOOD.HOSPITALITY` and `COMMS.FOLLOWUP` share a bilingual report workspace at `/events/:eventId/reports/:moduleCode`. The accepted module lead authors, saves and submits; the owner returns with reasons or adopts a submitted revision. States are `draft`, `submitted`, `returned`, `adopted`. Each submission has immutable text, author, version and plan-version reference. Adoption references the exact revision. Editing a later draft does not change previously adopted text. Submitted revisions must be withdrawn or returned before further authoring. ETags, idempotency keys and history protect handoffs. Report adoption into a frozen formal plan requires the existing reopening/approval process.

Preparation cards show responsibility and acceptance, report, and submission/adoption state. Specialist child consent, collection, worker eligibility, transport manifests and programme tools retain their own execution pages and checks. Food supports reports only; menus, allergies and kitchen operations remain deferred. Communication report adoption never sends or publishes content.

## RAM context and handoff

See [ram context and handoff](modules/SAFETY.RAM.md#ram-context-and-handoff) for the authoritative operational rules.

## Registration rules and actual participants

See [registration rules and actual participants](modules/PEOPLE.REGISTRATION.md#registration-rules-and-actual-participants) for the authoritative operational rules.

## Manual registration fees

See [manual registration fees](modules/MONEY.FINANCE.md#manual-registration-fees) for the authoritative operational rules.

## Private registration materials

See [private registration materials](modules/PEOPLE.REGISTRATION.md#private-registration-materials) for the authoritative operational rules.

## Independent venues and rooms

See [independent venues and rooms](modules/PLACE.RESOURCE.md#independent-venues-and-rooms) for the authoritative operational rules.

## Compatibility and verification boundary

`GroupEvent.CollaborationVersion=0` preserves legacy interpretation. New Events use version 1; adopting new reports or registration rules upgrades an existing Event explicitly. `20260914133318_EventCollaborationWorkspaces` is additive: report revisions/actions, registration policies/applications/participants/materials/audit, weekly venue rules/exceptions, task phase references and nullable RAM context. Old module codes, routes, enrollment IDs, child links and historical approvals are retained. Festival remains visible as unavailable and cannot be enabled by either UI or API.

Focused service/API tests cover positive/negative authority, immutable adoption/review, proxy consent/revocation, fee separation, FIFO capacity and calendar conflicts. SQL tests opt in with `ALIFE_TEST_PREPARATION_SQL=1`, use randomized local disposable databases, exercise the actual migration and competing transactions, then delete only those test databases. Browser fixtures exercise bilingual/mobile role paths with isolated data. These checks do not authorize shared-database migration, deployment or sending real invitations.

## Activity definitions and downstream RAM (2026-09-15)

Tasks and handoffs contains an independent, owner-editable Activities and conditions section and optional activity links on custom tasks. RAM shows sources read-only and groups compact risk disclosures by the same stable IDs. Source changes invalidate analysis and signatures. Top-level scoring and manual AI recalculation are visible. Current Required Questions and RAM’s safety-role shift editor are removed. The main Roles and shifts module displays all Event roles, including safety; assignments and server-enforced module authority remain intact. Version history uses a latest-first table without list controls.


## Capability availability and version boundaries

a current capability catalogue and Workspace projection show `coreAvailable`, `partial` or `unavailable` with bilingual descriptions, separately from module selection, details confirmation and readiness. Before collaboration version 1, finance, food/hospitality and festival operations were unavailable and communications/follow-up was partial (existing content/posters/publication only). Version 1 finance fees and food reports follow their module contracts; festival remains unavailable. All entry points use the same status; confirmations cannot bypass required unavailable-module submission blockers. Historical Plan snapshots and proposal hashes remain unchanged.

The 2026-09-13 authoring/capacity/roster extension kept all RAM, enrollment and roster responses private/no-store, with current server authorization and account-aware client refresh. Its additive migration is `20260913135531_EventPreparationAuthoringCapacityRoster`. Its exclusions (automatic rotation/recommendations, family/guest/occurrence enrollment, email/device push and catering delivery) describe that round; later explicit version-1 registration rules supersede the family/guest limitation only in their scope. Shared migrations, deployment and Git publication remain separately authorized actions.
