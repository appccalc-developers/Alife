import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readCreationProjectAssistantInput } from '../../shared/eventCreationAssistant.ts'
import { applyConversationDraft } from '../src/utils/eventConversationDraft.ts'
import { initialCreationDraft } from '../src/utils/eventCreationDraft.ts'
import { emptyActivityPlan } from '../src/types/eventActivityPlan.ts'
import { activityPlanAssistantForm } from '../src/utils/eventFormAssistant.ts'
import { newProjectAnswers } from '../src/utils/eventProjectQuestionnaire.ts'
import type { DetailsResult } from '../../shared/eventDetails.ts'

const bi = (text: string) => ({ en: text, zh: text })
const projectInput = () => ({ groupId: '11111111-1111-1111-1111-111111111111', revision: 1, language: 'zh', timeZone: 'Pacific/Auckland', message: '30 people', history: [], form: activityPlanAssistantForm(emptyActivityPlan()) })
test('creation project assistance is group-scoped and rejects saved IDs, other scopes and private fields', () => {
  const input = readCreationProjectAssistantInput(projectInput())
  assert.equal(input.scope, 'activityPlan'); assert.equal(input.eventId, projectInput().groupId)
  for (const change of [{ eventId: projectInput().groupId }, { scope: 'tasks' }, { groupId: 'bad' }, { members: [] }, { form: { ...projectInput().form, contact: 'private' } }]) {
    assert.throws(() => readCreationProjectAssistantInput({ ...projectInput(), ...change }))
  }
})
function fixture() {
  const draft = initialCreationDraft()
  draft.timeZone = 'Pacific/Auckland'; draft.title = bi('Meal')
  draft.moduleConfirmations = { 'TEAM.WORK': true }
  draft.activityPlan = { ...emptyActivityPlan(), activities: [{ id: 'stable', attributes: ['meal'], name: bi('Lunch'), conditions: bi('Indoors'), answers: newProjectAnswers(), sourcePresetKey: 'lunch', presetConfirmed: true, occurrenceId: 'stable-occurrence', startUtc: '2026-11-14T00:00:00Z' }] }
  const details: DetailsResult = { version: 1, revision: 1, form: { title: bi('New meal'), description: bi(''), locationName: bi(''), startLocal: null, endLocal: null, timeZone: draft.timeZone, visibility: 'groupVisible', registrationMode: 'none', maxCapacity: null, intervalWeeks: null }, adoptedFields: ['title'], sources: { title: 'explicit' }, issues: [], fieldAssessments: [], assessment: { sufficiencyScore: 10, summary: bi('Review') }, assistantReply: bi('Review'), completion: { completed: 1, total: 8, percent: 12, pending: [] } }
  return { draft, details }
}
test('atomic conversation adoption preserves project identity and clears stale human acceptance', () => {
  const { draft, details } = fixture(), original = structuredClone(draft)
  const form = activityPlanAssistantForm(draft.activityPlan!)
  form.activities = [{ id: 'stable', attributes: ['meal'], name: bi('Shared lunch'), conditions: bi('Bring a dish'), occurrenceId: 'stable-occurrence' }]
  form.participantCount = 30
  const result = applyConversationDraft(draft, details, { revision: 1, form, adoptedFields: ['activities', 'participantCount'], assistantReply: bi('Review') }, 'New meal')
  assert.equal(result.title.en, 'New meal'); assert.equal(result.activityPlan?.participantCount, 30)
  assert.equal(result.activityPlan?.activities[0].id, 'stable'); assert.equal(result.activityPlan?.activities[0].occurrenceId, 'stable-occurrence')
  assert.equal(result.activityPlan?.activities[0].startUtc, original.activityPlan?.activities[0].startUtc)
  assert.equal(result.activityPlan?.activities[0].presetConfirmed, false)
  assert.ok(Object.values(result.activityPlan!.activities[0].answers).every(a => a.confirmed === false))
  assert.equal(result.moduleConfirmations?.['TEAM.WORK'], false); assert.deepEqual(draft, original)
})
test('invalid local-time tuple rejects the whole conversation draft without mutation', () => {
  const { draft, details } = fixture(), original = structuredClone(draft)
  details.adoptedFields = ['title', 'startLocal', 'endLocal']
  details.form.startLocal = '2026-09-27T02:30'; details.form.endLocal = '2026-09-27T04:00'
  assert.throws(() => applyConversationDraft(draft, details, { revision: 1, form: activityPlanAssistantForm(draft.activityPlan!), adoptedFields: [], assistantReply: bi('Review') }, 'New meal'))
  assert.deepEqual(draft, original)
})
