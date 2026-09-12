# TEAM.WORK

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Provide the accountable team, roles, tasks, artifacts, blockers, deadlines, and hand-offs needed to prepare, deliver, and close every Event.

## Target contract

### Workspace placement

During preparation, team invitations, accepted roles and tasks render directly in Arrangements → People and volunteers → Team and tasks. Creation and the legacy `stage=setup&module=team.work` entry return to that section; no separate Team and tools step remains. Invitations still require a saved Event and personal acceptance. Existing direct operational routes remain available.

### Activation

Required whenever `event.exists == true` (`accountable-owner-required`).

During saved, unfrozen draft preparation this tool remains a Yes/No choice, including when the rule above applies. Disabling retains facts, ownership and saved records. Formal submission revalidates activation and dependencies and blocks missing required tools; see [optional preparation tools](../EVENT-SETUP-FLOW.md#optional-tools-during-saved-preparation).

### Dependencies

None. Other modules depend on this foundation.

### Domain responsibilities

Owning and contributing teams, accepted Event roles, task/dependency/blocker state, outputs, hand-offs, and closure evidence. Each Event retains one owning group and exactly one accountable owner.

### Roles and authority

`event.accountableOwner` is fixed to the authenticated creator for new Events. Existing stored owners remain; ownership cannot be transferred through role invitations. Optional `event.lead` is a personally accepted on-site duty and grants no plan-editing authority. Team membership alone does not grant module or approval authority. Managers assign roles and work on the server; invited members accept or decline their own assignment.

### Data classification

`eventTeam`. Protected responses are private/no-store.

### Workflow contribution

`event.prepare`, `event.deliver`, `event.close`, compiled into the existing Event workflow engine.

### Readiness

`accountable-owner-assigned` is always required. Operational task blockers may contribute additional readiness reasons.

### Event Package contribution

Contributes the accountable owner, accepted key-role coverage, required task/blocker summary, hand-off state, and immutable references to relevant artifacts. Package submission may create a linked approval task/artifact, but task completion never creates or changes the authoritative Event Package decision. Conditions reference the authoritative Event Package Condition and cannot be verified by ticking a normal task.

### User experience

The Event workspace exposes team membership, invitation state, tasks, dependencies, blockers, and role-aware actions with explicit loading, empty, conflict, and retry states.

The [continuous preparation flow](../EVENT-SETUP-FLOW.md) enters team/tool settings immediately after creation, reusing the saved Event and arrangements before formal approval, poster preparation and explicit publication. Details, arrangements and team configuration can be revised repeatedly before approval. Approved preparation is frozen; a reviewed reopening request restores editing and requires fresh approval. Operational progress and member responses retain their existing authority. Existing workspace editors remain the operational authority.

## Current implementation

Current. The worktree contains Event team members, accepted role assignments, tasks, dependencies, blockers, server authorisation, task ETags, operational readiness, `EventTeamPanel`, plus the existing Workflow Run/Step/Artifact flow.

## Open contract gaps

Handoff audit, reusable task templates, invitation notifications, and complete approval/artifact UX remain incomplete.

## Next useful vertical slice

`team-approval-handoff`: add workflow/task approval evidence, handoff history, invitation notification, and a non-destructive notification retry path.


In the integrated Arrangements flow, Team primarily shows cross-module tasks; collaboration membership and historical assignments are collapsed. Module role invitations appear in their owning modules; the global accountable owner remains outside optional tools, using its existing requirement key even if TEAM.WORK is disabled in preparation. Review summarizes responsible people and personal acceptance states. Section confirmation never accepts roles on someone’s behalf. See [section review](../CREATION-ARRANGEMENTS.md#section-confirmation-and-module-roles).
