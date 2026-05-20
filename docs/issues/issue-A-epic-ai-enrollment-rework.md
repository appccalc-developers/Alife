# [Epic] AI Enrollment Rework + Shared AI Session Facility

<!-- Issue title: [Epic] AI Enrollment Rework + Shared AI Session Facility -->
<!-- Labels: enhancement, Cloudflare, epic -->
<!-- Milestone: Alife AI-Native Core (MVP) -->

## Overview

Issue #84 implemented event enrollment via a stateless Cloudflare Worker that walked users through a
name → consent → file-upload loop using `window.prompt`/`window.confirm`. The UX is poor, the AI
usage is superficial, and there is no session persistence.

This epic replaces that implementation and, at the same time, extracts a reusable
**AI Session Facility** (frontend + Cloudflare Durable Object) that will serve both event creation
and enrollment today, and Memory Harvesting / Automated Witness Walls (#73) in the future.

## Goals

1. Replace the prompt/confirm enrollment loop with an AI chat dialog that mirrors the `EventCreatorView` pattern.
2. Extract the AI session logic from `EventCreatorView`/`worker/extractor.ts` into a reusable facility consumed by both event creation and enrollment.
3. Use a Cloudflare Durable Object session for enrollment (same as events), replacing the stateless `worker/enrollment.ts` handler.
4. Lay the groundwork for #73 (Memory Harvesting & Automated Witness Walls) to consume the same facility.

## Non-Goals

- Changes to the backend enrollment API (`EventEnrollmentsController`, `EnrollGroupEventCommandHandler`) are out of scope unless a schema change is required.
- Mobile-native features, push notifications, or offline-first enrollment are out of scope for this epic.

## Dependency Map

| Issue | Title | Depends on |
|-------|-------|-----------|
| **B** | Extract reusable AI Session Facility (Frontend + Cloudflare DO) | — |
| **C** | Replace enrollment prompts with AI chat dialog + "Create Enrollment" action | B |
| **D** | Migrate EventCreator AI flow to shared AI facility | B |
| **#73** | Memory Harvesting & Automated Witness Walls | B (shared facility) |

## Delivery Order

1. Issue B — shared facility foundation (unblocks all downstream)
2. Issue C — enrollment UX rewrite (uses facility from B)
3. Issue D — event flow migration onto facility (uses facility from B)
4. Issue #73 — memory harvesting / witness walls (uses facility from B)

## Open Questions / TBD

- **Enrollment data model**: Fields beyond `eventId`, name, consent, and payment file URLs?
  (e.g. dietary requirements, emergency contact, family size)
- **Session scope**: Per member+event pair? Per device? Expiry/retention policy?
- **File handling UX**: Attach files inline in chat, or as a final step after the draft is confirmed?
- **AI output contract**: Strict JSON schema + validation rules (matching EventDto approach)?
- **i18n**: Bilingual prompts/responses required for enrollment (zh + en)?
- **Consent wording**: Legal/compliance text to include in the consent step?
- **Failure fallback**: Manual form fallback if Gemini is unavailable?

## References

- Closed: #84 (prior enrollment implementation, now to be replaced)
- Future: #73 (will consume the shared AI facility)
- `frontend/alife-app/src/views/EventCreatorView.tsx` — event chat UI pattern to replicate
- `frontend/alife-app/worker/extractor.ts` — `EventPlanningSession` DO to generalize
- `frontend/alife-app/worker/enrollment.ts` — stateless handler to replace
