import { readLocalizedSource } from './helpers/readLocalizedSource.cjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, ShaderLib, Vector3 } from 'three'
import { createStudyWindowGeometry, STUDY_WINDOWS, studyGardenMaterialProps } from '../src/views/virtualChurchStudyWindows.ts'
import { createVirtualChurchStrictModeCleanupGuard } from '../src/views/virtualChurchResourceLeaseContract.ts'

test('three actual wall apertures preserve wall enclosure and the existing window anchors', () => {
  const geometry = createStudyWindowGeometry(), material = new MeshBasicMaterial({ side: DoubleSide })
  try {
    const wall = new Mesh(geometry.wall, material)
    const hit = (x: number, y: number) => new Raycaster(new Vector3(x, y, 0), new Vector3(0, 0, -1)).intersectObject(wall).length > 0
    assert.deepEqual(STUDY_WINDOWS.centers, [-2.65, 0, 2.65])
    assert.ok(Object.isFrozen(STUDY_WINDOWS) && Object.isFrozen(STUDY_WINDOWS.centers))
    for (const x of STUDY_WINDOWS.centers) {
      for (const dx of [-.7, 0, .7]) for (const y of [1.05, 2.08, 3.1]) assert.equal(hit(x + dx, y), false, 'glass cannot hide a solid backing wall')
      assert.equal(hit(x, .8), true)
      assert.equal(hit(x, 3.4), true)
    }
    for (const x of [-14, -1.3, 1.3, 14]) assert.equal(hit(x, 2.08), true)
    const rounded = (v: number) => Math.abs(v) < .0005 ? 0 : Number(v.toFixed(3))
    assert.deepEqual(geometry.wall.boundingBox!.min.toArray().map(rounded), [-15,0,-3.675])
    assert.deepEqual(geometry.wall.boundingBox!.max.toArray().map(rounded), [15,12,-3.525])
    assert.ok(geometry.vista.boundingBox!.max.z < geometry.wall.boundingBox!.min.z)
    assert.ok(geometry.glazing.boundingBox!.max.z < geometry.frames.boundingBox!.max.z)
    // Existing sun still uses one map; the new direction can actually illuminate
    // the central table through the centre opening rather than a painted pane.
    const start = new Vector3(0,.7,0), sun = new Vector3(-1.5,4.5,-8)
    assert.equal(new Raycaster(start, sun.clone().sub(start).normalize()).intersectObject(wall).length, 0)
  } finally { Object.values(geometry).forEach(part => part.dispose()); material.dispose() }
})

test('window architecture has five independent owned buffers with bounded triangle/storage cost', () => {
  const first = createStudyWindowGeometry(), second = createStudyWindowGeometry()
  try {
    assert.equal(Object.keys(first).length, 5)
    let triangles = 0, bytes = 0
    for (const [name, part] of Object.entries(first)) {
      assert.notEqual(part, second[name as keyof typeof second])
      assert.equal(part.groups.length, 0, 'merge by material, not one group/draw per window')
      assert.ok(part.boundingSphere && Number.isFinite(part.boundingSphere.radius))
      const positions = part.getAttribute('position')
      for (const value of positions.array) assert.ok(Number.isFinite(value))
      triangles += part.getIndex()!.count / 3
      bytes += part.getIndex()!.array.byteLength
      for (const attribute of Object.values(part.attributes)) bytes += attribute.array.byteLength
    }
    assert.equal(triangles, 332)
    assert.ok(bytes < 40000)
    const events = new Map(Object.values(first).map(part => [part, 0]))
    Object.values(first).forEach(part => part.addEventListener('dispose', () => events.set(part, events.get(part)! + 1)))
    Object.values(first).forEach(part => part.dispose())
    assert.ok([...events.values()].every(count => count === 1))
  } finally { Object.values(second).forEach(part => part.dispose()) }
})

test('continuous concept garden is static and texture-free, keeps standard basic tone mapping', () => {
  const shader = { ...ShaderLib.basic, uniforms: { ...ShaderLib.basic.uniforms } }
  studyGardenMaterialProps.onBeforeCompile.call(new MeshBasicMaterial(), shader, null!)
  assert.equal(Object.keys(shader.uniforms).length, Object.keys(ShaderLib.basic.uniforms).length)
  assert.match(shader.vertexShader, /modelMatrix \* vec4\(transformed, 1.0\)/)
  assert.match(shader.fragmentShader, /vStudyGardenPoint.xy/)
  assert.match(shader.fragmentShader, /#include <tonemapping_fragment>/)
  assert.doesNotMatch(shader.vertexShader + shader.fragmentShader, /NaN|undefined|Infinity/)
  assert.equal(studyGardenMaterialProps.customProgramCacheKey(), 'study-concept-garden-v1')
  const source = readFileSync(new URL('../src/views/virtualChurchStudyWindows.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /TextureLoader|fetch\(|useFrame|setTimeout|requestAnimationFrame|uniform float/)
})

test('window ownership survives StrictMode replay and frees all buffers on real unmount', async () => {
  const geometry = createStudyWindowGeometry(), guard = createVirtualChurchStrictModeCleanupGuard()
  let disposed = 0
  for (const part of Object.values(geometry)) part.addEventListener('dispose', () => { disposed++ })
  const release = () => Object.values(geometry).forEach(part => part.dispose())
  guard.activate(); guard.release(release); guard.activate()
  await Promise.resolve()
  assert.equal(disposed, 0)
  guard.release(release); await Promise.resolve()
  assert.equal(disposed, 5)
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchStudyRoomView.tsx', import.meta.url))
  assert.match(view, /windowCleanup.release\(\(\) => Object.values\(windows\).forEach\(part => part.dispose\(\)\)\)/)
  for (const part of ['wall','frames','sills','glazing','vista']) assert.match(view, new RegExp(`windows\\.${part}\\} attach="geometry" dispose=\\{null\\}`))
  assert.equal((view.match(/<directionalLight/g) ?? []).length, 1)
  assert.match(view, /shadow-mapSize=\{\[shadowMapSize, shadowMapSize\]\}/)
  assert.match(view, /shadowMapSize=\{Math.min\(1024, performancePreset.shadowMapSize\)\}/)
  assert.match(view, /opacity=\{.12\} depthWrite=\{false\}/)
  assert.match(view, /frameloop="demand"/)
  assert.match(view, /场景为概念设计/)
  assert.match(view, /Concept room/)
})
