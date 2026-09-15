# FOOD.HOSPITALITY

> Normative module contract. Owns module-specific behavior, authority and compatibility. [Current delivery and gaps](../IMPLEMENTATION-STATUS.md#food-hospitality) are maintained centrally; [exact machine values](../event-contract.json) remain unchanged. Read only affected sections.

## Collaboration version 1 — preparation and execution

Uses the [shared report and handoff contract](../EVENT-WORKSPACES.md#tasks-and-reports): accepted module lead, versioned submission and owner adoption. Module-specific operations and privacy below still apply; a report neither certifies specialist facts nor grants participant-data access.

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

## Operational behavior

Partial report support: accepted lead, bilingual drafting/submission/return/adoption, immutable history and independent work page. Menus, dietary/allergy records and kitchen operations remain target work.





## Historical availability — 2026-09-13 (superseded by version 1)

Before collaboration version 1, catalogue status was `unavailable` (**尚未提供 / Not yet available**) at all preparation and direct entries. Catering remains deferred. Enabled/details-confirmed/readiness states are distinct; required unavailable food capability still blocks formal approval. Historical selections are retained.
