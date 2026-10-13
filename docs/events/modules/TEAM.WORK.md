# TEAM.WORK

> Normative module contract. Owns module-specific behavior, authority and compatibility. [Current delivery and gaps](../IMPLEMENTATION-STATUS.md#team-work) are maintained centrally; [exact machine values](../event-contract.json) remain unchanged. Read only affected sections.

## Current Event 2.0 contract

The display name is **Tasks and handoffs / 任务与交接**, with the same module code. Overall ownership remains fixed on the Event. This workspace lists every enabled module and its personally accepted responsibilities; the same role records remain accessible from the owning modules. Optional onsite lead retains its Safety meaning. This module handles cross-module tasks, dependencies, blockers, executors, results and independent handoff review. Every task records a stage and optional occurrence. Only preparation tasks contribute preparation blockers. Specialist decisions cannot be completed by ordinary task checkboxes. Persistent entry and server authority follow [EVENT-WORKSPACES.md](../EVENT-WORKSPACES.md).

## Purpose

Coordinate cross-module tasks, executors, deadlines, dependencies, blockers, results and handoffs through preparation, delivery and follow-up. The accountable owner sees enabled-module responsibilities, invites collaborators and delegates custom tasks here; these actions reuse their existing authoritative services.

## Target contract

### Workspace placement

During preparation, Arrangements → Tasks and handoffs contains activity projects and conditions, enabled-module responsibilities, collaborators and custom tasks. Creation and the current `flow=setup&stage=arrangements&module=team.work` entry open that section; no separate Team and tools step remains. Invitations still require a saved Event and personal acceptance. Current direct operational routes remain available.

### Activation

Required whenever `event.exists == true` (`accountable-owner-required`).

Saved-draft choices, preservation and submission revalidation follow [optional preparation tools](../EVENT-SETUP-FLOW.md#optional-tools-during-saved-preparation).

### Dependencies

None. Other modules depend on this foundation.

### Domain responsibilities

Owning and contributing teams, accepted Event roles, task/dependency/blocker state, outputs, hand-offs, and closure evidence. Each Event retains one owning group and exactly one accountable owner.

### Roles and authority

`event.accountableOwner` is fixed to the authenticated creator for new Events. Existing stored owners remain; ownership cannot be transferred through role invitations. Optional `event.lead` is a personally accepted on-site duty and grants no plan-editing authority. Team membership alone does not grant module or approval authority. Managers assign roles and work on the server; invited members accept or decline their own assignment.

### Data classification

`eventTeam`. Protected responses are private/no-store.

### Workflow contribution

Preparation, delivery and closure are handled by existing domain services. The retired generic Workflow Run/Step/Artifact engine is not restored. Current responsibilities project into Personal Center; see [Event duties](../EVENT-DUTIES.md).

### Readiness

`accountable-owner-assigned` is always required. Operational task blockers may contribute additional readiness reasons.

### Event Package contribution

Contributes the accountable owner, accepted key-role coverage, required task/blocker summary, hand-off state, and immutable references to relevant artifacts. Package submission may create a linked approval task/artifact, but task completion never creates or changes the authoritative Event Package decision. Conditions reference the authoritative Event Package Condition and cannot be verified by ticking a normal task.

### User experience

The Event workspace exposes enabled modules and role acceptance, collaborators and personal invitations, custom tasks, dependencies, blockers, and role-aware actions with explicit loading, empty, conflict, and retry states. Organizers remain responsible throughout preparation; there is no organizer shift editor. The scoped [new-task form assistant](#ai-form-assistance) is the only AI form exception.

Enabled-module responsibilities use compact disclosure rows: collapsed rows show the module, assignees and response status; assignment controls appear only when expanded. The preparation section starts collapsed. Choosing No for a module immediately removes its responsibility row from the current draft view. Saved plan revisions refresh the authoritative enabled-module list. Hiding a row preserves its role assignments and history. Secondary invitation explanations are omitted while member selectors retain accessible labels in both languages.

The [continuous preparation flow](../EVENT-SETUP-FLOW.md) enters team/tool settings immediately after creation, reusing the saved Event and arrangements before formal approval, poster preparation and explicit publication. Details, arrangements and team configuration can be revised repeatedly before approval. Approved preparation is frozen; a reviewed reopening request restores editing and requires fresh approval. Operational progress and member responses retain their existing authority. Existing workspace editors remain the operational authority.

## AI form assistance

The new-task form uses the shared [AI form assistant](../AI-DETAILS-ASSISTANT.md#tasks-and-registration-form-assistants). It fills one bilingual title, due time, stage and review/restriction options in the local draft. People and occurrences remain manual; Add task is explicit. It cannot update existing task status, assign authority, submit handoffs or approve. Conversation/voice, pending-field focus and completion share the details template; permission, private cache and stale-response checks remain enforced.

## Operational behavior

Event team invitations, accepted roles, dependencies, blockers and deadlines retain their domain APIs. Ordinary tasks now have a named independent reviewer, approval status and immutable submission/action rounds; ETags, idempotency, current membership and specialist-source guards enforce handoff. Personal Center discovers live duties without notification records and opens restricted task details. Approved configuration remains frozen.





## Custom delegation and preparation — 2026-09-15

Custom tasks extend work beyond the twelve capability modules without creating arbitrary module codes. The owner sets bilingual title/description, assignee, deadline, stage and optional occurrence. Assignees are current approved owning-group members with accepted Event team/role participation, or the accountable owner. Invite and obtain collaboration acceptance before assigning a new collaborator a task.

The current creation UI requests personal task acceptance (`requireAcceptance=true`). Existing API clients that omit this additive option and migrated assignments retain accepted semantics. Reassignment always starts a fresh invitation and clears the former assignee's current preparation and publication-material selection. Required preparation tasks remain blockers until acceptance and a preparation update. Only the assigned member can accept/decline; current membership, exact task ETag and idempotency are checked on the server. A declined task returns to the owner's personal duties for reassignment.

Accepted assignees record bilingual preparation updates (up to 4,000 characters per language). A newly accepted delegation requires preparation before completion/submission. Pending completion review must be withdrawn before changing preparation. Completion snapshots include preparation, and existing independent-review and specialist-workflow boundaries remain intact.

For title, description and preparation, the selected UI language appears first and the other language is collapsed. Switching languages preserves both values without fetching task data again. Task lists include stage/status filters, deadline/title ordering and ten-item pages.

The owner can select unrestricted preparation with both languages as publication material. Selection is private and is cleared whenever preparation or task configuration changes. Its separate concurrency token does not change the Package preparation source vector. The publication step provides review and bilingual copy for manual use in audience-facing content; selection does not itself modify the public Event representation. Tasks, assignee identities and private notes never enter shared/public cache or AI prompts through this workflow.

Additive persistence: `EventTaskDelegationPreparation`. Existing task IDs, statuses, history, stage/occurrence and accepted assignments are preserved. Applying the migration is a separate approved-environment operation.

## Activities and conditions — 2026-09-15

This upstream plan defines actual event activities, separately from transport-booking, meal-booking and other preparation tasks. Each activity has a stable ID, bilingual name/conditions, required independent fixed attribute arrays and an optional saved Event occurrence. Shared conditions include participant estimate, outdoor/off-site, overnight, known high risk and weather review. Specialist travel/accommodation remain adopted MOVE.STAY reports. Custom tasks may optionally reference an activity; clearing uses an empty activityId, omitted/null updates preserve existing links. Removed sources retain task/risk references and require reassignment.

Versioned Event templates also define ordered bilingual preset projects with fixed-question default answers. Creation copies the selected template version into independent project IDs; every preset must receive explicit organiser confirmation before Event creation. Template edits create new versions and do not mutate accepted Event plans. In the current questionnaire, eight common arrangements appear as compact project switches: unchecked is explicit `no`, checked is `yes`, and template-selected switches still await organiser review. Eight specialist questions appear only for matching attributes, and removing an attribute excludes those answers from current composition without erasing audit history. Overall risk review, participant notices/follow-up and multi-zone coordination appear once in Event Details as tri-state Event facts. Applicable project `yes` answers and confirmed Event facts activate the union of corresponding modules; a project `no` cannot negate another project's `yes`, and an unknown Event or specialist answer is never treated as no. Module ownership, adopted reports and approval remain once per Event; each distinct project can have its own scoped configuration and occurrence offers. Any project with participation history remains in the Activity Plan, even after cancellation, so its bilingual identity still explains linked offers, fees and consents; changing its occurrence requires a new project.

`GET/PUT /api/events/{eventId}/activity-plan` is private/no-store. Readers need current plan access; writes require the current accountable owner and unfrozen preparation, exact ETag, valid unique IDs, fixed attribute arrays and bilingual shapes and same-Event occurrences. Saves serialize on the Event lock, invalidate Package/RAM and schedule analysis. Creation accepts the same activityPlan in arrangements, validates and saves it atomically with the Event; precreation occurrence references are not allowed. Draft recovery preserves bilingual source fields. RAM itself remains private and is not added to browser-persisted planning drafts.

Old RAM candidate/adoption controls are removed; the Activity Plan is the sole source and RAM reflects it through a read-only disclosure. Activity items use seven independent attribute checkboxes and collapsed applicable-check previews. Human-reviewed form assistance may propose names/conditions and fixed attributes while preserving actual activity IDs; organizer shifts remain outside this form. See the [attribute contract](SAFETY.RAM.md#church-policy-and-question-library).


## Creator and series ownership

New Events bind accountable ownership to the authenticated creator, and requests cannot nominate a different owner. Owner-transfer invitations are rejected. The stored Event 2.0 owner and immutable approval decisions remain auditable. Owning-group leadership does not grant editing of another owner's Event details, Plan, preparation configuration or poster.

`event.lead` is an optional, personally accepted on-site duty and may be held by the owner. It grants no Event-plan editing. RAM authors edit RAM, and independent RAM reviewers decide rather than alter the report; neither duty grants Event-plan editing. Specialist operations continue to use their own controlled permissions.

Series creation also requires ownership of its linked Event. Updating a series requires ownership of every affected Event; an empty series is editable only by its creator. Group leadership alone cannot use recurrence changes to bypass Event ownership.


## Activity authority across modules

TEAM.WORK owns event activity definitions and shared conditions in the additive activity-plan record/API. RAM mirrors that authority, combines adopted specialist reports, identifies risk and retains human scoring/confirmation/independent approval. Source ETags participate in RAM context and Package source versions. Runtime activities require fixed attribute arrays; normal source deletion retains orphaned risk evidence for reassignment. The [authorized pre-launch local cleanup](SAFETY.RAM.md#pre-launch-local-format-cleanup--2026-10-11) erases old RAM-only sources and their orphaned evidence instead of adopting them. Current question completeness is disabled while historical answers/policies/prints remain. Main SERVICE.ROSTER aggregates all module roles, including safety, under existing server permissions. See [TEAM.WORK](TEAM.WORK.md) and [SAFETY.RAM](SAFETY.RAM.md).
