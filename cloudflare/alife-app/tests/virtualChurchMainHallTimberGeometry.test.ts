import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { Color, Vector3 } from 'three'
import { createMainHallTimberGeometry } from '../src/views/virtualChurchMainHallTimberGeometry.ts'
import { MAIN_HALL_TIMBER_APPEARANCE } from '../src/views/virtualChurchMainHallMaterials.ts'

test('bounded shared chamfer retains the original unit-slat envelope, outward normals and longitudinal UVs', () => {
  const geometry = createMainHallTimberGeometry()
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv')
  assert.equal(position.count / 3, 28)
  assert.deepEqual(geometry.boundingBox!.min.toArray(), [-.5, -.5, -.5])
  assert.deepEqual(geometry.boundingBox!.max.toArray(), [.5, .5, .5])
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), face = new Vector3(), centre = new Vector3()
  for (let index = 0; index < position.count; index += 3) {
    a.fromBufferAttribute(position, index); b.fromBufferAttribute(position, index + 1); c.fromBufferAttribute(position, index + 2)
    face.copy(b).sub(a).cross(c.clone().sub(a))
    assert.ok(face.length() > .001, 'no degenerate cap/facet')
    centre.copy(a).add(b).add(c).divideScalar(3)
    assert.ok(face.dot(centre) > 0, 'outward winding keeps the visible inner-wall faces')
  }
  for (let index = 0; index < position.count; index++) {
    const n = new Vector3().fromBufferAttribute(normal, index)
    assert.ok(Math.abs(n.length() - 1) < 1e-6)
    assert.ok(uv.getX(index) >= 0 && uv.getX(index) <= 1 && uv.getY(index) >= 0 && uv.getY(index) <= 1)
    if (index < 48) assert.equal(uv.getY(index), position.getY(index) + .5)
  }
  const second = createMainHallTimberGeometry()
  assert.notEqual(second, geometry, 'each mounted batch owns its disposable geometry')
  let disposed = 0
  geometry.addEventListener('dispose', () => { disposed++ })
  geometry.dispose(); second.dispose()
  assert.equal(disposed, 1)
})

test('existing timber draws and backing keep Standard shading without emissive panels, assets or new batches', () => {
  const look = MAIN_HALL_TIMBER_APPEARANCE
  assert.ok(Object.isFrozen(look))
  const luminance = (hex: string) => { const c = new Color(hex); return c.r * .2126 + c.g * .7152 + c.b * .0722 }
  assert.ok(luminance(look.backing) < luminance(look.side) / 4)
  assert.ok(look.roughness >= .8 && look.roughness <= 1)
  const source = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  const slats = [...source.matchAll(/<Instances name="main-hall-(?:side|back)-slatting"[^\n]+/g)]
  assert.equal(slats.length, 2)
  for (const [line] of slats) assert.match(line, /geometryFactory=\{createMainHallTimberGeometry\} timber receiveShadow/)
  const rear = source.split('name="main-hall-rear-acoustic-wall"')[1].split('</mesh>')[0]
  assert.match(rear, /color=\{MAIN_HALL_TIMBER_APPEARANCE.backing\}/)
  assert.doesNotMatch(rear, /emissive|meshBasicMaterial/)
  assert.match(source, /useEffect\(\(\) => \(\) => geometry\?\.dispose\(\), \[geometry\]\)/)
  // Only geometry/materials changed. Layout, light transport and frame cadence stay separate.
})
