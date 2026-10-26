import { CylinderGeometry, LatheGeometry, Vector2, Vector3, type BufferGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Original furniture for the labelled concept room, not a real church fit-out.
 * All occupants share one cushion/back buffer and one tapered-leg buffer.
 * The caller owns every returned geometry; construction temporaries are freed. */
export function createStudyFurnitureGeometry(lowDetail = false) {
  const temporaries: BufferGeometry[] = []
  const owned: BufferGeometry[] = []
  try {
    const seat = new RoundedBoxGeometry(.57, .09, .53, lowDetail ? 1 : 2, .025)
    temporaries.push(seat)
    const back = new RoundedBoxGeometry(.56, .6, .075, lowDetail ? 2 : 3, .03)
    temporaries.push(back)
    seat.translate(0, .49, 0)
    const positions = back.getAttribute('position'), normals = back.getAttribute('normal')
    const normal = new Vector3()
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index)
      const taper = .94 + .06 * (y + .3) / .6
      const slope = 2 * .018 * x / (.28 * .28)
      // Inverse-transpose of the taper/wrap Jacobian: keep rounded normals
      // smooth rather than treating a curved cushion as a faceted box.
      const nx = (normals.getX(index) - slope * normals.getZ(index)) / taper
      normal.set(nx, normals.getY(index) - x * .1 * nx, normals.getZ(index)).normalize()
      normals.setXYZ(index, normal.x, normal.y, normal.z)
      positions.setXYZ(index, x * taper, y, z + .018 * (x / .28) ** 2)
    }
    back.rotateX(-.08); back.translate(0, .84, -.22)
    const cushions = mergeGeometries([seat, back], false)
    if (!cushions) throw new Error('Study chair geometry could not be merged')
    owned.push(cushions)
    const legs = new CylinderGeometry(.42, .5, 1, lowDetail ? 8 : 12)
    owned.push(legs)
    const radial = lowDetail ? 32 : 48
    const tabletop = new LatheGeometry([
      new Vector2(0, -.045), new Vector2(.933, -.045),
      new Vector2(.954, -.036), new Vector2(.96, -.018),
      new Vector2(.96, .024), new Vector2(.954, .038),
      new Vector2(.938, .045), new Vector2(0, .045),
    ], radial)
    owned.push(tabletop)
    const pedestal = new LatheGeometry([
      new Vector2(0, -.325), new Vector2(.223, -.325),
      new Vector2(.24, -.314), new Vector2(.235, -.28),
      new Vector2(.174, -.22), new Vector2(.126, -.12),
      new Vector2(.112, .06), new Vector2(.116, .24),
      new Vector2(.13, .325), new Vector2(0, .325),
    ], radial)
    owned.push(pedestal)
    for (const geometry of owned) { geometry.normalizeNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere() }
    return { cushions, legs, tabletop, pedestal }
  } catch (error) {
    owned.forEach(geometry => geometry.dispose())
    throw error
  } finally {
    temporaries.forEach(geometry => geometry.dispose())
  }
}
