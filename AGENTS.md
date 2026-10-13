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

## Project delivery governance

For project-wide planning, completion, audits and autonomous task selection, use [delivery governance](docs/governance/README.md) and its [work register](docs/governance/work-register.json). Domain contracts retain authority over business rules. The register tracks work and evidence; it does not replace domain status or grant publication, infrastructure or architecture permissions. For a narrow task, read only its relevant entry and requirements. Update the register when a registered task's scope, status or evidence changes.

Documentation use is recorded in [the Docs inventory](docs/governance/DOCUMENT-USAGE.zh-CN.md). Material under `archive/pending-docs-review/` is awaiting historical-archive confirmation and has no current development authority. Exclude it from ordinary requirement/implementation searches and Church App generation inputs. Read it only for an explicitly relevant history/provenance investigation; old prompts, plans, scripts and test results cannot establish current requirements or authorize operations. Promote an adopted requirement into its current owning contract with a recorded decision before implementing it.

## Architecture and API contracts

Use [the design orientation](docs/design/README.md) to locate the affected architecture/domain requirements. For UI work follow the applicable [UI/UX requirements](docs/design/UI-UX.md); use [QA](docs/design/QA.md) for requirement-to-evidence completion. Read only relevant sections. Preserve the Event reading/update matrix as its domain authority. Prototypes and generated presentations explain design and never replace server contracts or prove delivery.

Preserve separation between the frontend/PWA, backend application logic, Cloudflare speed/cache layer, authentication and authorization, persistent storage, and AI workflows. Do not move responsibility across layers without a documented reason and explicit approval.

For API changes, explicitly consider authentication, role/group visibility, backend and client caching, backward compatibility, and bilingual data shapes.

- Prefer readable enum names in API/frontend payloads; storage may remain integer-based.
- Keep DTO parsing robust and do not expose persistence details to clients.
- Make schema changes backward-compatible and migration-friendly.
- Review migrations and generated snapshots. Apply migrations only to an approved disposable/local database, never a shared or production database without explicit approval.

### Event 2.0 pre-launch reset exception

The user-authorised Event 2.0 reset is a narrow exception to compatibility requirements for Event instance data and Event 1.x runtime contracts. Pre-reset Event instances, Event 1.x requests, retired Event URLs, browser drafts and temporary Event sessions do not require conversion or continued support. Event templates, policy history, venue resources and every non-Event domain remain outside this exception.

From Event composition schema `2.0.0` onward, normal compatibility, immutable-history, migration and audit requirements apply again. Do not use this exception to discard or rewrite Event 2.0 data, weaken authentication or privacy, broaden cache visibility, or bypass bilingual contracts.

The former dedicated production Event reset, rollback and recovery workflows are retired. The user has separately authorised this one-time deletion of pre-launch production Event test instances and has declined SQL/R2 recovery copies and rollback. The operation must identify the exact production target and Event-only scope, freeze Event writes, preview and fingerprint what will be removed, and verify that templates, policies, venue resources and non-Event data remain intact. This exception does not authorise later Event 2.0 deletion. Normal application startup, deployment, Terraform and ordinary database migration must never purge Event instances. In particular, a pending Event 2.0 migration that removes legacy Event storage must fail closed while Event instance data is nonempty; retiring the reset workflow must not turn that migration into an implicit data-deletion path.

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

### Fixed UI copy in AI-generated code

AI agents generating or modifying frontend code must keep fixed display text in the existing feature-scoped `cloudflare/alife-app/src/i18n/` resources.

- This includes labels, buttons, placeholders, accessibility text, loading/error/empty/success messages, default display text, and preview/demo copy. Do not embed fixed copy in components, views, hooks, services, or utilities as `{ en: '...', zh: '...' }`, language-dependent string literals, JSX text, or arguments to local translation helpers. Single-language fixed UI text belongs in i18n too.
- Reuse suitable existing resources and translation helpers. Use stable, descriptive keys; keep interpolated messages in resources with explicit parameters rather than assembling translated fragments in callers. Preserve the established language selection and fallback behavior without adding a localization library.
- Keep user-authored content, editable form values, API/DTO fields, persisted `{ en, zh }` business data, domain identifiers, enum codes, and protocol values in their owning modules. Moving UI copy into i18n must not change payload shapes, saved JSON, permissions, cache identity, or business meaning.
- When adding or changing fixed copy, review both English and Chinese and run `npm --prefix cloudflare/alife-app run test:locale`. Verify language switching when presentation behavior changes.

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

Every Event module task, including Event code outside `docs/events/`, follows the task reading matrix and update triggers in [docs/events/AGENTS.md](docs/events/AGENTS.md). Read the compact core once and affected topic/status/JSON sections as needed; do not recursively load all linked documents or reread unchanged context. That matrix owns Event documentation verification. Never edit generated Event HTML directly.

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

### Local generated-data storage

For this Windows workspace, the user-approved data root is `C:\Data\Alife`.

- Put disposable builds, experiments, rendered previews, diagnostic reports, and temporary exports under `C:\Data\Alife\Temp`, with task-specific subdirectories.
- Keep original character and animation inputs under `C:\Data\Alife\Sources`, recovery backups under `C:\Data\Alife\Backups`, and package caches under `C:\Data\Alife\Cache`.
- Software installations and executable tools remain in appropriately named subdirectories of `C:\Developer`; do not use it for newly generated project data.
- Never create temporary output directly under `C:\` or `C:\.tmp`. Prefer explicit absolute output paths so a tool's working directory cannot redirect artifacts to the drive root.
- The repository `.tmp` and legacy Alife source/cache/backup locations may be compatibility junctions to the data root. They are not additional copies; do not replace them with real directories or recursively delete through them.
- Keep code, required distributable assets, and authoritative documentation in the repository. Do not move production assets or change their URLs as part of local-data housekeeping.
- Remove obsolete, reproducible build outputs after review. Retain original inputs, current candidates, required reproduction scripts, and recovery backups; do not retain every failed binary experiment by default. Inspect exact targets before cleanup and preserve unrelated user work.

When the user types `/localdev` or `/dev`, start the local stack from the repository root with:

```powershell
.\alife-dev.cmd -SkipSql
```

- Add `-ApplyMigrations` when migrations, database refresh, seed data, or DbMigrator are requested.
- Omit `-SkipSql` only when the user explicitly asks Codex to start Docker SQL Server.
- Add `-UseAzurite -EnableScheduledJobs` only for requested TimerTrigger or scheduled-job testing.

Local startup keeps the frontend at port 5173; Vite fails instead of silently
choosing a second origin, and the launcher reports an occupied fallback port 5174.
It does not kill that fallback-port process automatically.

For explicitly configured local alpha-login testing,
`AlphaLogin:BypassLocalRateLimit=true` skips only the controller's IP/account
throttles outside production. It defaults to false, is ignored in production,
and never bypasses alpha-login enablement or configured account restrictions.
Do not enable it on shared environments as part of ordinary local testing.
