import { detailsStepText } from '../../../i18n/detailsStep.ts'
import { useId, useRef, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import EventTextTranslation from '../EventTextTranslation'
import { CalendarDays, ChevronDown, Globe2, Languages, NotebookPen } from 'lucide-react'
import type { Bilingual, DetailField } from '../../../../../shared/eventDetails'
import type { EventActivityType, EventArchetype } from '../../../types/eventComposition'
import { creationSettings, invalidateArrangementConfirmation, type CreationDraft } from '../../../utils/eventCreationDraft'
import { creationInput, localText } from './CreationFields'
import { useDetailsWorkspace } from './DetailsWorkspace'

function DetailGroup({ field, label, children }: { field: string; label: string; children: ReactNode }) {
  const { updatedFields } = useDetailsWorkspace()
  return <fieldset tabIndex={-1} data-detail-field={field} data-ai-updated={updatedFields.includes(field)} className="event-detail-field"><legend>{label}</legend>{children}</fieldset>
}
export function DetailsBilingualField({ field, label, value, onChange, zh, multiline = false, maxLength, translationGroupId }: {
  field: string; label: string; value: Bilingual; onChange: (value: Bilingual) => void; zh: boolean; multiline?: boolean; maxLength?: number; translationGroupId?: string
}) {
  const { readOnly } = useDetailsWorkspace(), id = useId()
  const translation = useRef<HTMLDetailsElement>(null)
  const primary = zh ? 'zh' : 'en', secondary = zh ? 'en' : 'zh'
  const input = (locale: 'en' | 'zh') => <label className="event-detail-language" htmlFor={`${id}-${locale}`}><span id={`${id}-${locale}-label`}>{locale === 'zh' ? detailsStepText.english.zh : detailsStepText.english.en}</span>{multiline
    ? <textarea id={`${id}-${locale}`} aria-labelledby={`${id}-${locale}-label`} data-locale={locale} maxLength={maxLength} disabled={readOnly} rows={3} className={`${creationInput} py-2`} value={value[locale]} onChange={event => onChange({ ...value, [locale]: event.target.value })} />
    : <input id={`${id}-${locale}`} aria-labelledby={`${id}-${locale}-label`} data-locale={locale} maxLength={maxLength} disabled={readOnly} className={creationInput} value={value[locale]} onChange={event => onChange({ ...value, [locale]: event.target.value })} />}</label>
  return <DetailGroup field={field} label={label}>
    {input(primary)}
    {translationGroupId && !readOnly ? <EventTextTranslation groupId={translationGroupId} value={value} textType={label} maxLength={maxLength} onChange={next => { onChange(next); if (translation.current) translation.current.open = true }} /> : null}
    <details ref={translation} className="event-detail-translation"><summary><Languages size={15} aria-hidden="true" /><span>{secondary === 'zh' ? detailsStepText.english.zh : detailsStepText.english.en}</span><span className={value[secondary].trim() ? '' : 'event-detail-pending'}>{value[secondary].trim() ? (zh ? detailsStepText.added.zh : detailsStepText.added.en) : (zh ? detailsStepText.missing.zh : detailsStepText.missing.en)}</span><ChevronDown size={15} aria-hidden="true" /></summary>{input(secondary)}</details>
  </DetailGroup>
}

export default function DetailsStep({ draft, setDraft: updateDraft, zh, type, archetype, ai, saved = false, registrationRulesManaged = false, groupId }: {
  draft: CreationDraft; setDraft: Dispatch<SetStateAction<CreationDraft>>; zh: boolean; groupId: string
  type: EventActivityType; archetype: EventArchetype; ai: ReactNode; saved?: boolean; registrationRulesManaged?: boolean
}) {
  const { readOnly } = useDetailsWorkspace()
  const settings = creationSettings(draft, type)
  const setDraft: typeof updateDraft = action => updateDraft(previous => {
    if (readOnly) return previous
    const next = typeof action === 'function' ? action(previous) : action
    const conditions = (value: CreationDraft) => JSON.stringify([value.startLocal, value.endLocal, value.timeZone, value.intervalWeeks, value.maxCapacity, value.locationName])
    if (conditions(previous) !== conditions(next)) return invalidateArrangementConfirmation(next)
    if (JSON.stringify(previous.overrides) !== JSON.stringify(next.overrides)) return invalidateArrangementConfirmation(invalidateArrangementConfirmation(next, 'PEOPLE.REGISTRATION'), 'COMMS.FOLLOWUP')
    return next
  })
  const mark = (current: CreationDraft, field: DetailField) => ({ ...current.detailSources, [field]: 'human' as const })
  const textField = (key: 'startLocal' | 'endLocal' | 'maxCapacity' | 'timeZone' | 'intervalWeeks', label: string, inputType = 'text') => <DetailGroup field={key} label={label}><input aria-label={label} disabled={readOnly} className={creationInput} type={inputType} value={draft[key] ?? ''} min={inputType === 'number' ? 1 : undefined} max={key === 'intervalWeeks' ? 52 : undefined} step={inputType === 'number' ? 1 : undefined} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value, detailSources: mark(current, key) }))} /></DetailGroup>
  const bilingual = (key: 'title' | 'description' | 'locationName', label: string) => <DetailsBilingualField translationGroupId={groupId} field={key} label={label} value={draft[key]} zh={zh} multiline={key === 'description'} onChange={value => setDraft(current => ({ ...current, [key]: value, detailSources: mark(current, key) }))} />
  const timesUnconfirmed = [draft.detailSources?.startLocal, draft.detailSources?.endLocal].some(source => source !== 'human' && source !== 'explicit')
  return <div className="event-details-sections">
    <section className="event-details-section" aria-label={zh ? detailsStepText.nameAndDescription.zh : detailsStepText.nameAndDescription.en}>
      <header><NotebookPen size={20} aria-hidden="true" /><h3>{zh ? detailsStepText.nameAndDescription.zh : detailsStepText.nameAndDescription.en}</h3><span>{localText(type.name, zh)}</span></header>
      {bilingual('title', zh ? detailsStepText.eventTitle.zh : detailsStepText.eventTitle.en)}
      {bilingual('description', zh ? detailsStepText.description.zh : detailsStepText.description.en)}
    </section>
    <section className="event-details-section" aria-label={zh ? detailsStepText.timeAndPlace.zh : detailsStepText.timeAndPlace.en}>
      <header><CalendarDays size={20} aria-hidden="true" /><h3>{zh ? detailsStepText.timeAndPlace.zh : detailsStepText.timeAndPlace.en}</h3></header>
      <details className="event-detail-zone"><summary><Globe2 size={16} aria-hidden="true" /><span>{draft.timeZone || (zh ? detailsStepText.chooseAnEventTimeZone.zh : detailsStepText.chooseAnEventTimeZone.en)}</span><span>{zh ? detailsStepText.localTime.zh : detailsStepText.localTime.en}</span><ChevronDown size={16} aria-hidden="true" /></summary>{textField('timeZone', zh ? detailsStepText.eventTimeZone.zh : detailsStepText.eventTimeZone.en)}</details>
      <div className="event-details-time-pair">{textField('startLocal', zh ? detailsStepText.startTime.zh : detailsStepText.startTime.en, 'datetime-local')}{textField('endLocal', zh ? detailsStepText.endTime.zh : detailsStepText.endTime.en, 'datetime-local')}</div>
      {timesUnconfirmed ? <p className="event-detail-pending">{zh ? detailsStepText.prefilledTimesNeedConfirmationReviewAndEditThemOr.zh : detailsStepText.prefilledTimesNeedConfirmationReviewAndEditThemOr.en}</p> : null}
      {archetype.isSeries ? <div className="event-detail-recurrence">{textField('intervalWeeks', zh ? detailsStepText.repeatEveryNWeeks.zh : detailsStepText.repeatEveryNWeeks.en, 'number')}<p>{saved ? (zh ? detailsStepText.recurrenceChangesAddFutureOccurrencesAndPreserveExistingOccurrences.zh : detailsStepText.recurrenceChangesAddFutureOccurrencesAndPreserveExistingOccurrences.en) : (zh ? detailsStepText.repeatsEveryWeekSSchedulingTheNext12Weeks.zh(draft.intervalWeeks || '1') : detailsStepText.repeatsEveryWeekSSchedulingTheNext12Weeks.en(draft.intervalWeeks || '1'))}</p></div> : null}
      {bilingual('locationName', zh ? detailsStepText.location.zh : detailsStepText.location.en)}
    </section>
    <section className="event-details-section" aria-label={zh ? detailsStepText.visibilityAndRegistration.zh : detailsStepText.visibilityAndRegistration.en}>
      <header><Globe2 size={20} aria-hidden="true" /><h3>{zh ? detailsStepText.visibilityAndRegistration.zh : detailsStepText.visibilityAndRegistration.en}</h3></header>
      <div className="event-details-time-pair">
        <DetailGroup field="visibility" label={zh ? detailsStepText.visibility.zh : detailsStepText.visibility.en}><select aria-label={zh ? detailsStepText.visibility.zh : detailsStepText.visibility.en} disabled={readOnly} className={creationInput} value={settings.visibility} onChange={event => { const value = event.target.value as typeof settings.visibility; setDraft(current => ({ ...current, overrides: { ...current.overrides, visibility: value }, detailSources: mark(current, 'visibility') })) }}>{[['groupVisible', zh ? detailsStepText.groupOnly.zh : detailsStepText.groupOnly.en], ['churchVisible', zh ? detailsStepText.churchOnly.zh : detailsStepText.churchOnly.en], ['public', zh ? detailsStepText.public.zh : detailsStepText.public.en]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></DetailGroup>
        <DetailGroup field="registrationMode" label={zh ? detailsStepText.registration.zh : detailsStepText.registration.en}><select aria-label={zh ? detailsStepText.registration.zh : detailsStepText.registration.en} disabled={readOnly} className={creationInput} value={settings.registrationMode} onChange={event => { const value = event.target.value as 'none' | 'required'; setDraft(current => ({ ...current, overrides: { ...current.overrides, registrationMode: value }, detailSources: mark(current, 'registrationMode') })) }}><option value="none">{zh ? detailsStepText.noRegistration.zh : detailsStepText.noRegistration.en}</option><option value="required">{zh ? detailsStepText.registrationRequired.zh : detailsStepText.registrationRequired.en}</option></select></DetailGroup>
      </div>
      {settings.registrationMode === 'required' ? registrationRulesManaged ? <div data-detail-field="maxCapacity" tabIndex={-1} className="event-detail-managed"><p>{zh ? detailsStepText.capacityAndDeadlineAreManagedInTheRegistrationAnd.zh : detailsStepText.capacityAndDeadlineAreManagedInTheRegistrationAnd.en}</p></div> : <>{textField('maxCapacity', zh ? detailsStepText.capacity.zh : detailsStepText.capacity.en, 'number')}<p>{zh ? detailsStepText.registrationClosesOneDayBeforeTheEventStarts.zh : detailsStepText.registrationClosesOneDayBeforeTheEventStarts.en}</p></> : null}
    </section>
    {ai}
  </div>
}
