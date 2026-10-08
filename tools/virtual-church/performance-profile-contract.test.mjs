import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { decodeVirtualChurchProfileCapture } from './performance-profile-capture.mjs'
import { productionHeroMappings } from './gate-a-character-delivery.mjs'
import { virtualChurchResourceTimingChecks, virtualChurchProfileSetChecks, virtualChurchProfileSamplingIsValid } from './performance-profile-contract.mjs'

test('instrumented CPU/GPU/startup diagnostics cannot serve as formal performance evidence', () => {
  const value = { sampling: { documentVisibilityState: 'visible', uninterruptedForeground: true, interruptionCount: 0, maximumCallbackGapMs: 15 } }
  assert.equal(virtualChurchProfileSamplingIsValid(value), true)
  for (const key of ['cpuSubmissionDiagnostics', 'gpuTimingDiagnostics']) for (const diagnostic of [null, {}, { frames: [] }]) {
    assert.equal(virtualChurchProfileSamplingIsValid({ ...value, [key]: diagnostic }), false)
  }
  for (const diagnostic of [null, [], [{ textureCpu: { uploadMs: 0, uploads: 0 } }]]) {
    assert.equal(virtualChurchProfileSamplingIsValid({ ...value, loading: { startupPassTimings: diagnostic } }), false)
  }
  assert.equal(virtualChurchProfileSamplingIsValid({ ...value, loading: {} }), true)
})

const characters = productionHeroMappings(readFileSync(new URL('../../cloudflare/alife-app/src/services/virtualChurchService.ts', import.meta.url), 'utf8'))
function profile(hero, mobile) {
  const character = characters[`${hero === 'male' ? 'gateAMale' : 'gateAFemale'}${mobile ? 'Low' : 'Medium'}`]
  const timeline = [
    ['/assets/VirtualChurchView-test.js', 0, 4, 10],
    ['/assets/vendor-3d-test.js', .2, 5, 12],
    [`/virtual-church-assets/v3/releases/gate-a-baseline-r9/buildings/church-hero${mobile ? '-low' : ''}.glb`, 13, 15, 100],
    [character, 13.2, 16, 90],
  ].map(([path, startMs, responseStartMs, responseEndMs], index) => ({
    sequence: index + 1, path, startMs, responseStartMs, responseEndMs,
    transferSizeBytes: 1024, encodedBodySizeBytes: 724, serviceWorkerIntercepted: false, initial: true,
  }))
  return { visualVersion: 'v3', characterAssetPath: character, preset: { isMobile: mobile },
    loading: { diagnosticTransport: 'network', criticalResourceCount: timeline.length, criticalResourceTimeline: timeline } }
}
const selected = value => virtualChurchResourceTimingChecks(value).find(check => check.name === 'Selected character asset only')

test('strict network validation enforces the separate selected Hero body budget', () => {
  for (const hero of ['female', 'male']) {
    const value = profile(hero, false)
    const body = data => virtualChurchResourceTimingChecks(data, { characterEncodedBodySizeBytesMax: 1000 })
      .find(check => check.name === 'Selected character body budget')
    assert.equal(body(value)?.passed, true)
    for (const bytes of [0, -1, undefined, Number.NaN, 1001]) {
      const invalid = structuredClone(value); invalid.loading.criticalResourceTimeline[3].encodedBodySizeBytes = bytes
      assert.equal(body(invalid)?.passed, false)
    }
  }
})

for (const hero of ['female', 'male']) for (const mobile of [false, true]) {
  test(`Resource Timing accepts the actual released ${hero} ${mobile ? 'Low' : 'Medium'} mapping`, () => {
    assert.ok(virtualChurchResourceTimingChecks(profile(hero, mobile)).every(check => check.passed))
  })
}

test('male mapping still rejects wrong LOD, unknown/private paths, identity mismatch and both Heroes in the critical session', () => {
  const changes = [
    value => { value.loading.criticalResourceTimeline[3].path = characters.gateAMaleHigh },
    value => { value.loading.criticalResourceTimeline[3].path = characters.gateAMaleLow },
    value => { value.characterAssetPath = characters.gateAMaleHigh },
    value => { value.characterAssetPath = 'http://[' },
    value => { value.characterAssetPath = value.loading.criticalResourceTimeline[3].path = '/__alife-review/virtual-church/character-hero-male-v14-wave-medium.glb' },
    value => { value.characterAssetPath = value.loading.criticalResourceTimeline[3].path = characters.gateAMaleMedium.replace('male-hero-v14-r1', 'unknown-release') },
    value => { value.characterAssetPath = characters.gateAFemaleMedium },
    value => { value.loading.criticalResourceTimeline.push({ ...value.loading.criticalResourceTimeline[3],
      sequence: 5, path: characters.gateAFemaleMedium, startMs: 14, responseStartMs: 17, responseEndMs: 95 }); value.loading.criticalResourceCount++ },
  ]
  for (const mutate of changes) {
    const value = profile('male', false); mutate(value)
    assert.equal(selected(value).passed, false)
  }
})

test('legacy female fixture remains valid, and full URLs are normalized without trusting another Hero identity', () => {
  const legacy = profile('female', false); delete legacy.characterAssetPath
  assert.ok(virtualChurchResourceTimingChecks(legacy).every(check => check.passed))
  const male = profile('male', false); male.characterAssetPath = `https://assets.example${male.characterAssetPath}`
  assert.ok(virtualChurchResourceTimingChecks(male).every(check => check.passed))
})

test('V2 keeps its delayed legacy-avatar contract even without a V3 Hero identity', () => {
  const value = profile('female', false)
  value.visualVersion = 'v2'; value.characterAssetPath = null
  value.loading.criticalResourceTimeline[2].path = '/virtual-church-assets/buildings/church-hero.glb'
  value.loading.criticalResourceTimeline[3].path = '/virtual-church-assets/characters/believer-woman.gltf'
  value.loading.criticalResourceTimeline[3].initial = false
  assert.ok(virtualChurchResourceTimingChecks(value).every(check => check.passed))
})

test('a V3 three-run set cannot mix Heroes, LODs or invalid character identities', () => {
  const identities = values => virtualChurchProfileSetChecks(values, 'v3')
    .filter(check => check.name.endsWith('same character identity'))
  const runs = [profile('male', false), profile('male', false), profile('male', false)]
  runs[1].characterAssetPath = `https://assets.example${runs[1].characterAssetPath}`
  assert.equal(identities(runs).length, 3)
  assert.ok(identities(runs).every(check => check.passed))
  for (const identity of [characters.gateAFemaleMedium, characters.gateAMaleLow, null, 'http://[']) {
    const mixed = structuredClone(runs); mixed[2].characterAssetPath = identity
    assert.equal(identities(mixed)[2].passed, false)
  }
  const historical = runs.map(() => { const value = profile('female', false); delete value.characterAssetPath; return value })
  assert.ok(identities(historical).every(check => check.passed))
  assert.equal(virtualChurchProfileSetChecks(historical.map(value => ({ ...value, visualVersion: 'v2' })), 'v2')
    .filter(check => check.name.endsWith('same character identity')).length, 0)
})

test('compressed capture retains all three complete reports without changing ordinary JSON input', () => {
  const runs = [profile('male', false), profile('male', false), profile('male', false)]
  const capture = { captureFormat: 'virtual-church-profile-set-gzip-v1', runCount: 3,
    profilesGzipBase64: gzipSync(JSON.stringify(runs)).toString('base64') }
  assert.deepEqual(decodeVirtualChurchProfileCapture(capture), runs)
  assert.deepEqual(decodeVirtualChurchProfileCapture(runs[0]), [runs[0]])
  assert.throws(() => decodeVirtualChurchProfileCapture({ ...capture, runCount: 2 }))
  assert.throws(() => decodeVirtualChurchProfileCapture({ ...capture, profilesGzipBase64: 'not base64' }))
  assert.throws(() => decodeVirtualChurchProfileCapture({ ...capture, profilesGzipBase64: 'AAAA' }))
  assert.throws(() => decodeVirtualChurchProfileCapture({ ...capture, profilesGzipBase64: 'A'.repeat(1024 * 1024 + 4) }))
  for (const records of [[], [null], [[]], [{}]]) {
    assert.throws(() => decodeVirtualChurchProfileCapture({ ...capture, profilesGzipBase64: gzipSync(JSON.stringify(records)).toString('base64') }))
  }
})
