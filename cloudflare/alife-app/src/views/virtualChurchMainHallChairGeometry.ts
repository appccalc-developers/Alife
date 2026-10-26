import { BoxGeometry, CurvePath, LineCurve3, Matrix3, QuadraticBezierCurve3, Quaternion, TubeGeometry, Vector3, type BufferGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Original, shared geometry informed by the supplier's chair silhouettes.
// These are visual approximations, not a replica of the 2017 production chair.
// Unit cushions retain the existing placement scales, UVs and fabric material.
function cushion(kind: 'seat' | 'back', lowDetail = false): BufferGeometry {
  // RoundedBoxGeometry collapses its inner face grid onto the fillet boundary;
  // a bow needs real inner vertices, not additional degenerate box triangles.
  const geometry = kind === 'back'
    ? lowDetail ? new BoxGeometry(1, 1, 1, 4, 3, 2) : new BoxGeometry(1, 1, 1, 6, 4, 4)
    : new RoundedBoxGeometry(1, 1, 1, 1, .14)
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const point = new Vector3()
  const normal = new Vector3()
  const derivative = new Matrix3()
  const epsilon = .0001
  if (kind === 'back') {
    const core = new Vector3()
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i)
      core.copy(point).clampScalar(-.36, .36)
      normal.copy(point).sub(core).normalize()
      point.copy(core).addScaledVector(normal, .14)
      positions.setXYZ(i, point.x, point.y, point.z)
      normals.setXYZ(i, normal.x, normal.y, normal.z)
    }
  }
  const shape = (x: number, y: number, z: number) => {
    if (kind === 'back') {
      // Narrower lower corners and a gentle horizontal bow, with the crown
      // still at the authoritative .88 m height after instance scaling.
      return new Vector3(x * (.93 + .07 * (y + .5)), y, z - .18 * (1 - 4 * x * x))
    }
    const centre = Math.min(1, Math.max(0, (.5 - Math.abs(x)) / .14)) * Math.min(1, Math.max(0, (.5 - Math.abs(z)) / .14))
    // Slightly taper the rear; soften the top edges rather than raising the
    // seated height. The central top remains at the existing .475 m.
    return new Vector3(x * (.97 - .06 * z), y - .10 * (1 - centre) * Math.max(0, 2 * y), z)
  }
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i)
    normal.fromBufferAttribute(normals, i)
    const { x, y, z } = point
    const dx = shape(x + epsilon, y, z).sub(shape(x - epsilon, y, z)).multiplyScalar(1 / (2 * epsilon))
    const dy = shape(x, y + epsilon, z).sub(shape(x, y - epsilon, z)).multiplyScalar(1 / (2 * epsilon))
    const dz = shape(x, y, z + epsilon).sub(shape(x, y, z - epsilon)).multiplyScalar(1 / (2 * epsilon))
    derivative.set(dx.x, dy.x, dz.x, dx.y, dy.y, dz.y, dx.z, dy.z, dz.z).invert().transpose()
    // Transform the original smooth fillet normals; recomputing normals on
    // the non-indexed box would introduce flat triangle seams.
    normal.applyMatrix3(derivative).normalize()
    point.copy(shape(x, y, z))
    positions.setXYZ(i, point.x, point.y, point.z)
    normals.setXYZ(i, normal.x, normal.y, normal.z)
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export const createMainHallChairSeatGeometry = () => cushion('seat')
export const createMainHallChairBackGeometry = () => cushion('back')
export const createMainHallChairLowBackGeometry = () => cushion('back', true)

/** One shared lower steel frame, rather than four detached vertical blocks.
 * The historical gallery supports splayed legs and under-seat side rails, not
 * an exact manufacturer's frame drawing. Keep the existing chair/walk bounds.
 * Six slim rectangular tubes use 72 triangles and one draw for all 360 chairs.
 * Caller owns the merged geometry; construction parts are always disposed. */
export function createMainHallChairLowerFrameGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = []
  const up = new Vector3(0, 1, 0)
  const tube = (from: Vector3, to: Vector3) => {
    const delta = to.clone().sub(from)
    const part = new BoxGeometry(.024, delta.length(), .024)
    parts.push(part)
    part.applyQuaternion(new Quaternion().setFromUnitVectors(up, delta.clone().normalize()))
    part.translate(...from.clone().addScaledVector(delta, .5).toArray())
  }
  try {
    for (const side of [-1, 1]) {
      const front = new Vector3(side * .235, .375, -.2)
      const rear = new Vector3(side * .235, .375, .205)
      tube(new Vector3(side * .25, .02, -.24), front)
      tube(new Vector3(side * .25, .02, .25), rear)
      tube(front, rear)
    }
    const geometry = mergeGeometries(parts, false)
    if (!geometry) throw new Error('Unable to assemble main-hall chair lower frame')
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  } finally {
    parts.forEach(part => part.dispose())
  }
}

export function createMainHallChairBackFrameGeometry(lowDetail = false): BufferGeometry {
  // A single bent rear frame replaces the former disconnected vertical bars.
  // All chairs instance this one 6-sided tube; row links remain separate.
  const path = new CurvePath<Vector3>()
  const p = (x: number, y: number) => new Vector3(x, y, .038)
  path.add(new LineCurve3(p(-.252, -.215), p(-.252, .13)))
  path.add(new QuadraticBezierCurve3(p(-.252, .13), p(-.252, .17), p(-.215, .17)))
  path.add(new LineCurve3(p(-.215, .17), p(.215, .17)))
  path.add(new QuadraticBezierCurve3(p(.215, .17), p(.252, .17), p(.252, .13)))
  path.add(new LineCurve3(p(.252, .13), p(.252, -.215)))
  const geometry = new TubeGeometry(path, lowDetail ? 12 : 18, .013, lowDetail ? 5 : 6, false)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export const createMainHallChairLowBackFrameGeometry = () => createMainHallChairBackFrameGeometry(true)
