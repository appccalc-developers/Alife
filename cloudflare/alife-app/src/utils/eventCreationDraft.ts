import { detailFields, localTimeToUtc, type DetailSources } from '../../../shared/eventDetails.ts'
import type { EventDto, EventVisibility, MultilingualString } from '../types/event'
import type { EventActivityType, EventArchetype, EventFactInput, EventPlanComposeRequest, EventSeriesSetup, ModuleDecision } from '../types/eventComposition'
import { createEmptyEventRamDraft } from './eventRam.ts'
import { validStoredArrangements, type CreationArrangements } from './eventCreationArrangements.ts'

export type FactAnswer = 'unknown' | 'yes' | 'no'
export const arrangementGroups = [
  { key: 'people', en: 'People and volunteers', zh: '人员与同工', modules: ['TEAM.WORK', 'PEOPLE.REGISTRATION', 'SERVICE.ROSTER'], facts: [['people.volunteersRequired', 'Will volunteers be needed?', '需要志愿同工吗？']] },
  { key: 'safety', en: 'Safety', zh: '安全', modules: ['SAFETY.RAM', 'SAFEGUARDING.CHILD'], facts: [['people.childrenPresent', 'Will children participate?', '有未成年人参与吗？'], ['safety.requiresRam', 'Is a RAM review required?', '需要 RAM 风险检视吗？']] },
  { key: 'programme', en: 'Programme and venue', zh: '节目与场地', modules: ['PROGRAM.PRODUCTION', 'PLACE.RESOURCE', 'FESTIVAL.OPERATIONS'], facts: [['programme.productionRequired', 'Does the programme need coordination?', '需要统筹节目流程吗？'], ['place.resourcesRequired', 'Do venues or resources need managing?', '需要管理场地或资源吗？'], ['scale.multiZone', 'Will multiple areas operate at the same time?', '需要同时管理多个现场区域吗？']] },
  { key: 'travel', en: 'Travel and accommodation', zh: '交通与住宿', modules: ['MOVE.STAY'], facts: [['move.transportRequired', 'Will transport be arranged?', '本次安排交通吗？'], ['move.accommodationRequired', 'Will accommodation be arranged?', '本次安排住宿吗？']] },
  { key: 'food', en: 'Food', zh: '餐饮', modules: ['FOOD.HOSPITALITY'], facts: [['food.serviceRequired', 'Will food service be arranged?', '需要安排餐饮服务吗？']] },
  { key: 'money', en: 'Money', zh: '费用', modules: ['MONEY.FINANCE'], facts: [['money.hasMoneyFlow', 'Will money be collected or spent?', '本次有收费或支出吗？']] },
  { key: 'followup', en: 'Follow-up', zh: '跟进', modules: ['COMMS.FOLLOWUP'], facts: [['comms.followupRequired', 'Will organised follow-up be needed?', '需要安排活动后的跟进吗？']] },
] as const
export const creationFacts = arrangementGroups.flatMap(group => [...group.facts])
export const creationModuleCodes = arrangementGroups.flatMap(group => [...group.modules])

export type CreationDraft = {
  archetypeCode: string
  activityTypeCode: string
  overrides: { visibility?: EventVisibility; registrationMode?: 'none' | 'required'; useRecommendedWorkflow?: boolean }
  arrangementConfirmations?: Record<string, boolean>
  moduleConfirmations?: Record<string, boolean>
  moduleOverrides: Record<string, boolean>
  factValues: Record<string, FactAnswer>
  aiCandidateFacts: Record<string, boolean>
  title: MultilingualString
  description: MultilingualString
  locationName: MultilingualString
  startLocal: string
  endLocal: string
  maxCapacity: string
  timeZone: string
  intervalWeeks?: string
  detailSources?: DetailSources
  arrangements?: CreationArrangements
}

export const initialCreationDraft = (): CreationDraft => {
  const local = (hour: number) => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    date.setHours(hour, 0, 0, 0)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  }
  return {
    archetypeCode: '', activityTypeCode: '', overrides: {}, arrangementConfirmations: {}, moduleConfirmations: {}, moduleOverrides: {}, aiCandidateFacts: {},
    factValues: Object.fromEntries(creationFacts.map(([code]) => [code, 'unknown'])),
    title: { en: '', zh: '' }, description: { en: '', zh: '' }, locationName: { en: '', zh: '' },
    startLocal: local(10), endLocal: local(12), maxCapacity: '',
    intervalWeeks: '1', detailSources: {},
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Pacific/Auckland',
  }
}

export const selectCreationTemplate = (draft: CreationDraft, type: EventActivityType): CreationDraft => ({
  ...draft, arrangementConfirmations: {}, moduleConfirmations: {}, archetypeCode: type.archetypeCode, activityTypeCode: type.code,
  detailSources: { ...draft.detailSources, ...(draft.overrides.visibility === undefined ? { visibility: 'default' as const } : {}), ...(draft.overrides.registrationMode === undefined ? { registrationMode: 'default' as const } : {}) },
})

export const creationSettings = (draft: CreationDraft, type: EventActivityType | null) => ({
  visibility: draft.overrides.visibility ?? type?.defaults.visibility ?? 'groupVisible',
  registrationMode: draft.overrides.registrationMode ?? type?.defaults.registrationMode ?? 'none',
  useRecommendedWorkflow: Boolean(type?.recommendedWorkflowTemplateCode) && (draft.overrides.useRecommendedWorkflow ?? true),
})

export const composeCreationDraft = (draft: CreationDraft, type: EventActivityType): EventPlanComposeRequest => {
  const settings = creationSettings(draft, type)
  const facts: EventFactInput[] = creationFacts.map(([code]) => {
    const answer = draft.factValues[code]
    if (answer === 'yes' || answer === 'no') return { code, value: answer === 'yes', certainty: 'confirmed', source: 'human' }
    if (code in draft.aiCandidateFacts) return { code, value: draft.aiCandidateFacts[code], certainty: 'candidate', source: 'aiCandidate' }
    return { code, value: null, certainty: 'unknown', source: 'human' }
  })
  return {
    arrangementConfirmations: moduleConfirmationSummary(draft.moduleConfirmations),
    moduleConfirmations: Object.fromEntries(creationModuleCodes.map(code => [code, draft.moduleConfirmations?.[code] === true])),
    schemaVersion: '1.1.0', archetypeCode: draft.archetypeCode, activityTypeCode: type.code,
    useRecommendedWorkflow: settings.useRecommendedWorkflow, basePlanVersion: null,
    facts: { items: [
      { code: 'visibility', value: settings.visibility, certainty: 'confirmed', source: 'human' },
      { code: 'people.registrationMode', value: settings.registrationMode, certainty: 'confirmed', source: 'human' },
      ...facts,
    ] },
    humanSelections: creationModuleCodes.filter(code => code !== 'TEAM.WORK' && code in draft.moduleOverrides)
      .map(moduleCode => ({ moduleCode, selected: draft.moduleOverrides[moduleCode] })),
  }
}

export const changeOptionalModule = (draft: CreationDraft, decision: ModuleDecision, selected: boolean): CreationDraft =>
  decision.status === 'required' ? draft : { ...draft, moduleOverrides: { ...draft.moduleOverrides, [decision.moduleCode]: selected } }

export const validateCreationDraft = (draft: CreationDraft, type: EventActivityType, archetype: EventArchetype, zh: boolean): string => {
  if (!draft.title.en.trim() && !draft.title.zh.trim()) return zh ? '请填写活动名称。' : 'Enter an event title.'
  if (!draft.description.en.trim() && !draft.description.zh.trim()) return zh ? '请填写活动说明。' : 'Enter an event description.'
  let start: number, end: number
  try { start = Date.parse(localTimeToUtc(draft.startLocal, draft.timeZone)); end = Date.parse(localTimeToUtc(draft.endLocal, draft.timeZone)) }
  catch { return zh ? '请检查活动时区和日期时间；夏令时跳过或重复的时间须重新选择。' : 'Check the event time zone and dates; choose a different time for a daylight-saving gap or overlap.' }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return zh ? '请输入有效时间，结束时间须晚于开始时间。' : 'Enter valid dates with the end after the start.'
  if (creationSettings(draft, type).registrationMode === 'required' && (!Number.isInteger(Number(draft.maxCapacity)) || Number(draft.maxCapacity) < 1)) return zh ? '请填写大于零的整数容量。' : 'Enter a whole-number capacity greater than zero.'
  if (archetype.isSeries) {
    if (!Number.isInteger(Number(draft.intervalWeeks ?? '1')) || Number(draft.intervalWeeks ?? '1') < 1 || Number(draft.intervalWeeks ?? '1') > 52) return zh ? '重复间隔须为 1–52 周。' : 'Repeat interval must be 1–52 weeks.'
    try { new Intl.DateTimeFormat('en', { timeZone: draft.timeZone }).format() }
    catch { return zh ? '请选择有效的时区。' : 'Enter a valid time zone.' }
    if (!draft.timeZone.trim()) return zh ? '请填写时区。' : 'Enter a time zone.'
  }
  return ''
}

export const creationEvent = (draft: CreationDraft, type: EventActivityType, displayName: string): EventDto => {
  const settings = creationSettings(draft, type)
  const startUtc = localTimeToUtc(draft.startLocal, draft.timeZone), endUtc = localTimeToUtc(draft.endLocal, draft.timeZone)
  return {
    organizerDisplayName: displayName, personResponsible: displayName, purpose: { en: '', zh: '' },
    title: draft.title, description: draft.description, locationName: draft.locationName,
    startDate: startUtc, endDate: endUtc,
    timeZone: draft.timeZone,
    visibility: settings.visibility,
    registrationDeadline: new Date(Date.parse(startUtc) - (settings.registrationMode === 'required' ? 86_400_000 : 0)).toISOString(),
    maxCapacity: settings.registrationMode === 'required' ? Number(draft.maxCapacity) : 0,
    capacityUnit: 'People', hardConstraints: [], optionalActivities: [], baseFeePerAdult: null, baseFeePerChild: null,
    currency: 'NZD', posterImageUrl: null, galleryUrls: [], legacySummary: null, contactProfileIds: [], ram: createEmptyEventRamDraft(),
  }
}

export const creationSeries = (draft: CreationDraft, archetype: EventArchetype): EventSeriesSetup | null => archetype.isSeries ? {
  name: { en: draft.title.en || draft.title.zh, zh: draft.title.zh || draft.title.en },
  recurrenceRule: `FREQ=WEEKLY;INTERVAL=${draft.intervalWeeks ?? '1'};BYDAY=${['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][new Date(`${draft.startLocal}:00Z`).getUTCDay()]}`,
  timeZone: draft.timeZone, firstStartLocal: draft.startLocal,
  durationMinutes: Math.round((Date.parse(localTimeToUtc(draft.endLocal, draft.timeZone)) - Date.parse(localTimeToUtc(draft.startLocal, draft.timeZone))) / 60_000),
  exceptionDates: [], rollingOccurrenceWeeks: 12,
} : null

export const creationDraftKey = (memberId: string, groupId: string) => `alife:event-create:v2:${memberId}:${groupId}`

// Only this format is read. Validate the persisted boundary before hydrating controls.
export const restoreCreationDraft = (raw: string, archetypes: EventArchetype[]): CreationDraft | null => {
  try {
    const value = JSON.parse(raw)
    if (!value || ![2, 3].includes(value.version) || !value.draft) return null
    const draft = value.draft as CreationDraft
    if (!['archetypeCode', 'activityTypeCode', 'startLocal', 'endLocal', 'maxCapacity', 'timeZone'].every(key => typeof (draft as unknown as Record<string, unknown>)[key] === 'string')) return null
    if (![draft.title, draft.description, draft.locationName].every(x => x && typeof x.en === 'string' && typeof x.zh === 'string')) return null
    const archetype = archetypes.find(x => x.code === draft.archetypeCode)
    if (draft.archetypeCode && !archetype) return null
    if (draft.activityTypeCode && !archetype?.activityTypes.some(x => x.code === draft.activityTypeCode)) return null
    if (!draft.overrides || !draft.moduleOverrides || !draft.factValues || !draft.aiCandidateFacts) return null
    if (draft.moduleConfirmations && !Object.entries(draft.moduleConfirmations).every(([key, value]) => creationModuleCodes.some(code => code === key) && typeof value === 'boolean')) return null
    if (draft.arrangementConfirmations && !Object.entries(draft.arrangementConfirmations).every(([key, value]) => arrangementGroups.some(group => group.key === key) && typeof value === 'boolean')) return null
    if (draft.arrangements !== undefined && !validStoredArrangements(draft.arrangements)) return null
    if (draft.overrides.visibility !== undefined && !['groupVisible', 'churchVisible', 'public'].includes(draft.overrides.visibility)) return null
    if (draft.overrides.registrationMode !== undefined && !['none', 'required'].includes(draft.overrides.registrationMode)) return null
    if (draft.overrides.useRecommendedWorkflow !== undefined && typeof draft.overrides.useRecommendedWorkflow !== 'boolean') return null
    if (!Object.entries(draft.moduleOverrides).every(([key, x]) => creationModuleCodes.some(code => code === key) && key !== 'TEAM.WORK' && typeof x === 'boolean')) return null
    if (!creationFacts.every(([code]) => ['unknown', 'yes', 'no'].includes(draft.factValues[code]))) return null
    if (!Object.entries(draft.aiCandidateFacts).every(([key, x]) => creationFacts.some(([code]) => code === key) && typeof x === 'boolean')) return null
    if (value.version === 3 && (typeof draft.intervalWeeks !== 'string' || !draft.detailSources || Object.entries(draft.detailSources).some(([key, source]) => !detailFields.includes(key as typeof detailFields[number]) || !['default', 'human', 'explicit', 'unresolved'].includes(source)))) return null
    return value.version === 2 ? { ...draft, intervalWeeks: '1', detailSources: {} } : draft
  } catch { return null }
}

export const createRequestSequence = () => {
  let current = 0
  return { next: () => ++current, isCurrent: (id: number) => id === current, invalidate: () => { current++ } }
}

// Retries of identical input reuse a key; a refreshed proposal is different input.
export const createSubmissionGuard = () => {
  let pending = false
  let completed = false
  let signature = ''
  let key = ''
  return {
    begin(inputSignature: string): string | null {
      if (pending || completed) return null
      if (inputSignature !== signature || !key) { signature = inputSignature; key = crypto.randomUUID() }
      pending = true
      return key
    },
    finish(success: boolean) { pending = false; completed = success },
  }
}

// Section review and tool selection are separate from factual evidence and approval.
// Disabling a tool during preparation must not erase facts requiring it at submission.
export const moduleConfirmationSummary = (values?: Record<string, boolean> | null) => Object.fromEntries(arrangementGroups.map(group => [group.key, group.modules.every(code => values?.[code] === true)]))

export function invalidateArrangementConfirmation(draft: CreationDraft, moduleCode?: string): CreationDraft {
  const groups = arrangementGroups.filter(group => !moduleCode || group.modules.some(code => code === moduleCode))
  const affected = moduleCode ? [moduleCode, ...(['PLACE.RESOURCE', 'MOVE.STAY', 'TEAM.WORK', 'PROGRAM.PRODUCTION', 'PEOPLE.REGISTRATION', 'SAFEGUARDING.CHILD'].includes(moduleCode) ? ['SAFETY.RAM'] : [])] : creationModuleCodes
  const values = { ...draft.moduleConfirmations, ...Object.fromEntries(affected.map(code => [code, false])) }
  return { ...draft, moduleConfirmations: values, arrangementConfirmations: draft.moduleConfirmations ? moduleConfirmationSummary(values) : { ...draft.arrangementConfirmations, ...Object.fromEntries(groups.map(group => [group.key, false])) } }
}
export function selectArrangementModule(draft: CreationDraft, moduleCode: string, selected: boolean): CreationDraft {
  const next = invalidateArrangementConfirmation(draft, moduleCode)
  return { ...next, moduleOverrides: { ...next.moduleOverrides, [moduleCode]: selected } }
}
export function confirmArrangementModule(draft: CreationDraft, moduleCode: string, confirmed: boolean, decisions: ModuleDecision[]): CreationDraft {
  let next = draft
  const decision = decisions.find(value => value.moduleCode === moduleCode)
  if (confirmed && decision && moduleCode !== 'TEAM.WORK') next = { ...next, moduleOverrides: { ...next.moduleOverrides, [moduleCode]: draft.moduleOverrides[moduleCode] ?? decision.status !== 'inactive' } }
  const values = { ...next.moduleConfirmations, [moduleCode]: confirmed }
  return { ...next, moduleConfirmations: values, arrangementConfirmations: moduleConfirmationSummary(values) }
}
// Retained for callers editing legacy section metadata.
export function confirmArrangementGroup(draft: CreationDraft, groupKey: string, confirmed: boolean, decisions: ModuleDecision[]): CreationDraft {
  return arrangementGroups.find(group => group.key === groupKey)?.modules.reduce((next, code) => confirmArrangementModule(next, code, confirmed, decisions), draft) ?? draft
}
