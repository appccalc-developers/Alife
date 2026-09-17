# Alife Frontend

React 19 + TypeScript + Vite PWA for the Alife Church app. The app is deployed through a Cloudflare Worker that serves the built assets, proxies API/image requests, and hosts AI chat sessions through Durable Objects.

## Run

```bash
cd cloudflare/alife-app
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:5173` and proxies ordinary same-origin `/api/*` requests to `http://127.0.0.1:7071` by default.
AI session requests such as `/api/events/details-session/*`, `/api/events/form-assistance`, `/api/enrollments/session/*`, `/api/reviews/session/*`, and `/api/ai/*` are proxied to the speed-layer Worker at `http://localhost:8787` by default.

To point local dev at another API:

```bash
$env:API_PROXY_TARGET='http://127.0.0.1:7071'
$env:AI_PROXY_TARGET='http://localhost:8787'
npm run dev
```

For the Event Details Assistant in local development, also run the Worker with a real Gemini key:

```bash
cd ../speed-layer
copy .dev.vars.example .dev.vars
npm run dev
```

## Build And Preview

```bash
npm run build
npm run preview
```

`npm run preview` builds the app and starts `wrangler dev`, exercising the Cloudflare Worker entry point in `speed-layer/src/index.ts`.

### Public project overview

The root `README.html` is the only maintained source for `https://ccalc.live/project/`.
`predev` and `prebuild` copy it to the ignored `public/project/index.html`, which Vite includes in the static assets. After editing it during an active dev session, run `npm run generate:project-overview` and refresh. Generation failures stop the dev/build command.

In development, a small Vite middleware maps `/project/` to that public file and redirects `/project` to `/project/`, matching Workers directory-index routing instead of falling back to the React homepage.

The page contains English HTML for anonymous readers and crawlers, with a Chinese toggle that remembers the reader's choice. It links to public GitHub documentation. `public/robots.txt` advertises `public/sitemap.xml`, which lists only the homepage and project overview; these files do not grant access to protected content. The overview uses the existing static HTTP cache policy and PWA runtime cache but is excluded from the install-time precache.

The existing Worker deployment workflow also watches the root `README.html`. The public URL becomes available after a deployment containing these assets; no separate hosting service is needed.

## Environment

For local Vite development, prefer the same-origin proxy and leave `VITE_API_BASE_URL` empty.

For production builds that call a separate API origin directly, configure:

```env
VITE_API_BASE_URL=https://api.example.com
```

The Worker also supports these environment variables:

| Variable | Purpose |
|---|---|
| `API_PROXY_TARGET` | Backend API target for Worker proxy requests. |
| `IMAGES_PROXY_TARGET` | Image API target for `/images/*` proxy requests. |
| `GEMINI_API_KEY` | Secret used by AI session Durable Objects. |
| `GEMINI_MODEL` | Optional Gemini model override. |

## Key Runtime Pieces

- `index.html` is the canonical Vite base document and owns browser/PWA metadata.
- `src/main.tsx` is the minimal browser bootstrap.
- `src/app/AppProviders.tsx` composes application-wide providers.
- `src/app/routing/AppRoutes.tsx` owns route guards and lazy-loaded route screens.
- `src/app/AppShell.tsx` owns the application shell, contextual navigation, group drawer, and floating actions.
- `src/services/http.ts` configures Axios with `withCredentials` for the HttpOnly auth cookie.
- `src/services/aiSessionService.ts` and `src/hooks/useAiSession.ts` provide the reusable AI session client.
- `speed-layer/src/features/ai/aiSession.ts` provides the generic Durable Object base used by event planning, enrollment, and review sessions.
- `vite.config.ts` configures `vite-plugin-pwa` and Vite dev proxies.

See `ARCHITECTURE.md` for directory ownership and dependency rules.

To run the speed-layer edge worker tests, execute them from the `speed-layer` directory:

```bash
cd ../../speed-layer
npm test
```
