# RAM administrator initialization / RAM 管理员初始化

This guide does not authorize deployment, shared database migration or policy publication.

## Database preparation

Review `20260911120019_AddVersionedRamGovernance` and its generated model snapshot. It adds church policy versions, immutable assessment snapshots, append-only actions and current assessment/concurrency metadata. The original schema migration preserved existing JSON/status and archived genuine approval actors/times; it invented no residual scores or published policy. The separately authorized pre-launch local cleanup below now replaces obsolete activity formats and removes affected signing/Package history.

The migration SQL was generated for review (without applying it). Regenerate with `dotnet ef migrations script 20260911023825_AddEventPreparationReopenRequests 20260911120019_AddVersionedRamGovernance --project backend/src/Alife.Infrastructure --startup-project backend/src/Alife.Infrastructure --no-build --output <review-file.sql>`. Review it and test on an explicitly authorized disposable SQL Server copy before shared application. Automated persistence tests use EF InMemory; SQL execution, foreign keys, indexes and transactional locking still require that database check. Back up first. Down migration removes the new history tables: preserve evidence before rollback, and never return an active deployment to a client that overwrites version 2 RAM.

## First policy

1. Grant `admin.events.manageRamPolicies` through existing system permission administration. The administrator also needs approved membership in the selected root church. Reviewers separately need `admin.events.audit` and church membership.
2. Open **System management → RAM policy settings** (`/admin/ram-policies`). The deployment's church is resolved automatically; no church selection is needed. Groups inherit only that church's policy.
3. Review both languages of the five likelihood/impact definitions, five SOP risk categories, human/equipment/task guidance and generic/specialist check items. Applicable attribute uses All activities or a fixed independent attribute (hiking, water, sport, transport, accommodation/overnight, meal, outdoor). There is no configurable attribute catalogue. Activity items use checkboxes; general checks always apply and specialist checks combine. Both the activity editor and RAM show collapsed reference lists without adding mandatory answers. The current interface language is shown first; expand the other language manually. Add local check items as needed, retaining stable question codes.
4. Resolve the source colour ambiguity with the church's responsible safety authority. Explicitly set Green/Yellow/Red for **all 25 cells** and preview the matrix. During Alpha demonstration, the administrator may explicitly load the editable demo preset (scores 1–5 Green, 6–19 Yellow, 20–25 Red; legacy Amber/Orange combined as Yellow) as a starting point. Loading does not save or publish and does not replace the safety authority's cell-by-cell review.
5. Record the reviewed source/revision and follow-up deadline. Save, review and explicitly publish. Until then users may save drafts but cannot request formal confirmation or submit version 2 RAM.
6. Restore or revise a published policy through a new draft/version. New publication does not automatically revoke approved RAM; adopting it or changing material content requires fresh confirmation and review.

## Operational check

Open Event Workspace → Arrangements → Safety → RAM and safety; the assessment is embedded in its arrangement section. Saved-edit bookmarks redirect to Workspace instead of the retired AI event editor. Use a disposable Event with an author, an accepted-duty on-site member and an independent church reviewer. Complete risks for each item in the actual Event Activity List. Check-item prompts retain their generic/specialist matching, but the current workspace has no Required Questions card or answer-completeness gate. Check both scores against the matrix. Have the named person log in and confirm the fixed revision, submit, then review independently. Red residual risk needs explicit health/safety sign-off and a separate qualified leader's Enhanced Package approval before publication. RAM approval itself does not publish.

Print the selected revision, inspect its matrix/version/audit history and save PDF if needed. Drafts carry a draft label. Change a material field and verify current confirmation/approval and dependent gates invalidate while history remains. Frozen preparation first follows existing approval reopening.

No external venue, trail, weather or tide data is fetched. AI question guidance uses only enums and is optional; provider failure leaves manual assessment available. Private contacts, medical details and full RAM are excluded from its model context.

## 中文操作要点

既有结构迁移应先在获准的可弃置 SQL Server 副本验证，不补造剩余评分或发布政策。2026-10-11 已另行授权下述本地一次性格式清理：保留可转换项目，清除旧 RAM 独有资料及受影响的签名、修订和审批包；应用前保存恢复备份。此次清理不执行结构迁移、seed 或部署，不授权共享数据库操作。

授予独立的 `admin.events.manageRamPolicies` 权限，管理员还须是本部署教会的已批准成员。进入“系统管理 → RAM 政策设置”，系统自动读取部署所属教会，无需重新选择。检查双语评分定义、五类风险及检查项；检查项的“适用属性”选择所有活动或固定属性（徒步、水上、运动、交通、住宿／过夜、聚餐、户外），不提供属性目录配置。活动项目使用独立多选框，通用检查始终适用，其他检查按已选属性合并。例如室外聚餐匹配通用、聚餐、户外检查。活动编辑处和 RAM 均提供默认收起的检查清单，不新增必答门槛。属性不由 Event 模板或功能模块推断，不自动改写 Event 层面的设置。默认显示当前界面语言，另一语言可手动展开查看或编辑。手册颜色有歧义；Alpha 演示期间可明确载入可编辑预设（1–5 绿色、6–19 黄色、20–25 红色；旧版 Amber/Orange 合并为 Yellow）作为起点。载入不会保存或发布，仍须由安全负责人逐格确认全部 25 格，再预览、保存并明确发布。小组只继承本教会政策，无跨教会回退。未发布时仍可保存草稿。

现场负责人须已接受活动职责，并用本人账号确认指定版本，不能代签。作者、提交人、现场确认人不能自审。黄色须额外控制，红色剩余风险须明确健康安全签署及独立领导层加强审批。RAM 批准不会自动发布。重要变更撤销当前确认及审批资格，历史保留；冻结筹备沿用撤销批准流程。历史政策恢复须发布新版本，不能改写旧版。


## Background synchronization setup / 后台同步配置

Review additive migration `20260915074357_AddRamBackgroundSynchronization` (ten columns and a due-job index). It preserves existing approval fields, JSON and history. Apply it only in an explicitly approved environment before deploying the dependent backend; no database application is part of this change. Historical records acquire no fabricated AI evaluation or owner acknowledgment.

Use the existing speed-layer origin in backend `Cloudflare:SyncWorkerBaseUrl`. Provision a dedicated secret with matching values in backend `Cloudflare:RamSyncApiToken` and Worker `RAM_SYNC_API_TOKEN`; do not reuse `CACHE_SYNC_API_TOKEN`. The Worker retains its existing `GEMINI_API_KEY`/`GEMINI_MODEL`. All calls require HTTPS, refuse redirects and have bounded payloads/timeouts; raw request/response bodies are not logged. Secrets are not committed or automatically provisioned by this task.

Enable the `EventRamSync` TimerTrigger in the deployed Azure Functions host with its existing timer storage. Local testing that runs timers requires the existing local-development scheduled-jobs/Azurite configuration; do not silently start it. Missing provider configuration leaves RAM outdated with a retryable failure, and submission stays blocked. Test with two accounts and concurrent upstream changes against an approved disposable SQL database before rollout. Reverting the application may retain additive columns; the generated Down migration deletes sync metadata and should not be applied without separate review.

中文：先审核并在获准环境应用新增迁移，再配置后台与 Worker 对应的专用 RAM 同步密钥，沿用现有 Gemini 服务。开启 Azure Functions 定时任务与存储。此次修改不自动配置密钥、不执行数据库迁移或部署。AI 仅接收枚举、数量与活动风险信号；首次同步或失败时保持待核对，不能自动批准。上线前用独立账号验证同步失败、并发修改、人工核对、现场签署及独立安全审批。

Runtime RAM requires schema version 2 with fixed attribute arrays; there is no editor adoption/upgrade fallback. Complete the authorized local cleanup before using this origin/Worker format together. A missing Activity Plan prevents background calls. The local development launcher disables `EventRamSync` unless `-EnableScheduledJobs` is supplied. 中文：运行时只接受含固定属性数组的版本 2 RAM，不提供旧资料采纳或升级入口。先完成获准的本地清理，再一起使用相同格式的后台和 Worker；没有活动计划时不调用后台 AI。本地启动器默认停用定时任务，需显式开启计划任务。

Focused reproduction: run `npm run test:ram-sync` in `cloudflare/speed-layer`; run `node cloudflare/alife-app/tests/ramSync.browser.cjs` against Vite on port 5175 (override with `ALIFE_BROWSER_BASE_URL`, and set `ALIFE_PLAYWRIGHT_MODULE` when Playwright is supplied by the bundled runtime). Browser data and provider responses are fixtures.

## Activity-source migration (2026-09-15)

The original additive migration `20260915101331_EventActivityPlanningSources` creates `event_activity_plans` (Event PK/FK, JSON, concurrency token, timestamp) and nullable `event_operations_tasks.activity_id`; its original adoption flow has been withdrawn. Current owners directly maintain the actual Activity List with required fixed attributes. A missing source blocks background calls with `ram.sync.activityPlanRequired`. Deploy the matched Worker activity-key/attribute contract with origin changes; mismatched versions fail closed and preserve prior risks. This section records the existing schema dependency, not authorization to apply a migration.

## Pre-launch local format cleanup — 2026-10-11

Only the user-confirmed `localhost,14333 / alife_db` target is permitted. Run the existing DbMigrator against that configured connection with the explicit cleanup mode; this branch bypasses migrations and seeding. Stop the local application during application/recovery, then restart it so process-local caches cannot serve the old projection. Do not change the connection to make a failed command succeed.

```powershell
$activityCleanupOutput = 'C:/Data/Alife/Temp/ram-format-cleanup-20261011'
dotnet run --project backend/src/Alife.DbMigrator --no-build -- --Events:NormalizeActivities=preview --Events:ExpectedServer=localhost,14333 --Events:ExpectedDatabase=alife_db --Events:OutputDirectory=$activityCleanupOutput
```

Inspect `preview.json`: affected Event/record identities and counts are explicit. Before applying, retain its fingerprint; an absent/stale report or changed source fingerprint rejects application. The following applies the inspected preview to the same target:

```powershell
$activityCleanupFingerprint = (Get-Content -LiteralPath "$activityCleanupOutput/preview.json" -Raw | ConvertFrom-Json).Fingerprint
dotnet run --project backend/src/Alife.DbMigrator --no-build -- --Events:NormalizeActivities=apply --Events:ExpectedServer=localhost,14333 --Events:ExpectedDatabase=alife_db --Events:OutputDirectory=$activityCleanupOutput --Events:ExpectedFingerprint=$activityCleanupFingerprint
```

Before commit, the command writes private original-row JSON, `restore.sql` and the preview into a timestamped backup directory. Conversion and reference deletion are atomic under a serializable transaction. Apply twice to verify the second pass reports no changes. Recovery SQL is only for the same local database with the application stopped; inspect it and retain the original backup before recovery.

Conversion retains usable activity names/conditions, valid fixed attributes and valid policy content. Unknown attributes become empty; unrecoverable items are removed. Without an Activity Plan, old RAM-only activities are erased, never imported. Embedded source removal is limited to `EventDataJson.ram`, `ramDataJson`, `ramAssessment` and `arrangements.activityPlan`; other module JSON remains. Unsupported check scopes/answers and risks without a current source are removed. Affected revisions, signatures and Packages are deleted together with their dependent references/receipts; ordinary tasks retain their content and only lose invalid activity links. Affected Events return to preparation. Event/participant records, unrelated modules, the sixteen templates and accepted Plan snapshots are retained. No shared database change, migration, seed, deployment or live AI call is included.

中文：命令仅允许已指定的本地库。先执行预览并核对记录与数量，再使用同一预览的指纹执行应用；执行前停止本地应用，完成后重启。清理先保存原始行及恢复 SQL，再在事务内转换／删除，重复执行应无变化。未知属性清空，可用项目名称与条件保留；无活动计划的旧 RAM 资料直接清除，不再采纳。受影响的旧签名、修订、审批包及关联回执成组清理，活动回到筹备；普通任务、报名资料、其他模块以及十六个 Event 模板和 Plan 快照保留。备份含本地私密资料，不公开分享。
