# Event Management documentation instructions

These rules refine the repository-root `AGENTS.md` for `docs/events/` and Event module work elsewhere in the repository.

## Required context

For an ordinary Event module slice, normally read only:

- repository-root `AGENTS.md`;
- `EVENT-CONTRACT.md`;
- the affected `modules/<MODULE>.md`;
- the relevant portion of `event-contract.json`;
- `IMPLEMENTATION-STATUS.md`.

The generated long-form handbook is for people and broad architecture review. Do not load it for ordinary module work. Overview/onboarding work may also read `README.md` and `EventManagement-About.html`.

## Documentation impact

Before completing Event implementation or `/shipit`, review the complete diff for changes to:

- normative architecture or ADRs;
- domain/public or machine-readable contracts;
- module specifications and implementation/migration status;
- APIs, DTOs, authorization, privacy, or caching;
- user-visible behavior and acceptance scenarios;
- `README.md`, generated documentation, and Simplified Chinese, Traditional Chinese, or English parity.

Update every affected authoritative source in the same change, but do not mechanically edit unrelated documents or change normative architecture to excuse an implementation shortcut. If implementation conflicts with a normative contract, stop and report it unless the task authorizes the product/architecture decision.

## Generated documentation

- Never edit generated Event HTML directly.
- When `README.md` changes, run `node docs/events/scripts/generate-event-docs.mjs` from the repository root in the same change.
- Verify the Simplified Chinese, Traditional Chinese, and English `EventManagement-About.html` sections remain substantively equivalent.
- Do not claim generation or parity verification unless it was performed against the current sources.
