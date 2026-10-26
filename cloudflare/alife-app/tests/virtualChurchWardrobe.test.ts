import assert from 'node:assert/strict'
import test from 'node:test'
import { Color } from 'three'
import { gateAApplyOutfitMaterialTint, gateAOutfitMaterialTint } from '../src/views/virtualChurchCharacterWardrobe.ts'

test('classic review preset preserves the authored linear emerald factor', () => {
  const authored = new Color(0.0284260288, 0.1470272541, 0.1144353598)
  const target = new Color()
  gateAApplyOutfitMaterialTint(target, new Color(gateAOutfitMaterialTint('classic')), authored)
  assert.deepEqual(target.toArray(), authored.toArray())
})

test('repeated wardrobe changes do not compound tints or mutate source colour', () => {
  const authored = new Color(0.0284260288, 0.1470272541, 0.1144353598)
  const original = authored.toArray()
  const target = authored.clone()
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const outfit of ['service', 'community', 'classic'] as const) {
      const tint = new Color(gateAOutfitMaterialTint(outfit))
      gateAApplyOutfitMaterialTint(target, tint, authored)
      assert.deepEqual(target.toArray(), authored.clone().multiply(tint).toArray())
      assert.deepEqual(authored.toArray(), original)
    }
  }
  assert.deepEqual(target.toArray(), original)
})

test('without a review source factor, released r8 tint behaviour is unchanged', () => {
  const target = new Color('#123456')
  for (const outfit of ['classic', 'service', 'community'] as const) {
    const tint = new Color(gateAOutfitMaterialTint(outfit))
    gateAApplyOutfitMaterialTint(target, tint)
    assert.deepEqual(target.toArray(), tint.toArray())
  }
})
