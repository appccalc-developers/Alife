import { Vector3 } from 'three'
import { STUDY_COMPANION_SEATS } from './virtualChurchStudyPose.ts'

const up = new Vector3(0, 1, 0)
export const STUDY_CAMERA_FOV = 52

// Include the chairs, seated heads, feet and books rather than the empty room.
export function studyFramingPoints(overview: boolean) {
  const points: Vector3[] = []
  for (const seat of STUDY_COMPANION_SEATS) {
    for (const x of [-.42, .42]) for (const y of [0, 1.6]) for (const z of [-.35, .85]) {
      points.push(new Vector3(x, y, z).applyAxisAngle(up, seat.yaw).add(new Vector3(...seat.position)))
    }
  }
  if (overview) {
    for (const x of [-.32, .32]) for (const y of [0, 1.16]) for (const z of [1.7, 2.3]) points.push(new Vector3(x, y, z))
  }
  return points
}

/** Fit both axes in camera space; a wide, short phone must not inherit portrait distance. */
export function studyCameraFraming(width: number, height: number, overview: boolean) {
  const aspect = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : 1
  const target = new Vector3(0, .95, -.15)
  // A slight side angle reveals the circle and shared table instead of flattening five readers into a row.
  const backward = overview ? new Vector3(.55, .32, .8).normalize() : new Vector3(.38, .16, 1).normalize()
  const right = new Vector3().crossVectors(up, backward).normalize()
  const cameraUp = new Vector3().crossVectors(backward, right)
  const halfHeight = Math.tan(STUDY_CAMERA_FOV * Math.PI / 360)
  const inset = .92
  let distance = .5
  for (const point of studyFramingPoints(overview)) {
    const relative = point.sub(target)
    const depth = relative.dot(backward)
    distance = Math.max(distance,
      depth + Math.abs(relative.dot(right)) / (halfHeight * aspect * inset),
      depth + Math.abs(relative.dot(cameraUp)) / (halfHeight * inset),
      depth + .25)
  }
  return { position: target.clone().addScaledVector(backward, distance), target }
}
