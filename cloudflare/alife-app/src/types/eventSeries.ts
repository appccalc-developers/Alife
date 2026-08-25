export type EventSeriesText = { en: string; zh: string }
export type EventSeriesModule = 'venue' | 'registration' | 'finance' | 'ram' | 'roster' | 'programme'

export type EventSeriesInstance = {
  eventId: string
  occurrenceDate: string
  startUtc: string
  endUtc: string
}

export type EventSeries = {
  id: string
  groupId: string
  name: EventSeriesText
  description: EventSeriesText
  timeZoneId: string
  anchorLocalDate: string
  startTimeMinutes: number
  durationMinutes: number
  intervalWeeks: number
  generationHorizonWeeks: number
  lowHorizonWeeks: number
  visibility: 'groupVisible' | 'churchVisible' | 'public'
  defaultModules: EventSeriesModule[]
  isActive: boolean
  needsGeneration: boolean
  generatedThroughLocalDate?: string | null
  instances: EventSeriesInstance[]
  updatedUtc: string
}

export type SaveEventSeries = {
  nameEn: string
  nameZh: string
  descriptionEn: string
  descriptionZh: string
  timeZoneId: string
  anchorLocalDate: string
  startTimeMinutes: number
  durationMinutes: number
  intervalWeeks: number
  generationHorizonWeeks: number
  lowHorizonWeeks: number
  visibility: EventSeries['visibility']
  defaultModules: EventSeriesModule[]
  isActive: boolean
}

export type EventSeriesGenerationResult = {
  seriesId: string
  createdCount: number
  existingCount: number
  fromLocalDate: string
  throughLocalDate: string
  createdEventIds: string[]
}
