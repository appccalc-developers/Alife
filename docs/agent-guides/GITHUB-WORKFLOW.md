# GitHub and publishing workflow for coding agents

Read this file only when the user explicitly requests an Issue, branch, commit, push, PR, `/shipit`, or a complete publish flow. GitHub Issue and PR prose defaults to English; product content remains bilingual where required.

## Authorization boundaries

- Reuse an existing Issue when it covers the work; do not create one mechanically.
- An Issue request does not authorize a branch, commit, push, or PR.
- A branch request does not authorize an Issue, commit, push, or PR.
- A commit request authorizes staging explicit in-scope paths and a local commit, not push or PR.
- A push request authorizes only the requested branch push.
- A PR request authorizes its Issue/branch/verification/commit/push prerequisites, but no unrelated mutation.
- `/shipit` or an explicit complete-publish request authorizes the full workflow below.
- Prefer the GitHub app for metadata/writes; if it lacks permission, use authenticated `gh` without repeating failed connector writes.

Before any GitHub Issue write, restate the target repository, title, and intended mutation.

## Issue standard

A feature Issue includes `Context`, `Goal`, `Scope`, checkbox `Acceptance Criteria`, `Out of Scope`, and `Test Plan`. Add API/data, authorization/privacy/cache, bilingual, AI human-review, migration/deployment, rollout, or rollback sections when applicable.

A bug Issue includes `Problem and Impact`, `Steps to Reproduce`, `Actual Behavior`, `Expected Behavior`, `Scope`, `Acceptance Criteria`, and `Regression Test`, plus relevant roles, visibility, environment, data, and cache state.

For an Issue reconstructed from a branch, inspect the merge base, `main...HEAD`, commits, status, migrations, configuration, and tests. Separate inferred intent, delivered implementation, and verified results; keep branch statistics and detailed evidence primarily in the PR.

## Pull request standard

Meaningful PRs target `main`, default to Draft until implementation and focused checks are complete, and normally include `Closes #<number>`.

Describe user/developer impact and implementation by capability; map acceptance criteria to evidence; list exact checks; disclose risks, limitations, unverified behavior, migrations, configuration, screenshots, deployment notes, and Issue deviations. Do not mix unrelated work. Do not ready, merge, or close the Issue without explicit authorization.

## Branches and commits

Use conventional types such as `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, or `ci`. Prefer `type(scope): imperative summary (#issue)` when linked, otherwise omit the Issue suffix.

If `main` has uncommitted work, inspect every modified/untracked path. Preserve a coherent worktree while performing only the authorized action. Under `/shipit`, create/reuse the Issue before switching to `agent/<issue>-<short-slug>`. If changes are mixed or ownership is unclear, stop; never stash, discard, stage, or publish unrelated work.

## `/shipit`

Run only when explicitly requested:

1. Inspect repository, branch, remote, worktree, diff, and existing Issue/PR.
2. Confirm one coherent scope with no unrelated user work.
3. Reuse a linked Issue or create a standards-compliant one.
4. If on `main`, create `agent/<issue>-<short-slug>` before staging; a coherent dirty worktree may move with it.
5. Finish implementation and relevant checks.
6. Review documentation impact, update authoritative sources, regenerate derivatives, and verify language parity where applicable.
7. Stage only explicit in-scope paths, never the whole worktree.
8. Inspect the staged diff against the Issue and documentation contracts.
9. Commit as `type(scope): summary (#issue)`.
10. Push with upstream tracking.
11. Open a Draft PR against `main` containing `Closes #issue`.

Stop instead of shipping when authentication fails, the repository is ambiguous, tests expose an unresolved defect, destructive recovery is required, or unrelated changes cannot be separated.
