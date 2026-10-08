import assert from 'node:assert/strict'
import test from 'node:test'
import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Matrix4, Object3D, TorusGeometry, type BufferGeometry } from 'three'
import { PARKING_ROWS } from '../src/views/virtualChurchScene.ts'
import { createVirtualChurchAccessibleSymbol, createVirtualChurchColoredParkingMarkings, createVirtualChurchColoredRoundedMarkings, createVirtualChurchRoundedMarkings } from '../src/views/virtualChurchParkingGeometry.ts'

function assertSameTriangles(actual: BufferGeometry, expectedParts: BufferGeometry[]) {
  const expanded = actual.toNonIndexed()
  assert.equal(actual.groups.length, 0, 'single-material batch has no extra draw groups')
  let offset = 0
  for (const part of expectedParts) {
    const expected = part.toNonIndexed()
    for (const name of ['position', 'normal', 'uv']) {
      const a = expanded.getAttribute(name)
      const b = expected.getAttribute(name)
      for (let index = 0; index < b.count; index += 1) {
        for (let component = 0; component < b.itemSize; component += 1) {
          const difference = Math.abs(a.array[(offset + index) * a.itemSize + component] - b.array[index * b.itemSize + component])
          assert.ok(difference <= 0.00001, `${name} triangle vertex ${offset + index}: ${difference}`)
        }
      }
    }
    offset += expected.getAttribute('position').count
    expected.dispose()
  }
  assert.equal(expanded.getAttribute('position').count, offset, 'no triangles added or removed')
  assert.ok(actual.boundingSphere && Number.isFinite(actual.boundingSphere.radius))
  expanded.dispose()
  expectedParts.forEach(part => part.dispose())
  actual.dispose()
}

test('rounded parking batches preserve every legacy transformed triangle, normal and UV', () => {
  const markings = PARKING_ROWS.flatMap(row => Array.from({length: row.bays + 1}, (_, index) => ({
    position: [row.start[0] + Math.cos(row.angle) * row.bayWidth * index, 0.045,
      row.start[1] + Math.sin(row.angle) * row.bayWidth * index] as [number, number, number],
    rotation: [0, -row.angle, 0] as [number, number, number],
    scale: [0.09, 0.025, row.bayDepth] as [number, number, number],
  })))
  // Also cover X-oriented accessible hatching, equal width/length and short marks.
  markings.push(
    {position:[-30, 0.055, 5], rotation:[0,-0.62,0], scale:[1.8,0.026,0.09]},
    {position:[0,0,0], rotation:[0,0,0], scale:[0.09,0.025,0.09]},
    {position:[1,0,1], rotation:[0,0.7,0], scale:[0.08,0.025,0.09]},
  )
  const expected: BufferGeometry[] = []
  for (const item of markings) {
    const root = new Object3D()
    root.position.set(...item.position); root.rotation.set(...item.rotation); root.updateMatrix()
    const alongX = item.scale[0] > item.scale[2]
    const width = Math.min(item.scale[0], item.scale[2])
    const length = Math.max(item.scale[0], item.scale[2])
    const body = Math.max(length - width, width * 0.02)
    const offset = Math.max(0, (length - width) / 2)
    for (const capSide of [0, -1, 1]) {
      const local = new Object3D()
      local.position.set(alongX ? capSide * offset : 0, 0, alongX ? 0 : capSide * offset)
      local.scale.set(capSide === 0 && alongX ? body : width, item.scale[1], capSide === 0 && !alongX ? body : width)
      local.updateMatrix()
      // Original InstancedMesh uploads matrices as Float32.
      const matrix = new Matrix4().multiplyMatrices(root.matrix, local.matrix)
      matrix.fromArray(new Float32Array(matrix.elements))
      expected.push((capSide === 0 ? new BoxGeometry(1,1,1) : new CylinderGeometry(0.5,0.5,1,12)).applyMatrix4(matrix))
    }
  }
  assertSameTriangles(createVirtualChurchRoundedMarkings(markings)!, expected)
})

test('wheelchair batching retains the ring, head and two original strokes', () => {
  const parts = [new TorusGeometry(0.42,0.075,8,22,Math.PI*1.7), new CircleGeometry(0.13,16), new BoxGeometry(1,1,1), new BoxGeometry(1,1,1)]
  const transforms = [
    {p:[0,0.52,0], r:0, s:[1,1,1]}, {p:[-0.08,1.08,0], r:0, s:[1,1,1]},
    {p:[0.02,0.85,0], r:-0.18, s:[0.12,0.58,0.025]}, {p:[0.25,0.72,0], r:Math.PI/2, s:[0.11,0.55,0.025]},
  ]
  parts.forEach((part, index) => {
    const transform = new Object3D(), source = transforms[index]
    transform.position.fromArray(source.p); transform.rotation.z = source.r; transform.scale.fromArray(source.s); transform.updateMatrix()
    part.applyMatrix4(transform.matrix)
  })
  assertSameTriangles(createVirtualChurchAccessibleSymbol(), parts)
})

test('empty markings do not allocate a render batch', () => {
  assert.equal(createVirtualChurchRoundedMarkings([]), null)
})

test('white and accessible parking strokes merge without changing triangles, UVs or linear colours', () => {
  const groups = [
    { color: '#e7e2d2', items: [{ position: [1, .045, 2], scale: [.09, .025, 5] }] },
    { color: '#d8ad4f', items: [{ position: [3, .052, 4], rotation: [0, -.62, 0], scale: [2, .026, .09] }] },
  ] as const
  const merged = createVirtualChurchColoredRoundedMarkings(groups)!
  assert.ok(merged)
  assert.equal(merged.groups.length, 0, 'vertex colour stays one draw call')
  const expanded = merged.toNonIndexed()
  const actualColor = expanded.getAttribute('color')
  let vertexOffset = 0
  for (const group of groups) {
    const reference = createVirtualChurchRoundedMarkings(group.items)!.toNonIndexed()
    const expectedColor = new Color(group.color)
    for (const name of ['position', 'normal', 'uv']) {
      const actual = expanded.getAttribute(name), expected = reference.getAttribute(name)
      for (let index = 0; index < expected.count; index++) {
        for (let component = 0; component < expected.itemSize; component++) {
          assert.ok(Math.abs(actual.getComponent(vertexOffset + index, component) - expected.getComponent(index, component)) < 1e-5)
        }
      }
    }
    for (let index = 0; index < reference.getAttribute('position').count; index++) {
      assert.ok(Math.abs(actualColor.getX(vertexOffset + index) - expectedColor.r) < 1e-6)
      assert.ok(Math.abs(actualColor.getY(vertexOffset + index) - expectedColor.g) < 1e-6)
      assert.ok(Math.abs(actualColor.getZ(vertexOffset + index) - expectedColor.b) < 1e-6)
    }
    vertexOffset += reference.getAttribute('position').count
    reference.dispose()
  }
  assert.equal(expanded.getAttribute('position').count, vertexOffset)
  expanded.dispose(); merged.dispose()
  assert.equal(createVirtualChurchColoredRoundedMarkings([{ color: '#ffffff', items: [] }]), null)
})

test('V3 wheelchair symbols join the painted markings without moving or recolouring them', () => {
  const groups = [
    { color: '#e7e2d2', items: [{ position: [1, .045, 2] as [number, number, number], scale: [.09, .025, 5] as [number, number, number] }] },
    { color: '#d8ad4f', items: [{ position: [3, .052, 4] as [number, number, number], scale: [2, .026, .09] as [number, number, number] }] },
  ]
  const symbols = { positions: [[-30, 5], [-27, 5]] as [number, number][], angle: .78, color: '#d8ad4f' }
  const merged = createVirtualChurchColoredParkingMarkings(groups, symbols)!
  const lines = createVirtualChurchColoredRoundedMarkings(groups)!
  const source = createVirtualChurchAccessibleSymbol()
  const root = new Object3D(), inner = new Object3D()
  inner.rotation.x = -Math.PI / 2; inner.updateMatrix()
  const expected = [lines]
  for (const [x, z] of symbols.positions) {
    root.position.set(x, .058, z)
    root.rotation.set(0, -symbols.angle, 0)
    root.scale.setScalar(.62)
    root.updateMatrix()
    expected.push(source.clone().applyMatrix4(new Matrix4().multiplyMatrices(root.matrix, inner.matrix)))
  }
  const expanded = merged.toNonIndexed()
  assert.equal(merged.groups.length, 0, 'all paint is one draw call')
  let offset = 0
  for (const [partIndex, part] of expected.entries()) {
    const reference = part.toNonIndexed()
    const tint = new Color(symbols.color)
    for (const name of ['position', 'normal', 'uv']) {
      const actual = expanded.getAttribute(name), target = reference.getAttribute(name)
      for (let vertex = 0; vertex < target.count; vertex++) for (let component = 0; component < target.itemSize; component++) {
        assert.ok(Math.abs(actual.getComponent(offset + vertex, component) - target.getComponent(vertex, component)) < 1e-5,
          `${name} vertex ${offset + vertex}`)
      }
    }
    if (partIndex > 0) for (let vertex = 0; vertex < reference.getAttribute('position').count; vertex++) {
      const actual = expanded.getAttribute('color')
      assert.ok(Math.abs(actual.getX(offset + vertex) - tint.r) < 1e-6)
      assert.ok(Math.abs(actual.getY(offset + vertex) - tint.g) < 1e-6)
      assert.ok(Math.abs(actual.getZ(offset + vertex) - tint.b) < 1e-6)
    }
    offset += reference.getAttribute('position').count
    reference.dispose()
  }
  assert.equal(expanded.getAttribute('position').count, offset, 'no wheelchair triangles lost or added')
  expanded.dispose(); merged.dispose(); source.dispose(); expected.forEach(part => part.dispose())
})
