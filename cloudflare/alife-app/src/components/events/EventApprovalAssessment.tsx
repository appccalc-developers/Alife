import { eventApprovalAssessmentText } from '../../i18n/eventApprovalAssessment.ts'
import type { EventApprovalAssessment } from '../../types/eventPackage'

export const approvalTierLabel = (tier: string, zh: boolean) => ({ enhanced: zh ? eventApprovalAssessmentText.enhancedApproval.zh : eventApprovalAssessmentText.enhancedApproval.en, standard: zh ? eventApprovalAssessmentText.standardApproval.zh : eventApprovalAssessmentText.standardApproval.en, light: zh ? eventApprovalAssessmentText.lightApproval.zh : eventApprovalAssessmentText.lightApproval.en }[tier] || tier)

export default function EventApprovalAssessmentPanel({ assessment, zh, approved }: { assessment: EventApprovalAssessment; zh: boolean; approved: boolean }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const deadline = new Date(assessment.approvalDeadlineUtc)
  const overdue = !approved && deadline.getTime() < Date.now()
  return <section className="my-4 space-y-2 rounded-xl border border-[#176b5a]/20 bg-[#f4f8f6] p-3" aria-label={zh ? eventApprovalAssessmentText.approvalTierAndReplyDeadline.zh : eventApprovalAssessmentText.approvalTierAndReplyDeadline.en}>
    <h3 className="text-sm font-bold text-[#18332d]">{zh ? eventApprovalAssessmentText.thisPlanRequires.zh : eventApprovalAssessmentText.thisPlanRequires.en}{approvalTierLabel(assessment.tier, zh)}</h3>
    <p className="text-xs text-[#40554e]">{zh ? eventApprovalAssessmentText.expectedLatestReply.zh : eventApprovalAssessmentText.expectedLatestReply.en}<time dateTime={assessment.approvalDeadlineUtc}>{new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(deadline)}</time> · {timeZone}</p>
    {overdue ? <p role="status" className="text-sm font-semibold text-amber-900">{zh ? eventApprovalAssessmentText.theExpectedReplyTimeHasPassedFollowUpWith.zh : eventApprovalAssessmentText.theExpectedReplyTimeHasPassedFollowUpWith.en}</p> : null}
    <details><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold">{zh ? eventApprovalAssessmentText.whyIsThisApprovalTierRequired.zh : eventApprovalAssessmentText.whyIsThisApprovalTierRequired.en}</summary><p className="mb-3 text-xs text-[#40554e]">{zh ? eventApprovalAssessmentText.policyTheStrictestMatchingTierAppliesExpectedReplyHours.zh(assessment.policyVersion, assessment.finalConfirmationWindowHours) : eventApprovalAssessmentText.policyTheStrictestMatchingTierAppliesExpectedReplyHours.en(assessment.policyVersion, assessment.finalConfirmationWindowHours)}</p><div className="grid gap-3 desktop:grid-cols-3">{assessment.tiers.map(tier => <div key={tier.tier} className={`rounded-xl border bg-white p-3 ${tier.selected ? 'border-[#176b5a]' : 'border-[#2f4b42]/15'}`}>
      <h4 className="font-semibold">{approvalTierLabel(tier.tier, zh)}{tier.selected ? (zh ? eventApprovalAssessmentText.applied.zh : eventApprovalAssessmentText.applied.en) : ''}</h4>
      {tier.reasons.length ? <ul className="mt-2 list-disc space-y-2 pl-4 text-sm">{tier.reasons.map(reason => <li key={reason.code}>{reason.message[zh ? 'zh' : 'en'] || reason.message.en}</li>)}</ul> : <p className="mt-2 text-sm text-[#66766f]">{zh ? eventApprovalAssessmentText.thisPlanDoesNotTriggerThisTierSPolicy.zh : eventApprovalAssessmentText.thisPlanDoesNotTriggerThisTierSPolicy.en}</p>}
    </div>)}</div></details>
  </section>
}
