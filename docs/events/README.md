# ALIFE Event Management

> Documentation class: **Normative overview**. This is the compact human entry point. [EVENT-CONTRACT.md](EVENT-CONTRACT.md) and [event-contract.json](event-contract.json) remain authoritative when more detail or exact machine values are required.

[简体中文](#简体中文) · [繁體中文](#繁體中文) · [English](#english)

<!-- overview:zh-CN:start -->
## 简体中文

### 一个由事实组成的活动方案

ALIFE 不把活动锁定为一个固定的 `EventType`。活动类型只提供可解释、可覆盖的默认值；真实事实、结构、模块、治理规则和人工决定共同组成最终方案。

```
Event Plan
  = Event Facts
  + Structural Units
  + Capability Modules
  + Governance Rules
  + Human Decisions
```

组合必须是确定性的：相同的已确认事实、版本化定义和仍然有效的人工选择产生相同的提案。缺失或候选事实不能被当作 `false`，也不能关闭安全、隐私、赞助或权限要求。

### 四个不可变原型

- `simple-social` — 简单社交／外出
- `camp-retreat` — 营会／退修会
- `recurring-gathering` — 定期聚会
- `festival-celebration` — 节庆／庆典

这四个原型是不可变的系统分类和安全边界。分类中的 Activity Type 是版本化模板；它们可以提供默认模块、结构和岗位，但不能确认儿童、金流、交通、场地、容量或安全事实。

### 结构边界

- `EventSeries` 保存重复规则和可复用默认值；每个活动及实例保留自己的历史。
- `Event`（迁移期间仍由 `GroupEvent` 承载）是所有权、可见性、治理、报名和方案边界。
- `EventOccurrence` 是一次真实执行；单次活动至少有一个，定期活动按 12 周滚动窗口物化。
- `Session`／Track 组织同一活动中的时间段；`ProgramItem` 是其中的程序项。
- `Zone` 是同一活动中的空间／运营区域；`ServiceSlot`／Shift 是一次执行中的岗位需求。
- `ChildEvent` 只在需要独立报名、RAM、收费、权限、取消或结项时创建，而且最多一层；否则使用 Session 或 Zone。

### 十二个能力模块

- [TEAM.WORK](modules/TEAM.WORK.md)
- [PEOPLE.REGISTRATION](modules/PEOPLE.REGISTRATION.md)
- [SERVICE.ROSTER](modules/SERVICE.ROSTER.md)
- [MONEY.FINANCE](modules/MONEY.FINANCE.md)
- [SAFETY.RAM](modules/SAFETY.RAM.md)
- [SAFEGUARDING.CHILD](modules/SAFEGUARDING.CHILD.md)
- [PROGRAM.PRODUCTION](modules/PROGRAM.PRODUCTION.md)
- [PLACE.RESOURCE](modules/PLACE.RESOURCE.md)
- [MOVE.STAY](modules/MOVE.STAY.md)
- [FOOD.HOSPITALITY](modules/FOOD.HOSPITALITY.md)
- [FESTIVAL.OPERATIONS](modules/FESTIVAL.OPERATIONS.md)
- [COMMS.FOLLOWUP](modules/COMMS.FOLLOWUP.md)

模块是受控的产品能力，不是任意运行时代码。每个模块定义 ActivationRules、Dependencies、RoleRequirements、WorkflowContributions、DataClassification、ReadinessRules 和 Version。

### 活动方案正式审批

Event Package Approval 是 Plan 接受之后、发布／开放报名／收款／确认执行之前的独立治理环节。系统从当前 Plan、版本化治理政策、活动范围和各模块的最小必要摘要生成不可变 Package；提交后，由服务器确认有资格且与提交人适当分离的审批人作出批准、附条件批准或拒绝决定。Package 审批不取代 RAM、儿童保护、财务等专业审批，也不会自动触发后续动作。

审批只对绑定的 Plan、Package 版本、政策版本、来源向量和明确范围有效。重要来源变更、专业审批撤销或过期、条件失效会使相关生命周期门禁失效，并向操作者返回可解释的阻断原因。已有活动不会被补造历史批准；它们只按版本化迁移政策从 `off`、`dryRun` 进入 `enforced`。Plan B 和自动后备方案启用不在当前范围内。

### 人工确认与 AI 权限边界

RAM 按教会发布不可变政策与题库；管理员须逐格确认完整 25 格矩阵，未发布时仍可保存草稿。新版 RAM 分别记录初始／剩余风险，合并各活动适用题目，由本人确认指定版本，再由独立审核人审核；红色剩余风险须安全签署及加强 Package 审批。重要变更触发重审，历史保留；AI 只解释及追问，不覆盖人工评估，RAM 批准不会自动发布活动。参见 [RAM 模块规范](modules/SAFETY.RAM.md)及[管理员初始化](RAM-INITIALIZATION.md)。

活动筹备使用[连续七步流程](EVENT-SETUP-FLOW.md)：选择模板 → 活动资料 → 活动安排 → 确认创建 → 正式审批 → 海报制作 → 发布活动。新建与筹备修改共用创建时的表单，创建后不能再选择模板。已保存活动使用 Event Workspace；“安全／RAM 与安全”直接提供完整评估、本人确认、审核与打印流程。“活动安排”的安全区将未成年人／儿童保护与 RAM 要求／评估表分开排列，RAM 直接内嵌；新建时先填风险并随确认创建保存，创建后继续题库与签署审核。团队职责、报名、排班、节目、场地、儿童保护与交通工具均直接放在活动安排的对应分区，不再另设“团队与功能”步骤。创建后回到活动安排；旧入口也进入此页。各区域和功能右上角均可展开／收起，保留填写内容。各大分区另有默认未勾选的“已确认”，取消重复的三选项问题；修改后回到待确认。模块角色在各自模块分配，总负责人独立于模块；确认创建汇总分区状态与负责人，职责仍须本人接受。旧编辑链接转入 Workspace，不再打开已停用的 AI 活动编辑器；服务器权限与审批冻结规则继续生效。正式审批显示各等级命中的政策条件；最晚预期批复时间为活动开始时间减去政策的最终确认提前开放小时数。创建成功后继续编辑同一个活动；新方案活动从未发布、报名关闭状态开始。批准前可反复修改资料和安排；审批退回后可修改重提。保存后的筹备阶段，每项功能均可选是或否；关闭会保留资料，正式提交时再核对必要条件。批准后筹备资料冻结，可申请撤销审批，获准后恢复修改并重新审批。海报不在审批内容内，放在正式审批之后制作并由人工核对采用。批准后仍须确认发布，公共网站、教会生活和小组生活按既定可见范围展示；旧活动的兼容规则保持不变。

在[活动安排](CREATION-ARRANGEMENTS.md)页，可选功能通过“是／否”启用，必需功能保持锁定。岗位与轮班、节目与制作、场地与资源可直接展开填写人数、时段、节目顺序及场地预订，并在同页查看安排一览。关闭功能保留草稿；最终人工确认时，安排与活动一起保存。系列安排应用于本次创建的未来 12 周场次，场地冲突在创建时再次检查。

创建时的 [AI 资料助手](AI-DETAILS-ASSISTANT.md) 根据最新表单逐轮整理双语文字、时间、地点和报名设置，显示字段完成度、AI 充分性评估及待澄清问题。对话以左右聊天气泡显示在输入框上方，按时间从上到下排列，新增消息后自动滚动到底部；字段完成度与返回表单操作位于发送按钮下方，方便核对。明确日期与时间范围按活动时区回填，未确认的预填时间会标示。支持的浏览器可用中英文语音输入，识别文字追加到输入框，由用户核对后发送；不支持时仍可打字。默认值需用户确认才计入完成度；时间使用活动时区，系列活动支持每 1–52 周重复并保留未来 12 周窗口。回填仅更新待审阅草稿，最终创建仍须人工确认。

组合只生成候选方案。服务器在接受时重新组合并检查 hash、并发和幂等性；只有明确的人工接受才能建立权威、版本化且不可变的 Event Plan snapshot。以后修改原型、模板、模块或政策，不得改写已接受方案或历史实例。

AI 可以建议候选事实和解释原因，但不能确认事实、分配权限、批准、豁免政策、授予赞助、持久化或发布。前端可见性永远不能代替服务器授权，私密／受限资料不得进入共享缓存、日志或 AI 提示。

### 一个工作流引擎

现有 `EventWorkflowRun`／Step／Artifact 保持为唯一通用活动工作流引擎。模块向它贡献步骤和产出物；RAM 等专用领域流程继续由自己的权威处理程序管理，不引入第二个流程引擎。

### 继续阅读

- [EVENT-CONTRACT.md](EVENT-CONTRACT.md) — 完整规范架构、ADR 和不变量
- [event-contract.json](event-contract.json) — 精确代码、枚举、引用和 API 契约
- [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) — 当前存储库进度、迁移和验证状态
- [模块文档](modules/TEAM.WORK.md) — 每个能力模块的目标、现况与缺口
- [EventManagement-About.html](EventManagement-About.html) — 由本 README 生成的三语概览
- [完整活动管理手册](generated/alife-event-composition-model.zh-TW-en.html) — 生成的繁中／英文长篇展示
<!-- overview:zh-CN:end -->

<!-- overview:zh-TW:start -->
## 繁體中文

### 一個由事實組成的活動方案

ALIFE 不把活動鎖定為一個固定的 `EventType`。活動類型只提供可解釋、可覆寫的預設值；真實事實、結構、模組、治理規則和人工決定共同組成最終方案。

```
Event Plan
  = Event Facts
  + Structural Units
  + Capability Modules
  + Governance Rules
  + Human Decisions
```

組合必須是確定性的：相同的已確認事實、版本化定義和仍然有效的人工選擇產生相同的提案。缺失或候選事實不能被當作 `false`，也不能關閉安全、隱私、贊助或權限要求。

### 四個不可變原型

- `simple-social` — 簡單社交／外出
- `camp-retreat` — 營會／退修會
- `recurring-gathering` — 定期聚會
- `festival-celebration` — 節慶／慶典

這四個原型是不可變的系統分類和安全邊界。分類中的 Activity Type 是版本化範本；它們可以提供預設模組、結構和崗位，但不能確認兒童、金流、交通、場地、容量或安全事實。

### 結構邊界

- `EventSeries` 保存重複規則和可複用預設值；每個活動及實例保留自己的歷史。
- `Event`（遷移期間仍由 `GroupEvent` 承載）是所有權、可見性、治理、報名和方案邊界。
- `EventOccurrence` 是一次真實執行；單次活動至少有一個，定期活動按 12 週滾動視窗物化。
- `Session`／Track 組織同一活動中的時段；`ProgramItem` 是其中的程序項。
- `Zone` 是同一活動中的空間／營運區域；`ServiceSlot`／Shift 是一次執行中的崗位需求。
- `ChildEvent` 只在需要獨立報名、RAM、收費、權限、取消或結項時建立，而且最多一層；否則使用 Session 或 Zone。

### 十二個能力模組

- [TEAM.WORK](modules/TEAM.WORK.md)
- [PEOPLE.REGISTRATION](modules/PEOPLE.REGISTRATION.md)
- [SERVICE.ROSTER](modules/SERVICE.ROSTER.md)
- [MONEY.FINANCE](modules/MONEY.FINANCE.md)
- [SAFETY.RAM](modules/SAFETY.RAM.md)
- [SAFEGUARDING.CHILD](modules/SAFEGUARDING.CHILD.md)
- [PROGRAM.PRODUCTION](modules/PROGRAM.PRODUCTION.md)
- [PLACE.RESOURCE](modules/PLACE.RESOURCE.md)
- [MOVE.STAY](modules/MOVE.STAY.md)
- [FOOD.HOSPITALITY](modules/FOOD.HOSPITALITY.md)
- [FESTIVAL.OPERATIONS](modules/FESTIVAL.OPERATIONS.md)
- [COMMS.FOLLOWUP](modules/COMMS.FOLLOWUP.md)

模組是受控的產品能力，不是任意 runtime 程式碼。每個模組定義 ActivationRules、Dependencies、RoleRequirements、WorkflowContributions、DataClassification、ReadinessRules 和 Version。

### 活動方案正式審批

Event Package Approval 是 Plan 接受之後、發布／開放報名／收款／確認執行之前的獨立治理環節。系統從當前 Plan、版本化治理政策、活動範圍和各模組的最小必要摘要產生不可變 Package；提交後，由伺服器確認有資格且與提交人適當分離的審批人作出批准、附條件批准或拒絕決定。Package 審批不取代 RAM、兒童保護、財務等專業審批，也不會自動觸發後續動作。

審批只對綁定的 Plan、Package 版本、政策版本、來源向量和明確範圍有效。重要來源變更、專業審批撤銷或過期、條件失效會使相關生命週期門禁失效，並向操作者回傳可解釋的阻斷原因。既有活動不會被補造歷史批准；它們只按版本化遷移政策從 `off`、`dryRun` 進入 `enforced`。Plan B 和自動後備方案啟用不在目前範圍內。

### 人工確認與 AI 權限邊界

RAM 按教會發布不可變政策與題庫；管理員須逐格確認完整 25 格矩陣，未發布時仍可儲存草稿。新版 RAM 分別記錄初始／剩餘風險，合併各活動適用題目，由本人確認指定版本，再由獨立審核人審核；紅色剩餘風險須安全簽署及加強 Package 審批。重要變更觸發重審，歷史保留；AI 只解釋及追問，不覆蓋人工評估，RAM 批准不會自動發布活動。參見 [RAM 模組規範](modules/SAFETY.RAM.md)及[管理員初始化](RAM-INITIALIZATION.md)。

活動籌備使用[連續七步流程](EVENT-SETUP-FLOW.md)：選擇範本 → 活動資料 → 活動安排 → 確認建立 → 正式審批 → 海報製作 → 發布活動。新建與籌備修改共用建立時的表單，建立後不能再選擇範本。已儲存活動使用 Event Workspace；「安全／RAM 與安全」直接提供完整評估、本人確認、審核與列印流程。「活動安排」的安全區將未成年人／兒童保護與 RAM 要求／評估表分開排列，RAM 直接內嵌；新建時先填風險並隨確認建立儲存，建立後繼續題庫與簽署審核。團隊職責、報名、排班、節目、場地、兒童保護與交通工具均直接放在活動安排的對應分區，不再另設「團隊與功能」步驟。建立後回到活動安排；舊入口也進入此頁。各區域和功能右上角均可展開／收起，保留填寫內容。各大分區另有預設未勾選的「已確認」，取消重複的三選項問題；修改後回到待確認。模組角色在各自模組分配，總負責人獨立於模組；確認建立彙總分區狀態與負責人，職責仍須本人接受。舊編輯連結轉入 Workspace，不再開啟已停用的 AI 活動編輯器；伺服器權限與審批凍結規則繼續生效。正式審批顯示各等級命中的政策條件；最晚預期批覆時間為活動開始時間減去政策的最終確認提前開放小時數。建立成功後繼續編輯同一個活動；新方案活動從未發布、報名關閉狀態開始。批准前可反覆修改資料和安排；審批退回後可修改重提。儲存後的籌備階段，每項功能均可選是或否；關閉會保留資料，正式提交時再核對必要條件。批准後籌備資料凍結，可申請撤銷審批，獲准後恢復修改並重新審批。海報不在審批內容內，放在正式審批之後製作並由人工核對採用。批准後仍須確認發布，公共網站、教會生活和小組生活按既定可見範圍顯示；既有活動的相容規則保持不變。

在[活動安排](CREATION-ARRANGEMENTS.md)頁，可選功能透過「是／否」啟用，必需功能保持鎖定。崗位與輪班、節目與製作、場地與資源可直接展開填寫人數、時段、節目順序及場地預訂，並在同頁查看安排一覽。關閉功能保留草稿；最終人工確認時，安排與活動一起儲存。系列安排套用於本次建立的未來 12 週場次，場地衝突在建立時再次檢查。

建立時的 [AI 資料助手](AI-DETAILS-ASSISTANT.md) 根據最新表單逐輪整理雙語文字、時間、地點和報名設定，顯示欄位完成度、AI 充分性評估及待釐清問題。對話以左右聊天氣泡顯示在輸入框上方，按時間從上到下排列，新增訊息後自動捲動到底部；欄位完成度與返回表單操作位於傳送按鈕下方，方便核對。明確日期與時間範圍按活動時區回填，未確認的預填時間會標示。支援的瀏覽器可用中英文語音輸入，辨識文字追加到輸入框，由使用者核對後傳送；不支援時仍可打字。預設值需使用者確認才計入完成度；時間使用活動時區，系列活動支援每 1–52 週重複並保留未來 12 週視窗。回填僅更新待審閱草稿，最終建立仍須人工確認。

組合只產生候選方案。伺服器在接受時重新組合並檢查 hash、並行控制和冪等性；只有明確的人工接受才能建立權威、版本化且不可變的 Event Plan snapshot。以後修改原型、範本、模組或政策，不得改寫已接受方案或歷史實例。

AI 可以建議候選事實和解釋原因，但不能確認事實、分配權限、批准、豁免政策、授予贊助、持久化或發布。前端可見性永遠不能代替伺服器授權，私密／受限資料不得進入共享快取、日誌或 AI 提示。

### 一個工作流引擎

現有 `EventWorkflowRun`／Step／Artifact 保持為唯一通用活動工作流引擎。模組向它貢獻步驟和產出物；RAM 等專用領域流程繼續由自己的權威處理程序管理，不引入第二個流程引擎。

### 繼續閱讀

- [EVENT-CONTRACT.md](EVENT-CONTRACT.md) — 完整規範架構、ADR 和不變量
- [event-contract.json](event-contract.json) — 精確代碼、枚舉、引用和 API 契約
- [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) — 當前儲存庫進度、migration 和驗證狀態
- [模組文件](modules/TEAM.WORK.md) — 每個能力模組的目標、現況與缺口
- [EventManagement-About.html](EventManagement-About.html) — 由本 README 產生的三語概覽
- [完整活動管理手冊](generated/alife-event-composition-model.zh-TW-en.html) — 產生的繁中／英文長篇展示
<!-- overview:zh-TW:end -->

<!-- overview:en:start -->
## English

### An event plan composed from facts

ALIFE does not lock an event to a rigid `EventType`. An Activity Type supplies explainable, overridable defaults; real facts, structure, modules, governance rules, and human decisions compose the final plan.

```
Event Plan
  = Event Facts
  + Structural Units
  + Capability Modules
  + Governance Rules
  + Human Decisions
```

Composition is deterministic: the same confirmed facts, versioned definitions, and still-valid human selections produce the same proposal. Missing or candidate facts are not `false` and cannot switch off safety, privacy, sponsorship, or authority requirements.

### Four immutable archetypes

- `simple-social` — Simple social / outing
- `camp-retreat` — Camp / retreat
- `recurring-gathering` — Recurring gathering
- `festival-celebration` — Festival / celebration

These four archetypes are immutable system categories and safety boundaries. Activity Types inside a category are versioned templates. They may default modules, structure, and service slots, but they never confirm child, money, transport, venue, capacity, or safety facts.

### Structural boundaries

- `EventSeries` holds recurrence and reusable defaults while every event and occurrence preserves its own history.
- `Event` (still persisted as `GroupEvent` during migration) is the ownership, visibility, governance, registration, and plan boundary.
- `EventOccurrence` is one real delivery; a one-off has at least one, while recurring events materialise a rolling 12-week window.
- `Session` / Track organises time within one event; `ProgramItem` is an item in that programme.
- `Zone` is a spatial or operational area within one event; `ServiceSlot` / Shift is role demand for one delivery.
- `ChildEvent` exists only when a unit needs independent registration, RAM, fees, access, cancellation, or closure, and stops at one level; otherwise use a Session or Zone.

### Twelve capability modules

- [TEAM.WORK](modules/TEAM.WORK.md)
- [PEOPLE.REGISTRATION](modules/PEOPLE.REGISTRATION.md)
- [SERVICE.ROSTER](modules/SERVICE.ROSTER.md)
- [MONEY.FINANCE](modules/MONEY.FINANCE.md)
- [SAFETY.RAM](modules/SAFETY.RAM.md)
- [SAFEGUARDING.CHILD](modules/SAFEGUARDING.CHILD.md)
- [PROGRAM.PRODUCTION](modules/PROGRAM.PRODUCTION.md)
- [PLACE.RESOURCE](modules/PLACE.RESOURCE.md)
- [MOVE.STAY](modules/MOVE.STAY.md)
- [FOOD.HOSPITALITY](modules/FOOD.HOSPITALITY.md)
- [FESTIVAL.OPERATIONS](modules/FESTIVAL.OPERATIONS.md)
- [COMMS.FOLLOWUP](modules/COMMS.FOLLOWUP.md)

Modules are controlled product capabilities, not arbitrary runtime code. Every module defines ActivationRules, Dependencies, RoleRequirements, WorkflowContributions, DataClassification, ReadinessRules, and Version.

### Event Package Approval

Event Package Approval is a distinct governance step after Plan acceptance and before publication, registration opening, payment acceptance, or execution confirmation. The system generates an immutable Package from the current Plan, versioned governance policy, explicit scope, and each module's minimum necessary summary. After submission, a server-verified eligible approver with appropriate separation from the submitter records approval, conditional approval, or rejection. Package approval neither replaces specialist RAM, safeguarding, or finance decisions nor performs a downstream action automatically.

Approval is valid only for the bound Plan, Package version, policy version, source vector, and explicit scope. Material source changes, revoked or expired specialist decisions, and failed conditions invalidate the affected lifecycle gates with explainable blockers. Existing Events receive no invented historical approval; they enter enforcement only through a versioned `off`, `dryRun`, then `enforced` migration policy. Plan B and automatic contingency activation are outside the current scope.

### Human confirmation and AI authority

RAM policies and question libraries are published as immutable church versions. Administrators explicitly confirm all 25 matrix cells; drafts remain saveable before publication. Version 2 records initial and residual risk, combines questions per activity, obtains personal confirmation of the specified version and independent review; Red residual risk requires safety sign-off and Enhanced Package approval. Material changes require re-review while preserving history. AI only explains and asks questions, never overwrites human assessment, and RAM approval never publishes an Event. See the [RAM module contract](modules/SAFETY.RAM.md) and [administrator initialization](RAM-INITIALIZATION.md).

Event preparation uses a [continuous seven-step flow](EVENT-SETUP-FLOW.md): Template → Details → Arrangements → Confirm creation → Formal approval → Poster → Publish. Creation and preparation editing share the creation form; the template cannot be reselected after creation. Saved Events use Event Workspace. Safety / RAM and safety directly provides assessment, personal confirmation, review and printing. Arrangements pairs children participation with safeguarding, then the RAM requirement with an inline assessment. New Events can record risks and save them with explicit Create, then continue with questions and signed review. Team responsibilities, enrollment, roster, programme, venue, safeguarding and travel tools are embedded in their Arrangements groups; there is no separate Team and tools step. Creation and legacy setup links lead to Arrangements. Every group and tool has a top-right expand/collapse control that retains input. Legacy edit links redirect to Workspace without opening the retired AI event editor; server authorization and approval freezes remain authoritative. Formal approval explains each tier’s matching policy conditions; the expected latest reply is Event start minus the policy’s final-confirmation opening hours. Successful creation continues editing the same Event; new composition-backed Events begin unpublished with registration closed. Details and arrangements can be revised repeatedly before approval, including after return. Every tool remains a Yes/No choice during saved preparation; disabling preserves its data, and formal submission checks required conditions. Approval freezes preparation; an authorised reopening request restores editing and requires fresh approval. Posters are excluded from formal approval and are produced and adopted afterward. Approval still requires a separate publication confirmation, after which the public website, Church Life and Group Life apply the configured audience. Existing Event compatibility remains unchanged. Each section has an initially unchecked Confirmed marker, replacing duplicate three-choice questions; edits make it pending again. Roles are assigned in their modules, with a global accountable owner. Creation review summarizes section status and responsible people; roles still require personal acceptance.

On [Arrangements](CREATION-ARRANGEMENTS.md), optional tools have Yes/No choices while required tools stay locked. Roles and shifts, programme and production, and venue and resources expand inline for counts, times, programme order and bookings, with a same-page summary. Turning a tool off preserves its draft. Final human confirmation saves arrangements with the Event. Series arrangements apply to occurrences created in the initial 12-week window; venue conflicts are rechecked at creation.

The creation [AI details assistant](AI-DETAILS-ASSISTANT.md) uses the latest form on each turn to organise bilingual copy, times, location and registration settings, with field completion, an AI sufficiency assessment and clarification questions. Supported browsers offer Chinese/English voice input that appends text for human review and sending; typing remains available when unsupported. Defaults count only after user confirmation. Dates use the event time zone; series repeat every 1–52 weeks within the rolling 12-week window. Autofill updates a reviewable draft; final creation still requires human acceptance. The conversation uses left/right chat bubbles above the input in chronological order and automatically scrolls to the bottom on new messages. Field completion and the return-to-form action follow the send button for review. Explicit calendar dates and clock ranges fill Event-zone local values; unconfirmed prefilled times are labelled.

Composition produces a candidate plan only. On acceptance, the server recomposes and checks the hash, concurrency, and idempotency; only explicit human acceptance creates an authoritative, versioned, immutable Event Plan snapshot. Later archetype, template, module, or policy changes never rewrite accepted plans or historical occurrences.

AI may propose candidate facts and explain recommendations. It cannot confirm facts, assign authority, approve, waive policy, grant sponsorship, persist, or publish. Frontend visibility never replaces server authorisation, and private or restricted data never enters shared cache, logs, or AI prompts.

### One workflow engine

The existing `EventWorkflowRun` / Step / Artifact model remains the single general Event workflow engine. Modules contribute steps and artifacts to it; dedicated domain flows such as RAM retain their authoritative handlers without introducing a second workflow engine.

### Continue reading

- [EVENT-CONTRACT.md](EVENT-CONTRACT.md) — complete normative architecture, ADRs, and invariants
- [event-contract.json](event-contract.json) — exact codes, enums, references, and API contracts
- [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) — current repository progress, migrations, and verification
- [Module documents](modules/TEAM.WORK.md) — each capability module's target, current state, and gaps
- [EventManagement-About.html](EventManagement-About.html) — generated three-language version of this README
- [Full Event Management handbook](generated/alife-event-composition-model.zh-TW-en.html) — generated Traditional Chinese / English long-form presentation
<!-- overview:en:end -->

## Generation

Run `node docs/events/scripts/generate-event-docs.mjs` after editing this README or the machine contract. Run it with `--check` to verify generated output, links, module and archetype references, and three-language overview structure without writing files.
