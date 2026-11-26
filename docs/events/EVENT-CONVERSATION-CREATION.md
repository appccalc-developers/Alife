# Conversation creation — implementation plan

User-selected direction, 2026-11-07: use the approved Anhe character and warm-paper interactive prototype in the real Alife creation flow. This is a new optional creation surface; the existing form mode remains available.

## Goal and work sequence

1. Add a reachable conversation/form mode selector to creation. Retain template selection, the current account/group-scoped draft, and the approved character identity. Keep fixed copy in feature-scoped i18n.
2. Support explicitly started voice conversation: transcribe a turn, organise draft details and projects using existing AI validation patterns, show adopted fields immediately, optionally speak the reply, and listen again only while the user keeps the mode running. Provide pause, correction and text fallback.
3. Hand the same draft to existing project/arrangement review and final creation. Preserve version/signature checks, server composition, idempotency, required specialist gates and explicit human acceptance. Conversation cannot confirm policies, book rooms, create or publish an Event.
4. Verify microphone lifecycle, stale/error responses, bilingual draft shapes, project identity/confirmation invalidation, authenticated group access, locale/type checks and responsive rendered UI. Record fixture versus live-provider evidence separately.

## Boundaries

Use the current React, draft state, Gemini configuration and backend/Worker responsibilities. No new provider, dependency, database migration or deployment. The character is the approved 3D-rendered artwork, not a rigged/lip-synced model. Voice recognition uses the supported browser service, with explicit privacy disclosure and no audio storage by Alife. Unsupported/denied recognition retains text and manual controls. Do not infer consent, booking, safety completion or publication from the conversation.

The existing details session only accepts Event details. Project assistance before creation needs a separate group-scoped entry using the existing activity-plan schema and the backend's Event-creation authorization check. Existing saved-Event form-assistance requests remain unchanged. No group/member records enter provider context; responses remain private/no-store. The current Event contract and creation arrangement gates retain authority over this presentation.

## Acceptance

- The group leader can select a template and start/pause a conversation without typing; microphone access is never requested on load.
- Transcript, bilingual Event details, and proposed project list are reviewable. Failed, stale or invalid replies preserve the previous draft and current message.
- Changing mode/language, hiding the page or leaving creation stops recognition and playback. Late completions cannot restart either or overwrite a changed draft.
- Project suggestions preserve stable IDs and occurrence links. Changed projects need fresh human review. No generated policy answers are treated as confirmed.
- Final review and creation use existing validators and API contracts; creation never implies publication.
- Desktop and 320px layouts preserve readable character, conversation, draft and next actions in both languages.

## Local implementation and verification — 2026-11-07

Local implementation is complete for this scope. Entry: existing Event creation → select a template → Talk with Anhe. The default form flow remains available. Production character assets are under `cloudflare/alife-app/public/event-companion/`; `/images/` is reserved for the image proxy and is deliberately not used.

- `npm run test:event-conversation`: 33 cases passed (atomic adoption, scoped parsing, DST rejection, project identity, confirmation invalidation, existing creation/arrangement/idempotency gates).
- Details/form-assistant regressions: 18 cases passed. `npm run test:locale`: seven checks passed. Frontend `npm run typecheck` passed.
- Worker `npm run test:creation-assistance`: passed current-source handler checks for absent authentication, denied/malformed group authority, another viewer, strict input, private/no-store responses, provider input exclusion and provider failure/truncation. No provider or backend writes occurred.
- Actual React creation page, local Vite and browser-controlled fixture: opt-in microphone starts at zero; first meal turn updates details/projects; subsequent turn changes attendance 12→16; undo restores 12; failure preserves transcript/draft; retry succeeds; pause during delayed AI prevents adoption. Permission error pauses; mode switching stops recognition and does not restart it. Chinese/English switching preserves draft and transcript. At 320px, conversation, dialogue and draft containers have no internal horizontal overflow. Approved artwork loads on desktop/mobile.
- Final review displays projects/attendance; creation disabled before human acceptance, enabled after acceptance, and disabled again following a draft change. Explicit confirmation emitted exactly one simulated create request with bilingual data, current project identity, schema `2.0.0`, and correct Auckland UTC conversion, then navigated to the returned Event setup URL. No publish request was emitted.

Reproduction fixture and screenshots: `C:/Data/Alife/Temp/event-conversation-implementation-20261107/` (`serve.mjs`, `desktop-zh.png`, `mobile-zh.png`, `mobile-en.png`, `review-zh.png`, `review-en.png`). Start the fixture with installed Node 22 and open its printed localhost URL; visible QA controls simulate microphone/provider outcomes. The temporary verification server was stopped after review.

Limitations: recognition, synthesis, identity, compose and create responses in browser verification were fixtures. The compose fixture omitted required specialist modules; their existing validation is covered by focused unit checks, not a full real-policy browser run. No real microphone, live Gemini, authenticated backend create/persistence, saved-Event workspace, deployment or Git publication was verified. Voice quality/latency depends on the browser and configured provider. Each turn uses two existing-provider requests. This scoped completion does not declare Event-wide delivery complete.

## Page refinement — 2026-11-07

Preserved the approved character assets, warm-paper/green identity, bilingual draft and creation gates. Conversation mode now has compact context/navigation with the mode control in the same desktop row; the form keeps its normal shell. Rebalanced the three-column canvas, increased body/metadata readability, grouped microphone controls, and disclosed the full privacy explanation beneath an always-visible auto-send notice. Tablet/phone users can jump to the draft or return to conversation with keyboard focus and reduced-motion-aware scrolling. Empty history retains the welcome message; update/undo/playback notices translate when language changes.

Verification: frontend typecheck and seven locale checks passed. Actual React browser fixture verified conversation adoption, preserved transcript/draft across language and mode changes, privacy disclosure, focused draft/return jumps, and the final disabled/enabled human-confirmation gate. Inspected Chinese and English desktop (1366×900), tablet (768×1024), and narrow phone (320×800); English also inspected at 390×844. The conversation/dialogue/draft containers did not overflow at 320px. Screenshots: `C:/Data/Alife/Temp/event-conversation-polish-20261107/`. Provider/microphone remain simulated; this refinement adds no live service or deployment verification.

## Isolated PR verification — 2026-11-07

Tracking: [Issue #848](https://github.com/appccalc-developers/Alife/issues/848).

Re-tested only this feature on a clean worktree based on main at `02243dca`; unrelated staged/unstaged work was excluded. The isolated source passed 33 creation/conversation cases, 17 details/form regression cases, seven locale checks, three PWA privacy/cache regression cases and the Worker authority/privacy/provider-failure test. The earlier shared-worktree count of 18 details/form cases included an unrelated field-review test, which is deliberately outside this PR.

The first complete production build identified an oversized portrait in the install-time PWA precache. The approved PNG bytes are unchanged; `event-companion/**` is now excluded from precache instead of increasing the global limit. Artwork remains a public on-demand asset and is not guaranteed offline. A fresh `npm run build -- --outDir C:/Data/Alife/Temp/event-conversation-pr-build-verified` passed TypeScript, Vite and service-worker generation (145 precache entries). Both distributed character files match the source bytes, and neither is in the generated precache. Existing large 3D chunk warnings remain outside this scope.

Browser checks against the isolated source verified opt-in recognition, meal adoption, 12→16 correction, undo, failure preservation/retry, bilingual and mode continuity, desktop and 320px rendering, focus navigation, and human acceptance becoming invalid after a draft change. Explicit acceptance emitted one simulated create request with bilingual fields, schema 2.0.0, 16 guests and correct Auckland UTC times, then navigated to the returned setup URL. Real speech/Gemini, backend persistence, full specialist-policy composition and the saved workspace remain unverified. These are local/fixture checks, not production certification.

Reproduce the browser fixture from the repository root with Node 22: `node cloudflare/alife-app/tests/fixtures/eventConversation.browser.mjs`. Open its printed localhost URL, select the meal template and conversation mode, explicitly start speech, and use the labelled QA controls. It binds only loopback, mocks all API and speech responses, and makes no real backend/provider writes. Stop with Ctrl+C. The fixture sets its working directory for Tailwind's relative content globs. The verification server was stopped after testing.

Review evidence: [Chinese desktop](evidence/conversation-20261107/desktop-zh.png), [English mobile](evidence/conversation-20261107/mobile-en.png). Both show fictional QA data. Local build log and additional screenshots: `C:/Data/Alife/Temp/event-conversation-pr-evidence/`.
