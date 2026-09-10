import type { EventActivityType } from '../types/eventComposition'
import { creationSettings, type CreationDraft } from './eventCreationDraft.ts'
import { detailFields, type DetailsSnapshot, type DetailsResult, type EventDetailsForm } from '../../../shared/eventDetails.ts'

export function detailsForm(draft: CreationDraft, type: EventActivityType): EventDetailsForm {
  const settings = creationSettings(draft, type)
  return {
    title: draft.title, description: draft.description, locationName: draft.locationName,
    startLocal: draft.startLocal || null, endLocal: draft.endLocal || null, timeZone: draft.timeZone || null,
    visibility: settings.visibility, registrationMode: settings.registrationMode,
    maxCapacity: settings.registrationMode === 'required' && /^\d+$/.test(draft.maxCapacity) && Number(draft.maxCapacity) > 0 ? Number(draft.maxCapacity) : null,
    intervalWeeks: /^[1-9]\d*$/.test(draft.intervalWeeks ?? '1') && Number(draft.intervalWeeks ?? '1') <= 52 ? Number(draft.intervalWeeks ?? '1') : null,
  }
}
export function detailsSnapshot(draft: CreationDraft, type: EventActivityType, isSeries: boolean, revision: number): DetailsSnapshot {
  return { version: 1, revision, form: detailsForm(draft, type), sources: draft.detailSources ?? {}, isSeries, archetypeCode: draft.archetypeCode, activityTypeCode: draft.activityTypeCode }
}
export function applyDetailsResult(draft: CreationDraft, result: DetailsResult): CreationDraft {
  const next = { ...draft, detailSources: result.sources, overrides: { ...draft.overrides } }
  for (const field of result.adoptedFields) {
    if (!detailFields.includes(field)) continue
    if (field === 'visibility') { if (result.form.visibility) next.overrides.visibility = result.form.visibility; else { delete next.overrides.visibility; next.detailSources.visibility = 'unresolved' } continue }
    if (field === 'registrationMode') { if (result.form.registrationMode) next.overrides.registrationMode = result.form.registrationMode; else { delete next.overrides.registrationMode; next.detailSources.registrationMode = 'unresolved' } continue }
    if (field === 'title' || field === 'description' || field === 'locationName') next[field] = result.form[field]
    else next[field] = result.form[field] == null ? '' : String(result.form[field])
  }
  return next
}
