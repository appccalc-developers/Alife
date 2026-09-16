import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assistantApplicableFields, assistantFieldComplete, formAssistantFields, mergeFormAssistantResult, readFormAssistantInput, validateFormAssistantResult, type FormAssistantInput } from '../../shared/eventFormAssistant.ts'
import { activityPlanAssistantForm, applyActivityPlanAssistantForm, applyRegistrationAssistantForm, registrationAssistantForm } from '../src/utils/eventFormAssistant.ts'

const bi = (en: string, zh = en) => ({ en, zh })
const task = (): FormAssistantInput => ({ eventId: '11111111-1111-1111-1111-111111111111', scope: 'tasks', revision: 3, language: 'zh', timeZone: 'Australia/Perth', message: '准备场地', history: [], form: { title: bi(''), dueLocal: '', stage: 'preparation', requiresApproval: false, isRestricted: false } })
const registration = (): FormAssistantInput => ({ ...task(), scope: 'registration', form: Object.fromEntries(Object.entries(formAssistantFields.registration).map(([key, d]) => [key, d.kind === 'bilingual' ? bi('') : d.kind === 'boolean' ? false : d.kind === 'integer' ? key === 'capacity' ? 30 : 0 : d.kind === 'materials' ? [] : d.kind === 'currency' ? 'NZD' : d.kind === 'enum' ? d.values![0] : key === 'opensLocal' ? '2026-10-01T09:00' : '2026-10-02T09:00'])) })
const activityPlan = (): FormAssistantInput => ({ ...task(), scope: 'activityPlan', context: { eventTitle: bi('Community meal', '社区聚餐'), eventDescription: bi('Gather indoors for a shared meal.', '在室内一起聚餐。') }, form: { activities: [{ id: 'meal-1', type: 'meal', name: bi('', ''), conditions: bi('', ''), occurrenceId: null }], participantCount: null, isOuting: false, isOvernight: false, isHighRisk: false } })
const reply = (form: Record<string, unknown>, field: string, quote: string) => ({ form, evidence: [{ field, quote }], assistantReply: bi('Review the draft', '请核对草稿') })

test('input allowlists exclude people, assignments, other module fields and private records', () => {
  assert.deepEqual(readFormAssistantInput(task()), task())
  assert.deepEqual(readFormAssistantInput(registration()), registration())
  assert.deepEqual(readFormAssistantInput(activityPlan()), activityPlan())
  for (const field of ['members', 'assignedMemberId', 'reviewerMemberId', 'capacity', '__proto__']) assert.throws(() => readFormAssistantInput({ ...task(), form: { ...task().form, [field]: 'private' } }))
  for (const field of ['participants', 'uploads', 'approvals', 'eligibleGroupId']) assert.throws(() => readFormAssistantInput({ ...registration(), form: { ...registration().form, [field]: 'private' } }))
  assert.throws(() => readFormAssistantInput({ ...task(), scope: 'unknown' }))
  assert.throws(() => readFormAssistantInput({ ...task(), message: 'a'.repeat(8001) }))
  assert.throws(() => readFormAssistantInput({ ...task(), form: { ...task().form, title: bi('a'.repeat(301)) } }))
  assert.throws(() => readFormAssistantInput({ ...task(), history: Array(9).fill({ role: 'user', text: 'history' }) }))
})
test('activity plan assistance can use event title and description as evidence without making RAM decisions', () => {
  const input = activityPlan()
  const proposed = [{ id: 'meal-1', type: 'meal', name: bi('Shared meal', '共享聚餐'), conditions: bi('Indoor hall with accessible tables.', '室内礼堂，桌椅之间保持通道。'), occurrenceId: null }]
  const result = mergeFormAssistantResult({ form: { activities: proposed, isOuting: false }, evidence: [{ field: 'activities', quote: 'Community meal' }, { field: 'isOuting', quote: 'Gather indoors' }], assistantReply: bi('Please review the activity and conditions.', '请核对活动项目与条件。') }, input)
  assert.deepEqual(result.adoptedFields, ['activities', 'isOuting'])
  const next = applyActivityPlanAssistantForm({ activities: [{ ...proposed[0] }], participantCount: null, isOuting: false, isOvernight: false, isHighRisk: false, weatherConfirmation: bi('') }, result.form, result.adoptedFields)
  assert.equal(next.activities[0].id, 'meal-1'); assert.equal(next.isOuting, false); assert.deepEqual(activityPlanAssistantForm(next).activities, next.activities)
  const added = mergeFormAssistantResult({ form: { activities: [...proposed, { id: '', type: 'outdoor', name: bi('Walk', '散步'), conditions: bi('Stay with the group.', '全程跟随小组。'), occurrenceId: null }] }, evidence: [{ field: 'activities', quote: 'Community meal' }], assistantReply: bi('I found one activity.', '我整理了一个活动项目。') }, input)
  assert.equal(applyActivityPlanAssistantForm({ ...next, activities: proposed }, added.form, added.adoptedFields).activities.length, 2)
  const removal = mergeFormAssistantResult({ form: { activities: [] }, evidence: [{ field: 'activities', quote: 'Community meal' }], assistantReply: bi('Please review.', '请核对。') }, input)
  assert.deepEqual(removal.adoptedFields, [])
  input.message = 'Remove the existing activity.'
  assert.deepEqual(mergeFormAssistantResult({ form: { activities: [] }, evidence: [{ field: 'activities', quote: 'Community meal' }], assistantReply: bi('Removed as requested.', '已按要求移除。') }, input).adoptedFields, ['activities'])
})
test('only evidence-backed fields update; existing manual fields and independent snapshots survive', () => {
  const input = task(); input.form.dueLocal = '2026-10-02T12:00'
  const result = mergeFormAssistantResult(reply({ title: bi('Prepare venue', '准备场地'), dueLocal: '2026-10-03T12:00' }, 'title', '准备场地'), input)
  assert.equal((result.form.title as { zh: string }).zh, '准备场地')
  assert.equal(result.form.dueLocal, input.form.dueLocal)
  assert.equal((input.form.title as { en: string }).en, '')
  assert.deepEqual(mergeFormAssistantResult(reply({ title: bi('Fabricated') }, 'title', 'no evidence'), input).adoptedFields, [])
  assert.throws(() => validateFormAssistantResult({ ...result, revision: 2 }, input))
  assert.throws(() => mergeFormAssistantResult(reply({ capacity: 5 }, 'title', '准备场地'), input))
})
test('faithful translation can quote only the same current bilingual field', () => {
  const input = registration(); input.form.purpose = bi('', '协调人数')
  const result = mergeFormAssistantResult(reply({ purpose: bi('Coordinate attendance', '协调人数') }, 'purpose', '协调人数'), input)
  assert.deepEqual(result.adoptedFields, ['purpose'])
  assert.deepEqual(mergeFormAssistantResult(reply({ terms: bi('Made up') }, 'terms', '协调人数'), input).adoptedFields, [])
  assert.equal(assistantFieldComplete('registration', 'purpose', result.form, input.timeZone), true)
  assert.equal(assistantFieldComplete('registration', 'purpose', input.form, input.timeZone), false)
})
test('invalid time and registration intervals cannot partially update a form', () => {
  const input = registration(); input.message = 'Set deadline';
  for (const deadlineLocal of ['2026-09-01T09:00', '2026-10-02T09:00Z', 'bad', '']) assert.throws(() => mergeFormAssistantResult(reply({ deadlineLocal }, 'deadlineLocal', input.message), input))
  const gap = task(); gap.timeZone = 'Pacific/Auckland'; gap.message = 'set due time'
  assert.throws(() => mergeFormAssistantResult(reply({ dueLocal: '2026-09-27T02:30' }, 'dueLocal', gap.message), gap))
})
test('material identities survive edits; new requirements receive local IDs; group stays manual', () => {
  const input = registration(); const material = { id: 'legacy-text', label: bi('Note'), kind: 'text', required: true, maxCount: 1, maxBytes: 1024 }
  input.form.materials = [material]; input.message = 'Add a note requirement'
  const proposed = [material, { ...material, id: '', label: bi('New note') }]
  const result = mergeFormAssistantResult(reply({ materials: proposed }, 'materials', input.message), input)
  const draft = { ...input.form, eligibleGroupId: 'manually-selected', opensUtc: '2026-10-01T01:00:00Z', deadlineUtc: '2026-10-02T01:00:00Z' } as unknown as Parameters<typeof registrationAssistantForm>[0]
  const next = applyRegistrationAssistantForm(draft, result.form, result.adoptedFields, input.timeZone)
  assert.equal(next.eligibleGroupId, 'manually-selected'); assert.equal(next.materials[0].id, 'legacy-text'); assert.ok(next.materials[1].id)
  assert.equal(draft.materials.length, 1); assert.ok(!Object.hasOwn(registrationAssistantForm(next), 'eligibleGroupId'))
  for (const materials of [[{ ...material, id: 'fabricated' }], [material, material]]) assert.throws(() => mergeFormAssistantResult(reply({ materials }, 'materials', input.message), input))
})
test('fee-only fields are conditional and unknown response fields fail closed', () => {
  const input = registration()
  assert.ok(!assistantApplicableFields('registration', input.form).includes('refundTerms'))
  input.form.feeMinor = 1000
  assert.ok(assistantApplicableFields('registration', input.form).includes('refundTerms'))
  assert.throws(() => mergeFormAssistantResult({ ...reply({}, 'capacity', '30'), approvals: [] }, input))
  assert.throws(() => mergeFormAssistantResult({ ...reply({}, 'capacity', '30'), assistantReply: bi('') }, input))
})

test('material translation fills missing text without changing existing requirements', () => {
  const input = registration(), material = { id: 'legacy-note', label: bi('', '备注'), kind: 'text', required: true, maxCount: 1, maxBytes: 1024 }
  input.form.materials = [material]
  const translated = { ...material, label: bi('Notes', '备注') }
  assert.deepEqual(mergeFormAssistantResult(reply({ materials: [translated] }, 'materials', '备注'), input).adoptedFields, ['materials'])
  for (const materials of [[{ ...translated, required: false }], [translated, { ...translated, id: '' }], [{ ...translated, label: bi('Notes', '改变说明') }]]) {
    assert.deepEqual(mergeFormAssistantResult(reply({ materials }, 'materials', '备注'), input).adoptedFields, [])
  }
})
