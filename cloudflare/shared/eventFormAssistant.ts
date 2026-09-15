import { isTimeZone, localTimeToUtc, type Bilingual } from './eventDetails.ts'

export type FormAssistantScope = 'tasks' | 'registration'
type Field = { label: Bilingual; kind: 'bilingual' | 'integer' | 'boolean' | 'enum' | 'localTime' | 'currency' | 'materials'; values?: string[]; min?: number; max?: number }
const field = (en: string, zh: string, kind: Field['kind'], extra: Partial<Field> = {}): Field => ({ label: { en, zh }, kind, ...extra })
export const formAssistantFields: Record<FormAssistantScope, Record<string, Field>> = {
  tasks: {
    title: field('Task title', '任务标题', 'bilingual', { max: 300 }), dueLocal: field('Due time', '期限', 'localTime'),
    stage: field('Stage', '所属阶段', 'enum', { values: ['preparation', 'registration', 'execution', 'followup'] }),
    requiresApproval: field('Requires approval', '需要审核', 'boolean'), isRestricted: field('Restricted task', '限制任务', 'boolean'),
  },
  registration: {
    purpose: field('Why registration is needed', '为什么需要报名', 'bilingual'),
    audience: field('Eligible participants', '报名资格', 'enum', { values: ['invited', 'group', 'church', 'public'] }),
    eligibility: field('Additional eligibility conditions', '附加资格条件', 'bilingual'),
    capacity: field('Capacity', '人数上限', 'integer', { min: 1, max: 1000000 }),
    opensLocal: field('Opens', '报名开放时间', 'localTime'), deadlineLocal: field('Deadline', '报名截止时间', 'localTime'),
    allowWaitlist: field('Allow waitlist', '允许候补', 'boolean'), terms: field('Participation rules', '参加规则', 'bilingual'),
    privacyNotice: field('Privacy notice', '隐私说明', 'bilingual'), cancellationTerms: field('Cancellation terms', '取消条款', 'bilingual'),
    channel: field('Registration channel', '办理渠道', 'enum', { values: ['app', 'manual', 'both'] }),
    manualReview: field('Manual verification', '人工核实资格和材料', 'boolean'), materials: field('Material requirements', '材料要求', 'materials'),
    feeMinor: field('Fee in minor currency units', '报名费（货币最小单位）', 'integer', { min: 0, max: 100000000 }),
    currency: field('Currency', '币种', 'currency'),
    moneyFlowScope: field('Money flows', '金流范围', 'enum', { values: ['unspecified', 'registrationFeesOnly', 'otherMoney'] }),
    paymentInstructions: field('Payment instructions', '收付款说明', 'bilingual'), refundTerms: field('Refund terms', '退款条款', 'bilingual'),
  },
}
export type AssistantForm = Record<string, unknown>
export type FormAssistantInput = { eventId: string; scope: FormAssistantScope; revision: number; language: 'en' | 'zh'; timeZone: string; form: AssistantForm; message: string; history: { role: 'user' | 'assistant'; text: string }[] }
export type FormAssistantResult = { revision: number; form: AssistantForm; adoptedFields: string[]; assistantReply: Bilingual }
export const assistantObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const only = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every(k => keys.includes(k))
const bilingual = (v: unknown, max = 10000): v is Bilingual => assistantObject(v) && only(v, ['en', 'zh']) && typeof v.en === 'string' && typeof v.zh === 'string' && v.en.length <= max && v.zh.length <= max
export function validAssistantField(definition: Field, value: unknown, timeZone: string, draft = false): boolean {
  switch (definition.kind) {
    case 'bilingual': return bilingual(value, definition.max ?? 10000)
    case 'boolean': return typeof value === 'boolean'
    case 'enum': return typeof value === 'string' && !!definition.values?.includes(value)
    case 'integer': return Number.isSafeInteger(value) && (draft || Number(value) >= (definition.min ?? 0) && Number(value) <= (definition.max ?? 1000000))
    case 'currency': return typeof value === 'string' && (draft ? value.length <= 3 : /^[A-Z]{3}$/.test(value))
    case 'localTime':
      if (value === '') return true
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false
      try { localTimeToUtc(value, timeZone); return true } catch { return false }
    case 'materials': return Array.isArray(value) && value.length <= 20 && value.every(m => assistantObject(m) && only(m, ['id', 'label', 'kind', 'required', 'maxCount', 'maxBytes']) && typeof m.id === 'string' && m.id.length <= 80 && bilingual(m.label) && ['text', 'image', 'file'].includes(String(m.kind)) && typeof m.required === 'boolean' && Number.isInteger(m.maxCount) && Number(m.maxCount) >= 1 && Number(m.maxCount) <= 10 && Number.isInteger(m.maxBytes) && Number(m.maxBytes) >= 1 && Number(m.maxBytes) <= 20971520)
  }
}
export function readFormAssistantInput(value: unknown): FormAssistantInput {
  if (!assistantObject(value) || !only(value, ['eventId', 'scope', 'revision', 'language', 'timeZone', 'form', 'message', 'history']) || !['tasks', 'registration'].includes(String(value.scope)) || typeof value.eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.eventId) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !['en', 'zh'].includes(String(value.language)) || !isTimeZone(value.timeZone) || typeof value.message !== 'string' || !value.message.trim() || value.message.length > 8000 || !assistantObject(value.form) || !Array.isArray(value.history) || value.history.length > 8) throw new Error('Invalid form assistance request.')
  const input = value as FormAssistantInput, definitions = formAssistantFields[input.scope]
  if (Object.keys(input.form).length !== Object.keys(definitions).length || Object.entries(input.form).some(([key, v]) => !Object.hasOwn(definitions, key) || !validAssistantField(definitions[key], v, input.timeZone, true))) throw new Error('Invalid form fields.')
  if (input.history.some(t => !assistantObject(t) || !only(t, ['role', 'text']) || !['user', 'assistant'].includes(String(t.role)) || typeof t.text !== 'string' || t.text.length > 8000)) throw new Error('Invalid conversation.')
  return input
}
export function validateFormAssistantResult(value: unknown, input: FormAssistantInput): FormAssistantResult {
  if (!assistantObject(value) || !only(value, ['revision', 'form', 'adoptedFields', 'assistantReply']) || value.revision !== input.revision || !assistantObject(value.form) || !Array.isArray(value.adoptedFields) || !bilingual(value.assistantReply, 1200) || !value.assistantReply.en.trim() || !value.assistantReply.zh.trim()) throw new Error('Invalid form assistance response.')
  const definitions = formAssistantFields[input.scope], form = { ...input.form }, adoptedFields = value.adoptedFields
  if (Object.keys(value.form).length !== Object.keys(definitions).length || Object.keys(value.form).some(k => !Object.hasOwn(definitions, k)) || adoptedFields.some(k => typeof k !== 'string' || !Object.hasOwn(definitions, k)) || new Set(adoptedFields).size !== adoptedFields.length) throw new Error('Invalid suggested fields.')
  for (const key of adoptedFields as string[]) {
    if (!validAssistantField(definitions[key], value.form[key], input.timeZone)) throw new Error('Invalid suggested value.')
    form[key] = value.form[key]
  }
  if (input.scope === 'registration' && (adoptedFields.includes('opensLocal') || adoptedFields.includes('deadlineLocal')) && (!form.opensLocal || !form.deadlineLocal || localTimeToUtc(String(form.deadlineLocal), input.timeZone) <= localTimeToUtc(String(form.opensLocal), input.timeZone))) throw new Error('Invalid registration time range.')
  if (adoptedFields.includes('materials')) {
    const oldIds = new Set((input.form.materials as { id: string }[]).map(m => m.id)), ids = (form.materials as { id: string }[]).map(m => m.id).filter(Boolean)
    if (ids.some(id => !oldIds.has(id)) || new Set(ids).size !== ids.length) throw new Error('Invalid material identity.')
  }
  return { revision: input.revision, form, adoptedFields: adoptedFields as string[], assistantReply: value.assistantReply }
}
export function mergeFormAssistantResult(value: unknown, input: FormAssistantInput): FormAssistantResult {
  if (!assistantObject(value) || !only(value, ['form', 'evidence', 'assistantReply']) || !assistantObject(value.form) || !Array.isArray(value.evidence) || value.evidence.length > 20) throw new Error('Invalid form assistance response.')
  const definitions = formAssistantFields[input.scope], form = { ...input.form }, adoptedFields: string[] = []
  if (Object.entries(value.form).some(([key, v]) => !Object.hasOwn(definitions, key) || !validAssistantField(definitions[key], v, input.timeZone))) throw new Error('Invalid suggested fields.')
  const seen = new Set<string>()
  for (const item of value.evidence) {
    if (!assistantObject(item) || !only(item, ['field', 'quote']) || typeof item.field !== 'string' || !Object.hasOwn(definitions, item.field) || seen.has(item.field) || typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 800) throw new Error('Invalid field evidence.')
    seen.add(item.field)
    const old = input.form[item.field], quote = item.quote
    const proposed = value.form[item.field]
    const materialTranslation = item.field === 'materials' && Array.isArray(old) && Array.isArray(proposed)
      && old.some(m => bilingual(m.label) && [m.label.en, m.label.zh].some(text => text.includes(quote)))
      && old.length === proposed.length && old.every((m, index) => {
        const next = proposed[index]
        return ['id', 'kind', 'required', 'maxCount', 'maxBytes'].every(key => next[key] === m[key])
          && ['en', 'zh'].every(locale => !m.label[locale].trim() || next.label[locale] === m.label[locale])
      })
    const supported = input.message.includes(quote) || materialTranslation || definitions[item.field].kind === 'bilingual' && bilingual(old) && [old.en, old.zh].some(text => text.includes(quote))
    if (supported && Object.hasOwn(value.form, item.field)) { form[item.field] = value.form[item.field]; adoptedFields.push(item.field) }
  }
  return validateFormAssistantResult({ revision: input.revision, form, adoptedFields, assistantReply: value.assistantReply }, input)
}
export function assistantApplicableFields(scope: FormAssistantScope, form: AssistantForm) {
  return Object.keys(formAssistantFields[scope]).filter(key => scope !== 'registration' || !['paymentInstructions', 'refundTerms', 'moneyFlowScope'].includes(key) || Number(form.feeMinor) > 0)
}
export function assistantFieldComplete(scope: FormAssistantScope, key: string, form: AssistantForm, timeZone: string) {
  const definition = formAssistantFields[scope][key], value = form[key]
  if (!validAssistantField(definition, value, timeZone)) return false
  if (definition.kind === 'bilingual') return bilingual(value) && !!value.en.trim() && !!value.zh.trim()
  if (definition.kind === 'materials') return (value as { label: Bilingual }[]).every(m => m.label.en.trim() && m.label.zh.trim())
  return value !== '' && !(key === 'moneyFlowScope' && value === 'unspecified')
}
export function formAssistantSchema(scope: FormAssistantScope) {
  const text = { type: 'string' }, bilingual = { type: 'object', required: ['en', 'zh'], properties: { en: text, zh: text } }
  const properties = Object.fromEntries(Object.entries(formAssistantFields[scope]).map(([key, d]) => [key,
    d.kind === 'bilingual' ? bilingual : d.kind === 'enum' ? { type: 'string', enum: d.values } : d.kind === 'materials' ? { type: 'array', items: { type: 'object', required: ['id', 'label', 'kind', 'required', 'maxCount', 'maxBytes'], properties: { id: { type: 'string', description: 'Retain existing requirement IDs; empty string for new requirements.' }, label: bilingual, kind: { type: 'string', enum: ['text', 'image', 'file'] }, required: { type: 'boolean' }, maxCount: { type: 'integer' }, maxBytes: { type: 'integer' } } } } : { type: ['boolean', 'integer'].includes(d.kind) ? d.kind : 'string', description: `${d.label.en}${d.kind === 'localTime' ? ': YYYY-MM-DDTHH:mm in the supplied time zone; empty if unknown.' : ''}` },
  ]))
  return { type: 'object', required: ['form', 'evidence', 'assistantReply'], properties: { form: { type: 'object', properties }, evidence: { type: 'array', items: { type: 'object', required: ['field', 'quote'], properties: { field: { type: 'string', enum: Object.keys(properties) }, quote: { type: 'string', description: 'Exact supporting quote from the current message, or the same existing bilingual field for faithful translation.' } } } }, assistantReply: bilingual } }
}
