import type { EventDto, EventRamDraft, EventRamAssessmentRecord, MultilingualString } from '../types/event'

const emptyText = (): MultilingualString => ({ zh: '', en: '' })

export const createEmptyEventRamDraft = (event?: Partial<EventDto> | null): EventRamDraft => ({
  activityName: event?.title ? { ...event.title } : emptyText(),
  activityDescription: event?.description ? { ...event.description } : emptyText(),
  participantCount: null,
  participantAgeRange: emptyText(),
  isOuting: null,
  hazards: [],
  emergencyContacts: [],
  outingSafety: {
    transportRequired: null,
    licensedDriverConfirmed: null,
    vehicleRegistrationConfirmed: null,
    vehicleWofConfirmed: null,
    venueRiskAssessed: null,
    firstAidKitAvailable: null,
    trainedFirstAiderName: '',
    trainedFirstAiderQualificationConfirmed: null,
    participantHealthNeedsReviewed: null,
    weatherPlanReviewed: null,
  },
  missingInformation: [],
  leaderConfirmed: false,
})

export const parseEventRam = (record: EventRamAssessmentRecord): EventRamDraft => {
  try {
    const parsed = JSON.parse(record.ramDataJson) as Partial<EventRamDraft>
    const empty = createEmptyEventRamDraft()
    return {
      ...empty,
      ...parsed,
      activityName: { ...empty.activityName, ...parsed.activityName },
      activityDescription: { ...empty.activityDescription, ...parsed.activityDescription },
      participantAgeRange: { ...empty.participantAgeRange, ...parsed.participantAgeRange },
      hazards: Array.isArray(parsed.hazards) ? parsed.hazards : [],
      emergencyContacts: Array.isArray(parsed.emergencyContacts) ? parsed.emergencyContacts : [],
      outingSafety: { ...empty.outingSafety, ...parsed.outingSafety },
      missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation : [],
      leaderConfirmed: parsed.leaderConfirmed === true,
    }
  } catch {
    return createEmptyEventRamDraft()
  }
}
