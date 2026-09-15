# Event Workspace UI cheatsheet

Read [Workspace design](EVENT-WORKSPACE-DESIGN.md) for decisions, [Visual tokens](EVENT-UI-VISUAL-TOKENS.md) for exact visual guidance, and the relevant [reference area](EVENT-UI-REFERENCE-PAGES.md) before implementation.

## Product decisions

- Keep `preparation → registration → execution → followup`. Review/Reflection is a possible future decision, not a current fifth stage.
- Preparation is nonlinear. There is no requirement to preserve an owner's six-step wizard.
- Submission, approval, explicit publication, registration opening and execution keep their real server-defined gates. Navigation is not a business action.
- Plan B is not planned. Do not add a page, placeholder, timer or readiness condition for it.
- Pilot one part, inspect the result, then refine before wider rollout.

## Visual language

- Make colour, meaningful graphics, depth and quick feedback visible in the working surface.
- Event capability cards use ALIFE Prism Glass: translucent domain colour, reflected light and spatial depth. Treat it as the material of meaningful workspace objects (modules, documents, approvals, resources and status cards); keep text/state graphics opaque and verify composited contrast. Use the opaque fallback for reduced transparency.
- Domain identity stays stable; state markers overlay it. Safeguarding is Magenta/Plum.
- Prefer familiar graphics and simple supplemental icons to repeated prose. Keep necessary names, quantities/units, deadlines, action labels and short blocker reasons.
- Use bilingual accessible names and touch/keyboard-accessible detail. Critical meaning cannot depend on colour, motion or hover alone.
- Preserve separate capability, applicability, readiness, approval and permission dimensions. Registration procedure, seats and payment are also separate.
- Ready is not approved. A pending request is not saved. Unknown data is not complete.
- Reuse the palette, shape families and motion values from Visual tokens; do not create a new local palette for each feature.

## Six depth levels

| Level | Use |
| --- | --- |
| 0 | Canvas |
| 1 | Resting region |
| 2 | Interactive / hover |
| 3 | Selected region |
| 4 | Inspector / floating tools |
| 5 | Modal / critical interruption |

Selection and keyboard focus remain independently visible. Ordinary approval content is not automatically a modal.

## Layout and feedback

- Keep context compact; show real state before opening a planning region.
- Use groups, lanes, occupancy bars, role slots and decision checkpoints when they clarify the work.
- Prefer an inspector for bounded edits; large specialist work can keep a dedicated page and return link.
- Use desktop space for simultaneous useful signals; transform the layout for mobile while retaining the same visual meanings.
- Keep motion quick, interruptible and purposeful. Reduce movement when requested without losing meaning.
- Respond immediately, show pending work, confirm server success, and preserve drafts on failure.

## Before completion

Exercise the pilot in Chinese and English on mobile and desktop. Check real visual richness, state comprehension, contrast, keyboard/touch access, reduced motion, drafts and route compatibility. Record actual checks and screenshots; compilation alone is not visual acceptance.
