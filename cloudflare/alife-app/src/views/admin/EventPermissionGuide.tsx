import { Link } from 'react-router-dom'

export default function EventPermissionGuide({ zh, onFilter }: { zh: boolean; onFilter: () => void }) {
  const rows = zh ? [
    ['平台角色', '独立 RAM 审核、增强级活动审批、赞助、政策和模板管理，由下方具体权限项控制。角色名称本身不代表权限。'],
    ['小组负责人 / 协同负责人', '负责所属小组管理与符合政策的审批。小组管理身份不自动成为某场活动的总负责人或模块负责人。'],
    ['活动总负责人', '负责整体方案、人员职责、报名规则、报告采纳；仅总负责人可提交正式审批，发布仍需明确操作。审批冻结后先申请重开。'],
    ['活动模块负责人 / 协作者', '在活动内被邀请并接受职责后，处理获授权的模块或任务。查看完整方案不等于能查看儿童、财务或报名材料。'],
    ['审批人 / 限时受委派人', '按治理等级、当前政策、有效范围和期限确定；标准及增强级审批不得由提交人自批。委派不授予活动编辑权。'],
  ] : [
    ['Platform role', 'Independent RAM review, enhanced approval, sponsorship, policy and template management use specific permissions below. A role name alone grants nothing.'],
    ['Group leader / co-leader', 'Manages the owning group and policy-eligible approval. Group leadership does not automatically make someone an event owner or module lead.'],
    ['Accountable event owner', 'Responsible for the plan, responsibilities, rules and report adoption. Only the owner submits formal approval; publication remains explicit. Frozen preparation requires reopening.'],
    ['Module lead / collaborator', 'Accepts an event-scoped invitation and handles authorized modules or tasks. Full-plan access does not grant child, finance or participant-material access.'],
    ['Approver / temporary delegate', 'Determined by governance tier, current policy, scope and expiry. Standard/enhanced submitters cannot self-approve. Delegation grants no event editing authority.'],
  ]
  return <details className="rounded-2xl border border-[#d9dfd7] bg-[#fffdf8] p-4">
    <summary className="min-h-10 cursor-pointer text-sm font-bold text-[#18332d]">{zh ? '活动功能：角色、权限和职责在哪里设置？' : 'Events: where are roles, permissions and responsibilities configured?'}</summary>
    <dl className="mt-3 divide-y divide-[#d9dfd7]">{rows.map(([title, description]) => <div key={title} className="grid gap-1 py-3 md:grid-cols-[12rem_minmax(0,1fr)]"><dt className="text-sm font-semibold text-[#18332d]">{title}</dt><dd className="text-sm leading-6 text-[#596a63]">{description}</dd></div>)}</dl>
    <p className="mt-2 text-xs leading-5 text-[#596a63]">{zh ? '在活动工作台的“人员与职责”设置活动角色；“正式审批”内设置政策允许的限时委派。普通任务审核、RAM 审核、活动审批和发布互不替代。实际可操作范围以服务端实时校验为准。' : 'Configure event roles in People and responsibilities, and policy-enabled temporary delegation in Formal approval. Task review, RAM review, package approval and publication are separate. The server rechecks current authority for each action.'}</p>
    <p className="mt-2 text-xs leading-5 text-[#596a63]">{zh ? '小组负责人不自动取得撤回审批包的权限。活动总负责人或资源协调人可预订场地，但管理共享场地目录需要该场地管理小组的管理权限。' : 'Group leadership alone grants no package withdrawal. Event owners or resource coordinators may reserve venues; shared catalogue editing requires administration of the venue’s managing group.'}</p>
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" onClick={onFilter} className="min-h-11 rounded-xl border border-[#176b5a] px-3 text-sm font-semibold text-[#176b5a]">{zh ? '筛选活动权限' : 'Filter event permissions'}</button>
      <Link to="/event-work" className="inline-flex min-h-11 items-center rounded-xl border border-[#d9dfd7] px-3 text-sm text-[#176b5a]">{zh ? '打开我的活动工作台' : 'Open my event workspaces'}</Link>
    </div>
  </details>
}
