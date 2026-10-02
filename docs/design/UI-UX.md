# Common UI/UX requirements

## Authority and scope

These requirements apply across ALIFE and preserve the current React PWA. The [Alife design skill](../../.agents/skills/alife-frontend-design/SKILL.md) provides task execution guidance. Existing CSS/Tailwind tokens and shared layout components are implementation sources; Event [design and scoped overrides](../events/design/EVENT-WORKSPACE-DESIGN.md) govern Event surfaces. Do not install a new framework, font or design dependency without approval.

## Surface identity

| Surface | Intended experience | Boundaries |
| --- | --- | --- |
| Public church site | Warm, hospitable, authentic community imagery and readable storytelling | Do not present generated imagery as actual people/events; consent and truthful church claims remain required |
| General workspace | Deep-green structure, warm neutral/paper surfaces, restrained coral; calm, readable operational work | Preserve global navigation and shared components; avoid decorative dashboard density |
| Event workspace | Domain colours, meaningful graphics, six-level depth and immediate feedback | Follow scoped materials and saved-preparation editorial override; no global rollout by implication |
| Editor/preview/public output | Clear distinction between editing, preview and the approved public snapshot | A preview is not a publication; working edits do not silently alter public content |

## Stable requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| UX-01 | Church Life, Group Life, Personal Center and System Management retain their distinct member/administrative purposes | Authorized and denied actors, navigation and entry/return paths |
| UX-02 | Home summaries have deliberately bounded item counts and links to full views; each item is separately understandable | Empty, populated and over-limit data fixtures |
| UX-03 | General management uses one coherent entity per page, one level of peer tabs, and list filtering/sorting/pagination | Mobile tabs, list controls, detail return and retained state |
| UX-04 | Loading, empty, error, success, blocked, disabled and conflict states explain what happened and the available next action | Applicable states rendered and exercised; no false readiness |
| UX-05 | Bilingual UI/content retains `{en, zh}` compatibility, fallback and stable entity identity across language changes | English/Chinese rendering, long text and no unnecessary language-only refetch/remount |
| UX-06 | Controls have semantic labels, visible focus, keyboard access, readable contrast and usable touch targets | Keyboard/dialog/focus-return checks plus mobile inspection |
| UX-07 | Layout remains usable on phone and desktop; meaningful images have alt text and stable dimensions; reduced motion is respected | Representative 320px and 1280px rendering plus relevant longer content and motion states |
| UX-08 | Important confirmation uses application-rendered accessible dialogs; browser alert/confirm/prompt is prohibited | Consequence wording, initial focus, containment, cancellation and focus return |
| UX-09 | Save, submit, approve and publish are visibly distinct governed actions; unsaved/conflicting input is recoverable | Applicable editor/lifecycle flows and server denial cases |
| UX-10 | Product defaults, designer-selected direction and user preferences are distinct | Document scope, persistence and reset behavior for each exposed preference |

Management row secondary details may expand in place; a substantial managed object uses a dedicated page with a labelled return to its actual source. Mobile tab rows scroll rather than wrap. These are design requirements, not a claim every current screen already complies.

## Preferences and baseline evidence

Current language preference is coordinated by AuthProvider and `src/i18n/locale.ts`; a language-only change does not change permissions or data identity. Do not claim server synchronization, theme, typography or other settings exist without inspecting their implementation. New settings specify supported values, default, storage scope, reset, accessibility and viewer isolation.

Before a visual change classify its surface, identify existing tokens and the relevant accepted reference, and state its functional purpose. After implementation inspect rendered screens and interactions. Screenshots alone do not prove a functioning flow; automated geometry/semantic checks alone do not establish visual acceptance. Record user-approved design directions with their scope. New references must name source and fixture/live-data limitations.
