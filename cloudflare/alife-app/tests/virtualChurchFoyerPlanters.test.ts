import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { CylinderGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three'
import { VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS as anchors } from '../src/views/virtualChurchInteractionContract.ts'
import { VIRTUAL_CHURCH_FOYER_FLOOR as floor } from '../src/views/virtualChurchFoyerFloor.ts'
import { FOYER_PLANTER_LEAVES_PER_POT, FOYER_PLANTER_POT_HEIGHTS, createVirtualChurchFoyerPlanterLeafGeometry, createVirtualChurchFoyerPlanterPotGeometry, writeVirtualChurchFoyerPlanterInstances } from '../src/views/virtualChurchFoyerPlanters.ts'

test('two photo-backed pots share one bounded geometry inside unchanged collision footprints', () => {
  const before = JSON.stringify(anchors)
  const geometry = createVirtualChurchFoyerPlanterPotGeometry(anchors, floor.boardY)!
  try {
    assert.equal(JSON.stringify(anchors), before)
    assert.equal(geometry.groups.length, 0); assert.equal(geometry.index, null)
    assert.ok(geometry.getAttribute('position').count / 3 < 1200)
    const positions = geometry.getAttribute('position'), heights = [0, 0]
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = positions.getX(vertex), y = positions.getY(vertex), z = positions.getZ(vertex)
      const distances = anchors.map(pot => Math.hypot(x - pot.centerX, z - pot.centerZ))
      const index = distances[0] < distances[1] ? 0 : 1
      assert.ok(distances[index] <= anchors[index].radius + 1e-6)
      assert.ok(y >= floor.boardY - 1e-6 && y <= floor.boardY + .661)
      heights[index] = Math.max(heights[index], y - floor.boardY)
    }
    assert.ok(Math.abs(heights[0] - FOYER_PLANTER_POT_HEIGHTS[0]) < 1e-6)
    assert.ok(heights[1] < heights[0] && Math.abs(heights[1] - .445) < 1e-6)
    for (const attribute of Object.values(geometry.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite))
    assert.equal(geometry.getAttribute('color').count, positions.count)
  } finally { geometry.dispose() }
})

test('shared leaf has a narrow folded ridge, an arching crown and a lowered tip', () => {
  const leaf = createVirtualChurchFoyerPlanterLeafGeometry()
  try {
    assert.equal(leaf.index!.count / 3, 24)
    const positions = leaf.getAttribute('position')
    assert.equal(positions.count, 21)
    const height = Math.max(...Array.from({ length: positions.count }, (_, i) => positions.getY(i)))
    assert.ok(height - positions.getY(19) > .30, 'the tip must droop below the crown')
    assert.ok(leaf.boundingBox!.max.x - leaf.boundingBox!.min.x < .08, 'not the old .31m shield profile')
    assert.ok(positions.getZ(10) > positions.getZ(9), 'a subtle raised midrib catches light')
    for (const attribute of Object.values(leaf.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite))
  } finally { leaf.dispose() }
})

test('all 36 leaves and two stems retain deterministic roots and a modest walk-route envelope', () => {
  const leafGeometry = createVirtualChurchFoyerPlanterLeafGeometry(), stemGeometry = new CylinderGeometry(.025, .038, .56, 6)
  const material = new MeshStandardMaterial()
  const leaves = new InstancedMesh(leafGeometry, material, anchors.length * FOYER_PLANTER_LEAVES_PER_POT)
  const stems = new InstancedMesh(stemGeometry, material, anchors.length)
  try {
    writeVirtualChurchFoyerPlanterInstances(stems, leaves, anchors, floor.boardY)
    const before = leaves.instanceMatrix.array.slice(), colors = leaves.instanceColor!.array.slice()
    const matrix = new Matrix4(), point = new Vector3(), position = leafGeometry.getAttribute('position')
    for (let instance = 0; instance < leaves.count; instance++) {
      const index = Math.floor(instance / FOYER_PLANTER_LEAVES_PER_POT), pot = anchors[index]
      leaves.getMatrixAt(instance, matrix)
      for (let vertex = 0; vertex < position.count; vertex++) {
        point.fromBufferAttribute(position, vertex).applyMatrix4(matrix)
        assert.ok(Math.hypot(point.x - pot.centerX, point.z - pot.centerZ) < .57)
        assert.ok(point.y > floor.boardY + FOYER_PLANTER_POT_HEIGHTS[index])
        assert.ok(point.y < floor.boardY + 1.6)
      }
    }
    writeVirtualChurchFoyerPlanterInstances(stems, leaves, anchors, floor.boardY)
    assert.deepEqual(leaves.instanceMatrix.array, before); assert.deepEqual(leaves.instanceColor!.array, colors)
    assert.ok(leaves.boundingSphere && stems.boundingSphere)
    assert.ok(Array.from(stems.instanceMatrix.array).every(Number.isFinite))
  } finally { leaves.dispose(); stems.dispose(); leafGeometry.dispose(); stemGeometry.dispose(); material.dispose() }
})

test('pots are reproducible owned output and an empty anchor list does not allocate a batch', () => {
  const first = createVirtualChurchFoyerPlanterPotGeometry(anchors, floor.boardY)!, second = createVirtualChurchFoyerPlanterPotGeometry(anchors, floor.boardY)!
  try {
    assert.notEqual(first, second)
    for (const name of ['position', 'normal', 'color']) assert.deepEqual(first.getAttribute(name).array, second.getAttribute(name).array)
    assert.equal(createVirtualChurchFoyerPlanterPotGeometry([], floor.boardY), null)
  } finally { first.dispose(); second.dispose() }
})

test('planter replacement owns its buffers and keeps three static texture-free foyer LOD batches', () => {
  const view = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const component = view.slice(view.indexOf('const FoyerStairPlanters ='), view.indexOf('const FoyerCafeEquipment ='))
  assert.equal((component.match(/<instancedMesh\b/g) ?? []).length, 2)
  assert.equal((component.match(/<mesh\b/g) ?? []).length, 1)
  assert.match(component, /leafGeometry.dispose\(\); potGeometry\?\.dispose\(\)/)
  assert.match(component, /writeVirtualChurchFoyerPlanterInstances\(stems.current, leaves.current, VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS, VIRTUAL_CHURCH_FOYER_FLOOR.boardY\)/)
  assert.doesNotMatch(component, /useFrame|Texture|Light|castShadow|transparent/)
  assert.match(view, /const FoyerCirculationLayer =[\s\S]*?<FoyerStairPlanters \/>/)
})
