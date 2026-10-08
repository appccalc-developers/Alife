import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { Box3, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Frustum, MathUtils, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Texture, Vector2, Vector3 } from 'three'
import { ALIFE_V3_ENVIRONMENT_TREATMENT } from '../src/views/alifeVisualTheme.ts'
import { SCENE_LANDMARKS, VIRTUAL_CHURCH_SWALE, V3_THE_RUNWAY_APPROACH, ENTRANCE_DRIVEWAY } from '../src/views/virtualChurchScene.ts'
import { virtualChurchPointInsidePolygon, virtualChurchSwaleFloorAt, virtualChurchGroundHeightAt } from '../src/views/virtualChurchInteractionContract.ts'
import { buildTerrainLODGrid } from '../src/views/virtualChurchTerrain.ts'

// Execute the current components, including their JSX/material props. Avoid
// importing the whole page (and starting loaders) into a geometry regression.
const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('VirtualChurchView.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const declarations = ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
const names = ['SwaleSurfaceBatch', 'DrainageSwale', 'SWALE_START', 'SWALE_END']
const code = names.map(name => {
  const declaration = declarations.find(d => d.name.getText(ast) === name)
  assert.ok(declaration, name)
  return `const ${declaration.getText(ast)}`
}).join('\n')
const compiled = ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.React, jsxFactory: 'createElement', jsxFragmentFactory: 'Fragment' },
}).outputText

const profiles = [
  [[-3.05, -1.1, 0.025, -0.12], [1.1, 3.05, -0.12, 0.025]],
  [[-1.1, -0.68, -0.12, -0.18], [0.68, 1.1, -0.18, -0.12]],
  [[-0.68, 0.68, -0.18, -0.18]],
  [[-0.42, 0.42, -0.075, -0.075]],
]

const camera = new PerspectiveCamera(47, 844 / 390, 0.1, 190)
camera.position.set(-34.5465, 2.668, -5.0817)
camera.quaternion.set(0.034055, 0.936292, 0.094763, -0.336478).normalize()
camera.updateMatrixWorld()
const parkingFrustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
const visibleAtParking = (geometry: BufferGeometry) => {
  const material = new MeshBasicMaterial()
  const mesh = new Mesh(geometry, material)
  mesh.scale.z = -1 // Same geographic mirror as SiteScene.
  mesh.updateMatrixWorld()
  const visible = parkingFrustum.intersectsObject(mesh)
  material.dispose()
  return visible
}

test('channel passes through the culvert and its open bed is not buried under road or driveway paving', () => {
  const { start, end, crossing } = VIRTUAL_CHURCH_SWALE
  const dx = end[0] - start[0], dz = end[1] - start[1], length = Math.hypot(dx, dz)
  assert.ok(Math.abs((crossing[0] - start[0]) * dz - (crossing[1] - start[1]) * dx) / length < 1e-8)
  assert.ok(Math.abs(dx * 51 - dz * 63) < 1e-7, 'parallel to the existing carriageway edge')
  let tested = 0
  for (let t = .03; t < .98; t += .025) for (const offset of [-.68, 0, .68]) {
    const x = start[0] + dx * t - dz / length * offset
    const z = start[1] + dz * t + dx / length * offset
    if (Math.hypot(x - crossing[0], z - crossing[1]) < 4.5) continue
    assert.equal(virtualChurchPointInsidePolygon(V3_THE_RUNWAY_APPROACH, x, z), false, `asphalt above bed at ${x},${z}`)
    assert.equal(virtualChurchPointInsidePolygon(ENTRANCE_DRIVEWAY, x, z), false, `driveway above bed at ${x},${z}`)
    tested++
  }
  assert.ok(tested > 70)
})

test('actual mobile and desktop terrain triangles leave the aligned open channel visible', () => {
  const { start, end, crossing } = VIRTUAL_CHURCH_SWALE
  const dx = end[0] - start[0], dz = end[1] - start[1], length = Math.hypot(dx, dz)
  for (const lod of [
    { highRadius: 20, mediumRadius: 50, steps: { high: 1, medium: 2, low: 4 } },
    { highRadius: 12, mediumRadius: 30, steps: { high: 2, medium: 4, low: 8 } },
  ]) {
    const grid = buildTerrainLODGrid(-72, 72, lod, 0, 0)
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(grid.positions, 3))
    geometry.setIndex(grid.indices)
    const material = new MeshBasicMaterial({ side: DoubleSide }), mesh = new Mesh(geometry, material)
    mesh.updateMatrixWorld(true)
    const ray = new Raycaster()
    for (let t = .04; t < .97; t += .025) for (const offset of [-.6, 0, .6]) {
      const x = start[0] + dx * t - dz / length * offset
      const z = start[1] + dz * t + dx / length * offset
      if (Math.hypot(x - crossing[0], z - crossing[1]) < 5) continue
      ray.set(new Vector3(x, 2, z), new Vector3(0, -1, 0))
      const hit = ray.intersectObject(mesh)[0]
      assert.ok(hit && hit.point.y < -.18, `terrain covers bed: step ${lod.steps.low}, ${x},${z}, height ${hit?.point.y}`)
    }
    geometry.dispose(); material.dispose()
  }
})

test('feet follow the rendered bank and bed profiles, with no invisible floor across the culvert gap', () => {
  const { start, end, crossing } = VIRTUAL_CHURCH_SWALE
  const dx = end[0] - start[0], dz = end[1] - start[1], length = Math.hypot(dx, dz)
  // Test both banks against the actual authored strip heights used below.
  for (const strips of profiles.slice(0, 3)) for (const [offsetA, offsetB, yA, yB] of strips) {
    for (const blend of [0, .2, .5, .8, 1]) {
      const offset = offsetA + (offsetB - offsetA) * blend
      const x = start[0] + dx * .2 - dz / length * offset
      const z = start[1] + dz * .2 + dx / length * offset
      const height = virtualChurchSwaleFloorAt(x, z)
      assert.ok(height !== null && Math.abs(height - (yA + (yB - yA) * blend)) < 1e-7)
      assert.ok(virtualChurchGroundHeightAt(x, z, -1, -.44) >= height - 1e-7)
    }
  }
  assert.equal(virtualChurchSwaleFloorAt(...crossing), null)
  assert.equal(virtualChurchSwaleFloorAt(0, 0), null)
})

for (const visualVersion of ['v2', 'v3']) test(`${visualVersion}: swale batches preserve all twelve surfaces, colours and the culvert gap`, () => {
  const cleanups: Array<() => void> = []
  let frame: ((state: { camera: PerspectiveCamera }) => void) | undefined
  const normalScale = new Vector2(0.1, 0.1)
  const api = new Function('useMemo', 'useEffect', 'useRef', 'useFrame', 'BufferGeometry', 'Float32BufferAttribute', 'MathUtils',
    'DoubleSide', 'V3_WATER_NORMAL_SCALE', 'ALIFE_V3_ENVIRONMENT_TREATMENT', 'createElement', 'Color', 'Fragment', 'VIRTUAL_CHURCH_SWALE',
    'Frustum', 'Matrix4', 'Box3', 'Vector3',
    `${compiled}; return { SwaleSurfaceBatch, DrainageSwale, SWALE_START, SWALE_END }`)(
    (fn: () => unknown) => fn(), (fn: () => () => void) => cleanups.push(fn()),
    (value: unknown) => ({ current: value }), (callback: (state: { camera: PerspectiveCamera }) => void) => { frame = callback },
    BufferGeometry, Float32BufferAttribute, MathUtils, DoubleSide, normalScale, ALIFE_V3_ENVIRONMENT_TREATMENT,
    (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }),
    Color, 'fragment', VIRTUAL_CHURCH_SWALE, Frustum, Matrix4, Box3, Vector3,
  )
  const water = new Texture()
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces
  const colors = visualVersion === 'v3'
    ? [treatment.swaleBank, treatment.swaleTransition, treatment.swaleBed, treatment.swaleWater]
    : ['#596047', '#77705c', '#293631', '#3e716e']
  const roughness = visualVersion === 'v3' ? [0.98, 0.98, 0.98, treatment.swaleWaterRoughness] : [1, 1, 1, 1]
  const fixtures = [
    { start: api.SWALE_START, end: api.SWALE_END, crossing: [SCENE_LANDMARKS.culvert[0], SCENE_LANDMARKS.culvert[2]] },
    { start: [0, 0], end: [20, 0], crossing: [7, 0] },
    { start: [20, 0], end: [0, 0], crossing: [7, 0] },
    { start: [0, -20], end: [0, 20], crossing: [0, 0] },
  ]
  for (const fixture of fixtures) {
    const { start, end, crossing } = fixture
    const dx = end[0] - start[0], dz = end[1] - start[1], length = Math.hypot(dx, dz)
    const t = MathUtils.clamp(((crossing[0] - start[0]) * dx + (crossing[1] - start[1]) * dz) / length ** 2, 0, 1)
    const point = (v: number) => [start[0] + dx * v, start[1] + dz * v]
    const segments = [[start, point(Math.max(0, t - 3.2 / length))], [point(Math.min(1, t + 3.2 / length)), end]]
    const group = api.DrainageSwale({ ...fixture, visualVersion, waterNormalMap: water })
    const children = group.children.flat()
    const batches = visualVersion === 'v3'
      ? children.flatMap((child: { type: unknown; children: unknown[] }) => child.type === 'group' ? child.children : [child])
      : children.flatMap((child: { children: unknown[] }) => child.children)
    const plan: Array<Array<[segmentIndex: number, surfaceRole: number]>> = visualVersion === 'v3'
      ? [
        [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
        [[0, 3], [1, 3]],
      ]
      : [0, 1].flatMap(segmentIndex => [0, 1, 2, 3].map(surfaceRole => [[segmentIndex, surfaceRole]] as Array<[number, number]>))
    assert.equal(batches.length, plan.length, 'V3 submits two materials; V2 keeps eight original batches')
    let triangles = 0
    let originalVisible = 0
    let batchedVisible = 0
    for (let batchIndex = 0; batchIndex < plan.length; batchIndex++) {
        const batch = batches[batchIndex]
        const role = plan[batchIndex][0][1]
        const tinted = plan[batchIndex].some(([, surfaceRole]) => surfaceRole !== role)
        assert.equal(batch.type, api.SwaleSurfaceBatch)
        const mesh = api.SwaleSurfaceBatch(batch.props)
        assert.equal(mesh.type, 'mesh')
        assert.equal(mesh.props.receiveShadow, true)
        const material = mesh.children[0]
        assert.equal(material.type, 'meshStandardMaterial')
        assert.equal(material.props.color, tinted ? '#ffffff' : colors[role])
        assert.equal(material.props.vertexColors, tinted)
        assert.equal(material.props.roughness, roughness[role])
        assert.equal(material.props.metalness, 0)
        assert.equal(material.props.side, DoubleSide)
        const wet = visualVersion === 'v3' && role === 3
        assert.equal(material.props.normalMap, wet ? water : null)
        assert.equal(material.props.normalScale, wet ? normalScale : undefined)
        assert.equal(material.props.envMapIntensity, wet ? treatment.swaleWaterEnvMapIntensity : 1)
        const geometry: BufferGeometry = mesh.props.geometry
        batchedVisible += Number(visibleAtParking(geometry))
        assert.equal(geometry.groups.length, 0)
        assert.deepEqual(
          Object.keys(geometry.attributes).sort(),
          [...(tinted ? ['color'] : []), 'normal', 'position', ...(wet ? ['uv'] : [])],
          'only V3 water needs planar UVs; V2 and the banks keep their original attributes',
        )
        const expanded = geometry.toNonIndexed()
        let vertexOffset = 0
        for (const [segmentIndex, surfaceRole] of plan[batchIndex]) for (const [offsetA, offsetB, yA, yB] of profiles[surfaceRole]) {
          const [a, b] = segments[segmentIndex]
          // Original strip's four corners and winding, computed independently.
          const stripLength = Math.hypot(b[0] - a[0], b[1] - a[1])
          const nx = -(b[1] - a[1]) / stripLength, nz = (b[0] - a[0]) / stripLength
          const old = new BufferGeometry()
          old.setAttribute('position', new Float32BufferAttribute([
            a[0] + nx * offsetA, yA, a[1] + nz * offsetA,
            a[0] + nx * offsetB, yB, a[1] + nz * offsetB,
            b[0] + nx * offsetA, yA, b[1] + nz * offsetA,
            b[0] + nx * offsetB, yB, b[1] + nz * offsetB,
          ], 3))
          old.setIndex([0, 1, 2, 2, 1, 3]); old.computeVertexNormals()
          originalVisible += Number(visibleAtParking(old))
          const expected = old.toNonIndexed()
          for (const name of ['position', 'normal']) {
            const actualValues = expanded.getAttribute(name).array
            const expectedValues = expected.getAttribute(name).array
            for (let i = 0; i < expectedValues.length; i++) {
              assert.ok(Math.abs(actualValues[vertexOffset * 3 + i] - expectedValues[i]) < 1e-5, `${name}/${batchIndex}/${i}`)
            }
          }
          if (wet) {
            const uv = expanded.getAttribute('uv')
            const position = expanded.getAttribute('position')
            for (let vertex = 0; vertex < 6; vertex++) {
              assert.ok(Math.abs(uv.getX(vertexOffset + vertex) - position.getX(vertexOffset + vertex)) < 1e-5)
              assert.ok(Math.abs(uv.getY(vertexOffset + vertex) - position.getZ(vertexOffset + vertex)) < 1e-5)
            }
            assert.ok(Math.abs(uv.getX(vertexOffset) - uv.getX(vertexOffset + 2)) > 1e-4
              || Math.abs(uv.getY(vertexOffset) - uv.getY(vertexOffset + 2)) > 1e-4,
            'water samples vary along the strip instead of repeating one texel')
          }
          if (tinted) {
            const tint = new Color(colors[surfaceRole])
            for (let vertex = 0; vertex < 6; vertex++) {
              for (const [component, value] of [tint.r, tint.g, tint.b].entries()) {
                assert.ok(Math.abs(expanded.getAttribute('color').array[(vertexOffset + vertex) * 3 + component] - value) < 1e-7,
                  'each face retains its original linear-space material color without blending at the bank edge')
              }
            }
          }
          vertexOffset += 6
          old.dispose(); expected.dispose()
        }
        assert.equal(expanded.getAttribute('position').count, vertexOffset)
        triangles += vertexOffset / 3
        expanded.dispose()
        let disposed = 0
        geometry.addEventListener('dispose', () => disposed++)
        cleanups.pop()!()
        assert.equal(disposed, 1, 'owned geometry released on unmount')
    }
    assert.equal(triangles, 24, 'same complete surfaces, no triangles across the culvert gap')
    if (fixture === fixtures[0]) {
      assert.equal(originalVisible, 0, 'the sampled parking camera excludes the swale')
      if (visualVersion === 'v3') {
        const mergedGroup = children[0] as { props: { ref: { current: { visible: boolean } | null } } }
        mergedGroup.props.ref.current = { visible: true }
        assert.ok(frame)
        frame({ camera })
        assert.equal(mergedGroup.props.ref.current.visible, false, 'merged swale stays culled from parking')
        const street = new PerspectiveCamera(47, 844 / 390, 0.1, 190)
        street.position.set(-53.3465, 2.3032, -27.5817)
        street.quaternion.set(.023587, .938784, .065635, -.337373).normalize()
        street.updateMatrixWorld()
        frame({ camera: street })
        assert.equal(mergedGroup.props.ref.current.visible, true, 'merged swale returns at the street frontage')
      } else {
        assert.equal(batchedVisible, originalVisible, 'V2 retains independent frustum culling')
      }
    }
  }
  assert.equal(cleanups.length, 0)
  water.dispose()
})
