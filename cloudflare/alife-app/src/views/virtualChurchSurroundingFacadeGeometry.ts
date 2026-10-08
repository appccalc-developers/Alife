import {
  virtualChurchPointInsidePolygon,
  type VirtualChurchSurroundingBuilding,
} from './virtualChurchInteractionContract.ts'
import { BufferGeometry, Color, Float32BufferAttribute, Shape, ShapeGeometry } from 'three'
import { ALIFE_V3_ENVIRONMENT_TREATMENT } from './alifeVisualTheme.ts'

export type VirtualChurchFacadeFrame = {
  start: [number, number]
  end: [number, number]
  length: number
  rotation: [number, number, number]
  tangent: [number, number]
  outward: [number, number]
}

export type VirtualChurchRoofBandSegment = {
  start: [number, number]
  end: [number, number]
}

export type VirtualChurchHardstandStrip = {
  frame: VirtualChurchFacadeFrame
  width: number
  edgeIndex: number
}

/** Photo-constrained front of 117 The Runway, shared by both quality paths.
 * Photos establish pale wall / grey upper ribbon / small copper-colour awning.
 * The module count and dimensions below remain visual approximations, not survey data.
 */
export const virtualChurchOfficeRibbonPanels = (building: VirtualChurchSurroundingBuilding) => {
  const frame = virtualChurchSurroundingFacadeFrame(building)
  if (!frame || building.feature !== 'ribbon-office') return []
  type Panel = { kind: 'band' | 'glass' | 'canopy'; t: number; y: number; width: number; height: number; depth: number; outset: number }
  const panels: Panel[] = [{ kind: 'band', t: .5, y: 4.75, width: frame.length * .92, height: 1.3, depth: .12, outset: .1 }]
  const count = building.featureBayCount ?? 6
  for (const [y, start, end, amount] of [[4.75, .06, .94, count], [1.8, .24, .94, count - 1]]) {
    for (let index = 0; index < amount; index++) panels.push({
      kind: 'glass', t: start + (end - start) * (index + .5) / amount, y,
      width: frame.length * (end - start) / amount * .88, height: y > 3 ? .95 : .9,
      depth: .1, outset: .19,
    })
  }
  panels.push(
    { kind: 'glass', t: .12, y: 1.15, width: 1.1, height: 2.2, depth: .1, outset: .19 },
    { kind: 'canopy', t: .12, y: 2.43, width: 1.65, height: .14, depth: .85, outset: .46 },
  )
  return panels
}

/**
 * Resolve a stable tangent and exterior normal for one authoritative footprint
 * edge. Facade details use the normal so cladding, canopies and glazing sit
 * outside the collision shell rather than through the wall volume.
 */
export const virtualChurchSurroundingEdgeFrame = (
  building: VirtualChurchSurroundingBuilding,
  startIndex: number,
  endIndex: number,
): VirtualChurchFacadeFrame | null => {
  const start = building.footprint[startIndex]
  const end = building.footprint[endIndex]
  if (!start || !end) return null
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const length = Math.hypot(dx, dz)
  if (length <= Number.EPSILON) return null

  const tangent: [number, number] = [dx / length, dz / length]
  let outward: [number, number] = [-tangent[1], tangent[0]]
  const midpoint: [number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
  ]
  if (virtualChurchPointInsidePolygon(
    building.footprint,
    midpoint[0] + outward[0] * 0.24,
    midpoint[1] + outward[1] * 0.24,
  )) {
    outward = [-outward[0], -outward[1]]
  }

  return {
    start,
    end,
    length,
    rotation: [0, -Math.atan2(dz, dx), 0],
    tangent,
    outward,
  }
}

export const virtualChurchSurroundingFacadeFrame = (
  building: VirtualChurchSurroundingBuilding,
): VirtualChurchFacadeFrame | null => {
  if (!building.featureEdge) return null
  return virtualChurchSurroundingEdgeFrame(building, ...building.featureEdge)
}

/** The mapped outline includes 117 The Runway's open loading canopy.
 * Gallery photos 1–3 establish that the four-point side projection is a lower,
 * cantilevered roof, not a full-height enclosed room. Keep the mapped outline
 * for collision/site contracts; split only its visual shell. Heights, door
 * spacing and thickness remain estimates, and neighbouring interiors stay closed.
 */
export function virtualChurchSurroundingStructure(building: VirtualChurchSurroundingBuilding) {
  if (building.id !== 'far-north-industrial-complex' || building.sourceWayId !== '1170948415') {
    return { wallFootprint: building.footprint, flatRoofFootprint: building.footprint, gable: null, canopy: null }
  }
  const wallFootprint = building.footprint.filter((_, index) => index !== 11 && index !== 12)
  const wallFrame = virtualChurchSurroundingEdgeFrame({ ...building, footprint: wallFootprint }, 10, 11)!
  const point = (index: number) => building.footprint[index]
  const midpoint = (a: number, b: number): [number, number] => [(point(a)[0] + point(b)[0]) / 2, (point(a)[1] + point(b)[1]) / 2]
  const frontRidge = midpoint(14, 15), rearRidge = midpoint(9, 16)
  return {
    wallFootprint,
    // Bayleys listing 5529745 aerial: only the street warehouse is gabled.
    // Retain the mapped side jogs, rear complex and collision outline. The
    // 0.8 m rise is a visual estimate, not a measured pitch or building height.
    flatRoofFootprint: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 16, 17, 18, 19].map(point),
    gable: {
      frontRidge, rearRidge, rise: .8,
      halves: [[point(9), point(10), point(13), point(14), frontRidge, rearRidge], [rearRidge, frontRidge, point(15), point(16)]],
      ends: [[point(14), point(15), frontRidge], [point(16), point(9), rearRidge]],
    },
    canopy: {
      footprint: [13, 12, 11, 10].map(index => building.footprint[index]),
      height: building.height * .74,
      thickness: .18,
      wallFrame,
      doors: [.2, .5, .8].map(t => ({ t, width: 4.2, height: 4.5 })),
    },
  }
}

/** Every perimeter edge retains the OSM footprint direction while receiving
 * an independently verified exterior normal. This lets distant and secondary
 * walls carry restrained cladding scale without inventing extra doors/windows. */
export const virtualChurchSurroundingPerimeterFrames = (
  building: VirtualChurchSurroundingBuilding,
) => building.footprint.flatMap((_, startIndex) => {
  const frame = virtualChurchSurroundingEdgeFrame(
    building,
    startIndex,
    (startIndex + 1) % building.footprint.length,
  )
  return frame ? [frame] : []
})

/**
 * Add a restrained hard-surface seam around neighbouring industrial shells so
 * they do not appear to sit directly on the shared grass plane. The feature
 * edge of the east warehouse borders the user-approved church parking layout,
 * so that one edge is deliberately omitted rather than repainting any bay or
 * drive aisle as neighbouring property.
 */
export const virtualChurchSurroundingHardstandStrips = (
  building: VirtualChurchSurroundingBuilding,
): VirtualChurchHardstandStrip[] => {
  const width = building.detail === 'near'
    ? 1.35
    : building.detail === 'mid'
      ? 1.1
      : 0.85

  return building.footprint.flatMap((_, edgeIndex) => {
    const endIndex = (edgeIndex + 1) % building.footprint.length
    const protectsApprovedParking = building.id === 'east-logistics-warehouse'
      && building.featureEdge?.[0] === edgeIndex
      && building.featureEdge[1] === endIndex
    if (protectsApprovedParking) return []
    const frame = virtualChurchSurroundingEdgeFrame(building, edgeIndex, endIndex)
    return frame ? [{ frame, width, edgeIndex }] : []
  })
}

/**
 * Create a small number of footprint-clipped roof tone bands parallel to the
 * building's longest authoritative edge. The 2025 aerial shows broad metal
 * roof-sheet rhythms; these segments express that scale without claiming an
 * exact skylight count, roof pitch or rooftop equipment.
 */
export const virtualChurchSurroundingRoofBandSegments = (
  building: VirtualChurchSurroundingBuilding,
): VirtualChurchRoofBandSegment[] => {
  const frames = virtualChurchSurroundingPerimeterFrames(building)
  const longest = frames.reduce<VirtualChurchFacadeFrame | null>(
    (current, frame) => !current || frame.length > current.length ? frame : current,
    null,
  )
  if (!longest) return []

  const axis = longest.tangent
  const crossAxis: [number, number] = [-axis[1], axis[0]]
  const crossProjections = building.footprint.map(([x, z]) => x * crossAxis[0] + z * crossAxis[1])
  const minCross = Math.min(...crossProjections)
  const maxCross = Math.max(...crossProjections)
  const crossSpan = maxCross - minCross
  const preferredSpacing = building.detail === 'silhouette' ? 13 : 10.5
  const lineCount = Math.max(1, Math.min(8, Math.floor(crossSpan / preferredSpacing)))
  const endpointInset = 0.65
  const segments: VirtualChurchRoofBandSegment[] = []

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const cross = minCross + crossSpan * ((lineIndex + 1) / (lineCount + 1))
    const intersections: Array<{ point: [number, number]; along: number }> = []
    for (let edgeIndex = 0; edgeIndex < building.footprint.length; edgeIndex += 1) {
      const start = building.footprint[edgeIndex]
      const end = building.footprint[(edgeIndex + 1) % building.footprint.length]
      const startDistance = start[0] * crossAxis[0] + start[1] * crossAxis[1] - cross
      const endDistance = end[0] * crossAxis[0] + end[1] * crossAxis[1] - cross
      if ((startDistance > 0) === (endDistance > 0)) continue
      const t = startDistance / (startDistance - endDistance)
      const point: [number, number] = [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
      ]
      intersections.push({ point, along: point[0] * axis[0] + point[1] * axis[1] })
    }

    intersections.sort((a, b) => a.along - b.along)
    for (let pairIndex = 0; pairIndex + 1 < intersections.length; pairIndex += 2) {
      const first = intersections[pairIndex]
      const second = intersections[pairIndex + 1]
      const length = second.along - first.along
      if (length <= endpointInset * 2 + 1) continue
      segments.push({
        start: [
          first.point[0] + axis[0] * endpointInset,
          first.point[1] + axis[1] * endpointInset,
        ],
        end: [
          second.point[0] - axis[0] * endpointInset,
          second.point[1] - axis[1] * endpointInset,
        ],
      })
    }
  }

  return segments
}

export const virtualChurchFacadePointAt = (
  frame: VirtualChurchFacadeFrame,
  t: number,
  outset = 0,
): [number, number] => [
  frame.start[0] + (frame.end[0] - frame.start[0]) * t + frame.outward[0] * outset,
  frame.start[1] + (frame.end[1] - frame.start[1]) * t + frame.outward[1] * outset,
]

/** The east near-field facade faces the approved main car park. Giving it a
 * separate pad would visually repaint confirmed parking geometry, so only the
 * detached northern roller-door facade receives an authored loading pad. */
export const virtualChurchSurroundingFacadeUsesLoadingPad = (
  building: VirtualChurchSurroundingBuilding,
) => building.feature === 'roller-doors' && building.id !== 'east-logistics-warehouse'

/** Low keeps the same structural shell and primary facade layout as desktop,
 * with opaque flat panels in one vertex-coloured wall batch and one roof batch.
 * No per-window draw calls, textures, transmission, interiors or moving parts.
 * Caller owns both geometries. Desktop detailed geometry is not replaced.
 */
export function createVirtualChurchMobileSurroundings(buildings: readonly VirtualChurchSurroundingBuilding[], primaryFacadePanels = true) {
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.industrialContext
  const walls: number[] = [], wallColors: number[] = []
  const roofs: number[] = [], roofColors: number[] = []
  const color = new Color()
  const appendColors = (target: number[], hex: string, vertices: number) => {
    color.set(hex)
    for (let i = 0; i < vertices; i++) target.push(color.r, color.g, color.b)
  }
  const panel = (frame: VirtualChurchFacadeFrame, t: number, y: number, width: number, height: number, outset: number, hex: string) => {
    const [x, z] = virtualChurchFacadePointAt(frame, t, outset)
    const tx = frame.tangent[0] * width / 2, tz = frame.tangent[1] * width / 2
    const points = [
      [x - tx, y - height / 2, z - tz], [x + tx, y - height / 2, z + tz],
      [x + tx, y + height / 2, z + tz], [x - tx, y + height / 2, z - tz],
    ]
    const facesOutward = -frame.tangent[1] * frame.outward[0] + frame.tangent[0] * frame.outward[1] > 0
    for (const index of facesOutward ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) walls.push(...points[index])
    appendColors(wallColors, hex, 6)
  }
  const horizontal = (points: Array<[number, number]>, y: number, hex: string, target = roofs, colors = roofColors, underside = false, heightAt?: (x: number, z: number) => number) => {
    const shape = new Shape()
    points.forEach(([x, z], i) => i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z))
    shape.closePath()
    const indexed = new ShapeGeometry(shape), geometry = indexed.toNonIndexed()
    indexed.dispose()
    geometry.rotateX(-Math.PI / 2).translate(0, y, 0)
    const p = geometry.getAttribute('position')
    for (let i = 0; i < p.count; i += 3) {
      for (const v of underside ? [i, i + 2, i + 1] : [i, i + 1, i + 2]) target.push(p.getX(v), heightAt?.(p.getX(v), p.getZ(v)) ?? p.getY(v), p.getZ(v))
    }
    appendColors(colors, hex, p.count)
    geometry.dispose()
  }
  for (const building of buildings) {
    const { wallFootprint, flatRoofFootprint, gable, canopy } = virtualChurchSurroundingStructure(building)
    const wallColor = treatment[`${building.tone}Wall`]
    const frames = virtualChurchSurroundingPerimeterFrames({ ...building, footprint: wallFootprint })
    for (const frame of frames) {
      panel(frame, .5, building.height / 2, frame.length, building.height, 0, wallColor)
      panel(frame, .5, building.height - .12, frame.length, .24, .06, treatment.roofTrim)
      panel(frame, .5, .16, frame.length, .32, .03, treatment.greyAccent)
    }
    horizontal(flatRoofFootprint, building.height + .035, building.tone === 'grey' ? treatment.auxiliaryRoof : treatment.roofLight)
    if (gable) {
      const eave = building.height + .035
      const start = roofs.length
      for (const half of gable.halves) horizontal(half, eave, treatment.roofLight, roofs, roofColors, false,
        (x, z) => eave + ([gable.frontRidge, gable.rearRidge].some(p => Math.hypot(p[0] - x, p[1] - z) < .0001) ? gable.rise : 0))
      for (const [a, b, ridge] of gable.ends) {
        // Same perimeter direction as the wall; the back closes the step
        // down to the unsurveyed rear complex rather than leaving a roof gap.
        const frame = virtualChurchSurroundingFacadeFrame(building)!
        const outward = -frame.tangent[1] * frame.outward[0] + frame.tangent[0] * frame.outward[1] > 0
        const vertices = [a, b]
        for (const index of outward ? [0, 1] : [1, 0]) walls.push(vertices[index][0], building.height, vertices[index][1])
        walls.push(ridge[0], eave + gable.rise, ridge[1])
        appendColors(wallColors, wallColor, 3)
      }
      // Photo-informed cross-roof rhythm. Clip colour strips to the actual
      // slope triangles so they cannot float above, sink into or bridge roofs.
      // These share the wall batch in both quality paths; no new material/draw.
      type Vertex = [number, number, number]
      const dx = gable.rearRidge[0] - gable.frontRidge[0], dz = gable.rearRidge[1] - gable.frontRidge[1]
      const length = Math.hypot(dx, dz)
      const distance = (p: Vertex) => ((p[0] - gable.frontRidge[0]) * dx + (p[2] - gable.frontRidge[1]) * dz) / length
      const clip = (polygon: Vertex[], limit: number, keepAbove: boolean): Vertex[] => polygon.flatMap((a, i) => {
        const b = polygon[(i + 1) % polygon.length], da = distance(a) - limit, db = distance(b) - limit
        const insideA = keepAbove ? da >= 0 : da <= 0, insideB = keepAbove ? db >= 0 : db <= 0
        const result: Vertex[] = insideA ? [a] : []
        if (insideA !== insideB) {
          const t = da / (da - db)
          result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
        }
        return result
      })
      for (let stripe = 1; stripe <= 7; stripe++) {
        const centre = length * stripe / 8
        for (let offset = start; offset < roofs.length; offset += 9) {
          const triangle = [0, 3, 6].map(i => roofs.slice(offset + i, offset + i + 3) as Vertex)
          const polygon = clip(clip(triangle, centre - .28, true), centre + .28, false)
          for (let i = 1; i + 1 < polygon.length; i++) {
            for (const p of [polygon[0], polygon[i], polygon[i + 1]]) walls.push(p[0], p[1] + .014, p[2])
            appendColors(wallColors, treatment.roofBandLight, 3)
          }
        }
      }
    }
    if (canopy) {
      horizontal(canopy.footprint, canopy.height, treatment.roofLight)
      horizontal(canopy.footprint, canopy.height - canopy.thickness, treatment.roofTrim, walls, wallColors, true)
      horizontal(canopy.footprint, .028, treatment.serviceApron, walls, wallColors)
      // No front posts: the photographed beams cantilever from the warehouse.
      for (const edge of virtualChurchSurroundingPerimeterFrames({ ...building, footprint: canopy.footprint })) {
        panel(edge, .5, canopy.height - canopy.thickness / 2, edge.length, canopy.thickness, 0, treatment.roofTrim)
      }
      for (const door of canopy.doors) {
        panel(canopy.wallFrame, door.t, door.height / 2, door.width + .18, door.height + .16, .04, treatment.roofTrim)
        panel(canopy.wallFrame, door.t, door.height / 2, door.width, door.height, .055, treatment.rollerDoor)
      }
    }

    const frame = virtualChurchSurroundingFacadeFrame(building)
    if (!frame || !primaryFacadePanels) continue
    const count = building.featureBayCount ?? Math.max(2, Math.min(6, Math.floor(frame.length / 6.4)))
    if (building.feature === 'ribbon-office') {
      for (const item of virtualChurchOfficeRibbonPanels(building)) {
        panel(frame, item.t, item.y, item.width, item.height, item.outset + item.depth / 2,
          item.kind === 'band' ? treatment.greyAccent : item.kind === 'canopy' ? treatment.entryOrange : treatment.glass)
      }
    } else if (building.feature === 'office-glazing') {
      // Same front-face positions and window modules as the desktop boxes.
      const start = .08, end = .92
      const height = Math.min(6.8, building.height * .74)
      const windowCount = Math.max(5, Math.min(8, count + 1))
      const windowWidth = Math.min(3.4, frame.length * .7 / windowCount)
      panel(frame, .5, height / 2 + .38, frame.length * (end - start), height, .21, treatment.greyAccent)
      for (const y of [2.35, 5.15]) {
        for (let i = 0; i < windowCount; i++) {
          panel(frame, start + (end - start) * (i + .5) / windowCount, y, windowWidth, 1.45, .29, treatment.glass)
        }
      }
    } else if (building.feature === 'window-band') {
      panel(frame, .5, building.height * .58, frame.length * .88, 2.05, .19, treatment[`${building.tone}Accent`])
      const windowCount = count + 1
      for (let i = 0; i < windowCount; i++) {
        panel(frame, (i + 1) / (windowCount + 1), building.height * .58,
          Math.min(1.3, frame.length / (windowCount + 2) * .72), 1.55, .26, treatment.glass)
      }
    } else if (building.feature === 'roller-doors') {
      for (let i = 0; i < count; i++) {
        panel(frame, (i + 1) / (count + 1), Math.min(2.15, building.height * .27),
          Math.min(4.6, frame.length / (count + 1) * .68), Math.min(4.3, building.height * .54), .25, treatment.rollerDoor)
      }
    }
  }
  const geometry = (positions: number[], colors: number[]) => {
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(positions, 3))
    result.setAttribute('color', new Float32BufferAttribute(colors, 3))
    result.computeVertexNormals()
    result.computeBoundingBox()
    result.computeBoundingSphere()
    return result
  }
  return { walls: geometry(walls, wallColors), roofs: geometry(roofs, roofColors) }
}
