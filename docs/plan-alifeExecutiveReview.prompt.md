# Alife Executive Plan

## Goal
Launch a church app that is easy to use, safe for member data, and dependable for weekly ministry operations.

## Strategic Outcomes
- Help newcomers and members onboard smoothly.
- Let leaders manage groups and member requests without manual spreadsheets.
- Publish church pages and sermon updates quickly.
- Release updates safely with less downtime risk.

## Architecture Snapshot
- Website and mobile-friendly app for members.
- Cloudflare hosting for the member app and Azure hosting for the API/data layer.
- Central database for member, group, and page data.
- Integrations for LINE sign-in, sermon updates from YouTube, image handling, and AI-assisted event workflows.
- Session security designed to protect member accounts.

## Feature Portfolio
- Member onboarding:
  - First-time visit, LINE login, profile completion, and phone-based invitations where applicable.
- Group life management:
  - Group structure, join requests, invitations, approvals, leader assignments.
- Content publishing:
  - Church pages and group pages with simple section-based editing.
- Sermon sharing:
  - Sermon listing for members with admin sync from YouTube.
- Admin oversight:
  - Restricted admin tools and health checks.

## Deployment Strategy
- Automated deployment from GitHub to Cloudflare and Azure.
- Preview links for reviewing changes before release.
- Secure deployment sign-in using modern cloud identity.
- Release sequence: update database, deploy app, run quick business checks.

## Delivery Phases
1. Foundation
- Finalize environments, ownership, and security setup.

2. Release Readiness
- Verify onboarding, group workflows, and page publishing journeys.

3. Production Rollout
- Run launch checklist, deploy, and monitor service health.

4. Adoption and Iteration
- Pilot with real church users, collect feedback, and improve quickly.

## KPIs
- Onboarding completion rate (guest to registered).
- Group request approval turnaround.
- Page publishing frequency and sermon engagement.
- Release success rate and recovery time if issues occur.

## Immediate Decisions Needed
- Production environment naming and ownership.
- Data and security policy ownership.
- Release gate criteria (must-pass business checks).
- Pilot cohort scope and success metrics.
