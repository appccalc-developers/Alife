import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { ArrayCamera, BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, PerspectiveCamera, Vector3 } from 'three'
import {
  createVirtualChurchCurvedPlantBladeGeometry,
  createVirtualChurchHedgeInstances,
  createVirtualChurchPlantVisibility,
  writeVirtualChurchTussockMatrices,
  writeVirtualChurchColoredTussocks,
  writeVirtualChurchShrubMatrices,
  virtualChurchPlantClearsPaving,
  type VirtualChurchHedgeSegment,
  type VirtualChurchTussockPlacement,
} from '../src/views/virtualChurchTussockInstances.ts'

test('plant culling retains every on-screen vertex, instance colours and full bounds across mirrored camera rotations', () => {
  const geometry = new BoxGeometry(.4, 1.2, .2), material = new MeshStandardMaterial()
  const mesh = new InstancedMesh(geometry, material, 8)
  const originals = Array.from({ length: 8 }, (_, i) => new Matrix4().makeTranslation(Math.sin(i * Math.PI / 4) * 8, 0, Math.cos(i * Math.PI / 4) * 8))
  originals.forEach((matrix, i) => { mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, new Color(i / 8, .4, .7)) })
  mesh.scale.set(1.1, 1, -1); mesh.updateMatrixWorld(true); mesh.computeBoundingSphere()
  const fullBounds = mesh.boundingSphere!.clone(), position = geometry.getAttribute('position')
  const visibility = createVirtualChurchPlantVisibility(mesh)
  const camera = new PerspectiveCamera(55, 844 / 390, .1, 40)
  let reductions = 0
  for (const aspect of [844 / 390, 390 / 844]) for (let angle = 0; angle <= 720; angle += 15) {
    camera.aspect = aspect; camera.updateProjectionMatrix()
    camera.lookAt(Math.sin(angle * Math.PI / 180), 0, Math.cos(angle * Math.PI / 180)); camera.updateMatrixWorld(true)
    visibility.update(camera)
    const selected: number[] = []
    for (let slot = 0; slot < mesh.count; slot++) {
      const actual = new Matrix4(); mesh.getMatrixAt(slot, actual)
      const index = originals.findIndex(original => original.elements.every((v, i) => Math.abs(v - actual.elements[i]) < 1e-6))
      assert.ok(index >= 0); selected.push(index)
      const tint = new Color(); mesh.getColorAt(slot, tint)
      assert.ok(Math.abs(tint.r - index / 8) < 1e-6 && Math.abs(tint.g - .4) < 1e-6)
    }
    assert.deepEqual(selected, [...new Set(selected)].sort((a, b) => a - b))
    originals.forEach((matrix, index) => {
      for (let vertex = 0; vertex < position.count; vertex++) {
        const point = new Vector3().fromBufferAttribute(position, vertex).applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld).project(camera)
        if (Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && Math.abs(point.z) <= 1) assert.ok(selected.includes(index), 'visible plant vertex must never disappear')
      }
    })
    assert.ok(fullBounds.equals(mesh.boundingSphere!))
    const version = mesh.instanceMatrix.version
    visibility.update(camera); assert.equal(mesh.instanceMatrix.version, version, 'settled camera must not upload again')
    if (mesh.count < 8) reductions++
  }
  assert.ok(reductions > 90)
  visibility.update(new ArrayCamera())
  assert.equal(mesh.count, 8, 'stereo restores the full batch, not a single-eye subset')
  visibility.update(camera)
  assert.ok(mesh.count < 8, 'mono culling resumes after stereo')
  mesh.castShadow = true; assert.throws(() => createVirtualChurchPlantVisibility(mesh), /non-shadow-casting/)
  geometry.dispose(); material.dispose(); mesh.dispose()
})

test('plant culling is V3-only, before buffer upload, and empty batches do not inflate profile calls', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const probe = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  assert.match(source, /config3D.visualVersion === 'v3' \? <PlantVisibilityPass \/> : null/)
  assert.match(source, /scene.onBeforeRender = beforeRender/)
  assert.match(source, /if \(scene.onBeforeRender === beforeRender\) scene.onBeforeRender = previous/)
  assert.match(probe, /!effectivelyVisible \|\| instanceCount === 0/)
})
import { ALIFE_V3_ENVIRONMENT_TREATMENT } from '../src/views/alifeVisualTheme.ts'
import * as scene from '../src/views/virtualChurchScene.ts'
import { groundedPosition, provisionalTerrainHeightAt } from '../src/views/virtualChurchTerrain.ts'
import { virtualChurchSwaleFloorAt } from '../src/views/virtualChurchInteractionContract.ts'

test('plant clearance checks the full footprint, boundaries, corners and concave paving', () => {
  const square = [[0, 0], [4, 0], [4, 4], [0, 4]] as const
  assert.equal(virtualChurchPlantClearsPaving([2, 0, 2], .5, [square]), false)
  assert.equal(virtualChurchPlantClearsPaving([-.4, 0, 2], .5, [square]), false)
  assert.equal(virtualChurchPlantClearsPaving([-.6, 0, 2], .5, [square]), true)
  assert.equal(virtualChurchPlantClearsPaving([-.3, 0, -.3], .5, [square]), false)
  assert.equal(virtualChurchPlantClearsPaving([0, 0, 2], 0, [square]), false)
  const concave = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]] as const
  assert.equal(virtualChurchPlantClearsPaving([2, 0, 2], .5, [concave]), true)
  assert.equal(virtualChurchPlantClearsPaving([NaN, 0, 0], .5, [square]), false)
  assert.equal(virtualChurchPlantClearsPaving([5, 0, 5], -1, [square]), false)
})

test('grass exclusion radius contains every curved leaf vertex after the actual instance transforms', () => {
  const geometry = createVirtualChurchCurvedPlantBladeGeometry(1.1, .045, .075, .24, .025)
  const position = geometry.getAttribute('position')
  const check = (_: number, matrix: Matrix4) => {
    for (let vertex = 0; vertex < position.count; vertex++) {
      const point = new Vector3().fromBufferAttribute(position, vertex).applyMatrix4(matrix)
      assert.ok(Math.hypot(point.x, point.z) <= .65, 'clearance must protect leaf tips, not only roots')
    }
  }
  writeVirtualChurchTussockMatrices([{ position: [0, 0, 0] }], true, check, check)
  geometry.dispose()
})

test('actual V3 placement keeps provisional scatter off paving and preserves bank plants and photographed clusters', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const globals = ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
  const site = globals.find(d => d.name.getText(ast) === 'SiteScene')!.initializer as ts.ArrowFunction
  const locals = (site.body as ts.Block).statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
  const globalNames = ['V3_SHARED_ROAD_POLYGONS', 'V3_SHARED_CARPARK_POLYGONS', 'NORTH_FOOTPATH', 'V3_PLANT_CLEARANCE_POLYGONS', 'FRONTAGE_FLAX_CLUSTERS']
  const localNames = ['entranceShrubs', 'reservePlants', 'normalTussockCandidates', 'normalTussocks', 'reserveTussocks', 'combinedTussockAccents', 'shrubCandidates', 'shrubs', 'flaxCandidates', 'flaxPlacements']
  const selected = [...globals.filter(d => globalNames.includes(d.name.getText(ast))), ...locals.filter(d => localNames.includes(d.name.getText(ast)))]
  assert.equal(selected.length, globalNames.length + localNames.length)
  const code = selected.map(d => `const ${d.getText(ast)}`).join('\n')
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText
  const dependencies = { ...scene, groundedPosition, provisionalTerrainHeightAt, virtualChurchSwaleFloorAt, virtualChurchPlantClearsPaving }
  const run = new Function(...Object.keys(dependencies), 'visualVersion', `${compiled}; return { normalTussocks, shrubs, flaxPlacements, normalTussockCandidates, shrubCandidates, flaxCandidates, combinedTussockAccents, reserveTussocks, paved: V3_PLANT_CLEARANCE_POLYGONS }`)
  const v3 = run(...Object.values(dependencies), 'v3'), v2 = run(...Object.values(dependencies), 'v2')
  assert.equal(v2.normalTussocks.length, 19)
  assert.equal(v2.shrubs.length, 13)
  assert.equal(v2.flaxPlacements.length, 23)
  assert.deepEqual(v2.normalTussocks, v2.normalTussockCandidates, 'legacy layout remains untouched')
  assert.deepEqual(v2.shrubs, v2.shrubCandidates)
  assert.deepEqual(v2.flaxPlacements, v2.flaxCandidates)
  for (const [kind, points] of Object.entries(scene.VIRTUAL_CHURCH_SWALE_PLANTS)) {
    const rendered = kind === 'grass' ? v3.normalTussocks : v3.flaxPlacements
    for (const [x, z] of points) {
      const plant = rendered.find((p: { position: number[] }) => p.position[0] === x && p.position[2] === z)
      assert.ok(plant, `${kind}: bank relocation must not silently delete plants`)
      assert.equal(plant.position[1], virtualChurchSwaleFloorAt(x, z), 'root is on the rendered bank')
      assert.ok(Math.hypot(x - scene.SCENE_LANDMARKS.culvert[0], z - scene.SCENE_LANDMARKS.culvert[2]) > 5)
    }
  }
  for (const [plants, baseRadius] of [[v3.normalTussocks, .65], [v3.shrubs, .9], [v3.flaxPlacements, 1.25]] as const) {
    for (const plant of plants) {
      if (plant.cluster) continue
      const radius = baseRadius * (plant.scale ?? 1)
      assert.equal(virtualChurchPlantClearsPaving(plant.position, radius, v3.paved), true)
    }
  }
  assert.deepEqual(v3.flaxPlacements.filter((p: { cluster?: boolean }) => p.cluster), v2.flaxPlacements.filter((p: { cluster?: boolean }) => p.cluster), 'photo-constrained frontage clusters are not culled by a circle approximation')
  assert.deepEqual(v3.combinedTussockAccents, [...v3.normalTussocks, ...v3.reserveTussocks], 'removed roadside clumps cannot leave orphan accent blades')
  assert.ok(v3.shrubs.length < v2.shrubs.length, 'existing asphalt shrub regression must be removed')
  console.log('Plant placement counts', { grass: v3.normalTussocks.length, shrubs: v3.shrubs.length, flax: v3.flaxPlacements.length })
})

test('V3 curved plant blade forms a finite tapered ribbon with a bent silhouette', () => {
  const height = 1.7
  const baseWidth = 0.08
  const shoulderWidth = 0.12
  const geometry = createVirtualChurchCurvedPlantBladeGeometry(height, baseWidth, shoulderWidth, 0.32, 0.04)
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.getIndex()

  assert.equal(position.count, 10)
  assert.equal(index?.count, 24)
  assert.ok(Array.from(position.array).every(Number.isFinite))
  assert.ok(Array.from(normal.array).every(Number.isFinite))
  assert.ok(geometry.boundingBox)
  assert.ok(Math.abs((geometry.boundingBox.max.y - geometry.boundingBox.min.y) - height) < 1e-6)

  const widthAt = (sectionIndex: number) => position.getX(sectionIndex * 2 + 1) - position.getX(sectionIndex * 2)
  const centreXAt = (sectionIndex: number) => (position.getX(sectionIndex * 2) + position.getX(sectionIndex * 2 + 1)) / 2
  const centreZAt = (sectionIndex: number) => (position.getZ(sectionIndex * 2) + position.getZ(sectionIndex * 2 + 1)) / 2
  assert.ok(Math.abs(widthAt(0) - baseWidth) < 1e-6)
  assert.ok(Math.abs(widthAt(1) - shoulderWidth) < 1e-6)
  assert.ok(widthAt(4) > 0 && widthAt(4) < widthAt(3))
  assert.ok(centreZAt(4) > centreZAt(2) && centreZAt(2) > centreZAt(0))
  assert.ok(centreXAt(3) > centreXAt(1) && centreXAt(1) > centreXAt(0))

  const indices = index ? Array.from(index.array) : []
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    const a = new Object3D().position.set(position.getX(indices[triangle]), position.getY(indices[triangle]), position.getZ(indices[triangle]))
    const b = new Object3D().position.set(position.getX(indices[triangle + 1]), position.getY(indices[triangle + 1]), position.getZ(indices[triangle + 1]))
    const c = new Object3D().position.set(position.getX(indices[triangle + 2]), position.getY(indices[triangle + 2]), position.getZ(indices[triangle + 2]))
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-12)
  }

  geometry.dispose()
})

function legacyMatrices(placements: readonly VirtualChurchTussockPlacement[], rotateBlades: boolean) {
  const base: Matrix4[] = []
  const accent: Matrix4[] = []
  const root = new Object3D()
  const blade = new Object3D()
  const matrix = new Matrix4()
  for (const placement of placements) {
    root.position.set(...placement.position)
    root.scale.setScalar(placement.scale ?? 1)
    root.rotation.set(0, placement.rotation ?? 0, 0)
    root.updateMatrix()
    for (let index = 0; index < 9; index += 1) {
      const angle = index * .7
      blade.position.set(Math.cos(angle) * .15, .48, Math.sin(angle) * .15)
      blade.rotation.set(Math.cos(angle) * .38, rotateBlades ? angle : 0, Math.sin(angle) * .38)
      blade.scale.setScalar(1)
      blade.updateMatrix()
      matrix.multiplyMatrices(root.matrix, blade.matrix)
      ;(index % 3 === 0 ? accent : base).push(matrix.clone())
    }
  }
  return { base, accent }
}

test('tussock writer preserves every legacy V2 and V3 blade transform', () => {
  const placements: VirtualChurchTussockPlacement[] = [
    { position: [10, 0, 23], scale: .75 },
    { position: [-49, -.2, 14], scale: .85, rotation: .37 },
  ]
  for (const rotateBlades of [false, true]) {
    const actual = { base: [] as Matrix4[], accent: [] as Matrix4[] }
    const counts = writeVirtualChurchTussockMatrices(
      placements,
      rotateBlades,
      (_, matrix) => actual.base.push(matrix.clone()),
      (_, matrix) => actual.accent.push(matrix.clone()),
    )
    const expected = legacyMatrices(placements, rotateBlades)
    assert.equal(counts.baseCount, placements.length * 6)
    assert.equal(counts.accentCount, placements.length * 3)
    assert.deepEqual(actual.base.map(matrix => matrix.elements), expected.base.map(matrix => matrix.elements))
    assert.deepEqual(actual.accent.map(matrix => matrix.elements), expected.accent.map(matrix => matrix.elements))
  }
})

test('combined V3 accent batch is the exact ordered union of both former meshes', () => {
  const normal: VirtualChurchTussockPlacement[] = [{ position: [1, 0, 2], scale: .78 }]
  const reserve: VirtualChurchTussockPlacement[] = [{ position: [-3, -.1, 4], scale: .85 }]
  const combined: Matrix4[] = []
  writeVirtualChurchTussockMatrices(
    [...normal, ...reserve],
    true,
    undefined,
    (_, matrix) => combined.push(matrix.clone()),
  )
  const expected = [...legacyMatrices(normal, true).accent, ...legacyMatrices(reserve, true).accent]
  assert.deepEqual(combined.map(matrix => matrix.elements), expected.map(matrix => matrix.elements))
})

test('one V3 grass batch retains every base/reserve/accent matrix and its linear colour', () => {
  const normal: VirtualChurchTussockPlacement[] = [{ position: [1, -.12, 2], scale: .78, rotation: .27 }]
  const reserve: VirtualChurchTussockPlacement[] = [{ position: [-3, -.1, 4], scale: .85 }, { position: [4, 0, -7] }]
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.plantSilhouettes
  const expected = [
    ...legacyMatrices(normal, true).base.map(matrix => ({ matrix, color: treatment.tussock })),
    ...legacyMatrices(reserve, true).base.map(matrix => ({ matrix, color: treatment.reserveTussock })),
    ...legacyMatrices([...normal, ...reserve], true).accent.map(matrix => ({ matrix, color: treatment.dryAccent })),
  ]
  const actual: typeof expected = []
  const count = writeVirtualChurchColoredTussocks([
    { placements: normal, color: treatment.tussock }, { placements: reserve, color: treatment.reserveTussock },
  ], treatment.dryAccent, (index, matrix, color) => {
    assert.equal(index, actual.length)
    actual.push({ matrix: matrix.clone(), color })
    // Instanced colours are Float32 linear RGB, not unconverted sRGB values.
    const linear = new Color(color)
    for (const channel of linear.toArray()) assert.ok(Math.abs(Math.fround(channel) - channel) < 3e-8)
  })
  const signature = ({ matrix, color }: typeof expected[number]) => JSON.stringify([matrix.elements, color])
  assert.equal(count, 27)
  assert.deepEqual(actual.map(signature).sort(), expected.map(signature).sort())
  assert.equal(writeVirtualChurchColoredTussocks([], treatment.dryAccent, () => assert.fail('empty group')), 0)
})

test('one shrub batch preserves the old side/centre world transforms and V2 split indices', () => {
  const placements: VirtualChurchTussockPlacement[] = [
    { position: [1, -.18, 2], scale: .8, rotation: .9 }, { position: [-2, 0, 4] },
  ]
  const actual: Matrix4[] = []
  writeVirtualChurchShrubMatrices(placements, (plant, lobe, matrix) => {
    assert.equal(plant * 3 + lobe, actual.length)
    actual.push(matrix.clone())
  })
  const expected: Matrix4[] = []
  for (const placement of placements) {
    const root = new Object3D()
    root.position.set(...placement.position); root.scale.setScalar(placement.scale ?? 1); root.rotation.y = placement.rotation ?? 0
    for (const position of [[-.35, .38, .08], [.35, .38 + .1, .08], [0, .43, -.18]] as const) {
      const lobe = new Object3D(); lobe.position.set(...position); lobe.scale.set(1, .82, 1); root.add(lobe)
    }
    root.updateMatrixWorld(true)
    root.children.forEach(lobe => expected.push(lobe.matrixWorld.clone()))
  }
  assert.deepEqual(actual.map(matrix => matrix.elements), expected.map(matrix => matrix.elements))
  assert.equal(writeVirtualChurchShrubMatrices([], () => assert.fail('empty shrubs')), 0)
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /visualVersion === 'v3' \? <V3ColoredTussockField normal=\{normalTussocks\} reserve=\{reserveTussocks\}/)
  assert.match(source, /V3_TUSSOCK_INSTANCE_MATERIAL = createV3PlantMaterial\('#ffffff'\)/)
  assert.match(source, /V3_SHRUB_INSTANCE_MATERIAL = new MeshStandardMaterial\(\{ color: '#ffffff', roughness: 0.9 \}\)/)
  assert.match(source, /lobeIndex === 2 \? SHRUB_CENTRE_MATERIAL.color : SHRUB_SIDE_MATERIAL.color/)
  assert.match(source, /sideRef.current\?\.setMatrixAt\(placementIndex \* 2 \+ lobeIndex, matrix\)/)
})

test('V3 hedge modules overlap into continuous runs with fewer visible joins', () => {
  const segments: VirtualChurchHedgeSegment[] = [
    [[-8, 2], [8, 2]],
    [[8, 2], [13, 7]],
  ]
  const instances = createVirtualChurchHedgeInstances(segments)
  const legacyCount = segments.reduce((total, [start, end]) => (
    total + Math.max(3, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 0.5))
  ), 0)
  assert.ok(instances.length < legacyCount / 2)

  for (const segmentIndex of [0, 1]) {
    const modules = instances.filter((instance) => instance.segmentIndex === segmentIndex)
    assert.equal(modules.length, modules[0].moduleCount)
    assert.deepEqual(modules.map(({ moduleIndex }) => moduleIndex), modules.map((_, index) => index))
    for (const module of modules) {
      const centreStep = Math.hypot(
        segments[segmentIndex][1][0] - segments[segmentIndex][0][0],
        segments[segmentIndex][1][1] - segments[segmentIndex][0][1],
      ) / module.moduleCount
      assert.ok(module.scale[0] > centreStep)
      assert.ok(module.scale[1] >= 0.62 && module.scale[1] <= 0.688)
      assert.ok(module.scale[2] >= 0.94 && module.scale[2] <= 0.98)
    }
  }
})

test('hedge generation drops degenerate lines instead of producing invalid matrices', () => {
  assert.deepEqual(createVirtualChurchHedgeInstances([[[2, 3], [2, 3]]]), [])
})
