# ALIFE design-led delivery

## Authority and orientation

This is the top-level design entry, not a replacement for repository [agent rules](../../AGENTS.md). [Architecture](../architecture.md) owns system boundaries and technology decisions. Domain contracts own business semantics. [UI/UX](UI-UX.md) owns common experience requirements; [QA](QA.md) owns evidence and completion criteria. Detailed Event work continues to use its [reading/update matrix](../events/AGENTS.md).

| Task | Read first | Then inspect |
| --- | --- | --- |
| Architecture or cross-layer behavior | Architecture and affected layer; [cache matrix](../cache-coordination.md) for freshness changes | Affected source, contracts and nearby tests |
| Page editing/publication | [Page orientation and contract](../pages/README.md) | Editor, preview, public renderer and affected handlers/tests |
| Identity | [Identity orientation](../workspaces/IDENTITY.md) and detailed identity contract | Auth/identity handlers, providers, recovery and relevant tests |
| Church/Group/Personal workspace or management | [Workspace orientation](../workspaces/README.md) and affected booklet | Actor-filtered services, platform/group permissions and relevant views |
| Event | Event reading matrix | Only affected topic/module, machine values, status, implementation and tests |
| Visual or interaction change | UI/UX and applicable domain design | Existing tokens/components and rendered reference |

Page and workspace booklets provide top-level routing and acceptance. They do not replace exact DTOs, command-specific permissions or domain implementation/status records.

## Requirement-to-evidence chain

For consequential requirements retain: stable requirement ID, owning contract section, applicable prototype/reference, implementation entry, acceptance scenarios, implementation status, verification status and gaps. Do not duplicate entire rules in a tracking table; link to their owner. A source-only implementation is not verified delivery. Each new result names its source revision or working-tree scope, date, environment and limitations.

Tasks begin with the applicable requirements and finish conditions. Agents may implement and repair within the user's authorized scope without repeated routine approval; architecture changes, production operations and publication retain repository approval rules. Before completion review both functional requirements and applicable nonfunctional requirements, update affected authoritative sources, and report evidence or gaps.

## Design and prototype sequence

1. Establish user, problem, roles, scope and invariants.
2. Describe the intended flow, alternative/error states and unresolved decisions.
3. Use a demonstrable prototype for interactions and generated HTML for explaining the proposal.
4. Implement a complete authorized user flow against real persistence.
5. Verify behavior, role isolation, compatibility and rendered experience; retain evidence and remaining scope.

Prototype fixtures must be fictional and marked as simulations. They do not grant permissions or prove persistence, provider behavior or deployment. A prototype can be locally explored autonomously; product acceptance and changes to governed decisions must be explicitly recorded.

HTML presentations follow the existing [Event overview](../events/EventManagement-About.html) approach: authoritative source, generator, generated output and freshness check. Present user value, flow, roles, architecture, design choices, implemented/target scope and acceptance. Preserve source links and mark simulated interactions. Never hand-edit Event generated HTML. Sharing the presentation mechanism must not impose Event-specific business or styling rules on other domains.

## Delivery tracking

See [coverage and gaps](COVERAGE.md) for the requested deliverables and evidence. Open the [local rule demonstration](prototypes/review.html) to explore fictional page-copy, workspace-role and identity-intent boundaries. It is a demonstrable explanatory prototype, not a complete screen specification or actual server authorization.

### Generated explanation pages

Run `node docs/design/scripts/generate-design-presentations.mjs`, then the same command with `--check`. Generated [architecture](generated/architecture.html), [pages](generated/pages.html), [identity](generated/identity.html), [Church](generated/church.html), [Group](generated/group.html), [Personal](generated/personal.html), and [management](generated/management.html) explain their source contracts with shared navigation. These are explanation presentations, not interactive business prototypes. Event keeps its existing separate generator and [provenance orientation](../events/DESIGN-PROVENANCE.md).

The [implementation plan](../design-documentation-plan.zh-CN.md) records the full scope. Architecture, common orientation/UI/UX/QA, page/workspace booklets, generated explanations and the bounded demonstration now exist. The coverage record retains unresolved original Event provenance, comprehensive operation mapping and visual/product acceptance. Document publication does not certify the current application against every requirement.
