# MONEY.FINANCE

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

## Collaboration version 1

Current support is **partial: registration fees**. Versioned registration rules declare amount/currency, collection/refund terms and registrationFeesOnly scope. The accepted finance owner submits and a separate accepted finance approver reviews that version. Current memberships and separation are rechecked. Authorized finance actors manually record receipts/refunds with evidence; registration actors see required payment status only. Limited readiness never waives unsupported other money flows. No provider, budget, purchasing, claims or ledger is supplied. See [EVENT-WORKSPACES.md](../EVENT-WORKSPACES.md).

## Purpose

Provide auditable Event budgeting, fees, purchasing, claims, refunds, reconciliation, and close-out with strict separation of duties.

## Target contract

### Activation

Required only when confirmed `money.hasMoneyFlow == true` (`money-flow-present`). Activity Types never preselect this module or invent money flow.

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

Minor-unit budget lines, fees, purchasing, expense claims, refunds, reconciliation, and close-out. Authoritative amounts use integer `amountMinor` and ISO 4217 `currency`.

### Roles and authority

At least one `finance.owner` and one independent `finance.approver`. Each role is eligible through a controlled finance permission and is separated from the other.

### Data classification

`roleRestricted`, `approvalEvidence`, and `userSpecific`. Finance data is never shared-cached or included in AI prompts.

### Workflow contribution

`finance.budget`, `finance.collect`, `finance.purchase`, `finance.reconcile`, `finance.close`.

### Readiness

`currency-defined`, `budget-approved`, and `payment-and-refund-terms-published`.

### Event Package contribution

Contributes money-flow presence, currency, policy-safe aggregate budget/fee summary, refund terms, finance decision reference/version/expiry, and blockers. It never copies bank, payer, claim, invoice, or line-item detail into the Package. Any payment or fee acceptance additionally requires the Registration gate and current Finance approval; no payment provider is introduced by Event Package Approval.

### User experience

Owners prepare records; independent approvers review explicit versions. Participants see only their own fee/refund projection. Conflict, approval, and close-out states remain visible and auditable.

## Current implementation

Partial registration-fee support: versioned rules, independent approval, manual receipts/refunds, current authorization, audit and a dedicated registration/finance work page. Broader finance capabilities below remain target work.

## Open contract gaps

Budget, purchasing, claims, ledger reconciliation and wider financial close-out remain deferred; registration fees, their approval and manual refund evidence are provided in version 1.

## Next useful vertical slice

`event-budget-expense-closeout`: minor-unit budget lines, expense claim, independent approval, reconciliation, role-restricted no-store responses, and no payment-provider dependency.

## Historical availability — 2026-09-13 (superseded by version 1)

Before collaboration version 1, catalogue status was `unavailable` (**尚未提供 / Not yet available**) in creation, Workspace overview and the module/direct entry. Enabling or confirming details does not create financial readiness, and a required unavailable finance module still blocks formal approval. Historical selections and records remain intact.
