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
| Auth | LINE Login OAuth or dev/admin flows -> JWT in HttpOnly cookie `alife_auth` |
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

The Vite dev server runs at `http://localhost:5173`. In development, `/api/*` is proxied to `http://localhost:7071` by default. Override with `API_PROXY_TARGET` when needed.

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
```

Production deploys also require the Worker secret:

```powershell
cd cloudflare/speed-layer
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

## Main Features In The Current Code

- Member identity through LINE Login, display-name login, and dev/admin flows.
- JWT authentication stored in the HttpOnly `alife_auth` cookie.
- Hierarchical church/group model with public, protected, and private access types.
- Group membership workflows: request, invite, accept, decline, approve, reject, co-leader assignment, kick, subgroup creation, and subgroup co-leader claim.
- Bilingual group and page content using JSON-shaped localized text.
- Page builder with global/group pages, draft/group/public visibility, structured sections, and link metadata.
- Sermon listing and admin-triggered YouTube sermon synchronization.
- Group events with enrollment and review APIs.
- Notification messages with read and reply workflows.
- AI-assisted event planning, enrollment, and review sessions through Cloudflare Durable Objects.
- R2-backed image API for image listing, upload, deletion, and streaming.

## Authentication And Authorization

- LINE OAuth callback lands at `/api/members/line/callback`.
- The backend issues a JWT in the HttpOnly cookie `alife_auth`.
- JwtBearer middleware reads the token from the cookie automatically.
- JWT claims are intentionally minimal. Group roles and permissions are checked against current data.
- Protected APIs return `401` or `403`; they do not redirect browser clients.

## Caching

Alife deliberately uses multiple cache layers:

- Backend `HybridCache` for member, group, page, event, and sermon read services.
- Cloudflare speed layer cache for safe public responses, authorized group-shared responses, member profile responses, ETags, and passive mutation invalidation.
- Frontend IndexedDB ETag cache through `conditionalGet`.
- PWA runtime caching for app assets, images, and fonts. API responses are intentionally excluded from the PWA runtime cache so auth and permission changes are not replayed incorrectly.

Private user-specific data must not be stored in shared public caches.

## Key API Areas

| Area | Representative routes |
|---|---|
| Auth/session | `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/dev/admin`, `GET /api/me` |
| LINE/member | `GET /api/members/line/login`, `GET /api/members/line/callback`, `POST /api/members/register` |
| Groups | `GET /api/groups/church`, `GET /api/groups/{id}`, `POST /api/groups/{id}/join-request` |
| Group management | `POST /api/groups/{id}/subgroups`, `POST /api/groups/{id}/approve`, `POST /api/groups/{id}/set-coleader` |
| Pages | `GET /api/pages/global`, `GET /api/groups/{groupId}/pages`, `POST /api/groups/{groupId}/pages`, `PUT /api/pages/{id}` |
| Events | `GET /api/groups/{groupId}/events`, `POST /api/groups/{groupId}/events`, `PUT /api/events/{id}` |
| Enrollments/reviews | `GET/POST /api/events/{eventId}/enrollments`, `GET/POST /api/events/{eventId}/reviews` |
| Notifications | `GET/POST /api/notifications`, `POST /api/notifications/{id}/reply`, `POST /api/notifications/{id}/read` |
| Admin | `POST /api/admin/sermons/sync`, `POST /api/admin/groups/{groupId}/cloudflare-cache/refresh` |
| AI sessions | `/api/events/session/*`, `/api/enrollments/session/*`, `/api/reviews/session/*` |

## Configuration

Backend settings can be supplied through environment variables, user secrets, or `local.settings.json` for Azure Functions.

| Key | Notes |
|---|---|
| `ConnectionStrings__Default` | SQL Server connection string |
| `Jwt__Issuer`, `Jwt__Audience`, `Jwt__Key`, `Jwt__KeyId` | JWT signing and validation |
| `LineLogin__ClientId`, `LineLogin__ClientSecret`, `LineLogin__RedirectUri` | LINE OAuth |
| `Frontend__BaseUrl` | Frontend redirect/CORS base URL |
| `Youtube__ApiKey`, `Youtube__PlaylistId` | Sermon sync integration, where configured |
| `Cloudflare__ApiToken`, `Cloudflare__AccountId`, `Cloudflare__NamespaceId` | Cloudflare cache refresh support, where configured |

Frontend and Worker settings:

| Key | Location | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `cloudflare/alife-app/.env` | Production API origin when not same-origin |
| `API_PROXY_TARGET` | Vite env or `cloudflare/speed-layer/wrangler.jsonc` | Origin API target |
| `IMAGES_PROXY_TARGET` | Vite env | Image proxy target for local Vite |
| `GEMINI_API_KEY` | `cloudflare/speed-layer/.dev.vars` or Worker secret | Required for AI session routes |
| `GEMINI_MODEL` | `cloudflare/speed-layer/wrangler.jsonc` | Optional Gemini model override |

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
