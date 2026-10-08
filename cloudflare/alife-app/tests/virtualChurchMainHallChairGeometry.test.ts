import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createMainHallChairSeatGeometry, createMainHallChairBackGeometry, createMainHallChairBackFrameGeometry, createMainHallChairLowBackGeometry, createMainHallChairLowBackFrameGeometry, createMainHallChairLowerFrameGeometry } from '../src/views/virtualChurchMainHallChairGeometry.ts'
import { MAIN_HALL_CHAIR_PARTS, MAIN_HALL_CHAIR_REFERENCE, MAIN_HALL_CHAIRS } from '../src/views/virtualChurchMainHallLayout.ts'

const factories = [createMainHallChairSeatGeometry, createMainHallChairBackGeometry, createMainHallChairBackFrameGeometry]

test('shared chair geometry is deterministic, finite and has smooth unit normals', () => {
  for (const factory of factories) {
    const a = factory()
    const b = factory()
    assert.deepEqual(a.getAttribute('position').array, b.getAttribute('position').array)
    assert.deepEqual(a.getAttribute('normal').array, b.getAttribute('normal').array)
    const positions = a.getAttribute('position')
    const normals = a.getAttribute('normal')
    assert.ok(a.boundingBox && a.boundingSphere)
    for (let i = 0; i < positions.count; i++) {
      assert.ok([positions.getX(i), positions.getY(i), positions.getZ(i)].every(Number.isFinite))
      assert.ok(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < .00001)
    }
    a.dispose()
    b.dispose()
  }
})

test('cushions retain seat height, back crown and supplier-sized placement bounds', () => {
  const seat = createMainHallChairSeatGeometry()
  const back = createMainHallChairBackGeometry()
  const parts = MAIN_HALL_CHAIR_PARTS
  const bounds = (geometry: typeof seat, part: typeof parts.seat) => {
    const box = geometry.boundingBox!
    return {
      minX: box.min.x * part.width, maxX: box.max.x * part.width,
      minY: box.min.y * part.height + part.y, maxY: box.max.y * part.height + part.y,
      minZ: box.min.z * part.depth + part.z, maxZ: box.max.z * part.depth + part.z,
    }
  }
  const s = bounds(seat, parts.seat)
  const b = bounds(back, parts.back)
  assert.ok(Math.abs(s.maxY - MAIN_HALL_CHAIR_REFERENCE.seatHeight) < .002)
  assert.ok(Math.abs(b.maxY - MAIN_HALL_CHAIR_REFERENCE.height) < .00001)
  assert.ok(b.minY > s.maxY && b.minY - s.maxY < .025)
  assert.ok(s.maxX - s.minX <= MAIN_HALL_CHAIR_REFERENCE.width)
  assert.ok(b.maxX - b.minX <= MAIN_HALL_CHAIR_REFERENCE.width)
  assert.ok(b.maxZ - s.minZ <= MAIN_HALL_CHAIR_REFERENCE.depth + .001)
  seat.dispose()
  back.dispose()
})

test('back pad bows and tapers while seat top edges soften without raised seating', () => {
  const seatBox = new RoundedBoxGeometry(1, 1, 1, 1, .14)
  const back = createMainHallChairBackGeometry()
  const seat = createMainHallChairSeatGeometry()
  const b = back.getAttribute('position')
  const s = seat.getAttribute('position')
  let bow = 0
  let taper = 0
  let softTop = 0
  for (let i = 0; i < b.count; i++) {
    if (Math.abs(b.getX(i)) < .1 && b.getZ(i) < -.60) bow++
    if (b.getY(i) < -.2 && Math.abs(b.getX(i)) > .4 && Math.abs(b.getX(i)) < .49) taper++
  }
  const seatSource = seatBox.getAttribute('position')
  for (let i = 0; i < seatSource.count; i++) {
    if (seatSource.getY(i) > .2 && s.getY(i) < seatSource.getY(i) - .005) softTop++
    assert.ok(s.getY(i) <= seatSource.getY(i) + .000001)
  }
  assert.ok(bow > 0 && taper > 0 && softTop > 0)
  seatBox.dispose()
  seat.dispose()
  back.dispose()
})

test('curved back grid has real surface triangles rather than collapsed inner fillet vertices', () => {
  const back = createMainHallChairBackGeometry()
  const p = back.getAttribute('position')
  const indices = back.index!
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i)
    const b = indices.getX(i + 1)
    const c = indices.getX(i + 2)
    const u = [p.getX(b) - p.getX(a), p.getY(b) - p.getY(a), p.getZ(b) - p.getZ(a)]
    const v = [p.getX(c) - p.getX(a), p.getY(c) - p.getY(a), p.getZ(c) - p.getZ(a)]
    assert.ok(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > .000001)
  }
  back.dispose()
})

test('bent rear frame stays within each chair and uses one shared low-segment tube', () => {
  const frame = createMainHallChairBackFrameGeometry()
  const bounds = frame.boundingBox!
  assert.ok(bounds.max.x - bounds.min.x <= MAIN_HALL_CHAIR_REFERENCE.width)
  assert.ok(bounds.max.y + MAIN_HALL_CHAIR_PARTS.back.y < MAIN_HALL_CHAIR_REFERENCE.height)
  assert.ok(bounds.min.y + MAIN_HALL_CHAIR_PARTS.back.y > .45)
  assert.ok(bounds.min.z > .02 && bounds.max.z < MAIN_HALL_CHAIR_PARTS.back.depth / 2)
  // Preserve the existing conservative walk envelope after the rearward tilt.
  const p = frame.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const rear = p.getY(i) * Math.sin(-.065) + p.getZ(i) * Math.cos(-.065)
    assert.ok(rear <= MAIN_HALL_CHAIR_PARTS.back.depth / 2 + .01)
  }
  assert.equal(frame.index!.count / 3, 216)
  frame.dispose()
})

test('chair replacement reduces instanced triangle load without adding a chair draw batch', () => {
  const old = new RoundedBoxGeometry(1, 1, 1, 2, .16)
  const oldPerChair = old.getAttribute('position').count / 3 * 3 + 2 * 12
  const owned = factories.map(factory => factory())
  const newPerChair = owned.reduce((sum, geometry) => sum + (geometry.index?.count ?? geometry.getAttribute('position').count) / 3, 0)
  assert.equal(oldPerChair, 924)
  assert.equal(newPerChair, 580)
  assert.equal((oldPerChair - newPerChair) * MAIN_HALL_CHAIRS.length, 123840)
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /useMemo\(\(\) => geometryFactory\?\.\(\) \?\? null, \[geometryFactory\]\)/)
  assert.match(hall, /useEffect\(\(\) => \(\) => geometry\?\.dispose\(\), \[geometry\]\)/)
  assert.equal((hall.match(/name="main-hall-chair-(?:back-frames|seats|backs|linked-frames)"/g) ?? []).length, 4)
  assert.doesNotMatch(hall, /lowerBacks|main-hall-chair-lower-backs|TextureLoader|useLoader/)
  owned.forEach(geometry => geometry.dispose())
  old.dispose()
})

test('mobile chairs retain curved cushions, frame clearance and finite normals with fewer subdivisions', () => {
  const high = createMainHallChairBackGeometry()
  const low = createMainHallChairLowBackGeometry()
  const frame = createMainHallChairLowBackFrameGeometry()
  const seat = createMainHallChairSeatGeometry()
  assert.equal(low.index!.count / 3, 104)
  assert.equal(frame.index!.count / 3, 120)
  assert.equal((seat.getAttribute('position').count / 3 + low.index!.count / 3 + frame.index!.count / 3) * MAIN_HALL_CHAIRS.length, 119520)
  for (const axis of ['x', 'y', 'z'] as const) {
    assert.ok(Math.abs(high.boundingBox!.min[axis] - low.boundingBox!.min[axis]) < .02)
    assert.ok(Math.abs(high.boundingBox!.max[axis] - low.boundingBox!.max[axis]) < .02)
  }
  let bow = 0
  for (const geometry of [low, frame]) {
    const p = geometry.getAttribute('position')
    const n = geometry.getAttribute('normal')
    for (let i = 0; i < p.count; i++) {
      assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite))
      assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < .00001)
      if (geometry === low && Math.abs(p.getX(i)) < .1 && p.getZ(i) < -.6) bow++
      if (geometry === frame) {
        assert.ok(p.getY(i) * Math.sin(-.065) + p.getZ(i) * Math.cos(-.065) <= MAIN_HALL_CHAIR_PARTS.back.depth / 2 + .01)
      }
    }
  }
  assert.ok(bow > 0, 'Low retains a real back curve instead of reverting to a flat placeholder')
  for (const geometry of [high, low, frame, seat]) geometry.dispose()
})

test('main hall borrows one stable shared preset without continuous rendering or false FPS reporting', () => {
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /useState\(\(\) => getPerformanceConfig\(\)\)/)
  assert.match(hall, /dpr=\{\[1, performancePreset\.maxDevicePixelRatio\]\}/)
  assert.match(hall, /lowDetail=\{performancePreset\.isMobile\}/)
  assert.match(hall, /geometryFactory=\{lowDetail \? createMainHallChairLowBackGeometry : createMainHallChairBackGeometry\}/)
  assert.match(hall, /geometryFactory=\{lowDetail \? createMainHallChairLowBackFrameGeometry : createMainHallChairBackFrameGeometry\}/)
  assert.match(hall, /\{budgetDiagnostic \? <HallBudgetProbe/)
  assert.match(hall, /kind: 'scene-cost-only'/)
  assert.match(hall, /removeAttribute\('data-main-hall-budget'\)/)
  assert.match(hall, /<Canvas shadows="percentage" frameloop="demand"/)
  assert.doesNotMatch(hall, /averageFps|frameCount|data-virtual-church-profile/)
})

test('connected lower frame has four splayed feet and two under-seat rails inside existing clearances', () => {
  const a = createMainHallChairLowerFrameGeometry()
  const b = createMainHallChairLowerFrameGeometry()
  assert.deepEqual(a.getAttribute('position').array, b.getAttribute('position').array)
  assert.equal(a.index!.count / 3, 72)
  assert.equal(a.groups.length, 0, 'one opaque instance batch, not six material groups')
  const bounds = a.boundingBox!
  assert.ok(bounds.min.y > .005 && bounds.min.y < .022)
  assert.ok(bounds.max.y < MAIN_HALL_CHAIR_REFERENCE.seatHeight)
  assert.ok(bounds.max.x - bounds.min.x <= MAIN_HALL_CHAIR_REFERENCE.width)
  assert.ok(bounds.min.z >= -.285 && bounds.max.z <= .27)
  // Each original BoxGeometry contributes 24 vertices, 36 indices. The front
  // and rear feet splay outwards; each side's third tube joins the leg tops.
  const p = a.getAttribute('position')
  const n = a.getAttribute('normal')
  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? -1 : 1
    for (let leg = 0; leg < 2; leg++) {
      const start = (side * 3 + leg) * 24
      const bottomXs: number[] = [], topXs: number[] = []
      for (let i = start; i < start + 24; i++) {
        if (p.getY(i) < .06) bottomXs.push(sign * p.getX(i))
        if (p.getY(i) > .34) topXs.push(sign * p.getX(i))
      }
      const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
      assert.ok(bottomXs.length && topXs.length)
      assert.ok(mean(bottomXs) > mean(topXs) + .01)
    }
    for (let i = (side * 3 + 2) * 24; i < (side * 3 + 3) * 24; i++) {
      assert.ok(p.getY(i) > .35 && p.getY(i) < .4)
    }
  }
  for (let i = 0; i < p.count; i++) {
    assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite))
    assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < .00001)
  }
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /const chairLegs: Placement\[\] = MAIN_HALL_CHAIRS\.map/)
  assert.match(hall, /position: \[chair\.x, 0, chair\.z\], scale: \[1, 1, 1\], yaw: chair\.yaw/)
  assert.match(hall, /name="main-hall-chair-legs"[^\n]*geometryFactory=\{createMainHallChairLowerFrameGeometry\}/)
  assert.equal((72 - 4 * 12) * MAIN_HALL_CHAIRS.length, 8640)
  a.dispose(); b.dispose()
})
