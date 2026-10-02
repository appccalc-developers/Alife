# Management operation and role matrix

Source-reviewed 2026-10-01; this is top-level operation coverage, not a live authorization test. Exact target-state, concurrency and validation rules remain in the linked command directories. All paths below are relative to `backend/src/Alife.Application`.

| Operation family | Actor boundary | Important target/exception | Implementation |
| --- | --- | --- | --- |
| Profile/settings, subgroup creation, group closure | Leader/co-leader helper | Platform admin admitted by helper; dissolved group rejected; creation validates parent/type | `Groups/Commands/UpdateGroup`, `CreateSubgroup`, `CloseGroup` |
| Invite, approve, reject, group member profile | Leader/co-leader helper | Current target/group-specific validation still applies | `Groups/Commands/InviteGroupMember`, `InviteGroupMemberById`, `ApproveGroupMember`, `RejectGroupMember`, `UpdateGroupMemberProfile` |
| Co-leader appointment/removal | Leader helper | Platform admin exception; cannot alter primary leader via this action | `Groups/Commands/SetGroupCoLeader` |
| Direct leader appointment | Platform admin | Distinct from voluntary transfer | `Groups/Commands/AppointGroupLeader` |
| Transfer leadership | Actual approved current group leader | Another approved co-leader is target; broad admin grant alone is insufficient | `Groups/Commands/TransferGroupLeadership` |
| Dissolve group | Actual approved group leader | Platform administration is explicitly not a substitute; blockers evaluated | `Groups/Commands/DissolveGroup` |
| Remove member | Leader/co-leader helper plus actor/target checks | No self-removal or primary-leader removal; ordinary co-leader cannot remove peer co-leader | `Groups/Commands/KickGroupMember` |
| Join/accept/decline invitation | Acting member and current invitation/membership rules | Private group requires invitation; subgroup join requires approved parent membership | `Groups/Commands/JoinGroup`, `AcceptGroupInvite`, `DeclineGroupInvite` |
| Working-page editing | Draft creator or owning-group leadership helper | Reviewer role alone insufficient | `Pages/Commands/UpdatePage` |
| Page visibility/submission | Owning-group leadership helper | Public visibility submits review rather than bypassing approval | `Pages/Commands/PublishPage` |
| Publication review decision | Page-review grant | Requires valid submitted/current copy and concurrency handling | `Admin/Commands/ApprovePagePublication`, `ReturnPagePublication` |
| Publication-copy editing | Page-review grant AND owning-group leadership helper | Reviewer's general ability to review does not grant copy modification | `Admin/Commands/UpdatePagePublicationCopy` |
| Platform role definition/permissions | `admin.roles.managePermissions` | Allowed code filtering and command-specific built-in/target restrictions | `Admin/Commands/CreatePlatformRole`, `UpdatePlatformRolePermissions`, `DeletePlatformRole` |
| Platform member profile/role assignment | Corresponding profile/assignment permission | Not inherited merely from owning-group leadership | `Admin/Commands/UpdateMemberProfile`, `SetMemberPlatformRole` |
| Messages, files, sermons, edge refresh | Corresponding catalogue permission | Scope and target-specific checks remain applicable | `Admin/Commands/SendAdminMessage`, `BackfillMemberPrivateFiles`, `SyncSermons`, `RefreshCloudflareCache` |
| Identity activation/recovery | Identity contract actor/target rules | Elevated targets, self-issuance and authority recheck are independent restrictions | [Identity contract](../identity-access.md) |
| Event configuration/sponsorship/approval/operations | Specific platform permission and/or accepted scoped assignment | Policy management does not grant editing/approval; immutable versions and independent governance | [Event core](../events/EVENT-CONTRACT.md) and affected module |

For a changed operation expand the affected row into allowed/denied roles, actor and target group, current status, resource ownership, privacy projection, mutation invalidation and test evidence. This matrix deliberately does not equate all leader/co-leader capabilities or grant platform administration to every handler. Existing source tests should be mapped at that operation's scope before claiming verified coverage.
