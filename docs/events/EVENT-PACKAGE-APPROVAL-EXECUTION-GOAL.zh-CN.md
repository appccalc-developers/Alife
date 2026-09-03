# Event Package Approval：完整执行目标

> 文档类别：**执行目标 / 产品与架构提案（非现行权威契约）**
> 基线：`main` at `eb1a4b9`，2026-09-02
> 当前范围：Event Package、整体审批、生命周期门槛、重大变化重审
> 明确延期：Plan B / Contingency 不在本目标内，后续另立目标
> 权威边界：第 0 阶段获得确认以前，本文件不能覆盖 `EVENT-CONTRACT.md`、`event-contract.json` 或各模块规范。

## 1. 一句话目标

在不增加第二套工作流引擎、不削弱 RAM 等专项审批、不泄露受保护资料、也不让简单活动承担复杂流程的前提下，为 ALIFE 建立版本化的 **Event Package Approval**：系统汇总当前活动方案和各模块权威资料，由适当管理角色对完整方案作出可审计决定，并确保只有当前 Package 获得有效批准、条件已经落实且没有门槛阻塞时，才允许有权限的人明确发布、开放报名和确认进入执行。

### 1.1 用业务语言解释目标

现在的 ALIFE 能帮助负责人“把活动准备起来”，但不能回答一个最关键的问题：

> **教会究竟依据哪一版完整资料、由谁、在什么时候，正式同意这个活动进入公开报名和执行？**

本目标要补上的不是一个“批准”按钮，而是一条可追溯的责任链：

1. 组织者在现有模块中准备资料，不重复填写另一份大表。
2. ALIFE 把当前 Event Plan、场地、人员、RAM、儿童保障、交通、报名、财务等适用资料汇总成一个冻结版本。
3. Event Lead 明确声明“这一版已准备好，请审核”。
4. 系统只把审批人有权查看的必要资料交给正确的审批人。
5. 审批人针对准确版本作出批准、附条件批准、退回或拒绝。
6. 系统持续检查决定、条件和专项审批是否仍然有效。
7. 发布、开放报名和执行仍由有权限的人主动操作，但服务器在每个入口执行相同门禁。
8. 方案发生实质变化时，系统保留旧记录、明确指出影响并要求适当重审。

完成后，任何人查看一个活动都应该能清楚回答：当前批准的是哪一版、批准覆盖什么范围、谁有权决定、还有什么条件、为什么现在能或不能发布/报名/执行，以及发生变化后下一位责任人是谁。

### 1.2 这个目标不是什么

- 不是把 Word/PDF SOP 原样搬成一张超长网页表单。
- 不是让所有日常小组活动经历同样复杂的审批。
- 不是用整体批准代替 RAM、Safeguarding、Finance 或 Sponsorship。
- 不是把 Readiness 的系统判断包装成人的审批决定。
- 不是批准后自动发布、自动开放报名或自动执行。
- 不是重新实现 Workflow、任务、通知或模块数据的第二套引擎。
- 不是本轮实现 Plan B。

### 1.3 本轮结束时应当交付的产品能力

本目标完整交付后，ALIFE 至少具有以下可使用能力：

- Event Lead 能在活动工作区看到“方案审批”入口，检查资料来源和缺口后生成并提交 Package。
- 整体审批人能在自己的待办和 Event 工作区收到一项准确、可解释、可审计的审批事项。
- 审批人能查看七类汇总资料、专项决定、未完成条件和与上一版本的差异，而不是在多个页面自行拼凑事实。
- 条件负责人和验证人能分别提交证据和确认条件，不会混淆职责。
- Event Lead、发布人和 Registration Manager 能看到三个 gate 的明确结论、原因和下一步行动。
- 匿名访问者不能提前看到草稿活动或使用未开放的报名链接。
- 重大变化后，旧批准立即失去对受影响范围的授权作用，并产生明确的重审任务。
- 管理者和审计人员能重现历史决定，但无权人员不能借历史页面读取敏感资料。

### 1.4 目标完成的衡量方式

本目标不是以“数据库表已经创建”或“页面能够打开”为完成标准，而以以下结果衡量：

- 所有发布、撤下、报名打开/关闭、报名提交和执行确认入口都使用同一个服务器 gate evaluator。
- 所有已提交和已决定的 Package 都能重现当时的 schema、政策、Plan 和模块来源版本。
- 所有治理关键变化都能得到确定的失效结论；无法分类时 fail closed。
- 所有受保护响应都经过正反角色测试，没有跨查看者缓存或 ETag 复用。
- 一个复杂活动和一个周期性活动能够完成端到端演示，并留下可核验的审计记录。
- 旧活动上线迁移不会发生无解释的公开消失、报名中断或历史资料丢失。

## 2. 本目标解决的问题

ALIFE 已经能够组合活动方案、保存 Event Plan Snapshot、建立团队和任务、完成 RAM 等专项审核并计算 Readiness，但尚未形成以下闭环：

1. 没有把当前活动方案及各模块权威资料汇总成可审计的 Event Package。
2. 没有由适当管理角色对完整活动方案作出正式决定的整体审批流程。
3. 创建者接受 Event Plan、RAM Approval、Church Sponsorship 和完整活动方案批准之间的语义尚未形成清楚的产品闭环。
4. 发布、开放报名和进入执行的服务端门槛没有绑定 Event Package 的有效批准版本。
5. 活动发生重大变化后，系统不能可靠判断旧批准是否失效、哪些专项决定必须重审。
6. 现有 Approval、Plan、Readiness、Workflow、通知和模块数据已有基础，但没有被统一编排成完整的活动治理能力。

## 3. 完成后的业务结果

完成本目标后，应能观察到：

- Event Lead 不需要填写另一张重复的大表；系统从 Event Plan 和已启用模块生成版本化 Event Package。
- 审批人看到的是足以负责判断的完整方案、来源版本、未完成项目、重大变化和权限范围内的资料。
- 创建者接受 Plan Proposal 只负责建立或更新 Event Plan，不代表教会已经批准活动。
- RAM、Safeguarding、Finance、Sponsorship 等专项决定保持独立权威；整体审批引用但不替代它们。
- 支持批准、附条件批准、退回修改和拒绝，并保留每次决定、理由、条件和准确版本。
- `Approved` 不等于自动发布；发布、开放报名和执行确认仍是有权限人员的显式动作。
- 已批准方案发生重大变化后，旧批准不能继续授权新版本活动。
- 普通内部小组活动保持轻量，复杂活动根据已确认事实、政策和启用模块获得更完整治理。

### 3.1 目标用户、当前困难和完成后的动作

| 用户 | 当前困难 | 完成后在 ALIFE 中的动作 | 得到的结果 |
| --- | --- | --- | --- |
| Event Lead | 不知道完整方案是否足以送审，也要在多个模块之间人工核对 | 查看缺口、生成 Package、预览、提交、回应退回并生成新版本 | 清楚知道还缺什么以及下一位责任人是谁 |
| 整体审批人 | 只能看到零散资料，难以确认批准的准确版本 | 从待办进入审批工作区，查看摘要、专项决定、差异和条件后作决定 | 决定与准确 Package、权限和时间绑定 |
| RAM/Safeguarding/Finance 审批人 | 容易被误认为整体活动批准人 | 继续只处理自己的专项决定，并让 Package 引用权威版本 | 专项责任不被整体审批覆盖 |
| 条件负责人 | 不清楚条件影响哪个阶段、应提交什么证据 | 在条件项中提交最小必要证据 | 条件状态和责任清楚可追踪 |
| 条件验证人 | 可能与执行人混为一人 | 独立验证或退回条件证据 | 满足职责分离要求 |
| 发布人/Registration Manager | 不知道批准是否仍有效，也可能从旧入口绕过 | 查看 gate 解释并显式发布、撤下、开放或关闭报名 | 所有入口得到一致结果 |
| 普通成员/参加者 | 可能看到未批准资料或遇到状态不一致的报名页 | 只访问已批准的公开投影和当前报名状态 | 不会基于草稿或过期方案作决定 |
| 管理员/审计者 | 难以还原谁依据什么作了决定 | 按权限查看版本、决定、失效原因和审计元数据 | 能调查问题而不扩大敏感资料访问 |

### 3.2 三个代表性结果场景

#### 场景 A：普通内部小组聚餐

- 已确认事实不涉及公开宣传、儿童、收费、交通、住宿或特殊风险。
- 系统计算为 `light`，只生成活动概要、责任人、时间地点和适用 Readiness。
- Accountable Owner 检查并显式确认，不要求填写复杂模块资料。
- 活动保持组内可见；任何未知关键事实仍显示为待确认，不能自动当作“不涉及”。

#### 场景 B：公开报名的户外活动

- 已确认事实触发 Registration、RAM、Venue 和 Travel。
- Event Lead 必须完成场地、容量、RAM、司机车辆、报名隐私说明和公开内容草稿。
- Package 提交后，由治理政策指定的管理角色整体决定；RAM 仍由独立审批人决定。
- 批准并满足条件后，Registration Manager 显式开放报名，发布人显式发布。
- 若场地或人数上限改变，旧 Package 对相关 gate 失效，公开/报名状态按政策安全收敛并进入重审。

#### 场景 C：周期性聚会中的单次例外

- Event 级 Package 覆盖机器契约明确的一组 Occurrence。
- 某一周更换场地时，只为该 Occurrence 生成差异和必要的局部重审。
- 若变化影响整个系列的责任人、公开范围或治理政策，则升级为 Event 级新 Package。
- 其他未受影响 Occurrence 不被无理由阻断，历史批准范围仍可解释。

## 4. 已有基础与复用边界

本目标必须复用：

- `GroupEvent` 兼容持久化根；
- Event facts、compose/recompose 和不可变 `EventPlanSnapshot`；
- `EventWorkflowRun` / `EventWorkflowStep` / `EventArtifact` 单一通用工作流引擎；
- Event Team、角色、任务、依赖、Blocker 和 Readiness；
- RAM 草稿、提交和独立审批；
- Church Sponsorship 申请和决定；
- Programme、Roster、Venue、Travel、Safeguarding 和 Registration 已有业务切片；
- 服务器授权、ETag、幂等、审计、私有缓存和公开投影边界。

以下现有概念不能直接冒充 Event Package Approval：

- `AcceptEventPlan`：只确认组合方案并保存 Plan Snapshot。
- `RAM Approval`：只批准风险评估。
- `Church Sponsorship`：只决定活动是否取得教会正式身份。
- `Readiness`：是当前证据和规则的投影，不是人的整体决定。
- `Ready to Proceed`：只能是当前 Package、专项决定、条件和活动前确认共同通过后的可解释 gate 结果；不是客户端可以直接设置的状态，也不等于 Package Approval。
- Workflow Step 的普通 approval flag：不能自动成为完整活动方案批准。

现有 `EventApprovalDecision` 可作为不可变决定账本的参考，但当前实际用于 `event.sponsorship`，决定枚举也不足以表达附条件批准和退回修改。不得仅增加一个 `SubjectType` 字符串就宣称目标完成。

### 4.1 实施前的事实确认顺序

每个执行 Issue 开始前，按以下顺序确认当前事实：

1. 阅读 `AGENTS.md`、`EVENT-CONTRACT.md`、相关模块规范、`event-contract.json` 对应部分和 `IMPLEMENTATION-STATUS.md`。
2. 检查当前分支、工作树、相关迁移、实体、handler、controller、前端 service/view 和相邻测试。
3. 区分规范目标、当前实现和已有验证证据；`Current` 不代表模块的全部目标能力已经完成。
4. 展示性 HTML、README 摘要和旧说明只能作为导航，不能用来推断某项 API、权限、迁移或 UI 已经存在。
5. 如果源代码与权威契约冲突，记录冲突、影响和最小调整方案；在未获得产品/架构决定前不得静默修改规范来迁就实现。

实现计划必须引用具体证据，例如实体或 handler 路径、机器契约条目和测试名称，而不能只写“复用现有审批能力”。

## 5. 不可破坏的原则

### 5.1 架构

- 不创建第二套通用工作流引擎。
- Event Package Approval 属于 Event 主干治理，不放入 RAM、Programme、Registration 或 Sponsorship 模块。
- 各模块继续拥有本领域的数据、验证、决定和权限；Event 主干只负责汇总、版本、整体决定和生命周期门槛。
- 所有枚举、权限、模块代码、surface key 和可执行行为由系统控制；未知值 fail closed。
- 数据库和 API 演进保持现有 Event、报名、RAM、Workflow 和公开投影兼容。

### 5.2 人工权威

- AI 可以提取候选事实、建议模块和起草双语内容，但不能生成权威 Package、提交、审批、满足条件、发布或开放报名。
- Event Lead 负责准备和提交 Package，但不能以最终确认替代管理层或专项审批。
- 管理层整体批准不能覆盖专项负责人对安全、儿童保护或财务事项的独立责任。
- 发布、开放报名和执行确认必须是可归属、可审计的显式人工动作。

### 5.3 隐私与缓存

- Event Package、决定和条件默认属于 `approvalEvidence`，使用 `private, no-store`。
- 儿童、健康、财务、联系资料和乘客名单不得进入共享缓存、公开投影、日志内容、分析事件或 AI 提示。
- Package 根据查看者权限生成最小披露投影；普通 Event Team 身份不自动获得所有资料。
- 只有经过批准、清理并使用公开 allow-list 的公开 Event 投影可以共享缓存。
- Package、条件、决定和重大变化必须覆盖相应私有缓存及公开投影失效路径。
- “不可变历史”只适用于维持责任链所需的最小审计元数据、哈希、版本和决定；不代表个人资料可以永久保留。
- 第 0 阶段必须定义按 data class 区分的保留、到期、匿名化、不可访问和删除规则。来源中的个人资料到期后，可以保留不可逆哈希和审计引用，但不得继续通过历史 Package 暴露内容。
- 决定理由、条件和证据说明必须限制长度、采用结构化字段并提示不得填写不必要的儿童、健康、财务或联系资料；审计日志只记录标识、reason code 和必要元数据。

### 5.4 版本与并发

- 已提交的 Event Package 不可原地修改；更正产生新版本。
- 每次决定绑定明确的 `eventId`、`eventPlanVersion`、`eventPackageVersion` 和内容哈希。
- 所有版本化写操作使用 ETag / `If-Match`；可重试命令使用 Idempotency-Key。
- 历史 Package、决定、条件和证据引用不可被后续模板、政策或活动修改重写。
- Package 生成必须使用一个一致的来源版本向量：读取 Event Plan、治理政策和各模块来源后，在持久化前重新验证所有版本；任何来源在生成期间变化都返回 conflict，不能保存“混合时间点”的 Package。
- 内容哈希必须基于机器契约定义的 canonical serialization、Package schema version、治理政策版本和完整来源版本向量，不能依赖运行时对象字段顺序。

### 5.5 兼容上线与回滚

- 新 gate 不得在部署时静默阻断已有的已发布、已开放报名或正在执行的 Event。
- 第 0 阶段必须确定强制启用边界，例如新建 Event、明确 schema 版本或经批准的 rollout cohort；不得由实现者临时选择。
- 旧 Event 必须被明确分类为：需重新准备正式 Package、生成只读 `legacy` Package、在有期限的兼容策略下继续，或因安全原因立即 fail closed。
- 兼容策略必须保存理由、适用范围、到期时间和审计记录；不能把缺少历史事实伪装为已满足。
- rollout 使用可撤回的配置或 feature flag，并定义数据前向兼容、回滚后的读取行为、监控指标和人工恢复步骤。

## 6. 目标治理分级

系统依据**已确认事实、版本化政策和启用模块**计算治理等级；未知关键事实不能被当作 `false`。

| 建议等级 | 典型活动 | Package 要求 | 建议整体决定人 |
| --- | --- | --- | --- |
| `light` | 普通内部小组聚餐、低风险例行活动 | 轻量 Package，仅包含适用部分 | Accountable Owner 显式确认；政策触发时升级 |
| `standard` | 使用教会资源、公开报名或较多人参加 | 完整基础 Package | Owning Group Leader / Co-leader 或受控委派角色 |
| `enhanced` | 儿童、户外、交通、住宿、收费、高风险或大型公众活动 | 完整 Package、适用专项审核和严格执行门槛 | Root-church / 指定管理角色；专项审批仍独立 |

第 0 阶段必须正式确认上述等级和权限，不能在实现中自行假定。治理等级不能由普通组织者随意降低。允许政策例外时，必须保存政策版本、理由、有效期、独立批准人和审计记录。

### 6.1 建议的触发规则起点

以下是进入 Contract 评审的具体起点，不是未经确认即可编码的最终政策：

| 已确认事实或状态 | 最低治理结果 | 必须进入 Package 的内容 | 不能省略的决定 |
| --- | --- | --- | --- |
| 仅限所属小组、无报名、无收费、无儿童/交通/住宿/特殊风险 | `light` | 概要、责任人、时间地点、适用任务与缺口 | Accountable Owner 显式确认 |
| 公开或跨小组可见 | 至少 `standard` | 公开内容草稿、受众、隐私、Sponsorship 判断、发布 gate | 政策指定整体审批；需要时 Sponsorship |
| 开放报名或人数达到政策阈值 | 至少 `standard` | 报名窗口、容量、隐私说明、同意、取消/退款原则 | 整体审批和 Registration gate |
| 儿童或青少年 | `enhanced` | Safeguarding 配置、监护同意、工作人员资格和最小摘要 | Safeguarding 专项决定及整体审批 |
| 户外、偏远、交通或住宿 | `enhanced` | RAM、天气/道路、场地、Journey、司机车辆、住宿与夜间责任 | RAM 及适用专项决定、整体审批 |
| 收费、预算、采购或退款 | 按政策至少 `standard`，可升级 `enhanced` | 金额、币种、预算/退款原则、Finance 状态，不复制完整敏感账目 | Finance 专项决定及职责分离 |
| 大型公众活动、跨事工或外部合作 | `enhanced` | 联合责任、公共影响、场地/人群/供应商和指挥责任摘要 | Root-church 或政策指定管理角色决定 |
| 任一关键事实未知或模块能力不可用 | 不得降低等级 | 显示 unknown/unavailable、影响和下一责任人 | 对受影响 gate fail closed，除非存在有效政策例外 |

同一活动命中多条规则时取最严格结果。治理等级改变必须形成可解释 diff，显示触发事实、政策条款、旧等级、新等级和受影响决定。

### 6.2 治理输出不是单一等级字段

治理计算至少返回：

- `tier`：`light`、`standard` 或 `enhanced`；
- `policyVersion`：作出计算的治理政策版本；
- `triggerReasons[]`：稳定 reason code、双语说明和来源事实；
- `requiredPackageSections[]`：当前必须完成的 Package 部分；
- `requiredSpecialistDecisions[]`：适用的专项决定；
- `overallDecisionAuthority`：角色、组织层级、scope、人数/quorum 和委派限制；
- `gateRequirements`：Publish、Registration、Execute 分别要求什么；
- `exceptionCapability`：是否允许例外、由谁决定、何时过期；
- `unknowns[]`：尚不能确定且必须 fail closed 的事实。

前端不得只显示一个“增强审批”徽章；必须让 Event Lead 看见为什么升级、缺什么，以及谁能解决。

## 7. Event Package 目标模型

### 7.1 Event Package 的性质

Event Package 不是新的重复录入表单，而是不可变的审批快照清单：

- 保存审批时看到的安全摘要和版本化 manifest；
- 引用 Event Plan、RAM、Safeguarding、Finance、Venue、Travel、Programme、Roster、Registration 和 Comms 等权威记录的明确版本或哈希；
- 对受限制资料只保存必要摘要和不可变引用，不复制不必要的个人资料；
- 能重现当时审批依据，同时继续执行最小披露权限；
- Package 中不适用的部分显示“不适用及依据”，不能靠数据缺失推断。

### 7.2 最小持久化能力

最终命名以机器契约评审为准，但至少需要以下概念。

#### `EventPackage`

- `id`
- `eventId`
- `scopeType`：`event` 或 `occurrence`
- `scopeId`：Event scope 为空，Occurrence scope 指向明确 Occurrence
- `coveredOccurrenceIds` 或机器契约定义的确定性覆盖规则
- `version`
- `eventPlanVersion`
- `packageSchemaVersion`
- `governancePolicyVersion`
- `governanceTier`
- `status`
- `approvalValidityStatus`
- `contentHash`
- `sourceVectorHash`
- `manifestJson`
- `supersedesPackageId`
- `generatedByMemberId`
- `generatedUtc`
- `submittedByMemberId`
- `submittedUtc`
- `concurrencyToken`

#### `EventPackageSourceReference`

- `eventPackageId`
- `moduleCode`
- `subjectType`
- `subjectId`
- `subjectVersion` 或不可变 ETag / hash
- `sourceDecisionId`（适用时）
- `validUntilUtc`（来源有期限时）
- `dataClass`
- `requiredForDecision`
- `capturedUtc`

#### `EventPackageDecision`

- `eventPackageId`
- `decisionType`
- `actorMemberId`
- 双语 `reason`：`{ en, zh }`
- `decidedUtc`
- `decisionAuthoritySnapshot`
- `effectiveUtc` / `expiresUtc`
- `revokedByDecisionId` / `invalidatedReasonCode`
- request hash / 幂等记录

#### `EventPackageCondition`

- `eventPackageId`
- 双语条件内容 `{ en, zh }`
- `appliesToGate`
- `ownerRoleRequirementKey`
- `dueUtc`
- `status`
- `expiredUtc` / `waivedByDecisionId`（只有版本化政策明确允许时）
- `evidenceReference`
- `satisfiedByMemberId` / `satisfiedUtc`
- `verifiedByMemberId` / `verifiedUtc`

### 7.3 Package 生命周期与批准有效性

Package 生命周期至少明确：

- `draft`
- `submitted`
- `returnedForAmendment`
- `rejected`
- `approvedWithConditions`
- `approved`
- `withdrawn`
- `superseded`

批准有效性独立于 Package 生命周期，至少明确：

- `notDecided`
- `active`
- `invalidated`
- `expired`
- `revoked`

状态规则：

- Draft 可以从当前权威来源重新生成。
- Submitted 后内容冻结。
- Returned 和 Rejected 的 Package 不可编辑；修正来源后生成新版本。
- Approved with Conditions 只有在适用于某个 gate 的条件被有权限人员验证后，才满足该 gate。
- Approved 不自动执行 Publish、Open Registration 或 Execute。
- 新 Package 获批后，旧版本保留并标记 Superseded。
- 来源专项决定失效、治理关键变化、条件过期或政策规定的有效期结束时，批准有效性立即改变并阻断相应 gate。
- 撤销批准必须通过新的不可变决定完成，记录权限、理由和生效时间；不得覆盖原决定。
- 决定和责任链审计元数据不可被新版本重写；个人证据内容仍遵守第 5.3 节的保留和匿名化规则。

#### Package 生命周期转换

| 当前状态 | 允许动作 | 下一状态 | 关键限制 |
| --- | --- | --- | --- |
| `draft` | 重新生成 | `draft` 或新 draft version | 只能读取当前权威来源；不能覆盖已提交版本 |
| `draft` | 提交 | `submitted` | 无提交 blocker、来源向量仍一致、调用者有 submit 权限 |
| `submitted` | 批准 | `approved` | 决定人满足当前治理政策和职责分离 |
| `submitted` | 附条件批准 | `approvedWithConditions` | 每个条件必须有 gate、责任、期限和验证规则 |
| `submitted` | 退回 | `returnedForAmendment` | 必须提供双语 reason；修改来源后生成新版本 |
| `submitted` | 拒绝 | `rejected` | 必须提供双语 reason；不得继续进入 gate |
| `draft`/`submitted` | 撤回 | `withdrawn` | 只允许提交人或政策授权角色，保留历史 |
| 已决定版本 | 被新版本取代 | `superseded` | 只改变当前授权关系，不覆盖历史决定 |

批准有效性可以在 Package 生命周期不变时从 `active` 变为 `invalidated`、`expired` 或 `revoked`。任何 gate 只能接受生命周期和批准有效性组合都满足机器契约的 Package。

`Under Review / 审核中` 可以作为 `submitted` 的用户界面标签，或在机器契约确认确实存在“已领取审核”行为时成为独立状态；不得只为显示进度而增加一个没有状态转换语义的数据库枚举。

#### 条件状态转换

条件至少区分 `open`、`evidenceSubmitted`、`verified`、`rejected`、`expired` 和 `waived`。负责人提交证据不等于验证通过；验证人拒绝证据后条件回到可补充状态。达到 `dueUtc` 仍未验证时转为 `expired`，立即重新计算受影响 gate。只有版本化政策明确允许并由独立角色决定时才可以 `waived`。

附条件批准产生的条件必须同步为结构化 Readiness requirements，并进入现有 readiness projection 和 Workflow contribution。同步关系是单向引用同一个权威 Condition：Workflow Step 完成或普通任务勾选不能反向伪造 Condition 已验证，Readiness 也不能反向生成审批决定。

### 7.4 Series、Occurrence 与 Child Event 作用域

- Event 是默认治理边界；一次性 Event 的 Package 通常覆盖其唯一 Occurrence。
- 周期性 Event 必须由第 0 阶段选择并固化一种规则：Event 级 Package 覆盖确定的 Occurrence 范围，或为需要独立证据的 Occurrence 生成 occurrence-scoped Package。
- Series 默认值本身不能自动获得审批。新物化的 Occurrence 只有符合 Package 记录的覆盖规则、政策版本和有效期限时才可继承批准。
- Occurrence-local exception 只使受影响范围的批准失效；若变化影响 Event 主干、共享资源或系列政策，则升级为 Event 级重审。
- Child Event 具有独立生命周期边界时必须拥有自己的 Package 和 gate；父 Event 批准不自动批准 Child Event。父子活动之间只保存明确依赖和可审计状态摘要。
- Package DTO、权限检查、diff、历史和 gate reason code 都必须包含 scope，不能让 Event 级与 Occurrence 级记录发生歧义。

### 7.5 Package 内容

系统根据实际活动和启用模块汇总：

1. **活动概要**：名称、目的、成果、主办单位、责任人、时间、地点、人数、可见性、报名、收费和风险事实。
2. **活动结构**：Series、Occurrence、Session、Programme、Zone、布置、彩排、收尾和模块启用理由。
3. **人员与资源**：Event Lead、关键角色、岗位空缺、场地、设备、交通、住宿和夜间责任。
4. **安全与保障**：RAM 版本、残余风险、紧急安排、天气、道路、儿童保障、同意、接领和资格证据摘要。
5. **报名、财务、隐私与沟通**：报名窗口、容量、收集资料、隐私依据、收费/预算/退款原则、通知计划及公开材料草稿。
6. **专项决定**：RAM、Safeguarding、Finance、Sponsorship、政策例外和其他适用决定的权威版本。
7. **Readiness 与变化**：未完成事项、缺少证据、条件、Blocker、与上一 Package 的重要差异及受影响审批。

尚未实现的模块不能伪装成已完成。若活动事实要求 Finance、Accommodation、Food 或其他尚未交付的能力，Package 必须显示明确的 unavailable/blocker 状态或经政策允许的受审计替代流程。

### 7.6 一致性生成协议

生成 Package 时必须：

1. 验证调用者权限、目标 scope、Event Plan ETag 和治理政策版本。
2. 读取适用模块的权威摘要、决定、有效期和版本，形成排序稳定的 source vector。
3. 使用机器契约规定的 canonical serialization 生成 `manifestJson`、`sourceVectorHash` 和 `contentHash`。
4. 在同一提交边界内重新验证 Event Plan、政策和全部来源版本；任一不一致即返回稳定 conflict reason code。
5. 只在验证成功后持久化完整 Package 和 source references；不得留下可提交的半成品。

Draft 重新生成和失败重试不得覆盖已提交版本。相同 Idempotency-Key 与相同请求哈希返回同一结果；相同 key 对应不同请求必须拒绝。

### 7.7 Package manifest 示例

以下仅说明信息组织和版本关系，字段名最终由 `event-contract.json` 固定：

```json
{
  "schemaVersion": "event-package/1.0",
  "eventId": "...",
  "scope": {
    "type": "event",
    "id": null,
    "coveredOccurrenceIds": ["..."]
  },
  "eventPlan": {
    "version": 4,
    "hash": "..."
  },
  "governance": {
    "tier": "enhanced",
    "policyVersion": "...",
    "triggerReasonCodes": [
      "event.governance.outdoor",
      "event.governance.publicRegistration"
    ]
  },
  "sections": [
    {
      "code": "safety",
      "status": "complete",
      "summary": {
        "en": "RAM approved; one residual risk requires monitoring.",
        "zh": "RAM 已批准；一项残余风险需要持续监测。"
      },
      "sourceReferenceIds": ["..."]
    }
  ],
  "specialistDecisions": [
    {
      "type": "ram",
      "decisionId": "...",
      "version": 3,
      "status": "approved",
      "validUntilUtc": "..."
    }
  ],
  "readiness": {
    "status": "blocked",
    "blockerCodes": ["event.role.firstAider.missing"]
  },
  "previousPackage": {
    "id": "...",
    "version": 1,
    "materialChangeCodes": ["event.venue.changed"]
  },
  "sourceVectorHash": "...",
  "contentHash": "..."
}
```

Manifest 只保存审批所需摘要和引用。完整儿童名单、健康资料、联系人、乘客名单和财务明细仍留在各自权威模块中，并通过独立权限读取；它们不得因为 Package 生成而被复制进 JSON。

## 8. 整体审批责任

- 创建者确认 Plan Proposal：建立 Event 和保存 Event Plan Snapshot。
- Event Lead：生成、检查、提交或撤回当前 Package。
- RAM / Safeguarding / Finance 等专项负责人：只决定自己的权威领域。
- 整体审批人：依据治理等级对完整 Package 作出正式决定。
- 条件负责人：提供条件要求的证据。
- 条件验证人：确认条件是否满足；涉及 separation of duties 时不能与条件负责人相同。
- 发布人：在所有发布 gate 满足后显式发布。
- Registration Manager：在所有报名 gate 满足后显式开放报名。
- Event Lead：在执行 gate 满足后完成活动前确认。

所有责任和权限必须在服务端验证，不能只靠前端是否显示按钮。

第 0 阶段还必须明确整体审批权威的来源和变化规则：

- 委派的 scope、开始/结束时间、撤回人和可委派权限；
- 哪些等级要求单人决定、双人复核或 quorum；
- 审批人与 Event Lead、财务受益人或专项作者之间的回避及职责分离规则；
- 决定时保存角色、所属组织、委派和政策版本快照；
- 审批人随后离任或权限被撤销时，既有决定继续有效还是触发重审；
- 管理员只能按机器契约定义的紧急权限操作，并提供理由和独立审计，不能拥有不可见的万能绕过路径。
- API 从当前认证上下文解析提交人、审批人和实际角色；客户端不得传入、替换或伪造 `actorMemberId`、审批角色或 authority snapshot。

### 8.1 从准备到执行的完整正常流程

1. **确定治理要求**：Event Plan 被接受或重新组合后，系统依据已确认事实和政策版本计算 tier、必需部分、专项决定和审批权威。
2. **准备模块资料**：Event Lead 在现有 Event workspace 中完成适用模块；模块继续拥有自己的数据和审批。
3. **检查可提交性**：Governance surface 汇总 missing、unknown、unavailable、expired 和 blocker，并把每一项指向负责人及页面。
4. **生成 Package**：Event Lead 使用当前 Plan ETag 生成一致性快照。来源变化时返回 conflict，并要求刷新后重新检查。
5. **内部预览**：Event Lead 查看七部分摘要、scope、来源版本、敏感资料提示和相对于上一版的 diff。
6. **提交**：系统再次验证来源向量、提交权限和 mandatory sections，将 Package 冻结为 `submitted`，并复用现有 Workflow/通知基础创建审批任务和可展示的 approval artifact。Task/Artifact 只链接到权威 Package 决定，不拥有审批事实。
7. **专项完成**：未完成的 RAM、Safeguarding、Finance 或 Sponsorship 继续由专项负责人处理；Package 显示其状态，不复制决定权。
8. **整体决定**：符合 tier 权威规则的审批人查看同一版本并选择批准、附条件批准、退回或拒绝。
9. **落实条件**：条件负责人提交证据，独立验证人验证；到期、拒绝或来源变化会重新计算 gate。
10. **显式进入阶段**：发布人、Registration Manager 和 Event Lead 分别在满足 gate 时执行 Publish、Open Registration 和 Execute confirmation。
11. **处理变化**：任何 Plan 或模块写入都触发影响评估；重大变化使受影响批准失效，并按规则暂停公开、报名或执行。
12. **保留责任链**：新 Package 重审后成为当前有效版本；旧 Package、决定和差异保留审计关系，敏感证据继续遵守保留策略。

### 8.2 退回、拒绝和冲突时的用户结果

- **退回修改**：Event Lead 看到具体原因、受影响 Package 部分、需要修改的来源页面和重新提交步骤；不能直接编辑已提交 Package。
- **拒绝**：Event Lead 看到决定原因和可否重新提出；系统不自动生成新 Package，也不隐藏历史决定。
- **来源冲突**：系统说明哪一类来源已变化并提供刷新动作，不把技术 ETag 文本当作唯一用户提示。
- **权限变化**：页面保留只读状态并说明当前谁可以继续；无权限者不会因为之前打开页面而完成决定。
- **条件证据不合格**：验证人返回双语说明，已有证据保留版本，负责人可以提交新证据。
- **系统暂时失败**：已经提交或批准的数据不被回滚到草稿；重复请求依靠幂等结果恢复。

### 8.3 明确禁止的捷径

- 直接更新数据库状态绕过命令处理器和 gate evaluator。
- 仅在 React 中隐藏按钮而不执行服务端授权。
- 把 `Readiness == Ready` 当作 `Approved`。
- 把 RAM、Sponsorship 或任一 Workflow Step 的批准当作整体批准。
- 生成 Package 后继续读取“最新模块资料”并把它展示为审批时资料。
- 允许审批人编辑组织者的 Package 内容后再批准。
- 重大变化后仅显示警告但继续接受公开访问或报名。
- 为了兼容旧活动把 unknown、unavailable 或缺少历史证据自动转换成通过。

## 9. 发布、报名和执行门槛

服务器应使用同一个 lifecycle gate evaluator，分别返回稳定 reason code 和双语说明。

### 9.1 `CanPublish`

至少要求：

- 当前有效 Package 已批准；
- 发布前条件已验证；
- 所有适用专项审批有效；
- 需要 Sponsorship 时已批准；
- 当前 Event Plan 与 Package 绑定版本一致；
- 没有 Publication Blocker；
- 公开内容和资产已经过适用的人工确认；
- 操作者拥有权限并显式执行 Publish。

### 9.2 `CanOpenRegistration`

至少要求：

- 当前 Package 满足报名门槛；
- Registration 模块启用且配置完整；
- 容量、截止时间、隐私说明和必要同意有效；
- RAM、Safeguarding、Sponsorship 和报名前条件按政策满足；
- 发布与报名的先后关系符合版本化政策；若允许“未公开但定向报名”，其受众、链接和权限必须独立受控；
- 操作者显式执行 Open Registration。

如果活动涉及收费，任何现有或未来的付款、押金、付款意向或收费确认入口必须同时满足 Registration gate、适用 Finance 决定和版本化收费政策。当前没有支付提供商时应明确返回 unavailable/blocker，不能为了演示把付款标记为已完成；本目标不授权接入新的支付服务。

### 9.3 `CanExecute`

至少要求：

- 当前 Package 和适用专项审批仍然有效；
- 执行前条件、关键人员和必要证据齐备；
- 没有安全关键 Blocker；
- Event Lead 在政策规定的时间窗口内完成有时间戳且绑定 scope/Package 版本的活动前确认。

任何旧 API、公开查询、报名提交或前端路径都必须调用相同的服务器规则，不能存在绕过入口。

### 9.4 审批前草稿与公开入口

- 审批前可以制作双语介绍、海报和报名表草稿，但只能通过受保护的内部预览访问。
- 未满足 Publish gate 时，活动不得出现在公共列表、搜索、SEO metadata、站点地图或公开缓存中，也不得产生匿名可用的公开 URL 或 QR Code。
- 未满足 Registration gate 时，即使旧链接、书签或二维码仍被访问，服务端也必须返回稳定的关闭状态且不得接受报名。

### 9.5 已发布或已开放报名后的失效处理

当 Package、专项批准、条件或治理政策失效时，服务器必须在同一规则集中计算后续动作：

- `blockNewPublication`：禁止新的公开投影和重新发布；
- `withdrawPublicProjection`：按政策立即撤下公开投影，或仅保留经批准的取消/变更通知页；
- `pauseRegistration`：停止新报名，同时保留已有报名记录和管理者访问；
- `blockExecution`：禁止活动前执行确认；
- `requireHumanNotificationReview`：创建受控的通知草稿和责任任务，未经人工确认不得发送。

日期、地点、容量、儿童、交通、住宿、收费、安全或主办身份发生治理关键变化时默认 fail closed。取消、延期、关闭报名、撤下公开投影和重新开放都必须有独立权限、幂等、审计、缓存失效和稳定 reason code。不得为了重新审批删除已有报名、历史公开版本或决定记录。

### 9.6 Gate evaluator 的具体输出

三个 gate 使用同一结果结构，而不是分别返回互不兼容的布尔值：

```json
{
  "gate": "openRegistration",
  "scope": { "type": "event", "id": "..." },
  "allowed": false,
  "evaluatedUtc": "...",
  "eventPlanVersion": 4,
  "eventPackageVersion": 2,
  "governancePolicyVersion": "...",
  "blockers": [
    {
      "code": "event.package.condition.expired",
      "message": {
        "en": "A registration condition has expired.",
        "zh": "一项报名条件已经过期。"
      },
      "ownerRoleRequirementKey": "...",
      "action": "reviewCondition"
    }
  ],
  "warnings": []
}
```

准确 DTO 名称由机器契约决定，但必须具备：稳定 code、双语说明、受影响 scope、绑定版本、责任角色和可执行下一步。前端不得根据自由文本判断是否允许操作。

### 9.7 最低 reason code 集合

第 0 阶段至少冻结以下语义类别；具体 code 只能追加或按契约版本演进，不能静默改变含义：

- `event.package.missing`
- `event.package.notSubmitted`
- `event.package.notApproved`
- `event.package.invalidated`
- `event.package.expired`
- `event.package.revoked`
- `event.package.scopeMismatch`
- `event.package.sourceChanged`
- `event.package.condition.open`
- `event.package.condition.expired`
- `event.specialistApproval.missing`
- `event.specialistApproval.expired`
- `event.sponsorship.required`
- `event.registration.configurationIncomplete`
- `event.publicCopy.notApproved`
- `event.readiness.blocked`
- `event.execution.confirmationMissing`
- `event.legacy.transitionRequired`
- `event.authorization.denied`

## 10. 重大变化与重新审批

### 10.1 变化分类

- `cosmetic`：颜色、字体、不改变含义的文字修正；保留历史，通常不重审。
- `operational`：节目次序、非安全关键人员或资源调整；按受影响模块重新确认。
- `governanceCritical`：日期、地点、人数、儿童、交通、住宿、收费、可见性、主办身份、关键责任人、风险或紧急安排变化；使相应批准失效并触发重审。

### 10.2 影响评估输出

每次重要变化生成：

- 字段级新旧值差异；
- 受影响模块；
- 受影响专项决定；
- 当前 Package 是否失效；
- 发布、报名或执行是否需要关闭/暂停；
- 需要创建的 Workflow Step、任务和责任角色；
- 是否需要生成经人工确认的参加者变更通知。

变化规则来自版本化系统政策，不能由 AI 临时决定。若无法判断变化等级，应 fail closed 并要求人工审核。

## 11. 最小权限包

第 0 阶段应确认并写入机器契约：

- `event.package.view`
- `event.package.generate`
- `event.package.submit`
- `event.package.withdraw`
- `event.package.decide`
- `event.package.condition.satisfy`
- `event.package.condition.verify`
- `event.package.decision.revoke`
- `event.publish`
- `event.unpublish`
- `event.registration.open`
- `event.registration.close`
- `event.execution.confirm`

每个服务端操作同时检查 Event 所有权、所属小组、已接受角色、治理等级、平台权限和职责分离。普通 Event Team 成员不能因为加入团队而获得审批、儿童、财务或完整 Package 查看权限。

## 12. API 目标

最终路径以 `event-contract.json` 为准，建议能力边界如下：

- `GET /api/events/{eventId}/packages/current`
- `GET /api/events/{eventId}/packages/{packageId}`
- `GET /api/events/{eventId}/packages/history`
- `POST /api/events/{eventId}/packages/generate`
- `POST /api/events/{eventId}/packages/{packageId}/submit`
- `POST /api/events/{eventId}/packages/{packageId}/decisions`
- `POST /api/events/{eventId}/packages/{packageId}/decisions/{decisionId}/revoke`
- `POST /api/events/{eventId}/packages/{packageId}/withdraw`
- `POST /api/events/{eventId}/packages/{packageId}/conditions/{conditionId}/satisfy`
- `POST /api/events/{eventId}/packages/{packageId}/conditions/{conditionId}/verify`
- `GET /api/events/{eventId}/packages/{packageId}/diff/{otherPackageId}`
- `GET /api/events/{eventId}/lifecycle-gates`

Package 生成请求必须携带 Event Plan `If-Match`，响应返回 Package ETag 和来源版本向量摘要。现有发布、撤下、报名打开/关闭和执行入口必须调用同一 gate evaluator。Protected GET 使用 `private, no-store`；写操作按风险使用 `If-Match`、Idempotency-Key、审计和缓存失效。

## 13. 前端目标

Event 工作区增加受控 Governance surface，至少包含：

- 当前治理等级及触发原因；
- 当前 Package scope、覆盖的 Occurrence、版本、生命周期、批准有效性和审批人；
- 七部分摘要及每部分资料来源/版本；
- 专项审批状态；
- Readiness、Blocker 和附加条件；
- 与上一版本的重大差异；
- Event Lead 的生成、预览、提交和撤回操作；
- 审批人的批准、附条件批准、退回修改和拒绝操作；
- 条件负责人和验证人的受控操作；
- Publish、Open Registration 和 Execute gate 的可解释状态；
- Package 与决定历史。
- 来源在生成期间或提交前变化时的明确 conflict 恢复流程；
- 旧 Event 的 `legacy`、过渡期或必须补审状态；
- 决定、条件过期或重大变化后，公开、报名和执行受到的具体影响及下一责任人。

所有界面提供中英文、移动端可用性和键盘/焦点支持，并覆盖 loading、empty、blocked、error、conflict、success 和 retry。语言切换不得改变 Event 身份或触发不必要 refetch。

### 13.1 信息架构和入口

这是 authenticated workspace 能力，不进入公开教会首页。应复用现有 `EventWorkspaceView`、Surface Registry、`AppPageShell`、`AppSectionCard`、`AppActionButton`、`AppBadge`、`AppEmptyState` 和应用内确认 modal。

- Event workspace overview 增加一张 **Governance / 审批治理** 摘要卡：当前 tier、Package 版本、批准有效性、三个 gate 和最紧急下一步。
- Governance 作为一个顶层 workspace tab；不能在该 tab 内再嵌套第二层 TabView。
- Package 预览、审批决定和历史 diff 属于空间较大的受管对象，使用独立页面，并在顶部提供返回准确来源页面的 `← Back / ← 返回`。
- 审批人的个人待办复用现有“我的任务”方向，链接到同一个 Package 决定页面，不创建另一套审批数据。
- 历史列表提供分页、状态筛选、scope 筛选和排序；打开详情再返回时保留列表状态。

建议受控 surface key 和路径只作为 Contract 候选：

- `workspace.governance`：Event workspace 中的摘要和当前操作；
- `governance.package`：一个 Package 的只读预览/提交页；
- `governance.decision`：审批人决定页；
- `governance.history`：版本、决定和差异历史页。

最终 key 必须进入编译时 Surface Registry；不能由服务器返回任意组件路径。

### 13.2 Governance 摘要页

页面的单一任务是回答“这个活动现在能进入哪个阶段，下一步由谁做什么”。从上到下包含：

1. **状态头部**：Event 标题、scope、tier、当前 Package `vN`、批准有效性和最后评估时间。
2. **三段 gate 条**：Publish、Registration、Execute 分别显示 Ready/Blocked/Completed，不用一个模糊的总分代替。
3. **下一责任行动**：只突出一个最高优先级动作，例如“补充 RAM”“等待 Root Church 审批”“验证报名条件”。
4. **Package 完整度**：七部分各自显示 Complete、Missing、Unknown、Unavailable、Changed；点击进入对应模块或 Package 部分。
5. **专项决定**：RAM、Safeguarding、Finance、Sponsorship 的决定、版本、有效期和责任人。
6. **版本变化**：列出影响批准的重大变化以及“不触发完整重审”的展示性变化。
7. **历史入口**：显示最近决定，完整历史进入独立页面。

不得把七部分做成七张同等抢眼的大卡片。首屏优先呈现 gate、下一动作和阻塞原因；详细资料按层级展开。

### 13.3 Event Lead 的 Package 准备页

- 顶部说明当前将提交的 Event Plan 版本、Package scope 和治理政策版本。
- 每个部分显示数据来自哪个模块、最后更新时间、是否含受限资料以及谁能查看。
- 缺口直接链接到现有模块工作区，不在 Package 页面复制编辑表单。
- “生成预览”只创建/刷新 draft；“提交审批”是独立的高重要性动作。
- 提交前确认 modal 列出冻结版本、提交后的不可编辑后果和仍存在的非阻塞 warning。
- source conflict 时保留用户所在位置，显示变化来源并提供“刷新并重新生成”；不能静默替换正在看的内容。
- 没有权限、Package 已失效或已被新版本取代时进入清楚的只读状态。

### 13.4 审批人的决定页

- 首屏显示“你正在决定什么”：Event、scope、Package/Plan 版本、tier、提交人和提交时间。
- Blocker 与 warning 分开；未完成的 mandatory specialist decision 不能被折叠隐藏。
- 七部分使用可扫描的 section navigation，不使用嵌套 tabs；敏感部分按查看权限显示摘要、隐藏原因或完全不返回。
- 与上一版本的 diff 将 governance-critical 变化置顶，同时保留模块来源链接。
- 决定操作固定为 Approve、Approve with conditions、Return for amendment、Reject；只显示当前用户有权执行的操作。
- 附条件批准必须填写适用 gate、双语内容、责任角色、期限、证据要求和验证规则。
- Return/Reject 必须填写双语 reason；Approve 可以要求确认声明而不是空理由。
- 决定前使用应用内 accessible modal 展示后果；禁止 `window.confirm`、`window.alert` 或浏览器 prompt。

### 13.5 条件、历史和差异页面

- 条件列表以 gate 和状态分组，每项显示负责人、期限、证据版本和验证人；过期项不能仅改变颜色，必须显示后果与动作。
- 条件证据采用最小必要上传/引用，不复制儿童、健康或完整财务资料到自由文本。
- 历史页一行代表一个 Package 版本，摘要显示 scope、状态、批准有效性、提交/决定时间和取代关系。
- 版本详情清楚区分“审批时冻结内容”和“当前来源状态”，避免审批人误以为历史页面是最新事实。
- diff 按 `governanceCritical`、`operational`、`cosmetic` 分组，并标出受影响决定和 gate。

### 13.6 双语、响应式与可访问性细节

- 工作区沿用深绿结构、暖色表面和克制的 coral 警示；coral 只强调需要注意的失效/冲突，不作为第二个主操作色。
- 从 320px 开始设计；桌面断点沿用 1024px。移动端 gate 纵向排列，操作按钮保持至少现有 `min-h-11/min-h-12` 触控高度。
- 状态不能只依赖颜色；Badge 同时提供文本和适当的 accessible label。
- 中英文都验证换行。英文 reason code 不直接暴露给普通用户，但可作为可复制的支持信息显示。
- 初始焦点、modal focus trap、Escape、关闭后焦点返回和键盘操作必须与现有组件一致。
- loading 使用稳定骨架或状态区域；empty 说明为什么没有 Package；permission denied 不透露 Package 是否包含儿童或财务资料。
- language switch 只重新本地化已有 DTO，不改变 route identity，不重新生成 Package，也不触发无必要 API refetch。

### 13.7 关键页面文案示例

| 场景 | 中文 | English |
| --- | --- | --- |
| 尚未生成 | 尚未生成活动方案审批包。先完成当前缺口，再生成供审核的版本。 | No event package yet. Complete the current gaps, then generate a version for review. |
| 可以提交 | 当前资料已可提交。提交后这一版将被冻结。 | This package is ready to submit. This version will be frozen after submission. |
| 来源冲突 | 有资料在生成期间发生变化。请刷新并重新检查后再提交。 | Some source data changed while the package was generated. Refresh and review it again before submitting. |
| 等待审批 | 已于 {time} 提交给 {authority}，当前不能修改这一版。 | Submitted to {authority} at {time}. This version can no longer be edited. |
| 条件过期 | 一项适用于报名的条件已经过期，报名现已暂停。 | A registration condition has expired. Registration is now paused. |
| 重大变化 | 场地变化使当前批准失效。请检查影响并生成新版本。 | The venue change invalidated the current approval. Review the impact and generate a new version. |
| 旧活动过渡 | 此活动使用过渡规则。请在 {date} 前完成正式方案审批。 | This event is using a transition rule. Complete formal package approval by {date}. |

以上是产品语义示例；正式文案进入现有本地化模式并接受中英文评审，不能散落为组件内不可复用的临时字符串。

### 13.8 工程落点

最终文件名可以随现有目录习惯调整，但责任必须落在以下现有层中：

| 层 | 具体交付 | 建议落点 |
| --- | --- | --- |
| Domain | Package、SourceReference、Decision、Condition 实体；生命周期、批准有效性和条件枚举 | `backend/src/Alife.Domain/Entities`、`Enums` |
| Application | assembler、canonicalizer、governance evaluator、authorization policy、lifecycle gate evaluator、impact evaluator | `backend/src/Alife.Application/Events/Services` |
| Commands | generate、submit、withdraw、decide、revoke、satisfy/verify condition、publish/unpublish、registration open/close、execute confirm | `backend/src/Alife.Application/Events/Commands` |
| Queries/DTOs | current/history/detail/diff、viewer-filtered Package、gate result、approval inbox projection | `backend/src/Alife.Application/Events/Queries`、`Dtos` |
| Infrastructure | EF mapping、migration、indexes、unique constraints、audit、cache invalidation、rollout configuration | `backend/src/Alife.Infrastructure/Persistence` 及现有 cache 服务 |
| API | 受保护 Package/decision/gate endpoints，并让现有 Event/Enrollment 路径调用统一 gate | `backend/src/Alife.Api/Controllers` |
| Frontend data | readable enums、DTO types、service calls、query invalidation，不新增状态框架 | `cloudflare/alife-app/src/types`、`services` |
| Frontend UI | Governance surface、Package/decision/history 页面、modal、状态和本地化文案 | `cloudflare/alife-app/src/components/events`、`views`、现有 i18n 模式 |
| Speed layer | 公开 Event 投影的安全失效；protected Package 永不进入共享缓存 | `cloudflare/speed-layer` 现有路由和缓存边界 |
| Tests | domain、handler、controller、角色矩阵、缓存、前端交互和端到端场景 | `backend/tests/Alife.Tests.Unit/Events`、前端相邻测试、speed-layer tests |
| Documentation | Markdown 契约、机器契约、模块规范、实施状态和生成文档一致 | `docs/events` |

不得先创建一个包含所有业务逻辑的 `EventPackagesController`。Controller 只负责 HTTP 边界；授权、状态转换、版本验证和 gate 必须在 Application/Domain 层可独立测试。

### 13.9 数据库最低约束

迁移设计至少验证以下约束，准确索引名由实现决定：

- 同一个 Event/scope 的 Package version 唯一。
- `contentHash`、`sourceVectorHash`、schema version 和 policy version 非空。
- SourceReference 只能属于一个 Package，删除 Event 时不允许静默级联清除审计历史。
- Decision 和 Condition 使用稳定 GUID；决定不可 update/delete，只能追加纠正或撤销决定。
- 一个 Package 同一时刻只有一个机器契约认可的当前有效整体决定。
- 条件状态转换使用并发 token，重复满足/验证不会产生相互覆盖。
- `supersedesPackageId` 必须指向同一 Event 和兼容 scope，且不能形成循环。
- 常用 current/history/approval-inbox 查询具有明确索引；索引不得包含不必要的敏感自由文本。

迁移必须提供可审查的 `Down`/回退策略或明确说明无法完全回退的数据原因。创建 migration 前先检查当前 worktree、已有 migration 时间线、Model Snapshot 和并行分支可能使用的名称/时间戳；发现冲突时重新生成或协调迁移，不能手工拼接两个不一致的 snapshot。未经明确批准不得把迁移应用到共享或生产数据库。

### 13.10 可观测性与运行支持

不新增付费监控服务，复用现有日志和运行设施。至少记录不含敏感内容的结构化事件：

- Package generate succeeded/conflicted/failed；
- submitted/withdrawn/decided/revoked/invalidated/expired；
- condition evidence submitted/verified/rejected/expired；
- gate allowed/denied，包含 gate、scope 和 reason codes，但不包含人员姓名、健康、儿童或财务内容；
- rollout cohort、legacy transition outcome 和回滚动作；
- cache invalidation succeeded/failed。

每个写请求具有可关联的 request/correlation id、actor id、Event/scope id、Package version 和结果。运行手册说明如何调查“为什么不能报名”“为什么批准失效”和“为什么旧活动被过渡规则处理”，无需直接查询敏感 JSON。

## 14. 分阶段执行顺序

### 14.0 发布里程碑

> 执行状态（2026-09-03）：**M0–M4 审批主干已进入当前源码，源码级最终验证和开发库迁移回滚演练已完成**。代码现已包含可信 Package 快照、按 Event/Occurrence 范围冻结的来源向量、七段式双语方案摘要与触发原因、submit/withdraw/decide/revoke、结构化条件及其受限 Readiness 任务、独立核验、条件证据到期不可访问与哈希审计、政策控制的豁免、分级审批权/职责分离/quorum、带期限和范围的可撤销委派、决定与条件通知、不可变治理政策管理及 dry-run 报告、显式 Publish/Unpublish、Registration open/close、Payment unavailable、按 Event 或单场次独立持久化的执行确认、结构化双语 gate、版本历史筛选/排序/分页和 diff，以及 Event 核心、Plan 和已交付业务模块的失效钩子。周期活动的单场次场地变化会创建持久化局部复审、任务和审计，只撤销该场次旧 Package 及执行能力；批准替代的 occurrence Package 后解除，其他场次不受污染。纯展示字段不会改变治理来源哈希；审批不会自动发布；旧记录默认保持 `legacyImplicit` 兼容。七个新增迁移已在专用 Azure 开发库完成 forward、整体 rollback 和再次 forward；当前剩余重点是完整旁路/权限测试和登录态浏览器矩阵。Plan B 继续排除。

- **M0 — Contract ready**：阶段 0 完成，只形成权威可执行契约，不对用户启用新行为。
- **M1 — Foundation hidden**：阶段 1 完成，Package 可以在测试/受控 feature flag 下生成和读取，但不得把占位页面称为已交付审批功能。
- **M2 — First usable vertical slice**：阶段 2 和阶段 3 的最小组合完成。一个 `standard` Event 能生成、提交、批准/退回，并由真实 Package Approval 控制 Publish；包含服务端授权、审计、前端路径和正反测试。
- **M3 — Full target behavior**：条件批准、撤销/过期、Registration/Execute gates、重大变化、Occurrence scope 和 legacy rollout 全部完成。
- **M4 — General availability candidate**：阶段 5 的安全、缓存、并发、双语、浏览器和回滚证据齐备，才可建议扩大 rollout。

任何未达到 M2 的实现都只能称为 foundation，不能因为新增 enum、表、controller 空壳或占位 UI 就宣称 Event Package Approval 已可使用。

### 阶段 0：合同与产品决定冻结

交付：

- 更新 `EVENT-CONTRACT.md`，加入 Package、scope/继承、治理等级、整体审批、批准有效性、生命周期 gate、重大变化和兼容 rollout 的规范语义。
- 更新 `event-contract.json`，加入枚举、聚合、权限、API、缓存、状态机和验收场景。
- 更新受影响模块规范，明确各模块向 Package 贡献的摘要、来源版本、Readiness 和专项决定。
- 更新 `IMPLEMENTATION-STATUS.md`，将新能力标为 Target only 并列出实施切片。
- 若修改 `docs/events/README.md`，运行生成器并验证简体、繁体和英文内容实质一致。

退出条件：治理等级、决定人/委派/回避规则、Package 与批准状态机、Series/Occurrence/Child Event scope、条件过期规则、三个 gate、失效后动作、重大变化矩阵、一致性生成协议、数据分类/保留策略和旧 Event rollout 获得确认。

### 阶段 1：Package 只读生成

交付：Package 持久化、scope、schema/policy version、source vector、一致性生成、内容哈希、版本历史、权限过滤 DTO、旧 Event 分类、生成 API 和只读 UI。

退出条件：一次性、周期性和 Child Event 测试资料能生成可重现、不可变、最小披露的 Package；并发来源变化不会产生混合快照；本阶段不含审批写入。

### 阶段 2：整体审批闭环

交付：提交、批准、附条件批准、退回、拒绝、撤回、批准撤销/失效/过期、条件满足/验证/过期、委派、回避、职责分离、决定通知、审计和审批 UI。

退出条件：每个决定绑定准确 Package/Plan 版本；未经授权的正反角色测试全部通过。

### 阶段 3：生命周期 Gate

交付：统一 gate evaluator、稳定 reason codes、审批前公开链接/QR 防泄漏、现有发布/撤下/报名打开与关闭/执行入口接入、失效后 fail-closed 动作、缓存失效和显式动作 UI。

退出条件：任何前端、旧 API、公开 URL、QR、搜索或缓存路径都不能绕过门槛；批准不会自动发布；批准失效后公开、报名和执行状态按已确认政策安全收敛。

### 阶段 4：重大变化和重新审批

交付：字段级 diff、变化分类、影响矩阵、Package supersede、专项决定失效和重审任务。

退出条件：治理关键变化不能继续使用旧批准发布、报名或执行，已开放入口按政策暂停或撤下；纯展示变化不会触发完整重审。

### 阶段 5：首个完整业务场景与加固

建议场景：**涉及公开报名、交通和 RAM 的户外活动**。

完整演示：创建 Event → 准备模块资料 → 一致性生成 Package → 提交 → 附条件批准 → 满足并验证条件 → 显式开放报名和发布 → 修改场地/人数 → 旧批准失效且报名/公开状态安全收敛 → 新 Package 重审。

同时增加一个周期性活动验证：Event 级 Package 的覆盖范围、Occurrence exception 和局部重审不会互相污染。

退出条件：权限、隐私、缓存、并发、双语、移动端、迁移 rollout 和审计测试全部形成证据。

## 15. 验收标准

### Event Package

- [ ] Event Lead 可以从当前权威资料生成 Package，无需重复录入模块数据。
- [ ] Package 保存 Plan 版本、治理等级、内容哈希和必要来源版本。
- [ ] Package 保存 schema、治理政策、scope 和完整来源版本向量；哈希可跨进程稳定重现。
- [ ] 生成期间任一来源变化都会返回 conflict，不会产生可提交的混合快照。
- [ ] 已提交 Package 不可原地修改；更正产生新版本。
- [ ] 审批人只能看到权限允许的最小资料投影。
- [ ] 支持 Approved、Approved with Conditions、Returned for Amendment 和 Rejected。
- [ ] 条件具有适用 gate、负责人、期限、证据、满足人和验证人记录。
- [ ] 条件或来源决定过期、撤销或失效时，批准有效性和受影响 gate 自动 fail closed。
- [ ] 整体审批不能替代 RAM、Safeguarding、Finance 或 Sponsorship。
- [ ] Event、Occurrence 和 Child Event 的 Package scope、继承、例外和局部重审符合机器契约。
- [ ] 历史 Package 和决定的责任链始终可审计且不会被新版本重写；个人证据按保留政策到期、匿名化或变为不可访问。

### 生命周期 Gate

- [ ] 未满足适用整体审批的活动不能进入公共列表或生成可用公开投影。
- [ ] 未满足报名 gate 的活动不能通过任何 API 创建报名。
- [ ] 涉及收费时，未满足 Registration/Finance 要求不能创建付款、押金或收费确认；未实现支付能力明确显示 unavailable。
- [ ] 审批前草稿不会产生匿名可用 URL/QR，不进入搜索、SEO、站点地图或共享边缘缓存。
- [ ] 未满足执行 gate 时系统返回明确 Blocker。
- [ ] Package 获批后不会自动发布或开放报名。
- [ ] 批准失效、条件过期、取消或延期后，公开投影、报名和执行按政策暂停、撤下或阻断，已有报名和历史记录不会被删除。
- [ ] Publish 与 Open Registration 的先后关系以及受控定向报名规则已在机器契约中固定。
- [ ] 所有门槛返回稳定 reason code 和 `{ en, zh }` 说明。
- [ ] 缓存失效覆盖批准、退回、撤回、条件、重大变化、发布和报名状态变化。

### 重大变化

- [ ] 日期、场地、容量、儿童、交通、住宿、收费、责任人或风险变化产生字段级 diff。
- [ ] 系统能识别受影响的专项审核和整体审批。
- [ ] 重大变化使旧 Package 失去当前授权能力，但保留历史。
- [ ] 展示性小改动保留版本记录且不会无理由触发完整重审。
- [ ] 无法分类的变化 fail closed。

### 安全、隐私与并发

- [ ] 所有 protected Package、条件和决定响应均为 `private, no-store`。
- [ ] 不同查看者不会共享受保护 ETag 或响应。
- [ ] 普通成员、Event Team、Event Lead、专项审批人、管理层和平台管理员的正反权限矩阵均有测试。
- [ ] 委派、委派过期、回避、职责分离、quorum、离任和管理员紧急操作均有正反测试及审计。
- [ ] 敏感儿童、财务、健康、联系和乘客资料不进入日志、共享缓存、分析或 AI 提示。
- [ ] 可重试命令幂等；版本化写入使用 `If-Match`。
- [ ] 并发提交、重复决定和旧页面操作不会覆盖新状态。
- [ ] rollout 不会意外阻断既有活动；legacy、过渡期、强制补审和回滚路径均有测试。

### 双语与可用性

- [ ] 用户可见标题、条件、Blocker 和决定原因保持 `{ en, zh }`。
- [ ] 中英文切换不改变实体身份、不丢失状态、不造成不必要 refetch。
- [ ] 手机、平板和桌面均可完成核心流程。
- [ ] 所有交互具备 loading、empty、disabled、error、conflict、success 和 retry 状态。

## 16. 必须执行的测试矩阵

- Domain/state-machine 单元测试。
- API 正向与负向授权测试。
- owning group、root church、普通成员、Event Team、Event Lead、专项审批人和平台管理员角色矩阵。
- ETag、过期页面、并发提交和 Idempotency-Key 重试。
- Package 快照重现、版本不可变性和来源引用完整性。
- Package 多来源并发变化、canonical hash、schema/policy version 和原子提交。
- Series、Occurrence、Occurrence exception、Child Event 和父子依赖作用域。
- 批准/条件有效期、撤销、来源失效、角色撤销和重新审批。
- RAM/Safeguarding/Finance/Sponsorship 与整体审批互不替代。
- public、church/group、event team、role restricted、approval evidence 和 self 投影隔离。
- Cache-Control、Vary、共享缓存禁用及公开投影失效。
- 公共 URL、QR、SEO、站点地图、旧链接和边缘缓存绕过测试。
- 重大变化和非重大变化分类。
- 已发布/已开放报名后的重大变化、取消、延期、撤下、关闭和重新开放。
- legacy Event backfill/过渡策略、feature flag、灰度启用和回滚读取。
- migration `Up`/`Down`、Model Snapshot、脏数据库及并行分支 migration 冲突检查。
- 审计保留与个人证据到期、匿名化、不可访问和删除边界。
- 双语 DTO、语言切换、移动端和可访问性。
- 迁移 SQL 生成和 snapshot review；只在获准的 disposable/local 数据库应用迁移。

## 17. 非目标

本目标明确不包含：

- **Plan B、Contingency Plan、Decision Case、决策窗口、提醒、备用决策人、Timeout Action 或跨模块应变启用。**
- 新建第二套通用工作流引擎。
- 用 Event Package Approval 替换 RAM、Safeguarding、Finance 或 Sponsorship。
- 早期 `Planning Endorsement`；如需要，后续另立目标。
- 自动发布、自动开放报名或 AI 自动审批。
- 接入付费服务、支付提供商、酒店、天气、短信或外部通知平台。
- PDF／打印导出不是首个可用垂直切片的验收项；后续可以从已提交的结构化 Package 生成只读导出，但导出物永远不是权威记录，也不得绕过查看权限或保留策略。
- 一次性完成所有 Finance、Food、Festival、Accommodation 或健康记录能力。
- 事故登记、事故处理、活动结项和活动后复盘的完整实现；本轮只保留与 Package/gate 的集成边界，后续由 SAFETY.RAM、TEAM.WORK 和 COMMS.FOLLOWUP 分别交付。
- 把所有简单活动强制升级为 enhanced governance。
- 未经明确批准应用共享或生产数据库迁移。

## 18. 完成定义

整个目标完成需要：

1. 权威 Markdown、机器契约、模块规范和实现状态一致。
2. 数据库迁移、旧 Event rollout/回滚、领域模型、服务端授权 API、前端可达流程和审计全部存在。
3. Package 生成、整体审批、生命周期 gate 和重大变化重审各有端到端证据。
4. 安全、权限、缓存、隐私、并发、作用域、保留、兼容迁移和双语验收标准有自动化测试。
5. 文档生成检查通过，简体中文、繁体中文和英文 overview 实质一致。
6. 未验证的浏览器、数据库或部署行为被明确披露。
7. 不存在绕过整体审批、专项审批或生命周期 gate 的旧入口。

## 19. 建议拆分的执行 Issues

| 顺序 | Issue 与目标 | 前置依赖 | 必须交付 | 验收证据 |
| --- | --- | --- | --- | --- |
| 1 | **Contract — 定义可执行规则** | 无 | 权威 Markdown、机器契约、模块贡献、状态机、scope、权限、reason codes、rollout 决策 | JSON validation、生成文档检查、跨语言实质一致、产品/架构决定无 unresolved placeholder |
| 2 | **Package foundation — 生成可信快照** | Issue 1 | 实体、迁移、canonicalizer、source vector、原子生成、viewer-filtered queries、只读 UI | 同输入同 hash；并发来源变化 conflict；一次性/周期性/Child Event scope 测试；敏感投影隔离 |
| 3 | **Package decisions — 完成整体审批闭环** | Issue 2 | submit/withdraw/decide/revoke、条件状态机、权限/委派/回避、审计、待办和决定 UI | 四类决定端到端；条件满足与独立验证；未经授权、过期委派和重复决定均失败且不改状态 |
| 4 | **Lifecycle gates — 保护所有阶段入口** | Issues 1–3 | 统一 evaluator、Publish/Unpublish、Registration Open/Close、Execute、URL/QR/SEO 防泄漏、缓存失效 | 所有旧/新 API 使用统一 evaluator；公开绕过测试通过；批准不自动执行阶段动作 |
| 5 | **Material change — 让旧批准可靠失效** | Issues 2–4 | field diff、变化分类、影响矩阵、失效、supersede、重审任务、公开/报名安全收敛 | 场地/容量/人员/风险变化触发准确范围重审；cosmetic 不误伤；unknown fail closed |
| 6 | **Governance workspace — 交付完整可用界面** | Issues 2–5 的稳定 DTO | overview、准备、审批、条件、历史/diff 页面和完整交互状态 | 中英文、320px/desktop、键盘/modal/focus、权限拒绝、conflict/retry 浏览器验证 |
| 7 | **Legacy rollout — 安全启用新规则** | Issues 1–5 | 旧 Event 分类、只读 legacy/补审策略、feature flag、dry-run、监控、回滚手册 | 代表性旧活动不意外消失或中断；enforce 前 dry-run 差异可解释；回滚后历史仍可读 |
| 8 | **End-to-end hardening — 证明目标真实完成** | Issues 1–7 | 户外公开报名场景、周期性例外场景、安全/缓存/并发回归和文档收口 | 完整演示记录、自动化检查清单、风险披露、文档 parity 和最终 DoD 对照 |

每个 Issue 保持一个可审查的垂直切片，包含 Context、Goal、Scope、Acceptance Criteria、Out of Scope 和 Test Plan；不得把全部能力放入一个巨大 PR。

### 19.1 每个 Issue 的执行格式

执行者开始一个 Issue 时必须先写清：

1. **当前事实**：引用代码、契约和测试说明现在是什么，不把推断写成已确认需求。
2. **本 Issue 用户结果**：完成后哪个角色可以完成哪项新动作或得到哪项保护。
3. **精确范围**：列出会修改的层、API、DTO、状态和页面；列出明确不处理的相邻能力。
4. **状态与权限矩阵**：每个命令在各前置状态、角色、scope 和并发情况下的结果。
5. **数据与缓存影响**：迁移、历史读取、数据分类、Cache-Control、ETag、失效和保留行为。
6. **双语与页面状态**：英文/中文、loading、empty、blocked、permission denied、conflict、success 和 retry。
7. **验证证据**：准确命令、测试名称、浏览器尺寸/语言、未验证事项和风险。
8. **文档影响**：更新权威来源并生成派生文档；不得直接修改生成 HTML。

### 19.2 实施顺序约束

- Issue 1 未冻结以前，不创建正式数据库迁移或公开 API。
- Issue 2 先证明快照可信，再允许 Issue 3 把决定绑定到快照。
- Issue 4 接入 gate 前必须已有可查询的当前批准有效性，不能先在前端模拟。
- Issue 5 必须复用 Issue 4 的 gate evaluator，不另建一套失效判断。
- Issue 6 可以与后端后半段并行设计，但只能基于版本化 DTO contract，不直接读取持久化 JSON。
- Issue 7 在 enforce 前先运行 dry-run：计算新 gate 结果但不改变用户可见行为，记录非敏感差异供人工检查。
- Issue 8 只负责整体验证和必要的小修复，不能在最后阶段悄悄引入新的架构或大范围需求。

## 20. 第一项应执行的工作

第一项不是创建数据库实体，而是完成 **Issue 1：Contract**，冻结：

- 哪些事实触发 light、standard、enhanced；
- 各等级由谁作整体决定，以及委派、回避、quorum 和权限变化规则；
- Event、Occurrence、Series 和 Child Event 的 Package scope、继承与例外规则；
- Package 生命周期和批准有效性的准确状态机；
- 附条件批准的满足、验证、过期和允许豁免时的责任；
- Publish/Unpublish、Open/Close Registration、Execute 三类 gate 及失效后动作的准确规则；
- 哪些变化属于 governanceCritical；
- Package schema、治理政策版本、canonical hash 和一致性生成协议；
- Package 的数据分类、最小披露，以及审计元数据与个人证据不同的保留策略；
- 审批前公开 URL/QR、SEO、搜索、站点地图和缓存的禁止规则；
- 旧 Event 的 rollout、兼容期限、feature flag、监控和回滚策略；
- 尚未实现模块被活动事实触发时的 fail-closed 或受审计替代规则。

这些决定进入 `EVENT-CONTRACT.md` 和 `event-contract.json` 并通过文档生成检查后，再开始第一个代码切片。
