# Speed Layer Architecture

## Purpose

The Cloudflare speed layer is the browser-facing edge runtime for the deployed Alife app. It serves the built React PWA, proxies API and image requests, applies safe edge caching, maintains lightweight authorization mirrors for shared group cache reads, and hosts AI session Durable Objects.

The speed layer improves latency and availability without replacing the backend as the source of truth.

## Runtime Stack

| Concern | Technology |
|---|---|
| Runtime | Cloudflare Workers |
| Config | `cloudflare/speed-layer/wrangler.jsonc` |
| Language | TypeScript |
| App assets | Cloudflare Workers static assets from `cloudflare/alife-app/dist` |
| API origin | `API_PROXY_TARGET`, defaulting to `https://api.ccalc.live` |
| Image origin | `/images/*` proxy to `https://images.ccalc.live` by default |
| Edge cache | Cloudflare Cache API |
| AI sessions | Durable Objects backed by Worker classes |
| AI provider | Gemini through `GEMINI_API_KEY` |

## Source Layout

```text
cloudflare/speed-layer/
  wrangler.jsonc
  package.json
  index.test.mjs
  src/
    index.ts
    shared/
      router.ts
    middlewares/
      authCache.ts
      apiCache.ts
      proxyHandler.ts
    features/
      ai/
        aiRouter.ts
        aiSession.ts
        translateTextFields.ts
      events/
        eventRouter.ts
        planner.ts
        enrolment.ts
        reviewer.ts
```

## Request Routing

The main Worker router in `src/index.ts` has three important paths:

```text
/images and /images/*
  -> proxyHandler directly

/proxy/*
  -> proxyHandler directly with /proxy stripped

/api/*
  -> authMiddleware
  -> apiCacheMiddleware
  -> AI/event session routers when matched
  -> proxyHandler fallback to backend API
```

Non-API frontend navigation is handled by Workers static assets. `wrangler.jsonc` sets:

```json
"assets": {
  "directory": "../alife-app/dist",
  "not_found_handling": "single-page-application",
  "run_worker_first": [
    "/api/*",
    "/images/*"
  ]
}
```

This means the Worker runs first for API and image routes, while regular app routes can fall back to the built SPA.

## Proxy Behavior

`proxyHandler.ts` forwards allowed proxy paths:

- `/api/*` to `API_PROXY_TARGET`.
- `/images` and `/images/*` to the image API origin.
- `/proxy/*` after stripping `/proxy`.

It also handles CORS preflight for proxied routes and forwards credentials/headers needed for cookie auth and conditional GETs.

When the edge cache is responsible for validation, the proxy strips conditional request headers before going to origin. This lets the Worker decide whether to return a cached `304 Not Modified` based on its own stored response and ETag.

## Cache Model

The speed layer has two kinds of cache entries:

1. Response cache records.
2. Logical authorization and entity mapping records.

Both are stored through the Cloudflare Cache API, but they serve different purposes.

### Public Shared Cache

These API paths are public shared cache candidates:

- `/api/sermons`
- `/api/pages/global`

Public image responses under `/images/*` can also receive public cache headers.

### Authorized Group-Shared Cache

Some group-scoped responses can be shared among authorized approved members of the same group:

- `/api/groups/{groupId}/pages`
- `/api/groups/{groupId}/subgroups`
- `/api/groups/{groupId}/events`
- `/api/groups/{groupId}/memberships`
- `/api/groups/{groupId}/members`

These records use a group-level cache key such as:

```text
group:{groupId}:{cacheKind}
```

Before reading group-shared cache, the Worker checks an authorization mirror for the current member and group.

### Member Profile Cache

`GET /api/me` can be cached per member id:

```text
member:{memberId}:me
```

Successful `/api/me` responses also seed authorization mirror records for the member's memberships.

### Shared Page And Event Detail Cache

The speed layer can map page and event ids back to group ids with logical records:

```text
map:page:{pageId}:meta
map:{entityType}:{entityId}:group
```

These mappings let the Worker know which group authorization context is required for detail or subresource paths such as:

- `/api/pages/{pageId}`
- `/api/events/{eventId}/enrollments`
- `/api/events/{eventId}/reviews`

Draft pages receive extra protection. A shared cached draft page can be read only by its author or a member whose mirrored role allows draft access.

## Authorization Mirrors

The speed layer does not replace backend authorization. It mirrors a subset of authorization facts after the backend has already returned a successful response.

Important logical keys:

```text
membership:{groupId}:{memberId}
member:{memberId}:profile
map:page:{pageId}:meta
map:{entityType}:{entityId}:group
```

The Worker extracts the member id from:

- Bearer token subject, when an Authorization header is present.
- JWT subject in the `alife_auth` cookie.

The mirror status can be:

- `hit`
- `miss`
- `unbound`
- `no-principal`
- `not-applicable`

If a group-shared cache path needs authorization and the mirror is missing or not approved, the Worker does not serve the shared cache. For certain authorized group cache paths it returns `403` until origin-backed authorization has been seeded.

## Cache Headers

Browser-facing API responses are intentionally conservative:

```text
Cache-Control: private, no-cache
Vary: Accept-Encoding, Cookie, Authorization
```

This allows browser and frontend conditional validation while preventing private or member-visible data from being treated as public browser cache content.

Edge-stored records use public edge cache semantics internally. Public image responses can use public browser cache semantics.

`/api/sermons` keeps pagination parameters in its cache key, uses a five-minute
edge TTL, and stores `Cache-Tag: alife-sermons` on cached variants. This prevents
different page sizes from sharing a response and provides a bounded freshness
fallback if active invalidation is unavailable.

The Worker adds diagnostic headers:

| Header | Meaning |
|---|---|
| `x-alife-cache: HIT` | Served from edge cache |
| `x-alife-cache: MISS` | Fetched from origin and cached |
| `x-alife-cache: REVALIDATED` | Client ETag matched cached response, returned 304 |
| `x-alife-cache: BYPASS` | Edge cache was not used |
| `x-alife-authz` | Authorization mirror status for group-shared paths |

## ETags And Conditional GET

When a cacheable origin response does not include an ETag, the speed layer generates a weak ETag from the response body. Later requests with `If-None-Match` can receive `304 Not Modified` directly from the Worker if the client ETag matches the cached response.

This works with the frontend IndexedDB-backed `conditionalGet` helper.

## Mutation Invalidation

For `POST`, `PUT`, `PATCH`, and `DELETE`, the speed layer passively invalidates known affected cache keys after successful responses.

Examples:

- Group membership actions invalidate member lists, membership lists, member profile cache, and authorization mirror records.
- Page updates invalidate page detail and owner group page lists.
- Event updates invalidate owner group event lists.
- Enrollment and review mutations invalidate event enrollment/review lists.
- Sermon sync locally invalidates `/api/sermons` and asks the Cloudflare API to
  globally purge the `alife-sermons` cache tag. The global purge is required
  because Worker Cache API deletion runs only in the data center handling the
  invalidation request.
- Subgroup creation and co-leader claim update member profile and membership mirrors.

Backend invalidation still matters. Edge invalidation is a latency and correctness aid, not the only freshness mechanism.

## AI Session Routing

The speed layer owns temporary AI session state through Durable Objects.

Routes:

| Route | Handler |
|---|---|
| `GET /api/ai/status` | AI feature status |
| `POST /api/ai/translate-text-fields` | Bilingual text field translation helper |
| `POST /api/events/extract` | Event extraction helper |
| `/api/events/session/*` | Event planning session |
| `/api/enrollments/session/*` | Enrollment session |
| `/api/reviews/session/*` | Review session |

Durable Object classes:

- `EventPlanningSession`
- `EnrollmentSession`
- `ReviewSession`

Durable Objects store temporary conversation and draft state. Final event, enrollment, and review records are committed by the frontend to the backend API after human review.

## Configuration

`wrangler.jsonc` defines:

| Setting | Purpose |
|---|---|
| `name` | Worker name, currently `app-ccalc` |
| `compatibility_date` | Worker compatibility date |
| `assets.directory` | Built frontend assets |
| `assets.run_worker_first` | API/image routes handled by Worker before assets |
| `API_PROXY_TARGET` | Backend API origin |
| `GEMINI_MODEL` | Gemini model override |
| `GEMINI_API_KEY` | Required Worker secret |
| `EVENT_SESSIONS` | Durable Object namespace |
| `ENROLLMENT_SESSIONS` | Durable Object namespace |
| `REVIEW_SESSIONS` | Durable Object namespace |
| `routes` | Custom domain routing |

Local AI session testing needs `cloudflare/speed-layer/.dev.vars`:

```env
GEMINI_API_KEY=your-gemini-api-key
```

Production needs the secret in Cloudflare:

```powershell
cd cloudflare/speed-layer
npx wrangler secret put GEMINI_API_KEY
```

## Privacy Rules

Do not add a shared edge cache path unless all users who can read that cache key are allowed to see exactly the same response.

Before caching a new API path, decide:

- Is it public, group-visible, member-visible, or user-specific?
- Does the response include private user-specific fields?
- Is the authorization mirror sufficient to protect a shared key?
- What mutation paths must invalidate it?
- Does the frontend already use ETag-based conditional reads for it?
- Should browser-facing cache remain `private, no-cache`?

Never cache private user-specific data in a public shared cache key.

## Local Development

From the frontend package:

```powershell
cd cloudflare/alife-app
npm run preview
```

This builds the frontend and starts Wrangler for the speed layer.

From the speed-layer package:

```powershell
cd cloudflare/speed-layer
npm run dev
```

## Verification Commands

```powershell
cd cloudflare/speed-layer
npm test
npm run build
npx wrangler deploy --dry-run --outdir dist/app_ccalc
```

Useful manual checks:

```powershell
curl -i https://ccalc.live/api/sermons
curl -i https://ccalc.live/api/pages/global
curl -i https://ccalc.live/api/ai/status
```

For protected routes, inspect:

- `x-alife-cache`
- `x-alife-authz`
- `Cache-Control`
- `Vary`
- `ETag`
