import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRamAlphaDemoMatrix, ramAlphaDemoLevel, ramDefaultScales, activityAttributes, ramApplicableQuestions, activityAttributeCodes, ramActivityContentName, type RamPolicyData } from '../src/types/ramGovernance.ts'

test('activity attributes use seven fixed bilingual choices', () => {
  assert.deepEqual(activityAttributeCodes, ['hiking', 'water', 'sport', 'transport', 'camp', 'meal', 'outdoor'])
  assert.deepEqual(ramActivityContentName('generic'), { en: 'All activities', zh: '所有活动' })
  for (const code of activityAttributeCodes) assert.ok(ramActivityContentName(code).en && ramActivityContentName(code).zh)
})

test('Alpha Demo preset fills all 25 cells without changing other policy parameters', () => {
  const policy = {
    ...structuredClone(ramDefaultScales),
    matrix: [1, 2, 3, 4, 5].flatMap(likelihood => [1, 2, 3, 4, 5].map(impact => ({ likelihood, impact, level: null }))),
    categories: [], questions: [], reviewRules: { reviewReminderDays: 7 }, source: 'test',
  } satisfies RamPolicyData

  const result = applyRamAlphaDemoMatrix(policy)

  assert.equal(result.matrix.length, 25)
  assert.equal(result.matrix.find(cell => cell.likelihood === 1 && cell.impact === 5)?.level, 'Green')
  assert.equal(result.matrix.find(cell => cell.likelihood === 2 && cell.impact === 3)?.level, 'Yellow')
  assert.equal(result.matrix.find(cell => cell.likelihood === 4 && cell.impact === 5)?.level, 'Red')
  assert.equal(result.source, policy.source)
  assert.ok(policy.matrix.every(cell => cell.level === null))
})

test('Alpha Demo bands and manual-derived bilingual scale definitions remain exact', () => {
  assert.deepEqual([1, 5, 6, 19, 20, 25].map(score => ramAlphaDemoLevel(1, score)), ['Green', 'Green', 'Yellow', 'Yellow', 'Red', 'Red'])
  assert.deepEqual(ramDefaultScales.likelihood.map(scale => [scale.label.en, scale.label.zh]), [
    ['Rare', '极少'], ['Unlikely', '不太可能'], ['Moderate', '中等'], ['Likely', '很可能'], ['Almost certain', '几乎肯定'],
  ])
  assert.deepEqual(ramDefaultScales.impact.map(scale => [scale.label.en, scale.label.zh]), [
    ['Negligible', '可忽略'], ['Minor', '轻微'], ['Moderate', '中等'], ['Major', '严重'], ['Catastrophic', '灾难性'],
  ])
  assert.ok([...ramDefaultScales.likelihood, ...ramDefaultScales.impact].every(scale => scale.description.en && scale.description.zh))
})

import { duplicateRamRisk, ramChanges, ramDraftFingerprint } from '../src/utils/ramAuthoring.ts'
import { parseRamDraft } from '../src/types/ramGovernance.ts'

test('risk copying retains bilingual text while clearing authority and ratings', () => {
  const draft = parseRamDraft(undefined)
  const risk = { id: 'old', activityId: 'a', categoryCode: 'environment', hazard: { en: 'Slip', zh: '滑倒' }, consequence: { en: 'Injury', zh: '受伤' }, controlMeasures: { en: 'Check', zh: '检查' }, additionalAction: { en: '', zh: '' }, personResponsible: 'Owner', likelihood: 2, impact: 3, residualLikelihood: 1, residualImpact: 2 }
  const copy = duplicateRamRisk(risk, 'new')
  assert.deepEqual(copy.hazard, risk.hazard); assert.equal(copy.personResponsible, ''); assert.equal(copy.likelihood, null)
  copy.hazard.zh = '改变'; assert.equal(risk.hazard.zh, '滑倒')
  const next = { ...draft, hazards: [copy] }
  assert.equal(ramChanges(draft, next).length, 1)
  assert.notEqual(ramDraftFingerprint(draft, 'old conditions'), ramDraftFingerprint(draft, 'new conditions'))
  assert.notEqual(ramDraftFingerprint(next, 'same'), ramDraftFingerprint(draft, 'same'))
});

 test('activity attributes match general plus every selected scope, with stable identity and order', () => {
  const bi = (value: string) => ({ en: value, zh: value })
  const questions = ['generic','meal','water','outdoor'].map(activityType => ({code:activityType,activityType,categoryCode:'activity',text:bi(activityType),guidance:bi(activityType)}))
  for (const [attributes, expected] of [[[],['generic']],[['meal'],['generic','meal']],[['meal','outdoor'],['generic','meal','outdoor']],[['water','outdoor'],['generic','water','outdoor']]] as [string[],string[]][]) {
    assert.deepEqual(ramApplicableQuestions([...questions,questions[0]],{attributes}).map(q=>q.code),expected)
  }
  assert.deepEqual(activityAttributes({attributes:[]}),[])
})

import { emptyActivityPlan, validStoredActivityPlan } from '../src/types/eventActivityPlan.ts'

test('stored activity plans and RAM drafts require current fixed attribute arrays', () => {
  const activity = { id: 'a', attributes: ['meal', 'outdoor'], name: { en: 'Meal', zh: 'Meal' }, conditions: { en: '', zh: '' }, answers: {} }
  assert.equal(validStoredActivityPlan({ ...emptyActivityPlan(), activities: [activity] }), true)
  for (const attributes of [undefined, null, ['other'], ['craft'], ['meal', 'meal']]) {
    assert.equal(validStoredActivityPlan({ ...emptyActivityPlan(), activities: [{ ...activity, attributes }] }), false)
    assert.throws(() => parseRamDraft(JSON.stringify({ ...parseRamDraft(undefined), activities: [{ ...activity, attributes }] })))
  }
  assert.throws(() => parseRamDraft(JSON.stringify({ activityName: activity.name, hazards: [] })))
  assert.deepEqual(parseRamDraft(undefined).activities, [])
})
