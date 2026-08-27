# MONEY.FINANCE

> Documentation class: **Normative module contract**. “Current implementation” is an operational convenience snapshot and defers to [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values live in [event-contract.json](../event-contract.json).

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

### User experience

Owners prepare records; independent approvers review explicit versions. Participants see only their own fee/refund projection. Conflict, approval, and close-out states remain visible and auditable.

## Current implementation

Target only. Composition rules, role separation, classification, readiness metadata, and a generic controlled surface exist. Matching finance business persistence, authorised CRUD/state transitions, and usable finance UI do not.

## Open contract gaps

Budget, fees, purchasing, claims, refunds, reconciliation, close-out, approval evidence, and all dedicated finance UI/API behaviour.

## Next useful vertical slice

`event-budget-expense-closeout`: minor-unit budget lines, expense claim, independent approval, reconciliation, role-restricted no-store responses, and no payment-provider dependency.
