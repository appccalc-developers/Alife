export type MultilingualString = {
  zh: string
  en: string
}

export type EventRuleDto = {
  ruleKey: string
  displayMessage: MultilingualString
  isMandatory: boolean
}

export type OptionalActivityDto = {
  id?: string
  name: MultilingualString
  extraFee: number
}

export type RamMissingInformation = {
  code: string
  fieldPath: string
  message: MultilingualString
}

export type RamHazard = {
  id?: string
  hazard: MultilingualString
  likelihood: number | null
  impact: number | null
  riskScore: number | null
  controlMeasures: MultilingualString
  personResponsible: string
}

export type RamEmergencyContact = {
  role: MultilingualString
  name: string
  phone: string
}

export type RamOutingSafety = {
  transportRequired: boolean | null
  licensedDriverConfirmed: boolean | null
  vehicleRegistrationConfirmed: boolean | null
  vehicleWofConfirmed: boolean | null
  venueRiskAssessed: boolean | null
  firstAidKitAvailable: boolean | null
  trainedFirstAiderName: string
  trainedFirstAiderQualificationConfirmed: boolean | null
  participantHealthNeedsReviewed: boolean | null
  weatherPlanReviewed: boolean | null
}

export type EventRamDraft = {
  activityName: MultilingualString
  activityDescription: MultilingualString
  participantCount: number | null
  participantAgeRange: MultilingualString
  isOuting: boolean | null
  hazards: RamHazard[]
  emergencyContacts: RamEmergencyContact[]
  outingSafety: RamOutingSafety
  missingInformation: RamMissingInformation[]
  leaderConfirmed: boolean
}

export type EventRamStatus = 'draft' | 'awaitingReview' | 'approved'

export type EventRamAssessmentRecord = {
  eventId: string
  groupId: string
  ramDataJson: string
  status: EventRamStatus
  submittedByMemberId?: string | null
  submittedUtc?: string | null
  approvedByMemberId?: string | null
  approvedUtc?: string | null
  createdUtc: string
  updatedUtc: string
}

export type EventDto = {
  id?: string
  organizerId?: string
  organizerDisplayName?: string
  personResponsible?: string
  purpose?: MultilingualString
  title: MultilingualString
  description: MultilingualString
  locationName: MultilingualString
  startDate: string
  endDate: string
  registrationDeadline: string
  maxCapacity: number
  capacityUnit: 'Families' | 'People'
  hardConstraints: EventRuleDto[]
  optionalActivities: OptionalActivityDto[]
  baseFeePerAdult?: number | null
  baseFeePerChild?: number | null
  currency: string
  posterImageUrl?: string | null
  galleryUrls: string[]
  legacySummary?: MultilingualString | null
  contactProfileIds?: string[]
  ram?: EventRamDraft
}

export type ExtractEventFromChatResponse = {
  responseMode: 'markdown' | 'result'
  sessionId?: string
  markdown?: string | null
  result?: EventDto | null
  context?: MultilingualString | null
  legacySummary?: MultilingualString | null
}

export type EventSessionState = {
  sessionId: string
  eventDraft: EventDto | null
  legacySummary: MultilingualString | null
  chatHistory: Array<{ role: 'user' | 'model'; text: string }>
  updatedAt: string
}

export type EventSessionSsePayload = {
  type: 'eventDraft'
  state: EventSessionState
}

export type GroupEventRecord = {
  id: string
  groupId: string
  createdByMemberId: string
  titleEn: string
  titleZh: string
  startDate: string
  endDate: string
  eventDataJson: string
  createdUtc: string
  updatedUtc: string
  contactProfileIds?: string[]
  ramStatus?: EventRamStatus
}
