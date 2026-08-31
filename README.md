# Alife Church App

Alife is an alpha-stage community and church group platform for overseas Chinese Christian communities. It brings together group membership, bilingual pages, sermons, events, notifications, image handling, and AI-assisted event workflows in a mobile-friendly web app.

The codebase is split into a .NET Azure Functions API, a React PWA, Cloudflare Workers for the edge layer, and SQL Server persistence.

## Stack

| Layer | Technology |
|---|---|
| Backend | Azure Functions v4, .NET 10 isolated worker, ASP.NET Core controllers |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, PWA |
| Frontend data | TanStack Query, TanStack React DB, IndexedDB-backed ETag cache |
| Database | SQL Server 2022 locally, Azure SQL-compatible schema |
| Edge | Cloudflare Workers for app hosting, API proxying, edge cache, AI sessions, and image services |
| Auth | Discoverable Passkeys (primary), LINE Login compatibility, and gated internal Alpha sessions -> JWT in HttpOnly cookie `alife_auth` |
| Backend cache | .NET HybridCache read services and invalidation services |
| API docs | Swagger/OpenAPI at `/api/swagger/v1/swagger.json` in development |

## Repository Layout

```text
backend/
  Alife.sln
  src/
    Alife.Domain/          Entities and enums
    Alife.Application/     Use cases, commands, queries, DTOs, service interfaces
    Alife.Infrastructure/  EF Core, migrations, read services, integrations, security
    Alife.Api/             Azure Functions host, controllers, HTTP pipeline
    Alife.DbMigrator/      Migration and seed runner
  tests/
    Alife.Tests.Unit/
  docker-compose.yml       Local SQL Server

cloudflare/
  alife-app/               React 19 PWA
  speed-layer/             Cloudflare Worker for app assets, API proxy, edge cache, AI sessions
  images-api/              Cloudflare Worker for R2-backed image API

docs/
  architecture.md
  alife-*.md

global.json                .NET SDK version pin
```

## Prerequisites

- .NET SDK 10.0.x
- Node.js 20+
- Docker Desktop
- Wrangler CLI, or use `npx wrangler` from the relevant `cloudflare/*` package

## Local Setup

### One-command local dev

From the repository root, use the Windows wrapper when you want the normal local test stack:

```powershell
.\alife-dev.cmd -SkipSql
```

That starts `backend/src/Alife.Api`, `cloudflare/images-api`, `cloudflare/speed-layer`, and `cloudflare/alife-app`. The images API reuses the local R2 state under `.local-dev/images-wrangler`, and the Vite app serves those objects through stable `/images/...` paths. Azurite and scheduled Functions are skipped for the normal UI/API workflow. Use `-SkipSql` when Docker Desktop has already started the SQL Server container. When the database schema or seed data needs refreshing, run:

```powershell
.\alife-dev.cmd -SkipSql -ApplyMigrations
```

With `-ApplyMigrations -SkipSql`, the script still waits for the existing SQL Server container to become healthy before running `Alife.DbMigrator`.

Useful options:

```powershell
.\alife-dev.cmd                         # also starts the SQL Server container
.\alife-dev.cmd -SkipSql -UseAzurite     # also start local Azure Storage emulator
.\alife-dev.cmd -SkipImagesApi           # skip the local images worker
.\alife-dev.cmd -SkipSpeedLayer          # API + Vite only
.\alife-dev.cmd -RebuildFrontendAssets   # rebuild dist before starting speed-layer
```

To test Passkeys from a phone, expose the Vite origin through a trusted HTTPS tunnel, then restart the stack with that exact origin:

```powershell
cloudflared tunnel --url http://localhost:5173
# Copy the generated HTTPS URL from the previous terminal, then run:
.\alife-dev.cmd -SkipSql -MobilePasskeyOrigin https://example.trycloudflare.com
```

Open that HTTPS URL on the phone. The option sets the backend WebAuthn RP ID and allowed origin to the tunnel host and adds only that host to Vite's development allowlist. It does not start or manage the tunnel. Quick Tunnel hostnames change when restarted, so use a named stable tunnel for credentials that must remain reusable across sessions. Treat any tunnel URL as public and stop `cloudflared` after testing.

Azurite is skipped by default because the regular UI/API local workflow does not need local Azure Storage. The backend has a `SermonSync` TimerTrigger, so scheduled Functions are disabled by default. To test scheduled jobs locally, install Azurite once and run:

```powershell
npm install -g azurite
.\alife-dev.cmd -SkipSql -UseAzurite -EnableScheduledJobs
```

The script writes service logs under `.local-dev/logs`. The local URLs are:

| Service | URL |
|---|---|
| Frontend Vite app | `http://localhost:5173` |
| Cloudflare speed layer | `http://localhost:8787` |
| Cloudflare images API | `http://127.0.0.1:8788` |
| Azure Functions API | `http://127.0.0.1:7071` |

### 1. Start SQL Server

```powershell
cd backend
docker compose up -d sqlserver
```

SQL Server listens on `localhost,14333`. The default local password is configured in `backend/docker-compose.yml`.

### 2. Apply Migrations And Seed Data

```powershell
cd backend
dotnet run --project src/Alife.DbMigrator
```

### 3. Run The API

```powershell
dotnet run --project backend/src/Alife.Api
```

| Endpoint | URL |
|---|---|
| Local base | `http://localhost:7071` |
| Health | `GET /health` |
| Liveness | `GET /health/live` |
| Readiness | `GET /health/ready` |
| OpenAPI | `GET /api/swagger/v1/swagger.json` |
| Swagger UI | `GET /api/help` |

### 4. Run The Frontend

```powershell
cd cloudflare/alife-app
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:5173`. In development, `/api/*` is proxied to `http://127.0.0.1:7071` by default. Override with `API_PROXY_TARGET` when needed.

The local Vite server also proxies `/images/*` to `https://images.ccalc.live` by default. Override with `IMAGES_PROXY_TARGET` if you run the image Worker locally.

### 5. Run Through The Cloudflare Speed Layer

```powershell
cd cloudflare/alife-app
npm run preview
```

`npm run preview` builds the frontend and starts `cloudflare/speed-layer` through Wrangler. The speed layer serves `cloudflare/alife-app/dist`, proxies `/api/*`, routes `/images/*`, applies edge caching, and owns AI session Durable Object routes.

For local AI session testing, create `cloudflare/speed-layer/.dev.vars`:

```env
GEMINI_API_KEY=your-gemini-api-key
CACHE_SYNC_API_TOKEN=your-high-entropy-cache-sync-token
```

Production deploys also require the Worker secret:

```powershell
cd cloudflare/speed-layer
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put CACHE_SYNC_API_TOKEN
npx wrangler deploy
```

## Main Features In The Current Code

- Member identity through discoverable Passkeys, explicit LINE Login compatibility, one-time church activation links, and configuration-gated internal Alpha accounts.
- Passkeys are created from activation or Profile only on a personal mobile device. Desktop authentication prefers WebAuthn hybrid transport so the browser can show a QR for approval with the phone Passkey; no Passkey is created on the computer.
- JWT authentication stored in the HttpOnly `alife_auth` cookie, with `amr`, `auth_time`, and `session_kind` claims distinguishing standard, public-device, and Alpha sessions.
- A unified `/onboarding` flow preserves only validated same-site return paths and resumes activation, QR application, or anonymous reply context through a short-lived HttpOnly cookie.
- Hierarchical church/group model with public, protected, and private access types.
- Group membership workflows: request, invite, accept, decline, approve, reject, co-leader assignment, kick, subgroup creation, and subgroup co-leader claim.
- Bilingual group and page content using JSON-shaped localized text.
- Page builder with group-owned working pages, draft/group/public visibility, structured sections, and separate submitted and published snapshots.
- Sermon listing and admin-triggered YouTube sermon synchronization.
- Group events with enrollment and review APIs.
- Notification messages with read and reply workflows.
- AI-assisted event planning, enrollment, and review sessions through Cloudflare Durable Objects.
- R2-backed image API for image listing, upload, deletion, and streaming.

## Authentication And Authorization

- `/onboarding` starts username-less WebAuthn authentication with user verification. ALIFE stores public keys and credential metadata, never device PINs or biometric data.
- Passkey failures return a stable public error code and trace reference. Server logs retain only the controlled ceremony stage, exception type, Fido2 verification category, and that reference. Known-credential Fido2 verification failures also persist those same fixed fields in the existing restricted audit store so diagnostics remain available when platform telemetry is unavailable. Raw credentials, member identifiers, challenges, signatures, and exception messages are excluded. Browser requests time out after two minutes and cancellation-style browser errors are presented as an incomplete attempt rather than proof that the user cancelled.
- Standard Passkey and LINE sessions can last up to 30 days. Public-device sessions are non-persistent and last at most two hours; internal Alpha sessions are non-persistent and last at most twelve hours. A configured Alpha-only tester with no current or revoked Passkey can use an administrator-issued setup code to open a five-minute first-Passkey registration window; the code is permanently unavailable after any Passkey has existed, and ordinary Alpha sessions remain non-strong authentication.
- LINE OAuth is a compatibility path. Its server-side state is bound to the active onboarding flow; callbacks do not put profile PII in redirect URLs.
- Activation and QR links use `/activate/{selector}#{secret}` and `/join/{selector}#{signature}`. The fragment is exchanged in a request body and immediately removed from browser history.
- A group QR creates an application without access. A leader must explicitly attest that they verified the applicant and phone; approval materializes church/group membership and returns a one-time manual activation message when the member has no active Passkey. Authorized leaders copy the phone and message for manual delivery. Ambiguous existing-phone matches still require an explicit member link rather than automatic association.
- The backend issues a JWT in the HttpOnly cookie `alife_auth`.
- JwtBearer middleware reads the token from the cookie automatically.
- JWT claims are intentionally minimal. Group roles and permissions are checked against current data.
- Protected APIs return `401` or `403`; they do not redirect browser clients.
- The legacy arbitrary display-name/phone login route, `POST /api/members/login/account`, intentionally returns `404`.

## Caching

Alife deliberately uses multiple cache layers:

- Backend `HybridCache` for member, group, page, event, and sermon read services.
- Cloudflare speed layer cache for safe public responses, authorized group-shared responses, ETags, authorization mirrors, and passive mutation invalidation. Identity and member profile responses bypass the edge response cache.
- `/api/sermons` cache keys include the sorted query string so pagination variants cannot reuse incompatible payloads. Sermon entries use a five-minute edge TTL and the `alife-sermons` cache tag.
- Sermon sync performs the existing local Worker purge and, when `Cloudflare__ZoneId` and a Cache Purge-capable API token are configured, globally purges the `alife-sermons` tag across Cloudflare data centers.
- Frontend IndexedDB ETag cache through `conditionalGet`.
- PWA runtime caching for app assets, images, and fonts. API responses are intentionally excluded from the PWA runtime cache so auth and permission changes are not replayed incorrectly.

Private user-specific data must not be stored in shared public caches.
All identity ceremonies, onboarding flows, activations, applications, visitor requests, Alpha routes, management mutations, and personal tasks return `Cache-Control: no-store` and vary by cookie/authorization where appropriate.

## Key API Areas

| Area | Representative routes |
|---|---|
| Auth/session | `POST /api/auth/passkeys/authentication/*`, `POST /api/auth/logout`, `GET /api/me`, `GET/POST /api/me/passkeys/*` |
| Onboarding | `POST /api/onboarding/flows`, `POST /api/onboarding/resume`, activation/invite/application-response resolve and completion routes |
| LINE/member | `GET /api/members/line/login`, `GET /api/members/line/callback`, `POST /api/members/register` |
| Groups | `GET /api/groups/church`, `GET /api/groups/{id}`, `POST /api/groups/{id}/join-request` |
| Group management | `POST /api/groups/{id}/subgroups`, `POST /api/groups/{id}/approve`, `/api/groups/{id}/join-invite/*`, `/api/groups/{id}/membership-applications/*` |
| Pages | `GET /api/pages/global`, `GET /api/groups/{groupId}/pages`, `POST /api/groups/{groupId}/pages`, `PUT /api/pages/{id}` |
| Events | `GET /api/groups/{groupId}/events`, `POST /api/groups/{groupId}/events`, `PUT /api/events/{id}` |
| Enrollments/reviews | `GET/POST /api/events/{eventId}/enrollments`, `GET/POST /api/events/{eventId}/reviews` |
| Notifications | `GET/POST /api/notifications`, `POST /api/notifications/{id}/reply`, `POST /api/notifications/{id}/read` |
| Admin | `POST /api/admin/sermons/sync`, `POST /api/admin/groups/{groupId}/cloudflare-cache/refresh` |
| AI sessions | `/api/events/session/*`, `/api/enrollments/session/*`, `/api/reviews/session/*` |

## Configuration

Backend settings can be supplied through environment variables, user secrets, or `local.settings.json` for Azure Functions. The repository `/dev` launcher imports the ignored `backend/.env` into its child processes; explicit parent-process environment variables take precedence.

| Key | Notes |
|---|---|
| `ConnectionStrings__Default` | SQL Server connection string |
| `Jwt__Issuer`, `Jwt__Audience`, `Jwt__Key`, `Jwt__KeyId` | JWT signing and validation |
| `LineLogin__ClientId`, `LineLogin__ClientSecret`, `LineLogin__RedirectUri` | LINE OAuth |
| `Frontend__BaseUrl` | Frontend redirect/CORS base URL |
| `Passkeys__Enabled`, `Passkeys__RpId`, `Passkeys__RpName`, `Passkeys__Origins` | WebAuthn relying-party configuration. Missing/disabled configuration reports Passkeys unavailable. |
| `TokenProtection__SigningKey`, `RateLimiting__HashKey` | Independent high-entropy HMAC keys for one-time secret storage and rate-limit discriminators. Keep in a secret store. |
| `TrustedProxyNetworks` | Proxy CIDRs allowed to supply `CF-Connecting-IP`; untrusted callers use the direct peer address. |
| `AlphaLogin__Enabled`, `AlphaLogin__Accounts`, `AlphaLogin__PasskeyBootstrapCodes__<accountId>` | Internal Alpha whitelist (`accountId`, `memberId`, `label`) and optional per-account first-Passkey setup codes. Codes must be high-entropy secrets of at least 24 characters and must never be committed or logged. Disabled Alpha login returns `404`; explicit enablement is honored in every environment. Production currently provisions the setup code only for the whitelisted `Stephen` account. |
| `YOUTUBE_API_KEY`, `YOUTUBE_PLAYLIST_ID` | Sermon sync integration, where configured |
| `Cloudflare__ApiToken`, `Cloudflare__AccountId`, `Cloudflare__ZoneId`, `Cloudflare__AuthzNamespaceId`, `Cloudflare__ApiCacheNamespaceId` | Cloudflare KV mirror/cache refresh support, where configured. Global sermon invalidation requires the token's `Cache Purge` permission and the zone id. |
| `Cloudflare__SyncWorkerBaseUrl`, `Cloudflare__SyncApiToken` | Speed-layer cache purge endpoint, where configured. Production base URL is `https://ccalc.live`; token must match Worker `CACHE_SYNC_API_TOKEN`. |

Frontend and Worker settings:

| Key | Location | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `cloudflare/alife-app/.env` | Production API origin when not same-origin |
| `API_PROXY_TARGET` | Vite env or `cloudflare/speed-layer/wrangler.jsonc` | Origin API target |
| `IMAGES_PROXY_TARGET` | Vite env | Image proxy target for local Vite |
| `GEMINI_API_KEY` | `cloudflare/speed-layer/.dev.vars` or Worker secret | Required for AI session routes |
| `GEMINI_MODEL` | `cloudflare/speed-layer/wrangler.jsonc` | Optional Gemini model override |
| `CACHE_SYNC_API_TOKEN` | `cloudflare/speed-layer/.dev.vars` or Worker secret | Required for backend-triggered cache purge |

## Useful Commands

```powershell
# Backend
dotnet restore backend/Alife.sln
dotnet build backend/Alife.sln -c Debug
dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Debug
dotnet publish backend/src/Alife.Api/Alife.Api.csproj -c Release

# Frontend
cd cloudflare/alife-app
npm install
npm run build
npm run dev
npm run preview

# Speed layer
cd cloudflare/speed-layer
npm test
npm run deploy

# Image API Worker
cd cloudflare/images-api
npx wrangler deploy
```

## Notes For Maintainers

- Preserve the layered backend structure and keep authorization checks server-side.
- Keep bilingual fields as localized JSON structures where the code already uses them.
- Treat edge, backend, and frontend caches as separate layers with different privacy rules.
- For event enrollments, one member has one enrollment per event. For event reviews, multiple reviews per member are allowed.
- New work should be small, traceable, and easy to explain in a portfolio or handover context.
