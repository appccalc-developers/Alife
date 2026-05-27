# Migrate EventCreator AI Flow To Shared AI Facility

<!-- Issue title: Migrate EventCreator AI flow to shared AI facility -->
<!-- Labels: refactor, Cloudflare -->
<!-- Milestone: Alife AI-Native Core (MVP) -->
<!-- Part of Epic: Issue A -->

## Current Implementation Status

Implemented.

## Delivered Shape

- `EventCreatorView` uses the shared AI session hook/service flow.
- `eventService` wraps `createAiSessionService<EventDto, EventDto['legacySummary']>('/api/events/session')`.
- `worker/eventplanner.ts` implements the event-specific Durable Object session on top of the shared `AiChatSession` base.
- The route family remains `/api/events/session/*`, with `/api/events/extract` retained for compatibility through the same planner entry point.

## Important Code References

- `frontend/alife-app/src/views/EventCreatorView.tsx`
- `frontend/alife-app/src/services/eventService.ts`
- `frontend/alife-app/src/hooks/useAiSession.ts`
- `frontend/alife-app/worker/eventplanner.ts`
- `frontend/alife-app/worker/ai-session.ts`

## Verification

```bash
cd frontend/alife-app
npm run build
npm run test:worker
```

## Follow-Up Candidates

- Add browser-level regression tests for event create, edit, restore, and session close behavior.
- Revisit whether the compatibility `/api/events/extract` route is still needed.
