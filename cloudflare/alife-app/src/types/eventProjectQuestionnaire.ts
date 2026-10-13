import type { LocalizedText } from './eventComposition'

export const projectQuestionCodes = ['projectSelection', 'ageEligibility', 'capacityLimit', 'projectFee', 'minorsParticipate', 'spaceReservation', 'serviceTeam', 'programmeProduction', 'safetyReview', 'projectNotices', 'multiZoneOperations', 'foodService', 'organizedTransport', 'organizedStay', 'hikingRouteSafety', 'waterSafety', 'sportSafety', 'weatherPlan', 'fitnessAttestation'] as const
export const generalProjectQuestionCodes = ['projectSelection', 'ageEligibility', 'capacityLimit', 'projectFee', 'minorsParticipate', 'spaceReservation', 'serviceTeam', 'programmeProduction'] as const
export const movedEventQuestionFacts = {
  safetyReview: 'safety.requiresRam',
  projectNotices: 'comms.followupRequired',
  multiZoneOperations: 'scale.multiZone',
} as const
export const movedEventQuestionModules = {
  'safety.requiresRam': 'SAFETY.RAM',
  'comms.followupRequired': 'COMMS.FOLLOWUP',
  'scale.multiZone': 'FESTIVAL.OPERATIONS',
} as const
export type ProjectAnswerValue = 'yes' | 'no' | 'unknown'
export type ProjectAnswer = { value: ProjectAnswerValue; source: 'template' | 'human'; confirmed: boolean }
export type EventProjectQuestionDefinition = { code: string; question: LocalizedText; appliesToAttributes: string[]; requiredModules: string[]; dependencies: string[]; unavailableModules: string[] }
export type ProjectConfigurationDefaults = { eligibility?: LocalizedText; minimumAge?: number; maximumAge?: number; capacity?: number; allowWaitlist?: boolean; requiresGuardianConsent?: boolean; feeMinor?: number; currency?: string; feeChargeScope?: 'perOccurrence' | 'oncePerSeries'; terms?: LocalizedText }
export type EventTemplatePresetProject = { presetKey: string; name: LocalizedText; conditions: LocalizedText; attributes: string[]; defaultAnswers: Record<string, ProjectAnswerValue>; repeatForEachOccurrence: boolean; defaultConfiguration?: ProjectConfigurationDefaults; eventFactSuggestions?: string[] }
export const validProjectAnswerValue = (value: unknown): value is ProjectAnswerValue => value === 'yes' || value === 'no' || value === 'unknown'
