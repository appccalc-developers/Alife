# AGENTS.md — Alife Repository Instructions

## Authority and scope

This tracked file is the canonical instruction source for Codex and other coding agents working in the Alife repository.

- Apply these rules to every task started in this repository.
- Keep repository-specific behavior here rather than in a contributor's global `~/.codex/AGENTS.md`.
- Add a nested `AGENTS.md` only when a subtree has genuinely different requirements. A nested file may refine these rules for its subtree but must not weaken repository-wide security, privacy, compatibility, or traceability requirements.
- Keep `.github/copilot-instructions.md` as a thin compatibility pointer to this file. Do not duplicate the full workflow there.
- When instructions conflict, follow the higher-priority user or system instruction and report the conflict when it affects the requested outcome.

## Project identity

Alife is an alpha-stage community/church group platform for overseas Chinese Christian communities. It manages groups, members, pages, sermons, events, bilingual content, and AI-assisted event workflows.

Alife is also part of Stephen Wu's professional portfolio while returning to paid IT work. Stability, maintainability, architecture clarity, and demonstrable product value matter.

## Primary goals

Prioritize:

1. Keep Alife stable for alpha testing.
2. Improve real user experience for group leaders and members.
3. Preserve the current architecture unless a change is explicitly requested.
4. Prefer small, reviewable, incremental changes over broad rewrites.
5. Make the codebase easier to explain in a portfolio or job interview.
6. Support bilingual English/Chinese usage consistently.
7. Protect authentication, authorization, privacy, and cache correctness.

## Operating model

Before changing files:

- Read the relevant implementation and nearby tests first.
- Inspect the current branch and working tree. Existing changes belong to the user unless proven otherwise.
- Resolve discoverable facts from the repository instead of asking the user.
- Identify the smallest safe change and preserve unrelated behavior.
- For a complex task, briefly state the intended change before editing.
- Do not introduce a framework, library, paid service, or architectural pattern without explicit approval.
- Do not rewrite a working module solely for style preference.

While implementing:

- Keep each change within one coherent Issue.
- Preserve layer boundaries and existing public contracts.
- Use focused patches and explicit file scope.
- Do not delete, overwrite, stage, or publish unrelated user work.
- Treat tests, documentation, migrations, configuration, and cache behavior as part of the feature when applicable.

After implementing:

- Review the final diff against the Issue and its acceptance criteria.
- Run focused checks proportional to the risk.
- Report what changed, files changed, verification performed, anything not verified, risks, and the next useful step.

## Architecture principles

Alife uses a layered architecture designed around cost, availability, scalability, and edge performance. Preserve the separation between:

- Frontend / PWA UI
- API / backend application logic
- Cloudflare speed layer / cache behavior
- Authentication and authorization
- Persistent data storage
- AI-assisted workflows

When changing APIs, explicitly consider:

- Authentication requirements
- Authorization and group membership visibility
- Cache headers and Cloudflare behavior
- TanStack/PWA client cache behavior
- Backward compatibility with existing frontend payloads
- Bilingual data shapes

Do not move responsibilities across layers without a documented reason and explicit approval for an architectural change.

## Authentication, authorization, privacy, and caching

Alife uses JWT and Http-only Cookie based authentication and intentionally uses backend, Cloudflare edge, and PWA/client cache layers.

For protected or cached APIs:

- Enforce authentication and authorization on the server; never rely on frontend-only checks.
- Validate group membership, role, ownership, visibility, and platform permissions explicitly.
- Classify every response as public, group-visible, member-visible, or user-specific.
- Use shared caching only when every authorized viewer receives exactly the same representation.
- Never place user-specific or private member data in a shared cache.
- Check `Cache-Control`, `ETag`, `Vary`, cache keys, TTLs, authorization behavior, and invalidation paths.
- Include every visibility dimension in the cache key, or bypass shared caching when a safe shared key is not possible.
- Prefer a short TTL for member-related shared data when staleness has authorization or privacy impact.
- Preserve existing safe cache behavior; do not disable or bypass caching casually.
- Prevent private data from leaking through public endpoints, shared responses, logs, AI prompts, or stale cache entries.

## Bilingual and i18n rules

Alife supports English and Chinese. Many text fields use:

```json
{
  "en": "English text",
  "zh": "中文内容"
}
```

When changing content:

- Preserve bilingual structures where they already exist.
- Do not replace bilingual fields with plain strings unless explicitly requested.
- Support bilingual user-facing forms and clear fallback behavior.
- Keep translation helpers stable.
- Avoid API refetches or component remounts for language-only UI switches unless the underlying data changes.

## Frontend principles

- Preserve the existing UI framework, state patterns, routing conventions, and design language.
- Prefer accessible, responsive, mobile-first PWA behavior.
- Avoid unnecessary fetching, remounting, and state duplication.
- Provide clear loading, empty, error, success, and disabled states.
- Keep list, detail, and management views understandable for non-technical group leaders.
- Use semantic controls, usable focus behavior, and meaningful labels.

For images:

- Use `<img>` or the established optimized image component for meaningful content images that need alt text, loading behavior, SEO, or responsive sizing.
- Use background images only for decorative effects.
- Preserve dimensions or aspect ratios to avoid layout shift.

## Page, section, and content builder principles

- Preserve existing page and section JSON structures where possible.
- Make schema evolution explicit, backward-compatible, and migration-friendly.
- Do not break existing saved or published pages.
- Keep editor UX understandable for non-technical group leaders.
- Treat editor preview and published rendering as separate behaviors that both require verification.

## AI-assisted feature principles

AI is an assistant, not an authority.

- Keep human review, correction, and explicit commit or publication in the workflow.
- Never automatically publish AI-generated content without user confirmation.
- Do not let AI invent safety facts, permissions, identities, contact details, or authoritative church claims.
- Preserve consent and privacy boundaries for photos, personal information, prompts, and generated content.
- Keep prompts, outputs, and user edits auditable where practical.
- Prefer small, understandable AI workflow steps with clear loading and failure states.
- Provide a non-destructive failure path when an AI provider is unavailable or misconfigured.
- Consider provider cost and do not add a paid service without explicit approval.

## Database and API payload conventions

- Prefer readable enum names in frontend/API payloads; database storage may remain integer-based.
- Keep backend parsing robust and DTO usage consistent with the existing application layer.
- Do not leak persistence implementation details into frontend contracts.
- Preserve existing clients when changing payloads or routes.
- Make migrations reversible where practical, review generated snapshots, and document required migration or seed steps.
- Do not apply a migration to a shared or production database without explicit approval.

## Testing and verification

Run the narrowest checks that give credible coverage, then expand when risk warrants it.

Examples:

- Build the affected frontend or backend project.
- Run focused unit or API tests.
- Run TypeScript type checks and relevant lint checks.
- Verify cache headers, viewer-specific responses, and invalidation behavior for cache work.
- Verify authentication and role matrices for protected workflows.
- Verify language switching and bilingual payload preservation for i18n work.
- Render or exercise the UI when layout or interaction changes.
- Apply migrations only to an approved disposable/local database when database verification is required.

If browser, provider, database, or deployment verification is unavailable, say so explicitly. Never claim a check passed unless it was run against the current source or rebuilt artifact.

## GitHub Issue authoring standard

GitHub Issue and PR prose defaults to English. User-facing product content remains bilingual where required.

Every meaningful change must have one coherent Issue before implementation begins. Reuse an existing Issue when it already covers the work; do not create duplicates to satisfy process mechanically.

### Feature Issues

A meaningful feature Issue must contain:

- `Context`: the problem, user need, or current limitation.
- `Goal`: the outcome, not the implementation steps.
- `Scope`: the behaviors and systems included.
- `Acceptance Criteria`: observable, testable outcomes written as checkboxes.
- `Out of Scope`: boundaries that prevent accidental expansion.
- `Test Plan`: how implementation and review will verify completion.

Add API/data changes, authorization/privacy/caching, bilingual behavior, AI human review, deployment/migration, rollout, or rollback sections when applicable. Small low-risk Issues may omit inapplicable sections, but they must still state the problem or goal and testable completion criteria.

### Bug Issues

A bug Issue must contain:

- `Problem and Impact`
- `Steps to Reproduce`
- `Actual Behavior`
- `Expected Behavior`
- `Scope`
- `Acceptance Criteria`
- `Regression Test`

Document affected roles, visibility, environments, data, and cache state when they influence reproduction or risk.

### Branch-derived Issues

When an Issue is reconstructed or updated from an existing branch:

- Resolve the merge base and inspect `main...HEAD`, commit history, file status, migrations, configuration, and relevant tests.
- Separate original intent, delivered implementation, and verified results.
- Do not present inferred intent as a confirmed requirement.
- Identify mismatches among the Issue, branch name, commits, implementation, and current architecture.
- Put branch statistics and detailed verification primarily in the PR; keep the Issue focused on why, what, and done.

Before any GitHub Issue write, restate the target repository, title, and intended mutation. Do not create or update an Issue unless the user has authorized that external write or invoked `/shipit`.

## Pull Request authoring standard

An Issue defines why the change is needed, what is in scope, and how completion is judged. A PR explains how it was implemented, what actually changed, and what evidence supports review.

Every meaningful PR must:

- Target `main`.
- Link its Issue with `Closes #<issue-number>` unless closure must be deferred for a documented reason.
- Summarize user/developer impact and the implementation by capability, not merely by file.
- Map acceptance criteria to implementation or verification evidence.
- List exact checks run and their outcomes.
- Disclose risks, limitations, unverified behavior, migrations, configuration, screenshots, and deployment notes when applicable.
- Call out any deviation from the Issue and update the Issue when the agreed requirement changed.
- Default to Draft until implementation and focused verification are complete and a human is ready to begin formal review.

Do not mix unrelated changes into one PR. Do not mark a PR ready, merge it, or close its Issue unless the user explicitly authorizes that action.

## Branch, commit, and publishing conventions

For new meaningful work:

1. Create or confirm the Issue.
2. Start from an up-to-date, clean understanding of `main`.
3. Create `agent/<issue-number>-<short-slug>`.
4. Implement the smallest coherent change.
5. Stage only explicit in-scope paths.
6. Commit as `type(scope): summary (#<issue-number>)`.
7. Push the branch and open a Draft PR against `main`.

Use common conventional types such as `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, or `ci`. Keep subjects concise, imperative, and portfolio-friendly.

If `main` already contains uncommitted work when traceability is requested:

- Inspect every modified and untracked path before acting.
- If all changes form one coherent task, create or reuse its Issue, then switch to the feature branch while preserving the worktree.
- If the worktree is mixed or ownership is unclear, stop and request direction. Do not stash, discard, stage, or publish unrelated work.

Prefer the GitHub app for Issue and PR metadata and writes. If repository write permission is unavailable there, use the authenticated `gh` CLI without repeating failed connector writes. If `gh` is missing, install it once only when installation is authorized.

## `/shipit` workflow

Run this workflow only when the user explicitly types `/shipit` or otherwise explicitly requests the complete publish flow.

1. Inspect the repository, current branch, remote, worktree, diff, and any existing Issue or PR.
2. Confirm that the changes form one coherent scope and do not include unrelated user work.
3. Reuse the linked Issue when present; otherwise create a standards-compliant Issue.
4. If currently on `main`, create `agent/<issue-number>-<short-slug>` before staging or committing. A coherent dirty worktree may move with the branch.
5. Implement any remaining required work and run relevant checks.
6. Stage only explicit in-scope file paths. Never stage the whole worktree through a blanket staging command.
7. Inspect the staged diff and confirm that it satisfies the Issue.
8. Commit with `type(scope): summary (#<issue-number>)`.
9. Push with upstream tracking.
10. Open a Draft PR against `main` using the PR standard and include `Closes #<issue-number>`.

Stop instead of shipping when authentication fails, the target repository is ambiguous, tests reveal an unresolved defect, destructive recovery would be required, or the worktree contains inseparable unrelated changes.

## Code Review Rules

Review for consequential defects, regressions, and violations of these invariants. Do not report style-only findings unless they create a real maintenance or correctness risk.

### Authorization and privacy

- Flag protected behavior enforced only in the frontend, missing group/role/ownership validation, or responses that reveal data beyond the viewer's authorization.
- Safe path: enforce the rule in backend/application logic and add positive and negative role tests.

### Shared caching

- Flag user-specific or member-private responses that can enter a shared cache, cache keys missing a visibility dimension, or writes that leave sensitive shared entries stale.
- Safe path: use a correctly dimensioned shared key only for identical representations; otherwise use private/no-store behavior and test cache headers and cross-viewer isolation.

### API and persistence compatibility

- Flag silent contract changes, persistence details exposed to clients, unsafe enum changes, or migrations that break existing data and saved JSON.
- Safe path: preserve the existing contract, add backward-compatible parsing or explicit versioning, and document migration behavior.

### Bilingual content

- Flag replacement of established `{ en, zh }` fields with single-language strings or language switches that trigger unnecessary data reloads.
- Safe path: preserve the bilingual shape and localize presentation without changing the underlying entity identity.

### AI human control

- Flag AI output that is automatically persisted/published, prompts that include unnecessary personal data, or generated safety/identity facts treated as authoritative.
- Safe path: return a reviewable draft, minimize prompt data, and require an explicit human commit.

### Architecture boundaries

- Flag frontend authorization used as the only control, Cloudflare code becoming the persistent business authority, or broad framework/state-management replacements without approval.
- Safe path: keep UI, application logic, edge/cache behavior, authorization, storage, and AI orchestration in their established layers.

## Actions requiring explicit approval

Do not:

- Replace the existing architecture, UI framework, or state-management library.
- Remove safe Cloudflare cache behavior or make private/member data publicly cacheable.
- Weaken authentication or authorization.
- Convert bilingual fields to a single-language contract.
- Silently change an API contract.
- Delete features or user data to simplify implementation.
- Add paid external services.
- Apply migrations to a shared/production database.
- Merge a PR, force-push, rewrite published history, or perform destructive Git recovery.

## Preferred final response

At the end of a task, respond with:

1. Summary
2. Files changed
3. Verification performed
4. Risks or limitations
5. Suggested next step

Keep it practical and concise. Include Issue, branch, commit, and PR links when publishing occurred.

## Local development shortcuts

When the user types `/localdev` or `/dev`, start the local stack from the repository root with:

```powershell
.\alife-dev.cmd -SkipSql
```

- If the user mentions migrations, database refresh, seed data, or DbMigrator, include `-ApplyMigrations`.
- If the user explicitly asks Codex to start the Docker SQL Server container, omit `-SkipSql`.
- Azurite and scheduled Functions are not part of the default shortcut. Use `-UseAzurite -EnableScheduledJobs` only when asked to test TimerTrigger or scheduled behavior.
