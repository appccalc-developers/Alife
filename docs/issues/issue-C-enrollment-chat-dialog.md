# Replace Enrollment Prompts With AI Chat Dialog + Explicit Create Enrollment Action

<!-- Issue title: Replace enrollment prompts with AI chat dialog + explicit "Create Enrollment" action -->
<!-- Labels: enhancement, Cloudflare -->
<!-- Milestone: Alife AI-Native Core (MVP) -->
<!-- Part of Epic: Issue A -->

## Current Implementation Status

Implemented in the current architecture, with route-level enrollment instead of the older `GroupToolsDrawer` entry point.

## Delivered Shape

- `EnrollmentChatDialog` provides the conversational UI.
- `EventEnrollmentView` owns the route-level enrollment workflow at `/groups/:groupId/events/:eventId/enroll`.
- `enrollmentSessionService` uses the shared AI session service for chat state and message handling.
- `worker/enrollment.ts` hosts the enrollment Durable Object session.
- Payment proof image files are uploaded before commit and included in the enrollment JSON payload.
- Completed drafts are committed through `POST /api/events/{eventId}/enrollments`.

## Important Code References

- `frontend/alife-app/src/components/group/EnrollmentChatDialog.tsx`
- `frontend/alife-app/src/views/EventEnrollmentView.tsx`
- `frontend/alife-app/src/services/enrollmentSessionService.ts`
- `frontend/alife-app/worker/enrollment.ts`
- `backend/src/Alife.Api/Controllers/EventEnrollmentsController.cs`

## Acceptance Criteria Status

- [x] Chat dialog exists for enrollment.
- [x] Chat collects enrollment data and maintains a draft.
- [x] Explicit create/commit action exists in the route-level enrollment flow.
- [x] Payment proof image upload is supported.
- [x] Loading, error, and success states are represented.
- [x] Bilingual app context is passed into the AI session flow.
- [x] Old browser prompt/confirm loop is not present in `useGroupScreen`.
- [x] Enrollment routes through a Durable Object-backed AI session.

## Follow-Up Candidates

- Confirm final consent wording with stakeholders.
- Add e2e coverage for enrollment session restore, payment upload, commit, and duplicate enrollment handling.
- Add a manual fallback form for Gemini outages.
