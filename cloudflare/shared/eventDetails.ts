// Versioned presentation contract shared by the creation UI and edge assistant.
// These sources measure draft completeness; none grant business authority.
export type Bilingual = { zh: string; en: string }
export type EventDetailsForm = {
  title: Bilingual; description: Bilingual; locationName: Bilingual
  startLocal: string | null; endLocal: string | null; timeZone: string | null
  visibility: 'groupVisible' | 'churchVisible' | 'public' | null
  registrationMode: 'none' | 'required' | null
  maxCapacity: number | null; intervalWeeks: number | null
}
export const detailFields = ['title', 'description', 'locationName', 'startLocal', 'endLocal', 'timeZone', 'visibility', 'registrationMode', 'maxCapacity', 'intervalWeeks'] as const
export type DetailField = typeof detailFields[number]
export type DetailSource = 'default' | 'human' | 'explicit' | 'unresolved'
export type DetailSources = Partial<Record<DetailField, DetailSource>>
export const detailLabels: Record<DetailField, Bilingual> = {
  title: { zh: '活动名称', en: 'Title' }, description: { zh: '活动说明', en: 'Description' }, locationName: { zh: '地点说明', en: 'Location' },
  startLocal: { zh: '开始时间', en: 'Start time' }, endLocal: { zh: '结束时间', en: 'End time' }, timeZone: { zh: '活动时区', en: 'Time zone' },
  visibility: { zh: '可见范围', en: 'Visibility' }, registrationMode: { zh: '报名方式', en: 'Registration' },
  maxCapacity: { zh: '最多参加人数', en: 'Capacity' }, intervalWeeks: { zh: '重复间隔', en: 'Repeat interval' },
}
export type DetailIssue = { field: DetailField; kind: 'missing' | 'confirmationNeeded' | 'ambiguous' | 'conflicting' | 'unsupported'; question: Bilingual }
export type EventDetailsAiResult = {
  form: EventDetailsForm
  fieldAssessments: { field: DetailField; status: 'explicit' | 'inferred' | 'missing' | 'ambiguous' | 'conflicting'; evidence: string; explanation: Bilingual }[]
  assessment: { sufficiencyScore: number; summary: Bilingual }
  issues: DetailIssue[]
  assistantReply: Bilingual
}
export type DetailsSnapshot = { version: 1; revision: number; form: EventDetailsForm; sources: DetailSources; isSeries: boolean; archetypeCode: string; activityTypeCode: string }
export type DetailsResult = EventDetailsAiResult & { version: 1; revision: number; sources: DetailSources; adoptedFields: DetailField[]; completion: ReturnType<typeof detailCompletion> }

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true } catch { return false }
}

// Resolve the wall clock using actual IANA offsets around that date. Round-trip
// candidates distinguish gaps (zero) and folds (two), rather than guessing DST.
export function localTimeToUtc(local: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !isTimeZone(timeZone)) throw new Error('Invalid local time or time zone.')
  const wall = Date.parse(`${local}:00Z`)
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== local) throw new Error('Invalid local date.')
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  const wallAt = (instant: number) => {
    const p = Object.fromEntries(formatter.formatToParts(instant).map(x => [x.type, x.value]))
    return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)
  }
  const offsets = new Set<number>()
  for (let hours = -48; hours <= 48; hours += 6) { const instant = wall + hours * 3_600_000; offsets.add(wallAt(instant) - instant) }
  const matches = [...offsets].map(offset => wall - offset).filter(instant => wallAt(instant) === wall)
  if (matches.length !== 1) throw new Error(matches.length ? 'Ambiguous daylight-saving time.' : 'Nonexistent daylight-saving time.')
  return new Date(matches[0]).toISOString()
}

export function validDetail(field: DetailField, form: EventDetailsForm): boolean {
  const value = form[field]
  if (field === 'title' || field === 'description' || field === 'locationName') { const text = form[field]; return Boolean(text?.zh?.trim() && text?.en?.trim()) }
  if (field === 'timeZone') return isTimeZone(value)
  if (field === 'startLocal' || field === 'endLocal') {
    try {
      const utc = localTimeToUtc(String(value ?? ''), form.timeZone ?? '')
      return field === 'startLocal' || utc > localTimeToUtc(form.startLocal ?? '', form.timeZone ?? '')
    } catch { return false }
  }
  if (field === 'visibility') return ['groupVisible', 'churchVisible', 'public'].includes(String(value))
  if (field === 'registrationMode') return value === 'none' || value === 'required'
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && (field !== 'intervalWeeks' || value <= 52)
}

export function applicableDetails(form: EventDetailsForm, isSeries: boolean): DetailField[] {
  return detailFields.filter(field => (field !== 'maxCapacity' || form.registrationMode === 'required') && (field !== 'intervalWeeks' || isSeries))
}
export function detailCompletion(form: EventDetailsForm, sources: DetailSources, isSeries: boolean) {
  const fields = applicableDetails(form, isSeries)
  const pending = fields.filter(field => !['human', 'explicit'].includes(sources[field] ?? '') || !validDetail(field, form))
  return { completed: fields.length - pending.length, total: fields.length, percent: Math.round((fields.length - pending.length) * 100 / fields.length), pending }
}
