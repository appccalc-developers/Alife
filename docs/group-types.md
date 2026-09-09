# Group types

`Group.GroupType` distinguishes Fellowship (`0`) and Ministry (`1`). `IsChurch` remains the separate root-church marker, and takes precedence for church behavior; a church's default fellowship value does not make it an ordinary fellowship. Existing records, including historical nested groups, default to Fellowship. Classification is explicit and never inferred from a group's name.

## API and creation rules

Group detail, church, visible-group, subgroup, creation, and update responses expose the additive `groupType` field as `fellowship` or `ministry`. `POST /api/groups/{id}/subgroups` accepts `groupType` alongside the existing bilingual `name`, optional bilingual `description`, and `accessType`.

- A church manager may create either type directly under the church.
- A non-church group manager may create only Ministry children. Explicit Fellowship requests are rejected by the application handler before any group or membership is written.
- Omitted `groupType` defaults to Fellowship for existing callers. It remains valid under a church, but is rejected under a non-church parent under the new product rule. Older clients must send `ministry` to create children there.
- Invalid enum values are rejected. Existing server authorization, approved leader assignment, access types, parent membership rules, and bilingual payloads are preserved.
- Profile updates preserve the stored type. Reclassification of existing groups is outside this change.

## Management interface

Church Management has separate Fellowships (`section=subgroups`) and Ministries (`section=ministries`) lists filtered by the stored type. Each list's add action sends its corresponding type. Group Management renames Subgroups to Ministries and permits only ministry creation. Historical child fellowships remain accessible with their type displayed and an explanatory note; they are not silently reclassified or hidden. Group settings actions use Settings / 设置.

Group Management removes the Albums entry and its duplicate panel. Old management `section=albums` links fall back to the profile section; album browsing and management remain available from Group Life with their existing permissions and routes.

The Group Management sidebar description follows the renamed Ministries section and omits Albums. For non-church groups, `section=ministries` also resolves to the existing `section=subgroups` management panel, avoiding an empty panel on direct links.

No Pastoral Team, Deacon Board, Media Ministry, Worship Team, PA Team, or PPT Team records are automatically created in either local or production data.

### Explicit local setup

The local API was restarted from the tested Debug build with the existing development environment. The persisted local speed-layer cache entry `group:11111111-1111-1111-1111-111111111111:subgroups` was invalidated after insertion. An authenticated browser refresh at `/church/manage?section=ministries` verified all six groups and their Settings actions. The database retained all 13 existing fellowships. Future direct local data inserts also require invalidating this local list cache; restarting the speed layer alone does not clear persisted Cache API entries.

简体：已用通过测试的 Debug 构建及原有开发配置重启本地 API，并清除本地教会下属组列表的持久化缓存。登录后的浏览器已确认“事工”页显示六组及“设置”按钮，数据库原有 13 个团契保留。以后直接写入本地数据时也须刷新列表缓存，仅重启速度层不会清除持久化缓存。

繁體：已用通過測試的 Debug 構建及原有開發設定重啟本機 API，並清除本機教會下屬組列表的持久化快取。登入後的瀏覽器已確認「事工」頁顯示六組及「設定」按鈕，資料庫原有 13 個團契保留。以後直接寫入本機資料時也須重新整理列表快取，僅重啟速度層不會清除持久化快取。

On request, the six groups were added to the local `localhost,14333 / alife_db` church using `pwsh -File scripts/add-local-ministry-groups.ps1`. This script is restricted to that database, runs all six inserts in one transaction, skips compatible existing matches, and stops on ambiguous or incompatible matches. It sets bilingual names, Ministry type and Protected access, without assigning leaders or members. It is not part of automatic seeding or production deployment. Local verification confirmed six rows, repeat execution without duplicates, and preserved existing fellowships. EF applied `20260908234441_AccountApplicationInvitations` (also pending locally) and `20260909205231_AddGroupType`; production was not changed.

简体：按明确要求，已通过 `scripts/add-local-ministry-groups.ps1` 在本机 `localhost,14333 / alife_db` 教会下加入六个事工组。脚本限制本地数据库，在单个事务内按双语名称检查重复，设置事工类型及受保护访问，不指定负责人或成员；不进入自动播种或生产部署。已验证六条记录及重复执行不重复创建，原团契保留。本地应用了尚未执行的 `AccountApplicationInvitations` 和 `AddGroupType` 迁移，生产未变。

繁體：按明確要求，已透過 `scripts/add-local-ministry-groups.ps1` 在本機 `localhost,14333 / alife_db` 教會下加入六個事工組。腳本限制本機資料庫，在單一交易內按雙語名稱檢查重複，設定事工類型及受保護存取，不指定負責人或成員；不進入自動播種或正式環境部署。已驗證六筆記錄及重複執行不重複建立，原團契保留。本機套用了尚未執行的 `AccountApplicationInvitations` 和 `AddGroupType` 遷移，正式環境未變。

## Migration, compatibility, and caching

`20260909205231_AddGroupType` adds non-null integer `groups.group_type` with default `0`; it preserves all existing records and relationships. Apply this migration through the approved database deployment process before running the new backend. Generating it does not apply it. Down drops only the new column and loses classification, so back up classifications before any authorized rollback; roll back application code before dropping the column.

Frontend group normalization accepts numeric or case-insensitive named enum values and treats a missing field in old responses or browser caches as Fellowship. Type is immutable in the profile API, so pre-upgrade records cached without the field retain the correct classification. New groups use the existing subgroup/discoverable cache invalidation and client query refresh paths. API visibility, private/no-cache responses, shared-cache authorization dimensions, TTLs, and membership invalidation remain unchanged; type is not an authorization dimension. Language switches only change presentation.

Verification covers the church/non-church creation matrix, unauthorized and invalid-type requests without writes, persisted types in detail and cached list responses, creator membership and cache invalidation, and management navigation including legacy album links. Local SQL and authenticated browser verification are recorded above; production migration and rollout remain separate authorized operations.

## 简体中文

Group 新增持久化类型 `groupType`：`fellowship`（团契，数据库值 0）和 `ministry`（事工，值 1）。教会仍由独立的 `IsChurch` 标识；所有旧组默认团契，不按名称推断或改动历史层级。教会管理分两类显示和创建；普通小组的“下属小组”改为“事工”，后端只允许新增事工。历史下属团契保留并标明类型。组设置不支持重新分类，操作按钮使用“设置”。

API 新增类型字段，创建请求未提供时默认团契，因此旧客户端在非教会父组下创建会被拒绝，须明确传入 `ministry`。非法值及无权限请求不会写入数据。双语字段、权限、成员归属及缓存规则不变；旧响应缺少字段时前端按团契兼容。移除小组管理的相册入口及重复面板，旧 `section=albums` 管理链接回到资料页，小组生活的相册功能不变。

小组管理侧栏说明同步使用“事工”并移除相册。非教会组的 `section=ministries` 也会打开原 `section=subgroups` 管理面板，避免直达链接显示空白。

迁移 `20260909205231_AddGroupType` 必须在新后端运行前经批准应用；回滚删除类型列前须备份类型并先回滚应用。教牧团、执事会、媒体事工组、敬拜赞美团、PA组、PPT组不自动创建。验证覆盖创建类型／权限、无副作用拒绝、类型读取及缓存、组长赋权和导航；本地 SQL 与登录后浏览器验收记录见上文，生产迁移与部署仍须另行授权。

## 繁體中文

Group 新增持久化類型 `groupType`：`fellowship`（團契，資料庫值 0）和 `ministry`（事工，值 1）。教會仍由獨立的 `IsChurch` 標識；所有舊組預設團契，不按名稱推斷或改動歷史層級。教會管理分兩類顯示和建立；普通小組的「下屬小組」改為「事工」，後端只允許新增事工。歷史下屬團契保留並標明類型。組設定不支援重新分類，操作按鈕使用「設定」。

API 新增類型欄位，建立請求未提供時預設團契，因此舊客戶端在非教會父組下建立會被拒絕，須明確傳入 `ministry`。非法值及無權限請求不會寫入資料。雙語欄位、權限、成員歸屬及快取規則不變；舊回應缺少欄位時前端按團契相容。移除小組管理的相冊入口及重複面板，舊 `section=albums` 管理連結回到資料頁，小組生活的相冊功能不變。

小組管理側欄說明同步使用「事工」並移除相冊。非教會組的 `section=ministries` 也會開啟原 `section=subgroups` 管理面板，避免直達連結顯示空白。

遷移 `20260909205231_AddGroupType` 必須在新後端執行前經批准套用；回滾刪除類型欄位前須備份類型並先回滾應用。教牧團、執事會、媒體事工組、敬拜讚美團、PA組、PPT組不自動建立。驗證涵蓋建立類型／權限、無副作用拒絕、類型讀取及快取、組長賦權和導覽；本機 SQL 與登入後瀏覽器驗收記錄見上文，正式環境遷移與部署仍須另行授權。
