# Alife Alpha Architecture

## Overview

Alife is a full-stack community and church group platform with four main runtime areas:

- **Backend**: .NET 10 Azure Functions v4 isolated worker, ASP.NET Core controllers, MediatR, EF Core, SQL Server, HybridCache.
- **Frontend**: React 19 + TypeScript + Vite PWA, Tailwind CSS, TanStack Query, TanStack React DB, Axios, IndexedDB-backed ETag cache.
- **Edge**: Cloudflare `speed-layer` Worker for frontend assets, API proxying, edge cache, authorization mirrors, and AI session Durable Objects.
- **Images**: separate Cloudflare `images-api` Worker backed by Cloudflare R2.

The current architecture is intentionally layered. The main product goal is alpha stability for real church/group usage while keeping the system maintainable enough for handover and portfolio review.

## Product Value Model

Alife reduces operational friction around church community life:

- Members can find groups, pages, sermons, events, notifications, and join flows from one mobile-friendly entry point.
- Leaders and co-leaders can manage subgroups, members, pages, and events without mixing management work into normal reading screens.
- Content volunteers can build bilingual pages from structured sections rather than editing code.
- Admins can run operational actions such as sermon sync and Cloudflare cache refresh from protected APIs.
- AI-assisted workflows help draft event planning, enrollment, and review content while leaving final persistence under user control.

### Primary Users

- **Guest**: can open onboarding, sign in, and request/accept access.
- **Member**: can view accessible groups, pages, sermons, events, notifications, and enroll in activities.
- **Leader / CoLeader**: can manage approved groups, subgroups, memberships, pages, and events.
- **Admin**: can access protected admin operations.

## Runtime Topology

```mermaid
flowchart LR
  Browser[Browser / PWA] --> Worker[Cloudflare speed-layer Worker]
  Worker --> Assets[alife-app dist assets]
  Worker -->|/api/* proxy| Api[Azure Functions API]
  Worker -->|AI session routes| DO[Durable Objects]
  Worker -->|/images/* proxy| ImageWorker[Cloudflare images-api Worker]
  ImageWorker --> R2[Cloudflare R2]
  Api --> Sql[SQL Server / Azure SQL]
  Api --> Line[LINE Login]
  Api --> Youtube[YouTube API]
```

The speed layer is the normal browser-facing entry for deployed traffic. It serves the built React app, proxies origin API requests, routes AI session requests to Durable Objects, and handles cache/authorization mirror logic before falling back to the backend API.

## Backend Architecture

### Clean Architecture Layers

```text
Alife.Domain
  -> Alife.Application
  -> Alife.Infrastructure
  -> Alife.Api
```

- `Alife.Domain`: entities and enums with no infrastructure dependency.
- `Alife.Application`: commands, queries, DTOs, service interfaces, and use-case rules.
- `Alife.Infrastructure`: EF Core, migrations, SQL Server access, read services, cache invalidation, JWT, LINE, YouTube, Cloudflare integration.
- `Alife.Api`: Azure Functions host, ASP.NET Core HTTP pipeline, controllers, auth middleware, health checks, Swagger.
- `Alife.DbMigrator`: migration and seed runner.

The backend is controller-style HTTP API hosted inside Azure Functions, not a collection of isolated single-purpose scripts.

### Domain Model

Key entities:

- `Member`: display name, contact fields, LINE UID, registration/admin state.
- `Group`: bilingual name/description JSON, hierarchy, access type, church/root marker, closed state.
- `GroupMembership`: member/group relationship with role and status.
- `Page`: global or group-scoped page with bilingual title/description JSON, tags, visibility, and soft delete.
- `Section`: ordered page block with type, content JSON, style JSON, and links.
- `Link`: section-owned links to groups/pages or external visual items.
- `Sermon`: synchronized YouTube sermon metadata.
- `GroupEvent`: group-owned event with bilingual titles and serialized rich event JSON.
- `EventEnrollment`: one enrollment per event/member, stored as JSON.
- `EventReview`: event review JSON; multiple reviews per event/member are allowed.
- `NotificationMessage`: recipient, creator, optional group/event context, action JSON, response JSON, read/reply timestamps.

### Enums And API Shape

The backend serializes enums as camelCase strings. The frontend normalizes legacy integer or string enum values where needed.

Important enums include:

- `AccessType`: public, protected, private.
- `MembershipStatus`: invited, requested, approved, rejected, removed.
- `MembershipRole`: member, coLeader, leader.
- `PageScope`: global, group.
- `PageVisibility`: draft, group, public.
- `SectionType`: hero, rich text, spotlight, list view, and related section rendering types.

## Security Architecture

### Authentication

Alife uses JWT authentication stored in the HttpOnly cookie `alife_auth`.

Flow:

1. User signs in through LINE Login, Alpha account login by display name or phone number with an optional international calling code, or dev/admin flow.
2. Backend issues a JWT with minimal claims such as `sub` and expiry.
3. JwtBearer middleware reads the JWT from the cookie.
4. `CurrentMemberAccessor` resolves the current member from the `sub` claim.
5. Protected API handlers perform current membership and role checks before mutating data.

### Authorization

Group authorization is intentionally checked against current data instead of trusting stale role claims in the JWT.

Typical protected flow:

```text
HTTP request
  -> Cookie JWT validation
  -> Current member resolution
  -> Group membership/role check in application or read service
  -> Command/query execution
  -> Cache invalidation where needed
```

This is important because leaders and co-leaders can change membership state, and permission changes must take effect without waiting for token refresh.

## API Surface

Controllers are grouped by responsibility:

- `AuthController`: login, logout, dev/admin session.
- `MembersController`: `/api/me`, LINE login/callback, registration, Alpha account login, member listing.
- `GroupsController`: church root, group detail, subgroups, membership workflows, invite candidates, group update/close.
- `PagesController`: global pages, group pages, page detail, create/update/publish/delete.
- `EventsController`: group event list/create/update/delete.
- `EventEnrollmentsController`: enrollment list/create/update/delete.
- `EventReviewsController`: review list/create/update/delete.
- `NotificationsController`: notification list/create/reply/read.
- `SermonsController`: sermon listing.
- `AdminController`: sermon sync and Cloudflare cache refresh.

Health and diagnostics:

- `GET /health/live`
- `GET /health/ready`
- `GET /health`
- `GET /api/swagger/v1/swagger.json`
- `GET /api/help`

## Caching Architecture

Alife has several cache layers, each with different privacy rules.

### Backend HybridCache

Backend read services use `.NET HybridCache` for read-heavy data:

- member profile data
- groups and memberships
- pages and sections
- events
- sermons

Write operations call invalidation services where applicable.

### Cloudflare Speed Layer Cache

The speed layer uses the Cloudflare Cache API and logical cache records to support:

- public shared caching for `/api/sermons`, `/api/pages/public`, and confirmed-public `/api/pages/{pageId}` responses;
- authorized group-shared caching for group pages, subgroups, events, members, and memberships;
- member profile caching for `/api/me` by member id;
- generated ETags and `304 Not Modified`;
- passive invalidation after mutations;
- membership/page/entity metadata mirrors used to decide whether shared cached data can be read.

Browser-facing API responses are returned with private browser cache semantics such as `private, no-cache` and `Vary: Cookie, Authorization` where appropriate. Public image responses can use public immutable-style caching.

### Frontend Cache

The frontend uses:

- TanStack Query for query coordination and invalidation.
- TanStack React DB collections for local list data.
- `idb-keyval` for ETag-aware `conditionalGet` storage in IndexedDB.
- Vite PWA runtime caching for app assets, images, fonts, and non-API runtime resources.

The PWA service worker deliberately avoids replaying `/api/*` responses from runtime cache. This protects users from seeing stale private data after auth or permission changes.

## Frontend Architecture

### Technology Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router 7
- Framer Motion
- Axios with `withCredentials`
- TanStack Query and TanStack React DB
- IndexedDB via `idb-keyval`
- Vite PWA

### Directory Structure

```text
cloudflare/alife-app/src/
  App.tsx                 App shell, route tree, navigation
  main.tsx                React root and providers
  stores/                 Auth, current group, leader UI preferences
  views/                  Route-level screens
  components/             Reusable UI and domain components
  services/               Axios-backed API clients and workflow clients
  api/                    Additional API helpers
  db/                     TanStack collections and ETag HTTP cache
  hooks/                  Screen/data composition hooks
  types/                  TypeScript DTO and model types
  i18n/                   UI text translation table
  utils/                  localization, enum normalization, page content helpers
```

### Key Frontend Flows

- `AuthProvider` bootstraps identity through `GET /api/me`.
- `CurrentGroupProvider` and `activeEntityService` keep the active group/page/event context stable across canonical and parameterized routes.
- `GroupDetailView` focuses on reading visible group content.
- `GroupManageView` owns group, subgroup, member, page, and event management.
- `PageEditorView` edits bilingual page metadata and structured sections.
- `EventCreatorView`, `EventEnrollmentView`, and `EventReviewView` cover event planning, enrollment, and review workflows.
- `NotificationToastHost` and notification services support action-oriented message flows.

## Page Builder And Bilingual Content

Pages use localized JSON fields for title and description. Sections use JSON payloads and explicit section types rather than storing raw whole-page HTML.

This supports:

- bilingual English/Chinese display;
- migration-friendly section evolution;
- content blocks such as hero, rich text, spotlight, and list-driven sections;
- list sections whose metadata can resolve sermons, groups, members, pages, or events through shared frontend data collections.

Visibility is explicit:

- `draft`: not broadly visible; privileged users or the creator can work on it.
- `group`: visible to approved members of the owner group.
- `public`: intended for public/global or church-visible usage, subject to scope rules.

## AI Session Architecture

AI-assisted workflows run through the Cloudflare speed layer:

- generic AI router under `/api/ai`;
- event planning sessions under `/api/events/session/*`;
- enrollment sessions under `/api/enrollments/session/*`;
- review sessions under `/api/reviews/session/*`.

Durable Object classes:

- `EventPlanningSession`
- `EnrollmentSession`
- `ReviewSession`

The Durable Objects keep session state and call Gemini. Completed drafts are committed to backend REST APIs by the frontend, preserving the separation between temporary AI conversation state and durable business records.

## Image Architecture

`cloudflare/images-api` is a separate Worker that uses the `IMAGE_BUCKET` R2 binding.

It supports:

- `GET /api/images/config`
- `GET /api/images/list/{path}`
- `GET /api/images/{path}`
- `POST /api/images/{path}`
- `DELETE /api/images/{path}`
- `/help` and `/help/raw` for OpenAPI documentation

The Vite dev server proxies `/images/*` to the configured image origin. The deployed speed layer routes `/images/*` through the Worker pipeline and proxy handler.

## Deployment Architecture

### Local Development

- SQL Server runs through `backend/docker-compose.yml` on port `14333`.
- The API runs locally through `dotnet run --project backend/src/Alife.Api`.
- The frontend runs through Vite on `http://localhost:5173`.
- The speed layer can be tested through `npm run preview` from `cloudflare/alife-app`.

### Container Build

The backend `Dockerfile`:

- builds with `mcr.microsoft.com/dotnet/sdk:10.0`;
- publishes both `Alife.Api` and `Alife.DbMigrator`;
- runs on `mcr.microsoft.com/dotnet/aspnet:10.0-noble`;
- installs ICU for SQL Server globalization support;
- starts `dotnet Alife.Api.dll`.

It is a standard .NET publish/container flow, not Native AOT in the current project file.

### Cloudflare Deployment

`cloudflare/speed-layer/wrangler.jsonc`:

- serves built assets from `../alife-app/dist`;
- runs Worker code first for `/api/*` and `/images/*`;
- routes `ccalc.live`;
- configures Durable Object bindings and migrations;
- sets `API_PROXY_TARGET`;
- requires `GEMINI_API_KEY`.

`cloudflare/images-api/wrangler.toml`:

- routes `images.ccalc.live`;
- binds R2 buckets for image objects and help docs.

## Data Flow Examples

### User Opens The App

```text
Browser loads deployed domain
  -> speed-layer returns React assets
  -> app calls GET /api/me
  -> speed-layer may serve member cache or proxy to API
  -> API validates alife_auth cookie and resolves member
  -> frontend builds navigation from memberships and active group/page state
```

### Leader Publishes A Group Page

```text
Leader opens group management
  -> frontend loads group pages through conditionalGet
  -> leader edits page/sections
  -> API validates leader/co-leader permission
  -> page and section records are updated
  -> backend and speed-layer caches are invalidated for affected page/group paths
  -> frontend query/IndexedDB caches refresh on the next read
```

### Event Enrollment

```text
Member opens event enrollment route
  -> frontend restores or creates AI enrollment session
  -> Durable Object keeps chat/draft state
  -> user reviews and commits the draft
  -> frontend posts JSON to /api/events/{eventId}/enrollments
  -> backend enforces member/group access and stores the enrollment JSON
```

### Notification Reply

```text
Leader or workflow creates notification
  -> recipient sees notification through protected /api/notifications
  -> recipient posts reply JSON
  -> backend records ResponseDataJson and RepliedUtc
  -> response remains private and no-store/no-cache at API controller level
```

## Key Design Decisions

### 1. Minimal JWT In HttpOnly Cookie

This reduces frontend token exposure and avoids stale role claims. The trade-off is that group authorization requires current backend data or edge authorization mirrors.

### 2. Route-Level Management Workflows

Group reading and group management are separated. This keeps member browsing simpler and gives leaders a task-focused management route.

### 3. Structured Page Content

Pages are section-based and bilingual. This is more maintainable than storing raw HTML and supports future schema evolution.

### 4. Separate AI Session State From Durable Data

Durable Objects hold temporary conversation state. Backend APIs persist reviewed event/enrollment/review records.

### 5. Multi-Layer Cache With Privacy Boundaries

Public, group-shared, member-specific, and local browser caches are treated differently. Shared cache reads require explicit authorization context or public-safe routes.

## Testing Strategy

### Current Test Locations

- Backend unit tests: `backend/tests/Alife.Tests.Unit`
- Speed layer tests: `cloudflare/speed-layer/index.test.mjs`
- Images API tests: `cloudflare/images-api/worker/index.test.mjs`

### Useful Verification Commands

```powershell
dotnet build backend/Alife.sln -c Debug
dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj -c Debug

cd cloudflare/alife-app
npm run build

cd ../speed-layer
npm test
```

### Future Gaps

- Broader API integration tests with a test database.
- Browser-level tests for onboarding, group management, page editing, and event enrollment/review.
- Explicit cache header regression tests for protected group/member data.
