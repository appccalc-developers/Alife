import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { Color, Matrix4, Shape, ShapeGeometry, Texture, Vector2, Vector3, type BufferGeometry } from 'three'
import { createVirtualChurchGroundPolygonGeometry, type VirtualChurchGroundPolygon } from '../src/views/virtualChurchGroundPolygonGeometry.ts'
import { buildTerrainLODGrid, provisionalTerrainHeightAt } from '../src/views/virtualChurchTerrain.ts'
import { VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS, VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT, VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS } from '../src/views/virtualChurchScene.ts'
import * as scene from '../src/views/virtualChurchScene.ts'
import { virtualChurchGroundHeightAt, virtualChurchPointInsidePolygon, VIRTUAL_CHURCH_PLATFORMS } from '../src/views/virtualChurchInteractionContract.ts'
import { ALIFE_PBR, ALIFE_V3_ENVIRONMENT_TREATMENT } from '../src/views/alifeVisualTheme.ts'

const THE_RUNWAY: VirtualChurchGroundPolygon = [[-76, 8], [-13, 59], [36, 91], [42, 82], [-6.37, 49.22], [-69.37, -1.78]]
const STARK_DRIVE_NORTH: VirtualChurchGroundPolygon = [[-14, 58], [-69, 109], [-62, 116], [-6, 62]]

test('flat road and driveway support feet above the buried swale, without flattening terrain outside', () => {
  for (const version of ['v2', 'v3'] as const) {
    for (const [x, z, expected] of [[-63.5, 8.5, .018], [-50, 18.5, .032], [-42.5, -36.5, .01]]) {
      const terrain = provisionalTerrainHeightAt(x, z)
      for (const feet of [-1, 0, 2]) {
        assert.equal(virtualChurchGroundHeightAt(x, z, feet, terrain, version), expected)
        assert.equal(virtualChurchGroundHeightAt(x, z, feet, -.44, version), expected, 'flat paving must also support feet when underlying terrain is depressed')
      }
    }
    // The aligned channel now owns the old [-30, 29] bank sample; use a
    // genuinely unpaved point beyond its endpoint for terrain-only behavior.
    for (const [x, z] of [[-60, -45], [-25, 27]]) {
      const terrain = provisionalTerrainHeightAt(x, z)
      assert.equal(virtualChurchGroundHeightAt(x, z, 0, terrain, version), terrain, 'unpaved terrain remains unchanged')
    }
  }
  // The origin belongs to the V3 foyer, not unpaved terrain. Its solid floor
  // must support feet independently of the lower terrain backing.
  assert.equal(virtualChurchGroundHeightAt(0, 0, 0, -.44, 'v3'), .095)
  assert.equal(virtualChurchGroundHeightAt(0, 0, 0, provisionalTerrainHeightAt(0, 0), 'v2'),
    provisionalTerrainHeightAt(0, 0), 'V2 has no V3 foyer floor')
  const platform = VIRTUAL_CHURCH_PLATFORMS[1]
  const x = (platform.minX + platform.maxX) / 2, z = (platform.minZ + platform.maxZ) / 2
  assert.equal(virtualChurchGroundHeightAt(x, z, 0, -.44), platform.top, 'existing culvert support wins over paving')
})

test('road collision follows both render-version footprints and includes exact seams', () => {
  for (const version of ['v2', 'v3'] as const) {
    const road = version === 'v3' ? scene.V3_THE_RUNWAY_APPROACH : scene.THE_RUNWAY
    for (const [x, z] of road) {
      assert.ok(virtualChurchGroundHeightAt(x, z, 0, -.44, version) >= .018, 'exact road corners are solid')
    }
    let count = 0
    for (let x = -70; x <= 30; x += 2) for (let z = 0; z <= 78; z += 2) {
      if (!virtualChurchPointInsidePolygon(road, x, z)) continue
      assert.ok(virtualChurchGroundHeightAt(x, z, 0, provisionalTerrainHeightAt(x, z), version) >= .018)
      count++
    }
    assert.ok(count > 200)
  }
  // V2 must not gain an invisible floor on the V3-only mapped extension.
  assert.equal(virtualChurchGroundHeightAt(80, 120, 0, -.3, 'v2'), -.3)
  assert.equal(virtualChurchGroundHeightAt(80, 120, 0, -.3, 'v3'), .018)
})
const INTERSECTION_ISLANDS: readonly VirtualChurchGroundPolygon[] = [
  [[-18, 59], [-14, 64], [-9, 61], [-12, 56]],
  [[-5, 52], [0, 55], [4, 50], [-1, 47]],
  [[-12, 48], [-8, 44], [-12, 39], [-17, 43]],
]

function createLegacyGeometry(points: VirtualChurchGroundPolygon) {
  const shape = new Shape()
  points.forEach(([x, z], index) => index === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z))
  shape.closePath()
  return new ShapeGeometry(shape)
}

function assertSameTriangles(actual: BufferGeometry, polygons: readonly VirtualChurchGroundPolygon[]) {
  const expanded = actual.toNonIndexed()
  assert.equal(actual.groups.length, 0, 'one shared material requires one draw group')
  let offset = 0
  for (const polygon of polygons) {
    const indexedExpected = createLegacyGeometry(polygon)
    const expected = indexedExpected.toNonIndexed()
    indexedExpected.dispose()
    for (const name of ['position', 'normal', 'uv']) {
      const actualAttribute = expanded.getAttribute(name)
      const expectedAttribute = expected.getAttribute(name)
      assert.equal(actualAttribute.itemSize, expectedAttribute.itemSize)
      for (let index = 0; index < expectedAttribute.count; index += 1) {
        for (let component = 0; component < expectedAttribute.itemSize; component += 1) {
          const actualValue = actualAttribute.array[(offset + index) * actualAttribute.itemSize + component]
          const expectedValue = expectedAttribute.array[index * expectedAttribute.itemSize + component]
          assert.ok(Math.abs(actualValue - expectedValue) <= 0.00001,
            `${name} triangle vertex ${offset + index} differs by ${Math.abs(actualValue - expectedValue)}`)
        }
      }
    }
    offset += expected.getAttribute('position').count
    expected.dispose()
  }
  assert.equal(expanded.getAttribute('position').count, offset, 'no triangles are added or removed')
  assert.ok(actual.boundingBox && actual.boundingSphere && Number.isFinite(actual.boundingSphere.radius))
  expanded.dispose()
  actual.dispose()
}

test('two road polygons batch without changing triangles, normals or UVs', () => {
  const geometry = createVirtualChurchGroundPolygonGeometry([THE_RUNWAY, STARK_DRIVE_NORTH])
  assert.ok(geometry)
  assertSameTriangles(geometry, [THE_RUNWAY, STARK_DRIVE_NORTH])
})

test('three traffic islands batch without changing triangles, normals or UVs', () => {
  const geometry = createVirtualChurchGroundPolygonGeometry(INTERSECTION_ISLANDS)
  assert.ok(geometry)
  assertSameTriangles(geometry, INTERSECTION_ISLANDS)
})

test('empty polygon sets do not allocate a render batch', () => {
  assert.equal(createVirtualChurchGroundPolygonGeometry([]), null)
})

test('neighbour forecourts keep their concave outlines in one bounded ground batch', () => {
  const geometry = createVirtualChurchGroundPolygonGeometry(VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS)
  assert.ok(geometry)
  assert.ok((geometry.index?.count ?? 0) / 3 < 100, 'neighbour pavement remains inexpensive on Low')
  assertSameTriangles(geometry, VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS)
})

test('context terrain seals the horizon with upward faces while retaining the detailed pad', () => {
  for (const low of [4, 8]) {
    const lod = { highRadius: 20, mediumRadius: 45, steps: { high: 1, medium: 2, low } }
    const original = buildTerrainLODGrid(-72, 72, lod, 0, 0)
    const extended = buildTerrainLODGrid(-72, 72, lod, 0, 0, -0.025, 256)
    assert.deepEqual(extended.positions.slice(0, original.positions.length), original.positions)
    assert.deepEqual(extended.indices.slice(0, original.indices.length), original.indices)
    const added = extended.indices.slice(original.indices.length)
    assert.ok(added.length / 3 <= 300, 'outer context must stay coarsely tessellated')
    let area = 0
    for (let i = 0; i < added.length; i += 3) {
      const [a, b, c] = added.slice(i, i + 3).map((id) => extended.positions.slice(id * 3, id * 3 + 3))
      const upwardArea = ((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])) / 2
      assert.ok(upwardArea > 0, 'all context faces must be visible from above')
      area += upwardArea
      const cx = (a[0] + b[0] + c[0]) / 3
      const cz = (a[2] + b[2] + c[2]) / 3
      assert.ok(Math.abs(cx) >= 72 || Math.abs(cz) >= 72, 'no overlap inside detailed pad')
    }
    assert.ok(Math.abs(area - 4 * (256 ** 2 - 72 ** 2)) < 0.001, 'ring covers full missing ground')
    for (let i = original.positions.length; i < extended.positions.length; i += 3) {
      const [x, y, z] = extended.positions.slice(i, i + 3)
      assert.ok(Math.abs(x) === 256 || Math.abs(z) === 256)
      assert.equal(y, provisionalTerrainHeightAt(x, z) - 0.025)
    }
  }
})

test('service court reuses the concrete ground batch with six upward triangles', () => {
  const court = createVirtualChurchGroundPolygonGeometry([VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT.points])!
  assert.equal(court.index!.count / 3, 6)
  const p = court.getAttribute('position')
  for (let i = 0; i < court.index!.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map(j => court.index!.getX(i + j))
    const twiceArea = (p.getX(b) - p.getX(a)) * (p.getY(c) - p.getY(a))
      - (p.getY(b) - p.getY(a)) * (p.getX(c) - p.getX(a))
    assert.ok(twiceArea > 0, 'front faces point upward after the ground rotation')
  }
  court.dispose()
  const polygons = [...VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS, VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT.points]
  assertSameTriangles(createVirtualChurchGroundPolygonGeometry(polygons)!, polygons)
})

test('optional linear vertex tints leave existing paving unchanged and keep one draw group', () => {
  const polygons = [THE_RUNWAY, VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT.points]
  const tints = ['#ffffff', '#bebcb0']
  const tinted = createVirtualChurchGroundPolygonGeometry(polygons, tints)!
  const colors = tinted.getAttribute('color')
  let offset = 0
  polygons.forEach((polygon, index) => {
    const original = createLegacyGeometry(polygon)
    const color = new Color(tints[index])
    for (let v = 0; v < original.getAttribute('position').count; v++) {
      const actual = [colors.getX(offset), colors.getY(offset), colors.getZ(offset)]
      color.toArray().forEach((expected, c) => assert.ok(Math.abs(actual[c] - expected) < 1e-7))
      offset++
    }
    original.dispose()
  })
  assertSameTriangles(tinted, polygons)
  const plain = createVirtualChurchGroundPolygonGeometry(polygons)!
  assert.equal(plain.getAttribute('color'), undefined, 'other batches have no extra attribute')
  plain.dispose()
  assert.throws(() => createVirtualChurchGroundPolygonGeometry(polygons, ['#ffffff']), /count/)
})

test('elevation offsets preserve original UVs and normals and reject invalid arrays before allocation', () => {
  const polygons = [THE_RUNWAY, STARK_DRIVE_NORTH]
  const offsets = [.001, .034]
  const plain = createVirtualChurchGroundPolygonGeometry(polygons)!
  const raised = createVirtualChurchGroundPolygonGeometry(polygons, undefined, offsets)!
  for (const name of ['normal', 'uv']) assert.deepEqual(raised.attributes[name].array, plain.attributes[name].array)
  assert.deepEqual(raised.index!.array, plain.index!.array)
  let vertex = 0
  polygons.forEach((polygon, index) => {
    const old = createLegacyGeometry(polygon)
    for (let i = 0; i < old.attributes.position.count; i++, vertex++) {
      assert.equal(raised.attributes.position.getX(vertex), plain.attributes.position.getX(vertex))
      assert.equal(raised.attributes.position.getY(vertex), plain.attributes.position.getY(vertex))
      assert.equal(raised.attributes.position.getZ(vertex), Math.fround(offsets[index]))
    }
    old.dispose()
  })
  assert.equal(raised.boundingBox!.min.z, Math.fround(.001))
  assert.equal(raised.boundingBox!.max.z, Math.fround(.034))
  for (const invalid of [[0], [0, NaN], [Infinity, 0]]) {
    assert.throws(() => createVirtualChurchGroundPolygonGeometry(polygons, undefined, invalid), /elevations/)
  }
  const suppliedTint = new Color('#c6c8c2').multiply(new Color('#bebcb0'))
  const originalTint = suppliedTint.clone()
  const tinted = createVirtualChurchGroundPolygonGeometry(polygons, [suppliedTint, '#ffffff'], offsets)!
  assert.deepEqual(suppliedTint, originalTint, 'shared Color inputs remain owned by the caller')
  tinted.dispose(); plain.dispose(); raised.dispose()
})

test('four V3 ground batches execute real JSX with unchanged world heights, textures, colors and surfaces', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names = ['GroundPolygonSet', 'V3_THE_RUNWAY_APPROACH', 'STARK_DRIVE_NORTH', 'STARK_DRIVE_SERVICE',
    'NORTH_FOOTPATH', 'ENTRANCE_DRIVEWAY', 'MAIN_CARPARK', 'CARPARK_SPINE_WALKWAY', 'WETLAND_POND_A', 'WETLAND_POND_B']
  const declarations = ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
    .filter(d => names.includes(d.name.getText(ast)) || d.name.getText(ast).startsWith('V3_SHARED_'))
  const transpile = (text: string) => ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.React, jsxFactory: 'createElement' },
  }).outputText
  const selected: ts.JsxSelfClosingElement[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'GroundPolygonSet'
      && /polygons=\{V3_SHARED_/.test(node.attributes.getText(ast))) selected.push(node)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.equal(selected.length, 4)
  selected.forEach(node => {
    let parent: ts.Node | undefined = node.parent
    while (parent && !ts.isConditionalExpression(parent)) parent = parent.parent
    assert.ok(parent && ts.isConditionalExpression(parent) && parent.condition.getText(ast) === "visualVersion === 'v3'", 'new batches are V3-only')
  })
  const cleanups: Array<() => void> = []
  const asphalt = new Texture(), concrete = new Texture(), water = new Texture(), normalScale = new Vector2(.1, .1)
  const api = new Function('scene', 'Color', 'useMemo', 'useEffect', 'createElement', 'createVirtualChurchGroundPolygonGeometry',
    'ALIFE_PBR', 'ALIFE_V3_ENVIRONMENT_TREATMENT', 'V3_WATER_NORMAL_SCALE', 'asphaltTexture', 'concreteTexture', 'waterNormalTexture',
    `const { V3_THE_RUNWAY_APPROACH, STARK_DRIVE_NORTH, STARK_DRIVE_SERVICE, ENTRANCE_DRIVEWAY, MAIN_CARPARK, VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION, VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS, VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT } = scene;
     const v3GroundTreatment = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces;
     ${transpile(declarations.map(d => `const ${d.getText(ast)}`).join('\n'))}
     return { render: GroundPolygonSet, elements: [${selected.map(n => transpile(`return ${n.getText(ast)}`).replace(/^return /, '').replace(/;\s*$/, '')).join(',')}],
       roads: [V3_THE_RUNWAY_APPROACH, STARK_DRIVE_NORTH, scene.VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION, STARK_DRIVE_SERVICE],
       concrete: [NORTH_FOOTPATH, ...scene.VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS, scene.VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT.points, CARPARK_SPINE_WALKWAY],
       parking: [ENTRANCE_DRIVEWAY, MAIN_CARPARK], ponds: [WETLAND_POND_A, WETLAND_POND_B] };`)(
    scene, Color, (fn: () => unknown) => fn(), (fn: () => () => void) => cleanups.push(fn()),
    (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }),
    createVirtualChurchGroundPolygonGeometry, ALIFE_PBR, ALIFE_V3_ENVIRONMENT_TREATMENT, normalScale, asphalt, concrete, water,
  )
  const ground = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces
  const expected = [
    { polygons: api.concrete, heights: api.concrete.map((_: unknown, i: number) => i === api.concrete.length - 1 ? .046 : .012),
      colors: api.concrete.map((_: unknown, i: number) => i === api.concrete.length - 1 ? new Color(ground.spineWalkway) : new Color(ground.footpath).multiply(new Color(i === api.concrete.length - 2 ? '#bebcb0' : '#ffffff'))),
      roughness: .98, metalness: 0, map: concrete, normal: null, env: ALIFE_PBR.envMapIntensity },
    { polygons: api.roads, heights: [.018, .018, .018, .019], colors: ['#48504f', '#48504f', '#48504f', '#505755'].map(c => new Color(c)),
      roughness: .85, metalness: .15, map: asphalt, normal: null, env: ALIFE_PBR.envMapIntensity },
    { polygons: api.parking, heights: [.032, .01], colors: ['#3d4342', '#343a39'].map(c => new Color(c)),
      roughness: .96, metalness: .02, map: asphalt, normal: null, env: ALIFE_PBR.envMapIntensity },
    { polygons: api.ponds, heights: [-.34, -.34], colors: [new Color(ground.water), new Color(ground.water)],
      roughness: ground.waterRoughness, metalness: 0, map: null, normal: water, env: ground.waterEnvMapIntensity },
  ]
  api.elements.forEach((element: any, batchIndex: number) => {
    const mesh = api.render(element.props), material = mesh.children[0].props, original = expected[batchIndex]
    assert.equal(mesh.props.receiveShadow, true)
    assert.equal(material.roughness, original.roughness); assert.equal(material.metalness, original.metalness)
    assert.equal(material.envMapIntensity, original.env); assert.equal(material.map, original.map)
    assert.equal(material.normalMap, original.normal); assert.equal(material.normalScale, original.normal ? normalScale : undefined)
    const geometry = mesh.props.geometry as BufferGeometry, expanded = geometry.toNonIndexed()
    const transform = new Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, mesh.props.position[1], 0)
    const base = new Color(material.color)
    assert.equal(geometry.groups.length, 0)
    let offset = 0
    original.polygons.forEach((polygon: VirtualChurchGroundPolygon, i: number) => {
      const old = createLegacyGeometry(polygon), reference = old.toNonIndexed()
      const oldTransform = new Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, original.heights[i], 0)
      for (let vertex = 0; vertex < reference.attributes.position.count; vertex++, offset++) {
        const position = new Vector3().fromBufferAttribute(expanded.attributes.position, offset)
        assert.ok(geometry.boundingBox!.containsPoint(position))
        const actual = position.applyMatrix4(transform), expectedPoint = new Vector3().fromBufferAttribute(reference.attributes.position, vertex).applyMatrix4(oldTransform)
        assert.ok(actual.distanceTo(expectedPoint) < 1e-6, 'retain original millimetre offsets and all polygon boundaries')
        for (const name of ['normal', 'uv']) for (let c = 0; c < reference.attributes[name].itemSize; c++) {
          assert.equal(expanded.attributes[name].getComponent(offset, c), reference.attributes[name].getComponent(vertex, c))
        }
        const actualColor = expanded.hasAttribute('color') ? new Color().fromBufferAttribute(expanded.attributes.color, offset).multiply(base) : base
        actualColor.toArray().forEach((value, c) => assert.ok(Math.abs(value - original.colors[i].toArray()[c]) < 1e-7))
      }
      old.dispose(); reference.dispose()
    })
    assert.equal(offset, expanded.attributes.position.count, 'no added/removed triangles')
    expanded.dispose()
    let disposed = 0
    geometry.addEventListener('dispose', () => disposed++)
    cleanups.pop()!(); assert.equal(disposed, 1)
  })
  asphalt.dispose(); concrete.dispose(); water.dispose()
})
