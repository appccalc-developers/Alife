# Page production and publication orientation

## Authority and task routing

Use repository [instructions](../../AGENTS.md), [system architecture](../architecture.md) and [common design](../design/README.md). [Page contract](PAGE-CONTRACT.md) owns the page lifecycle and acceptance requirements. Current DTOs/section serializers own exact wire shapes until a separate machine contract is explicitly maintained. Do not execute the historical [builder-v2 proposal](../codex/page-builder-v2.md) as an outstanding task list.

| Task | Read/inspect |
| --- | --- |
| Editor/schema | Page contract, `PageEditorView`, `components/page-editor`, section types, `pageService` write serialization and affected handlers/tests |
| Preview/public renderer | Page contract, `PageView`, section renderers, published snapshot parser and public queries |
| Submission/review | Page contract, `PageReviewView`, `AdminController`, publication handlers/state/snapshot services and review tests |
| Permissions/cache | Relevant rows in page contract, [cache matrix](../cache-coordination.md), actual group/reviewer checks and edge classifier/invalidation |
| Layout/interaction | [UI/UX](../design/UI-UX.md), Alife frontend-design skill and applicable source/rendered reference |

AI may assist drafting bilingual content and explaining layout choices. It must not invent church facts, identities, contacts or consent; assign permissions; approve its own output; or publish without the authorized human action. Preserve saved schema and separate editor, review and public rendering. Do not infer backend authority from visible frontend controls.

## Completion and evidence

Map the task to PAGE requirements, implement within the current architecture, verify relevant role negatives and lifecycle/preview/public paths, then update affected contract/status. Use [QA](../design/QA.md). Current documentation was checked against source on 2026-10-01; no new application or visual verification is implied.

Existing evidence sources include `backend/tests/Alife.Tests.Unit/Pages`, admin publication tests, frontend bilingual/page tests and relevant browser fixtures. Inspect their scenario coverage before choosing a run. The [generated explanation](../design/generated/pages.html), [bounded demonstration](../design/prototypes/review.html) and [coverage record](../design/COVERAGE.md) now exist. Their local verification does not replace current application acceptance against PAGE requirements.
