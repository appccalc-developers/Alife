# Extract Reusable AI Session Facility (Frontend + Cloudflare DO)

<!-- Issue title: Extract reusable AI Session Facility (Frontend + Cloudflare DO) -->
<!-- Labels: enhancement, Cloudflare -->
<!-- Milestone: Alife AI-Native Core (MVP) -->
<!-- Part of Epic: Issue A -->

## Current Implementation Status

Implemented.

## Delivered Scope

### Cloudflare Worker Layer

- `worker/ai-session.ts` provides a generic `AiChatSession<TDraft, TContext>` Durable Object base.
- The base supports `/message`, `/state`, `/stream`, `/start`, and `/close`.
- Session implementations provide system instructions, Gemini response schemas, draft normalization, validation, formatting, and context-building.
- Durable Object namespaces in `wrangler.jsonc`:
  - `EVENT_SESSIONS`
  - `ENROLLMENT_SESSIONS`
  - `REVIEW_SESSIONS`

### Frontend Service + Hook Layer

- `src/services/aiSessionService.ts` provides `createAiSessionService<TDraft, TContext>(basePath)`.
- `src/hooks/useAiSession.ts` encapsulates SSE subscription, state hydration, message dispatch, and API error normalization.
- `src/types/aiSession.ts` contains shared frontend session types.

### Current Consumers

- Event planning: `worker/eventplanner.ts`, `src/views/EventCreatorView.tsx`, `/api/events/session/*`.
- Enrollment: `worker/enrollment.ts`, `src/views/EventEnrollmentView.tsx`, `/api/enrollments/session/*`.
- Review: `worker/review.ts`, `src/views/EventReviewView.tsx`, `/api/reviews/session/*`.

## Verification

Use:

```bash
cd frontend/alife-app
npm run build
npm run test:worker
```

## Follow-Up Candidates

- Add session TTL and cleanup expectations.
- Add more failure-mode tests around malformed AI JSON, missing Gemini configuration, and SSE reconnects.
- Consider a typed wrapper per feature where route-specific app context becomes repetitive.
