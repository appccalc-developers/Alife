# Alife frontend instructions

These rules refine the repository-root `AGENTS.md` for `cloudflare/alife-app/`.

## UI implementation

- Preserve the existing UI framework, state patterns and routing conventions. General pages retain their design language; Event management workspaces use the scoped direction below.
- Prefer accessible, responsive, mobile-first PWA behavior.
- Avoid unnecessary fetching, remounting, and duplicated state.
- Provide clear loading, empty, error, success, disabled, and focus states.
- Keep list, detail, creation, and management views understandable for non-technical group leaders.
- Use semantic controls, meaningful labels, and usable keyboard/focus behavior.
- Use `<img>` or the established optimized component for meaningful images needing alt text, loading behavior, SEO, or responsive sizing. Use backgrounds only for decoration and preserve dimensions/aspect ratios to avoid layout shift.

## Event Workspace design

- For Event management UI, use the [Event task reading matrix](../../docs/events/AGENTS.md#task-reading-matrix). Interaction/loading/routing repairs read relevant state and accessibility guidance; layout/material changes additionally read [Event Workspace design](../../docs/events/design/EVENT-WORKSPACE-DESIGN.md), visual tokens and the affected reference area. Colour, meaningful graphics, six-level depth and prompt feedback remain design requirements; a behavior repair does not require a visual redesign.
- Event-specific guidance extends the general restrained green/coral workspace palette. Keep the global shell, bilingual behavior, accessibility, server authority and compatible routes.
- Preparation is nonlinear; do not preserve a six-step wizard as a design requirement. Approval, publication and execution retain their actual business gates. Plan B is not planned.
- Use graphics first, simple icons where helpful, and concise text where meaning or consequences need it. Start with one pilot area and evaluate its rendered behavior before wider rollout.

## Pages, sections, and content builders

- Preserve existing page/section JSON structures where possible.
- Make schema evolution explicit, backward-compatible, and migration-friendly.
- Do not break existing saved or published pages.
- Keep editor workflows understandable for non-technical group leaders.
- Treat editor preview and published rendering as separate behaviors; verify both when affected.

## Frontend verification

- Run the narrowest relevant type, unit, browser, or build checks.
- Verify language switching and bilingual payload preservation when affected.
- Exercise responsive layout and interaction when visual behavior changes.
- Verify client-cache behavior when query identity, invalidation, or viewer visibility changes.
