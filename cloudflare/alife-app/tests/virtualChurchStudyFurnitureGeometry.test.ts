import { readLocalizedSource } from './helpers/readLocalizedSource.cjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Box3, Vector3, type BufferGeometry } from 'three'
import { createStudyFurnitureGeometry } from '../src/views/virtualChurchStudyFurnitureGeometry.ts'
import { buildStudyFurnitureBatches } from '../src/views/virtualChurchStudyFurniture.ts'

const triangles = (geometry: BufferGeometry) => (geometry.index?.count ?? geometry.getAttribute('position').count) / 3
const bytes = (geometry: BufferGeometry) => Object.values(geometry.attributes).reduce((total, attribute) => total + attribute.array.byteLength, geometry.index?.array.byteLength ?? 0)
const close = (actual: number, expected: number, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)

test('rounded original chair and turned table stay within the existing seating/room envelope', () => {
  for (const lowDetail of [false, true]) {
    const parts = createStudyFurnitureGeometry(lowDetail)
    const cushion = parts.cushions.boundingBox!
    close(cushion.min.x, -.285); close(cushion.max.x, .285)
    close(cushion.min.y, .445)
    assert.ok(cushion.max.y >= 1.13 && cushion.max.y <= 1.15)
    assert.ok(cushion.min.z >= -.29 && cushion.max.z <= .266)
    for (const part of [parts.tabletop, parts.pedestal]) assert.ok(part.boundingSphere!.radius > 0)
    close(parts.tabletop.boundingBox!.min.y, -.045); close(parts.tabletop.boundingBox!.max.y, .045)
    close(parts.tabletop.boundingBox!.max.x, .96)
    close(parts.pedestal.boundingBox!.min.y, -.325); close(parts.pedestal.boundingBox!.max.y, .325)
    close(parts.pedestal.boundingBox!.max.x, .24)
    Object.values(parts).forEach(part => part.dispose())
  }
})

test('geometry attributes are finite and normals stay unit length after the chair wrap', () => {
  for (const lowDetail of [false, true]) {
    const parts = createStudyFurnitureGeometry(lowDetail)
    for (const part of Object.values(parts)) {
      for (const attribute of Object.values(part.attributes)) assert.ok([...attribute.array].every(Number.isFinite))
      const normal = part.getAttribute('normal'), vector = new Vector3()
      for (let index = 0; index < normal.count; index++) {
        vector.fromBufferAttribute(normal, index)
        close(vector.length(), 1, 1e-5)
      }
    }
    Object.values(parts).forEach(part => part.dispose())
  }
})

test('Low keeps the rounded silhouettes with fewer triangles; furniture still uses seven opaque draws', () => {
  const high = createStudyFurnitureGeometry(), low = createStudyFurnitureGeometry(true)
  for (const overview of [false, true]) {
    const count = overview ? 6 : 5
    const cost = (parts: ReturnType<typeof createStudyFurnitureGeometry>) => triangles(parts.cushions) * count + triangles(parts.legs) * 4 * count + triangles(parts.tabletop) + triangles(parts.pedestal)
    assert.ok(cost(low) < cost(high) * .65)
    assert.ok(cost(high) < 9000 && cost(low) < 5000)
    const batches = buildStudyFurnitureBatches([], overview)
    assert.equal(batches.length + 2, 7, 'five furniture batches and two table surfaces, unchanged')
    assert.equal(batches[0].matrices.length, count)
    assert.equal(batches[1].matrices.length, count * 4)
    const roomBounds = new Box3()
    for (const matrix of batches[0].matrices) roomBounds.union(high.cushions.boundingBox!.clone().applyMatrix4(matrix))
    assert.ok(roomBounds.min.x > -3.6 && roomBounds.max.x < 3.6)
  }
  assert.ok(Object.values(low).reduce((sum, part) => sum + bytes(part), 0) < Object.values(high).reduce((sum, part) => sum + bytes(part), 0))
  Object.values(high).forEach(part => part.dispose()); Object.values(low).forEach(part => part.dispose())
})

test('returned buffers are separately owned, disposable, and never alias another visit', () => {
  const first = createStudyFurnitureGeometry(), second = createStudyFurnitureGeometry()
  let released = 0
  for (const key of ['cushions', 'legs', 'tabletop', 'pedestal'] as const) {
    assert.notEqual(first[key], second[key])
    const attribute = first[key].getAttribute('position'), other = second[key].getAttribute('position')
    assert.notEqual(attribute.array, other.array)
    const previous = other.getX(0); attribute.setX(0, 999); close(other.getX(0), previous)
    first[key].addEventListener('dispose', () => released++)
    first[key].dispose(); second[key].dispose()
  }
  assert.equal(released, 4)
})

test('room geometry is visit-stable, shared, explicitly retired, and adds no continuous rendering or media', () => {
  const source = readLocalizedSource(new URL('../src/views/VirtualChurchStudyRoomView.tsx', import.meta.url))
  assert.match(source, /useMemo\(\(\) => createStudyFurnitureGeometry\(lowDetail\), \[lowDetail\]\)/)
  assert.match(source, /Object.values\(geometry\).forEach\(part => part.dispose\(\)\)/)
  assert.match(source, /\[performancePreset\] = useState\(\(\) => getPerformanceConfig\(\)\)/)
  assert.match(source, /lowDetail=\{performancePreset.isMobile\}/)
  assert.match(source, /<primitive object=\{geometry\} attach="geometry" dispose=\{null\}/)
  assert.match(source, /frameloop="demand"/)
  assert.match(source, /has\('profile3d'\)/)
  assert.match(source, /\{budgetDiagnostic \? <StudyBudgetProbe/)
  assert.match(source, /return \(\) => page\?\.removeAttribute\('data-study-room-budget'\)/)
  const geometry = readFileSync(new URL('../src/views/virtualChurchStudyFurnitureGeometry.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(geometry, /Texture|Loader|fetch\(|useFrame|requestAnimationFrame/)
  assert.match(geometry, /finally[\s\S]*temporaries.forEach\(geometry => geometry.dispose\(\)\)/)
})
