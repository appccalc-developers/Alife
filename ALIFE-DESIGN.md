# Alife design entry

This is a thin reading entry, not another design system. Read only the surface being worked on. [Repository rules](AGENTS.md), domain contracts and the [design orientation](docs/design/README.md) retain their authority.

| Surface | Direction | Read next |
| --- | --- | --- |
| CMS / general authenticated Workspace | Calm operational work: deep green, warm paper, restrained coral; clear editing, preview and publication boundaries | [Common UI/UX](docs/design/UI-UX.md), [Alife frontend design skill](.agents/skills/alife-frontend-design/SKILL.md), [Pages](docs/pages/README.md) or [Workspaces](docs/workspaces/README.md) |
| Event creation / capability cards | Lively domain objects; card expands from its position into a focused work surface and contracts back | [Creation-card DESIGN.md](docs/events/design/event-creation-cards/DESIGN.md), then the [Event reading matrix](docs/events/AGENTS.md) |
| Saved Event preparation overview | Bright architectural-magazine composition, opaque warm paper, domain-coloured regions | [Editorial workspace](docs/events/design/EVENT-PREPARATION-EDITORIAL.md) |
| Other Event management surfaces | Meaningful domain graphics, scoped Prism Glass objects, six interaction-depth levels | [Workspace design](docs/events/design/EVENT-WORKSPACE-DESIGN.md), [visual tokens](docs/events/design/EVENT-UI-VISUAL-TOKENS.md) and affected [reference area](docs/events/design/EVENT-UI-REFERENCE-PAGES.md) |
| Public church site / published content | Hospitable community imagery and readable storytelling; separate from management styling | [Alife frontend design skill](.agents/skills/alife-frontend-design/SKILL.md) and the affected public renderer |

## Implementation sources and status

- Shared colours, radii, shadows and controls: [global.css](cloudflare/alife-app/src/styles/global.css) and [layout components](cloudflare/alife-app/src/components/layout/). Public-home colours: [Tailwind configuration](cloudflare/alife-app/tailwind.config.js).
- Event palette, material, depth, motion and state grammar: [visual tokens](docs/events/design/EVENT-UI-VISUAL-TOKENS.md). Domain identity, business status and interaction depth have different meanings.
- Retain the existing English/Chinese font stack, `{en, zh}` content, navigation, accessibility and explicit human actions. Refero references inform selected visual principles; they do not replace contracts or authorize dependencies.
- A documented direction is not proof of delivery. The 2026-10-10 creation-card expansion is a target specification; implementation, rendered inspection and user acceptance remain pending. See [Event status](docs/events/IMPLEMENTATION-STATUS.md) and [QA](docs/design/QA.md).

When prose and implementation tokens disagree, record and resolve the affected value before a visual rollout rather than copying a second palette here. In particular, the general design skill currently lists `#f5f2eb`, while `--alife-workspace-bg` in global.css is `#f3efe6`.
