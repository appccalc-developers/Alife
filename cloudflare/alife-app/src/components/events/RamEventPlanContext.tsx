import AppBadge from '../layout/AppBadge'
import AppSectionCard from '../layout/AppSectionCard'
import type { RamEventPlanContext } from '../../types/ramGovernance'

const localize = (value: { en: string; zh: string }, zh: boolean) =>
  value[zh ? 'zh' : 'en'] || value[zh ? 'en' : 'zh'] || ''

const factValue = (value: unknown, zh: boolean) => {
  if (value === true) return zh ? '是' : 'Yes'
  if (value === false) return zh ? '否' : 'No'
  if (value === null || value === undefined || value === '') return zh ? '未提供' : 'Not provided'
  if (typeof value === 'object' && !Array.isArray(value)) {
    const text = value as { en?: unknown; zh?: unknown }
    const localized = text[zh ? 'zh' : 'en'] ?? text[zh ? 'en' : 'zh']
    if (typeof localized === 'string') return localized
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

export default function RamEventPlanContext({ context, zh }: { context: RamEventPlanContext; zh: boolean }) {
  const snapshot = context.acceptedPlan
  const plan = snapshot?.plan
  const activeModules = plan?.moduleDecisions.filter(item => item.status !== 'inactive') ?? []

  return <div data-ram-plan-context><AppSectionCard
    title={zh ? '独立审核所依据的完整活动方案' : 'Complete Event Plan for independent review'}
    subtitle={zh
      ? 'RAM 独立审核必须同时核对风险报告与当前已接受的活动方案；这里是只读资料，不授予修改活动的权限。'
      : 'Independent RAM review covers both the risk report and the current accepted Event Plan. This is read-only and does not grant Event editing permission.'}
    action={snapshot ? <AppBadge variant="info">Plan v{snapshot.planVersion}</AppBadge> : undefined}
  >
    <div className="grid gap-3 tablet:grid-cols-2">
      <div className="rounded-xl bg-[#f4f8f6] p-4 tablet:col-span-2">
        <h2 className="break-words text-xl font-black text-[#18332d]">{localize(context.title, zh)}</h2>
        <p className="mt-2 text-sm text-[#40554e]">{new Date(context.startUtc).toLocaleString()} – {new Date(context.endUtc).toLocaleString()}</p>
        {plan ? <p className="mt-2 text-xs text-[#66766f]">{zh ? '活动类型' : 'Activity type'}: {plan.activityTypeCode || '—'} · {zh ? '结构' : 'Archetype'}: {plan.archetypeCode || '—'}</p> : null}
      </div>
    </div>

    {!plan ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{zh ? '此活动尚无已接受的活动方案，不能据此完成独立审核。' : 'This Event has no accepted Event Plan, so the independent review cannot be completed from this context.'}</p> : <div className="mt-4 space-y-4">
      <section aria-labelledby="ram-plan-facts">
        <h3 id="ram-plan-facts" className="font-black text-[#18332d]">{zh ? '活动事实' : 'Event facts'}</h3>
        {plan.facts.items.length ? <dl className="mt-2 grid gap-2 tablet:grid-cols-2">{plan.facts.items.map(item => <div key={item.code} className="rounded-xl border border-[#2f4b42]/10 bg-white p-3 text-sm"><dt className="break-all text-xs font-bold text-[#66766f]">{item.code} · {item.certainty}</dt><dd className="mt-1 break-words font-semibold text-[#18332d]">{factValue(item.value, zh)}</dd></div>)}</dl> : <p className="mt-2 text-sm text-[#66766f]">{zh ? '此版本没有记录活动事实。' : 'No Event facts are recorded in this version.'}</p>}
      </section>

      <section aria-labelledby="ram-plan-modules">
        <h3 id="ram-plan-modules" className="font-black text-[#18332d]">{zh ? '筹备模块与状态' : 'Preparation modules and status'}</h3>
        <div className="mt-2 grid gap-2 tablet:grid-cols-2">{activeModules.map(item => <div key={item.moduleCode} className="rounded-xl border border-[#2f4b42]/10 bg-white p-3 text-sm"><div className="flex items-start justify-between gap-2"><strong>{localize(item.label, zh)}</strong><AppBadge variant={item.status === 'required' ? 'warning' : 'info'}>{item.status}</AppBadge></div><p className="mt-1 break-all text-xs text-[#66766f]">{item.moduleCode}</p>{item.reasonCodes.length ? <p className="mt-2 text-xs text-[#40554e]">{item.reasonCodes.join(' · ')}</p> : null}</div>)}</div>
      </section>

      <section aria-labelledby="ram-plan-roles">
        <h3 id="ram-plan-roles" className="font-black text-[#18332d]">{zh ? '责任与职责分离' : 'Responsibilities and separation'}</h3>
        {plan.roleRequirements.length ? <ul className="mt-2 space-y-2">{plan.roleRequirements.map(item => <li key={item.requirementKey} className="rounded-xl border border-[#2f4b42]/10 bg-white p-3 text-sm"><strong>{item.roleCode}</strong><span className="ml-2 text-xs text-[#66766f]">{item.moduleCode} · {zh ? '至少' : 'minimum'} {item.minimum}</span>{item.separationFrom.length ? <p className="mt-1 text-xs text-[#40554e]">{zh ? '须与以下职责分离：' : 'Must be separate from: '}{item.separationFrom.join(' · ')}</p> : null}</li>)}</ul> : <p className="mt-2 text-sm text-[#66766f]">{zh ? '此版本没有额外职责要求。' : 'No additional role requirements are recorded.'}</p>}
      </section>

      {(plan.readiness.blockers.length || plan.readiness.warnings.length) ? <section aria-labelledby="ram-plan-readiness">
        <h3 id="ram-plan-readiness" className="font-black text-[#18332d]">{zh ? '准备度与注意事项' : 'Readiness and cautions'}</h3>
        <ul className="mt-2 space-y-2">{[...plan.readiness.blockers, ...plan.readiness.warnings].map((item, index) => <li key={`${item.en}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{localize(item, zh)}</li>)}</ul>
      </section> : null}

      <details className="rounded-xl border border-[#2f4b42]/10 bg-white px-3 py-2 text-xs text-[#66766f]">
        <summary className="min-h-10 cursor-pointer py-2 font-bold text-[#40554e]">{zh ? '版本与人工决定' : 'Version and human decisions'}</summary>
        <p>{zh ? '接受时间' : 'Accepted'}: {snapshot.acceptedUtc ? new Date(snapshot.acceptedUtc).toLocaleString() : '—'}</p>
        <p className="mt-1 break-all">{zh ? '方案哈希' : 'Proposal hash'}: {plan.proposalHash}</p>
        {snapshot.humanDecisions.length ? <ul className="mt-2 space-y-1">{snapshot.humanDecisions.map((item, index) => <li key={`${item.code}-${index}`}>{item.code}: {item.decision}{item.reason ? ` · ${item.reason}` : ''}</li>)}</ul> : null}
      </details>
    </div>}
  </AppSectionCard></div>
}
