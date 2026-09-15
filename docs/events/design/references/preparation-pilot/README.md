# Preparation overview and details pilot — 2026-09-15

Status: implemented and inspected with fixtures, including the user's ALIFE Prism Glass material refinement. User visual acceptance is pending. This pilot covers the preparation overview and shared details/AI workspace, not the global stage rail or specialist module interiors.

## Reproduction

Run Vite from `cloudflare/alife-app`, then run `tests/eventDetailsWorkspace.browser.cjs`. The test uses fixture-only application APIs and AI replies; no real person, Event, microphone or provider is used. Set `ALIFE_PLAYWRIGHT_MODULE` to an existing Playwright module and optionally `ALIFE_BROWSER_EXECUTABLE` to an installed browser. It defaults to Chinese and English at 320, 768, 1024 and 1280px, with a 1000px viewport height and reduced motion. Screenshots are written to the system temporary directory as `alife-pilot-*`.

The 768px fixture represents a recurring gathering; the other widths represent a one-off community meal. The viewer is a fictional authorised QA Leader. The overview can show twelve real module identities, including partial/unavailable capability markers, without implying those capabilities are delivered.

For saved preparation, run `tests/eventSetupFlow.browser.cjs` with `ALIFE_QA_DETAILS_ONLY=1`; this checks current saved records, explicit saving, managed registration capacity, read-only browsing and the existing approval freeze. `tests/eventDetailsVoice.browser.cjs` mocks browser speech recognition and checks cleanup and recovery without microphone access.

## Visual principles to retain

- Domain colours and shapes remain stable while enabled, confirmation, unsaved and capability states remain distinguishable.
- ALIFE Prism Glass is the module cards' material: translucent domain-coloured bodies, fixed upper-left reflected light, visible edges and depth according to interaction. Forms and conversation bubbles retain their existing materials. Reduced transparency provides an opaque domain surface; forced colours retains system surfaces and outlines.
- Cards use natural height with 2/3/4/6 columns. The Event context is compact; templates and relevant/all filtering remain independent of editor selection.
- Desktop form and assistant appear together only when the viewport is at least 1024px and workspace content is at least 880px; narrower layouts use one keyboard-operable tablist.
- Current-language fields appear first. Missing translations remain visible in disclosure summaries; pending-field links reveal the missing language or time-zone editor before focus.
- The warm left/right conversation remains recognisable. AI adoption changes only the draft, with brief field feedback and a separate sufficiency disclosure.
- Read-only users can switch and expand authorised content. Existing frozen preparation routes retain their server-governed boundary.

## Inspected references

The screenshots below are full-page captures refreshed after the Prism Glass refinement, with the page reset to the top so fixed navigation keeps its normal position. The source manifest records the base revision and SHA-256 hashes of the pilot files. Screenshot data is synthetic. Existing fixed navigation and the development cache inspector may overlap part of a full-page capture.

| Surface | Chinese | English |
| --- | --- | --- |
| Desktop overview, 1280px | [Overview](overview-zh-1280.png) | [Overview](overview-en-1280.png) |
| Desktop form and assistant, 1280px | [Workspace](form-zh-1280.png) | [Workspace](form-en-1280.png) |
| Mobile overview, 320px | [Overview](overview-zh-320.png) | [Overview](overview-en-320.png) |
| Mobile form, 320px | [Form](form-zh-320.png) | [Form](form-en-320.png) |
| Mobile assistant, 320px | [Assistant](assistant-zh-320.png) | [Assistant](assistant-en-320.png) |

Automated checks passed for new and saved details in both languages at 320/768/1024/1280px, plus voice/chat scenarios at 320/768/1280px. The selected English phone/desktop cases additionally verify rendered domain text contrast (at least 4.5:1), keyboard tab navigation and static reduced-motion field feedback. The creation arrangements fixture passes at 1280px in Chinese, including independent disclosure, confirmation invalidation, venue capacity/conflicts, retained private RAM draft and idempotent retry. These are observed fixture outcomes, not user acceptance or a timed usability result.

After the Prism Glass refinement, the new-details fixture was rerun in both languages at all four widths. It samples the browser-composited material with card text and unrelated fixed chrome temporarily hidden for measurement; normal screenshots retain the application UI. The minimum normal-text contrast across those samples is 5.61:1. The English 1280px run also checks hover/selection depth, keyboard focus, opaque reduced-transparency rendering and forced-colour outlines. Narrow card headers stack the graphic over the label based on content width; the English runs assert that Registration, Safeguarding and Programme remain whole words. The final production stylesheet was rebuilt after that wrapping correction.

## Evidence limitations

Fixtures validate UI behaviour and request boundaries, not live AI semantic quality or production authorization. No deployment, database migration, real event creation or publication is part of this pilot. Screenshot acceptance by the user and wider rollout remain separate steps.

The older full saved-preparation browser script outside DETAILS_ONLY still has stale registration fixture assumptions (the current registration-rule editor expects an event start instant). It was not used as evidence of complete specialist-workflow regression. The dedicated saved pilot covers the changed surface, explicit saves, read-only permissions and existing freeze gate.
