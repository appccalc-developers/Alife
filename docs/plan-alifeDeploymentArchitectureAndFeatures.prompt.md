# Alife Plan

## Objective
Build and validate a clear deployment plan, architecture map, and feature/use analysis for Alife so the team can align implementation, release, and refinement.

## 1. System Architecture Plan

### 1.1 Layered Backend Architecture
- Domain layer: core entities and enums only.
- Application layer: CQRS commands and queries with MediatR.
- Infrastructure layer: EF Core persistence, external integrations, security, caching.
- API layer: Azure Functions HTTP entrypoint, controllers, pipeline and auth.

### 1.2 Core Runtime Topology
- Frontend SPA/PWA served by Azure Static Web Apps.
- Backend API served by Azure Functions (.NET isolated worker).
- Primary data store in Azure SQL.
- External integrations for LINE OAuth and YouTube sync.

### 1.3 Domain Model Plan
- Member: identity and registration lifecycle (guest to registered), profile, admin flag.
- Group: hierarchical structure with access type and close/open status.
- GroupMembership: role and status workflow between members and groups.
- Page and Section: CMS-like content model with visibility and section composition.
- Link: section-level internal navigation targets.
- Sermon: synchronized media catalog from YouTube playlist.

## 2. Deployment Plan

### 2.1 Production Targets
- Frontend deploy to Azure Static Web Apps.
- Backend API deploy as Functions integration for Static Web Apps.
- Database hosted on Azure SQL.

### 2.2 CI/CD Pipeline
- GitHub Actions workflow triggers on push and PR events.
- Build frontend with Vite and backend with dotnet publish.
- Deploy app through Static Web Apps deploy action.
- Use PR preview environments for staging and review.

### 2.3 Secure Identity for CI/CD
- Configure GitHub OIDC federated identity with Azure app registration and service principal.
- Assign least-privilege RBAC at resource group scope.
- Store only non-secret identifiers and runtime secrets in GitHub Secrets.

### 2.4 Migration and Release Flow
- Run DB migrations via Alife.DbMigrator in pipeline or controlled release stage.
- Validate health endpoints after deployment.
- Promote after smoke checks for auth, group operations, pages, and sermon sync.

## 3. Local Development and Environment Plan

### 3.1 Local Stack
- Docker Compose with SQL Server and API service.
- Optional Caddy reverse proxy for local HTTPS routing.
- Azurite support for local storage emulation where needed.

### 3.2 Configuration Strategy
- Keep connection strings, JWT settings, LINE, and YouTube values in environment configuration.

## 4. Feature Plan and Usage Map

### 4.1 Auth and Onboarding
- Guest session bootstrap.
- LINE OAuth login/link flow.
- Persistent auth through HttpOnly cookie.

### 4.2 Group Management
- Discover church and subgroup hierarchy.
- Join request and invite workflows.
- Leader/co-leader moderation for approvals, rejections, role changes, removals.
- Subgroup creation and group closure controls.

### 4.3 Content and Page Management
- Create group-scoped and global pages.
- Draft to group-visible to public visibility lifecycle.
- Edit page composition using typed sections.
- Maintain internal navigation via section links.

### 4.4 Sermon Experience
- Public sermon listing for users.
- Admin-triggered YouTube synchronization for catalog freshness.

### 4.5 Admin Operations
- Restricted admin actions including sermon sync.
- Health/readiness endpoints for operational monitoring.

## 5. Frontend Delivery Plan

### 5.1 Frontend Stack
- React + TypeScript + Router + Tailwind + Axios.
- Auth provider and role-aware route guards.

### 5.2 Route and Screen Strategy
- Home, sermons, group detail, group management, page rendering, page editor, onboarding, admin.
- Role-based UI exposure for leaders and admins.

### 5.3 PWA Strategy
- Manifest for installability and app identity.
- Service worker caching policy: network-first for API, cache-first for assets.
- Offline shell fallback and mobile install support.

## 6. Validation and Refinement Plan

### 6.1 Technical Validation
- Verify deployment wiring, CORS + credential flow, auth cookie behavior.
- Validate DB constraints and membership role/status rules.
- Verify page visibility and multilingual slug behavior.

### 6.2 Product Validation
- Pilot with small user group.
- Collect usage feedback on onboarding, group flows, and page editing.
- Iterate on UX and release readiness checkpoints.

## 7. Immediate Next Actions
1. Confirm target environments and secret inventory.
2. Finalize OIDC and CI/CD permissions.
3. Execute migration and deployment dry run.
4. Run smoke tests across auth, groups, pages, sermons, and admin.
5. Start pilot rollout and collect iteration backlog.
