# Event Workspace visual tokens

> Adopted semantic design guidance, 2026-09-15. Values below are the semantic source of truth; the bounded preparation pilot implements these in eventPreparation.css. Other Event surfaces have not completed rollout. Read [Workspace design](EVENT-WORKSPACE-DESIGN.md) for scope and business boundaries.

## Domain palette

The [2026-09-22 saved editorial overview](EVENT-PREPARATION-EDITORIAL.md) uses opaque paper `#fffdf8`, ink `#18332d`, secondary text `#596a63`, separators `#d9dfd7` and a handover surface `#233e35` with `#fffdf8`/`#e2e9df` text. Domain light/text pairs below remain on symbols and selected entries; six depth levels and 3px keyboard focus remain. This scoped, user-selected material supersedes Prism Glass only for the saved overview, not the shared creation pilot.

Retain stable identity across pages and states. Safeguarding uses **Magenta / Plum**, consistently; Violet belongs to People & Teams. Domains may share a colour family when a different icon, shape and label distinguish their function. Colour alone is not the complete identifier.

| Domain / module | Family | Accent | Light surface | Text on light surface | Graphic cue |
| --- | --- | --- | --- | --- | --- |
| Event overview | Indigo | `#4F46E5` | `#EEF2FF` | `#3730A3` | connected context/stage band |
| People & Teams / `SERVICE.ROSTER` | Violet | `#7C3AED` | `#F5F3FF` | `#5B21B6` | people groups and role slots |
| Tasks and handoffs / `TEAM.WORK` | Violet | `#7C3AED` | `#F5F3FF` | `#5B21B6` | task/dependency marks |
| Place & Resources / `PLACE.RESOURCE` | Blue/cyan | `#0284C7` | `#F0F9FF` | `#075985` | reservation blocks/capacity |
| Safeguarding / `SAFEGUARDING.CHILD` | Magenta/plum | `#C026D3` | `#FDF4FF` | `#86198F` | shield/protected enclosure |
| Move & Stay / `MOVE.STAY` | Orange | `#EA580C` | `#FFF7ED` | `#9A3412` | directional path/vehicle |
| Communications / `COMMS.FOLLOWUP` | Rose | `#E11D48` | `#FFF1F2` | `#9F1239` | message/broadcast |
| Registration fees / `MONEY.FINANCE` | Teal | `#0F766E` | `#F0FDFA` | `#134E4A` | amount/receipt |
| Risk assessment / `SAFETY.RAM` | Amber | `#D97706` | `#FFFBEB` | `#92400E` | risk matrix/assessment |
| Registration / `PEOPLE.REGISTRATION` | Blue | `#2563EB` | `#EFF6FF` | `#1E40AF` | person/ticket/seat allocation |
| Programme / `PROGRAM.PRODUCTION` | Indigo | `#4F46E5` | `#EEF2FF` | `#3730A3` | timeline/session blocks |
| Hospitality reports / `FOOD.HOSPITALITY` | Orange | `#EA580C` | `#FFF7ED` | `#9A3412` | meal/report |
| Festival / `FESTIVAL.OPERATIONS` | Rose | `#E11D48` | `#FFF1F2` | `#9F1239` | festival with unavailable marker |
| Approval | Emerald | `#059669` | `#ECFDF5` | `#065F46` | decision checkpoint |
| Publication | Blue | `#2563EB` | `#EFF6FF` | `#1E40AF` | outward/publication marker |

The newly completed domain mappings are starting choices for the pilot. Availability remains governed by the capability catalogue; a palette row never enables a feature. Risk-domain amber does not replace the church's published RAM matrix colours or risk classification. Approval-domain green does not imply an approved decision.

Prefer neutral/lightly tinted large surfaces, distinct identity headers or graphics, and stronger selection. Treat the original neutral/domain/status area ratios as a balancing aid, not a quota. Make visual richness apparent without saturating every surface.

### Personal Event work card artwork

The personal work list uses a real adopted poster when present. Its fallback artwork uses the existing lifecycle stage only as an identity cue; it does not imply approval, readiness or publication. Keep the card body on warm paper/white with `#18332D` ink, `#596A63` secondary text, a `#DCE5E0` boundary and a deep-green `#173F36` workspace action. Stage fallbacks use these gradient families:

| Stage | Fallback artwork family | Light label surface / text |
| --- | --- | --- |
| `preparation` | indigo → violet | `#EEF2FF` / `#3730A3` |
| `registration` | cyan → blue | `#EFF6FF` / `#1E40AF` |
| `execution` | teal → emerald | `#ECFDF5` / `#065F46` |
| `followup` | deep rose → rose | `#FFF1F2` / `#9F1239` |

Poster images use `object-cover`, a useful bilingual alt description and an on-error return to the stage fallback. Decorative glow, date and briefcase marks are hidden from assistive technology. Hover may lift the card and scale a poster by at most 1.025; reduced motion removes both transforms. Keyboard focus remains a separate 3px blue ring.

## ALIFE Prism Glass material

**Prism Glass = translucent coloured surfaces + reflected light + functional colour coding + spatial depth.** It is the material language for meaningful workspace objects: Event capability/module cards, documents, approvals, resources and status cards. The preparation pilot applies it to its module cards; other object types adopt it when their own area is implemented and inspected.

The domain palette supplies the tint and deep text colour. A fixed upper-left reflection, a light inner edge and a shaded lower edge make the surface legible as glass. Resting, hovered and selected objects use the existing depth levels; selection and keyboard focus remain separate. Glass does not communicate a new status or change capability availability, permissions or business decisions. Large reading surfaces, form fields, conversation bubbles and the global shell keep their appropriate existing materials.

| Pilot material token / layer | Value and role |
| --- | --- |
| Translucent body | domain light surface at 78% opacity |
| Domain tint | same-domain accent from 6% to 18% opacity across the body |
| `--event-prism-reflection` | fixed 135° white reflection, 88% → 28% → transparent |
| `--event-prism-edge-light` | white top and side inset edges; shaded lower inset edge completes the thickness |
| `--event-prism-blur` | 10px backdrop blur, confined to the object |
| `--event-object-shadow` | resting/hovered/selected depth from the six-level model |

Measure contrast against the browser-composited surface, including tint and reflected light; normal text must remain at least 4.5:1 throughout the content area. Text and state graphics stay opaque. Reflections stay still, and hover never animates blur. Browsers without colour mixing/backdrop support use the opaque domain surface. Reduced transparency removes the translucent layers and blur; forced colours uses system surfaces, text and outlines. Reduced motion preserves the static material and removes movement.

简体中文：**ALIFE Prism Glass（棱光玻璃）**由半透明彩色表面、反射光、功能性领域配色与空间深度构成，是工作对象的材质语言。优先用于活动模块、文档、审批、资源及状态卡；当前试点已用于模块卡。文字和状态图形保持不透明，并核验合成后的对比度；减少透明度或强制颜色模式保留清晰的实体表面与边界。

繁體中文：**ALIFE Prism Glass（稜光玻璃）**由半透明彩色表面、反射光、功能性領域配色與空間深度構成，是工作物件的材質語言。優先用於活動模組、文件、審批、資源及狀態卡；目前試點已用於模組卡。文字與狀態圖形保持不透明，並核驗合成後的對比度；減少透明度或強制色彩模式保留清晰的實體表面與邊界。

## Text, surfaces and focus

| Semantic token | Starting value / role |
| --- | --- |
| `--event-canvas` | `#F8FAFC` |
| `--event-surface` | `#FFFFFF` |
| `--event-surface-subtle` | `#F1F5F9` |
| `--event-text` | `#0F172A` |
| `--event-text-secondary` | `#475569` |
| `--event-text-muted` | `#5C6C82`, checked on white, canvas and subtle surfaces |
| `--event-border` | `#E2E8F0`, decorative separation |
| `--event-border-strong` | `#64748B`, when a visible boundary identifies a control |
| `--event-primary` / `--event-on-primary` | `#4F46E5` / `#FFFFFF` |
| `--event-focus` | `#1D4ED8`, 3px outline with a 2px neutral separation |

Use a domain's text colour on its light surface. Accent values are not automatically safe text or filled-button backgrounds. Normal text requires at least 4.5:1 contrast; large text requires 3:1. For a filled domain control, use the deeper text colour as background with white text and check all interaction states. Check focus and essential graphics against their actual surrounding colours. Preserve forced-colour mode outlines.

Keep existing Latin/Chinese font stacks. Starting sizes: body 14–16px, metadata 12–13px, domain headings 16–18px, compact Event title 22–28px. Do not reduce essential text or touch targets to increase density. Maintain usable wrapping and bilingual accessible names.

## Visual state grammar

These are presentation mappings, not replacement API enums. Preserve each backend dimension and the exact accepted decisions. Use familiar shapes and small icons to reduce visible prose. An accessible description combines all relevant meanings; expanded detail explains the evidence.

| Dimension / meaning | Primary graphic | Supplemental cue / text when needed |
| --- | --- | --- |
| Not started | hollow progress marker | short accessible status |
| In progress | partially filled segments | completed/required count |
| Ready | complete segments + check | actual requirement count; no approval seal |
| Attention | amber dot/marker | attention icon or count |
| Warning | orange triangle | affected item and short reason |
| Blocked | red stop/octagon or blocker rail | concise reason and resolution action |
| Awaiting decision | checkpoint + clock/person | approver/deadline where relevant |
| Approved | seal/checkpoint check | authoritative decision, scope and validity |
| Returned/rejected | return arrow / cross at checkpoint | distinguish the actual decision in detail |
| Expired/invalidated approval | clock/slash at checkpoint | reason; cannot look currently approved |
| Not applicable | neutral dash | explain applicability on disclosure |
| Disabled by configuration | inactive tool/toggle marker | distinct from unavailable capability |
| Partial/unavailable capability | partial/absent tool marker | short capability label and current scope |
| Read-only/no action permission | lock or view icon | explain permitted action; disclose only authorized data |
| Unknown/loading/error | question / pending / error marker | no fabricated readiness or successful state |

Registration procedure, seat allocation and payment are separate dimensions. For example, a document check, seat marker and receipt marker can show verified materials, a waitlisted seat and an unpaid fee without one generic 'complete' badge. Provide exact counts/amounts/units where decisions depend on them. Reports retain draft/submitted/returned/adopted meanings independently of Package approval.

Priority is blocker, required decision, current work, warning, ordinary progress. Do not show every possible marker on every region. Display the useful current signals; disclose secondary facts in the inspector. Missing essential information cannot be hidden just to meet a low-text aesthetic.

## Shape and graphics

- Major regions: 16–20px corners; compact operational items: 8–12px; controls inherit usable existing geometry.
- People: circles, grouped avatars and role slots. Resources: blocks, occupancy strips and capacity bars.
- Decisions: checkpoint/notched marker with familiar decision icon. Warning: triangle; blocked: stop marker. Use real controls with accessible labels around decorative shapes.
- Dependencies: sparse connectors only for actual relationships; retain a text alternative in details.
- Prefer known quantities such as `8 / 10` roles to an unexplained percentage. Never infer readiness from field count or unloaded/private data.

## Depth

One model applies to all Event design documents and components:

| Level | Meaning | Starting shadow / visual treatment |
| --- | --- | --- |
| 0 | Canvas | none |
| 1 | Resting region | `0 1px 3px rgb(15 23 42 / 0.08)` |
| 2 | Interactive/hover | `0 3px 8px rgb(15 23 42 / 0.12)` |
| 3 | Selected region | `0 6px 16px rgb(15 23 42 / 0.14)` plus identity outline |
| 4 | Inspector/floating tool | `0 12px 32px rgb(15 23 42 / 0.18)` |
| 5 | Modal/critical interruption | `0 20px 48px rgb(15 23 42 / 0.24)` plus backdrop |

Use semantic names such as `--event-shadow-selected`. A stronger shadow must reflect interaction hierarchy. Selection differs from keyboard focus; both remain visible. A normal approval page is not automatically a level-5 modal. Keep overlays in the existing application's stacking system and preserve focus containment/return for true modals. Dragging, where already supported, can temporarily use level 4 without adding a drag feature to every screen.

## Motion and feedback

| Token / use | Starting value |
| --- | --- |
| `--event-duration-immediate` | `100ms`: press, hover, icon feedback |
| `--event-duration-quick` | `180ms`: selection, status transition, short disclosure |
| `--event-duration-context` | `260ms`: inspector or larger context change |
| `--event-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--event-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` |

Use one coherent movement vocabulary: a small lift confirms interactivity, an outline and elevation confirm selection, an inspector's entrance connects detail to its source, and a settled marker confirms a successful state transition. Keep controls usable while motion runs; avoid layout jumps, repeated bounce and decorative ambient movement. Exact values are pilot defaults, not values claimed to be copied from Material or Fluent.

Pending feedback starts immediately. Saved/approved/published graphics follow server confirmation. Preserve draft and recovery on error. Under `prefers-reduced-motion`, remove translation, scaling, elastic and layout movement; show the final visual state directly and retain a static pending indication and accessible status updates.

## Verification and variants

Verify colour pairs, recognizable markers, keyboard/touch access, both languages and actual reduced-motion behavior in the pilot. Use expanded explanations or a compact legend if unfamiliar graphics need teaching; do not require users to memorize arbitrary symbols.

Dark mode, if supported by the implemented surface, needs separately checked surfaces, text and depth. Do not mechanically invert this light palette or claim dark-mode completion from these tokens alone.
