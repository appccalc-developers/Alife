import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { BoxGeometry, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { VIRTUAL_CHURCH_FOYER_CIRCULATION as route } from '../src/views/virtualChurchInteractionContract.ts'
import { createVirtualChurchFoyerWelcomeArrangement, createVirtualChurchFoyerWoodworkGeometry, type FoyerWelcomePart } from '../src/views/virtualChurchFoyerWelcome.ts'

test('merged box woodwork preserves the former instance position, XYZ rotation, scale and colour', () => {
  const items: FoyerWelcomePart[] = [
    { position: [3, .6, -2], scale: [.03, 1.2, .5], rotation: [.2, -.6, .1], color: '#75604b' },
    { position: [-2, .1, 4], scale: [1.55, .065, .64], color: '#f4efe2' },
    { position: [1, 2, 3], scale: [.2, .03, .5], rotation: [0, .16, 0] },
  ]
  const before = JSON.stringify(items), merged = createVirtualChurchFoyerWoodworkGeometry(items)!
  const box = new BoxGeometry(1, 1, 1).toNonIndexed()
  try {
    assert.equal(JSON.stringify(items), before)
    assert.equal(merged.groups.length, 0); assert.equal(merged.index, null)
    const actual = merged.getAttribute('position'), source = box.getAttribute('position'), colors = merged.getAttribute('color')
    for (const [index, item] of items.entries()) {
      const matrix = new Matrix4().compose(new Vector3(...item.position), new Quaternion().setFromEuler(new Euler(...(item.rotation ?? [0, 0, 0]))), new Vector3(...item.scale))
      const rgb = new Color(item.color ?? '#ffffff')
      for (let vertex = 0; vertex < source.count; vertex++) {
        const offset = index * source.count + vertex, expected = new Vector3().fromBufferAttribute(source, vertex).applyMatrix4(matrix)
        assert.ok(expected.distanceTo(new Vector3().fromBufferAttribute(actual, offset)) < 1e-6)
        assert.ok(Math.abs(colors.getX(offset) - rgb.r) < 1e-6)
        assert.ok(Math.abs(colors.getY(offset) - rgb.g) < 1e-6)
        assert.ok(Math.abs(colors.getZ(offset) - rgb.b) < 1e-6)
      }
    }
  } finally { merged.dispose(); box.dispose() }
})

test('photo-backed vase, three curved stems and nine modest blooms stay inside the existing tabletop', () => {
  const table = route.welcomeTable, before = JSON.stringify(table), topY = .78
  const parts = createVirtualChurchFoyerWelcomeArrangement(table, topY)
  assert.equal(parts.filter(p => p.shape === 'vase').length, 1)
  assert.equal(parts.filter(p => p.shape === 'stem').length, 3)
  assert.equal(parts.filter(p => p.shape === 'leaf').length, 6)
  assert.equal(parts.filter(p => p.shape === 'petal').length, 54)
  const firstPetal = parts.find(p => p.shape === 'petal')!
  assert.ok(firstPetal.scale[1] > firstPetal.scale[2], 'flowers show a face to the walking view, not only a horizontal edge')
  const geometry = createVirtualChurchFoyerWoodworkGeometry(parts)!
  try {
    assert.equal(JSON.stringify(table), before)
    const position = geometry.getAttribute('position')
    assert.ok(position.count / 3 < 1900, 'bounded geometric detail, not dozens of extra draws')
    for (let i = 0; i < position.count; i++) {
      assert.ok(Math.abs(position.getX(i) - table.x) < .775)
      assert.ok(Math.abs(position.getZ(i) - table.z) < .32)
      assert.ok(position.getY(i) >= topY + .0325 - 1e-6, 'vase rests on the existing upper surface')
      assert.ok(position.getY(i) < topY + .74)
    }
    for (const attribute of Object.values(geometry.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite))
    assert.ok(geometry.boundingBox && geometry.boundingSphere)
  } finally { geometry.dispose() }
})

test('rounded top preserves the table bounds and the curved stem is not a straight box', () => {
  const top = createVirtualChurchFoyerWoodworkGeometry([{ position: [0, .78, 0], scale: [1.55, .065, .64], shape: 'rounded' }])!
  const stem = createVirtualChurchFoyerWoodworkGeometry([{ position: [0, 0, 0], scale: [1, 1, 1], shape: 'stem' }])!
  try {
    assert.ok(Math.abs(top.boundingBox!.min.x + .775) < 1e-6)
    assert.ok(Math.abs(top.boundingBox!.max.y - .8125) < 1e-6)
    assert.ok(stem.boundingBox!.min.x < -.23 && stem.boundingBox!.max.x > .025)
    const normals = stem.getAttribute('normal')
    assert.ok(Array.from(normals.array).every(Number.isFinite))
  } finally { top.dispose(); stem.dispose() }
})

test('static welcome output is independently owned, reproducible, and empty woodwork allocates nothing', () => {
  const parts = createVirtualChurchFoyerWelcomeArrangement(route.welcomeTable, .78)
  assert.deepEqual(parts, createVirtualChurchFoyerWelcomeArrangement(route.welcomeTable, .78))
  const first = createVirtualChurchFoyerWoodworkGeometry(parts)!, second = createVirtualChurchFoyerWoodworkGeometry(parts)!
  try {
    assert.notEqual(first, second)
    for (const name of ['position', 'normal', 'color', 'uv']) assert.deepEqual(first.getAttribute(name).array, second.getAttribute(name).array)
    assert.equal(createVirtualChurchFoyerWoodworkGeometry([]), null)
  } finally { first.dispose(); second.dispose() }
})

test('welcome details retain one opaque woodwork draw, unchanged brochure stacks and foyer distance gate', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const component = source.slice(source.indexOf('const FoyerWoodwork ='), source.indexOf('const FoyerCirculationLayer ='))
  assert.equal((component.match(/<mesh\b/g) ?? []).length, 1)
  assert.match(component, /createVirtualChurchFoyerWoodworkGeometry\(foyerWoodwork\)/)
  assert.match(component, /geometry\?\.dispose\(\)/)
  assert.doesNotMatch(component, /useFrame|Texture|Light|transparent|castShadow|receiveShadow/)
  assert.match(component, /vertexColors color="#ffffff" roughness=\{\.8\}/)
  assert.match(source, /const welcomeTable = foyerRoute.welcomeTable/)
  assert.match(source, /createVirtualChurchFoyerWelcomeArrangement\(welcomeTable, welcomeTableTopY\)/)
  assert.match(source, /const foyerWelcomeBrochures: BoxInstance\[\] = \[-\.45, -\.08, \.3\]/)
  assert.match(source, /foyerWelcomeTableFrame\.slice\(1\)\.map/)
  assert.match(source, /<FoyerWoodwork \/>/)
  assert.doesNotMatch(source, /<InstancedBoxSet name="vc:foyer-woodwork"/)
  assert.match(source, /virtualChurchShouldRenderFoyerDetail\(/)
})
