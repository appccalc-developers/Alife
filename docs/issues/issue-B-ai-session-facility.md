# Extract reusable AI Session Facility (Frontend + Cloudflare DO)

<!-- Issue title: Extract reusable AI Session Facility (Frontend + Cloudflare DO) -->
<!-- Labels: enhancement, Cloudflare -->
<!-- Milestone: Alife AI-Native Core (MVP) -->
<!-- Part of Epic: Issue A -->

## Context

The AI chat session logic is currently tightly coupled to two files:

- `frontend/alife-app/worker/extractor.ts` — `EventPlanningSession` Durable Object + Gemini call
- `frontend/alife-app/src/views/EventCreatorView.tsx` — session ID management, SSE subscription, chat state

Enrollment (Issue C) and future features (Issue #73) need the same primitives. This issue extracts
them into a shared, reusable facility.

## Scope

### Cloudflare Worker layer

- Extract a generic `AiChatSession` Durable Object base class / factory from `EventPlanningSession` that:
  - Holds `chatHistory`, `currentDraft`, and a `legacySummary`-equivalent context field
  - Exposes `/message` (POST), `/state` (GET), `/stream` (GET SSE) sub-routes
  - Accepts a pluggable Gemini system instruction + JSON response schema at construction time
  - Validates AI output against the caller-supplied schema
- Keep `EventPlanningSession` as a thin wrapper over the shared base (no behavior change)
- Register an `ENROLLMENT_SESSIONS` Durable Object namespace in `wrangler.jsonc`
- Route `/api/enrollments/session/...` to the enrollment DO (analogous to `/api/events/session/...`)

### Frontend service + hooks layer

- Extract a generic `createAiSessionService(basePath: string)` factory in `src/services/` returning:
  - `sendMessage(sessionId, message, inputMode)` → `AiSessionResponse<T>`
  - `getState(sessionId)` → `AiSessionState<T>`
  - `createStream(sessionId)` → `EventSource`
- Keep existing `eventService` session methods unchanged (thin wrappers)
- Provide `enrollmentSessionService` using the same factory
- Extract a `useAiSession<T>(sessionId, basePath)` custom hook encapsulating SSE lifecycle + message dispatch

### Types (`src/types/aiSession.ts`)

- `AiSessionState<T>` — generic session state with `draft: T | null`, `chatHistory`, `updatedAt`
- `AiSessionResponse<T>` — generic response from a message send

## Acceptance Criteria

- [ ] `EventPlanningSession` continues to work without behavior change (existing tests pass)
- [ ] `EnrollmentSession` Durable Object exists and accepts pluggable system instruction + schema
- [ ] Generic frontend service factory and `useAiSession` hook exist
- [ ] `npm run test:worker` passes with updated/added tests covering generic session lifecycle
- [ ] `wrangler.jsonc` includes the `ENROLLMENT_SESSIONS` DO binding and migration

## Files Likely Touched

- `frontend/alife-app/worker/extractor.ts`
- `frontend/alife-app/worker/index.ts`
- `frontend/alife-app/wrangler.jsonc`
- `frontend/alife-app/src/services/eventService.ts` (thin wrapper refactor)
- `frontend/alife-app/src/services/enrollmentSessionService.ts` (new)
- `frontend/alife-app/src/hooks/useAiSession.ts` (new)
- `frontend/alife-app/src/types/aiSession.ts` (new)
- `frontend/alife-app/worker/index.test.mjs`
