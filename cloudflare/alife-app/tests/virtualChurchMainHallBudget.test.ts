import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera } from 'three'
import { createMainHallInitialSubmissionRecorder, measureMainHallSceneBudget } from '../src/views/virtualChurchMainHallBudget.ts'

test('initial submission record retains the first draw and long gaps without extending its four-frame bound', () => {
  const record = createMainHallInitialSubmissionRecorder()
  record.complete(10)
  record.begin(NaN, false, true)
  record.complete(11)
  assert.equal(record.snapshot().frames.length, 0)
  record.begin(100, false, true)
  record.complete(850)
  record.begin(900, true, false)
  record.complete(912)
  record.begin(920, true, false)
  record.complete(919)
  record.complete(NaN)
  assert.equal(record.snapshot().frames.length, 2)
  record.complete(930)
  record.begin(940, true, false)
  record.complete(950)
  record.begin(960, true, false)
  record.complete(970)
  const sample = record.snapshot()
  assert.deepEqual(sample.frames.map(frame => frame.durationMs), [750, 12, 10, 10])
  assert.deepEqual(sample.frames.map(frame => frame.callbackGapMs), [null, 800, 20, 20])
  assert.equal(sample.frames[0].environmentPresent, false)
  assert.equal(sample.frames[1].environmentPresent, true)
  sample.frames[0].durationMs = 0
  assert.equal(record.snapshot().frames[0].durationMs, 750, 'snapshot must not mutate retained failure evidence')
})

test('initial submission capture stays in the existing opt-in budget probe and preserves cancellation rules', () => {
  const view = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  const probe = view.split('function HallBudgetProbe(')[1].split('class HallCanvasBoundary')[0]
  assert.match(view, /\{budgetDiagnostic \? <HallBudgetProbe/)
  assert.match(probe, /initialSubmissions.current.begin\(performance.now\(\), Boolean\(scene.environment\), gl.shadowMap.needsUpdate\)/)
  assert.match(probe, /if \(args\[0\] !== gl \|\| gl.getRenderTarget\(\) !== null\) return/)
  assert.match(probe, /initialSubmissions.current.complete\(performance.now\(\)\)/)
  assert.match(probe, /scene.onAfterRender === hook/)
  assert.doesNotMatch(probe, /requestAnimationFrame\(|setTimeout\(|setInterval\(|invalidate\(/)
  const walk = readFileSync(new URL('../src/views/virtualChurchMainHallWalk.ts', import.meta.url), 'utf8')
  assert.match(walk, /now - previous > 250\) cancel\('frame-gap'\)/)
})

const camera = () => {
  const result = new PerspectiveCamera(60, 1, .1, 30)
  result.position.set(0, 0, 5)
  result.lookAt(0, 0, 0)
  return result
}

test('room estimate counts whole instance batches and respects inherited visibility and frustum culling', () => {
  const scene = new Group()
  const geometry = new BoxGeometry()
  const material = new MeshBasicMaterial()
  const chairs = new InstancedMesh(geometry, material, 3)
  const transform = new Object3D()
  for (let i = 0; i < 3; i++) {
    transform.position.set(i === 2 ? 100 : 0, 0, 0)
    transform.updateMatrix()
    chairs.setMatrixAt(i, transform.matrix)
  }
  chairs.computeBoundingSphere()
  scene.add(chairs)
  const distant = new Mesh(geometry, material)
  distant.position.x = 100
  scene.add(distant)
  const hidden = new Group()
  hidden.visible = false
  hidden.add(new Mesh(geometry, material))
  scene.add(hidden)
  assert.deepEqual(measureMainHallSceneBudget(scene, camera()), {sceneTriangleCeiling:48, visibleTriangles:36, visibleDrawCalls:1})
  distant.frustumCulled = false
  assert.deepEqual(measureMainHallSceneBudget(scene, camera()), {sceneTriangleCeiling:48, visibleTriangles:48, visibleDrawCalls:2})
  chairs.count = 0
  assert.deepEqual(measureMainHallSceneBudget(scene, camera()), {sceneTriangleCeiling:12, visibleTriangles:12, visibleDrawCalls:1})
  geometry.dispose()
  material.dispose()
})

test('material groups, hidden materials and partial draw ranges count only submitted triangles', () => {
  const geometry = new BoxGeometry()
  const visible = new MeshBasicMaterial()
  const hidden = new MeshBasicMaterial()
  hidden.visible = false
  const scene = new Group()
  const mesh = new Mesh(geometry, [visible, hidden, visible, hidden, visible, hidden])
  scene.add(mesh)
  assert.deepEqual(measureMainHallSceneBudget(scene, camera()), {sceneTriangleCeiling:6, visibleTriangles:6, visibleDrawCalls:3})
  geometry.setDrawRange(3, 9)
  assert.deepEqual(measureMainHallSceneBudget(scene, camera()), {sceneTriangleCeiling:1, visibleTriangles:1, visibleDrawCalls:1})
  mesh.material = visible
  assert.deepEqual(measureMainHallSceneBudget(scene, camera()), {sceneTriangleCeiling:3, visibleTriangles:3, visibleDrawCalls:1})
  geometry.dispose()
  visible.dispose()
  hidden.dispose()
})
