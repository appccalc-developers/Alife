import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { Box3, Vector3 } from 'three'
import { createVirtualChurchFoyerCafeEquipmentGeometry, type FoyerCafeEquipmentPart } from '../src/views/virtualChurchFoyerCafeEquipment.ts'

const view = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
const declaration = view.slice(view.indexOf('const foyerServiceEquipment:'), view.indexOf('const foyerServiceInteriorLights:'))
const fixture = ts.transpileModule(`${declaration}\nexport default foyerServiceEquipment`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const items = new Function('foyerServiceX', 'foyerServiceOpening', 'exports', `${fixture}; return exports.default`)(0, { sillY: 1.05 }, {}) as FoyerCafeEquipmentPart[]

test('photo-backed cafe equipment uses one opaque geometry inside its existing shallow anchors', () => {
  const before = JSON.stringify(items)
  const geometry = createVirtualChurchFoyerCafeEquipmentGeometry(items)!
  try {
    assert.equal(JSON.stringify(items), before)
    assert.equal(geometry.groups.length, 0, 'no material groups split the draw')
    assert.equal(geometry.index, null)
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), colors = geometry.getAttribute('color')
    assert.equal(normals.count, positions.count); assert.equal(colors.count, positions.count)
    assert.ok(positions.count / 3 < 2000, `bounded triangles: ${positions.count / 3}`)
    assert.ok(positions.count / 3 > items.length * 12, 'real round profiles, not the previous boxes')
    const oldEnvelope = new Box3()
    for (const item of items) {
      for (const sign of [-1, 1]) oldEnvelope.expandByPoint(new Vector3(...item.position).addScaledVector(new Vector3(...item.scale), sign / 2))
    }
    const tolerance = new Vector3(1e-6, 1e-6, 1e-6)
    assert.ok(oldEnvelope.clone().expandByVector(tolerance).containsBox(geometry.boundingBox!))
    assert.ok(Array.from(positions.array).every(Number.isFinite))
    assert.ok(Array.from(normals.array).every(Number.isFinite))
    assert.ok(Array.from(colors.array).every(value => value >= 0 && value <= 1))
    assert.equal(items.filter(item => item.shape === 'cup').length, 5)
    assert.equal(items.filter(item => item.shape === 'hopper').length, 1)
  } finally { geometry.dispose() }
})

test('cup retains an open inner wall and the merged result belongs to its caller', () => {
  const cup = createVirtualChurchFoyerCafeEquipmentGeometry([{ position: [0, 0, 0], scale: [1, 1, 1], shape: 'cup', color: '#ffffff' }])!
  const positions = cup.getAttribute('position'), normals = cup.getAttribute('normal')
  let inwardNormals = 0
  for (let i = 0; i < positions.count; i++) {
    if (positions.getX(i) * normals.getX(i) + positions.getZ(i) * normals.getZ(i) < -.1) inwardNormals++
  }
  assert.ok(inwardNormals > 12, 'hollow cups are not solid cylinders')
  let disposals = 0
  cup.addEventListener('dispose', () => { disposals++ }); cup.dispose()
  assert.equal(disposals, 1)
  assert.equal(createVirtualChurchFoyerCafeEquipmentGeometry([]), null)
})

test('V3 cafe replacement remains a single lit, texture-free draw with explicit geometry cleanup', () => {
  const ast = ts.createSourceFile('view.tsx', view, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declaration = ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
    .find(d => d.name.getText(ast) === 'FoyerCafeEquipment')
  assert.ok(declaration)
  const component = declaration.getText(ast)
  assert.equal((component.match(/<mesh /g) ?? []).length, 1)
  assert.match(component, /geometry\?\.dispose\(\)/)
  assert.match(component, /meshStandardMaterial vertexColors color="#ffffff" roughness=\{\.55\} metalness=\{\.16\}/)
  assert.doesNotMatch(component, /castShadow|light|map=|Texture|transparent|emissive/)
  assert.match(view, /<FoyerCafeEquipment \/>/)
  assert.doesNotMatch(view, /InstancedBoxSet name="vc:foyer-service-equipment"/)
})
