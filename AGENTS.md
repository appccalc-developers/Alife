# AGENTS.md — Alife Project Instructions for Codex

## Project identity

Alife is an alpha-stage community/church group platform designed to help overseas Chinese Christian communities manage groups, members, pages, sermons, events, bilingual content, and AI-assisted event workflows.

The project is also part of Stephen Wu's professional portfolio while returning to paid IT work. Code quality, maintainability, architecture clarity, and demonstrable product value matter.

## Primary goals

When working in this repository, prioritize:

1. Keep Alife stable for alpha testing.
2. Improve real user experience for group leaders and members.
3. Preserve the current architecture unless a change is explicitly requested.
4. Prefer small, reviewable, incremental changes over large rewrites.
5. Make the codebase easier to explain in a portfolio or job interview.
6. Support bilingual English/Chinese usage consistently.
7. Respect authentication, authorization, privacy, and cache correctness.

## Working style

Before making changes:

* Read the relevant existing implementation first.
* Identify the smallest safe change.
* Explain the intended change briefly before editing when the task is complex.
* Prefer focused patches over broad refactors.
* Do not introduce new frameworks, libraries, services, or architectural patterns unless explicitly requested.
* Do not remove existing behavior unless the task clearly asks for it.
* Do not rewrite working modules only for style preference.

After making changes:

* Summarize what changed.
* List files changed.
* Mention tests, checks, or commands run.
* Mention anything not verified.
* Point out follow-up work if relevant.

## Architecture principles

Alife uses a layered architecture with emphasis on cost, availability, scalability, and edge performance.

Respect the current separation between:

* Frontend / PWA UI
* API / backend application logic
* Cloudflare speed layer / cache behavior
* Authentication and authorization
* Persistent data storage
* AI-assisted workflows

Avoid mixing responsibilities across these layers.

When changing APIs, consider:

* Authentication requirements
* Authorization and group membership visibility
* Cache headers and Cloudflare behavior
* Client-side TanStack/PWA cache behavior
* Backward compatibility with existing frontend payloads
* Bilingual data shape where applicable

## Caching principles

Alife intentionally uses multiple cache layers:

* Backend/API cache where appropriate
* Cloudflare edge cache for safe, shared, stable responses
* PWA/client cache for user experience

Do not disable or bypass caching casually.

When changing cache-related code, explicitly consider:

* Whether the response is public, group-visible, member-visible, or user-specific
* Whether all authorized users receive exactly the same response
* Whether `Cache-Control`, `ETag`, `Vary`, and authorization behavior are correct
* Whether the cache key includes all necessary dimensions
* Whether a short TTL is safer for member-related data
* Whether stale data could leak private information

Never cache user-specific private data in a shared cache.

## Authentication and authorization

Alife uses JWT and Http-only Cookie based authentication.

When modifying protected APIs:

* Preserve authentication requirements.
* Validate group membership and visibility rules.
* Avoid trusting frontend-only checks.
* Avoid leaking private data through public or shared responses.
* Keep authorization logic explicit and easy to review.

## Bilingual and i18n rules

Alife supports English and Chinese content.

Many text attributes follow this shape:

```json
{
  "en": "English text",
  "zh": "中文内容"
}
```

When adding or editing content fields:

* Preserve bilingual structure where it already exists.
* Do not replace bilingual fields with plain strings unless explicitly requested.
* Avoid causing API refetches on language-only UI switches unless the underlying data truly changed.
* Keep translation helper behavior stable.
* Support user-facing bilingual forms consistently.

## Frontend principles

For frontend work:

* Preserve existing UI framework and conventions.
* Prefer simple, accessible, responsive UI.
* Avoid over-engineering.
* Avoid unnecessary refetching.
* Avoid unnecessary remounting.
* Keep list views, detail views, and management views easy for group leaders to understand.
* Consider mobile-first PWA usage.
* Use clear loading, empty, and error states where appropriate.

For image handling:

* Use `<img>` / optimized image components for meaningful content images requiring alt text, SEO, loading behavior, or responsive optimization.
* Use background images for decorative layout effects.
* Avoid layout shift by preserving known image dimensions or aspect ratios where possible.

## Page, section, and content builder principles

Pages and sections may contain bilingual text attributes and layout-specific configuration.

When working on page builder or section builder features:

* Preserve existing JSON structure where possible.
* Make changes migration-friendly.
* Avoid breaking existing saved pages.
* Keep editor UX understandable for non-technical group leaders.
* Prefer explicit schema evolution over hidden implicit behavior.
* Consider preview behavior and published behavior separately.

## AI-assisted features

Alife includes AI-assisted workflows, especially around event planning, event enrollment, photo reading, and post-event reflection.

When working on AI features:

* Treat AI as an assistant, not an unquestioned authority.
* Keep human review and correction in the workflow.
* Avoid automatically publishing AI-generated content without user confirmation.
* Preserve consent and privacy boundaries for uploaded photos and personal information.
* Keep prompts, generated content, and user edits auditable where practical.
* Prefer small AI workflow steps that users can understand and control.

## Database and API payload conventions

Prefer clear enum names in frontend/API payloads where appropriate, while database storage may remain integer-based.

When changing payload contracts:

* Keep frontend payloads readable.
* Keep backend parsing robust.
* Avoid breaking existing clients.
* Use explicit DTOs where they already exist.
* Avoid leaking persistence implementation details into frontend contracts.

## Testing and verification

When possible, run focused checks relevant to the change.

Examples:

* Build affected frontend/backend project
* Run unit tests if available
* Run type checks
* Run lint checks
* Run targeted API tests
* Verify cache headers for API/cache work
* Verify language switching behavior for i18n work

If a browser or visual environment is unavailable, say so clearly and provide the best available non-visual verification.

## Git and task management

Prefer changes that can map cleanly to GitHub issues and milestones.

For larger work:

* Propose a phased plan.
* Break work into small reviewable issues.
* Avoid large mixed-purpose commits.
* Keep commit messages and PR summaries portfolio-friendly.

## Do not do these without explicit approval

* Do not replace the existing architecture.
* Do not introduce a new state management library.
* Do not introduce a new UI framework.
* Do not remove Cloudflare cache behavior.
* Do not weaken authentication or authorization.
* Do not make private/member data publicly cacheable.
* Do not perform a large redesign when a focused UX improvement is requested.
* Do not convert bilingual fields into single-language fields.
* Do not silently change API contracts.
* Do not delete existing features to simplify the implementation.
* Do not add paid external services unless explicitly requested.

## Preferred response format from Codex

At the end of each task, respond with:

1. Summary
2. Files changed
3. Verification performed
4. Risks or limitations
5. Suggested next step

Keep the summary practical and concise.

## Alife project workflow

For Alife, every meaningful code change should be traceable through:
GitHub issue → feature branch → local implementation → commit → push → PR against main.
Use small, reviewable PRs. Prefer one issue per coherent feature, bug fix, or refactor.

When GitHub issue or PR creation is needed:

* Prefer fixing GitHub app repository write permission first.
* If GitHub app write permission is still unavailable, skip repeated GitHub app attempts and use the authenticated `gh` CLI directly.
* If `gh` is missing, install it globally once instead of reinstalling it for every shipping task.

Start it when user type /shipit.

## Local dev shortcut

When the user types `/localdev` or `/dev`, start the local development stack from the repository root with:

```powershell
.\alife-dev.cmd -SkipSql
```

If the user mentions migrations, database refresh, seed data, or DbMigrator, include `-ApplyMigrations`.
If the user explicitly wants Codex to start the Docker SQL Server container too, omit `-SkipSql`.
Azurite and scheduled Functions are not part of the default shortcut; use `-UseAzurite -EnableScheduledJobs` only when the user asks to test TimerTrigger/scheduled behavior.
