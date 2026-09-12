import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRamAlphaDemoMatrix, ramAlphaDemoLevel, ramDefaultScales, type RamPolicyData } from '../src/types/ramGovernance.ts'

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
