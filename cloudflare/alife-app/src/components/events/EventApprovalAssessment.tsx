import type { EventApprovalAssessment } from '../../types/eventPackage'

export const approvalTierLabel = (tier: string, zh: boolean) => ({ enhanced: zh ? '加强审批' : 'Enhanced approval', standard: zh ? '标准审批' : 'Standard approval', light: zh ? '简易审批' : 'Light approval' }[tier] || tier)

export default function EventApprovalAssessmentPanel({ assessment, zh, approved }: { assessment: EventApprovalAssessment; zh: boolean; approved: boolean }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const deadline = new Date(assessment.approvalDeadlineUtc)
  const overdue = !approved && deadline.getTime() < Date.now()
  return <section className="my-4 space-y-2 rounded-xl border border-[#176b5a]/20 bg-[#f4f8f6] p-3" aria-label={zh ? '审批等级与批复时间' : 'Approval tier and reply deadline'}>
    <h3 className="text-sm font-bold text-[#18332d]">{zh ? '本方案采用：' : 'This plan requires: '}{approvalTierLabel(assessment.tier, zh)}</h3>
    <p className="text-xs text-[#40554e]">{zh ? '最晚预期批复：' : 'Expected latest reply: '}<time dateTime={assessment.approvalDeadlineUtc}>{new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(deadline)}</time> · {timeZone}</p>
    {overdue ? <p role="status" className="text-sm font-semibold text-amber-900">{zh ? '已超过预期批复时间，请联系审批人跟进。' : 'The expected reply time has passed. Follow up with the approver.'}</p> : null}
    <details><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold">{zh ? '为什么需要这个审批等级？' : 'Why is this approval tier required?'}</summary><p className="mb-3 text-xs text-[#40554e]">{zh ? `政策 ${assessment.policyVersion}；同时符合多个等级时采用最严格等级。预期批复时间 = 活动开始前 ${assessment.finalConfirmationWindowHours} 小时，不是审批人的承诺。` : `Policy ${assessment.policyVersion}; the strictest matching tier applies. Expected reply = ${assessment.finalConfirmationWindowHours} hours before the event, not an approver’s commitment.`}</p><div className="grid gap-3 desktop:grid-cols-3">{assessment.tiers.map(tier => <div key={tier.tier} className={`rounded-xl border bg-white p-3 ${tier.selected ? 'border-[#176b5a]' : 'border-[#2f4b42]/15'}`}>
      <h4 className="font-semibold">{approvalTierLabel(tier.tier, zh)}{tier.selected ? (zh ? ' · 本次采用' : ' · Applied') : ''}</h4>
      {tier.reasons.length ? <ul className="mt-2 list-disc space-y-2 pl-4 text-sm">{tier.reasons.map(reason => <li key={reason.code}>{reason.message[zh ? 'zh' : 'en'] || reason.message.en}</li>)}</ul> : <p className="mt-2 text-sm text-[#66766f]">{zh ? '本方案未触发此等级的政策条件。' : 'This plan does not trigger this tier’s policy conditions.'}</p>}
    </div>)}</div></details>
  </section>
}
