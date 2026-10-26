---
name: create-system
description: Plan and implement a new independently named bilingual community system equivalent to a pinned Alife baseline. Ask deployment profile and resource availability; support Azure + Cloudflare and Cloudflare-only. Do not use to silently migrate existing Alife or promise a complete app from the bundled planning resources.
---

# Create an Alife-equivalent system

This package contains intake, a functional baseline, a deterministic planning generator and implementation workflows. It does not bundle application source or complete runtime templates. A pinned, authorized Alife source checkout is needed for source-equivalent generation. In its absence, complete intake/planning and report the missing source; do not invent contracts or claim a runnable clone. A target checkout may have additional instructions.

## Intake and plan

Read [intake](references/intake.md) and [baseline](references/baseline.json). Preserve answers already given. Ask the system display name, safe project slug, explicit deployment profile, and actual availability of Azure Functions/Azure SQL and Cloudflare resources. Resource availability does not decide the profile. Ask follow-ups only when they affect the next step; unknown external resources may remain documented blockers while local work continues.

Generate a plan using `node scripts/plan-system.mjs --name "Display Name" --slug project-slug --profile azure-cloudflare` or `--profile cloudflare-only`; paths are relative to this skill directory. Optional flags `--azure-functions`, `--azure-sql`, `--cloudflare` accept present/absent/unknown. The tool prints JSON and has no external or filesystem mutations. Save reviewed project configuration, requirements/parity register and work register to the user's chosen new project location using normal file tools. The output is a plan, not executable application source. Before saving, inspect the destination and preserve existing work; do not default to modifying Alife.

Resolve source location and exact revision. baseline.json is a routing snapshot, not a substitute for pinned contracts/source. Locate its authority paths relative to the Alife source root, inspect only affected sections, and record version drift. Keep source-delivered and target-only capabilities separate. Generate a per-scenario parity record including requirement, source behavior/status, target implementation, test, environment and gaps; expand the family-level baseline before declaring equivalence.

For an Alife source that includes docs/governance/document-register.json, use its retained records to route relevant documentation. Exclude archive/pending-docs-review from generation inputs and ordinary requirement searches. Historical prompts or proposals are not current architecture choices; use them only for a specific provenance question, then reconcile any adopted requirement into its current owner.

## Implement the selected profile

Read only [Azure + Cloudflare](references/azure-cloudflare.md) or [Cloudflare-only](references/cloudflare-only.md). Both preserve logical presentation, acceleration, application/domain and persistent-storage responsibilities. The Cloudflare profile is a new implementation topology, not a configuration conversion of .NET/SQL Server. The selected profile authorizes that topology for the new system; additional libraries, paid services or unrelated redesign require the user's authorization.

When implementation is requested, inspect source and target working trees. Produce a reviewed file/configuration inventory before copying. Reuse only authorized code/assets and relevant tests/contracts; exclude secrets, private data, source tenant identities, production resources, cached accounts, generated binaries and personal developer configuration. No blanket recursive clone/replace operation. Record source attribution and reuse-rights gaps. Brand changes must be deliberate; cookie names, RP IDs/origins, databases, buckets, Worker names and deployment resources must be independent. Legacy payload values cannot be renamed indiscriminately.

Implement one complete persistent authorized journey, then continue by dependency and parity register until the requested scope is satisfied. Use govern-project's delivery method and the target's owning rules. Separate draft assistance from authorized persistence/publication. Never copy an Alife database or share its auth keys/resources by default. Provider tests use authorized test accounts or explicit fixtures and disclose which.

Before claiming an equivalent system, verify all agreed scenarios against the pinned baseline, both languages, saved-payload compatibility, positive/negative roles, cross-viewer cache isolation, invalidation, rendering and configured integrations. Partial Alife modules remain partial unless separately implemented and verified. Generated placeholders, migrations, contracts and passing builds do not establish delivery. Report changed files, evidence, source version, missing integrations and next task. Installation and end-to-end generation of this plugin itself also need a target-host rehearsal; package validation alone is insufficient.
