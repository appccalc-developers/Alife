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
  markdown?: string | null
  result?: EventDto | null
}
