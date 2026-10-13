# Event documentation and task reading

Applies to every Event task, including code outside this directory. Repository [AGENTS.md](../../AGENTS.md) remains in force. This is the single Event reading/update policy; frontend instructions and skills refer here.

## Task reading matrix

Read the compact [core contract](EVENT-CONTRACT.md) once. Search headings/JSON keys first, then read only affected sections, nearby implementation and tests. Content already in context need not be reread unless changed. A link is a reference, not an instruction to recursively load all dependencies.

| Task | Additional reading |
| --- | --- |
| Restore existing behavior | Affected topic/module sections and its [current status](IMPLEMENTATION-STATUS.md) entry |
| Change business behavior across modules | Affected stage, ownership, approval and specialist topics from the core reading map |
| API, DTO, enum, authorization or cache change | Matching `event-contract.json` sections/entries, plus all applicable privacy, viewer, role and compatibility rules |
| Frontend loading, routing or interaction repair | Relevant interaction/state/accessibility sections of [Workspace design](design/EVENT-WORKSPACE-DESIGN.md) and the affected flow; frontend AGENTS still applies |
| New layout, visual material or substantial visual reshape | Relevant [design](design/EVENT-WORKSPACE-DESIGN.md), [visual tokens](design/EVENT-UI-VISUAL-TOKENS.md) and [reference area](design/EVENT-UI-REFERENCE-PAGES.md); render one pilot before expanding |
| Historical regression, migration or evidence investigation | Relevant dated [history](../../archive/pending-docs-review/2026-10-10/docs/events/IMPLEMENTATION-HISTORY.md), old proposal or migration; never treat old results as a current test run |
| Product overview or documentation projection | Relevant README locales and generator/template; generated HTML is output, not authority |

Do not routinely load the full machine contract, historical log, execution proposals or generated long handbook. Reading budgets are guidance, never a reason to omit applicable authentication, privacy, cache isolation, bilingual compatibility or human-approval requirements.

## Event 2.0 reset scope

The repository-root [Event 2.0 pre-launch reset exception](../../AGENTS.md#event-20-pre-launch-reset-exception) is authoritative for this one cutover. Pre-reset Event instance data and Event 1.x runtime compatibility are not current requirements. Historical templates and policies remain readable, but cannot create or calculate a new Event. Composition schema `2.0.0` is the new compatibility baseline: all Event data created after the reset again requires forward migration, immutable history and auditable version governance.

Documentation and tests must not reintroduce an Event 1.x runtime fallback merely to preserve historical examples. They must still preserve security, privacy, authorization, cache isolation, bilingual behavior, templates, policy history, venue resources and non-Event data. The former dedicated production reset workflows are retired. The current one-time production deletion is separately authorised without SQL/R2 recovery copies; record its exact target, scope, preview fingerprint and post-operation evidence without exposing sensitive record details. Do not claim completion until production verification succeeds. Ordinary deployment must fail closed when a pending destructive Event 2.0 migration would encounter nonempty Event instance data.

## Documentation update triggers

Review the final diff for documentation impact, then update only affected authoritative sources in the same change:

| Actual change | Required update |
| --- | --- |
| Bug fix restoring an existing rule | Changed acceptance/evidence or current status only when those facts change; no automatic contract/README rewrite |
| Product behavior or module rule | Owning topic/module and its acceptance scenarios; core only when a shared invariant or architecture decision changes |
| Exact interface, schema, enum or machine rule | Relevant JSON contract entry plus the affected topic; preserve backward compatibility |
| Delivery, gaps, migration or verification facts | Update the relevant current-status row/section; retain new dated evidence there or in an active scoped evidence record. Do not append to the frozen pending-history archive |
| User-facing overview | Equivalent Simplified Chinese, Traditional Chinese and English README sections |
| README, machine JSON, generator or handbook template | Generate outputs, then run the check below; never edit generated HTML directly |

Topics own detailed business rules, modules own specialist operations/exceptions, JSON owns exact machine values, status owns delivery labels/gaps, and history owns dated evidence. Use links instead of copying rules into every source. Preserve important bookmarks when relocating sections. An explicitly scoped/versioned exception does not change other versions. Stop affected work and report unresolved normative conflicts unless the task already authorizes the necessary product/architecture decision.

The former implementation history, authorization review, Package execution proposal and policy-editor verification report are in `archive/pending-docs-review/2026-10-10/`. They preserve original dated evidence only. Read them for a specific historical investigation, not ordinary implementation or new Church App generation; current rules and remaining scope stay in the active contracts and status.

## Proportional verification

- Keep repository security, compatibility and bilingual checks proportional to the actual change. UI behavior still needs the relevant rendered interaction checks; a logic repair does not require a new visual pilot.
- After generator-input changes run `node docs/events/scripts/generate-event-docs.mjs`, then `node docs/events/scripts/generate-event-docs.mjs --check` from the repository root. For other Event documentation changes, run `--check` once; regenerate only if an affected projection is stale. Preserve the check and investigate failures rather than bypassing it.
- Verify changed translations for meaning as well as generated structure. Check moved anchors and links. Successful commands need only a compact summary; expand relevant diagnostics on failure.
- Report only checks actually run against the current source/artifact. Historical provider, database, browser or deployment results are not a new verification. No shared migration, external communication or Git publication is implied.
