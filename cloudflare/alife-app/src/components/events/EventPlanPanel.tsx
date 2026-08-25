import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowRight, Bot, Building2, CalendarClock, CheckCircle2, ChevronDown,
  ClipboardCheck, ClipboardList, FileText, Link2, Megaphone, ShieldCheck, UserCheck, UsersRound, WalletCards,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { eventPlanService } from '../../services/eventPlanService'
import { normalizeApiError } from '../../services/http'
import type { EventModuleStatus, EventPlanApprovalItem, EventPlanMilestoneCheck, EventPlanModule, EventReadinessGate } from '../../types/eventPlan'
import AppBadge from '../layout/AppBadge'

type Props = { eventId: string; eventBasePath: string; editPath: string; language: string }
type ModulePresentation = {
  name: { en: string; zh: string }
  description: { en: string; zh: string }
  action: { en: string; zh: string }
  href: (paths: Pick<Props, 'eventBasePath' | 'editPath'>) => string
  icon: ComponentType<{ className?: string }>
  approval?: {
    question: { en: string; zh: string }
    reviewer: { en: string; zh: string }
    reviewerEntry: { en: string; zh: string }
    evidence: { en: string; zh: string }[]
    effect: { en: string; zh: string }
  }
}

const modulesCopy: Record<string, ModulePresentation> = {
  core: {
    name: { en: 'Event facts', zh: '活动资料' },
    description: { en: 'Confirm the purpose, audience, dates, contacts and visibility used by every other module.', zh: '确认活动目的、对象、日期、联系人和可见范围，其他准备工作都会使用这些资料。' },
    action: { en: 'Review event details', zh: '检查活动资料' }, href: ({ editPath }) => editPath, icon: FileText,
  },
  communications: {
    name: { en: 'Activity notice', zh: '活动通知' },
    description: { en: 'Confirm the bilingual activity notice. Use the poster tool separately when this event needs a poster.', zh: '确认双语活动通知；需要海报时再单独使用海报工具，两项内容分别处理。' },
    action: { en: 'Edit activity notice', zh: '完善活动通知' }, href: ({ editPath }) => `${editPath}?step=notice`, icon: Megaphone,
  },
  venue: {
    name: { en: 'Venue request', zh: '场地申请' },
    description: { en: 'Choose a maintained church venue, submit the request, and wait for a venue owner to approve it.', zh: '从教会已维护的场地中选择，提交申请，并等待场地负责人审批。' },
    action: { en: 'Manage venue request', zh: '办理场地申请' }, href: ({ eventBasePath }) => `${eventBasePath}/venue-request`, icon: Building2,
    approval: {
      question: { en: 'Can the selected space be reserved for this time, attendance and purpose?', zh: '所选空间在这个时段、人数和用途下是否可以预留？' },
      reviewer: { en: 'A venue reviewer with booking-review permission who did not submit the request.', zh: '具备场地申请审批权限、且不是申请人的场地负责人。' },
      reviewerEntry: { en: 'Church management → Venue request review', zh: '教会管理 → 场地申请审批' },
      evidence: [
        { en: 'Venue and space', zh: '场地与具体空间' }, { en: 'Start and end time', zh: '开始和结束时间' },
        { en: 'Expected attendance and purpose', zh: '预计人数和用途' }, { en: 'Server conflict check', zh: '系统冲突检查结果' },
      ],
      effect: { en: 'Approval reserves the space and satisfies venue readiness. A rejection returns the request for correction.', zh: '批准后预留空间并满足场地准备条件；退回后由申请人修改并重新提交。' },
    },
  },
  registration: {
    name: { en: 'Registration', zh: '报名设置' },
    description: { en: 'Confirm capacity, registration deadline, eligibility and participant information.', zh: '确认人数上限、报名截止时间、报名对象和需要收集的资料。' },
    action: { en: 'Open registration workspace', zh: '打开报名工作区' }, href: ({ eventBasePath }) => `${eventBasePath}/registration`, icon: UsersRound,
  },
  finance: {
    name: { en: 'Fees and payments', zh: '费用与收款' },
    description: { en: 'Confirm fees, optional items, payment instructions and who may see payment evidence.', zh: '确认费用、可选项目、付款说明，以及谁可以查看付款凭证。' },
    action: { en: 'Open finance workspace', zh: '打开费用工作区' }, href: ({ eventBasePath }) => `${eventBasePath}/finance`, icon: WalletCards,
  },
  ram: {
    name: { en: 'Risk assessment', zh: '风险评估' },
    description: { en: 'Prepare the RAM, submit it for review, and wait for an authorized person to approve it.', zh: '整理风险和应对措施，提交审核，并等待有权限的人员批准。' },
    action: { en: 'Open RAM', zh: '打开风险评估' }, href: ({ editPath }) => `${editPath}?step=ram`, icon: ShieldCheck,
    approval: {
      question: { en: 'Are the identified risks and controls sufficient for this event to proceed?', zh: '本次活动识别出的风险和控制措施是否足以支持活动举办？' },
      reviewer: { en: 'A person with event-audit permission who did not submit this RAM.', zh: '具备活动审计权限、且不是本次 RAM 提交人的人员。' },
      reviewerEntry: { en: 'Current event → Edit event → Risk assessment', zh: '当前活动 → 编辑活动 → 风险评估' },
      evidence: [
        { en: 'Hazards and risk ratings', zh: '风险事项与风险等级' }, { en: 'Control measures and responsible people', zh: '控制措施与明确负责人' },
        { en: 'Emergency contacts and arrangements', zh: '紧急联系人和应急安排' }, { en: 'Leader confirmation of all facts', zh: '负责人对全部事实的人工确认' },
      ],
      effect: { en: 'Approval satisfies the RAM readiness condition. Material event or RAM changes invalidate the decision and require resubmission.', zh: '批准后满足风险准备条件；活动或 RAM 的实质变化会让原决定失效，并要求重新提交。' },
    },
  },
  roster: {
    name: { en: 'Volunteer roster', zh: '同工排班' },
    description: { en: 'Create the roles and shifts, compare member availability and capability labels, then confirm each person.', zh: '建立岗位和班次，比较成员的时间限制与能力标签，再由负责人逐项确认。' },
    action: { en: 'Open roster', zh: '打开排班工作区' }, href: ({ eventBasePath }) => `${eventBasePath}/roster`, icon: UsersRound,
  },
  programme: {
    name: { en: 'Programme and handover', zh: '程序单与岗位交接' },
    description: { en: 'Build one event-day timeline, link existing roster shifts, and confirm owners and operational handovers.', zh: '编排一张当天时间轴，关联已有排班岗位，并确认负责人和现场交接说明。' },
    action: { en: 'Open programme', zh: '打开程序单' }, href: ({ eventBasePath }) => `${eventBasePath}/programme`, icon: ClipboardList,
  },
  closure: {
    name: { en: 'Closure and learning', zh: '结项与经验' },
    description: { en: 'Summarize verified outcomes, confirm follow-up, and choose learning that may guide future events.', zh: '汇总已经核实的结果和跟进事项，并选择可以供往期参考的经验。' },
    action: { en: 'Open closure report', zh: '打开活动总结' }, href: ({ eventBasePath }) => `${eventBasePath}/closure`, icon: ClipboardCheck,
  },
  tasks: {
    name: { en: 'Preparation tasks', zh: '筹备任务' },
    description: { en: 'Assign clear work, due dates and prerequisites so each person can see the next actionable step.', zh: '明确分配任务、截止时间和前置条件，让每个人都能看到自己下一步该做什么。' },
    action: { en: 'Open task board', zh: '打开任务看板' }, href: ({ eventBasePath }) => `${eventBasePath}/tasks`, icon: ClipboardCheck,
  },
}

const fallbackCopy = (key: string): ModulePresentation => ({
  name: { en: key, zh: key }, description: { en: 'Complete this preparation module.', zh: '完成这个筹备模块所需的资料。' },
  action: { en: 'Open event editor', zh: '打开活动编辑' }, href: ({ editPath }) => editPath, icon: ClipboardCheck,
})
const statusCopy: Record<EventModuleStatus, { en: string; zh: string }> = {
  notConfigured: { en: 'Not started', zh: '尚未开始' }, configuring: { en: 'In progress', zh: '正在办理' },
  ready: { en: 'Ready', zh: '已经就绪' }, blocked: { en: 'Needs attention', zh: '需要处理' }, completed: { en: 'Completed', zh: '已经完成' },
}
const moduleOrder = ['core', 'venue', 'registration', 'finance', 'ram', 'roster', 'programme', 'tasks', 'communications', 'closure']
const isReady = (status: EventModuleStatus) => status === 'ready' || status === 'completed'
const localize = (value: { en: string; zh: string }, chinese: boolean) => (chinese ? value.zh : value.en) || value.en || value.zh

const approvalStatusCopy: Record<EventPlanApprovalItem['status'], { en: string; zh: string }> = {
  notStarted: { en: 'Not started', zh: '尚未发起' },
  draft: { en: 'Draft not submitted', zh: '草稿未提交' },
  requested: { en: 'Waiting for decision', zh: '等待审批' },
  approved: { en: 'Approved', zh: '已批准' },
  returned: { en: 'Returned for changes', zh: '已退回修改' },
  rejected: { en: 'Rejected', zh: '已拒绝' },
  cancelled: { en: 'No longer valid', zh: '已经失效' },
}

const approvalTone = (status: EventPlanApprovalItem['status']) => status === 'approved'
  ? 'bg-emerald-100 text-emerald-800'
  : status === 'requested'
    ? 'bg-amber-100 text-amber-800'
    : status === 'returned' || status === 'rejected' || status === 'cancelled'
      ? 'bg-rose-100 text-rose-800'
      : 'bg-slate-100 text-slate-700'

const milestoneStatusCopy = {
  ready: { en: 'Ready', zh: '已满足' },
  pending: { en: 'Not ready', zh: '尚未满足' },
  blocked: { en: 'Blocked', zh: '存在阻塞' },
  notApplicable: { en: 'Not used', zh: '本次不使用' },
} as const

const ApprovalDetails = ({
  moduleName,
  actionHref,
  actionLabel,
  policy,
  items,
  chinese,
}: {
  moduleName: string
  actionHref: string
  actionLabel: string
  policy: NonNullable<ModulePresentation['approval']>
  items: EventPlanApprovalItem[]
  chinese: boolean
}) => {
  const primaryStatus = items.find((item) => item.status === 'requested')?.status
    ?? items.find((item) => item.status === 'returned' || item.status === 'rejected' || item.status === 'cancelled')?.status
    ?? (items.length && items.every((item) => item.status === 'approved') ? 'approved' : items[0]?.status)
    ?? 'notStarted'
  const formatDate = (value: string) => new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

  return <details className="group border-b border-[#2f4b42]/10 last:border-b-0">
    <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 marker:hidden sm:px-5">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <span className="min-w-0 flex-1"><span className="block text-xs font-black text-amber-950">{moduleName} · {chinese ? '需要人工决定' : 'Human decision required'}</span><span className="mt-1 block text-xs leading-5 text-amber-900/80">{localize(policy.question, chinese)}</span></span>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${approvalTone(primaryStatus)}`}>{localize(approvalStatusCopy[primaryStatus], chinese)}</span>
      <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[#71827b] transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="border-t border-[#2f4b42]/10 bg-[#fbfaf7] px-4 py-5 sm:px-5">
      <dl className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="font-black text-[#18332d]">{chinese ? '谁来决定' : 'Who decides'}</dt><dd className="mt-1 leading-5 text-[#687a73]">{localize(policy.reviewer, chinese)}</dd></div>
        <div><dt className="font-black text-[#18332d]">{chinese ? '审批人从哪里进入' : 'Where the reviewer goes'}</dt><dd className="mt-1 leading-5 text-[#687a73]">{localize(policy.reviewerEntry, chinese)}</dd></div>
        <div><dt className="font-black text-[#18332d]">{chinese ? '提交前要有' : 'Required evidence'}</dt><dd className="mt-1"><ul className="space-y-1 text-[#687a73]">{policy.evidence.map((item) => <li key={item.en}>· {localize(item, chinese)}</li>)}</ul></dd></div>
        <div><dt className="font-black text-[#18332d]">{chinese ? '决定会影响什么' : 'What the decision changes'}</dt><dd className="mt-1 leading-5 text-[#687a73]">{localize(policy.effect, chinese)}</dd></div>
      </dl>
      {items.length ? <div className="mt-4 divide-y divide-[#2f4b42]/10 border-y border-[#2f4b42]/10">{items.map((item, index) => {
        const requester = item.requestedByDisplayName || (chinese ? '活动负责人' : 'event leader')
        const reviewer = item.decidedByDisplayName || (chinese ? '审批人' : 'reviewer')
        return <div key={item.referenceId || `${item.key}-${index}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-black text-[#18332d]">{localize(item.subject, chinese) || localize(policy.question, chinese)}</p><p className="mt-1 text-[11px] leading-5 text-[#71827b]">{item.status === 'notStarted' ? (chinese ? '负责人还没有建立申请。' : 'The leader has not created a request yet.') : item.status === 'draft' ? (chinese ? '申请已经保存为草稿，尚未交给审批人。' : 'The request is saved as a draft and has not been submitted.') : item.status === 'requested' ? (chinese ? `${requester} 已提交${item.requestedUtc ? ` · ${formatDate(item.requestedUtc)}` : ''}，现在等待另一位合资格人员决定。` : `${requester} submitted${item.requestedUtc ? ` · ${formatDate(item.requestedUtc)}` : ''}; an eligible reviewer now decides.`) : item.status === 'approved' ? (chinese ? `${reviewer} 已批准${item.decidedUtc ? ` · ${formatDate(item.decidedUtc)}` : ''}。` : `${reviewer} approved${item.decidedUtc ? ` · ${formatDate(item.decidedUtc)}` : ''}.`) : (chinese ? `${reviewer} 已作出处理${item.decisionNotes ? `：${item.decisionNotes}` : '，请按要求修改后重新提交。'}` : `${reviewer} responded${item.decisionNotes ? `: ${item.decisionNotes}` : '; update the request and submit it again.'}`)}</p></div>
          <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${approvalTone(item.status)}`}>{localize(approvalStatusCopy[item.status], chinese)}</span>
        </div>
      })}</div> : <p className="mt-4 border-y border-[#2f4b42]/10 py-3 text-xs text-[#71827b]">{chinese ? '负责人还没有建立申请；请先进入对应项目准备资料。' : 'The leader has not created a request yet. Open the preparation item to begin.'}</p>}
      <Link to={actionHref} className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#176b5a] hover:underline">{actionLabel}<ArrowRight className="h-3.5 w-3.5" /></Link>
    </div>
  </details>
}

const EventPlanPanel = ({ eventId, eventBasePath, editPath, language }: Props) => {
  const chinese = language === 'zh'
  const query = useQuery({ queryKey: ['eventPlan', eventId], queryFn: () => eventPlanService.get(eventId), enabled: Boolean(eventId) })

  if (query.isLoading) return <div className="rounded-[1.75rem] border border-[#2f4b42]/10 bg-white px-6 py-8 shadow-[0_18px_45px_rgba(31,56,48,0.06)]"><p className="text-sm font-semibold text-slate-600">{chinese ? '正在整理这次活动的筹备方案…' : 'Preparing this event plan…'}</p></div>
  if (query.error || !query.data) return (
    <div className="rounded-[1.75rem] border border-rose-200 bg-white px-6 py-7 shadow-[0_18px_45px_rgba(31,56,48,0.06)]">
      <h2 className="text-lg font-black text-slate-950">{chinese ? '暂时无法打开筹备方案' : 'Unable to open the preparation plan'}</h2>
      <p className="text-sm text-rose-700">{normalizeApiError(query.error).message}</p>
      <button type="button" className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800" onClick={() => void query.refetch()}>{chinese ? '重新加载' : 'Try again'}</button>
    </div>
  )

  const plan = query.data
  const requiredModules = plan.modules.filter((item) => item.isRequired).sort((a, b) => {
    const ai = moduleOrder.indexOf(a.key); const bi = moduleOrder.indexOf(b.key)
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
  })
  const modules = requiredModules.filter((item) => item.key !== 'core')
  const approvalGroups = modules.flatMap((module) => {
    const copy = modulesCopy[module.key] ?? fallbackCopy(module.key)
    if (!copy.approval) return []
    return [{
      module,
      copy,
      policy: copy.approval,
      items: (plan.approvals ?? []).filter((item) => item.moduleInstanceId === module.id),
    }]
  })
  const pendingApprovalCount = approvalGroups.filter((group) => !group.items.length || group.items.some((item) => item.status !== 'approved')).length
  const gates = plan.readinessGates.filter((gate) => gate.isRequired)
  const readyGates = gates.filter((gate) => gate.status === 'satisfied' || gate.status === 'waived')
  const progress = gates.length ? Math.round(readyGates.length / gates.length * 100) : 0
  const nextModule = requiredModules.find((module) => !isReady(module.status))
  const nextCopy = nextModule ? modulesCopy[nextModule.key] ?? fallbackCopy(nextModule.key) : null
  const gateFor = (module: EventPlanModule): EventReadinessGate | undefined => gates.find((gate) => gate.moduleInstanceId === module.id)
  const moduleSelectionHref = `${editPath}${editPath.includes('?') ? '&' : '?'}step=setup#event-module-selector`
  const timeEditHref = `${editPath}${editPath.includes('?') ? '&' : '?'}step=setup#event-time`
  const eventEnded = Date.parse(plan.eventEndUtc) <= Date.now()
  const financeSelected = requiredModules.some((module) => module.key === 'finance')
  const dateTimeFormatter = new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' })
  const milestoneActionHref = (check: EventPlanMilestoneCheck) => {
    if (check.status === 'satisfied' || check.status === 'notApplicable') return null
    if (check.key === 'eventEnded') return null
    if (check.key === 'attendance') return `${eventBasePath}/attendance`
    if (check.key === 'financeActuals') return `${eventBasePath}/finance#actual-finance`
    if (check.moduleKey === 'communications') return `${editPath}?step=notice`
    if (check.moduleKey === 'core') return `${editPath}?step=setup`
    if (check.moduleKey === 'closure') return `${eventBasePath}/closure`
    const presentation = check.moduleKey ? modulesCopy[check.moduleKey] : undefined
    return presentation?.href({ eventBasePath, editPath }) ?? null
  }

  return <section className="overflow-hidden rounded-[2rem] border border-[#2f4b42]/10 bg-white shadow-[0_22px_58px_rgba(31,56,48,0.08)]" aria-labelledby="event-plan-title">
    <header className="relative overflow-hidden bg-[linear-gradient(118deg,#123d34_0%,#176b5a_62%,#2c6079_100%)] px-6 py-7 text-white sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border border-white/10 bg-white/[0.035]" />
      <div className="relative">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '活动主流程' : 'Event delivery'}</p>
            <h2 id="event-plan-title" className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">{chinese ? '这次活动的筹备方案' : 'Preparation plan for this event'}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">{chinese ? '这里只显示负责人已经加入的筹备项目；未选择的场地、报名、财务、风险、排班或程序单不会占用页面。' : 'Only preparation selected by the leader appears here. Venue, registration, finance, risk, roster and programme stay out until added.'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black">{readyGates.length}/{gates.length} {chinese ? '项就绪' : 'ready'}</span>
            <Link to={moduleSelectionHref} className="text-sm font-black text-white underline decoration-white/35 underline-offset-4 hover:decoration-white">{chinese ? '调整筹备项目' : 'Change preparation'}</Link>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15" aria-label={`${progress}%`}><div className="h-full rounded-full bg-[#f4c46a] transition-all" style={{ width: `${progress}%` }} /></div><span className="text-sm font-black text-white">{progress}%</span></div>
        {plan.milestones?.length ? <div className="mt-5 grid overflow-hidden border-y border-white/15 sm:grid-cols-4 sm:divide-x sm:divide-white/15">{plan.milestones.map((milestone, index) => {
          const firstMissing = milestone.checks.find((check) => check.status === 'blocked' || check.status === 'pending')
          return <details key={milestone.key} className="group px-3 py-3 sm:px-4">
            <summary className="cursor-pointer list-none marker:hidden"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/80">0{index + 1}</span><span className="mt-1 flex items-start justify-between gap-2"><span className="text-sm font-black text-white">{localize(milestone.name, chinese)}</span><span className={['mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full', milestone.status === 'ready' ? 'bg-emerald-300' : milestone.status === 'blocked' ? 'bg-rose-300' : milestone.status === 'notApplicable' ? 'bg-white/30' : 'bg-amber-300'].join(' ')} /></span><span className="mt-1 block text-[11px] font-semibold leading-5 text-emerald-50/70">{firstMissing ? localize(firstMissing.name, chinese) : localize(milestoneStatusCopy[milestone.status], chinese)}</span></summary>
            {milestone.checks.length ? <ul className="mt-3 space-y-2 border-t border-white/10 pt-3 text-[11px] leading-5 text-emerald-50/80">{milestone.checks.map((check) => {
              const actionHref = milestoneActionHref(check)
              return <li key={check.key} className="flex items-start gap-2"><span className={check.status === 'satisfied' || check.status === 'notApplicable' ? 'text-emerald-300' : check.status === 'blocked' ? 'text-rose-300' : 'text-amber-300'}>{check.status === 'satisfied' || check.status === 'notApplicable' ? '✓' : '•'}</span><span className="min-w-0 flex-1">{localize(check.name, chinese)}</span>{actionHref ? <Link to={actionHref} className="inline-flex shrink-0 items-center gap-0.5 font-black text-white underline decoration-white/35 underline-offset-2 hover:decoration-white">{chinese ? '去处理' : 'Open'}<ArrowRight className="h-3 w-3" /></Link> : null}</li>
            })}</ul> : <p className="mt-3 border-t border-white/10 pt-3 text-[11px] text-emerald-50/70">{chinese ? '本次活动没有启用这个阶段。' : 'This stage is not used for this event.'}</p>}
          </details>
        })}</div> : null}
        <div className="mt-6 border-t border-white/15 pt-5">
          {nextModule && nextCopy ? <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f4c46a]">{chinese ? '现在最值得处理' : 'Recommended next step'}</p><p className="mt-1 font-black text-white">{localize(nextCopy.name, chinese)}</p><p className="mt-1 text-sm leading-6 text-emerald-50/80">{localize(nextCopy.description, chinese)}</p></div>
            <Link to={nextCopy.href({ eventBasePath, editPath })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#123d34] shadow-lg transition hover:-translate-y-0.5">{localize(nextCopy.action, chinese)}<ArrowRight className="h-4 w-4" /></Link>
          </div> : <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" /><div><p className="font-black text-white">{chinese ? '所有必要项目已经就绪' : 'All required items are ready'}</p><p className="mt-1 text-sm text-emerald-50/80">{chinese ? '负责人仍需在实际发布或执行前做最后确认。' : 'The leader still confirms before publishing or running the event.'}</p></div></div>}
        </div>
      </div>
    </header>

    <div className="border-b border-[#2f4b42]/10 px-6 py-6 sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#176b5a]">01</p><h3 className="mt-1 text-lg font-black text-[#18332d]">{chinese ? '活动时间' : 'Event time'}</h3><p className="mt-1 text-sm text-[#71827b]">{chinese ? '直接修改时间；只有真正的多日或多时段活动才需要拆分场次。' : 'Change the time directly; split sessions only for genuinely multi-day or multi-slot events.'}</p></div>
        <div className="flex gap-4"><Link to={timeEditHref} className="text-sm font-black text-[#176b5a] hover:underline">{chinese ? '修改时间' : 'Change time'}</Link><Link to={`${eventBasePath}/schedule`} className="text-sm font-black text-[#60726b] hover:underline">{chinese ? '拆分场次' : 'Split sessions'}</Link></div>
      </div>
      <div className="mt-4 divide-y divide-[#2f4b42]/10 border-y border-[#2f4b42]/10">{plan.occurrences.map((occurrence) => <div key={occurrence.id} className="flex items-start gap-3 py-3.5"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#176b5a]" /><div><p className="text-sm font-black text-[#18332d]">{localize(occurrence.name, chinese)}</p><p className="mt-1 text-xs text-[#71827b]">{dateTimeFormatter.format(new Date(occurrence.startUtc))} → {dateTimeFormatter.format(new Date(occurrence.endUtc))}</p></div></div>)}</div>
    </div>

    <div className="border-b border-[#2f4b42]/10 px-6 py-7 sm:px-8" aria-labelledby="event-modules-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#176b5a]">02</p><h3 id="event-modules-title" className="mt-1 text-lg font-black text-[#18332d]">{chinese ? '本次筹备项目' : 'Preparation for this event'}</h3><p className="mt-1 text-sm text-[#71827b]">{chinese ? '每项都说明当前状态、完成条件和下一步，不再用多张卡片重复表达。' : 'Each row shows its status, readiness condition and next action without repeating card layouts.'}</p></div><span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700"><Bot className="h-4 w-4" />{chinese ? 'AI 只生成待确认建议' : 'AI produces reviewable suggestions only'}</span></div>
      <div className="mt-5 divide-y divide-[#2f4b42]/10 border-y border-[#2f4b42]/10">{modules.length ? modules.map((module) => {
        const copy = modulesCopy[module.key] ?? fallbackCopy(module.key); const gate = gateFor(module); const Icon = copy.icon
        const ready = isReady(module.status); const blocked = module.status === 'blocked'
        return <article key={module.id} className="py-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="flex min-w-0 items-start gap-3.5"><span className={['rounded-xl p-2.5', ready ? 'bg-emerald-100 text-emerald-800' : blocked ? 'bg-rose-100 text-rose-800' : 'bg-[#edf4f0] text-[#526861]'].join(' ')}><Icon className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-black text-[#18332d]">{localize(copy.name, chinese)}</h4><AppBadge variant={ready ? 'success' : blocked ? 'warning' : 'neutral'}>{localize(statusCopy[module.status], chinese)}</AppBadge></div><p className="mt-1 text-sm leading-6 text-[#71827b]">{localize(copy.description, chinese)}</p>{gate ? <p className="mt-2 text-xs font-bold text-[#53665f]">{chinese ? '完成条件：' : 'Ready when: '}{localize(gate.name, chinese)}</p> : null}{copy.approval ? <a href="#event-approvals" className="mt-2 inline-flex items-center gap-1 text-xs font-black text-amber-700 hover:underline"><ShieldCheck className="h-3.5 w-3.5" />{chinese ? '查看谁来决定、依据和结果' : 'See decision owner, evidence and effect'}</a> : null}</div></div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end"><Link to={`${editPath}?step=assistant&module=${encodeURIComponent(module.key)}`} className="inline-flex items-center gap-1 text-sm font-black text-violet-700 hover:underline"><Bot className="h-4 w-4" />{chinese ? 'AI 协助' : 'AI help'}</Link>{module.key === 'communications' ? <Link to={`${editPath}?step=setup#event-poster-workspace`} className="text-sm font-black text-[#60726b] hover:underline">{chinese ? '海报工具' : 'Poster tool'}</Link> : null}<Link to={copy.href({ eventBasePath, editPath })} className="inline-flex items-center gap-1 rounded-lg bg-[#edf4f0] px-3 py-2 text-sm font-black text-[#176b5a] transition hover:bg-[#dfece6]">{localize(copy.action, chinese)}<ArrowRight className="h-4 w-4" /></Link></div>
          </div>
          {module.key === 'registration' && plan.registration ? <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-l-2 border-[#176b5a]/25 pl-4 text-xs text-[#71827b]"><span><strong className="text-[#18332d]">{plan.registration.reservedUnits}</strong> {chinese ? '已占名额' : 'reserved'}</span><span><strong className="text-[#18332d]">{plan.registration.remainingUnits}</strong> {chinese ? '剩余名额' : 'remaining'}</span><span><strong className="text-[#18332d]">{plan.registration.enrollmentCount}</strong> {chinese ? '报名记录' : 'submissions'}</span></div> : null}
          {module.key === 'tasks' && plan.preparationTasks ? <div className="mt-4 border-y border-[#2f4b42]/10 text-xs text-[#71827b]">
            <div className="flex flex-wrap gap-x-6 gap-y-2 py-3 font-bold"><span><strong className="text-[#18332d]">{plan.preparationTasks.completedCount}/{plan.preparationTasks.requiredCount}</strong> {chinese ? '必要任务完成' : 'required complete'}</span><span className={plan.preparationTasks.unassignedCount ? 'text-rose-700' : ''}><strong>{plan.preparationTasks.unassignedCount}</strong> {chinese ? '项缺少负责人' : 'without owner'}</span><span className={plan.preparationTasks.missingDueDateCount + plan.preparationTasks.dueAfterEventCount ? 'text-rose-700' : ''}><strong>{plan.preparationTasks.missingDueDateCount + plan.preparationTasks.dueAfterEventCount}</strong> {chinese ? '项截止时间不合格' : 'invalid due dates'}</span><span className={plan.preparationTasks.overdueCount ? 'text-rose-700' : ''}><strong>{plan.preparationTasks.overdueCount}</strong> {chinese ? '项已逾期' : 'overdue'}</span><span className={plan.preparationTasks.blockedCount ? 'text-amber-700' : ''}><strong>{plan.preparationTasks.blockedCount}</strong> {chinese ? '项等待前置工作' : 'waiting for prerequisites'}</span></div>
            {plan.preparationTasks.nextTasks.length ? <div className="divide-y divide-[#2f4b42]/10 border-t border-[#2f4b42]/10">{plan.preparationTasks.nextTasks.slice(0, 3).map((task) => <div key={task.id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="font-black text-[#18332d]">{localize(task.title, chinese)}</span><span className="flex flex-wrap items-center gap-x-4 gap-y-1"><span className={task.assignedDisplayName ? '' : 'font-black text-rose-700'}>{task.assignedDisplayName || (chinese ? '缺少负责人' : 'Owner missing')}</span><span className={task.dueUtc ? 'inline-flex items-center gap-1' : 'font-black text-rose-700'}>{task.dueUtc ? <><CalendarClock className="h-3.5 w-3.5" />{dateTimeFormatter.format(new Date(task.dueUtc))}</> : (chinese ? '缺少截止时间' : 'Due date missing')}</span>{task.isBlocked ? <span className="inline-flex items-center gap-1 font-black text-amber-700"><Link2 className="h-3.5 w-3.5" />{chinese ? '等待前置工作' : 'Waiting'}</span> : null}</span></div>)}</div> : null}
          </div> : null}
        </article>
      }) : <p className="py-6 text-sm text-[#71827b]">{chinese ? '当前没有额外筹备项目。需要时可从上方“调整筹备项目”添加。' : 'No additional preparation is selected. Add it only when this event needs it.'}</p>}</div>
    </div>

    {approvalGroups.length ? <div id="event-approvals" className="scroll-mt-24 border-b border-[#2f4b42]/10 bg-[#fffdfa] px-6 py-7 sm:px-8" aria-labelledby="event-approvals-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#176b5a]">03</p><h3 id="event-approvals-title" className="mt-1 text-lg font-black text-[#18332d]">{chinese ? '需要别人决定的事项' : 'Decisions required from others'}</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-[#71827b]">{chinese ? '只有真正需要另一位合资格人员作出决定的事项才会出现在这里。展开后可直接看到：决定什么、谁来决定、依据什么、决定后发生什么。' : 'Only items requiring a decision by another eligible person appear here. Expand an item to see what is decided, who decides, the evidence and what happens next.'}</p></div>
        <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">{pendingApprovalCount} {chinese ? '项尚未批准' : 'not yet approved'}</span>
      </div>
      <div className="mt-5 overflow-hidden border-y border-[#2f4b42]/10 bg-white">{approvalGroups.map(({ module, copy, policy, items }) => <ApprovalDetails key={module.id} moduleName={localize(copy.name, chinese)} actionHref={copy.href({ eventBasePath, editPath })} actionLabel={localize(copy.action, chinese)} policy={policy} items={items} chinese={chinese} />)}</div>
      <p className="mt-4 text-xs font-semibold leading-5 text-violet-800"><Bot className="mr-1 inline h-4 w-4" />{chinese ? 'AI 可以检查资料是否齐全并整理摘要，但批准、退回或拒绝只能由有权限的人亲自完成。' : 'AI may check whether evidence is complete and prepare a summary, but only an authorized person can approve, return or reject.'}</p>
    </div> : null}

    {eventEnded ? <div className="border-b border-[#2f4b42]/10 bg-[#f7faf8] px-6 py-7 sm:px-8">
      <div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#176b5a]">{approvalGroups.length ? '04' : '03'}</p><h3 className="mt-1 text-lg font-black text-[#18332d]">{chinese ? '活动结果' : 'Event outcomes'}</h3><p className="mt-1 text-sm text-[#71827b]">{chinese ? '活动已结束：先核对真实数据，再由负责人完成总结。' : 'The event has ended. Verify actual data before the leader completes closure.'}</p></div>
      <div className="mt-5 divide-y divide-[#2f4b42]/10 border-y border-[#2f4b42]/10">
        <Link to={`${eventBasePath}/attendance`} className="group flex items-center gap-4 py-4"><UserCheck className="h-5 w-5 shrink-0 text-[#176b5a]" /><span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#18332d]">{chinese ? '实际出席' : 'Actual attendance'}</span><span className="mt-0.5 block text-xs text-[#71827b]">{chinese ? '按场次核对报名者和临时到场者。' : 'Verify enrolled and walk-in participants by session.'}</span></span><ArrowRight className="h-4 w-4 text-[#82918b] transition group-hover:translate-x-0.5" /></Link>
        {financeSelected ? <Link to={`${eventBasePath}/finance#actual-finance`} className="group flex items-center gap-4 py-4"><WalletCards className="h-5 w-5 shrink-0 text-[#176b5a]" /><span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#18332d]">{chinese ? '实际收支与对账' : 'Actual finance and reconciliation'}</span><span className="mt-0.5 block text-xs text-[#71827b]">{chinese ? '记录真实收入和支出，或明确确认本次没有收支。' : 'Record actual income and expenses, or explicitly confirm none occurred.'}</span></span><ArrowRight className="h-4 w-4 text-[#82918b] transition group-hover:translate-x-0.5" /></Link> : null}
        <Link to={`${eventBasePath}/closure`} className="group flex items-center gap-4 py-4"><ClipboardCheck className="h-5 w-5 shrink-0 text-[#176b5a]" /><span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#18332d]">{chinese ? '总结与跟进' : 'Closure and follow-up'}</span><span className="mt-0.5 block text-xs text-[#71827b]">{chinese ? '基于已核对结果，记录异常、跟进和可复用经验。' : 'Use verified outcomes for incidents, follow-up and reusable learning.'}</span></span><ArrowRight className="h-4 w-4 text-[#82918b] transition group-hover:translate-x-0.5" /></Link>
      </div>
    </div> : null}

    <details className="px-6 py-4 text-sm text-[#60726b] sm:px-8"><summary className="cursor-pointer font-black text-[#40554e]">{chinese ? '查看方案记录' : 'View plan record'}</summary><div className="mt-3 space-y-2 leading-6"><p>{chinese ? `当前方案版本：${plan.currentRevision}。系统会保留修改记录，便于查看活动如何变化。` : `Current plan revision: ${plan.currentRevision}. Changes are versioned for review.`}</p>{plan.isLegacyProjection ? <p className="flex items-start gap-2 text-amber-800"><AlertTriangle className="mt-1 h-4 w-4 shrink-0" />{chinese ? '这条较早的活动已经按新的筹备方案展示；请继续在上面的模块中办理。原活动资料会保留，旧流程不能再继续操作。' : 'This earlier event is already shown through the new preparation plan. Continue in the modules above; original records remain available, but the old workflow can no longer be advanced.'}</p> : null}</div></details>
  </section>
}

export default EventPlanPanel
