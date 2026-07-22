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

const hasBilingualText = (value: MultilingualString) => Boolean(value.zh.trim() && value.en.trim())
const isScore = (value: number | null) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5

export const getEventRamSubmissionIssues = (ram: EventRamDraft, hasSavedEvent: boolean): string[] => {
  const issues: string[] = []

  if (!hasSavedEvent) issues.push('event')
  if (!hasBilingualText(ram.activityName)) issues.push('activityName')
  if (!hasBilingualText(ram.activityDescription)) issues.push('activityDescription')
  if (!hasBilingualText(ram.participantAgeRange)) issues.push('participantAgeRange')
  if (!Number.isInteger(ram.participantCount) || Number(ram.participantCount) < 1) issues.push('participantCount')
  if (typeof ram.isOuting !== 'boolean') issues.push('isOuting')
  if (ram.missingInformation.length > 0) issues.push('missingInformation')
  if (!ram.leaderConfirmed) issues.push('leaderConfirmed')

  if (ram.hazards.length === 0) {
    issues.push('hazards')
  } else {
    ram.hazards.forEach((hazard, index) => {
      if (!hasBilingualText(hazard.hazard)
        || !isScore(hazard.likelihood)
        || !isScore(hazard.impact)
        || hazard.riskScore !== Number(hazard.likelihood) * Number(hazard.impact)
        || !hasBilingualText(hazard.controlMeasures)
        || !hazard.personResponsible.trim()) {
        issues.push(`hazards.${index}`)
      }
    })
  }

  if (ram.emergencyContacts.length === 0) {
    issues.push('emergencyContacts')
  } else {
    ram.emergencyContacts.forEach((contact, index) => {
      if (!hasBilingualText(contact.role) || !contact.name.trim() || !contact.phone.trim()) {
        issues.push(`emergencyContacts.${index}`)
      }
    })
  }

  if (ram.isOuting) {
    const safety = ram.outingSafety
    if (safety.transportRequired === null
      || !safety.venueRiskAssessed
      || !safety.firstAidKitAvailable
      || !safety.trainedFirstAiderName.trim()
      || !safety.trainedFirstAiderQualificationConfirmed
      || !safety.participantHealthNeedsReviewed
      || !safety.weatherPlanReviewed) {
      issues.push('outingSafety')
    }
    if (safety.transportRequired
      && (!safety.licensedDriverConfirmed || !safety.vehicleRegistrationConfirmed || !safety.vehicleWofConfirmed)) {
      issues.push('outingTransport')
    }
  }

  return issues
}
