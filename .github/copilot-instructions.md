# Project Guidelines

## Scope
- This workspace is currently backend-first for agent tasks.
- Default to changes under `backend/` and backend-related docs.
- Do not modify `frontend/` unless the user explicitly asks.

## Build And Test
- Preferred working directory for backend tasks: `backend/`.
- Restore solution: `dotnet restore Alife.sln`
- Build solution: `dotnet build Alife.sln -c Debug`
- Run unit tests: `dotnet test tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Debug`
- Start local SQL Server: `docker compose up -d sqlserver`
- Apply migrations and seed: `dotnet run --project src/Alife.DbMigrator`
- Run API (from repo root): `dotnet run --project backend/src/Alife.Api --launch-profile http`

## Architecture
- Backend follows Clean Architecture:
  - `Alife.Domain`: entities and enums only (no dependencies)
  - `Alife.Application`: CQRS handlers and business logic
  - `Alife.Infrastructure`: EF Core, persistence, integrations, read services, security
  - `Alife.Api`: HTTP layer and composition root
  - `Alife.DbMigrator`: migration and seed runner
- Dependency direction:
  - `Api -> Application + Infrastructure`
  - `Infrastructure -> Application + Domain`
  - `Application -> Domain`

## Conventions
- Use MediatR CQRS style in application layer:
  - Commands/queries are records and return `AppResult<T>`.
  - Handlers implement `IRequestHandler<TRequest, AppResult<T>>`.
- In controllers, map application outcomes through `ToActionResult(...)`.
- Keep file names aligned with primary type names.
- Use DI extension methods for wiring (`AddApplication()`, `AddInfrastructure(...)`).
- Keep C# naming in PascalCase; DB naming is snake_case via EF convention.

## Configuration And Security
- Required settings for normal backend operation:
  - `ConnectionStrings:Default`
  - `Jwt:Issuer`, `Jwt:Audience`, `Jwt:Key`
  - `Frontend:Origin`
  - `Twilio:*` (AccountSid, AuthToken, VerifyServiceSid, Channel)
- JWT is read from HttpOnly cookie `alife_auth`.
- Authorization is role-checked from DB per request; do not assume JWT carries roles.

## Common Gotchas
- SQL Server runs on `localhost,14333` in local Docker setup.
- Twilio options are validated at startup in infrastructure; missing values can fail startup.
- For Azure SQL / Entra auth connections, db auto-create is intentionally skipped by migrator.
- CORS issues usually mean `Frontend:Origin` mismatch.

## References
- Backend setup and commands: `README.md`, `backend/README - backend.md`
- Architecture details and API model: `docs/architecture.md`
- Composition root and middleware: `backend/src/Alife.Api/Program.cs`
- Service registration: `backend/src/Alife.Application/DependencyInjection.cs`, `backend/src/Alife.Infrastructure/DependencyInjection.cs`
- Result mapping pattern: `backend/src/Alife.Application/Common/Models/AppResult.cs`, `backend/src/Alife.Api/Results/AppResultExtensions.cs`