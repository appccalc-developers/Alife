import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Matrix4, Object3D, Vector3 } from 'three'
import { CHURCH_AUTOMATIC_DOOR as door, VEHICLE_GATE_TRACK_OFFSET, createAutomaticVehicleGateAndFenceMatrixWriter, createAutomaticVehicleGateMatrixWriter, prepareChurchSlidingGeometry, stepAutomaticDoor, vehicleGateSlideDistance, type AutomaticVehicleGatePart } from '../src/views/virtualChurchAutomaticDoors.ts'
import { loadDracoDecoder } from '../../../tools/virtual-church/gate-a-church-geometry.mjs'

test('wordmark clears the corrugated ribs without changing cross or shell placement', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const offset = (name: string) => Number(source.match(new RegExp(`const ${name} = streetOffset\\(([^)]+)\\)`))?.[1])
  assert.ok(offset('streetWordmarkOffset') > offset('streetCladdingOffset') + .06 / 2)
  assert.equal(offset('streetSignOffset'), .62)
  assert.equal(offset('streetShellOffset'), .36)
  assert.match(source, /<ChurchFacadeSign position=\{\[streetFacadeStart\[0\] \+ streetDx \* 0\.23 \+ streetWordmarkOffset\[0\]/)
})

test('entrance louvre backing starts above the automatic door opening', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const entryLouvreBackingHeight = Math\.max\(0\.2, entryLouvreTop - recessHeight\)/)
  assert.match(source, /position=\{\[entryLouvreCentre, recessHeight \+ entryLouvreBackingHeight \/ 2, -0\.05\]\}/)
  assert.doesNotMatch(source, /position=\{\[entryLouvreCentre, entryLouvreTop \/ 2, -0\.05\]\}/)
})

test('automatic doors open on approach, hold at the edge, delay closure and reopen immediately', () => {
  for (const radius of [5, 7]) for (const hz of [20, 60, 120]) {
    const state = { open: false, awaySeconds: 0, progress: 0 }
    for (let i = 0; i < hz * 2; i++) stepAutomaticDoor(state, radius, 1 / hz, radius)
    assert.equal(state.progress, 1)
    for (let i = 0; i < hz * 4; i++) stepAutomaticDoor(state, radius + 1, 1 / hz, radius)
    assert.equal(state.progress, 1, 'hysteresis protects people beside the door')
    for (let i = 0; i < hz; i++) stepAutomaticDoor(state, radius + 2, 1 / hz, radius)
    assert.equal(state.progress, 1, 'one second away must not close it')
    for (let i = 0; i < hz * 4; i++) stepAutomaticDoor(state, radius + 2, 1 / hz, radius)
    assert.equal(state.progress, 0)
    stepAutomaticDoor(state, radius - .1, 1 / hz, radius)
    assert.ok(state.progress > 0)
    stepAutomaticDoor(state, 0, 1 / hz, radius, true)
    assert.equal(state.progress, 1, 'reduced motion snaps to the safe open pose')
    state.awaySeconds = 2
    for (let i = 0; i < hz / 2; i++) stepAutomaticDoor(state, radius + 2, 1 / hz, radius)
    const closingProgress = state.progress
    assert.ok(closingProgress > 0 && closingProgress < 1)
    stepAutomaticDoor(state, radius, 1 / hz, radius)
    assert.ok(state.progress > closingProgress, 'approach reverses an in-progress closure')
  }
})

test('vehicle gate leaves retract to both sides without rotating or sweeping into the driveway', () => {
  const length = 5.92
  const gateParts: AutomaticVehicleGatePart[] = [
    { position: [-length / 2, .74, 0], scale: [.16, 1.48, .16] },
    { position: [length / 2, .74, 0], scale: [.16, 1.48, .16] },
  ]
  const leafParts: AutomaticVehicleGatePart[] = [
    { position: [-length / 4, .27, 0], scale: [length / 2 - .08, .065, .075] },
    { position: [-length / 4, 1.24, 0], scale: [length / 2 - .08, .065, .075] },
    { position: [-length / 2 + .06, .68, 0], scale: [.032, 1.36, .032] },
    { position: [length / 4, .27, 0], scale: [length / 2 - .08, .065, .075] },
    { position: [length / 4, 1.24, 0], scale: [length / 2 - .08, .065, .075] },
    { position: [length / 2 - .06, .68, 0], scale: [.032, 1.36, .032] },
  ]
  const writer = createAutomaticVehicleGateMatrixWriter(gateParts, leafParts, length)
  assert.equal(writer.count, gateParts.length + leafParts.length)

  for (const progress of [0, .37, 1, .62, 0]) {
    const actual: Matrix4[] = []
    writer.write(progress, (index, matrix) => { actual[index] = matrix.clone() })
    const expected: Matrix4[] = []
    const part = new Object3D()
    for (const item of gateParts) {
      part.position.set(...item.position); part.rotation.set(0, 0, 0); part.scale.set(...item.scale); part.updateMatrix()
      expected.push(part.matrix.clone())
    }
    for (const side of [-1, 1] as const) {
      for (const item of leafParts.filter(item => Math.sign(item.position[0]) === side)) {
        // Independent expected translation, including the clearance past each post.
        const x = item.position[0] + side * (length / 2 + .12) * progress
        part.position.set(x, item.position[1], item.position[2] - .16)
        part.rotation.set(0, 0, 0); part.scale.set(...item.scale); part.updateMatrix()
        expected.push(part.matrix.clone())
        assert.ok(Math.abs(part.position.z) - item.scale[2] / 2 > .08, 'moving leaf clears the fixed post plane')
        if (progress === 1) assert.ok(Math.abs(x) - item.scale[0] / 2 > length / 2, 'full opening clears the original driveway')
      }
    }
    assert.equal(actual.length, expected.length)
    actual.forEach((matrix, index) => assert.deepEqual(matrix.elements, expected[index].elements))
  }
  assert.equal(VEHICLE_GATE_TRACK_OFFSET, -.16)
  assert.equal(vehicleGateSlideDistance(length, -1), 0)
  assert.equal(vehicleGateSlideDistance(length, 2), length / 2 + .12)
  assert.ok(-vehicleGateSlideDistance(length, 1) + .06 < -length / 2, 'latch also clears the opening')
})

test('V3 shared fence batch preserves fixed world transforms and updates only the sliding gate suffix', async () => {
  const length = 5.92
  const fence: AutomaticVehicleGatePart[] = [
    { position: [-41, .68, 3], scale: [3.2, .055, .055], rotation: [0, -.69, 0] },
    { position: [-30, .71, 11], scale: [.085, 1.42, .085], rotation: [0, -.69, 0] },
  ]
  const posts: AutomaticVehicleGatePart[] = [
    { position: [-length / 2, .74, 0], scale: [.16, 1.48, .16] },
    { position: [length / 2, .74, 0], scale: [.16, 1.48, .16] },
  ]
  const leaves: AutomaticVehicleGatePart[] = [
    { position: [-length / 4, .68, 0], scale: [length / 2 - .08, .065, .075] },
    { position: [length / 4, .68, 0], scale: [length / 2 - .08, .065, .075] },
  ]
  const gateWorld = new Matrix4().makeRotationY(-.69).setPosition(-35.9, 0, 6.4)
  const writer = createAutomaticVehicleGateAndFenceMatrixWriter(fence, posts, leaves, length, gateWorld)
  const oldGateWriter = createAutomaticVehicleGateMatrixWriter(posts, leaves, length)
  assert.equal(writer.staticCount, fence.length)
  assert.equal(writer.dynamicCount, oldGateWriter.count)
  assert.equal(writer.count, fence.length + oldGateWriter.count)

  const part = new Object3D()
  const staticMatrices: Matrix4[] = []
  writer.writeStatic((index, matrix) => { staticMatrices[index] = matrix.clone() })
  fence.forEach((item, index) => {
    part.position.set(...item.position)
    part.rotation.set(...(item.rotation ?? [0, 0, 0]))
    part.scale.set(...item.scale)
    part.updateMatrix()
    const restoredWorld = gateWorld.clone().multiply(staticMatrices[index])
    restoredWorld.elements.forEach((value, component) =>
      assert.ok(Math.abs(value - part.matrix.elements[component]) < 1e-12))
  })
  for (const progress of [0, .37, 1, .62, 0]) {
    const actual: Matrix4[] = []
    writer.writeGate(progress, (index, matrix) => { actual[index] = matrix.clone() })
    const expected: Matrix4[] = []
    oldGateWriter.write(progress, (index, matrix) => { expected[index] = matrix.clone() })
    assert.ok(actual.slice(0, fence.length).every(value => value === undefined),
      'moving leaves must not rewrite static fence matrices')
    expected.forEach((matrix, index) => assert.deepEqual(actual[fence.length + index].elements, matrix.elements))
  }
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /mesh\.instanceMatrix\.addUpdateRange\(combinedGate\.staticCount \* 16, combinedGate\.dynamicCount \* 16\)/)
  assert.match(source, /visualVersion !== 'v3' \? <FenceNetwork segments=\{SITE_FENCE_SEGMENTS\}/,
    'V2 retains its separate existing fence renderer')
})

function area(g: BufferGeometry) {
  const p = g.getAttribute('position'), index = g.index
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  let total = 0
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    a.fromBufferAttribute(p, index ? index.getX(i) : i)
    b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1)
    c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2)
    total += b.sub(a).cross(c.sub(a)).length() / 2
  }
  return total
}

test('Low one-piece pane splits without stretching, preserving closed surfaces and cached geometry', () => {
  const source = new BoxGeometry(3.7, 2.19, .12).translate(door.centre, 1.175, -.735)
  const original = Array.from(source.getAttribute('position').array)
  const result = prepareChurchSlidingGeometry(source, 'M_Glass')!
  assert.ok(result)
  assert.ok(Math.abs(area(result.geometry) - area(source)) < .0001)
  const closed = Array.from(result.geometry.getAttribute('position').array)
  result.update(1)
  const p = result.geometry.getAttribute('position')
  for (let i = 0; i < p.count; i++) assert.ok(Math.abs(p.getX(i) - door.centre) >= 1.949)
  assert.ok(Math.abs(area(result.geometry) - area(source)) < .0001)
  result.update(0)
  assert.deepEqual(Array.from(p.array), closed)
  assert.deepEqual(Array.from(source.getAttribute('position').array), original)
  assert.equal(prepareChurchSlidingGeometry(source, 'M_OffWhite'), null)
  result.geometry.dispose(); source.dispose()
})

test('all shipped church LODs retain closed geometry and isolate real moving glass', async () => {
  const { module: draco } = await loadDracoDecoder()
  for (const suffix of ['', '-medium', '-low']) {
    const raw = await readFile(new URL(`../public/virtual-church-assets/v3/releases/gate-a-baseline-r9/buildings/church-hero${suffix}.glb`, import.meta.url))
    const len = raw.readUInt32LE(12), json = JSON.parse(raw.toString('utf8', 20, 20 + len)), binary = raw.subarray(28 + len)
    let glassMoved = 0
    for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
      const name = json.materials[primitive.material].name
      if (!/Glass|Charcoal|Silver/i.test(name)) continue
      const ext = primitive.extensions.KHR_draco_mesh_compression, view = json.bufferViews[ext.bufferView]
      const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
      const decoder = new draco.Decoder(), buffer = new draco.DecoderBuffer(), decoded = new draco.Mesh()
      const g = new BufferGeometry()
      try {
        buffer.Init(new Int8Array(bytes), bytes.length)
        assert.ok(decoder.DecodeBufferToMesh(buffer, decoded).ok())
        for (const [semantic, id] of Object.entries(ext.attributes)) {
          const attribute = decoder.GetAttributeByUniqueId(decoded, id), values = new draco.DracoFloat32Array()
          try {
            decoder.GetAttributeFloatForAllPoints(decoded, attribute, values)
            g.setAttribute(({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1' } as Record<string, string>)[semantic], new Float32BufferAttribute(Array.from({ length: values.size() }, (_, i) => values.GetValue(i)), attribute.num_components()))
          } finally { draco.destroy(values) }
        }
        const face = new draco.DracoInt32Array(), indices: number[] = []
        try {
          for (let i = 0; i < decoded.num_faces(); i++) { decoder.GetFaceFromMesh(decoded, i, face); indices.push(face.GetValue(0), face.GetValue(1), face.GetValue(2)) }
        } finally { draco.destroy(face) }
        g.setIndex(indices)
        const cached = Array.from(g.getAttribute('position').array)
        const moving = prepareChurchSlidingGeometry(g, name)
        if (!moving) continue
        assert.ok(Math.abs(area(moving.geometry) - area(g)) < .002, `${suffix}/${name}: closed surfaces`)
        const closed = Array.from(moving.geometry.getAttribute('position').array)
        moving.update(1)
        assert.ok(Math.abs(area(moving.geometry) - area(g)) < .002, `${suffix}/${name}: no stretched triangles`)
        const open = moving.geometry.getAttribute('position')
        let changed = 0
        for (let i = 0; i < open.count; i++) if (Math.abs(open.getX(i) - closed[i * 3]) > .001) {
          changed++
          assert.ok(closed[i * 3] >= door.start - .006 && closed[i * 3] <= door.end + .006)
          assert.equal(open.getY(i), closed[i * 3 + 1]); assert.equal(open.getZ(i), closed[i * 3 + 2])
        }
        assert.equal(changed, moving.movingVertices)
        if (/Glass/i.test(name)) glassMoved += changed
        moving.update(0)
        assert.deepEqual(Array.from(open.array), closed)
        assert.deepEqual(Array.from(g.getAttribute('position').array), cached)
        moving.geometry.dispose()
      } finally { g.dispose(); draco.destroy(decoded); draco.destroy(buffer); draco.destroy(decoder) }
    }
    assert.ok(glassMoved >= 36, `${suffix}: actual door glass animated`)
  }
})
