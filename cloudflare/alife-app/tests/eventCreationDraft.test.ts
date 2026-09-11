import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { creationMessage } from '../src/utils/eventCreationCopy.ts'
import type { EventActivityType, EventArchetype, ModuleDecision } from '../src/types/eventComposition.ts'
import { changeOptionalModule, composeCreationDraft, createRequestSequence, createSubmissionGuard, creationDraftKey, creationEvent, creationSeries, creationSettings, initialCreationDraft, restoreCreationDraft, selectCreationTemplate, validateCreationDraft } from '../src/utils/eventCreationDraft.ts'

const type: EventActivityType = {
  code: 'shared-meal', archetypeCode: 'simple-social', version: 2,
  name: { en: 'Meal', zh: '聚餐' }, description: { en: '', zh: '' }, iconKey: 'meal',
  defaults: { visibility: 'groupVisible', registrationMode: 'required', capacityUnit: 'People' },
  preselectedModules: ['PEOPLE.REGISTRATION', 'FOOD.HOSPITALITY'], presetServiceSlots: [],
}
const recurring: EventActivityType = { ...type, code: 'bible-study-course', archetypeCode: 'recurring-gathering', defaults: { ...type.defaults, visibility: 'churchVisible', registrationMode: 'none' }, recommendedWorkflowTemplateCode: 'camp' }
const category = (item: EventActivityType): EventArchetype => ({
  code: item.archetypeCode, version: 1, name: item.name, isSeries: item === recurring,
  occurrenceCount: 1, hasSessions: false, hasZones: false, requiredModules: [], recommendedModules: [],
  conditionalModules: [], workflowTemplateRecommendations: [], activityTypes: [item],
})
const draft = () => ({ ...selectCreationTemplate(initialCreationDraft(), type), title: { en: 'Meal', zh: '聚餐' }, description: { en: 'Together', zh: '相聚' }, maxCapacity: '20' })

test('template suggestions are not recorded as human selections or confirmed facts', () => {
  const request = composeCreationDraft(draft(), type)
  assert.deepEqual(request.humanSelections, [])
  assert.equal(request.facts.items.find(x => x.code === 'food.serviceRequired')?.certainty, 'unknown')
  assert.equal(request.facts.items.find(x => x.code === 'people.registrationMode')?.value, 'required')
})

test('template changes preserve copy, facts and explicit overrides while untouched defaults follow the template', () => {
  const before = draft()
  before.factValues['people.childrenPresent'] = 'yes'
  before.moduleOverrides['FOOD.HOSPITALITY'] = false
  const changed = selectCreationTemplate(before, recurring)
  assert.deepEqual(changed.title, before.title)
  assert.equal(changed.factValues['people.childrenPresent'], 'yes')
  assert.deepEqual(composeCreationDraft(changed, recurring).humanSelections, [{ moduleCode: 'FOOD.HOSPITALITY', selected: false }])
  assert.equal(creationSettings(changed, recurring).registrationMode, 'none')
  assert.equal(creationSettings(changed, recurring).visibility, 'churchVisible')
  changed.overrides.visibility = 'public'
  assert.equal(creationSettings(selectCreationTemplate(changed, type), type).visibility, 'public')
  assert.equal(creationSettings(selectCreationTemplate(changed, type), type).useRecommendedWorkflow, false)
})

test('AI suggestions stay candidates until a human answers; extra tools never confirm facts', () => {
  const value = draft()
  value.aiCandidateFacts['move.transportRequired'] = true
  value.moduleOverrides['MONEY.FINANCE'] = true
  let request = composeCreationDraft(value, type)
  assert.equal(request.facts.items.find(x => x.code === 'move.transportRequired')?.certainty, 'candidate')
  assert.equal(request.facts.items.find(x => x.code === 'money.hasMoneyFlow')?.value, null)
  value.factValues['move.transportRequired'] = 'no'
  request = composeCreationDraft(value, type)
  assert.deepEqual(request.facts.items.find(x => x.code === 'move.transportRequired'), { code: 'move.transportRequired', value: false, certainty: 'confirmed', source: 'human' })
})

test('required server decisions cannot be disabled, optional decisions can be overridden', () => {
  const value = draft()
  const required = { moduleCode: 'FOOD.HOSPITALITY', status: 'required' } as ModuleDecision
  assert.equal(changeOptionalModule(value, required, false), value)
  assert.equal(changeOptionalModule(value, { ...required, status: 'selected' }, false).moduleOverrides['FOOD.HOSPITALITY'], false)
})

test('copy changes invalidate the creation input without changing composition inputs', () => {
  const before = draft(), after = { ...before, title: { en: 'New title', zh: '新名称' } }
  assert.deepEqual(composeCreationDraft(before, type), composeCreationDraft(after, type))
  assert.notEqual(JSON.stringify(before), JSON.stringify(after))
})

test('request sequence rejects out-of-order responses, unmounted requests and failed-request retries', () => {
  const sequence = createRequestSequence()
  const old = sequence.next(), latest = sequence.next()
  assert.equal(sequence.isCurrent(old), false)
  assert.equal(sequence.isCurrent(latest), true)
  sequence.invalidate()
  assert.equal(sequence.isCurrent(latest), false)
  const retry = sequence.next()
  assert.equal(sequence.isCurrent(retry), true)
})

test('duplicate submissions are blocked, retries reuse keys and changed proposals receive new keys', () => {
  const guard = createSubmissionGuard()
  const first = guard.begin('draft:hash1')
  assert.ok(first)
  assert.equal(guard.begin('draft:hash1'), null)
  guard.finish(false)
  assert.equal(guard.begin('draft:hash1'), first)
  guard.finish(false)
  assert.notEqual(guard.begin('draft:hash2'), first)
  guard.finish(true)
  assert.equal(guard.begin('draft:hash2'), null)
})

test('new drafts roundtrip, isolate viewers and groups, and reject legacy or invalid persisted values', () => {
  const value = draft(), catalogue = [category(type)]
  assert.deepEqual(restoreCreationDraft(JSON.stringify({ version: 3, draft: value }), catalogue), value)
  assert.equal(restoreCreationDraft(JSON.stringify(value), catalogue), null)
  assert.equal(restoreCreationDraft(JSON.stringify({ version: 1, draft: value }), catalogue), null)
  assert.equal(restoreCreationDraft(JSON.stringify({ version: 2, draft: { ...value, title: {} } }), catalogue), null)
  assert.equal(restoreCreationDraft(JSON.stringify({ version: 2, draft: { ...value, activityTypeCode: 'unknown' } }), catalogue), null)
  assert.equal(restoreCreationDraft(JSON.stringify({ version: 2, draft: { ...value, moduleOverrides: { 'unknown': true } } }), catalogue), null)
  assert.notEqual(creationDraftKey('a', 'group'), creationDraftKey('b', 'group'))
  assert.notEqual(creationDraftKey('a', 'group'), creationDraftKey('a', 'other'))
})

test('one-off and recurring payloads retain bilingual copy and only include applicable settings', () => {
  const value = draft()
  assert.equal(validateCreationDraft(value, type, category(type), false), '')
  assert.equal(creationSeries(value, category(type)), null)
  assert.deepEqual(creationEvent(value, type, 'Leader').title, value.title)
  assert.equal(creationEvent(value, type, 'Leader').posterImageUrl, null)
  const repeat = selectCreationTemplate(value, recurring)
  assert.equal(creationEvent(repeat, recurring, 'Leader').maxCapacity, 0)
  assert.equal(repeat.maxCapacity, '20')
  assert.equal(creationSeries(repeat, category(recurring))?.rollingOccurrenceWeeks, 12)
  assert.match(creationSeries(repeat, category(recurring))!.recurrenceRule, /^FREQ=WEEKLY/)
  assert.notEqual(validateCreationDraft({ ...repeat, timeZone: 'bad-timezone' }, recurring, category(recurring), true), '')
  assert.notEqual(validateCreationDraft({ ...value, endLocal: 'bad-date' }, type, category(type), true), '')
  assert.notEqual(validateCreationDraft({ ...value, maxCapacity: '1.5' }, type, category(type), true), '')
})

test('readiness tasks and required-module warnings use readable bilingual labels without changing the server message', () => {
  const modules = [{ moduleCode: 'FOOD.HOSPITALITY', label: { en: 'Food', zh: '餐饮' } }] as ModuleDecision[]
  const task = { en: 'Food: complete allergy-process-confirmed.', zh: '餐饮：完成 allergy-process-confirmed。' }
  assert.equal(creationMessage(task, true, modules), '餐饮: 确认过敏处理安排')
  assert.equal(creationMessage(task, false, modules), 'Food: Confirm allergy handling arrangements')
  assert.match(task.en, /allergy-process-confirmed/)
  assert.equal(creationMessage({ en: 'FOOD.HOSPITALITY remains required.', zh: 'FOOD.HOSPITALITY 仍为必需。' }, true, modules), '餐饮 仍为必需。')
})
