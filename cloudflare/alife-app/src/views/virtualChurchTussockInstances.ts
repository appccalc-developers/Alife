import { BufferGeometry, Float32BufferAttribute, Frustum, Matrix4, Object3D, Sphere, type Camera, type InstancedMesh } from 'three'

/** Static, non-shadow-casting plants only. Keep the full batch bounds so a
 * culled batch can reappear; compact matrices AND colours in original order.
 * Called immediately before rendering with the final camera/world matrices.
 */
export function createVirtualChurchPlantVisibility(mesh: InstancedMesh) {
  if (mesh.castShadow) throw new Error('Plant visibility requires non-shadow-casting instances')
  const count = mesh.count
  const matrices = mesh.instanceMatrix.array.slice(0, count * 16)
  const colors = mesh.instanceColor?.array.slice(0, count * 3)
  mesh.geometry.computeBoundingSphere()
  const bounds = mesh.geometry.boundingSphere!
  const matrix = new Matrix4(), world = new Matrix4(), projectionView = new Matrix4(), last = new Matrix4()
  const frustum = new Frustum(), sphere = new Sphere()
  const spheres = Array.from({ length: count }, (_, i) => bounds.clone().applyMatrix4(matrix.fromArray(matrices, i * 16)))
  const indices = new Int32Array(count).fill(-1)
  let initialized = false
  return {
    update(camera: Camera) {
      // Stereo cameras have separate eye frusta: retain all instances rather
      // than accidentally applying a single eye's projection to both eyes.
      const stereo = 'isArrayCamera' in camera && camera.isArrayCamera === true
      world.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld)
      projectionView.multiplyMatrices(camera.projectionMatrix, world)
      if (!stereo && initialized && projectionView.equals(last)) return
      initialized = !stereo; last.copy(projectionView)
      // Local-space frustum includes the scene's mirrored Z and all parents.
      frustum.setFromProjectionMatrix(projectionView)
      let visible = 0, changed = false
      for (let i = 0; i < count; i++) {
        sphere.copy(spheres[i])
        if (!stereo && Number.isFinite(sphere.radius) && !frustum.intersectsSphere(sphere)) continue
        if (indices[visible] !== i) {
          mesh.instanceMatrix.array.set(matrices.subarray(i * 16, i * 16 + 16), visible * 16)
          if (colors && mesh.instanceColor) mesh.instanceColor.array.set(colors.subarray(i * 3, i * 3 + 3), visible * 3)
          indices[visible] = i; changed = true
        }
        visible++
      }
      mesh.count = visible
      if (changed) {
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
    },
  }
}

export type VirtualChurchTussockPlacement = {
  position: readonly [number, number, number]
  scale?: number
  rotation?: number
}

/** Same nine leaves and source transforms, with colour carried per instance. */
export function writeVirtualChurchColoredTussocks(
  groups: readonly { placements: readonly VirtualChurchTussockPlacement[]; color: string }[],
  accentColor: string,
  write: (index: number, matrix: Matrix4, color: string) => void,
) {
  let count = 0
  for (const group of groups) {
    writeVirtualChurchTussockMatrices(group.placements, true,
      (_, matrix) => write(count++, matrix, group.color),
      (_, matrix) => write(count++, matrix, accentColor))
  }
  return count
}

/** Three unchanged lobes for each shrub; the callback also supports the V2 split batches. */
export function writeVirtualChurchShrubMatrices(
  placements: readonly VirtualChurchTussockPlacement[],
  write: (placementIndex: number, lobeIndex: number, matrix: Matrix4) => void,
) {
  const root = new Object3D(), crown = new Object3D(), matrix = new Matrix4()
  placements.forEach((placement, placementIndex) => {
    root.position.set(...placement.position); root.scale.setScalar(placement.scale ?? 1)
    root.rotation.set(0, placement.rotation ?? 0, 0); root.updateMatrix()
    for (let lobe = 0; lobe < 3; lobe++) {
      if (lobe === 2) crown.position.set(0, .43, -.18)
      else crown.position.set(lobe === 0 ? -.35 : .35, .38 + lobe * .1, .08)
      crown.scale.set(1, .82, 1); crown.updateMatrix()
      write(placementIndex, lobe, matrix.multiplyMatrices(root.matrix, crown.matrix))
    }
  })
  return placements.length * 3
}

/** Keep the whole plant footprint clear, including polygon edges and corners. */
export function virtualChurchPlantClearsPaving(
  position: readonly [number, number, number],
  radius: number,
  polygons: readonly (readonly (readonly [number, number])[])[],
) {
  const [x, , z] = position
  if (![x, z, radius].every(Number.isFinite) || radius < 0) return false
  return polygons.every(points => {
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [ax, az] = points[j], [bx, bz] = points[i]
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside
      const dx = bx - ax, dz = bz - az, lengthSquared = dx * dx + dz * dz
      const t = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared)) : 0
      if (Math.hypot(x - ax - t * dx, z - az - t * dz) <= radius + 1e-7) return false
    }
    return !inside
  })
}

export type VirtualChurchHedgeSegment = readonly [
  start: readonly [number, number],
  end: readonly [number, number],
]

export type VirtualChurchHedgeInstance = {
  position: readonly [number, number, number]
  rotationY: number
  scale: readonly [number, number, number]
  segmentIndex: number
  moduleIndex: number
  moduleCount: number
  toneIndex: number
}

/**
 * Build a slim, curved ribbon leaf for the V3 flax and tussock clumps.
 * Five paired cross-sections keep the silhouette smooth without adding a
 * texture, asset request, material or draw call. A non-zero tip width avoids
 * degenerate triangles and the small sideways drift prevents a flat spear
 * profile when several instanced blades overlap.
 */
export function createVirtualChurchCurvedPlantBladeGeometry(
  height: number,
  baseWidth: number,
  shoulderWidth: number,
  bend: number,
  twist: number,
) {
  const geometry = new BufferGeometry()
  const halfHeight = height / 2
  const sections = [
    { t: 0, width: baseWidth },
    { t: 0.22, width: shoulderWidth },
    { t: 0.48, width: shoulderWidth * 0.78 },
    { t: 0.76, width: shoulderWidth * 0.36 },
    { t: 1, width: Math.max(baseWidth * 0.06, 0.002) },
  ]
  const positions: number[] = []

  for (const { t, width } of sections) {
    const centreX = twist * Math.sin(t * Math.PI * 0.9) * t
    const centreZ = bend * t ** 1.65
    const y = -halfHeight + height * t
    positions.push(
      centreX - width / 2, y, centreZ,
      centreX + width / 2, y, centreZ,
    )
  }

  const indices: number[] = []
  for (let sectionIndex = 0; sectionIndex < sections.length - 1; sectionIndex += 1) {
    const lowerLeft = sectionIndex * 2
    const lowerRight = lowerLeft + 1
    const upperLeft = lowerLeft + 2
    const upperRight = lowerLeft + 3
    indices.push(
      lowerLeft, lowerRight, upperRight,
      lowerLeft, upperRight, upperLeft,
    )
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Convert the photographed frontage hedge lines into overlapping clipped
 * modules. The former 0.5 m scatter exposed every cube; broader aligned
 * modules read as one maintained hedge while preserving the same centreline
 * offset, height envelope and gate opening.
 */
export function createVirtualChurchHedgeInstances(
  segments: readonly VirtualChurchHedgeSegment[],
): VirtualChurchHedgeInstance[] {
  return segments.flatMap(([start, end], segmentIndex) => {
    const dx = end[0] - start[0]
    const dz = end[1] - start[1]
    const length = Math.hypot(dx, dz)
    if (length <= Number.EPSILON) return []
    const angle = Math.atan2(dz, dx)
    const nx = -dz / length
    const nz = dx / length
    const midX = (start[0] + end[0]) / 2
    const midZ = (start[1] + end[1]) / 2
    const normalSign = Math.hypot(midX + nx, midZ + nz) < Math.hypot(midX - nx, midZ - nz) ? 1 : -1
    const moduleCount = Math.max(2, Math.ceil(length / 1.7))
    const step = length / moduleCount

    return Array.from({ length: moduleCount }, (_, moduleIndex) => {
      const t = (moduleIndex + 0.5) / moduleCount
      const localZ = moduleIndex % 2 === 0 ? -0.025 : 0.025
      const height = 0.62 + (segmentIndex % 3) * 0.025 + (moduleIndex % 4 === 0 ? 0.018 : 0)
      return {
        position: [
          start[0] + dx * t + nx * normalSign * -0.62 - Math.sin(angle) * localZ,
          height / 2 - 0.015,
          start[1] + dz * t + nz * normalSign * -0.62 + Math.cos(angle) * localZ,
        ],
        rotationY: -angle,
        scale: [step + 0.24, height, 0.94 + (segmentIndex % 2) * 0.04],
        segmentIndex,
        moduleIndex,
        moduleCount,
        toneIndex: segmentIndex % 3,
      } satisfies VirtualChurchHedgeInstance
    })
  })
}

/**
 * Writes the established nine-blade tussock layout without allocating per
 * instance. Keeping base and dry-accent callbacks separate lets V3 combine all
 * identical accent blades in one InstancedMesh without changing any transform.
 */
export function writeVirtualChurchTussockMatrices(
  placements: readonly VirtualChurchTussockPlacement[],
  rotateBlades: boolean,
  setBaseMatrix?: (index: number, matrix: Matrix4) => void,
  setAccentMatrix?: (index: number, matrix: Matrix4) => void,
) {
  const root = new Object3D()
  const blade = new Object3D()
  const matrix = new Matrix4()
  let baseCount = 0
  let accentCount = 0

  for (const placement of placements) {
    root.position.set(...placement.position)
    root.scale.setScalar(placement.scale ?? 1)
    root.rotation.set(0, placement.rotation ?? 0, 0)
    root.updateMatrix()
    for (let index = 0; index < 9; index += 1) {
      const angle = index * .7
      blade.position.set(Math.cos(angle) * .15, .48, Math.sin(angle) * .15)
      blade.rotation.set(Math.cos(angle) * .38, rotateBlades ? angle : 0, Math.sin(angle) * .38)
      blade.scale.setScalar(1)
      blade.updateMatrix()
      matrix.multiplyMatrices(root.matrix, blade.matrix)
      if (index % 3 === 0) {
        setAccentMatrix?.(accentCount, matrix)
        accentCount += 1
      } else {
        setBaseMatrix?.(baseCount, matrix)
        baseCount += 1
      }
    }
  }

  return { baseCount, accentCount }
}
