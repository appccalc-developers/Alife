# Alife Frontend

React 19 + TypeScript + Vite PWA for the Alife Church app. The app is deployed through a Cloudflare Worker that serves the built assets, proxies API/image requests, and hosts AI chat sessions through Durable Objects.

## Run

```bash
cd frontend/alife-app
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:5173` and proxies same-origin `/api/*` requests to `http://localhost:7071` by default.

To point local dev at another API:

```bash
$env:API_PROXY_TARGET='http://localhost:7071'
npm run dev
```

## Build And Preview

```bash
npm run build
npm run preview
```

`npm run preview` builds the app and starts `wrangler dev`, exercising the Cloudflare Worker entry point in `speed-layer/src/index.ts`.

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

- `src/App.tsx` owns the route tree, shell navigation, group context drawer, and floating actions.
- `src/services/http.ts` configures Axios with `withCredentials` for the HttpOnly auth cookie.
- `src/services/aiSessionService.ts` and `src/hooks/useAiSession.ts` provide the reusable AI session client.
- `speed-layer/src/features/ai/aiSession.ts` provides the generic Durable Object base used by event planning, enrollment, and review sessions.
- `vite.config.ts` configures `vite-plugin-pwa` and Vite dev proxies.

To run the speed-layer edge worker tests, execute them from the `speed-layer` directory:

```bash
cd ../../speed-layer
npm test
```
