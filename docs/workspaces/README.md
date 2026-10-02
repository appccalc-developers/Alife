# Identity and workspace orientation

Read [repository instructions](../../AGENTS.md), [common design](../design/README.md) and only the affected contract: [identity](IDENTITY.md), [Church](CHURCH.md), [Group](GROUP.md), [Personal](PERSONAL.md), or [management](MANAGEMENT.md). Detailed identity lifecycle remains owned by [identity-access](../identity-access.md); Event roles and work remain owned by Event contracts.

For navigation inspect `src/app/navigation/useShellNavigation.tsx`, routing access helpers and relevant views. For authority inspect backend `GroupAuthorizationService`, `AdminPermissionCatalog`, `AdminPlatformRoleHelpers` and the specific handler. Never treat frontend helpers, destination visibility, group titles or platform labels as authorization proof.

Changing roles or workspaces requires reviewing current membership, owning group, platform permission, actor/target restrictions, cache isolation and bilingual rendering. AI may explain or draft; it cannot assign roles, confirm identity or approve a governed decision without authorized human action.

Acceptance uses the requirements in each booklet plus [UI/UX](../design/UI-UX.md) and [QA](../design/QA.md). Current documentation is source-based as of 2026-10-01; no fresh live-account or database result is implied. Generated explanations, a bounded local demonstration and the [operation matrix](OPERATION-MATRIX.md) exist; [coverage](../design/COVERAGE.md) separates their browser checks from application verification.
