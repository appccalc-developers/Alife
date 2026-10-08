import { BufferGeometry, Float32BufferAttribute, Matrix4, Object3D } from 'three'

// Same entrance-local datum as the approved church asset; no building rescale.
const angle = -Math.atan2(-9.21, 7.49)
const bankStart = Math.hypot(7.49, -9.21) / 2 - 15 + 4.2 - 18 + 18 * .3 + 12.24 * .315
export const CHURCH_AUTOMATIC_DOOR = {
  start: bankStart, end: bankStart + 3.8, centre: bankStart + 1.9,
  travel: 1.95, angle,
  source: [-.265 + Math.cos(angle) * (bankStart + 1.9) + Math.sin(angle) * -.735,
    -20.285 - Math.sin(angle) * (bankStart + 1.9) + Math.cos(angle) * -.735] as [number, number],
}

export type AutomaticDoorState = { open: boolean; awaySeconds: number; progress: number }
export function stepAutomaticDoor(state: AutomaticDoorState, distance: number, delta: number, radius: number, reducedMotion = false) {
  const dt = Math.max(0, Math.min(delta, .1))
  if (distance <= radius) { state.open = true; state.awaySeconds = 0 }
  else if (distance <= radius + 1.5) state.awaySeconds = 0
  else if (state.open) {
    state.awaySeconds += dt
    if (state.awaySeconds >= 2) state.open = false
  }
  const target = state.open ? 1 : 0
  state.progress = reducedMotion ? target : Math.max(0, Math.min(1, state.progress + Math.sign(target - state.progress) * dt / 1.2))
  return state.progress
}

export type AutomaticVehicleGatePart = {
  position: readonly [number, number, number]
  scale: readonly [number, number, number]
  rotation?: readonly [number, number, number]
}

// Parallel tracks clear the fixed fence/posts; neither leaf swings into the drive.
export const VEHICLE_GATE_TRACK_OFFSET = -.16
export const vehicleGateSlideDistance = (length: number, progress: number) =>
  (length / 2 + .12) * Math.max(0, Math.min(1, progress))

/** Zero-allocation writer for fixed posts and two outward-sliding gate leaves. */
export function createAutomaticVehicleGateMatrixWriter(
  gateParts: readonly AutomaticVehicleGatePart[],
  leafParts: readonly AutomaticVehicleGatePart[],
  length: number,
) {
  const part = new Object3D()
  const count = gateParts.length + leafParts.length
  const setPartTransform = (item: AutomaticVehicleGatePart, localX = item.position[0], trackOffset = 0) => {
    part.position.set(localX, item.position[1], item.position[2] + trackOffset)
    if (item.rotation) part.rotation.set(...item.rotation)
    else part.rotation.set(0, 0, 0)
    part.scale.set(...item.scale)
    part.updateMatrix()
  }

  return {
    count,
    write(progress: number, setMatrixAt: (index: number, matrix: Matrix4) => void) {
      let instanceIndex = 0
      for (const item of gateParts) {
        setPartTransform(item)
        setMatrixAt(instanceIndex, part.matrix)
        instanceIndex += 1
      }
      const travel = vehicleGateSlideDistance(length, progress)
      for (const side of [-1, 1] as const) {
        for (const item of leafParts) {
          if (Math.sign(item.position[0]) !== side) continue
          setPartTransform(item, item.position[0] + side * travel, VEHICLE_GATE_TRACK_OFFSET)
          setMatrixAt(instanceIndex, part.matrix)
          instanceIndex += 1
        }
      }
      if (instanceIndex !== count) throw new Error(`Automatic vehicle gate wrote ${instanceIndex} of ${count} instances`)
    },
  }
}

/** Keep fixed fence instances and moving gate leaves in one material batch.
 * The gate remains in its original local coordinates under the gate group;
 * only its contiguous matrix range needs a GPU upload while the leaves slide.
 */
export function createAutomaticVehicleGateAndFenceMatrixWriter(
  fenceParts: readonly AutomaticVehicleGatePart[],
  gateParts: readonly AutomaticVehicleGatePart[],
  leafParts: readonly AutomaticVehicleGatePart[],
  length: number,
  gateWorldMatrix: Matrix4,
) {
  const gate = createAutomaticVehicleGateMatrixWriter(gateParts, leafParts, length)
  const inverseGateWorld = gateWorldMatrix.clone().invert()
  const part = new Object3D()
  const localMatrix = new Matrix4()
  const staticCount = fenceParts.length
  return {
    count: staticCount + gate.count,
    staticCount,
    dynamicCount: gate.count,
    writeStatic(setMatrixAt: (index: number, matrix: Matrix4) => void) {
      fenceParts.forEach((item, index) => {
        part.position.set(...item.position)
        part.rotation.set(...(item.rotation ?? [0, 0, 0]))
        part.scale.set(...item.scale)
        part.updateMatrix()
        localMatrix.multiplyMatrices(inverseGateWorld, part.matrix)
        setMatrixAt(index, localMatrix)
      })
    },
    writeGate(progress: number, setMatrixAt: (index: number, matrix: Matrix4) => void) {
      gate.write(progress, (index, matrix) => setMatrixAt(staticCount + index, matrix))
    },
  }
}

/** Separate only the existing door surfaces, retaining closed-pose attributes.
 * Low has one pane spanning the bank: clip it at the centre instead of stretching
 * triangles across the opening. The cached GLB geometry is never mutated.
 */
export function prepareChurchSlidingGeometry(source: BufferGeometry, materialName: string) {
  const kind = /Glass/i.test(materialName) ? 'glass' : /Charcoal/i.test(materialName) ? 'frame' : /Silver/i.test(materialName) ? 'handle' : null
  if (!kind) return null
  const p = source.getAttribute('position')
  const indices = source.index
  const names = Object.keys(source.attributes)
  const sizes = names.map(name => source.getAttribute(name).itemSize)
  const offsets = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0))
  const positionOffset = offsets[names.indexOf('position')]
  const output = names.map(() => [] as number[])
  const moving: { index: number; x: number; side: number }[] = []
  let vertices = 0
  const read = (index: number) => names.flatMap(name => {
    const a = source.getAttribute(name)
    return Array.from({ length: a.itemSize }, (_, c) => a.getComponent(index, c))
  })
  const emit = (triangle: number[][], side: number) => {
    for (const v of triangle) {
      names.forEach((_, i) => output[i].push(...v.slice(offsets[i], offsets[i] + sizes[i])))
      if (side) moving.push({ index: vertices, x: v[positionOffset], side })
      vertices++
    }
  }
  const clip = (polygon: number[][], side: number) => {
    const result: number[][] = []
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length]
      const da = (a[positionOffset] - CHURCH_AUTOMATIC_DOOR.centre) * side
      const db = (b[positionOffset] - CHURCH_AUTOMATIC_DOOR.centre) * side
      if (da >= 0) result.push(a)
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db)
        result.push(a.map((value, j) => value + t * (b[j] - value)))
      }
    }
    return result
  }
  for (let t = 0; t < (indices?.count ?? p.count); t += 3) {
    const ids = [0, 1, 2].map(i => indices ? indices.getX(t + i) : t + i)
    const door = ids.every(i => p.getX(i) > bankStart - .006 && p.getX(i) < bankStart + 3.806
      && p.getY(i) > .055 && p.getY(i) < 2.295 && p.getZ(i) > -.94 && p.getZ(i) < -.66)
      && (kind !== 'frame' || [1, 2, 3].some(n => ids.every(i => Math.abs(p.getX(i) - (bankStart + n * .95)) < .061)))
    const triangle = ids.map(read)
    if (!door) { emit(triangle, 0); continue }
    for (const side of [-1, 1]) {
      const polygon = clip(triangle, side)
      for (let i = 1; i < polygon.length - 1; i++) emit([polygon[0], polygon[i], polygon[i + 1]], side)
    }
  }
  if (!moving.length) return null
  const geometry = new BufferGeometry()
  names.forEach((name, i) => geometry.setAttribute(name, new Float32BufferAttribute(output[i], sizes[i])))
  geometry.computeBoundingBox()
  // Conservative bounds cover both poses; no per-frame full-building traversal.
  geometry.boundingBox!.min.x -= CHURCH_AUTOMATIC_DOOR.travel
  geometry.boundingBox!.max.x += CHURCH_AUTOMATIC_DOOR.travel
  geometry.computeBoundingSphere()
  geometry.boundingSphere!.radius += CHURCH_AUTOMATIC_DOOR.travel
  let last = -1
  return { geometry, movingVertices: moving.length, update(progress: number) {
    if (progress === last) return
    const positions = geometry.getAttribute('position')
    moving.forEach(v => positions.setX(v.index, v.x + v.side * CHURCH_AUTOMATIC_DOOR.travel * progress))
    positions.needsUpdate = true
    last = progress
  } }
}
