import { virtualChurchMainHallText } from '../i18n/virtualChurchMainHall'
import { Component, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, Color, Group, InstancedMesh, Object3D, PMREMGenerator, type BufferGeometry, type MeshBasicMaterial, type MeshStandardMaterial, type WebGLRenderTarget } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CircleHelp, Eye, Footprints, RotateCcw } from 'lucide-react'
import { useAuthStore } from '../stores/auth'
import './virtualChurchInteriorControls.css'
import { getPerformanceConfig, type PerformanceConfig } from '../services/virtualChurchService'
import { createMainHallChairSeatGeometry, createMainHallChairBackGeometry, createMainHallChairBackFrameGeometry, createMainHallChairLowBackGeometry, createMainHallChairLowBackFrameGeometry, createMainHallChairLowerFrameGeometry } from './virtualChurchMainHallChairGeometry'
import { createMainHallInitialSubmissionRecorder, measureMainHallSceneBudget } from './virtualChurchMainHallBudget'
import { createMainHallStageEquipmentGeometry } from './virtualChurchMainHallStageEquipment'
import { createMainHallTimberGeometry } from './virtualChurchMainHallTimberGeometry'
import { createMainHallWindowGeometry, MAIN_HALL_WINDOW_DETAIL, MAIN_HALL_DAYLIGHT_KEY_POSITION, mainHallDaylightMaterialProps } from './virtualChurchMainHallWindows'
import { createVirtualChurchStrictModeCleanupGuard } from './virtualChurchResourceLeaseContract'
import { installVirtualChurchShadowCache } from './virtualChurchShadowCache'
import { MAIN_HALL_FILL_RESPONSE, MAIN_HALL_LIGHTING_TRACKS, MAIN_HALL_LIGHTING_HEADS, MAIN_HALL_SHADOW, mainHallShadowMapSize } from './virtualChurchMainHallLighting'
import { MAIN_HALL_CHAIR_APPEARANCE, MAIN_HALL_CEILING_APPEARANCE, MAIN_HALL_TIMBER_APPEARANCE, MAIN_HALL_ENVIRONMENT_RESPONSE, attachMainHallEnvironment, mainHallCeilingShader, mainHallChairFabricShader, mainHallChairFabricProgramKey, mainHallCarpetShader, mainHallCarpetProgramKey, mainHallWallContactShader, mainHallWallContactProgramKey, mainHallTimberShader, mainHallTimberProgramKey } from './virtualChurchMainHallMaterials'
import { VirtualChurchInteriorTimingProbe } from './VirtualChurchInteriorTimingProbe'
import { useVirtualChurchPageIsolation, useVirtualChurchReducedMotion } from './virtualChurchAccessibility'
import { virtualChurchContextLossDiagnosticLimit, virtualChurchShouldReportContextLoss } from './virtualChurchRecoveryContract'
import { virtualChurchMainHallDoorFromQuery, virtualChurchMainHallEntryView, virtualChurchMainHallReturnUrl } from './virtualChurchMainHallPortal'
import {
  MAIN_HALL_CAMERA,
  MAIN_HALL_CHAIR_PARTS,
  MAIN_HALL_CHAIR_ROW_LINKS,
  MAIN_HALL_CHAIRS,
  MAIN_HALL_DIMENSIONS,
  MAIN_HALL_REAR_ACOUSTIC_FIELD,
  MAIN_HALL_STAGE_ACCESS,
  MAIN_HALL_STAGE_FRONT_DOORS,
  MAIN_HALL_STAGE_RECESS,
  MAIN_HALL_SIDE_WINDOW_BAYS,
  type MainHallCameraView,
} from './virtualChurchMainHallLayout'
import {
  MAIN_HALL_WALK_EYE_HEIGHT,
  MAIN_HALL_FOYER_EXIT_CENTERS,
  MAIN_HALL_FOYER_EXIT_WIDTH,
  mainHallFoyerExitDoorAt,
  mainHallWalkStartForDoor,
  mainHallWalkReviewEnabled,
  createMainHallWalkReview,
  stepMainHallWalk,
  type MainHallWalkInput,
  type MainHallWalkPose,
} from './virtualChurchMainHallWalk'

type Placement = { position: [number, number, number]; scale: [number, number, number]; yaw?: number; tilt?: number; tint?: string }

type HallContextReleaseDiagnostic = {
  createdContexts: number
  releasedContexts: number
  activeContexts: number
  canvasConnectedAtRelease: boolean | null
}
const hallContextReleaseDiagnosticEnabled = new URLSearchParams(window.location.search)
  .get('profile3dGpu') === 'release'

function updateHallContextReleaseDiagnostic(update: (current: HallContextReleaseDiagnostic) => void) {
  if (!hallContextReleaseDiagnosticEnabled) return
  const diagnosticWindow = window as Window & { __alifeVirtualChurchHallContextRelease?: HallContextReleaseDiagnostic }
  const current = diagnosticWindow.__alifeVirtualChurchHallContextRelease ?? {
    createdContexts: 0, releasedContexts: 0, activeContexts: 0, canvasConnectedAtRelease: null,
  }
  update(current)
  diagnosticWindow.__alifeVirtualChurchHallContextRelease = current
  // Context events only: these counters are not heap or driver VRAM measures.
  document.documentElement.setAttribute('data-virtual-church-hall-context-release-diagnostic', JSON.stringify(current))
}

const seatPalette = MAIN_HALL_CHAIR_APPEARANCE.seatColors
const backPalette = MAIN_HALL_CHAIR_APPEARANCE.backColors
const chairFrameFinish = MAIN_HALL_CHAIR_APPEARANCE.frame
const chairParts = MAIN_HALL_CHAIR_PARTS

const seats: Placement[] = MAIN_HALL_CHAIRS.map(chair => ({
  position: [chair.x, chairParts.seat.y, chair.z + chairParts.seat.z],
  scale: [chairParts.seat.width, chairParts.seat.height, chairParts.seat.depth], yaw: chair.yaw,
  tint: seatPalette[chair.block],
}))
const backs: Placement[] = MAIN_HALL_CHAIRS.map(chair => ({
  position: [chair.x, chairParts.back.y, chair.z + chairParts.back.z],
  scale: [chairParts.back.width, chairParts.back.height, chairParts.back.depth], yaw: chair.yaw, tilt: -.065,
  tint: backPalette[chair.block],
}))
const backFrames: Placement[] = MAIN_HALL_CHAIRS.map(chair => ({
  position: [chair.x, chairParts.back.y, chair.z + chairParts.back.z],
  scale: [1, 1, 1], yaw: chair.yaw, tilt: -.065,
}))
const chairLegs: Placement[] = MAIN_HALL_CHAIRS.map(chair => ({
  position: [chair.x, 0, chair.z], scale: [1, 1, 1], yaw: chair.yaw,
}))
const chairFrames: Placement[] = MAIN_HALL_CHAIR_ROW_LINKS.map(link => ({
    position: [link.x, chairParts.rowLink.y, link.z + chairParts.rowLink.z] as [number, number, number],
    scale: [link.width, chairParts.rowLink.height, chairParts.rowLink.depth] as [number, number, number],
  }))
const sideSlats: Placement[] = [-1, 1].flatMap(side =>
  Array.from({ length: 95 }, (_, index) => ({
    position: [side * 11.47, 4.83, -10.3 + index * .218] as [number, number, number],
    scale: [.105, 3.15, .12] as [number, number, number],
  })),
)
const backSlats: Placement[] = Array.from({ length: 92 }, (_, index) => ({
  position: [-10.47 + index * .23, 4.85, 10.77] as [number, number, number],
  scale: [.105, 3.05, .09] as [number, number, number],
})).filter(({ position }) => Math.abs(position[0]) > MAIN_HALL_REAR_ACOUSTIC_FIELD.halfWidth + .06)
// Stage-facing doors remain visual-only, with no invented exit destination.
// Side glazing now lives in the genuinely open HallSideWindows shell.
const sideWindowPanes: Placement[] = [
  ...MAIN_HALL_STAGE_FRONT_DOORS.flatMap(door =>
    Array.from({ length: door.panes }, (_, index): Placement => ({
      position: [door.centerX - door.width / 2 + (index + .5) * door.width / door.panes,
        (door.bottomY + door.topY) / 2, door.faceZ + .1],
      scale: [door.width / door.panes - .07, door.topY - door.bottomY - .12, .025],
      tint: door.centerX < 0 ? '#dce6e3' : '#667674',
    })),
  ),
]
const sideWindowFrames: Placement[] = MAIN_HALL_SIDE_WINDOW_BAYS.flatMap(({ side, centerZ, length, bottomY, topY, panes }) => {
  const x = side * (MAIN_HALL_DIMENSIONS.width / 2 - .055)
  const centerY = (bottomY + topY) / 2
  return [
    ...[bottomY, topY].map(y => ({ position: [x, y, centerZ] as [number, number, number], scale: [MAIN_HALL_WINDOW_DETAIL.frameDepth, .055, length + .08] as [number, number, number] })),
    ...Array.from({ length: panes + 1 }, (_, index) => ({
      position: [x, centerY, centerZ - length / 2 + index * length / panes] as [number, number, number],
      scale: [MAIN_HALL_WINDOW_DETAIL.frameDepth, topY - bottomY, .055] as [number, number, number],
    })),
  ]
})
sideWindowFrames.push(
  ...MAIN_HALL_STAGE_FRONT_DOORS.flatMap(door => [
    ...[door.bottomY, door.topY].map(y => ({
      position: [door.centerX, y, door.faceZ + .15] as [number, number, number],
      scale: [door.width + .08, .055, .055] as [number, number, number],
    })),
    ...Array.from({ length: door.panes + 1 }, (_, index) => ({
      position: [door.centerX - door.width / 2 + index * door.width / door.panes,
        (door.bottomY + door.topY) / 2, door.faceZ + .15] as [number, number, number],
      scale: [.055, door.topY - door.bottomY, .055] as [number, number, number],
    })),
  ]),
)
// Sparse wall lights are visible in the 2017 gallery; their exact spacing is
// not surveyed, so this remains part of the historical review candidate.
const sideSconceBodies: Placement[] = [-1, 1].flatMap(side =>
  [-7.8, -2.6, 2.6, 7.8].map(z => ({
    position: [side * 11.35, 4.24, z] as [number, number, number],
    scale: [.09, .3, .19] as [number, number, number],
  })),
)
const sideSconceGlow: Placement[] = sideSconceBodies.map(({ position }) => ({
  position: [position[0] > 0 ? position[0] - .055 : position[0] + .055, position[1], position[2]],
  scale: [.018, .14, .11],
}))
const ceilingStrips: Placement[] = [-7.6, -4.6, -1.6, 1.4, 4.4, 7.4].flatMap(z =>
  [-6.4, 0, 6.4].map(x => ({
    position: [x, 6.47, z] as [number, number, number],
    scale: [2.1, .025, .075] as [number, number, number],
  })),
)

const stageRecess = MAIN_HALL_STAGE_RECESS
const stageRecessCentreY = stageRecess.bottomY + stageRecess.height / 2
const stageRecessPale: Placement[] = [
  { position: [0, stageRecessCentreY, stageRecess.faceZ], scale: [stageRecess.width, stageRecess.height, .06], tint: '#f8f7f1' },
  ...[-1, 1].map((side): Placement => ({
    position: [side * (stageRecess.width / 2 + stageRecess.sidePierWidth / 2), stageRecessCentreY, stageRecess.faceZ + .13],
    scale: [stageRecess.sidePierWidth, stageRecess.height + .18, .28], tint: '#e8e6e0',
  })),
  { position: [0, stageRecess.bottomY + stageRecess.height + .055, stageRecess.faceZ + .13],
    scale: [stageRecess.width + stageRecess.sidePierWidth * 2, .11, .28], tint: '#f1f0eb' },
  ...[-1, 1].map((side): Placement => ({
    position: [side * (stageRecess.width / 2 + stageRecess.revealWidth / 2), stageRecessCentreY, stageRecess.faceZ + .29],
    scale: [stageRecess.revealWidth, stageRecess.height + .1, .055], tint: '#d6d3cb',
  })),
]
const stageRecessDark: Placement[] = [
  ...[-1, 1].map((side): Placement => ({
    position: [side * stageRecess.wingX, MAIN_HALL_DIMENSIONS.height / 2, stageRecess.faceZ + .16],
    scale: [stageRecess.wingWidth, MAIN_HALL_DIMENSIONS.height, .19],
  })),
  ...MAIN_HALL_STAGE_FRONT_DOORS.map((door): Placement => ({
    position: [door.centerX, (door.bottomY + door.topY) / 2, door.faceZ],
    scale: [door.width + .1, door.topY - door.bottomY + .1, .12],
  })),
]

// The 2017 stage photo has soft, uneven wall-wash below the lighting track.
// Keep it on the back wall only: one translucent plane, no light/shadow pass
// across the 360 chair instances and no downloaded photograph or texture.
const stageWallWashShader: MeshBasicMaterial['onBeforeCompile'] = shader => {
  shader.vertexShader = `varying vec2 vStageWallPosition;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStageWallPosition = position.xy;')
  shader.fragmentShader = `varying vec2 vStageWallPosition;\n${shader.fragmentShader}`
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 wallUv = vStageWallPosition / vec2(${stageRecess.width.toFixed(2)}, ${stageRecess.height.toFixed(2)}) + 0.5;
      float leftWash = exp(-pow((wallUv.x - 0.26) / 0.23, 2.0));
      float rightWash = exp(-pow((wallUv.x - 0.74) / 0.23, 2.0));
      float heightFade = smoothstep(0.12, 0.56, wallUv.y) * (1.0 - smoothstep(0.79, 1.0, wallUv.y));
      diffuseColor.a *= min(1.0, leftWash + rightWash) * heightFade;
    `)
}
const stageAccess = MAIN_HALL_STAGE_ACCESS
const stageRailTilt = Math.atan2(
  stageAccess.railBackTopY - stageAccess.railFrontTopY,
  stageAccess.railFrontZ - stageAccess.railBackZ,
)
const stageRailLength = Math.hypot(
  stageAccess.railFrontZ - stageAccess.railBackZ,
  stageAccess.railBackTopY - stageAccess.railFrontTopY,
)
const stageHandrails: Placement[] = stageAccess.stairCentersX.flatMap(centerX =>
  [-1, 1].flatMap(side => {
    const x = centerX + side * stageAccess.railOffsetX
    return [
      { position: [x, stageAccess.railFrontTopY / 2, stageAccess.railFrontZ],
        scale: [.034, stageAccess.railFrontTopY, .034] },
      { position: [x, (stageAccess.railBackTopY + MAIN_HALL_DIMENSIONS.stageHeight) / 2, stageAccess.railBackZ],
        scale: [.034, stageAccess.railBackTopY - MAIN_HALL_DIMENSIONS.stageHeight, .034] },
      { position: [x, (stageAccess.railFrontTopY + stageAccess.railBackTopY) / 2,
        (stageAccess.railFrontZ + stageAccess.railBackZ) / 2],
        scale: [.04, .04, stageRailLength], tilt: stageRailTilt },
    ] as Placement[]
  }),
)

// Fine woven variation and subdued edge piping stay procedural: no external
// photograph, fabric download, extra mesh batch, or seat-layout change.
const chairFabricShader: MeshStandardMaterial['onBeforeCompile'] = mainHallChairFabricShader
const chairFabricProgramKey = mainHallChairFabricProgramKey

// One soft, low-opacity pass grounds all 360 chairs on the photographed
// carpet. This ambient-contact approximation supplements the cached daylight
// map where thin legs fall below its resolution; it is not measured AO.
const chairContactShader: MeshStandardMaterial['onBeforeCompile'] = shader => {
  shader.vertexShader = `varying vec2 vChairContact;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvChairContact = position.xy;')
  shader.fragmentShader = `varying vec2 vChairContact;\n${shader.fragmentShader}`
    .replace('#include <opaque_fragment>', `#include <opaque_fragment>
      float contactFade = 1.0 - smoothstep(0.12, 0.49, length(vChairContact));
      gl_FragColor.a *= contactFade;
    `)
}

function ChairContactShadows() {
  const mesh = useRef<InstancedMesh>(null)
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const transform = new Object3D()
    MAIN_HALL_CHAIRS.forEach((chair, index) => {
      transform.position.set(chair.x, .013, chair.z)
      transform.rotation.set(-Math.PI / 2, 0, 0)
      transform.scale.set(.78, .82, 1)
      transform.updateMatrix()
      mesh.current!.setMatrixAt(index, transform.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
    invalidate()
  }, [invalidate])
  return <instancedMesh ref={mesh} name="main-hall-chair-contact" args={[undefined, undefined, MAIN_HALL_CHAIRS.length]}>
    <planeGeometry args={[1, 1]} />
    <meshBasicMaterial
      color="#211d1d"
      opacity={.2}
      transparent
      depthWrite={false}
      toneMapped={false}
      onBeforeCompile={chairContactShader}
      customProgramCacheKey={() => 'main-hall-chair-contact-v1'}
    />
  </instancedMesh>
}

function Instances({ placements, color, rounded = false, timber = false, metalness = 0, roughness, emissive = false, name, geometryFactory, castShadow = false, receiveShadow = false }: {
  placements: Placement[]; color: string; rounded?: boolean; timber?: boolean; metalness?: number; roughness?: number; emissive?: boolean; name: string; geometryFactory?: () => BufferGeometry; castShadow?: boolean; receiveShadow?: boolean
}) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => geometryFactory?.() ?? null, [geometryFactory])
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const transform = new Object3D()
    placements.forEach(({ position, scale, yaw = 0, tilt = 0 }, index) => {
      transform.position.set(...position)
      transform.rotation.set(tilt, yaw, 0)
      transform.scale.set(...scale)
      transform.updateMatrix()
      mesh.current!.setMatrixAt(index, transform.matrix)
      if (placements[index].tint) mesh.current!.setColorAt(index, new Color(placements[index].tint))
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.computeBoundingBox()
    mesh.current.computeBoundingSphere()
    invalidate()
  }, [invalidate, placements])
  useEffect(() => () => geometry?.dispose(), [geometry])
  return <instancedMesh ref={mesh} name={name} args={[undefined, undefined, placements.length]} geometry={geometry ?? undefined} castShadow={castShadow} receiveShadow={receiveShadow}>
    {!geometry ? <boxGeometry args={[1, 1, 1]} /> : null}
    {emissive
      ? <meshBasicMaterial color={color} toneMapped={false} />
      : <meshStandardMaterial
          color={color}
          roughness={roughness ?? (rounded ? .93 : metalness > 0 ? .48 : .91)}
          metalness={metalness}
          onBeforeCompile={rounded ? chairFabricShader : timber ? mainHallTimberShader : undefined}
          customProgramCacheKey={rounded ? chairFabricProgramKey : timber ? mainHallTimberProgramKey : undefined}
        />}
  </instancedMesh>
}

const carpetShader: MeshStandardMaterial['onBeforeCompile'] = mainHallCarpetShader

function HallEnvironment() {
  const { gl, scene, invalidate } = useThree()
  // Install the same environment before the first demand frame. A passive
  // effect previously allowed a costly no-environment draw, then compiled
  // the environment variant on a second frame. Do not change its quality.
  useLayoutEffect(() => {
    const generator = new PMREMGenerator(gl), room = new RoomEnvironment()
    let target: WebGLRenderTarget | undefined
    try {
      target = generator.fromScene(room, .04, .1, 100, { size: MAIN_HALL_ENVIRONMENT_RESPONSE.size })
      const release = attachMainHallEnvironment(scene, target)
      invalidate()
      return release
    } catch (error) { target?.dispose(); throw error }
    finally { generator.dispose(); room.dispose() }
  }, [gl, scene, invalidate])
  return null
}

function HallSideWindows() {
  const windows = useMemo(() => createMainHallWindowGeometry(), [])
  const cleanup = useMemo(() => createVirtualChurchStrictModeCleanupGuard(), [windows])
  useEffect(() => {
    cleanup.activate()
    return () => cleanup.release(() => Object.values(windows).forEach(part => part.dispose()))
  }, [windows, cleanup])
  return <>
    <mesh name="main-hall-openings-wall" castShadow receiveShadow><primitive object={windows.wall} attach="geometry" dispose={null} /><meshStandardMaterial vertexColors roughness={1} onBeforeCompile={mainHallWallContactShader} customProgramCacheKey={mainHallWallContactProgramKey} /></mesh>
    <mesh name="main-hall-window-daylight"><primitive object={windows.vista} attach="geometry" dispose={null} /><meshBasicMaterial {...mainHallDaylightMaterialProps} /></mesh>
    <mesh name="main-hall-window-glazing"><primitive object={windows.glazing} attach="geometry" dispose={null} /><meshBasicMaterial color="#d9e5e8" transparent opacity={.1} depthWrite={false} /></mesh>
  </>
}

function HallStaticShadows() {
  const { gl, scene } = useThree()
  // Compare actual light/caster state after world transforms. Camera/language
  // changes reuse static depth; rear-door transforms invalidate it.
  // Canvas uses explicit PCF ("percentage"): boolean shadows requests the
  // deprecated PCFSoft type, which Three converts back and R3F re-invalidates.
  useLayoutEffect(() => installVirtualChurchShadowCache(scene, gl), [scene, gl])
  return null
}

// Structex's 2017 auditorium photo shows small circular ceiling diffusers.
// Keep them in the existing ceiling draw, visible only on its underside;
// their regular spacing is a visual estimate, not a surveyed services plan.
const ceilingDiffuserShader: MeshStandardMaterial['onBeforeCompile'] = mainHallCeilingShader

// The 2017 rear wall has a pale woven-square centre between the vertical
// timber bands. Draw it on the existing wall material, behind the side slats:
// no downloaded texture, extra mesh or additional draw submission.
const rearAcousticFieldShader: MeshStandardMaterial['onBeforeCompile'] = shader => {
  shader.vertexShader = `varying vec2 vRearWallXY;\nvarying float vRearWallInside;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRearWallXY = position.xy;\nvRearWallInside = step(0.5, -normal.z);')
  shader.fragmentShader = `varying vec2 vRearWallXY;\nvarying float vRearWallInside;\n${shader.fragmentShader}`
    .replace('#include <color_fragment>', `#include <color_fragment>
      float acousticCentre = (1.0 - step(${MAIN_HALL_REAR_ACOUSTIC_FIELD.halfWidth.toFixed(2)}, abs(vRearWallXY.x))) * vRearWallInside;
      vec2 acousticUv = (vRearWallXY + vec2(${MAIN_HALL_REAR_ACOUSTIC_FIELD.halfWidth.toFixed(2)}, 1.58)) * ${MAIN_HALL_REAR_ACOUSTIC_FIELD.cellsPerMeter.toFixed(2)};
      vec2 acousticCell = fract(acousticUv);
      vec2 acousticEdge = min(acousticCell, 1.0 - acousticCell);
      float acousticGroove = 1.0 - smoothstep(.035, .085, min(acousticEdge.x, acousticEdge.y));
      float acousticInset = 1.0 - smoothstep(.18, .27, max(abs(acousticCell.x - .5), abs(acousticCell.y - .5)));
      float acousticAlternation = mod(floor(acousticUv.x) + floor(acousticUv.y), 2.0);
      vec3 acousticWood = vec3(.47, .31, .145) + acousticAlternation * vec3(.022, .015, .008);
      acousticWood *= 1.0 - acousticGroove * .2 - acousticInset * .075;
      diffuseColor.rgb = mix(diffuseColor.rgb, acousticWood, acousticCentre);
    `)
}

function HallCamera({ view }: { view: MainHallCameraView }) {
  const { camera, invalidate, size } = useThree()
  useEffect(() => {
    const framing = MAIN_HALL_CAMERA[view]
    camera.position.set(framing.position[0], framing.position[1], framing.position[2])
    camera.lookAt(framing.target[0], framing.target[1], framing.target[2])
    if ('fov' in camera) camera.fov = size.width < 640 ? framing.fov + 7 : framing.fov
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, size.width, view])
  return null
}

function HallWalkCamera({ enabled, entryDoor, touchInput, requestFrame, walkPose, onExit, samplingActivity, inputReview }: {
  enabled: boolean
  entryDoor: number
  touchInput: MutableRefObject<MainHallWalkInput>
  requestFrame: MutableRefObject<(() => void) | null>
  walkPose: MutableRefObject<MainHallWalkPose>
  onExit: (door: number) => void
  samplingActivity?: MutableRefObject<boolean>
  inputReview: boolean
}) {
  const { camera, gl, invalidate, size } = useThree()
  const pitch = useRef(0)
  const heldKeys = useRef(new Set<string>())
  const wasEnabled = useRef(false)
  const exiting = useRef(false)
  const reviewRun = useRef<ReturnType<typeof createMainHallWalkReview> | null>(null)
  const publishedReview = useRef('')

  useEffect(() => {
    if (!enabled) {
      wasEnabled.current = false
      return
    }
    const startingWalk = !wasEnabled.current
    if (startingWalk) {
      walkPose.current = mainHallWalkStartForDoor(entryDoor)
      pitch.current = 0
      exiting.current = false
    }
    if (startingWalk && inputReview) reviewRun.current = createMainHallWalkReview()
    wasEnabled.current = true
    camera.position.set(walkPose.current.x, MAIN_HALL_WALK_EYE_HEIGHT, walkPose.current.z)
    camera.lookAt(walkPose.current.x - Math.sin(walkPose.current.yaw), MAIN_HALL_WALK_EYE_HEIGHT + Math.sin(pitch.current), walkPose.current.z - Math.cos(walkPose.current.yaw))
    if ('fov' in camera) camera.fov = size.width < 640 ? 73 : 67
    camera.updateProjectionMatrix()
    requestFrame.current = invalidate
    invalidate()

    let pointer: { id: number; x: number; y: number } | null = null
    const handledKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('button, a, input, select, textarea, [contenteditable="true"], [role="dialog"]')) return
      if (!handledKeys.has(event.code)) return
      event.preventDefault()
      reviewRun.current?.cancel('manual-input')
      heldKeys.current.add(event.code)
      invalidate()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!handledKeys.has(event.code)) return
      if (heldKeys.current.has(event.code)) event.preventDefault()
      heldKeys.current.delete(event.code)
    }
    const onBlur = () => {
      reviewRun.current?.cancel('window-blur')
      heldKeys.current.clear()
      touchInput.current = { forward: 0, strafe: 0, turn: 0 }
      if (pointer && gl.domElement.hasPointerCapture(pointer.id)) gl.domElement.releasePointerCapture(pointer.id)
      pointer = null
    }
    const onVisibilityChange = () => { if (document.visibilityState !== 'visible') onBlur() }
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('button, a, input, select, textarea, [contenteditable="true"], [role="dialog"]')) {
        heldKeys.current.clear()
        reviewRun.current?.cancel('control-focus')
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (pointer || event.button !== 0) return
      reviewRun.current?.cancel('manual-input')
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
      gl.domElement.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return
      walkPose.current.yaw += (event.clientX - pointer.x) * .004
      pitch.current = Math.max(-.48, Math.min(.48, pitch.current - (event.clientY - pointer.y) * .003))
      pointer.x = event.clientX
      pointer.y = event.clientY
      invalidate()
    }
    const onPointerEnd = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return
      pointer = null
      if (gl.domElement.hasPointerCapture(event.pointerId)) gl.domElement.releasePointerCapture(event.pointerId)
    }
    const onLostCapture = () => { pointer = null }
    const onContextMenu = (event: MouseEvent) => event.preventDefault()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onBlur)
    window.addEventListener('orientationchange', onBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('focusin', onFocusIn)
    gl.domElement.addEventListener('pointerdown', onPointerDown)
    gl.domElement.addEventListener('pointermove', onPointerMove)
    gl.domElement.addEventListener('pointerup', onPointerEnd)
    gl.domElement.addEventListener('pointercancel', onPointerEnd)
    gl.domElement.addEventListener('lostpointercapture', onLostCapture)
    gl.domElement.addEventListener('contextmenu', onContextMenu)
    return () => {
      if (pointer && gl.domElement.hasPointerCapture(pointer.id)) gl.domElement.releasePointerCapture(pointer.id)
      heldKeys.current.clear()
      touchInput.current = { forward: 0, strafe: 0, turn: 0 }
      requestFrame.current = null
      reviewRun.current?.cancel('mode-change')
      reviewRun.current = null
      publishedReview.current = ''
      delete gl.domElement.dataset.mainHallWalkReview
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onBlur)
      window.removeEventListener('orientationchange', onBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('focusin', onFocusIn)
      gl.domElement.removeEventListener('pointerdown', onPointerDown)
      gl.domElement.removeEventListener('pointermove', onPointerMove)
      gl.domElement.removeEventListener('pointerup', onPointerEnd)
      gl.domElement.removeEventListener('pointercancel', onPointerEnd)
      gl.domElement.removeEventListener('lostpointercapture', onLostCapture)
      gl.domElement.removeEventListener('contextmenu', onContextMenu)
    }
  }, [camera, enabled, entryDoor, gl, invalidate, requestFrame, size.width, touchInput, walkPose, inputReview])

  useFrame((_, delta) => {
    if (!enabled) { if (samplingActivity) samplingActivity.current = false; return }
    const keys = heldKeys.current
    let input = {
      forward: Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + touchInput.current.forward,
      strafe: Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + touchInput.current.strafe,
      turn: Number(keys.has('KeyE') || keys.has('ArrowRight')) - Number(keys.has('KeyQ') || keys.has('ArrowLeft')) + touchInput.current.turn,
    }
    const review = reviewRun.current?.advance(performance.now(), !document.hidden, Boolean(input.forward || input.strafe || input.turn))
    if (review?.status === 'running') input = review.input
    if (samplingActivity) samplingActivity.current = Boolean(input.forward || input.strafe || input.turn)
    walkPose.current = stepMainHallWalk(walkPose.current, input, delta)
    const { x, z, yaw } = walkPose.current
    if (review && publishedReview.current !== `${review.status}:${review.phase}`) {
      publishedReview.current = `${review.status}:${review.phase}`
      gl.domElement.dataset.mainHallWalkReview = JSON.stringify({ ...review, kind: 'bounded-input-through-normal-walk-controller', pose: { x, z, yaw } })
    }
    const cosine = Math.cos(pitch.current)
    camera.position.set(x, MAIN_HALL_WALK_EYE_HEIGHT, z)
    camera.lookAt(x - Math.sin(yaw) * cosine, MAIN_HALL_WALK_EYE_HEIGHT + Math.sin(pitch.current), z - Math.cos(yaw) * cosine)
    const exitDoor = mainHallFoyerExitDoorAt(x, z)
    if (exitDoor !== null && !exiting.current) {
      exiting.current = true
      queueMicrotask(() => onExit(exitDoor))
    }
    if (input.forward || input.strafe || input.turn) invalidate()
  })
  return null
}

function HallRearDoor({ index, enabled, entryDoor, walkPose }: {
  index: number
  enabled: boolean
  entryDoor: number
  walkPose: MutableRefObject<MainHallWalkPose>
}) {
  const { invalidate } = useThree()
  const reducedMotion = useVirtualChurchReducedMotion()
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const progress = useRef(enabled && entryDoor === index ? 1 : 0)
  const center = MAIN_HALL_FOYER_EXIT_CENTERS[index]
  const apply = useCallback(() => {
    if (left.current) left.current.rotation.y = -1.35 * progress.current
    if (right.current) right.current.rotation.y = 1.35 * progress.current
  }, [])
  useLayoutEffect(() => { apply() }, [apply])
  useFrame((_, delta) => {
    const pose = walkPose.current
    const nearby = enabled && Math.abs(pose.x - center) < 1.55 && pose.z > 8.95
    const target = nearby ? 1 : 0
    const next = reducedMotion ? target : progress.current + Math.sign(target - progress.current) * Math.min(Math.abs(target - progress.current), delta * 2.4)
    if (next === progress.current) return
    progress.current = next
    apply()
    invalidate()
  })
  return <group name={`main-hall-foyer-exit-${index}`} position={[center, 0, 10.69]}>
    {[-1, 1].map(side => <group key={side} ref={side < 0 ? left : right} position={[side * MAIN_HALL_FOYER_EXIT_WIDTH / 2, 0, 0]}>
      <mesh position={[-side * (MAIN_HALL_FOYER_EXIT_WIDTH / 4 - .025), 1.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[MAIN_HALL_FOYER_EXIT_WIDTH / 2 - .05, 2.4, .09]} />
        <meshStandardMaterial color="#e6e4dc" roughness={.87} />
      </mesh>
      <mesh position={[-side * .13, 1.44, -.055]}>
        <boxGeometry args={[.035, .67, .025]} />
        <meshStandardMaterial color="#adb4b1" metalness={.53} roughness={.38} />
      </mesh>
    </group>)}
  </group>
}

function HallStageEquipment({ lowDetail, stageHeight, visible }: { lowDetail: boolean; stageHeight: number; visible: boolean }) {
  const geometry = useMemo(() => createMainHallStageEquipmentGeometry(lowDetail), [lowDetail])
  useEffect(() => () => { geometry.surfaces.dispose(); geometry.hardware.dispose() }, [geometry])
  // The fixed audience-facing camera has all equipment behind its near plane.
  // Do not let the merged batch's wide sphere create two pointless submissions.
  return <group position={[0, stageHeight, 0]} visible={visible}>
    <mesh name="main-hall-stage-equipment-surfaces" geometry={geometry.surfaces}>
      <meshStandardMaterial vertexColors roughness={.67} metalness={.08} />
    </mesh>
    <mesh name="main-hall-stage-equipment-hardware" geometry={geometry.hardware}>
      <meshStandardMaterial vertexColors roughness={.38} metalness={.58} />
    </mesh>
  </group>
}

function HallScene({ view, entryDoor, touchInput, requestFrame, walkPose, onExit, lowDetail, samplingActivity, inputReview }: {
  view: MainHallCameraView | 'walk'
  entryDoor: number
  touchInput: MutableRefObject<MainHallWalkInput>
  requestFrame: MutableRefObject<(() => void) | null>
  walkPose: MutableRefObject<MainHallWalkPose>
  onExit: (door: number) => void
  lowDetail: boolean
  samplingActivity?: MutableRefObject<boolean>
  inputReview: boolean
}) {
  const { width, depth, height, stageZ, stageWidth, stageDepth, stageHeight } = MAIN_HALL_DIMENSIONS
  return <>
    {view !== 'walk' ? <HallCamera view={view} /> : null}
    <HallEnvironment />
    <HallStaticShadows />
    <HallWalkCamera enabled={view === 'walk'} entryDoor={entryDoor} touchInput={touchInput} requestFrame={requestFrame} walkPose={walkPose} onExit={onExit} samplingActivity={samplingActivity} inputReview={inputReview} />
    <color attach="background" args={['#ddd8cc']} />
    <ambientLight intensity={MAIN_HALL_FILL_RESPONSE.ambientIntensity} />
    <hemisphereLight args={[MAIN_HALL_FILL_RESPONSE.skyColor, MAIN_HALL_FILL_RESPONSE.groundColor, MAIN_HALL_FILL_RESPONSE.hemisphereIntensity]} />
    {/* Same stage-window key; one cached map captures aperture/chair occlusion.
        Still an artistic approximation, not measured solar illumination/GI. */}
    <directionalLight position={MAIN_HALL_DAYLIGHT_KEY_POSITION} intensity={1.65} color="#fff6e8" castShadow
      shadow-mapSize={[mainHallShadowMapSize(lowDetail), mainHallShadowMapSize(lowDetail)]}
      shadow-camera-left={MAIN_HALL_SHADOW.camera.left} shadow-camera-right={MAIN_HALL_SHADOW.camera.right}
      shadow-camera-top={MAIN_HALL_SHADOW.camera.top} shadow-camera-bottom={MAIN_HALL_SHADOW.camera.bottom}
      shadow-camera-near={MAIN_HALL_SHADOW.camera.near} shadow-camera-far={MAIN_HALL_SHADOW.camera.far}
      shadow-bias={MAIN_HALL_SHADOW.bias} shadow-normalBias={MAIN_HALL_SHADOW.normalBias} shadow-intensity={MAIN_HALL_SHADOW.intensity} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .006, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#69655e" roughness={1} onBeforeCompile={carpetShader} customProgramCacheKey={mainHallCarpetProgramKey} />
    </mesh>
    <ChairContactShadows />
    <mesh position={[0, height / 2, -depth / 2]} castShadow receiveShadow><boxGeometry args={[width, height, .16]} /><meshStandardMaterial color="#f0ede6" roughness={1} onBeforeCompile={mainHallWallContactShader} customProgramCacheKey={mainHallWallContactProgramKey} /></mesh>
    {/* Openings are cut through the lower rear wall; the upper wall and timber
        acoustic band remain continuous above the two provisional doors. */}
    <mesh position={[0, (height + 2.4) / 2, depth / 2]} castShadow receiveShadow><boxGeometry args={[width, height - 2.4, .16]} /><meshStandardMaterial color="#efebe2" roughness={1} onBeforeCompile={mainHallWallContactShader} customProgramCacheKey={mainHallWallContactProgramKey} /></mesh>
    {[
      [-width / 2, MAIN_HALL_FOYER_EXIT_CENTERS[1] - MAIN_HALL_FOYER_EXIT_WIDTH / 2],
      [MAIN_HALL_FOYER_EXIT_CENTERS[1] + MAIN_HALL_FOYER_EXIT_WIDTH / 2, MAIN_HALL_FOYER_EXIT_CENTERS[0] - MAIN_HALL_FOYER_EXIT_WIDTH / 2],
      [MAIN_HALL_FOYER_EXIT_CENTERS[0] + MAIN_HALL_FOYER_EXIT_WIDTH / 2, width / 2],
    ].map(([start, end], index) => <mesh key={index} position={[(start + end) / 2, 1.2, depth / 2]} castShadow receiveShadow><boxGeometry args={[end - start, 2.4, .16]} /><meshStandardMaterial color="#efebe2" roughness={1} onBeforeCompile={mainHallWallContactShader} customProgramCacheKey={mainHallWallContactProgramKey} /></mesh>)}
    <HallSideWindows />
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * (width / 2 - .1), 4.82, 0]}><boxGeometry args={[.05, 3.2, depth - .5]} /><meshStandardMaterial color={MAIN_HALL_TIMBER_APPEARANCE.backing} roughness={1} /></mesh>
    </group>)}
    <mesh name="main-hall-ceiling" position={[0, height, 0]}><boxGeometry args={[width, .08, depth]} /><meshStandardMaterial {...MAIN_HALL_CEILING_APPEARANCE} onBeforeCompile={ceilingDiffuserShader} customProgramCacheKey={() => 'main-hall-ceiling-diffusers-v3'} /></mesh>
    <mesh name="main-hall-rear-acoustic-wall" position={[0, 4.83, 10.8]}><boxGeometry args={[width - .4, 3.15, .09]} /><meshStandardMaterial color={MAIN_HALL_TIMBER_APPEARANCE.backing} roughness={1} onBeforeCompile={rearAcousticFieldShader} customProgramCacheKey={() => 'main-hall-rear-acoustic-v1'} /></mesh>
    <Instances name="main-hall-side-slatting" placements={sideSlats} color={MAIN_HALL_TIMBER_APPEARANCE.side} roughness={MAIN_HALL_TIMBER_APPEARANCE.roughness} geometryFactory={createMainHallTimberGeometry} timber receiveShadow />
    <Instances name="main-hall-back-slatting" placements={backSlats} color={MAIN_HALL_TIMBER_APPEARANCE.rear} roughness={MAIN_HALL_TIMBER_APPEARANCE.roughness} geometryFactory={createMainHallTimberGeometry} timber receiveShadow />
    <Instances name="main-hall-stage-door-panes" placements={sideWindowPanes} color="#ffffff" emissive />
    <Instances name="main-hall-side-window-frames" placements={sideWindowFrames} color="#526268" metalness={.22} castShadow receiveShadow />
    <Instances name="main-hall-side-sconce-housings" placements={sideSconceBodies} color="#393735" metalness={.34} />
    <Instances name="main-hall-side-sconce-glow" placements={sideSconceGlow} color="#f4e3bd" emissive />
    <Instances name="main-hall-ceiling-lights" placements={ceilingStrips} color="#fff7df" emissive />
    <Instances name="main-hall-lighting-tracks" placements={MAIN_HALL_LIGHTING_TRACKS} color="#282b2b" metalness={.35} />
    <Instances name="main-hall-track-heads" placements={MAIN_HALL_LIGHTING_HEADS} color="#303333" metalness={.3} />
    {/* The outer two rear doors remain closed; the two inner doors connect the
        walk preview back to the corresponding photographed foyer door bank. */}
    {[-7.4, 7.4].map(x => <group key={x} position={[x, 0, 10.68]}>
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow><boxGeometry args={[1.6, 2.4, .11]} /><meshStandardMaterial color="#e6e4dc" roughness={.87} /></mesh>
      <mesh position={[0, 1.44, -.07]}><boxGeometry args={[.13, .67, .025]} /><meshStandardMaterial color="#adb4b1" metalness={.53} roughness={.38} /></mesh>
    </group>)}
    {MAIN_HALL_FOYER_EXIT_CENTERS.map((_, index) => <HallRearDoor key={index} index={index} enabled={view === 'walk'} entryDoor={entryDoor} walkPose={walkPose} />)}
    <mesh position={[0, stageHeight / 2, stageZ]}><boxGeometry args={[stageWidth, stageHeight, stageDepth]} /><meshStandardMaterial color="#363638" roughness={.91} /></mesh>
    <mesh position={[0, stageHeight + .013, stageZ]}><boxGeometry args={[stageWidth, .025, stageDepth]} /><meshStandardMaterial color="#535154" roughness={1} /></mesh>
    {stageAccess.stairCentersX.map(x => <group key={x} position={[x, 0, stageAccess.stepCenterZ]}>
      <mesh position={[0, .075, 0]}><boxGeometry args={[1.15, .15, .52]} /><meshStandardMaterial color="#5a5858" /></mesh>
      <mesh position={[0, .23, -.28]}><boxGeometry args={[1.15, .16, .54]} /><meshStandardMaterial color="#49484a" /></mesh>
    </group>)}
    <Instances name="main-hall-stage-handrails" placements={stageHandrails} color="#91999a" metalness={.62} />
    <Instances name="main-hall-stage-recess" placements={stageRecessPale} color="#ffffff" />
    <mesh name="main-hall-stage-wall-wash" position={[0, stageRecessCentreY, stageRecess.faceZ + .04]}>
      <planeGeometry args={[stageRecess.width - .12, stageRecess.height - .08]} />
      <meshBasicMaterial color="#fff5df" transparent opacity={.48} depthWrite={false} toneMapped={false}
        onBeforeCompile={stageWallWashShader} customProgramCacheKey={() => 'main-hall-stage-wall-wash-v1'} />
    </mesh>
    <Instances name="main-hall-stage-wings-and-reveals" placements={stageRecessDark} color="#242625" />
    <HallStageEquipment lowDetail={lowDetail} stageHeight={stageHeight} visible={view !== 'stage'} />
    <Instances name="main-hall-chair-legs" placements={chairLegs} {...chairFrameFinish} geometryFactory={createMainHallChairLowerFrameGeometry} castShadow receiveShadow />
    <Instances name="main-hall-chair-linked-frames" placements={chairFrames} {...chairFrameFinish} receiveShadow />
    <Instances name="main-hall-chair-back-frames" placements={backFrames} {...chairFrameFinish} geometryFactory={lowDetail ? createMainHallChairLowBackFrameGeometry : createMainHallChairBackFrameGeometry} castShadow receiveShadow />
    <Instances name="main-hall-chair-seats" placements={seats} color="#ffffff" rounded geometryFactory={createMainHallChairSeatGeometry} castShadow receiveShadow />
    <Instances name="main-hall-chair-backs" placements={backs} color="#ffffff" rounded geometryFactory={lowDetail ? createMainHallChairLowBackGeometry : createMainHallChairBackGeometry} castShadow receiveShadow />
  </>
}

function HallBudgetProbe({ pageRef, preset }: { pageRef: MutableRefObject<HTMLDivElement | null>; preset: PerformanceConfig }) {
  const { scene, gl } = useThree()
  const initialSubmissions = useRef(createMainHallInitialSubmissionRecorder())
  useLayoutEffect(() => {
    initialSubmissions.current = createMainHallInitialSubmissionRecorder()
    const page = pageRef.current
    const previous = scene.onAfterRender
    let frames = 0, retired = false
    const hook: typeof scene.onAfterRender = function (this: typeof scene, ...args) {
      previous.apply(this, args)
      if (retired) return
      if (args[0] !== gl || gl.getRenderTarget() !== null) return
      initialSubmissions.current.complete(performance.now())
      // Actual completed-frame submission, including any shadow pass. This
      // query-only diagnostic is not a frame-time or device-performance gate.
      page?.setAttribute('data-main-hall-render', JSON.stringify({
        kind: 'completed-frame-cost-only', frames: ++frames,
        cameraPosition: args[2].position.toArray(),
        cameraQuaternion: args[2].quaternion.toArray(),
        calls: gl.info.render.calls, triangles: gl.info.render.triangles,
        shadowType: gl.shadowMap.type, shadowPending: gl.shadowMap.needsUpdate,
        initialSubmissions: initialSubmissions.current.snapshot(),
      }))
    }
    scene.onAfterRender = hook
    return () => {
      retired = true
      if (scene.onAfterRender === hook) scene.onAfterRender = previous
      page?.removeAttribute('data-main-hall-render')
    }
  }, [scene, gl, pageRef])
  useFrame(({ scene, camera, gl }) => {
    initialSubmissions.current.begin(performance.now(), Boolean(scene.environment), gl.shadowMap.needsUpdate)
    const environmentImage = scene.environment?.image as { width?: number; height?: number } | undefined
    const shadowMaps: Array<{ width: number | null; height: number | null }> = []
    scene.traverseVisible(object => {
      if ('isDirectionalLight' in object && object.castShadow) {
        const shadow = (object as import('three').DirectionalLight).shadow
        shadowMaps.push({ width: shadow.map?.width ?? null, height: shadow.map?.height ?? null })
      }
    })
    pageRef.current?.setAttribute('data-main-hall-budget', JSON.stringify({
      kind: 'scene-cost-only',
      preset: preset.isMobile ? 'mobile' : 'desktop',
      ...measureMainHallSceneBudget(scene, camera),
      dpr: gl.getPixelRatio(),
      drawingBuffer: [gl.domElement.width, gl.domElement.height],
      cameraPosition: camera.position.toArray(),
      environment: scene.environment ? { width: environmentImage?.width ?? null, height: environmentImage?.height ?? null, intensity: scene.environmentIntensity } : null,
      rendererMemory: { geometries: gl.info.memory.geometries, textures: gl.info.memory.textures },
      // Before this frame's render: not FPS or a paired current-camera cost.
      rendererLastFrame: { calls: gl.info.render.calls, triangles: gl.info.render.triangles },
      shadowCache: { autoUpdate: gl.shadowMap.autoUpdate, needsUpdate: gl.shadowMap.needsUpdate, maps: shadowMaps, type: gl.shadowMap.type },
    }))
  })
  useEffect(() => {
    const page = pageRef.current
    return () => page?.removeAttribute('data-main-hall-budget')
  }, [pageRef])
  return null
}

class HallCanvasBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

export default function VirtualChurchMainHallView() {
  const pageRef = useVirtualChurchPageIsolation()
  const navigate = useNavigate()
  const entryDoorQuery = new URLSearchParams(window.location.search).get('vcHallDoor')
  const returnDoor = virtualChurchMainHallDoorFromQuery(entryDoorQuery)
  const enteredFromFoyerDoor = virtualChurchMainHallEntryView(entryDoorQuery) === 'walk'
  const entryWalkStart = mainHallWalkStartForDoor(returnDoor)
  const returnToFoyerDoor = useCallback((door: number) => navigate(virtualChurchMainHallReturnUrl(door, window.location.search, import.meta.env.DEV)), [navigate])
  const { language, updateLanguage } = useAuthStore()
  // One shared preset per visit; language changes and landscape rotation do
  // not rebuild the chair buffers or upgrade a phone to desktop geometry.
  const [performancePreset] = useState(() => getPerformanceConfig())
  const budgetDiagnostic = new URLSearchParams(window.location.search).has('profile3d')
  const timingDiagnostic = budgetDiagnostic && new URLSearchParams(window.location.search).get('profile3dTiming') === '1'
  const reducedMotion = useVirtualChurchReducedMotion()
  const inputReview = mainHallWalkReviewEnabled(new URLSearchParams(window.location.search)) && !reducedMotion
  const zh = language === 'zh'
  const [view, setView] = useState<MainHallCameraView | 'walk'>(enteredFromFoyerDoor ? 'walk' : 'entrance')
  const [walkHelpOpen, setWalkHelpOpen] = useState(false)
  const walkHelpId = useId()
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const contextLossInjections = useRef(0)
  const contextLossTimer = useRef<number | undefined>(undefined)
  const contextLossLimit = virtualChurchContextLossDiagnosticLimit(new URLSearchParams(window.location.search).get('profile3dFailure'))
  useEffect(() => () => window.clearTimeout(contextLossTimer.current), [])
  const touchInput = useRef<MainHallWalkInput>({ forward: 0, strafe: 0, turn: 0 })
  const requestWalkFrame = useRef<(() => void) | null>(null)
  const walkPose = useRef<MainHallWalkPose>({ ...entryWalkStart })
  const samplingActivity = useRef(false)
  const action = 'vc-interior-button min-h-11'
  const walkControl = (field: keyof MainHallWalkInput, value: number, label: string, icon: ReactNode) =>
    <button type="button" aria-label={label} className={`${action} vc-interior-walk-button pointer-events-auto min-w-11`}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); touchInput.current[field] = value; requestWalkFrame.current?.() }}
      onPointerUp={() => { if (touchInput.current[field] === value) touchInput.current[field] = 0 }}
      onPointerCancel={() => { if (touchInput.current[field] === value) touchInput.current[field] = 0 }}
      onLostPointerCapture={() => { if (touchInput.current[field] === value) touchInput.current[field] = 0 }}
    >{icon}</button>
  return createPortal(<main ref={pageRef} tabIndex={-1} data-vc-interior="main-hall" className="virtual-church-ui fixed inset-0 z-[9999] flex flex-col" aria-label={zh ? virtualChurchMainHallText.mainAuditoriumReferencePreview.zh : virtualChurchMainHallText.mainAuditoriumReferencePreview.en}>
    <header className="vc-interior-header">
      <button type="button" onClick={() => returnToFoyerDoor(returnDoor)} className={action}><ArrowLeft size={17} />{zh ? virtualChurchMainHallText.backToFoyer.zh : virtualChurchMainHallText.backToFoyer.en}</button>
      <div className="vc-interior-caption"><h1>{zh ? virtualChurchMainHallText.mainAuditorium2017PhotoReference.zh : virtualChurchMainHallText.mainAuditorium2017PhotoReference.en}</h1><p className="hidden sm:block">{zh ? virtualChurchMainHallText.roomProportionsAndSeatingLayoutAwaitSiteVerification.zh : virtualChurchMainHallText.roomProportionsAndSeatingLayoutAwaitSiteVerification.en}</p></div>
      <button type="button" onClick={() => void updateLanguage(zh ? 'en' : 'zh')} className={action}>{zh ? virtualChurchMainHallText.switchLanguage.zh : virtualChurchMainHallText.switchLanguage.en}</button>
    </header>
    <div className="relative min-h-0 flex-1" aria-label={zh ? virtualChurchMainHallText.original3dCandidateBasedOn2017AuditoriumPhotos.zh : virtualChurchMainHallText.original3dCandidateBasedOn2017AuditoriumPhotos.en}>
      {!failed ? <HallCanvasBoundary key={revision} onFailure={() => setFailed(true)}>
        <Canvas shadows="percentage" frameloop="demand" dpr={[1, performancePreset.maxDevicePixelRatio]} style={{ touchAction: 'none' }} camera={{ position: enteredFromFoyerDoor ? [entryWalkStart.x, MAIN_HALL_WALK_EYE_HEIGHT, entryWalkStart.z] : [...MAIN_HALL_CAMERA.entrance.position], fov: enteredFromFoyerDoor ? 67 : MAIN_HALL_CAMERA.entrance.fov, near: .1, far: 80 }} gl={{ antialias: true }} onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = .94
          updateHallContextReleaseDiagnostic(current => { current.createdContexts++; current.activeContexts++ })
          gl.domElement.addEventListener('webglcontextlost', event => {
            updateHallContextReleaseDiagnostic(current => {
              current.releasedContexts++
              current.activeContexts = Math.max(0, current.activeContexts - 1)
              current.canvasConnectedAtRelease = gl.domElement.isConnected
            })
            if (!virtualChurchShouldReportContextLoss(gl.domElement.isConnected, pageRef.current?.querySelector('canvas') === gl.domElement)) return
            event.preventDefault()
            setFailed(true)
          }, { once: true })
          // Same explicit, bounded failure diagnostic as the exterior route.
          if (contextLossInjections.current < contextLossLimit) {
            contextLossInjections.current++
            contextLossTimer.current = window.setTimeout(() => gl.forceContextLoss(), 250)
          }
        }}><HallScene view={view} entryDoor={returnDoor} touchInput={touchInput} requestFrame={requestWalkFrame} walkPose={walkPose} onExit={returnToFoyerDoor} lowDetail={performancePreset.isMobile} samplingActivity={timingDiagnostic ? samplingActivity : undefined} inputReview={inputReview} />
          {budgetDiagnostic ? <HallBudgetProbe pageRef={pageRef} preset={performancePreset} /> : null}
          {timingDiagnostic ? <VirtualChurchInteriorTimingProbe pageRef={pageRef} active={view === 'walk'} room="main-hall" mode={view} preset={performancePreset.isMobile ? 'mobile' : 'desktop'} motionUpdateLimitHz={null} samplingActivity={samplingActivity} /> : null}
        </Canvas>
      </HallCanvasBoundary> : null}
      {view === 'walk' && !failed ? <>
        <div className="vc-interior-walk-help" onKeyDown={event => {
          if (event.code === 'Escape') {
            event.stopPropagation()
            setWalkHelpOpen(false)
            pageRef.current?.focus({ preventScroll: true })
          }
        }}>
          <button type="button" className={action} aria-expanded={walkHelpOpen} aria-controls={walkHelpId} onClick={() => {
            setWalkHelpOpen(!walkHelpOpen)
            // Closing help returns keys to the existing walk controller. The
            // focused help button keeps its own keys while the guide is open.
            if (walkHelpOpen) pageRef.current?.focus({ preventScroll: true })
          }}><CircleHelp size={16} aria-hidden="true" />{walkHelpOpen ? (zh ? virtualChurchMainHallText.hideControls.zh : virtualChurchMainHallText.hideControls.en) : (zh ? virtualChurchMainHallText.controls.zh : virtualChurchMainHallText.controls.en)}</button>
          <p id={walkHelpId} hidden={!walkHelpOpen} className="vc-interior-hint">{zh ? virtualChurchMainHallText.wasdArrowKeysToMoveQETo.zh : virtualChurchMainHallText.wasdArrowKeysToMoveQETo.en}</p>
        </div>
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-3" aria-label={zh ? virtualChurchMainHallText.walkTouchControls.zh : virtualChurchMainHallText.walkTouchControls.en}>
          <div className="grid grid-cols-3 gap-1">
            <span />{walkControl('forward', 1, zh ? virtualChurchMainHallText.walkForward.zh : virtualChurchMainHallText.walkForward.en, <ArrowUp size={20} />)}<span />
            {walkControl('strafe', -1, zh ? virtualChurchMainHallText.stepLeft.zh : virtualChurchMainHallText.stepLeft.en, <ArrowLeft size={20} />)}
            {walkControl('forward', -1, zh ? virtualChurchMainHallText.walkBackward.zh : virtualChurchMainHallText.walkBackward.en, <ArrowDown size={20} />)}
            {walkControl('strafe', 1, zh ? virtualChurchMainHallText.stepRight.zh : virtualChurchMainHallText.stepRight.en, <ArrowRight size={20} />)}
          </div>
          <div className="flex gap-1">
            {walkControl('turn', -1, zh ? virtualChurchMainHallText.turnLeft.zh : virtualChurchMainHallText.turnLeft.en, <RotateCcw size={19} />)}
            {walkControl('turn', 1, zh ? virtualChurchMainHallText.turnRight.zh : virtualChurchMainHallText.turnRight.en, <RotateCcw className="scale-x-[-1]" size={19} />)}
          </div>
        </div>
      </> : null}
      {failed ? <div role="alert" className="vc-interior-panel absolute left-1/2 top-4 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 p-4 text-center"><p>{zh ? virtualChurchMainHallText.theAuditoriumPreviewCouldNotDisplayYouCan.zh : virtualChurchMainHallText.theAuditoriumPreviewCouldNotDisplayYouCan.en}</p><button type="button" className={`${action} mt-3`} onClick={() => { setFailed(false); setRevision(value => value + 1) }}><RotateCcw size={16} />{zh ? virtualChurchMainHallText.retryPreview.zh : virtualChurchMainHallText.retryPreview.en}</button></div> : null}
    </div>
    <footer className="vc-interior-footer">
      <button type="button" aria-label={zh ? virtualChurchMainHallText.viewTheStage.zh : virtualChurchMainHallText.viewTheStage.en} aria-pressed={view === 'entrance'} onClick={() => setView('entrance')} className={action}><Eye size={16} /><span className="vc-interior-label-full" aria-hidden="true">{zh ? virtualChurchMainHallText.viewTheStage.zh : virtualChurchMainHallText.viewTheStage.en}</span><span className="vc-interior-label-compact" aria-hidden="true">{zh ? virtualChurchMainHallText.stage.zh : virtualChurchMainHallText.stage.en}</span></button>
      <button type="button" aria-label={zh ? virtualChurchMainHallText.viewTheSeating.zh : virtualChurchMainHallText.viewTheSeating.en} aria-pressed={view === 'stage'} onClick={() => setView('stage')} className={action}><Eye size={16} /><span className="vc-interior-label-full" aria-hidden="true">{zh ? virtualChurchMainHallText.viewTheSeating.zh : virtualChurchMainHallText.viewTheSeating.en}</span><span className="vc-interior-label-compact" aria-hidden="true">{zh ? virtualChurchMainHallText.seating.zh : virtualChurchMainHallText.seating.en}</span></button>
      <button type="button" aria-label={zh ? virtualChurchMainHallText.walkThrough.zh : virtualChurchMainHallText.walkThrough.en} aria-pressed={view === 'walk'} onClick={() => { setView('walk'); pageRef.current?.focus({ preventScroll: true }) }} className={action}><Footprints size={16} /><span className="vc-interior-label-full" aria-hidden="true">{zh ? virtualChurchMainHallText.walkThrough.zh : virtualChurchMainHallText.walkThrough.en}</span><span className="vc-interior-label-compact" aria-hidden="true">{zh ? virtualChurchMainHallText.walk.zh : virtualChurchMainHallText.walk.en}</span></button>
      <span className="vc-interior-note">{zh ? virtualChurchMainHallText.visualReviewOnlyNotARecordOfThe.zh : virtualChurchMainHallText.visualReviewOnlyNotARecordOfThe.en}</span>
    </footer>
  </main>, document.body)
}
