# Alife MVP Architecture

## Overview

Alife is a full-stack church management application built with:
- **Backend**: .NET 10 (Clean Architecture)
- **Frontend**: Vue 3 TypeScript SPA (Vite, Tailwind, Pinia)
- **Database**: SQL Server 2022
- **Containerization**: Docker Compose
- **API Docs**: Built-in OpenAPI (`/openapi/v1.json` in Development)

## Backend Architecture

### Clean Architecture Layers

```
Domain (Entities, Enums)
    ↑
Application (Use Cases, Commands, Queries, DTOs)
    ↑
Infrastructure (Data Access, Migrations, Services, Security)
    ↑
Api (Controllers, HTTP layer)
```

**Project Dependencies:**
- `Alife.Domain` - No dependencies
- `Alife.Application` → Domain
- `Alife.Infrastructure` → Application, Domain
- `Alife.Api` → Application, Infrastructure
- `Alife.DbMigrator` → Infrastructure, Application

### Domain Model

#### Groups
- Hierarchical structure with Church as root
- Three access types: Public, Protected (with approval), Private
- Roles: Owner, Leader, CoLeader, Member
- Membership statuses: Invited, Requested, Approved, Active, Rejected, Removed

#### Members
- Authentication via phone OTP verification
- Profile includes name, phone, email
- Associated with groups via membership records
- Current member identity always from JWT `sub` claim

#### Pages
- Lifecycle states: Draft → Visible → Public
- Can be managed globally (for all groups) or per-group
- Multilingual support (English, Chinese)
- Versions tracked in database

#### Sections
- Sub-units within pages
- Support for section link replacement with ownership validation
- Customizable content per group if needed

### Security Architecture

#### JWT in HttpOnly Cookies

**Why HttpOnly?**
- Immune to XSS (JavaScript cannot access the cookie)
- Automatically sent with all requests
- Follows OWASP best practices

**Flow:**
1. User authenticates (guest signup or admin login)
2. Backend creates JWT with minimal claims:
   - `sub` - Member ID (unique identifier)
   - `exp` - Expiration time
3. JWT stored in HttpOnly cookie `alife_auth`
4. JwtBearer middleware reads from cookie automatically
5. Current identity always validated from `sub` claim

#### Authorization Model

**No Role Caching in JWT**
- JWT intentionally minimal to reduce data leakage
- Group roles and permissions queried from database on each request
- Ensures real-time permission updates

**Authorization Flow:**
```
Request arrives
    ↓
JwtBearer middleware reads cookie → validates JWT → extracts `sub`
    ↓
CurrentMemberAccessor retrieves member ID from JWT
    ↓
Controller/Service queries DB for group membership
    ↓
If authorized: proceed | If unauthorized: 403 Forbidden
```

### API Structure

**Controllers** (request/response handling):
- AdminController - Admin operations
- AuthController - Authentication (guest, dev login)
- MembersController - Member registration, phone verification
- GroupsController - Group CRUD operations
- PagesController - Page management
- SectionsController - Section management
- HealthController - Health checks

### HTTP and API Surface

- Health endpoint: `GET /health`
- API endpoints: under `/api/*`
- Swagger UI: `GET /swagger` (Swashbuckle)

**Application Layer** (business logic):
- Commands - Write operations (create, update, delete)
- Queries - Read operations
- DTOs - Data transfer objects
- Services - Domain logic and validations

**Infrastructure Layer**:
- DbContext - Entity Framework configuration
- Migrations - Database schema versioning
- ReadServices - Optimized read database queries
- Security - Cookie, JWT handling
- Services - Email, SMS, external integrations

### Caching Architecture

- Read services and invalidation services now use `HybridCache`.
- This provides coordinated local/distributed cache behavior and built-in stampede protection semantics.
- `/api/me` member profile path is cached via HybridCache and invalidated on profile-changing operations.
- Source-level `IMemoryCache` and `AddMemoryCache()` usage were removed from application wiring.

### Database Schema

Key tables:
- `Members` - User accounts
- `Groups` - Organizational units
- `MemberGroupMemberships` - Member-to-group relationships
- `Pages` - Content pages
- `Sections` - Page sections
- `MemberGroupRoles` - Role assignments

## Frontend Architecture

### Technology Stack

- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript
- **Build Tool**: Vite (HMR, optimized builds)
- **Styling**: Tailwind CSS
- **State Management**: Pinia (simpler than Vuex)
- **Routing**: Vue Router 4
- **HTTP Client**: Axios (automatic cookie handling)

### Application Structure

```
src/
├── router.ts           - Route definitions
├── stores/             - Pinia stores (global state)
├── components/         - Reusable Vue components
├── views/              - Page-level components
├── api/                - API client functions
├── types/              - TypeScript interfaces
└── assets/             - Static files
```

### Authentication & Bootstrap Flow

1. **App Initialization**
   - `main.ts` creates Vue app and mounts

2. **Bootstrap Check**
   - `router.ts` or `App.vue` calls `GET /api/me`
   - Checks if member is authenticated

3. **If 401 Unauthorized**
   - Call `POST /api/auth/guest` to create guest identity
   - Retry `GET /api/me`

4. **User Registration**
   - Phone OTP verification
   - Profile completion
   - JWT cookie issued (longer-lived)

5. **State Management**
   - Pinia store holds current user
   - Reactive to auth changes
   - router navigation guards check auth state

### Cookie Handling

**Axios Configuration**:
```javascript
// All requests automatically include withCredentials
// Allows browser to send cookie with cross-origin requests
axios.defaults.withCredentials = true
```

**CORS Requirements**:
- Backend must allow `withCredentials`
- Frontend origin must be in CORS whitelist
- Cookie must be marked `SameSite=None; Secure` for cross-origin (not needed for localhost)

### Component Architecture

**Key Components**:
- Navigation/Layout - Main app shell
- AuthFlow - Login/registration flow
- GroupList - Group browsing
- MemberProfile - User profile management
- PageViewer - Content display
- AdminDashboard - Admin operations

## Deployment Architecture

### Docker Compose (Development)

**Services**:
- **sqlserver** - SQL Server 2022 on port 14333
- **alife-api** - Built from Dockerfile on port 8080

### Container Images

- Build stage: `.NET SDK 10`
- Runtime stage: `aspnet:10.0-jammy-chiseled` (reduced attack surface)

**Environment Variables**:
```
ASPNETCORE_ENVIRONMENT=Development
MSSQL_SA_PASSWORD=YourStrong!Passw0rd
JWT_KEY=your-jwt-secret
FRONTEND_ORIGIN=http://localhost:5173
```

### Production Considerations

- Remove HttpOnly flag only if frontend on same host
- Use environment-specific JWT keys
- Enable HTTPS (TLS)
- Configure health checks for load balancers
- Set up proper SQL Server backup strategy
- Use managed identity or secure secret storage for credentials

## Runtime Configuration Notes

- .NET SDK is pinned by `global.json` to 10.0 feature band.
- Development config includes Twilio placeholders so startup options validation can pass in local environments.
- Real Twilio and JWT secrets should be supplied via environment variables or secure secret storage in non-local environments.

## Data Flow Examples

### User Registration Flow

```
Guest opens app
├─ Frontend: GET /api/me → 401 Unauthorized
├─ Frontend: POST /api/auth/guest → Guest member created
├─ Frontend: GET /api/me → Returns guest profile
├─ User: Enter phone
├─ Frontend: POST /api/members/phone/start → OTP sent
├─ User: Enter OTP
├─ Frontend: POST /api/members/phone/confirm → Phone verified
├─ User: Complete profile
├─ Frontend: POST /api/members/register → Member upgraded
└─ Backend: Issue permanent JWT cookie
```

### Group Approval Flow

```
Member requests to join group
├─ Frontend: POST /api/groups/{groupId}/join
├─ Backend: Create pending membership
├─ Leader/Admin: Reviews pending members
├─ Frontend: PATCH /api/groups/{groupId}/members/{memberId}
├─ Backend: Update membership status
├─ Authorization check: Leader must have approval permission
└─ Member notified (via DB, real-time TBD)
```

## Key Design Decisions

### 1. JWT in HttpOnly Cookie
**Rationale**: Secure default posture; immune to XSS attacks
**Trade-off**: Cannot use token for non-browser clients (yet)

### 2. Fresh Permission Checks
**Rationale**: Real-time authorization without JWT refresh
**Trade-off**: Slight performance overhead per request
**Mitigation**: Database query caching if needed

### 3. Minimal JWT Claims
**Rationale**: Reduce data leakage from token interception
**Trade-off**: Every authorization check requires DB query
**Mitigation**: Member ID cached in context, single lookup per request

### 4. Cookie-based CORS
**Rationale**: Simpler auth flow than bearer tokens
**Trade-off**: Must handle SameSite restrictions
**Works**: Automatic cookie inclusion with withCredentials

## Testing Strategy

### Unit Tests
- Located in `backend/tests/Alife.Tests.Unit`
- Test domain logic, application services
- No database dependencies

### Integration Tests (Future)
- API endpoints with in-memory database
- Full auth flow validation

### Frontend Tests (Future)
- Component testing with Vue Test Utils
- Integration tests with Mock Service Worker
