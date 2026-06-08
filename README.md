# Alife Church App

Full-stack church management application. Clean Architecture .NET backend on Azure Functions, React 19 PWA frontend served through Cloudflare Workers.

## Stack

| Layer | Technology |
|---|---|
| Backend | Azure Functions (.NET 10 Isolated Worker, Native AOT) |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS (PWA) |
| Database | SQL Server 2022 (Docker) |
| Edge | Cloudflare Workers (frontend proxy, images API) |
| Auth | LINE Login OAuth → JWT in HttpOnly cookie (`alife_auth`) |
| Caching | .NET 10 HybridCache |
| API Docs | Swagger/OpenAPI (`/api/swagger/v1/swagger.json`) |

## Repository Layout

```
backend/
  Alife.sln               # .NET solution
  src/
    Alife.Domain/          # Entities, enums — no dependencies
    Alife.Application/     # Use cases, commands, queries, DTOs
    Alife.Infrastructure/  # Data access, migrations, services, security
    Alife.Api/             # Azure Functions host, controllers, HTTP layer
    Alife.DbMigrator/      # Database migration + seed runner
  tests/
    Alife.Tests.Unit/
  docker-compose.yml       # Local SQL Server and supporting services
cloudflare/
  alife-app/               # React 19 SPA
  images-api/              # Cloudflare Worker for image proxy/resize
  speed-layer/             # Cloudflare Worker edge proxy & compute layer
docs/
  architecture.md
global.json                # .NET SDK version pin
```

## Prerequisites

- .NET SDK 10.0.x
- Node.js 20+
- Docker Desktop
- Wrangler CLI (`npm install -g wrangler`) — for Cloudflare Workers

## Local Setup

### 1) Start SQL Server

```bash
cd backend
docker compose up -d sqlserver
```

SQL Server is available at `localhost,14333`.

### 2) Apply migrations and seed

```bash
cd backend
dotnet run --project src/Alife.DbMigrator
```

### 3) Run the API

```bash
dotnet run --project backend/src/Alife.Api
```

| Endpoint | URL |
|---|---|
| Local base | `http://localhost:7071` |
| Health check | `GET /health` |
| OpenAPI (dev) | `GET /api/swagger/v1/swagger.json` |
| Swagger UI (dev) | `GET /api/help` |

### 4) Run the frontend

```bash
cd cloudflare/alife-app
npm install
npm run dev         # Vite dev server  → http://localhost:5173
```

For Vite local development, `/api/*` is proxied to the Functions host by `vite.config.ts`.
Set `API_PROXY_TARGET` only when the API is not running on `http://localhost:7071`.

For production builds, copy `.env.example` to `.env` and set `VITE_API_BASE_URL` when the frontend should call a separate API origin:

```env
VITE_API_BASE_URL=http://localhost:7071
```

To run through the Cloudflare Worker proxy locally (port 8788):

```bash
npm run preview     # build + wrangler dev
```

The Worker AI session routes require a Gemini key. For local Worker runs, create
`cloudflare/speed-layer/.dev.vars` with:

```env
GEMINI_API_KEY=your-gemini-api-key
```

For production, configure the deployed Worker secret before manual deploys:

```bash
cd cloudflare/speed-layer
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

GitHub Actions deploys read the same value from the repository secret
`GEMINI_API_KEY` and upload it during `wrangler deploy`.

## Authentication

- LINE Login OAuth flow ends at `/api/members/line/callback`.
- Backend issues a JWT stored in HttpOnly cookie `alife_auth` (XSS-immune).
- JwtBearer reads the token from the cookie automatically.
- JWT is minimal (`sub`, `exp`); group roles and permissions are DB-checked per request.
- API returns `401`/`403` status codes; no auth redirects.

## Caching

- `HybridCache` (.NET 10) with stampede protection is used in:
  - Member profile (`/api/me`)
  - Group, page, event, and sermon read services
  - Group, page, event, and sermon cache invalidation services

## AI Session Workflows

- Cloudflare Durable Objects back the event planning, enrollment, and review chat sessions.
- Session routes are exposed under `/api/events/session/*`, `/api/enrollments/session/*`, and `/api/reviews/session/*`.
- Completed enrollment and review drafts are committed through backend REST endpoints under `/api/events/{eventId}/enrollments` and `/api/events/{eventId}/reviews`.

## Key Configuration

Backend settings (environment variables or `local.settings.json` for Functions):

| Key | Notes |
|---|---|
| `ConnectionStrings__Default` | e.g. `Server=localhost,14333;...` |
| `Jwt__Issuer`, `Jwt__Audience`, `Jwt__Key` | JWT signing |
| `LineLogin__ClientId`, `LineLogin__ClientSecret`, `LineLogin__RedirectUri` | LINE OAuth |
| `Frontend__BaseUrl` | CORS / redirect target |

## Useful Commands

```bash
# Backend — restore / build / test
dotnet restore backend/Alife.sln
dotnet build  backend/Alife.sln -c Debug
dotnet test   backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Debug

# Backend — release publish (Native AOT)
dotnet publish backend/src/Alife.Api --configuration Release

# Frontend — build + deploy to Cloudflare (delegates to speed-layer under the hood)
cd cloudflare/alife-app
npm run deploy

# Speed Layer — build + run tests
cd cloudflare/speed-layer
npm test

# Run API directly from backend folder
cd backend/src/Alife.Api
dotnet run
```

## Notes

- Configure LINE login and JWT secrets with real values for non-local environments.

## Configuration

### LINE Login

| Setting | Required | Description |
|---|---|---|
| `LineLogin:ClientId` | Yes | LINE Login channel client ID |
| `LineLogin:ClientSecret` | Yes | LINE Login channel secret |
| `LineLogin:RedirectUri` | Yes | Backend callback URI for LINE OAuth |
| `Frontend:BaseUrl` | Yes | Frontend base URL used for callback redirects |
