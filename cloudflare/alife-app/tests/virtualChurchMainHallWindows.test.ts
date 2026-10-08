import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, ShaderLib, Vector3 } from 'three'
import { MAIN_HALL_DIMENSIONS, MAIN_HALL_SIDE_WINDOW_BAYS } from '../src/views/virtualChurchMainHallLayout.ts'
import { createMainHallWindowGeometry, MAIN_HALL_WINDOW_DETAIL, MAIN_HALL_DAYLIGHT_KEY_POSITION, mainHallDaylightMaterialProps } from '../src/views/virtualChurchMainHallWindows.ts'
import { createVirtualChurchStrictModeCleanupGuard } from '../src/views/virtualChurchResourceLeaseContract.ts'

test('two opposing historical window apertures are genuinely open, with wall/sill enclosure retained', () => {
  const geometry = createMainHallWindowGeometry(), material = new MeshBasicMaterial({ side: DoubleSide })
  try {
    const wall = new Mesh(geometry.wall, material)
    for (const bay of MAIN_HALL_SIDE_WINDOW_BAYS) {
      const direction = new Vector3(bay.side, 0, 0)
      const hit = (y: number, z: number) => new Raycaster(new Vector3(0, y, z), direction).intersectObject(wall).length > 0
      for (const dy of [.12, (bay.topY - bay.bottomY) / 2, bay.topY - bay.bottomY - .12]) {
        for (const dz of [-bay.length / 2 + .12, 0, bay.length / 2 - .12]) assert.equal(hit(bay.bottomY + dy, bay.centerZ + dz), false)
      }
      for (const y of [.3, bay.bottomY - .1, bay.topY + .1, MAIN_HALL_DIMENSIONS.height - .1]) assert.equal(hit(y, bay.centerZ), true)
      for (const z of [bay.centerZ - bay.length / 2 - .1, bay.centerZ + bay.length / 2 + .1]) assert.equal(hit((bay.bottomY + bay.topY) / 2, z), true)
      // A front-facing ray must meet the actual pane and then a recessed vista;
      // not a solid backing wall with emissive rectangles pasted on top.
      const glass = new Mesh(geometry.glazing, new MeshBasicMaterial()), vista = new Mesh(geometry.vista, new MeshBasicMaterial())
      const ray = new Raycaster(new Vector3(0, (bay.bottomY + bay.topY) / 2, bay.centerZ), direction)
      assert.ok(ray.intersectObject(glass).length > 0)
      assert.ok(ray.intersectObject(vista)[0].distance > ray.intersectObject(glass)[0].distance + 3)
      glass.material.dispose(); vista.material.dispose()
    }
    const rounded = (v: number) => Math.abs(v) < .0005 ? 0 : Number(v.toFixed(3))
    assert.deepEqual(geometry.wall.boundingBox!.min.toArray().map(rounded), [-11.68, 0, -11])
    assert.deepEqual(geometry.wall.boundingBox!.max.toArray().map(rounded), [11.68, 6.55, 11])
    const floor = new Vector3(0,.02,0), key = new Vector3(...MAIN_HALL_DAYLIGHT_KEY_POSITION)
    const keyRay = new Raycaster(floor, key.clone().sub(floor).normalize())
    assert.equal(keyRay.intersectObject(wall).length, 0, 'centre-floor key direction crosses the aperture, not the solid side wall')
    assert.ok(keyRay.intersectObject(new Mesh(geometry.glazing, material)).length > 0)
    assert.ok(Object.isFrozen(MAIN_HALL_DAYLIGHT_KEY_POSITION))
  } finally { Object.values(geometry).forEach(part => part.dispose()); material.dispose() }
})

test('three independent material buffers preserve colour, finite bounds and a small fixed geometry budget', () => {
  const first = createMainHallWindowGeometry(), second = createMainHallWindowGeometry()
  try {
    assert.equal(Object.keys(first).length, 3)
    let triangles = 0, bytes = 0
    for (const [name, part] of Object.entries(first)) {
      assert.notEqual(part, second[name as keyof typeof second])
      assert.equal(part.groups.length, 0)
      assert.ok(Number.isFinite(part.boundingSphere!.radius))
      for (const attribute of Object.values(part.attributes)) {
        bytes += attribute.array.byteLength
        for (const value of attribute.array) assert.ok(Number.isFinite(value))
      }
      triangles += part.index!.count / 3
      bytes += part.index!.array.byteLength
    }
    assert.equal(triangles, 128)
    assert.equal(bytes, 11840)
    assert.equal(first.wall.getAttribute('color').count, first.wall.getAttribute('position').count)
    assert.ok(Object.isFrozen(MAIN_HALL_WINDOW_DETAIL))
  } finally { Object.values(first).forEach(part => part.dispose()); Object.values(second).forEach(part => part.dispose()) }
})

test('illustrative daylight is a static continuous gradient, not a photograph or claimed exterior', () => {
  const shader = { ...ShaderLib.basic, uniforms: { ...ShaderLib.basic.uniforms } }
  mainHallDaylightMaterialProps.onBeforeCompile.call(new MeshBasicMaterial(), shader, null!)
  assert.equal(Object.keys(shader.uniforms).length, Object.keys(ShaderLib.basic.uniforms).length)
  assert.match(shader.vertexShader, /modelMatrix \* vec4\(transformed, 1.0\)/)
  assert.match(shader.fragmentShader, /smoothstep\(1.0, 9.0, vHallDaylightHeight\)/)
  assert.match(shader.fragmentShader, /#include <tonemapping_fragment>/)
  assert.doesNotMatch(shader.vertexShader + shader.fragmentShader, /NaN|undefined|Infinity/)
  assert.equal(mainHallDaylightMaterialProps.customProgramCacheKey(), 'main-hall-illustrative-daylight-v1')
  const source = readFileSync(new URL('../src/views/virtualChurchMainHallWindows.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /TextureLoader|fetch\(|useFrame|setTimeout|requestAnimationFrame|uniform float/)
})

test('committed window buffers survive effect replay, retire on exit, and cannot rebuild on language/view changes', async () => {
  const geometry = createMainHallWindowGeometry(), guard = createVirtualChurchStrictModeCleanupGuard()
  let disposed = 0
  for (const part of Object.values(geometry)) part.addEventListener('dispose', () => { disposed++ })
  const release = () => Object.values(geometry).forEach(part => part.dispose())
  guard.activate(); guard.release(release); guard.activate(); await Promise.resolve()
  assert.equal(disposed, 0)
  guard.release(release); await Promise.resolve()
  assert.equal(disposed, 3)
  const view = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(view, /useMemo\(\(\) => createMainHallWindowGeometry\(\), \[\]\)/)
  assert.match(view, /cleanup.release\(\(\) => Object.values\(windows\).forEach\(part => part.dispose\(\)\)\)/)
  for (const part of ['wall','glazing','vista']) assert.match(view, new RegExp(`windows\\.${part}\\} attach="geometry" dispose=\\{null\\}`))
  assert.match(view, /vertexColors roughness=\{1\} onBeforeCompile=\{mainHallWallContactShader\}/)
  assert.match(view, /opacity=\{.1\} depthWrite=\{false\}/)
  assert.doesNotMatch(view, /boxGeometry args=\{\[.16, height, depth\]\}/)
  assert.match(view, /窗外为示意天光/)
  assert.match(view, /Illustrative window daylight/)
  assert.equal((view.match(/<directionalLight/g) ?? []).length, 1)
  assert.match(view, /frameloop="demand"/)
})
