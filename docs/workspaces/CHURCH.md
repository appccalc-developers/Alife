# Church workspace

Church Life is the member-facing root-church experience: bounded current summaries, church content and permitted activities. Church management is a separate working destination; System Management contains platform operations. The root church is a special group, not a second grant of unrestricted platform authority.

Current source entries: `ChurchLifeView`, `ChurchAlbumsView`, `ChurchManagementView`, `useShellNavigation`, `churchManagementAccess` and the corresponding actor-filtered services. `/church/manage` composes the existing GroupManage workspace with church-specific sections; member administration is embedded only when the current admin permission allows it.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| CH-01 | Member life and management remain distinguishable | Member sees permitted content; unauthorized management route/API is denied |
| CH-02 | Church identity is stable across routes and language | No accidental substitution with the selected ordinary group |
| CH-03 | Current-focus summaries are bounded | Over-limit data leads to full views rather than an unbounded home feed |
| CH-04 | Church scope does not bypass specialist governance | Event sponsorship, Package approval and reviewer actions retain own checks |

Use [management](MANAGEMENT.md) for responsibilities/configuration and [UI/UX](../design/UI-UX.md) for visual behavior. Do not promote a local design override to every church-facing page.
