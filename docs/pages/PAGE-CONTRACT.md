# Page production and publication contract

## Scope and data model

Pages are group-owned structured bilingual content. A page contains title/description maps, display metadata and ordered typed sections with content/style JSON and section links. Preserve existing serializers, legacy discriminators and saved payloads; do not replace sections with whole-page HTML or introduce arbitrary executable component definitions.

The product has three separate content copies: mutable group working page, submitted publication-review snapshot and last approved published snapshot. `PageVisibility` alone does not prove an approved public snapshot exists. Current lifecycle uses draft/group/public visibility and a separate review status. The historical API route named `publish` can submit public review; it is not permission to bypass review.

## Roles and authority

| Operation | Current authority/boundary |
| --- | --- |
| Edit working page | Draft creator or owning-group leader/co-leader as checked by UpdatePage handler |
| Change visibility/submit via publish route | Owning-group leader/co-leader; reviewer title alone is insufficient |
| Read review copy/approve/return | Page-review authorization checked server-side; see `AdminPlatformRoleHelpers.CanReviewPagesAsync` and specific admin handlers |
| Edit publication copy | Both page-review authorization and owning-group leader/co-leader access; reviewer-only access is insufficient |
| Read public content | Valid approved published projection only; malformed/unsupported snapshot fails closed |
| Read working/group content | Server checks applicable creator, membership, visibility and management access; no public-snapshot fallback on working-copy route |

Platform, group and reviewer powers are separate. Do not give all administrators or reviewers implicit group editing permission. Inspect the actual authorization service for exceptions before changing behavior.

## Stable requirements and acceptance

| ID | Requirement | Acceptance scenario |
| --- | --- | --- |
| PAGE-01 | Preserve bilingual maps and section/link compatibility | Existing saved page loads, edits and renders in both languages without losing data |
| PAGE-02 | Working editor changes remain distinct from public rendering | Editing a public working page leaves the previous approved snapshot readable until replacement or explicit withdrawal |
| PAGE-03 | Public submission captures an isolated review copy | Later working changes cannot silently mutate an earlier captured snapshot; updated submission follows current review-state rules |
| PAGE-04 | Reviewer changes/return do not modify the group working page | Compare working, submitted and published copies before/after return and copy edit |
| PAGE-05 | Return of a newer submission preserves an earlier publication | Public readers retain the last approved snapshot despite a returned replacement |
| PAGE-06 | Explicit withdrawal/deletion removes eligible public visibility | A withdrawn page cannot leak through detail/list/KV/client stale reads; resubmission needs the current approval flow |
| PAGE-07 | Review and group permissions remain separate | Reviewer-only working update/submission denied; authorized group editor and reviewer actions allowed |
| PAGE-08 | Review concurrency conflicts rather than losing copies | Competing submit/approve/return/copy writes exercise review `UpdatedUtc` concurrency; do not claim generic If-Match on every endpoint |
| PAGE-09 | Public snapshot parsing fails closed | Invalid or unsupported stored publication does not fall back to mutable working content |
| PAGE-10 | Editor, preview and approved rendering are each usable | Save/reload, unsaved-change guard, state/error feedback, English/Chinese and phone/desktop inspection |
| PAGE-11 | Publication freshness follows all relevant layers | Working updates invalidate private/detail/group state; approved-copy/visibility/publication changes cover public projections and client state |

## Current implementation map

- HTTP: `backend/src/Alife.Api/Controllers/PagesController.cs` for public/detail/working/list/create/update/publish/delete; `AdminController.cs` for review candidates, review copy, approve/return, public-cache refresh and menus.
- Business: `backend/src/Alife.Application/Pages/Commands` and `Pages/Services/PagePublicationReviewState.cs`; admin publication command handlers and snapshot services.
- App: `PageEditorView.tsx`, `PageReviewView.tsx`, `PageView.tsx`, `components/page-editor`, section renderers and `services/pageService.ts`.
- Cache: page invalidation service; edge public/working classifiers; App query keys, collections and conditional HTTP cache. `pageService` explicitly removes IndexedDB records as well as invalidating matching Query state.

Existing update handling can resubmit a public working page. Its `preservePublicationReviewStatus` exception is checked server-side; it is not a general editor bypass. Existing migrations backfill older public pages without review rows as pending submissions, not invented approval. Do not apply a migration without the approved target.

## Cache and privacy

Public snapshot routes are eligible for public-page edge caching. Working copies are excluded from shared cache. The current origin working-copy controller applies private/no-cache headers while the edge architecture documents private/no-store for working copies. Treat these as different hop policies; verify origin/edge/client behavior together when changing this path rather than asserting identical headers everywhere.

Follow [cross-layer cache coordination](../cache-coordination.md). A content change and a publication change affect different copies; invalidation must preserve that distinction. Public menu/card metadata comes from controlled publication data, not unreviewed working edits.

## Delivery and limitations

This contract describes source-backed current behavior and acceptance requirements, not a newly verified runtime. Relevant existing tests cover reviewer denial, retained publication, withdrawal, review-status preservation and resubmission. Full current browser/database/multi-account/cache verification remains task-dependent. Exact section schema and valid enum values must be read from current code rather than inferred from the old builder proposal.
