# FOOD.HOSPITALITY

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Collaboration version 1 — preparation and execution

The [workspace contract](../EVENT-WORKSPACES.md) scopes this version's preparation to an accepted responsible lead and a bilingual versioned report. The lead writes in an independent page; the Event owner returns or adopts an immutable submitted revision into the formal plan. Later drafts cannot alter adopted text; frozen-plan changes require reopening. Submission and return project the next person's duty. Existing specialist execution tools and checks remain independent. This report does not certify specialist facts or grant access to private participant data.

## Purpose

Plan safe and hospitable food service while limiting dietary/allergy disclosure to people who need it for a defined Event purpose.

## Target contract

### Activation

Required when `food.serviceRequired == true` (`food-service`).

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

Menus, headcount, dietary/allergy summaries, purchasing, kitchen shifts, food-safety evidence, serving, vendors, and cleanup.

### Roles and authority

At least one `hospitality.lead` with controlled `foodPolicyEligible` evidence. Registration data does not grant open access; the server returns only the minimum operational summary for the authorised purpose.

### Data classification

`eventTeam` and `roleRestricted`. Allergy/dietary information is protected, private/no-store, excluded from shared cache and AI prompts, and is not a duplicate health record.

### Workflow contribution

`food.plan`, `food.collect-dietary-needs`, `food.prepare`, `food.clean`.

### Readiness

`food-policy-loaded`, `allergy-process-confirmed`, and `service-and-cleaning-roles-filled`.

### Event Package contribution

Contributes service requirement, headcount/serving aggregate, food-policy version, allergy-process confirmation, vendor/safety summary, role coverage, and blockers. It never copies participant dietary/allergy identities or health detail. In version 1, the adopted planning report supplies the limited preparation contribution; it does not claim automated food-policy, allergy, menu or kitchen tools. Those broader checks remain target capabilities.

### User experience

Participants submit their own needs through registration. Authorised hospitality leads receive a purpose-limited aggregate and actionable exceptions, with explicit safety sign-off and cleanup state.

## Current implementation

Partial report support: accepted lead, bilingual drafting/submission/return/adoption, immutable history and independent work page. Menus, dietary/allergy records and kitchen operations remain target work.

## Open contract gaps

Menu, headcount, dietary/allergy summary, purchasing, kitchen shifts, food-safety evidence, vendor, serving, cleanup, and all dedicated API/UI behaviour.

## Next useful vertical slice

`dietary-menu-safety`: registration-derived dietary needs, an authorised minimum allergy summary, menu/servings, food-lead safety sign-off, and no health-record duplication.

## Historical availability — 2026-09-13 (superseded by version 1)

Before collaboration version 1, catalogue status was `unavailable` (**尚未提供 / Not yet available**) at all preparation and direct entries. Catering remains deferred. Enabled/details-confirmed/readiness states are distinct; required unavailable food capability still blocks formal approval. Historical selections are retained.
