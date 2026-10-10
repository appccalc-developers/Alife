# [Epic] AI Enrollment Rework + Shared AI Session Facility

<!-- Issue title: [Epic] AI Enrollment Rework + Shared AI Session Facility -->
<!-- Labels: enhancement, Cloudflare, epic -->
<!-- Milestone: Alife AI-Native Core (MVP) -->

## Current Implementation Status

The epic has effectively landed in the current codebase:

- Shared AI session infrastructure exists in `frontend/alife-app/worker/ai-session.ts`.
- Frontend AI session helpers exist in `src/services/aiSessionService.ts` and `src/hooks/useAiSession.ts`.
- Event planning, enrollment, and review each have Durable Object-backed session implementations:
  - `worker/eventplanner.ts`
  - `worker/enrollment.ts`
  - `worker/review.ts`
- Cloudflare bindings are registered in `frontend/alife-app/wrangler.jsonc` as `EVENT_SESSIONS`, `ENROLLMENT_SESSIONS`, and `REVIEW_SESSIONS`.
- Enrollment commits now use `POST /api/events/{eventId}/enrollments`.
- Reviews use `POST /api/events/{eventId}/reviews`.

## Original Goal

Replace the old prompt/confirm enrollment flow with a conversational AI workflow and extract reusable AI session primitives for current and future AI-native features.

## Delivered Shape

1. Shared Durable Object base: `AiChatSession<TDraft, TContext>`.
2. Shared frontend service factory: `createAiSessionService<TDraft, TContext>()`.
3. Shared React hook: `useAiSession<TDraft, TContext>()`.
4. Event planning route family: `/api/events/session/*`.
5. Enrollment route family: `/api/enrollments/session/*`.
6. Review route family: `/api/reviews/session/*`.
7. Backend commit endpoints under `/api/events/{eventId}/enrollments` and `/api/events/{eventId}/reviews`.

## Remaining Follow-Up Candidates

- Decide retention/expiry policy for Durable Object session state.
- Add a manual enrollment fallback for Gemini outages.
- Add broader end-to-end coverage for event creation, enrollment, review, and restore flows.
- Confirm bilingual consent wording and any ministry-specific enrollment fields.

## Current References

- `frontend/alife-app/worker/ai-session.ts`
- `frontend/alife-app/worker/eventplanner.ts`
- `frontend/alife-app/worker/enrollment.ts`
- `frontend/alife-app/worker/review.ts`
- `frontend/alife-app/src/services/aiSessionService.ts`
- `frontend/alife-app/src/hooks/useAiSession.ts`
- `frontend/alife-app/src/components/group/EnrollmentChatDialog.tsx`
- `frontend/alife-app/src/views/EventEnrollmentView.tsx`
- `backend/src/Alife.Api/Controllers/EventEnrollmentsController.cs`
- `backend/src/Alife.Api/Controllers/EventReviewsController.cs`
