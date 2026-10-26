import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { Vector3 } from 'three'
import { createMainHallStageEquipmentGeometry, MAIN_HALL_STAGE_EQUIPMENT_ANCHORS } from '../src/views/virtualChurchMainHallStageEquipment.ts'
import { MAIN_HALL_CAMERA, MAIN_HALL_DIMENSIONS } from '../src/views/virtualChurchMainHallLayout.ts'

test('original equipment buffers are opaque two-batch geometry with finite unit normals and colors', () => {
  for (const low of [false, true]) {
    const result = createMainHallStageEquipmentGeometry(low)
    assert.deepEqual(Object.keys(result), ['surfaces','hardware'])
    try {
      for (const geometry of Object.values(result)) {
        assert.equal(geometry.index, null)
        assert.equal(geometry.groups.length, 0)
        const p = geometry.getAttribute('position')
        const n = geometry.getAttribute('normal')
        const c = geometry.getAttribute('color')
        assert.equal(p.count,n.count); assert.equal(p.count,c.count)
        for (let i = 0; i < p.count; i++) {
          assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite))
          assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.001)
          assert.ok([c.getX(i),c.getY(i),c.getZ(i)].every(v => Number.isFinite(v)&&v>=0&&v<=1))
        }
      }
    } finally { result.surfaces.dispose(); result.hardware.dispose() }
  }
})

test('both detail levels keep the old anchors, footprint and stage-only walk boundary', () => {
  const anchors = MAIN_HALL_STAGE_EQUIPMENT_ANCHORS
  assert.deepEqual(anchors.drum,[0,.49,-8.45])
  assert.deepEqual(anchors.keyboard,[-3.3,.97,-8.55])
  assert.deepEqual(anchors.musicStandXs,[2.7,4])
  assert.deepEqual(anchors.cymbalXs,[-1.05,1.1])
  assert.ok(Object.isFrozen(anchors)&&Object.values(anchors).every(Object.isFrozen))
  const room = MAIN_HALL_DIMENSIONS
  for (const low of [false,true]) {
    const result = createMainHallStageEquipmentGeometry(low)
    try {
      for (const geometry of Object.values(result)) {
        const bounds = geometry.boundingBox!
        assert.ok(bounds.min.y>=-.005&&bounds.max.y<1.8)
        assert.ok(bounds.min.x>-4.1&&bounds.max.x<4.5)
        assert.ok(bounds.min.z>room.stageZ-room.stageDepth/2)
        assert.ok(bounds.max.z<room.stageZ+room.stageDepth/2-.6)
        assert.ok(geometry.boundingSphere!.radius>0)
      }
    } finally { result.surfaces.dispose(); result.hardware.dispose() }
  }
})

test('Low reduces curved detail rather than dropping devices and stays within room headroom', () => {
  const high = createMainHallStageEquipmentGeometry()
  const low = createMainHallStageEquipmentGeometry(true)
  try {
    const triangles = (items: typeof high) => Object.values(items).reduce((total,g)=>total+g.getAttribute('position').count/3,0)
    assert.ok(triangles(low)<triangles(high))
    assert.ok(triangles(high)<8000&&triangles(low)<6000)
    assert.ok(146764-636+triangles(low)<175000)
    for (const key of ['surfaces','hardware'] as const) {
      for (const side of ['min','max'] as const) for (const axis of ['x','y','z'] as const) {
        assert.ok(Math.abs(high[key].boundingBox![side][axis]-low[key].boundingBox![side][axis])<.015)
      }
    }
  } finally { for (const g of [...Object.values(high),...Object.values(low)]) g.dispose() }
})

test('returned buffers are independently owned and source configuration remains unchanged', () => {
  const before = JSON.stringify(MAIN_HALL_STAGE_EQUIPMENT_ANCHORS)
  const first = createMainHallStageEquipmentGeometry(true)
  const second = createMainHallStageEquipmentGeometry(true)
  let disposed = 0
  for (const g of Object.values(first)) g.addEventListener('dispose',()=>disposed++)
  assert.equal(disposed,0)
  first.surfaces.dispose(); first.hardware.dispose()
  assert.equal(disposed,2)
  assert.notEqual(first.surfaces,second.surfaces)
  assert.notEqual(first.hardware,second.hardware)
  assert.ok(second.surfaces.getAttribute('position').count>0)
  assert.equal(JSON.stringify(MAIN_HALL_STAGE_EQUIPMENT_ANCHORS),before)
  second.surfaces.dispose(); second.hardware.dispose()
})

test('only the fixed audience-facing camera can hide the two stage batches', () => {
  const framing = MAIN_HALL_CAMERA.stage
  const eye = new Vector3(...framing.position)
  const direction = new Vector3(...framing.target).sub(eye).normalize()
  const point = new Vector3()
  for (const low of [false,true]) {
    const result = createMainHallStageEquipmentGeometry(low)
    try {
      for (const geometry of Object.values(result)) {
        const positions = geometry.getAttribute('position')
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions,i)
          point.y += MAIN_HALL_DIMENSIONS.stageHeight
          assert.ok(point.sub(eye).dot(direction)<.1,'every vertex must remain behind the actual .1 m near plane')
        }
      }
    } finally { result.surfaces.dispose(); result.hardware.dispose() }
  }
})

test('runtime replaces the former props with memoized Low-aware buffers and owns cleanup', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx',import.meta.url),'utf8')
  assert.match(source,/useMemo\(\(\) => createMainHallStageEquipmentGeometry\(lowDetail\), \[lowDetail\]\)/)
  assert.match(source,/geometry\.surfaces\.dispose\(\); geometry\.hardware\.dispose\(\)/)
  assert.equal((source.match(/name="main-hall-stage-equipment-[^"]+"/g)??[]).length,2)
  assert.match(source,/<HallStageEquipment lowDetail=\{lowDetail\} stageHeight=\{stageHeight\} visible=\{view !== 'stage'\} \/>/)
  assert.match(source,/<group position=\{\[0, stageHeight, 0\]\} visible=\{visible\}>/)
  assert.doesNotMatch(source,/<cylinderGeometry|<circleGeometry|TextureLoader|useLoader/)
  assert.match(source,/<Canvas shadows="percentage" frameloop="demand"/)
})
