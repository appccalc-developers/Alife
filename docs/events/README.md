# ALIFE Event Management

> Human overview and navigation. Business authority belongs to the core contract, delegated topics/modules and machine contract. Delivery status and historical evidence are separate.

<!-- overview:zh-CN:start -->

## 简体中文

### 活动是什么

ALIFE 帮助群体筹备、公布、执行和收尾活动。活动由已确认的事实、所需能力和明确负责的人组成；模板提供起点，不能代替事实或授权。

本页是产品概览。业务规则以[核心契约及其专题](EVENT-CONTRACT.md)为准；[当前实现状态](IMPLEMENTATION-STATUS.md)说明已交付范围，不代表完整目标或已经部署。

### 活动结构

- **Event Plan**：人工接受的不可变方案快照；后续修改产生新版本。
- **EventSeries**：重复活动的时区、规律和共用设置；维持未来十二周的场次窗口。
- **EventOccurrence**：一次实际执行，具有自己的人员、安排和执行确认；一个场次结束不代表整个系列结束。
- 只有需要独立报名、安全、费用或生命周期时才使用子活动，最多一层；节目时段和区域不另建活动生命周期。

### 阶段与职责

- **筹备**：创建者承担总负责；负责人按需往返各筹备区域，模块负责人提交报告，受邀人员亲自接受职责。
- **公布与报名**：有权者明确公布、开放报名；各负责人通过独立工作入口处理报名、排班等职责。公布不停止后续排班。
- **执行**：按具体场次检查人员资格、安全与批准范围，由有权者明确确认执行。
- **收尾**：处理仍需完成的交接、反馈和职责。阶段导航本身不保存、批准或授予权限。

### 人工决定与隐私

- 方案接受、RAM 等专项审核、整体 Package 审批、公布和执行是不同的人工作业。AI 只在各自批准的范围内辅助；生成内容不能自动发布。
- 服务器核对当前成员、角色、用途和版本。参与者、儿童、安全和财务资料按需最少披露；受保护资料不进入共享缓存。
- 业务采用明确版本与兼容规则。四个既有阶段继续使用；Plan B 和额外的复盘阶段尚未纳入。

### 能力模块

- [TEAM.WORK](modules/TEAM.WORK.md) — 任务与交接
- [PEOPLE.REGISTRATION](modules/PEOPLE.REGISTRATION.md) — 报名与参与人
- [SERVICE.ROSTER](modules/SERVICE.ROSTER.md) — 同工排班
- [MONEY.FINANCE](modules/MONEY.FINANCE.md) — 财务与报名费用
- [SAFETY.RAM](modules/SAFETY.RAM.md) — 风险评估与审核
- [SAFEGUARDING.CHILD](modules/SAFEGUARDING.CHILD.md) — 儿童保障
- [PROGRAM.PRODUCTION](modules/PROGRAM.PRODUCTION.md) — 节目与流程
- [PLACE.RESOURCE](modules/PLACE.RESOURCE.md) — 场地与资源
- [MOVE.STAY](modules/MOVE.STAY.md) — 交通与住宿
- [FOOD.HOSPITALITY](modules/FOOD.HOSPITALITY.md) — 餐饮接待
- [COMMS.FOLLOWUP](modules/COMMS.FOLLOWUP.md) — 沟通与跟进
- [FESTIVAL.OPERATIONS](modules/FESTIVAL.OPERATIONS.md) — 节庆现场运营

模块名称描述产品职责，并不表示全部功能已完成。当前版本的财务只支持人工报名费用，餐饮只支持负责人报告，节庆运营尚不可用；详见实现状态。

### 按需阅读

- [组合与模板](EVENT-COMPOSITION.md) · [审批与生命周期门槛](EVENT-PACKAGE-APPROVAL.md)
- [阶段与工作空间](EVENT-WORKSPACES.md) · [筹备流程](EVENT-SETUP-FLOW.md) · [创建安排](CREATION-ARRANGEMENTS.md)
- [个人事务与交接](EVENT-DUTIES.md) · [AI 表单辅助](AI-DETAILS-ASSISTANT.md)
- [精确机器契约](event-contract.json) · [设计指导](design/EVENT-WORKSPACE-DESIGN.md) · [开发阅读规则](AGENTS.md)
- [历史验证记录](IMPLEMENTATION-HISTORY.md)与[生成的长篇手册](generated/alife-event-composition-model.zh-TW-en.html)仅供按需追溯；历史结果不是当前验证。

<!-- overview:zh-CN:end -->

<!-- overview:zh-TW:start -->

## 繁體中文

### 活動是什麼

ALIFE 協助群體籌備、公布、執行和收尾活動。活動由已確認的事實、所需能力和明確負責的人組成；範本提供起點，不能代替事實或授權。

本頁是產品概覽。業務規則以[核心契約及其專題](EVENT-CONTRACT.md)為準；[目前實作狀態](IMPLEMENTATION-STATUS.md)說明已交付範圍，不代表完整目標或已經部署。

### 活動結構

- **Event Plan**：人工接受的不可變方案快照；後續修改產生新版本。
- **EventSeries**：重複活動的時區、規律和共用設定；維持未來十二週的場次視窗。
- **EventOccurrence**：一次實際執行，具有自己的人員、安排和執行確認；一個場次結束不代表整個系列結束。
- 只有需要獨立報名、安全、費用或生命週期時才使用子活動，最多一層；節目時段和區域不另建活動生命週期。

### 階段與職責

- **籌備**：建立者承擔總負責；負責人按需往返各籌備區域，模組負責人提交報告，受邀人員親自接受職責。
- **公布與報名**：有權者明確公布、開放報名；各負責人透過獨立工作入口處理報名、排班等職責。公布不停止後續排班。
- **執行**：按具體場次檢查人員資格、安全與批准範圍，由有權者明確確認執行。
- **收尾**：處理仍需完成的交接、回饋和職責。階段導覽本身不儲存、批准或授予權限。

### 人工決定與隱私

- 方案接受、RAM 等專項審核、整體 Package 審批、公布和執行是不同的人工作業。AI 只在各自批准的範圍內輔助；生成內容不能自動發布。
- 伺服器核對目前成員、角色、用途和版本。參與者、兒童、安全和財務資料按需最少揭露；受保護資料不進入共用快取。
- 業務採用明確版本與相容規則。四個既有階段繼續使用；Plan B 和額外的回顧階段尚未納入。

### 能力模組

- [TEAM.WORK](modules/TEAM.WORK.md) — 任務與交接
- [PEOPLE.REGISTRATION](modules/PEOPLE.REGISTRATION.md) — 報名與參與人
- [SERVICE.ROSTER](modules/SERVICE.ROSTER.md) — 同工排班
- [MONEY.FINANCE](modules/MONEY.FINANCE.md) — 財務與報名費用
- [SAFETY.RAM](modules/SAFETY.RAM.md) — 風險評估與審核
- [SAFEGUARDING.CHILD](modules/SAFEGUARDING.CHILD.md) — 兒童保障
- [PROGRAM.PRODUCTION](modules/PROGRAM.PRODUCTION.md) — 節目與流程
- [PLACE.RESOURCE](modules/PLACE.RESOURCE.md) — 場地與資源
- [MOVE.STAY](modules/MOVE.STAY.md) — 交通與住宿
- [FOOD.HOSPITALITY](modules/FOOD.HOSPITALITY.md) — 餐飲接待
- [COMMS.FOLLOWUP](modules/COMMS.FOLLOWUP.md) — 溝通與跟進
- [FESTIVAL.OPERATIONS](modules/FESTIVAL.OPERATIONS.md) — 節慶現場營運

模組名稱描述產品職責，並不表示全部功能已完成。目前版本的財務只支援人工報名費用，餐飲只支援負責人報告，節慶營運尚不可用；詳見實作狀態。

### 按需閱讀

- [組合與範本](EVENT-COMPOSITION.md) · [審批與生命週期門檻](EVENT-PACKAGE-APPROVAL.md)
- [階段與工作空間](EVENT-WORKSPACES.md) · [籌備流程](EVENT-SETUP-FLOW.md) · [建立安排](CREATION-ARRANGEMENTS.md)
- [個人事務與交接](EVENT-DUTIES.md) · [AI 表單輔助](AI-DETAILS-ASSISTANT.md)
- [精確機器契約](event-contract.json) · [設計指引](design/EVENT-WORKSPACE-DESIGN.md) · [開發閱讀規則](AGENTS.md)
- [歷史驗證記錄](IMPLEMENTATION-HISTORY.md)與[生成的長篇手冊](generated/alife-event-composition-model.zh-TW-en.html)僅供按需追溯；歷史結果不是目前驗證。

<!-- overview:zh-TW:end -->

<!-- overview:en:start -->

## English

### What an Event is

ALIFE helps communities prepare, publish, deliver and follow up on Events. An Event combines confirmed facts, required capabilities and accountable people. Templates provide a starting point; they do not establish facts or permissions.

This page is a product overview. The [core contract and delegated topics](EVENT-CONTRACT.md) define business rules; [current implementation status](IMPLEMENTATION-STATUS.md) describes delivered scope, not complete targets or deployed availability.

### Event structure

- **Event Plan**: a human-accepted immutable snapshot; later changes produce another version.
- **EventSeries**: recurrence, time zone and shared settings, maintaining a rolling twelve-week occurrence window.
- **EventOccurrence**: one delivery with its own people, arrangements and execution confirmation; finishing one date does not close the series.
- Use a Child Event only for independent registration, safety, fees or lifecycle, with one parent level at most. Programme sessions and zones do not create another Event lifecycle.

### Stages and responsibilities

- **Preparation**: the creator is accountable; planning areas can be revisited, module leads submit reports and invited people personally accept responsibilities.
- **Publication and registration**: authorized people explicitly publish/open registration; leads use independent work entries for registration, scheduling and other duties. Scheduling continues after publication.
- **Execution**: validate staffing eligibility, safety and approval coverage for the specific occurrence; an authorized person explicitly confirms execution.
- **Follow-up**: finish remaining handoffs, feedback and responsibilities. Stage navigation itself never saves, approves or grants authority.

### Human decisions and privacy

- Plan acceptance, specialist decisions such as RAM, overall Package approval, publication and execution are separate human actions. AI assists only within its authorized scope; generated content is never auto-published.
- The server checks current membership, roles, purpose and version. Participant, child, safety and financial information receives minimum necessary disclosure; protected data never enters shared caches.
- Explicit version and compatibility rules apply. The existing four stages remain; Plan B and a separate Review/Reflection stage are not included.

### Capability modules

- [TEAM.WORK](modules/TEAM.WORK.md) — Tasks and handoffs
- [PEOPLE.REGISTRATION](modules/PEOPLE.REGISTRATION.md) — Registration and participants
- [SERVICE.ROSTER](modules/SERVICE.ROSTER.md) — Volunteer scheduling
- [MONEY.FINANCE](modules/MONEY.FINANCE.md) — Finance and registration fees
- [SAFETY.RAM](modules/SAFETY.RAM.md) — Risk assessment and review
- [SAFEGUARDING.CHILD](modules/SAFEGUARDING.CHILD.md) — Child safeguarding
- [PROGRAM.PRODUCTION](modules/PROGRAM.PRODUCTION.md) — Programme and run sheet
- [PLACE.RESOURCE](modules/PLACE.RESOURCE.md) — Venues and resources
- [MOVE.STAY](modules/MOVE.STAY.md) — Transport and accommodation
- [FOOD.HOSPITALITY](modules/FOOD.HOSPITALITY.md) — Food and hospitality
- [COMMS.FOLLOWUP](modules/COMMS.FOLLOWUP.md) — Communication and follow-up
- [FESTIVAL.OPERATIONS](modules/FESTIVAL.OPERATIONS.md) — Live festival operations

Module names describe product responsibilities, not completion of every feature. Current finance supports manual registration fees, food supports lead reports, and festival operations is unavailable; see implementation status.

### Read by topic

- [Composition and templates](EVENT-COMPOSITION.md) · [Approval and lifecycle gates](EVENT-PACKAGE-APPROVAL.md)
- [Stages and workspaces](EVENT-WORKSPACES.md) · [Preparation](EVENT-SETUP-FLOW.md) · [Creation arrangements](CREATION-ARRANGEMENTS.md)
- [Personal duties and handoffs](EVENT-DUTIES.md) · [AI form assistance](AI-DETAILS-ASSISTANT.md)
- [Exact machine contract](event-contract.json) · [Design guidance](design/EVENT-WORKSPACE-DESIGN.md) · [Development reading rules](AGENTS.md)
- [Historical verification](IMPLEMENTATION-HISTORY.md) and the [generated long handbook](generated/alife-event-composition-model.zh-TW-en.html) are for relevant historical investigation; old results are not current verification.

<!-- overview:en:end -->
