# Alife Backend

REST API for Alife Church App, now running on .NET 10.

## Key Updates

- Target framework upgraded to `net10.0` for all backend projects.
- Built-in OpenAPI is used (`/openapi/v1.json` in Development).
- Swashbuckle/Swagger UI is removed.
- Caching moved to HybridCache in read/invalidation paths.
- API auth challenge/forbidden handling returns status codes for frontend API calls.
- Dockerfile moved to .NET 10 + Ubuntu chiseled runtime.

## Backend Structure

```text
src/
  Alife.Domain/
  Alife.Application/
  Alife.Infrastructure/
  Alife.Api/
  Alife.DbMigrator/
tests/
  Alife.Tests.Unit/
```

## Prerequisites

- .NET SDK 10.0.x
- Docker Desktop

## Quick Start

### 1) Start SQL Server

```bash
cd backend
docker compose up -d sqlserver
```

### 2) Apply migration + seed

```bash
dotnet run --project src/Alife.DbMigrator
```

### 3) Run API

From repository root:

```bash
dotnet run --project backend/src/Alife.Api --launch-profile http
```

Default launch URL: `http://localhost:5097`

## Endpoints

- Health: `GET /health`
- OpenAPI (Development): `GET /openapi/v1.json`
- Auth, Groups, Members, Pages, Sections, Admin are under `/api/*`

## Configuration

### Development settings

`src/Alife.Api/appsettings.Development.json` includes local placeholders so startup validation succeeds:

- Connection string (local SQL at `localhost,14333`)
- Twilio section placeholders (`Twilio:AccountSid`, `Twilio:AuthToken`, `Twilio:VerifyServiceSid`, `Twilio:Channel`)

Override via environment variables or secrets for real environments.

### Important settings

- `ConnectionStrings:Default`
- `Jwt:Issuer`, `Jwt:Audience`, `Jwt:Key`
- `Frontend:BaseUrl`
- `Twilio:*`

## Authentication

- JWT token is stored in HttpOnly cookie `alife_auth`.
- JwtBearer reads token from cookie.
- API returns proper `401`/`403` status codes for frontend API requests.

## Caching

- `HybridCache` is used in:
  - Member profile (`/api/me`)
  - Group and page read services
  - Group/page cache invalidation services
- Source-level `IMemoryCache` and `AddMemoryCache()` usage were removed.

## Static Assets + SPA

- `MapStaticAssets()` serves backend static assets.
- SPA fallback is mapped for non-API routes.
- Frontend `dist` is copied into API output/publish as static assets when present.
- A source `wwwroot` folder exists to prevent startup errors when dist is missing.

## Build/Test

```bash
dotnet restore backend/Alife.sln
dotnet build backend/Alife.sln -c Debug
dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Debug
```

## Docker

- Build image: `mcr.microsoft.com/dotnet/sdk:10.0`
- Runtime image: `mcr.microsoft.com/dotnet/aspnet:10.0-jammy-chiseled`

### Docker Compose with Caddy (HTTPS)

`backend/docker-compose.yml` includes a `caddy` reverse proxy in front of `alife-api`:

- `https://{CADDY_SITE_ADDRESS}` -> `alife-api:8080`
- Defaults to `https://localhost` when `CADDY_SITE_ADDRESS` is not set.

Start stack:

```bash
cd backend
docker compose up -d --build
```

## Troubleshooting

- Port busy: stop existing `Alife.Api` process before rerun.
- SQL errors: verify SQL container on `localhost,14333`.
- Twilio validation errors: provide `Twilio:*` config values.
