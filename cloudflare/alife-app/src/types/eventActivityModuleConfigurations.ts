import type { LocalizedText } from './eventComposition'

export type ProjectModuleKind = 'meal' | 'travel' | 'stay' | 'programme' | 'roster'
export type ProjectModuleDetails = {
  occurrenceId: string | null
  meal?: { serviceMethod: LocalizedText; preparationPlace: LocalizedText; dietaryHandling: LocalizedText; foodSafetyPlan: LocalizedText }
  travel?: { origin: LocalizedText; destination: LocalizedText; timetable: LocalizedText; journeyId: string | null }
  stay?: { site: LocalizedText; checkInUtc: string | null; checkOutUtc: string | null; roomingPlan: LocalizedText }
  programme?: { programItemIds: string[]; productionNotes: LocalizedText }
  roster?: { serviceSlotIds: string[]; staffingNotes: LocalizedText }
}
export type ProjectModuleConfiguration = { id: string; activityId: string; occurrenceId: string | null; kind: ProjectModuleKind; details: ProjectModuleDetails; eTag: string; updatedUtc: string }
export type ProjectModuleConfigurationWorkspace = { items: ProjectModuleConfiguration[]; canEditKinds: ProjectModuleKind[] }
