import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { Group, MeshPhysicalMaterial, MeshStandardMaterial, Texture } from 'three'
import { VIRTUAL_CHURCH_GPU_MEMORY_BUDGET_BYTES, virtualChurchDrawCategory, virtualChurchUsesMobileBudget } from '../src/views/virtualChurchPerformanceContract.ts'
import { virtualChurchMaterialForBudget } from '../src/views/virtualChurchMaterialBudget.ts'

test('draw attribution uses the nearest fixed owner, never leaks arbitrary asset names', () => {
  const root = new Group(); root.name = 'vc:church'
  const owner = new Group(); owner.name = 'vc:character'; root.add(owner)
  const asset = new Group(); asset.name = 'C:/private/source/input'; owner.add(asset)
  assert.equal(virtualChurchDrawCategory(asset), 'character')
  owner.name = 'vc:unrecognized'
  assert.equal(virtualChurchDrawCategory(asset), 'church')
  root.name = 'unlabelled'
  assert.equal(virtualChurchDrawCategory(asset), 'other')
  assert.equal(virtualChurchDrawCategory(null), 'other')
  for (const category of ['church', 'character', 'trees', 'plants', 'vehicles', 'ground-details', 'surroundings', 'culvert', 'swale', 'surfaces', 'lights', 'fences']) {
    owner.name = `vc:${category}`
    assert.equal(virtualChurchDrawCategory(asset), category)
  }
})

test('profile attribution uses existing visibility gates and exactly the same draw and triangle counts', () => {
  const probe = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  const gate = probe.indexOf('if (!effectivelyVisible || instanceCount === 0 || (mesh.frustumCulled && !frustum.intersectsObject(mesh))) return')
  const attribution = probe.indexOf('const category = virtualChurchDrawCategory(mesh)')
  assert.ok(gate > 0 && attribution > gate)
  assert.match(probe, /visibleDrawCalls \+= meshDrawCalls/)
  assert.match(probe, /bucket\.drawCalls \+= meshDrawCalls/)
  assert.match(probe, /visibleTriangles \+= trianglesPerInstance \* instanceCount/)
  assert.match(probe, /bucket\.triangles \+= trianglesPerInstance \* instanceCount/)
  assert.match(probe, /categories: \[\.\.\.drawCategories\.values\(\)\]/)
  const surfaces = probe.indexOf("if (category === 'surfaces')")
  assert.ok(surfaces > attribution && surfaces > gate)
  const surfaceDiagnostic = probe.slice(surfaces, probe.indexOf("if (category === 'other')", surfaces))
  assert.match(surfaceDiagnostic, /visibleSurfaceBatches\.push\(\{/)
  assert.doesNotMatch(surfaceDiagnostic, /\.name\b|\.src\b|\.url\b/,
    'diagnostic must not expose imported asset names or texture URLs')
  const drawStateDiagnostic = probe.slice(
    probe.indexOf('if (inspectDrawStates &&'),
    probe.indexOf('const primaryMaterial =', probe.indexOf('if (inspectDrawStates &&')),
  )
  assert.match(probe, /has\('profile3dDrawStates'\)/)
  assert.match(drawStateDiagnostic, /mesh\.material\.uuid/)
  assert.match(drawStateDiagnostic, /mesh\.castShadow/)
  assert.match(drawStateDiagnostic, /mesh\.receiveShadow/)
  assert.match(drawStateDiagnostic, /mesh\.geometry\.attributes/)
  assert.match(drawStateDiagnostic, /!\('isInstancedMesh' in mesh\)/)
  assert.match(drawStateDiagnostic, /!\('isSkinnedMesh' in mesh\)/)
  assert.doesNotMatch(drawStateDiagnostic, /\.name\b|\.src\b|\.url\b/)
  assert.match(probe, /\.filter\(candidate => candidate\.meshes > 1\)/)
})

test('immersive church fills the viewport without removing the ordinary workspace gutter', () => {
  const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8')
  const workspace = /html:has\(\.alife-workspace\)\s*\{\s*scrollbar-gutter:\s*stable;\s*\}/.exec(css)
  const church = /html:has\(\.virtual-church-ui\)\s*\{\s*scrollbar-gutter:\s*auto;\s*\}/.exec(css)
  assert.ok(workspace && church, 'Both page-specific rules must remain present')
  assert.ok(church.index > workspace.index, 'The immersive override must win at equal specificity')
})

test('readiness audit cannot promote historical narrative into current performance evidence', () => {
  const source = readFileSync(new URL('../../../tools/virtual-church/audit-gate-a-readiness.mjs', import.meta.url), 'utf8')
  const start = source.indexOf('const manualHardGates = ')
  const end = source.indexOf('\nconst report = ', start)
  assert.ok(start >= 0 && end > start)
  const body = source.slice(start, end)
  // Evaluate the real report gates with both absent and all-positive narrative
  // matches. Even a plan containing every old success phrase proves nothing
  // about the current build; the current static budget alone is insufficient.
  const names = [...new Set(body.match(/\b\w+(?:Recorded|Captured|Pending|Passed)\b/g) ?? [])]
  for (const historicalClaimsPresent of [false, true]) {
    const context = Object.fromEntries(names.map(name => [name, historicalClaimsPresent]))
    context.staticPayloadPassed = true
    const gates = runInNewContext(`${body}\nmanualHardGates`, context)
    assert.equal(gates.currentStatePerformance.staticPayloadBudgetPassed, true)
    assert.equal(gates.currentStatePerformance.passed, false)
    assert.equal(gates.currentStatePerformance.currentStateEvidenceVerified, false)
    assert.ok(gates.currentStatePerformance.missingEvidence.length >= 2)
    for (const name of ['visualReview', 'currentStateBrowserFunction', 'currentStatePerformance']) {
      assert.equal('completedEvidence' in gates[name], false)
      assert.ok(Array.isArray(gates[name].historicalPlanClaims))
    }
  }
})

test('phone GPU budget stays mobile in portrait and landscape', () => {
  for (const ua of ['iPhone', 'Android']) {
    for (const [width, height] of [[390, 844], [320, 568], [430, 932]]) {
      assert.equal(virtualChurchUsesMobileBudget(ua, width, height), true)
      assert.equal(virtualChurchUsesMobileBudget(ua, height, width), true)
    }
  }
})

test('in-page GPU estimate uses the same limits as the formal profile validator', () => {
  const budgets = JSON.parse(readFileSync(new URL('../../../tools/virtual-church/performance-budgets.json', import.meta.url), 'utf8'))
  assert.equal(VIRTUAL_CHURCH_GPU_MEMORY_BUDGET_BYTES.mobile, budgets.mobile.gpuMemoryEstimateBytesMax)
  assert.equal(VIRTUAL_CHURCH_GPU_MEMORY_BUDGET_BYTES.desktop, budgets.desktop.gpuMemoryEstimateBytesMax)
  const probe = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  assert.match(probe, /gpuMemoryBudgetBytes = VIRTUAL_CHURCH_GPU_MEMORY_BUDGET_BYTES\[preset\.isMobile \? 'mobile' : 'desktop'\]/)
})

test('church baseline follows the lazy post-processing module and rejects broken wiring or theme values', () => {
  const validator = readFileSync(new URL('../../../tools/virtual-church/validate-gate-a-church-baseline.mjs', import.meta.url), 'utf8')
  const functionSource = validator.match(/function validatePostProcessingConsumers\([\s\S]+?\n\}/)?.[0]
  assert.ok(functionSource)
  const validate = runInNewContext(`(${functionSource})`)
  const view = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const effects = readFileSync(new URL('../src/views/VirtualChurchPostProcessing.tsx', import.meta.url), 'utf8')
  assert.equal(validate(view, effects).length, 0)
  for (const consumer of [
    "const DeferredPostProcessing = lazy(() => import('./VirtualChurchPostProcessing'))",
    '{postProcessingReady ? (',
    '<DeferredPostProcessing />',
  ]) {
    assert.ok(validate(view.replace(consumer, ''), effects).length > 0, consumer)
  }
  for (const consumer of [
    'intensity={ALIFE_N8AO.intensity}',
    'intensity={ALIFE_BLOOM.intensity}',
    "import { ALIFE_BLOOM, ALIFE_N8AO } from './alifeVisualTheme'",
  ]) {
    assert.ok(validate(view, effects.replace(consumer, '')).length > 0, consumer)
  }
})

test('rotation preserves the existing tablet threshold and desktop UA policy', () => {
  for (const [width, height] of [[768, 1024], [1024, 768]]) {
    assert.equal(virtualChurchUsesMobileBudget('iPad', width, height), false)
  }
  for (const [width, height] of [[390, 844], [844, 390], [1280, 720]]) {
    assert.equal(virtualChurchUsesMobileBudget('Windows NT', width, height), false)
  }
})

test('imported glass respects the low budget without changing the cached desktop material', () => {
  const texture = new Texture()
  const source = new MeshPhysicalMaterial({
    transmission: 0.18, color: '#668a92', roughness: 0.16, metalness: 0.12, map: texture,
  })
  const reduced = virtualChurchMaterialForBudget(source, false) as MeshPhysicalMaterial
  assert.notEqual(reduced, source)
  assert.equal(reduced.transmission, 0)
  assert.equal(reduced.transparent, true)
  assert.equal(reduced.opacity, 0.48)
  assert.equal(reduced.depthWrite, false)
  assert.equal(source.transmission, 0.18)
  assert.equal(source.transparent, false)
  assert.equal(source.opacity, 1)
  assert.equal(source.depthWrite, true)
  assert.equal(virtualChurchMaterialForBudget(source, true), source)
  assert.equal(reduced.color.getHex(), source.color.getHex())
  for (const key of ['roughness', 'metalness', 'side', 'envMapIntensity', 'map'] as const) {
    assert.equal(reduced[key], source[key], key)
  }
  let textureDisposed = false
  texture.addEventListener('dispose', () => { textureDisposed = true })
  reduced.dispose()
  assert.equal(textureDisposed, false)
  source.dispose()
  texture.dispose()
})

test('opaque and already budgeted materials are reused without allocations', () => {
  for (const source of [new MeshStandardMaterial(), new MeshPhysicalMaterial({ transmission: 0 })]) {
    assert.equal(virtualChurchMaterialForBudget(source, false), source)
    assert.equal(virtualChurchMaterialForBudget(source, true), source)
    source.dispose()
  }
})
