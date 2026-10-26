/**
 * Single source of truth for the virtual site's provisional terrain.
 *
 * All values are metres relative to the church platform. This profile is only
 * a temporary fallback until the NZTM2000/NZVD2016 LiDAR crop is committed.
 * Keeping rendering, props, and player collision on this function prevents
 * floating objects and mismatched visual/collision surfaces in the meantime.
 */

import type { TerrainLODLayers } from '../services/virtualChurchService'
import { VIRTUAL_CHURCH_SWALE } from './virtualChurchScene.ts'

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

const distanceToSegment = (x: number, z: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax
  const dz = bz - az
  const lengthSquared = dx * dx + dz * dz
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared))
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t))
}

export const provisionalTerrainHeightAt = (x: number, z: number) => {
  // The verified aerial shows a level developed pad around the church. The
  // only broad fall represented in this fallback is toward the south-west
  // wetland; the former east-side trench was based on a wrong site layout.
  const westFall = smoothstep(-30, -62, x)
  const southFall = smoothstep(-18, -58, z)
  const wetlandFall = -0.42 * westFall * southFall
  const { start, end, crossing } = VIRTUAL_CHURCH_SWALE
  const swaleDistance = distanceToSegment(x, z, ...start, ...end)
  // The driveway culvert crosses the roadside swale before the separate
  // boundary gate farther inside the property.
  const crossingDistance = Math.hypot(x - crossing[0], z - crossing[1])
  const swaleDepth = crossingDistance < 3.2 ? 0 : -0.44 * (1 - smoothstep(0.5, 3.1, swaleDistance))
  return wetlandFall + swaleDepth
}

export const groundedPosition = (x: number, z: number, offset = 0): [number, number, number] => [
  x,
  provisionalTerrainHeightAt(x, z) + offset,
  z,
]

// ── Dynamic terrain LOD ─────────────────────────────────────────────────────

/**
 * Select the grid step (metres between vertices) for a world-space point
 * based on its distance from a reference position (typically the camera).
 *
 * Returns the appropriate step from the supplied LOD layer configuration,
 * choosing the finest resolution inside `highRadius`, the medium resolution
 * inside `mediumRadius`, and the coarsest step beyond.
 */
export const terrainStepForDistance = (
  x: number,
  z: number,
  refX: number,
  refZ: number,
  lod: TerrainLODLayers,
): number => {
  const dist = Math.hypot(x - refX, z - refZ)
  if (dist <= lod.highRadius) return lod.steps.high
  if (dist <= lod.mediumRadius) return lod.steps.medium
  return lod.steps.low
}

/**
 * Build a terrain vertex grid with adaptive resolution based on LOD layers
 * and a reference point (camera position). Vertices closer to the reference
 * use a finer grid step; distant vertices use a coarser step.
 *
 * Returns flat arrays of positions and triangle indices ready for a
 * `BufferGeometry`.
 */
export const buildTerrainLODGrid = (
  min: number,
  max: number,
  lod: TerrainLODLayers,
  refX: number,
  refZ: number,
  yOffset = -0.025,
  outerExtent?: number,
): { positions: number[]; indices: number[] } => {
  // Use the coarsest step as the base grid and subdivide near the camera.
  const baseStep = lod.steps.low
  const width = Math.round((max - min) / baseStep) + 1
  const positions: number[] = []
  const vertexMap = new Map<string, number>()

  const key = (x: number, z: number) => `${x.toFixed(2)},${z.toFixed(2)}`

  const ensureVertex = (x: number, z: number) => {
    const k = key(x, z)
    const existing = vertexMap.get(k)
    if (existing !== undefined) return existing
    const index = positions.length / 3
    positions.push(x, provisionalTerrainHeightAt(x, z) + yOffset, z)
    vertexMap.set(k, index)
    return index
  }

  // Populate base grid
  for (let zi = 0; zi < width; zi++) {
    for (let xi = 0; xi < width; xi++) {
      ensureVertex(min + xi * baseStep, min + zi * baseStep)
    }
  }

  // Subdivide cells that fall within the high/medium radius
  const indices: number[] = []
  for (let zi = 0; zi < width - 1; zi++) {
    for (let xi = 0; xi < width - 1; xi++) {
      const x0 = min + xi * baseStep
      const z0 = min + zi * baseStep
      const x1 = x0 + baseStep
      const z1 = z0 + baseStep
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2

      const cellStep = terrainStepForDistance(cx, cz, refX, refZ, lod)

      // A 4/8 m LOD cell can bridge over a sub-metre channel even when its
      // height function is correct. Sample only the cells touching the cut at
      // 1 m spacing; all their boundary edges outside the cut remain level.
      // This preserves the ordinary LOD elsewhere and adds no draw/material.
      const swaleCell = distanceToSegment(cx, cz, ...VIRTUAL_CHURCH_SWALE.start, ...VIRTUAL_CHURCH_SWALE.end)
        <= 3.1 + baseStep * Math.SQRT2 / 2
      if (swaleCell) {
        const divisions = Math.max(1, Math.ceil(baseStep))
        const step = baseStep / divisions
        for (let iz = 0; iz < divisions; iz++) for (let ix = 0; ix < divisions; ix++) {
          const sx = x0 + ix * step, sz = z0 + iz * step
          const a = ensureVertex(sx, sz), b = ensureVertex(sx + step, sz)
          const c = ensureVertex(sx, sz + step), d = ensureVertex(sx + step, sz + step)
          indices.push(a, c, b, b, c, d)
        }
      } else if (cellStep >= baseStep) {
        // No subdivision – single quad
        const a = ensureVertex(x0, z0)
        const b = ensureVertex(x1, z0)
        const c = ensureVertex(x0, z1)
        const d = ensureVertex(x1, z1)
        indices.push(a, c, b, b, c, d)
      } else {
        // Subdivide into 4 sub-quads
        const mx = (x0 + x1) / 2
        const mz = (z0 + z1) / 2
        const tl = ensureVertex(x0, z0)
        const tr = ensureVertex(x1, z0)
        const bl = ensureVertex(x0, z1)
        const br = ensureVertex(x1, z1)
        const t = ensureVertex(mx, z0)
        const b = ensureVertex(mx, z1)
        const l = ensureVertex(x0, mz)
        const r = ensureVertex(x1, mz)
        const m = ensureVertex(mx, mz)
        indices.push(tl, l, t, t, l, m)
        indices.push(t, m, tr, tr, m, r)
        indices.push(l, bl, m, m, bl, b)
        indices.push(m, b, r, r, b, br)
      }
    }
  }

  // Surroundings extend beyond the detailed church pad. Stitch a coarse
  // skirt to its actual boundary vertices so moving the camera toward the
  // edge cannot expose the sky underneath neighbouring buildings. Reuse the
  // inner grid and material rather than tessellating the whole context area.
  if (outerExtent !== undefined && outerExtent > Math.max(Math.abs(min), Math.abs(max))) {
    const centre = (min + max) / 2
    const boundary = Array.from(vertexMap.values()).filter((index) => {
      const x = positions[index * 3]
      const z = positions[index * 3 + 2]
      return x === min || x === max || z === min || z === max
    }).sort((a, b) => (
      Math.atan2(positions[a * 3 + 2] - centre, positions[a * 3] - centre)
      - Math.atan2(positions[b * 3 + 2] - centre, positions[b * 3] - centre)
    ))
    const outer = boundary.map((index) => {
      const x = positions[index * 3] - centre
      const z = positions[index * 3 + 2] - centre
      const scale = outerExtent / Math.max(Math.abs(x), Math.abs(z))
      return ensureVertex(centre + x * scale, centre + z * scale)
    })
    boundary.forEach((a, index) => {
      const next = (index + 1) % boundary.length
      const b = boundary[next]
      indices.push(a, b, outer[index], b, outer[next], outer[index])
    })
  }

  return { positions, indices }
}
