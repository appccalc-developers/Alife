import type { EventApprovalAssessment } from '../../types/eventPackage'

export const approvalTierLabel = (tier: string, zh: boolean) => ({ enhanced: zh ? '加强审批' : 'Enhanced approval', standard: zh ? '标准审批' : 'Standard approval', light: zh ? '简易审批' : 'Light approval' }[tier] || tier)

export default function EventApprovalAssessmentPanel({ assessment, zh, approved }: { assessment: EventApprovalAssessment; zh: boolean; approved: boolean }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const deadline = new Date(assessment.approvalDeadlineUtc)
  const overdue = !approved && deadline.getTime() < Date.now()
  return <section className="my-4 space-y-4 rounded-xl border border-[#176b5a]/20 bg-[#f4f8f6] p-4" aria-label={zh ? '审批等级与批复时间' : 'Approval tier and reply deadline'}>
    <div><h3 className="font-bold text-[#18332d]">{zh ? '本方案采用：' : 'This plan requires: '}{approvalTierLabel(assessment.tier, zh)}</h3><p className="mt-1 text-xs text-[#66766f]">{zh ? `依据当前生效的活动方案治理政策 ${assessment.policyVersion}；同时满足多个等级时，采用更严格的等级。` : `Based on effective Event Package governance policy ${assessment.policyVersion}. The strictest matching tier applies.`}</p></div>
    <div className="grid gap-3 desktop:grid-cols-3">{assessment.tiers.map(tier => <div key={tier.tier} className={`rounded-xl border bg-white p-3 ${tier.selected ? 'border-[#176b5a]' : 'border-[#2f4b42]/15'}`}>
      <h4 className="font-semibold">{approvalTierLabel(tier.tier, zh)}{tier.selected ? (zh ? ' · 本次采用' : ' · Applied') : ''}</h4>
      {tier.reasons.length ? <ul className="mt-2 list-disc space-y-2 pl-4 text-sm">{tier.reasons.map(reason => <li key={reason.code}>{reason.message[zh ? 'zh' : 'en'] || reason.message.en}</li>)}</ul> : <p className="mt-2 text-sm text-[#66766f]">{zh ? '本方案未触发此等级的政策条件。' : 'This plan does not trigger this tier’s policy conditions.'}</p>}
    </div>)}</div>
    <div className={`rounded-xl p-3 ${overdue ? 'bg-amber-50 text-amber-900' : 'bg-[#e3f0eb] text-[#18332d]'}`}>
      <h4 className="text-sm font-semibold">{zh ? '最晚预期批复时间' : 'Expected latest approval reply'}</h4>
      <time dateTime={assessment.approvalDeadlineUtc} className="mt-1 block font-bold">{new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-AU', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(deadline)} · {timeZone}</time>
      <p className="mt-2 text-sm">{zh ? `活动开始时间 − 政策规定的 ${assessment.finalConfirmationWindowHours} 小时（最终确认开放窗口）。筹备方可据此安排等待批复和最终确认。` : `Event start − the policy’s ${assessment.finalConfirmationWindowHours}-hour final confirmation window. Use this time to plan for the approval reply and final confirmation.`}</p>
      {overdue ? <p role="status" className="mt-2 text-sm font-semibold">{zh ? '已超过预期批复时间，请联系审批人跟进。' : 'The expected reply time has passed. Follow up with the approver.'}</p> : null}
    </div>
  </section>
}
