import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { Box3, BoxGeometry, BufferGeometry, ConeGeometry, Euler, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createVirtualChurchTreeVisibility } from '../src/views/virtualChurchTreeVisibility.ts'

const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const component = ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
  .find(d => d.name.getText(ast) === 'LoadedInstancedTreeField')
assert.ok(component)
let frame: ts.Node | undefined
const visit = (node: ts.Node) => {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFrame') frame = node.arguments[0]
  ts.forEachChild(node, visit)
}
visit(component)
assert.ok(frame)
const frameCode = ts.transpileModule(`const frame = ${frame.getText(ast)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2023 },
}).outputText

test('tree LOD uses mirrored world distance and draws exactly one active representation per tree', () => {
  const positions = [[10, 0, 40], [10, 0, -40], [0, 0, 0]]
  const placements = positions.map((position, index) => ({ position, scale: 0.8 + index * 0.1 }))
  const camera = { position: new Vector3() }
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial()
  const meshes = Array.from({ length: 4 }, () => new InstancedMesh(geometry, material, placements.length))
  const highDetailRefs = { current: meshes.slice(0, 2) }
  const farTrunkRef = { current: meshes[2] }, farCrownRef = { current: meshes[3] }
  const sourceMeshes = [{ matrix: new Matrix4() }, { matrix: new Matrix4().makeTranslation(0, 1, 0) }]
  const scratch = {
    position: new Vector3(), scale: new Vector3(), rotation: new Euler(), quaternion: new Quaternion(),
    root: new Matrix4(), final: new Matrix4(), trunkLocal: new Matrix4().makeTranslation(0, 0.55, 0),
    crownLocal: new Matrix4().makeTranslation(0, 1.02, 0),
  }
  const run = new Function('placements', 'camera', 'scratch', 'sourceMeshes', 'highDetailRefs', 'farTrunkRef',
    'farCrownRef', 'lodDistance', 'baseScale', 'visualVersion', 'perfConfig', `${frameCode};return frame`)(
    placements, camera, scratch, sourceMeshes, highDetailRefs, farTrunkRef, farCrownRef, 25, 5, 'v3', { isMobile: false },
  )
  // First two cases expose the old source/world Z distance mix-up. Subsequent
  // passes switch the same buffers through empty, mixed and repopulated LODs.
  for (const view of [[10, 0, -40], [10, 0, 40], [200, 0, 200], [0, 0, 0], [10, 0, -40]]) {
    camera.position.set(...view as [number, number, number])
    run({ clock: { elapsedTime: 3.5 } })
    const near = placements.filter(p => Math.hypot(p.position[0] - view[0], p.position[1] - view[1], -p.position[2] - view[2]) < 25)
    const far = placements.filter(p => !near.includes(p))
    assert.equal(meshes[0].count + meshes[2].count, placements.length, 'no tree dropped or represented twice')
    for (let batch = 0; batch < meshes.length; batch++) {
      const selected = batch < 2 ? near : far
      assert.equal(meshes[batch].count, selected.length)
      assert.equal(meshes[batch].visible, selected.length > 0)
      selected.forEach((placement, index) => {
        const originalIndex = placements.indexOf(placement)
        const [x, y, z] = placement.position
        const sway = Math.sin(3.5 * 0.75 + originalIndex * 1.73 + x * 0.08) * 0.014
        const yaw = ((x * 7 + z * 3) % 11) * 0.17
        const root = new Matrix4().compose(new Vector3(x, y, z),
          new Quaternion().setFromEuler(new Euler(sway * 0.55, yaw, sway)), new Vector3().setScalar(5 * placement.scale))
        const local = batch < 2 ? sourceMeshes[batch].matrix : batch === 2 ? scratch.trunkLocal : scratch.crownLocal
        const expected = root.multiply(local)
        const actual = new Matrix4()
        meshes[batch].getMatrixAt(index, actual)
        for (let i = 0; i < 16; i++) assert.ok(Math.abs(actual.elements[i] - expected.elements[i]) < 1e-5)
      })
    }
  }
  // All-near: verify both far batches stop drawing, then recover on departure.
  placements.forEach(p => { p.position[0] = 0; p.position[2] = 0 })
  camera.position.set(0, 0, 0); run({ clock: { elapsedTime: 0 } })
  assert.deepEqual(meshes.map(m => m.count), [3, 3, 0, 0])
  assert.deepEqual(meshes.map(m => m.visible), [true, true, false, false])
  camera.position.set(100, 0, 100); run({ clock: { elapsedTime: 1 } })
  assert.deepEqual(meshes.map(m => m.count), [0, 0, 3, 3])
  assert.deepEqual(meshes.map(m => m.visible), [false, false, true, true])
  meshes.forEach(m => m.dispose()); geometry.dispose(); material.dispose()
})

test('tree visibility mirrors source Z, retains edge foliage and does not mutate shared inputs', () => {
  const bounds = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 3, 1))
  const original = bounds.clone(), visibility = createVirtualChurchTreeVisibility(bounds)
  const camera = new PerspectiveCamera(60, 2, .1, 100)
  camera.position.set(0, 1.5, 0); camera.lookAt(0, 1.5, -10); camera.updateMatrixWorld(true)
  visibility.update(camera.projectionMatrix, camera.matrixWorldInverse)
  assert.equal(visibility.isVisible(new Matrix4().makeTranslation(0, 0, 10)), true)
  assert.equal(visibility.isVisible(new Matrix4().makeTranslation(0, 0, -10)), false)
  assert.equal(visibility.isVisible(new Matrix4().makeTranslation(100, 0, 10)), false)
  // Root itself is outside the side plane, but part of the crown is inside.
  assert.equal(visibility.isVisible(new Matrix4().makeTranslation(12, 0, 10)), true)
  const root = new Matrix4().compose(new Vector3(11, -1, 10), new Quaternion().setFromEuler(new Euler(.03, .7, -.02)), new Vector3(2, 2, 2))
  const before = root.clone()
  assert.equal(visibility.isVisible(root), true)
  assert.ok(root.equals(before)); assert.ok(bounds.equals(original))
  const unknown = createVirtualChurchTreeVisibility(new Box3())
  unknown.update(camera.projectionMatrix, camera.matrixWorldInverse)
  assert.equal(unknown.isVisible(new Matrix4().makeTranslation(999, 0, -999)), true)
})

test('runtime visibility envelope includes all imported parts, trunk and the entire simplified crown', () => {
  let declaration: ts.Node | undefined
  const find = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'treeVisibility') declaration = node
    ts.forEachChild(node, find)
  }
  find(component!)
  assert.ok(declaration)
  const code = ts.transpileModule(`const ${declaration.getText(ast)}`, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText
  const sourceMeshes = [
    { geometry: new BoxGeometry(2, 4, 3), matrix: new Matrix4().makeRotationY(.4).setPosition(3, 5, -2) },
    { geometry: new BoxGeometry(1, 8, 2), matrix: new Matrix4().makeTranslation(-2, 1, 3) },
  ]
  const crown = new BoxGeometry(1.2, 1.4, 1.1)
  try {
    for (const farCrownGeometry of [crown, null]) {
      const bounds: Box3 = new Function('sourceMeshes', 'farCrownGeometry', 'Box3', 'Vector3', 'createVirtualChurchTreeVisibility', 'useMemo', `${code}; return treeVisibility`)(
        sourceMeshes, farCrownGeometry, Box3, Vector3, (box: Box3) => box.clone(), (fn: () => unknown) => fn(),
      )
      const expected = sourceMeshes.map(part => ({ geometry: part.geometry, matrix: part.matrix }))
      if (farCrownGeometry) expected.push({ geometry: farCrownGeometry, matrix: new Matrix4().makeTranslation(0, 1.02, 0) })
      for (const part of expected) {
        const position = part.geometry.getAttribute('position')
        for (let index = 0; index < position.count; index++) {
          assert.ok(bounds.containsPoint(new Vector3().fromBufferAttribute(position, index).applyMatrix4(part.matrix)))
        }
      }
      assert.ok(bounds.containsPoint(new Vector3(-.1, 0, -.1)))
      assert.ok(bounds.containsPoint(new Vector3(.1, 1.1, .1)))
    }
  } finally { sourceMeshes.forEach(part => part.geometry.dispose()); crown.dispose() }
})

test('mobile camera is evaluated before tree culling without taking over automatic rendering', () => {
  const controller = ast.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations])
    .find(declaration => declaration.name.getText(ast) === 'PlayerController')
  assert.ok(controller)
  let priority: ts.Node | undefined
  const find = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFrame') priority = node.arguments[1]
    ts.forEachChild(node, find)
  }
  find(controller)
  assert.ok(priority)
  const read = new Function('config3D', 'perfConfig', `return ${priority.getText(ast)}`)
  assert.equal(read({ visualVersion: 'v3' }, { isMobile: true }), -1)
  for (const [version, mobile] of [['v2', true], ['v2', false], ['v3', false]] as const) {
    assert.equal(read({ visualVersion: version }, { isMobile: mobile }), 0)
  }
  assert.match(frameCode, /camera.updateMatrixWorld\(\);\s*treeVisibility.update\(camera.projectionMatrix, camera.matrixWorldInverse\)/)
})

test('actual frame skips off-camera mobile trees, restores them on turning, and preserves V2/desktop shadows', () => {
  const placements = [[0, 0, 10], [100, 0, 10], [0, 0, -10]].map(position => ({ position, scale: 1 }))
  const camera = new PerspectiveCamera(60, 2, .1, 100)
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial()
  const meshes = Array.from({ length: 4 }, () => new InstancedMesh(geometry, material, 3))
  const highDetailRefs = { current: meshes.slice(0, 2) }, farTrunkRef = { current: meshes[2] }, farCrownRef = { current: meshes[3] }
  const sourceMeshes = [{ matrix: new Matrix4() }, { matrix: new Matrix4().makeTranslation(0, 1, 0) }]
  const scratch = {
    position: new Vector3(), scale: new Vector3(), rotation: new Euler(), quaternion: new Quaternion(), root: new Matrix4(), final: new Matrix4(),
    trunkLocal: new Matrix4().makeTranslation(0, .55, 0), crownLocal: new Matrix4().makeTranslation(0, 1.02, 0),
  }
  const treeVisibility = createVirtualChurchTreeVisibility(new Box3(new Vector3(-.5, 0, -.5), new Vector3(.5, 2, .5)))
  const run = (visualVersion: string, isMobile: boolean) => new Function('placements', 'camera', 'scratch', 'sourceMeshes', 'highDetailRefs', 'farTrunkRef', 'farCrownRef', 'lodDistance', 'baseScale', 'visualVersion', 'perfConfig', 'treeVisibility', `${frameCode};return frame`)(
    placements, camera, scratch, sourceMeshes, highDetailRefs, farTrunkRef, farCrownRef, 5, 1, visualVersion, { isMobile }, treeVisibility,
  )({ clock: { elapsedTime: 3.5 } })
  for (const direction of [-1, 1, -1]) {
    camera.position.set(0, 1, 0); camera.lookAt(0, 1, direction * 10); camera.updateMatrixWorld(true)
    run('v3', true)
    assert.deepEqual(meshes.map(mesh => mesh.count), [0, 0, 1, 1])
    const actual = new Matrix4(); meshes[2].getMatrixAt(0, actual)
    assert.ok(Math.abs(actual.elements[14] - -direction * 10) < .02)
  }
  camera.position.set(0, 1, -7); camera.lookAt(0, 1, -10); camera.updateMatrixWorld(true)
  run('v3', true)
  assert.deepEqual(meshes.map(mesh => mesh.count), [1, 1, 0, 0])
  assert.deepEqual(meshes.map(mesh => mesh.visible), [true, true, false, false])
  for (const [version, mobile] of [['v2', true], ['v2', false], ['v3', false]] as const) {
    run(version, mobile)
    assert.equal(meshes[0].count + meshes[2].count, 3, 'legacy and shadow-casting paths keep offscreen trees')
  }
  meshes.forEach(mesh => mesh.dispose()); geometry.dispose(); material.dispose()
})

test('V3 far crowns keep a rounded silhouette within a small triangle budget', () => {
  let declaration: ts.VariableDeclaration | undefined
  const find = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'farCrownGeometry') declaration = node
    ts.forEachChild(node, find)
  }
  find(component!)
  assert.ok(declaration?.initializer)
  const code = ts.transpileModule(`const farCrownGeometry = ${declaration.initializer.getText(ast)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText
  const make = new Function('visualVersion', 'variant', 'useMemo', 'ConeGeometry', 'IcosahedronGeometry', 'mergeGeometries',
    `${code}; return farCrownGeometry`) as (
    visualVersion: string, variant: string, useMemo: (factory: () => unknown) => unknown,
    cone: typeof ConeGeometry, icosahedron: typeof IcosahedronGeometry, merge: typeof mergeGeometries,
  ) => BufferGeometry | null
  const instantMemo = (factory: () => unknown) => factory()
  assert.equal(make('v2', 'oak', instantMemo, ConeGeometry, IcosahedronGeometry, mergeGeometries), null)
  for (const variant of ['oak', 'broadleaf', 'pine']) {
    const geometry = make('v3', variant, instantMemo, ConeGeometry, IcosahedronGeometry, mergeGeometries)
    assert.ok(geometry)
    const triangles = (geometry.index?.count ?? geometry.getAttribute('position').count) / 3
    assert.ok(triangles > 0 && triangles <= 300, `${variant}: ${triangles} triangles`)
    if (variant !== 'pine') assert.equal(triangles, 240)
    geometry.dispose()
  }
})

test('V3 distant pines keep their imported silhouette while V2 retains its distance LOD', () => {
  let declaration: ts.VariableDeclaration | undefined
  const find = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'lodDistance') declaration = node
    ts.forEachChild(node, find)
  }
  find(component!)
  assert.ok(declaration?.initializer)
  const code = ts.transpileModule(`const lodDistance = ${declaration.initializer.getText(ast)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText
  const distance = new Function('visualVersion', 'variant', 'perfConfig', `${code}; return lodDistance`) as
    (version: string, variant: string, config: { lodDistances: { tree: number } }) => number
  const config = { lodDistances: { tree: 24 } }
  assert.equal(distance('v3', 'pine', config), Infinity)
  assert.equal(distance('v2', 'pine', config), 28)
  assert.equal(distance('v3', 'oak', config), 24)
})

test('mobile far trunks from oak and broadleaf share one batch without changing their transforms', () => {
  const merged = ast.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations])
    .find(declaration => declaration.name.getText(ast) === 'MobileMergedFarTreeTrunks')
  assert.ok(merged)
  let mergedFrame: ts.Node | undefined
  const findFrame = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFrame') mergedFrame = node.arguments[0]
    ts.forEachChild(node, findFrame)
  }
  findFrame(merged)
  assert.ok(mergedFrame)
  assert.match(merged.getText(ast), /<instancedMesh name="vc:trees"/)
  assert.match(merged.getText(ast), /\.filter\(\(variant\) => variant !== 'pine'\)/)
  assert.match(component!.getText(ast), /!sharedMobileFarTrunks && <instancedMesh ref=\{farTrunkRef\}/)
  const mergedFrameCode = ts.transpileModule(`const frame = ${mergedFrame.getText(ast)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText
  const entries = ([
    ['broadleaf', 10, 5.3], ['oak', 12, 5],
  ] as const).map(([variant, z, baseScale]) => ({
    variant, placement: { position: [0, 0, z], scale: 0.8 }, index: 0, baseScale, lodDistance: 5,
  }))
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial()
  const mesh = new InstancedMesh(geometry, material, entries.length), meshRef = { current: mesh }
  const camera = new PerspectiveCamera(60, 2, .1, 100)
  const visibility = createVirtualChurchTreeVisibility(new Box3(new Vector3(-.1, 0, -.1), new Vector3(.1, 1.1, .1)))
  const scratch = {
    position: new Vector3(), scale: new Vector3(), rotation: new Euler(), quaternion: new Quaternion(),
    root: new Matrix4(), final: new Matrix4(), trunkLocal: new Matrix4().makeTranslation(0, .55, 0),
  }
  const frame = new Function('camera', 'visibility', 'entries', 'scratch', 'meshRef', `${mergedFrameCode}; return frame`)(
    camera, visibility, entries, scratch, meshRef,
  )
  camera.position.set(0, 1, 0); camera.lookAt(0, 1, -10)
  frame({ clock: { elapsedTime: 3.5 } })
  assert.equal(mesh.count, entries.length)
  entries.forEach((entry, index) => {
    const [x, y, z] = entry.placement.position
    const sway = Math.sin(3.5 * .75 + entry.index * 1.73 + x * .08) * .014
    const yaw = ((x * 7 + z * 3) % 11) * .17
    const expected = new Matrix4().compose(new Vector3(x, y, z),
      new Quaternion().setFromEuler(new Euler(sway * .55, yaw, sway)),
      new Vector3().setScalar(entry.baseScale * entry.placement.scale)).multiply(scratch.trunkLocal)
    const actual = new Matrix4(); mesh.getMatrixAt(index, actual)
    for (let element = 0; element < 16; element++) assert.ok(Math.abs(actual.elements[element] - expected.elements[element]) < 1e-5)
  })
  camera.lookAt(0, 1, 10); frame({ clock: { elapsedTime: 3.5 } })
  assert.equal(mesh.count, 0); assert.equal(mesh.visible, false)
  camera.lookAt(0, 1, -10); frame({ clock: { elapsedTime: 3.5 } })
  assert.equal(mesh.count, entries.length); assert.equal(mesh.visible, true)
  mesh.dispose(); geometry.dispose(); material.dispose()
})

test('imported tree materials retain single versus grouped rendering contracts in V2 and V3', () => {
  let sources: ts.Node | undefined
  const findSources = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'sourceMeshes') sources = node
    ts.forEachChild(node, findSources)
  }
  findSources(component!)
  assert.ok(sources)
  const sourceCode = ts.transpileModule(`const ${sources.getText(ast)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText
  const singleGeometry = new BoxGeometry(); singleGeometry.clearGroups()
  const groupedGeometry = new BoxGeometry(); groupedGeometry.clearGroups()
  groupedGeometry.addGroup(0, 18, 0); groupedGeometry.addGroup(18, 18, 1)
  const materials = [new MeshBasicMaterial(), new MeshBasicMaterial()]
  const scene = new Group()
  scene.add(new Mesh(singleGeometry, materials[0]), new Mesh(groupedGeometry, materials))
  for (const visualVersion of ['v2', 'v3']) {
    const prepared = new Function('gltf', 'useMemo', 'Box3', 'Matrix4', 'v3TreeMaterial', 'visualVersion', 'variant',
      `${sourceCode};return sourceMeshes`)(
      { scene }, (fn: () => unknown) => fn(), Box3, Matrix4,
      (material: MeshBasicMaterial) => material.clone(), visualVersion, 'oak',
    )
    assert.equal(prepared.length, 2)
    assert.equal(Array.isArray(prepared[0].material), false,
      'single GLTF primitive has no groups: wrapping its material in an array prevents Three.js from drawing it')
    assert.equal(prepared[0].geometry.groups.length, 0)
    assert.equal(Array.isArray(prepared[1].material), true)
    assert.equal(prepared[1].material.length, 2)
    assert.equal(prepared[1].geometry.groups.length, 2)
    if (visualVersion === 'v3') prepared.forEach((part: { material: MeshBasicMaterial | MeshBasicMaterial[] }) =>
      (Array.isArray(part.material) ? part.material : [part.material]).forEach(m => m.dispose()))
  }
  assert.equal(scene.children[0].visible, true)
  singleGeometry.dispose(); groupedGeometry.dispose(); materials.forEach(m => m.dispose())
})
