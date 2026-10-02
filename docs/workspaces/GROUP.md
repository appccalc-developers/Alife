# Group workspace

Group Life is the experience of the selected non-church group. Membership status and role are separate: a leader/co-leader title without the required approved relationship is not sufficient. Group discovery visibility is viewer-specific and bypasses shared directory caches as specified by edge architecture.

| Role | Experience and scope |
| --- | --- |
| Member | Permitted content, participation and own actions; no general member/role/content administration |
| Co-leader | Shared leadership functions accepted by specific handlers; not automatically leader-only or platform powers |
| Leader | Owning-group management and leader-specific actions checked by handlers; no implied authority over unrelated groups |

Current `GroupAuthorizationService` also admits platform administration for its group-check helpers and rejects dissolved groups. This is an explicit implementation exception, not authority granted by a frontend menu. Do not omit it from permission review or extend it to specialist handlers.

Source: `GroupDetailView`, `GroupManageView`, current-group provider, `groupLifeMemberships`, group commands and authorization service.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| GR-01 | Active group/viewer determines data and route context | Switch group and viewer without leaking the previous group's data |
| GR-02 | Approved member, leader and co-leader behavior remains distinct | Positive/negative roles including requested/removed membership |
| GR-03 | Management is scoped to the target resource | Other-group resource IDs do not inherit selected-group authority |
| GR-04 | Lists/details preserve usable navigation and state | Filters/sorting/pagination, mobile tabs and labelled return |
| GR-05 | Role changes propagate to permitted reads and actions | Recheck server authority and affected mirrors/client state |

Read [management](MANAGEMENT.md) before changing member/role workflows. Exact leader-versus-co-leader exceptions belong to each command; this booklet does not assert a complete endpoint matrix.
