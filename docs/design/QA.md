# Design and delivery quality assurance

## Completion rules

A declared capability needs matching persistence where applicable, server-authorized API and a reachable usable flow. A catalogue, migration, placeholder or mock screen alone is insufficient. Track implementation (unimplemented/partial/implemented) separately from verification (unverified/partial/verified). Neither a passing build nor a written contract proves all requirements.

## Risk-based verification

| Change | Required evidence as applicable |
| --- | --- |
| Business behavior | Owning acceptance scenarios, positive/negative outcomes and persistent/reloaded state |
| Identity or permissions | Allowed/denied actor, current group/owner/platform scope, expired/revoked or changed authority |
| Cache | Viewer isolation, headers/validators, affected mutation freshness and scope of purge/fallback; use [cache matrix](../cache-coordination.md) |
| Saved schema/API | Existing payload compatibility, enum parsing, invalid inputs, concurrent/retried writes and domain versions |
| Bilingual UI | Both languages, missing-text fallback, long text, stable identity and language-only switching |
| Layout/interaction | Rendered mobile/desktop, applicable UX requirements, keyboard/focus, dialogs and error/recovery |
| Content builder | Editing, save/reload, preview, submission/review and approved public rendering separately |
| Database/deployment/provider | Exact environment and authorized target; fixtures never establish live integration |
| Documentation/projection | Valid local links, authority/scope consistency, current generated output and affected translations |

Select the narrowest meaningful existing unit/API/browser/build checks for the actual risk. Expand only for failures, new changes or unresolved concerns. Do not create tests that merely restate documentation or implementation. Repository tests and required domain checks remain applicable; no shared migration or deployment is implied.

## Evidence record

Record requirement IDs/sections; source commit or precisely described worktree; date; command/tool; artifact; actor/viewer and fixture scope; outcome; unverified environments; remaining gaps. Do not transfer old success counts to new source. API-intercepting browser fixtures prove supported simulated flows, not live accounts or database authorization.

For generated presentations run generation and freshness check when inputs change. For Event use `node docs/events/scripts/generate-event-docs.mjs --check` and its documented regeneration rules. Existing stale outputs must be investigated rather than bypassed. Application code is not changed merely to force a documentation check green.

## Review gates

Before implementation: identify owning design and acceptance, compatibility/privacy dimensions and prototype status. Before declaring completion: review diff against those requirements, exercise affected flows, update status and projections, and disclose missing evidence. Human review remains necessary for product/visual acceptance and governed publication; the agent can autonomously perform authorized local implementation and verification.

## Current documentation-work evidence

As of 2026-10-01, this programme changes documentation, generators and fictional prototypes only. The stale Event projection was regenerated and its check passed. Local Edge/Playwright checks and screenshot inspection cover the bounded demonstration and explanation presentation; see [coverage evidence](COVERAGE.md). No application runtime certification or user visual acceptance is implied. These standards are checking criteria, not retrospective certification of all ALIFE screens.
