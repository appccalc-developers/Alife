## Plan: Alife Azure Subscription Setup

Prepare a repeatable, low-risk setup for the Azure side of Alife: Azure Functions API, Azure SQL, deployment identity, app settings, and migration/smoke-test readiness. The Cloudflare Worker frontend, image proxy, and Durable Object AI sessions remain in Cloudflare and should be configured separately through Wrangler.

## Target Architecture

- Backend API: Azure Functions isolated worker, .NET 10.
- Database: Azure SQL, migrated by `backend/src/Alife.DbMigrator`.
- Frontend/edge: Cloudflare Worker in `frontend/alife-app/worker/index.ts`.
- AI sessions: Cloudflare Durable Objects for events, enrollments, and reviews.
- Auth: JWT in HttpOnly cookie issued by the backend.

## Steps

1. Confirm Azure resource naming, region, tags, and environment names.
2. Provision or select the resource group.
3. Create Azure SQL logical server and database.
4. Create the Azure Functions app and supporting storage account.
5. Configure GitHub OIDC federated credentials for this repository.
6. Assign least-privilege RBAC for the deployment identity at resource-group scope.
7. Add environment-scoped GitHub secrets or variables for Azure subscription, tenant, client, resource group, Function App name, and SQL connection.
8. Configure Function App settings:
   - `ConnectionStrings__Default`
   - `Jwt__Issuer`
   - `Jwt__Audience`
   - `Jwt__Key`
   - `Frontend__BaseUrl`
   - `LineLogin__ClientId`
   - `LineLogin__ClientSecret`
   - `LineLogin__RedirectUri`
   - YouTube settings used by sermon sync
9. Run `Alife.DbMigrator` against the target SQL database.
10. Deploy the API and validate startup.
11. Configure Cloudflare `API_PROXY_TARGET` to the deployed API origin.
12. Run smoke tests for health, login/session, one protected group action, page read/write, sermon list, and AI enrollment/review commit paths where Gemini is configured.

## Relevant Files

- `backend/Alife.sln`
- `backend/src/Alife.Api/Program.cs`
- `backend/src/Alife.Api/ApiHttpPipeline.cs`
- `backend/src/Alife.Api/appsettings.json`
- `backend/src/Alife.Api/local.settings.json`
- `backend/src/Alife.DbMigrator/Program.cs`
- `backend/src/Alife.Infrastructure/Persistence/Migrations/`
- `frontend/alife-app/wrangler.jsonc`
- `frontend/alife-app/worker/index.ts`

## Verification

1. OIDC login succeeds in GitHub Actions.
2. Azure resource inventory contains the Function App, storage account, SQL server, and SQL database.
3. Migration completes and `__EFMigrationsHistory` contains the latest migration.
4. `GET /health` returns healthy.
5. `GET /api/swagger/v1/swagger.json` returns the OpenAPI document in development.
6. Cloudflare Worker can proxy `/api/*` to the Azure Functions API.
7. Auth cookie works through the deployed frontend/API topology.

## Decisions To Confirm

- Environment names and production ownership.
- Whether SQL firewall uses explicit runner/app egress allowlisting or private networking.
- Secret owner and rotation cadence.
- Whether migration is automatic in CI/CD or manually approved per release.
- Whether preview environments should use separate Azure SQL databases or shared non-production data.
