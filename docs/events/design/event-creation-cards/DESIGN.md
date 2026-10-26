# Event creation / capability cards — DESIGN.md

## Decision, scope and authority

Recorded **2026-10-10**. The user requests a livelier Event creation surface: clicking a capability card expands that same object from its position to fill the user's working area, exposes details, and animates back on return. This interaction direction is authorized; the Refero choice below is the designer's recommendation, not a claim of user acceptance of a rendered screen.

Scope: the Event creation arrangement/capability deck and its existing detail editors. This is a **target specification, not implemented behavior**. It adds a bounded presentation transition to [Workspace design](../EVENT-WORKSPACE-DESIGN.md). It does not restyle the saved [editorial preparation overview](../EVENT-PREPARATION-EDITORIAL.md), specialist interiors, member Event Detail or the global shell.

Business meaning remains in the [core and delegated contracts](../../EVENT-CONTRACT.md), especially [creation arrangements](../../CREATION-ARRANGEMENTS.md). Palette, state grammar, six depth levels and motion parameters remain owned by [visual tokens](../EVENT-UI-VISUAL-TOKENS.md). Follow the [reading matrix](../../AGENTS.md); common [UI/UX](../../../design/UI-UX.md) and [Alife frontend design](../../../../.agents/skills/alife-frontend-design/SKILL.md) still apply.

## Reference and character

**Recommended primary reference:** [Refero: LottieFiles — Bright motion studio with teal accent](https://styles.refero.design/style/a80507cb-afda-46dd-a2b9-ba91f3a78e78), inspected 2026-10-10. Borrow its bright creative-studio character, soft rounded containers, colourful content and quiet surrounding controls. Keep Alife's existing typography, domain colours and materials. This recommendation does not require the Lottie service, animation assets, another font or a new library.

**Secondary comparison:** [Refero: Duolingo](https://styles.refero.design/style/7088d695-362b-4e09-b325-fa8136d4f350) makes controls feel tactile through rounded shapes and clear edges. Borrow recognisable click/press feedback selectively; retain the adult community-work context and restrained working surface. [Refero: Lottielab](https://styles.refero.design/style/1f782141-d407-4c27-8cee-2246720a9f42) is a quieter alternative for tool hierarchy, with less of the desired colourful energy.

These are Refero's interpreted website style references. No referenced page was verified to implement the requested card-to-workspace morph. The transition below is an Alife interaction specification, not a copied or tested Refero feature.

**Character:** 活泼、亲切、有组织 / lively, welcoming, organised. The signature is an object opening into its own workspace. Motion explains where details came from and where they return; meaningful domain graphics supply the energy.

## Visual vocabulary

| Element | Direction |
| --- | --- |
| Canvas | Existing light creation surface; neutral surroundings let domain objects carry colour |
| Collapsed card | Existing Prism Glass tint/reflection and domain light/text pair; icon, readable name, useful count or signal, and unsaved/read-only/capability markers when relevant |
| Expanded surface | Opaque warm paper for reading and inputs, with the same domain icon, name and colour carried into its header; glass remains confined to appropriate object/header accents |
| Shape and depth | Major regions keep the established 16–20px corners; selection uses level 3, the temporary expansion layer may use level 4; a full content surface is not automatically a level-5 modal |
| Type and controls | Existing Latin/Chinese font stack and shared controls; card heading 16–18px, focused heading 20–24px, body 14–16px as pilot starting sizes; allow bilingual wrapping |
| Graphics | People/role slots, time bands, capacity blocks or report/document cues that explain the module; no invented totals or decorative completion percentages |

Retain functional domain colours from the token document. Success and approval markers come from authoritative outcomes, not the cheerful palette. Use a small lift and press response; avoid rotating cards, flashing lights, confetti, perpetual icon loops or repeated bounce across the deck. Text contrast, focus and touch feedback must survive the material transition.

## Card-to-workspace interaction

```text
Card deck → press card → same card expands → focused details / existing editor
Card deck ← restore position and focus ← same card contracts ← Back to cards
```

“整个用户区域” means the available **main content area** inside the existing application shell. The expanded surface occupies its full available width and at least its visible working height; long details scroll normally. It respects the application header, navigation, safe areas and existing save controls. It is not browser fullscreen and does not cover global navigation.

| Phase | Observable behavior |
| --- | --- |
| Rest / focus | Each card remains a semantic, labelled control; focus is separate from selected/hover depth. Relevant markers and concise status are readable before opening |
| Press | Immediate tactile response. Opening does not enable the module, confirm details, create an Event, save, approve or publish |
| Expand | Start from the clicked card's actual visible rectangle, including its scroll position. Its outline/background grows into the content area; title/icon remain recognisable. Sibling cards fade out without reordering or pushing the destination below the deck |
| Focused | One accessible detail/editor surface occupies the area. Header names the module and offers `← Back to cards / ← 返回卡片`; show availability, read-only state, explicit actions and relevant detail. Background deck controls leave the tab order/accessibility tree |
| Contract | Return reverses the spatial path to the source card, restores deck scroll/filter state and keyboard focus, and retains unfinished work |

Use shared-element geometry for the container and persistent identity elements. Reflow the real editor at destination dimensions; do not stretch input fields, text or an entire form with a scale transform. Details can fade in during the latter part of expansion, within the same overall duration. A visual transition copy is decorative and hidden from assistive technology; it never contains a second live form or focusable controls.

The focused view is a labelled working region, with focus moved to its heading using `preventScroll` once the real region is ready. It is not a modal and does not trap focus away from the global shell. Use the existing application dialog only when an actual confirmation requires interruption. Escape returns to cards when no child menu/dialog owns it and no in-progress operation needs its existing guard. The visible return action always remains available.

## Motion contract

Use the scoped expand/contract tokens in [Motion and feedback](../EVENT-UI-VISUAL-TOKENS.md#motion-and-feedback). Their **320ms expansion and 260ms contraction** are pilot defaults selected for Alife, not measured Refero timings. Let the shape ease into its destination with prompt press response and a gentle settle; do not overshoot the working area or bounce readable content. The transition must remain interruptible.

- Rapid open/close/open finishes in the latest requested view; no queued entrances, duplicate editors or stranded input blockers. Existing save/loading/disabled guards still apply.
- Keyboard activation, touch and pointer all open the same surface. Hover cannot be required to find controls or blockers.
- `prefers-reduced-motion: reduce` removes geometry movement, scaling, translation and elastic effects. Display the destination directly, preserve focus/return behavior and show pending status without moving decoration.
- Viewport resize, browser zoom, soft keyboard, page scroll and orientation change recompute valid geometry. If no reliable visible source exists (deep link, filtered-away card, restored route), enter or return directly to a stable view; do not animate from an invented corner or an offscreen rectangle.
- Freeze reflection/blur during movement; animate the container/identity with existing capabilities, without animating expensive backdrop filters. Reduced transparency and forced colours retain the token document's opaque/readable fallback.

## Drafts, routing and protected behavior

- Preserve the current visited-editor/draft lifetime. Open, close, reopen, module switching, animation interruption and language-only changes must not reset inputs or cause navigation-driven persistence/refetch. Hidden editors are not focusable and remain logically distinct from decorative animation layers.
- Use the existing compatible module selection and deep-link conventions. Browser Back/Forward restores the appropriate view; a refresh/deep link renders a valid focused view without requiring a prior card click. Card closure does not add a new stage or mandatory wizard step.
- Closing the card returns to the deck and retains the local draft. Leaving the Event or an existing discard action uses the current explicit dirty-work guard; cancelling preserves work. Distinguish local unsaved, saved, pending and failed states.
- Show only authorized capabilities and projections. A read-only detail may expand while editing remains disabled. Unavailable/configuration-disabled/unknown/error states explain themselves and never look ready. Revoked access follows existing denial/recovery paths without exposing cached private detail through a transition copy.
- Keep backend authorization, cache isolation, saved JSON and `{en, zh}` contracts intact. Opening a card does not send a mutation or confer permission. Actual save/create/confirm/approve/publish operations remain the existing explicit actions.

## Implementation entry and pilot acceptance

Current source inspected on 2026-10-10: [TileButtons](../../../../cloudflare/alife-app/src/components/events/ArrangementTileDeck.tsx), [creation arrangements and mounted editor selection](../../../../cloudflare/alife-app/src/components/events/creation/CreationSteps.tsx), [creation material CSS](../../../../cloudflare/alife-app/src/styles/eventPreparation.css). Current behavior selects and reveals an editor; this inspection does not establish an animated morph.

The project already declares Framer Motion in [package.json](../../../../cloudflare/alife-app/package.json). Reuse the existing framework, animation dependency and state/routing conventions; this document does not prescribe a replacement architecture. Start with one available creation capability before applying the transition to the deck. Keep the saved editorial surface outside the rollout.

| ID | Required pilot evidence |
| --- | --- |
| ECARD-01 | Pointer, Enter/Space and touch expand from the correct scrolled card to the bounded content area; return reaches the same card with position and focus restored |
| ECARD-02 | No document overflow, clipped controls or navigation/savebar overlap at 320/390/1024/1280px in zh/en; long labels, long detail, zoom/reflow and mobile keyboard remain usable |
| ECARD-03 | Open/close/reopen, sibling switching, language switching and Back/Forward retain drafts; direct entry/refresh and missing-source return are valid; no implicit mutation |
| ECARD-04 | Rapid reversal, loading, failed reads/saves, resize and orientation do not strand controls or duplicate live editors; unsupported animation degrades to a usable direct transition |
| ECARD-05 | Focus/return, screen-reader structure, touch targets, contrast, reduced motion, reduced transparency and forced colours pass; hidden/decorative copies are not announced or operated |
| ECARD-06 | Authorized edit, read-only and denied/revoked actors retain existing server boundaries; capability, confirmation, approval and publication stay distinct |

Record dated source scope, environment, fixture/role assumptions, both-language desktop/mobile screenshots and actual interaction observations under the [reference policy](../EVENT-UI-REFERENCE-PAGES.md). Screenshots demonstrate final states; also inspect the transition in motion. Ask users whether the source/destination relationship and return action are clear before wider rollout. Implementation, browser/provider/database checks and visual acceptance are currently pending.
