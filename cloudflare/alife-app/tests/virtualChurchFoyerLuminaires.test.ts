import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { BoxGeometry, Color, CylinderGeometry, Vector3 } from 'three'
import { createVirtualChurchFoyerLuminaireGeometry, createVirtualChurchFoyerWickerGeometry, VIRTUAL_CHURCH_FOYER_WICKER, VIRTUAL_CHURCH_FOYER_PENDANT_SHADE, virtualChurchFoyerPendantRadius } from '../src/views/virtualChurchFoyerLuminaires.ts'

test('photo 10 pendant profile is a slender spindle clear of event flags', () => {
  const shade = VIRTUAL_CHURCH_FOYER_PENDANT_SHADE
  assert.ok(shade.maxRadius * 2 / shade.height < .4)
  assert.ok(Math.abs(virtualChurchFoyerPendantRadius(0) - shade.tipRadius) < 1e-9)
  assert.ok(Math.abs(virtualChurchFoyerPendantRadius(.5) - shade.maxRadius) < 1e-9)
  assert.ok(Math.abs(virtualChurchFoyerPendantRadius(1) - shade.tipRadius) < 1e-9)
  assert.ok(5.16 - shade.height > 3.15 + .4, 'shade must stay above the temporary upper flag line')
})

test('round corridor spots and coloured foyer strips share one unchanged static draw geometry', () => {
  const downlights = [{ position: [0, 2, 0], scale: [.14, .015, .14] }] as const
  const panels = [{ position: [1, 3, 2], scale: [1, .025, .07], color: '#fff1d2' }] as const
  const round = new CylinderGeometry(.5, .5, 1, 12), strip = new BoxGeometry(1, 1, 1)
  const geometry = createVirtualChurchFoyerLuminaireGeometry(downlights, panels)
  try {
    assert.ok(geometry)
    assert.equal(geometry.groups.length, 0)
    assert.equal(geometry.index?.count, round.index!.count + strip.index!.count)
    assert.equal(geometry.getAttribute('position').count, round.getAttribute('position').count + strip.getAttribute('position').count)
    const colors = geometry.getAttribute('color')
    const checkColor = (vertex: number, expected: Color) => {
      assert.ok(Math.abs(colors.getX(vertex) - expected.r) < 1e-6)
      assert.ok(Math.abs(colors.getY(vertex) - expected.g) < 1e-6)
      assert.ok(Math.abs(colors.getZ(vertex) - expected.b) < 1e-6)
    }
    checkColor(0, new Color('#fff3d8'))
    checkColor(round.getAttribute('position').count, new Color('#fff1d2'))
    geometry.computeBoundingBox()
    assert.ok(Math.abs(geometry.boundingBox!.min.x + .07) < 1e-5)
    assert.ok(Math.abs(geometry.boundingBox!.max.x - 1.5) < 1e-5)
    assert.deepEqual(downlights[0].scale, [.14, .015, .14], 'input fixtures stay immutable')
    const again = createVirtualChurchFoyerLuminaireGeometry(downlights, panels)
    try {
      assert.deepEqual(geometry.getAttribute('position').array, again?.getAttribute('position').array)
      assert.deepEqual(colors.array, again?.getAttribute('color').array)
    } finally { again?.dispose() }
  } finally { geometry?.dispose(); round.dispose(); strip.dispose() }
})

test('no fixtures produce no extra mesh', () => {
  assert.equal(createVirtualChurchFoyerLuminaireGeometry([], []), null)
})

test('photo-backed high foyer uses pendants and acoustic ceiling without an invented strip row', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /foyerRouteLights/, 'remove the unsupported two-row luminous strips')
  assert.match(source, /<FoyerWovenPendants \/>/, 'retain the photo-backed woven pendants')
  assert.match(source, /const foyerPendantZ = \[2\.25, 5\.45, 8\.65, 11\.85\]/,
    'the four photographed woven shades must continue along the hall')
  assert.match(source, /const foyerPendantX = foyerRoute\.axisX - 1\.75/,
    'the line belongs just left of the entrance walking axis')
  assert.match(source, /foyerPendantCords[^\n]*foyerPendantX/)
  assert.match(source, /createVirtualChurchFoyerWickerGeometry\(foyerPendantX, foyerPendantZ, foyerPendantCords\)/,
    'cords and wicker must stay aligned')
  assert.match(source, /foyerAcousticCeiling|foyer-acoustic-ceiling/, 'retain the acoustic ceiling surface')
  assert.match(source, /foyerServiceInteriorLights/, 'keep light in the shallow service frontage')
  assert.match(source, /foyerBranchCeilingLights/, 'keep ordinary-height corridor spots')
})

test('continuous wicker stays open, smooth, correctly wound and below the previous four-shade triangle cost', () => {
  const centers = [2.25, 5.45, 8.65, 11.85]
  const cords = centers.map(z => ({ position: [2, 5.54, z], scale: [.012, .72, .012] } as const))
  const geometry = createVirtualChurchFoyerWickerGeometry(2, centers, cords)
  try {
    assert.ok(geometry?.index && geometry.boundingBox && geometry.boundingSphere)
    assert.equal(geometry.groups.length, 0, 'one static material batch')
    const w = VIRTUAL_CHURCH_FOYER_WICKER
    const ribbonVertices = centers.length * 2 * w.strands * (w.sections + 1) * 2
    const ribbonIndices = centers.length * 2 * w.strands * w.sections * 6
    assert.ok(geometry.index.count / 3 < 4 * (20 * 6 + 1) * 12, 'less than the old 480 box bars + 4 cords')
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal')
    for (const attribute of Object.values(geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value))
    const p = new Vector3(), q = new Vector3(), r = new Vector3(), n = new Vector3()
    for (let vertex = 0; vertex < ribbonVertices; vertex++) {
      n.fromBufferAttribute(normal, vertex)
      assert.ok(Math.abs(n.length() - 1) < 1e-6)
    }
    for (let i = 0; i < ribbonIndices; i += 3) {
      p.fromBufferAttribute(position, geometry.index.getX(i))
      q.fromBufferAttribute(position, geometry.index.getX(i + 1))
      r.fromBufferAttribute(position, geometry.index.getX(i + 2))
      n.fromBufferAttribute(normal, geometry.index.getX(i))
      assert.ok(q.sub(p).cross(r.sub(p)).dot(n) > 1e-8, 'nondegenerate outward triangles')
    }
    assert.ok(geometry.boundingBox.min.x > 2 - .27 && geometry.boundingBox.max.x < 2 + .27)
    assert.ok(geometry.boundingBox.min.y > 3.72 && geometry.boundingBox.max.y <= 5.901)
    assert.ok(geometry.boundingBox.min.z > centers[0] - .27 && geometry.boundingBox.max.z < centers[3] + .27)
    // Each strip's paired vertices remain exactly one ribbon width apart.
    for (let i = 0; i < ribbonVertices; i += 2) {
      p.fromBufferAttribute(position, i); q.fromBufferAttribute(position, i + 1)
      assert.ok(Math.abs(p.distanceTo(q) - w.width) < 1e-6)
    }
    const colors = geometry.getAttribute('color'), rgb = new Color(w.color)
    assert.ok(Math.abs(colors.getX(0) - rgb.r) < 1e-6)
    assert.ok(Math.abs(colors.getY(0) - rgb.g) < 1e-6)
    assert.ok(Math.abs(colors.getZ(0) - rgb.b) < 1e-6)
    const again = createVirtualChurchFoyerWickerGeometry(2, centers, cords)
    try { assert.deepEqual(position.array, again?.getAttribute('position').array) } finally { again?.dispose() }
    assert.deepEqual(centers, [2.25, 5.45, 8.65, 11.85], 'input placements unchanged')
  } finally { geometry?.dispose() }
})

test('opposite wicker families separate at crossings and absent pendants add no mesh', () => {
  const geometry = createVirtualChurchFoyerWickerGeometry(0, [0], [])!
  try {
    const w = VIRTUAL_CHURCH_FOYER_WICKER, stride = (w.sections + 1) * 2
    const position = geometry.getAttribute('position')
    const centerRadius = (offset: number) => {
      const x = (position.getX(offset) + position.getX(offset + 1)) / 2
      const z = (position.getZ(offset) + position.getZ(offset + 1)) / 2
      return Math.hypot(x, z)
    }
    assert.ok(Math.abs(Math.abs(centerRadius(0) - centerRadius(w.strands * stride)) - 2 * w.weaveDepth) < 1e-6)
    assert.equal(createVirtualChurchFoyerWickerGeometry(0, [], []), null)
  } finally { geometry.dispose() }
})

test('runtime owns the continuous batch and preserves ordinary lights, with no textures, shadows or animation', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const component = source.slice(source.indexOf('const FoyerWovenPendants ='), source.indexOf('const FOYER_OAK_BASECOLOR'))
  assert.match(component, /useMemo\(\(\) => createVirtualChurchFoyerWickerGeometry/)
  assert.match(component, /useEffect\(\(\) => \(\) => \{ geometry\?\.dispose\(\); material\.dispose\(\) \}, \[geometry, material\]\)/)
  assert.match(component, /name="vc:foyer-woven-pendant-fixtures"/)
  assert.match(component, /useMemo\(createVirtualChurchFoyerWickerMaterial, \[\]\)/)
  assert.match(component, /material=\{material\}/)
  assert.match(component, /geometry\?\.dispose\(\); material\.dispose\(\)/)
  assert.doesNotMatch(component, /useFrame|useLoader|castShadow|receiveShadow|map=/)
})
