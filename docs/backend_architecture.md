# Backend Architecture

## Purpose

The Alife backend is the authoritative application API for identity, group membership, page content, events, enrollments, reviews, notifications, sermons, and administrative operations. It is designed to keep business rules, authorization, persistence, and cache invalidation on the server side while exposing readable DTOs to the React PWA and Cloudflare speed layer.

The backend runs as an Azure Functions v4 isolated worker using .NET 10 and ASP.NET Core controllers.

## Runtime Stack

| Concern | Technology |
|---|---|
| Host | Azure Functions v4 isolated worker |
| HTTP API | ASP.NET Core controllers mapped through a catch-all Functions HTTP trigger |
| Language/runtime | C# / .NET 10 |
| Application pattern | Layered architecture with Domain, Application, Infrastructure, and Api projects |
| Persistence | EF Core with SQL Server / Azure SQL-compatible schema |
| Authentication | Discoverable Passkeys with LINE compatibility; JWT in HttpOnly cookie `alife_auth` |
| Authorization | Current database-backed member and group role checks |
| Backend cache | .NET HybridCache in read services and invalidation services |
| API documentation | Swagger/OpenAPI in development at `/api/swagger/v1/swagger.json` and `/api/help` |
| Observability | Application Insights worker telemetry |

## Project Layout

```text
backend/
  Alife.sln
  Dockerfile
  docker-compose.yml
  src/
    Alife.Domain/
      Entities/
      Enums/
    Alife.Application/
      Abstractions/
      Auth/
      Groups/
      Members/
      Pages/
      Sections/
      Events/
      Notifications/
      Sermons/
      Admin/
    Alife.Infrastructure/
      Persistence/
      ReadServices/
      Services/
      Security/
      Integrations/
      HostedServices/
    Alife.Api/
      Controllers/
      Security/
      Program.cs
      ApiHttpFunction.cs
      ApiHttpPipeline.cs
    Alife.DbMigrator/
  tests/
    Alife.Tests.Unit/
```

## Layer Responsibilities

### Alife.Domain

`Alife.Domain` contains persistence-neutral business entities and enums. It should not depend on infrastructure, HTTP, EF Core configuration, Cloudflare, LINE, YouTube, or UI concepts.

Key entity areas:

- `Member`
- `Group`
- `GroupMembership`
- `Page`
- `PagePublicationReview`
- `Section`
- `Link`
- `Sermon`
- `GroupEvent`
- `EventEnrollment`
- `EventReview`
- `NotificationMessage`

Key enum areas:

- `AccessType`
- `MembershipStatus`
- `MembershipRole`
- `PageVisibility`
- `SectionType`
- `LinkType`

### Alife.Application

`Alife.Application` owns use cases, DTOs, commands, queries, service interfaces, and application-level rules. It is the main place for feature behavior that should be testable without a concrete HTTP host.

Common patterns:

- Commands for mutations.
- Queries for reads.
- DTOs for frontend/API payloads.
- Interfaces for persistence, current identity, external integrations, read services, and cache invalidation.
- Explicit authorization checks for protected workflows.

Application code should prefer clear API-facing enum names and bilingual JSON-friendly DTO shapes where the feature already uses localized fields.

### Alife.Infrastructure

`Alife.Infrastructure` provides concrete implementations for database access, read services, cache services, security, and external integrations.

Main responsibilities:

- EF Core `AlifeDbContext`.
- SQL Server migrations and seed data.
- HybridCache-backed read services.
- Cache invalidation services.
- JWT token creation.
- LINE Login integration.
- YouTube sermon synchronization.
- Cloudflare cache refresh integration.
- Group authorization service implementation.

Infrastructure may know about EF Core and external APIs, but it should not contain controller routing or frontend-specific UI decisions.

### Alife.Api

`Alife.Api` is the HTTP boundary. It wires dependency injection, auth, JSON serialization, Swagger, CORS, health checks, and controller routing.

The checked-in host uses:

- `Program.cs` for Functions worker startup and service registration.
- `ApiHttpFunction.cs` as a catch-all HTTP trigger for `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, and `OPTIONS`.
- `ApiHttpPipeline.cs` to run an ASP.NET Core pipeline inside the Functions request.
- Controllers for grouped API areas.

The API layer should stay thin. It should translate HTTP requests to application commands/queries and return appropriate HTTP results.

### Alife.DbMigrator

`Alife.DbMigrator` applies database migrations and seed data. It is used locally and can be run in deployment workflows before the API starts serving traffic.

## HTTP Pipeline

The Functions entry point receives all paths and forwards the request through an ASP.NET Core pipeline:

```text
Azure Functions HTTP trigger
  -> ApiHttpFunction
  -> ApiHttpPipeline
  -> UseRouting
  -> Swagger / Swagger UI
  -> CORS policy "Frontend"
  -> Authentication
  -> Authorization
  -> Health endpoints and controllers
```

Authentication and authorization happen before controller actions execute.

## Authentication And Identity Entry

Alife stores the JWT in the HttpOnly cookie `alife_auth`. The backend configures JwtBearer authentication to read the token from that cookie.

Typical flow:

```text
Member opens /onboarding
  -> backend binds intent and a safe return path to a short-lived flow cookie
  -> WebAuthn validates a discoverable credential with user verification
  -> backend issues JWT with amr, auth_time, and session_kind
  -> JWT is stored in HttpOnly alife_auth cookie
  -> future API requests include the cookie
  -> JwtBearer validates issuer, audience, expiry, algorithm, and signing key
  -> CurrentMemberAccessor resolves the current member from the subject claim
```

Protected API calls return `401` or `403`; they do not redirect browser clients.

`IPasskeyService` isolates Fido2 4.0.1 in Infrastructure. Ceremonies expire after five minutes and are consumed once. Authentication failures keep the stable API code `passkey_verification_failed`, include the ASP.NET trace identifier in Problem Details, and log only the controlled completion stage, exception type, Fido2 verification category, and sanitized trace identifier. Known-credential `Fido2VerificationException` failures at `verify_assertion` persist those same fixed fields in the restricted `AuditLog` store as a telemetry-independent fallback; the row has no actor, member, credential, IP, or user-agent association. Raw assertions, credential IDs, challenges, exception messages, and ceremony options are not logged or audited. Standard sessions can persist for 30 days; public-device sessions are non-persistent and last at most two hours; internal Alpha sessions are non-persistent and last at most twelve hours. Ordinary Alpha sessions do not satisfy recent strong authentication. A whitelisted Alpha-only tester who has never had a Passkey may supply a configured high-entropy setup code to receive `amr=alpha_bootstrap`; this allows only the existing five-minute registration window, remains a non-persistent Alpha session, and is permanently unavailable once any current or revoked credential exists. Bootstrap ceremonies are explicitly marked and recheck that invariant inside the serializable completion transaction. Activation registration stages the new credential in the same unit of work and commits it only after the invitation is revalidated as active and unexpired. LINE OAuth is an explicit compatibility route whose single-use state is bound to `OnboardingFlow`.

The frontend permits credential creation only on a likely personal mobile device. Activation resolution also ignores the legacy public-device flag, and the former credential-free public-device activation completion route returns `activation_mobile_passkey_required`; an activation can be consumed only by completing mobile Passkey registration. Desktop authentication sends the WebAuthn `hybrid` hint first so compatible browsers prefer a cross-device QR ceremony backed by the phone credential. User-agent classification and the WebAuthn hint are interaction policies rather than trusted hardware classification; server security continues to come from the RP/origin, challenge, user-verification, credential-ownership, and signature checks.

Activation, group QR, and anonymous response tokens use selector/secret pairs. Raw secrets exist only in URL fragments, request bodies, and the authorized mutation response that creates them; SQL stores HMAC hashes. Anonymous submission and phone matching do not create membership. A group leader/co-leader must explicitly record identity/contact verification before approval; the approved transaction links or creates the member and materializes church/group membership. Possible or ambiguous existing-phone matches fail closed until an existing member is explicitly linked. If the approved member has no active Passkey, a separate durable `Active` activation invitation with `Manual` delivery status is created. The mutation returns the full phone and copyable bilingual message once; list APIs contain neither the message nor the raw URL, and losing the response does not roll back the human-approved membership.

## Authorization

Group permissions are checked against current data instead of trusting role claims in the JWT. This keeps membership and role changes effective without waiting for token refresh.

Rules to preserve:

- Public data can be readable without membership only when the feature explicitly allows it.
- Protected/private group data must validate current membership and visibility.
- Leader and co-leader management operations must be checked server-side.
- Notification data is current-user private.
- Frontend route checks are convenience only; they are not authorization.

## API Areas

| Area | Responsibility |
|---|---|
| Auth | Passkey authentication/registration, credential management, logout |
| Onboarding | Resumable identity flow, activation, QR application, anonymous replies |
| Members | Current member, LINE compatibility callback/registration, member listing |
| Groups | Church root, group detail, subgroups, join/invite/approve/reject/role workflows |
| Identity management | Pre-registration/member manual activation messages, QR lifecycle, leader-verified group applications, ambiguous person-match exceptions |
| Internal Alpha | Configuration-whitelisted accounts; optional first-Passkey bootstrap for explicitly configured testers, permanently disabled after any credential exists; disabled unless explicitly enabled in the current environment |
| Pages | Group-owned working pages, submitted review copies, published snapshots, create/update/submit/delete |
| Sections | Page section creation, update, deletion, link replacement |
| Events | Group event listing, creation, update, deletion |
| Enrollments | Event enrollment list and member enrollment mutations |
| Reviews | Event review list and review mutations |
| Notifications | Notification list, create, reply, mark-read |
| Sermons | Sermon listing and YouTube-backed sync support |
| Admin | Page-copy approval/return and menu management, sermon sync, and Cloudflare cache refresh |
| Health | Live, ready, and aggregate health checks |

Page publication uses immutable submitted and published JSON snapshots, including ordered section-link metadata. Public readers reject invalid snapshots rather than exposing the mutable working page. Existing public pages without review records are backfilled as pending submissions, and review-row `UpdatedUtc` concurrency checks return a conflict when submit, approve, return, or review-copy edits race.

## Data And Payload Conventions

The backend serializes enums as camelCase strings:

```csharp
new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false)
```

This keeps frontend payloads readable and avoids leaking database integer representation. Frontend compatibility code may still normalize legacy integer values where older data or clients require it.

Bilingual fields commonly use JSON-shaped localized text:

```json
{
  "en": "English text",
  "zh": "Chinese text"
}
```

Do not replace these with plain strings unless a migration and API contract change are explicitly planned.

## Persistence

EF Core maps the domain entities to SQL Server. Local development uses SQL Server through `backend/docker-compose.yml`, usually on `localhost,14333`.

Migration flow:

```powershell
cd backend
dotnet run --project src/Alife.DbMigrator
```

Schema changes should be explicit migrations. For alpha stability, avoid hidden implicit schema changes or broad data reshaping.

The identity-entry migration adds Passkey credentials/ceremonies, onboarding flows, activation invitations/grants, group join invitations, person/group applications with history and reply tokens, rate-limit buckets, a random member WebAuthn handle, and visitor consent metadata. It includes unique credential, current-QR, active-application, row-version, and one-time-token constraints. The retained person/application split supports explicit ambiguous-match handling without requiring a second approval for ordinary leader-verified applications. Generate and review this migration locally; do not apply it to a shared database without explicit approval.

## Backend Cache

Backend read services use .NET HybridCache for read-heavy API data:

- Member profile reads.
- Group and membership reads.
- Page and section reads.
- Event reads.
- Sermon reads.

Write operations should invalidate relevant backend cache entries through the existing invalidation services. Cache behavior should be considered part of the API contract because the Cloudflare speed layer and frontend conditional caches also depend on freshness signals.

## Interaction With The Speed Layer

The Cloudflare speed layer sits in front of the backend in deployed traffic. The backend remains authoritative for:

- Authentication validation.
- Authorization decisions.
- Persistent state.
- Mutation behavior.
- Backend cache invalidation.

The speed layer may cache selected API responses, generate ETags, and maintain authorization mirrors, but those mirrors are derived from successful backend responses and invalidated on known mutations. Backend code should not assume a request always came directly from the browser.

## Deployment Shape

The checked-in Dockerfile performs a standard release publish for the API and migrator:

```text
dotnet publish src/Alife.Api/Alife.Api.csproj -c Release -o /app/publish/api --no-restore
dotnet publish src/Alife.DbMigrator/Alife.DbMigrator.csproj -c Release -o /app/publish/migrator --no-restore
```

The runtime image starts:

```text
dotnet Alife.Api.dll
```

Additional publish options, such as AOT-related flags, should be documented in the CI/deployment workflow if they are used outside the checked-in Dockerfile.

## Configuration

Important settings:

| Key | Purpose |
|---|---|
| `ConnectionStrings__Default` | SQL Server / Azure SQL connection |
| `Jwt__Issuer` | JWT issuer |
| `Jwt__Audience` | JWT audience |
| `Jwt__Key` | JWT HMAC signing key |
| `Jwt__KeyId` | JWT signing key id |
| `Frontend__BaseUrl` | Frontend base URL for redirects/CORS |
| `LineLogin__ClientId` | LINE Login client id |
| `LineLogin__ClientSecret` | LINE Login client secret |
| `LineLogin__RedirectUri` | LINE Login callback URL |
| `Passkeys__Enabled`, `Passkeys__RpId`, `Passkeys__RpName`, `Passkeys__Origins` | WebAuthn availability and relying-party validation |
| `TokenProtection__SigningKey` | HMAC key for stored one-time token and OAuth-state hashes |
| `RateLimiting__HashKey` | Separate HMAC key for SQL rate-limit discriminators |
| `TrustedProxyNetworks` | CIDRs allowed to supply `CF-Connecting-IP` |
| `AlphaLogin__Enabled`, `AlphaLogin__Accounts`, `AlphaLogin__PasskeyBootstrapCodes__<accountId>` | Internal whitelist plus optional per-account first-Passkey secret (minimum 24 characters); explicit enablement is honored in every environment |
| `Youtube__ApiKey` | YouTube sermon sync API key |
| `Youtube__PlaylistId` | YouTube sermon playlist |
| `Cloudflare__ApiToken` | Cloudflare cache refresh API token |
| `Cloudflare__AccountId` | Cloudflare account id |
| `Cloudflare__NamespaceId` | Cloudflare cache namespace id, where configured |

Use environment variables, Function App settings, user secrets, or local settings as appropriate. Do not commit secrets.

## Change Guidelines

When changing backend behavior:

- Keep controller actions thin.
- Put business rules in application handlers or services.
- Keep current authorization checks server-side.
- Preserve bilingual DTO shapes.
- Preserve cache invalidation for affected read paths.
- Return clear `401`, `403`, `404`, and validation responses.
- Avoid changing API contracts silently.
- Add or update focused tests for application behavior, cache-sensitive behavior, and authorization-sensitive behavior.

## Verification Commands

```powershell
dotnet restore backend/Alife.sln
dotnet build backend/Alife.sln -c Debug
dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Debug
dotnet run --project backend/src/Alife.DbMigrator
dotnet run --project backend/src/Alife.Api
```

Useful local endpoints:

| Endpoint | URL |
|---|---|
| API base | `http://localhost:7071` |
| Health | `GET /health` |
| Liveness | `GET /health/live` |
| Readiness | `GET /health/ready` |
| OpenAPI | `GET /api/swagger/v1/swagger.json` |
| Swagger UI | `GET /api/help` |
