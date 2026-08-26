---
name: alife-frontend-design
description: Design, reshape, or review frontend UI specifically for the Alife bilingual React PWA. Use for Alife pages, components, visual systems, interaction states, responsive behavior, and design critiques; do not use for backend-only work.
---

# Alife Frontend Design

Apply the repository `AGENTS.md` first. This skill specializes the general `frontend-design` guidance for Alife; when both skills are available, use `frontend-design` for creative direction and critique, while this file governs Alife-specific identity, compatibility, and bilingual behavior.

## Inspect before choosing a direction

Read the screen being changed, adjacent components, and nearby tests. Use these files as the current visual sources of truth:

- `cloudflare/alife-app/tailwind.config.js` for public-home colors.
- `cloudflare/alife-app/src/styles/global.css` for workspace tokens and shared behavior.
- `cloudflare/alife-app/src/components/layout/` for reusable workspace primitives.
- `cloudflare/alife-app/src/views/home/` for the public church-site language.
- `cloudflare/alife-app/src/i18n/` and existing local copy modules for bilingual patterns.

Classify the work before designing:

- **Public church site:** a welcoming digital front door for visitors, seekers, members, and new migrants.
- **Authenticated workspace:** a calm, legible tool for members and non-technical group leaders.
- **Editor or preview:** a productive editing surface whose preview and published output are distinct and both need verification.

Preserve the selected surface's visual language. Do not blend cinematic public-page styling into dense management workflows or turn public storytelling into a generic admin dashboard.

## Member-space information architecture

Organize the authenticated member space from the member's point of view, not from backend entities or the administrative hierarchy. Place each capability under one of the existing primary destinations:

- **Church Life / 教会生活** for the member-facing church-wide experience.
- **Group Life / 小组生活** for the member-facing experience of the currently selected non-church group.
- **Personal Center / 个人中心** for the signed-in member's own information, preferences, and personal actions.
- **System Management / 系统管理** for administrative and platform-management work.

Treat the church group as a special root group. Its member-facing content may appear in Church Life, but its management functions belong under System Management rather than ordinary Group Life.

### Current-focus home pages

Make the Church Life, Group Life, and Personal Center home pages concise views of what is changing now, not exhaustive directories or management lists.

- Church Life and Group Life should foreground timely items such as upcoming or recent events, latest announcements, and newly added albums.
- Personal Center should foreground the signed-in member's current tasks, active matters, and notifications.
- Define and enforce a deliberately small maximum item count for every home-page section. Do not let the number grow opportunistically with the available data, and do not turn these summaries into unbounded feeds.
- Render every displayed event, announcement, album, task, matter, or notification instance as its own card. Do not combine several instances into one oversized summary card.
- When more items exist than the allowed home-page count, lead to the corresponding full view instead of adding more cards to the home page.

## Management pages, tabs, and lists

- Give one managed entity its own page, such as Group Management, or make a page about one coherent entity-related sequence, such as the church's group list. Do not combine unrelated management entities merely to fill a dashboard.
- When one managed entity has several aspects, or one list has several statuses, express those peer views with a single TabView. Never place another TabView inside a TabView. A destination reached from a tab may use its own tabs only after navigating to a separate page.
- Keep mobile tabs on one non-wrapping row and use horizontal scrolling when they do not fit. Keep the selected tab visible and preserve accessible tablist, tab, and tabpanel semantics.
- Every management list must provide pagination, filtering, and sorting. Preserve those controls and their state when opening and returning from item details where the current routing and state patterns allow it.
- If a row cannot communicate all useful details, use an in-place expandable-detail pattern for that list item. Put secondary details, editing controls, and item actions together inside the expanded region rather than crowding the summary row.
- Show images contained in expanded details as small, stable thumbnails. They support recognition and context; they should not dominate the management list.
- Navigate to a dedicated page instead of expanding inline when the item is itself a managed object or its working area is expected to be large—for example an event, another group, or a page. Put a visible `← Back to {source}` / `← 返回{来源}` link at the top that returns to the exact originating screen.

## Reminders and confirmations

Use an application-rendered, accessible modal when the user must notice important information or confirm an action. Absolutely never use the browser's blocking Web API dialogs: `window.alert`, `window.confirm`, or `window.prompt`.

Give the modal a clear title, specific consequence or next step, explicit primary and cancel actions when confirmation is required, initial focus, keyboard focus containment, Escape behavior when safe, and focus return to the invoking control. Keep ordinary information, inline validation, and expandable row details out of modals when they do not require interruption.

## Alife design direction — edit this section

<!-- ALIFE CUSTOMIZATION START: edit the values and guidance in this section as the product identity evolves. -->

**Product promise:** Help overseas Chinese Christian communities move naturally from first welcome to belonging, fellowship, service, and shared memory.

**Primary audiences:** Chinese-speaking and English-speaking visitors, students, young families, new migrants, members, group leaders, and church administrators in New Zealand.

**Voice:** Warm, grounded, hospitable, plain-spoken, and trustworthy. Faith language may be confident but must never invent Scripture, doctrine, safety facts, identities, permissions, contact details, or authoritative church claims.

**Public-site signature:** Real community imagery and South Island light create the emotional center. Prefer one cinematic, content-led moment—such as the existing full-bleed welcome hero—supported by quiet warm surfaces. The page should feel like approaching a real gathering, not browsing a church template.

**Workspace signature:** Deep green structure, warm neutral surfaces, restrained coral highlights, and the existing faint grid/glow atmosphere. It should feel humane and composed while remaining fast to scan and easy to operate.

**Imagery:** Prefer authentic worship, meals, small groups, Christchurch places, and ordinary community life with appropriate consent. Avoid anonymous corporate teams, staged handshakes, decorative religious stock imagery, or AI images presented as real people or events.

**Avoid:** Generic SaaS gradients, excessive glass effects, card grids without information hierarchy, decoration-only numbered sections, ornamental crosses, loud revival/conference styling, and animation scattered across every element.

<!-- ALIFE CUSTOMIZATION END -->

## Existing visual system

Use existing tokens and components before adding one-off values. Do not add a UI framework, font package, remote font, or design dependency without explicit approval.

For authenticated workspace screens, derive choices from these established colors:

- Ink `#18332d`, muted text `#66766f`.
- Brand green `#176b5a`, deep green `#0d4f43`, soft green `#e3f0eb`.
- Coral accent `#e37b63` and warm workspace background `#f5f2eb`.

For public church pages, use the existing `home-*` Tailwind tokens rather than duplicating hex values:

- Dark brown `#21160e`, warm surface `#f7efe2`, border `#ead7b6`.
- Gold `#f5d798` / accent `#9a6a2d` and community green `#2f6f62`.

Treat coral or gold as a purposeful accent, not a competing primary action color. Maintain readable contrast; never place muted gold or green text on a similarly valued background without checking it.

Keep the current font stack by default: Inter/Segoe for Latin text and PingFang SC/Microsoft YaHei fallbacks for Chinese. Use weight, size, rhythm, and spacing to create character. Do not depend on English-only uppercase, extreme tracking, or a font treatment whose Chinese fallback loses the intended hierarchy. Scripture and long-form reading may use the established serif reader stack.

Reuse `AppPageShell`, `AppSectionCard`, `AppActionButton`, `AppEmptyState`, badges, inputs, and shell/navigation components where they fit. Preserve the established radii, focus treatment, shadows, max widths, and mobile navigation behavior. Extend a primitive only when the new behavior is genuinely shared.

## Layout and interaction

- Design mobile-first from 320px upward, then verify the existing `desktop` breakpoint at 1024px.
- Keep primary touch targets at least as usable as the existing `min-h-10`, `min-h-11`, or `min-h-12` controls.
- Public pages may use full-bleed media and narrative pacing. Workspace pages should use clear page headers, grouped actions, scannable sections, and restrained density.
- Spend visual boldness in one signature element per screen. Structural labels, dividers, icons, and motion must explain content or state.
- Use Framer Motion only where motion improves orientation, hierarchy, or atmosphere. Respect `prefers-reduced-motion` and avoid making core content depend on animation.
- Use meaningful content images with the established image component or `<img>`, useful alt text, stable aspect ratios, and appropriate loading behavior. Background media is for decorative atmosphere only.
- Always design loading, empty, error, success, disabled, destructive-confirmation, and permission-denied states when the workflow can reach them.

## Bilingual design and copy

English and Chinese are equal product languages, not a primary language plus a translation afterthought.

- Preserve established `{ en, zh }` data and local copy patterns. Language-only UI changes must not refetch data or remount the underlying screen unless the data actually changes.
- Check both languages at mobile and desktop widths. Chinese may be visually denser; English often needs more horizontal space. Allow wrapping instead of shrinking essential text into unreadability.
- Keep actions consistent across the flow: the button, progress state, confirmation, and error should name the same action.
- Write from the user's side of the screen with plain verbs. Empty and error states should say what happened and what the user can do next.
- Never silently fall back to mixed-language UI. Follow the existing fallback helper and make missing translation behavior explicit.

## Design workflow

For a substantive new screen or visual reshape, form a compact plan before coding: the surface type, page audience and single job, 4–6 relevant existing colors, type hierarchy, layout concept, and one Alife-specific signature. Critique whether the plan could belong to an unrelated SaaS or church template; revise the generic part before implementation.

Keep implementation incremental. Preserve React, Tailwind, current state and routing patterns, cache behavior, public payloads, and component contracts. A visual task does not authorize an architecture rewrite.

After implementation, inspect the rendered UI when tools permit. Verify at minimum:

- mobile and desktop layout;
- English and Chinese copy, wrapping, and fallback;
- keyboard focus, semantic labels, contrast, and touch targets;
- reduced-motion behavior and image layout stability;
- relevant loading, empty, error, disabled, success, and authorization states;
- member-space placement, one-level tab behavior, list controls, detail expansion, dedicated-page back links, and application modal behavior for management work;
- editor preview and published rendering when a content-builder surface changed.
