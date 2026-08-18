# Event Workflow Framework

## Scope

The first implementation adds a lightweight, versioned workflow framework for group-owned events. Event creation, workflow state, enrollment management and authorization remain anchored to the owning group. It intentionally supports ordered stages, approval gates, dedicated integrations and output packages without introducing a general BPMN engine.

The first built-in templates are:

- `camp` / 营会: proposal and budget, RAM, registration and payments, people and programme, delivery, finance and follow-up.
- `outreach` / 外展: purpose and team, training, RAM, engagement preparation, delivery and privacy-aware new-contact follow-up.

The event creator presents workflow templates as an optional preparation approach rather than as event types. Leaders can select a template, inspect its ordered stages and approval gates, or keep the backward-compatible quick-create path without a managed workflow. Audience scope (owning group, selected groups, whole church, or public) remains a separate responsibility and visibility concern; selecting a workflow never widens access.

## Model

- `EventWorkflowTemplate` stores a bilingual, versioned JSON definition. Built-in templates are seeded by `SeedData`; leader-created templates carry an `OwnerGroupId` and `CreatedByMemberId` and are reusable only inside that group.
- `EventWorkflowRun` belongs to one `GroupEvent` and stores the selected template version plus an immutable JSON snapshot.
- `EventWorkflowStep` stores operational status, assignment, due date and completion audit fields.
- `EventArtifact` represents a required or optional output. It may contain structured JSON, reference a `FileAsset`, or act as a checklist placeholder until content is attached.
- Dedicated event modules remain authoritative when a step has an `IntegrationKey`. Version 1 uses `ram`; RAM save, submit and approval actions synchronize the generic step and artifact.

## Authorization and privacy

- Active templates require authentication. Listing with a group scope requires approved membership; creating a custom template requires leader/co-leader access.
- Group-owned templates are filtered by `OwnerGroupId` both when listed and when selected for event creation or workflow initialization, preventing cross-group reuse.
- Every workflow run is resolved through its `GroupEvent`; there is no separate event ownership model.
- Workflow initialization, step changes and artifact changes require group leader/co-leader access.
- Approved group members can read workflow progress and group-visible outputs.
- `MemberPrivate` artifacts are omitted from regular member responses and are visible only to group leaders/co-leaders and admins.
- Workflow GET responses use private/no-cache headers. Private file bytes continue to use the existing authorized `FileAsset` open flow and must not enter a shared cache.

## API

```text
GET  /api/event-workflow-templates?groupId={groupId}
POST /api/groups/{groupId}/event-workflow-templates
GET  /api/events/{eventId}/workflow
POST /api/events/{eventId}/workflow
PUT  /api/events/{eventId}/workflow/steps/{stepId}
POST /api/events/{eventId}/workflow/artifacts
PUT  /api/events/{eventId}/workflow/artifacts/{artifactId}
```

Initialization request:

```json
{ "templateCode": "camp" }
```

Event creation also accepts an optional template code:

```json
{ "workflowTemplateCode": "camp" }
```

When supplied, the create handler validates the latest active template version before adding any event data, then creates the event, RAM record, workflow version snapshot, operational steps and output placeholders in one database save. Existing clients may omit this property and retain the previous behavior.

## Visual creation and execution

- The create view separates quick creation from named, managed templates and presents a horizontally scrollable stage preview only for the selected template.
- Leaders can create a named bilingual group template in the same picker, add and reorder up to 12 stages, and mark approval gates. Saving selects the new template immediately and makes it available for later events in the same group.
- Template selection appears before the four editor steps. The previous fixed five-card creation overview was removed because it duplicated both the editor navigation and template preview.
- The chosen template is not persisted until the leader explicitly saves the event notice.
- The event detail workflow view presents a compact visual stage navigator above the operational step cards.
- Desktop and mobile use the same ordered workflow semantics; narrow screens scroll the stage track rather than hiding stages.

## Deliberate limits

- Custom templates can be created but are not yet editable, duplicated, archived or versioned through the UI.
- The custom editor creates ordered required stages and approval gates. Artifact requirements and dedicated integration keys remain available only to built-in/code-managed templates.
- There are no branches, parallel gateways or arbitrary workflow scripts.
- Event output file selection/upload is not embedded in the workflow panel yet. The API already supports linking a compatible `FileAsset`.
- Generic approval is currently performed by group leaders/co-leaders. RAM retains the stronger `admin.events.audit` permission and cannot be completed through the generic step endpoint.
