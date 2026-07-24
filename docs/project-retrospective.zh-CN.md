# Alife 项目回溯：从想法到可用的 Alpha 产品

## 摘要

Alife 起源于一个具体而长期存在的问题：海外华人教会的群组、成员、网页、讲道、活动、报名和双语内容，往往散落在不同工具、聊天记录和少数同工的个人经验里。我的目标不是再做一个信息展示网站，而是建立一个让访客、成员、组长、内容同工和平台管理员都能完成实际任务的社区平台。

从 2026 年 4 月 15 日到 7 月 23 日，项目留下了 271 条 GitHub issues，其中 269 条已经关闭，2 条仍在开放路线图中。这个数字本身不是成果；真正能证明从 0 到 1 能力的是，issues 所记录的工作逐步形成了完整的产品闭环：

- 访客可以浏览公开内容、讲道、活动、论坛和历史文章；
- 成员可以加入群组、报名活动、参与讨论、阅读双语圣经并跨设备保存进度；
- 组长可以管理成员、子群组、公告、相册、联系人、网页和活动；
- 内容同工可以用双语 WYSIWYG 页面构建器建立并维护公开网站；
- 审核者可以控制页面发布、菜单结构和公开内容投放；
- AI 可以协助活动策划、报名、复盘、翻译和风险评估，但关键内容仍由人确认和批准；
- 系统通过后端、Cloudflare 边缘层和 PWA 客户端的分层缓存，在性能、成本、隐私和数据新鲜度之间取得平衡。

截至本次回溯，Alife 已经不是概念原型，而是一个具备真实业务边界、角色权限、内容治理、运维能力和持续迭代轨迹的 Alpha 产品。

## 证据范围

- 仓库：[`appccalc-developers/Alife`](https://github.com/appccalc-developers/Alife)
- 数据范围：全部 271 条 issues，包含开放和关闭状态
- 时间范围：2026-04-15 至 2026-07-23
- 月度分布：4 月 22 条、5 月 68 条、6 月 98 条、7 月 83 条
- 当前状态：269 条关闭，2 条开放，关闭率 99.3%

这里的 issue 数量只表示可追溯的工作项，不等于 271 个独立功能，也不直接等于开发速度。GitHub 的 issue 与 PR 共用编号，因此 issue 编号从 #1 延伸到 #575；其中还包括一条明确的测试 issue（[#416](https://github.com/appccalc-developers/Alife/issues/416)）。本回溯把 issue 正文、验收条件、状态和时间作为产品演进证据，而不是把数量当作营销指标。

## 从 0 到 1 的功能成长

### 第一阶段：先建立可信赖的产品底座

最早的工作不是追求功能数量，而是处理一个社区产品必须先解决的基础问题：身份、访问、移动端体验和可部署性。

项目先修正讲道读取被外部 YouTube 同步阻塞的问题（[#1](https://github.com/appccalc-developers/Alife/issues/1)），取消没有必要的访客 GUID（[#3](https://github.com/appccalc-developers/Alife/issues/3)），加入兼容旧 iPhone 的 PWA 能力（[#5](https://github.com/appccalc-developers/Alife/issues/5)），并建立 LINE OAuth、HttpOnly Cookie 和 JWT 登录流程（[#9](https://github.com/appccalc-developers/Alife/issues/9)、[#21](https://github.com/appccalc-developers/Alife/issues/21)）。

同时，我把后端从混合 SPA 的应用整理成独立 API（[#11](https://github.com/appccalc-developers/Alife/issues/11)），迁移到 Azure Functions（[#13](https://github.com/appccalc-developers/Alife/issues/13)），并补上 Docker 化（[#19](https://github.com/appccalc-developers/Alife/issues/19)）。

这一阶段证明我知道 0 到 1 的第一步不是做漂亮页面，而是先让身份、API 边界、移动端和部署路径足够可靠。

### 第二阶段：从页面集合变成可使用的群组产品

接下来，重点转向成员和组长每天如何使用产品。前端逐步形成移动优先的应用外壳，包括底部导航、侧栏、抽屉和情境化操作（[#25](https://github.com/appccalc-developers/Alife/issues/25)、[#30](https://github.com/appccalc-developers/Alife/issues/30)）。

群组详情从静态资料页转成以群组网页为中心的内容入口，并把组长工具放入独立管理情境（[#29](https://github.com/appccalc-developers/Alife/issues/29)、[#38](https://github.com/appccalc-developers/Alife/issues/38)、[#47](https://github.com/appccalc-developers/Alife/issues/47)）。

这一步的产品判断是：普通成员主要想“看内容、参加活动”，组长才需要“管理成员和内容”。将阅读和管理分开，比把所有功能堆在同一页面更符合真实角色。

### 第三阶段：把性能和媒体能力做成架构，而不是补丁

随着内容和列表增加，性能问题不能继续由单个页面各自处理。我先整理 PWA service worker 和条件请求（[#53](https://github.com/appccalc-developers/Alife/issues/53)、[#56](https://github.com/appccalc-developers/Alife/issues/56)、[#58](https://github.com/appccalc-developers/Alife/issues/58)），随后增加 Cloudflare 智能代理、Cache API、被动失效和独立图片 Worker（[#61](https://github.com/appccalc-developers/Alife/issues/61)、[#62](https://github.com/appccalc-developers/Alife/issues/62)）。

边缘层后来进一步被重构为垂直切片和中间件管线（[#207](https://github.com/appccalc-developers/Alife/issues/207)），再从前端项目中解耦成独立包和 CI/CD 单元（[#209](https://github.com/appccalc-developers/Alife/issues/209)、[#212](https://github.com/appccalc-developers/Alife/issues/212)）。

更重要的是，这套缓存不是“全部公开缓存”。项目逐步明确公开、群组共享、成员专属和浏览器本地数据的边界，并在共享缓存读取前检查授权（[#133](https://github.com/appccalc-developers/Alife/issues/133)、[#143](https://github.com/appccalc-developers/Alife/issues/143)、[#147](https://github.com/appccalc-developers/Alife/issues/147)、[#225](https://github.com/appccalc-developers/Alife/issues/225)）。

这体现了我不仅会优化响应时间，也能处理缓存带来的权限泄漏、新鲜度和失效复杂度。

### 第四阶段：建立完整的活动生命周期，并让 AI 进入可控工作流

活动功能从领域实体和 CRUD 开始（[#81](https://github.com/appccalc-developers/Alife/issues/81)、[#85](https://github.com/appccalc-developers/Alife/issues/85)），随后覆盖组长编辑、成员报名、付款材料、活动复盘和多次评论（[#83](https://github.com/appccalc-developers/Alife/issues/83)、[#84](https://github.com/appccalc-developers/Alife/issues/84)、[#172](https://github.com/appccalc-developers/Alife/issues/172)、[#174](https://github.com/appccalc-developers/Alife/issues/174)、[#242](https://github.com/appccalc-developers/Alife/issues/242)）。

AI 没有被做成一个孤立聊天框。共享 AI session 基础设施使用 Cloudflare Durable Objects 保存临时对话状态，用户确认后才通过后端 API 持久化业务记录（[#109](https://github.com/appccalc-developers/Alife/issues/109)、[#111](https://github.com/appccalc-developers/Alife/issues/111)）。

后期，活动功能进一步加入双语 RAM（Risk Assessment and Management）草稿、风险评分、负责人确认和审核者批准（[#565](https://github.com/appccalc-developers/Alife/issues/565)、[#567](https://github.com/appccalc-developers/Alife/issues/567)）。AI 被明确禁止编造负责人、电话、急救资格、驾照、车牌、WOF 或车辆状况等安全事实；未批准的活动不能开放报名。

这说明我能把 AI 放入真实业务约束中：它负责降低认知负担，人负责真实性、责任和最终决定。

### 第五阶段：让非技术同工能够维护双语内容

页面功能最初只是结构化 section，后来逐步形成真正的 WYSIWYG 页面构建器：统一渲染和编辑（[#117](https://github.com/appccalc-developers/Alife/issues/117)）、双语数据结构（[#127](https://github.com/appccalc-developers/Alife/issues/127)、[#135](https://github.com/appccalc-developers/Alife/issues/135)）、简化 section 模型和兼容旧数据（[#194](https://github.com/appccalc-developers/Alife/issues/194)、[#199](https://github.com/appccalc-developers/Alife/issues/199)），以及手动或数据绑定的 Spotlight（[#201](https://github.com/appccalc-developers/Alife/issues/201)）。

之后的迭代并非继续增加更多 section，而是降低编辑成本：

- 用统一的 section type 和数据源默认值简化添加流程（[#399](https://github.com/appccalc-developers/Alife/issues/399)）；
- 加入 TinyMCE、R2 图片和视频选择器（[#401](https://github.com/appccalc-developers/Alife/issues/401)、[#486](https://github.com/appccalc-developers/Alife/issues/486)）；
- 在 AI 翻译失败时仍允许保存，避免辅助功能阻断核心工作（[#403](https://github.com/appccalc-developers/Alife/issues/403)）；
- 检测错误的双语结构和语言放错字段（[#480](https://github.com/appccalc-developers/Alife/issues/480)）；
- 加入离开前提醒、自动保存和更直接的 section 编辑路径（[#478](https://github.com/appccalc-developers/Alife/issues/478)、[#527](https://github.com/appccalc-developers/Alife/issues/527)）。

这一阶段最能说明我在做产品而不只是做 CMS：目标用户是非技术的组长，所以成功标准是“他们能理解、敢操作、不会轻易丢内容或破坏双语结构”。

### 第六阶段：从群组内部工具成长为有治理能力的公开网站

当群组页面开始面向公众，系统需要的不只是 `Public=true`，还需要内容治理。项目先加入平台角色、权限、管理 API 和管理后台（[#363](https://github.com/appccalc-developers/Alife/issues/363)、[#371](https://github.com/appccalc-developers/Alife/issues/371)、[#375](https://github.com/appccalc-developers/Alife/issues/375)、[#419](https://github.com/appccalc-developers/Alife/issues/419)）。

公开页面发布流程随后经历多轮收敛：从全局页面和审核队列（[#369](https://github.com/appccalc-developers/Alife/issues/369)、[#405](https://github.com/appccalc-developers/Alife/issues/405)），发展到页面仍归原群组所有、审核记录独立保存、可退回并给出理由（[#443](https://github.com/appccalc-developers/Alife/issues/443)、[#454](https://github.com/appccalc-developers/Alife/issues/454)），最终取消容易造成双重所有权的全局页面模型（[#457](https://github.com/appccalc-developers/Alife/issues/457)）。

审核后的页面被组织成可配置的双语主菜单、二级菜单和首页内容投放（[#508](https://github.com/appccalc-developers/Alife/issues/508)、[#512](https://github.com/appccalc-developers/Alife/issues/512)、[#516](https://github.com/appccalc-developers/Alife/issues/516)）。公开内容即使来自 protected group，也只投射审核通过的公开页面，不会暴露成员内容（[#518](https://github.com/appccalc-developers/Alife/issues/518)）。

这段历史展示了一个重要能力：我能够承认早期模型不够好，用迁移和兼容策略修正所有权与审核模型，而不是为了“架构一致”让用户继续承担错误复杂度。

### 第七阶段：补齐真正社区产品需要的内容和协作能力

在平台框架稳定后，Alife 开始覆盖更完整的教会生活场景：

- 会员申请、邀请、角色管理和通知中心（[#255](https://github.com/appccalc-developers/Alife/issues/255)、[#257](https://github.com/appccalc-developers/Alife/issues/257)、[#261](https://github.com/appccalc-developers/Alife/issues/261)、[#267](https://github.com/appccalc-developers/Alife/issues/267)）；
- 全站论坛、讲道讨论和游客公开浏览（[#447](https://github.com/appccalc-developers/Alife/issues/447)、[#467](https://github.com/appccalc-developers/Alife/issues/467)）；
- 双语 YouVersion 圣经阅读与跨设备进度（[#488](https://github.com/appccalc-developers/Alife/issues/488)）；
- 有受众、状态、优先级和有效期的公告（[#492](https://github.com/appccalc-developers/Alife/issues/492)）；
- 嵌套相册和受权限保护的媒体（[#498](https://github.com/appccalc-developers/Alife/issues/498)）；
- 群组联系人、活动联系人和咨询通知（[#504](https://github.com/appccalc-developers/Alife/issues/504)）；
- 历史文章归档、可重复导入和公开索引（[#531](https://github.com/appccalc-developers/Alife/issues/531)、[#533](https://github.com/appccalc-developers/Alife/issues/533)）；
- 旧网站 About Us 内容迁入新的页面构建器（[#541](https://github.com/appccalc-developers/Alife/issues/541)）。

这些功能不是彼此孤立的菜单项。它们复用了相同的群组所有权、双语字段、可见性、审核、媒体和缓存规则，说明产品已经从“功能集合”成长为可扩展的平台。

### 第八阶段：进入 Alpha 产品的可靠性和可运营阶段

后期大量 issues 不再是新功能，而是处理真实系统才会出现的问题：

- 生产 HTML 与静态资源缓存新鲜度、会员资料权限和手机号规范（[#496](https://github.com/appccalc-developers/Alife/issues/496)）；
- 公开文章来源 URL 的隐私边界（[#539](https://github.com/appccalc-developers/Alife/issues/539)）；
- DbMigrator 的生产迁移和依赖注入失败（[#385](https://github.com/appccalc-developers/Alife/issues/385)、[#545](https://github.com/appccalc-developers/Alife/issues/545)）；
- 已安装 PWA 在刘海屏和 Home Indicator 上的 safe-area 问题（[#547](https://github.com/appccalc-developers/Alife/issues/547)）；
- 讲道分页缓存键冲突和跨 Cloudflare PoP 全局失效（[#549](https://github.com/appccalc-developers/Alife/issues/549)）；
- 公开页面的 L1 Cache API、L2 KV 和预热（[#553](https://github.com/appccalc-developers/Alife/issues/553)）；
- 权限控制的缓存诊断工具和诚实的讲道字幕空状态（[#573](https://github.com/appccalc-developers/Alife/issues/573)）。

与此同时，项目补上 Terraform、架构文档、本地一键启动和按组件拆分的 CI/CD（[#309](https://github.com/appccalc-developers/Alife/issues/309)、[#311](https://github.com/appccalc-developers/Alife/issues/311)、[#351](https://github.com/appccalc-developers/Alife/issues/351)）。

这表明我不仅能启动产品，也愿意承担把它变得可诊断、可部署、可交接和可继续演进的工作。

## 三个最能证明产品能力的案例

### 1. 页面构建器：从“能编辑”到“同工能安全发布”

这个功能横跨数据模型、API、WYSIWYG 编辑、双语验证、媒体库、自动保存、发布审核、菜单配置、公开缓存和旧内容迁移。真正的成果不是增加了多少 section，而是把“组长写内容—审核者检查—访客看到网站”变成了一条可以理解和治理的完整链路。

它证明我能：

- 从用户任务设计流程，而不是从数据库表设计界面；
- 在简化模型时保留旧页面兼容；
- 处理作者、审核者和访客三种不同角色；
- 把双语、媒体、权限和缓存作为产品的一部分，而不是事后补丁。

### 2. 多层缓存：把性能、成本和隐私放在同一个设计里

Alife 的缓存经历了 service worker、ETag、IndexedDB、后端 HybridCache、Cloudflare Cache API、授权镜像和全局 KV 的逐步演进。期间也出现过分页缓存键冲突、304 CORS、权限检查顺序和跨 PoP 失效问题。

我没有通过关闭缓存来回避复杂度，而是按数据性质区分：

- 公开内容可以跨用户、跨边缘节点共享；
- 群组内容只能在确认授权后共享；
- 会员资料必须按用户隔离；
- 浏览器 API 缓存不能在身份切换后重放旧的私有数据。

这证明我能对线上问题做根因分析，并把修复沉淀成架构规则和回归测试。

### 3. AI 活动工作流：让 AI 有用，同时保留人的责任

活动 AI 从辅助生成描述，发展到策划、报名、复盘、海报/旧 PDF 读取、双语活动通知和 RAM 风险评估。系统保留临时会话、可编辑草稿、缺失信息标记、组长确认和审核者批准。

最关键的产品决定是：AI 不自动发布，也不能编造安全事实。未批准的 RAM 会阻止报名。这使 AI 从展示性功能变成了能进入真实流程、但不会越过责任边界的助手。

## 这些 issues 证明了什么

| 能力 | 可观察证据 |
|---|---|
| 从模糊问题定义产品 | 把分散的群组、内容、活动和沟通需求整理成访客、成员、组长、审核者和管理员的角色流程 |
| 端到端交付 | 多个 issue 同时覆盖实体、迁移、API、授权、前端、边缘缓存、测试和部署 |
| 迭代而非固守第一版 | LINE 取代 SMS、全局页面被群组所有权模型取代、page section 持续收敛、缓存按工作负载重新分层 |
| 用户体验判断 | 移动优先、safe area、WYSIWYG、媒体选择器、自动保存、离开提醒、清晰的空状态和双语文案 |
| 安全与隐私意识 | HttpOnly Cookie、后端角色校验、共享缓存前授权、公开 DTO 投影、私有来源 URL 隐藏 |
| AI 产品判断 | 人工确认、可编辑草稿、不可编造事实、审核门槛、AI 失败不阻断核心保存流程 |
| 可运营与可维护性 | Terraform、独立 CI/CD、本地启动脚本、架构文档、缓存诊断、迁移器和回归测试 |

## 回头看：做得好的地方

1. **始终围绕真实角色。** 功能不是抽象的“内容管理”，而是明确谁创建、谁审核、谁可见、谁负责。
2. **愿意修正错误抽象。** 页面所有权、缓存后端、语言偏好和 section 模型都根据实际问题调整过。
3. **把非功能需求当成功能。** 权限、缓存新鲜度、PWA safe area、迁移和诊断直接影响用户是否信任产品。
4. **AI 始终服务于流程。** 它降低输入和翻译负担，但不替代业务授权或人的责任。
5. **保持可追溯。** issue、验收条件、验证命令和架构文档让每次迭代可以解释、复查和继续。

## 如果重新开始，我会更早做的事

1. **更早建立产品指标。** 当前 issues 很好地证明了交付范围，但还不能证明活跃用户、任务完成率、内容发布周期或留存改善。
2. **更早加入端到端测试。** 后端、Worker 和构建验证已经较完整，但登录、入组、页面发布和活动报名仍需要稳定的浏览器级回归测试。
3. **更早定义页面发布领域模型。** 全局页面到群组所有权的迁移是正确修正，但如果更早明确作者、所有者、审核状态和公开投影，可以减少中间重构。
4. **更早建立可观测性。** 缓存诊断在后期才加入；日志、追踪和关键业务事件应在 Alpha 初期成为统一设计。
5. **控制迭代密度。** 高频 issue 让产品快速成长，也会提高回归风险。后续应把更多精力放在真实用户反馈、稳定性窗口和小批量发布。

## 当前边界和下一步

当前仍开放的两条 issues 是：

- [#420 Visitor contact requests](https://github.com/appccalc-developers/Alife/issues/420)：让公开网站访客可以提交联系请求，并由后台跟踪状态；
- [#421 File asset management](https://github.com/appccalc-developers/Alife/issues/421)：建立正式的文件资产、存储提供者、签名 URL、访问控制和回填能力。

对下一阶段而言，最有价值的工作不是继续增加菜单，而是：

1. 选择一至两个真实教会小组完成结构化 Alpha 试用；
2. 测量组长完成建页、发布公告和建立活动所需的时间与失败点；
3. 增加关键旅程的端到端测试与业务事件遥测；
4. 完成访客联系和文件资产两个平台缺口；
5. 用真实使用数据决定 Beta 范围。

## 面试中的一分钟版本

> 我从海外华人教会内容和群组管理分散的问题出发，在约一百天内把 Alife 从基础 API 和 PWA 建成了一个可用的 Alpha 社区平台。它现在覆盖 LINE 登录、群组和成员管理、双语页面构建与发布审核、讲道、活动报名与复盘、论坛、公告、相册、联系人、历史内容迁移，以及 AI 辅助的活动策划和 RAM 风险评估。
>
> 这个项目最能证明我的，不是 271 条 issues，而是我能把一个真实工作流跨越 React、.NET、SQL、Azure Functions、Cloudflare Workers、R2、Durable Objects 和多层缓存完整落地。我也在开发中推翻过不合适的第一版，例如取消全局页面所有权、重新划分缓存层，并把 AI 放在人工确认和授权之后。现在它已经具备 Alpha 产品需要的权限、内容治理、运维和可演进性；下一步是用真实用户指标验证 Beta。

## 证据使用说明

这份材料适合作为作品集和面试叙事，但应保持以下表述边界：

- 可以说“我建立并迭代了一个具备完整工作流的 Alpha 产品”；
- 可以说“269 条关闭 issues 证明了工作范围和可追溯性”；
- 在没有分析 PR、部署记录和用户数据前，不应把 issue 关闭时间当作实际开发耗时；
- 在没有活跃用户、任务完成率和留存数据前，不应声称已经验证市场成功；
- 如果部分工作由他人或 AI 协作完成，应在面试中准确说明自己的产品决策、架构责任、实现范围和审核方式。
