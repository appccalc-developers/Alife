import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three'
import { prepareVirtualChurchFoyerPassage } from '../src/views/virtualChurchFoyerPassage.ts'
import { loadDracoDecoder } from '../../../tools/virtual-church/gate-a-church-geometry.mjs'

const triangle = (x: number, y: number, z: number) => [
  x, y, z, x + .1, y, z, x, y + .1, z,
]

test('V3 passage removes only the cloned photo backdrop, preserving exterior faces and source geometry', () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    ...triangle(-11, 2, 6.31),
    ...triangle(-11, 2, 0),
    ...triangle(-25, 2, 6.31),
  ], 3))
  geometry.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8])
  const material = new MeshStandardMaterial({ name: 'M_OffWhite' })
  const mesh = new Mesh(geometry, material)
  const model = new Group()
  model.add(mesh)
  const passage = prepareVirtualChurchFoyerPassage(model)
  try {
    assert.equal(passage.removedTriangles, 1)
    assert.notEqual(mesh.geometry, geometry)
    assert.equal(mesh.geometry.index?.count, 6)
    assert.equal(geometry.index?.count, 9)
    assert.deepEqual(Array.from(mesh.geometry.index!.array), [3, 4, 5, 6, 7, 8])
  } finally { passage.dispose(); material.dispose(); geometry.dispose() }
})

test('an unknown model or material is left untouched', () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(triangle(-11, 2, 6.31), 3))
  geometry.setIndex([0, 1, 2])
  const material = new MeshStandardMaterial({ name: 'UnknownWhite' })
  const mesh = new Mesh(geometry, material)
  const model = new Group()
  model.add(mesh)
  const passage = prepareVirtualChurchFoyerPassage(model)
  try {
    assert.equal(passage.removedTriangles, 0)
    assert.equal(mesh.geometry, geometry)
  } finally { passage.dispose(); material.dispose(); geometry.dispose() }
})

test('V3 removes old near-left returns and the three false service-side stripes, preserving other geometry', () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    ...triangle(-17.30, 2, 1.05),
    ...triangle(-17.30, 2, 3.45),
    ...triangle(-17.30, 2, 5.80),
    ...triangle(-17.30, 2, 8.40),
    ...triangle(.50, 2, 3.45),
    ...triangle(1.2, 2, 3.45),
  ], 3))
  geometry.setIndex(Array.from({ length: 18 }, (_, index) => index))
  const material = new MeshStandardMaterial({ name: 'M_Charcoal' })
  const mesh = new Mesh(geometry, material), model = new Group()
  model.add(mesh)
  const passage = prepareVirtualChurchFoyerPassage(model)
  try {
    assert.equal(passage.removedLeftWallLineTriangles, 3)
    assert.equal(passage.removedServiceWallLineTriangles, 1)
    assert.deepEqual(Array.from(mesh.geometry.index!.array), [9, 10, 11, 15, 16, 17])
    assert.equal(geometry.index?.count, 18, 'the cached source remains immutable')
  } finally { passage.dispose(); material.dispose(); geometry.dispose() }
})

test('non-indexed Draco-style charcoal geometry is also filtered on the V3 clone', () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    ...triangle(-17.30, 2, 1.05),
    ...triangle(-17.30, 2, 8.40),
  ], 3))
  const material = new MeshStandardMaterial({ name: 'M_Charcoal' })
  const mesh = new Mesh(geometry, material), model = new Group()
  model.add(mesh)
  const passage = prepareVirtualChurchFoyerPassage(model)
  try {
    assert.equal(passage.removedLeftWallLineTriangles, 1)
    assert.deepEqual(Array.from(mesh.geometry.index!.array), [3, 4, 5])
    assert.equal(geometry.index, null, 'the cached source stays non-indexed')
  } finally { passage.dispose(); material.dispose(); geometry.dispose() }
})

test('Low cedar service returns are removed without cutting the floor', () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    ...triangle(.50, 2, 1.45),
    .50, .09, 1.0, .60, .09, 1.0, .50, .09, 1.9,
    ...triangle(.50, 2, 8.40),
  ], 3))
  const material = new MeshStandardMaterial({ name: 'M_CedarLight' })
  const mesh = new Mesh(geometry, material), model = new Group()
  model.add(mesh)
  const passage = prepareVirtualChurchFoyerPassage(model)
  try {
    assert.equal(passage.removedServiceWallLineTriangles, 1)
    assert.deepEqual(Array.from(mesh.geometry.index!.array), [3, 4, 5, 6, 7, 8])
  } finally { passage.dispose(); material.dispose(); geometry.dispose() }
})

test('V3 opens only the four complete service-partition faces in a cloned wall', () => {
  const wallFace = (x: number) => [
    x, 0, 6.4, x, 0, -.52, x, 6.05, 6.4,
    x, 0, -.52, x, 6.05, -.52, x, 6.05, 6.4,
  ]
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    ...wallFace(.68), ...wallFace(.49), ...triangle(.68, 1, 3),
  ], 3))
  geometry.setIndex(Array.from({ length: 15 }, (_, index) => index))
  const material = new MeshStandardMaterial({ name: 'M_OffWhite' })
  const mesh = new Mesh(geometry, material), model = new Group()
  model.add(mesh)
  const passage = prepareVirtualChurchFoyerPassage(model)
  try {
    assert.equal(passage.removedServicePartitionTriangles, 4)
    assert.equal(passage.removedTriangles, 4)
    assert.deepEqual(Array.from(mesh.geometry.index!.array), [12, 13, 14])
    assert.equal(geometry.index?.count, 15, 'the cached source remains immutable')
  } finally { passage.dispose(); material.dispose(); geometry.dispose() }
})

test('V3 cuts only complete near-left wall faces behind the two main-hall doors', () => {
  const wallFace = (x: number) => [
    x, 0, 6.4, x, 0, -.52, x, 6.05, 6.4,
    x, 0, -.52, x, 6.05, -.52, x, 6.05, 6.4,
  ]
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    ...wallFace(-17.2547), ...wallFace(-17.4344), ...triangle(-17.2547, 1, 3),
  ], 3))
  geometry.setIndex(Array.from({ length: 15 }, (_, index) => index))
  const material = new MeshStandardMaterial({ name: 'M_OffWhite' })
  const mesh = new Mesh(geometry, material), model = new Group()
  model.add(mesh)
  const passage = prepareVirtualChurchFoyerPassage(model)
  try {
    assert.equal(passage.removedMainHallPartitionTriangles, 4)
    assert.deepEqual(Array.from(mesh.geometry.index!.array), [12, 13, 14])
    assert.equal(geometry.index?.count, 15, 'the cached source remains immutable')
  } finally { passage.dispose(); material.dispose(); geometry.dispose() }
})

test('all three immutable church LODs lose only bounded openings, obsolete returns and duplicate pendants', async () => {
  const { module: draco } = await loadDracoDecoder()
  const expectedOldLeftTriangles: Record<string, number> = {
    'church-hero.glb': 328,
    'church-hero-medium.glb': 326,
    'church-hero-low.glb': 24,
  }
  const expectedServiceLineTriangles: Record<string, number> = {
    'church-hero.glb': 324,
    'church-hero-medium.glb': 324,
    'church-hero-low.glb': 24,
  }
  const expectedPendantTriangles: Record<string, number> = {
    'church-hero.glb': 2160, 'church-hero-medium.glb': 1056, 'church-hero-low.glb': 404,
  }
  for (const lod of ['church-hero.glb', 'church-hero-medium.glb', 'church-hero-low.glb']) {
    const raw = await readFile(new URL(`../public/virtual-church-assets/v3/releases/gate-a-baseline-r9/buildings/${lod}`, import.meta.url))
    const jsonLength = raw.readUInt32LE(12)
    const json = JSON.parse(raw.toString('utf8', 20, 20 + jsonLength))
    const binary = raw.subarray(28 + jsonLength)
    let removed = 0, removedMainHallWall = 0, removedLeftWallLines = 0, removedServiceWallLines = 0, removedPendants = 0
    for (const meshDefinition of json.meshes) for (const primitive of meshDefinition.primitives) {
      const materialName = json.materials[primitive.material]?.name
      if (!['M_OffWhite', 'M_Charcoal', 'M_CedarLight', 'M_WarmLight'].includes(materialName)) continue
      const extension = primitive.extensions.KHR_draco_mesh_compression
      const view = json.bufferViews[extension.bufferView]
      const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
      const decoder = new draco.Decoder(), buffer = new draco.DecoderBuffer(), decoded = new draco.Mesh()
      const position = new draco.DracoFloat32Array(), face = new draco.DracoInt32Array()
      const geometry = new BufferGeometry(), material = new MeshStandardMaterial({ name: materialName })
      try {
        buffer.Init(new Int8Array(bytes), bytes.length)
        assert.ok(decoder.DecodeBufferToMesh(buffer, decoded).ok(), `${lod} must decode`)
        decoder.GetAttributeFloatForAllPoints(decoded, decoder.GetAttributeByUniqueId(decoded, extension.attributes.POSITION), position)
        geometry.setAttribute('position', new Float32BufferAttribute(
          Array.from({ length: decoded.num_points() * 3 }, (_, index) => position.GetValue(index)), 3,
        ))
        const indices: number[] = []
        for (let index = 0; index < decoded.num_faces(); index++) {
          decoder.GetFaceFromMesh(decoded, index, face)
          indices.push(face.GetValue(0), face.GetValue(1), face.GetValue(2))
        }
        geometry.setIndex(indices)
        const renderGeometry = materialName === 'M_Charcoal' ? geometry.toNonIndexed() : geometry
        const model = new Group(), mesh = new Mesh(renderGeometry, material)
        model.add(mesh)
        const passage = prepareVirtualChurchFoyerPassage(model)
        try {
          removed += passage.removedServicePartitionTriangles
          removedMainHallWall += passage.removedMainHallPartitionTriangles
          removedLeftWallLines += passage.removedLeftWallLineTriangles
          removedServiceWallLines += passage.removedServiceWallLineTriangles
          removedPendants += passage.removedPendantTriangles
          assert.equal(geometry.index?.count, indices.length, `${lod} cached source must stay intact`)
          assert.equal(mesh.geometry.index!.count, indices.length - passage.removedTriangles * 3)
        } finally { passage.dispose(); if (renderGeometry !== geometry) renderGeometry.dispose() }
      } finally {
        material.dispose(); geometry.dispose()
        for (const value of [position, face, decoded, buffer, decoder]) draco.destroy(value)
      }
    }
    assert.equal(removed, 4, `${lod} must remove only both complete source wall faces`)
    assert.equal(removedMainHallWall, 4, `${lod} must remove only the complete left main-hall wall faces`)
    assert.equal(removedLeftWallLines, expectedOldLeftTriangles[lod], `${lod} must remove only its old left returns`)
    assert.equal(removedServiceWallLines, expectedServiceLineTriangles[lod], `${lod} must remove only the old service-side returns`)
    assert.equal(removedPendants, expectedPendantTriangles[lod], `${lod} must remove its exact decoded old shade/cord/bulb triangles`)
  }
})

test('duplicate pendant filter preserves ceiling, facade, other materials and transformed instances', () => {
  for (const indexed of [true, false]) for (const materialName of ['M_CedarLight', 'M_Charcoal', 'M_WarmLight', 'M_OffWhite']) {
    const y = materialName === 'M_Charcoal' ? 5.5 : 4.9
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([
      -8.81, y, 1.64, -8.79, y, 1.64, -8.81, y + .02, 1.66,
      ...triangle(-8.8, 5.9, 2.5), // acoustic ceiling, outside all three centers
      ...triangle(-8.8, 3.0, 1.65), // unrelated low timber/architecture
      ...triangle(-14, 4.9, 1.65), // exterior/other timber outside exact X
    ], 3))
    if (indexed) geometry.setIndex(Array.from({ length: 12 }, (_, i) => i))
    const material = new MeshStandardMaterial({ name: materialName })
    const mesh = new Mesh(geometry, material), model = new Group(); model.add(mesh)
    const before = [...geometry.getAttribute('position').array]
    const result = prepareVirtualChurchFoyerPassage(model)
    try {
      const expected = materialName === 'M_OffWhite' ? 0 : 1
      assert.equal(result.removedPendantTriangles, expected)
      assert.equal(result.removedTriangles, expected)
      if (expected) assert.deepEqual([...mesh.geometry.index!.array], [3, 4, 5, 6, 7, 8, 9, 10, 11])
      else assert.equal(mesh.geometry, geometry)
      assert.deepEqual([...geometry.getAttribute('position').array], before)
      assert.equal(geometry.index?.count ?? geometry.getAttribute('position').count, 12, 'immutable source')
      const movedMesh = new Mesh(geometry, material), movedModel = new Group()
      movedMesh.position.x = .1; movedModel.add(movedMesh)
      const skipped = prepareVirtualChurchFoyerPassage(movedModel)
      try { assert.equal(skipped.removedPendantTriangles, 0); assert.equal(movedMesh.geometry, geometry) } finally { skipped.dispose() }
    } finally { result.dispose(); material.dispose(); geometry.dispose() }
  }
})

test('the actual Low cedar batch loses only the old near cross, not its floor', async () => {
  const raw = await readFile(new URL('../public/virtual-church-assets/v3/releases/gate-a-baseline-r9/buildings/church-hero-low.glb', import.meta.url))
  const jsonLength = raw.readUInt32LE(12)
  const json = JSON.parse(raw.toString('utf8', 20, 20 + jsonLength))
  const binary = raw.subarray(28 + jsonLength)
  const { module: draco } = await loadDracoDecoder()
  let removedCross = 0, preservedFloor = 0
  for (const meshDefinition of json.meshes) for (const primitive of meshDefinition.primitives) {
    if (json.materials[primitive.material]?.name !== 'M_CedarLight') continue
    const extension = primitive.extensions.KHR_draco_mesh_compression
    const view = json.bufferViews[extension.bufferView]
    const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
    const decoder = new draco.Decoder(), buffer = new draco.DecoderBuffer(), decoded = new draco.Mesh()
    const position = new draco.DracoFloat32Array(), face = new draco.DracoInt32Array()
    const geometry = new BufferGeometry(), material = new MeshStandardMaterial({ name: 'M_CedarLight' })
    try {
      buffer.Init(new Int8Array(bytes), bytes.length)
      assert.ok(decoder.DecodeBufferToMesh(buffer, decoded).ok())
      decoder.GetAttributeFloatForAllPoints(decoded, decoder.GetAttributeByUniqueId(decoded, extension.attributes.POSITION), position)
      geometry.setAttribute('position', new Float32BufferAttribute(
        Array.from({ length: decoded.num_points() * 3 }, (_, i) => position.GetValue(i)), 3,
      ))
      const indices: number[] = []
      for (let i = 0; i < decoded.num_faces(); i++) {
        decoder.GetFaceFromMesh(decoded, i, face)
        indices.push(face.GetValue(0), face.GetValue(1), face.GetValue(2))
      }
      geometry.setIndex(indices)
      const floorTriangles = (index: number[]) => {
        let count = 0
        for (let i = 0; i < index.length; i += 3) {
          if ([index[i], index[i + 1], index[i + 2]].every(vertex =>
            Math.abs(geometry.getAttribute('position').getY(vertex) - .09) < .002)) count++
        }
        return count
      }
      const floorBefore = floorTriangles(indices)
      const model = new Group(), mesh = new Mesh(geometry, material)
      model.add(mesh)
      const passage = prepareVirtualChurchFoyerPassage(model)
      try {
        removedCross += passage.removedTriangles
        assert.equal(floorTriangles(Array.from(mesh.geometry.index!.array)), floorBefore)
        preservedFloor += floorBefore
      } finally { passage.dispose() }
    } finally {
      material.dispose(); geometry.dispose()
      for (const value of [position, face, decoded, buffer, decoder]) draco.destroy(value)
    }
  }
  assert.ok(removedCross > 0, 'the Low-only cedar cross must not float in the extended foyer')
  assert.ok(preservedFloor > 50, 'the same cedar batch still contains the authored floor')
})
