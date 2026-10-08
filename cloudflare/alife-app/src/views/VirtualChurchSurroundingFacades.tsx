import { useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Object3D } from 'three'
import { ALIFE_V3_ENVIRONMENT_TREATMENT } from './alifeVisualTheme'
import {
  VIRTUAL_CHURCH_SURROUNDING_BUILDINGS,
  type VirtualChurchSurroundingBuilding,
  type VirtualChurchSurroundingBuildingTone,
} from './virtualChurchInteractionContract'
import {
  virtualChurchFacadePointAt,
  virtualChurchOfficeRibbonPanels,
  virtualChurchSurroundingFacadeFrame,
  virtualChurchSurroundingFacadeUsesLoadingPad,
  virtualChurchSurroundingHardstandStrips,
  virtualChurchSurroundingPerimeterFrames,
  virtualChurchSurroundingRoofBandSegments,
  virtualChurchSurroundingStructure,
  type VirtualChurchFacadeFrame,
} from './virtualChurchSurroundingFacadeGeometry'

type BoxInstance = {
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
}

const InstancedBoxSet = ({
  items,
  color,
  roughness,
  metalness,
  castShadow = false,
  receiveShadow = true,
}: {
  items: BoxInstance[]
  color: string
  roughness: number
  metalness: number
  castShadow?: boolean
  receiveShadow?: boolean
}) => {
  const meshRef = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const transform = new Object3D()
    items.forEach((item, index) => {
      transform.position.set(...item.position)
      transform.rotation.set(...(item.rotation ?? [0, 0, 0]))
      transform.scale.set(...item.scale)
      transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])

  if (items.length === 0) return null
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </instancedMesh>
  )
}

const edgeBox = (
  start: [number, number],
  end: [number, number],
  y: number,
  height: number,
  depth: number,
): BoxInstance => {
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  return {
    position: [(start[0] + end[0]) / 2, y, (start[1] + end[1]) / 2],
    rotation: [0, -Math.atan2(dz, dx), 0],
    scale: [Math.hypot(dx, dz), height, depth],
  }
}

const framedBox = (
  frame: VirtualChurchFacadeFrame,
  y: number,
  height: number,
  depth: number,
  outset: number,
  startT = 0,
  endT = 1,
): BoxInstance => {
  const [x, z] = virtualChurchFacadePointAt(frame, (startT + endT) / 2, outset)
  return {
    position: [x, y, z],
    rotation: frame.rotation,
    scale: [frame.length * (endT - startT), height, depth],
  }
}

const SURROUNDING_TONES: VirtualChurchSurroundingBuildingTone[] = ['silver', 'pale', 'grey']

type ToneBoxInstances = Record<VirtualChurchSurroundingBuildingTone, BoxInstance[]>

type SurroundingFacadeBatches = {
  roofTrim: BoxInstance[]
  foundationTrim: BoxInstance[]
  eaveShadows: BoxInstance[]
  secondaryCladdingRibs: ToneBoxInstances
  primaryCladdingRibs: ToneBoxInstances
  accentSurfaces: ToneBoxInstances
  wallRhythmBays: ToneBoxInstances
  officeBackdrops: BoxInstance[]
  officeRibbonBands: BoxInstance[]
  entryAccents: BoxInstance[]
  windowGlass: BoxInstance[]
  rollerDoorBays: BoxInstance[]
  rollerSlats: BoxInstance[]
  doorJambs: BoxInstance[]
  doorCanopies: BoxInstance[]
  loadingPads: BoxInstance[]
}

const createToneBoxInstances = (): ToneBoxInstances => ({ silver: [], pale: [], grey: [] })

const createSurroundingFacadeBatches = (): SurroundingFacadeBatches => {
  const batches: SurroundingFacadeBatches = {
    roofTrim: [],
    foundationTrim: [],
    eaveShadows: [],
    secondaryCladdingRibs: createToneBoxInstances(),
    primaryCladdingRibs: createToneBoxInstances(),
    accentSurfaces: createToneBoxInstances(),
    wallRhythmBays: createToneBoxInstances(),
    officeBackdrops: [],
    officeRibbonBands: [],
    entryAccents: [],
    windowGlass: [],
    rollerDoorBays: [],
    rollerSlats: [],
    doorJambs: [],
    doorCanopies: [],
    loadingPads: [],
  }

  VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.forEach((building: VirtualChurchSurroundingBuilding) => {
  const { wallFootprint, canopy } = virtualChurchSurroundingStructure(building)
  if (canopy) {
    // Photos show copper/orange cantilever beams, not columns into the yard.
    // Spacing remains estimated; Low keeps only the shared roof/door silhouette.
    for (const t of [.04, .27, .5, .73, .96]) {
      batches.entryAccents.push(framedBox(canopy.wallFrame, canopy.height - .24, .26, 4.2, 2.1,
        t - .1 / canopy.wallFrame.length, t + .1 / canopy.wallFrame.length))
    }
    for (const door of canopy.doors) for (let row = 1; row <= 5; row++) {
      batches.rollerSlats.push(framedBox(canopy.wallFrame, door.height * row / 6, .045, .045, .085,
        door.t - door.width / canopy.wallFrame.length / 2, door.t + door.width / canopy.wallFrame.length / 2))
    }
  }
  const perimeterFrames = virtualChurchSurroundingPerimeterFrames({ ...building, footprint: wallFootprint })
  batches.roofTrim.push(...wallFootprint.map((point, index) => edgeBox(
    point,
    wallFootprint[(index + 1) % wallFootprint.length],
    building.height + 0.12,
    0.24,
    0.32,
  )))
  batches.foundationTrim.push(...wallFootprint.map((point, index) => edgeBox(
    point,
    wallFootprint[(index + 1) % wallFootprint.length],
    0.2,
    0.4,
    0.34,
  )))
  const secondaryFrames = perimeterFrames.filter(frame => {
    const isFront = building.featureEdge && frame.start === building.footprint[building.featureEdge[0]] && frame.end === building.footprint[building.featureEdge[1]]
    const isLoading = canopy && frame.start === canopy.wallFrame.start && frame.end === canopy.wallFrame.end
    return !isFront && !isLoading
  })
  batches.secondaryCladdingRibs[building.tone].push(...secondaryFrames.flatMap((sideFrame) => {
    const spacing = building.detail === 'silhouette' ? 4.2 : 2.7
    const ribCount = Math.max(2, Math.min(28, Math.floor(sideFrame.length / spacing)))
    return Array.from({ length: ribCount }, (_, index): BoxInstance => {
      const [x, z] = virtualChurchFacadePointAt(
        sideFrame,
        (index + 0.5) / ribCount,
        0.105,
      )
      return {
        position: [x, building.height * 0.52, z],
        rotation: sideFrame.rotation,
        scale: [0.026, building.height * 0.76, 0.045],
      }
    })
  }))

  if (building.detail === 'silhouette' && !building.featureEdge) {
    return
  }

  const frame = virtualChurchSurroundingFacadeFrame(building)
  if (!frame) return
  const count = building.featureBayCount
    ?? Math.max(2, Math.min(6, Math.floor(frame.length / 6.4)))
  const claddingRibSpacing = building.detail === 'silhouette' ? 2.1 : 1.25
  // The photographed office front is smooth; do not carry the generic warehouse ribs over it.
  const claddingRibCount = building.feature === 'ribbon-office' ? 0 : Math.max(8, Math.min(46, Math.floor(frame.length / claddingRibSpacing)))
  batches.primaryCladdingRibs[building.tone].push(...Array.from({ length: claddingRibCount }, (_, index): BoxInstance => {
    const [x, z] = virtualChurchFacadePointAt(
      frame,
      (index + 0.5) / claddingRibCount,
      0.12,
    )
    return {
      position: [x, building.height * 0.51, z],
      rotation: frame.rotation,
      scale: [0.035, building.height * 0.82, 0.08],
    }
  }))
  batches.eaveShadows.push(framedBox(frame, building.height - 0.28, 0.16, 0.2, 0.11))

  if (building.feature === 'office-glazing') {
    const officeStart = 0.08
    const officeEnd = 0.92
    const windowCount = Math.max(5, Math.min(8, count + 1))
    const windowWidth = Math.min(3.4, frame.length * 0.7 / windowCount)
    const officeHeight = Math.min(6.8, building.height * 0.74)
    const officeCentreY = officeHeight / 2 + 0.38

    batches.officeBackdrops.push(
      framedBox(
        frame,
        officeCentreY,
        officeHeight,
        0.16,
        0.13,
        officeStart,
        officeEnd,
      ),
    )
    batches.windowGlass.push(...[2.35, 5.15].flatMap((y) => (
      Array.from({ length: windowCount }, (_, index): BoxInstance => {
        const t = officeStart + (officeEnd - officeStart) * ((index + 0.5) / windowCount)
        const [x, z] = virtualChurchFacadePointAt(frame, t, 0.235)
        return {
          position: [x, y, z],
          rotation: frame.rotation,
          scale: [windowWidth, 1.45, 0.11],
        }
      })
    )))
    batches.doorJambs.push(...Array.from({ length: windowCount + 1 }, (_, index): BoxInstance => {
      const t = officeStart + (officeEnd - officeStart) * (index / windowCount)
      const [x, z] = virtualChurchFacadePointAt(frame, t, 0.25)
      return {
        position: [x, officeCentreY, z],
        rotation: frame.rotation,
        scale: [0.15, officeHeight + 0.18, 0.18],
      }
    }))
    batches.doorCanopies.push(
      framedBox(frame, 3.45, 0.13, 0.72, 0.52, officeStart, officeEnd),
      framedBox(frame, 6.24, 0.14, 0.82, 0.54, officeStart, officeEnd),
    )
    return
  }

  if (building.feature === 'ribbon-office') {
    for (const panel of virtualChurchOfficeRibbonPanels(building)) {
      const [x, z] = virtualChurchFacadePointAt(frame, panel.t, panel.outset)
      const item: BoxInstance = { position: [x, panel.y, z], rotation: frame.rotation, scale: [panel.width, panel.height, panel.depth] }
      if (panel.kind === 'band') batches.officeRibbonBands.push(item)
      else if (panel.kind === 'canopy') batches.entryAccents.push(item)
      else batches.windowGlass.push(item)
    }
    return
  }

  if (building.feature === 'window-band') {
    batches.accentSurfaces[building.tone].push(
      framedBox(frame, building.height * 0.58, 2.05, 0.14, 0.12, 0.06, 0.94),
    )
    const windowCount = count + 1
    const bayWidth = Math.min(1.3, frame.length / (windowCount + 2) * 0.72)
    batches.windowGlass.push(...Array.from({ length: windowCount }, (_, index): BoxInstance => {
      const [x, z] = virtualChurchFacadePointAt(
        frame,
        (index + 1) / (windowCount + 1),
        0.2,
      )
      return {
        position: [x, building.height * 0.58, z],
        rotation: frame.rotation,
        scale: [bayWidth, 1.55, 0.12],
      }
    }))
    return
  }

  const isDoor = building.feature === 'roller-doors'
  const doorHeight = Math.min(4.3, building.height * 0.54)
  const doorCentreY = Math.min(2.15, building.height * 0.27)
  const bayWidth = Math.min(4.6, frame.length / (count + 1) * 0.68)
  const bays: BoxInstance[] = Array.from({ length: count }, (_, index) => {
    const t = (index + 1) / (count + 1)
    const [x, z] = virtualChurchFacadePointAt(frame, t, 0.16)
    return {
      position: [x, isDoor ? doorCentreY : building.height * 0.52, z],
      rotation: frame.rotation,
      scale: [isDoor ? bayWidth : 0.12, isDoor ? doorHeight : building.height * 0.76, 0.18],
    }
  })
  const slats: BoxInstance[] = isDoor
    ? Array.from({ length: count * 5 }, (_, index) => {
        const doorIndex = Math.floor(index / 5)
        const slatIndex = index % 5
        const t = (doorIndex + 1) / (count + 1)
        const [x, z] = virtualChurchFacadePointAt(frame, t, 0.265)
        return {
          position: [x, 0.42 + (doorHeight - 0.45) * ((slatIndex + 1) / 6), z],
          rotation: frame.rotation,
          scale: [bayWidth, 0.055, 0.205],
        }
      })
    : []
  const doorCanopies: BoxInstance[] = isDoor
    ? Array.from({ length: count }, (_, index) => {
        const [x, z] = virtualChurchFacadePointAt(frame, (index + 1) / (count + 1), 0.58)
        return {
          position: [x, doorCentreY + doorHeight / 2 + 0.18, z],
          rotation: frame.rotation,
          scale: [bayWidth + 0.5, 0.16, 1.05],
        }
      })
    : []
  const doorJambs: BoxInstance[] = isDoor
    ? Array.from({ length: count * 2 }, (_, index) => {
        const doorIndex = Math.floor(index / 2)
        const direction = index % 2 === 0 ? -1 : 1
        const t = (doorIndex + 1) / (count + 1)
        const [centreX, centreZ] = virtualChurchFacadePointAt(frame, t, 0.25)
        return {
          position: [
            centreX + frame.tangent[0] * direction * (bayWidth / 2 + 0.09),
            doorCentreY,
            centreZ + frame.tangent[1] * direction * (bayWidth / 2 + 0.09),
          ],
          rotation: frame.rotation,
          scale: [0.15, doorHeight + 0.24, 0.24],
        }
      })
    : []
  const loadingPads: BoxInstance[] = virtualChurchSurroundingFacadeUsesLoadingPad(building)
    ? Array.from({ length: count }, (_, index) => {
        const [x, z] = virtualChurchFacadePointAt(frame, (index + 1) / (count + 1), 1.15)
        return {
          position: [x, 0.035, z],
          rotation: frame.rotation,
          scale: [bayWidth + 0.6, 0.07, 2.3],
        }
      })
    : []

  batches.accentSurfaces[building.tone].push(
    framedBox(frame, building.height * 0.78, 0.28, 0.2, 0.12),
  )
  batches.loadingPads.push(...loadingPads)
  if (isDoor) {
    batches.rollerDoorBays.push(...bays)
    batches.rollerSlats.push(...slats)
    batches.doorJambs.push(...doorJambs)
    batches.doorCanopies.push(...doorCanopies)
  } else {
    batches.wallRhythmBays[building.tone].push(...bays)
  }
  })

  return batches
}

const VirtualChurchSurroundingFacades = () => {
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.industrialContext
  const facadeBatches = useMemo(createSurroundingFacadeBatches, [])
  const toneMaterials = {
    silver: { joint: treatment.silverJoint, accent: treatment.silverAccent },
    pale: { joint: treatment.paleJoint, accent: treatment.paleAccent },
    grey: { joint: treatment.greyJoint, accent: treatment.greyAccent },
  } satisfies Record<VirtualChurchSurroundingBuildingTone, { joint: string; accent: string }>
  const hardstandAprons = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.flatMap((building) => (
    virtualChurchSurroundingHardstandStrips(building).map(({ frame, width }) => (
      framedBox(frame, 0.026, 0.052, width, width / 2)
    ))
  ))
  const lightRoofBands = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS
    .filter(({ tone }) => tone !== 'grey')
    .flatMap((building) => virtualChurchSurroundingRoofBandSegments({ ...building, footprint: virtualChurchSurroundingStructure(building).flatRoofFootprint }).map(({ start, end }) => (
      edgeBox(start, end, building.height + 0.075, 0.035, 0.72)
    )))
  const greyRoofBands = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS
    .filter(({ tone }) => tone === 'grey')
    .flatMap((building) => virtualChurchSurroundingRoofBandSegments(building).map(({ start, end }) => (
      edgeBox(start, end, building.height + 0.075, 0.035, 0.72)
    )))

  return (
    <group>
      <InstancedBoxSet items={hardstandAprons} color={treatment.serviceApron} roughness={0.96} metalness={0.02} receiveShadow />
      <InstancedBoxSet items={lightRoofBands} color={treatment.roofBandLight} roughness={0.78} metalness={0.18} />
      <InstancedBoxSet items={greyRoofBands} color={treatment.roofBandGrey} roughness={0.8} metalness={0.16} />
      <InstancedBoxSet items={facadeBatches.loadingPads} color={treatment.loadingPad} roughness={0.96} metalness={0.02} />
      <InstancedBoxSet items={facadeBatches.roofTrim} color={treatment.roofTrim} roughness={0.7} metalness={0.3} />
      <InstancedBoxSet items={facadeBatches.foundationTrim} color={treatment.greyAccent} roughness={0.86} metalness={0.1} />
      <InstancedBoxSet items={facadeBatches.eaveShadows} color={treatment.roofTrim} roughness={0.72} metalness={0.24} />
      {SURROUNDING_TONES.map((tone) => (
        <InstancedBoxSet
          key={`${tone}-secondary-ribs`}
          items={facadeBatches.secondaryCladdingRibs[tone]}
          color={toneMaterials[tone].joint}
          roughness={0.8}
          metalness={0.18}
        />
      ))}
      {SURROUNDING_TONES.map((tone) => (
        <InstancedBoxSet
          key={`${tone}-primary-ribs`}
          items={facadeBatches.primaryCladdingRibs[tone]}
          color={toneMaterials[tone].joint}
          roughness={0.78}
          metalness={0.2}
        />
      ))}
      {SURROUNDING_TONES.map((tone) => (
        <InstancedBoxSet
          key={`${tone}-accent-surfaces`}
          items={facadeBatches.accentSurfaces[tone]}
          color={toneMaterials[tone].accent}
          roughness={0.52}
          metalness={0.24}
        />
      ))}
      {SURROUNDING_TONES.map((tone) => (
        <InstancedBoxSet
          key={`${tone}-wall-rhythm-bays`}
          items={facadeBatches.wallRhythmBays[tone]}
          color={toneMaterials[tone].accent}
          roughness={0.82}
          metalness={0.18}
        />
      ))}
      <InstancedBoxSet items={facadeBatches.officeBackdrops} color={treatment.greyAccent} roughness={0.8} metalness={0.16} />
      <InstancedBoxSet items={facadeBatches.officeRibbonBands} color={treatment.greyAccent} roughness={0.82} metalness={0.12} />
      <InstancedBoxSet items={facadeBatches.entryAccents} color={treatment.entryOrange} roughness={0.72} metalness={0.08} />
      <InstancedBoxSet items={facadeBatches.windowGlass} color={treatment.glass} roughness={0.2} metalness={0.28} />
      <InstancedBoxSet items={facadeBatches.rollerDoorBays} color={treatment.rollerDoor} roughness={0.82} metalness={0.18} />
      <InstancedBoxSet items={facadeBatches.rollerSlats} color={treatment.rollerSlat} roughness={0.72} metalness={0.28} />
      <InstancedBoxSet items={facadeBatches.doorJambs} color={treatment.roofTrim} roughness={0.72} metalness={0.26} />
      <InstancedBoxSet
        items={facadeBatches.doorCanopies}
        color={treatment.roofTrim}
        roughness={0.72}
        metalness={0.26}
        castShadow
      />
    </group>
  )
}

export default VirtualChurchSurroundingFacades
