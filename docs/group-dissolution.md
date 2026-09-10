# Dissolving an empty group

Group Management → Profile & settings provides **Dissolve group / 解散小组** to the current approved group leader. This is permanent removal, separate from the existing reversible Close action. The root church cannot be dissolved. Platform administration or co-leadership alone does not grant this permission.

The server requires exactly one membership record: the requesting approved leader. Invitations, requests, rejected or removed membership history also block deletion. There must be no child group (including closed groups and historical child fellowships), page (including drafts), event or event series, album, or announcement. Visibility and publication state do not exempt content.

Existing contacts, forum/content records, files, links, invitations/applications, notifications, group-linked audit history, and event governance/venue/workflow records also prevent removal. These safeguards preserve related data and existing foreign-key restrictions; the operation never cascades into community content. The UI explains blockers and supports rechecking after they are resolved. It does not offer to delete blocking content automatically.

## API and persistence

- `GET /api/groups/{id}/dissolution`: authenticated actual-leader check; returns `{ canDissolve, blockers }`. Blocker values are `church`, `members`, `subgroups`, `pages`, `events`, `albums`, `announcements`, and `relatedRecords`. The UI presents bilingual descriptions rather than these identifiers.
- `POST /api/groups/{id}/dissolve`: no member identity is accepted in the body. The actor comes from authentication. Rechecks eligibility in a serializable transaction, removes only the sole membership and empty group, and writes a `group.dissolved` audit record with actor, deleted `EntityId`, bilingual name snapshot, parent and group type. The new audit record has no foreign key to the deleted group.
- Success returns the existing `GroupActionResultDto` shape: `ok`, `groupId`, and `parentGroupId`. Unauthorized/non-leader calls fail; nonempty or concurrently changed groups return a conflict. A repeated successful deletion cannot remove anything else or create duplicate audit records. A retry after removal is denied because the membership no longer exists.
- Both endpoints are user-specific `private, no-store`. No client-side eligibility is trusted. The database's existing foreign keys remain a final safety barrier. No migration or change to Close, membership removal, or event creation contracts is required.

After commit, existing cache services remove group/detail/discovery, parent subgroup lists, membership lists, the leader's profile cache and membership authorization mirror. The speed layer also invalidates the parent list, group detail and acting member's authorization after successful dissolution. The frontend clears relevant IndexedDB/TanStack records, refreshes the profile, clears a matching saved group selection, and returns to `/groups`. If post-deletion client refresh fails, the UI reports the completed deletion and offers to retry refresh without submitting another deletion.

The UI uses the shared destructive confirmation modal, including the group name and irreversible consequence. Loading, failed eligibility, blockers and submission disable the destructive action. Cancel writes nothing; a ref guard prevents overlapping confirmation/submission. Language changes only update copy, not the eligibility request. The endpoint rechecks data even after a successful preview.

## Verification

- Backend `GroupDissolutionTests`: leader-only authorization, administrator denial without leadership, root-church rejection, membership statuses, each primary content blocker, linked records, post-preview changes, account/other-membership preservation, audit and cache invalidation, repeat deletion and anonymous/no-store endpoints.
- `tests/groupDissolution.browser.cjs`: local browser with every API intercepted; Chinese/English at 320/768/1280px, loading and failure retry, blocker descriptions, keyboard confirmation/cancel, stale final-check conflict, successful navigation and non-leader visibility. Run with `ALIFE_PLAYWRIGHT_MODULE` pointing to an available Playwright installation. Screenshots go to the OS temporary directory.
- Speed-layer regressions check dissolution invalidation and uncached eligibility alongside existing close behavior.
- TypeScript/production build and group hierarchy, current-group selection and no-native-dialog regression checks.

Backend unit tests use EF InMemory and do not prove SQL range-lock behavior across independent connections. No production group has been dissolved, and no migration or deployment was performed for this feature.

Local checks on 2026-09-10 passed: all 81 backend tests matching `FullyQualifiedName~Groups` (including 26 dissolution cases); 3 speed-layer close/dissolution regressions against the rebuilt dry-run bundle; 7 frontend hierarchy/current-group/dialog regressions; and the mocked browser scenario. `npm run build` passed TypeScript and Vite/PWA compilation. The Worker dry run produced the bundle without deployment, although its global log-file write was denied by the local filesystem sandbox. Existing package-pruning and mixed-import build warnings remain unrelated to this feature.

## 简体中文

小组管理的“资料与设置”新增“解散小组”，仅当前已批准的组长可操作，管理员身份和副组长身份不能替代。小组须仅有组长一条成员记录，并且没有下属组、页面、活动或定期活动、相册和公告；邀请、申请、历史成员、草稿及已关闭内容均计入。教会根组不可解散，其他关联资料也会阻止删除。页面显示阻止原因，须在确认弹窗明确确认；服务器在事务中再次检查，永久删除空组及其唯一成员关系，保留个人账号、其他小组身份与审计。成功后刷新目录与身份缓存并返回小组生活。现有“关闭”行为不变，无需数据库迁移。本地模拟测试不修改生产资料，真实 SQL 并发锁仍未验证。

## 繁體中文

小組管理的「資料與設定」新增「解散小組」，僅目前已批准的組長可操作，管理員身分和副組長身分不能替代。小組須僅有組長一筆成員紀錄，且沒有下屬組、頁面、活動或定期活動、相冊和公告；邀請、申請、歷史成員、草稿及已關閉內容均計入。教會根組不可解散，其他關聯資料也會阻止刪除。頁面顯示阻止原因，須在確認視窗明確確認；伺服器在交易中再次檢查，永久刪除空組及其唯一成員關係，保留個人帳號、其他小組身分與稽核。成功後重新整理目錄與身分快取並返回小組生活。現有「關閉」行為不變，無需資料庫遷移。本機模擬測試不修改正式環境資料，真實 SQL 並行鎖仍未驗證。
