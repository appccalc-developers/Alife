# Alife Implementation Tracking Plan

## 1. Scope and Objectives
- Build and run Alife as a reliable church operations platform.
- Confirm that core flows work for members, leaders, and admins.
- Prepare a pilot launch with clear pass or fail criteria.

## 2. Workstreams

### 2.1 Platform and Architecture
- Confirm clear ownership of system parts:
  - Data model and church rules.
  - Business workflows.
  - Integrations and security.
  - API endpoints for app screens.
- Ensure the structure stays maintainable as features grow.

### 2.2 Environment and Configuration
- Define environment matrix:
  - Local, PR preview, staging (optional), production.
- Validate required settings for each environment:
  - DB connection.
  - JWT issuer/audience/key.
  - Frontend base URL and CORS origins.
  - LINE client credentials and callback URI.
  - YouTube API key and playlist ID.
- Confirm secure storage in GitHub secrets and Azure app settings.
- Confirm who owns each environment and who approves production changes.

### 2.3 Deployment and CI/CD
- Confirm GitHub Actions pipeline steps:
  - Restore, build, publish backend.
  - Build frontend.
  - Deploy Static Web App + API.
  - PR environment lifecycle.
- Integrate or verify migration execution strategy:
  - Controlled migration step using DbMigrator.
  - Failure handling and rollback guidance.
- Validate OIDC federation:
  - App registration, federated credential subject, role assignment scope.
- Confirm release approvals and rollback responsibility are documented.

### 2.4 Data and Persistence
- Validate EF Core migrations apply cleanly.
- Validate critical constraints:
  - Unique LINE identity behavior.
  - Group membership role/status constraints.
  - Page slug uniqueness per scope/language.
- Confirm seed strategy for local/dev usability.
- Confirm backup and restore expectations for production data.

### 2.5 Security and Authorization
- Validate auth cookie behavior:
  - HttpOnly, SameSite/secure policy by environment.
- Validate middleware and claim extraction.
- Validate server-side permission checks for protected actions.
- Validate admin-only operations and failure responses.
- Confirm least-privilege access for operations and support roles.

### 2.6 Feature Delivery

#### Authentication and Onboarding
- Guest session bootstrap.
- LINE login callback/linking.
- Registration completion profile updates.

#### Group Management
- Church fetch and subgroup discovery.
- Join requests and invitations.
- Approval/rejection lifecycle.
- Co-leader assignment and member removal.
- Group closure workflow.

#### Page and Section CMS
- Create/update/delete pages.
- Publish visibility transitions.
- Create/update/delete/reorder sections.
- Replace section links and verify rendering.

#### Sermons and Admin
- Sermon listing performance and sorting.
- Admin sermon sync execution and idempotent updates.

#### Leadership Acceptance Check
- Can a first-time user join smoothly?
- Can leaders manage requests and co-leaders without support help?
- Can ministry staff publish and update pages quickly?
- Can admins run sermon sync confidently and verify results?

### 2.7 Frontend and UX
- Route guard validation (leader/admin/onboarding).
- State consistency for auth and membership-aware UI.
- Error/loading handling coverage.
- Language toggle behavior and slug routing.

### 2.8 PWA and Reliability
- Validate manifest metadata and installability.
- Validate service worker strategy:
  - Network-first API behavior.
  - Cache-first static assets.
  - Offline fallback experience.
- Validate mobile behavior (Android and iOS constraints documented).
- Confirm acceptable user experience when internet is unstable.

## 3. Milestones and Exit Criteria

### M1: Foundation Complete
- CI/CD deploys from default branch.
- OIDC auth and permissions confirmed.
- Health endpoints green after deploy.
- Ownership list and escalation contacts confirmed.

### M2: Feature Readiness
- All critical journeys pass smoke tests.
- Security checks pass for protected routes/actions.
- DB constraints validated against edge cases.
- Leadership walk-through completed and signed off.

### M3: Pilot Launch
- Pilot cohort configured.
- Monitoring dashboard and alert channels ready.
- Feedback loop and triage process active.
- Pilot communications prepared for church users.

### M4: Production Hardening
- Incident runbook and rollback checklist confirmed.
- Secret rotation and access reviews scheduled.
- Performance baselines recorded.
- Monthly governance review cadence agreed.

## 4. Test Matrix (Must-Pass)
- Auth:
  - Unauthenticated access blocked where required.
  - Guest and registered token lifecycle validated.
- Groups:
  - Invite/request/approve/reject/kick workflows.
  - Leader and co-leader permissions.
- Pages:
  - Draft/group/public visibility and slug resolution.
  - Section content and links correctness.
- Sermons:
  - Sync upsert behavior and user listing parity.
- Platform:
  - Deployment, health checks, telemetry signal.

## 5. Risks and Mitigations
- Risk: Cross-origin cookie misconfiguration.
  - Mitigation: Environment-specific CORS and cookie policy validation gates.
- Risk: Migration drift across environments.
  - Mitigation: Controlled migrator step and release checklist enforcement.
- Risk: Role/state inconsistency in membership workflows.
  - Mitigation: Scenario tests for all status transitions and authorization checks.
- Risk: External API failures (LINE/YouTube).
  - Mitigation: Timeout/retry strategy and clear operator alerts.
- Risk: User confusion during onboarding and approvals.
  - Mitigation: Short guided instructions and quick support fallback path.

## 6. Operational Checklist
- Pre-deploy:
  - Secrets present, DB reachable, OIDC principal valid.
- Deploy:
  - Build success, migration success, deployment success.
- Post-deploy:
  - Health ready, login path, one protected action, one content action, sermon list.
- Release:
  - Stakeholder sign-off and pilot communications.

## 7. Ownership Template
- Product owner: priorities, acceptance criteria, pilot feedback.
- Tech lead: architecture guardrails and readiness sign-off.
- Dev team: implementation and automated tests.
- Ops/DevOps: pipeline, OIDC, secrets, observability.
- Ministry representatives: workflow validation and adoption feedback.

## 8. Next Action Queue
1. Confirm environment matrix and naming.
2. Lock required secrets and OIDC role scope.
3. Confirm production ownership and release approval path.
4. Run migration and deployment dry run.
5. Execute must-pass smoke suite.
6. Start pilot and collect backlog candidates.
