# AGENTS.md — Alife Repository Instructions

## Authority and scope

This tracked file is the canonical repository-wide instruction source for coding agents working in Alife. Apply it to every task in this repository.

- Keep repository-specific behavior in tracked instructions rather than a contributor's global configuration.
- A nested `AGENTS.md` may add subtree-specific requirements but must not weaken repository-wide security, privacy, compatibility, or traceability rules.
- Keep `.github/copilot-instructions.md` as a thin compatibility pointer to this file.
- Higher-priority user or system instructions win; report conflicts that affect the requested outcome.

## Product and priorities

Alife is an alpha-stage community/church group platform for overseas Chinese Christian communities. It manages groups, members, pages, sermons, events, bilingual content, and AI-assisted event workflows.

Prioritize, in order:

1. Alpha stability and real user value for group leaders and members.
2. Authentication, authorization, privacy, and cache correctness.
3. Existing architecture and public-contract compatibility.
4. Small, reviewable changes with clear tests and documentation.
5. Consistent English/Chinese behavior and maintainable handover.

Do not introduce a framework, library, paid service, or architectural pattern without explicit approval. Do not rewrite working modules solely for style.

## Context and token discipline

- Read the affected implementation and nearby tests before editing, but avoid broad repository scans when a focused search answers the question.
- Load only the instructions and references relevant to the files in scope. Do not read generated handbooks or whole directories when an authoritative module source is available.
- Keep shell and tool output focused with path filters and sensible limits. Do not print whole large files when a matching section or line range is enough.
- Do not rerun successful builds, tests, searches, or reads unless a later change or unresolved failure justifies it.
- For routine work, use the lowest reasoning effort that provides credible results when the setting is under your control; reserve high effort for genuinely complex or high-risk work.
- Keep one task to one coherent scope. Recommend a new task when the user changes to unrelated work after a long session.

## Working safely

Before changing files:

- Inspect the current branch and working tree. Existing changes belong to the user unless proven otherwise.
- Resolve discoverable facts from the repository instead of asking the user.
- Identify the smallest safe change and preserve unrelated behavior.
- For complex work, briefly state the intended change before editing.

While implementing:

- Preserve layer boundaries, public contracts, existing state/routing conventions, and unrelated user work.
- Use focused patches. Never delete, overwrite, stage, or publish unrelated changes.
- Treat tests, documentation, migrations, configuration, and cache behavior as part of a feature when applicable.

After implementing:

- Review the final diff against the request and any linked Issue acceptance criteria.
- Review documentation impact and update only affected authoritative sources.
- Run the narrowest checks that credibly cover the risk, expanding only when needed.
- Report changes, verification, unverified behavior, risks, and the next useful step.

## Architecture and API contracts

Preserve separation between the frontend/PWA, backend application logic, Cloudflare speed/cache layer, authentication and authorization, persistent storage, and AI workflows. Do not move responsibility across layers without a documented reason and explicit approval.

For API changes, explicitly consider authentication, role/group visibility, backend and client caching, backward compatibility, and bilingual data shapes.

- Prefer readable enum names in API/frontend payloads; storage may remain integer-based.
- Keep DTO parsing robust and do not expose persistence details to clients.
- Make schema changes backward-compatible and migration-friendly.
- Review migrations and generated snapshots. Apply migrations only to an approved disposable/local database, never a shared or production database without explicit approval.

## Authentication, privacy, and caching

- Enforce authentication and authorization on the server; frontend checks are never sufficient.
- Validate group membership, role, ownership, visibility, and platform permissions explicitly.
- Classify responses as public, group-visible, member-visible, or user-specific.
- Use shared caching only when every authorized viewer receives the same representation.
- Never place private or user-specific data in a shared cache, logs, AI prompts, or public endpoints.
- Check `Cache-Control`, `ETag`, `Vary`, cache keys, TTLs, authorization behavior, and invalidation paths.
- Include every visibility dimension in a shared key or use private/no-store behavior. Prefer short member-data TTLs when stale authorization has privacy impact.
- Preserve safe cache behavior; do not bypass caching casually.

## Bilingual behavior

Preserve established bilingual shapes such as:

```json
{ "en": "English text", "zh": "中文内容" }
```

- Do not replace bilingual fields with plain strings unless explicitly requested.
- Support bilingual forms and clear fallbacks.
- Keep translation helpers stable.
- Avoid refetching or remounting for a language-only UI switch unless underlying data changes.

## Frontend and content builders

Changes under `cloudflare/alife-app/` must also follow `cloudflare/alife-app/AGENTS.md`.

At repository level: preserve the current UI framework, state patterns, routing, accessibility, responsive PWA behavior, saved JSON compatibility, and the separation between editor preview and published rendering.

## AI-assisted features

AI is an assistant, not an authority.

- Keep human review, correction, and explicit commit/publication in the workflow.
- Never auto-publish AI-generated content.
- Do not invent safety facts, permissions, identities, contact details, or authoritative church claims.
- Minimize personal information in prompts and preserve consent/privacy boundaries.
- Keep outputs and edits auditable where practical and provide non-destructive failure paths.
- Consider provider cost; adding a paid service requires explicit approval.

## Event documentation

Every Event module task, including Event code outside `docs/events/`, must follow `docs/events/AGENTS.md`. Read that file before changing Event contracts, module specifications, implementation status, or generated documentation. Never edit generated Event HTML directly.

For non-Event work, update authoritative documentation only when behavior, architecture, contracts, APIs/DTOs, authorization/privacy/cache behavior, migrations, user-visible acceptance scenarios, or language parity changes.

## Testing and verification

Choose checks proportional to risk: focused unit/API tests, affected project builds, TypeScript/lint checks, cache and role matrices, bilingual switching, UI rendering, or approved local migration tests.

- Verify protected behavior with positive and negative roles.
- Verify cross-viewer isolation and invalidation for cache changes.
- Verify saved payload compatibility for schemas and builders.
- Render/exercise UI changes when layout or interaction matters.
- State explicitly when browser, provider, database, or deployment verification was unavailable.
- Never claim a check, generation, migration, or deployment that was not actually run against the current source or rebuilt artifact.

## Git and GitHub mutations

Local implementation and verification are the default. Do not create/update Issues, switch/create branches, stage, commit, push, open/ready/merge PRs, or close Issues unless the user explicitly requests that specific action, invokes `/shipit`, or requests the complete publish flow.

Before any Issue, PR, commit, push, or `/shipit` work, read `docs/agent-guides/GITHUB-WORKFLOW.md` and follow it. Keep single-action authorization scoped to that action. Never stage the whole worktree, force-push, rewrite published history, or perform destructive Git recovery without explicit approval.

## Review invariants

Report consequential defects rather than style preferences. In particular, flag:

- frontend-only authorization or missing group/role/ownership checks;
- private responses entering shared caches or unsafe invalidation;
- silent API/persistence incompatibility or broken saved JSON;
- loss of established bilingual structures;
- AI content persisted/published without explicit human review;
- responsibility moved across architecture layers without approval.

## Actions requiring explicit approval

Do not replace the architecture, UI framework, or state library; weaken authentication/authorization; make private data publicly cacheable; convert bilingual contracts to one language; silently change an API; delete features or user data; add paid services; apply shared/production migrations; merge PRs; force-push; or rewrite published history without explicit approval.

## Preferred final response

Keep the response concise and practical:

1. Summary
2. Files changed
3. Verification performed
4. Risks or limitations
5. Suggested next step

Include Issue, branch, commit, and PR links only when publishing occurred.

## Local development shortcuts

For `/localdev` or `/dev`, run from the repository root:

```powershell
.\alife-dev.cmd -SkipSql
```

- Add `-ApplyMigrations` when migrations, database refresh, seed data, or DbMigrator are requested.
- Omit `-SkipSql` only when the user explicitly asks Codex to start Docker SQL Server.
- Add `-UseAzurite -EnableScheduledJobs` only for requested TimerTrigger or scheduled-job testing.
