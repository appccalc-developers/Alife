# Alife MVP Architecture

## Overview

Alife is a full-stack church operations application built with:
- **Backend**: .NET 10 Azure Functions using Clean Architecture.
- **Frontend**: React 19 + TypeScript PWA using Vite and Tailwind CSS.
- **Database**: SQL Server 2022.
- **Containerization**: Docker Compose for local infrastructure.
- **Edge**: Cloudflare Workers for the frontend proxy and image API.
- **API Docs**: Swagger/OpenAPI in development.

## Product Value Model

Alife's current product value goal is to reduce the operational load of church group life:
- Members should quickly find group content, activities, sermons, and join flows.
- Leaders and co-leaders should manage their group without hunting through unrelated navigation.
- Ministry operators should publish pages and run recurring admin jobs with clear feedback.
- System admins should keep authentication, permissions, content, and integrations reliable.

### Primary Users

- **Guest**: can enter onboarding, sign in, and request or accept group access.
- **Member**: can view accessible groups, pages, sermons, and events, and enroll in activities.
- **Leader / CoLeader**: can manage subgroups, members, pages, and activities for approved groups.
- **Admin**: can access global admin operations such as sermon synchronization.

### Current UX Direction

Group pages separate day-to-day reading from management work:
- The group page focuses on visible content and lightweight contextual tools.
- The group tools drawer shows membership state, current page shortcuts, and a single management entry point.
- The group management route (`/groups/:groupId/manage`) owns subgroup, member, page, and event management.

## Backend Architecture

### Clean Architecture Layers

```text
Domain (Entities, Enums)
  -> Application (Use Cases, Commands, Queries, DTOs)
  -> Infrastructure (Data Access, Migrations, Services, Security)
  -> Api (Azure Functions host, controllers, HTTP layer)
```

**Project Dependencies:**
- `Alife.Domain` has no project dependencies.
- `Alife.Application` depends on Domain.
- `Alife.Infrastructure` depends on Application and Domain.
- `Alife.Api` depends on Application and Infrastructure.
- `Alife.DbMigrator` depends on Infrastructure and Application.

### Domain Model

#### Groups
- Hierarchical structure with Church as the root group.
- Access types: Public, Protected, Private.
- Roles: Owner, Leader, CoLeader, Member.
- Membership statuses: Invited, Requested, Approved, Active, Rejected, Removed.

#### Members
- Authentication via LINE Login OAuth or development/admin flows.
- Profile includes display name, phone, email, and registration state.
- Members relate to groups through membership records.
- Current member identity is resolved from the JWT `sub` claim.

#### Pages
- Group-scoped and global pages.
- Visibility supports draft and group-visible states.
- Multilingual support through language-specific page records.
- Sections define rendered content blocks inside pages.

#### Events
- Group-owned activities with structured event data.
- Enrollment is handled through event enrollment APIs and frontend chat UI.
- Leaders/co-leaders can create, edit, and delete group events.

## Security Architecture

### JWT in HttpOnly Cookies

**Why HttpOnly?**
- JavaScript cannot read the cookie, reducing XSS token theft risk.
- Cookies are automatically sent with API requests.
- The approach follows OWASP-friendly browser auth defaults.

**Flow:**
1. User authenticates through LINE login, display-name login, or admin/dev login.
2. Backend creates a JWT with minimal claims such as `sub` and `exp`.
3. JWT is stored in the HttpOnly cookie `alife_auth`.
4. JwtBearer middleware reads the token from the cookie.
5. Current identity is validated from the `sub` claim.

### Authorization Model

**No role caching in JWT**
- JWT claims stay minimal to reduce leakage and stale authorization.
- Group roles and permissions are checked from the database for protected actions.
- Permission changes take effect without forcing token refresh.

**Authorization Flow:**

```text
Request arrives
  -> JwtBearer middleware validates cookie JWT and extracts sub
  -> CurrentMemberAccessor resolves the current member
  -> Controller or application service checks group membership
  -> Authorized requests proceed; unauthorized requests return 403
```

## API Structure

**Controllers:**
- `AdminController` - admin operations.
- `AuthController` - authentication and session operations.
- `MembersController` - registration, LINE login/callback, profile.
- `GroupsController` - group and membership workflows.
- `PagesController` - page management.
- Page section writes are handled through `PagesController` create/update payloads.
- `EventsController`, `EventEnrollmentsController`, and `EventReviewsController` - activity, enrollment, and review workflows.
- `SermonsController` - sermon listing.

### HTTP and API Surface

- Health endpoint: `GET /health`.
- API endpoints: under `/api/*`.
- OpenAPI document: `GET /api/swagger/v1/swagger.json` in development.
- Swagger UI: `GET /api/help` in development.

### Application Layer

- Commands handle write operations.
- Queries handle read operations.
- DTOs define API-facing payload shapes.
- Services centralize domain rules and authorization helpers.

### Infrastructure Layer

- EF Core DbContext and migrations.
- Read services for optimized group, member, and page reads.
- HybridCache-backed read paths and invalidation services.
- Cloudflare Durable Objects for AI-assisted event planning, enrollment, and review sessions.
- JWT, cookie, LINE Login, and YouTube integration services.

### Caching Architecture

- Read services and invalidation services use `HybridCache`.
- `/api/me` is cached and invalidated on profile-changing operations.
- Group, page, event, and sermon reads use cache keys owned by application services.
- Source-level `IMemoryCache` usage has been removed from application wiring.

## Database Schema

Key tables include:
- `Members` - user accounts.
- `Groups` - organizational units.
- `GroupMemberships` - member-to-group relationships.
- `Pages` - global and group content pages.
- `Sections` - page content sections.
- `GroupEvents` - group activity records.
- `EventEnrollments` - event registration records.
- `Sermons` - synchronized sermon metadata.

## Frontend Architecture

### Technology Stack

- **Framework**: React 19.
- **Language**: TypeScript.
- **Build Tool**: Vite.
- **Styling**: Tailwind CSS.
- **Routing**: React Router.
- **Server State**: TanStack Query and TanStack DB live queries.
- **Local App State**: React context providers such as `AuthProvider` and `CurrentGroupProvider`.
- **HTTP Client**: Axios with `withCredentials` enabled.
- **PWA**: Vite PWA service worker registration.

### Application Structure

```text
frontend/alife-app/src/
  App.tsx                 Route tree, app shell, navigation
  main.tsx                React root, providers, router, service worker
  stores/                 React context stores for auth and current group
  views/                  Route-level screens
  components/             Reusable UI and domain components
  services/               Axios-backed API clients
  api/                    Additional API helpers
  db/                     TanStack Query/DB collections and HTTP cache
  hooks/                  Screen and data composition hooks
  types/                  TypeScript DTO and model types
  assets/                 Static frontend assets
```

### Authentication and Bootstrap Flow

1. `main.tsx` creates the React root and mounts providers.
2. `AuthProvider` bootstraps identity by calling `GET /api/me` through `authService`.
3. If the user is a guest or unauthenticated, onboarding routes can guide LINE login or registration.
4. After registration or login, the backend issues the `alife_auth` cookie.
5. The app reads membership and role data from `/api/me` and uses it for route-aware UI.

### Cookie Handling

**Axios Configuration:**

```ts
export const http = axios.create({
  baseURL,
  withCredentials: true,
})
```

**Environment behavior:**
- In development, Vite proxies same-origin `/api/*` requests where configured.
- In production, `VITE_API_BASE_URL` supplies the API base URL.
- Backend CORS must allow credentials for cross-origin deployments.
- Secure production cookies should use the correct `SameSite` and `Secure` settings for the deployment topology.

### Frontend Information Architecture

**Global shell:**
- Home, sermons, global events entry, onboarding, admin.
- Current group pages appear in the side/bottom navigation when a group is active.
- Group leaders and co-leaders also see a `Manage` entry for the current group.

**Group detail screen:**
- `GroupDetailView` composes `useGroupScreen` data.
- `GroupScreenShell` renders selected group page content.
- The app shell owns current-group page navigation, subgroup navigation, language switching, and manager-only floating actions.

**Group management screen:**
- `GroupManageView` owns management workflows for leaders and co-leaders.
- It groups operations into Subgroups, Members, Pages, and Events sections.
- Direct access is guarded in the UI by group role and redirects non-managers back to the group page.

### Component Architecture

**Key components:**
- Layout primitives: `AppPageShell`, `AppSectionCard`, `AppActionButton`, `AppBadge`, `AppEmptyState`.
- Group screens: `GroupScreenShell`, `GroupPageTabs`, `GroupHeaderCard`, `GroupOverviewPanel`, `EnrollmentChatDialog`, `ReviewChatDialog`.
- Content screens: `PageView`, `PageEditorView`, `PageContentRenderer`, page editor components.
- Admin and operations screens: `AdminView`, `SermonsView`, `EventCreatorView`, `GroupManageView`.

### AI Session Frontend / Edge Architecture

- `src/services/aiSessionService.ts` provides the generic frontend client for `/message`, `/state`, `/stream`, and `/close`.
- `src/hooks/useAiSession.ts` centralizes SSE subscription, state updates, send-message handling, and error normalization.
- `worker/ai-session.ts` provides the generic Durable Object base.
- `worker/eventplanner.ts`, `worker/enrollment.ts`, and `worker/review.ts` configure event, enrollment, and review-specific prompts, schemas, and draft normalization.
- Worker session routes are `/api/events/session/*`, `/api/enrollments/session/*`, and `/api/reviews/session/*`.

## Deployment Architecture

### Docker Compose (Development)

**Services:**
- `sqlserver` - SQL Server 2022 on port 14333.
- `alife-api` - API container where applicable.

### Container Images

- Build stage: `.NET SDK 10`.
- Runtime stage: ASP.NET 10 Ubuntu chiseled runtime image for the API container.

**Environment Variables:**

```text
ASPNETCORE_ENVIRONMENT=Development
ConnectionStrings__Default=...
Jwt__Issuer=...
Jwt__Audience=...
Jwt__Key=...
Frontend__BaseUrl=http://localhost:5173
```

### Production Considerations

- Use environment-specific JWT keys.
- Enable HTTPS.
- Configure health checks for platform routing and monitoring.
- Run migrations through a controlled migrator step.
- Keep database backup and restore expectations documented.
- Store LINE, YouTube, and deployment secrets outside source control.

## Runtime Configuration Notes

- .NET SDK is pinned by `global.json`.
- LINE login and JWT secrets should be supplied through environment variables or secure secret storage.
- Frontend local development uses `frontend/alife-app/.env` and Vite dev server configuration.

## Data Flow Examples

### User Registration Flow

```text
Guest opens app
  -> Frontend calls GET /api/me
  -> Guest enters onboarding
  -> Frontend requests LINE login redirect or development login
  -> User completes authentication and profile registration
  -> Frontend posts registration data
  -> Backend upgrades member and issues permanent JWT cookie
```

### Group Approval Flow

```text
Member requests to join group
  -> Frontend posts to /api/groups/{groupId}/join-request
  -> Backend creates or updates pending membership
  -> Leader opens /groups/{groupId}/manage
  -> Leader approves or rejects pending members
  -> Backend updates membership status after authorization check
```

### Group Management Flow

```text
Leader opens group page
  -> Group shell shows page content and compact tools drawer
  -> Leader opens Manage
  -> Management page presents subgroups, members, pages, and events
  -> Each action calls the existing group/page/event API client
  -> Query caches are invalidated and status feedback is shown
```

### AI Enrollment Flow

```text
Member opens event enrollment route
  -> Frontend creates or restores an enrollment session through /api/enrollments/session/*
  -> EnrollmentSession Durable Object calls Gemini and stores chat/draft state
  -> User attaches payment proof images when required
  -> Frontend commits completed draft to POST /api/events/{eventId}/enrollments
  -> Backend stores the enrollment JSON and enforces member/group authorization
```

## Key Design Decisions

### 1. JWT in HttpOnly Cookie
**Rationale**: Secure browser default posture; JavaScript cannot read auth token.
**Trade-off**: Non-browser clients need a separate auth strategy later.

### 2. Fresh Permission Checks
**Rationale**: Real-time authorization without JWT refresh.
**Trade-off**: Protected actions require database-backed permission checks.
**Mitigation**: Read paths use cache where appropriate.

### 3. Minimal JWT Claims
**Rationale**: Reduce token leakage impact and stale role risk.
**Trade-off**: UI and backend must request current role data from the API.

### 4. Management Workflows Are Route-Level
**Rationale**: Leaders need task-focused screens, not overloaded sidebars.
**Trade-off**: Some actions require one extra navigation step.
**Mitigation**: The group tools drawer provides a single clear management entry point.

## Testing Strategy

### Unit Tests
- Located in `backend/tests/Alife.Tests.Unit`.
- Cover domain and application behavior without database dependencies.

### Frontend Verification
- `npm run build` runs TypeScript project checks and Vite production build.
- Future component tests should use a React testing stack such as Testing Library.
- Future end-to-end tests should cover onboarding, group joining, management, page editing, event creation, and enrollment.

### Integration Tests (Future)
- API endpoints with a test database or isolated integration fixture.
- Full auth and authorization flow validation.
