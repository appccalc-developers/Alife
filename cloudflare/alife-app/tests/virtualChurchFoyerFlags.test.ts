import assert from 'node:assert/strict'
import test from 'node:test'
import { VIRTUAL_CHURCH_FOYER_FLAG_COUNTS, createVirtualChurchFoyerFlagCordGeometry, createVirtualChurchFoyerFlagGeometry } from '../src/views/virtualChurchFoyerFlags.ts'
import { VIRTUAL_CHURCH_FOYER_FLOOR } from '../src/views/virtualChurchFoyerFloor.ts'

test('the two temporary flag lines are separated through the open hall above walking height', () => {
  const geometry = createVirtualChurchFoyerFlagGeometry()
  try {
    const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv'), normal = geometry.getAttribute('normal')
    const [nearCount, farCount] = VIRTUAL_CHURCH_FOYER_FLAG_COUNTS
    assert.deepEqual([nearCount, farCount], [48, 48])
    assert.equal(position.count, (nearCount + farCount) * 36)
    assert.equal(uv.count, position.count)
    assert.equal(normal.count, position.count, 'cloth lighting needs a normal for every vertex')
    assert.ok(geometry.boundingSphere && geometry.boundingSphere.radius > 1)
    for (let flag = 0; flag < nearCount + farCount; flag++) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (let vertex = flag * 36; vertex < (flag + 1) * 36; vertex++) {
        minX = Math.min(minX, position.getX(vertex)); maxX = Math.max(maxX, position.getX(vertex))
        minY = Math.min(minY, position.getY(vertex)); maxY = Math.max(maxY, position.getY(vertex))
      }
      if (flag < nearCount) {
        assert.ok(maxX - minX >= .25 && maxX - minX <= .28, 'near flags should leave visible cord between cloth panels')
        assert.ok(maxY - minY >= .32 && maxY - minY <= .36, 'near flags should be legible without hanging into the walking line')
      } else {
        assert.ok(maxX - minX < .17, 'far flags should recede from the entrance view')
        assert.ok(maxY - minY < .22, 'far flags should retain their smaller scale')
      }
    }
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
      assert.ok(x > VIRTUAL_CHURCH_FOYER_FLOOR.minX && x < VIRTUAL_CHURCH_FOYER_FLOOR.maxX)
      assert.ok(y > 1.8 && y < 2.9)
      assert.ok(z > VIRTUAL_CHURCH_FOYER_FLOOR.minZ && z < VIRTUAL_CHURCH_FOYER_FLOOR.maxZ)
      assert.ok(uv.getX(i) > 0 && uv.getX(i) < 1 && uv.getY(i) > 0 && uv.getY(i) < 1)
    }
    const firstRowLast = position.getZ((nearCount - 1) * 36)
    const secondRowFirst = position.getZ(nearCount * 36)
    assert.ok(firstRowLast < secondRowFirst, 'the two strings remain separated at the right wall')
  } finally { geometry.dispose() }
})

test('the two flag cords remain inside the circulation shell and above walking height', () => {
  const geometry = createVirtualChurchFoyerFlagCordGeometry()
  try {
    const position = geometry.getAttribute('position')
    const [nearCount, farCount] = VIRTUAL_CHURCH_FOYER_FLAG_COUNTS
    assert.equal(position.count, (nearCount + farCount) * 2)
    assert.ok(Math.abs(position.getZ(0) - 1.8) < 1e-5)
    assert.ok(Math.abs(position.getZ(nearCount * 2 - 1) - 10.5) < 1e-5)
    assert.ok(Math.abs(position.getZ(nearCount * 2) - 11.8) < 1e-5)
    for (let i = 0; i < position.count; i++) {
      assert.ok(position.getX(i) > VIRTUAL_CHURCH_FOYER_FLOOR.minX)
      assert.ok(position.getX(i) < VIRTUAL_CHURCH_FOYER_FLOOR.maxX)
      assert.ok(position.getY(i) > 2.05)
      assert.ok(position.getY(i) < 2.9)
    }
  } finally { geometry.dispose() }
})
