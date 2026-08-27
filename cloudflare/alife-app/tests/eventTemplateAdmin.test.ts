import assert from 'node:assert/strict'
import test from 'node:test'
import type { AdminEventActivityTemplate } from '../src/types/eventTemplateAdmin.ts'
import {
  emptyEventTemplateAdminForm,
  eventTemplateToAdminForm,
  normalizeEventTemplateCode,
  toCreateEventTemplateRequest,
  toUpdateEventTemplateRequest,
  validateEventTemplateAdminForm,
} from '../src/utils/eventTemplateAdminState.ts'

const archetypes = new Set(['simple-social', 'camp-retreat', 'recurring-gathering', 'festival-celebration'])
const modules = new Set(['PEOPLE.REGISTRATION', 'SERVICE.ROSTER', 'COMMS.FOLLOWUP'])
const icons = new Set(['people', 'outdoors'])
const workflows = new Set(['camp', 'outreach'])

const validForm = () => ({
  ...emptyEventTemplateAdminForm(),
  code: 'community-picnic',
  name: { en: ' Community picnic ', zh: ' 社区野餐 ' },
  description: { en: ' A local gathering. ', zh: ' 本地聚会。 ' },
  iconKey: 'outdoors',
  defaults: { visibility: 'groupVisible' as const, registrationMode: 'required' as const, capacityUnit: 'People' as const },
  preselectedModules: ['COMMS.FOLLOWUP', 'PEOPLE.REGISTRATION'],
})

test('template admin validates a complete bilingual template in a fixed category', () => {
  assert.equal(validateEventTemplateAdminForm(validForm(), archetypes, modules, icons, workflows), null)
  assert.equal(normalizeEventTemplateCode('  COMMUNITY-PICNIC  '), 'community-picnic')
})

test('unknown categories, capabilities, icons and workflows fail closed', () => {
  assert.equal(validateEventTemplateAdminForm({ ...validForm(), archetypeCode: 'custom-category' }, archetypes, modules, icons, workflows), 'archetype')
  assert.equal(validateEventTemplateAdminForm({ ...validForm(), preselectedModules: ['MONEY.FINANCE'] }, archetypes, modules, icons, workflows), 'modules')
  assert.equal(validateEventTemplateAdminForm({ ...validForm(), iconKey: 'remote-script' }, archetypes, modules, icons, workflows), 'icon')
  assert.equal(validateEventTemplateAdminForm({ ...validForm(), recommendedWorkflowTemplateCode: 'dynamic-workflow' }, archetypes, modules, icons, workflows), 'workflow')
})

test('roster presets require SERVICE.ROSTER and valid unique bilingual slots', () => {
  const slot = { roleCode: 'event.host', label: { en: 'Host', zh: '接待' }, requiredCount: 2, eligibilityCode: 'approvedGroupMember' as const }
  assert.equal(validateEventTemplateAdminForm({ ...validForm(), presetServiceSlots: [slot] }, archetypes, modules, icons, workflows), 'roster-module')
  assert.equal(validateEventTemplateAdminForm({ ...validForm(), preselectedModules: [...validForm().preselectedModules, 'SERVICE.ROSTER'] }, archetypes, modules, icons, workflows), 'roster-slots')
  assert.equal(validateEventTemplateAdminForm({ ...validForm(), preselectedModules: [...validForm().preselectedModules, 'SERVICE.ROSTER'], presetServiceSlots: [slot, { ...slot }] }, archetypes, modules, icons, workflows), 'slot-code')
  assert.equal(validateEventTemplateAdminForm({ ...validForm(), preselectedModules: [...validForm().preselectedModules, 'SERVICE.ROSTER'], presetServiceSlots: [slot] }, archetypes, modules, icons, workflows), null)
})

test('request mapping trims bilingual fields, normalizes code and fixes capacity unit', () => {
  const request = toCreateEventTemplateRequest(validForm())

  assert.equal(request.code, 'community-picnic')
  assert.deepEqual(request.name, { en: 'Community picnic', zh: '社区野餐' })
  assert.deepEqual(request.description, { en: 'A local gathering.', zh: '本地聚会。' })
  assert.deepEqual(request.preselectedModules, ['COMMS.FOLLOWUP', 'PEOPLE.REGISTRATION'])
  assert.equal(request.defaults.capacityUnit, 'People')
  assert.equal('archetypeCode' in toUpdateEventTemplateRequest(validForm()), false)
  assert.equal('code' in toUpdateEventTemplateRequest(validForm()), false)
})

test('editing clones nested server state and preserves immutable identifiers locally', () => {
  const source: AdminEventActivityTemplate = {
    template: {
      code: 'community-picnic', version: 3, archetypeCode: 'simple-social',
      name: { en: 'Community picnic', zh: '社区野餐' },
      description: { en: 'A local gathering.', zh: '本地聚会。' },
      iconKey: 'outdoors',
      defaults: { visibility: 'groupVisible', registrationMode: 'required', capacityUnit: 'People' },
      preselectedModules: ['SERVICE.ROSTER'], recommendedWorkflowTemplateCode: null,
      presetServiceSlots: [{ roleCode: 'event.host', label: { en: 'Host', zh: '接待' }, requiredCount: 1, eligibilityCode: 'approvedGroupMember' }],
    },
    isActive: false, isSystemPreset: false, eTag: '"etag"', updatedUtc: '2026-08-27T00:00:00Z',
  }

  const form = eventTemplateToAdminForm(source)
  form.name.en = 'Changed'
  form.presetServiceSlots[0].label.en = 'Changed host'

  assert.equal(form.code, 'community-picnic')
  assert.equal(form.archetypeCode, 'simple-social')
  assert.equal(form.isActive, false)
  assert.equal(source.template.name.en, 'Community picnic')
  assert.equal(source.template.presetServiceSlots[0].label.en, 'Host')
})
