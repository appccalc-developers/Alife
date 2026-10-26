import { ramGovernanceText } from '../i18n/ramGovernance.ts'
import { activityAttributes, activityAttributeCodes, validActivityAttributes } from '../../../shared/activityAttributes.ts'
import { ramActivityAttributesText } from '../i18n/ramActivityAttributes.ts'
export { activityAttributes, activityAttributeCodes }
import type { EventRamAssessmentRecord, MultilingualString } from './event'
import type { EventPlanSnapshot } from './eventComposition'
export type RamText = MultilingualString
export type RamSyncState = { status: 'Draft' | 'Syncing' | 'AI_Updated' | 'Outdated' | 'Reviewed'; isUpdated: boolean; lastEvaluatedAt: string | null; error: string | null; reviewedByMemberId: string | null; reviewedAt: string | null }
export type RamSyncOverview = { isRequired: boolean; eTag: string; sync: RamSyncState; canReview: boolean; canRetry: boolean }
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
export type RamActivity = { id: string; attributes: string[]; name: RamText; conditions?: RamText; occurrenceId?: string | null }
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
export type RamEventPlanContext = { activityPlan?: {data:import('./eventActivityPlan').ActivityPlanData;eTag:string}; programme?: { title: RamText; startUtc: string; endUtc: string; items: { title: RamText; description: RamText; startOffsetMinutes: number; durationMinutes: number }[] }[]; eventId: string; groupId: string; title: RamText; startUtc: string; endUtc: string; acceptedPlan: EventPlanSnapshot | null; venues?: { name: RamText; startUtc: string; endUtc: string; capacity: number }[]; weeklyVenues?: { name: RamText; firstDate: string; lastDate: string | null; startMinute: number; endMinute: number; timeZone: string; capacity: number; releasedDates: string[] }[]; rosterNeeds?: { roleCode: string; requiredCount: number; startOffsetMinutes: number; endOffsetMinutes: number; eligibilityCode: string }[]; details?: Record<string, unknown>; reports?: { moduleCode: string; revisionId: string; version: number; text: RamText }[]; registrationRulesVersion?: number; registrationRules?: import('../services/eventRegistrationWorkService').RegistrationRules }
export type RamWorkspace = { assessment: RamAssessment | null; policy: RamPolicy | null; latestPolicy?: RamPolicy | null; history: RamRevision[]; actions: RamAction[]; onsiteCandidates: { memberId: string; name: string }[]; canEdit: boolean; canAudit: boolean; currentMemberId: string; isRequired: boolean; eventPlanContext?: RamEventPlanContext | null }
export type RamPrint = { revision: RamRevision; ramDataJson: string; policy: RamPolicy | null; actions: RamAction[]; isCurrent: boolean; validity: string; isDraft: boolean }
export const ramActivityContentName = (code: string): RamText =>
  code === 'generic' ? ramActivityAttributesText.allActivities : ramActivityAttributesText.labels[code as keyof typeof ramActivityAttributesText.labels]
export function ramApplicableQuestions(questions: RamQuestion[], activity: Pick<RamActivity, 'attributes'>): RamQuestion[] {
  const attributes = activityAttributes(activity), seen = new Set<string>()
  return questions.filter(q => {
    if (q.activityType !== 'generic' && !attributes.includes(q.activityType)) return false
    const key = ramQuestionKey(q)
    if (seen.has(key)) return false
    seen.add(key); return true
  })
}
export const ramDefaultScales: Pick<RamPolicyData, 'likelihood' | 'impact'> = {
  likelihood: [
    { value: 1, label: { ...ramGovernanceText.likelihoodLabel }, description: { ...ramGovernanceText.likelihoodDescription } },
    { value: 2, label: { ...ramGovernanceText.likelihoodLabelUnlikely }, description: { ...ramGovernanceText.likelihoodDescriptionText529ChanceOfOccurring } },
    { value: 3, label: { ...ramGovernanceText.likelihoodLabelModerate }, description: { ...ramGovernanceText.likelihoodDescriptionText3059ChanceOfOccurring } },
    { value: 4, label: { ...ramGovernanceText.likelihoodLabelLikely }, description: { ...ramGovernanceText.likelihoodDescriptionText6079ChanceOfOccurring } },
    { value: 5, label: { ...ramGovernanceText.likelihoodLabelAlmostCertain }, description: { ...ramGovernanceText.likelihoodDescriptionText80OrGreaterChanceOfOccurring } },
  ],
  impact: [
    { value: 1, label: { ...ramGovernanceText.impactLabel }, description: { ...ramGovernanceText.impactDescription } },
    { value: 2, label: { ...ramGovernanceText.impactLabelMinor }, description: { ...ramGovernanceText.impactDescriptionBasicFirstAidRecoveryInLessThanOneWeek } },
    { value: 3, label: { ...ramGovernanceText.likelihoodLabelModerate }, description: { ...ramGovernanceText.impactDescriptionAdvancedFirstAidOrMedicalVisitRecoveryIn16Weeks } },
    { value: 4, label: { ...ramGovernanceText.impactLabelMajor }, description: { ...ramGovernanceText.impactDescriptionHospitalOrEmergencyTreatmentRecoveryLongerThanSixWeeks } },
    { value: 5, label: { ...ramGovernanceText.impactLabelCatastrophic }, description: { ...ramGovernanceText.impactDescriptionImmediateEmergencyResponsePermanentDisabilityOrDeathOrHospitalisationLongerThanSixWeeks } },
  ],
}
export const ramAlphaDemoLevel = (likelihood: number, impact: number): Exclude<RamLevel, 'Incomplete'> => {
  const score = likelihood * impact
  return score >= 20 ? 'Red' : score >= 6 ? 'Yellow' : 'Green'
}
export const applyRamAlphaDemoMatrix = (policy: RamPolicyData): RamPolicyData => ({
  ...policy,
  matrix: policy.matrix.map(cell => ({ ...cell, level: ramAlphaDemoLevel(cell.likelihood, cell.impact) })),
})
export const ramText = (): RamText => ({ en: '', zh: '' })
export const displayRamText = (text: RamText | undefined, zh: boolean) => text?.[zh ? 'zh' : 'en'] || text?.[zh ? 'en' : 'zh'] || ''
export const ramQuestionKey = (question: RamQuestion) => `${question.activityType}:${question.code}`
export function parseRamDraft(raw: string | undefined): RamDraft {
  if (raw) {
    const data = JSON.parse(raw) as RamDraft
    if (data.schemaVersion !== 2 || !Array.isArray(data.activities) || data.activities.some(activity => !validActivityAttributes(activity.attributes))) throw new TypeError('ram.schema.invalid')
    return data
  }
  return { schemaVersion: 2, activities: [], hazards: [], answers: [], authorAttendsAndLeads: null, onsiteMemberId: null, participantCount: null,
    isOuting: false, isOvernight: false, isHighRisk: false, weatherConfirmation: ramText(), accommodation: ramText(), transport: ramText() }
}

export const ramActionLabels: Record<string, RamText> = ramGovernanceText.ramActionLabels
export const ramValidityLabels: Record<string, RamText> = ramGovernanceText.ramValidityLabels
