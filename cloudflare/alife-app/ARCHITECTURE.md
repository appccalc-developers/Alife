# Alife Frontend Architecture

## Runtime Shape

Alife is a React 19 and TypeScript PWA built with Vite. The browser uses same-origin
API calls so JWT authentication can remain in HttpOnly cookies. Cloudflare provides
the production speed layer, while TanStack Query and the local HTTP cache manage
client-side freshness.

`index.html` is the Vite base document. A separate `base.html` is intentionally not
used because Vite only treats `index.html` as the development and build entry. Keeping
one canonical document prevents metadata and PWA configuration from drifting.

## Source Directories

| Directory | Responsibility |
|---|---|
| `src/app` | Application shell, composition, providers, route configuration, and app-level loading states. |
| `src/app/navigation` | Navigation models, responsive navigation UI, and workspace navigation construction. |
| `src/app/shell` | Structural shell UI such as the header and contextual drawers. |
| `src/app/context` | Route-derived workspace context, permissions, and shell data loading. |
| `src/app/actions` | Contextual floating actions and their interaction rules. |
| `src/views` | Route-level screens. Views may compose feature and shared components. |
| `src/components` | Reusable presentation and feature components that are not routes. |
| `src/services` | API clients and browser-facing integration services. |
| `src/db` | TanStack Query setup, collections, validators, and local cache behavior. |
| `src/stores` | Cross-route React context state such as authentication and current group. |
| `src/hooks` | Reusable stateful behavior shared by views or components. |
| `src/i18n` | Bilingual UI text and translation helpers. |
| `src/types` | Shared API, domain, and editor contracts. |
| `src/utils` | Pure transformations, validation, and formatting helpers. |
| `src/styles` | Global CSS, design tokens, and application-wide utility classes. |

## Dependency Direction

The preferred dependency flow is:

```text
main -> app -> views -> components/hooks -> services/db -> types/utils
```

- `main.tsx` only starts the application.
- `app` owns composition and routing, not feature business logic.
- Route screens are lazy-loaded in `app/routing/AppRoutes.tsx`.
- Stable third-party groups are emitted as named vendor chunks from `vite.config.ts`.
- Components should not import route screens.
- Services must not depend on React components or stores.
- Shared API access belongs in `services`; do not recreate a parallel `api` directory.

## Adding A Route

1. Add the route screen under `src/views`.
2. Register it with `lazy()` in `src/app/routing/AppRoutes.tsx`.
3. Apply authentication or authorization in the route layer.
4. Add navigation only when the route should be directly discoverable.
5. Preserve bilingual labels through `src/i18n/uiText.ts`.

## Quality Checks

```powershell
npm run typecheck
npm run build
```

The production build verifies TypeScript, Vite bundling, route chunks, and PWA
service-worker generation.
