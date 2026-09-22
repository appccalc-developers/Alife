# Event Workspace reference pages

> Pilot and reference specifications, 2026-09-15. The preparation overview and details workspace are the selected implementation pilot. See the [pilot record](references/preparation-pilot/README.md) for inspected fixtures and screenshots; user acceptance remains pending. Follow [Workspace design](EVENT-WORKSPACE-DESIGN.md) and [Visual tokens](EVENT-UI-VISUAL-TOKENS.md).

## Start with one part

The user-authorized [2026-09-22 editorial refinement](EVENT-PREPARATION-EDITORIAL.md) is the current saved-preparation candidate and includes its four-stage entry rail. The older Prism screenshots below remain historical references for creation/details, not evidence of the current saved overview. The new slice reuses existing specialist and approval editors.

Choose one bounded Event area, implement and inspect it, then refine before expanding to the rest of the workspace. The following are candidates, not authorization to build them all. The Event preparation overview is a useful first candidate because it can exercise domain colour, state graphics, depth and nonlinear selection together. The user selected the preparation overview and shared details/AI workspace on 2026-09-15. Other module interiors and the global stage rail remain outside this pilot.

Use actual supported fields and authorized projections. Prototype fixtures must be clearly identified in development/review material and must not imply a delivered capability. Preserve current routes, drafts and business gates while changing presentation.

## Candidate reference areas

| Area | What the visual design should communicate | Useful graphics | Key boundary |
| --- | --- | --- | --- |
| Personal Event work list | which Events need this actor's work, current stage, date, responsibility and direct workspace entry | adopted poster; otherwise stage/date artwork; responsibility icon | actor-filtered summaries only; artwork does not confer access or invent Event content |
| Event preparation overview | current stage, incomplete areas, blockers, current responsibility and next action | domain regions, readiness segments, stage band, inspector relationship | four existing stages; nonlinear preparation; explicit approval/publication gates |
| Event Package approval | source readiness, decision state, blockers, who decides and what the decision enables | checkpoint, source groups, blocker markers, decision history | readiness is not approval; approval does not publish or open registration |
| People, roles and handoffs | requirements, assignments, acceptance, outstanding responses | role slots, people groups, confirmation markers | distinguish teams, roster assignments and `TEAM.WORK` tasks; do not expose unauthorized identities |
| Place & Resources | venue/room booking, capacity, time scope and conflicts | occupancy strips, capacity bars, reservation blocks | catalogue management and Event ownership confer different permissions; equipment inventory is not delivered |
| Safeguarding | applicability, missing requirements and authorized next action | magenta/plum identity, shield, protected regions and requirement markers | no restricted child detail in a general overview; domain colour is not an alarm |

Plan B is not planned and has no reference page or rollout slot. Risk assessment remains an existing specialist capability. Registration and report surfaces can later reuse the pilot's state grammar without collapsing their independent procedure, seat, payment or report states.

## Composition examples

### Preparation overview

Keep Event title, date/zone, occurrence scope and the four-stage rail compact. Let the main planning surface show real domain state before navigation. Selecting a region should reveal its details with a strong selected treatment and, where the work fits, an inspector. On narrow screens use a focused view/disclosure with a clear way back to the same context.

Preparation areas have no imposed filling order. Submission readiness and approval/publication checkpoints remain apparent. A returned Package may direct work back to an affected domain; that is a real dependency, not a requirement to repeat every preparation screen.

### Personal Event work list

Lead with a 16:9 Event image and keep the decision data immediately below it: stage, date, bilingual title, current responsibility and one workspace action. Prefer the adopted Event poster. The fallback is a recognizable stage/date composition, never fabricated promotional content. Search, empty, loading, error and pagination states retain the same access boundary and do not require an unrestricted Event fetch.

The implemented 2026-09-22 slice was inspected in the authenticated local desktop app at approximately 1380px in Chinese and English with three owner-visible Events. The three-column layout, fallback artwork, stage/date metadata, titles, owner labels and existing workspace links were visible together. The running backend had not yet reloaded the added date/poster summary fields, so the browser correctly showed the unknown-date fallback; adopted-poster rendering is covered by the code/fixture path but was not visually accepted in that live session. Production build and source-level responsive breakpoints passed; a 320px browser capture remains pending and this record is **implemented and desktop-inspected, not user-accepted**.

### Approval

Make the current decision distinguishable from readiness and domain identity. Use the gate, blocker summary and current decision state as the main visual hierarchy. Keep explicit labels for consequential actions. Show expired/invalidated/returned states distinctly, with a short reason and details. Preserve history and server-defined authorizations.

### Specialist areas

Use people clusters for assignment awareness and blocks/bars for space and capacity. Retain tables for precise comparisons or long lists where they work better. Safeguarding uses the same six depth levels and state markers but only exposes information allowed for the current role. Rendering all areas in a common visual family does not merge their permissions or APIs.

## Pilot acceptance

- Meaningful colour, shape and depth are plainly visible in the rendered working area.
- Capability/module cards use ALIFE Prism Glass, with functional domain tint, translucent surfaces, fixed reflected light and state-appropriate depth. Verify composited text contrast, reduced transparency and forced colours; surfaces outside the pilot retain their own materials.
- Users can identify the current scope, what needs attention, and the next permitted action without reading long introductory paragraphs. Observe this with realistic tasks; do not claim a five-second result without measuring it.
- Graphics distinguish the states that matter in that area; short labels/icons supplement ambiguity. Detailed reasons remain accessible on touch and keyboard.
- Selected, focused, hovered, pending, successful, failed, unavailable and read-only presentations remain distinguishable.
- A successful save/approval marker appears only after actual success; failure preserves recoverable work.
- Inspect Chinese and English at 320px mobile and desktop widths around the existing 1024px breakpoint and 1280px. Check long names, large counts and zoom/reflow as applicable.
- Check reduced motion, text/graphic contrast, keyboard navigation, focus return and usable touch targets.
- Verify existing route/return behavior, drafts and language changes; presentation changes do not change permissions, readiness or approval gates.

## Establishing references

Once the pilot has been exercised and reviewed, keep dated screenshots and short notes with the design documentation, preferably under `references/` next to this file. Record viewport, language, state, role/data fixture, source revision and what was actually checked. Never include real private participant data.

State whether a reference is proposed, implemented, inspected or accepted. Describe the principle to preserve, such as selection depth, information density or blocker treatment. New screens reuse the established patterns; they need not duplicate the exact layout. Expand rollout only after evaluating the first part's effect.
