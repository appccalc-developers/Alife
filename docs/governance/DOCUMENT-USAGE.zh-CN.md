# Docs 文件用途与待确认历史清单

审查日期：2026-10-10。原有 196 个文件，保留 97 个（其中 1 个仅在指定源版本中），移入待确认区 99 个；另有 3 个新增审计文件和 1 个审查后新增文件。

“Alife”列表示继续推进现有项目时仍有作用；“新 Church App”列表示生成、验证或交接新系统时仍有作用。保留可以是规则、运维、用户手册、生成工具或仍采用的参考；不等于每次任务都要读取。历史证据可按需要调查，但不会授予当前需求或开发权威。

状态与全部原路径/现路径/引用/原因在 [机器清单](document-register.json) 中；待确认资料位于 [准备历史归档区](../../archive/pending-docs-review/2026-10-10/README.md)。尚未删除任何文件，也未永久确认归档。移动后的历史原件字节保持不变，原有相对链接须结合机器清单中的原路径定位。

## 判断依据与注意事项

- 以 AGENTS、架构、领域契约和当前依赖为准；没有引用不等于没有用途。
- 现行 Event 视觉规范仍采用的试点图片、说明 HTML、原型、模板及生成/验证工具保留。
- 虚拟教会计划只存在于指定源版本和独立 PR #827，当前 main 没有该文档或对应功能；以固定提交链接保留来源，不复制为 main 的现行契约，不自动恢复旧 V3 任务。
- FileAsset 设计仍保留供归整，其早期现状描述不能覆盖已存在的 FileAsset/私有文件实现。
- Azure 新实例清单保留；Vue/Pinia、Next.js、旧 Static Web Apps 和 PostgreSQL 迁移提示移入待确认区。
- Communication/VibeCoding 原为 Git 忽略的本地材料，移动后仍忽略；清单不公开其正文、凭据或诊断数据。
- 待确认历史原件使用仓库 .gitattributes 的 -text 规则，避免 Git 暂存或签出时转换换行并破坏原始哈希。
- 旧 Issue follow-up、原始业务愿景与当前契约是否有遗漏，由 DOCS-RECONCILE 核对；不将候选自动视为已授权任务。

## 原目录汇总

| 原目录 | 原有文件 | 保留 | 待确认历史 |
| --- | ---: | ---: | ---: |
| docs | 37 | 19 | 18 |
| docs/Communication | 17 | 0 | 17 |
| docs/Communication/pictures/6-9 | 23 | 0 | 23 |
| docs/VibeCoding | 16 | 0 | 16 |
| docs/VibeCoding/Deployment | 2 | 0 | 2 |
| docs/VibeCoding/Setup | 7 | 0 | 7 |
| docs/agent-guides | 1 | 1 | 0 |
| docs/assets/event-duties | 2 | 2 | 0 |
| docs/assets/portfolio | 6 | 0 | 6 |
| docs/codex | 1 | 0 | 1 |
| docs/design | 4 | 4 | 0 |
| docs/design/generated | 7 | 7 | 0 |
| docs/design/prototypes | 1 | 1 | 0 |
| docs/design/scripts | 2 | 2 | 0 |
| docs/events | 19 | 15 | 4 |
| docs/events/design | 5 | 5 | 0 |
| docs/events/design/references/preparation-pilot | 14 | 14 | 0 |
| docs/events/generated | 1 | 1 | 0 |
| docs/events/modules | 12 | 12 | 0 |
| docs/events/scripts | 2 | 2 | 0 |
| docs/events/templates | 1 | 1 | 0 |
| docs/governance | 2 | 2 | 0 |
| docs/issues | 5 | 0 | 5 |
| docs/pages | 2 | 2 | 0 |
| docs/workspaces | 7 | 7 | 0 |

## docs

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [alife-internal-trial-call.zh-CN.md](../../archive/pending-docs-review/2026-10-10/docs/alife-internal-trial-call.zh-CN.md) | 否 | 否 | 待确认历史 | 试用动员、作品集或技术讲解的展示材料/语言风格副本；当前指导入口为架构、领域契约、QA 和用户说明书。 |
| [alife-ministry-guide.en.md](../alife-ministry-guide.en.md) | 是 | 是 | 保留 | 现有使用/内容编制与新 Church App 用户手册的基础；身份说明与当前 Passkey 主路径对齐，细节仍服从领域契约。 |
| [alife-ministry-guide.zh-CN.md](../alife-ministry-guide.zh-CN.md) | 是 | 是 | 保留 | 现有使用/内容编制与新 Church App 用户手册的基础；身份说明与当前 Passkey 主路径对齐，细节仍服从领域契约。 |
| [alife-portfolio-case-study.en.md](../../archive/pending-docs-review/2026-10-10/docs/alife-portfolio-case-study.en.md) | 否 | 否 | 待确认历史 | 试用动员、作品集或技术讲解的展示材料/语言风格副本；当前指导入口为架构、领域契约、QA 和用户说明书。 |
| [alife-portfolio-case-study.zh-CN.md](../../archive/pending-docs-review/2026-10-10/docs/alife-portfolio-case-study.zh-CN.md) | 否 | 否 | 待确认历史 | 试用动员、作品集或技术讲解的展示材料/语言风格副本；当前指导入口为架构、领域契约、QA 和用户说明书。 |
| [alife-tech-slices.academic.en.md](../../archive/pending-docs-review/2026-10-10/docs/alife-tech-slices.academic.en.md) | 否 | 否 | 待确认历史 | 试用动员、作品集或技术讲解的展示材料/语言风格副本；当前指导入口为架构、领域契约、QA 和用户说明书。 |
| [alife-tech-slices.en.md](../../archive/pending-docs-review/2026-10-10/docs/alife-tech-slices.en.md) | 否 | 否 | 待确认历史 | 试用动员、作品集或技术讲解的展示材料/语言风格副本；当前指导入口为架构、领域契约、QA 和用户说明书。 |
| [alife-tech-slices.natural.en.md](../../archive/pending-docs-review/2026-10-10/docs/alife-tech-slices.natural.en.md) | 否 | 否 | 待确认历史 | 试用动员、作品集或技术讲解的展示材料/语言风格副本；当前指导入口为架构、领域契约、QA 和用户说明书。 |
| [alife-tech-slices.zh-CN.docx](../../archive/pending-docs-review/2026-10-10/docs/alife-tech-slices.zh-CN.docx) | 否 | 否 | 待确认历史 | 试用动员、作品集或技术讲解的展示材料/语言风格副本；当前指导入口为架构、领域契约、QA 和用户说明书。 |
| [alife-tech-slices.zh-CN.md](../../archive/pending-docs-review/2026-10-10/docs/alife-tech-slices.zh-CN.md) | 否 | 否 | 待确认历史 | 试用动员、作品集或技术讲解的展示材料/语言风格副本；当前指导入口为架构、领域契约、QA 和用户说明书。 |
| [architecture.md](../architecture.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [backend_architecture.md](../backend_architecture.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [cache-coordination.md](../cache-coordination.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [church-life-site.md](../church-life-site.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [design-documentation-plan.zh-CN.md](../../archive/pending-docs-review/2026-10-10/docs/design-documentation-plan.zh-CN.md) | 否 | 否 | 待确认历史 | 设计文档建设的原实施方案；已交付结构由 design/README、QA、COVERAGE 管理，遗留来源/覆盖缺口仍在 COVERAGE 中保留。 |
| [file-asset-design.md](../file-asset-design.md) | 是 | 是 | 保留 | 包含文件归属/可见性/兼容设计，仍与新系统有关；现状段落早于 FileAsset 实现，已标记为设计参考，须对照当前源码归整，不能当作现状事实。 |
| [frontend_architecture.md](../frontend_architecture.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [group-dissolution.md](../group-dissolution.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [group-life-site.md](../group-life-site.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [group-types.md](../group-types.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [identity-access.md](../identity-access.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [member-private-file-backfill.md](../member-private-file-backfill.md) | 是 | 否 | 保留 | 现有 Alife 私有文件兼容与修复操作说明仍需保留；空白新实例不默认执行旧对象回填。 |
| [plan-alifeAudience2-engineeringDevOps.prompt.md](../../archive/pending-docs-review/2026-10-10/docs/plan-alifeAudience2-engineeringDevOps.prompt.md) | 否 | 否 | 待确认历史 | 不同听众的旧规划提示稿，包含旧 frontend 路径/旧阶段口径；当前目标与推进顺序由治理台账承担。 |
| [plan-alifeAudience3-steeringCommittee.prompt.md](../../archive/pending-docs-review/2026-10-10/docs/plan-alifeAudience3-steeringCommittee.prompt.md) | 否 | 否 | 待确认历史 | 不同听众的旧规划提示稿，包含旧 frontend 路径/旧阶段口径；当前目标与推进顺序由治理台账承担。 |
| [plan-alifeDeploymentArchitectureAndFeatures.prompt.md](../../archive/pending-docs-review/2026-10-10/docs/plan-alifeDeploymentArchitectureAndFeatures.prompt.md) | 否 | 否 | 待确认历史 | 不同听众的旧规划提示稿，包含旧 frontend 路径/旧阶段口径；当前目标与推进顺序由治理台账承担。 |
| [plan-alifeExecutiveReview.prompt.md](../../archive/pending-docs-review/2026-10-10/docs/plan-alifeExecutiveReview.prompt.md) | 否 | 否 | 待确认历史 | 不同听众的旧规划提示稿，包含旧 frontend 路径/旧阶段口径；当前目标与推进顺序由治理台账承担。 |
| [plan-alifeImplementationTracking.prompt.md](../../archive/pending-docs-review/2026-10-10/docs/plan-alifeImplementationTracking.prompt.md) | 否 | 否 | 待确认历史 | 不同听众的旧规划提示稿，包含旧 frontend 路径/旧阶段口径；当前目标与推进顺序由治理台账承担。 |
| [plan-newAzureSubscriptionSetup.prompt.md](../plan-newAzureSubscriptionSetup.prompt.md) | 是 | 是 | 保留 | 新 Church App 的 Azure 路线所需独立资源、OIDC、配置及验收清单；更新旧路径，不据此自动创建资源/迁移/部署。 |
| [project-development-timeline.md](../../archive/pending-docs-review/2026-10-10/docs/project-development-timeline.md) | 否 | 否 | 待确认历史 | 有日期的项目时间线、回溯和历史证据；移入待确认区，仍可由明确的历史调查引用，但不作为当前任务或架构指令。 |
| [project-retrospective-verification.md](../../archive/pending-docs-review/2026-10-10/docs/project-retrospective-verification.md) | 否 | 否 | 待确认历史 | 有日期的项目时间线、回溯和历史证据；移入待确认区，仍可由明确的历史调查引用，但不作为当前任务或架构指令。 |
| [project-retrospective.en.md](../../archive/pending-docs-review/2026-10-10/docs/project-retrospective.en.md) | 否 | 否 | 待确认历史 | 有日期的项目时间线、回溯和历史证据；移入待确认区，仍可由明确的历史调查引用，但不作为当前任务或架构指令。 |
| [project-retrospective.zh-CN.md](../../archive/pending-docs-review/2026-10-10/docs/project-retrospective.zh-CN.md) | 否 | 否 | 待确认历史 | 有日期的项目时间线、回溯和历史证据；移入待确认区，仍可由明确的历史调查引用，但不作为当前任务或架构指令。 |
| [pwa.md](../pwa.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [sermon-metadata.md](../sermon-metadata.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [speed-layer_architecture.md](../speed-layer_architecture.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [sunday-bulletins.md](../sunday-bulletins.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [virtual-church-visual-upgrade-plan.zh-CN.md](https://github.com/appccalc-developers/Alife/blob/4416e4de6a01aee0d43446a1b7c1ee7dafcfcd31/docs/virtual-church-visual-upgrade-plan.zh-CN.md) | 是 | 是 | 保留源版本引用 | 仅存在于固定源版本和独立 PR #827，当前 main 无对应文档或运行功能；保留可追溯来源，不能作为 main 的现行契约或交付证据。 |

## docs/Communication

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [Alife App 核心价值分析.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/Alife%20App%20%E6%A0%B8%E5%BF%83%E4%BB%B7%E5%80%BC%E5%88%86%E6%9E%90.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [Alife 内部试用动员文案.pdf](../../archive/pending-docs-review/2026-10-10/docs/Communication/Alife%20%E5%86%85%E9%83%A8%E8%AF%95%E7%94%A8%E5%8A%A8%E5%91%98%E6%96%87%E6%A1%88.pdf) | 否 | 否 | 待确认历史 | 内部试用沟通文案的 PDF；保留原件供确认，不作为功能或上线验收依据。 |
| [Alife 在整体愿景中的角色.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/Alife%20%E5%9C%A8%E6%95%B4%E4%BD%93%E6%84%BF%E6%99%AF%E4%B8%AD%E7%9A%84%E8%A7%92%E8%89%B2.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [Alife 影像文档分享系1.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/Alife%20%E5%BD%B1%E5%83%8F%E6%96%87%E6%A1%A3%E5%88%86%E4%BA%AB%E7%B3%BB1.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [Alife 影像文档分享系统.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/Alife%20%E5%BD%B1%E5%83%8F%E6%96%87%E6%A1%A3%E5%88%86%E4%BA%AB%E7%B3%BB%E7%BB%9F.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [Alife 教会应用程序.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/Alife%20%E6%95%99%E4%BC%9A%E5%BA%94%E7%94%A8%E7%A8%8B%E5%BA%8F.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [Alife_Technical_Slices_v2.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/Alife_Technical_Slices_v2.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [alife-app-src-program-files-explanation.md](../../archive/pending-docs-review/2026-10-10/docs/Communication/alife-app-src-program-files-explanation.md) | 否 | 否 | 待确认历史 | 早期设计提案、源码讲解或面试展示；现行架构与契约已承担相关指导职责。 |
| [ALIFE-DESIGN-PROPOSAL-CN.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/ALIFE-DESIGN-PROPOSAL-CN.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [ALIFE-DESIGN-PROPOSAL-CN.md](../../archive/pending-docs-review/2026-10-10/docs/Communication/ALIFE-DESIGN-PROPOSAL-CN.md) | 否 | 否 | 待确认历史 | 早期设计提案、源码讲解或面试展示；现行架构与契约已承担相关指导职责。 |
| [ALIFE-DESIGN-PROPOSAL.md](../../archive/pending-docs-review/2026-10-10/docs/Communication/ALIFE-DESIGN-PROPOSAL.md) | 否 | 否 | 待确认历史 | 早期设计提案、源码讲解或面试展示；现行架构与契约已承担相关指导职责。 |
| [Alife-Proposal-EN.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/Alife-Proposal-EN.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [Alife-Proposal-TW.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/Alife-Proposal-TW.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [For interviews.md](../../archive/pending-docs-review/2026-10-10/docs/Communication/For%20interviews.md) | 否 | 否 | 待确认历史 | 早期设计提案、源码讲解或面试展示；现行架构与契约已承担相关指导职责。 |
| [Stephen 对官网愿景的正式回复.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/Stephen%20%E5%AF%B9%E5%AE%98%E7%BD%91%E6%84%BF%E6%99%AF%E7%9A%84%E6%AD%A3%E5%BC%8F%E5%9B%9E%E5%A4%8D.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [This is a strategic move.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/This%20is%20a%20strategic%20move.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |
| [分工与生态集成版.docx](../../archive/pending-docs-review/2026-10-10/docs/Communication/%E5%88%86%E5%B7%A5%E4%B8%8E%E7%94%9F%E6%80%81%E9%9B%86%E6%88%90%E7%89%88.docx) | 否 | 否 | 待确认历史 | 早期愿景、提案或沟通导览；当前开发规则由架构、领域契约与治理入口承担。原始业务意图如有未映射项，须经 DOCS-RECONCILE 核对后再采纳。 |

## docs/Communication/pictures/6-9

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [Image_20260608230240_87_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230240_87_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230242_88_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230242_88_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230250_89_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230250_89_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230259_91_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230259_91_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230306_92_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230306_92_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230310_93_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230310_93_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230312_94_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230312_94_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230313_95_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230313_95_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230315_96_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230315_96_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230316_97_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230316_97_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230318_98_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230318_98_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230320_99_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230320_99_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230321_100_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230321_100_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230323_101_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230323_101_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230324_102_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230324_102_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230332_103_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230332_103_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230335_104_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230335_104_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230336_105_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230336_105_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230338_106_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230338_106_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230339_107_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230339_107_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230341_108_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230341_108_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230342_109_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230342_109_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |
| [Image_20260608230343_110_28.jpg](../../archive/pending-docs-review/2026-10-10/docs/Communication/pictures/6-9/Image_20260608230343_110_28.jpg) | 否 | 否 | 待确认历史 | 早期沟通资料配套截图；没有现行设计文档采用它们。 |

## docs/VibeCoding

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [53 Implementation.md](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/53%20Implementation.md) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [azure-static-web-apps-polite-grass-0af321b00.yml](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/azure-static-web-apps-polite-grass-0af321b00.yml) | 否 | 否 | 待确认历史 | 旧 Azure/OIDC/Static Web Apps 设置稿，含旧项目/资源上下文；新实例使用保留的 Azure 配置清单并重新核实。 |
| [Codex Prompt.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Codex%20Prompt.txt) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [copilot-instructions.md](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/copilot-instructions.md) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [devtools_why_we_can_t_see_etag_in_header_and_how_to_add_it.md](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/devtools_why_we_can_t_see_etag_in_header_and_how_to_add_it.md) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [Implement Resilient PWA Sync Engine (Push + Edge Signaling) #53.md](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Implement%20Resilient%20PWA%20Sync%20Engine%20%28Push%20%2B%20Edge%20Signaling%29%20%2353.md) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [issue-group-pages-navigation-refactor.md](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/issue-group-pages-navigation-refactor.md) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [issue-group-tools-drawer-concise-actions.md](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/issue-group-tools-drawer-concise-actions.md) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [issue-group-tools-sidebar-scrollbar.md](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/issue-group-tools-sidebar-scrollbar.md) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [MIGRATION_NEXTJS.md](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/MIGRATION_NEXTJS.md) | 否 | 否 | 待确认历史 | Vue/Pinia、Next.js 或早期 UI 生成路线与现行 React/Vite/TanStack 架构不一致；不能再作为创建新系统的执行指令。 |
| [New Text Document.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/New%20Text%20Document.txt) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [new ticket.md](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/new%20ticket.md) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [Result.json](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Result.json) | 否 | 否 | 待确认历史 | 本地诊断响应或临时查询材料；保留原件且保持 Git 忽略，不能作为业务契约或种子数据。 |
| [SELECT TOP (1000) G.sql](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/SELECT%20TOP%20%281000%29%20G.sql) | 否 | 否 | 待确认历史 | 本地诊断响应或临时查询材料；保留原件且保持 Git 忽略，不能作为业务契约或种子数据。 |
| [setup-github-oidc.ps1](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/setup-github-oidc.ps1) | 否 | 否 | 待确认历史 | 旧 Azure/OIDC/Static Web Apps 设置稿，含旧项目/资源上下文；新实例使用保留的 Azure 配置清单并重新核实。 |
| [Step 5 --- UI.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Step%205%20---%20UI.txt) | 否 | 否 | 待确认历史 | Vue/Pinia、Next.js 或早期 UI 生成路线与现行 React/Vite/TanStack 架构不一致；不能再作为创建新系统的执行指令。 |

## docs/VibeCoding/Deployment

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [OIDC.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Deployment/OIDC.txt) | 否 | 否 | 待确认历史 | 旧 Azure/OIDC/Static Web Apps 设置稿，含旧项目/资源上下文；新实例使用保留的 Azure 配置清单并重新核实。 |
| [Setup for Azure.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Deployment/Setup%20for%20Azure.txt) | 否 | 否 | 待确认历史 | 旧 Azure/OIDC/Static Web Apps 设置稿，含旧项目/资源上下文；新实例使用保留的 Azure 配置清单并重新核实。 |

## docs/VibeCoding/Setup

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [Script 1 — Generate top-level UI architecture.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Setup/Script%201%20%E2%80%94%20Generate%20top-level%20UI%20architecture.txt) | 否 | 否 | 待确认历史 | Vue/Pinia、Next.js 或早期 UI 生成路线与现行 React/Vite/TanStack 架构不一致；不能再作为创建新系统的执行指令。 |
| [Script 11 - PWA](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Setup/Script%2011%20-%20PWA) | 否 | 否 | 待确认历史 | Vue/Pinia、Next.js 或早期 UI 生成路线与现行 React/Vite/TanStack 架构不一致；不能再作为创建新系统的执行指令。 |
| [Script 2 — Generate group detail  leaderco-leader management UX.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Setup/Script%202%20%E2%80%94%20Generate%20group%20detail%20%20leaderco-leader%20management%20UX.txt) | 否 | 否 | 待确认历史 | Vue/Pinia、Next.js 或早期 UI 生成路线与现行 React/Vite/TanStack 架构不一致；不能再作为创建新系统的执行指令。 |
| [Script 3 — Generate a page editor with section editing configuration.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Setup/Script%203%20%E2%80%94%20Generate%20a%20page%20editor%20with%20section%20editing%20configuration.txt) | 否 | 否 | 待确认历史 | Vue/Pinia、Next.js 或早期 UI 生成路线与现行 React/Vite/TanStack 架构不一致；不能再作为创建新系统的执行指令。 |
| [Script 4 — Generate shared frontend contracts, stores, and services.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Setup/Script%204%20%E2%80%94%20Generate%20shared%20frontend%20contracts%2C%20stores%2C%20and%20services.txt) | 否 | 否 | 待确认历史 | Vue/Pinia、Next.js 或早期 UI 生成路线与现行 React/Vite/TanStack 架构不一致；不能再作为创建新系统的执行指令。 |
| [Script 5 --- Generate Church Administrator Design Report.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Setup/Script%205%20---%20Generate%20Church%20Administrator%20Design%20Report.txt) | 否 | 否 | 待确认历史 | 旧提示词、任务完成说明、旧指令副本、零字节草稿或排错对话；由现行 AGENTS、PWA/缓存契约和治理台账替代。 |
| [Script 6 -- Move from SQL Server to PostgresQL.txt](../../archive/pending-docs-review/2026-10-10/docs/VibeCoding/Setup/Script%206%20--%20Move%20from%20SQL%20Server%20to%20PostgresQL.txt) | 否 | 否 | 待确认历史 | SQL Server→PostgreSQL 的旧迁移提示；不是已选择的 Azure SQL 或 Workers/D1 新系统路线。 |

## docs/agent-guides

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [GITHUB-WORKFLOW.md](../agent-guides/GITHUB-WORKFLOW.md) | 是 | 是 | 保留 | Alife 发布操作规则；新项目可按授权适配，不复制仓库身份或授予权限。 |

## docs/assets/event-duties

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [en-1280.png](../assets/event-duties/en-1280.png) | 是 | 是 | 保留 | Event duties 的当前说明截图依赖；保留文档说明/交接用途。 |
| [zh-320.png](../assets/event-duties/zh-320.png) | 是 | 是 | 保留 | Event duties 的当前说明截图依赖；保留文档说明/交接用途。 |

## docs/assets/portfolio

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [alife-ai-event-assistant.png](../../archive/pending-docs-review/2026-10-10/docs/assets/portfolio/alife-ai-event-assistant.png) | 否 | 否 | 待确认历史 | 作品集文章配套截图；随文章保留历史价值，没有当前 UI 规范依赖。 |
| [alife-page-editor.png](../../archive/pending-docs-review/2026-10-10/docs/assets/portfolio/alife-page-editor.png) | 否 | 否 | 待确认历史 | 作品集文章配套截图；随文章保留历史价值，没有当前 UI 规范依赖。 |
| [alife-platform-workspace.png](../../archive/pending-docs-review/2026-10-10/docs/assets/portfolio/alife-platform-workspace.png) | 否 | 否 | 待确认历史 | 作品集文章配套截图；随文章保留历史价值，没有当前 UI 规范依赖。 |
| [alife-public-home.png](../../archive/pending-docs-review/2026-10-10/docs/assets/portfolio/alife-public-home.png) | 否 | 否 | 待确认历史 | 作品集文章配套截图；随文章保留历史价值，没有当前 UI 规范依赖。 |
| [alife-ram-workflow.png](../../archive/pending-docs-review/2026-10-10/docs/assets/portfolio/alife-ram-workflow.png) | 否 | 否 | 待确认历史 | 作品集文章配套截图；随文章保留历史价值，没有当前 UI 规范依赖。 |
| [alife-website-builder.png](../../archive/pending-docs-review/2026-10-10/docs/assets/portfolio/alife-website-builder.png) | 否 | 否 | 待确认历史 | 作品集文章配套截图；随文章保留历史价值，没有当前 UI 规范依赖。 |

## docs/codex

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [page-builder-v2.md](../../archive/pending-docs-review/2026-10-10/docs/codex/page-builder-v2.md) | 否 | 否 | 待确认历史 | Page 旧生成提案；现行 PAGE-CONTRACT 与页面入口已明确它不是待执行任务。 |

## docs/design

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [COVERAGE.md](../design/COVERAGE.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [QA.md](../design/QA.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [README.md](../design/README.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [UI-UX.md](../design/UI-UX.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |

## docs/design/generated

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [architecture.html](../design/generated/architecture.html) | 是 | 是 | 保留 | 仍由现行权威文档/JSON 生成、链接和校验；保留人类说明用途，不能取代规则或证明交付。 |
| [church.html](../design/generated/church.html) | 是 | 是 | 保留 | 仍由现行权威文档/JSON 生成、链接和校验；保留人类说明用途，不能取代规则或证明交付。 |
| [group.html](../design/generated/group.html) | 是 | 是 | 保留 | 仍由现行权威文档/JSON 生成、链接和校验；保留人类说明用途，不能取代规则或证明交付。 |
| [identity.html](../design/generated/identity.html) | 是 | 是 | 保留 | 仍由现行权威文档/JSON 生成、链接和校验；保留人类说明用途，不能取代规则或证明交付。 |
| [management.html](../design/generated/management.html) | 是 | 是 | 保留 | 仍由现行权威文档/JSON 生成、链接和校验；保留人类说明用途，不能取代规则或证明交付。 |
| [pages.html](../design/generated/pages.html) | 是 | 是 | 保留 | 仍由现行权威文档/JSON 生成、链接和校验；保留人类说明用途，不能取代规则或证明交付。 |
| [personal.html](../design/generated/personal.html) | 是 | 是 | 保留 | 仍由现行权威文档/JSON 生成、链接和校验；保留人类说明用途，不能取代规则或证明交付。 |

## docs/design/prototypes

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [review.html](../design/prototypes/review.html) | 是 | 是 | 保留 | 当前设计入口与验证脚本使用的限定模拟原型；仅用于解释和体验检查。 |

## docs/design/scripts

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [generate-design-presentations.mjs](../design/scripts/generate-design-presentations.mjs) | 是 | 是 | 保留 | 现行文档生成、链接/新鲜度校验或原型检查工具。 |
| [verify-prototype.cjs](../design/scripts/verify-prototype.cjs) | 是 | 是 | 保留 | 现行文档生成、链接/新鲜度校验或原型检查工具。 |

## docs/events

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [AGENTS.md](../events/AGENTS.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [AI-DETAILS-ASSISTANT.md](../events/AI-DETAILS-ASSISTANT.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [CREATION-ARRANGEMENTS.md](../events/CREATION-ARRANGEMENTS.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [DESIGN-PROVENANCE.md](../events/DESIGN-PROVENANCE.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EVENT-AUTHORIZATION-REVIEW-2026-09-22.md](../../archive/pending-docs-review/2026-10-10/docs/events/EVENT-AUTHORIZATION-REVIEW-2026-09-22.md) | 否 | 否 | 待确认历史 | 旧实施记录、权限审计、执行方案或某次验证报告；当前业务规则/缺口由 Event 核心、主题、机器契约和状态维护。历史证据仍可按明确链接查阅。 |
| [EVENT-COMPOSITION.md](../events/EVENT-COMPOSITION.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [event-contract.json](../events/event-contract.json) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EVENT-CONTRACT.md](../events/EVENT-CONTRACT.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EVENT-DUTIES.md](../events/EVENT-DUTIES.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EVENT-PACKAGE-APPROVAL-EXECUTION-GOAL.zh-CN.md](../../archive/pending-docs-review/2026-10-10/docs/events/EVENT-PACKAGE-APPROVAL-EXECUTION-GOAL.zh-CN.md) | 否 | 否 | 待确认历史 | 旧实施记录、权限审计、执行方案或某次验证报告；当前业务规则/缺口由 Event 核心、主题、机器契约和状态维护。历史证据仍可按明确链接查阅。 |
| [EVENT-PACKAGE-APPROVAL.md](../events/EVENT-PACKAGE-APPROVAL.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EVENT-SETUP-FLOW.md](../events/EVENT-SETUP-FLOW.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EVENT-WORKSPACES.md](../events/EVENT-WORKSPACES.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EventManagement-About.html](../events/EventManagement-About.html) | 是 | 是 | 保留 | 仍由现行权威文档/JSON 生成、链接和校验；保留人类说明用途，不能取代规则或证明交付。 |
| [IMPLEMENTATION-HISTORY.md](../../archive/pending-docs-review/2026-10-10/docs/events/IMPLEMENTATION-HISTORY.md) | 否 | 否 | 待确认历史 | 旧实施记录、权限审计、执行方案或某次验证报告；当前业务规则/缺口由 Event 核心、主题、机器契约和状态维护。历史证据仍可按明确链接查阅。 |
| [IMPLEMENTATION-STATUS.md](../events/IMPLEMENTATION-STATUS.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [POLICY-EDITOR-VERIFICATION.md](../../archive/pending-docs-review/2026-10-10/docs/events/POLICY-EDITOR-VERIFICATION.md) | 否 | 否 | 待确认历史 | 旧实施记录、权限审计、执行方案或某次验证报告；当前业务规则/缺口由 Event 核心、主题、机器契约和状态维护。历史证据仍可按明确链接查阅。 |
| [RAM-INITIALIZATION.md](../events/RAM-INITIALIZATION.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [README.md](../events/README.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |

## docs/events/design

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [EVENT-PREPARATION-EDITORIAL.md](../events/design/EVENT-PREPARATION-EDITORIAL.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EVENT-UI-CHEATSHEET.md](../events/design/EVENT-UI-CHEATSHEET.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EVENT-UI-REFERENCE-PAGES.md](../events/design/EVENT-UI-REFERENCE-PAGES.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EVENT-UI-VISUAL-TOKENS.md](../events/design/EVENT-UI-VISUAL-TOKENS.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [EVENT-WORKSPACE-DESIGN.md](../events/design/EVENT-WORKSPACE-DESIGN.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |

## docs/events/design/event-creation-cards

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [DESIGN.md](../events/design/event-creation-cards/DESIGN.md) | 是 | 是 | 保留 | 用户请求的创建能力卡片展开/缩回设计目标；保留业务、草稿、双语与可访问边界，尚未实现动画。 |

## docs/events/design/references/preparation-pilot

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [assistant-en-1280.png](../events/design/references/preparation-pilot/assistant-en-1280.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [assistant-en-320.png](../events/design/references/preparation-pilot/assistant-en-320.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [assistant-zh-1280.png](../events/design/references/preparation-pilot/assistant-zh-1280.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [assistant-zh-320.png](../events/design/references/preparation-pilot/assistant-zh-320.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [form-en-1280.png](../events/design/references/preparation-pilot/form-en-1280.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [form-en-320.png](../events/design/references/preparation-pilot/form-en-320.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [form-zh-1280.png](../events/design/references/preparation-pilot/form-zh-1280.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [form-zh-320.png](../events/design/references/preparation-pilot/form-zh-320.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [overview-en-1280.png](../events/design/references/preparation-pilot/overview-en-1280.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [overview-en-320.png](../events/design/references/preparation-pilot/overview-en-320.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [overview-zh-1280.png](../events/design/references/preparation-pilot/overview-zh-1280.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [overview-zh-320.png](../events/design/references/preparation-pilot/overview-zh-320.png) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [README.md](../events/design/references/preparation-pilot/README.md) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |
| [source-manifest.json](../events/design/references/preparation-pilot/source-manifest.json) | 是 | 是 | 保留 | 现行 Event 创建/details 设计仍采用的限定试点参考、截图或来源清单；不证明当前 saved overview 或全面验收。 |

## docs/events/generated

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [alife-event-composition-model.zh-TW-en.html](../events/generated/alife-event-composition-model.zh-TW-en.html) | 是 | 是 | 保留 | 仍由现行权威文档/JSON 生成、链接和校验；保留人类说明用途，不能取代规则或证明交付。 |

## docs/events/modules

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [COMMS.FOLLOWUP.md](../events/modules/COMMS.FOLLOWUP.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [FESTIVAL.OPERATIONS.md](../events/modules/FESTIVAL.OPERATIONS.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [FOOD.HOSPITALITY.md](../events/modules/FOOD.HOSPITALITY.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [MONEY.FINANCE.md](../events/modules/MONEY.FINANCE.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [MOVE.STAY.md](../events/modules/MOVE.STAY.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [PEOPLE.REGISTRATION.md](../events/modules/PEOPLE.REGISTRATION.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [PLACE.RESOURCE.md](../events/modules/PLACE.RESOURCE.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [PROGRAM.PRODUCTION.md](../events/modules/PROGRAM.PRODUCTION.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [SAFEGUARDING.CHILD.md](../events/modules/SAFEGUARDING.CHILD.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [SAFETY.RAM.md](../events/modules/SAFETY.RAM.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [SERVICE.ROSTER.md](../events/modules/SERVICE.ROSTER.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [TEAM.WORK.md](../events/modules/TEAM.WORK.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |

## docs/events/scripts

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [generate-event-docs.mjs](../events/scripts/generate-event-docs.mjs) | 是 | 是 | 保留 | 现行文档生成、链接/新鲜度校验或原型检查工具。 |
| [generate-event-docs.test.mjs](../events/scripts/generate-event-docs.test.mjs) | 是 | 是 | 保留 | 现行文档生成、链接/新鲜度校验或原型检查工具。 |

## docs/events/templates

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [alife-event-composition-model.zh-TW-en.template.html](../events/templates/alife-event-composition-model.zh-TW-en.template.html) | 是 | 是 | 保留 | 现行 Event HTML 生成器模板输入；删除会破坏生成与校验。 |

## docs/governance

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [document-register.json](document-register.json) | 是 | 是 | 保留 | 本次逐文件审计、待确认记录和可重复检查。 |
| [DOCUMENT-USAGE.zh-CN.md](DOCUMENT-USAGE.zh-CN.md) | 是 | 是 | 保留 | 本次逐文件审计、待确认记录和可重复检查。 |
| [README.md](README.md) | 是 | 是 | 保留 | 项目目标、工作台账、验收和后续推进的当前治理来源。 |
| [work-register.json](work-register.json) | 是 | 是 | 保留 | 项目目标、工作台账、验收和后续推进的当前治理来源。 |

## docs/governance/scripts

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [audit-document-usage.mjs](scripts/audit-document-usage.mjs) | 是 | 是 | 保留 | 本次逐文件审计、待确认记录和可重复检查。 |

## docs/issues

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [create-epic-issues.yml](../../archive/pending-docs-review/2026-10-10/docs/issues/create-epic-issues.yml) | 否 | 否 | 待确认历史 | 已落地 AI 会话/报名改造的旧 Issue 草稿和已禁用的一次性工作流；follow-up 候选进入 DOCS-RECONCILE 核对，不能自动重建旧任务。 |
| [issue-A-epic-ai-enrollment-rework.md](../../archive/pending-docs-review/2026-10-10/docs/issues/issue-A-epic-ai-enrollment-rework.md) | 否 | 否 | 待确认历史 | 已落地 AI 会话/报名改造的旧 Issue 草稿和已禁用的一次性工作流；follow-up 候选进入 DOCS-RECONCILE 核对，不能自动重建旧任务。 |
| [issue-B-ai-session-facility.md](../../archive/pending-docs-review/2026-10-10/docs/issues/issue-B-ai-session-facility.md) | 否 | 否 | 待确认历史 | 已落地 AI 会话/报名改造的旧 Issue 草稿和已禁用的一次性工作流；follow-up 候选进入 DOCS-RECONCILE 核对，不能自动重建旧任务。 |
| [issue-C-enrollment-chat-dialog.md](../../archive/pending-docs-review/2026-10-10/docs/issues/issue-C-enrollment-chat-dialog.md) | 否 | 否 | 待确认历史 | 已落地 AI 会话/报名改造的旧 Issue 草稿和已禁用的一次性工作流；follow-up 候选进入 DOCS-RECONCILE 核对，不能自动重建旧任务。 |
| [issue-D-migrate-event-creator-to-facility.md](../../archive/pending-docs-review/2026-10-10/docs/issues/issue-D-migrate-event-creator-to-facility.md) | 否 | 否 | 待确认历史 | 已落地 AI 会话/报名改造的旧 Issue 草稿和已禁用的一次性工作流；follow-up 候选进入 DOCS-RECONCILE 核对，不能自动重建旧任务。 |

## docs/pages

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [PAGE-CONTRACT.md](../pages/PAGE-CONTRACT.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [README.md](../pages/README.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |

## docs/workspaces

| 文件 | Alife | 新 Church App | 处理 | 依据 |
| --- | --- | --- | --- | --- |
| [CHURCH.md](../workspaces/CHURCH.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [GROUP.md](../workspaces/GROUP.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [IDENTITY.md](../workspaces/IDENTITY.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [MANAGEMENT.md](../workspaces/MANAGEMENT.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [OPERATION-MATRIX.md](../workspaces/OPERATION-MATRIX.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [PERSONAL.md](../workspaces/PERSONAL.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
| [README.md](../workspaces/README.md) | 是 | 是 | 保留 | 现行架构、领域契约、状态、运维或设计入口；Alife 继续交付与功能等价的新 Church App 均需要。 |
