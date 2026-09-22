import { useId } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import type { EventLifecycle, EventPackage, EventPackageActorCapabilities } from '../../types/eventPackage'
import { gateLabel, gateStateLabel, groupGateIssues, knownPreparationArea, preparationAreaLabel } from '../../utils/eventActionGuidance'

export default function EventGateChecklist({ lifecycle, current, capabilities, zh, canManage, busy, onEdit, onFocus }: {
  lifecycle: EventLifecycle; current?: EventPackage; capabilities: EventPackageActorCapabilities | null
  zh: boolean; canManage: boolean; busy: boolean
  onEdit: (module?: string) => void; onFocus: (target: 'actions' | 'decision' | 'conditions' | 'evidence', scopeId?: string | null) => void
}) {
  const id = useId(), issues = groupGateIssues(lifecycle.gates)
  const gaps = current?.manifest.modules.filter(module => module.blockers.length > 0) ?? []
  return <section className="space-y-3" aria-label={zh ? '下一步与待处理事项' : 'Next actions and outstanding items'}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{zh ? '接下来做什么' : 'What to do next'}</h3><span className="text-xs text-[#596a63]">{zh ? '检查满足 ≠ 已批准 ≠ 已发布' : 'Ready ≠ approved ≠ published'}</span></div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{lifecycle.gates.map(gate => <div key={gate.gate} className="rounded-xl border border-[#dce5e0] bg-white p-3"><strong className="block text-sm">{gateLabel(gate.gate, zh)}</strong><span className={`mt-1 block text-xs ${!gate.allowed ? 'text-amber-900' : 'text-[#40554e]'}`}>{gateStateLabel(gate, zh)}</span></div>)}</div>
    {lifecycle.gates.some(gate => gate.enforcementMode === 'dryRun') ? <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-950">{zh ? '试运行只提示新规则下的缺项，不代表活动已获批准或可以发布。实际操作仍受权限及其他检查约束。' : 'Trial checks highlight missing requirements; they do not grant approval or permission to publish. Permissions and other checks still apply.'}</p> : null}
    {gaps.length ? <p className="text-xs text-[#596a63]">{zh ? '缺项来自当前审批快照；修改并保存后，请生成新版本重新检查。' : 'Gaps come from the current approval snapshot. After saving changes, generate a new version to recheck.'}</p> : null}
    <ul className="divide-y divide-[#dce5e0] rounded-xl border border-[#dce5e0] bg-[#fffdf8]">{issues.map(issue => {
      const action = issue.blocker.nextAction
      const approval = action === 'event.package.decide'
      const readiness = action === 'event.readiness.review'
      const matchingGaps = current && current.scopeType === issue.scopeType && (current.scopeId ?? null) === (issue.scopeId ?? null) && current.version === issue.packageVersion ? gaps : []
      const unavailable = action === 'event.payment.unavailable'
      const conditions = action.startsWith('event.package.condition.')
      const pending = approval && current?.status === 'submitted' && !capabilities?.canDecide
      const title = approval ? (zh ? (pending ? '等待审批人处理' : '完成活动方案审批') : pending ? 'Awaiting an approver' : 'Complete event approval') : readiness ? (zh ? '补齐筹备事项' : 'Complete preparation requirements') : unavailable ? (zh ? '此收款能力尚未开放' : 'This payment capability is unavailable') : issue.blocker.message[zh ? 'zh' : 'en'] || issue.blocker.message.en || issue.blocker.message.zh
      const owner = approval ? (capabilities?.canDecide ? (zh ? '你可以审批' : 'You can review') : current?.status === 'submitted' ? (zh ? '由符合权限的审批人处理' : 'For an authorised approver') : (zh ? '由活动负责人准备并提交' : 'For the event owner to prepare and submit')) : readiness ? (zh ? '由相关领域负责人补齐；可能需要独立审核' : 'For the relevant area lead; independent review may be required') : conditions ? (zh ? '由条件负责人补充材料，审批人核验' : 'Evidence from the condition owner; verification by an approver') : (zh ? '按当前权限处理' : 'Subject to your current permissions')
      return <li key={issue.key} className="space-y-2 p-3 sm:p-4"><div className="flex flex-wrap items-start justify-between gap-2"><strong className="text-sm">{title}</strong><AppBadge variant="neutral">{issue.warningsOnly ? (zh ? '提示 · ' : 'Advisory · ') : ''}{issue.gates.map(gate => gateLabel(gate, zh)).join(' / ')}</AppBadge></div><p className="text-xs text-[#596a63]">{owner}{issue.scopeType === 'occurrence' ? (zh ? ' · 针对单个场次' : ' · For one occurrence') : ''}</p>
        {readiness && matchingGaps.length ? <ul className="space-y-2">{matchingGaps.map(module => <li key={module.moduleCode} className="rounded-lg bg-white p-3"><strong className="text-sm">{preparationAreaLabel(module.moduleCode, zh)}</strong><ul className="mt-1 space-y-1 text-sm text-[#40554e]">{module.blockers.map((item, index) => <li key={index}>{item[zh ? 'zh' : 'en'] || item.en || item.zh}</li>)}</ul>{canManage && knownPreparationArea(module.moduleCode) ? <AppActionButton className="mt-2" size="sm" disabled={busy} onClick={() => onEdit(module.moduleCode)}>{zh ? '前往处理：' : 'Open: '}{preparationAreaLabel(module.moduleCode, zh)}</AppActionButton> : null}</li>)}</ul> : null}
        {unavailable ? <p className="text-sm">{zh ? '不是漏填设置，也不能通过委派审批来开启此能力。' : 'This is not a missing setting; approval delegation cannot enable it.'}</p> : pending ? <p className="text-sm">{zh ? '已提交的资料需要审批人作出决定；无需创建审批委派来完成这一步。' : 'An approver needs to decide on the submitted material. Creating a delegation is not a required step.'}</p> : <AppActionButton size="sm" disabled={busy} onClick={() => readiness ? canManage ? onEdit() : onFocus('evidence') : onFocus(conditions ? 'conditions' : approval && capabilities?.canDecide ? 'decision' : 'actions', issue.scopeId)}>{readiness ? (zh ? '查看筹备与缺项' : 'Review preparation gaps') : conditions ? (zh ? '查看审批条件' : 'Review approval conditions') : approval && capabilities?.canDecide ? (zh ? '前往审批' : 'Review and decide') : (zh ? '查看审批操作' : 'Review approval actions')}</AppActionButton>}
      </li>
    })}</ul>
    {!issues.length ? <p className="text-sm text-[#40554e]">{zh ? '当前检查没有返回待处理项；提交、批准、发布和开放报名仍需分别确认。' : 'No outstanding items were returned. Submission, approval, publication and registration opening still require separate actions.'}</p> : null}
    <details className="text-xs text-[#596a63]"><summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">{zh ? '查看技术诊断（供排查使用）' : 'Technical diagnostics (for support)'}</summary><div id={id} className="space-y-3 break-all rounded-xl bg-[#f4f8f6] p-3">{lifecycle.gates.map(gate => <div key={gate.gate}><strong>{gateLabel(gate.gate, zh)}</strong><p>{gate.enforcementMode} · Package {gate.eventPackageVersion ?? '—'} · Policy {gate.governancePolicyVersion ?? '—'}</p>{[...gate.blockers, ...gate.warnings].map((item, index) => <p key={index}>{item.code} · {item.responsibleRole} · {item.nextAction}</p>)}</div>)}</div></details>
  </section>
}
