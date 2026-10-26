import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { BoxGeometry, Color, InstancedMesh, Matrix3, Matrix4, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { VIRTUAL_CHURCH_AUXILIARY_BUILDING } from '../src/views/virtualChurchInteractionContract.ts'

const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const declaration = ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
  .find(d => d.name.getText(ast) === 'WindowBand')
assert.ok(declaration)
const code = ts.transpileModule(`const ${declaration.getText(ast)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.React, jsxFactory: 'createElement' },
}).outputText

test('window instances retain every original pane transform, vertex and physical material', () => {
  const ref: { current: InstancedMesh | null } = { current: null }
  let layout = () => {}
  const render = new Function('useRef', 'useLayoutEffect', 'Object3D', 'createElement', `${code};return WindowBand`)(
    () => ref, (callback: () => void) => { layout = callback }, Object3D,
    (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }),
  )
  const cases = [
    { start: VIRTUAL_CHURCH_AUXILIARY_BUILDING[0], end: VIRTUAL_CHURCH_AUXILIARY_BUILDING[1], y: 2.65, count: 5, offset: [0, 0], color: '#3e5a5e' },
    { start: [3, 4], end: [-3, -4], y: 1.45, count: 7, offset: [0.3, -0.2], color: '#30474a' },
    { start: [0, 0], end: [1, 0], y: 1, count: 1, offset: [0, 0], color: '#ffffff' },
    { start: [0, 0], end: [1, 0], y: 1, count: 0, offset: [0, 0], color: '#ffffff' },
  ]
  for (const props of cases) {
    const tree = render(props)
    assert.equal(tree.type, 'instancedMesh')
    assert.equal(tree.props.args[2], props.count)
    assert.equal(tree.children[1].type, 'meshPhysicalMaterial')
    assert.deepEqual(tree.children[1].props, { color: props.color, roughness: 0.2, metalness: 0.28, clearcoat: 0.25 })
    const [width, height, depth] = tree.children[0].props.args
    const dx = props.end[0] - props.start[0], dz = props.end[1] - props.start[1]
    assert.deepEqual([width, height, depth], [Math.min(1.15, Math.hypot(dx, dz) / (props.count + 1)), 1.95, 0.36])
    const geometry = new BoxGeometry(width, height, depth)
    const material = new MeshPhysicalMaterial(tree.children[1].props)
    const mesh = new InstancedMesh(geometry, material, props.count)
    ref.current = mesh
    layout()
    assert.equal(mesh.castShadow, false)
    assert.equal(mesh.receiveShadow, false)
    assert.equal(mesh.count, props.count)
    for (let i = 0; i < props.count; i++) {
      const expected = new Object3D()
      const t = (i + 1) / (props.count + 1)
      expected.position.set(props.start[0] + dx * t + props.offset[0], props.y, props.start[1] + dz * t + props.offset[1])
      expected.rotation.y = -Math.atan2(dz, dx)
      expected.updateMatrix()
      const actual = new Matrix4()
      mesh.getMatrixAt(i, actual)
      for (let v = 0; v < geometry.attributes.position.count; v++) {
        const original = new Vector3().fromBufferAttribute(geometry.attributes.position, v).applyMatrix4(expected.matrix)
        const instanced = new Vector3().fromBufferAttribute(geometry.attributes.position, v).applyMatrix4(actual)
        assert.ok(original.distanceTo(instanced) < 1e-5)
        assert.ok(mesh.boundingBox!.containsPoint(instanced), 'bounds enclose every moved pane')
      }
    }
    if (props.count > 0) {
      const oldCenter = mesh.boundingSphere!.center.clone()
      render({ ...props, offset: [100, 100] })
      layout()
      assert.ok(mesh.boundingSphere!.center.distanceTo(oldCenter) > 100, 'bounds refresh on relocation')
    }
    mesh.dispose(); geometry.dispose(); material.dispose()
  }
})

test('V3 street fins use one opaque batch with all twelve authored silhouettes and material settings', () => {
  const declarations: ts.VariableDeclaration[] = []
  const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node)) declarations.push(node); ts.forEachChild(node, visit) }
  visit(ast)
  const fins = declarations.find(d => d.name.getText(ast) === 'streetFins')!
  const boxSet = declarations.find(d => d.name.getText(ast) === 'InstancedBoxSet')!
  assert.ok(fins?.initializer && boxSet?.initializer)
  const transpile = (input: string) => ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.React, jsxFactory: 'createElement' },
  }).outputText
  const createFins = new Function('streetInsetStart', 'streetFacadeEnd', 'streetFinOffset', 'streetAngle', 'roofHeightAtVertex',
    transpile(`return ${fins.initializer.getText(ast)}`))
  const ref: { current: InstancedMesh | null } = { current: null }
  let layout = () => {}
  const render = new Function('useRef', 'useMemo', 'useEffect', 'useLayoutEffect', 'Object3D', 'Color', 'createElement',
    `${transpile(`const ${boxSet.getText(ast)}`)};return InstancedBoxSet`)(
    () => ref, (factory: () => unknown) => factory(), () => {}, (callback: () => void) => { layout = callback }, Object3D, Color,
    (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }),
  )
  const selected: ts.JsxSelfClosingElement[] = []
  const findFins = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'InstancedBoxSet'
      && node.attributes.getText(ast).includes('items={streetFins}')) selected.push(node)
    ts.forEachChild(node, findFins)
  }
  findFins(ast)
  assert.equal(selected.length, 1)
  assert.match(selected[0].getText(ast), /color="#1a1e20" roughness=\{0\.42\} metalness=\{0\.60\}/)
  assert.match(source, /visualVersion === 'v3' \? \(\s*<InstancedBoxSet items=\{streetFins\}/)
  assert.match(source, /\) : streetFins\.map/)
  for (const angle of [0, .81, -1.73]) {
    const start = [-18, 12], end = [9, 29], offset = [.4, -.6]
    const roof = ([x, z]: number[]) => 10.8 + x * .03 - z * .01
    const items = createFins(start, end, offset, angle, roof)
    assert.equal(items.length, 12)
    const tree = render({ items, color: '#1a1e20', roughness: .42, metalness: .60 })
    assert.equal(tree.type, 'instancedMesh'); assert.equal(tree.props.args[2], 12)
    assert.equal(tree.props.castShadow, false); assert.equal(tree.props.receiveShadow, false)
    assert.equal(tree.children[1].type, 'meshStandardMaterial')
    const material = new MeshStandardMaterial(Object.fromEntries(Object.entries(tree.children[1].props).filter(([, value]) => value !== undefined)))
    assert.equal(material.transparent, false); assert.equal(material.roughness, .42); assert.equal(material.metalness, .60)
    const unit = new BoxGeometry(...tree.children[0].props.args as [number, number, number])
    const mesh = new InstancedMesh(unit, material, 12); ref.current = mesh; layout()
    assert.equal(unit.index!.count / 3 * mesh.count, 144)
    for (let i = 0; i < 12; i++) {
      const t = (i + .5) / 12, x = start[0] + (end[0] - start[0]) * t + offset[0], z = start[1] + (end[1] - start[1]) * t + offset[1]
      const height = roof([x, z]) - .3
      const original = new BoxGeometry(.18, height, 1.05), transform = new Object3D()
      transform.position.set(x, height / 2, z); transform.rotation.y = angle; transform.updateMatrix()
      const matrix = new Matrix4(); mesh.getMatrixAt(i, matrix)
      const originalNormals = new Matrix3().getNormalMatrix(transform.matrix), instanceNormals = new Matrix3().getNormalMatrix(matrix)
      for (let v = 0; v < unit.attributes.position.count; v++) {
        const expected = new Vector3().fromBufferAttribute(original.attributes.position, v).applyMatrix4(transform.matrix)
        const actual = new Vector3().fromBufferAttribute(unit.attributes.position, v).applyMatrix4(matrix)
        assert.ok(expected.distanceTo(actual) < 3e-6)
        const expectedNormal = new Vector3().fromBufferAttribute(original.attributes.normal, v).applyNormalMatrix(originalNormals)
        const actualNormal = new Vector3().fromBufferAttribute(unit.attributes.normal, v).applyNormalMatrix(instanceNormals)
        assert.ok(expectedNormal.distanceTo(actualNormal) < 1e-6)
        assert.equal(unit.attributes.uv.getX(v), original.attributes.uv.getX(v))
        assert.equal(unit.attributes.uv.getY(v), original.attributes.uv.getY(v))
        assert.ok(actual.distanceTo(mesh.boundingSphere!.center) <= mesh.boundingSphere!.radius + 1e-6)
      }
      original.dispose()
    }
    mesh.dispose(); unit.dispose(); material.dispose()
  }
})
