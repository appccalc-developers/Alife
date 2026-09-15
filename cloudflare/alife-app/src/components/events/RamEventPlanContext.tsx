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

export default function RamEventPlanContext({ context, zh, review = true }: { context: RamEventPlanContext; zh: boolean; review?: boolean }) {
  const snapshot = context.acceptedPlan
  const plan = snapshot?.plan
  const activeModules = plan?.moduleDecisions.filter(item => item.status !== 'inactive') ?? []

  return <div data-ram-plan-context><AppSectionCard
    title={review ? zh ? '独立审核所依据的完整活动方案' : 'Complete Event Plan for independent review' : zh ? '完整活动方案（只读）' : 'Complete event plan (read only)'}
    subtitle={zh
      ? '这里显示确定版本的活动方案。RAM 确认后，方案改变须重新确认，旧版本不能继续送审或批准。'
      : 'This is a fixed plan version. After RAM confirmation, plan changes require a new confirmation before submission or approval.'}
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
      {(context.venues?.length || context.weeklyVenues?.length) ? <section className="space-y-2"><h3 className="font-semibold">{zh ? '场地安排' : 'Venue arrangements'}</h3>
        {context.venues?.map((v, index) => <p key={index} className="rounded-xl border p-3 text-sm">{localize(v.name, zh)} · {new Date(v.startUtc).toLocaleString(zh ? 'zh' : 'en')} – {new Date(v.endUtc).toLocaleString(zh ? 'zh' : 'en')} · {v.capacity} {zh ? '人' : 'people'}</p>)}
        {context.weeklyVenues?.map((v, index) => <div key={index} className="rounded-xl border p-3 text-sm"><p>{localize(v.name, zh)} · {zh ? '每周，从' : 'Weekly from'} {v.firstDate} {zh ? '至' : 'to'} {v.lastDate || (zh ? '无终止日期' : 'no end date')} · {String(Math.floor(v.startMinute / 60) % 24).padStart(2, '0')}:{String(v.startMinute % 60).padStart(2, '0')} – {String(Math.floor(v.endMinute / 60) % 24).padStart(2, '0')}:{String(v.endMinute % 60).padStart(2, '0')}{v.endMinute >= 1440 ? zh ? '（次日）' : ' (next day)' : ''} · {v.timeZone} · {v.capacity} {zh ? '人' : 'people'}</p>{v.releasedDates.length ? <p>{zh ? '单次释放日期：' : 'Released dates: '}{v.releasedDates.join(', ')}</p> : null}</div>)}
      </section> : null}
      {context.rosterNeeds?.length ? <section className="space-y-2"><h3 className="font-semibold">{zh ? '默认岗位需求' : 'Default staffing requirements'}</h3>{context.rosterNeeds.map((r, index) => <p key={index} className="rounded-xl border p-3 text-sm">{r.roleCode} · {r.requiredCount} {zh ? '人' : 'people'} · {zh ? '相对场次开始' : 'From occurrence start'} {r.startOffsetMinutes}–{r.endOffsetMinutes} {zh ? '分钟' : 'minutes'}{r.eligibilityCode ? ` · ${r.eligibilityCode}` : ''}</p>)}</section> : null}
      {context.details ? <section className="space-y-3"><h3 className="font-semibold">{zh ? '活动内容与安排' : 'Event content and arrangements'}</h3>{Object.entries(context.details).map(([key, value]) => <div key={key} className="rounded-xl border p-3 text-sm"><strong>{({ purpose: zh ? '目的' : 'Purpose', description: zh ? '活动说明' : 'Description', locationName: zh ? '地点' : 'Location', timeZone: zh ? '时区' : 'Time zone', hardConstraints: zh ? '参加要求' : 'Participation requirements', optionalActivities: zh ? '可选活动' : 'Optional activities', registrationDeadline: zh ? '报名截止' : 'Registration deadline', maxCapacity: zh ? '容量' : 'Capacity', capacityUnit: zh ? '计数单位' : 'Capacity unit' } as Record<string, string>)[key] || key}</strong><p className="mt-1 whitespace-pre-wrap break-words">{Array.isArray(value) ? value.map(item => factValue(item, zh)).join('\n') : factValue(value, zh)}</p></div>)}</section> : null}
      {context.reports?.map(report => <section key={report.revisionId} className="rounded-xl border p-4"><h3 className="font-semibold">{report.moduleCode} · {zh ? '已采用报告' : 'Adopted report'} v{report.version}</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm">{localize(report.text, zh)}</p></section>)}
      {context.registrationRules ? <details className="rounded-xl border p-4"><summary className="min-h-11 cursor-pointer font-semibold">{zh ? '报名规则与办理程序' : 'Registration rules and procedures'} v{context.registrationRulesVersion}</summary>{(['purpose', 'eligibility', 'terms', 'privacyNotice', 'cancellationTerms', 'paymentInstructions', 'refundTerms'] as const).map((key, index) => <div key={key} className="mt-3 text-sm"><strong>{(zh ? ['报名目的', '资格条件', '参加规则', '隐私说明', '取消条款', '缴费说明', '退款条款'] : ['Purpose', 'Eligibility', 'Participation rules', 'Privacy', 'Cancellation', 'Payment', 'Refund terms'])[index]}</strong><p className="mt-1 whitespace-pre-wrap">{context.registrationRules?.[key] ? localize(context.registrationRules[key], zh) : '—'}</p></div>)}<p className="mt-3 text-sm">{zh ? '实际人数上限' : 'Participant capacity'}: {context.registrationRules.capacity}</p></details> : null}
      <section aria-labelledby="ram-plan-facts">
        {context.programme?.length ? <section className="mb-4 space-y-3"><h3 className="font-semibold">{zh ? '节目与环节安排' : 'Programme and sessions'}</h3>{context.programme.map((session, index) => <details key={index} className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">{localize(session.title, zh)} · {new Date(session.startUtc).toLocaleString(zh ? 'zh' : 'en')} – {new Date(session.endUtc).toLocaleString(zh ? 'zh' : 'en')}</summary><ol className="space-y-2 text-sm">{session.items.map((item, i) => <li key={i} className="border-t pt-2"><strong>{localize(item.title, zh)}</strong><p>{zh ? '开始于第' : 'Starts at minute'} {item.startOffsetMinutes} · {zh ? '时长' : 'Duration'} {item.durationMinutes} {zh ? '分钟' : 'minutes'}</p><p className="whitespace-pre-wrap break-words">{localize(item.description, zh)}</p></li>)}</ol></details>)}</section> : null}
        {context.registrationRules ? <section className="mb-4 rounded-xl border p-3 text-sm"><h3 className="font-semibold">{zh ? '报名程序与条件' : 'Registration steps and conditions'}</h3><dl className="mt-3 grid gap-2 sm:grid-cols-2">{[
          [zh ? '资格范围' : 'Audience', ({ invited: zh ? '点名邀请' : 'Named invitations', group: zh ? '指定小组成员' : 'Specified group members', church: zh ? '本教会成员' : 'Church members', public: zh ? '活动公开范围' : 'Published event audience' } as Record<string, string>)[context.registrationRules.audience]],
          [zh ? '开放时间' : 'Opens', new Date(context.registrationRules.opensUtc).toLocaleString(zh ? 'zh' : 'en')],
          [zh ? '截止时间' : 'Deadline', new Date(context.registrationRules.deadlineUtc).toLocaleString(zh ? 'zh' : 'en')],
          [zh ? '办理渠道' : 'Channel', ({ app: zh ? 'App 内办理' : 'In App', manual: zh ? '人工登记' : 'Manual', both: zh ? 'App 与人工登记' : 'App and manual' } as Record<string, string>)[context.registrationRules.channel]],
          [zh ? '候补' : 'Waitlist', context.registrationRules.allowWaitlist ? zh ? '允许' : 'Allowed' : zh ? '不允许' : 'Not allowed'],
          [zh ? '人工资格和材料核实' : 'Manual eligibility and material review', context.registrationRules.manualReview ? zh ? '需要' : 'Required' : zh ? '不需要' : 'Not required'],
          [zh ? '每人报名费' : 'Fee per participant', new Intl.NumberFormat(zh ? 'zh-CN' : 'en', { style: 'currency', currency: context.registrationRules.currency }).format(context.registrationRules.feeMinor / 10 ** (new Intl.NumberFormat('en', { style: 'currency', currency: context.registrationRules.currency }).resolvedOptions().maximumFractionDigits ?? 2))],
        ].map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl><ul className="mt-3 space-y-2">{context.registrationRules.materials.map(m => <li key={m.id}>{localize(m.label, zh)} · {m.required ? zh ? '必填' : 'Required' : zh ? '选填' : 'Optional'} · {m.kind === 'text' ? zh ? '文字' : 'Text' : `${m.kind === 'image' ? 'JPG / PNG' : 'JPG / PNG / PDF / TXT'} · ${m.maxCount} ${zh ? '个文件，单个上限' : 'files, each up to'} ${Math.round(m.maxBytes / 1024)} KB`}</li>)}</ul></section> : null}
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
