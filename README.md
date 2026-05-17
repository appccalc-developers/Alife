# Alife Church App

Full-stack church management application. Clean Architecture .NET backend on Azure Functions, React 19 PWA frontend deployed to Azure Static Web Apps / Cloudflare Workers.

## Stack

| Layer | Technology |
|---|---|
| Backend | Azure Functions (.NET 10 Isolated Worker, Native AOT) |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS (PWA) |
| Database | SQL Server 2022 (Docker) |
| Edge | Cloudflare Workers (frontend proxy, images API) |
| Auth | LINE Login OAuth → JWT in HttpOnly cookie (`alife_auth`) |
| Caching | .NET 10 HybridCache |
| API Docs | Swagger/OpenAPI (`/swagger/v1/swagger.json`) |

## Repository Layout

```
backend/
  src/
    Alife.Domain/          # Entities, enums — no dependencies
    Alife.Application/     # Use cases, commands, queries, DTOs
    Alife.Infrastructure/  # Data access, migrations, services, security
    Alife.Api/             # Azure Functions host, controllers, HTTP layer
    Alife.DbMigrator/      # Database migration + seed runner
  tests/
    Alife.Tests.Unit/
cloudflare/
  images-api/              # Cloudflare Worker for image proxy/resize
frontend/
  alife-app/               # React 19 SPA + Cloudflare Worker proxy
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
| OpenAPI (dev) | `GET /swagger/v1/swagger.json` |

### 4) Run the frontend

```bash
cd frontend/alife-app
npm install
npm run dev         # Vite dev server  → http://localhost:5173
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL`:

```env
VITE_API_BASE_URL=http://localhost:7071
```

To run through the Cloudflare Worker proxy locally (port 8788):

```bash
npm run preview     # build + wrangler dev
```

## Authentication

- LINE Login OAuth flow ends at `/api/auth/line/callback`.
- Backend issues a JWT stored in HttpOnly cookie `alife_auth` (XSS-immune).
- JwtBearer reads the token from the cookie automatically.
- JWT is minimal (`sub`, `exp`); group roles and permissions are DB-checked per request.
- API returns `401`/`403` status codes; no auth redirects.

## Caching

- `HybridCache` (.NET 10) with stampede protection is used in:
  - Member profile (`/api/me`)
  - Group and page read services
  - Group/page cache invalidation services

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

# Frontend — build + deploy to Cloudflare
cd frontend/alife-app
npm run deploy

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
