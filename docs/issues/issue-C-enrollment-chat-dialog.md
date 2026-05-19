# Replace enrollment prompts with AI chat dialog + explicit "Create Enrollment" action

<!-- Issue title: Replace enrollment prompts with AI chat dialog + explicit "Create Enrollment" action -->
<!-- Labels: enhancement, Cloudflare -->
<!-- Milestone: Alife AI-Native Core (MVP) -->
<!-- Part of Epic: Issue A — Depends on Issue B -->

## Context

The current enrollment UX (from #84) uses `window.prompt` / `window.confirm` / a hidden file input
looped from `useGroupScreen`. This is not suitable for a mobile PWA, is not conversational, and
integrates AI only superficially (Gemini generates prompt text, not a conversation).

This issue replaces it with an AI chat dialog mirroring `EventCreatorView`, backed by a Cloudflare
Durable Object session from Issue B.

**Depends on:** Issue B (shared AI facility).

## Scope

### New component: `EnrollmentChatDialog`

- Modal/sheet dialog opened when the user clicks "Enroll" in `GroupToolsDrawer`
- Chat window (same bubble layout as `EventCreatorView`)
- AI collects enrollment fields via conversation (name, consent, and any additional fields agreed in Issue A)
- Shows enrollment draft preview (applicant name, consent status, payment files)
- "Attach Payment Files" action available inline in chat or as a final step
- **"Create Enrollment" button** rendered below the draft preview — calls the backend commit API
- Bilingual support (zh/en) following the app's language setting

### Worker: `EnrollmentSession` DO (via facility from Issue B)

- System instruction focused on enrollment data collection
- Response schema matching enrollment fields agreed in Issue A
- Session key: `member-{memberId}-event-{eventId}-enrollment`

### Frontend wiring

- `enrollmentSessionService` (from Issue B) drives the dialog's chat
- Remove the multi-step `enrollEvent` loop from `useGroupScreen`
- Remove stateless `eventService.enrollEvent` call
- Replace `onEnrollEvent` prop in `GroupToolsDrawer` with `onOpenEnrollDialog`

### Backend commit step

- Calls existing `POST /api/group/{groupId}/enroll` — no backend changes required unless the data
  schema agreed in Issue A requires new fields

## Acceptance Criteria

- [ ] "Enroll" button in `GroupToolsDrawer` opens `EnrollmentChatDialog` instead of browser prompts
- [ ] Chat collects required fields; draft preview is shown
- [ ] **"Create Enrollment" button** appears below the draft and commits the enrollment via the backend API
- [ ] Users can attach payment files during or after the chat collection step
- [ ] Dialog handles loading, error, and success states
- [ ] Bilingual prompts/responses rendered per app language setting
- [ ] Old `enrollEvent` prompt/confirm loop removed from `useGroupScreen`
- [ ] Stateless `worker/enrollment.ts` handler replaced or removed; enrollment routes through DO session

## Files Likely Touched

- `frontend/alife-app/src/components/group/EnrollmentChatDialog.tsx` (new)
- `frontend/alife-app/src/components/group/GroupToolsDrawer.tsx`
- `frontend/alife-app/src/hooks/useGroupScreen.ts`
- `frontend/alife-app/src/views/GroupDetailView.tsx`
- `frontend/alife-app/src/services/enrollmentSessionService.ts` (from Issue B)
- `frontend/alife-app/worker/enrollment.ts` (replaced/removed)
- `frontend/alife-app/worker/index.ts`
