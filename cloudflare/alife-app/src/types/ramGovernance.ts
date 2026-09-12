import type { EventRamAssessmentRecord, MultilingualString } from './event'
export type RamText = MultilingualString
export type RamLevel = 'Green' | 'Yellow' | 'Red' | 'Incomplete'
export type RamScale = { value: number; label: RamText; description: RamText }
export type RamQuestion = { code: string; activityType: string; categoryCode: string; text: RamText; guidance: RamText }
export type RamPolicyData = {
  likelihood: RamScale[]; impact: RamScale[]
  matrix: { likelihood: number; impact: number; level: RamLevel | null }[]
  categories: { code: string; name: RamText; guidance: RamText }[]
  questions: RamQuestion[]; reviewRules: { reviewReminderDays: number }; source: string
}
export type RamPolicy = { id: string | null; churchId: string; version: number; isPublished: boolean; eTag: string; data: RamPolicyData; publishedByMemberId?: string; publishedUtc?: string }
export type RamActivity = { id: string; type: string; name: RamText }
export type RamRisk = {
  id: string; activityId: string; categoryCode: string; hazard: RamText; consequence: RamText
  likelihood: number | null; impact: number | null; riskScore?: number | null; initialLevel?: RamLevel
  controlMeasures: RamText; personResponsible: string
  residualLikelihood: number | null; residualImpact: number | null; residualScore?: number | null; residualLevel?: RamLevel
  additionalAction: RamText
}
export type RamAnswer = { activityId: string; questionCode: string; answer: RamText; notApplicable: boolean; reason: RamText }
export type RamDraft = {
  schemaVersion: 2; activities: RamActivity[]; hazards: RamRisk[]; answers: RamAnswer[]
  authorAttendsAndLeads: boolean | null; onsiteMemberId: string | null; participantCount: number | null
  isOuting: boolean; isOvernight: boolean; isHighRisk: boolean
  weatherConfirmation: RamText; accommodation: RamText; transport: RamText
  [key: string]: unknown
}
export type RamAssessment = EventRamAssessmentRecord & { schemaVersion: number; eTag: string; policyVersionId: string | null; currentRevisionId: string | null; validity: string; residualLevel: RamLevel; authorMemberId: string | null; reviewRequested: boolean }
export type RamRevision = { id: string; version: number; schemaVersion: number; policyVersionId: string | null; contentHash: string; residualLevel: RamLevel; authorMemberId: string; onsiteMemberId: string | null; createdUtc: string }
export type RamAction = { id: string; revisionId: string; actorMemberId: string; action: string; reason: string; healthSafetySigned: boolean; createdUtc: string }
export type RamWorkspace = { assessment: RamAssessment | null; policy: RamPolicy | null; latestPolicy?: RamPolicy | null; history: RamRevision[]; actions: RamAction[]; onsiteCandidates: { memberId: string; name: string }[]; canEdit: boolean; canAudit: boolean; currentMemberId: string; isRequired: boolean }
export type RamPrint = { revision: RamRevision; ramDataJson: string; policy: RamPolicy | null; actions: RamAction[]; isCurrent: boolean; validity: string; isDraft: boolean }
export const ramActivityTypes = ['generic', 'hiking', 'water', 'sport', 'transport', 'camp', 'meal', 'outdoor', 'other'] as const
export const ramActivityLabels: Record<string, RamText> = {
  generic: { en: 'General activity', zh: '通用活动' }, hiking: { en: 'Hiking', zh: '徒步' }, water: { en: 'Water activity', zh: '水上活动' }, sport: { en: 'Sport', zh: '运动' }, transport: { en: 'Transport', zh: '交通' }, camp: { en: 'Camp / overnight', zh: '营会／过夜' }, meal: { en: 'Shared meal', zh: '聚餐' }, outdoor: { en: 'Other outdoor activity', zh: '其他户外活动' }, other: { en: 'Other (general questions)', zh: '其他（通用题集）' },
}
export const ramText = (): RamText => ({ en: '', zh: '' })
export const displayRamText = (text: RamText | undefined, zh: boolean) => text?.[zh ? 'zh' : 'en'] || text?.[zh ? 'en' : 'zh'] || ''
export const ramQuestionKey = (question: RamQuestion) => `${question.activityType}:${question.code}`
export function upgradeRam(raw: string | undefined): RamDraft {
  const old = raw ? JSON.parse(raw) : {}
  if (old.schemaVersion === 2) return old as RamDraft
  const activity = { id: 'legacy-activity', type: 'generic', name: old.activityName || ramText() }
  return { ...old, schemaVersion: 2, activities: [activity], answers: [],
    hazards: (old.hazards || []).map((r: Partial<RamRisk>, i: number) => ({ ...r, id: r.id || `legacy-${i}`, activityId: activity.id, categoryCode: '', consequence: ramText(), residualLikelihood: null, residualImpact: null, residualScore: null, residualLevel: 'Incomplete', additionalAction: ramText() })),
    authorAttendsAndLeads: null, onsiteMemberId: null, participantCount: old.participantCount || null,
    isOuting: old.isOuting === true, isOvernight: false, isHighRisk: false, weatherConfirmation: ramText(), accommodation: ramText(), transport: ramText(),
  }
}

export const ramActionLabels: Record<string, RamText> = {
  'snapshot-draft': { en: 'Draft snapshot saved', zh: '已保存草稿快照' }, 'request-confirmation': { en: 'Personal confirmation requested', zh: '已请求本人确认' },
  confirm: { en: 'Personally confirmed', zh: '本人已确认' }, submit: { en: 'Submitted for review', zh: '已提交审核' }, approve: { en: 'Approved', zh: '已批准' },
  return: { en: 'Returned for changes', zh: '退回修改' }, 'request-review': { en: 'Re-review requested', zh: '已请求重审' },
  'legacy-submitted': { en: 'Historical submission', zh: '历史提交' }, 'legacy-approved': { en: 'Historical approval', zh: '历史批准' },
}
export const ramValidityLabels: Record<string, RamText> = {
  Legacy: { en: 'Legacy record', zh: '旧版记录' }, Draft: { en: 'Draft', zh: '草稿' }, ReviewRequired: { en: 'Re-review required', zh: '需重审' },
  AwaitingConfirmation: { en: 'Awaiting personal confirmation', zh: '等待本人确认' }, Confirmed: { en: 'Personally confirmed', zh: '本人已确认' },
  AwaitingReview: { en: 'Awaiting independent review', zh: '等待独立审核' }, Valid: { en: 'Approved and valid', zh: '已批准且有效' },
  Returned: { en: 'Returned for changes', zh: '退回修改' }, Historical: { en: 'Historical evidence', zh: '历史记录' },
}
