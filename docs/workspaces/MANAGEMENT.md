# Church, group and platform management

## Responsibility boundaries

Church-level management handles root-group profile/settings, members, contacts, fellowships, ministries and venue/room management exposed by the current workspace. Functional configuration includes the controlled Event template/policy catalogues and platform-role permissions, each subject to its specific permission. A navigation section or catalogue does not prove a complete operational feature.

Group management applies to an ordinary owning group, with leader/co-leader/member distinctions. Platform management is a separate permission system. Event accepted assignments form a further independent authority dimension; platform policy management does not itself grant Event editing or approval.

## Current permission sources

`AdminPermissionCatalog` is authoritative for allowed permission codes and defaults. Examples include `admin.access`, member view/profile/role assignment, `admin.roles.managePermissions`, pages review, Event audit/sponsorship/Package approval, template/Package/RAM policy management, messages, files, audit logs, sermon synchronization and cache refresh. Read the catalogue rather than treating this descriptive list as an exhaustive duplicate.

`admin.access` is consequential: current group authorization treats it as platform administration across group workspaces. It is broader than opening a menu. `superadmin` behavior and configurable role permissions require server inspection; never infer one global hierarchy from role display names.

## Required operation matrix

Use the source-reviewed [operation matrix](OPERATION-MATRIX.md) to identify the specific role boundary and exceptions before implementation.

For every changed operation record actor role/status, platform permission, target group, target member/resource, ownership, specialist role/purpose, closed/dissolved state, permitted/denied outcome and invalidation. Leader and co-leader distinctions are command-specific. Role templates and feature configuration cannot supply arbitrary code or bypass fixed system security boundaries.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| MG-01 | Server enforces each management operation | Direct denied-role API requests fail even if UI guards are bypassed |
| MG-02 | Group authority and platform grants remain distinct | Own/other-group and broad-admin exception tested explicitly |
| MG-03 | Role/permission changes are controlled and traceable | Current actor/target checks, valid code filtering and relevant audit behavior |
| MG-04 | Configuration does not rewrite immutable historical decisions | Versioned Event definitions/policies preserve accepted references |
| MG-05 | Management data is minimally disclosed | Permission-specific DTOs, no secret-bearing lists/shared cache |
| MG-06 | Management UX is coherent | One entity per page, single-level tabs, list controls, confirmation and return paths |

## Current scope and gaps

These booklets and the operation matrix map source responsibilities and consequential permission boundaries, not certification of every management screen. [Coverage](../design/COVERAGE.md) links the generated explanation and bounded prototype evidence. Current per-operation live elevated/ordinary church-account testing and user visual acceptance remain unverified.
