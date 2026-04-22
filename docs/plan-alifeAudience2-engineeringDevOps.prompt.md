# Alife Plan (Audience 2: Engineering + DevOps)

## Objective
Deliver Alife with production-grade reliability, security, and operability across app, API, and data layers.

## 1. Architecture and Platform Baseline

### 1.1 System Topology
- Frontend: React + TypeScript SPA/PWA on Azure Static Web Apps.
- Backend: .NET isolated Azure Functions API.
- Data: Azure SQL (EF Core migrations via DbMigrator).
- Integrations: Twilio Verify, LINE OAuth, YouTube Data API.
- Auth: JWT in HttpOnly cookie with server-side authorization checks.

### 1.2 Backend Layering Rules
- Domain: entities/enums only, zero infra dependencies.
- Application: CQRS handlers, DTOs, validation, business policies.
- Infrastructure: EF Core, external adapters, cache, security wiring.
- API: HTTP contracts/controllers, middleware pipeline, DI composition root.
- Enforce dependency direction: API -> Application -> Domain, Infrastructure -> Application + Domain.

### 1.3 Core Domain Boundaries
- Members and identity lifecycle (guest -> verified -> registered).
- Group hierarchy + membership state machine.
- Page/Section content model with visibility controls.
- Sermon catalog synchronization boundaries and idempotency.

## 2. Delivery and Release Engineering

### 2.1 Environment Matrix
- local: Docker/compose with SQL Server and optional Caddy.
- preview: PR-based Static Web Apps environment.
- prod: managed Azure resources and locked configuration.

### 2.2 CI/CD Pipeline Contract
- Trigger: push/PR events on default branch policy.
- Steps:
  - restore/build test backend
  - build frontend
  - run lint/type checks
  - run migrations gate (dry run or controlled apply)
  - deploy Static Web Apps + API
  - execute smoke tests
- Required outcomes:
  - deterministic build
  - artifact traceability
  - explicit fail-fast conditions

### 2.3 OIDC and Access Model
- GitHub Actions to Azure via OIDC federation.
- No long-lived cloud credentials in repo.
- RBAC scoped to resource group with least privilege.
- Deployment identity ownership and break-glass process documented.

### 2.4 Data Migration Strategy
- DbMigrator as the only production schema mutation path.
- Pre-deploy backup checkpoint for critical releases.
- Post-migration integrity checks for key constraints.
- Roll-forward preferred; rollback playbook documented.

## 3. Security and Compliance Controls

### 3.1 Authentication and Session Controls
- Cookie flags validated per environment (Secure, HttpOnly, SameSite).
- Token claim minimalism and expiration policy validated.
- CORS with credentials explicitly configured and tested.

### 3.2 Authorization Controls
- Role checks for leader/co-leader/admin operations.
- Membership status transitions validated against policy.
- Negative-path testing for protected endpoints (401/403 correctness).

### 3.3 Secrets and Configuration
- Centralized secret inventory:
  - DB connection
  - JWT key/issuer/audience
  - Twilio creds
  - LINE creds
  - YouTube key/playlist
- Rotation cadence and owner assigned.

## 4. Feature Implementation Matrix

### 4.1 Auth and Onboarding
- Guest bootstrap endpoint path.
- Phone OTP start/confirm flow.
- LINE login callback/link behavior.
- Registration completion and profile persistence.

### 4.2 Groups
- Church/group/subgroup read paths.
- Join/invite/approve/reject workflows.
- Co-leader assignment and member kick.
- Group close operation and UI/API parity.

### 4.3 Pages and Sections
- Page CRUD + visibility transitions.
- Section CRUD + ordering + link replacement.
- Multilingual slug handling and collision policy.

### 4.4 Sermons and Admin
- Sermon read endpoint performance targets.
- Admin sync trigger idempotency and stale-record behavior.

## 5. Reliability, Observability, and Quality Gates

### 5.1 SLO-Oriented Checks
- Availability target defined for API and app.
- Error budget policy for release velocity decisions.

### 5.2 Telemetry
- Structured logs with request correlation.
- Health/readiness probes validated.
- Alerting on auth failures, sync failures, and DB connectivity.

### 5.3 Test Gates (Must Pass)
- Unit tests for handlers and domain rules.
- Integration tests for critical API workflows.
- Smoke tests after deploy:
  - login path
  - protected endpoint access
  - group approval action
  - page publish action
  - sermon list render

## 6. Milestones
1. Platform Hardening
- OIDC, RBAC, secrets, environment parity complete.

2. Functional Readiness
- Critical user journeys validated end to end.

3. Release Candidate
- Migration + deploy + smoke fully green in controlled run.

4. Production Operability
- Alerting, runbook, and incident response drill complete.

## 7. Action Queue
1. Finalize pipeline gates and branch protections.
2. Lock secret inventory and assign owners.
3. Validate cookie/CORS behavior in preview and production.
4. Run migration rehearsal and failure-path simulation.
5. Publish go-live checklist with clear approval owners.
