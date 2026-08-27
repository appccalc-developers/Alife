import type { EventDto, EventVisibility, MultilingualString } from '../types/event'
import type { EventActivityType, EventArchetype } from '../types/eventComposition'

export type CreationDetails = {
  title: MultilingualString
  description: MultilingualString
  locationName: MultilingualString
}

export const resolveActivityType = (
  archetypes: EventArchetype[],
  archetypeCode: string,
  activityTypeCode: string,
): EventActivityType | null => {
  const archetype = archetypes.find((item) => item.code === archetypeCode)
  return archetype?.activityTypes.find((item) => item.code === activityTypeCode) ?? null
}

export const applyActivityTypePreset = (type: EventActivityType): {
  selectedModules: string[]
  visibility: EventVisibility
  registrationMode: 'none' | 'required'
  useRecommendedWorkflow: boolean
} => ({
  selectedModules: ['TEAM.WORK', ...type.preselectedModules],
  visibility: type.defaults.visibility,
  registrationMode: type.defaults.registrationMode,
  useRecommendedWorkflow: Boolean(type.recommendedWorkflowTemplateCode),
})

// AI output is deliberately narrowed to presentation copy. It cannot mutate
// archetype/type/module/workflow choices or any confirmed composition fact.
export const applyAiCopyDraft = (_current: CreationDetails, aiDraft: EventDto): CreationDetails => ({
  title: aiDraft.title,
  description: aiDraft.description,
  locationName: aiDraft.locationName,
})

export const deriveAiCandidateFacts = (aiDraft: EventDto): Record<string, boolean> => {
  const candidates: Record<string, boolean> = {}
  if ((aiDraft.baseFeePerAdult ?? 0) > 0 || (aiDraft.baseFeePerChild ?? 0) > 0) {
    candidates['money.hasMoneyFlow'] = true
  }
  if (aiDraft.ram?.outingSafety.transportRequired != null) {
    candidates['move.transportRequired'] = aiDraft.ram.outingSafety.transportRequired
  }
  if (aiDraft.ram && (aiDraft.ram.isOuting === true || aiDraft.ram.hazards.length > 0)) {
    candidates['safety.requiresRam'] = true
  }
  return candidates
}

export const proposalIsCurrent = (proposalSignature: string, currentSignature: string) =>
  Boolean(proposalSignature) && proposalSignature === currentSignature
