import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { BoxGeometry, Color, CylinderGeometry, DoubleSide, FrontSide, Group, Matrix3, Mesh, MeshStandardMaterial, TorusGeometry, Vector3 } from 'three'
import { createVirtualChurchCulvertBatches, createVirtualChurchCulvertCrossingGeometry, type CulvertMouthPlacement } from '../src/views/virtualChurchCulvertGeometry.ts'

test('V3 road crossing is one colour-preserving batch with unchanged box positions, normals and UVs', async () => {
  const asphaltColor = '#505654', concreteColor = '#c2c4be'
  const merged = createVirtualChurchCulvertCrossingGeometry(asphaltColor, concreteColor)
  const actual = merged.toNonIndexed()
  const parts = [
    { geometry: new BoxGeometry(5.2, .11, 6.4).translate(0, -.06, 0), color: new Color(asphaltColor) },
    { geometry: new BoxGeometry(5.25, .035, 1.25).translate(0, -.005, 1.75), color: new Color(concreteColor) },
  ]
  let cursor = 0
  for (const { geometry, color } of parts) {
    const original = geometry.toNonIndexed()
    for (let index = 0; index < original.getAttribute('position').count; index++, cursor++) {
      for (const name of ['position', 'normal', 'uv'] as const) {
        const expected = original.getAttribute(name), found = actual.getAttribute(name)
        for (let axis = 0; axis < expected.itemSize; axis++) {
          assert.ok(Math.abs(expected.getComponent(index, axis) - found.getComponent(cursor, axis)) < 1e-6)
        }
      }
      const tint = actual.getAttribute('color')
      assert.ok(Math.abs(tint.getX(cursor) - color.r) < 1e-6)
      assert.ok(Math.abs(tint.getY(cursor) - color.g) < 1e-6)
      assert.ok(Math.abs(tint.getZ(cursor) - color.b) < 1e-6)
    }
    original.dispose(); geometry.dispose()
  }
  assert.equal(cursor, actual.getAttribute('position').count)
  assert.equal(merged.groups.length, 0, 'one material means one draw call')
  assert.ok(merged.boundingBox && merged.boundingSphere)
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /visualVersion === 'v3' \? <BatchedCulvertCrossing \/> : <>/)
  assert.match(source, /<mesh name="vc:culvert-crossing-batch" geometry=\{geometry\} receiveShadow>/)
  actual.dispose(); merged.dispose()
})

// Independent reconstruction of the pre-batching JSX (one group per mouth).
function authoredMouths(placements: readonly CulvertMouthPlacement[]) {
  const scene = new Group()
  for (const { position, rotation } of placements) {
    const root = new Group(); root.position.set(position[0], -.11, position[1]); root.rotation.y = rotation
    const add = (id: string, geometry: BoxGeometry | CylinderGeometry | TorusGeometry, position: [number, number, number], roughness: number, casts: boolean, receives: boolean) => {
      const mesh = new Mesh(geometry, new MeshStandardMaterial({ roughness }))
      mesh.name = id; mesh.position.set(...position); mesh.castShadow = casts; mesh.receiveShadow = receives
      root.add(mesh); return mesh
    }
    for (const x of [-.86, .86]) add('precast', new BoxGeometry(.58, .74, .3), [x, .28, 0], .95, true, true)
    add('precast', new BoxGeometry(2.3, .22, .3), [0, .61, 0], .95, true, true)
    add('sill', new BoxGeometry(1.22, .16, .38), [0, -.005, .01], 1, false, true)
    const pipe = add('pipe', new CylinderGeometry(.51, .51, .24, 28), [0, .28, .22], .92, false, false)
    pipe.rotation.x = Math.PI / 2; pipe.material.side = DoubleSide
    add('rim', new TorusGeometry(.54, .075, 8, 28), [0, .28, .36], .94, false, false)
    for (const side of [-1, 1]) add('wings', new BoxGeometry(1.05, .54, .22), [side * 1.35, .18, -.38], .98, true, true).rotation.y = side * -.42
    scene.add(root)
  }
  scene.updateMatrixWorld(true)
  return scene
}

test('four opaque batches preserve all sixteen authored pieces, UVs, normals, winding and finishes', () => {
  for (const angle of [0, .83, -2.31]) {
    const placements: CulvertMouthPlacement[] = [
      { position: [-30.2, 14.8], rotation: angle + Math.PI },
      { position: [-25.7, 19.9], rotation: angle },
    ]
    const legacy = authoredMouths(placements), batches = createVirtualChurchCulvertBatches(placements)
    const meshes: Mesh[] = []; legacy.traverse(object => { if (object instanceof Mesh) meshes.push(object) })
    assert.equal(meshes.length, 16); assert.equal(batches.length, 4)
    assert.equal(batches.reduce((sum, { geometry }) => sum + geometry.index!.count / 3, 0), 1264)
    for (const batch of batches) {
      const geometry = batch.geometry, actual = geometry.toNonIndexed()
      const p = actual.getAttribute('position'), n = actual.getAttribute('normal'), uv = actual.getAttribute('uv')
      let cursor = 0
      for (const mesh of meshes.filter(mesh => mesh.name === batch.id || (batch.id === 'precast' && mesh.name === 'wings'))) {
        const material = mesh.material as MeshStandardMaterial
        if (batch.id === 'precast') {
          assert.ok(Math.abs(batch.roughness - material.roughness) <= .0200001,
            'only the two nearly identical matte precast finishes may converge')
        } else {
          assert.equal(batch.roughness, material.roughness)
        }
        assert.equal(batch.side, material.side)
        assert.equal(batch.castShadow, mesh.castShadow); assert.equal(batch.receiveShadow, mesh.receiveShadow)
        assert.equal(material.transparent, false)
        const original = mesh.geometry.toNonIndexed(), normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld)
        for (let i = 0; i < original.getAttribute('position').count; i++, cursor++) {
          const position = new Vector3().fromBufferAttribute(original.getAttribute('position'), i).applyMatrix4(mesh.matrixWorld)
          const normal = new Vector3().fromBufferAttribute(original.getAttribute('normal'), i).applyNormalMatrix(normalMatrix)
          assert.ok(position.distanceTo(new Vector3().fromBufferAttribute(p, cursor)) < 3e-6)
          assert.ok(normal.distanceTo(new Vector3().fromBufferAttribute(n, cursor)) < 1e-6)
          assert.equal(uv.getX(cursor), original.getAttribute('uv').getX(i))
          assert.equal(uv.getY(cursor), original.getAttribute('uv').getY(i))
        }
        original.dispose()
      }
      assert.equal(cursor, p.count)
      assert.equal(geometry.groups.length, 0, 'one draw per material, no hidden subgroups')
      assert.ok(geometry.boundingBox && geometry.boundingSphere)
      assert.ok(Number.isFinite(geometry.boundingSphere.radius))
      actual.dispose(); geometry.dispose()
    }
    for (const mesh of meshes) { mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose() }
  }
})

test('material distinctions and separate ownership survive repeated preparation', () => {
  const placements: CulvertMouthPlacement[] = [{ position: [3, 4], rotation: .5 }]
  const a = createVirtualChurchCulvertBatches(placements), b = createVirtualChurchCulvertBatches(placements)
  assert.deepEqual(a.map(({ role, roughness, side }) => [role, roughness, side]), [
    ['precastConcrete', .97, FrontSide],
    ['concreteEdge', 1, FrontSide], ['pipeInterior', .92, DoubleSide], ['concreteEdge', .94, FrontSide],
  ])
  let disposed = 0
  a.forEach(({ geometry }, i) => {
    assert.notEqual(geometry, b[i].geometry)
    assert.deepEqual(geometry.getAttribute('position').array, b[i].geometry.getAttribute('position').array)
    geometry.addEventListener('dispose', () => disposed++)
    geometry.dispose()
  })
  assert.equal(disposed, 4); b.forEach(({ geometry }) => geometry.dispose())
  assert.deepEqual(createVirtualChurchCulvertBatches([]), [])
})

test('only V3 uses opaque mouth batches; legacy, riprap loading and owned cleanup remain', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /visualVersion === 'v3' \? <BatchedCulvertMouths mouths=\{mouths\} \/> : <>/)
  assert.match(source, /<CulvertPipeMouth position=\{lower\}/)
  assert.match(source, /<CulvertPipeMouth position=\{upper\}/)
  assert.match(source, /batches\.forEach\(\(\{ geometry \}\) => geometry\.dispose\(\)\)/)
  assert.match(source, /color=\{ALIFE_V3_ENVIRONMENT_TREATMENT\.culvertDetails\[batch\.role\]\}/)
  assert.match(source, /side=\{batch\.side\}/)
  assert.doesNotMatch(source, /culvertConcreteRoughnessShader|culvertRoughness/,
    'this draw reduction must not require a new shader program')
  assert.match(source, /\{detailed \? \([\s\S]*?placements=\{riprapPlacements\('a'\)\}/)
  assert.match(source, /visualVersion === 'v3' && perfConfig\.isMobile \? \(\s*<BatchedCulvertRocks/)
  for (const index of [0, 1, 2]) {
    assert.match(source, new RegExp(`useLoader\\(GLTFLoader, V3_LOW_ROCK_PATHS\\[${index}\\]\\)`))
  }
  assert.doesNotMatch(source, /useLoader\(GLTFLoader, V3_LOW_ROCK_PATHS\)/,
    'array loads can break the shared GLTF resource lease while single-path consumers are mounted')
})
