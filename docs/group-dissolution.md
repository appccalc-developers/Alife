# Dissolving an empty group

Group Management → Profile & settings provides **Dissolve group / 解散小组** to the actual approved leader. An empty group has exactly one **active (approved) membership**, belonging to that leader, and no child group, page, event/series, album or announcement. Invitations, requests, rejected/removed memberships, forum posts, contacts, files, notifications and other information do not block dissolution. Drafts and closed content still count; already soft-deleted content is cleaned up. The root church cannot be dissolved. Administrator or co-leader status alone does not confer this permission.

The leader explicitly confirms permanent deletion of the group, all its membership records and its other information. Accounts and memberships in other groups survive. Existing audit rows survive with their group foreign key detached; the dissolution audit links their IDs to the removed group. Operational approval/application decision evidence is copied into audit records before its dependent operational records are removed. No UI restores a dissolved group. The existing reversible Close action is unchanged.

## API, transaction and data cleanup

- `GET /api/groups/{id}/dissolution` returns `{ canDissolve, blockers }`; blockers are `church`, `members`, `subgroups`, `pages`, `events`, `albums`, `announcements`. There is no `relatedRecords` blocker. Both endpoints are authenticated and `private, no-store`.
- `POST /api/groups/{id}/dissolve` accepts no client-supplied actor. The server rechecks the leader and empty-group criteria in a serializable transaction. It stages cleanup through the persistence layer, removes group-scoped dependent records in foreign-key order and preserves principal accounts/events and the parent group. Optional references to removed resources are detached. If another event references a policy version, workflow template, venue reservation or child-enrollment history, those audit dependencies and their exact foreign keys are retained. Referenced venues/templates are retired. Only in that case, a closed `IsDissolved` group identity remains for audit foreign keys; a global Group query filter hides it from all ordinary group queries, and all memberships are removed. This is not a reusable or reopenable group, and accepted Event policy references are not rewritten. Audit records are preserved; legacy group links and onboarding references are handled explicitly.
- Success retains the existing `GroupActionResultDto` (`ok`, `groupId`, `parentGroupId`). Repeated deletion is denied because leadership no longer exists; it does not repeat database deletion.
- All former group members have their membership/profile authorization caches invalidated, including inactive memberships. Public article caches, group detail/discovery, parent lists and membership lists are cleared. Existing frontend and edge invalidation refresh the directory and return the leader to `/groups`.
- The additive `AddGroupDissolutionAuditIdentity` migration adds `groups.is_dissolved` with a false default. It must be applied before deploying the changed backend; no shared or production migration is applied by this implementation. The persistence cleanup reads soft-deleted dependents too, so hidden rows cannot leave restrictive foreign keys behind.

## Stored file cleanup

File metadata is immediately hidden using the existing `IsDeleted` flag and detached from the removed group. `RelatedEntityType = DissolvedGroup` and the removed group ID form a durable cleanup marker. A backend hosted service retries marked files in batches of 25 once per minute, rotating attempts by timestamp. It uses each file's matching storage provider/bucket, requires `FileAssets:ImageApiAdminSecret`, and calls `POST /api/admin/file-objects/delete` on the configured upload API. Only keys under `groups/{groupId}/` or `private/groups/{groupId}/` are eligible for automatic object deletion; legacy unscoped keys remain hidden for manual ownership review and never block dissolution. The image worker validates the same group namespace and the existing `FILE_ADMIN_BACKFILL_SECRET`, bucket name and exact object key. It never interprets an absent object as a folder deletion; repeated deletion is safe.

After the object service confirms deletion, metadata is removed and a file-purge audit is written. Missing configuration, an unscoped legacy object key, or service failure leaves the hidden marker for a later retry and does not prevent group dissolution. Registration cannot revive a file while this cleanup is pending. Files referenced by surviving content are shared records: their group association is detached and their metadata/object is retained. Another live asset referencing the same provider/bucket/key also prevents deletion of the shared object. Remote copies, browser caches and external URLs embedded directly in free text are not an object inventory; only registered file assets enter this cleanup.

Deployment must include the backend and the image-worker endpoint, with their existing matching admin secret. Deploying only the backend leaves retryable cleanup markers until the endpoint is available. This change does not deploy either service or delete production data.

## Verification

Group tests cover approved-only membership counting, role/root/content rejection, cleanup of ancillary data, retained audit/account/other-group data, file queue retry and exact-key deletion. The optional `GroupDissolutionSqlTests` uses a uniquely named disposable database on `localhost,14333`; enable with `ALIFE_TEST_GROUP_DISSOLUTION_SQL=1`. It checks actual foreign-key cleanup, not concurrent independent transactions. Browser regression uses mocked APIs and bilingual responsive/keyboard/confirmation/failure flows.

## 简体中文

空小组仅有组长一名活跃成员（已批准），且没有下属组、页面、活动或定期活动、相册及公告。邀请、申请、已退出成员与其他资料不阻止解散。组长明确确认后永久删除小组、全部组内成员关系和其他资料，保留账号、其他小组身份与审计。文件先隐藏，再由后台按精确对象键删除；失败会重试，不阻止解散。教会根组不可解散，“关闭”功能不变。被其他活动引用的审计依据保留，并以不可访问的已解散标记维持外键；部署前须应用新增标记字段的迁移。

## 繁體中文

空小組僅有組長一名活躍成員（已批准），且沒有下屬組、頁面、活動或定期活動、相冊及公告。邀請、申請、已退出成員與其他資料不阻止解散。組長明確確認後永久刪除小組、全部組內成員關係和其他資料，保留帳號、其他小組身分與稽核。檔案先隱藏，再由背景程序按精確物件鍵刪除；失敗會重試，不阻止解散。教會根組不可解散，「關閉」功能不變。被其他活動引用的稽核依據保留，並以無法存取的已解散標記維持外鍵；部署前須套用新增標記欄位的遷移。

Local verification (2026-09-10): the complete backend suite passed all 651 tests with `ALIFE_TEST_GROUP_DISSOLUTION_SQL=1`, including both disposable SQL foreign-key scenarios and database cleanup. Image-worker tests: 22 passed. TypeScript/Vite/PWA production build and mocked bilingual browser checks at 320/768/1280px passed. Migration model consistency and forward/reverse SQL generation passed; reverse SQL refuses to drop the marker while retained audit identities exist. Real object-storage deletion and independent concurrent SQL connections were not exercised. No production data was changed.
