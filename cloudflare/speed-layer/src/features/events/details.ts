import { explicitLocalRange } from '../../../../shared/eventDetailsTime'
import type { Env } from '../../index'
import { AiChatSession, type DurableObjectStateLike, multilingualSchema } from '../ai/aiSession'
import { detailFields, applicableDetails, detailCompletion, validDetail, type DetailsSnapshot, type DetailsResult, type DetailField, type DetailIssue, type EventDetailsAiResult, type EventDetailsForm } from '../../../../shared/eventDetails'

const text = (description: string) => ({ type: 'string', description })
const bilingual = multilingualSchema('Equivalent Chinese and English; concise, at most 400 characters per language.')
const formProperties = {
  title: bilingual, description: bilingual, locationName: bilingual,
  startLocal: { ...text('Wall-clock YYYY-MM-DDTHH:mm in form.timeZone, never UTC or browser time; null if unknown.'), nullable: true }, endLocal: { ...text('Wall-clock YYYY-MM-DDTHH:mm in form.timeZone, never UTC or browser time; null if unknown.'), nullable: true },
  timeZone: { ...text('IANA time zone, e.g. Pacific/Auckland; null if unknown.'), nullable: true },
  visibility: { type: 'string', enum: ['groupVisible', 'churchVisible', 'public'], nullable: true },
  registrationMode: { type: 'string', enum: ['none', 'required'], nullable: true },
  maxCapacity: { type: 'integer', minimum: 1, nullable: true }, intervalWeeks: { type: 'integer', minimum: 1, maximum: 52, nullable: true },
}
export const DETAILS_RESPONSE_SCHEMA = {
  type: 'object', required: ['form', 'fieldAssessments', 'assessment', 'issues', 'assistantReply'],
  properties: {
    form: { type: 'object', required: [...detailFields], properties: formProperties },
    fieldAssessments: { type: 'array', maxItems: 10, items: { type: 'object', required: ['field', 'status', 'evidence', 'explanation'], properties: {
      field: { type: 'string', enum: [...detailFields] }, status: { type: 'string', enum: ['explicit', 'inferred', 'missing', 'ambiguous', 'conflicting'] },
      evidence: text('Exact short quote from userMessage or current form text; never instructions or a paraphrase.'), explanation: bilingual,
    } } },
    assessment: { type: 'object', required: ['sufficiencyScore', 'summary'], properties: { sufficiencyScore: { type: 'integer', minimum: 0, maximum: 100 }, summary: bilingual } },
    issues: { type: 'array', maxItems: 10, items: { type: 'object', required: ['field', 'kind', 'question'], properties: {
      field: { type: 'string', enum: [...detailFields] }, kind: { type: 'string', enum: ['missing', 'confirmationNeeded', 'ambiguous', 'conflicting', 'unsupported'] }, question: bilingual,
    } } },
    assistantReply: bilingual,
  },
}
const SCENARIO = `Event details form assistant v1. Return the complete target form, fieldAssessments, assessment, issues and assistantReply. Do not produce RAM, fees, contacts, module decisions or any legacy EventDto fields.
The supplied snapshot is the latest user-visible form, including manual edits. Preserve all fields not explicitly corrected or cleared. Sources default/unresolved mean unconfirmed; never count a default as user intent. human/explicit are presentation provenance only, not business authority.
Only mark a field explicit when the user directly supplied/corrected/cleared it, or you faithfully translate existing supplied text. evidence must be an exact short quotation of that information. Do not reuse an unrelated quote to justify another field. Use missing, inferred, ambiguous or conflicting otherwise. Unknown scalar values are null; unknown bilingual text is empty. Never invent optional details to fill blanks.
Use the activity's IANA timeZone and referenceInstant for date reasoning. startLocal/endLocal are wall-clock times in that zone, with no offset conversion. For an explicit date and time range, cite the full date plus range as evidence for BOTH fields; do not quote the hour alone. Keep an existing timeZone unless the user explicitly changes it. Bare relative dates such as next Saturday / 下个周六 require a proposed concrete date and confirmation before adoption. Conflicting weekly and fortnightly instructions require clarification. Never silently resolve a DST gap or fold. New Zealand time means Pacific/Auckland unless a different NZ zone is explicitly requested.
Only weekly series with an interval from 1 to 52 and the single weekday of startLocal are supported. Monthly/multiple-weekday recurrence is unsupported. Never change archetypeCode or activityTypeCode: explain a mismatch and ask the user to select a matching template.
All ten fields are described by target schema. Capacity applies only to required registration; interval applies only to series. Visibility/registration/time defaults require explicit confirmation. A missing registration choice is not no-registration. A clear request to clear a field is allowed and leaves it incomplete.
Return an AI sufficiency score, separate from deterministic completion. List issues by importance. assistantReply must briefly reflect what was captured and ask at most two useful questions. Never claim submission or approval. Keep descriptions under 400 characters per language and every reply concise. Do not repeat already resolved questions. All explanatory and question text is bilingual.`

const record = (x: unknown): x is Record<string, unknown> => Boolean(x && typeof x === 'object' && !Array.isArray(x))
const isField = (x: unknown): x is DetailField => detailFields.includes(x as DetailField)
function readText(x: unknown, max = 400) {
  if (!record(x) || typeof x.zh !== 'string' || typeof x.en !== 'string' || x.zh.length > max || x.en.length > max) throw new Error('Invalid bilingual details.')
  return { zh: x.zh, en: x.en }
}
function readForm(x: unknown): EventDetailsForm {
  if (!record(x) || Object.keys(x).some(k => !isField(k))) throw new Error('Invalid details fields.')
  const form = { title: readText(x.title, 4000), description: readText(x.description, 4000), locationName: readText(x.locationName, 4000) } as EventDetailsForm
  for (const key of ['startLocal', 'endLocal', 'timeZone'] as const) {
    if (x[key] !== null && (typeof x[key] !== 'string' || (x[key] as string).length > 100)) throw new Error('Invalid details value.')
    form[key] = x[key] as string | null
  }
  if (x.visibility !== null && !['groupVisible', 'churchVisible', 'public'].includes(String(x.visibility))) throw new Error('Invalid visibility.')
  if (x.registrationMode !== null && !['none', 'required'].includes(String(x.registrationMode))) throw new Error('Invalid registration mode.')
  form.visibility = x.visibility as EventDetailsForm['visibility']; form.registrationMode = x.registrationMode as EventDetailsForm['registrationMode']
  for (const key of ['maxCapacity', 'intervalWeeks'] as const) {
    const v = x[key]
    if (v !== null && (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || (key === 'intervalWeeks' && v > 52))) throw new Error('Invalid details number.')
    form[key] = v as number | null
  }
  return form
}
export function readDetailsSnapshot(x: unknown): DetailsSnapshot {
  if (!record(x) || x.version !== 1 || !Number.isSafeInteger(x.revision) || Number(x.revision) < 0 || typeof x.isSeries !== 'boolean' || typeof x.archetypeCode !== 'string' || typeof x.activityTypeCode !== 'string' || x.archetypeCode.length > 100 || x.activityTypeCode.length > 100 || !record(x.sources)) throw new Error('Invalid details snapshot.')
  const sources: DetailsSnapshot['sources'] = {}
  for (const field of detailFields) {
    const source = x.sources[field]
    if (source !== undefined && !['default', 'human', 'explicit', 'unresolved'].includes(String(source))) throw new Error('Invalid details source.')
    if (source) sources[field] = source as DetailsSnapshot['sources'][DetailField]
  }
  return { version: 1, revision: Number(x.revision), form: readForm(x.form), sources, isSeries: x.isSeries, archetypeCode: x.archetypeCode, activityTypeCode: x.activityTypeCode }
}
export function readDetailsAiResult(x: unknown): DetailsResult {
  if (!record(x) || !record(x.assessment) || !Number.isInteger(x.assessment.sufficiencyScore) || Number(x.assessment.sufficiencyScore) < 0 || Number(x.assessment.sufficiencyScore) > 100 || !Array.isArray(x.fieldAssessments) || x.fieldAssessments.length > 10 || !Array.isArray(x.issues) || x.issues.length > 10) throw new Error('Invalid details response.')
  const seen = new Set<string>()
  const fieldAssessments: EventDetailsAiResult['fieldAssessments'] = x.fieldAssessments.map(a => {
    if (!record(a) || !isField(a.field) || seen.has(a.field) || !['explicit', 'inferred', 'missing', 'ambiguous', 'conflicting'].includes(String(a.status)) || typeof a.evidence !== 'string' || a.evidence.length > 400) throw new Error('Invalid field assessment.')
    seen.add(a.field)
    return { field: a.field, status: a.status as EventDetailsAiResult['fieldAssessments'][number]['status'], evidence: a.evidence, explanation: readText(a.explanation) }
  })
  const issues: DetailIssue[] = x.issues.map(a => {
    if (!record(a) || !isField(a.field) || !['missing', 'confirmationNeeded', 'ambiguous', 'conflicting', 'unsupported'].includes(String(a.kind))) throw new Error('Invalid details issue.')
    return { field: a.field, kind: a.kind as DetailIssue['kind'], question: readText(a.question) }
  })
  const form = readForm(x.form)
  return { version: 1, revision: 0, form, sources: {}, adoptedFields: [], completion: detailCompletion(form, {}, false), fieldAssessments, issues, assessment: { sufficiencyScore: Number(x.assessment.sufficiencyScore), summary: readText(x.assessment.summary) }, assistantReply: readText(x.assistantReply) }
}

export function mergeDetails(snapshot: DetailsSnapshot, result: DetailsResult, message: string): DetailsResult {
  // Exact date/range text is stronger evidence than a model returning stale
  // defaults or UTC in a local-time field. Do not take a zone invented by AI.
  const explicit = explicitLocalRange(message, snapshot.form.timeZone)
  if (explicit) result = { ...result, form: { ...result.form, startLocal: explicit.startLocal, endLocal: explicit.endLocal },
    issues: result.issues.filter(x => x.field !== 'startLocal' && x.field !== 'endLocal'),
    fieldAssessments: [...result.fieldAssessments.filter(x => x.field !== 'startLocal' && x.field !== 'endLocal'),
      ...(['startLocal', 'endLocal'] as const).map(field => ({ field, status: 'explicit' as const, evidence: explicit.evidence, explanation: { zh: '按活动时区采用用户明确提供的日期和时间。', en: 'Explicit calendar date and wall-clock range in the event time zone.' } }))] }
  const form = structuredClone(snapshot.form), sources = { ...snapshot.sources }, adoptedFields: DetailField[] = []
  const issues = [...result.issues]
  const blocked = new Set(issues.filter(x => ['ambiguous', 'conflicting', 'unsupported'].includes(x.kind)).map(x => x.field))
  const addIssue = (field: DetailField, kind: DetailIssue['kind'], zh: string, en: string) => {
    blocked.add(field)
    if (!issues.some(x => x.field === field)) issues.push({ field, kind, question: { zh, en } })
  }
  if (/下(?:一)?个?周|下星期|next\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day/i.test(message) && !/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(message)) {
    for (const field of ['startLocal', 'endLocal'] as const) addIssue(field, 'ambiguous', `请确认具体日期（AI 建议：${result.form[field] ?? '待确定'}）。`, `Please confirm the exact date (AI suggestion: ${result.form[field] ?? 'unknown'}).`)
  }
  if (/(每[二两2]周|隔周|fortnight|biweekly|every (?:two|2) weeks)/i.test(message) && /(每周[一二三四五六日天]|every saturday|weekly)/i.test(message.replace(/biweekly/ig, ''))) addIssue('intervalWeeks', 'conflicting', '请确认是每周还是每两周一次？', 'Should this repeat every week or every two weeks?')
  for (const a of result.fieldAssessments) if (['ambiguous', 'conflicting'].includes(a.status)) blocked.add(a.field)
  for (const a of result.fieldAssessments) {
    const field = a.field
    if (blocked.has(field)) { sources[field] = 'unresolved'; continue }
    if (a.status !== 'explicit' || !a.evidence.trim()) continue
    const inMessage = message.includes(a.evidence)
    const isCopy = field === 'title' || field === 'description' || field === 'locationName'
    const oldText = isCopy ? snapshot.form[field] : null
    const inKnownCopy = oldText && ['human', 'explicit'].includes(sources[field] ?? '') && (oldText.zh.includes(a.evidence) || oldText.en.includes(a.evidence))
    if (!inMessage && !inKnownCopy) continue
    // A quote merely present in the prompt is not sufficient numeric/enum
    // evidence. Confirmation can retain a current value but cannot invent one.
    const proposed = result.form[field]
    const isClear = proposed === null || (typeof proposed === 'object' && !proposed.zh && !proposed.en)
    if (isClear && !/清空|删除|移除|清除|取消|clear|remove|delete|unset/i.test(a.evidence)) continue
    const confirmingCurrent = JSON.stringify(proposed) === JSON.stringify(snapshot.form[field]) && /确认|就按|没错|是的|同意|confirm|correct|yes|use (?:these|the current)/i.test(a.evidence)
    if (proposed !== null && !confirmingCurrent) {
      if ((field === 'startLocal' || field === 'endLocal') && !explicit && !/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}月\d{1,2}|today|tomorrow|今天|明天|确认|confirm|yes/i.test(a.evidence)) continue
      if (field === 'maxCapacity' && !a.evidence.match(/\d+/g)?.includes(String(proposed))) continue
      if (field === 'intervalWeeks' && !a.evidence.match(/\d+/g)?.includes(String(proposed)) && !(proposed === 2 ? /二|两|隔周|fortnight|biweekly|two/i : proposed === 1 ? /每周|weekly|one/i : /(?!)/).test(a.evidence)) continue
      if (field === 'visibility' && !(proposed === 'public' ? /公开|public/i : proposed === 'churchVisible' ? /教会|church/i : /小组|group/i).test(a.evidence)) continue
      if (field === 'registrationMode') {
        if (!/报名|登记|registration|register|rsvp|enrol/i.test(a.evidence)) continue
        const noRegistration = /无需|不用|不需|不报名|不登记|no |not |without/i.test(a.evidence)
        if ((proposed === 'none') !== noRegistration) continue
      }
      if (field === 'timeZone' && !a.evidence.includes(String(proposed)) && !(proposed === 'Pacific/Auckland' && /新西兰|new zealand|auckland|奥克兰|\bNZ\b/i.test(a.evidence))) continue
    }
    if (!snapshot.isSeries && field === 'intervalWeeks') continue
    const value = result.form[field]
    // Explicit clears remain incomplete; source never means business confirmation.
    ;(form as unknown as Record<string, unknown>)[field] = value
    sources[field] = 'explicit'
    if (JSON.stringify(value) !== JSON.stringify(snapshot.form[field])) adoptedFields.push(field)
  }
  for (const field of [...adoptedFields]) {
    const value = form[field]
    const cleared = value === null || (typeof value === 'object' && !value.zh && !value.en)
    if (!cleared && !validDetail(field, form)) {
      ;(form as unknown as Record<string, unknown>)[field] = snapshot.form[field]
      sources[field] = 'unresolved'; adoptedFields.splice(adoptedFields.indexOf(field), 1)
      addIssue(field, 'ambiguous', '此字段无效或时间存在夏令时歧义，请检查后重新填写。', 'This value is invalid or its time has a daylight-saving ambiguity. Please revise it.')
    }
  }
  if (adoptedFields.some(field => ['startLocal', 'endLocal', 'timeZone'].includes(field)) && form.startLocal && form.endLocal && !validDetail('endLocal', form)) {
    for (const field of ['startLocal', 'endLocal', 'timeZone'] as const) {
      if (!adoptedFields.includes(field)) continue
      form[field] = snapshot.form[field]; sources[field] = 'unresolved'; adoptedFields.splice(adoptedFields.indexOf(field), 1)
    }
    addIssue('endLocal', 'conflicting', '请检查开始和结束时间，结束须晚于开始，且不能落在夏令时歧义时段。', 'Check both times: end must follow start and neither may fall in a daylight-saving gap or overlap.')
  }
  for (const field of blocked) sources[field] = 'unresolved'
  const completion = detailCompletion(form, sources, snapshot.isSeries)
  for (const field of completion.pending) if (!issues.some(x => x.field === field)) issues.push({ field, kind: validDetail(field, form) ? 'confirmationNeeded' : 'missing', question: { zh: '请补充或确认此项资料。', en: 'Please supply or confirm this detail.' } })
  const priority = { conflicting: 0, ambiguous: 1, unsupported: 2, missing: 3, confirmationNeeded: 4 }
  const orderedIssues = issues.filter(x => applicableDetails(form, snapshot.isSeries).includes(x.field))
    .sort((a, b) => priority[a.kind] - priority[b.kind])
  return { ...result, form, sources, adoptedFields, revision: snapshot.revision, completion, issues: orderedIssues.slice(0, 10) }
}

export class EventDetailsSession extends AiChatSession<DetailsResult> {
  constructor(storage: DurableObjectStateLike, env: Env) {
    super(storage, env, {
      storageKey: 'event-details-v1', routeNotFoundMessage: 'Details session route not found.', scenarioDefinition: SCENARIO,
      responseSchema: DETAILS_RESPONSE_SCHEMA, normalizeDraft: readDetailsAiResult, validateDraft: () => [],
      buildGeminiContext: ({ state, userMessage }) => ({ task: 'event-details-v1', snapshot: readDetailsSnapshot(state.appContext.knownFacts?.snapshot), userMessage, chatHistory: state.chatHistory.slice(-8), language: state.appContext.language ?? 'bilingual' }),
      mergeDraft: (_previous, next, state, message) => mergeDetails(readDetailsSnapshot(state.appContext.knownFacts?.snapshot), next, message),
      formatChatHistoryEntry: result => JSON.stringify({ assistantReply: result.assistantReply, issues: result.issues }),
    })
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (!['/details/message', '/details/state', '/details/close'].includes(url.pathname)) return Response.json({ message: 'Details session route not found.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
    if (url.pathname.endsWith('/message')) {
      try {
        const body = await request.json() as Record<string, unknown>
        if (typeof body.message !== 'string' || body.message.length > 8000) throw new Error('Invalid message.')
        const context = record(body.appContext) ? body.appContext : {}
        const facts = record(context.knownFacts) ? context.knownFacts : {}
        const snapshot = readDetailsSnapshot(facts.snapshot)
        request = new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({ message: body.message, inputMode: 'text', appContext: { language: context.language === 'en' ? 'en' : 'zh', knownFacts: { snapshot } } }) })
      } catch { return Response.json({ message: 'Invalid event details input.' }, { status: 400, headers: { 'cache-control': 'no-store', vary: 'Cookie, Authorization' } }) }
    }
    return this.handleRequest(request, url.searchParams.get('sessionId') ?? 'default')
  }
}
