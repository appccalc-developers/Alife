# FOOD.HOSPITALITY

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

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

Contributes service requirement, headcount/serving aggregate, food-policy version, allergy-process confirmation, vendor/safety summary, role coverage, and blockers. It never copies participant dietary/allergy identities or health detail. Until this module has authoritative persistence/API, a required food contribution remains unavailable or follows an explicitly approved policy exception.

### User experience

Participants submit their own needs through registration. Authorised hospitality leads receive a purpose-limited aggregate and actionable exceptions, with explicit safety sign-off and cleanup state.

## Current implementation

Target only. Composition, role/classification/readiness definitions, workflow contribution, and a generic controlled surface exist. Matching food business persistence, authorised API, and usable flow do not.

## Open contract gaps

Menu, headcount, dietary/allergy summary, purchasing, kitchen shifts, food-safety evidence, vendor, serving, cleanup, and all dedicated API/UI behaviour.

## Next useful vertical slice

`dietary-menu-safety`: registration-derived dietary needs, an authorised minimum allergy summary, menu/servings, food-lead safety sign-off, and no health-record duplication.
