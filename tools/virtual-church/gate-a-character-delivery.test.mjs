import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { auditProductionHeroDelivery, auditProductionHeroSource } from './gate-a-character-delivery.mjs'
import animationContract from '../../cloudflare/alife-app/src/views/virtualChurchCharacterAnimationContract.json' with { type: 'json' }

function glb(name, bone = 'hip', clips = Object.keys(animationContract.durationsSeconds)) {
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator: name },
    nodes: [{ name: bone }], skins: [{ joints: [0], inverseBindMatrices: 0 }],
    accessors: [{ bufferView: 0, componentType: 5126, type: 'MAT4', count: 1 }],
    bufferViews: [{ byteOffset: 0, byteLength: 64 }], animations: clips.map(name => ({ name })) }))
  const length = Math.ceil(json.length / 4) * 4
  const bytes = Buffer.alloc(28 + length + 64)
  bytes.write('glTF'); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8)
  bytes.writeUInt32LE(length, 12); bytes.writeUInt32LE(0x4e4f534a, 16)
  bytes.fill(32, 20, 20 + length); json.copy(bytes, 20)
  bytes.writeUInt32LE(64, 20 + length); bytes.writeUInt32LE(0x004e4942, 24 + length)
  return bytes
}
const portrait = Buffer.from('RIFF0000WEBPfixture')
const mappings = () => Object.fromEntries(['Female', 'Male'].flatMap(gender =>
  ['High', 'Medium', 'Low', 'Picker'].map(quality => [`gateA${gender}${quality}`,
    `/virtual-church-assets/v3/releases/test/characters/${gender}-${quality}.${quality === 'Picker' ? 'webp' : 'glb'}`])))
const load = async url => url.endsWith('.webp') ? portrait : glb(url.includes('Female') ? 'female' : 'male')

test('current production inventory has two formal heroes but cannot claim a shared rig or complete V3', async () => {
  const source = await readFile(new URL('../../cloudflare/alife-app/src/services/virtualChurchService.ts', import.meta.url), 'utf8')
  const report = await auditProductionHeroSource(source,
    fileURLToPath(new URL('../../cloudflare/alife-app/public/', import.meta.url)))
  assert.equal(report.completeReleasedHeroes, 2)
  assert.equal(report.heroes[0].assets.medium.bones, 187)
  assert.equal(report.heroes[0].assets.medium.clips.length, 14)
  assert.equal(report.heroes[1].errors.length, 0)
  assert.equal(report.heroes[1].assets.medium.bones, 126)
  assert.ok(report.heroes[1].assets.low.url.includes('/male-hero-v14-r1/'))
  assert.equal(report.sharedRig, false)
  assert.equal(report.assetScopePassed, false)
  assert.equal(report.fullV3CharacterPassed, false)
})

test('two complete distinct model inventories still do not certify UI, motion or publication', async () => {
  const report = await auditProductionHeroDelivery(mappings(), load)
  assert.equal(report.completeReleasedHeroes, 2)
  assert.equal(report.assetScopePassed, true)
  assert.equal(report.sharedRig, true)
  assert.equal(report.fullV3CharacterPassed, false)
  assert.ok(report.remainingVerification.includes('production-selector-and-bilingual-cards'))
})

test('duplicate appearance URLs and equal bone counts with different rig identities fail', async () => {
  const same = await auditProductionHeroDelivery(mappings(), async url => url.endsWith('.webp') ? portrait : glb('same'))
  assert.ok(same.missing.some(error => error.includes('same model')))
  const different = await auditProductionHeroDelivery(mappings(), async url => url.endsWith('.webp')
    ? portrait : glb(url, url.includes('Female') ? 'hip' : 'pelvis'))
  assert.equal(different.completeReleasedHeroes, 2)
  assert.equal(different.sharedRig, false)
  assert.equal(different.assetScopePassed, false)
})

test('review URLs, missing files, corrupt portraits and divergent LOD rigs stay incomplete', async () => {
  const registry = mappings()
  registry.gateAMaleHigh = '/__alife-review/virtual-church/character-hero-male-v14-high.glb'
  const report = await auditProductionHeroDelivery(registry, async url => {
    if (url.includes('Male-Medium')) throw new Error('Missing file')
    if (url.includes('Male-Picker')) return Buffer.from('bad')
    return load(url)
  })
  assert.equal(report.completeReleasedHeroes, 1)
  assert.equal(report.heroes[1].errors.length, 3)
  const divergent = await auditProductionHeroDelivery(mappings(), async url => url.endsWith('.webp')
    ? portrait : glb(url, url.includes('Male-Low') ? 'other' : 'hip'))
  assert.equal(divergent.heroes[1].complete, false)
  assert.ok(divergent.heroes[1].errors.some(error => error.includes('LOD rigs differ')))
})

test('matching LOD clip lists cannot hide missing required actions', async () => {
  const report = await auditProductionHeroDelivery(mappings(), async url => url.endsWith('.webp')
    ? portrait : glb(url, 'hip', ['Walk']))
  assert.equal(report.completeReleasedHeroes, 0)
  assert.equal(report.assetScopePassed, false)
  assert.ok(report.heroes.every(hero => hero.errors.some(error => error.includes('Greet'))))
})
