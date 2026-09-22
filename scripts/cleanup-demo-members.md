# 清理十个虚拟成员

范围固定为 `eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10` 至 `...ee19`，即陈以诺、刘子谦、张伟恩、黄嘉诚、吴德安、李恩慈、王思宁、周明洁、林悦诗、赵雅文。不包括另外四个 Demo Leader / Co-Leader / Member / Pending，也不包括真实小组长。

## 关联清单与处理策略

[完整结构清单](demo-member-relations.md)来自 EF snapshot。它不代表生产记录已经存在；运行 [SQL 脚本](cleanup-demo-members.sql) 的默认预览才会列出目标数据库的实际命中记录、行 ID、数量与阻断项。报告包含内部 ID，应保存在受限位置。

| 关联 | 策略 |
|---|---|
| `group_memberships.member_id` | 删除这十人的小组关系，保留小组及其他成员 |
| `member_platform_roles.member_id` | 删除这十人的平台角色分配，保留角色定义 |
| `bible_reading_progresses.member_id` | 删除个人读经进度 |
| `member_passkey_credentials.member_id`、`passkey_ceremonies.member_id` | 删除个人登录凭据及认证过程 |
| `contact_profiles.member_id` | 删除个人联系资料；其他表引用它时阻断 |
| `notification_messages.recipient_member_id` | 删除发给虚拟成员的通知；发给其他人的通知保留并在引用虚拟成员时阻断 |
| `member_activation_invitations.member_id` | 删除发给虚拟成员的激活邀请 |
| 邀请 → `activation_group_grants`、`onboarding_flows` → `passkey_ceremonies` | 只沿指定个人附属链扩展，子记录先删 |
| 活动报名、排班、任务、监护／接送、财务／安全／审批、审计记录 | 输出阻断项，不自动删除业务或改写历史；报名还可能涉及容量和候补处理 |
| 页面、论坛、活动、文件等的作者／所有者；由虚拟成员给真实成员分配的权限 | 输出阻断项，不递归删除共享内容或冒用真实人员作为历史作者 |
| 任意其他外键、GUID 列、文本／JSON 内的目标或待删附属记录 ID | 在删除计划之外命中即阻断，包括 `CASCADE` / `SET NULL` 的潜在连带修改 |

删除顺序从实时外键和显式逻辑关系推导，先子表再父表，最后成员。有循环、未知主键结构、启用的行级安全策略、待删表的触发器或 temporal history 时拒绝执行。不会禁用外键，也不会把未知关联自动设为空。生产新增的表／外键会进入实时检查。

GUID 扫描包含无外键的逻辑关系；文本扫描支持大小写及带／不带连字符的 GUID。二进制、加密／编码内容、只保存姓名或邮箱的文本、外部对象存储和缓存不属于数据库 ID 扫描的覆盖范围，需要单独核对。历史审计中的 ID 可以有意保留，但必须先作明确的业务保留决策并修改策略；当前程序保守阻断。

## 操作步骤

1. 用有完整 `SELECT` 和 `VIEW DEFINITION` 权限、且不会被数据可见性限制的连接，在 SSMS / Azure Data Studio 中连接正确数据库，执行整个脚本。默认 `@Apply = 0`，只读应用表，不执行删除。需要 `sqlcmd` 时使用现有安全认证方式及 `-b -f 65001 -i scripts/cleanup-demo-members.sql`，不要把密码放在命令行或报告里。
2. 检查 `database_name`、十人的身份匹配、`created_utc`、实际关联与 `blocks=1` 行。创建时间输出为数据库 UTC，没有假定用户界面的时区。现存目标要求 ID、姓名、邮箱、电话均匹配；已不存在的账号允许重复运行，但残留引用仍会报告。不要用姓名模糊匹配扩大删除范围。
3. 对每个阻断项逐项决定保留、取消、通过既有业务流程转移负责人，或另行清理确定为虚拟的数据。不要批量删除全部引用表，也不要通过删审计记录或改审批人来绕过阻断。
4. 在已获批准的隔离 SQL Server 副本上演练，确认备份及恢复方案可用，保存预览的待删行 ID 和受影响 `group_id/member_id`。预览涉及全表 GUID／文本扫描，可能较慢；在低流量窗口运行。预览使用 SERIALIZABLE 事务，读取期间也可能阻塞写入。
5. 部署包含 `Seed:IncludeDemoMembers` 开关的代码，并在所有生产 DbMigrator／种子执行环境设置 `Seed__IncludeDemoMembers=false`（JSON 配置为 `"Seed": { "IncludeDemoMembers": false }`）。默认仍为 `true`，兼容现有开发环境；未关闭会在下次运行种子时重新生成这十人。此开关只停止这十人的生成，不删除任何现存数据，也不关闭其他初始化行为。

   仓库的 `main_ccalc-api.yml` 已在生产发布 job 环境和 Function App settings 中明确设置该值为 `false`；该 job 内的 DbMigrator 会继承它。其他手动种子执行环境仍需单独配置。发布流程不执行本清理 SQL。
6. 获得生产执行授权后进入维护窗口：停止 API 写入、后台任务及种子任务，限制这十个身份继续访问；完成备份。SQL 不撤销已签发令牌，维护窗口内还要完成下述授权缓存处理。
7. 在脚本副本中设置 `@Apply=1`、`@ExpectedDatabase=N'实际数据库名'`、`@MaintenanceAndBackupConfirmed=1`。再次执行整个脚本。它重新计算计划并在同一事务中锁定所有扫描表，检查关联后按顺序删除，核对每表删除数量；任何异常全部回滚。应用模式持有全表排他锁，不适合在线流量。禁止在外层事务内运行。
8. 成功提交后，在恢复流量前完成缓存清理（下节），再用新连接运行默认预览，确认十人及附属记录均不存在，且无残留阻断引用。验证真实小组长登录、成员列表及权限正常。每次执行使用新连接，避免前次临时表影响。

## 缓存与会话

此 SQL 是数据库维护程序，不调用 Cloudflare，也不自动清理应用缓存。授权 KV 的 TTL 可能达七天，不能仅删除数据库后立即恢复流量。

- 对预览输出的每个 `group_id/member_id` 调用现有 `ICloudflareKvCacheService.RemoveMembershipAsync`，移除 `membership:{groupId}:{memberId}`。
- 对十个目标分别调用 `RemoveMemberProfileAsync`，移除 `member:{memberId}:profile`。
- 对受影响的小组调用 `IGroupCacheInvalidationService.RemoveMembershipsAsync`，清理 HybridCache、KV API cache 与 speed layer 对应成员、页面、活动、小组路径；其实现是路径／缓存键的权威来源。
- 在实际生产运维环境使用已有服务／缓存管理途径执行上述清理；这些是代码服务方法，不是新增 HTTP 端点。重启应用只清本机缓存，不能代替远端 KV／边缘缓存清理。确认各步骤成功后才恢复流量；失败时维持维护状态并重试。
- 验证旧凭据／旧令牌不能再获得成员权限；数据库清理本身不保证所有认证提供者的会话都即时失效。

## 验证与维护

```powershell
python scripts/demo-member-relations.py --check
dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj --filter 'FullyQualifiedName~SeedDataTests|FullyQualifiedName~DemoMemberCleanupSqlTests'
```

SQL 集成测试默认跳过。仅在已批准的可丢弃本地 SQL Server `localhost,14333` 上设置 `ALIFE_TEST_DEMO_CLEANUP_SQL=1`；必要时通过 `ALIFE_LOCAL_SQL_PASSWORD` 提供本地密码。测试只创建和删除 `AlifeDemoCleanupTest_*` 数据库，覆盖预览、按依赖顺序删除、重复执行、无外键 GUID、JSON、级联子表阻断和身份不匹配，验证真实成员保留及失败时无部分清理。不连接生产。

EF schema 变化后运行 `python scripts/demo-member-relations.py` 更新清单。自动生成器只读仓库文件，不访问数据库。程序仍以目标库的实时结构为准。
