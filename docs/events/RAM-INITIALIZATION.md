# RAM administrator initialization / RAM 管理员初始化

This guide does not authorize deployment, shared database migration or policy publication.

## Database preparation

Review `20260911120019_AddVersionedRamGovernance` and its generated model snapshot. It adds church policy versions, immutable assessment snapshots, append-only actions and current assessment/concurrency metadata. Existing JSON, status and approvals remain unchanged; genuine historical submission/approval actors and times are archived. No residual scores or published policies are invented.

The migration SQL was generated for review (without applying it). Regenerate with `dotnet ef migrations script 20260911023825_AddEventPreparationReopenRequests 20260911120019_AddVersionedRamGovernance --project backend/src/Alife.Infrastructure --startup-project backend/src/Alife.Infrastructure --no-build --output <review-file.sql>`. Review it and test on an explicitly authorized disposable SQL Server copy before shared application. Automated persistence tests use EF InMemory; SQL execution, foreign keys, indexes and transactional locking still require that database check. Back up first. Down migration removes the new history tables: preserve evidence before rollback, and never return an active deployment to a client that overwrites version 2 RAM.

## First policy

1. Grant `admin.events.manageRamPolicies` through existing system permission administration. The administrator also needs approved membership in the selected root church. Reviewers separately need `admin.events.audit` and church membership.
2. Open **System management → RAM policies and questions** (`/admin/ram-policies`) and select the church. Groups inherit only that church's policy.
3. Review both languages of the five likelihood/impact definitions, five SOP categories, human/equipment/task guidance and generic/specialist questions. Add local questions as needed, retaining a generic mandatory question for every category.
4. Resolve the source colour ambiguity with the church's responsible safety authority. Explicitly set Green/Yellow/Red for **all 25 cells** and preview the matrix. During Alpha demonstration, the administrator may explicitly load the editable demo preset (scores 1–5 Green, 6–19 Yellow, 20–25 Red; legacy Amber/Orange combined as Yellow) as a starting point. Loading does not save or publish and does not replace the safety authority's cell-by-cell review.
5. Record the reviewed source/revision and follow-up deadline. Save, review and explicitly publish. Until then users may save drafts but cannot request formal confirmation or submit version 2 RAM.
6. Restore or revise a published policy through a new draft/version. New publication does not automatically revoke approved RAM; adopting it or changing material content requires fresh confirmation and review.

## Operational check

Open Event Workspace → Arrangements → Safety → RAM and safety; the assessment is embedded in its arrangement section. Saved-edit bookmarks redirect to Workspace instead of the retired AI event editor. Use a disposable Event with an author, an accepted-duty on-site member and an independent church reviewer. Complete each activity's risks and applicable questions; N/A requires a reason. Check both scores against the matrix. Have the named person log in and confirm the fixed revision, submit, then review independently. Red residual risk needs explicit health/safety sign-off and a separate qualified leader's Enhanced Package approval before publication. RAM approval itself does not publish.

Print the selected revision, inspect its matrix/version/audit history and save PDF if needed. Drafts carry a draft label. Change a material field and verify current confirmation/approval and dependent gates invalidate while history remains. Frozen preparation first follows existing approval reopening.

No external venue, trail, weather or tide data is fetched. AI question guidance uses only enums and is optional; provider failure leaves manual assessment available. Private contacts, medical details and full RAM are excluded from its model context.

## 中文操作要点

本次只交付代码与迁移，不执行共享数据库迁移或部署。先在获准的可弃置 SQL Server 副本验证；旧 RAM 原文及真实历史审批保留，不补造剩余评分。回退会删除新历史表，须先保全证据。

授予独立的 `admin.events.manageRamPolicies` 权限，管理员还须是所选教会的已批准成员。进入“系统管理 → RAM 政策与题库”，检查双语评分定义、五类风险及题库。手册颜色有歧义；Alpha 演示期间可明确载入可编辑预设（1–5 绿色、6–19 黄色、20–25 红色；旧版 Amber/Orange 合并为 Yellow）作为起点。载入不会保存或发布，仍须由安全负责人逐格确认全部 25 格，再预览、保存并明确发布。小组只继承本教会政策，无跨教会回退。未发布时仍可保存草稿。

现场负责人须已接受活动职责，并用本人账号确认指定版本，不能代签。作者、提交人、现场确认人不能自审。黄色须额外控制，红色剩余风险须明确健康安全签署及独立领导层加强审批。RAM 批准不会自动发布。重要变更撤销当前确认及审批资格，历史保留；冻结筹备沿用撤销批准流程。历史政策恢复须发布新版本，不能改写旧版。
