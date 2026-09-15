import { useId, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { CalendarDays, ChevronDown, Globe2, Languages, NotebookPen } from 'lucide-react'
import type { Bilingual, DetailField } from '../../../../../shared/eventDetails'
import type { EventActivityType, EventArchetype } from '../../../types/eventComposition'
import { creationSettings, invalidateArrangementConfirmation, type CreationDraft } from '../../../utils/eventCreationDraft'
import { creationInput, localText } from './CreationFields'
import { useDetailsWorkspace } from './DetailsWorkspace'

function DetailGroup({ field, label, children }: { field: DetailField; label: string; children: ReactNode }) {
  const { updatedFields } = useDetailsWorkspace()
  return <fieldset tabIndex={-1} data-detail-field={field} data-ai-updated={updatedFields.includes(field)} className="event-detail-field"><legend>{label}</legend>{children}</fieldset>
}
function DetailsBilingualField({ field, label, value, onChange, zh, multiline = false }: {
  field: DetailField; label: string; value: Bilingual; onChange: (value: Bilingual) => void; zh: boolean; multiline?: boolean
}) {
  const { readOnly } = useDetailsWorkspace(), id = useId()
  const primary = zh ? 'zh' : 'en', secondary = zh ? 'en' : 'zh'
  const input = (locale: 'en' | 'zh') => <label className="event-detail-language" htmlFor={`${id}-${locale}`}><span>{locale === 'zh' ? '中文' : 'English'}</span>{multiline
    ? <textarea id={`${id}-${locale}`} data-locale={locale} disabled={readOnly} rows={3} className={`${creationInput} py-2`} value={value[locale]} onChange={event => onChange({ ...value, [locale]: event.target.value })} />
    : <input id={`${id}-${locale}`} data-locale={locale} disabled={readOnly} className={creationInput} value={value[locale]} onChange={event => onChange({ ...value, [locale]: event.target.value })} />}</label>
  return <DetailGroup field={field} label={label}>
    {input(primary)}
    <details className="event-detail-translation"><summary><Languages size={15} aria-hidden="true" /><span>{secondary === 'zh' ? '中文' : 'English'}</span><span className={value[secondary].trim() ? '' : 'event-detail-pending'}>{value[secondary].trim() ? (zh ? '已填写' : 'Added') : (zh ? '待补充' : 'Missing')}</span><ChevronDown size={15} aria-hidden="true" /></summary>{input(secondary)}</details>
  </DetailGroup>
}

export default function DetailsStep({ draft, setDraft: updateDraft, zh, type, archetype, ai, saved = false, registrationRulesManaged = false }: {
  draft: CreationDraft; setDraft: Dispatch<SetStateAction<CreationDraft>>; zh: boolean
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
  const bilingual = (key: 'title' | 'description' | 'locationName', label: string) => <DetailsBilingualField field={key} label={label} value={draft[key]} zh={zh} multiline={key === 'description'} onChange={value => setDraft(current => ({ ...current, [key]: value, detailSources: mark(current, key) }))} />
  const timesUnconfirmed = [draft.detailSources?.startLocal, draft.detailSources?.endLocal].some(source => source !== 'human' && source !== 'explicit')
  return <div className="event-details-sections">
    <section className="event-details-section" aria-label={zh ? '名称与说明' : 'Name and description'}>
      <header><NotebookPen size={20} aria-hidden="true" /><h3>{zh ? '名称与说明' : 'Name and description'}</h3><span>{localText(type.name, zh)}</span></header>
      {bilingual('title', zh ? '活动名称' : 'Event title')}
      {bilingual('description', zh ? '活动说明' : 'Description')}
    </section>
    <section className="event-details-section" aria-label={zh ? '时间与地点' : 'Time and place'}>
      <header><CalendarDays size={20} aria-hidden="true" /><h3>{zh ? '时间与地点' : 'Time and place'}</h3></header>
      <details className="event-detail-zone"><summary><Globe2 size={16} aria-hidden="true" /><span>{draft.timeZone || (zh ? '请选择活动时区' : 'Choose an event time zone')}</span><span>{zh ? '当地时间' : 'Local time'}</span><ChevronDown size={16} aria-hidden="true" /></summary>{textField('timeZone', zh ? '活动时区' : 'Event time zone')}</details>
      <div className="event-details-time-pair">{textField('startLocal', zh ? '开始时间' : 'Start time', 'datetime-local')}{textField('endLocal', zh ? '结束时间' : 'End time', 'datetime-local')}</div>
      {timesUnconfirmed ? <p className="event-detail-pending">{zh ? '预填时间待确认，请核对后填写或由助手更新。' : 'Prefilled times need confirmation. Review and edit them or ask the assistant to update them.'}</p> : null}
      {archetype.isSeries ? <div className="event-detail-recurrence">{textField('intervalWeeks', zh ? '每隔几周举行' : 'Repeat every N weeks', 'number')}<p hidden={saved}>{zh ? `每 ${draft.intervalWeeks || '1'} 周同一时间举行，预先安排未来 12 周。` : `Repeats every ${draft.intervalWeeks || '1'} week(s), scheduling the next 12 weeks.`}</p></div> : null}
      {bilingual('locationName', zh ? '地点说明' : 'Location')}
    </section>
    <section className="event-details-section" aria-label={zh ? '可见范围与报名' : 'Visibility and registration'}>
      <header><Globe2 size={20} aria-hidden="true" /><h3>{zh ? '可见范围与报名' : 'Visibility and registration'}</h3></header>
      <div className="event-details-time-pair">
        <DetailGroup field="visibility" label={zh ? '可见范围' : 'Visibility'}><select aria-label={zh ? '可见范围' : 'Visibility'} disabled={readOnly} className={creationInput} value={settings.visibility} onChange={event => { const value = event.target.value as typeof settings.visibility; setDraft(current => ({ ...current, overrides: { ...current.overrides, visibility: value }, detailSources: mark(current, 'visibility') })) }}>{[['groupVisible', zh ? '小组内可见' : 'Group only'], ['churchVisible', zh ? '教会内可见' : 'Church only'], ['public', zh ? '公开' : 'Public']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></DetailGroup>
        <DetailGroup field="registrationMode" label={zh ? '报名方式' : 'Registration'}><select aria-label={zh ? '报名方式' : 'Registration'} disabled={readOnly} className={creationInput} value={settings.registrationMode} onChange={event => { const value = event.target.value as 'none' | 'required'; setDraft(current => ({ ...current, overrides: { ...current.overrides, registrationMode: value }, detailSources: mark(current, 'registrationMode') })) }}><option value="none">{zh ? '无需报名' : 'No registration'}</option><option value="required">{zh ? '需要报名' : 'Registration required'}</option></select></DetailGroup>
      </div>
      {settings.registrationMode === 'required' ? registrationRulesManaged ? <div data-detail-field="maxCapacity" tabIndex={-1} className="event-detail-managed"><p>{zh ? '人数上限和截止时间由“报名与参与者”中的报名规则管理。' : 'Capacity and deadline are managed in the Registration and participants rules.'}</p></div> : <>{textField('maxCapacity', zh ? '最多参加人数' : 'Capacity', 'number')}<p>{zh ? '报名默认在活动开始前一天截止。' : 'Registration closes one day before the event starts.'}</p></> : null}
    </section>
    {ai}
  </div>
}
