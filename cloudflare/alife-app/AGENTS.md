# Alife frontend instructions

These rules refine the repository-root `AGENTS.md` for `cloudflare/alife-app/`.

## UI implementation

- Preserve the existing UI framework, state patterns, routing conventions, and design language.
- Prefer accessible, responsive, mobile-first PWA behavior.
- Avoid unnecessary fetching, remounting, and duplicated state.
- Provide clear loading, empty, error, success, disabled, and focus states.
- Keep list, detail, creation, and management views understandable for non-technical group leaders.
- Use semantic controls, meaningful labels, and usable keyboard/focus behavior.
- Use `<img>` or the established optimized component for meaningful images needing alt text, loading behavior, SEO, or responsive sizing. Use backgrounds only for decoration and preserve dimensions/aspect ratios to avoid layout shift.

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
