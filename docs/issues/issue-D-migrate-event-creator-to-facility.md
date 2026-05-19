# Migrate EventCreator AI flow to shared AI facility

<!-- Issue title: Migrate EventCreator AI flow to shared AI facility -->
<!-- Labels: refactor, Cloudflare -->
<!-- Milestone: Alife AI-Native Core (MVP) -->
<!-- Part of Epic: Issue A — Depends on Issue B -->

## Context

After Issue B extracts the shared AI Session Facility, the event creation/edit flow in
`EventCreatorView` and `worker/extractor.ts` should be migrated to consume it. This validates the
facility contract and eliminates duplicated session logic.

**Depends on:** Issue B (shared AI facility).

## Scope

### Frontend

- Refactor `EventCreatorView` to use the generic `useAiSession<EventDto>` hook from Issue B,
  removing inline session ID management, SSE subscription setup, and message dispatch code.
- Keep all event creation/edit behavior and UI unchanged.

### Worker

- Refactor `worker/extractor.ts` so `EventPlanningSession` is a thin wrapper of the shared base
  class from Issue B, delegating Gemini calls, schema validation, and SSE broadcast to the base.
- No route or behavior changes.

## Acceptance Criteria

- [ ] `EventCreatorView` uses `useAiSession<EventDto>` hook (no inline SSE/state management code)
- [ ] `EventPlanningSession` is implemented as a thin wrapper over the shared facility base class
- [ ] All existing `npm run test:worker` tests pass unchanged (no behavior regressions)
- [ ] Event creation, edit, and session restore behaviors are unchanged end-to-end

## Files Likely Touched

- `frontend/alife-app/src/views/EventCreatorView.tsx`
- `frontend/alife-app/worker/extractor.ts`
- `frontend/alife-app/src/services/eventService.ts`
