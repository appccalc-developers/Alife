# TEAM.WORK

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Purpose

Provide the accountable team, roles, tasks, artifacts, blockers, deadlines, and hand-offs needed to prepare, deliver, and close every Event.

## Target contract

### Activation

Required whenever `event.exists == true` (`accountable-owner-required`).

### Dependencies

None. Other modules depend on this foundation.

### Domain responsibilities

Owning and contributing teams, accepted Event roles, task/dependency/blocker state, outputs, hand-offs, and closure evidence. Each Event retains one owning group and exactly one accountable owner.

### Roles and authority

`event.accountableOwner` requires exactly one owning-group leader or approved delegate. Team membership alone does not grant module or approval authority. Managers assign roles and work on the server; invited members accept or decline their own assignment.

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

## Current implementation

Current. The worktree contains Event team members, accepted role assignments, tasks, dependencies, blockers, server authorisation, task ETags, operational readiness, `EventTeamPanel`, plus the existing Workflow Run/Step/Artifact flow.

## Open contract gaps

Handoff audit, reusable task templates, invitation notifications, and complete approval/artifact UX remain incomplete.

## Next useful vertical slice

`team-approval-handoff`: add workflow/task approval evidence, handoff history, invitation notification, and a non-destructive notification retry path.
