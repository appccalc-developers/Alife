# alife-church-app

Alife is a full-stack church management MVP with a .NET 10 backend and a Vue 3 frontend.

## Current Stack

- Backend: .NET 10 (Clean Architecture)
- Frontend: Vue 3 + TypeScript + Vite + Pinia + Tailwind
- Database: SQL Server 2022 (Docker)
- API auth: JWT in HttpOnly cookie (`alife_auth`)
- API docs: built-in OpenAPI endpoint (`/openapi/v1.json`)

## Repository Layout

- `backend/src/Alife.Domain`
- `backend/src/Alife.Application`
- `backend/src/Alife.Infrastructure`
- `backend/src/Alife.Api`
- `backend/src/Alife.DbMigrator`
- `backend/tests/Alife.Tests.Unit`
- `frontend/alife-web`
- `docs/architecture.md`
- `global.json` (SDK pin for .NET 10)

## Prerequisites

- .NET SDK 10.0.x
- Node.js 20+
- Docker Desktop

## Local Setup

### 1) Start SQL Server

```bash
cd backend
docker compose up -d sqlserver
```

SQL Server host port: `localhost,14333`

### 2) Apply migrations and seed

```bash
cd backend
dotnet run --project src/Alife.DbMigrator
```

### 3) Run API

From repo root:

```bash
dotnet run --project backend/src/Alife.Api --launch-profile http
```

Default launch profile URL: `http://localhost:5097`

Health endpoint:

```text
GET /health
```

OpenAPI document in development:

```text
GET /openapi/v1.json
```

### 4) Run frontend

```bash
cd frontend/alife-web
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`

## Auth + API Behavior

- Frontend uses `withCredentials: true` in Axios.
- Backend reads JWT from `alife_auth` cookie in `JwtBearer` events.
- API endpoints return status codes (401/403) rather than auth redirects.
- Identity source is JWT `sub`; permissions are DB-checked per request.

## Caching

- Read and invalidation services are on `.NET 10 HybridCache`.
- Members `/api/me` now uses HybridCache with stampede protection.
- Legacy `AddMemoryCache()` usage was removed from source.

## Useful Commands

```bash
# Restore/build/test backend
dotnet restore backend/Alife.sln
dotnet build backend/Alife.sln -c Debug
dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Debug

# Run API directly from backend folder
cd backend/src/Alife.Api
dotnet run
```

## Notes

- Development Twilio placeholders exist in `appsettings.Development.json` so options validation passes locally.
- Replace Twilio and JWT secrets with real values for non-local environments.

## Configuration

### Twilio SMS Verification

| Setting | Required | Description |
|---|---|---|
| `Twilio:AccountSid` | Yes (unless Skip enabled) | Twilio Account SID |
| `Twilio:AuthToken` | Yes (unless Skip enabled) | Twilio Auth Token |
| `Twilio:VerifyServiceSid` | Yes (unless Skip enabled) | Twilio Verify Service SID |
| `Twilio:Channel` | No (default: `sms`) | Delivery channel: `sms`, `whatsapp`, or `call` |
| `Twilio:Skip` | No (default: unset/disabled) | Set to `1` or `true` to bypass Twilio entirely (dev/test only) |

When `Twilio:Skip` is `1` or `true`, all phone numbers and verification codes are accepted as valid without calling Twilio APIs. This is intended for development and testing only — do **not** enable in production.
