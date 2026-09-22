# Event Workspace design

> Adopted design direction, 2026-09-15. Revised from the four external Event UI proposals supplied by the user, incorporating the user's five design decisions. Adoption of this guidance is not evidence of a completed UI rollout.

## Scope and authority

This is the visual and interaction direction for Event management workspaces: preparation, role-specific work, registration operations, occurrence delivery and follow-up. Member-facing Event Detail and public church pages retain their own design language.

Use the [task reading matrix](../AGENTS.md#task-reading-matrix): read only the design sections affected by the task. The [core and delegated topics](../EVENT-CONTRACT.md) govern business meaning, authorization and readiness; inspect matching [machine-contract](../event-contract.json) entries only when exact values/interfaces are involved. This document governs Event-specific visual choices instead of the general workspace's restrained green/coral palette. It does not replace the global shell, existing framework, bilingual contracts or server authority.

Supporting documents:

- [Visual tokens](EVENT-UI-VISUAL-TOKENS.md): the authoritative palette, six depth levels and visual state grammar.
- [Reference pages](EVENT-UI-REFERENCE-PAGES.md): pilot selection and page acceptance criteria; these are specifications until rendered examples exist.
- [Cheatsheet](EVENT-UI-CHEATSHEET.md): a short execution reminder; it does not redefine tokens or business rules.

The companion [collaboration implementation (#784)](https://github.com/appccalc-developers/Alife/issues/784) delivers role/stage workspaces separately. This guidance does not depend on its code or import its new feature contract. Render capabilities according to the version actually available.

## Experience

**Saved-preparation refinement, 2026-09-22:** the user selected a bright architectural-magazine direction and authorized local implementation. The [editorial saved workspace](EVENT-PREPARATION-EDITORIAL.md) supersedes Prism Glass for this bounded overview: warm paper, generous typography, an asymmetric brief/approval spread and restrained domain-coloured selections. Creation, specialist interiors and other areas retain their existing materials. Four-stage navigation, six-level interaction depth and all business boundaries still apply.

**Personal Event work list, 2026-09-22:** the actor-filtered list uses image-led Event cards rather than text-only work rows. An adopted Event poster is the preferred artwork. When none is available, the card renders an explicitly decorative stage/date composition rather than inventing a poster or Event fact. Date, current responsibility and the existing workspace action remain readable outside the artwork. This list pattern is a bounded warm-paper surface, not a rollout of Prism Glass to navigation or all Event cards.

Event Workspace should feel colourful, dimensional, responsive, approachable and information-rich. Colour, shape, spatial grouping, icons, depth and purposeful motion should help people see the Event's condition and decide what to do next.

Use Material 3 Expressive as the principal reference for colour, shape, containment and feedback, and Fluent 2 for depth and coherent transitions. Apply those principles through existing Alife components and styling. This is not a requirement to install either component framework.

Use **ALIFE Prism Glass** for Event capability cards: translucent coloured surfaces, reflected light, functional colour coding and spatial depth form one material language. Apply it primarily to meaningful workspace objects such as modules, documents, approvals, resources and status cards. The preparation pilot implements module cards first; other surfaces require their own inspection. The [material tokens](EVENT-UI-VISUAL-TOKENS.md#alife-prism-glass-material) govern contrast, opacity, reflection, fallbacks and accessibility.

Richness must be visible in the working surface: recognisable domain regions, meaningful graphics, clear selection and prompt feedback. A few coloured badges added to otherwise unchanged navigation do not by themselves satisfy this direction. Large neutral or lightly tinted surfaces give those signals room to work.

Keep Alife typography, global navigation conventions, accessible control behaviour and bilingual content. The canvas can be the screen's signature element and contain several meaningful domain colours; the general advice to concentrate visual boldness does not limit it to one coloured domain.

## Stages and preparation

Use the existing stage identifiers and bilingual UI labels:

| Identifier | English | 中文 |
| --- | --- | --- |
| `preparation` | Preparation | 筹备 |
| `registration` | Published | 公布 |
| `execution` | Delivery | 执行 |
| `followup` | Follow-up | 收尾 |

The stage rail presents those four stages. `registration` remains the compatible identifier for the period after publication; displaying Published does not imply registration has opened. A separate future Review/Reflection stage is not part of the current model. Existing document reviews and approval decisions remain their own actions, not a new Event lifecycle stage.

**Preparation uses nonlinear planning.** People, venue, programme, registration rules, reports and other authorized planning areas can be revisited in the order the work requires. Remove the requirement to preserve an owner's six-step wizard. Existing stage URLs and numeric step identifiers are compatibility details, not prescribed navigation order.

Nonlinear planning still has real process boundaries:

- Human creation establishes one persisted Event; moving around it does not create another Event or save a draft.
- Preparation requirements determine submission readiness; submit, approval decision and explicit publication remain distinct governed actions.
- Approval freezes the applicable preparation; material changes and reopening retain existing server checks and approval invalidation.
- Publication, opening registration, occurrence execution and follow-up retain their own eligibility and explicit actions. A stage click never performs those transitions.
- Poster preparation/adoption follows the existing approval boundary and remains separate from publication.

Show readiness and gates beside the nonlinear planning areas. A gate may have a visual checkpoint, but must not become a compulsory series of unrelated preparation forms. Registration work that is authorized during preparation remains accessible there. Recurring delivery and follow-up are occurrence-specific; do not close the whole series when one occurrence finishes.

## Current scope

**Plan B is not planned.** Do not add a Plan B page, decision branch, timer, default response, readiness requirement or placeholder navigation. Revisit this guidance if the product decision changes. Existing RAM risk assessment and mitigation continue independently of that excluded feature.

Show only real, authorized capability and data. The companion collaboration scope limits finance to registration fees and food to reports; earlier versions may expose neither. Equipment inventory and broader budget operations remain outside that scope. A proposed graphic does not establish a new business capability. Capability availability, applicability, readiness and permissions stay distinct.

## Visual understanding with less text

Prefer graphics that carry useful information: role slots and avatar groups, capacity bars, labelled counts, schedule bands, readiness segments, resource occupancy and approval checkpoints. Use familiar silhouettes and simple supplementary icons when shape and colour cannot distinguish the meaning alone.

Use a consistent visual grammar rather than a growing collection of badges. Domain colour answers what an area concerns; marker shape and icon express its business state; depth expresses interaction. Do not overwrite domain identity with a full red or green background on state changes.

Reduce repeated visible labels and explanatory paragraphs. Domain names, important quantities/units, deadlines, action names and short blocker reasons remain where they help a user decide. Specific reasons, history and supporting detail belong in an inspector or expandable region. A destructive or approval action keeps an explicit action label and consequence.

All meaningful graphics and icon-only controls have bilingual accessible names. Explanations must be available on keyboard focus and touch as well as hover. Never require animation, hue recognition or a tooltip to discover a critical blocker. Unknown, loading, failed, unavailable and unauthorized data must not look complete or not applicable. Only an authoritative decision can produce an approved seal; a readiness check does not confer approval.

## Composition

- **Compact context:** Event name, time/zone, occurrence scope, stage and important signals. Keep the operational title area compact.
- **Planning surface:** connected regions, groups, lanes or compact objects with current state, responsibility and useful quantities. Use connections only where they describe a real dependency.
- **Contextual inspector:** focused details and bounded edits beside the selected area on desktop. Preserve drafts, keyboard focus and deep links. Large specialist work can use a dedicated page with a clear return path.
- **Gates and actions:** prominent blockers, submission/approval state and the next authorized action. Permissions come from current server projections.

Use stable grouping. Give important conditions more visual emphasis without unexpectedly rearranging controls while the user is working. A planning region must communicate something useful before opening it. Tables and cards remain valid when they are the clearest representation of the content.

Desktop should expose several useful signals at once. Mobile transforms the same model into compact regions, disclosures and focused work surfaces. Preserve domain identity and state meanings; do not shrink a desktop diagram into unreadable controls. Retain single-level tabs where appropriate and existing list filtering, sorting and pagination.

For the personal Event work list, use one column on narrow screens, two at medium widths and three only when the content region can support the card title, date and action without crowding. The image remains 16:9; long titles wrap to two lines, responsibility text stays outside the image, and the action keeps a usable touch target. Search and result count stack on narrow screens.

## Six depth levels and motion

Use the single six-level model in [Visual tokens](EVENT-UI-VISUAL-TOKENS.md#depth): 0 canvas, 1 resting, 2 interactive, 3 selected, 4 inspector/floating tools, 5 modal/critical interruption. Perceived depth and CSS stacking order are related but are not interchangeable.

Motion communicates press, selection, expansion, movement, relationship, pending work and completion. Keep it quick, interruptible and coherent. Use a small reusable set of curves and durations; repeated bounce, continuous decorative movement and elaborate entrance sequences do not help operational work.

Provide immediate local response to an action and show a pending state during the request. Display saved, approved or published only after authoritative success. On failure, preserve drafts and expose a clear recovery action. Reduced-motion presentation retains the same final state and meaning.

## Pilot before rollout

Implement one bounded area first, inspect and use it, then refine before expanding to other Event screens. Candidate areas and acceptance checks are in [Reference pages](EVENT-UI-REFERENCE-PAGES.md). The selected preparation overview/details pilot is recorded in [Reference pages](EVENT-UI-REFERENCE-PAGES.md); selection and implementation do not establish user acceptance.

Record desktop/mobile screenshots, both languages, data/role assumptions and actual interaction observations. Ask users to identify what needs attention and the next action; treat quick recognition as a usability question to test, not a proven outcome. Build success alone does not establish visual acceptance.

## Reference basis

- [Google's Material 3 Expressive research](https://design.google/library/expressive-material-design-google-research): published research on colour, shape, size, containment and motion. This supports the reference choice, not a claim that Alife users have validated this design.
- [Fluent 2 elevation](https://fluent2.microsoft.design/elevation) and [motion](https://fluent2.microsoft.design/motion): hierarchical depth, understandable transitions and accessible movement.
- [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum): check actual text/background pairs.
