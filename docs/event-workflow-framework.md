# Event Workflow Framework

## Scope

The first implementation adds a lightweight, versioned workflow framework for group-owned events. Event creation, workflow state, enrollment management and authorization remain anchored to the owning group. It intentionally supports ordered stages, approval gates, dedicated integrations and output packages without introducing a general BPMN engine.

The first built-in templates are:

- `camp` / 营会: proposal and budget, RAM, registration and payments, people and programme, delivery, finance and follow-up.
- `outreach` / 外展: purpose and team, training, RAM, engagement preparation, delivery and privacy-aware new-contact follow-up.

## Model

- `EventWorkflowTemplate` stores a bilingual, versioned JSON definition. Templates are seeded by `SeedData` after migrations.
- `EventWorkflowRun` belongs to one `GroupEvent` and stores the selected template version plus an immutable JSON snapshot.
- `EventWorkflowStep` stores operational status, assignment, due date and completion audit fields.
- `EventArtifact` represents a required or optional output. It may contain structured JSON, reference a `FileAsset`, or act as a checklist placeholder until content is attached.
- Dedicated event modules remain authoritative when a step has an `IntegrationKey`. Version 1 uses `ram`; RAM save, submit and approval actions synchronize the generic step and artifact.

## Authorization and privacy

- Active templates require authentication.
- Every workflow run is resolved through its `GroupEvent`; there is no separate event ownership model.
- Workflow initialization, step changes and artifact changes require group leader/co-leader access.
- Approved group members can read workflow progress and group-visible outputs.
- `MemberPrivate` artifacts are omitted from regular member responses and are visible only to group leaders/co-leaders and admins.
- Workflow GET responses use private/no-cache headers. Private file bytes continue to use the existing authorized `FileAsset` open flow and must not enter a shared cache.

## API

```text
GET  /api/event-workflow-templates
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

## Deliberate first-phase limits

- Templates are seeded in code; there is no template editor yet.
- There are no branches, parallel gateways or arbitrary workflow scripts.
- Event output file selection/upload is not embedded in the workflow panel yet. The API already supports linking a compatible `FileAsset`.
- Generic approval is currently performed by group leaders/co-leaders. RAM retains the stronger `admin.events.audit` permission and cannot be completed through the generic step endpoint.
