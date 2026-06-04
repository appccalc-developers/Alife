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

export type EventDto = {
  id?: string
  organizerId?: string
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
}
