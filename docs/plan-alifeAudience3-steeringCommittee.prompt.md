# Alife Plan (Audience 3: Steering Committee - Business + Technical)

## Purpose
Provide a shared plan that aligns ministry outcomes, product priorities, technical delivery, and operational risk management.

## 1. Program Outcomes
- Improve newcomer and member onboarding completion.
- Enable leaders to manage group growth with less administrative friction.
- Increase consistency and speed of church content and sermon publishing.
- Deliver updates safely with measurable reliability and governance.

## 2. Solution Overview

### 2.1 What We Are Building
- A web and mobile-friendly church platform with:
  - onboarding and identity verification
  - group and membership workflows
  - page-based content publishing
  - sermon discovery and sync

### 2.2 How It Runs
- Frontend hosted on Cloudflare Workers.
- Backend API on Azure Functions.
- Data in Azure SQL.
- External services for LINE sign-in, YouTube sermon import, image handling, and AI-assisted event workflows.

### 2.3 Why This Architecture
- Scales with ministry demand and reduces infrastructure overhead.
- Separates business rules from infrastructure for easier future changes.
- Supports secure deployment and operational visibility.

## 3. Feature Portfolio and Business Usage

### 3.1 Member Onboarding
- Guest start, LINE sign-in, profile completion, and phone-based member invitation where applicable.
- Usage goal: reduce friction in first-time and returning user access.

### 3.2 Group Operations
- Group hierarchy, invite/request flows, approval and role management.
- Usage goal: empower leaders and co-leaders to run healthy group operations.

### 3.3 Content Publishing
- Church and group pages with section-based editing.
- Visibility controls for draft, internal, and public content.
- Usage goal: publish announcements and ministry content quickly.

### 3.4 Sermons
- Member-facing sermon list.
- Admin-triggered YouTube sync to keep catalog current.
- Usage goal: improve content freshness with lower manual effort.

## 4. Deployment and Governance Plan

### 4.1 Release Flow
- GitHub-based automated deployment to Cloudflare and Azure.
- Preview environments for stakeholder sign-off before production.
- Controlled release sequence: migration, deploy, smoke validation.

### 4.2 Security and Access Governance
- OIDC-based deployment identity (no long-lived deploy secrets).
- Least-privilege RBAC assignments.
- Named owners for production access, release approval, and incident response.

### 4.3 Data and Compliance Governance
- Secret ownership and rotation policy.
- Data backup/restore expectations and rehearsal cadence.
- Audit-ready operational logs and health monitoring.

## 5. Delivery Model

### Phase 1: Foundation
- Environment ownership, security setup, and deployment baseline complete.

### Phase 2: Readiness
- Critical journeys validated:
  - onboarding
  - group approvals
  - page publishing
  - sermon sync

### Phase 3: Pilot
- Limited rollout to selected church users.
- Weekly feedback review and backlog prioritization.

### Phase 4: Production Hardening
- Incident runbook, alerting thresholds, and governance cadence finalized.

## 6. Success Metrics (Committee View)
- Onboarding completion rate.
- Group request turnaround time.
- Publishing velocity for pages and sermons.
- Release success rate and issue recovery time.
- Pilot satisfaction trend and support ticket volume.

## 7. Decision Log Needed from Committee
1. Pilot scope and timeline.
2. Release gate criteria and sign-off model.
3. Production ownership matrix.
4. Risk tolerance for phased feature rollout.
5. Monthly governance review format.

## 8. Immediate Next Steps
1. Confirm cross-functional owners (product, engineering, operations, ministry reps).
2. Approve release checklist and go/no-go criteria.
3. Execute a dry-run release with migration and smoke tests.
4. Start pilot and report KPI baseline at week 1 and week 3.
