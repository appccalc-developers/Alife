import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { ArrowLeft, ArrowUp, BookOpen, Building2, CalendarDays, Camera, Church, Compass, Eye, Hand, Info, MapPin, Play, Smartphone, UserRound, UsersRound, Video, X } from 'lucide-react'
import { Component, Fragment, Suspense, createContext, lazy, memo, useContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ErrorInfo, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './virtualChurchTourControls.css'
import { useNavigate } from 'react-router-dom'
import { recoverVirtualChurchChunkOnce } from '../app/routing/VirtualChurchRouteBoundary'
import { virtualChurchChunkLoadFailed } from '../app/routing/virtualChurchRouteRecoveryContract'
import { virtualChurchDiagnosticDpr } from './virtualChurchPerformanceContract'
import { ACESFilmicToneMapping, AnimationMixer, Box3, BoxGeometry, BufferGeometry, CanvasTexture, Color, ColorManagement, ConeGeometry, CubeTexture, CylinderGeometry, DefaultLoadingManager, DodecahedronGeometry, DoubleSide, DynamicDrawUsage, EquirectangularReflectionMapping, Euler, ExtrudeGeometry, Float32BufferAttribute, Frustum, Group as ThreeGroup, IcosahedronGeometry, InstancedMesh, LoopOnce, LoopRepeat, MathUtils, Matrix4, Mesh as ThreeMesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, PMREMGenerator, Quaternion, RepeatWrapping, ShaderLib, ShaderMaterial, SphereGeometry, SRGBColorSpace, SRGBTransfer, Shape, ShapeGeometry, ShapeUtils, TextureLoader, UniformsUtils, Vector2, Vector3, type Group, type Material, type Mesh, type Texture } from 'three'
import { GLTFLoader, type GLTF, type GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { BackSide, ImageBitmapLoader, WebGLRenderTarget, type WebGLRenderer } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useAuthStore } from '../stores/auth'
import { ACCESSIBLE_PARKING_PAIR, CENTRAL_PARKING_WHEEL_STOP_INNER_SIDE, CHURCH_DIMENSIONS, PARKING_ROWS, RENDER_BUDGET, SCENE_LANDMARKS, SCENE_SCALE, SCENE_SHOWCASE_CAMERA, SCENE_V3_SHOWCASE_CAMERA, VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS, VIRTUAL_CHURCH_SURROUNDING_TREES, VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION, VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS } from './virtualChurchScene'
import { groundedPosition, buildTerrainLODGrid, provisionalTerrainHeightAt } from './virtualChurchTerrain'
import { virtualChurchInitialFollowCamera, virtualChurchYawTowardLogicalPoint } from './virtualChurchInitialCamera'
import { createVirtualChurchMobileSurroundings, virtualChurchSurroundingStructure } from './virtualChurchSurroundingFacadeGeometry'
import { createVirtualChurchTreeVisibility } from './virtualChurchTreeVisibility'
import { registerVirtualChurchPlantVisibility, updateVirtualChurchPlantVisibility } from './virtualChurchPlantVisibilityRegistry'
import { mergeVirtualChurchRockSources } from './virtualChurchGroundRockBatch'
import { ALIFE_SCENE, ALIFE_LIGHTING, ALIFE_PBR, ALIFE_EMISSIVE, ALIFE_V3_ENVIRONMENT_TREATMENT, ALIFE_V3_SCENE_TREATMENT } from './alifeVisualTheme'
import {
  get3DConfig,
  getPerformanceConfig,
  getTerrainLOD,
  getVirtualChurchCharacterReview,
  getVirtualChurchCharacterReviewQuality,
  getVirtualChurchSharedMotionReview,
  VIRTUAL_CHURCH_CHARACTER_REVIEW_ASSETS,
  VIRTUAL_CHURCH_CHARACTER_REVIEW_PICKERS,
  type VirtualChurchCharacterReview,
  type VirtualChurchCharacterMotionProfile,
  type VirtualChurchHeroId,
  type VirtualChurchVisualVersion,
} from '../services/virtualChurchService'
import { VirtualChurchPerformanceProbe } from './VirtualChurchPerformanceProbe'
import { virtualChurchMaterialForBudget } from './virtualChurchMaterialBudget'
import { composeVirtualChurchSharedMotion, VirtualChurchSharedMotionError } from './virtualChurchSharedMotion'
import { createVirtualChurchOutfitBatch, virtualChurchShouldBatchOriginalOutfitMaps } from './virtualChurchOutfitBatch'
import { assertVirtualChurchGltfTextures, createVirtualChurchGltfIntegrityPlugin, VirtualChurchGltfTextureIntegrityError } from './virtualChurchGltfIntegrity'
import { VirtualChurchTexturePrefetch, VirtualChurchPrefetchedImageBitmapLoader, virtualChurchAtlasUrls, virtualChurchCanPrefetchTextures } from './virtualChurchTexturePrefetch'
import { installVirtualChurchShadowCache } from './virtualChurchShadowCache'
import { createVirtualChurchAccessibleSymbol, createVirtualChurchColoredParkingMarkings } from './virtualChurchParkingGeometry'
import { createVirtualChurchGroundPolygonGeometry } from './virtualChurchGroundPolygonGeometry'
import { VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT } from './virtualChurchScene'
import { THE_RUNWAY, V3_THE_RUNWAY_APPROACH, STARK_DRIVE_NORTH, STARK_DRIVE_SERVICE, ENTRANCE_DRIVEWAY, MAIN_CARPARK, VIRTUAL_CHURCH_SWALE, VIRTUAL_CHURCH_SWALE_PLANTS } from './virtualChurchScene'
import { virtualChurchSwaleFloorAt } from './virtualChurchInteractionContract'
import VirtualChurchGatheringsDialog from './VirtualChurchGatheringsDialog'
import { VIRTUAL_CHURCH_FOYER_FLOOR, createVirtualChurchFoyerOakFloorGeometry, prepareVirtualChurchFoyerFloor } from './virtualChurchFoyerFloor'
import { createVirtualChurchFoyerExtensionCeilingMaterial, prepareVirtualChurchFoyerCeiling } from './virtualChurchFoyerCeiling'
import { prepareVirtualChurchFoyerPassage } from './virtualChurchFoyerPassage'
import { virtualChurchShouldLoadFoyerPhotos, virtualChurchShouldRenderFoyerDetail, virtualChurchWorldCameraIsInsideFoyer } from './virtualChurchFoyerDetailRange'
import { createVirtualChurchFoyerLuminaireGeometry, createVirtualChurchFoyerWickerGeometry } from './virtualChurchFoyerLuminaires'
import { createVirtualChurchFoyerHandrailMaterial, createVirtualChurchFoyerInteriorMaterial, createVirtualChurchFoyerWickerMaterial } from './virtualChurchFoyerLighting'
import { createVirtualChurchFoyerCafeEquipmentGeometry, type FoyerCafeEquipmentPart } from './virtualChurchFoyerCafeEquipment'
import { createVirtualChurchFoyerWelcomeArrangement, createVirtualChurchFoyerWoodworkGeometry, type FoyerWelcomePart } from './virtualChurchFoyerWelcome'
import { FOYER_PLANTER_LEAVES_PER_POT, createVirtualChurchFoyerPlanterLeafGeometry, createVirtualChurchFoyerPlanterPotGeometry, writeVirtualChurchFoyerPlanterInstances } from './virtualChurchFoyerPlanters'
import { addVirtualChurchFoyerContactUV, createVirtualChurchFoyerContactMask, createVirtualChurchFoyerFloorMaterial, createVirtualChurchFoyerFloorShaderPreparation, type FoyerFloorContact } from './virtualChurchFoyerContact'
import { createVirtualChurchFoyerFlagCordGeometry, createVirtualChurchFoyerFlagCordMaterial, createVirtualChurchFoyerFlagGeometry, createVirtualChurchFoyerFlagMaterial } from './virtualChurchFoyerFlags'
import { createVirtualChurchCulvertBatches, createVirtualChurchCulvertCrossingGeometry, type CulvertMouthPlacement } from './virtualChurchCulvertGeometry'
import { CHURCH_AUTOMATIC_DOOR, VEHICLE_GATE_TRACK_OFFSET, createAutomaticVehicleGateAndFenceMatrixWriter, prepareChurchSlidingGeometry, stepAutomaticDoor, vehicleGateSlideDistance } from './virtualChurchAutomaticDoors'
import {
  createVirtualChurchCurvedPlantBladeGeometry,
  createVirtualChurchHedgeInstances,
  createVirtualChurchPlantVisibility,
  writeVirtualChurchTussockMatrices,
  writeVirtualChurchColoredTussocks,
  writeVirtualChurchShrubMatrices,
  virtualChurchPlantClearsPaving,
} from './virtualChurchTussockInstances'
import { VirtualChurchSharedImageBitmapLoader } from './virtualChurchSharedImageBitmapLoader'
import { createVirtualChurchTeleport, virtualChurchCameraLerpFactor } from './virtualChurchTeleport'
import { virtualChurchCrossedMainHallThreshold, virtualChurchMainHallArrivalDoor, virtualChurchMainHallDoorReturnView, virtualChurchMainHallEntryUrl, virtualChurchMainHallPromptAfterProximity, virtualChurchNearbyMainHallDoor, type MainHallArrivalPromptGate } from './virtualChurchMainHallPortal'
import {
  VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_ASSET_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_ACTION_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_RESOURCE_ATTRIBUTE,
  VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE,
  VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE,
  VIRTUAL_CHURCH_INPUT_DIAGNOSTIC_PHASE_ATTRIBUTE,
  VIRTUAL_CHURCH_PLAYER_POSE_ATTRIBUTE,
  clearVirtualChurchRuntimeSignals,
  beginVirtualChurchCharacterDiagnosticScope,
  markVirtualChurchRenderedAssetReady,
  beginVirtualChurchCharacterRetry,
} from './virtualChurchRuntimeSignals'
import gateAAnimationContract from './virtualChurchCharacterAnimationContract.json'
import {
  gateAAnimationForMotionState,
  gateAAnimationIsOneShot,
  gateALocomotionPlaybackScale,
  gateATurnPlaybackScale,
  gateAAnimationPhaseRemainingSeconds,
  gateAAnimationPlaybackScale,
  gateAAvatarYawForMovement,
  gateAAnimationShouldSyncLocomotionPhase,
  gateASynchronizedLocomotionTime,
  gateAShortestYawDelta,
  gateALocomotionCanTranslate,
  gateALocomotionFacingAlignment,
  gateAStepYaw,
  gateAAnimationTransitionSeconds,
  gateAGreetCanRun,
  gateAReviewTransitionStepDistance,
  gateAReviewLoopJoinTime,
  gateAReviewLocomotionPlaybackScale,
  gateAReviewGaitBlendFrame,
  gateAReviewContributingActionWeight,
  type GateAReviewGaitBlend,
  gateAReviewSpeedBlendStep,
  GATE_A_REVIEW_SPEED_BLEND_SECONDS,
  type AvatarMotionState,
  type GateAAnimationName,
} from './virtualChurchCharacterAnimation'
import { gateARefineFemaleWalkGait } from './virtualChurchCharacterGait'
import {
  VIRTUAL_CHURCH_OUTFIT_SWATCHES,
  GATE_A_SKIN_UNLIT_COLOR,
  gateAIsOutfitMaterial,
  gateAIsSkinMaterial,
  gateAOutfitMaterialTint,
  gateAApplyOutfitMaterialTint,
  gateAUsesOpaqueAlphaPath,
  type VirtualChurchOutfitId,
} from './virtualChurchCharacterWardrobe'
import { selectVirtualChurchHeroReadyAssets } from './virtualChurchCriticalAssets'
import { createVirtualChurchShaderFrameQueue, createVirtualChurchStartupSubmissions, scheduleVirtualChurchShaderWarmup, virtualChurchAssetHasRendered, virtualChurchDeferredDelayMs, virtualChurchDeferredCanStart } from './virtualChurchLoadingContract'
import { createVirtualChurchShaderIntrospectionTrace, createVirtualChurchShaderProgramAssociations, type VirtualChurchShaderSource } from './virtualChurchPerformanceContract'
import {
  VIRTUAL_CHURCH_AUXILIARY_BUILDING as AUXILIARY_BUILDING,
  VIRTUAL_CHURCH_BUILDING_FOOTPRINT as BUILDING_FOOTPRINT,
  VIRTUAL_CHURCH_PLAYER_BOUNDS,
  VIRTUAL_CHURCH_FOYER_CIRCULATION,
  VIRTUAL_CHURCH_FOYER_SERVICE_FRONTAGE,
  VIRTUAL_CHURCH_FOYER_GUARD_ROOM,
  VIRTUAL_CHURCH_FOYER_FAR_CABINET,
  VIRTUAL_CHURCH_FOYER_STAIR,
  VIRTUAL_CHURCH_FOYER_STAIR_END_PIER,
  VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS,
  VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW,
  VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW,
  VIRTUAL_CHURCH_FOYER_VIEW,
  VIRTUAL_CHURCH_MAIN_HALL_VIEW,
  virtualChurchMainHallComparisonYaw,
  VIRTUAL_CHURCH_SECONDARY_HALL_VIEW,
  VIRTUAL_CHURCH_WALKABLE_FOYER,
  VIRTUAL_CHURCH_SURROUNDING_BUILDINGS,
  type VirtualChurchSurroundingBuilding,
  virtualChurchGroundHeightAt,
  virtualChurchPointInsidePolygon as pointInsidePolygon,
  virtualChurchPositionIsBlocked as isBlocked,
  virtualChurchPositionIsInsideFoyerInterior,
  virtualChurchPositionIsInsideWalkableFoyer,
  virtualChurchPositionIsNearEntrance,
  virtualChurchShouldRenderSurroundingFacadeDetails,
} from './virtualChurchInteractionContract'
import {
  useVirtualChurchDialogFocus,
  useVirtualChurchPageIsolation,
  useVirtualChurchReducedMotion,
} from './virtualChurchAccessibility'
import { useVirtualChurchRuntimeStatus } from './virtualChurchStatus'
import { virtualChurchPlayerInputEnabled, virtualChurchShouldCoverLoadingScene, type VirtualChurchRuntimeStatus } from './virtualChurchStatusContract'
import {
  virtualChurchContextLossDiagnosticLimit,
  virtualChurchShouldReportContextLoss,
  virtualChurchShouldAutomaticallyRecover,
} from './virtualChurchRecoveryContract'
import {
  createVirtualChurchResourceLeaseRegistry,
  disposeVirtualChurchCharacterSkeletons,
  createVirtualChurchStrictModeCleanupGuard,
  freezeVirtualChurchUnanimatedCloneBoneMatrices,
  shareVirtualChurchOwnedCloneSkeletons,
} from './virtualChurchResourceLeaseContract'
import {
  VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC,
  VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC,
  virtualChurchLocomotionDiagnosticInputAt,
} from './virtualChurchInputDiagnostic'

const perfConfig = getPerformanceConfig()
const profile3DSearchParams = new URLSearchParams(window.location.search)
const profile3DEnabled = profile3DSearchParams.has('profile3d')
// Fixed diagnostic spawn avoids a guide teleport (and its profile restart)
// when comparing the V2/V3 street-front mobile draw ceiling. Never affect a
// normal visitor or a return from the main hall.
const profile3DStartAtStreet = profile3DEnabled
  && profile3DSearchParams.get('profile3dView') === 'streetFront'
  && !profile3DSearchParams.has('vcArrival')
const profile3DFailureMode = profile3DSearchParams.get('profile3dFailure')
const profile3DInputDiagnostic = profile3DEnabled
  ? profile3DSearchParams.get('profile3dInput')
  : null
const profile3DGpuReleaseDiagnostic = profile3DEnabled
  && profile3DSearchParams.get('profile3dGpu') === 'release'
const VIRTUAL_CHURCH_GPU_RELEASE_DIAGNOSTIC_ATTRIBUTE =
  'data-virtual-church-gpu-release-diagnostic'
const contextLossDiagnosticLimit = virtualChurchContextLossDiagnosticLimit(
  profile3DFailureMode,
)

type VirtualChurchGpuReleaseDiagnostic = {
  createdContexts: number
  releasedContexts: number
  activeContexts: number
  lastCreatedAt: number | null
  lastReleasedAt: number | null
  lastReleasePath: string | null
  canvasConnectedAtRelease: boolean | null
  memoryBeforeRelease: {
    geometries: number
    textures: number
  } | null
}

type VirtualChurchDiagnosticWindow = Window & {
  __alifeVirtualChurchGpuRelease?: VirtualChurchGpuReleaseDiagnostic
}

const updateVirtualChurchGpuReleaseDiagnostic = (
  update: (current: VirtualChurchGpuReleaseDiagnostic) => void,
) => {
  if (!profile3DGpuReleaseDiagnostic) return
  const diagnosticWindow = window as VirtualChurchDiagnosticWindow
  const current = diagnosticWindow.__alifeVirtualChurchGpuRelease ?? {
    createdContexts: 0,
    releasedContexts: 0,
    activeContexts: 0,
    lastCreatedAt: null,
    lastReleasedAt: null,
    lastReleasePath: null,
    canvasConnectedAtRelease: null,
    memoryBeforeRelease: null,
  }
  update(current)
  diagnosticWindow.__alifeVirtualChurchGpuRelease = current
  document.documentElement.setAttribute(
    VIRTUAL_CHURCH_GPU_RELEASE_DIAGNOSTIC_ATTRIBUTE,
    JSON.stringify(current),
  )
}

const GLASS_TRANSMISSION_PROPS = perfConfig.glassTransmission
  ? { transmission: 0.14, thickness: 0.5, ior: 1.5, transparent: false, opacity: 1 }
  : { transparent: true, opacity: 0.88 }

type MovementInput = {
  joystickX: number
  joystickZ: number
  keyboardX: number
  keyboardZ: number
  diagnosticX: number
  diagnosticZ: number
  diagnosticElapsedMs: number | null
  jumpQueued: boolean
  gestureQueued: boolean
  sprint: boolean
  diagnosticSprint: boolean
  movementIntensity: number
  travelledSpeedMps: number
  turnDurationSeconds: number
  avatarState: AvatarMotionState
}

type MovementRef = MutableRefObject<MovementInput>
const DeferredSurroundingFacades = lazy(() => import('./VirtualChurchSurroundingFacades'))
const DeferredPostProcessing = lazy(() => import('./VirtualChurchPostProcessing'))
const DoorInteractionContext = createContext<{ position: MutableRefObject<Vector3>; reducedMotion: boolean } | null>(null)

const useAutomaticDoor = (name: string, centre: [number, number], radius: number, apply: (progress: number) => void, enabled = true) => {
  const interaction = useContext(DoorInteractionContext)
  const state = useRef({ open: false, awaySeconds: 0, progress: 0 })
  const { invalidate } = useThree()
  const attribute = `data-vc-${name}-door`
  useEffect(() => {
    if (!enabled) document.documentElement.removeAttribute(attribute)
    return () => document.documentElement.removeAttribute(attribute)
  }, [attribute, enabled])
  useFrame((_, delta) => {
    if (!interaction || !enabled) return
    const p = interaction.position.current
    const distance = Math.hypot(p.x - centre[0], p.z - centre[1])
    const progress = stepAutomaticDoor(state.current, distance, delta, radius, interaction.reducedMotion)
    apply(progress)
    const signal = `${state.current.open ? 'opening' : 'closing'}:${progress.toFixed(2)}`
    if (document.documentElement.getAttribute(attribute) !== signal) document.documentElement.setAttribute(attribute, signal)
    if (progress !== (state.current.open ? 1 : 0) || (state.current.open && distance > radius + 1.5)) invalidate()
  })
}
type RequestFrameRef = MutableRefObject<(() => void) | null>
type CameraViewRef = MutableRefObject<{ yaw: number; pitch: number }>
type CameraMode = 'first' | 'follow' | 'showcase'
type CameraModeRef = MutableRefObject<CameraMode>
type TeleportRef = ReturnType<typeof createVirtualChurchTeleport>
type DustTriggerRef = MutableRefObject<((position: [number, number, number]) => void) | null>
type CharacterId = 'cleric' | 'ranger' | 'wizard' | 'pastor' | 'sister' | 'believerMan' | 'believerWoman'
type ChurchRole = 'pastor' | 'sister' | 'brother' | 'believerWoman'
type OutfitId = VirtualChurchOutfitId
type TreeVariant = 'broadleaf' | 'oak' | 'pine'
type VehicleVariant = 'sedan' | 'suv' | 'van'

const useDeferredAfterHero = (
  delayMs = 2000,
  deferOnDesktop = false,
  enabled = true,
  requireCharacterReady = false,
) => {
  const shouldDefer = enabled && (perfConfig.isMobile || deferOnDesktop)
  const mountedAtRef = useRef(window.performance.now())
  const [ready, setReady] = useState(!shouldDefer)

  useEffect(() => {
    if (!enabled || !shouldDefer || ready) return

    let deferredLoadTimer: number | undefined
    const scheduleDetail = () => {
      if (!virtualChurchDeferredCanStart(
        document.documentElement.getAttribute(VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE),
        document.documentElement.getAttribute(VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE),
        mountedAtRef.current,
        requireCharacterReady,
      )) return

      observer.disconnect()
      deferredLoadTimer ??= window.setTimeout(() => setReady(true), delayMs)
    }
    const observer = new MutationObserver(scheduleDetail)

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: requireCharacterReady
        ? [VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE, VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE]
        : [VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE],
    })
    scheduleDetail()

    return () => {
      observer.disconnect()
      if (deferredLoadTimer !== undefined) window.clearTimeout(deferredLoadTimer)
    }
  }, [delayMs, enabled, ready, requireCharacterReady, shouldDefer])

  return enabled && ready
}

const config3D = get3DConfig()
// Isolated visual candidate: never load its stylesheet in a production build.
const editorialCharacterPreview = import.meta.env.DEV
  && config3D.visualVersion === 'v3'
  && profile3DSearchParams.get('vcCharacterUi') === 'editorial'
if (editorialCharacterPreview) void import('./virtualChurchCharacterReview.css')
// A fixed photo-backed interior spawn lets the existing probe sample the
// foyer without a late guide teleport. It is V3-only and diagnostic-only.
const profile3DStartAtFoyer = profile3DEnabled
  && config3D.visualVersion === 'v3'
  && profile3DSearchParams.get('profile3dView') === 'foyer'
  && !profile3DSearchParams.has('vcArrival')
const initialCharacterReview = getVirtualChurchCharacterReview(config3D.visualVersion)
const characterReviewQuality = getVirtualChurchCharacterReviewQuality(
  perfConfig.isMobile ? 'low' : 'medium',
)
const HERO_READY_ASSETS = selectVirtualChurchHeroReadyAssets(
  config3D,
  perfConfig.isMobile,
)
const CHURCH_HERO_ASSET_PATH = profile3DFailureMode === 'church-glb'
  ? `${HERO_READY_ASSETS.churchHero}.missing`
  : HERO_READY_ASSETS.churchHero
// Stable registration identity prevents duplicate hooks in the shared loader.
const VIRTUAL_CHURCH_TEXTURE_PREFETCH = new VirtualChurchTexturePrefetch(
  virtualChurchAtlasUrls(HERO_READY_ASSETS.churchHero, window.location.href), window.location.href,
)
const installVirtualChurchGltfIntegrity = (parser: GLTFParser) => {
  if (new URL(parser.options.path, window.location.href).href === new URL('.', new URL(CHURCH_HERO_ASSET_PATH, window.location.href)).href
    && parser.textureLoader instanceof ImageBitmapLoader) {
    parser.textureLoader = new VirtualChurchPrefetchedImageBitmapLoader(parser.textureLoader, VIRTUAL_CHURCH_TEXTURE_PREFETCH)
  }
  return createVirtualChurchGltfIntegrityPlugin(parser, CHURCH_HERO_ASSET_PATH, window.location.href)
}
const CHARACTER_HERO_PICKER_PATH = config3D.characters.gateAFemalePicker

const virtualChurchCharacterHeroAssetPath = (
  review: VirtualChurchCharacterReview | null,
  heroId: VirtualChurchHeroId = 'female',
) => {
  const releasedAsset = selectVirtualChurchHeroReadyAssets(config3D, perfConfig.isMobile, heroId).characterHero
  const reviewAssets = review ? VIRTUAL_CHURCH_CHARACTER_REVIEW_ASSETS[review] : undefined
  const selectedAssetPath = review
    ? reviewAssets?.[characterReviewQuality]
      ?? reviewAssets?.medium
      ?? HERO_READY_ASSETS.characterHero
    : releasedAsset
  return profile3DFailureMode === 'character-glb'
    ? `${selectedAssetPath}.missing`
    : selectedAssetPath
}

const virtualChurchCharacterPickerPath = (
  review: VirtualChurchCharacterReview,
) => review.startsWith('female-')
  ? CHARACTER_HERO_PICKER_PATH
  : VIRTUAL_CHURCH_CHARACTER_REVIEW_PICKERS[review]
    ?? CHARACTER_HERO_PICKER_PATH

const NATURE_ASSETS = config3D.nature

const VEHICLE_ASSETS: Record<VehicleVariant, string> = config3D.vehicles

const CHARACTER_ASSETS: Record<CharacterId, string> = config3D.characters
const legacyCharacterAssetPath = (characterId: CharacterId) => {
  const configuredAsset = CHARACTER_ASSETS[characterId]
  return profile3DFailureMode === 'character-glb'
    ? `${configuredAsset}.missing`
    : configuredAsset
}

const FLAX_BLADE_GEOMETRY = new ConeGeometry(0.09, 1.7, 5)
const FLAX_BLADE_MATERIAL = new MeshStandardMaterial({ color: '#456f50', roughness: 0.95 })
const TUSSOCK_BLADE_GEOMETRY = new ConeGeometry(0.055, 1.1, 4)
const TUSSOCK_BASE_MATERIAL = new MeshStandardMaterial({ color: '#78905e', roughness: 1, side: DoubleSide })
const TUSSOCK_RESERVE_MATERIAL = new MeshStandardMaterial({ color: '#829865', roughness: 1, side: DoubleSide })
const TUSSOCK_ACCENT_MATERIAL = new MeshStandardMaterial({ color: '#9baa6d', roughness: 1, side: DoubleSide })
const V3_FLAX_BLADE_GEOMETRY = createVirtualChurchCurvedPlantBladeGeometry(1.7, 0.08, 0.12, 0.32, 0.04)
const V3_TUSSOCK_BLADE_GEOMETRY = createVirtualChurchCurvedPlantBladeGeometry(1.1, 0.045, 0.075, 0.24, 0.025)
const V3_PLANT_TREATMENT = ALIFE_V3_ENVIRONMENT_TREATMENT.plantSilhouettes
const createV3PlantMaterial = (color: string) => new MeshStandardMaterial({
  color,
  roughness: V3_PLANT_TREATMENT.roughness,
  metalness: 0,
  envMapIntensity: V3_PLANT_TREATMENT.envMapIntensity,
  side: DoubleSide,
})
const V3_FLAX_BLADE_MATERIAL = createV3PlantMaterial(V3_PLANT_TREATMENT.flax)
const V3_TUSSOCK_BASE_MATERIAL = createV3PlantMaterial(V3_PLANT_TREATMENT.tussock)
const V3_TUSSOCK_RESERVE_MATERIAL = createV3PlantMaterial(V3_PLANT_TREATMENT.reserveTussock)
const V3_TUSSOCK_ACCENT_MATERIAL = createV3PlantMaterial(V3_PLANT_TREATMENT.dryAccent)
const V3_TUSSOCK_INSTANCE_MATERIAL = createV3PlantMaterial('#ffffff')
// The entrance planting is a hero asset on desktop, so keep its silhouette
// round at close range while retaining the existing lower-cost mobile mesh.
const SHRUB_CROWN_GEOMETRY = new SphereGeometry(
  0.5,
  perfConfig.isMobile ? 16 : 24,
  perfConfig.isMobile ? 12 : 18,
)
const SHRUB_SIDE_MATERIAL = new MeshStandardMaterial({ color: '#52785a', roughness: 0.9 })
const SHRUB_CENTRE_MATERIAL = new MeshStandardMaterial({ color: '#64886b', roughness: 0.9 })
const V3_SHRUB_INSTANCE_MATERIAL = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })

const VIRTUAL_CHURCH_DRACO_LOADER = new DRACOLoader()
VIRTUAL_CHURCH_DRACO_LOADER.setDecoderPath(config3D.dracoDecoderPath)
VIRTUAL_CHURCH_DRACO_LOADER.preload()

const CHARACTER_IDLE_CLIPS: Record<CharacterId, string> = {
  cleric: 'Idle_Weapon',
  ranger: 'Idle_Weapon',
  wizard: 'Idle_Weapon',
  pastor: 'Idle_Neutral',
  sister: 'Idle_Neutral',
  believerMan: 'Idle',
  believerWoman: 'Idle_Neutral',
}

const ROLE_CHARACTERS: Record<ChurchRole, CharacterId> = {
  pastor: 'pastor',
  sister: 'sister',
  brother: 'believerMan',
  believerWoman: 'believerWoman',
}

const copy = {
  zh: {
    back: '返回 Alife',
    prototype: '沉浸式体验 · Alpha',
    churchName: '丰盛生命教会 · Wigram',
    welcomeEyebrow: '欢迎来到线上教会',
    welcomeTitle: '在这里，先认识空间，再走进团契',
    welcomeBody: '这是以 182 The Runway 实际建筑与场地为依据制作的轻量 3D 体验。走到发光入口可进入查经，也可以随时使用快捷入口。',
    welcomeBodyV3: '从正门进入后，沿门厅直行；左侧是主堂，右侧是副堂方向。也可以直接进入五位虚拟同伴围坐的查经房。',
    start: '开始探索',
    enterStudy: '直接进入查经',
    enterStudyV3: '直接进入查经房',
    controls: 'WASD 或方向键移动 · Shift 奔跑 · 空格跳跃 · G 问候 · 拖动视角',
    cameraHint: '在右侧滑动调整视角',
    landscapeHint: '横屏游览，视野更开阔；竖屏也可继续',
    cameraModes: '切换视角',
    firstPerson: '第一人称',
    thirdPerson: '第三人称',
    showcaseView: '英雄视角',
    moveHint: '拖动圆点移动',
    jump: '跳跃',
    greet: '问候',
    nearEntranceInfoTitle: '欢迎 · WELCOME',
    nearEntranceInfoDetail: '周日聚会 · SUNDAY GATHERING',
    nearEntranceInfoAction: '查看聚会',
    nearStudy: '进入查经',
    goStudy: '前往查经',
    openGuide: '打开导览',
    guide: '空间导览',
    guideBody: '不必绕路：选择目的地可立即回到入口，或打开 Alife 的主要教会空间。',
    entrance: '教会入口',
    entranceDetail: '回到正门前的发光入口点',
    foyer: '门厅内景',
    foyerDetail: '从正门向内走：左侧门卫室、两处主堂门和迎宾桌，右侧是咖啡窗及相邻的深色双门；尽头可转向两侧走廊（动线样板）',
    mainHallView: '正门看主堂方向',
    mainHallViewDetail: '站在正门向左望：先看见两组主堂门，门后是放宣传册的迎宾桌（照片对照视角）',
    mainHallInterior: '主堂内部 · 2017 参考',
    mainHallInteriorDetail: '依据这栋教堂的公开旧照查看座席与舞台候选，现状和尺寸仍待核对',
    mainHallDoorPrompt: '主堂门会自动打开；向里走或点击进入 · 内部为 2017 照片参考预览',
    mainHallDoorAction: '进入主堂预览',
    secondaryHallView: '副堂方向对照',
    secondaryHallViewDetail: '沿入口往前，查看咖啡窗旁的深色双门',
    junction: '尽头左走廊',
    junctionDetail: '看靠门厅的庭院窗、后续侧门与尽头门（照片约束的动线候选）',
    rightJunction: '尽头右走廊',
    rightJunctionDetail: '从对门前向右看其他房间（动线样板）',
    foyerFlags: '活动国旗布置',
    foyerFlagsDetail: '照片中的临时布置，可随时切换。',
    foyerFlagsShow: '显示国旗',
    foyerFlagsHide: '隐藏国旗',
    parking: '教会招牌视角',
    parkingDetail: '看清教会名称、十字架与正立面',
    streetFront: '街道正立面',
    streetFrontDetail: '对照十字架、格栅、围栏与排水浅沟',
    surroundings: '周边建筑视角',
    surroundingsDetail: '查看 The Runway 北侧建筑与工业区围合关系',
    study: '查经',
    studyDetail: '进入五位虚拟同伴围坐的查经房',
    sermons: '讲道',
    sermonsDetail: '观看与讨论信息',
    events: '查看聚会',
    eventsDetail: '查看首页聚会时间表',
    close: '关闭',
    accuracy: '场景依据市议会 2025 航拍、OpenStreetMap 建筑轮廓、工程方资料与现场照片近似还原，不代表测绘或建筑图纸精度。',
    unavailableTitle: '虚拟教堂暂时无法显示',
    unavailableBody: '当前设备无法稳定运行 WebGL。你仍然可以使用 Alife 的普通查经和小组功能。',
    contextLostTitle: '教堂空间需要重新载入',
    contextLostBody: '设备暂时释放了 3D 显示资源。你可以重新载入教堂空间，或继续使用普通查经功能。',
    sceneErrorTitle: '教堂空间遇到显示错误',
    sceneErrorBody: '3D 场景已安全停止。你可以重新载入场景，或继续使用普通查经和小组功能。',
    chunkConflictTitle: '教堂资源需要更新',
    chunkConflictBody: '页面代码与缓存的资源版本不一致。正在尝试清理失效缓存并重新打开；如果未自动恢复，请手动清理并重载。',
    chunkOfflineBody: '当前离线，暂时无法取得更新后的教堂资源。现有缓存已保留；联网后再清理并重载。',
    technicalDetails: '技术详情',
    retry3D: '重新载入 3D',
    cleanReload3D: '清理并重载',
    reconnect3D: '联网后重试',
    retryCharacter: '重新加载角色',
    retryingCharacter: '正在重新加载角色…',
    loading3D: '正在准备教堂与角色…',
    slowLoading3D: '完整角色仍在加载；不会先显示简化替身。',
    ready3D: '教堂空间已准备好',
    degraded3D: '部分 3D 资产正在使用兼容显示',
    characterUnavailable3D: '角色暂时无法显示；可以重新加载角色',
    character: '角色选择',
    characterTitle: '选择角色',
    churchRole: '教会身份',
    pastor: '牧师',
    sisterRole: '修女',
    brother: '弟兄',
    believerWoman: '姊妹',
    wardrobe: '服装方案',
    classicOutfit: '经典',
    serviceOutfit: '礼拜',
    communityOutfit: '团契',
    previewAlt: '角色缩略图',
    characterNote: '教会身份使用独立模型；服装只改变角色外观，不会改变教会权限。',
    characterSourceLabel: '样例改造来源',
    characterSourceNote: '角色基于 pixiv VRoid Project 的 VRoid Studio 样例改造，为 Alife 调整外观和动作，并非从零原创模型。',
    gateAHeroLabel: 'Alife Hero 01',
    gateAHeroRole: '教会空间向导',
    gateAHeroAppearanceLabel: '外观',
    gateAHeroAppearance: '浅暖肤色 · 银白长发 · 绿色眼睛',
    gateAHeroWardrobeLabel: '造型',
    gateAHeroWardrobe: '象牙白、翡翠绿与金色礼服',
    gateAHeroPortraitAlt: 'Alife Hero 01 女性角色全身定妆图',
    gateAHeroLocked: '当前只开放这一名达到视觉基准的完整角色；其他角色必须先完成真实定妆图与实机颜值验收。',
    gateAWardrobeNote: '三套服装方案复用同一网格、骨架和材质槽，只改变受控配色，不会额外下载角色。',
    reviewCharactersLabel: '动作评审角色',
    reviewCharactersNote: '开发评审模式：两名角色都使用各自最终模型的真实定妆图。切换会替换场景角色并释放上一名角色的解码与 GPU 源资源；不会修改教堂或生产默认版本。',
    reviewSelected: '当前角色',
    reviewFemaleLabel: 'Alife Hero 01',
    reviewFemaleRole: '教会空间向导',
    reviewFemaleAppearance: '浅暖肤色 · 银白长发 · 绿色眼睛',
    reviewFemaleWardrobe: '象牙白、翡翠绿与金色礼服',
    reviewFemalePortraitAlt: 'Alife Hero 01 女性角色最终模型全身定妆图',
    reviewMaleLabel: 'Alife Hero 02',
    reviewMaleRole: '教会空间同行者',
    reviewMaleAppearance: '浅暖肤色 · 栗色短发 · 暖棕眼睛',
    reviewMaleWardrobe: '暖白长外套 · 深色高领 · 深棕长裤',
    reviewMalePortraitAlt: 'Alife Hero 02 男性角色最终模型全身定妆图',
  },
  en: {
    back: 'Back to Alife',
    prototype: 'Immersive experience · Alpha',
    churchName: 'Chinese Abundant Life Church · Wigram',
    welcomeEyebrow: 'Welcome to church online',
    welcomeTitle: 'Discover the place, then join the community',
    welcomeBody: 'This lightweight 3D experience is based on the real building and grounds at 182 The Runway. Walk to the glowing entrance for Bible study, or use the shortcuts at any time.',
    welcomeBodyV3: 'Enter through the front doors and continue down the foyer. The main auditorium is on the left, with the secondary hall to the right. Or go straight to the Bible-study room with five virtual companions.',
    start: 'Start exploring',
    enterStudy: 'Go to Bible study',
    enterStudyV3: 'Go to the Bible-study room',
    controls: 'Move with WASD or arrows · Shift to run · Space to jump · G to greet · Drag to look',
    cameraHint: 'Swipe on the right to look around',
    landscapeHint: 'Turn for a wider view, or keep exploring upright',
    cameraModes: 'Change camera',
    firstPerson: 'First person',
    thirdPerson: 'Third person',
    showcaseView: 'Hero view',
    moveHint: 'Drag the dot to move',
    jump: 'Jump',
    greet: 'Greet',
    nearEntranceInfoTitle: 'WELCOME · 欢迎',
    nearEntranceInfoDetail: 'SUNDAY GATHERING · 周日聚会',
    nearEntranceInfoAction: 'Gatherings',
    nearStudy: 'Enter Bible study',
    goStudy: 'Go to Bible study',
    openGuide: 'Open guide',
    guide: 'Explore the space',
    guideBody: 'No need to take the long way: return to the entrance or open a key Alife church space.',
    entrance: 'Church entrance',
    entranceDetail: 'Return to the glowing point by the main doors',
    foyer: 'Inside the foyer',
    foyerDetail: 'From the entrance: a small guard room, two main-hall door banks and a brochure table on the left; the cafe window and its charcoal double doors are on the right. Side corridors branch ahead (layout preview)',
    mainHallView: 'Entrance view toward main hall',
    mainHallViewDetail: 'Look left from the entrance: two main-hall door banks, then the brochure welcome table (photo comparison)',
    mainHallInterior: 'Main auditorium · 2017 reference',
    mainHallInteriorDetail: 'Review a seating and stage candidate based on this church’s historical photos; current details and dimensions remain unverified',
    mainHallDoorPrompt: 'Auditorium doors open automatically; walk through or tap Enter · 2017 photo-based preview',
    mainHallDoorAction: 'Enter auditorium preview',
    secondaryHallView: 'Toward the secondary hall',
    secondaryHallViewDetail: 'Walk inward to review the charcoal double doors beside the cafe window',
    junction: 'Far left corridor',
    junctionDetail: 'See the near courtyard window, later room doors and far door (photo-guided layout preview)',
    rightJunction: 'Far right corridor',
    rightJunctionDetail: 'Look right toward other rooms near the opposite door (layout preview)',
    foyerFlags: 'Event flags in the foyer',
    foyerFlagsDetail: 'Temporary decoration from the photos; switch it at any time.',
    foyerFlagsShow: 'Show flags',
    foyerFlagsHide: 'Hide flags',
    parking: 'Church sign view',
    parkingDetail: 'See the church name, cross, and street-facing facade',
    streetFront: 'Street frontage',
    streetFrontDetail: 'Inspect the cross, fins, fence, and drainage swale',
    surroundings: 'Surrounding buildings',
    surroundingsDetail: 'View the northern The Runway context and industrial enclosure',
    study: 'Bible study',
    studyDetail: 'Join five virtual companions in the study room',
    sermons: 'Sermons',
    sermonsDetail: 'Watch and discuss messages',
    events: 'Gathering times',
    eventsDetail: 'View the homepage gathering timetable',
    close: 'Close',
    accuracy: 'This scene is an approximate recreation based on the council 2025 aerial, OpenStreetMap footprint, project information, and site photos; it is not a survey or architectural drawing.',
    unavailableTitle: 'The virtual church is unavailable',
    unavailableBody: 'This device cannot run WebGL reliably. You can still use Alife Bible study and group features.',
    contextLostTitle: 'The church space needs to reload',
    contextLostBody: 'This device temporarily released its 3D display resources. Reload the church space, or continue with Bible study.',
    sceneErrorTitle: 'The church space hit a display error',
    sceneErrorBody: 'The 3D scene stopped safely. Reload the scene, or continue using Bible study and group features.',
    chunkConflictTitle: 'Church resources need to refresh',
    chunkConflictBody: 'The page code and cached resources are out of sync. We are trying a clean reload; if it does not recover automatically, clean and reload manually.',
    chunkOfflineBody: 'Offline: existing caches are preserved. Reconnect, then clean and reload the church resources.',
    technicalDetails: 'Technical details',
    retry3D: 'Reload 3D',
    cleanReload3D: 'Clean and reload',
    reconnect3D: 'Reconnect to retry',
    retryCharacter: 'Reload character',
    retryingCharacter: 'Reloading character…',
    loading3D: 'Preparing the church and character…',
    slowLoading3D: 'The full character is still loading; no stand-in will appear.',
    ready3D: 'The church space is ready',
    degraded3D: 'Some 3D assets are using compatibility display',
    characterUnavailable3D: 'The character is temporarily unavailable; reload it to try again',
    character: 'Choose character',
    characterTitle: 'Choose your character',
    churchRole: 'Church identity',
    pastor: 'Pastor',
    sisterRole: 'Sister',
    brother: 'Brother',
    believerWoman: 'Woman of faith',
    wardrobe: 'Wardrobe',
    classicOutfit: 'Classic',
    serviceOutfit: 'Service',
    communityOutfit: 'Community',
    previewAlt: 'Character thumbnail',
    characterNote: 'Church identities use distinct models; wardrobe choices only change appearance, not church permissions.',
    characterSourceLabel: 'Sample-model adaptation',
    characterSourceNote: 'Based on VRoid Studio sample models by pixiv VRoid Project, with appearance and motion adapted for Alife; not models created from scratch.',
    gateAHeroLabel: 'Alife Hero 01',
    gateAHeroRole: 'Church-space guide',
    gateAHeroAppearanceLabel: 'Appearance',
    gateAHeroAppearance: 'Fair warm skin · silver-white hair · green eyes',
    gateAHeroWardrobeLabel: 'Look',
    gateAHeroWardrobe: 'Ivory, jade and gold ceremonial outfit',
    gateAHeroPortraitAlt: 'Full-length character portrait of Alife Hero 01',
    gateAHeroLocked: 'Only this complete character currently meets the visual bar. Every future character must first pass a real portrait and in-scene beauty review.',
    gateAWardrobeNote: 'All three wardrobe presets reuse the same mesh, rig and material slots. Only controlled colour changes are applied, with no extra character download.',
    reviewCharactersLabel: 'Motion-review characters',
    reviewCharactersNote: 'Development review mode: both portraits come from the final model for that character. Switching replaces the scene avatar and releases the previous character’s decoded and GPU source resources; it does not change the church or the production default.',
    reviewSelected: 'Current character',
    reviewFemaleLabel: 'Alife Hero 01',
    reviewFemaleRole: 'Church-space guide',
    reviewFemaleAppearance: 'Fair warm skin · silver-white hair · green eyes',
    reviewFemaleWardrobe: 'Ivory, jade and gold ceremonial outfit',
    reviewFemalePortraitAlt: 'Full-length final-model portrait of the female Alife Hero 01',
    reviewMaleLabel: 'Alife Hero 02',
    reviewMaleRole: 'Church-space companion',
    reviewMaleAppearance: 'Fair warm skin · chestnut hair · warm brown eyes',
    reviewMaleWardrobe: 'Warm ivory long coat · dark roll-neck · deep brown trousers',
    reviewMalePortraitAlt: 'Full-length final-model portrait of the male Alife Hero 02',
  },
} as const

const PLAYER_START = profile3DStartAtStreet
  ? SCENE_LANDMARKS.streetFrontPreview
  : profile3DStartAtFoyer
    ? VIRTUAL_CHURCH_FOYER_VIEW.position
    : SCENE_LANDMARKS.playerStart
// The V3 arrival should face the photographed cedar entrance, not the far
// parking row. Retain the surveyed driveway heading for the released V2 view.
const PLAYER_START_YAW = profile3DStartAtStreet
  ? SCENE_LANDMARKS.streetFrontPreviewYaw
  : profile3DStartAtFoyer
    ? VIRTUAL_CHURCH_FOYER_VIEW.yaw
    : config3D.visualVersion === 'v3'
      ? virtualChurchYawTowardLogicalPoint(PLAYER_START, SCENE_LANDMARKS.entrance)
      : SCENE_LANDMARKS.playerStartYaw
const showcaseCamera = config3D.visualVersion === 'v3' ? SCENE_V3_SHOWCASE_CAMERA : SCENE_SHOWCASE_CAMERA
const HERO_SHOWCASE_CAMERA_POSITION = new Vector3(...showcaseCamera.position)
const HERO_SHOWCASE_LOOK_AT = new Vector3(...showcaseCamera.lookAt)
const THIRD_PERSON_CAMERA_DISTANCE = 6.2
const THIRD_PERSON_FOYER_CAMERA_DISTANCE = 3.25
const THIRD_PERSON_CAMERA_BASE_HEIGHT = 1.9
const THIRD_PERSON_CAMERA_PITCH_HEIGHT = 3.2
const INITIAL_FOLLOW_CAMERA_PITCH = profile3DStartAtStreet
  ? 0.12
  : profile3DStartAtFoyer ? VIRTUAL_CHURCH_FOYER_VIEW.pitch : 0.24
const GATE_A_DESKTOP_IDLE_MIXER_INTERVAL_SECONDS = 1 / 30

const GRAVITY = 22
const JUMP_VELOCITY = 6.4
const WALK_SPEED = 1.85
const RUN_SPEED = 4.5
// The V3 hero uses a compact authored stride. Keep the legacy V2 controller
// unchanged, but match V3 translation to the actual stance-foot sweep so a
// pleasant human-scale walk does not have to be played at double speed.
const gateACharacterWalkSpeed = (
  review: VirtualChurchCharacterMotionProfile | null,
) => review === 'male' || review?.startsWith('male-')
    ? 1.6022
    : 1.5497
const gateACharacterRunSpeed = (
  review: VirtualChurchCharacterMotionProfile | null,
) => review === 'male' || review?.startsWith('male-')
    ? 3.0531
    : 4.1015
const TAKEOFF_DURATION = 0.16
const LANDING_DURATION = 0.22
const PLAYER_QUARTER_TURN_DURATION_SECONDS = 0.8
const PLAYER_TURN_SPEED = (Math.PI / 2) / PLAYER_QUARTER_TURN_DURATION_SECONDS
const GATE_A_PHASE_DURATIONS = {
  takeoff: TAKEOFF_DURATION,
  landing: LANDING_DURATION,
}

const selectedGateALocomotionPlaybackScale = (
  review: VirtualChurchCharacterMotionProfile | null,
  animation: GateAAnimationName,
  movementIntensity: number,
  travelledSpeedMps: number,
  distanceMatchedMotion: boolean,
) => {
  if (!distanceMatchedMotion) {
    return gateALocomotionPlaybackScale(animation, movementIntensity)
  }

  if (animation === 'Walk' || animation === 'Run') {
    return gateAReviewLocomotionPlaybackScale(
      travelledSpeedMps,
      animation === 'Walk' ? gateACharacterWalkSpeed(review) : gateACharacterRunSpeed(review),
    )
  }
  return 1
}

const clearFailedGltfAsset = (assetPath: string) => {
  // A second decode of the same URL may already be mounted. Disposing this
  // generation must not evict its live generation from R3F's loader cache.
  if (!VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.has(assetPath)) {
    useLoader.clear(GLTFLoader, assetPath)
  }
}

const releaseLoadedGltfResource = (assetPath: string, gltf: GLTF) => {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()

  gltf.scene.traverse((child: Object3D) => {
    if (!('isMesh' in child) || !child.isMesh) return
    const mesh = child as ThreeMesh
    geometries.add(mesh.geometry)
    const sourceMaterials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
    sourceMaterials.forEach((material) => materials.add(material))
  })

  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (
        value
        && typeof value === 'object'
        && 'isTexture' in value
        && value.isTexture
      ) {
        textures.add(value as Texture)
      }
    })
    material.dispose()
  })
  textures.forEach((texture) => texture.dispose())
  geometries.forEach((geometry) => geometry.dispose())
  useLoader.clear(GLTFLoader, assetPath)
  if ((Object.values(VEHICLE_ASSETS) as string[]).includes(assetPath)) {
    queueMicrotask(() => {
      const vehiclesRemain = VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES
        .snapshot()
        .some(({ key }) => (Object.values(VEHICLE_ASSETS) as string[]).includes(key))
      if (!vehiclesRemain) VIRTUAL_CHURCH_SHARED_VEHICLE_TEXTURE_LOADER.clear()
    })
  }
  if (
    profile3DEnabled
    && (
      assetPath.includes('/characters/')
      || assetPath.includes('/character-hero-')
    )
  ) {
    virtualChurchCharacterReleasedResources += 1
    virtualChurchCharacterLastReleasedAssetPath = assetPath
    queueMicrotask(updateVirtualChurchCharacterResourceDiagnostic)
  }
}

const VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES =
  createVirtualChurchResourceLeaseRegistry<GLTF>(releaseLoadedGltfResource)

const VIRTUAL_CHURCH_SHARED_VEHICLE_TEXTURE_LOADER =
  new VirtualChurchSharedImageBitmapLoader(DefaultLoadingManager)
DefaultLoadingManager.addHandler(
  /(?:^|\/)Textures\/colormap\.png(?:[?#].*)?$/i,
  VIRTUAL_CHURCH_SHARED_VEHICLE_TEXTURE_LOADER,
)

let virtualChurchCharacterActiveAssetPath: string | null = null
let virtualChurchCharacterReleasedResources = 0
let virtualChurchCharacterLastReleasedAssetPath: string | null = null
let virtualChurchCharacterDiagnosticScope: ReturnType<typeof beginVirtualChurchCharacterDiagnosticScope> | null = null

const updateVirtualChurchCharacterResourceDiagnostic = () => {
  if (!profile3DEnabled) return
  virtualChurchCharacterDiagnosticScope?.write((root) => {
    if (virtualChurchCharacterActiveAssetPath) {
      root.setAttribute(
        VIRTUAL_CHURCH_CHARACTER_ASSET_ATTRIBUTE,
        virtualChurchCharacterActiveAssetPath,
      )
    } else {
      root.removeAttribute(VIRTUAL_CHURCH_CHARACTER_ASSET_ATTRIBUTE)
    }
    root.setAttribute(
      VIRTUAL_CHURCH_CHARACTER_RESOURCE_ATTRIBUTE,
      JSON.stringify({
        activeAssetPath: virtualChurchCharacterActiveAssetPath,
        leases: VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.snapshot(),
        releasedResources: virtualChurchCharacterReleasedResources,
        lastReleasedAssetPath: virtualChurchCharacterLastReleasedAssetPath,
      }),
    )
  })
}

const createV3VisibleSkyTexture = (source: HTMLCanvasElement) => {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(source, 0, 0)

  const treatment = ALIFE_V3_SCENE_TREATMENT.scene.visibleSky
  const horizon = context.createLinearGradient(0, 150, 0, 300)
  horizon.addColorStop(0, 'rgba(255, 255, 255, 0)')
  horizon.addColorStop(0.55, treatment.horizonGlow)
  horizon.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = horizon
  context.fillRect(0, 150, canvas.width, 150)

  context.globalCompositeOperation = 'screen'
  const cloudBands: Array<[number, number, number, number, number, number]> = [
    [85, 150, 128, 18, -0.05, 0.75],
    [270, 196, 170, 22, 0.03, 0.62],
    [486, 132, 142, 15, -0.08, 0.58],
    [650, 188, 190, 24, 0.04, 0.68],
    [875, 142, 150, 17, -0.04, 0.66],
    [1000, 210, 118, 21, 0.02, 0.55],
  ]
  cloudBands.forEach(([x, y, radiusX, radiusY, rotation, opacity]) => {
    context.save()
    context.translate(x, y)
    context.rotate(rotation)
    context.scale(radiusX, radiusY)
    const cloud = context.createRadialGradient(0, 0, 0, 0, 0, 1)
    cloud.addColorStop(0, treatment.cloudCore.replace('0.17', String(0.17 * opacity)))
    cloud.addColorStop(0.48, treatment.cloudCore.replace('0.17', String(0.11 * opacity)))
    cloud.addColorStop(1, treatment.cloudEdge)
    context.fillStyle = cloud
    context.fillRect(-1, -1, 2, 2)
    context.restore()
  })
  context.globalCompositeOperation = 'source-over'

  const texture = new CanvasTexture(canvas)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = SRGBColorSpace
  return texture
}

const PbrEnvironmentMap = ({ visualVersion }: { visualVersion: VirtualChurchVisualVersion }) => {
  const { gl, scene } = useThree()

  useLayoutEffect(() => {
    if (profile3DEnabled) performance.mark('vc:environment:effect-start')
    const isV3 = visualVersion === 'v3'
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Sky gradient: deep blue zenith → warm horizon
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
    const skyStops: Array<[number, string]> = isV3
      ? [
          [0, '#4f7fad'],
          [0.18, '#6f9fc5'],
          [0.4, '#a9cce1'],
          [0.5, '#e7eee9'],
          [0.6, '#d5d6c4'],
          [0.78, '#9b8f78'],
          [1, '#665d52'],
        ]
      : [
          [0, '#0a1628'],
          [0.15, '#1a3558'],
          [0.35, '#4a7aa8'],
          [0.48, '#8cb8d8'],
          [0.52, '#f0c87a'],
          [0.56, '#d4885a'],
          [0.72, '#3d2010'],
          [0.88, '#1a0e06'],
          [1, '#0d0804'],
        ]
    skyStops.forEach(([offset, color]) => grad.addColorStop(offset, color))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Sun glow – positioned to match scene lighting direction
    const sunRadius = isV3 ? 92 : 140
    const sunGrad = ctx.createRadialGradient(720, 238, 0, 720, 238, sunRadius)
    sunGrad.addColorStop(0, 'rgba(255,255,240,1)')
    sunGrad.addColorStop(0.08, isV3 ? 'rgba(255,248,220,0.9)' : 'rgba(255,240,200,0.95)')
    sunGrad.addColorStop(0.25, isV3 ? 'rgba(255,232,170,0.42)' : 'rgba(255,200,120,0.6)')
    sunGrad.addColorStop(0.55, isV3 ? 'rgba(255,215,145,0.14)' : 'rgba(255,140,60,0.25)')
    sunGrad.addColorStop(1, isV3 ? 'rgba(255,210,130,0)' : 'rgba(255,100,30,0)')
    ctx.fillStyle = sunGrad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Procedural cloud layer – soft ellipses near the horizon band
    ctx.globalCompositeOperation = 'screen'
    const rand = (seed: number) => {
      let s = seed
      return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647 }
    }
    const rng = rand(42)
    for (let i = 0; i < 60; i++) {
      const cx = rng() * canvas.width
      const cy = 180 + rng() * 80 // cloud band near horizon
      const rx = 30 + rng() * 80
      const ry = 8 + rng() * 18
      const alpha = 0.04 + rng() * 0.1
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = isV3
        ? `rgba(255,255,250,${alpha * 0.82})`
        : `rgba(255,240,220,${alpha})`
      ctx.fill()
    }
    // Upper wispy clouds
    for (let i = 0; i < 25; i++) {
      const cx = rng() * canvas.width
      const cy = 60 + rng() * 100
      const rx = 40 + rng() * 100
      const ry = 4 + rng() * 10
      const alpha = 0.02 + rng() * 0.05
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, rng() * 0.3, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200,220,255,${alpha})`
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'

    const texture = new CanvasTexture(canvas)
    texture.mapping = EquirectangularReflectionMapping
    texture.colorSpace = SRGBColorSpace
    if (profile3DEnabled) performance.mark('vc:environment:canvas-end')

    const pmremGenerator = new PMREMGenerator(gl)
    pmremGenerator.compileEquirectangularShader()
    if (profile3DEnabled) performance.mark('vc:environment:compile-end')
    const environmentTarget = pmremGenerator.fromEquirectangular(texture)
    if (profile3DEnabled) performance.mark('vc:environment:pmrem-end')
    const envMap = environmentTarget.texture
    // Keep the established environment map byte-for-byte in the PBR path so
    // visible-sky polish cannot recolour the frozen church materials.
    const backgroundTexture = isV3
      ? createV3VisibleSkyTexture(canvas) ?? texture
      : texture

    const prevEnvironment = scene.environment
    const prevBackground = scene.background
    const prevBackgroundIntensity = scene.backgroundIntensity
    scene.environment = envMap
    scene.background = backgroundTexture
    scene.backgroundIntensity = isV3
      ? perfConfig.isMobile
        ? ALIFE_V3_SCENE_TREATMENT.scene.backgroundIntensity.mobile
        : ALIFE_V3_SCENE_TREATMENT.scene.backgroundIntensity.desktop
      : perfConfig.isMobile ? 0.82 : 0.92
    if (profile3DEnabled) performance.mark('vc:environment:effect-end')

    return () => {
      scene.environment = prevEnvironment
      scene.background = prevBackground
      scene.backgroundIntensity = prevBackgroundIntensity
      if (backgroundTexture !== texture) backgroundTexture.dispose()
      texture.dispose()
      // The PMREM output owns framebuffer/renderbuffer attachments as well as
      // its texture. Disposing only the texture leaves the target allocated.
      environmentTarget.dispose()
      pmremGenerator.dispose()
    }
  }, [gl, scene, visualVersion])

  return null
}

const groundHeightAt = (x: number, z: number, feetY: number) =>
  virtualChurchGroundHeightAt(
    x,
    z,
    feetY,
    provisionalTerrainHeightAt(x, z),
    config3D.visualVersion,
  )

const supportsWebGl = () => {
  if (profile3DFailureMode === 'webgl-unavailable') return false
  try {
    // Three.js r185 creates WebGL2 renderers only. Accepting a WebGL1 context
    // here lets the old probe pass and then makes Canvas throw. Do not create a
    // second probe context: the real Canvas owns context creation, and its
    // boundary reports selected-attribute or driver failures without a race.
    return typeof WebGL2RenderingContext !== 'undefined'
  } catch {
    return false
  }
}

const createV3AsphaltTexture = () => {
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces
  const canvas = document.createElement('canvas')
  canvas.width = treatment.asphaltTextureSize
  canvas.height = treatment.asphaltTextureSize
  const context = canvas.getContext('2d')
  if (!context) return null

  const image = context.createImageData(canvas.width, canvas.height)
  let seed = 7331
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const coarse = Math.sin(x * 0.19) * 5.2
        + Math.cos(y * 0.16) * 4.5
        + Math.sin((x + y) * 0.07) * 3.4
      const fine = (random() - 0.5) * 10
      const sparseAggregate = random() > 0.975 ? -12 : 0
      const value = Math.round(MathUtils.clamp(237 + coarse + fine + sparseAggregate, 210, 250))
      const offset = (y * canvas.width + x) * 4
      image.data[offset] = value - 2
      image.data[offset + 1] = value
      image.data[offset + 2] = value - 1
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(treatment.asphaltRepeat, treatment.asphaltRepeat)
  return texture
}

const createV3GrassTexture = () => {
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces
  const canvas = document.createElement('canvas')
  canvas.width = treatment.grassTextureSize
  canvas.height = treatment.grassTextureSize
  const context = canvas.getContext('2d')
  if (!context) return null

  const image = context.createImageData(canvas.width, canvas.height)
  let seed = 4283
  const random = () => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const broadVariation = Math.sin(x * 0.11) * 4
        + Math.cos(y * 0.13) * 3.5
        + Math.sin((x + y) * 0.055) * 2.5
      const fibre = random() > 0.983 ? -13 : 0
      const value = Math.round(MathUtils.clamp(239 + broadVariation + (random() - 0.5) * 8 + fibre, 216, 250))
      const offset = (y * canvas.width + x) * 4
      image.data[offset] = value - 2
      image.data[offset + 1] = value + 2
      image.data[offset + 2] = value - 3
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(treatment.grassRepeat, treatment.grassRepeat)
  return texture
}

const createV3ConcreteTexture = () => {
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces
  const canvas = document.createElement('canvas')
  canvas.width = treatment.concreteTextureSize
  canvas.height = treatment.concreteTextureSize
  const context = canvas.getContext('2d')
  if (!context) return null

  const image = context.createImageData(canvas.width, canvas.height)
  let seed = 1907
  const random = () => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const broadVariation = Math.sin(x * 0.13) * 2.8
        + Math.cos(y * 0.15) * 2.4
        + Math.sin((x - y) * 0.08) * 1.8
      const pores = random() > 0.986 ? -8 : 0
      const value = Math.round(MathUtils.clamp(242 + broadVariation + (random() - 0.5) * 4 + pores, 226, 249))
      const offset = (y * canvas.width + x) * 4
      image.data[offset] = value
      image.data[offset + 1] = value
      image.data[offset + 2] = value - 1
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(treatment.concreteRepeat, treatment.concreteRepeat)
  return texture
}

const createV3WaterNormalTexture = () => {
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces
  const canvas = document.createElement('canvas')
  canvas.width = treatment.waterNormalTextureSize
  canvas.height = treatment.waterNormalTextureSize
  const context = canvas.getContext('2d')
  if (!context) return null

  const image = context.createImageData(canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y += 1) {
    const v = y / canvas.height * Math.PI * 2
    for (let x = 0; x < canvas.width; x += 1) {
      const u = x / canvas.width * Math.PI * 2
      const normalX = Math.sin(u * 3 + Math.sin(v * 2) * 0.55) * 0.16
        + Math.sin((u + v) * 5) * 0.05
      const normalY = Math.cos(v * 4 + Math.sin(u * 2) * 0.45) * 0.13
        + Math.cos((u - v) * 3) * 0.05
      const normalZ = Math.sqrt(Math.max(0, 1 - normalX * normalX - normalY * normalY))
      const offset = (y * canvas.width + x) * 4
      image.data[offset] = Math.round((normalX * 0.5 + 0.5) * 255)
      image.data[offset + 1] = Math.round((normalY * 0.5 + 0.5) * 255)
      image.data[offset + 2] = Math.round((normalZ * 0.5 + 0.5) * 255)
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(treatment.waterNormalRepeat, treatment.waterNormalRepeat)
  return texture
}

const V3_WATER_NORMAL_SCALE = new Vector2(
  ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces.waterNormalStrength,
  ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces.waterNormalStrength,
)

const GroundPolygon = ({
  points,
  y = 0.01,
  color,
  roughness = 0.85,
  metalness = 0.15,
  envMapIntensity = ALIFE_PBR.envMapIntensity,
  surfaceMap,
  surfaceNormalMap,
}: {
  points: Array<[number, number]>
  y?: number
  color: string
  roughness?: number
  metalness?: number
  envMapIntensity?: number
  surfaceMap?: Texture | null
  surfaceNormalMap?: Texture | null
}) => {
  const geometry = useMemo(() => {
    const shape = new Shape()
    points.forEach(([x, z], index) => index === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z))
    shape.closePath()
    return new ShapeGeometry(shape)
  }, [points])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name="vc:surfaces" geometry={geometry} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><meshStandardMaterial color={color} map={surfaceMap ?? null} normalMap={surfaceNormalMap ?? null} normalScale={surfaceNormalMap ? V3_WATER_NORMAL_SCALE : undefined} roughness={roughness} metalness={metalness} envMapIntensity={envMapIntensity} /></mesh>
}

const GroundPolygonSet = ({
  polygons,
  tints,
  elevationOffsets,
  y = 0.01,
  color,
  roughness = 0.85,
  metalness = 0.15,
  envMapIntensity = ALIFE_PBR.envMapIntensity,
  surfaceMap,
  surfaceNormalMap,
}: {
  polygons: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
  tints?: ReadonlyArray<string | Color>
  elevationOffsets?: readonly number[]
  y?: number
  color: string
  roughness?: number
  metalness?: number
  envMapIntensity?: number
  surfaceMap?: Texture | null
  surfaceNormalMap?: Texture | null
}) => {
  const geometry = useMemo(() => createVirtualChurchGroundPolygonGeometry(polygons, tints, elevationOffsets), [polygons, tints, elevationOffsets])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return <mesh name="vc:surfaces" geometry={geometry} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><meshStandardMaterial vertexColors={Boolean(tints)} color={color} map={surfaceMap ?? null} normalMap={surfaceNormalMap ?? null} normalScale={surfaceNormalMap ? V3_WATER_NORMAL_SCALE : undefined} roughness={roughness} metalness={metalness} envMapIntensity={envMapIntensity} /></mesh>
}

const CAMERA_ENTRANCE_START = BUILDING_FOOTPRINT[4]
const CAMERA_ENTRANCE_END = BUILDING_FOOTPRINT[5]
const CAMERA_ENTRANCE_DX = CAMERA_ENTRANCE_END[0] - CAMERA_ENTRANCE_START[0]
const CAMERA_ENTRANCE_DZ = CAMERA_ENTRANCE_END[1] - CAMERA_ENTRANCE_START[1]
const CAMERA_ENTRANCE_LENGTH = Math.hypot(CAMERA_ENTRANCE_DX, CAMERA_ENTRANCE_DZ)
const CAMERA_ENTRANCE_ANGLE = -Math.atan2(CAMERA_ENTRANCE_DZ, CAMERA_ENTRANCE_DX)
const CAMERA_ENTRANCE_MID: [number, number] = [
  (CAMERA_ENTRANCE_START[0] + CAMERA_ENTRANCE_END[0]) / 2,
  (CAMERA_ENTRANCE_START[1] + CAMERA_ENTRANCE_END[1]) / 2,
]
const CAMERA_FACADE_RIGHT = CAMERA_ENTRANCE_LENGTH / 2
const CAMERA_FOYER_START = CAMERA_FACADE_RIGHT - 15
const CAMERA_CEDAR_END = CAMERA_FOYER_START + 4.2
const CAMERA_CEDAR_START = CAMERA_CEDAR_END - 18
const CAMERA_FACADE_LEFT = (() => {
  const dx = BUILDING_FOOTPRINT[0][0] - CAMERA_ENTRANCE_MID[0]
  const dz = BUILDING_FOOTPRINT[0][1] - CAMERA_ENTRANCE_MID[1]
  return Math.cos(CAMERA_ENTRANCE_ANGLE) * dx - Math.sin(CAMERA_ENTRANCE_ANGLE) * dz - 0.3
})()
const CAMERA_BOOM_SAMPLE_COUNT = 48
const CAMERA_BOOM_SLIDE_OFFSETS = [
  0,
  Math.PI / 12,
  -Math.PI / 12,
  Math.PI / 6,
  -Math.PI / 6,
  Math.PI / 4,
  -Math.PI / 4,
  Math.PI / 3,
  -Math.PI / 3,
  Math.PI / 2,
  -Math.PI / 2,
] as const

const pointInsideChurchCameraVolume = (x: number, z: number) => {
  if (virtualChurchPositionIsInsideWalkableFoyer(x, z, config3D.visualVersion)) return false
  if (pointInsidePolygon(BUILDING_FOOTPRINT, x, z) || pointInsidePolygon(AUXILIARY_BUILDING, x, z)) return true

  const dx = x - CAMERA_ENTRANCE_MID[0]
  const dz = z - CAMERA_ENTRANCE_MID[1]
  const localX = Math.cos(CAMERA_ENTRANCE_ANGLE) * dx - Math.sin(CAMERA_ENTRANCE_ANGLE) * dz
  const localZ = Math.sin(CAMERA_ENTRANCE_ANGLE) * dx + Math.cos(CAMERA_ENTRANCE_ANGLE) * dz
  const withinFacadeWidth = localX >= CAMERA_FACADE_LEFT && localX <= CAMERA_FACADE_RIGHT + 0.3
  if (!withinFacadeWidth || localZ > 0.55) return false

  const cedarProjectsHere = localX >= CAMERA_CEDAR_START - 0.2 && localX <= CAMERA_CEDAR_END + 0.2
  return localZ >= (cedarProjectsHere ? -2.98 : -0.9)
}

const churchCameraBoomSafeFraction = (
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  playerIsInside: boolean,
) => {
  let lastSafeT = 0
  const cameraStartsInV3Foyer = config3D.visualVersion === 'v3'
    && virtualChurchPositionIsInsideFoyerInterior(startX, startZ, 'v3')
  for (let step = 1; step <= CAMERA_BOOM_SAMPLE_COUNT; step += 1) {
    const t = step / CAMERA_BOOM_SAMPLE_COUNT
    const sampleX = MathUtils.lerp(startX, endX, t)
    const sampleZ = MathUtils.lerp(startZ, endZ, t)
    if (
      pointInsideChurchCameraVolume(sampleX, sampleZ) !== playerIsInside
      || (cameraStartsInV3Foyer && isBlocked(sampleX, sampleZ, 0, 'v3'))
    ) break
    lastSafeT = t
  }
  return lastSafeT
}

const constrainThirdPersonCamera = (
  desiredRenderPosition: Vector3,
  playerSourcePosition: Vector3,
  allowFacadeSlide: boolean,
) => {
  const startX = playerSourcePosition.x
  const startZ = playerSourcePosition.z
  const directEndX = desiredRenderPosition.x
  const directEndZ = -desiredRenderPosition.z
  const boomX = directEndX - startX
  const boomZ = directEndZ - startZ
  const playerIsInside = pointInsideChurchCameraVolume(startX, startZ)
  let bestEndX = directEndX
  let bestEndZ = directEndZ
  let bestSafeT = churchCameraBoomSafeFraction(
    startX,
    startZ,
    directEndX,
    directEndZ,
    playerIsInside,
  )

  // Keep the camera on the same side of the building envelope as the avatar.
  // If the direct boom meets a facade close to the avatar, first slide the
  // camera around that facade. Collapsing directly onto the avatar can put the
  // near plane into the wall and obscure the whole screen.
  // In the entrance/foyer keep the user's heading: searching side booms here
  // can swing the camera into the door jamb during the exterior/interior handoff.
  const cameraInFoyerRoute = config3D.visualVersion === 'v3'
    && virtualChurchPositionIsInsideWalkableFoyer(startX, startZ, 'v3')
  if (allowFacadeSlide && !cameraInFoyerRoute && bestSafeT < 1) {
    for (const offset of CAMERA_BOOM_SLIDE_OFFSETS.slice(1)) {
      const cosine = Math.cos(offset)
      const sine = Math.sin(offset)
      const candidateEndX = startX + boomX * cosine - boomZ * sine
      const candidateEndZ = startZ + boomX * sine + boomZ * cosine
      const candidateSafeT = churchCameraBoomSafeFraction(
        startX,
        startZ,
        candidateEndX,
        candidateEndZ,
        playerIsInside,
      )
      if (candidateSafeT > bestSafeT) {
        bestSafeT = candidateSafeT
        bestEndX = candidateEndX
        bestEndZ = candidateEndZ
      }
      if (bestSafeT === 1) break
    }
  }

  if (bestSafeT < 1) {
    const boomLength = Math.max(0.001, Math.hypot(bestEndX - startX, bestEndZ - startZ))
    const safeT = Math.max(0, bestSafeT - 0.12 / boomLength)
    desiredRenderPosition.x = MathUtils.lerp(startX, bestEndX, safeT)
    desiredRenderPosition.z = -MathUtils.lerp(startZ, bestEndZ, safeT)
    // A shortened boom must not leave the camera high above the avatar,
    // looking down into its head or the floor instead of through the door.
    if (cameraInFoyerRoute) {
      const eyeHeight = 1.4 + playerSourcePosition.y
      desiredRenderPosition.y = MathUtils.lerp(eyeHeight, desiredRenderPosition.y, safeT)
    }
  } else {
    desiredRenderPosition.x = bestEndX
    desiredRenderPosition.z = -bestEndZ
  }
  if (cameraInFoyerRoute) {
    const entranceDepth = (x: number, z: number) =>
      Math.sin(CAMERA_ENTRANCE_ANGLE) * (x - CAMERA_ENTRANCE_MID[0])
      + Math.cos(CAMERA_ENTRANCE_ANGLE) * (z - CAMERA_ENTRANCE_MID[1])
    const playerDepth = entranceDepth(startX, startZ)
    const cameraDepth = entranceDepth(desiredRenderPosition.x, -desiredRenderPosition.z)
    // The portal is only 2.35m high. Ground-plane wall tests cannot detect its
    // soffit: keep the camera (including its near plane) below it while either
    // the camera or its sightline crosses the recessed doorway.
    if (Math.min(playerDepth, cameraDepth) <= .45 && Math.max(playerDepth, cameraDepth) >= -3.1) {
      desiredRenderPosition.y = Math.min(desiredRenderPosition.y, CHURCH_DIMENSIONS.entranceDoorHeight - .25)
    }
  }
}

const TerrainSurface = ({
  visualVersion,
  surfaceMap,
}: {
  visualVersion: VirtualChurchVisualVersion
  surfaceMap?: Texture | null
}) => {
  const terrainLOD = useMemo(() => getTerrainLOD(perfConfig.isMobile), [])
  const geometry = useMemo(() => {
    const result = new BufferGeometry()
    const { positions, indices } = buildTerrainLODGrid(
      -72, 72, terrainLOD, 0, 0, -0.025, visualVersion === 'v3' ? 256 : undefined,
    )
    result.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const worldUvs: number[] = []
    for (let index = 0; index < positions.length; index += 3) {
      worldUvs.push(positions[index], positions[index + 2])
    }
    result.setAttribute('uv', new Float32BufferAttribute(worldUvs, 2))
    result.setIndex(indices)
    result.computeVertexNormals()
    return result
  }, [terrainLOD, visualVersion])
  useEffect(() => () => geometry.dispose(), [geometry])
  const v3Treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces
  return <mesh name="vc:surfaces" geometry={geometry} receiveShadow><meshStandardMaterial color={visualVersion === 'v3' ? v3Treatment.terrain : '#71886a'} map={surfaceMap ?? null} roughness={visualVersion === 'v3' ? v3Treatment.grassRoughness : 1} metalness={0} envMapIntensity={visualVersion === 'v3' ? v3Treatment.grassEnvMapIntensity : 1} /></mesh>
}

type BoxInstance = {
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
  color?: string
  mainHallDoor?: { bank: number; leaf: -1 | 1; hingeX: number; hingeZ: number }
}

const INITIAL_FOLLOW_CAMERA = virtualChurchInitialFollowCamera(
  PLAYER_START,
  PLAYER_START_YAW,
  INITIAL_FOLLOW_CAMERA_PITCH,
  THIRD_PERSON_CAMERA_DISTANCE,
  THIRD_PERSON_CAMERA_BASE_HEIGHT,
  THIRD_PERSON_CAMERA_PITCH_HEIGHT,
)
const INITIAL_FOLLOW_CAMERA_POSITION = new Vector3(...INITIAL_FOLLOW_CAMERA.position)
constrainThirdPersonCamera(
  INITIAL_FOLLOW_CAMERA_POSITION,
  new Vector3(...PLAYER_START),
  true,
)

const InstancedBoxSet = ({
  name,
  items,
  color,
  roughness = 1,
  metalness = 0,
  emissive,
  emissiveIntensity = 1,
  basic = false,
  opacity = 1,
  castShadow = false,
  receiveShadow = false,
  shape = 'box',
  instanceRef,
  material,
}: {
  name?: string
  items: BoxInstance[]
  color: string
  roughness?: number
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
  basic?: boolean
  opacity?: number
  castShadow?: boolean
  receiveShadow?: boolean
  shape?: 'box' | 'wheel-stop' | 'downlight'
  instanceRef?: MutableRefObject<InstancedMesh | null>
  material?: Material
}) => {
  const internalMeshRef = useRef<InstancedMesh>(null)
  const meshRef = instanceRef ?? internalMeshRef
  const transform = useMemo(() => new Object3D(), [])
  const instanceTint = useMemo(() => new Color(), [])
  const hasInstanceColors = items.some(item => item.color !== undefined)
  const alternateGeometry = useMemo(() => {
    if (shape === 'downlight') return new CylinderGeometry(.5, .5, 1, 12)
    if (shape !== 'wheel-stop') return null
    const geometry = new BoxGeometry(1, 1, 1)
    const positions = geometry.getAttribute('position')
    for (let index = 0; index < positions.count; index += 1) {
      if (positions.getY(index) <= 0) continue
      positions.setX(index, positions.getX(index) * 0.88)
      positions.setZ(index, positions.getZ(index) * 0.68)
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
  }, [shape])
  useEffect(() => () => alternateGeometry?.dispose(), [alternateGeometry])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    items.forEach((item, index) => {
      transform.position.set(...item.position)
      transform.rotation.set(...(item.rotation ?? [0, 0, 0]))
      transform.scale.set(...item.scale)
      transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix)
      if (hasInstanceColors) mesh.setColorAt(index, instanceTint.set(item.color ?? color))
      else if (mesh.instanceColor) mesh.setColorAt(index, instanceTint.set('#ffffff'))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [color, hasInstanceColors, instanceTint, items, transform])

  if (items.length === 0) return null

  return (
    <instancedMesh name={name} ref={meshRef} args={[undefined, undefined, items.length]} castShadow={castShadow} receiveShadow={receiveShadow}>
      {alternateGeometry
        ? <primitive object={alternateGeometry} attach="geometry" />
        : <boxGeometry args={[1, 1, 1]} />}
      {material
        ? <primitive object={material} attach="material" />
        : basic
        ? <meshBasicMaterial color={hasInstanceColors ? '#ffffff' : color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
        : <meshStandardMaterial color={hasInstanceColors ? '#ffffff' : color} roughness={roughness} metalness={metalness} emissive={emissive} emissiveIntensity={emissiveIntensity} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />}
    </instancedMesh>
  )
}

const ColoredParkingMarkingSet = ({ groups, symbols, roughness }: {
  groups: Array<{ items: BoxInstance[]; color: string }>
  symbols: { positions: Array<[number, number]>; angle: number; color: string }
  roughness: number
}) => {
  const geometry = useMemo(() => createVirtualChurchColoredParkingMarkings(groups, symbols), [groups, symbols])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return <mesh geometry={geometry} receiveShadow>
    <meshStandardMaterial color="#ffffff" vertexColors roughness={roughness} metalness={0} />
  </mesh>
}

type AccessibleParkingPairProps = {
  start: [number, number]
  bayWidth: number
  aisleWidth: number
  angle: number
  depth?: number
}

function accessibleParkingPairGeometry({ start, bayWidth, aisleWidth, angle, depth = 5 }: AccessibleParkingPairProps) {
  const ux = Math.cos(angle)
  const uz = Math.sin(angle)
  const vx = -uz
  const vz = ux
  const totalWidth = bayWidth * 2 + aisleWidth
  const stripeOffsets = [0, bayWidth, bayWidth + aisleWidth, totalWidth]
  const bayCentreOffsets = [bayWidth / 2, bayWidth + aisleWidth + bayWidth / 2]
  const positionAt = (along: number, across = 0): [number, number] => [
    start[0] + ux * along + vx * across,
    start[1] + uz * along + vz * across,
  ]
  const markings: BoxInstance[] = [
    ...stripeOffsets.map((offset) => {
      const [x, z] = positionAt(offset)
      return {
        position: [x, 0.052, z],
        rotation: [0, -angle, 0],
        scale: [0.09, 0.026, depth],
      } satisfies BoxInstance
    }),
    ...[-1.65, -0.82, 0, 0.82, 1.65].map((across) => {
      const [x, z] = positionAt(bayWidth + aisleWidth / 2, across)
      return {
        position: [x, 0.055, z],
        rotation: [0, -angle - 0.62, 0],
        scale: [aisleWidth * 0.72, 0.026, 0.09],
      } satisfies BoxInstance
    }),
  ]
  return { markings, symbolPositions: bayCentreOffsets.map((offset) => positionAt(offset, -0.72)) }
}

const ParkingRowsField = ({ rows, accessible }: { rows: typeof PARKING_ROWS; accessible: AccessibleParkingPairProps }) => {
  const markings: BoxInstance[] = rows.flatMap((row) =>
    Array.from({ length: row.bays + 1 }, (_, index) => ({
      position: [
        row.start[0] + Math.cos(row.angle) * row.bayWidth * index,
        0.045,
        row.start[1] + Math.sin(row.angle) * row.bayWidth * index,
      ],
      rotation: [0, -row.angle, 0],
      scale: [0.09, 0.025, row.bayDepth],
    } satisfies BoxInstance)),
  )

  const accessibleGeometry = accessibleParkingPairGeometry(accessible)
  return config3D.visualVersion === 'v3'
    ? <ColoredParkingMarkingSet
        groups={[
          { items: markings, color: ALIFE_V3_ENVIRONMENT_TREATMENT.parkingDetails.line },
          { items: accessibleGeometry.markings, color: ALIFE_V3_ENVIRONMENT_TREATMENT.parkingDetails.accessibleLine },
        ]}
        symbols={{ positions: accessibleGeometry.symbolPositions, angle: accessible.angle,
          color: ALIFE_V3_ENVIRONMENT_TREATMENT.parkingDetails.accessibleLine }}
        roughness={ALIFE_V3_ENVIRONMENT_TREATMENT.parkingDetails.lineRoughness}
      />
    : <InstancedBoxSet items={markings} color="#ece9d7" basic />
}

const AccessibleParkingSymbols = ({
  positions,
  angle,
}: {
  positions: Array<[number, number]>
  angle: number
}) => {
  const symbolsRef = useRef<InstancedMesh>(null)
  const geometry = useMemo(createVirtualChurchAccessibleSymbol, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const root = new Object3D()
    const inner = new Object3D()
    const rootInner = new Matrix4()
    positions.forEach(([x, z], index) => {
      root.position.set(x, 0.058, z)
      root.rotation.set(0, -angle, 0)
      root.scale.setScalar(0.62)
      root.updateMatrix()
      inner.position.set(0, 0, 0)
      inner.rotation.set(-Math.PI / 2, 0, 0)
      inner.scale.setScalar(1)
      inner.updateMatrix()
      rootInner.multiplyMatrices(root.matrix, inner.matrix)

      symbolsRef.current?.setMatrixAt(index, rootInner)
    })
    const mesh = symbolsRef.current
    if (mesh) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [angle, positions])

  const visualVersion = config3D.visualVersion
  const symbolColor = visualVersion === 'v3'
    ? ALIFE_V3_ENVIRONMENT_TREATMENT.parkingDetails.accessibleLine
    : '#e8c44e'
  const symbolMaterial = visualVersion === 'v3'
    ? <meshStandardMaterial color={symbolColor} roughness={ALIFE_V3_ENVIRONMENT_TREATMENT.parkingDetails.lineRoughness} metalness={0} />
    : <meshBasicMaterial color={symbolColor} />

  return (
    <instancedMesh ref={symbolsRef} args={[geometry, undefined, positions.length]}>
      {symbolMaterial}
    </instancedMesh>
  )
}

const AccessibleParkingPair = (props: AccessibleParkingPairProps) => {
  const { markings: accessibleMarkings, symbolPositions } = accessibleParkingPairGeometry(props)
  const { angle } = props
  return (
    <group>
      {config3D.visualVersion !== 'v3'
        ? <InstancedBoxSet items={accessibleMarkings} color="#e8c44e" basic />
        : null}
      <AccessibleParkingSymbols positions={symbolPositions} angle={angle} />
    </group>
  )
}

const VehicleFallback = ({ position, rotation = 0, color = '#4f86a6' }: {
  position: [number, number, number]
  rotation?: number
  color?: string
}) => {
  const { carLength, carWidth, carHeight } = SCENE_SCALE
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, carHeight * 0.34, 0]} castShadow receiveShadow>
        <boxGeometry args={[carWidth, carHeight * 0.48, carLength]} />
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.12} />
      </mesh>
      <mesh position={[0, carHeight * 0.7, -0.18]} castShadow>
        <boxGeometry args={[carWidth * 0.82, carHeight * 0.48, carLength * 0.52]} />
        <meshStandardMaterial color={color} roughness={0.52} metalness={0.14} />
      </mesh>
      {[-1, 1].flatMap((side) => [-1, 1].map((end) => (
        <mesh key={`${side}-${end}`} position={[side * carWidth * 0.49, 0.33, end * carLength * 0.31]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.31, 0.31, 0.18, 12]} />
          <meshStandardMaterial color="#20282b" roughness={0.9} />
        </mesh>
      )))}
      <mesh position={[0, carHeight * 0.72, carLength * 0.275]} rotation={[Math.PI * 0.08, 0, 0]}>
        <planeGeometry args={[carWidth * 0.68, carHeight * 0.32]} />
        <meshStandardMaterial color="#9ed1df" roughness={0.22} metalness={0.15} />
      </mesh>
      {[-0.55, 0.55].map((x) => <mesh key={x} position={[x, 0.52, carLength * 0.505]}><circleGeometry args={[0.13, 10]} /><meshStandardMaterial color="#fff1b5" emissive="#ffd970" emissiveIntensity={ALIFE_EMISSIVE.vehicleLight.emissiveIntensity} /></mesh>)}
    </group>
  )
}

type StaticSceneAssetProps = {
  path: string
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  castShadow?: boolean
}

type StaticAssetPlacement = Omit<StaticSceneAssetProps, 'path' | 'castShadow'>

const v3GroundDetailMaterial = (source: Material) => {
  const material = source.clone()
  if (!(material instanceof MeshStandardMaterial)) return material
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.groundDetails
  const materialName = source.name.toLowerCase()
  const isGrass = materialName.includes('grass')
  const isPurple = materialName.includes('purple')
  const isYellow = materialName.includes('yellow')
  const isWhite = materialName.includes('white')
  material.color.set(
    isGrass
      ? treatment.grass
      : isPurple
        ? treatment.flowerPurple
        : isYellow
          ? treatment.flowerYellow
          : isWhite
            ? treatment.flowerWhite
            : treatment.rock,
  )
  material.metalness = 0
  material.roughness = isPurple || isYellow || isWhite
    ? treatment.flowerRoughness
    : treatment.foliageRoughness
  material.envMapIntensity = treatment.envMapIntensity
  material.name = `${source.name || 'ground-detail'}-v3`
  return material
}

const LoadedInstancedStaticAssetField = ({
  path,
  placements,
  visualVersion,
}: {
  path: string
  placements: StaticAssetPlacement[]
  visualVersion: VirtualChurchVisualVersion
}) => {
  const gltf = useLoader(GLTFLoader, path) as GLTF
  useEffect(
    () => VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(path, gltf),
    [gltf, path],
  )
  const instanceRefs = useRef<Array<InstancedMesh | null>>([])
  const sourceMeshes = useMemo(() => {
    gltf.scene.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(gltf.scene)
    const groundAlignment = new Matrix4().makeTranslation(
      0,
      Number.isFinite(bounds.min.y) ? -bounds.min.y : 0,
      0,
    )
    const sources: Array<{
      geometry: BufferGeometry
      material: Material | Material[]
      matrix: Matrix4
    }> = []
    gltf.scene.traverse((child: Object3D) => {
      if (!('isMesh' in child) || !child.isMesh) return
      const mesh = child as Mesh
      const sourceMaterials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      sources.push({
        geometry: mesh.geometry,
        // Preserve the production V2 shortcut. V3 restores every source
        // material slot so flower petals and two-tone rocks are not flattened
        // into the first material assigned to the mesh.
        material: visualVersion === 'v3'
          ? Array.isArray(mesh.material)
            ? mesh.material.map(v3GroundDetailMaterial)
            : v3GroundDetailMaterial(mesh.material)
          : sourceMaterials[0],
        matrix: groundAlignment.clone().multiply(mesh.matrixWorld),
      })
    })
    if (visualVersion === 'v3' && perfConfig.isMobile
      && [NATURE_ASSETS.rockA, NATURE_ASSETS.rockC, NATURE_ASSETS.flatRock].includes(path)) {
      const rockSources = sources.every(source => source.material instanceof MeshStandardMaterial)
        ? sources as Array<{ geometry: BufferGeometry; material: MeshStandardMaterial; matrix: Matrix4 }>
        : []
      const merged = mergeVirtualChurchRockSources(rockSources)
      if (merged) {
        rockSources.forEach(source => source.material.dispose())
        return [{ ...merged, ownedGeometry: true }]
      }
    }
    return sources
  }, [gltf.scene, path, visualVersion])

  useEffect(() => () => {
    if (visualVersion !== 'v3') return
    const materials = new Set<Material>()
    sourceMeshes.forEach((source) => {
      if ('ownedGeometry' in source && source.ownedGeometry) source.geometry.dispose()
      const sourceMaterials = Array.isArray(source.material)
        ? source.material
        : [source.material]
      sourceMaterials.forEach((material) => materials.add(material))
    })
    materials.forEach((material) => material.dispose())
  }, [sourceMeshes, visualVersion])

  useLayoutEffect(() => {
    const position = new Vector3()
    const rotation = new Euler()
    const quaternion = new Quaternion()
    const scale = new Vector3()
    const root = new Matrix4()
    const final = new Matrix4()

    placements.forEach((placement, placementIndex) => {
      position.set(...placement.position)
      rotation.set(...(placement.rotation ?? [0, 0, 0]))
      quaternion.setFromEuler(rotation)
      if (typeof placement.scale === 'number' || placement.scale === undefined) {
        scale.setScalar(placement.scale ?? 1)
      } else {
        scale.set(...placement.scale)
      }
      root.compose(position, quaternion, scale)
      sourceMeshes.forEach((source, sourceIndex) => {
        instanceRefs.current[sourceIndex]?.setMatrixAt(
          placementIndex,
          final.multiplyMatrices(root, source.matrix),
        )
      })
    })
    instanceRefs.current.forEach((mesh) => {
      if (!mesh) return
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingBox()
      mesh.computeBoundingSphere()
    })
  }, [placements, sourceMeshes])

  return (
    <group name="vc:ground-details">
      {sourceMeshes.map((source, index) => (
        <instancedMesh
          key={`${path}-${index}`}
          ref={(mesh) => { instanceRefs.current[index] = mesh }}
          args={[source.geometry, source.material, placements.length]}
          dispose={null}
          receiveShadow
        />
      ))}
    </group>
  )
}

const InstancedStaticAssetField = ({
  path,
  placements,
  visualVersion,
}: {
  path: string
  placements: StaticAssetPlacement[]
  visualVersion: VirtualChurchVisualVersion
}) => (
  <Suspense fallback={null}>
    <LoadedInstancedStaticAssetField path={path} placements={placements} visualVersion={visualVersion} />
  </Suspense>
)

const V3_LOW_ROCK_PATHS = [NATURE_ASSETS.rockA, NATURE_ASSETS.rockC, NATURE_ASSETS.flatRock]

// The culvert uses only eight rocks. Baking those existing placements into one
// Low-only mesh keeps the two source tints and every silhouette, while avoiding
// a separate draw call for each of the three otherwise identical rock assets.
const LoadedBatchedCulvertRocks = ({ placementsByVariant }: {
  placementsByVariant: [StaticAssetPlacement[], StaticAssetPlacement[], StaticAssetPlacement[]]
}) => {
  // Match the single-path loader cache keys used by the other rock fields.
  // An array load creates separate GLTF objects for those URLs and would
  // conflict with the shared resource-lease registry while they are mounted.
  const rockA = useLoader(GLTFLoader, V3_LOW_ROCK_PATHS[0]) as GLTF
  const rockC = useLoader(GLTFLoader, V3_LOW_ROCK_PATHS[1]) as GLTF
  const flatRock = useLoader(GLTFLoader, V3_LOW_ROCK_PATHS[2]) as GLTF
  useEffect(() => {
    const releases = [rockA, rockC, flatRock].map((gltf, index) =>
      VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(V3_LOW_ROCK_PATHS[index], gltf))
    return () => releases.forEach(release => release())
  }, [rockA, rockC, flatRock])

  const batch = useMemo(() => {
    const sources: Array<{ geometry: BufferGeometry; material: MeshStandardMaterial; matrix: Matrix4 }> = []
    let compatible = true
    ;[rockA, rockC, flatRock].forEach((gltf, variantIndex) => {
      gltf.scene.updateMatrixWorld(true)
      const bounds = new Box3().setFromObject(gltf.scene)
      const groundAlignment = new Matrix4().makeTranslation(
        0,
        Number.isFinite(bounds.min.y) ? -bounds.min.y : 0,
        0,
      )
      placementsByVariant[variantIndex].forEach(placement => {
        const position = new Vector3(...placement.position)
        const rotation = new Quaternion().setFromEuler(new Euler(...(placement.rotation ?? [0, 0, 0])))
        const scale = typeof placement.scale === 'number' || placement.scale === undefined
          ? new Vector3().setScalar(placement.scale ?? 1)
          : new Vector3(...placement.scale)
        const placementMatrix = new Matrix4().compose(position, rotation, scale).multiply(groundAlignment)
        gltf.scene.traverse((child: Object3D) => {
          if (!('isMesh' in child) || !child.isMesh) return
          const mesh = child as Mesh
          if (Array.isArray(mesh.material)) {
            compatible = false
            return
          }
          const material = v3GroundDetailMaterial(mesh.material)
          if (!(material instanceof MeshStandardMaterial)) {
            compatible = false
            material.dispose()
            return
          }
          sources.push({
            geometry: mesh.geometry,
            material,
            matrix: placementMatrix.clone().multiply(mesh.matrixWorld),
          })
        })
      })
    })
    const merged = compatible ? mergeVirtualChurchRockSources(sources) : null
    sources.forEach(source => source.material.dispose())
    return merged
  }, [rockA, rockC, flatRock, placementsByVariant])

  useEffect(() => () => {
    batch?.geometry.dispose()
    batch?.material.dispose()
  }, [batch])

  if (!batch) return <>
    {V3_LOW_ROCK_PATHS.map((path, index) => (
      <InstancedStaticAssetField key={path} path={path} placements={placementsByVariant[index]} visualVersion="v3" />
    ))}
  </>
  return <group name="vc:ground-details">
    <mesh geometry={batch.geometry} material={batch.material} receiveShadow />
  </group>
}

const BatchedCulvertRocks = ({ placementsByVariant }: {
  placementsByVariant: [StaticAssetPlacement[], StaticAssetPlacement[], StaticAssetPlacement[]]
}) => <Suspense fallback={null}>
  <LoadedBatchedCulvertRocks placementsByVariant={placementsByVariant} />
</Suspense>

type VehicleMaterialRole = 'body' | 'wheel'

const applyV3VehiclePaletteShader = (
  material: MeshPhysicalMaterial,
  variant: VehicleVariant,
) => {
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.vehicles
  const [commonPaintBin, upperPaintBin] = treatment.atlasBins.paint[variant]
  const glassBin = treatment.atlasBins.glass
  const trimBin = treatment.atlasBins.trim
  const metalBin = treatment.atlasBins.metal
  const [frontLightBin, rearLightBin] = treatment.atlasBins.lights
  const binLiteral = (bin: readonly number[]) => `vec2(${bin[0]}.0, ${bin[1]}.0)`

  material.onBeforeCompile = (shader) => {
    shader.uniforms.alifeVehiclePaintColor = {
      value: new Color(treatment.bodyColor[variant]),
    }
    shader.uniforms.alifeVehicleGlassColor = {
      value: new Color(treatment.glassColor),
    }
    shader.uniforms.alifeVehicleTrimColor = {
      value: new Color(treatment.trimColor),
    }
    shader.uniforms.alifeVehicleMetalColor = {
      value: new Color(treatment.metalColor),
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
uniform vec3 alifeVehiclePaintColor;
uniform vec3 alifeVehicleGlassColor;
uniform vec3 alifeVehicleTrimColor;
uniform vec3 alifeVehicleMetalColor;
const vec2 alifeVehicleCommonPaintBin = ${binLiteral(commonPaintBin)};
const vec2 alifeVehicleUpperPaintBin = ${binLiteral(upperPaintBin)};
const vec2 alifeVehicleGlassBin = ${binLiteral(glassBin)};
const vec2 alifeVehicleTrimBin = ${binLiteral(trimBin)};
const vec2 alifeVehicleMetalBin = ${binLiteral(metalBin)};
const vec2 alifeVehicleFrontLightBin = ${binLiteral(frontLightBin)};
const vec2 alifeVehicleRearLightBin = ${binLiteral(rearLightBin)};
vec2 alifeVehicleAtlasBin( vec2 uv ) {
  return floor( clamp( uv, vec2( 0.0 ), vec2( 0.999999 ) ) * vec2( 8.0, 4.0 ) );
}`,
    )
    // Three.js emits map_fragment before roughnessmap_fragment,
    // metalnessmap_fragment and emissivemap_fragment within the same main()
    // scope, so the bin and category flags are classified once here and reused
    // by the later stages instead of recomputing the same pure expressions.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
#ifdef USE_MAP
  vec2 alifeVehicleBin = alifeVehicleAtlasBin( vMapUv );
  bool alifeVehicleIsPaint = all( equal( alifeVehicleBin, alifeVehicleCommonPaintBin ) )
    || all( equal( alifeVehicleBin, alifeVehicleUpperPaintBin ) );
  bool alifeVehicleIsGlass = all( equal( alifeVehicleBin, alifeVehicleGlassBin ) );
  bool alifeVehicleIsTrim = all( equal( alifeVehicleBin, alifeVehicleTrimBin ) );
  bool alifeVehicleIsMetal = all( equal( alifeVehicleBin, alifeVehicleMetalBin ) );
  bool alifeVehicleIsLight = all( equal( alifeVehicleBin, alifeVehicleFrontLightBin ) )
    || all( equal( alifeVehicleBin, alifeVehicleRearLightBin ) );
  if ( alifeVehicleIsPaint ) diffuseColor.rgb = alifeVehiclePaintColor;
  else if ( alifeVehicleIsGlass ) diffuseColor.rgb = alifeVehicleGlassColor;
  else if ( alifeVehicleIsTrim ) diffuseColor.rgb = alifeVehicleTrimColor;
  else if ( alifeVehicleIsMetal ) diffuseColor.rgb = alifeVehicleMetalColor;
#endif`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
#ifdef USE_MAP
  if ( alifeVehicleIsPaint ) roughnessFactor = 0.30;
  else if ( alifeVehicleIsGlass ) roughnessFactor = 0.30;
  else if ( alifeVehicleIsTrim ) roughnessFactor = 0.70;
  else if ( alifeVehicleIsMetal ) roughnessFactor = 0.38;
#endif`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>
#ifdef USE_MAP
  if ( alifeVehicleIsPaint ) metalnessFactor = 0.14;
  else if ( alifeVehicleIsGlass ) metalnessFactor = 0.02;
  else if ( alifeVehicleIsTrim ) metalnessFactor = 0.03;
  else if ( alifeVehicleIsMetal ) metalnessFactor = 0.58;
#endif`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
#ifdef USE_MAP
  if ( alifeVehicleIsLight ) totalEmissiveRadiance += diffuseColor.rgb * 0.20;
#endif`,
    )
  }
  material.customProgramCacheKey = () => `alife-v3-vehicle-palette-v2-${variant}`
}

const LoadedPbrVehicle = ({
  path,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  variant,
  visualVersion,
  fallbackColor,
}: StaticSceneAssetProps & {
  variant: VehicleVariant
  visualVersion: VirtualChurchVisualVersion
  fallbackColor: string
}) => {
  const gltf = useLoader(GLTFLoader, path) as GLTF
  useEffect(
    () => VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(path, gltf),
    [gltf, path],
  )
  const model = useMemo(() => {
    const isV3 = visualVersion === 'v3'
    const cloned = gltf.scene.clone(true)
    cloned.updateMatrixWorld(true)
    const geometries: Record<VehicleMaterialRole, BufferGeometry[]> = {
      body: [],
      wheel: [],
    }
    let sourceMaterial: Material | null = null

    const enhanceMaterial = (source: Material, role: VehicleMaterialRole) => {
      if (!(source instanceof MeshStandardMaterial)) return source.clone()
      const vehicleTreatment = ALIFE_V3_ENVIRONMENT_TREATMENT.vehicles
      const treatment = role === 'wheel' ? vehicleTreatment.wheel : vehicleTreatment.body
      const material = new MeshPhysicalMaterial({
        name: `${source.name || 'vehicle'}-${role}-pbr`,
        color: source.color,
        map: source.map,
        normalMap: source.normalMap,
        emissive: source.emissive,
        emissiveMap: source.emissiveMap,
        emissiveIntensity: source.emissiveIntensity,
        transparent: source.transparent,
        opacity: source.opacity,
        alphaTest: source.alphaTest,
        side: source.side,
        metalness: isV3 ? treatment.metalness : 0.18,
        roughness: isV3 ? treatment.roughness : 0.34,
        clearcoat: isV3 ? treatment.clearcoat : 0.42,
        clearcoatRoughness: isV3 ? treatment.clearcoatRoughness : 0.2,
        envMapIntensity: isV3 ? treatment.envMapIntensity : 0.85,
      })
      material.toneMapped = source.toneMapped
      if (isV3 && role === 'body') applyV3VehiclePaletteShader(material, variant)
      return material
    }

    cloned.traverse((child: Object3D) => {
      if (!('isMesh' in child) || !child.isMesh) return
      const mesh = child as Mesh
      sourceMaterial ??= Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      const geometry = mesh.geometry.clone()
      geometry.applyMatrix4(mesh.matrixWorld)
      const role = isV3 && /wheel/i.test(mesh.name) ? 'wheel' : 'body'
      geometries[role].push(geometry)
    })

    const mergedParts: Array<{
      geometry: BufferGeometry
      material: Material
    }> = []
    if (sourceMaterial) {
      ;(Object.entries(geometries) as Array<[VehicleMaterialRole, BufferGeometry[]]>)
        .forEach(([role, roleGeometries]) => {
          if (roleGeometries.length === 0) return
          const geometry = mergeGeometries(roleGeometries, false)
          if (geometry) {
            mergedParts.push({
              geometry,
              material: enhanceMaterial(sourceMaterial as Material, role),
            })
          }
        })
    }
    Object.values(geometries)
      .flat()
      .forEach((geometry) => geometry.dispose())

    if (mergedParts.length === 0 || !sourceMaterial) {
      cloned.traverse((child: Object3D) => {
        if (!('isMesh' in child) || !child.isMesh) return
        const mesh = child as Mesh
        const role = isV3 && /wheel/i.test(mesh.name) ? 'wheel' : 'body'
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((material) => enhanceMaterial(material, role))
          : enhanceMaterial(mesh.material, role)
        mesh.castShadow = true
        mesh.receiveShadow = true
      })
      return cloned
    }

    const mergedModel = new ThreeGroup()
    mergedModel.userData.mergedVehicle = true
    mergedParts.forEach(({ geometry, material }) => {
      const vehicleMesh = new ThreeMesh(geometry, material)
      vehicleMesh.castShadow = true
      vehicleMesh.receiveShadow = true
      mergedModel.add(vehicleMesh)
    })
    const bounds = new Box3().setFromObject(mergedModel)
    if (Number.isFinite(bounds.min.y)) mergedModel.position.y -= bounds.min.y
    return mergedModel
  }, [gltf.scene, variant, visualVersion])

  useEffect(() => () => {
    model.traverse((child: Object3D) => {
      if ('isMesh' in child && child.isMesh) {
        const mesh = child as Mesh
        const material = mesh.material
        for (const item of Array.isArray(material) ? material : [material]) item.dispose()
        if (model.userData.mergedVehicle) mesh.geometry.dispose()
      }
    })
  }, [model])

  const prepared = usePreparedReviewAsset(model, initialCharacterReview !== null && !perfConfig.postProcessing)
  const normalizedScale: [number, number, number] = typeof scale === 'number' ? [scale, scale, scale] : scale
  return <>
    {visualVersion !== 'v3' && !prepared && <VehicleFallback position={position} rotation={rotation[1]} color={fallbackColor} />}
    <primitive name="vc:vehicles" object={model} visible={prepared} position={position} rotation={rotation} scale={normalizedScale} />
  </>
}

const ParkedVehicle = ({ variant, position, rotation = 0, fallbackColor, visualVersion }: {
  variant: VehicleVariant
  position: [number, number, number]
  rotation?: number
  fallbackColor: string
  visualVersion: VirtualChurchVisualVersion
}) => <Suspense fallback={visualVersion === 'v3' ? null : <VehicleFallback position={position} rotation={rotation} color={fallbackColor} />}>
    <LoadedPbrVehicle
      path={VEHICLE_ASSETS[variant]}
      position={position}
      rotation={[0, rotation, 0]}
      scale={[1.18, 1.12, 1.68]}
      variant={variant}
      visualVersion={visualVersion}
      fallbackColor={fallbackColor}
    />
  </Suspense>

const TreeFallback = ({
  position,
  scale = 1,
  visualVersion = 'v2',
}: {
  position: [number, number, number]
  scale?: number
  visualVersion?: VirtualChurchVisualVersion
}) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.17, 0.26, 2.2, 16]} />
      <meshStandardMaterial
        color={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.trees.trunk : '#71543b'}
        roughness={0.95}
      />
    </mesh>
    {[[0, 2.75, 0], [-0.62, 2.55, 0.14], [0.58, 2.67, -0.2], [0.08, 3.35, 0.08]].map(([x, y, z], index) => (
      <mesh key={index} position={[x, y, z]} scale={index === 3 ? [0.72, 0.78, 0.72] : [1, 0.86, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.92, 18, 14]} />
        <meshStandardMaterial
          color={visualVersion === 'v3'
            ? index % 2 === 0
              ? ALIFE_V3_ENVIRONMENT_TREATMENT.trees.leaf.broadleaf
              : ALIFE_V3_ENVIRONMENT_TREATMENT.trees.accent
            : index % 2 === 0 ? '#4e765b' : '#5f8565'}
          roughness={0.88}
        />
      </mesh>
    ))}
  </group>
)

type TreePlacement = { position: [number, number, number]; scale: number }

const v3TreeMaterial = (source: Material, variant: TreeVariant) => {
  const material = source.clone()
  if (!(material instanceof MeshStandardMaterial)) return material
  const isLeaf = /leaf/i.test(material.name)
  const isTrunk = /wood|bark/i.test(material.name)
  material.color.set(
    isLeaf
      ? ALIFE_V3_ENVIRONMENT_TREATMENT.trees.leaf[variant]
      : isTrunk
        ? ALIFE_V3_ENVIRONMENT_TREATMENT.trees.trunk
        : ALIFE_V3_ENVIRONMENT_TREATMENT.trees.accent,
  )
  material.metalness = 0
  material.roughness = isLeaf
    ? ALIFE_V3_ENVIRONMENT_TREATMENT.trees.leafRoughness
    : ALIFE_V3_ENVIRONMENT_TREATMENT.trees.trunkRoughness
  material.envMapIntensity = ALIFE_V3_ENVIRONMENT_TREATMENT.trees.envMapIntensity
  material.name = `${source.name || 'tree'}-v3`
  return material
}

const LoadedInstancedTreeField = ({
  variant,
  placements,
  visualVersion,
}: {
  variant: TreeVariant
  placements: TreePlacement[]
  visualVersion: VirtualChurchVisualVersion
}) => {
  const gltf = useLoader(GLTFLoader, NATURE_ASSETS[variant]) as GLTF
  useEffect(
    () => VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(
      NATURE_ASSETS[variant],
      gltf,
    ),
    [gltf, variant],
  )
  const { camera, invalidate } = useThree()
  const highDetailRefs = useRef<Array<InstancedMesh | null>>([])
  const farTrunkRef = useRef<InstancedMesh>(null)
  const farCrownRef = useRef<InstancedMesh>(null)
  const sharedMobileFarTrunks = visualVersion === 'v3' && perfConfig.isMobile
  const baseScale = variant === 'oak' ? 5 : variant === 'pine' ? 5.15 : 5.3
  // The imported pine is already a small, two-material mesh. Its distant
  // surrogate makes a conspicuous flat triangle at the entrance Hero view.
  // Keep the actual silhouette at every V3 distance; V2 retains its LOD.
  const lodDistance = visualVersion === 'v3' && variant === 'pine'
    ? Infinity
    : perfConfig.lodDistances.tree + (variant === 'pine' ? 4 : 0)
  const sourceMeshes = useMemo(() => {
    gltf.scene.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(gltf.scene)
    const groundAlignment = new Matrix4().makeTranslation(0, Number.isFinite(bounds.min.y) ? -bounds.min.y : 0, 0)
    const sources: Array<{
      geometry: Mesh['geometry']
      material: Material | Material[]
      matrix: Matrix4
    }> = []
    gltf.scene.traverse((child: Object3D) => {
      if (!('isMesh' in child) || !child.isMesh) return
      const mesh = child as Mesh
      const sourceMaterials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      sources.push({
        geometry: mesh.geometry,
        material: visualVersion === 'v3'
          ? (Array.isArray(mesh.material)
              ? sourceMaterials.map((material) => v3TreeMaterial(material, variant))
              : v3TreeMaterial(mesh.material, variant))
          : mesh.material,
        matrix: groundAlignment.clone().multiply(mesh.matrixWorld),
      })
    })
    return sources
  }, [gltf.scene, variant, visualVersion])

  useEffect(() => () => {
    if (visualVersion !== 'v3') return
    const materials = new Set<Material>()
    sourceMeshes.forEach((source) => {
      const sourceMaterials = Array.isArray(source.material)
        ? source.material
        : [source.material]
      sourceMaterials.forEach((material) => materials.add(material))
    })
    materials.forEach((material) => material.dispose())
  }, [sourceMeshes, visualVersion])
  const scratch = useMemo(() => ({
    position: new Vector3(),
    scale: new Vector3(),
    rotation: new Euler(),
    quaternion: new Quaternion(),
    root: new Matrix4(),
    final: new Matrix4(),
    trunkLocal: new Matrix4().makeTranslation(0, 0.55, 0),
    crownLocal: new Matrix4().makeTranslation(0, 1.02, 0),
  }), [])
  const farCrownGeometry = useMemo(() => {
    if (visualVersion !== 'v3') return null
    const geometries: BufferGeometry[] = variant === 'pine'
      ? [
          new ConeGeometry(0.5, 0.64, 12).translate(0, -0.25, 0),
          new ConeGeometry(0.42, 0.62, 12).translate(0, 0.08, 0),
          new ConeGeometry(0.32, 0.56, 12).translate(0, 0.38, 0),
        ]
      : [
          new IcosahedronGeometry(0.4, 1)
            .scale(1.08, 0.86, 0.98)
            .translate(-0.2, -0.03, 0.03),
          new IcosahedronGeometry(0.42, 1)
            .scale(1, 0.92, 1.05)
            .translate(0.2, 0.02, -0.05),
          new IcosahedronGeometry(0.34, 1)
            .scale(0.95, 0.9, 0.92)
            .translate(0.01, 0.31, 0.08),
        ]
    const merged = mergeGeometries(geometries, false)
    geometries.forEach((geometry) => geometry.dispose())
    return merged
  }, [variant, visualVersion])

  useEffect(() => () => farCrownGeometry?.dispose(), [farCrownGeometry])

  const treeVisibility = useMemo(() => {
    // Envelope includes every source primitive and both simplified parts, so
    // camera-edge foliage survives wind and near/far representation changes.
    const bounds = new Box3(), part = new Box3(), vertex = new Vector3()
    const readBounds = (geometry: BufferGeometry) => {
      part.makeEmpty()
      const position = geometry.getAttribute('position')
      for (let index = 0; index < position.count; index++) part.expandByPoint(vertex.fromBufferAttribute(position, index))
      return part
    }
    sourceMeshes.forEach(source => {
      bounds.union(readBounds(source.geometry).applyMatrix4(source.matrix))
    })
    bounds.union(new Box3(new Vector3(-.1, 0, -.1), new Vector3(.1, 1.1, .1)))
    if (farCrownGeometry) {
      bounds.union(readBounds(farCrownGeometry).translate(new Vector3(0, 1.02, 0)))
    } else {
      // Legacy shapes are retained, although V2 never uses the culling path.
      bounds.union(new Box3(new Vector3(-.5, .445, -.5), new Vector3(.5, 1.595, .5)))
    }
    return createVirtualChurchTreeVisibility(bounds)
  }, [sourceMeshes, farCrownGeometry])

  useEffect(() => {
    invalidate()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') invalidate()
    }, RENDER_BUDGET.windUpdateIntervalMs)
    return () => window.clearInterval(timer)
  }, [invalidate])

  useFrame(({ clock }) => {
    const windTime = clock.elapsedTime
    const cullOffscreen = visualVersion === 'v3' && perfConfig.isMobile
    if (cullOffscreen) {
      camera.updateMatrixWorld()
      treeVisibility.update(camera.projectionMatrix, camera.matrixWorldInverse)
    }
    let nearCount = 0
    let farCount = 0
    placements.forEach((placement, index) => {
      const [x, y, z] = placement.position
      // Placements are geographic source coordinates; SiteScene mirrors Z.
      const near = camera.position.distanceToSquared(scratch.position.set(x, y, -z)) < lodDistance * lodDistance
      const sway = Math.sin(windTime * 0.75 + index * 1.73 + x * 0.08) * 0.014
      const yaw = ((x * 7 + z * 3) % 11) * 0.17
      scratch.rotation.set(sway * 0.55, yaw, sway)
      scratch.quaternion.setFromEuler(scratch.rotation)
      const instanceScale = baseScale * placement.scale
      scratch.scale.setScalar(instanceScale)
      scratch.root.compose(scratch.position.set(x, y, z), scratch.quaternion, scratch.scale)

      // Desktop near trees cast off-camera shadows into the visible scene;
      // never apply this mobile-only optimisation to that rendering path.
      if (cullOffscreen && !treeVisibility.isVisible(scratch.root)) return

      if (near) {
        sourceMeshes.forEach((source, sourceIndex) => {
          highDetailRefs.current[sourceIndex]?.setMatrixAt(nearCount, scratch.final.multiplyMatrices(scratch.root, source.matrix))
        })
        nearCount += 1
      } else {
        farTrunkRef.current?.setMatrixAt(farCount, scratch.final.multiplyMatrices(scratch.root, scratch.trunkLocal))
        farCrownRef.current?.setMatrixAt(farCount, scratch.final.multiplyMatrices(scratch.root, scratch.crownLocal))
        farCount += 1
      }
    })
    // Pack only active instances. Tiny hidden matrices still submit geometry,
    // and empty LOD batches must not draw or cast placeholder shadows.
    const updateBatch = (mesh: InstancedMesh | null, count: number) => {
      if (!mesh) return
      mesh.count = count
      mesh.visible = count > 0
      mesh.instanceMatrix.needsUpdate = true
    }
    highDetailRefs.current.forEach(mesh => updateBatch(mesh, nearCount))
    updateBatch(farTrunkRef.current, farCount)
    updateBatch(farCrownRef.current, farCount)
  })

  return (
    <group name="vc:trees">
      {sourceMeshes.map((source, index) => (
        <instancedMesh key={`${variant}-high-${index}`} ref={(mesh) => { highDetailRefs.current[index] = mesh }} args={[source.geometry, source.material, placements.length]} castShadow={!perfConfig.isMobile} dispose={null} receiveShadow frustumCulled={false} />
      ))}
      {!sharedMobileFarTrunks && <instancedMesh ref={farTrunkRef} args={[undefined, undefined, placements.length]} receiveShadow frustumCulled={false}>
        <cylinderGeometry args={[0.06, 0.1, 1.1, 6]} />
        <meshStandardMaterial
          color={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.trees.trunk : '#74563c'}
          roughness={0.96}
          metalness={0}
        />
      </instancedMesh>}
      <instancedMesh ref={farCrownRef} args={[undefined, undefined, placements.length]} receiveShadow frustumCulled={false}>
        {farCrownGeometry
          ? <primitive object={farCrownGeometry} attach="geometry" />
          : variant === 'pine'
            ? <coneGeometry args={[0.48, 1.15, 7]} />
            : <sphereGeometry args={[0.5, 7, 5]} />}
        <meshStandardMaterial
          color={visualVersion === 'v3'
            ? ALIFE_V3_ENVIRONMENT_TREATMENT.trees.leaf[variant]
            : variant === 'pine' ? '#3f6650' : variant === 'oak' ? '#54745a' : '#4b795c'}
          roughness={visualVersion === 'v3'
            ? ALIFE_V3_ENVIRONMENT_TREATMENT.trees.leafRoughness
            : 0.92}
          metalness={0}
          envMapIntensity={visualVersion === 'v3'
            ? ALIFE_V3_ENVIRONMENT_TREATMENT.trees.envMapIntensity
            : 1}
        />
      </instancedMesh>
    </group>
  )
}

/** All three mobile far-LOD trunks have identical geometry and material. Keep
 * crowns species-specific, but submit their trunks as one instance batch. */
const MobileMergedFarTreeTrunks = ({ placementsByVariant }: {
  placementsByVariant: Record<TreeVariant, TreePlacement[]>
}) => {
  const { camera } = useThree()
  const meshRef = useRef<InstancedMesh>(null)
  const entries = (Object.keys(placementsByVariant) as TreeVariant[]).filter((variant) => variant !== 'pine').flatMap((variant) =>
    placementsByVariant[variant].map((placement, index) => ({
      placement,
      index,
      baseScale: variant === 'oak' ? 5 : 5.3,
      lodDistance: perfConfig.lodDistances.tree,
    })))
  const scratch = useMemo(() => ({
    position: new Vector3(), scale: new Vector3(), rotation: new Euler(),
    quaternion: new Quaternion(), root: new Matrix4(), final: new Matrix4(),
    trunkLocal: new Matrix4().makeTranslation(0, 0.55, 0),
  }), [])
  const visibility = useMemo(() => createVirtualChurchTreeVisibility(
    new Box3(new Vector3(-0.1, 0, -0.1), new Vector3(0.1, 1.1, 0.1)),
  ), [])
  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return
    camera.updateMatrixWorld()
    visibility.update(camera.projectionMatrix, camera.matrixWorldInverse)
    let count = 0
    entries.forEach(({ placement, index, baseScale, lodDistance }) => {
      const [x, y, z] = placement.position
      if (camera.position.distanceToSquared(scratch.position.set(x, y, -z)) < lodDistance * lodDistance) return
      const sway = Math.sin(clock.elapsedTime * 0.75 + index * 1.73 + x * 0.08) * 0.014
      const yaw = ((x * 7 + z * 3) % 11) * 0.17
      scratch.rotation.set(sway * 0.55, yaw, sway)
      scratch.quaternion.setFromEuler(scratch.rotation)
      scratch.scale.setScalar(baseScale * placement.scale)
      scratch.root.compose(scratch.position.set(x, y, z), scratch.quaternion, scratch.scale)
      if (!visibility.isVisible(scratch.root)) return
      mesh.setMatrixAt(count++, scratch.final.multiplyMatrices(scratch.root, scratch.trunkLocal))
    })
    mesh.count = count
    mesh.visible = count > 0
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh name="vc:trees" ref={meshRef} args={[undefined, undefined, entries.length]} receiveShadow frustumCulled={false}>
    <cylinderGeometry args={[0.06, 0.1, 1.1, 6]} />
    <meshStandardMaterial color={ALIFE_V3_ENVIRONMENT_TREATMENT.trees.trunk} roughness={0.96} metalness={0} />
  </instancedMesh>
}

const InstancedTreeField = ({
  variant,
  placements,
  visualVersion,
}: {
  variant: TreeVariant
  placements: TreePlacement[]
  visualVersion: VirtualChurchVisualVersion
}) => (
  <Suspense fallback={<>{placements.map(({ position, scale }) => <TreeFallback key={position.join('-')} position={position} scale={scale * 1.65} visualVersion={visualVersion} />)}</>}>
    <LoadedInstancedTreeField variant={variant} placements={placements} visualVersion={visualVersion} />
  </Suspense>
)

const Shrub = ({ position, color = '#52785a', scale = 1 }: { position: [number, number, number]; color?: string; scale?: number }) => {
  const sideRef = useRef<InstancedMesh>(null)
  const centreRef = useRef<InstancedMesh>(null)
  const sideMaterial = useMemo(
    () => color === '#52785a' ? SHRUB_SIDE_MATERIAL : new MeshStandardMaterial({ color, roughness: 0.9 }),
    [color],
  )

  useLayoutEffect(() => {
    const dummy = new Object3D()
    ;[-0.35, 0.35].forEach((x, index) => {
      dummy.position.set(x, 0.38 + index * 0.1, 0.08)
      dummy.scale.set(1, 0.82, 1)
      dummy.updateMatrix()
      sideRef.current?.setMatrixAt(index, dummy.matrix)
    })
    dummy.position.set(0, 0.43, -0.18)
    dummy.scale.set(1, 0.82, 1)
    dummy.updateMatrix()
    centreRef.current?.setMatrixAt(0, dummy.matrix)
    if (sideRef.current) sideRef.current.instanceMatrix.needsUpdate = true
    if (centreRef.current) centreRef.current.instanceMatrix.needsUpdate = true
  }, [])

  useEffect(() => () => {
    if (sideMaterial !== SHRUB_SIDE_MATERIAL) sideMaterial.dispose()
  }, [sideMaterial])

  return (
    <group position={position} scale={scale}>
      <instancedMesh ref={sideRef} args={[SHRUB_CROWN_GEOMETRY, sideMaterial, 2]} receiveShadow />
      <instancedMesh ref={centreRef} args={[SHRUB_CROWN_GEOMETRY, SHRUB_CENTRE_MATERIAL, 1]} receiveShadow />
    </group>
  )
}

const v3BushMaterial = (source: Material) => {
  const material = source.clone()
  if (!(material instanceof MeshStandardMaterial)) return material
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.bushes
  material.metalness = 0
  material.roughness = treatment.roughness
  material.envMapIntensity = treatment.envMapIntensity
  material.onBeforeCompile = (shader) => {
    shader.uniforms.alifeBushDarkLeaf = { value: new Color(treatment.darkLeaf) }
    shader.uniforms.alifeBushLightLeaf = { value: new Color(treatment.lightLeaf) }
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
uniform vec3 alifeBushDarkLeaf;
uniform vec3 alifeBushLightLeaf;`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
#ifdef USE_MAP
  float alifeBushTone = smoothstep(
    0.08,
    0.72,
    dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))
  );
  diffuseColor.rgb = mix(alifeBushDarkLeaf, alifeBushLightLeaf, alifeBushTone);
#endif`,
    )
  }
  material.customProgramCacheKey = () => 'alife-v3-bush-palette-v1'
  material.name = `${source.name || 'bush'}-v3`
  return material
}

const DetailedBush = ({
  position,
  scale = 1,
  visualVersion,
}: {
  position: [number, number, number]
  scale?: number
  visualVersion: VirtualChurchVisualVersion
}) => {
  const assetPath = '/virtual-church-assets/nature/Bush_Large.gltf'
  const gltf = useLoader(GLTFLoader, assetPath) as GLTF
  useEffect(
    () => VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(assetPath, gltf),
    [assetPath, gltf],
  )
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true)
    clone.updateMatrixWorld(true)
    if (visualVersion === 'v3') {
      clone.traverse((child: Object3D) => {
        if (!('isMesh' in child) || !child.isMesh) return
        const mesh = child as Mesh
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(v3BushMaterial)
          : v3BushMaterial(mesh.material)
      })
    }
    const bounds = new Box3().setFromObject(clone)
    if (Number.isFinite(bounds.min.y)) clone.position.y -= bounds.min.y
    return clone
  }, [gltf.scene, visualVersion])
  useEffect(() => () => {
    if (visualVersion !== 'v3') return
    const materials = new Set<Material>()
    model.traverse((child: Object3D) => {
      if (!('isMesh' in child) || !child.isMesh) return
      const mesh = child as Mesh
      const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      meshMaterials.forEach((material) => materials.add(material))
    })
    materials.forEach((material) => material.dispose())
  }, [model, visualVersion])
  useEffect(() => {
    model.traverse((child: Object3D) => {
      if ('isMesh' in child && child.isMesh) {
        const mesh = child as Object3D & { castShadow: boolean; receiveShadow: boolean }
        mesh.castShadow = false
        mesh.receiveShadow = true
      }
    })
  }, [model])
  return <primitive name="vc:plants" object={model} position={position} scale={[scale, scale, scale]} />
}

const StreetLightField = ({
  placements,
  visualVersion,
}: {
  placements: Array<[number, number, number]>
  visualVersion: VirtualChurchVisualVersion
}) => {
  const v3Treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.lightingDetails
  const fixturesRef = useRef<InstancedMesh>(null)
  const fixtureGeometry = useMemo(() => {
    const pole = new CylinderGeometry(0.07, 0.11, 6.8, 8)
    pole.translate(0, 3.4, 0)
    const arm = new CylinderGeometry(0.055, 0.07, 0.9, 8)
    arm.rotateZ(Math.PI / 2)
    arm.translate(0.45, 6.8, 0)
    const merged = mergeGeometries([pole, arm], false)
    pole.dispose()
    arm.dispose()
    if (!merged) throw new Error('Unable to merge street-light fixture')
    return merged
  }, [])
  const lampBoxes: BoxInstance[] = placements.map(([x, y, z]) => ({
    position: [x + 0.9, y + 6.75, z],
    scale: [0.62, 0.13, 0.28],
  }))

  useLayoutEffect(() => {
    const transform = new Object3D()
    placements.forEach(([x, y, z], index) => {
      transform.position.set(x, y, z)
      transform.rotation.set(0, 0, 0)
      transform.scale.setScalar(1)
      transform.updateMatrix()
      fixturesRef.current?.setMatrixAt(index, transform.matrix)
    })
    if (fixturesRef.current) fixturesRef.current.instanceMatrix.needsUpdate = true
  }, [placements])

  useEffect(() => () => fixtureGeometry.dispose(), [fixtureGeometry])

  return (
    <group name="vc:lights">
      <instancedMesh ref={fixturesRef} args={[fixtureGeometry, undefined, placements.length]}>
        <meshStandardMaterial
          color={visualVersion === 'v3' ? v3Treatment.streetFixture : '#252b2a'}
          roughness={visualVersion === 'v3' ? v3Treatment.streetFixtureRoughness : 0.48}
          metalness={visualVersion === 'v3' ? v3Treatment.streetFixtureMetalness : 0.65}
        />
      </instancedMesh>
      <InstancedBoxSet
        items={lampBoxes}
        color={visualVersion === 'v3' ? v3Treatment.streetLamp : '#d9ddd8'}
        roughness={0.4}
        emissive={visualVersion === 'v3' ? v3Treatment.streetLampEmissive : '#fff0bd'}
        emissiveIntensity={visualVersion === 'v3'
          ? v3Treatment.streetLampEmissiveIntensity
          : ALIFE_EMISSIVE.streetLight.emissiveIntensity}
      />
    </group>
  )
}

const UplightField = ({
  placements,
  visualVersion,
}: {
  placements: Array<[number, number]>
  visualVersion: VirtualChurchVisualVersion
}) => {
  const basesRef = useRef<InstancedMesh>(null)
  const v3Treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.lightingDetails

  useLayoutEffect(() => {
    const transform = new Object3D()
    placements.forEach(([x, z], index) => {
      transform.position.set(x, 0.18, z)
      transform.updateMatrix()
      basesRef.current?.setMatrixAt(index, transform.matrix)
    })
    if (basesRef.current) basesRef.current.instanceMatrix.needsUpdate = true
  }, [placements])

  return (
    <group name="vc:lights">
      <instancedMesh ref={basesRef} args={[undefined, undefined, placements.length]}>
        <cylinderGeometry args={[0.13, 0.18, 0.36, 10]} />
        <meshStandardMaterial color={visualVersion === 'v3' ? v3Treatment.uplightFixture : '#303736'} metalness={0.45} />
      </instancedMesh>
      {placements.map(([x, z]) => (
        <pointLight
          key={`${x}-${z}`}
          position={[x, 0.5, z]}
          intensity={visualVersion === 'v3' ? v3Treatment.uplightIntensity : ALIFE_LIGHTING.accentLights.intensity}
          distance={visualVersion === 'v3' ? v3Treatment.uplightDistance : 6}
          color={visualVersion === 'v3' ? v3Treatment.uplightColor : ALIFE_LIGHTING.accentLights.color}
        />
      ))}
    </group>
  )
}

const FacadeSegment = ({ start, end, height, y, color, depth = 0.28, metalness = 0.2, offset = [0, 0] }: {
  start: [number, number]
  end: [number, number]
  height: number
  y: number
  color: string
  depth?: number
  metalness?: number
  offset?: [number, number]
}) => {
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  return (
    <mesh position={[(start[0] + end[0]) / 2 + offset[0], y, (start[1] + end[1]) / 2 + offset[1]]} rotation={[0, -Math.atan2(dz, dx), 0]} castShadow receiveShadow>
      <boxGeometry args={[Math.hypot(dx, dz), height, depth]} />
      <meshStandardMaterial color={color} roughness={0.52} metalness={metalness} />
    </mesh>
  )
}

const CorrugatedFacade = ({ start, end, height, y, spacing = 0.42, offset = [0, 0] }: {
  start: [number, number]
  end: [number, number]
  height: number
  y: number
  spacing?: number
  offset?: [number, number]
}) => {
  const meshRef = useRef<InstancedMesh>(null)
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const count = Math.max(2, Math.floor(Math.hypot(dx, dz) / spacing))
  const rotation = useMemo(() => new Quaternion().setFromEuler(new Euler(0, -Math.atan2(dz, dx), 0)), [dx, dz])

  const corrugatedNormalMap = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.createImageData(256, 256)
    for (let py = 0; py < 256; py++) {
      const normalY = Math.sin(py * 0.5) * 0.5 + 0.5
      for (let px = 0; px < 256; px++) {
        const idx = (py * 256 + px) * 4
        imageData.data[idx] = 128     // R
        imageData.data[idx + 1] = Math.floor(normalY * 255) // G
        imageData.data[idx + 2] = 255 // B (pointing out)
        imageData.data[idx + 3] = 255 // A
      }
    }
    ctx.putImageData(imageData, 0, 0)
    const texture = new CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(1, 16)
    return texture
  }, [])

  useEffect(() => {
    const matrix = new Matrix4()
    const position = new Vector3()
    const scale = new Vector3(1, 1, 1)
    for (let index = 0; index < count; index += 1) {
      const t = (index + 0.5) / count
      position.set(start[0] + dx * t + offset[0], y, start[1] + dz * t + offset[1])
      matrix.compose(position, rotation, scale)
      meshRef.current?.setMatrixAt(index, matrix)
    }
    if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true
  }, [count, dx, dz, offset, rotation, start, y])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
      {/* Thin ribs sit fully in front of the backing wall. The former 460 mm
          boxes intersected the shell and produced visible depth flicker. */}
      <boxGeometry args={[0.055, height, 0.06]} />
      <meshStandardMaterial color="#d8dcdb" roughness={0.58} metalness={0.60} normalMap={corrugatedNormalMap} normalScale={new Vector2(0.4, 0.4)} />
    </instancedMesh>
  )
}

const ChurchFacadeSign = ({ position, rotation, visualVersion }: { position: [number, number, number]; rotation: number; visualVersion: VirtualChurchVisualVersion }) => {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#292d2d'
      context.textAlign = 'left'
      context.textBaseline = 'middle'
      context.font = '600 42px Arial, sans-serif'
      context.fillText('CHINESE', 34, 48)
      context.fillText('ABUNDANT LIFE CHURCH', 34, 101)
      // The V3 wordmark sits on a pale wall: the old ivory Chinese line
      // disappears in the sign-view camera even though the English is clear.
      context.fillStyle = visualVersion === 'v3' ? '#292d2d' : '#f1f0ea'
      context.font = '600 58px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
      context.fillText('基督城华人丰盛生命教会', 34, 184)
      context.fillStyle = visualVersion === 'v3' ? '#755226' : '#d5a94d'
      context.font = '700 23px Arial, sans-serif'
      context.fillText('182 THE RUNWAY · WIGRAM', 34, 232)
    }
    const result = new CanvasTexture(canvas)
    result.colorSpace = SRGBColorSpace
    result.anisotropy = 8
    return result
  }, [visualVersion])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    // The geographic scene root mirrors source Z. Counter-mirror this
    // screen-readable plane once so the wordmark is not seen backwards.
    <mesh name="vc:church-wordmark" position={position} rotation={[0, rotation, 0]} scale={[-1, 1, 1]} renderOrder={10}>
      <planeGeometry args={[8.2, 2.05]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} side={DoubleSide} polygonOffset polygonOffsetFactor={-4} />
    </mesh>
  )
}

const WindowBand = ({ start, end, y = 1.45, count = 7, offset = [0, 0], color = '#30474a' }: { start: [number, number]; end: [number, number]; y?: number; count?: number; offset?: [number, number]; color?: string }) => {
  const windowsRef = useRef<InstancedMesh>(null)
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const angle = -Math.atan2(dz, dx)
  const bayWidth = Math.min(1.15, Math.hypot(dx, dz) / (count + 1))
  useLayoutEffect(() => {
    const mesh = windowsRef.current
    if (!mesh) return
    const transform = new Object3D()
    transform.rotation.set(0, angle, 0)
    for (let index = 0; index < count; index++) {
      const t = (index + 1) / (count + 1)
      transform.position.set(start[0] + dx * t + offset[0], y, start[1] + dz * t + offset[1])
      transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    // Recompute on prop changes as well as mount: stale instance bounds can
    // otherwise hide relocated windows after a geometry or layout update.
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
  }, [angle, bayWidth, count, dx, dz, offset, start, y])
  return (
    <instancedMesh ref={windowsRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[bayWidth, 1.95, 0.36]} />
      <meshPhysicalMaterial color={color} roughness={0.2} metalness={0.28} clearcoat={0.25} />
    </instancedMesh>
  )
}

/**
 * Calculate the auditorium roof height along its real long axis. The signed
 * fin facade is the high end and the cedar entrance is the low end; using only
 * world X previously reversed the photographed slope and over-heightened the
 * wall beside the entrance.
 */
function roofHeightAtVertex(vertex: [number, number]): number {
  const lowEnd: [number, number] = [
    (BUILDING_FOOTPRINT[4][0] + BUILDING_FOOTPRINT[5][0]) / 2,
    (BUILDING_FOOTPRINT[4][1] + BUILDING_FOOTPRINT[5][1]) / 2,
  ]
  const highEnd: [number, number] = [
    (BUILDING_FOOTPRINT[15][0] + BUILDING_FOOTPRINT[0][0]) / 2,
    (BUILDING_FOOTPRINT[15][1] + BUILDING_FOOTPRINT[0][1]) / 2,
  ]
  const axisX = highEnd[0] - lowEnd[0]
  const axisZ = highEnd[1] - lowEnd[1]
  const axisLengthSquared = axisX * axisX + axisZ * axisZ
  const projection = ((vertex[0] - lowEnd[0]) * axisX + (vertex[1] - lowEnd[1]) * axisZ) / axisLengthSquared
  const t = MathUtils.clamp(projection, 0, 1)
  return CHURCH_DIMENSIONS.roofLowHeight + t * (CHURCH_DIMENSIONS.roofPeakHeight - CHURCH_DIMENSIONS.roofLowHeight)
}

const FootprintVolume = ({ points, height, color }: { points: Array<[number, number]>; height: number; color: string }) => {
  const geometry = useMemo(() => {
    const shape = new Shape()
    points.forEach(([x, z], index) => index === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z))
    shape.closePath()
    return new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
  }, [height, points])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.58} metalness={0.28} />
    </mesh>
  )
}

const SlopedRoofBuilding = ({ points, omitParkingWalls = false }: { points: Array<[number, number]>; omitParkingWalls?: boolean }) => {
  const geometry = useMemo(() => {
    const n = points.length
    const heights = points.map(p => roofHeightAtVertex(p))
    const positions: number[] = []
    const normals: number[] = []

    // Footprint points already use world X/Z. Negating Z here used to mirror
    // the solid shell away from its facades, producing detached single walls.
    for (let i = 0; i < n; i++) {
      // OSM describes this elevation as five stepped edges, while the photos
      // show one continuous layered facade. All five parking-facing shell
      // walls are replaced below; retaining any of them lets a tall grey slab
      // cut in front of the calibrated cladding and causes depth flicker.
      if (omitParkingWalls && i <= 4) continue
      const j = (i + 1) % n
      const [x0, z0] = points[i]
      const [x1, z1] = points[j]
      const h0 = heights[i]
      const h1 = heights[j]

      const dx = x1 - x0
      const dz = z1 - z0
      const len = Math.hypot(dx, dz)
      const nx = dz / len
      const nz = -dx / len

      positions.push(x0, 0, z0, x1, h1, z1, x1, 0, z1)
      normals.push(nx, 0, nz, nx, 0, nz, nx, 0, nz)
      positions.push(x0, 0, z0, x0, h0, z0, x1, h1, z1)
      normals.push(nx, 0, nz, nx, 0, nz, nx, 0, nz)
    }

    // The OSM outline is concave. Proper polygon triangulation preserves its
    // notches instead of spanning them with a centroid fan.
    const roofFaces = ShapeUtils.triangulateShape(points.map(([x, z]) => new Vector2(x, z)), [])
    roofFaces.forEach(([a, b, c]) => {
      const indices = [a, b, c]
      const pa = points[a]
      const pb = points[b]
      const pc = points[c]
      const crossY = (pb[1] - pa[1]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[1] - pa[1])
      if (crossY < 0) indices.reverse()
      indices.forEach((index) => positions.push(points[index][0], heights[index], points[index][1]))
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0)
      indices.slice().reverse().forEach((index) => positions.push(points[index][0], 0, points[index][1]))
      normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0)
    })

    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    return geo
  }, [omitParkingWalls, points])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#b8bdbe" roughness={0.58} metalness={0.28} side={DoubleSide} transparent={false} opacity={1} />
    </mesh>
  )
}

const SlopedFacadeVolume = ({
  x0,
  x1,
  bottomY,
  topY0,
  topY1,
  z,
  depth,
  color,
}: {
  x0: number
  x1: number
  bottomY: number
  topY0: number
  topY1: number
  z: number
  depth: number
  color: string
}) => {
  const geometry = useMemo(() => {
    const frontZ = z - depth / 2
    const backZ = z + depth / 2
    const vertices = new Float32Array([
      x0, bottomY, frontZ,
      x1, bottomY, frontZ,
      x1, topY1, frontZ,
      x0, topY0, frontZ,
      x0, bottomY, backZ,
      x1, bottomY, backZ,
      x1, topY1, backZ,
      x0, topY0, backZ,
    ])
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    result.setIndex([
      0, 1, 2, 0, 2, 3,
      5, 4, 7, 5, 7, 6,
      4, 0, 3, 4, 3, 7,
      1, 5, 6, 1, 6, 2,
      3, 2, 6, 3, 6, 7,
      4, 5, 1, 4, 1, 0,
    ])
    result.computeVertexNormals()
    return result
  }, [bottomY, depth, topY0, topY1, x0, x1, z])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.62} metalness={0.26} side={DoubleSide} transparent={false} opacity={1} />
    </mesh>
  )
}

type ChurchHeroAssetProps = {
  visualVersion: VirtualChurchVisualVersion
  foyerPrepared: boolean
  position: [number, number, number]
  rotationY: number
  onReady: (ready: boolean) => void
}

const sharedTextureKey = (texture: Texture) => [
  texture.source?.uuid ?? texture.uuid,
  texture.mapping,
  texture.channel,
  texture.wrapS,
  texture.wrapT,
  texture.magFilter,
  texture.minFilter,
  texture.anisotropy,
  texture.format,
  texture.type,
  texture.colorSpace,
  texture.flipY,
  texture.offset.x,
  texture.offset.y,
  texture.repeat.x,
  texture.repeat.y,
  texture.rotation,
  texture.center.x,
  texture.center.y,
].join('|')

const reuseMaterialTextures = (
  material: Material,
  textureRegistry: Map<string, Texture>,
) => {
  const mutableMaterial = material as Material & Record<string, unknown>
  Object.entries(mutableMaterial).forEach(([property, value]) => {
    if (
      !value
      || typeof value !== 'object'
      || !('isTexture' in value)
      || value.isTexture !== true
    ) return

    const texture = value as Texture
    const key = sharedTextureKey(texture)
    const sharedTexture = textureRegistry.get(key)
    if (sharedTexture) {
      mutableMaterial[property] = sharedTexture
    } else {
      textureRegistry.set(key, texture)
    }
  })
}

const useVirtualChurchRenderedAssetSignal = (model: Object3D, attribute: string, canRender = true) => {
  const { gl, invalidate } = useThree()
  const mountedFrameRef = useRef(Number.NaN)
  const pendingRef = useRef(true)

  useLayoutEffect(() => {
    mountedFrameRef.current = gl.info.render.frame
    pendingRef.current = canRender
    document.documentElement.removeAttribute(attribute)
    const cancelSubmission = canRender ? reviewStartupSubmissions.get(gl)?.request(gl.info.render.frame) : undefined
    invalidate()
    return () => {
      cancelSubmission?.()
      pendingRef.current = false
      document.documentElement.removeAttribute(attribute)
    }
  }, [attribute, canRender, gl, invalidate, model])

  useFrame(() => {
    if (!pendingRef.current || gl.getContext().isContextLost()) return
    if (virtualChurchAssetHasRendered(
      mountedFrameRef.current,
      gl.info.render.frame,
      document.visibilityState === 'visible',
    )) {
      pendingRef.current = false
      markVirtualChurchRenderedAssetReady(attribute, window.performance.now())
    } else {
      // Demand rendering still needs a second callback to observe the first
      // completed scene submission. Hidden avatars must not deadlock first-
      // person/showcase views: readiness is for the active camera's scene.
      invalidate()
    }
  })
}

const LoadedChurchHeroAsset = ({ position, rotationY, onReady, visualVersion, foyerPrepared }: ChurchHeroAssetProps) => {
  const asset = useLoader(GLTFLoader, CHURCH_HERO_ASSET_PATH, (loader) => {
    loader.setDRACOLoader(VIRTUAL_CHURCH_DRACO_LOADER)
    if (visualVersion === 'v3') loader.register(installVirtualChurchGltfIntegrity)
  }) as GLTF
  // GLTFLoader treats individual texture failures as nullable dependencies and
  // still resolves the model. Never mark a textureless white church as ready.
  assertVirtualChurchGltfTextures(asset)
  useEffect(
    () => VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(
      CHURCH_HERO_ASSET_PATH,
      asset,
    ),
    [asset],
  )

  const { model, ownedMaterials, slidingParts, foyerFloor, foyerCeiling, foyerPassage } = useMemo(() => {
    if (profile3DEnabled) performance.mark('vc:church:prepare-start')
    const result = asset.scene.clone(true)
    const slidingParts: NonNullable<ReturnType<typeof prepareChurchSlidingGeometry>>[] = []
    const textureRegistry = new Map<string, Texture>()
    const materialRegistry = new Map<Material, Material>()
    result.name = perfConfig.isMobile ? 'ChurchHero_Low' : 'ChurchHero_High'
    result.traverse((child) => {
      if (!('isMesh' in child)) return
      const mesh = child as Mesh
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (!Array.isArray(mesh.material)) {
        const sliding = prepareChurchSlidingGeometry(mesh.geometry, mesh.material.name)
        if (sliding) { mesh.geometry = sliding.geometry; slidingParts.push(sliding) }
      }
      sourceMaterials.forEach((material) => reuseMaterialTextures(material, textureRegistry))
      const preparedMaterials = sourceMaterials.map((material) => {
        let prepared = materialRegistry.get(material)
        if (!prepared) {
          prepared = virtualChurchMaterialForBudget(material, perfConfig.glassTransmission)
          materialRegistry.set(material, prepared)
        }
        return prepared
      })
      mesh.material = Array.isArray(mesh.material) ? preparedMaterials : preparedMaterials[0]
      mesh.castShadow = !perfConfig.isMobile
      mesh.receiveShadow = true
    })

    const foyerPassage = visualVersion === 'v3' ? prepareVirtualChurchFoyerPassage(result) : null
    const foyerFloor = visualVersion === 'v3' ? prepareVirtualChurchFoyerFloor(result) : null
    const foyerCeiling = visualVersion === 'v3' ? prepareVirtualChurchFoyerCeiling(result) : null
    if (profile3DEnabled) performance.mark('vc:church:prepare-end')
    return {
      model: result,
      slidingParts,
      foyerFloor,
      foyerCeiling,
      foyerPassage,
      ownedMaterials: [...materialRegistry].filter(([source, prepared]) => source !== prepared).map(([, prepared]) => prepared),
    }
  }, [asset, visualVersion])

  useEffect(() => () => ownedMaterials.forEach((material) => material.dispose()), [ownedMaterials])
  useEffect(() => () => foyerFloor?.dispose(), [foyerFloor])
  useEffect(() => () => foyerCeiling?.dispose(), [foyerCeiling])
  useEffect(() => () => foyerPassage?.dispose(), [foyerPassage])
  useEffect(() => () => slidingParts.forEach(part => part.geometry.dispose()), [slidingParts])
  useAutomaticDoor('entrance', CHURCH_AUTOMATIC_DOOR.source, 5, progress => slidingParts.forEach(part => part.update(progress)))

  // Models arriving after the initial scene need their own linked/introspected
  // material variants before reveal. Reuse the cancellable renderer queue.
  const prepareChurchShaders = visualVersion === 'v3' || (initialCharacterReview !== null && !perfConfig.postProcessing)
  const prepared = usePreparedReviewAsset(model, prepareChurchShaders, true)
  useVirtualChurchRenderedAssetSignal(model, VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE, prepared && (visualVersion !== 'v3' || foyerPrepared))

  useEffect(() => {
    onReady(prepared)
  }, [onReady, prepared])

  return <primitive object={model} visible={prepared} position={position} rotation={[0, rotationY, 0]} />
}

const ChurchHeroAsset = (props: ChurchHeroAssetProps) =>
  <LoadedChurchHeroAsset {...props} />

class ChurchHeroAssetBoundary extends Component<
  { assetPath: string; children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn('Church hero GLB failed to load; retaining the procedural entrance.', error, info)
    if (error instanceof VirtualChurchGltfTextureIntegrityError) {
      releaseLoadedGltfResource(this.props.assetPath, error.gltf)
    } else {
      clearFailedGltfAsset(this.props.assetPath)
    }
    document.documentElement.setAttribute(VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE, 'true')
    document.documentElement.setAttribute(
      VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE,
      window.performance.now().toFixed(1),
    )
    this.props.onFailure()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

// Geometry follows the real OSM footprint. Canterbury aerial imagery and the
// Structex project photos and the supplied road-entry view establish the signed
// north-west fin facade and the long south-west parking elevation. The public
// cedar-and-glass entrance is at that elevation's far south-east end. The nearby
// low white building is detached.
const FoyerFlagLayer = () => {
  const resources = useMemo(() => ({
    geometry: createVirtualChurchFoyerFlagGeometry(),
    material: createVirtualChurchFoyerFlagMaterial(),
    cordGeometry: createVirtualChurchFoyerFlagCordGeometry(),
    cordMaterial: createVirtualChurchFoyerFlagCordMaterial(),
  }), [])
  useEffect(() => () => {
    resources.geometry.dispose()
    resources.material.map?.dispose()
    resources.material.dispose()
    resources.cordGeometry.dispose()
    resources.cordMaterial.dispose()
  }, [resources])
  return <group name="vc:foyer-event-flags">
    <lineSegments geometry={resources.cordGeometry} material={resources.cordMaterial} dispose={null} />
    <mesh geometry={resources.geometry} material={resources.material} dispose={null} />
  </group>
}

// Keep the entrance volume open like photos 03–10. The earlier narrow white
// tunnel was rejected: only the unmeasured extension gets new side frontages.
const foyerRoute = VIRTUAL_CHURCH_FOYER_CIRCULATION
const foyerPartitionWalls: BoxInstance[] = [
  // The photographed left doors sit against the already authored shallow
  // foyer wall. Only its continuation and the cafe-side frontage are new.
  { position: [foyerRoute.aisleLeftX, 2.93, (foyerRoute.partitionStartZ + foyerRoute.leftBranchOpeningStartZ) / 2], scale: [.16, 5.86, foyerRoute.leftBranchOpeningStartZ - foyerRoute.partitionStartZ] },
  ...[
    [foyerRoute.partitionStartZ, foyerRoute.rightDoorBanks[0][0]],
    [foyerRoute.rightDoorBanks[0][1], foyerRoute.partitionEndZ],
  ].map(([start, end]): BoxInstance => ({ position: [foyerRoute.aisleRightX, 2.93, (start + end) / 2], scale: [.16, 5.86, end - start] })),
  ...foyerRoute.rightDoorBanks.map(([start, end]): BoxInstance => ({ position: [foyerRoute.aisleRightX, 4.22, (start + end) / 2], scale: [.16, 3.28, end - start] })),
]
// Door count and positions remain a circulation sketch. Physically cutting
// those four closed openings keeps them from reading as stickers on a wall.
// The near-right placeholder door conflicted with the photographed stair.
const branchRoomDoorCenters = [...foyerRoute.leftBranchRoomDoors, ...foyerRoute.rightBranchRoomDoors]
const branchRoomDoorZ = (x: number) => x > foyerRoute.aisleRightX
  ? foyerRoute.rightBranchRoomDoorZ
  : foyerRoute.oppositeDoorZ
const leftBranchWindow = foyerRoute.leftBranchCourtyardWindow
const farGlazingHalfWidth = foyerRoute.farGlazingHalfWidth
const branchDoorHalfWidth = .58
const branchEndZ = 13.425
const leftBranchEndDoorZ = (foyerRoute.leftBranchOpeningStartZ + branchEndZ) / 2
const leftBranchEndDoorHalfWidth = .58
const foyerBranchBackWall: BoxInstance[] = ([
  [foyerRoute.branchLeftX, foyerRoute.axisX - farGlazingHalfWidth],
] as [number, number][]).flatMap(([start, end]) => {
  const doors = foyerRoute.leftBranchRoomDoors.filter(x => x > start && x < end)
  const parts: BoxInstance[] = []
  let cursor = start
  for (const x of doors) {
    const edge = x - branchDoorHalfWidth
    if (edge > cursor) parts.push({ position: [(cursor + edge) / 2, 2.93, 13.42], scale: [edge - cursor, 5.86, .2] })
    parts.push({ position: [x, 4.1, 13.42], scale: [branchDoorHalfWidth * 2, 3.52, .2] })
    cursor = x + branchDoorHalfWidth
  }
  if (start < leftBranchWindow.centerX && leftBranchWindow.centerX < end) {
    const edge = leftBranchWindow.centerX - leftBranchWindow.width / 2
    const farEdge = leftBranchWindow.centerX + leftBranchWindow.width / 2
    if (edge > cursor) parts.push({ position: [(cursor + edge) / 2, 2.93, 13.42], scale: [edge - cursor, 5.86, .2] })
    // Leave a real floor-to-ceiling-looking opening without cutting the
    // adjacent room doors or the structure above the corridor ceiling.
    parts.push({ position: [leftBranchWindow.centerX, leftBranchWindow.sillY / 2, 13.42], scale: [leftBranchWindow.width, leftBranchWindow.sillY, .2] })
    parts.push({ position: [leftBranchWindow.centerX, (leftBranchWindow.headY + 5.86) / 2, 13.42], scale: [leftBranchWindow.width, 5.86 - leftBranchWindow.headY, .2] })
    cursor = farEdge
  }
  if (end > cursor) parts.push({ position: [(cursor + end) / 2, 2.93, 13.42], scale: [end - cursor, 5.86, .2] })
  return parts
})
// Photos 04/07: the black stair sits against a light upper wall, while its
// under-stair cheek is dark. Keep the backing split from the side corridor.
const foyerStairBackWallStartX = VIRTUAL_CHURCH_FOYER_STAIR.minX - .1
const foyerStairBackWallEndX = VIRTUAL_CHURCH_FOYER_STAIR.maxX + .1
const foyerStairBackWall: BoxInstance[] = [
  { position: [(foyerStairBackWallStartX + foyerStairBackWallEndX) / 2, 2.93, 13.42],
    scale: [foyerStairBackWallEndX - foyerStairBackWallStartX, 5.86, .2] },
]
// Photo 07: a charcoal structural pier separates the glass stair from the
// cafe-side right doors. Keep it against the existing back wall so the
// circulation and the estimated corridor footprint do not change.
const foyerStairEndPier: BoxInstance[] = [{
  position: [VIRTUAL_CHURCH_FOYER_STAIR_END_PIER.centerX, 2.93, VIRTUAL_CHURCH_FOYER_STAIR_END_PIER.centerZ],
  scale: [VIRTUAL_CHURCH_FOYER_STAIR_END_PIER.halfWidth * 2, 5.86, VIRTUAL_CHURCH_FOYER_STAIR_END_PIER.halfDepth * 2],
}]
const foyerFarRightBackWall: BoxInstance[] = [
  { position: [(foyerStairBackWallEndX + foyerRoute.branchRightX) / 2, 2.93, 13.42],
    scale: [foyerRoute.branchRightX - foyerStairBackWallEndX, 5.86, .2] },
]
const foyerContinuationWalls: BoxInstance[] = [
  // Photo 01 ends at a closed room door, not a blank wall. Cut only the
  // left branch end wall; the right corridor's end wall stays unmeasured.
  ...([
    [foyerRoute.leftBranchOpeningStartZ, leftBranchEndDoorZ - leftBranchEndDoorHalfWidth],
    [leftBranchEndDoorZ + leftBranchEndDoorHalfWidth, branchEndZ],
  ] as [number, number][]).map(([start, end]): BoxInstance => ({
    position: [foyerRoute.branchLeftX - .12, 2.93, (start + end) / 2],
    scale: [.24, 5.86, end - start],
  })),
  { position: [foyerRoute.branchLeftX - .12, 4.10, leftBranchEndDoorZ], scale: [.24, 3.52, leftBranchEndDoorHalfWidth * 2] },
  { position: [foyerRoute.branchRightX + .12, 2.93, (foyerRoute.branchOpeningStartZ + branchEndZ) / 2], scale: [.24, 5.86, branchEndZ - foyerRoute.branchOpeningStartZ] },
  // A shallow closed-room frontage makes the right branch a lateral corridor
  // rather than an invented square room. Its depth is still a V3 estimate.
  ...([foyerRoute.aisleRightX, ...foyerRoute.rightBranchRoomDoors.flatMap(x => [x - branchDoorHalfWidth, x + branchDoorHalfWidth]), foyerRoute.branchRightX]
    .reduce<BoxInstance[]>((parts, edge, index, edges) => {
      if (index % 2 === 1 && edge > edges[index - 1]) parts.push({
        position: [(edges[index - 1] + edge) / 2, 2.93, foyerRoute.rightBranchRoomDoorZ],
        scale: [edge - edges[index - 1], 5.86, .2],
      })
      if (index > 0 && index % 2 === 0) parts.push({
        position: [(edges[index - 1] + edge) / 2, 4.1, foyerRoute.rightBranchRoomDoorZ],
        scale: [edge - edges[index - 1], 3.52, .2],
      })
      return parts
    }, [])),
  { position: [foyerRoute.aisleRightX, 2.93, (foyerRoute.rightBranchRoomDoorZ + branchEndZ) / 2],
    scale: [.16, 5.86, branchEndZ - foyerRoute.rightBranchRoomDoorZ] },
  // Close only the outer side-corridor edges, not the broad central foyer.
  // This prevents a view into the unmodelled blue exterior while preserving
  // the photographed sightline to the opposite glazed exit.
  ...([
    [foyerRoute.branchLeftX, foyerRoute.aisleLeftX, foyerRoute.leftBranchOpeningStartZ],
    [foyerRoute.aisleRightX, foyerRoute.branchRightX, foyerRoute.branchOpeningStartZ],
  ] as [number, number, number][]).map(([start, end, openingZ]): BoxInstance => ({
    position: [(start + end) / 2, 1.4, openingZ],
    scale: [end - start, 2.8, .16],
  })),
  // Keep the far foyer open on both sides. The earlier full-height front
  // partitions hid the visible glazing and left a free-standing wall edge in
  // the corridor view; their exact placement is not photo-established.
  ...foyerBranchBackWall,
  ...foyerFarRightBackWall,
]
// Photos 03/04/07: the cross sits on a warm-grey end wall above the glazed
// exit. Photo 04's darker exposure should not turn the wall charcoal.
// Keep these existing volumes separate from the pale side corridors.
const foyerFarCrossWall: BoxInstance[] = [
  { position: [foyerRoute.axisX, 3.395, 13.42], scale: [farGlazingHalfWidth * 2, 1.89, .2] },
  { position: [foyerRoute.axisX, 5.1, 13.42], scale: [farGlazingHalfWidth * 2, 1.52, .2] },
]
const foyerContinuationCeiling: BoxInstance[] = [
  // The daylit exit and staircase share the photographed tall foyer; only
  // the outer room corridors sit beneath a normal-height ceiling. Extend the
  // high liner over the right frontage so the old sloped roof cannot show
  // through the seam above it; the lower corridor ceiling is unchanged.
  { position: [(VIRTUAL_CHURCH_WALKABLE_FOYER.interior.minX + foyerRoute.branchRightX) / 2, 5.99, 9.8875], scale: [foyerRoute.branchRightX - VIRTUAL_CHURCH_WALKABLE_FOYER.interior.minX + .35, .12, 7.075] },
  // Photos 01–02 show ordinary-height side corridors, not an extension of
  // the double-height foyer. The exact measurement remains an estimate.
  ...([[
    foyerRoute.branchLeftX, foyerRoute.aisleLeftX, foyerRoute.leftBranchOpeningStartZ,
  ], [
    foyerRoute.aisleRightX + .18, foyerRoute.branchRightX, foyerRoute.branchOpeningStartZ,
  ]] as [number, number, number][]).map(([start, end, openingZ]): BoxInstance => ({
    position: [(start + end) / 2, 2.86, (openingZ + 13.425) / 2],
    scale: [end - start, .12, 13.425 - openingZ],
  })),
]
const foyerBranchSkirting: BoxInstance[] = ([
  [foyerRoute.branchLeftX, foyerRoute.axisX - farGlazingHalfWidth],
  [foyerRoute.axisX + farGlazingHalfWidth, foyerRoute.branchRightX],
] as [number, number][]).map(([start, end]): BoxInstance => ({
  position: [(start + end) / 2, .075, 13.285], scale: [end - start, .15, .055], color: '#f1eee8',
})).concat(([
  [foyerRoute.branchLeftX, foyerRoute.aisleLeftX, foyerRoute.leftBranchOpeningStartZ],
  [foyerRoute.aisleRightX, foyerRoute.branchRightX, foyerRoute.branchOpeningStartZ],
] as [number, number, number][]).map(([start, end, openingZ]): BoxInstance => ({
  position: [(start + end) / 2, .075, openingZ + .11],
  scale: [end - start, .15, .055], color: '#f1eee8',
})))
// Recessed spots belong under the ordinary-height side-corridor ceiling.
// The earlier ten-spot row crossed the double-height foyer at 2.8 m, where
// half its fixtures appeared to float below the photographed pendant lights.
const foyerBranchCeilingLights: BoxInstance[] = [
  ...[0.7, 2.3, 3.9, 5.5, 7.1].map(offset => ({
    position: [foyerRoute.branchLeftX + offset, 2.785, foyerRoute.leftBranchDepthZ] as [number, number, number],
    scale: [.14, .015, .14] as [number, number, number],
  })),
  ...[1.1, 2.45, 3.8].map(x => ({
    position: [x, 2.785, (foyerRoute.branchOpeningStartZ + foyerRoute.rightBranchRoomDoorZ) / 2] as [number, number, number],
    scale: [.14, .015, .14] as [number, number, number],
  })),
]
// Closed, unlabelled room fronts sit on the rear wall, not in the newly open
// cross-foyer. Their count and exact door positions are not surveyed.
const foyerBranchRoomDoors: BoxInstance[] = branchRoomDoorCenters.map(x => ({
  position: [x, 1.14, branchRoomDoorZ(x) + .12], scale: [1.04, 2.28, .035],
}))
const foyerLeftBranchEndDoor: BoxInstance[] = [{
  position: [foyerRoute.branchLeftX + .025, 1.14, leftBranchEndDoorZ], scale: [.035, 2.28, 1.04],
}]
const foyerBranchDoorReveals: BoxInstance[] = branchRoomDoorCenters.flatMap(x => [
  { position: [x - branchDoorHalfWidth, 1.17, branchRoomDoorZ(x) + .04], scale: [.055, 2.34, .2], color: '#c8c6bf' },
  { position: [x + branchDoorHalfWidth, 1.17, branchRoomDoorZ(x) + .04], scale: [.055, 2.34, .2], color: '#c8c6bf' },
] satisfies BoxInstance[])
const foyerBranchRoomFrames: BoxInstance[] = branchRoomDoorCenters.flatMap(x => [
  { position: [x - .55, 1.17, branchRoomDoorZ(x) - .04], scale: [.06, 2.34, .055] },
  { position: [x + .55, 1.17, branchRoomDoorZ(x) - .04], scale: [.06, 2.34, .055] },
  { position: [x, 2.34, branchRoomDoorZ(x) - .04], scale: [1.16, .06, .055] },
] satisfies BoxInstance[])
const foyerLeftBranchWindowFrames: BoxInstance[] = [
  ...[-1, 1].map(sign => ({
    position: [leftBranchWindow.centerX + sign * leftBranchWindow.width / 2, (leftBranchWindow.sillY + leftBranchWindow.headY) / 2, 13.285],
    scale: [.065, leftBranchWindow.headY - leftBranchWindow.sillY + .07, .055], color: '#293437',
  } satisfies BoxInstance)),
  // Photo 01 shows a dark full-height mullion between the courtyard panes.
  // It sits in the existing frame batch, in front of the bounded photo view.
  { position: [leftBranchWindow.centerX, (leftBranchWindow.sillY + leftBranchWindow.headY) / 2, 13.285],
    scale: [.065, leftBranchWindow.headY - leftBranchWindow.sillY + .07, .055], color: '#293437' },
  ...[leftBranchWindow.sillY, leftBranchWindow.headY].map(y => ({
    position: [leftBranchWindow.centerX, y, 13.285], scale: [leftBranchWindow.width + .07, .065, .055], color: '#293437',
  } satisfies BoxInstance)),
]
// The far door in photo 01 has a wall-mounted extinguisher and red sign on
// its courtyard side. These are shallow, non-interactive markers, not a room.
const foyerLeftBranchSafety: BoxInstance[] = [
  { position: [foyerRoute.branchLeftX + .17, 1.81, leftBranchEndDoorZ + .91], scale: [.045, .22, .18], color: '#bd282d' },
  { position: [foyerRoute.branchLeftX + .19, 1.08, leftBranchEndDoorZ + .91], scale: [.14, .46, .16], color: '#b6322d' },
  { position: [foyerRoute.branchLeftX + .27, 1.08, leftBranchEndDoorZ + .91], scale: [.014, .14, .105], color: '#e8e4dc' },
  { position: [foyerRoute.branchLeftX + .19, 1.34, leftBranchEndDoorZ + .91], scale: [.085, .065, .12], color: '#303536' },
]
const foyerLeftBranchEndFrames: BoxInstance[] = [
  ...[-leftBranchEndDoorHalfWidth, leftBranchEndDoorHalfWidth].map(offset => ({
    position: [foyerRoute.branchLeftX + .075, 1.17, leftBranchEndDoorZ + offset], scale: [.055, 2.34, .06],
  } satisfies BoxInstance)),
  { position: [foyerRoute.branchLeftX + .075, 2.34, leftBranchEndDoorZ], scale: [.055, .06, 1.16] },
]
// Photo 01 has ordinary short lever handles. Keep their plates and levers
// ahead of the closed door faces; the old thin pins sat nearly flush with
// the slab and disappeared from the corridor sightline.
const foyerBranchRoomHandles: BoxInstance[] = branchRoomDoorCenters.flatMap(x => [
  { position: [x + .36, 1.04, branchRoomDoorZ(x) + .075], scale: [.05, .16, .035] },
  { position: [x + .36, 1.04, branchRoomDoorZ(x) + .045], scale: [.035, .035, .055] },
  { position: [x + .27, 1.04, branchRoomDoorZ(x) + .015], scale: [.18, .025, .035] },
])
const foyerLeftBranchEndHandle: BoxInstance[] = [
  { position: [foyerRoute.branchLeftX + .075, 1.04, leftBranchEndDoorZ + .36], scale: [.035, .16, .05] },
  { position: [foyerRoute.branchLeftX + .11, 1.04, leftBranchEndDoorZ + .36], scale: [.055, .035, .035] },
  { position: [foyerRoute.branchLeftX + .14, 1.04, leftBranchEndDoorZ + .27], scale: [.035, .025, .18] },
]
const foyerDoorBanks = [
  ...foyerRoute.leftDoorBanks.map(([start, end]) => ({ x: foyerRoute.aisleLeftX, side: 1, start, end })),
  ...foyerRoute.rightDoorBanks.map(([start, end]) => ({ x: foyerRoute.aisleRightX, side: -1, start, end })),
]
// Owner-confirmed compact guard room just inside the left of the entrance.
// It remains closed: the little door is a visual face, not an invented route.
// Its unmeasured shell reuses the foyer's existing opaque/glass batches.
const foyerGuard = VIRTUAL_CHURCH_FOYER_GUARD_ROOM
const foyerGuardMidX = (foyerGuard.minX + foyerGuard.maxX) / 2
const foyerGuardMidZ = (foyerGuard.minZ + foyerGuard.maxZ) / 2
const foyerGuardDoorWidth = .68
const foyerGuardRoomShell: BoxInstance[] = [
  { position: [foyerGuardMidX, foyerGuard.height + .04, foyerGuardMidZ],
    scale: [foyerGuard.maxX - foyerGuard.minX, .08, foyerGuard.maxZ - foyerGuard.minZ] },
  { position: [foyerGuardMidX, foyerGuard.height / 2, foyerGuard.maxZ],
    scale: [foyerGuard.maxX - foyerGuard.minX, foyerGuard.height, .07] },
  { position: [foyerGuard.maxX, .47, foyerGuardMidZ],
    scale: [.07, .94, foyerGuard.maxZ - foyerGuard.minZ] },
  { position: [foyerGuard.maxX, (2.32 + foyerGuard.height) / 2, foyerGuardMidZ],
    scale: [.07, foyerGuard.height - 2.32, foyerGuard.maxZ - foyerGuard.minZ] },
  ...[-1, 1].map(side => ({
    position: [foyerGuardMidX + side * (foyerGuardDoorWidth / 2 + (foyerGuard.maxX - foyerGuard.minX - foyerGuardDoorWidth) / 4),
      1.04, foyerGuard.minZ],
    scale: [(foyerGuard.maxX - foyerGuard.minX - foyerGuardDoorWidth) / 2, 2.08, .07],
  } satisfies BoxInstance)),
  { position: [foyerGuardMidX, (2.08 + foyerGuard.height) / 2, foyerGuard.minZ],
    scale: [foyerGuardDoorWidth, foyerGuard.height - 2.08, .07] },
]
const foyerGuardRoomInterior: BoxInstance[] = [{
  position: [foyerGuard.minX + .055, 1.18, foyerGuardMidZ],
  scale: [.025, 2.32, foyerGuard.maxZ - foyerGuard.minZ - .09], color: '#817d73',
}]
const foyerGuardRoomCounter: BoxInstance[] = [
  { position: [foyerGuard.maxX - .36, 1.02, foyerGuardMidZ + .06],
    scale: [.48, .055, foyerGuard.maxZ - foyerGuard.minZ - .22], color: '#9d866c' },
  { position: [foyerGuard.maxX - .52, .54, foyerGuardMidZ + .06],
    scale: [.04, .96, foyerGuard.maxZ - foyerGuard.minZ - .25], color: '#7b6756' },
]
const foyerGuardRoomDoor: BoxInstance[] = [{
  position: [foyerGuardMidX, 1.03, foyerGuard.minZ - .04],
  scale: [foyerGuardDoorWidth - .045, 2.06, .035], color: '#4b5150',
}]
const foyerGuardRoomFrames: BoxInstance[] = [
  ...[foyerGuard.minZ, foyerGuard.maxZ].map(z => ({
    position: [foyerGuard.maxX + .055, (2.32 + .94) / 2, z], scale: [.045, 2.32 - .94, .045], color: '#303a3a',
  } satisfies BoxInstance)),
  { position: [foyerGuard.maxX + .055, (2.32 + .94) / 2, foyerGuardMidZ],
    scale: [.045, 2.32 - .94, .045], color: '#303a3a' },
  ...[.94, 2.32].map(y => ({
    position: [foyerGuard.maxX + .055, y, foyerGuardMidZ], scale: [.045, .05, foyerGuard.maxZ - foyerGuard.minZ], color: '#303a3a',
  } satisfies BoxInstance)),
  ...[-1, 1].map(side => ({
    position: [foyerGuardMidX + side * foyerGuardDoorWidth / 2, 1.04, foyerGuard.minZ - .075],
    scale: [.05, 2.08, .045], color: '#303a3a',
  } satisfies BoxInstance)),
  { position: [foyerGuardMidX, 2.08, foyerGuard.minZ - .075],
    scale: [foyerGuardDoorWidth + .05, .05, .045], color: '#303a3a' },
]
const foyerGuardRoomHardware: BoxInstance[] = [{
  position: [foyerGuardMidX + .21, 1.02, foyerGuard.minZ - .105],
  scale: [.08, .025, .045], color: '#c9c6bd',
}]
const foyerGuardRoomGlass: BoxInstance[] = [{
  position: [foyerGuard.maxX + .045, (2.32 + .94) / 2, foyerGuardMidZ],
  scale: [.014, 2.32 - .94, foyerGuard.maxZ - foyerGuard.minZ - .06], color: '#d8e2dc',
}]
// In the entrance photo the near pair of main-hall entrances shares one low
// soffit and dark recessed frontage beneath the tall white wall. Keep this
// photo-backed treatment on the left only; the cafe-side doors have their
// own charcoal surround from the supplied photos.
const leftDoorBayEnd = foyerRoute.leftDoorBanks[1][1] + .14
const leftDoorBayStart = foyerRoute.leftDoorBanks[0][0] - .14
// Replace the V3 clone's single full-height near-left wall with complete
// piers and lintels around the two photographed double-door banks. The
// original GLB wall is untouched for V2 and for future rebuilds.
const mainHallWallX = foyerRoute.aisleLeftX - .10
const mainHallWallBottomZ = -.52
const mainHallWallTopZ = 6.40
const mainHallDoorHeadY = 2.44
const mainHallWallHeight = 6.05
const mainHallWallSolidSpans: Array<[number, number]> = [
  [mainHallWallBottomZ, foyerRoute.leftDoorBanks[0][0]],
  [foyerRoute.leftDoorBanks[0][1], foyerRoute.leftDoorBanks[1][0]],
  [foyerRoute.leftDoorBanks[1][1], mainHallWallTopZ],
]
const foyerMainHallWallStrips: BoxInstance[] = [
  ...mainHallWallSolidSpans.map(([start, end]): BoxInstance => ({
    position: [mainHallWallX, mainHallWallHeight / 2, (start + end) / 2],
    scale: [.18, mainHallWallHeight, end - start],
  })),
  ...foyerRoute.leftDoorBanks.map(([start, end]): BoxInstance => ({
    position: [mainHallWallX, (mainHallDoorHeadY + mainHallWallHeight) / 2, (start + end) / 2],
    scale: [.18, mainHallWallHeight - mainHallDoorHeadY, end - start],
  })),
]
// A short shaded threshold conceals the unbuilt room behind this separate
// auditorium preview. The scene switches before the avatar reaches its back.
const foyerMainHallThresholdRecess: BoxInstance[] = foyerRoute.leftDoorBanks.flatMap(([start, end]): BoxInstance[] => [
  { position: [mainHallWallX - .55, 1.2, (start + end) / 2], scale: [.025, 2.4, end - start], color: '#2d3131' },
  { position: [mainHallWallX - .27, 2.43, (start + end) / 2], scale: [.57, .045, end - start], color: '#343a39' },
  ...[start, end].map((z): BoxInstance => ({ position: [mainHallWallX - .27, 1.2, z], scale: [.57, 2.4, .045], color: '#343a39' })),
])
const foyerMainHallThresholdFloor: BoxInstance[] = foyerRoute.leftDoorBanks.map(([start, end]) => ({
  position: [mainHallWallX - .20, .038, (start + end) / 2], scale: [.66, .045, end - start], color: '#786655',
}))
const leftDoorDividerZ = (foyerRoute.leftDoorBanks[0][1] + foyerRoute.leftDoorBanks[1][0]) / 2
const foyerLeftDoorDivider: BoxInstance[] = [{
  position: [foyerRoute.aisleLeftX + .28, 1.36, leftDoorDividerZ],
  scale: [.24, 2.72, .58],
}]
const foyerLeftDoorSoffit: BoxInstance[] = [{
  // Photo 09 has a shallow lintel above the doors, not a deep canopy
  // cantilevered into the double-height foyer.
  position: [foyerRoute.aisleLeftX + .20, 2.54, (leftDoorBayStart + leftDoorBayEnd) / 2],
  scale: [.40, .16, leftDoorBayEnd - leftDoorBayStart + .12],
}]
// Photo 09: the shallow soffit's face catches light even though its underside
// and the two door openings remain shadowed. Keep this in the pale instance batch.
const foyerLeftDoorSoffitFascia: BoxInstance[] = [{
  position: [foyerRoute.aisleLeftX + .412, 2.54, (leftDoorBayStart + leftDoorBayEnd) / 2],
  scale: [.025, .16, leftDoorBayEnd - leftDoorBayStart + .12],
}]
// Photo 09: the high wall above the two door banks reads as a subdued
// daylit grey. The prior cool tint rendered cyan under the foyer lighting,
// pulling attention from the charcoal piers and timber frontage.
const foyerMainHallUpperWall: BoxInstance[] = [
  { position: [foyerRoute.aisleLeftX + .23, 4.22, 3.27],
    scale: [.018, 3.20, 6.18], color: '#a0a09b' },
  { position: [foyerRoute.aisleLeftX + .23, 4.22, (6.94 + 9.81) / 2],
    scale: [.018, 3.20, 9.81 - 6.94], color: '#a0a09b' },
]
const foyerLeftDoorTimber: BoxInstance[] = [{
  position: [foyerRoute.aisleLeftX + .17, 1.36, leftDoorBayEnd + .31], scale: [.075, 2.72, .62],
}]
// Photos 07/08: the cafe window and its adjacent double door share one
// continuous charcoal lower frontage. Extend the existing thin door-bay
// finish back under the service wall's solid end pier.
const foyerServiceDoorBayStartZ = VIRTUAL_CHURCH_FOYER_SERVICE_FRONTAGE.endZ
const foyerServiceDoorBayEndZ = foyerRoute.rightDoorBanks[0][1] + .17
const foyerServiceAdjacentDoorBay: BoxInstance[] = [{
  position: [foyerRoute.aisleRightX - .10, 1.48,
    (foyerServiceDoorBayStartZ + foyerServiceDoorBayEndZ) / 2],
  scale: [.025, 2.96, foyerServiceDoorBayEndZ - foyerServiceDoorBayStartZ],
}]
const foyerDoorRecesses: BoxInstance[] = foyerDoorBanks.map(({ x, side, start, end }) => ({
  position: [x + side * .11, 1.34, (start + end) / 2], scale: [.035, 2.68, end - start + .18],
}))
const foyerSanctuaryDoors: BoxInstance[] = foyerDoorBanks.flatMap(({ x, side, start, end }, bank) => {
  const middle = (start + end) / 2, half = (end - start) / 2
  return ([-1, 1] as const).map((leaf): BoxInstance => ({
    position: [x + side * .15, 1.16, middle + leaf * half / 2],
    scale: [.045, 2.32, half - .06],
    mainHallDoor: bank < foyerRoute.leftDoorBanks.length
      ? { bank, leaf, hingeX: x + side * .15, hingeZ: leaf < 0 ? start : end }
      : undefined,
  }))
})
const foyerLeftDoorLeafCount = foyerRoute.leftDoorBanks.length * 2
const foyerDoorFrames: BoxInstance[] = foyerDoorBanks.flatMap(({ x, side, start, end }): BoxInstance[] => [
  ...[start, (start + end) / 2, end].map((z): BoxInstance => ({ position: [x + side * .19, 1.22, z], scale: [.07, 2.44, .055] })),
  { position: [x + side * .19, 2.44, (start + end) / 2], scale: [.07, .06, end - start + .07] },
])
const foyerDoorGlass: BoxInstance[] = foyerDoorBanks.flatMap(({ x, side, start, end }, bank) => {
  const middle = (start + end) / 2, quarter = (end - start) / 4
  return ([-1, 1] as const).map((leaf): BoxInstance => ({
    position: [x + side * .20, 1.52, middle + leaf * quarter],
    scale: [.012, .88, .13],
    mainHallDoor: bank < foyerRoute.leftDoorBanks.length
      ? { bank, leaf, hingeX: x + side * .15, hingeZ: leaf < 0 ? start : end }
      : undefined,
  }))
})
const foyerDoorPulls: BoxInstance[] = foyerDoorBanks.flatMap(({ x, side, start, end }, bankIndex) => {
  const middle = (start + end) / 2
  return ([-1, 1] as const).flatMap((leaf): BoxInstance[] => {
    const handleZ = middle + leaf * .12
    // Photos 09 and 08 show loop pulls on the main-hall and cafe-side banks.
    // Keep the same rounded silhouette in the existing hardware batch; only
    // the main-hall parts belong to animated door leaves.
    const parts: BoxInstance[] = [
      ...[-1, 1].map(edge => ({
        position: [x + side * .265, 1.12, handleZ + edge * .065],
        scale: [.024, .42, .024] as [number, number, number],
        color: '#4d5350',
      } satisfies BoxInstance)),
      ...[-1, 1].flatMap(end => [-1, 1].map(edge => ({
        position: [x + side * .265, 1.12 + end * .25, handleZ + edge * .033],
        scale: [.024, .09, .024] as [number, number, number],
        rotation: [-end * edge * .82, 0, 0] as [number, number, number],
        color: '#4d5350',
      } satisfies BoxInstance))),
      ...[-.19, .19].map(offset => ({
        position: [x + side * .23, 1.12 + offset, handleZ],
        scale: [.075, .024, .025] as [number, number, number],
        color: '#4d5350',
      } satisfies BoxInstance)),
    ]
    const mainHallDoor = bankIndex < foyerRoute.leftDoorBanks.length
      ? { bank: bankIndex, leaf, hingeX: x + side * .15, hingeZ: leaf < 0 ? start : end }
      : undefined
    return parts.map(item => ({ ...item, mainHallDoor }))
  })
})
const welcomeTable = foyerRoute.welcomeTable
// Photo 09 shows a low, light folding welcome table; the previous .95 m
// surface read as a counter next to the 2.4 m sanctuary doors. Its exact
// dimensions are not surveyed, so retain the footprint and lower only the
// tabletop, legs, and printed material together for the V3 review candidate.
const welcomeTableTopY = .78
const foyerWelcomeTableFrame: FoyerWelcomePart[] = [
  { position: [welcomeTable.x, welcomeTableTopY, welcomeTable.z], scale: [1.55, .065, .64], shape: 'rounded' },
  ...[-.63, .63].flatMap(dx => [-.235, .235].map((dz): BoxInstance => ({ position: [welcomeTable.x + dx, welcomeTableTopY / 2, welcomeTable.z + dz], scale: [.045, welcomeTableTopY, .045] }))),
]
// Thin, individually visible leaflet stacks rather than dark solid blocks.
// Their artwork is intentionally abstract until the church supplies print files.
const foyerWelcomeBrochures: BoxInstance[] = [-.45, -.08, .3].flatMap((dx, index) =>
  [0, 1, 2].map((sheet): BoxInstance => ({
    position: [welcomeTable.x + dx, welcomeTableTopY + .046 + sheet * .006, welcomeTable.z],
    scale: [.27, .004, .38], rotation: [0, index * .08, 0],
  })))
// Photo 09 has print on the welcome table. Low dark display plinths and tall
// single-colour cards read as laptop screens in the walking view, so keep the
// material as small, flat A5-like stacks. Artwork stays abstract until the
// church supplies current, approved leaflets.
const foyerWelcomeBrochurePalette = ['#6c866f', '#b97164', '#768c91']
const foyerWelcomeBrochureCovers: BoxInstance[] = [-.45, -.08, .3].flatMap((dx, index): BoxInstance[] => [
  { position: [welcomeTable.x + dx, welcomeTableTopY + .068, welcomeTable.z + .08], scale: [.24, .003, .31], rotation: [0, index * .08, 0], color: foyerWelcomeBrochurePalette[index] },
  { position: [welcomeTable.x + dx, welcomeTableTopY + .070, welcomeTable.z - .005], scale: [.17, .002, .025], rotation: [0, index * .08, 0], color: '#eee9da' },
  { position: [welcomeTable.x + dx, welcomeTableTopY + .070, welcomeTable.z + .055], scale: [.17, .002, .012], rotation: [0, index * .08, 0], color: '#e7dfd0' },
])
// Photo 09: a slim wine-coloured campaign banner stands between the second
// left door and the brochure table. Its artwork is not legible in the supplied
// photo, so suggest only the dark print field and quiet warm lower panel.
const foyerWelcomeBannerZ = foyerRoute.leftDoorBanks[1][1] + .43
const foyerWelcomeBanner: BoxInstance[] = [
  { position: [foyerRoute.aisleLeftX + .39, 1.01, foyerWelcomeBannerZ], scale: [.045, 1.90, .57], color: '#69283d' },
  { position: [foyerRoute.aisleLeftX + .415, 1.39, foyerWelcomeBannerZ - .10], scale: [.008, .74, .31], color: '#773449' },
  { position: [foyerRoute.aisleLeftX + .42, .39, foyerWelcomeBannerZ], scale: [.008, .54, .55], color: '#a45e49' },
  { position: [foyerRoute.aisleLeftX + .43, .19, foyerWelcomeBannerZ + .17], scale: [.009, .19, .20], color: '#c4945f' },
  { position: [foyerRoute.aisleLeftX + .39, .035, foyerWelcomeBannerZ], scale: [.46, .025, .68], color: '#454341' },
]
// Photo 09 has brochures and a small arrangement on a low table. Keep the
// covers flat: the former upright colour cards looked like laptop screens
// from the entrance and obscured the table's actual welcoming purpose.
const foyerWelcomeTableDisplay = createVirtualChurchFoyerWelcomeArrangement(welcomeTable, welcomeTableTopY)
// Photo 04: low, light storage sits on the far wall left of the courtyard
// glazing. It replaces an invented full-height room door at this position.
const farCabinet = VIRTUAL_CHURCH_FOYER_FAR_CABINET
const foyerFarCabinetWoodwork: BoxInstance[] = [
  { position: [farCabinet.centerX, .48, farCabinet.centerZ], scale: [2.42, .93, .48], color: '#c4b4a1' },
  { position: [farCabinet.centerX, .975, farCabinet.centerZ], scale: [2.48, .06, .53], color: '#a78f78' },
  ...[-.9, -.3, .3, .9].map(dx => ({
    position: [farCabinet.centerX + dx, .49, farCabinet.centerZ - .255],
    scale: [.565, .78, .025], color: '#d2c2ad',
  } satisfies BoxInstance)),
]
const foyerFarCabinetPulls: BoxInstance[] = [-.9, -.3, .3, .9].map(dx => ({
  position: [farCabinet.centerX + dx + .2, .53, farCabinet.centerZ - .275],
  scale: [.015, .12, .018], color: '#655c52',
}))
// Photo 03 reveals the lower stem behind the flags: it is taller than the
// arm is wide, with that arm in the upper portion. Photo 04 alone obscures
// the lower stem. Retain the existing top edge; dimensions remain estimates.
const foyerFarWallCross: BoxInstance[] = [
  { position: [foyerRoute.axisX, 4.11, 13.275], scale: [.16, 2.0, .065], color: '#5e4132' },
  { position: [foyerRoute.axisX, 4.59, 13.265], scale: [1.32, .14, .075], color: '#5e4132' },
]
// Photo 04 shows fixed side lights flanking the central double doors. Four
// narrow glazed panels also keep the real mullions aligned with the backdrop.
const farGlazingPanelWidth = farGlazingHalfWidth / 2
const foyerBackDoors: BoxInstance[] = [
  ...[-1.5, -.5, .5, 1.5].map((offset): BoxInstance => ({
    position: [foyerRoute.axisX + offset * farGlazingPanelWidth, 1.225, foyerRoute.oppositeDoorZ],
    scale: [farGlazingPanelWidth - .08, 2.45, .035],
  })),
  { position: [leftBranchWindow.centerX, (leftBranchWindow.sillY + leftBranchWindow.headY) / 2, 13.265],
    scale: [leftBranchWindow.width - .06, leftBranchWindow.headY - leftBranchWindow.sillY - .06, .012] },
]
const foyerBackDoorFrames: BoxInstance[] = [
  ...[-2, -1, 0, 1, 2].map((offset): BoxInstance => ({
    position: [foyerRoute.axisX + offset * farGlazingPanelWidth, 1.225, foyerRoute.oppositeDoorZ - .04],
    scale: [.075, 2.45, .08],
  })),
  { position: [foyerRoute.axisX, 2.45, foyerRoute.oppositeDoorZ - .04], scale: [farGlazingHalfWidth * 2 + .08, .08, .08] },
]
const foyerBackDoorPulls: BoxInstance[] = [-.13, .13].map(dx => ({
  position: [foyerRoute.axisX + dx, 1.17, foyerRoute.oppositeDoorZ - .1], scale: [.024, .43, .024],
}))
const FOYER_COURTYARD_REFERENCE = '/virtual-church-assets/v3/foyer-courtyard-reference-04.jpg'
// Image-backed meshes commit later than their containing foyer. Keep each
// real material hidden until the same cancellable preparation queue settles.
const PreparedFoyerSurface = ({ children, onReady }: { children: ReactNode; onReady?: (ready: boolean) => void }) => {
  const group = useMemo(() => new ThreeGroup(), [])
  const prepared = usePreparedReviewAsset(group, true, true, true, 'surface')
  useEffect(() => { onReady?.(prepared) }, [onReady, prepared])
  return <primitive object={group} visible={prepared}>{children}</primitive>
}
const FoyerCourtyardPhoto = () => {
  const source = useLoader(TextureLoader, FOYER_COURTYARD_REFERENCE)
  const texture = useMemo(() => {
    const cropped = source.clone()
    cropped.colorSpace = SRGBColorSpace
    // Unedited user photo 04: sample only the actual glazed courtyard view,
    // not the photographed foyer around it. This is a temporary scenic view.
    // Start below the temporary flag strings so the guide's flag toggle
    // remains truthful even while this distant photo view is visible.
    cropped.offset.set(420 / 1280, (960 - 714) / 960)
    cropped.repeat.set(410 / 1280, 194 / 960)
    cropped.needsUpdate = true
    return cropped
  }, [source])
  useEffect(() => () => texture.dispose(), [texture])
  return <PreparedFoyerSurface><mesh name="vc:foyer-courtyard-photo-view" position={[foyerRoute.axisX, 1.225, foyerRoute.oppositeDoorZ + .065]} rotation={[0, Math.PI, 0]}>
    <planeGeometry args={[farGlazingHalfWidth * 2 - .07, 2.43]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh></PreparedFoyerSurface>
}
const FOYER_SIDE_COURTYARD_REFERENCE = '/virtual-church-assets/v3/foyer-courtyard-reference-01.jpg'
const FoyerSideCourtyardPhoto = () => {
  const source = useLoader(TextureLoader, FOYER_SIDE_COURTYARD_REFERENCE)
  const texture = useMemo(() => {
    const cropped = source.clone()
    cropped.colorSpace = SRGBColorSpace
    // Crop only the actual wall, downpipe and planting visible through the
    // user's photo 01 window. Do not project the photographed corridor back
    // into itself or claim this is surveyed courtyard depth.
    cropped.offset.set(795 / 1280, 0)
    cropped.repeat.set(415 / 1280, 460 / 960)
    cropped.needsUpdate = true
    return cropped
  }, [source])
  useEffect(() => () => texture.dispose(), [texture])
  return <PreparedFoyerSurface><mesh name="vc:foyer-side-courtyard-photo-view"
    position={[leftBranchWindow.centerX, (leftBranchWindow.sillY + leftBranchWindow.headY) / 2, 13.315]}
    rotation={[0, Math.PI, 0]}>
    <planeGeometry args={[leftBranchWindow.width - .075, leftBranchWindow.headY - leftBranchWindow.sillY - .075]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh></PreparedFoyerSurface>
}
// Photos 06/09 show full-height dark columns on the main-hall side. The
// service-window side in photos 07/08 instead reads as a dark low frontage
// below a pale upper wall; adding the same columns there made false stripes.
const foyerPerimeterColumns: BoxInstance[] = [6.7, 10.05].map((z): BoxInstance => ({
  position: [foyerRoute.aisleLeftX, 2.93, z], scale: [.42, 5.86, .48],
}))
// Photo 09: the welcome table stands in front of a warm timber frontage
// between the two charcoal piers. Keep this as a thin finish on the existing
// main-hall wall, without implying a new room or changing circulation.
const foyerMainHallTimberFrontage: BoxInstance[] = [{
  position: [foyerRoute.aisleLeftX + .23, 1.36, (6.7 + 10.05) / 2],
  scale: [.018, 2.72, 10.05 - 6.7 - .48], color: '#604335',
}]
const foyerMainHallTimberJoints: BoxInstance[] = [7.35, 8.05, 8.75, 9.45].map(z => ({
  position: [foyerRoute.aisleLeftX + .245, 1.36, z],
  scale: [.012, 2.72, .018], color: '#51392e',
}))
const foyerCeilingSlots: BoxInstance[] = [-5.5, 5.5].map(offset => ({ position: [foyerRoute.axisX + offset, 5.88, 9.83], scale: [.09, .025, 6.7] }))
// A shallow service-window elevation is supported by photos 05–08. Its exact
// room depth is unknown, so this is only the visible foyer-side frontage.
const foyerServiceX = foyerRoute.aisleRightX - .15
const foyerServiceVisibleDepth = VIRTUAL_CHURCH_FOYER_SERVICE_FRONTAGE.visibleDepth
const foyerServiceOpening = VIRTUAL_CHURCH_FOYER_SERVICE_FRONTAGE
const foyerServiceGlassHeight = foyerServiceOpening.headY - foyerServiceOpening.sillY
const foyerServiceGlassMidY = (foyerServiceOpening.headY + foyerServiceOpening.sillY) / 2
const foyerServiceCounterY = foyerServiceOpening.sillY + .08
const foyerServiceCenterZ = (foyerServiceOpening.startZ + foyerServiceOpening.endZ) / 2
const foyerServiceGlassWidth = foyerServiceOpening.endZ - foyerServiceOpening.startZ
const foyerServiceWallStartZ = .25
const foyerServiceWallEndZ = 6.4
const foyerServiceWallCenterZ = (foyerServiceWallStartZ + foyerServiceWallEndZ) / 2
const foyerServiceWallWidth = foyerServiceWallEndZ - foyerServiceWallStartZ
// The original x=.49/.68 partition faces are removed from V3 clones only.
// Restore the same wall volume around the photographed service window; the
// opening, not an entire side of the building, is the only new void.
const foyerServiceSurround: BoxInstance[] = [
  { position: [.585, 3.025, (-.52 + foyerServiceOpening.startZ) / 2], scale: [.187, 6.05, foyerServiceOpening.startZ + .52] },
  { position: [.585, 3.025, (foyerServiceOpening.endZ + 6.4) / 2], scale: [.187, 6.05, 6.4 - foyerServiceOpening.endZ] },
  { position: [.585, foyerServiceOpening.sillY / 2, (foyerServiceOpening.startZ + foyerServiceOpening.endZ) / 2], scale: [.187, foyerServiceOpening.sillY, foyerServiceOpening.endZ - foyerServiceOpening.startZ] },
  { position: [.585, (foyerServiceOpening.headY + 6.05) / 2, (foyerServiceOpening.startZ + foyerServiceOpening.endZ) / 2], scale: [.187, 6.05 - foyerServiceOpening.headY, foyerServiceOpening.endZ - foyerServiceOpening.startZ] },
]
const foyerServiceWall: BoxInstance[] = [
  // Leave a real opening between the dark sill and header; an opaque pane
  // previously made the photographed cafe read as a flat grey rectangle.
  { position: [foyerServiceX, foyerServiceOpening.sillY / 2, foyerServiceWallCenterZ], scale: [.08, foyerServiceOpening.sillY, foyerServiceWallWidth] },
  { position: [foyerServiceX, 3.395, foyerServiceWallCenterZ], scale: [.08, .69, foyerServiceWallWidth] },
  { position: [foyerServiceX, foyerServiceGlassMidY, (foyerServiceWallStartZ + foyerServiceOpening.startZ) / 2],
    scale: [.08, foyerServiceGlassHeight, foyerServiceOpening.startZ - foyerServiceWallStartZ] },
  { position: [foyerServiceX, foyerServiceGlassMidY, (foyerServiceOpening.endZ + foyerServiceWallEndZ) / 2],
    scale: [.08, foyerServiceGlassHeight, foyerServiceWallEndZ - foyerServiceOpening.endZ] },
]
const foyerServiceRecess: BoxInstance[] = [
  { position: [foyerServiceX + foyerServiceVisibleDepth, foyerServiceGlassMidY, foyerServiceCenterZ],
    scale: [.04, foyerServiceGlassHeight, foyerServiceGlassWidth] },
  ...[foyerServiceOpening.startZ, foyerServiceOpening.endZ].map((z): BoxInstance => ({ position: [foyerServiceX + foyerServiceVisibleDepth / 2, foyerServiceGlassMidY, z], scale: [foyerServiceVisibleDepth, foyerServiceGlassHeight, .04] })),
]
// Photo 08 shows a pale, daylit pass-through behind the darker coffee
// equipment. Keep this a shallow elevation, not an invented walkable kitchen.
const foyerServiceBackHatch: BoxInstance[] = [
  { position: [foyerServiceX + foyerServiceVisibleDepth - .045, 2.38, 3.34], scale: [.035, 1.18, 2.54], color: '#a8a8a2' },
  ...[-.605, .605].map((offset): BoxInstance => ({
    position: [foyerServiceX + foyerServiceVisibleDepth - .071, 2.38, 3.34 + offset],
    scale: [.012, 1.04, 1.13], color: '#d8d3c6',
  })),
  { position: [foyerServiceX + foyerServiceVisibleDepth - .084, 2.38, 3.34], scale: [.014, 1.16, .045], color: '#676b67' },
  { position: [foyerServiceX + foyerServiceVisibleDepth - .086, 1.77, 3.34], scale: [.025, .025, 2.53], color: '#777b76' },
]
const foyerServiceCounter: BoxInstance[] = [
  { position: [foyerServiceX + .53, foyerServiceCounterY, foyerServiceCenterZ], scale: [1.08, .07, foyerServiceGlassWidth - .04] },
  // Photo 08 shows pale joinery and coffee equipment behind the dark frontage,
  // not an empty room. Only the visible shallow elevation
  // is modelled; no inaccessible back-of-house floor plan is implied.
  ...Array.from({ length: 7 }, (_, index) =>
    foyerServiceOpening.startZ + .39 + index * (foyerServiceGlassWidth - .78) / 6).map((z): BoxInstance => ({
    position: [foyerServiceX + foyerServiceVisibleDepth - .06, foyerServiceOpening.sillY + .29, z], scale: [.026, .48, .68], color: '#d8c8b3',
  })),
  { position: [foyerServiceX + foyerServiceVisibleDepth - .08, foyerServiceOpening.sillY + .55, foyerServiceCenterZ],
    scale: [.12, .045, foyerServiceGlassWidth - .09], color: '#eee8db' },
]
const foyerServiceEquipment: FoyerCafeEquipmentPart[] = [
  // The photographed grinder precedes the wider espresso machine. These are
  // unbranded silhouettes, not a claim about appliance make or exact layout.
  { position: [foyerServiceX + .73, foyerServiceOpening.sillY + .36, 2.13], scale: [.30, .53, .30], color: '#4a504e', shape: 'grinder' },
  { position: [foyerServiceX + .73, foyerServiceOpening.sillY + .77, 2.13], scale: [.22, .27, .22], color: '#c6beb0', shape: 'hopper' },
  { position: [foyerServiceX + .70, foyerServiceOpening.sillY + .41, 3.43], scale: [.50, .62, 1.12], color: '#3b4141', shape: 'rounded' },
  { position: [foyerServiceX + .70, foyerServiceOpening.sillY + .75, 3.43], scale: [.52, .07, 1.14], color: '#353b3a' },
  { position: [foyerServiceX + .44, foyerServiceOpening.sillY + .47, 3.43], scale: [.018, .41, 1.03], color: '#a9aaa5' },
  { position: [foyerServiceX + .42, foyerServiceOpening.sillY + .60, 3.43], scale: [.025, .07, .38], color: '#303737' },
  ...[-.28, .28].map((offset): BoxInstance => ({
    position: [foyerServiceX + .42, foyerServiceOpening.sillY + .29, 3.43 + offset],
    scale: [.045, .11, .13], color: '#383d3d',
  })),
  { position: [foyerServiceX + .35, foyerServiceOpening.sillY + .16, 3.43], scale: [.24, .035, .96], color: '#343a39' },
  ...[-.28, .28].map((offset): BoxInstance => ({
    position: [foyerServiceX + .31, foyerServiceOpening.sillY + .26, 3.43 + offset],
    scale: [.23, .025, .035], color: '#292e2e',
  })),
  ...[-.32, -.14, .14, .32].map((offset): FoyerCafeEquipmentPart => ({
    position: [foyerServiceX + .62, foyerServiceOpening.sillY + .84, 3.43 + offset],
    scale: [.11, .10, .10], color: '#dedbd2', shape: 'cup',
  })),
  { position: [foyerServiceX + .78, foyerServiceOpening.sillY + .23, 4.37], scale: [.24, .2, .38], color: '#655d52' },
  { position: [foyerServiceX + .70, foyerServiceOpening.sillY + .22, 4.72], scale: [.17, .18, .15], color: '#dedad0', shape: 'cup' },
]
const foyerServiceInteriorLights: BoxInstance[] = [
  { position: [foyerServiceX + .76, 2.98, 2.43], scale: [.24, .015, 1.0] },
  { position: [foyerServiceX + .76, 2.98, 4.3], scale: [.24, .015, 1.0] },
  { position: [foyerServiceX + 1.17, 2.91, 3.34], scale: [.05, .025, 3.22] },
]
const foyerServiceFrames: BoxInstance[] = [
  // Photo 08: three glazed bays, with two internal black mullions. Keep the
  // photographed window opening and existing one-draw-call frame batch.
  ...[0, 1, 2, 3].map((bay): BoxInstance => ({
    position: [foyerServiceX - .08, foyerServiceGlassMidY, foyerServiceOpening.startZ + bay * foyerServiceGlassWidth / 3],
    scale: [.045, foyerServiceGlassHeight, .055],
  })),
  ...[foyerServiceOpening.sillY, foyerServiceOpening.headY].map((y): BoxInstance => ({ position: [foyerServiceX - .08, y, foyerServiceCenterZ], scale: [.045, .07, foyerServiceGlassWidth + .08] })),
  { position: [foyerServiceX - .12, foyerServiceOpening.sillY - .17, foyerServiceCenterZ], scale: [.32, .09, foyerServiceGlassWidth + .13] },
]
// Photo 08 shows a glazed service opening, not a bare pass-through. Reuse the
// existing translucent end-glazing batch so the equipment remains legible
// without adding a transparent draw call or an invented kitchen interior.
const foyerGlazingPanels: BoxInstance[] = [
  ...foyerBackDoors,
  ...foyerGuardRoomGlass,
  { position: [foyerServiceX - .055, foyerServiceGlassMidY, foyerServiceCenterZ],
    scale: [.012, foyerServiceGlassHeight - .08, foyerServiceOpening.endZ - foyerServiceOpening.startZ - .08],
    color: '#d8e2dc' },
]
// Photos 06/09/10 show four woven shades receding above the hall, just on
// the sanctuary side of the walking axis. The previous three-shade line sat
// too far right and nearly disappeared from the entrance comparison view.
const foyerPendantZ = [2.25, 5.45, 8.65, 11.85]
const foyerPendantX = foyerRoute.axisX - 1.75
const foyerPendantCords: BoxInstance[] = foyerPendantZ.map(z => ({ position: [foyerPendantX, 5.54, z], scale: [.012, .72, .012] }))

// Photos 04/07: black treads rise beside the far glazing above a charcoal
// under-stair side panel and a clear balustrade. This remains unwalkable.
const foyerStair = VIRTUAL_CHURCH_FOYER_STAIR
const foyerStairRun = (foyerStair.maxX - foyerStair.minX) / foyerStair.steps
const foyerStairRiser = foyerStair.rise / foyerStair.steps
// Photos 04/07 show dark tread faces; the small pale marks along the glass
// are balustrade fixings, not full-width light risers. Keep the rear edge
// inside the existing stair footprint.
const foyerStairTreadFrontZ = foyerStair.minZ - .07
const foyerStairTreadBackZ = foyerStair.maxZ - .07
const foyerStairMidZ = (foyerStairTreadFrontZ + foyerStairTreadBackZ) / 2
const foyerStairTreadDepth = foyerStairTreadBackZ - foyerStairTreadFrontZ
const foyerStairDarkwork: BoxInstance[] = Array.from({ length: foyerStair.steps }, (_, index): BoxInstance[] => {
  const top = (index + 1) * foyerStairRiser
  // Photo 04: from the entrance, the stair begins beside the glazing and
  // climbs toward the right-hand wall, not back toward the glass doors.
  const x = foyerStair.minX + (index + .5) * foyerStairRun
  return [
    // Closed steps put the vertical riser at the downhill edge. Thin treads
    // with uphill risers previously left visible floating shelves.
    { position: [x, top - foyerStairRiser / 2, foyerStairMidZ],
      scale: [foyerStairRun + .008, foyerStairRiser, foyerStairTreadDepth], color: '#292d2d' },
  ]
}).flat()
const foyerStairRailAngle = Math.atan2(foyerStair.rise, foyerStair.maxX - foyerStair.minX)
const foyerStairRailLength = Math.hypot(foyerStair.maxX - foyerStair.minX, foyerStair.rise)
const foyerStairRailPosition: [number, number, number] = [
  (foyerStair.minX + foyerStair.maxX) / 2, 1.16 + foyerStair.rise / 2, foyerStair.minZ - .06,
]
// The photographed clear rail is held off the stair cheek by small visible
// fittings. Reuse the existing stair batch instead of adding a mesh per clip.
foyerStairDarkwork.push(...Array.from({ length: 5 }, (_, index): BoxInstance => {
  const along = (index + .65) / 5
  return {
    position: [foyerStair.minX + along * (foyerStair.maxX - foyerStair.minX), .22 + along * foyerStair.rise, foyerStair.minZ - .08],
    scale: [.085, .085, .045], color: '#c5cbc7',
  }
}))
const foyerStairSideShape = new Shape()
foyerStairSideShape.moveTo(foyerStair.minX, .04)
foyerStairSideShape.lineTo(foyerStair.maxX, .04)
// Keep the opaque cheek below each tread. The previous +.14 m edge stood
// 2.5 cm above the tread at its centre and hid every step from the entry view.
foyerStairSideShape.lineTo(foyerStair.maxX, foyerStair.rise + .045)
foyerStairSideShape.lineTo(foyerStair.minX, .045)
foyerStairSideShape.closePath()
// Photo-guided panel divisions, not a surveyed pane count. All panels share
// the existing single transparent draw, with small gaps along the incline.
const foyerStairGlassShapes = Array.from({ length: 3 }, (_, index) => {
  const start = index / 3 + .003, end = (index + 1) / 3 - .003
  const atX = (along: number) => foyerStair.minX + along * (foyerStair.maxX - foyerStair.minX)
  const shape = new Shape()
  shape.moveTo(atX(start), start * foyerStair.rise + .17)
  shape.lineTo(atX(end), end * foyerStair.rise + .17)
  shape.lineTo(atX(end), end * foyerStair.rise + 1.14)
  shape.lineTo(atX(start), start * foyerStair.rise + 1.14)
  shape.closePath()
  return shape
})

// Per-instance colors retain the photographed light wall, dark columns, and
// warm counter distinctions without spending a draw call on every frontage.
const foyerLeftCorridorWallTone = (item: BoxInstance) => {
  const [x, , z] = item.position
  // Photos 07/08: the wall above the cafe-side doors continues the same
  // muted upper plane as the service window, rather than forming a white
  // tower between the two. The later door layout remains a V3 estimate.
  if (Math.abs(x - foyerRoute.aisleRightX) < .2 && z <= foyerRoute.partitionEndZ) return '#bab6b0'
  const besideLeftBranch = Math.abs(x - foyerRoute.aisleLeftX) < .2 && z >= foyerRoute.partitionStartZ
  const deeperLeftBranch = x < foyerRoute.aisleLeftX && z >= foyerRoute.leftBranchOpeningStartZ
  return besideLeftBranch || deeperLeftBranch ? '#d9cdbb' : '#dfded7'
}
const foyerPaleArchitecture: BoxInstance[] = [
  // Photo 01 has warm walls but a lighter, near-white ceiling. Keep both in
  // the same instance batch, without adding geometry or a second material.
  ...[...foyerPartitionWalls, ...foyerContinuationWalls]
    .map(item => ({ ...item, color: foyerLeftCorridorWallTone(item) })),
  ...foyerContinuationCeiling.map(item => ({ ...item, color: '#f3efe6' })),
  ...foyerMainHallWallStrips.map(item => ({ ...item, color: '#dfded7' })),
  ...foyerGuardRoomShell.map(item => ({ ...item, color: '#d8d6cf' })),
  // Photos 07/08: the tall wall around the cafe glazing is a subdued warm
  // grey, distinct from the bright service-room recess and corridor walls.
  ...foyerServiceSurround.map(item => ({ ...item, color: '#bab6b0' })),
  ...foyerBranchSkirting,
  ...foyerBranchDoorReveals.map((item, index) => ({ ...item,
    color: index < foyerRoute.leftBranchRoomDoors.length * 2 ? '#b2a48c' : item.color })),
  ...foyerServiceRecess.map((item, index) => ({ ...item, color: index === 0 ? '#d4c7b6' : '#eee9df' })),
  // Photo 09: the two main-hall banks sit below a shadowed soffit, but
  // their low separating jamb is pale plaster, not a full charcoal pier.
  // The tall structural piers retain their photographed dark finish.
  ...foyerLeftDoorSoffit.map(item => ({ ...item, color: '#69716e' })),
  ...foyerLeftDoorSoffitFascia.map(item => ({ ...item, color: '#d1cec6' })),
  ...foyerLeftDoorDivider.map(item => ({ ...item, color: '#cbc7bd' })),
  ...foyerMainHallUpperWall,
  // Opaque fallback keeps the opening calm until the photo crop is decoded.
  { position: [leftBranchWindow.centerX, (leftBranchWindow.sillY + leftBranchWindow.headY) / 2, 13.40],
    scale: [leftBranchWindow.width, leftBranchWindow.headY - leftBranchWindow.sillY, .02], color: '#c9dce1' },
]
const foyerDarkArchitecture: BoxInstance[] = [
  ...foyerGuardRoomInterior,
  ...foyerPerimeterColumns.map(item => ({ ...item, color: '#343b3b' })),
  ...foyerStairEndPier.map(item => ({ ...item, color: '#343b3b' })),
  ...foyerStairBackWall.map(item => ({ ...item, color: '#aaa7a1' })),
  ...foyerFarCrossWall.map(item => ({ ...item, color: '#85817b' })),
  ...foyerServiceWall.map(item => ({ ...item, color: '#303536' })),
  ...foyerServiceBackHatch,
  ...foyerMainHallThresholdRecess,
  ...foyerServiceAdjacentDoorBay.map(item => ({ ...item, color: '#303536' })),
  ...foyerDoorRecesses.slice(foyerRoute.leftDoorBanks.length).map(item => ({ ...item, color: '#343a3b' })),
  ...foyerCeilingSlots.map(item => ({ ...item, color: '#282e30' })),
  ...foyerStairDarkwork,
  ...foyerLeftBranchWindowFrames,
]
const foyerWoodwork: FoyerWelcomePart[] = [
  ...foyerGuardRoomCounter,
  // The photo-backed pale cabinet doors and light rear worktop carry their
  // own colours; only the uncoloured service counter uses the wood default.
  ...foyerServiceCounter.map(item => ({ ...item, color: item.color ?? '#a38b70' })),
  ...foyerLeftDoorTimber.map(item => ({ ...item, color: '#75604b' })),
  ...foyerMainHallTimberFrontage,
  ...foyerMainHallTimberJoints,
  ...foyerMainHallThresholdFloor,
  // Photo 09's slim pale-grey top and light metal legs. This is a visual
  // estimate, not a claim about the actual table's manufacturer or dimensions.
  ...foyerWelcomeTableFrame.map((item, index) => ({ ...item, color: index === 0 ? '#b8bab4' : '#c8cac2' })),
  ...foyerWelcomeBrochures.map(item => ({ ...item, color: '#f4efe2' })),
  ...foyerWelcomeBrochureCovers,
  ...foyerWelcomeBanner,
  ...foyerWelcomeTableDisplay,
  ...foyerLeftBranchSafety,
  ...foyerFarCabinetWoodwork,
  ...foyerFarWallCross,
]
const foyerLightPanels: BoxInstance[] = [
  ...foyerServiceInteriorLights.map(item => ({ ...item, color: '#fff1d8' })),
]
const foyerDoorLeaves: BoxInstance[] = foyerSanctuaryDoors.map((item, index) => ({
  ...item,
  // Photo 09 shows pale neutral-grey opaque leaves beneath the shaded soffit.
  // Keep their base finish distinct from the dark structural piers: painting
  // the left leaves charcoal confused them with the cafe-side frontage.
  // Photo 07/08 and owner review confirm the cafe-adjacent pair is charcoal.
  color: index < foyerLeftDoorLeafCount ? '#97978f'
    : '#464b4a',
}))
const foyerAllDoorLeaves: BoxInstance[] = [
  ...foyerGuardRoomDoor,
  ...foyerBranchRoomDoors.map((item, index) => ({ ...item,
    color: index < foyerRoute.leftBranchRoomDoors.length ? '#b5a68e' : '#d9d4c8' })),
  ...foyerLeftBranchEndDoor.map(item => ({ ...item, color: '#b5a68e' })),
  ...foyerDoorLeaves,
]
const foyerAllDoorPulls: BoxInstance[] = [
  ...foyerGuardRoomHardware,
  ...foyerBranchRoomHandles.map(item => ({ ...item, color: '#545d5d' })),
  ...foyerLeftBranchEndHandle.map(item => ({ ...item, color: '#545d5d' })),
  ...foyerDoorPulls.map(item => ({ ...item, color: item.color ?? '#5c6260' })),
  ...foyerBackDoorPulls.map(item => ({ ...item, color: '#d6d4c7' })),
  ...foyerDoorGlass.map((item, index) => ({ ...item,
    // Photo 08: the cafe-adjacent charcoal pair has bright, narrow vision lights.
    color: index < foyerLeftDoorLeafCount ? '#293330'
      : '#d5d9d3' })),
  ...foyerFarCabinetPulls,
]
const foyerAllDoorFrames: BoxInstance[] = [
  ...foyerGuardRoomFrames,
  ...foyerBranchRoomFrames.map((item, index) => ({ ...item,
    color: index < foyerRoute.leftBranchRoomDoors.length * 3 ? '#aa9b83' : '#7e817d' })),
  ...foyerLeftBranchEndFrames.map(item => ({ ...item, color: '#aa9b83' })),
  ...foyerDoorFrames.map((item, index) => ({ ...item,
    color: index < foyerRoute.leftDoorBanks.length * 4 ? '#c4c1b7' : '#303a3a' })),
  ...foyerBackDoorFrames.map(item => ({ ...item, color: '#303a3a' })),
  ...foyerServiceFrames.map(item => ({ ...item, color: '#181e20' })),
]

// Keep the existing one-draw-call leaf and hardware batches. Only the parts
// belonging to the two photographed left double doors swing about their
// jambs; the cafe-side doors and corridor room fronts stay fixed.
const createFoyerMainHallDoorWriter = (items: BoxInstance[]) => {
  const part = new Object3D()
  const moving = items.flatMap((item, index) => {
    const hinge = item.mainHallDoor
    if (!hinge) return []
    part.position.set(...item.position)
    part.rotation.set(...(item.rotation ?? [0, 0, 0]))
    part.scale.set(...item.scale)
    part.updateMatrix()
    return [{ index, hinge, base: part.matrix.clone(), toHinge: new Matrix4().makeTranslation(hinge.hingeX, 0, hinge.hingeZ), fromHinge: new Matrix4().makeTranslation(-hinge.hingeX, 0, -hinge.hingeZ) }]
  })
  const rotation = new Matrix4(), output = new Matrix4()
  const lastProgress = new WeakMap<InstancedMesh, number[]>()
  return (mesh: InstancedMesh | null, bank: number, progress: number) => {
    if (!mesh) return
    const previous = lastProgress.get(mesh) ?? [Number.NaN, Number.NaN]
    if (previous[bank] === progress) return
    previous[bank] = progress
    lastProgress.set(mesh, previous)
    for (const { index, hinge, base, toHinge, fromHinge } of moving) {
      if (hinge.bank !== bank) continue
      // Each leaf opens away from the foyer into the short transition recess.
      rotation.makeRotationY(hinge.leaf * progress * Math.PI * .44)
      output.copy(toHinge).multiply(rotation).multiply(fromHinge).multiply(base)
      mesh.setMatrixAt(index, output)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }
}
const writeFoyerMainHallLeaves = createFoyerMainHallDoorWriter(foyerAllDoorLeaves)
const writeFoyerMainHallHardware = createFoyerMainHallDoorWriter(foyerAllDoorPulls)

const FoyerMainHallDoorMotion = ({ leaves, hardware }: {
  leaves: MutableRefObject<InstancedMesh | null>
  hardware: MutableRefObject<InstancedMesh | null>
}) => {
  const centres = useMemo(() => foyerRoute.leftDoorBanks.map((_, index) => virtualChurchMainHallDoorReturnView(index).position), [])
  useAutomaticDoor('main-hall-1', [centres[0][0], centres[0][2]], 1.8, progress => {
    writeFoyerMainHallLeaves(leaves.current, 0, progress)
    writeFoyerMainHallHardware(hardware.current, 0, progress)
  })
  useAutomaticDoor('main-hall-2', [centres[1][0], centres[1][2]], 1.8, progress => {
    writeFoyerMainHallLeaves(leaves.current, 1, progress)
    writeFoyerMainHallHardware(hardware.current, 1, progress)
  })
  return null
}

const FoyerLuminaires = () => {
  const geometry = useMemo(() => createVirtualChurchFoyerLuminaireGeometry(foyerBranchCeilingLights, foyerLightPanels), [])
  useEffect(() => () => geometry?.dispose(), [geometry])
  return geometry
    ? <mesh name="vc:foyer-luminaires" geometry={geometry}><meshBasicMaterial vertexColors /></mesh>
    : <>
        <InstancedBoxSet name="vc:foyer-corridor-downlights" items={foyerBranchCeilingLights} color="#fff3d8" basic shape="downlight" />
        <InstancedBoxSet name="vc:foyer-light-panels" items={foyerLightPanels} color="#ffffff" basic />
      </>
}

const FoyerWovenPendants = () => {
  const geometry = useMemo(() => createVirtualChurchFoyerWickerGeometry(foyerPendantX, foyerPendantZ, foyerPendantCords), [])
  const material = useMemo(createVirtualChurchFoyerWickerMaterial, [])
  useEffect(() => () => { geometry?.dispose(); material.dispose() }, [geometry, material])
  return geometry ? <mesh name="vc:foyer-woven-pendant-fixtures" geometry={geometry} material={material} /> : null
}

const FOYER_OAK_BASECOLOR = '/virtual-church-assets/v3/foyer-oak-basecolor-v2.webp'
const foyerFloorContacts: FoyerFloorContact[] = [
  // Derive contacts from rendered feet, not the larger navigation bounds.
  ...foyerWelcomeTableFrame.slice(1).map(item => ({ x: item.position[0], z: item.position[2],
    halfX: item.scale[0] / 2, halfZ: item.scale[2] / 2, feather: .17, strength: .58 })),
  { x: welcomeTable.x, z: welcomeTable.z, halfX: .70, halfZ: .25, feather: .34, strength: .09 },
  ...VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS.map(pot => ({ x: pot.centerX, z: pot.centerZ,
    halfX: .18, halfZ: .18, feather: .30, strength: .42 })),
  { x: (foyerStair.minX + foyerStair.maxX) / 2, z: (foyerStair.minZ + foyerStair.maxZ) / 2,
    halfX: (foyerStair.maxX - foyerStair.minX) / 2, halfZ: (foyerStair.maxZ - foyerStair.minZ) / 2,
    feather: .28, strength: .40 },
  { x: VIRTUAL_CHURCH_FOYER_FAR_CABINET.centerX, z: VIRTUAL_CHURCH_FOYER_FAR_CABINET.centerZ,
    halfX: VIRTUAL_CHURCH_FOYER_FAR_CABINET.halfWidth, halfZ: VIRTUAL_CHURCH_FOYER_FAR_CABINET.halfDepth,
    feather: .24, strength: .27 },
]
const FoyerOakFloor = ({ onReady }: { onReady: (ready: boolean) => void }) => {
  const geometry = useMemo(() => addVirtualChurchFoyerContactUV(createVirtualChurchFoyerOakFloorGeometry()), [])
  const contactMask = useMemo(() => createVirtualChurchFoyerContactMask(foyerFloorContacts), [])
  const [texture, setTexture] = useState<Texture | null>(null)
  const material = useMemo(() => texture ? createVirtualChurchFoyerFloorMaterial(texture, contactMask) : null, [texture, contactMask])
  useEffect(() => {
    let active = true
    onReady(false)
    const loaded = new TextureLoader().load(FOYER_OAK_BASECOLOR, (result) => {
      if (!active) { result.dispose(); return }
      result.colorSpace = SRGBColorSpace
      result.anisotropy = perfConfig.isMobile ? 2 : 4
      result.needsUpdate = true
      setTexture(result)
    }, undefined, () => { if (active) { setTexture(null); onReady(true) } })
    return () => { active = false; loaded.dispose() }
  }, [onReady])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => contactMask.dispose(), [contactMask])
  useEffect(() => () => material?.dispose(), [material])
  return material ? <PreparedFoyerSurface onReady={onReady}><mesh name="vc:foyer-oak-floor" geometry={geometry} receiveShadow>
    <primitive object={material} attach="material" />
  </mesh></PreparedFoyerSurface> : null
}

const FoyerAcousticExtension = () => {
  const ceiling = foyerContinuationCeiling[0]
  const material = useMemo(() => createVirtualChurchFoyerExtensionCeilingMaterial(ceiling.scale[0], ceiling.scale[2]), [ceiling])
  useEffect(() => () => material.dispose(), [material])
  return <mesh name="vc:foyer-acoustic-ceiling" position={[ceiling.position[0], ceiling.position[1] - ceiling.scale[1] / 2 - .004, ceiling.position[2]]} rotation={[Math.PI / 2, 0, 0]}>
    <planeGeometry args={[ceiling.scale[0], ceiling.scale[2]]} />
    <primitive object={material} attach="material" />
  </mesh>
}

// Photo 01's five downlights softly wash the otherwise plain left corridor wall.
// One transparent plane adds no downloaded texture or five extra light passes.
const FoyerLeftCorridorWallWash = () => {
  const width = foyerRoute.aisleLeftX - foyerRoute.branchLeftX
  const material = useMemo(() => {
    const result = new MeshBasicMaterial({ color: '#fff1d2', transparent: true, opacity: .26, depthWrite: false })
    result.onBeforeCompile = shader => {
      shader.vertexShader = `varying vec2 vCorridorWashUV;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nvCorridorWashUV = uv;')
      shader.fragmentShader = `varying vec2 vCorridorWashUV;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 wallPoint = vec2(vCorridorWashUV.x * ${width.toFixed(3)}, vCorridorWashUV.y * 2.8);
        float wash = 0.0;
        ${[.7, 2.3, 3.9, 5.5, 7.1].map(offset => `wash = max(wash, 1.0 - smoothstep(.12, 1.0, length(vec2((wallPoint.x - ${offset}) / .86, (wallPoint.y - 2.10) / 1.05))));`).join('\n')}
        diffuseColor.a *= wash;
      `)
    }
    result.customProgramCacheKey = () => 'foyer-left-corridor-wall-wash-v1'
    return result
  }, [width])
  useEffect(() => () => material.dispose(), [material])
  return <mesh name="vc:foyer-left-corridor-wall-wash" position={[
    (foyerRoute.branchLeftX + foyerRoute.aisleLeftX) / 2, 1.4, foyerRoute.leftBranchOpeningStartZ + .084,
  ]}>
    <planeGeometry args={[width, 2.8]} />
    <primitive object={material} attach="material" />
  </mesh>
}

const FoyerStair = () => {
  const handrailMaterial = useMemo(createVirtualChurchFoyerHandrailMaterial, [])
  const material = useMemo(() => {
    const result = createVirtualChurchFoyerInteriorMaterial(.88, true, foyerStair.minZ - .015)
    result.color.set('#464c4a')
    result.side = DoubleSide
    return result
  }, [])
  useEffect(() => () => { material.dispose(); handrailMaterial.dispose() }, [material, handrailMaterial])
  return <group name="vc:foyer-stair-photo-candidate">
  <mesh name="vc:foyer-stair-metal-handrail" position={foyerStairRailPosition}
    rotation={[0, 0, foyerStairRailAngle - Math.PI / 2]}>
    <cylinderGeometry args={[.02, .02, foyerStairRailLength, 12]} />
    <primitive object={handrailMaterial} attach="material" />
  </mesh>
  <mesh name="vc:foyer-stair-undercroft" position={[0, 0, foyerStair.minZ - .015]} receiveShadow>
    <shapeGeometry args={[foyerStairSideShape]} />
    <primitive object={material} attach="material" />
  </mesh>
  <mesh name="vc:foyer-stair-glass-balustrade" position={[0, 0, foyerStair.minZ - .035]}>
    <shapeGeometry args={[foyerStairGlassShapes]} />
    <meshStandardMaterial color="#d9e0dc" roughness={.12} metalness={0} transparent opacity={.09} depthWrite={false} side={DoubleSide} />
  </mesh>
</group>
}

// A lightly arched leaf catches foyer light without a texture or another
// material. One small source mesh is instanced for both photographed plants.
const FoyerStairPlanters = () => {
  const stems = useRef<InstancedMesh>(null)
  const leaves = useRef<InstancedMesh>(null)
  const leafGeometry = useMemo(createVirtualChurchFoyerPlanterLeafGeometry, [])
  const potGeometry = useMemo(() => createVirtualChurchFoyerPlanterPotGeometry(VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS, VIRTUAL_CHURCH_FOYER_FLOOR.boardY), [])
  useEffect(() => () => { leafGeometry.dispose(); potGeometry?.dispose() }, [leafGeometry, potGeometry])
  useLayoutEffect(() => {
    if (!stems.current || !leaves.current) return
    writeVirtualChurchFoyerPlanterInstances(stems.current, leaves.current, VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS, VIRTUAL_CHURCH_FOYER_FLOOR.boardY)
  }, [])
  return <group name="vc:foyer-stair-planters">
    {potGeometry ? <mesh name="vc:foyer-planter-pots" geometry={potGeometry} receiveShadow>
      <meshStandardMaterial vertexColors color="#ffffff" roughness={.88} />
    </mesh> : null}
    <instancedMesh ref={stems} args={[undefined, undefined, VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS.length]}>
      <cylinderGeometry args={[.025, .038, .56, 6]} />
      <meshStandardMaterial color="#38573d" roughness={.9} />
    </instancedMesh>
    <instancedMesh ref={leaves} args={[undefined, undefined, VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS.length * FOYER_PLANTER_LEAVES_PER_POT]}>
      <primitive object={leafGeometry} attach="geometry" />
      <meshStandardMaterial color="#ffffff" roughness={.75} side={DoubleSide} />
    </instancedMesh>
  </group>
}

const FoyerCafeEquipment = () => {
  const geometry = useMemo(() => createVirtualChurchFoyerCafeEquipmentGeometry(foyerServiceEquipment), [])
  useEffect(() => () => geometry?.dispose(), [geometry])
  return geometry ? <mesh name="vc:foyer-service-equipment" geometry={geometry}>
    <meshStandardMaterial vertexColors color="#ffffff" roughness={.55} metalness={.16} />
  </mesh> : null
}

const FoyerWoodwork = () => {
  const geometry = useMemo(() => createVirtualChurchFoyerWoodworkGeometry(foyerWoodwork), [])
  useEffect(() => () => geometry?.dispose(), [geometry])
  return geometry ? <mesh name="vc:foyer-woodwork" geometry={geometry}>
    <meshStandardMaterial vertexColors color="#ffffff" roughness={.8} />
  </mesh> : null
}

const FoyerCirculationLayer = ({ loadCourtyardPhotos, onFloorReady }: { loadCourtyardPhotos: boolean; onFloorReady: (ready: boolean) => void }) => {
  const leaves = useRef<InstancedMesh>(null)
  const hardware = useRef<InstancedMesh>(null)
  const architectureMaterials = useMemo(() => [
    createVirtualChurchFoyerInteriorMaterial(.87),
    createVirtualChurchFoyerInteriorMaterial(.86, true),
  ], [])
  useEffect(() => () => architectureMaterials.forEach(material => material.dispose()), [architectureMaterials])
  return <group name="vc:foyer-circulation-candidate">
  <FoyerOakFloor onReady={onFloorReady} />
  <InstancedBoxSet name="vc:foyer-pale-architecture" items={foyerPaleArchitecture} color="#ffffff" material={architectureMaterials[0]} receiveShadow />
  <FoyerLuminaires />
  <FoyerLeftCorridorWallWash />
  <InstancedBoxSet name="vc:foyer-dark-architecture" items={foyerDarkArchitecture} color="#ffffff" material={architectureMaterials[1]} receiveShadow />
  <FoyerWoodwork />
  <FoyerCafeEquipment />
  <FoyerAcousticExtension />
  <FoyerStair />
  <FoyerStairPlanters />
  <FoyerWovenPendants />
  <InstancedBoxSet name="vc:foyer-door-leaves" items={foyerAllDoorLeaves} color="#ffffff" roughness={.76} instanceRef={leaves} />
  <InstancedBoxSet name="vc:foyer-door-frames" items={foyerAllDoorFrames} color="#ffffff" roughness={.65} />
  <InstancedBoxSet name="vc:foyer-door-pulls-and-vision-panels" items={foyerAllDoorPulls} color="#ffffff" roughness={.4} metalness={.2} instanceRef={hardware} />
  <FoyerMainHallDoorMotion leaves={leaves} hardware={hardware} />
  {loadCourtyardPhotos ? <>
    <Suspense fallback={null}><FoyerCourtyardPhoto /></Suspense>
    <Suspense fallback={null}><FoyerSideCourtyardPhoto /></Suspense>
  </> : null}
  <InstancedBoxSet name="vc:foyer-daylit-end-glazing" items={foyerGlazingPanels} color="#e4f2ef" basic opacity={.12} />
</group>
}

const FoyerDetailLayer = ({ showFlags, onReady }: { showFlags: boolean; onReady: (ready: boolean) => void }) => {
  // This subtree arrives after the church GLTF was prepared. Prepare its own
  // committed materials, including instance colours, before the first reveal.
  const group = useMemo(() => { const result = new ThreeGroup(); result.name = 'vc:foyer-detail-lod'; return result }, [])
  const prepared = usePreparedReviewAsset(group, true, true, true, 'foyer')
  const [floorPrepared, setFloorPrepared] = useState(false)
  useEffect(() => { onReady(prepared && floorPrepared) }, [onReady, prepared, floorPrepared])
  const entranceWorldPosition = useMemo(() => new Vector3(), [])
  const [loadCourtyardPhotos, setLoadCourtyardPhotos] = useState(false)
  const courtyardPhotosRequested = useRef(false)
  useFrame(({ camera }) => {
    group.getWorldPosition(entranceWorldPosition)
    const cameraIsInsideFoyer = virtualChurchWorldCameraIsInsideFoyer(camera.position.x, camera.position.z)
    if (!courtyardPhotosRequested.current && virtualChurchShouldLoadFoyerPhotos(
      camera.position.x,
      camera.position.z,
      entranceWorldPosition.x,
      entranceWorldPosition.z,
      cameraIsInsideFoyer,
    )) {
      courtyardPhotosRequested.current = true
      setLoadCourtyardPhotos(true)
    }
    group.visible = prepared && virtualChurchShouldRenderFoyerDetail(
      perfConfig.isMobile,
      camera.position.x,
      camera.position.z,
      entranceWorldPosition.x,
      entranceWorldPosition.z,
      cameraIsInsideFoyer,
    )
  })
  return <primitive object={group} visible={prepared}>
    {showFlags ? <FoyerFlagLayer /> : null}
    <FoyerCirculationLayer loadCourtyardPhotos={loadCourtyardPhotos} onFloorReady={setFloorPrepared} />
  </primitive>
}

const ChurchBuilding = ({ visualVersion, showFoyerFlags }: { visualVersion: VirtualChurchVisualVersion; showFoyerFlags: boolean }) => {
  const [heroAssetReady, setHeroAssetReady] = useState(false)
  const [foyerPrepared, setFoyerPrepared] = useState(false)
  const fallbackLeftDoor = useRef<Group>(null)
  const fallbackRightDoor = useRef<Group>(null)
  useAutomaticDoor('entrance-fallback', CHURCH_AUTOMATIC_DOOR.source, 5, progress => {
    if (fallbackLeftDoor.current) fallbackLeftDoor.current.position.x = -CHURCH_AUTOMATIC_DOOR.travel * progress
    if (fallbackRightDoor.current) fallbackRightDoor.current.position.x = CHURCH_AUTOMATIC_DOOR.travel * progress
  }, !heroAssetReady)
  const v3AccentTreatment = ALIFE_V3_SCENE_TREATMENT.accent
  // The signed elevation is the north-west end beside the incoming driveway.
  // It was previously placed on the opposite (north-east) end of the footprint.
  const streetFacadeStart = BUILDING_FOOTPRINT[15]
  const streetFacadeEnd = BUILDING_FOOTPRINT[0]
  const streetDx = streetFacadeEnd[0] - streetFacadeStart[0]
  const streetDz = streetFacadeEnd[1] - streetFacadeStart[1]
  const streetLength = Math.hypot(streetDx, streetDz)
  const streetAngle = -Math.atan2(streetDz, streetDx)
  const streetOutward: [number, number] = [streetDz / streetLength, -streetDx / streetLength]
  const streetOffset = (distance: number): [number, number] => [streetOutward[0] * distance, streetOutward[1] * distance]
  const streetInsetStart: [number, number] = [
    streetFacadeStart[0] + streetDx * 0.38,
    streetFacadeStart[1] + streetDz * 0.38,
  ]
  // The main public entrance occupies the short facade at the far end of the
  // auditorium parking wall (edge 4 -> 5), as confirmed by both entrance photos.
  // Keeping it as a single local facade group also provides a stable transform
  // for cutting the doorway through to a future walkable interior.
  const entranceStart = BUILDING_FOOTPRINT[4]
  const entranceEnd = BUILDING_FOOTPRINT[5]
  const entranceDx = entranceEnd[0] - entranceStart[0]
  const entranceDz = entranceEnd[1] - entranceStart[1]
  const entranceLength = Math.hypot(entranceDx, entranceDz)
  const entranceAngle = -Math.atan2(entranceDz, entranceDx)
  const entranceMid: [number, number] = [(entranceStart[0] + entranceEnd[0]) / 2, (entranceStart[1] + entranceEnd[1]) / 2]
  // Calibrate the complete parking elevation as one local facade. In the real
  // photograph the cedar portal sits in front of both the auditorium and the
  // double-height foyer; those rear volumes overlap it instead of starting at
  // either end of the timber box.
  const facadeRight = entranceLength / 2
  const foyerWidth = 15
  const foyerStart = facadeRight - foyerWidth
  const foyerEnd = facadeRight
  const foyerCentre = (foyerStart + foyerEnd) / 2
  const cedarWidth = 18
  const cedarEnd = foyerStart + 4.2
  const cedarStart = cedarEnd - cedarWidth
  const cedarCentre = (cedarStart + cedarEnd) / 2
  const cedarProjection = 2.7
  // Cover the complete omitted OSM parking edge. The previous 21 m panel
  // stopped almost five metres short and exposed the sky at the street corner.
  const auditoriumWidth = 26
  const auditoriumEnd = cedarStart + 9.4
  const auditoriumStart = auditoriumEnd - auditoriumWidth
  const auditoriumUpperBaseY = 2.35
  const auditoriumRibCount = Math.ceil(auditoriumWidth / 0.4)
  const lowerAuditoriumWidth = cedarStart - auditoriumStart + 0.35
  const lowerAuditoriumCentre = auditoriumStart + lowerAuditoriumWidth / 2
  const lowerWindowStart = cedarStart - 5.2
  const lowerWindowEnd = cedarStart - 0.2
  const lowerWindowCount = 3
  const entranceLocalToSource = (x: number, z = 0): [number, number] => [
    entranceMid[0] + Math.cos(entranceAngle) * x + Math.sin(entranceAngle) * z,
    entranceMid[1] - Math.sin(entranceAngle) * x + Math.cos(entranceAngle) * z,
  ]
  const roofHeightAtEntranceLocal = (x: number, z = 0) => roofHeightAtVertex(entranceLocalToSource(x, z))
  const auditoriumTopStart = roofHeightAtEntranceLocal(auditoriumStart, -0.2) - 0.12
  const auditoriumTopEnd = roofHeightAtEntranceLocal(auditoriumEnd, -0.2) - 0.12

  // The photograph shows one broad recessed portal, not one door bank filling
  // the cedar opening. Cross-checking the straight-on and oblique photographs
  // puts its edges at roughly 30% and 98% of the timber volume.
  const recessWidth = cedarWidth * 0.68
  const recessCentre = cedarStart + cedarWidth * 0.64
  const recessStart = recessCentre - recessWidth / 2
  const recessEnd = recessCentre + recessWidth / 2
  const recessHeight = CHURCH_DIMENSIONS.entranceDoorHeight
  const leftCedarPierWidth = recessStart - cedarStart
  const rightCedarPierWidth = cedarEnd - recessEnd
  const cedarSpandrelHeight = CHURCH_DIMENSIONS.timberEntranceHeight - recessHeight

  // Inside the recess: fixed glazing and a ribbed wall, four normal door
  // leaves, a white pier, then the dark return bay visible at the far right.
  const entrancePanelCount = 4
  const entrancePanelWidth = CHURCH_DIMENSIONS.entranceDoorWidth
  const doorBankWidth = entrancePanelCount * entrancePanelWidth
  const doorBankStart = recessStart + recessWidth * 0.315
  const doorBankEnd = doorBankStart + doorBankWidth
  const doorBankCentre = (doorBankStart + doorBankEnd) / 2
  const leftRecessWidth = doorBankStart - recessStart
  const fixedGlassWidth = leftRecessWidth * 0.34
  const ribbedWallWidth = leftRecessWidth - fixedGlassWidth
  const whitePierWidth = recessWidth * 0.1
  const whitePierStart = doorBankEnd
  const whitePierEnd = whitePierStart + whitePierWidth
  const darkReturnWidth = Math.max(0.2, recessEnd - whitePierEnd)
  const darkReturnCentre = whitePierEnd + darkReturnWidth / 2

  const leftCedarBoardCount = Math.max(2, Math.ceil(leftCedarPierWidth / 0.42))
  const rightCedarBoardCount = Math.max(2, Math.ceil(rightCedarPierWidth / 0.42))
  const upperCedarBoardCount = Math.max(4, Math.ceil(recessWidth / 0.42))
  // The cedar face projects 2.7 m. In the real building the complete rear
  // elevation sits close to the original wall line, about 1.9 m behind the
  // portal mouth. Keeping every rear element on this one datum removes the
  // offset frames and restores the visible jamb/soffit depth.
  const cedarFrontFaceZ = -cedarProjection - 0.12
  const portalMouthZ = -cedarProjection + 0.12
  const rearPanelZ = -0.62
  const rearFacadeFaceZ = rearPanelZ - 0.08
  const entranceDoorPanelZ = rearFacadeFaceZ - 0.035
  const entranceDoorFrameZ = entranceDoorPanelZ - 0.025
  const entranceDoorHandleZ = entranceDoorPanelZ - 0.115
  const portalLiningBackZ = rearFacadeFaceZ - 0.01
  const portalLiningDepth = portalLiningBackZ - portalMouthZ
  const portalLiningCentreZ = (portalMouthZ + portalLiningBackZ) / 2
  const entranceFrameWidth = 0.07
  const entranceFrameDepth = 0.16
  const entranceFrameBottomY = entranceFrameWidth / 2
  const entranceFrameTopY = recessHeight - entranceFrameWidth / 2
  const entranceFrameHeight = recessHeight - entranceFrameWidth * 2
  const entranceFrameCentreY = recessHeight / 2
  const entranceGlazingHeight = recessHeight - 0.16
  const entranceGlazingCentreY = recessHeight / 2
  // The released GLB now contains a shallow foyer behind the door plane. Keep
  // its single existing accent light inside that volume; the former negative-Z
  // position illuminated the exterior apron used by the old warm backdrops.
  const heroInteriorLightZ = 2.8
  const fixedPaneFrameXs = [
    recessStart + entranceFrameWidth / 2,
    recessStart + fixedGlassWidth - entranceFrameWidth / 2,
  ]
  const doorFrameXs = [
    doorBankStart + entranceFrameWidth / 2,
    ...Array.from({ length: entrancePanelCount - 1 }, (_, index) => doorBankStart + (index + 1) * entrancePanelWidth),
    doorBankEnd - entranceFrameWidth / 2,
  ]
  const rearCedarBoardCount = Math.max(3, Math.ceil(ribbedWallWidth / 0.36))
  const foyerWhiteWallWidth = foyerWidth * 0.39
  const foyerGlassStart = foyerStart + 0.34
  const foyerGlassEnd = foyerEnd - foyerWhiteWallWidth
  const foyerGlassWidth = foyerGlassEnd - foyerGlassStart
  const foyerGlassCentre = (foyerGlassStart + foyerGlassEnd) / 2
  const foyerWhiteWallCentre = (foyerGlassEnd + foyerEnd) / 2
  // Keep glazing behind the opaque casing instead of sharing its front plane.
  // This small, real-world reveal prevents the white wall/glass z-fighting.
  const foyerGlassZ = -0.2
  const foyerBandZ = -0.21
  const foyerFrameZ = -0.39
  const foyerWallZ = -0.14
  const lowerFoyerGlassHeight = 2.35
  const foyerBandHeight = 1.45
  const upperFoyerGlassHeight = CHURCH_DIMENSIONS.foyerHeight - lowerFoyerGlassHeight - foyerBandHeight - 0.45
  const interiorMinX = recessStart + 0.12
  const interiorMaxX = foyerGlassEnd + 0.5
  const interiorWidth = interiorMaxX - interiorMinX
  const interiorCentreX = (interiorMinX + interiorMaxX) / 2
  const interiorFrontZ = rearFacadeFaceZ + 0.18
  const interiorBackZ = 6.4
  const interiorDepth = interiorBackZ - interiorFrontZ
  const interiorCentreZ = (interiorFrontZ + interiorBackZ) / 2
  const interiorHeight = 6.05
  const interiorFeatureWidth = Math.min(5.8, interiorWidth * 0.56)
  const interiorHeaderWidth = Math.min(6.6, interiorWidth * 0.64)
  const interiorColumnOffset = Math.min(3.5, interiorWidth * 0.34)
  const streetSoffitOffset = streetOffset(0.62)
  const soffitCenterX = (streetInsetStart[0] + streetFacadeEnd[0]) / 2 + streetSoffitOffset[0]
  const soffitCenterZ = (streetInsetStart[1] + streetFacadeEnd[1]) / 2 + streetSoffitOffset[1]
  const soffitY = roofHeightAtVertex([soffitCenterX, soffitCenterZ]) - 0.15
  const soffitWidth = Math.hypot(streetFacadeEnd[0] - streetInsetStart[0], streetFacadeEnd[1] - streetInsetStart[1])
  const entryLouvreWidth = foyerStart - auditoriumEnd
  const entryLouvreCentre = (auditoriumEnd + foyerStart) / 2
  const entryLouvreTop = roofHeightAtEntranceLocal(entryLouvreCentre, -0.05) - 0.12
  const entryLouvreBackingHeight = Math.max(0.2, entryLouvreTop - recessHeight)
  const streetShellOffset = streetOffset(0.36)
  const streetCladdingOffset = streetOffset(0.62)
  const streetInsetOffset = streetOffset(0.72)
  const streetFinOffset = streetOffset(0.84)
  const streetFins: BoxInstance[] = Array.from({ length: 12 }, (_, index) => {
    const t = (index + 0.5) / 12
    const finX = streetInsetStart[0] + (streetFacadeEnd[0] - streetInsetStart[0]) * t + streetFinOffset[0]
    const finZ = streetInsetStart[1] + (streetFacadeEnd[1] - streetInsetStart[1]) * t + streetFinOffset[1]
    const finHeight = roofHeightAtVertex([finX, finZ]) - 0.3
    return { position: [finX, finHeight / 2, finZ], rotation: [0, streetAngle, 0], scale: [0.18, finHeight, 1.05] }
  })
  const streetSignOffset = streetOffset(0.62)
  // Ribs extend to 0.65 m; the old coplanar wordmark lost strokes behind them.
  const streetWordmarkOffset = streetOffset(0.67)
  const auditoriumRibs: BoxInstance[] = Array.from({ length: auditoriumRibCount }, (_, index) => {
    const x = auditoriumStart + (index + 0.5) * auditoriumWidth / auditoriumRibCount
    const ribTop = roofHeightAtEntranceLocal(x, -0.42) - 0.18
    const ribHeight = Math.max(0.2, ribTop - auditoriumUpperBaseY)
    return {
      position: [x, auditoriumUpperBaseY + ribHeight / 2, -0.46],
      scale: [0.055, ribHeight, 0.06],
    }
  })
  const lightCedarBoards: BoxInstance[] = []
  const darkCedarBoards: BoxInstance[] = []
  const addCedarBoard = (item: BoxInstance, dark: boolean) => {
    ;(dark ? darkCedarBoards : lightCedarBoards).push(item)
  }
  Array.from({ length: leftCedarBoardCount }, (_, index) => {
    const x = cedarStart + (index + 0.5) * leftCedarPierWidth / leftCedarBoardCount
    addCedarBoard({
      position: [x, CHURCH_DIMENSIONS.timberEntranceHeight / 2, cedarFrontFaceZ - 0.06],
      scale: [0.035, CHURCH_DIMENSIONS.timberEntranceHeight - 0.08, 0.04],
    }, index % 2 === 0)
  })
  Array.from({ length: rightCedarBoardCount }, (_, index) => {
    const x = recessEnd + (index + 0.5) * rightCedarPierWidth / rightCedarBoardCount
    addCedarBoard({
      position: [x, CHURCH_DIMENSIONS.timberEntranceHeight / 2, cedarFrontFaceZ - 0.06],
      scale: [0.035, CHURCH_DIMENSIONS.timberEntranceHeight - 0.08, 0.04],
    }, index % 2 === 0)
  })
  Array.from({ length: upperCedarBoardCount }, (_, index) => {
    const x = recessStart + (index + 0.5) * recessWidth / upperCedarBoardCount
    addCedarBoard({
      position: [x, recessHeight + cedarSpandrelHeight / 2, cedarFrontFaceZ - 0.06],
      scale: [0.035, cedarSpandrelHeight - 0.08, 0.04],
    }, index % 3 === 0)
  })
  const entryLouvres: BoxInstance[] = Array.from({ length: 5 }, (_, index) => ({
    position: [entryLouvreCentre, 4.08 + index * 0.28, -0.64],
    scale: [entryLouvreWidth, 0.08, 0.2],
  }))
  const rearCedarRibs: BoxInstance[] = Array.from({ length: rearCedarBoardCount }, (_, index) => ({
    position: [
      recessStart + fixedGlassWidth + (index + 0.5) * ribbedWallWidth / rearCedarBoardCount,
      recessHeight / 2,
      rearFacadeFaceZ - 0.025,
    ],
    scale: [0.035, recessHeight - 0.08, 0.05],
  }))
  const entranceFrames: BoxInstance[] = [
    ...fixedPaneFrameXs.map((x) => ({
      position: [x, entranceFrameCentreY, entranceDoorFrameZ],
      scale: [entranceFrameWidth, entranceFrameHeight, entranceFrameDepth],
    } satisfies BoxInstance)),
    ...doorFrameXs.map((x) => ({
      position: [x, entranceFrameCentreY, entranceDoorFrameZ],
      scale: [entranceFrameWidth, entranceFrameHeight, entranceFrameDepth],
    } satisfies BoxInstance)),
    ...[entranceFrameBottomY, entranceFrameTopY].flatMap((y) => [
      {
        position: [recessStart + fixedGlassWidth / 2, y, entranceDoorFrameZ],
        scale: [fixedGlassWidth, entranceFrameWidth, entranceFrameDepth],
      } satisfies BoxInstance,
      {
        position: [doorBankCentre, y, entranceDoorFrameZ],
        scale: [doorBankWidth, entranceFrameWidth, entranceFrameDepth],
      } satisfies BoxInstance,
    ]),
  ]
  const foyerFrames: BoxInstance[] = [
    ...[0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      position: [foyerGlassStart + foyerGlassWidth * ratio, CHURCH_DIMENSIONS.foyerHeight / 2, foyerFrameZ],
      scale: [0.09, CHURCH_DIMENSIONS.foyerHeight - 0.5, 0.15],
    } satisfies BoxInstance)),
    ...[lowerFoyerGlassHeight, lowerFoyerGlassHeight + foyerBandHeight].map((y) => ({
      position: [foyerGlassCentre, y, foyerFrameZ],
      scale: [foyerGlassWidth, 0.09, 0.15],
    } satisfies BoxInstance)),
  ]

  return (
    <group name="vc:church">
      <SlopedRoofBuilding points={BUILDING_FOOTPRINT} omitParkingWalls />

      <FacadeSegment start={streetFacadeStart} end={streetFacadeEnd} height={9.85} y={4.98} color="#c4c8c8" depth={0.42} metalness={0.38} offset={streetShellOffset} />
      <CorrugatedFacade start={streetFacadeStart} end={streetFacadeEnd} height={9.65} y={4.98} offset={streetCladdingOffset} />
      <FacadeSegment start={streetInsetStart} end={streetFacadeEnd} height={9.05} y={4.7} color="#171d1f" depth={0.08} metalness={0.22} offset={streetInsetOffset} />
      {visualVersion === 'v3' ? (
        <InstancedBoxSet items={streetFins} color="#1a1e20" roughness={0.42} metalness={0.60} />
      ) : streetFins.map((fin, index) => (
          <mesh key={`front-fin-${index}`} position={fin.position} rotation={fin.rotation}>
            <boxGeometry args={fin.scale} />
            <meshStandardMaterial color="#1a1e20" roughness={0.42} metalness={0.60} />
          </mesh>
      ))}
      {/* Silver metal return above the recessed dark fins. */}
      <mesh
        position={[soffitCenterX, soffitY, soffitCenterZ]}
        rotation={[0, streetAngle, 0]}
        castShadow
      >
        <boxGeometry args={[soffitWidth, 0.4, 1.2]} />
        <meshStandardMaterial color="#d6d9d8" roughness={0.52} metalness={0.34} />
      </mesh>

      {/* Cross and bilingual wordmark confirmed by the supplied close photos. */}
      <group position={[streetFacadeStart[0] + streetDx * 0.19 + streetSignOffset[0], 5.35, streetFacadeStart[1] + streetDz * 0.19 + streetSignOffset[1]]} rotation={[0, streetAngle, 0]}>
        <mesh castShadow><boxGeometry args={[0.28, 4.45, 0.3]} /><meshStandardMaterial color="#d7d9d6" metalness={0.56} roughness={0.42} emissive={visualVersion === 'v3' ? v3AccentTreatment.cross.emissive : '#ffaa44'} emissiveIntensity={visualVersion === 'v3' ? v3AccentTreatment.cross.emissiveIntensity : 0.9} /></mesh>
        <mesh position={[0, 0.65, -0.03]} castShadow><boxGeometry args={[2.2, 0.28, 0.34]} /><meshStandardMaterial color="#4a4038" metalness={0.4} roughness={0.5} emissive={visualVersion === 'v3' ? v3AccentTreatment.cross.emissive : '#ffaa44'} emissiveIntensity={visualVersion === 'v3' ? v3AccentTreatment.cross.emissiveIntensity : 0.9} /></mesh>
      </group>
      {/* Cross halo - warm backlight projecting onto corrugated wall */}
      <pointLight
        position={[streetFacadeStart[0] + streetDx * 0.19 + streetSignOffset[0] - Math.sin(streetAngle) * 0.3, 5.35, streetFacadeStart[1] + streetDz * 0.19 + streetSignOffset[1] + Math.cos(streetAngle) * 0.3]}
        color={visualVersion === 'v3' ? v3AccentTreatment.cross.emissive : '#ffaa44'}
        intensity={visualVersion === 'v3' ? v3AccentTreatment.cross.lightIntensity : 5.0}
        distance={visualVersion === 'v3' ? v3AccentTreatment.cross.distance : 6}
        decay={2}
      />
      <ChurchFacadeSign position={[streetFacadeStart[0] + streetDx * 0.23 + streetWordmarkOffset[0], 2.02, streetFacadeStart[1] + streetDz * 0.23 + streetWordmarkOffset[1]]} rotation={Math.PI + streetAngle} visualVersion={visualVersion} />

      {/* Main entrance, facing the car park. Cedar portal is on the left and
          the double-height glazed foyer is on the right when viewed outside. */}
      <group
        position={[entranceMid[0], 0, entranceMid[1]]}
        rotation={[0, entranceAngle, 0]}
        visible={!heroAssetReady}
      >
        {/* Continuous rear auditorium elevation. The earlier OSM-edge pieces
            produced a floating silver wall and a false seven-door storefront.
            This single datum keeps the cladding, low wall and foyer aligned. */}
        <SlopedFacadeVolume
          x0={auditoriumStart}
          x1={auditoriumEnd}
          bottomY={auditoriumUpperBaseY}
          topY0={auditoriumTopStart}
          topY1={auditoriumTopEnd}
          z={-0.05}
          depth={0.7}
          color="#aeb4b4"
        />
        <InstancedBoxSet
          items={auditoriumRibs}
          color="#d8dcdb"
          roughness={0.45}
          metalness={0.48}
          castShadow
        />
        <mesh position={[lowerAuditoriumCentre, auditoriumUpperBaseY / 2, -0.1]} castShadow receiveShadow>
          <boxGeometry args={[lowerAuditoriumWidth, auditoriumUpperBaseY, 0.7]} />
          <meshStandardMaterial color="#77766f" roughness={0.84} metalness={0.08} />
        </mesh>
        {Array.from({ length: lowerWindowCount }, (_, index) => {
          const x = lowerWindowStart + (index + 0.5) * (lowerWindowEnd - lowerWindowStart) / lowerWindowCount
          const width = (lowerWindowEnd - lowerWindowStart) / lowerWindowCount - 0.16
          return (
            <mesh key={`parking-window-${index}`} position={[x, 1.28, -0.51]} castShadow>
              <boxGeometry args={[width, 1.62, 0.1]} />
              <meshPhysicalMaterial color="#52686a" roughness={0.18} metalness={0.18} clearcoat={0.35} {...GLASS_TRANSMISSION_PROPS} />
            </mesh>
          )
        })}

        {/* The cedar volume is assembled around the photographed broad recess. */}
        <mesh position={[(cedarStart + recessStart) / 2, CHURCH_DIMENSIONS.timberEntranceHeight / 2, -cedarProjection]} castShadow receiveShadow>
          <boxGeometry args={[leftCedarPierWidth, CHURCH_DIMENSIONS.timberEntranceHeight, 0.24]} />
          <meshStandardMaterial color="#b07848" roughness={0.86} />
        </mesh>
        <mesh position={[(recessEnd + cedarEnd) / 2, CHURCH_DIMENSIONS.timberEntranceHeight / 2, -cedarProjection]} castShadow receiveShadow>
          <boxGeometry args={[rightCedarPierWidth, CHURCH_DIMENSIONS.timberEntranceHeight, 0.24]} />
          <meshStandardMaterial color="#b07848" roughness={0.86} />
        </mesh>
        <mesh position={[recessCentre, recessHeight + cedarSpandrelHeight / 2, -cedarProjection]} castShadow receiveShadow>
          <boxGeometry args={[recessWidth, cedarSpandrelHeight, 0.24]} />
          <meshStandardMaterial color="#b07848" roughness={0.86} />
        </mesh>

        {/* Roof and end returns give the timber block its photographed depth. */}
        <mesh position={[cedarCentre, CHURCH_DIMENSIONS.timberEntranceHeight - 0.07, -cedarProjection / 2]} castShadow>
          <boxGeometry args={[cedarWidth, 0.22, cedarProjection]} />
          <meshStandardMaterial color="#9e673f" roughness={0.84} />
        </mesh>
        {[cedarStart, cedarEnd].map((x) => <mesh key={`cedar-end-return-${x}`} position={[x, CHURCH_DIMENSIONS.timberEntranceHeight / 2, -cedarProjection / 2]} castShadow><boxGeometry args={[0.22, CHURCH_DIMENSIONS.timberEntranceHeight, cedarProjection]} /><meshStandardMaterial color="#9e673f" roughness={0.84} /></mesh>)}

        {/* A real portal: two deep jambs, a low soffit and a concrete threshold
            connect the projecting timber face to the rear door elevation. */}
        {[recessStart + 0.09, recessEnd - 0.09].map((x) => (
          <mesh key={`portal-jamb-${x}`} position={[x, recessHeight / 2, portalLiningCentreZ]} castShadow receiveShadow>
            <boxGeometry args={[0.18, recessHeight, portalLiningDepth]} />
            <meshStandardMaterial color="#8f5c3b" roughness={0.9} side={DoubleSide} transparent={false} opacity={1} />
          </mesh>
        ))}
        <mesh position={[recessCentre, recessHeight + 0.09, portalLiningCentreZ]} castShadow receiveShadow>
          <boxGeometry args={[recessWidth - 0.18, 0.18, portalLiningDepth]} />
          <meshStandardMaterial color="#232728" roughness={0.78} side={DoubleSide} transparent={false} opacity={1} />
        </mesh>
        <mesh position={[recessCentre, 0.04, portalLiningCentreZ]} receiveShadow>
          <boxGeometry args={[recessWidth - 0.18, 0.08, portalLiningDepth]} />
          <meshStandardMaterial color="#696863" roughness={0.96} side={DoubleSide} transparent={false} opacity={1} />
        </mesh>
        {[-0.34, 0, 0.34].map((ratio) => (
          <group key={`portal-downlight-${ratio}`}>
            <mesh position={[recessCentre + recessWidth * ratio, recessHeight - 0.012, portalLiningCentreZ]}>
              <cylinderGeometry args={[0.055, 0.055, 0.018, 16]} />
              <meshStandardMaterial color="#fff4d8" emissive="#ffe5a8" emissiveIntensity={1.3} toneMapped={false} />
            </mesh>
          </group>
        ))}

        {/* Every rear element shares the same back-wall datum. The fixed pane,
            ribbed panel, doors, white pier and dark return are no longer pasted
            onto the timber face, so their frames cannot drift out of alignment. */}
        <mesh position={[recessStart + fixedGlassWidth / 2, entranceGlazingCentreY, entranceDoorPanelZ]} castShadow>
          <boxGeometry args={[fixedGlassWidth - 0.08, entranceGlazingHeight, 0.12]} />
          <meshPhysicalMaterial color="#52686a" roughness={0.18} metalness={0.18} clearcoat={0.35} {...GLASS_TRANSMISSION_PROPS} />
        </mesh>
        <mesh position={[recessStart + fixedGlassWidth + ribbedWallWidth / 2, recessHeight / 2, rearPanelZ]} castShadow receiveShadow>
          <boxGeometry args={[ribbedWallWidth, recessHeight, 0.16]} />
          <meshStandardMaterial color="#343638" roughness={0.72} metalness={0.18} />
        </mesh>
        <InstancedBoxSet items={rearCedarRibs} color="#5d6261" roughness={0.66} metalness={0.28} castShadow />
        {/* Four conventional door leaves form a compact 3.8 m bank. */}
        {[-1, 1].map(side => <group key={side} ref={side < 0 ? fallbackLeftDoor : fallbackRightDoor}>
        {Array.from({ length: entrancePanelCount }, (_, index) => {
          if ((index < 2 ? -1 : 1) !== side) return null
          const x = doorBankStart + (index + 0.5) * entrancePanelWidth
          return (
            <mesh key={`entrance-glass-panel-${index}`} position={[x, entranceGlazingCentreY, entranceDoorPanelZ]} castShadow>
              <boxGeometry args={[entrancePanelWidth - 0.075, entranceGlazingHeight, 0.12]} />
              <meshPhysicalMaterial color="#52686a" roughness={0.18} metalness={0.18} clearcoat={0.35} {...GLASS_TRANSMISSION_PROPS} />
            </mesh>
          )
        })}
        {[side < 0 ? 1 : 3].flatMap((boundary) => [-0.11, 0.11].map((offset) => (
          <mesh key={`entry-handle-${boundary}-${offset}`} position={[doorBankStart + boundary * entrancePanelWidth + offset, 1.24, entranceDoorHandleZ]}><boxGeometry args={[0.035, 0.62, 0.045]} /><meshStandardMaterial color="#c7cac7" metalness={0.82} roughness={0.26} /></mesh>
        )))}
        <InstancedBoxSet items={entranceFrames.slice(3, 6).flatMap(item => {
          const x = item.position[0]
          if (Math.abs(x - doorBankCentre) < .01) return [{ ...item, position: [x + side * entranceFrameWidth / 4, item.position[1], item.position[2]], scale: [entranceFrameWidth / 2, item.scale[1], item.scale[2]] } satisfies BoxInstance]
          return (x < doorBankCentre ? -1 : 1) === side ? [item] : []
        })} color="#242a2b" metalness={0.56} roughness={0.38} />
        </group>)}

        {/* White pier and dark return bay complete the right rear elevation. */}
        <mesh position={[(whitePierStart + whitePierEnd) / 2, recessHeight / 2, rearPanelZ]} castShadow receiveShadow>
          <boxGeometry args={[whitePierWidth, recessHeight, 0.16]} />
          <meshStandardMaterial color="#e8e5dc" roughness={0.76} />
        </mesh>
        <mesh position={[darkReturnCentre, recessHeight / 2, rearPanelZ]} castShadow receiveShadow>
          <boxGeometry args={[darkReturnWidth, recessHeight, 0.16]} />
          <meshStandardMaterial color="#171d1f" roughness={0.62} metalness={0.18} />
        </mesh>

        {/* The fixed pane and the four-leaf door bank are two complete frame
            systems. Their outer mullions sit wholly inside their own openings,
            so no frame overlaps the ribbed wall or white structural pier. */}
        <InstancedBoxSet items={entranceFrames.filter((_, index) => index < 3 || index > 5)} color="#242a2b" metalness={0.56} roughness={0.38} />

        {/* Vertical board joints are limited to the real cedar panels, so they
            no longer run across and visually fill the entrance opening. */}
        <InstancedBoxSet items={lightCedarBoards} color="#c18a60" roughness={0.94} />
        <InstancedBoxSet items={darkCedarBoards} color="#754830" roughness={0.94} />

        {/* Horizontal louvres visible above the entrance. The backing starts
            at the door head: extending it to ground level seals the real door
            opening even when the animated glass leaves are fully open. */}
        <mesh position={[entryLouvreCentre, recessHeight + entryLouvreBackingHeight / 2, -0.05]} castShadow receiveShadow>
          <boxGeometry args={[entryLouvreWidth, entryLouvreBackingHeight, 0.7]} />
          <meshStandardMaterial color="#252a2b" roughness={0.72} metalness={0.2} side={DoubleSide} transparent={false} opacity={1} />
        </mesh>
        <mesh position={[entryLouvreCentre, 4.65, -0.5]} castShadow><boxGeometry args={[entryLouvreWidth, 1.5, 0.16]} /><meshStandardMaterial color="#2c3233" roughness={0.58} metalness={0.28} /></mesh>
        <InstancedBoxSet items={entryLouvres} color="#666d6d" roughness={0.55} metalness={0.42} />

        {/* Opaque foyer shell behind the glazing. Photos 05-07 show a timber
            floor, white ceiling/walls, dark columns and a cedar feature wall.
            This five-sided volume blocks sky, roads and street lights while
            retaining deliberate glass reflections at the exterior facade. */}
        <mesh position={[interiorCentreX, 0.04, interiorCentreZ]} receiveShadow>
          <boxGeometry args={[interiorWidth, 0.08, interiorDepth]} />
          <meshStandardMaterial color="#b98a62" roughness={0.82} side={DoubleSide} transparent={false} opacity={1} />
        </mesh>
        <mesh position={[interiorCentreX, interiorHeight - 0.06, interiorCentreZ]} receiveShadow>
          <boxGeometry args={[interiorWidth, 0.12, interiorDepth]} />
          <meshStandardMaterial color="#eeeae1" roughness={0.9} side={DoubleSide} transparent={false} opacity={1} />
        </mesh>
        <mesh position={[interiorCentreX, interiorHeight / 2, interiorBackZ]} receiveShadow>
          <boxGeometry args={[interiorWidth, interiorHeight, 0.18]} />
          <meshStandardMaterial color="#e7e4dc" roughness={0.9} side={DoubleSide} transparent={false} opacity={1} />
        </mesh>
        {[interiorMinX, interiorMaxX].map((x) => (
          <mesh key={`foyer-interior-side-${x}`} position={[x, interiorHeight / 2, interiorCentreZ]} receiveShadow>
            <boxGeometry args={[0.18, interiorHeight, interiorDepth]} />
            <meshStandardMaterial color="#e7e4dc" roughness={0.9} side={DoubleSide} transparent={false} opacity={1} />
          </mesh>
        ))}
        <mesh position={[interiorCentreX, 1.25, interiorBackZ - 0.18]} castShadow receiveShadow>
          <boxGeometry args={[interiorFeatureWidth, 2.5, 0.14]} />
          <meshStandardMaterial color="#9a6037" roughness={0.88} />
        </mesh>
        <mesh position={[interiorCentreX, 4.25, interiorBackZ - 0.22]} castShadow receiveShadow>
          <boxGeometry args={[interiorHeaderWidth, 3.35, 0.24]} />
          <meshStandardMaterial color="#f1eee6" roughness={0.88} />
        </mesh>
        {[-interiorColumnOffset, interiorColumnOffset].map((offset) => (
          <mesh key={`foyer-column-${offset}`} position={[interiorCentreX + offset, interiorHeight / 2, 4]} castShadow receiveShadow>
            <boxGeometry args={[0.38, interiorHeight, 0.38]} />
            <meshStandardMaterial color="#25292a" roughness={0.74} />
          </mesh>
        ))}
        {[-0.22, 0.22].flatMap((xRatio) => [1.5, 3.7].map((z) => (
          <mesh key={`foyer-ceiling-light-${xRatio}-${z}`} position={[interiorCentreX + interiorWidth * xRatio, interiorHeight - 0.13, z]}>
            <boxGeometry args={[1.5, 0.035, 0.11]} />
            <meshStandardMaterial color="#fff5df" emissive="#fff5df" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
        )))}

        {/* The foyer is roughly half glazing and half solid white end wall.
            Its glass is split into lower panes, a deep dark band and upper panes. */}
        <mesh position={[foyerGlassCentre, lowerFoyerGlassHeight / 2, foyerGlassZ]} castShadow>
          <boxGeometry args={[foyerGlassWidth, lowerFoyerGlassHeight, 0.16]} />
          <meshPhysicalMaterial color="#52686a" roughness={0.18} metalness={0.18} clearcoat={0.35} {...GLASS_TRANSMISSION_PROPS} />
        </mesh>
        <mesh position={[foyerGlassCentre, lowerFoyerGlassHeight + foyerBandHeight / 2, foyerBandZ]} castShadow>
          <boxGeometry args={[foyerGlassWidth, foyerBandHeight, 0.2]} />
          <meshStandardMaterial color="#1a1e20" roughness={0.5} metalness={0.28} />
        </mesh>
        <mesh position={[foyerGlassCentre, lowerFoyerGlassHeight + foyerBandHeight + upperFoyerGlassHeight / 2, foyerGlassZ]} castShadow>
          <boxGeometry args={[foyerGlassWidth, upperFoyerGlassHeight, 0.16]} />
          <meshPhysicalMaterial color="#52686a" roughness={0.18} metalness={0.18} clearcoat={0.35} {...GLASS_TRANSMISSION_PROPS} />
        </mesh>
        <mesh position={[foyerWhiteWallCentre, CHURCH_DIMENSIONS.foyerHeight / 2, foyerWallZ]} castShadow receiveShadow>
          <boxGeometry args={[foyerWhiteWallWidth, CHURCH_DIMENSIONS.foyerHeight, 0.38]} />
          <meshStandardMaterial color="#efefeb" roughness={0.78} />
        </mesh>
        <mesh position={[foyerStart + 0.17, CHURCH_DIMENSIONS.foyerHeight / 2, foyerWallZ]} castShadow><boxGeometry args={[0.34, CHURCH_DIMENSIONS.foyerHeight, 0.36]} /><meshStandardMaterial color="#efefeb" roughness={0.78} /></mesh>
        <mesh position={[foyerCentre, CHURCH_DIMENSIONS.foyerHeight - 0.22, foyerWallZ]} castShadow><boxGeometry args={[foyerWidth, 0.44, 0.36]} /><meshStandardMaterial color="#efefeb" roughness={0.78} /></mesh>
        <mesh position={[foyerEnd - 0.12, CHURCH_DIMENSIONS.foyerHeight / 2, -0.35]} castShadow receiveShadow>
          <boxGeometry args={[0.24, CHURCH_DIMENSIONS.foyerHeight, 0.18]} />
          <meshStandardMaterial color="#efefeb" roughness={0.78} />
        </mesh>
        <mesh position={[foyerCentre, (CHURCH_DIMENSIONS.foyerHeight + CHURCH_DIMENSIONS.roofLowHeight) / 2, -0.26]} castShadow receiveShadow>
          <boxGeometry args={[foyerWidth, CHURCH_DIMENSIONS.roofLowHeight - CHURCH_DIMENSIONS.foyerHeight, 0.52]} />
          <meshStandardMaterial color="#efefeb" roughness={0.78} />
        </mesh>
        <InstancedBoxSet items={foyerFrames} color="#292f30" metalness={0.5} roughness={0.42} />

      </group>
      <pointLight
        position={(() => {
          const [x, z] = entranceLocalToSource(
            recessCentre,
            heroAssetReady ? heroInteriorLightZ : entranceDoorPanelZ + 0.5,
          )
          return [x, 2.5, z] as [number, number, number]
        })()}
        color={visualVersion === 'v3' ? v3AccentTreatment.entrance.color : ALIFE_LIGHTING.entrance.color}
        intensity={visualVersion === 'v3' ? v3AccentTreatment.entrance.intensity : ALIFE_LIGHTING.entrance.intensity}
        distance={visualVersion === 'v3' ? v3AccentTreatment.entrance.distance : ALIFE_LIGHTING.entrance.distance}
        decay={2}
      />
      <ChurchHeroAssetBoundary
        assetPath={CHURCH_HERO_ASSET_PATH}
        onFailure={() => setHeroAssetReady(false)}
      >
        <Suspense fallback={null}>
          <ChurchHeroAsset
            visualVersion={visualVersion}
            foyerPrepared={foyerPrepared}
            position={[entranceMid[0], 0, entranceMid[1]]}
            rotationY={entranceAngle}
            onReady={setHeroAssetReady}
          />
        </Suspense>
      </ChurchHeroAssetBoundary>
      {visualVersion === 'v3' && heroAssetReady ? (
        <group position={[entranceMid[0], 0, entranceMid[1]]} rotation={[0, entranceAngle, 0]}>
          <FoyerDetailLayer showFlags={showFoyerFlags} onReady={setFoyerPrepared} />
        </group>
      ) : null}
    </group>
  )
}

const FLAX_BLADES: Array<[number, number]> = [[0, 0.3], [0.9, 0.26], [1.8, 0.34], [2.7, 0.28], [3.6, 0.32], [4.5, 0.27], [5.4, 0.33]]

const FLAX_CLUSTER_OFFSETS: Array<[number, number, number]> = [
  [0, 0, 1],
  [-0.62, 0.12, 0.92],
  [0.62, -0.08, 0.96],
  [-1.08, -0.2, 0.82],
  [1.08, 0.22, 0.86],
  [-0.3, 0.66, 0.88],
  [0.34, -0.6, 0.84],
]

type PlantPlacement = {
  position: [number, number, number]
  scale?: number
  rotation?: number
  spread?: number
  cluster?: boolean
}

const PlantVisibilityPass = () => {
  const { scene } = useThree()
  useLayoutEffect(() => {
    const previous = scene.onBeforeRender
    const beforeRender: typeof scene.onBeforeRender = function (...args) {
      previous.apply(scene, args)
      // Scene callback runs after world/camera updates but BEFORE Three uploads
      // instance buffers. A mesh callback is too late and causes a stale frame.
      updateVirtualChurchPlantVisibility(scene, args[2])
    }
    scene.onBeforeRender = beforeRender
    return () => { if (scene.onBeforeRender === beforeRender) scene.onBeforeRender = previous }
  }, [scene])
  return null
}

const FlaxField = ({
  placements,
  visualVersion,
}: {
  placements: PlantPlacement[]
  visualVersion: VirtualChurchVisualVersion
}) => {
  const { scene } = useThree()
  const meshRef = useRef<InstancedMesh>(null)
  const instanceCount = placements.reduce(
    (total, placement) => total + (placement.cluster ? FLAX_CLUSTER_OFFSETS.length : 1) * FLAX_BLADES.length,
    0,
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const root = new Object3D()
    const blade = new Object3D()
    const matrix = new Matrix4()
    let instanceIndex = 0

    placements.forEach((placement) => {
      root.position.set(...placement.position)
      root.rotation.set(0, placement.rotation ?? 0, 0)
      root.scale.setScalar(placement.cluster ? 1 : (placement.scale ?? 1))
      root.updateMatrix()
      const offsets = placement.cluster ? FLAX_CLUSTER_OFFSETS : [[0, 0, 1] as [number, number, number]]
      offsets.forEach(([x, z, localScale], plantIndex) => {
        const plantScale = placement.cluster
          ? (placement.scale ?? 1) * localScale * (plantIndex % 2 === 0 ? 1.04 : 0.96)
          : 1
        FLAX_BLADES.forEach(([angle, tilt]) => {
          blade.position.set(x * (placement.spread ?? 1), 0.8 * plantScale, z * (placement.spread ?? 1))
          blade.rotation.set(
            tilt * Math.cos(angle),
            visualVersion === 'v3' ? angle : 0,
            tilt * Math.sin(angle),
          )
          blade.scale.setScalar(plantScale)
          blade.updateMatrix()
          matrix.multiplyMatrices(root.matrix, blade.matrix)
          mesh.setMatrixAt(instanceIndex, matrix)
          instanceIndex += 1
        })
      })
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.count = instanceCount
    mesh.computeBoundingSphere()
    if (visualVersion === 'v3') {
      return registerVirtualChurchPlantVisibility(scene, mesh, createVirtualChurchPlantVisibility(mesh).update)
    }
  }, [placements, visualVersion, instanceCount, scene])

  const geometry = visualVersion === 'v3' ? V3_FLAX_BLADE_GEOMETRY : FLAX_BLADE_GEOMETRY
  const material = visualVersion === 'v3' ? V3_FLAX_BLADE_MATERIAL : FLAX_BLADE_MATERIAL

  return (
    <instancedMesh name="vc:plants" ref={meshRef} args={[geometry, material, instanceCount]} receiveShadow />
  )
}

const TussockField = ({
  placements,
  accentPlacements,
  reserve = false,
  visualVersion,
}: {
  placements: PlantPlacement[]
  accentPlacements?: PlantPlacement[]
  reserve?: boolean
  visualVersion: VirtualChurchVisualVersion
}) => {
  const baseRef = useRef<InstancedMesh>(null)
  const accentRef = useRef<InstancedMesh>(null)
  const resolvedAccentPlacements = accentPlacements ?? placements

  useLayoutEffect(() => {
    writeVirtualChurchTussockMatrices(
      placements,
      visualVersion === 'v3',
      (index, matrix) => baseRef.current?.setMatrixAt(index, matrix),
    )
    writeVirtualChurchTussockMatrices(
      resolvedAccentPlacements,
      visualVersion === 'v3',
      undefined,
      (index, matrix) => accentRef.current?.setMatrixAt(index, matrix),
    )
    if (baseRef.current) {
      baseRef.current.instanceMatrix.needsUpdate = true
      baseRef.current.computeBoundingSphere()
    }
    if (accentRef.current) {
      accentRef.current.instanceMatrix.needsUpdate = true
      accentRef.current.computeBoundingSphere()
    }
  }, [placements, resolvedAccentPlacements, visualVersion])

  const geometry = visualVersion === 'v3' ? V3_TUSSOCK_BLADE_GEOMETRY : TUSSOCK_BLADE_GEOMETRY
  const baseMaterial = visualVersion === 'v3'
    ? (reserve ? V3_TUSSOCK_RESERVE_MATERIAL : V3_TUSSOCK_BASE_MATERIAL)
    : (reserve ? TUSSOCK_RESERVE_MATERIAL : TUSSOCK_BASE_MATERIAL)
  const accentMaterial = visualVersion === 'v3'
    ? V3_TUSSOCK_ACCENT_MATERIAL
    : TUSSOCK_ACCENT_MATERIAL

  return (
    <group name="vc:plants">
      <instancedMesh ref={baseRef} args={[geometry, baseMaterial, placements.length * 6]} receiveShadow />
      {resolvedAccentPlacements.length > 0 ? (
        <instancedMesh ref={accentRef} args={[geometry, accentMaterial, resolvedAccentPlacements.length * 3]} receiveShadow />
      ) : null}
    </group>
  )
}

const V3ColoredTussockField = ({ normal, reserve }: { normal: PlantPlacement[]; reserve: PlantPlacement[] }) => {
  const { scene } = useThree()
  const meshRef = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const tint = new Color()
    writeVirtualChurchColoredTussocks([
      { placements: normal, color: V3_PLANT_TREATMENT.tussock },
      { placements: reserve, color: V3_PLANT_TREATMENT.reserveTussock },
    ], V3_PLANT_TREATMENT.dryAccent, (index, matrix, color) => {
      mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, tint.set(color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = (normal.length + reserve.length) * 9
    mesh.computeBoundingBox(); mesh.computeBoundingSphere()
    return registerVirtualChurchPlantVisibility(scene, mesh, createVirtualChurchPlantVisibility(mesh).update)
  }, [normal, reserve, scene])
  return <instancedMesh name="vc:plants" ref={meshRef} args={[V3_TUSSOCK_BLADE_GEOMETRY, V3_TUSSOCK_INSTANCE_MATERIAL, (normal.length + reserve.length) * 9]} receiveShadow />
}

const ShrubField = ({ placements, visualVersion }: { placements: PlantPlacement[]; visualVersion: VirtualChurchVisualVersion }) => {
  const sideRef = useRef<InstancedMesh>(null)
  const centreRef = useRef<InstancedMesh>(null)
  const combinedRef = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    writeVirtualChurchShrubMatrices(placements, (placementIndex, lobeIndex, matrix) => {
      if (visualVersion === 'v3') {
        const index = placementIndex * 3 + lobeIndex
        combinedRef.current?.setMatrixAt(index, matrix)
        combinedRef.current?.setColorAt(index, lobeIndex === 2 ? SHRUB_CENTRE_MATERIAL.color : SHRUB_SIDE_MATERIAL.color)
      } else if (lobeIndex === 2) centreRef.current?.setMatrixAt(placementIndex, matrix)
      else sideRef.current?.setMatrixAt(placementIndex * 2 + lobeIndex, matrix)
    })
    for (const mesh of [sideRef.current, centreRef.current, combinedRef.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingBox(); mesh.computeBoundingSphere()
    }
  }, [placements, visualVersion])

  if (visualVersion === 'v3') return <instancedMesh name="vc:plants" ref={combinedRef} args={[SHRUB_CROWN_GEOMETRY, V3_SHRUB_INSTANCE_MATERIAL, placements.length * 3]} receiveShadow />
  return (
    <group name="vc:plants">
      <instancedMesh ref={sideRef} args={[SHRUB_CROWN_GEOMETRY, SHRUB_SIDE_MATERIAL, placements.length * 2]} receiveShadow />
      <instancedMesh ref={centreRef} args={[SHRUB_CROWN_GEOMETRY, SHRUB_CENTRE_MATERIAL, placements.length]} receiveShadow />
    </group>
  )
}

const LowHedgeNetwork = ({
  segments,
  visualVersion,
}: {
  segments: Array<[[number, number], [number, number]]>
  visualVersion: VirtualChurchVisualVersion
}) => {
  const { scene } = useThree()
  const hedgeMesh = useMemo(() => {
    const v3Treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.hedges
    const geometry = visualVersion === 'v3'
      ? new RoundedBoxGeometry(1, 1, 1, 2, v3Treatment.cornerRadius)
      : new DodecahedronGeometry(0.5, 0)
    const material = new MeshStandardMaterial({
      color: visualVersion === 'v3' ? v3Treatment.base : '#4b603d',
      roughness: visualVersion === 'v3' ? v3Treatment.roughness : 0.98,
      metalness: 0,
      envMapIntensity: visualVersion === 'v3' ? v3Treatment.envMapIntensity : 1,
    })
    const v3Instances = visualVersion === 'v3'
      ? createVirtualChurchHedgeInstances(segments)
      : []
    const v2Counts = visualVersion === 'v3'
      ? []
      : segments.map(([start, end]) => Math.max(3, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 0.5)))
    const instanceCount = visualVersion === 'v3'
      ? v3Instances.length
      : v2Counts.reduce((sum, count) => sum + count, 0)
    const mesh = new InstancedMesh(geometry, material, instanceCount)
    const transform = new Object3D()
    const instanceColor = new Color()

    if (visualVersion === 'v3') {
      v3Instances.forEach((instance, instanceIndex) => {
        transform.position.set(...instance.position)
        transform.rotation.set(0, instance.rotationY, 0)
        transform.scale.set(...instance.scale)
        transform.updateMatrix()
        mesh.setMatrixAt(instanceIndex, transform.matrix)
        mesh.setColorAt(
          instanceIndex,
          instanceColor.set(v3Treatment.variation[instance.toneIndex]),
        )
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.receiveShadow = true
      mesh.computeBoundingSphere()
      return mesh
    }

    let instanceIndex = 0

    segments.forEach(([start, end], segmentIndex) => {
      const dx = end[0] - start[0]
      const dz = end[1] - start[1]
      const length = Math.hypot(dx, dz)
      const angle = Math.atan2(dz, dx)
      const nx = -dz / length
      const nz = dx / length
      const midX = (start[0] + end[0]) / 2
      const midZ = (start[1] + end[1]) / 2
      const normalSign = Math.hypot(midX + nx, midZ + nz) < Math.hypot(midX - nx, midZ - nz) ? 1 : -1
      const count = v2Counts[segmentIndex]

      for (let index = 0; index < count; index += 1) {
        const t = (index + 0.5) / count
        const localZ = index % 2 === 0 ? -0.14 : 0.12
        const height = 0.6 + ((index * 7) % 5) * 0.035
        const width = 0.76 + ((index * 11) % 4) * 0.055
        transform.position.set(
          start[0] + dx * t + nx * normalSign * -0.62 - Math.sin(angle) * localZ,
          height / 2 - 0.015,
          start[1] + dz * t + nz * normalSign * -0.62 + Math.cos(angle) * localZ,
        )
        transform.rotation.set(0, -angle + ((index % 5) - 2) * 0.07, 0)
        transform.scale.set(width, height, 0.88 + (index % 3) * 0.06)
        transform.updateMatrix()
        mesh.setMatrixAt(instanceIndex, transform.matrix)
        const color = index % 3 === 0 ? '#526641' : index % 3 === 1 ? '#465a39' : '#5a6842'
        mesh.setColorAt(instanceIndex, instanceColor.set(color))
        instanceIndex += 1
      }
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    return mesh
  }, [segments, visualVersion])

  useLayoutEffect(() => visualVersion === 'v3'
    ? registerVirtualChurchPlantVisibility(scene, hedgeMesh, createVirtualChurchPlantVisibility(hedgeMesh).update)
    : undefined, [hedgeMesh, scene, visualVersion])

  useEffect(() => () => {
    hedgeMesh.geometry.dispose()
    if (Array.isArray(hedgeMesh.material)) hedgeMesh.material.forEach((material) => material.dispose())
    else hedgeMesh.material.dispose()
  }, [hedgeMesh])

  return <primitive name="vc:plants" object={hedgeMesh} />
}

const FENCE_HEIGHT = 1.36
const FENCE_RAIL_COLOR = '#171c1b'

const createFenceNetworkBoxes = (segments: Array<[[number, number], [number, number]]>): BoxInstance[] => {
  const railsAndPickets: BoxInstance[] = []
  const posts: BoxInstance[] = []

  segments.forEach(([start, end]) => {
    const dx = end[0] - start[0]
    const dz = end[1] - start[1]
    const length = Math.hypot(dx, dz)
    const angle = Math.atan2(dz, dx)
    const rotation: [number, number, number] = [0, -angle, 0]
    const midX = (start[0] + end[0]) / 2
    const midZ = (start[1] + end[1]) / 2
    const picketCount = Math.max(2, Math.floor(length / 0.12) + 1)
    const postCount = Math.max(2, Math.ceil(length / 2.4) + 1)

    railsAndPickets.push(
      {
        position: [midX, FENCE_HEIGHT - 0.12, midZ],
        scale: [length, 0.055, 0.055],
        rotation,
      },
      {
        position: [midX, 0.27, midZ],
        scale: [length, 0.055, 0.055],
        rotation,
      },
    )
    for (let index = 0; index < picketCount; index += 1) {
      const t = picketCount > 1 ? index / (picketCount - 1) : 0.5
      railsAndPickets.push({
        position: [start[0] + dx * t, FENCE_HEIGHT / 2, start[1] + dz * t],
        scale: [0.028, FENCE_HEIGHT, 0.028],
        rotation,
      })
    }
    for (let index = 0; index < postCount; index += 1) {
      const t = postCount > 1 ? index / (postCount - 1) : 0.5
      posts.push({
        position: [start[0] + dx * t, (FENCE_HEIGHT + 0.06) / 2, start[1] + dz * t],
        scale: [0.085, FENCE_HEIGHT + 0.06, 0.085],
        rotation,
      })
    }
  })

  return [...railsAndPickets, ...posts]
}

const FenceNetwork = ({ segments, visualVersion }: { segments: Array<[[number, number], [number, number]]>; visualVersion: VirtualChurchVisualVersion }) => {
  const items = useMemo(() => createFenceNetworkBoxes(segments), [segments])
  return (
    <InstancedBoxSet
      name="vc:fences"
      items={items}
      color={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.siteMetalwork.fence : FENCE_RAIL_COLOR}
      roughness={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.siteMetalwork.fenceRoughness : 0.66}
      metalness={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.siteMetalwork.fenceMetalness : 0.52}
    />
  )
}

const ClosedVehicleGate = ({ left, right, visualVersion, fenceSegments }: { left: [number, number]; right: [number, number]; visualVersion: VirtualChurchVisualVersion; fenceSegments?: Array<[[number, number], [number, number]]> }) => {
  const leftLeaf = useRef<Group>(null)
  const rightLeaf = useRef<Group>(null)
  const combinedGateRef = useRef<InstancedMesh>(null)
  const combinedLatchRef = useRef<Group>(null)
  const lastCombinedGateProgressRef = useRef<number | null>(null)
  const dx = right[0] - left[0]
  const dz = right[1] - left[1]
  const length = Math.hypot(dx, dz)
  const angle = -Math.atan2(dz, dx)
  const midX = (left[0] + right[0]) / 2
  const midZ = (left[1] + right[1]) / 2
  const leafWidth = length / 2
  const gatePicketCount = Math.max(5, Math.floor(leafWidth / 0.12))
  const leafParts = useMemo<BoxInstance[]>(() => [-leafWidth / 2, leafWidth / 2].flatMap((localX) => [
    {
      position: [localX, 0.27, 0],
      scale: [leafWidth - 0.08, 0.065, 0.075],
    },
    {
      position: [localX, FENCE_HEIGHT - 0.12, 0],
      scale: [leafWidth - 0.08, 0.065, 0.075],
    },
    ...Array.from({ length: gatePicketCount }, (_, index) => {
      const t = gatePicketCount > 1 ? index / (gatePicketCount - 1) : 0.5
      return {
        position: [
          localX - leafWidth / 2 + 0.06 + t * (leafWidth - 0.12),
          FENCE_HEIGHT / 2,
          0,
        ],
        scale: [0.032, FENCE_HEIGHT, 0.032],
      } satisfies BoxInstance
    }),
  ]), [gatePicketCount, leafWidth])
  const gateParts = useMemo<BoxInstance[]>(() => [-length / 2, length / 2].map((localX) => ({
    position: [localX, (FENCE_HEIGHT + 0.12) / 2, 0] as [number, number, number],
    scale: [0.16, FENCE_HEIGHT + 0.12, 0.16] as [number, number, number],
  })), [length])
  const fenceParts = useMemo(
    () => visualVersion === 'v3' && fenceSegments ? createFenceNetworkBoxes(fenceSegments) : [],
    [fenceSegments, visualVersion],
  )
  const gateWorldMatrix = useMemo(
    () => new Matrix4().makeRotationY(angle).setPosition(midX, 0, midZ),
    [angle, midX, midZ],
  )
  const combinedGate = useMemo(
    () => createAutomaticVehicleGateAndFenceMatrixWriter(fenceParts, gateParts, leafParts, length, gateWorldMatrix),
    [fenceParts, gateParts, leafParts, length, gateWorldMatrix],
  )
  const updateCombinedGate = useCallback((progress: number) => {
    const mesh = combinedGateRef.current
    if (!mesh || lastCombinedGateProgressRef.current === progress) return
    combinedGate.writeGate(progress, (index, matrix) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.clearUpdateRanges()
    mesh.instanceMatrix.addUpdateRange(combinedGate.staticCount * 16, combinedGate.dynamicCount * 16)
    mesh.instanceMatrix.needsUpdate = true
    if (combinedLatchRef.current) combinedLatchRef.current.position.x = -length / 2 - vehicleGateSlideDistance(length, progress)
    lastCombinedGateProgressRef.current = progress
  }, [combinedGate, length])
  useLayoutEffect(() => {
    if (visualVersion !== 'v3') return
    lastCombinedGateProgressRef.current = null
    const mesh = combinedGateRef.current
    if (!mesh) return
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    combinedGate.writeStatic((index, matrix) => mesh.setMatrixAt(index, matrix))
    combinedGate.writeGate(0, (index, matrix) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.clearUpdateRanges()
    mesh.instanceMatrix.needsUpdate = true
    lastCombinedGateProgressRef.current = 0
  }, [combinedGate, visualVersion])
  useAutomaticDoor('vehicle', [midX, midZ], 7, progress => {
    if (visualVersion === 'v3') {
      updateCombinedGate(progress)
      return
    }
    const travel = vehicleGateSlideDistance(length, progress)
    if (leftLeaf.current) leftLeaf.current.position.x = -length / 2 - travel
    if (rightLeaf.current) rightLeaf.current.position.x = length / 2 + travel
  })

  return (
    <group name="vc:fences" position={[midX, 0, midZ]} rotation={[0, angle, 0]}>
      {visualVersion === 'v3' ? (
        <>
          <instancedMesh ref={combinedGateRef} args={[undefined, undefined, combinedGate.count]} frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={ALIFE_V3_ENVIRONMENT_TREATMENT.siteMetalwork.fence}
              metalness={ALIFE_V3_ENVIRONMENT_TREATMENT.siteMetalwork.fenceMetalness}
              roughness={ALIFE_V3_ENVIRONMENT_TREATMENT.siteMetalwork.fenceRoughness}
            />
          </instancedMesh>
          <group ref={combinedLatchRef} position={[-length / 2, 0, VEHICLE_GATE_TRACK_OFFSET]}>
            <mesh position={[length / 2, 0.72, -0.055]}>
              <boxGeometry args={[0.12, 0.18, 0.14]} />
              <meshStandardMaterial
                color={ALIFE_V3_ENVIRONMENT_TREATMENT.siteMetalwork.gateLatch}
                metalness={ALIFE_V3_ENVIRONMENT_TREATMENT.siteMetalwork.gateLatchMetalness}
                roughness={ALIFE_V3_ENVIRONMENT_TREATMENT.siteMetalwork.gateLatchRoughness}
              />
            </mesh>
          </group>
        </>
      ) : (
        <>
          <InstancedBoxSet items={gateParts} color="#171c1b" metalness={0.54} roughness={0.5} />
          {[-1, 1].map(side => <group key={side} ref={side < 0 ? leftLeaf : rightLeaf} position={[side * length / 2, 0, VEHICLE_GATE_TRACK_OFFSET]}>
            <InstancedBoxSet
              items={leafParts.filter(item => Math.sign(item.position[0]) === side).map(item => ({ ...item, position: [item.position[0] - side * length / 2, item.position[1], item.position[2]] }))}
              color="#171c1b"
              metalness={0.54}
              roughness={0.5}
            />
            {side < 0 && <mesh position={[length / 2, 0.72, -0.055]}>
              <boxGeometry args={[0.12, 0.18, 0.14]} />
              <meshStandardMaterial color="#c9c5aa" metalness={0.45} roughness={0.46} />
            </mesh>}
          </group>)}
        </>
      )}
    </group>
  )
}

const BatchedCulvertCrossing = () => {
  const colors = ALIFE_V3_ENVIRONMENT_TREATMENT.culvertDetails
  const geometry = useMemo(() => createVirtualChurchCulvertCrossingGeometry(colors.crossingAsphalt, colors.crossingConcrete), [colors])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name="vc:culvert-crossing-batch" geometry={geometry} receiveShadow>
    <meshStandardMaterial color="#ffffff" vertexColors roughness={colors.roughness} />
  </mesh>
}

const CulvertCrossing = ({ position, rotation = -0.94, visualVersion }: { position: [number, number, number]; rotation?: number; visualVersion: VirtualChurchVisualVersion }) => (
  <group name="vc:culvert" position={position} rotation={[0, rotation, 0]}>
    {visualVersion === 'v3' ? <BatchedCulvertCrossing /> : <>
    <mesh position={[0, -0.06, 0]} receiveShadow>
      <boxGeometry args={[5.2, 0.11, 6.4]} />
      <meshStandardMaterial color="#555a57" roughness={0.96} />
    </mesh>
    <mesh position={[0, -0.005, 1.75]}>
      <boxGeometry args={[5.25, 0.035, 1.25]} />
      <meshStandardMaterial color="#c8cac5" roughness={0.93} />
    </mesh>
    </>}
  </group>
)

const SwaleSurfaceBatch = ({
  strips,
  color,
  roughness = 1,
  envMapIntensity = 1,
  surfaceNormalMap,
}: {
  strips: Array<{
    start: [number, number]
    end: [number, number]
    offsetA: number
    offsetB: number
    yA: number
    yB: number
    color?: string
  }>
  color: string
  roughness?: number
  envMapIntensity?: number
  surfaceNormalMap?: Texture | null
}) => {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const indices: number[] = []
    const colors: number[] = []
    const uvs: number[] = []
    const vertexColors = strips.some(strip => strip.color !== undefined)
    for (const { start, end, offsetA, offsetB, yA, yB, color: stripColor } of strips) {
      const dx = end[0] - start[0]
      const dz = end[1] - start[1]
      const length = Math.hypot(dx, dz)
      const nx = -dz / length
      const nz = dx / length
      const base = positions.length / 3
      positions.push(
        start[0] + nx * offsetA, yA, start[1] + nz * offsetA,
        start[0] + nx * offsetB, yB, start[1] + nz * offsetB,
        end[0] + nx * offsetA, yA, end[1] + nz * offsetA,
        end[0] + nx * offsetB, yB, end[1] + nz * offsetB,
      )
      if (surfaceNormalMap) {
        // World-space planar UVs keep the existing ripple continuous across
        // both channel segments. Without UVs every vertex sampled one texel.
        uvs.push(
          start[0] + nx * offsetA, start[1] + nz * offsetA,
          start[0] + nx * offsetB, start[1] + nz * offsetB,
          end[0] + nx * offsetA, end[1] + nz * offsetA,
          end[0] + nx * offsetB, end[1] + nz * offsetB,
        )
      }
      // Keep each strip's vertices separate: no smoothing across the bank
      // edges and no triangles bridging the driveway's culvert opening.
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3)
      if (vertexColors) {
        const tint = new Color(stripColor ?? '#ffffff')
        for (let vertex = 0; vertex < 4; vertex++) colors.push(tint.r, tint.g, tint.b)
      }
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(positions, 3))
    if (surfaceNormalMap) result.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    if (vertexColors) result.setAttribute('color', new Float32BufferAttribute(colors, 3))
    result.setIndex(indices)
    result.computeVertexNormals()
    return result
  }, [strips, surfaceNormalMap])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial color={color} vertexColors={geometry.hasAttribute('color')} normalMap={surfaceNormalMap ?? null} normalScale={surfaceNormalMap ? V3_WATER_NORMAL_SCALE : undefined} roughness={roughness} metalness={0} envMapIntensity={envMapIntensity} side={DoubleSide} /></mesh>
}

const DrainageSwale = ({ start, end, crossing, visualVersion, waterNormalMap }: {
  start: [number, number]
  end: [number, number]
  crossing: [number, number]
  visualVersion: VirtualChurchVisualVersion
  waterNormalMap?: Texture | null
}) => {
  const v3Treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const lengthSquared = dx * dx + dz * dz
  const crossingT = MathUtils.clamp(
    ((crossing[0] - start[0]) * dx + (crossing[1] - start[1]) * dz) / lengthSquared,
    0,
    1,
  )
  const gapT = 3.2 / Math.sqrt(lengthSquared)
  const pointAt = (t: number): [number, number] => [
    MathUtils.lerp(start[0], end[0], t),
    MathUtils.lerp(start[1], end[1], t),
  ]
  const segments: Array<[[number, number], [number, number]]> = [
    [start, pointAt(Math.max(0, crossingT - gapT))],
    [pointAt(Math.min(1, crossingT + gapT)), end],
  ]
  const stripsFor = (
    [segmentStart, segmentEnd]: [[number, number], [number, number]],
    profiles: Array<[number, number, number, number]>,
  ) => profiles.map(([offsetA, offsetB, yA, yB]) => ({
    start: segmentStart, end: segmentEnd, offsetA, offsetB, yA, yB,
  }))
  const allStripsFor = (profiles: Array<[number, number, number, number]>) =>
    segments.flatMap(segment => stripsFor(segment, profiles))
  const mergedRef = useRef<ThreeGroup>(null)
  const frustum = useMemo(() => new Frustum(), [])
  const projection = useMemo(() => new Matrix4(), [])
  const segmentBounds = segments.map(([a, b]) => {
    const segmentDx = b[0] - a[0]
    const segmentDz = b[1] - a[1]
    const segmentLength = Math.hypot(segmentDx, segmentDz)
    const nx = -segmentDz / segmentLength
    const nz = segmentDx / segmentLength
    const corners: Vector3[] = []
    for (const point of [a, b]) for (const offset of [-3.05, 3.05]) for (const y of [-.18, .025]) {
      corners.push(new Vector3(point[0] + nx * offset, y, -(point[1] + nz * offset)))
    }
    return new Box3().setFromPoints(corners)
  })
  useFrame(({ camera }) => {
    if (visualVersion !== 'v3' || !mergedRef.current) return
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    mergedRef.current.visible = segmentBounds.some(bounds => frustum.intersectsBox(bounds))
  })
  return (
    <group name="vc:swale">
      {visualVersion === 'v3' ? <group ref={mergedRef}>
        {/* Preserve every bank/bed vertex and the culvert gap. The dark matte
            bed shares the bank's .98 roughness, so dry strips submit once;
            water keeps its own normal-mapped material. */}
        <SwaleSurfaceBatch strips={[
          ...allStripsFor([[-3.05, -1.1, 0.025, -0.12], [1.1, 3.05, -0.12, 0.025]]).map(strip => ({ ...strip, color: v3Treatment.swaleBank })),
          ...allStripsFor([[-1.1, -0.68, -0.12, -0.18], [0.68, 1.1, -0.18, -0.12]]).map(strip => ({ ...strip, color: v3Treatment.swaleTransition })),
          ...allStripsFor([[-0.68, 0.68, -0.18, -0.18]]).map(strip => ({ ...strip, color: v3Treatment.swaleBed })),
        ]} color="#ffffff" roughness={0.98} />
        <SwaleSurfaceBatch strips={allStripsFor([[-0.42, 0.42, -0.075, -0.075]])} color={v3Treatment.swaleWater}
          roughness={v3Treatment.swaleWaterRoughness} envMapIntensity={v3Treatment.swaleWaterEnvMapIntensity}
          surfaceNormalMap={waterNormalMap} />
      </group> : segments.map((segment, index) => (
        <group key={`swale-segment-${index}`}>
          <SwaleSurfaceBatch strips={stripsFor(segment, [[-3.05, -1.1, 0.025, -0.12], [1.1, 3.05, -0.12, 0.025]])} color="#596047" />
          <SwaleSurfaceBatch strips={stripsFor(segment, [[-1.1, -0.68, -0.12, -0.18], [0.68, 1.1, -0.18, -0.12]])} color="#77705c" />
          <SwaleSurfaceBatch strips={stripsFor(segment, [[-0.68, 0.68, -0.18, -0.18]])} color="#293631" />
          <SwaleSurfaceBatch strips={stripsFor(segment, [[-0.42, 0.42, -0.075, -0.075]])} color="#3e716e" />
        </group>
      ))}
    </group>
  )
}

const CulvertPipeMouth = ({ position, rotation, visualVersion }: {
  position: [number, number]
  rotation: number
  visualVersion: VirtualChurchVisualVersion
}) => (
  <group position={[position[0], -0.11, position[1]]} rotation={[0, rotation, 0]}>
    {/* Three precast pieces leave the pipe opening readable instead of
        presenting the culvert as an uninterrupted driveway slab. */}
    {[-0.86, 0.86].map((x) => (
      <mesh key={`culvert-pier-${x}`} position={[x, 0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.58, 0.74, 0.3]} />
        <meshStandardMaterial color={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.culvertDetails.precastConcrete : '#a6aaa4'} roughness={0.95} />
      </mesh>
    ))}
    <mesh position={[0, 0.61, 0]} castShadow receiveShadow>
      <boxGeometry args={[2.3, 0.22, 0.3]} />
      <meshStandardMaterial color={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.culvertDetails.precastConcrete : '#a6aaa4'} roughness={0.95} />
    </mesh>
    <mesh position={[0, -0.005, 0.01]} receiveShadow>
      <boxGeometry args={[1.22, 0.16, 0.38]} />
      <meshStandardMaterial color={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.culvertDetails.concreteEdge : '#858b85'} roughness={1} />
    </mesh>
    <mesh position={[0, 0.28, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.51, 0.51, 0.24, 28]} />
      <meshStandardMaterial color={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.culvertDetails.pipeInterior : '#172420'} roughness={0.92} side={DoubleSide} />
    </mesh>
    <mesh position={[0, 0.28, 0.36]}>
      <torusGeometry args={[0.54, 0.075, 8, 28]} />
      <meshStandardMaterial color={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.culvertDetails.concreteEdge : '#858b85'} roughness={0.94} />
    </mesh>
    {/* Splayed wing walls hold the bank and make the inlet/outlet shape clear. */}
    {[-1, 1].map((side) => (
      <mesh
        key={`culvert-wing-${side}`}
        position={[side * 1.35, 0.18, -0.38]}
        rotation={[0, side * -0.42, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1.05, 0.54, 0.22]} />
        <meshStandardMaterial color={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.culvertDetails.precastConcrete : '#989d97'} roughness={0.98} />
      </mesh>
    ))}
  </group>
)

const BatchedCulvertMouths = ({ mouths }: { mouths: CulvertMouthPlacement[] }) => {
  const batches = useMemo(() => createVirtualChurchCulvertBatches(mouths), [mouths])
  useEffect(() => () => batches.forEach(({ geometry }) => geometry.dispose()), [batches])
  return <group>{batches.map(batch => (
    <mesh key={batch.id} geometry={batch.geometry} castShadow={batch.castShadow} receiveShadow={batch.receiveShadow}>
      <meshStandardMaterial color={ALIFE_V3_ENVIRONMENT_TREATMENT.culvertDetails[batch.role]} roughness={batch.roughness} side={batch.side} />
    </mesh>
  ))}</group>
}

const CulvertDrainDetails = ({ start, end, crossing, detailed, visualVersion }: {
  start: [number, number]
  end: [number, number]
  crossing: [number, number]
  detailed: boolean
  visualVersion: VirtualChurchVisualVersion
}) => {
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const length = Math.hypot(dx, dz)
  const ux = dx / length
  const uz = dz / length
  const nx = -uz
  const nz = ux
  const mouthOffset = 3.35
  const lower: [number, number] = [crossing[0] - ux * mouthOffset, crossing[1] - uz * mouthOffset]
  const upper: [number, number] = [crossing[0] + ux * mouthOffset, crossing[1] + uz * mouthOffset]
  const yaw = Math.atan2(ux, uz)
  const mouths = useMemo<CulvertMouthPlacement[]>(() => [
    { position: [crossing[0] - ux * mouthOffset, crossing[1] - uz * mouthOffset], rotation: yaw + Math.PI },
    { position: [crossing[0] + ux * mouthOffset, crossing[1] + uz * mouthOffset], rotation: yaw },
  ], [crossing[0], crossing[1], ux, uz, yaw])
  const riprap = [lower, upper].flatMap(([x, z], mouthIndex) => [
    [x + nx * 1.28, -0.13, z + nz * 1.28, 0.42, mouthIndex * 0.7],
    [x - nx * 1.22, -0.13, z - nz * 1.22, 0.48, 0.8 + mouthIndex],
    [x + nx * 0.78 + ux * (mouthIndex ? 0.72 : -0.72), -0.15, z + nz * 0.78 + uz * (mouthIndex ? 0.72 : -0.72), 0.34, 1.6 + mouthIndex],
    [x - nx * 0.72 + ux * (mouthIndex ? 0.82 : -0.82), -0.15, z - nz * 0.72 + uz * (mouthIndex ? 0.82 : -0.82), 0.38, 2.2 + mouthIndex],
  ] as const)
  const riprapPlacements = (variant: 'a' | 'c' | 'flat'): StaticAssetPlacement[] => riprap
    .map(([x, y, z, scale, rotation], index) => ({
      placement: {
        position: [x, y, z],
        rotation: [0, rotation, 0],
        scale,
      } satisfies StaticAssetPlacement,
      variant: index % 3 === 2 ? 'flat' : index % 2 ? 'c' : 'a',
    }))
    .filter((entry) => entry.variant === variant)
    .map((entry) => entry.placement)

  return (
    <group name="vc:culvert">
      {visualVersion === 'v3' ? <BatchedCulvertMouths mouths={mouths} /> : <>
        <CulvertPipeMouth position={lower} rotation={yaw + Math.PI} visualVersion={visualVersion} />
        <CulvertPipeMouth position={upper} rotation={yaw} visualVersion={visualVersion} />
      </>}
      {detailed ? (
        <>
          {visualVersion === 'v3' && perfConfig.isMobile ? (
            <BatchedCulvertRocks placementsByVariant={[
              riprapPlacements('a'), riprapPlacements('c'), riprapPlacements('flat'),
            ]} />
          ) : <>
            <InstancedStaticAssetField path={NATURE_ASSETS.rockA} placements={riprapPlacements('a')} visualVersion={visualVersion} />
            <InstancedStaticAssetField path={NATURE_ASSETS.rockC} placements={riprapPlacements('c')} visualVersion={visualVersion} />
            <InstancedStaticAssetField path={NATURE_ASSETS.flatRock} placements={riprapPlacements('flat')} visualVersion={visualVersion} />
          </>}
        </>
      ) : null}
    </group>
  )
}

const IndustrialNeighbour = ({
  position,
  rotation = 0,
  width,
  depth,
  height,
  wallColor,
  accentColor = '#5e6565',
  rollerDoor = true,
  visualVersion,
}: {
  position: [number, number]
  rotation?: number
  width: number
  depth: number
  height: number
  wallColor: string
  accentColor?: string
  rollerDoor?: boolean
  visualVersion: VirtualChurchVisualVersion
}) => {
  const v3Treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.industrialContext
  const ribCount = Math.max(8, Math.floor(width / 0.85))
  const ribs: BoxInstance[] = Array.from({ length: ribCount }, (_, index) => ({
    position: [-width / 2 + ((index + 0.5) / ribCount) * width, height * 0.62, -depth / 2 - 0.035],
    scale: [0.055, height * 0.72, 0.08],
  }))
  const rollerSlats: BoxInstance[] = Array.from({ length: 6 }, (_, index) => ({
    position: [0, -height * 0.25 + index * height * 0.1, -0.071],
    scale: [Math.min(4.65, width * 0.29), 0.025, 0.025],
  }))

  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, rotation, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.8} metalness={0.12} />
      </mesh>
      <mesh position={[0, height + 0.09, 0]} castShadow>
        <boxGeometry args={[width + 0.22, 0.18, depth + 0.22]} />
        <meshStandardMaterial color={visualVersion === 'v3' ? v3Treatment.roofTrim : '#767b79'} roughness={visualVersion === 'v3' ? 0.76 : 0.65} metalness={visualVersion === 'v3' ? 0.24 : 0.38} />
      </mesh>
      <InstancedBoxSet items={ribs} color={accentColor} roughness={0.66} metalness={0.42} />
      <mesh position={[width * 0.2, height * 0.67, -depth / 2 - 0.075]}>
        <boxGeometry args={[width * 0.42, Math.min(1.75, height * 0.27), 0.12]} />
        <meshPhysicalMaterial color={visualVersion === 'v3' ? v3Treatment.glass : '#314549'} roughness={visualVersion === 'v3' ? 0.32 : 0.25} metalness={visualVersion === 'v3' ? 0.16 : 0.25} clearcoat={visualVersion === 'v3' ? 0.12 : 0.2} />
      </mesh>
      {rollerDoor && (
        <group position={[-width * 0.27, height * 0.34, -depth / 2 - 0.085]}>
          <mesh>
            <boxGeometry args={[Math.min(4.8, width * 0.3), height * 0.62, 0.13]} />
            <meshStandardMaterial color={visualVersion === 'v3' ? v3Treatment.rollerDoor : '#c6c7c2'} roughness={visualVersion === 'v3' ? 0.88 : 0.82} metalness={visualVersion === 'v3' ? 0.14 : 0.22} />
          </mesh>
          <InstancedBoxSet
            items={rollerSlats}
            color={visualVersion === 'v3' ? v3Treatment.rollerSlat : '#777d7a'}
            roughness={0.72}
            metalness={0.28}
            basic={visualVersion !== 'v3'}
          />
        </group>
      )}
    </group>
  )
}

const SurroundingBuildingExterior = ({ building }: { building: VirtualChurchSurroundingBuilding }) => {
  // Share the open-canopy structural shell with Low; detailed street facade
  // remains in the deferred desktop batches and must not be rendered twice.
  const geometry = useMemo(() => virtualChurchSurroundingStructure(building).canopy
    ? createVirtualChurchMobileSurroundings([building], false) : null, [building])
  useEffect(() => () => { geometry?.walls.dispose(); geometry?.roofs.dispose() }, [geometry])
  const treatment = ALIFE_V3_ENVIRONMENT_TREATMENT.industrialContext
  const wallColor = building.tone === 'pale'
    ? treatment.paleWall
    : building.tone === 'grey'
      ? treatment.greyWall
      : treatment.silverWall
  const roofColor = building.tone === 'grey' ? treatment.auxiliaryRoof : treatment.roofLight

  if (geometry) return <group>
    <mesh geometry={geometry.walls} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={0.58} metalness={0.28} /></mesh>
    <mesh geometry={geometry.roofs} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={0.78} metalness={0.2} /></mesh>
  </group>

  return (
    <group>
      <FootprintVolume points={building.footprint} height={building.height} color={wallColor} />
      <GroundPolygon
        points={building.footprint}
        y={building.height + 0.035}
        color={roofColor}
        roughness={0.78}
        metalness={0.2}
      />
    </group>
  )
}

const MobileSurroundingBuildings = () => {
  const geometry = useMemo(() => createVirtualChurchMobileSurroundings(VIRTUAL_CHURCH_SURROUNDING_BUILDINGS), [])
  useEffect(() => () => { geometry.walls.dispose(); geometry.roofs.dispose() }, [geometry])
  return <group>
    <mesh geometry={geometry.walls} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.58} metalness={0.28} />
    </mesh>
    <mesh geometry={geometry.roofs} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.78} metalness={0.2} />
    </mesh>
  </group>
}

const SurroundingBuildingCluster = memo(({ detailed }: { detailed: boolean }) => (
  <group name="vc:surroundings">
    {perfConfig.isMobile ? <MobileSurroundingBuildings /> : VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.map((building) => (
      <SurroundingBuildingExterior key={building.id} building={building} />
    ))}
    {detailed ? (
      <Suspense fallback={null}>
        <DeferredSurroundingFacades />
      </Suspense>
    ) : null}
  </group>
))

// North-up local-metre geometry reconstructed from the CCC 2025 aerial and
// OSM road/building vectors. The church footprint remains centred at (0, 0).
// Keep the carriageway-side verge close to the aerial-measured drainage line:
// approximately 2 m from the asphalt edge to the swale centre at the culvert.
// Share the exact end cross-section with the mapped continuation. The former
// tip extended beyond its eastern footpath and left an asphalt tooth in it.
const V3_SHARED_ROAD_POLYGONS = [
  V3_THE_RUNWAY_APPROACH,
  STARK_DRIVE_NORTH,
  VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION,
  STARK_DRIVE_SERVICE,
] as const
const V3_SHARED_ROAD_TINTS = ['#48504f', '#48504f', '#48504f', '#505755']
const V3_SHARED_ROAD_ELEVATIONS = [0, 0, 0, 0.019 - 0.018]
// The council aerial shows a conventional narrow shared footpath, not the
// former five-metre-wide pale strip. Keep its centreline, but reduce the
// cross-section to approximately 1.8 m so the two grass verges read correctly.
const NORTH_FOOTPATH: Array<[number, number]> = [
  [-67.79, -7.83],
  [-2.29, 44.17],
  [42.21, 74.17],
  [43.29, 72.73],
  [-1.21, 42.73],
  [-66.71, -9.27],
]
const V3_SHARED_CARPARK_POLYGONS = [ENTRANCE_DRIVEWAY, MAIN_CARPARK]
const V3_PLANT_CLEARANCE_POLYGONS = [
  ...V3_SHARED_ROAD_POLYGONS, ...V3_SHARED_CARPARK_POLYGONS,
  NORTH_FOOTPATH, ...VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS,
  ...VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS,
] as const
const V3_SHARED_CARPARK_TINTS = ['#3d4342', '#343a39']
const V3_SHARED_CARPARK_ELEVATIONS = [0.032 - 0.01, 0]
const ENTRANCE_APRON: Array<[number, number]> = [[-7.1, -13.5], [-3.1, -18.4], [-5.8, -20.6], [-9.8, -15.7]]
const SWALE_START = VIRTUAL_CHURCH_SWALE.start
const SWALE_END = VIRTUAL_CHURCH_SWALE.end
const INTERSECTION_ISLANDS: Array<Array<[number, number]>> = [
  [[-18, 59], [-14, 64], [-9, 61], [-12, 56]],
  [[-5, 52], [0, 55], [4, 50], [-1, 47]],
  [[-12, 48], [-8, 44], [-12, 39], [-17, 43]],
]
const CARPARK_SPINE_WALKWAY: Array<[number, number]> = [
  [-24.27, -21.37],
  [-10.05, -35.44],
  [-10.97, -36.36],
  [-25.19, -22.3],
]
// Keep each authored elevation and color in the existing concrete batch.
// Yard tint is multiplied in linear space, without a lossy hex round-trip.
const V3_SHARED_CONCRETE_GROUND_POLYGONS = [
  NORTH_FOOTPATH,
  ...VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS,
  VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT.points,
  CARPARK_SPINE_WALKWAY,
] as const
const V3_SHARED_CONCRETE_GROUND_TINTS = V3_SHARED_CONCRETE_GROUND_POLYGONS.map(points => {
  const ground = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces
  if (points === CARPARK_SPINE_WALKWAY) return new Color(ground.spineWalkway)
  return new Color(ground.footpath).multiply(new Color(points === VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT.points ? '#bebcb0' : '#ffffff'))
})
const V3_SHARED_CONCRETE_GROUND_ELEVATIONS = V3_SHARED_CONCRETE_GROUND_POLYGONS.map(
  points => points === CARPARK_SPINE_WALKWAY ? 0.046 - 0.012 : 0,
)
// Complete property boundary reconstructed from the street photograph and
// aerial. The street fence is a separate line in front of the church, with a
// 3.5-4 m planted setback from the facade. The only deliberate opening is the
// vehicle gate; no fence segment uses the building wall as the boundary.
const SITE_FENCE_SEGMENTS: Array<[[number, number], [number, number]]> = [
  [[-52, -7], [-38.2, 4.5]],
  [[-33.6, 8.3], [-27.33, 13.45]],
  [[-27.33, 13.45], [-12.28, 25.65]],
  [[-12.28, 25.65], [0.5, 28.2]],
  [[0.5, 28.2], [15.1, 8.1]],
  [[15.1, 8.1], [25, -8]],
  [[25, -8], [22, -15]],
  [[22, -15], [19, -26]],
  [[19, -26], [4, -49]],
  [[4, -49], [-24, -52]],
  [[-24, -52], [-39, -42]],
  [[-39, -42], [-50, -25]],
  [[-50, -25], [-54, -21]],
  [[-54, -21], [-55, -10]],
  [[-55, -10], [-52, -7]],
]
const STREET_FENCE_PLANTING_SEGMENTS: Array<[[number, number], [number, number]]> = SITE_FENCE_SEGMENTS.slice(0, 6)
// The street photo has clipped hedging across the church frontage, while the
// strongest flax masses sit outside the gate and at both ends of the elevation.
// Keep the cross and bilingual wordmark section low and visually open.
const FRONTAGE_FLAX_CLUSTERS: Array<{
  position: [number, number, number]
  rotation: number
  scale: number
  spread: number
}> = [
  { position: [-50.38, 0, -4.74], rotation: -0.88, scale: 0.88, spread: 0.92 },
  { position: [-47.2, 0, -2.09], rotation: -0.88, scale: 0.98, spread: 1.02 },
  { position: [-42.79, 0, 1.59], rotation: -0.88, scale: 1.04, spread: 1.08 },
  { position: [-40.03, 0, 3.89], rotation: -0.88, scale: 1.08, spread: 1.1 },
  { position: [-26.57, 0, 14.97], rotation: -0.68, scale: 1.02, spread: 1.08 },
  { position: [-24.01, 0, 17.04], rotation: -0.68, scale: 1.08, spread: 1.12 },
  { position: [-2.83, 0, 28.25], rotation: -0.2, scale: 0.9, spread: 0.96 },
  { position: [4.72, 0, 23.59], rotation: 0.63, scale: 0.98, spread: 1.02 },
  { position: [11.29, 0, 14.54], rotation: 0.63, scale: 1.02, spread: 1.06 },
  { position: [18.67, 0, 3.64], rotation: 0.55, scale: 0.94, spread: 1 },
]
const RESERVE_EDGE: Array<[number, number]> = [[-72, -16], [-52, -25], [-32, -50], [9, -58], [4, -72], [-72, -72]]
const WETLAND_POND_A: Array<[number, number]> = [[-65, -38], [-60, -33], [-52, -34], [-47, -41], [-50, -47], [-59, -48], [-65, -44]]
const WETLAND_POND_B: Array<[number, number]> = [[-47, -57], [-40, -53], [-31, -56], [-29, -63], [-35, -68], [-44, -66]]
const V3_SHARED_POND_POLYGONS = [WETLAND_POND_A, WETLAND_POND_B]

const SiteScene = ({ visualVersion, showFoyerFlags }: { visualVersion: VirtualChurchVisualVersion; showFoyerFlags: boolean }) => {
  const { scene, gl } = useThree()
  useLayoutEffect(() => {
    if (profile3DEnabled) performance.mark('vc:site:layout-effect')
    if (visualVersion !== 'v3' || !perfConfig.isMobile || perfConfig.postProcessing) return
    return installVirtualChurchShadowCache(scene, gl)
  }, [scene, gl, visualVersion])
  const reducedMotion = useVirtualChurchReducedMotion()
  const sceneTreatment = visualVersion === 'v3'
    ? ALIFE_V3_SCENE_TREATMENT.scene
    : ALIFE_SCENE
  const lightingTreatment = visualVersion === 'v3'
    ? ALIFE_V3_SCENE_TREATMENT.lighting
    : ALIFE_LIGHTING
  const detailedSiteAssetsReady = useDeferredAfterHero(
    virtualChurchDeferredDelayMs('siteDetails', perfConfig.isMobile),
    true,
  )
  const asphaltTexture = useMemo(
    () => visualVersion === 'v3' ? createV3AsphaltTexture() : null,
    [visualVersion],
  )
  useEffect(() => () => asphaltTexture?.dispose(), [asphaltTexture])
  const grassTexture = useMemo(
    () => visualVersion === 'v3' ? createV3GrassTexture() : null,
    [visualVersion],
  )
  useEffect(() => () => grassTexture?.dispose(), [grassTexture])
  const concreteTexture = useMemo(
    () => visualVersion === 'v3' ? createV3ConcreteTexture() : null,
    [visualVersion],
  )
  useEffect(() => () => concreteTexture?.dispose(), [concreteTexture])
  const waterNormalTexture = useMemo(
    () => visualVersion === 'v3' ? createV3WaterNormalTexture() : null,
    [visualVersion],
  )
  useEffect(() => () => waterNormalTexture?.dispose(), [waterNormalTexture])
  useFrame((_, delta) => {
    if (!waterNormalTexture || reducedMotion) return
    const drift = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces.waterDriftPerSecond
    waterNormalTexture.offset.x = (waterNormalTexture.offset.x + delta * drift[0]) % 1
    waterNormalTexture.offset.y = (waterNormalTexture.offset.y + delta * drift[1]) % 1
  })
  const v3GroundTreatment = ALIFE_V3_ENVIRONMENT_TREATMENT.groundSurfaces
  const v3IndustrialTreatment = ALIFE_V3_ENVIRONMENT_TREATMENT.industrialContext
  const perimeterTrees: Array<[number, number, number]> = [[-66, -22], [-58, -31], [-48, -48], [-28, -55], [-8, -57], [26, 14], [31, 18]].map(([x, z]) => groundedPosition(x, z))
  const treePlacements: Record<TreeVariant, TreePlacement[]> = { broadleaf: [], oak: [], pine: [] }
  perimeterTrees.forEach((position, index) => treePlacements[index % 4 === 0 ? 'pine' : index % 2 ? 'oak' : 'broadleaf'].push({ position, scale: index % 3 === 0 ? 1 : 0.82 }))
  if (visualVersion === 'v3') {
    VIRTUAL_CHURCH_SURROUNDING_TREES.forEach(({ point: [x, z] }, index) => {
      treePlacements.broadleaf.push({ position: groundedPosition(x, z), scale: .6 + (index % 3) * .07 })
    })
  }
  const entranceShrubs: Array<[number, number, number]> = [[9.8, 0, 20.5], [11.8, 0, 22.2], [13.8, 0, 23.8], [16.1, 0, 25.2], [18.2, 0, 26.2]]
  const reservePlants: Array<[number, number, number]> = Array.from({ length: 18 }, (_, index) => [-53 + index * 3.3, 0, -43 - Math.sin(index * 0.72) * 4] as [number, number, number])
  const normalTussockCandidates: PlantPlacement[] = [
    ...[10, 14, 18].map((x, index) => ({ position: [x, 0, 23 + index * 1.2], scale: 0.75 } satisfies PlantPlacement)),
    ...[[21, 0, 18], [7, 0, 29], [-13, 0, 28]].map((position) => ({ position: position as [number, number, number], scale: 0.78 } satisfies PlantPlacement)),
    ...(visualVersion === 'v3' ? VIRTUAL_CHURCH_SWALE_PLANTS.grass.map(([x, z]) => ({
      position: [x, virtualChurchSwaleFloorAt(x, z) ?? provisionalTerrainHeightAt(x, z), z] as [number, number, number],
    })) : [
      [-51, 0, 12.8], [-48.6, 0, 15.6], [-39.8, 0, 22.8], [-37.5, 0, 20.2],
      [-61, -0.3, 7], [-56, -0.3, 10.8], [-51, -0.3, 14.6],
      [-39, -0.3, 23.8], [-34, -0.3, 27.6], [-29, -0.3, 31.4],
    ].map((position) => ({ position: position as [number, number, number] } satisfies PlantPlacement))),
    ...[[-26, 0, 13], [-18, 0, 22], [5, 0, 22]].map((position) => ({ position: position as [number, number, number] } satisfies PlantPlacement)),
  ]
  const normalTussocks = normalTussockCandidates.filter(plant => visualVersion !== 'v3'
    || virtualChurchPlantClearsPaving(plant.position, .65 * (plant.scale ?? 1), V3_PLANT_CLEARANCE_POLYGONS))
  const reserveTussocks: PlantPlacement[] = reservePlants
    .filter((_, index) => index % 2 === 1)
    .map(([x, , z]) => ({ position: groundedPosition(x - 8, z - 8), scale: 0.85 }))
  const combinedTussockAccents = visualVersion === 'v3'
    ? [...normalTussocks, ...reserveTussocks]
    : undefined
  const shrubCandidates: PlantPlacement[] = [
    ...[[15, 0, 25], [-3, 0, 30]].map((position) => ({ position: position as [number, number, number], scale: 0.82 } satisfies PlantPlacement)),
    ...[[14, 0, -2], [16, 0, -2.5], [18, 0, -3], [12, 0, -1.5]].map((position, index) => ({ position: position as [number, number, number], scale: 0.7 + index * 0.1 } satisfies PlantPlacement)),
    ...[[-58, 0, 16], [-60, 0, 30], [-41, 0, 29], [-33, 0, 35]].map((position) => ({ position: position as [number, number, number], scale: 2 } satisfies PlantPlacement)),
    ...[[-22, 0, 18], [-8, 0, 25], [13, 0, 17]].map((position) => ({ position: position as [number, number, number], scale: 0.9 } satisfies PlantPlacement)),
  ]
  const shrubs = shrubCandidates.filter(plant => visualVersion !== 'v3'
    || virtualChurchPlantClearsPaving(plant.position, .9 * (plant.scale ?? 1), V3_PLANT_CLEARANCE_POLYGONS))
  const flaxCandidates: PlantPlacement[] = [
    ...entranceShrubs
      .filter((_, index) => index % 3 === 0)
      .map((position) => ({ position, scale: 0.68 })),
    ...(visualVersion === 'v3' ? VIRTUAL_CHURCH_SWALE_PLANTS.flax.map(([x, z], index) => ({
      position: [x, virtualChurchSwaleFloorAt(x, z) ?? provisionalTerrainHeightAt(x, z), z] as [number, number, number], scale: index === 0 ? 1.1 : 1,
    })) : [{ position: [-49.2, 0, 14.2] as [number, number, number], scale: 1.1 }, { position: [-39.3, 0, 21.7] as [number, number, number], scale: 1 }]),
    ...reservePlants
      .filter((_, index) => index % 2 === 0)
      .map(([x, , z]) => ({ position: groundedPosition(x - 8, z - 8), scale: 0.72 })),
    ...FRONTAGE_FLAX_CLUSTERS.map(({ position, rotation, scale, spread }) => ({
      position,
      rotation,
      scale,
      spread,
      cluster: true,
    })),
  ]
  // Preserve the photo-constrained frontage clusters. Their elongated hedge
  // beds need an oriented survey, not rejection by a conservative circle on
  // provisional paving polygons. This guard covers only scattered plants.
  const flaxPlacements = flaxCandidates.filter(plant => visualVersion !== 'v3' || plant.cluster
    || virtualChurchPlantClearsPaving(plant.position, 1.25 * (plant.scale ?? 1), V3_PLANT_CLEARANCE_POLYGONS))
  const parkingWheelStops: BoxInstance[] = [
    ...PARKING_ROWS
      .filter((row) => row.id === 'spine-building-side' || row.id === 'spine-boundary-side')
      .flatMap((row) => {
        const ux = Math.cos(row.angle)
        const uz = Math.sin(row.angle)
        const vx = -uz
        const vz = ux
        const side = CENTRAL_PARKING_WHEEL_STOP_INNER_SIDE[
          row.id as keyof typeof CENTRAL_PARKING_WHEEL_STOP_INNER_SIDE
        ]
        const depthOffset = side * (row.bayDepth / 2 - 0.58)
        return Array.from({ length: row.bays }, (_, index) => ({
          position: [
            row.start[0] + ux * row.bayWidth * (index + 0.5) + vx * depthOffset,
            0.075,
            row.start[1] + uz * row.bayWidth * (index + 0.5) + vz * depthOffset,
          ],
          rotation: [0, -row.angle, 0],
          scale: [1.55, 0.12, 0.22],
        } satisfies BoxInstance))
      }),
  ]
  const purpleFlowerPlacements: StaticAssetPlacement[] = [
    { position: [10.8, 0, 21.5], scale: 1.71 },
    { position: [15.6, 0, 24.4], scale: 1.71 },
  ]
  const yellowFlowerPlacements: StaticAssetPlacement[] = [
    { position: [13.2, 0, 23], scale: 2.07 },
    { position: [18, 0, 25.7], scale: 2.07 },
  ]
  const grassPlacements: StaticAssetPlacement[] = [
    { position: [17.5, 0, 22], scale: 1.89 },
    { position: [9.5, 0, 27.2], scale: 2.14 },
    { position: [0.5, 0, 29], scale: 2.39 },
  ]
  const rockAPlacements: StaticAssetPlacement[] = [
    { position: [9.2, 0, 24.8], scale: 0.85 },
  ]
  const rockCPlacements: StaticAssetPlacement[] = [
    { position: [14.8, 0, 26.4], rotation: [0, 0.8, 0], scale: 0.85 },
  ]
  const flatRockPlacements: StaticAssetPlacement[] = [
    { position: [18.6, 0, 27.5], rotation: [0, 1.6, 0], scale: 1.7 },
  ]

  return (
    <>
      <PbrEnvironmentMap visualVersion={visualVersion} />
      <color attach="background" args={[sceneTreatment.background]} />
      <fog attach="fog" args={[sceneTreatment.fog.color, sceneTreatment.fog.near, sceneTreatment.fog.far]} />
      {/* Source coordinates use geographic +Z north. Three.js uses +Z as the
          south-facing axis for a normal east/up/south world, so mirror source Z
          exactly once here. This preserves the real left/right site layout. */}
      <group scale={[1, 1, -1]}>
      <ambientLight intensity={lightingTreatment.ambient.intensity} />
      <hemisphereLight args={[lightingTreatment.hemisphere.skyColor, lightingTreatment.hemisphere.groundColor, lightingTreatment.hemisphere.intensity]} />
      <directionalLight
        position={lightingTreatment.directional.position}
        intensity={lightingTreatment.directional.intensity}
        color={lightingTreatment.directional.color}
        castShadow
        shadow-mapSize-width={perfConfig.shadowMapSize}
        shadow-mapSize-height={perfConfig.shadowMapSize}
        shadow-camera-left={-65}
        shadow-camera-right={65}
        shadow-camera-top={65}
        shadow-camera-bottom={-65}
      />

      <TerrainSurface visualVersion={visualVersion} surfaceMap={grassTexture} />

      {visualVersion === 'v3' && (
        <GroundPolygonSet
          polygons={VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS}
          y={0.009}
          color="#606561"
          roughness={0.98}
          metalness={0}
          surfaceMap={asphaltTexture}
        />
      )}

      {/* Verified road layout: The Runway passes diagonally north of the
          church; Stark Drive branches north-west and its service arm runs
          south-east along the open-field edge. */}
      {visualVersion === 'v3' ? (
        <GroundPolygonSet
          polygons={V3_SHARED_CONCRETE_GROUND_POLYGONS}
          tints={V3_SHARED_CONCRETE_GROUND_TINTS}
          elevationOffsets={V3_SHARED_CONCRETE_GROUND_ELEVATIONS}
          y={0.012}
          color="#ffffff"
          roughness={0.98}
          metalness={0}
          surfaceMap={concreteTexture}
        />
      ) : (
        <GroundPolygon
          points={NORTH_FOOTPATH}
          y={0.012}
          color="#c8ccc7"
          roughness={0.85}
          metalness={0.15}
          surfaceMap={concreteTexture}
        />
      )}
      {visualVersion === 'v3' ? (
        <GroundPolygonSet polygons={V3_SHARED_ROAD_POLYGONS} tints={V3_SHARED_ROAD_TINTS} elevationOffsets={V3_SHARED_ROAD_ELEVATIONS} y={0.018} color="#ffffff" surfaceMap={asphaltTexture} />
      ) : (
        <>
          <GroundPolygon points={THE_RUNWAY} y={0.018} color="#48504f" surfaceMap={asphaltTexture} />
          <GroundPolygon points={STARK_DRIVE_NORTH} y={0.018} color="#48504f" surfaceMap={asphaltTexture} />
          <GroundPolygon points={STARK_DRIVE_SERVICE} y={0.019} color="#505755" surfaceMap={asphaltTexture} />
        </>
      )}
      {visualVersion === 'v3' ? (
        <GroundPolygonSet
          polygons={INTERSECTION_ISLANDS}
          y={0.045}
          color={v3GroundTreatment.trafficIsland}
          roughness={1}
          metalness={0}
          surfaceMap={concreteTexture}
        />
      ) : INTERSECTION_ISLANDS.map((points, index) => (
          <GroundPolygon
            key={`intersection-island-${index}`}
            points={points}
            y={0.045}
            color="#9d9a83"
            roughness={1}
            metalness={0.15}
            surfaceMap={concreteTexture}
          />
        ))}
      <InstancedBoxSet
        items={[[-18, 52, 0.93], [-8, 57, -0.65], [-3, 45, 0.92]].map(([x, z, rotation]) => ({
          position: [x, 0.055, z], rotation: [0, rotation, 0], scale: [0.12, 0.025, 4.8],
        }))}
        color={visualVersion === 'v3' ? ALIFE_V3_ENVIRONMENT_TREATMENT.parkingDetails.line : '#f0ead4'}
        roughness={ALIFE_V3_ENVIRONMENT_TREATMENT.parkingDetails.lineRoughness}
        metalness={0}
        basic={visualVersion !== 'v3'}
      />

      {/* The Runway approach crosses the roadside swale before reaching the
          OSM barrier gate and opening into the west/south-west car park. */}
      {visualVersion === 'v3' ? (
        <GroundPolygonSet polygons={V3_SHARED_CARPARK_POLYGONS} tints={V3_SHARED_CARPARK_TINTS} elevationOffsets={V3_SHARED_CARPARK_ELEVATIONS} color="#ffffff" roughness={0.96} metalness={0.02} surfaceMap={asphaltTexture} />
      ) : <>
        <GroundPolygon points={ENTRANCE_DRIVEWAY} y={0.032} color="#3d4342" roughness={0.96} metalness={0.02} surfaceMap={asphaltTexture} />
        <GroundPolygon points={MAIN_CARPARK} color="#343a39" roughness={0.96} metalness={0.02} surfaceMap={asphaltTexture} />
      </>}
      <ParkingRowsField rows={PARKING_ROWS} accessible={{
        start: ACCESSIBLE_PARKING_PAIR.start,
        bayWidth: ACCESSIBLE_PARKING_PAIR.bayWidth,
        aisleWidth: ACCESSIBLE_PARKING_PAIR.aisleWidth,
        depth: ACCESSIBLE_PARKING_PAIR.bayDepth,
        angle: ACCESSIBLE_PARKING_PAIR.angle,
      }} />
      {visualVersion !== 'v3' && <AccessibleParkingPair
        start={ACCESSIBLE_PARKING_PAIR.start}
        bayWidth={ACCESSIBLE_PARKING_PAIR.bayWidth}
        aisleWidth={ACCESSIBLE_PARKING_PAIR.aisleWidth}
        depth={ACCESSIBLE_PARKING_PAIR.bayDepth}
        angle={ACCESSIBLE_PARKING_PAIR.angle}
      />}
      {detailedSiteAssetsReady ? (
        <>
          <ParkedVehicle variant="suv" position={[-24.4, 0, 0.55]} rotation={0.78} fallbackColor="#d7d8d4" visualVersion={visualVersion} />
          <ParkedVehicle variant="sedan" position={[-20, 0, -23.2]} rotation={0.78} fallbackColor="#6f7d80" visualVersion={visualVersion} />
          <ParkedVehicle variant="van" position={[-31.8, 0, -36.2]} rotation={0.78} fallbackColor="#ecece7" visualVersion={visualVersion} />
        </>
      ) : visualVersion !== 'v3' ? (
        <>
          <VehicleFallback position={[-24.4, 0, 0.55]} rotation={0.78} color="#d7d8d4" />
          <VehicleFallback position={[-20, 0, -23.2]} rotation={0.78} color="#6f7d80" />
          <VehicleFallback position={[-31.8, 0, -36.2]} rotation={0.78} color="#ecece7" />
        </>
      ) : null}
      {visualVersion !== 'v3' && <GroundPolygon
        points={CARPARK_SPINE_WALKWAY}
        y={0.046}
        color="#b7b8b2"
        roughness={0.96}
        metalness={0.15}
        surfaceMap={concreteTexture}
      />}
      {/* The reviewed overhead layout keeps this cross-aisle fully driveable:
          no planted island, tree, planter, or freestanding sign. */}
      <InstancedBoxSet items={parkingWheelStops}
        color={visualVersion === 'v3'
          ? ALIFE_V3_ENVIRONMENT_TREATMENT.parkingDetails.wheelStop
          : '#c7c8c2'}
        roughness={visualVersion === 'v3'
          ? ALIFE_V3_ENVIRONMENT_TREATMENT.parkingDetails.wheelStopRoughness
          : 1}
        metalness={0}
        receiveShadow
        shape={visualVersion === 'v3' ? 'wheel-stop' : 'box'}
      />
      {(Object.keys(treePlacements) as TreeVariant[]).map((variant) => (
        detailedSiteAssetsReady
          ? <InstancedTreeField key={variant} variant={variant} placements={treePlacements[variant]} visualVersion={visualVersion} />
          : (
            <group key={variant}>
              {treePlacements[variant].map(({ position, scale }) => (
                <TreeFallback key={position.join('-')} position={position} scale={scale * 1.65} visualVersion={visualVersion} />
              ))}
            </group>
          )
      ))}
      {detailedSiteAssetsReady && visualVersion === 'v3' && perfConfig.isMobile
        ? <MobileMergedFarTreeTrunks placementsByVariant={treePlacements} />
        : null}

      {/* The 2025 council aerial and OSM footprints show a working industrial
          estate rather than an empty horizon. V3 uses eight traceable exterior
          shells; heights and facade rhythm remain intentionally approximate. */}
      <FootprintVolume points={AUXILIARY_BUILDING} height={5.1} color={visualVersion === 'v3' ? v3IndustrialTreatment.auxiliaryWall : '#a8adab'} />
      <GroundPolygon points={AUXILIARY_BUILDING} y={5.12} color={visualVersion === 'v3' ? v3IndustrialTreatment.auxiliaryRoof : '#7a807e'} roughness={visualVersion === 'v3' ? 0.76 : 0.58} />
      <FacadeSegment start={AUXILIARY_BUILDING[0]} end={AUXILIARY_BUILDING[1]} height={3.9} y={2.05} color={visualVersion === 'v3' ? v3IndustrialTreatment.auxiliaryAccent : '#666e6d'} depth={0.38} metalness={visualVersion === 'v3' ? 0.16 : 0.24} />
      <WindowBand start={AUXILIARY_BUILDING[0]} end={AUXILIARY_BUILDING[1]} y={2.65} count={5} color={visualVersion === 'v3' ? v3IndustrialTreatment.glass : '#30474a'} />
      <GroundPolygon points={[[-53, -7], [-47, -2], [-43, -6], [-49, -12]]} y={0.04} color={visualVersion === 'v3' ? v3IndustrialTreatment.mulch : '#71523d'} roughness={visualVersion === 'v3' ? 0.99 : 0.95} />
      {visualVersion === 'v3' ? (
        <SurroundingBuildingCluster
          detailed={virtualChurchShouldRenderSurroundingFacadeDetails(
            detailedSiteAssetsReady,
            perfConfig.isMobile,
          )}
        />
      ) : (
        <>
          <IndustrialNeighbour
            position={[34, -5.5]}
            rotation={-0.03}
            width={20}
            depth={14}
            height={6.4}
            wallColor="#c7c3b8"
            accentColor="#777d7b"
            visualVersion={visualVersion}
          />
          <IndustrialNeighbour
            position={[12, -59]}
            rotation={0.08}
            width={27}
            depth={13}
            height={5.4}
            wallColor="#929998"
            accentColor="#656c6b"
            rollerDoor={false}
            visualVersion={visualVersion}
          />
        </>
      )}

      {/* Photo-confirmed roadside drain. Its banks and dark bed remain visible
          from ground level, while the culvert interrupts the open channel. */}
      <DrainageSwale
        start={SWALE_START}
        end={SWALE_END}
        crossing={[SCENE_LANDMARKS.culvert[0], SCENE_LANDMARKS.culvert[2]]}
        visualVersion={visualVersion}
        waterNormalMap={waterNormalTexture}
      />
      <GroundPolygon
        points={ENTRANCE_APRON}
        y={0.035}
        color={visualVersion === 'v3' ? v3GroundTreatment.entranceApron : '#aeb2ae'}
        roughness={visualVersion === 'v3' ? 0.97 : 0.9}
        metalness={visualVersion === 'v3' ? 0 : 0.15}
        surfaceMap={concreteTexture}
      />
      <CulvertCrossing position={[SCENE_LANDMARKS.culvert[0], 0.03, SCENE_LANDMARKS.culvert[2]]} rotation={2.45} visualVersion={visualVersion} />
      <CulvertDrainDetails
        start={SWALE_START}
        end={SWALE_END}
        crossing={[SCENE_LANDMARKS.culvert[0], SCENE_LANDMARKS.culvert[2]]}
        detailed={detailedSiteAssetsReady}
        visualVersion={visualVersion}
      />
      {entranceShrubs.map((position, index) => {
        if (index % 3 === 0) return null
        const fallback = <Shrub position={position} scale={index % 2 ? 0.8 : 1} />
        return detailedSiteAssetsReady ? (
          <Suspense key={position.join('-')} fallback={fallback}>
            <DetailedBush position={position} scale={index % 2 ? 0.82 : 1.04} visualVersion={visualVersion} />
          </Suspense>
        ) : <group key={position.join('-')}>{fallback}</group>
      })}
      <FlaxField placements={flaxPlacements} visualVersion={visualVersion} />
      {visualVersion === 'v3' ? <V3ColoredTussockField normal={normalTussocks} reserve={reserveTussocks} /> : <>
        <TussockField placements={normalTussocks} accentPlacements={combinedTussockAccents} visualVersion={visualVersion} />
        <TussockField placements={reserveTussocks} reserve visualVersion={visualVersion} />
      </>}
      <ShrubField placements={shrubs} visualVersion={visualVersion} />
      {detailedSiteAssetsReady ? (
        <>
          <InstancedStaticAssetField path={NATURE_ASSETS.purpleFlower} placements={purpleFlowerPlacements} visualVersion={visualVersion} />
          <InstancedStaticAssetField path={NATURE_ASSETS.yellowFlower} placements={yellowFlowerPlacements} visualVersion={visualVersion} />
          <InstancedStaticAssetField path={NATURE_ASSETS.grass} placements={grassPlacements} visualVersion={visualVersion} />
          <InstancedStaticAssetField path={NATURE_ASSETS.rockA} placements={rockAPlacements} visualVersion={visualVersion} />
          <InstancedStaticAssetField path={NATURE_ASSETS.rockC} placements={rockCPlacements} visualVersion={visualVersion} />
          <InstancedStaticAssetField path={NATURE_ASSETS.flatRock} placements={flatRockPlacements} visualVersion={visualVersion} />
        </>
      ) : null}

      {/* The two visible ponds and planted wetland lie south-west of the site. */}
      <GroundPolygon
        points={RESERVE_EDGE}
        y={-0.01}
        color={visualVersion === 'v3' ? v3GroundTreatment.reserveGrass : '#526f5a'}
        roughness={visualVersion === 'v3' ? v3GroundTreatment.grassRoughness : 1}
        envMapIntensity={visualVersion === 'v3' ? v3GroundTreatment.grassEnvMapIntensity : 1}
        surfaceMap={grassTexture}
      />
      {visualVersion === 'v3' ? (
        <GroundPolygonSet
          polygons={V3_SHARED_POND_POLYGONS}
          y={-0.34}
          color={v3GroundTreatment.water}
          roughness={v3GroundTreatment.waterRoughness}
          metalness={0}
          envMapIntensity={v3GroundTreatment.waterEnvMapIntensity}
          surfaceNormalMap={waterNormalTexture}
        />
      ) : <>
      <GroundPolygon
        points={WETLAND_POND_A}
        y={-0.34}
        color="#304f50"
        roughness={0.25}
        metalness={0.15}
        envMapIntensity={ALIFE_PBR.envMapIntensity}
        surfaceNormalMap={waterNormalTexture}
      />
      <GroundPolygon
        points={WETLAND_POND_B}
        y={-0.34}
        color="#304f50"
        roughness={0.25}
        metalness={0.15}
        envMapIntensity={ALIFE_PBR.envMapIntensity}
        surfaceNormalMap={waterNormalTexture}
      />
      </>}

      {/* The photographed two-leaf gate sits in the same low picket line as
          the frontage fence, inside the property and after the culvert. */}
      <ClosedVehicleGate left={[-38.2, 4.5]} right={[-33.6, 8.3]} visualVersion={visualVersion} fenceSegments={visualVersion === 'v3' ? SITE_FENCE_SEGMENTS : undefined} />
      {visualVersion !== 'v3' ? <FenceNetwork segments={SITE_FENCE_SEGMENTS} visualVersion={visualVersion} /> : null}

      {/* The real frontage uses one continuous clipped hedge below the rails,
          with taller flax concentrated at the gate and the elevation ends. */}
      <LowHedgeNetwork segments={STREET_FENCE_PLANTING_SEGMENTS} visualVersion={visualVersion} />
      <ChurchBuilding visualVersion={visualVersion} showFoyerFlags={showFoyerFlags} />

      {/* Warm uplights along the public street elevation. Every coordinate is
          outside the building footprint; the first two were previously inside. */}
      <UplightField placements={[[-21.4, 14.7], [-16.4, 18.7], [-8, 21], [1, 20], [7, 13]]} visualVersion={visualVersion} />

      {/* Street light poles stop either side of the cross and wordmark sightline. */}
      <StreetLightField placements={[[-22, 0, 15.5], [-5.4, 0, 21.7], [4.4, 0, 18.4], [12, 0, 11]]} visualVersion={visualVersion} />

      </group>
    </>
  )
}

const reviewShaderFrameQueues = new WeakMap<WebGLRenderer, ReturnType<typeof createVirtualChurchShaderFrameQueue>>()
const reviewStartupSubmissions = new WeakMap<WebGLRenderer, ReturnType<typeof createVirtualChurchStartupSubmissions>>()
const reviewShaderProgramAssociations = new WeakMap<WebGLRenderer, NonNullable<ReturnType<typeof createVirtualChurchShaderProgramAssociations>>>()

// compile(scene) omits Three's internal background mesh. Use the public shader
// library with its exact background material/geometry flags, and a metadata-only
// cube texture: no conversion, upload, visible mesh or extra render target.
const createVirtualChurchSkyShaderPreparation = (background: Texture) => {
  const cube = new CubeTexture()
  cube.colorSpace = background.colorSpace
  cube.isRenderTargetTexture = true
  const geometry = new BoxGeometry(1, 1, 1)
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')
  const material = new ShaderMaterial({
    name: 'BackgroundCubeMaterial',
    uniforms: UniformsUtils.clone(ShaderLib.backgroundCube.uniforms),
    vertexShader: ShaderLib.backgroundCube.vertexShader,
    fragmentShader: ShaderLib.backgroundCube.fragmentShader,
    side: BackSide, depthTest: false, depthWrite: false, fog: false, allowOverride: false,
  })
  material.uniforms.envMap.value = cube
  Object.defineProperty(material, 'envMap', { get() { return this.uniforms.envMap.value } })
  material.toneMapped = ColorManagement.getTransfer(background.colorSpace) !== SRGBTransfer
  const mesh = new ThreeMesh(geometry, material)
  let disposed = false
  return { mesh, dispose: () => {
    if (disposed) return
    disposed = true
    geometry.dispose(); material.dispose(); cube.dispose()
  } }
}

const usePreparedReviewAsset = (model: Object3D, enabled: boolean, warmSceneTransmission = false, requireSubmittedFrame = true, diagnosticSource?: VirtualChurchShaderSource, compilePriority: 1 | 2 = 1) => {
  const { gl, camera, scene, invalidate } = useThree()
  const [prepared, setPrepared] = useState(!enabled)

  useLayoutEffect(() => {
    const context = gl.getContext()
    const extension = enabled ? context.getExtension('KHR_parallel_shader_compile') : null
    if (!extension) {
      setPrepared(true)
      return
    }

    setPrepared(false)
    const frameAtMount = gl.info.render.frame
    const cancelParentSubmission = requireSubmittedFrame ? reviewStartupSubmissions.get(gl)?.request(frameAtMount) : undefined
    let cancelRevealSubmission: (() => void) | undefined
    let programs: NonNullable<typeof gl.info.programs> | null = null
    let linkingComplete = false
    let nextProgram = 0
    let introspectionStarted = false
    let skyPreparation: ReturnType<typeof createVirtualChurchSkyShaderPreparation> | null = null
    let skyReleaseFrame = 0
    // Fixed diagnostic labels only; ordinary visits record no shader timings.
    const shaderOwner = !requireSubmittedFrame ? 'scene' : warmSceneTransmission ? 'church' : 'character'
    const shaderTracePhase = profile3DEnabled ? profile3DSearchParams.get('profile3dStartupPasses') : null
    const traceEnabled = shaderTracePhase === '1' || shaderTracePhase === 'assets' || shaderTracePhase === 'all'
    // No properties reads, model traversal or association cache on normal visits.
    let programAssociations = traceEnabled ? reviewShaderProgramAssociations.get(gl) : undefined
    if (traceEnabled && !programAssociations) {
      programAssociations = createVirtualChurchShaderProgramAssociations(true, gl.properties)!
      reviewShaderProgramAssociations.set(gl, programAssociations)
    }
    if (requireSubmittedFrame) programAssociations?.register(model, diagnosticSource ?? (warmSceneTransmission ? 'church' : 'character'))
    if (!requireSubmittedFrame && model === scene && programAssociations) {
      const floorPreparation = scene.getObjectByName('vc:foyer-floor-shader-preparation')
      if (floorPreparation) programAssociations.register(floorPreparation, 'surface')
    }
    const traceShaderQuery = createVirtualChurchShaderIntrospectionTrace(
      traceEnabled, shaderOwner,
      () => performance.now(), (name, startTime) => performance.mark(name, { startTime }),
      context,
    )
    const markShaderStage = (stage: string) => {
      if (profile3DEnabled) performance.mark(`vc:shader:${shaderOwner}:${stage}`)
    }
    const traceShaderStage = (stage: 'compile' | 'transmission' | 'backface', work: () => void) => {
      markShaderStage(`${stage}-start`)
      try { work() } finally { markShaderStage(`${stage}-end`) }
    }
    const compile = (object: Object3D, stage: 'compile' | 'transmission' | 'backface') => {
      const materials = gl.compile(object, camera, scene)
      if (programAssociations) {
        const summary = programAssociations.compiled(materials, stage, (id, source, variant) => {
          performance.mark(`vc:shader:${shaderOwner}:${stage}-selected-p${id}-s${source}-f${variant.features}-o${variant.output}-t${variant.tone}-e${variant.environment}-l${variant.lights.join('_')}-s${variant.shadows.join('_')}`)
        })
        performance.mark(`vc:shader:${shaderOwner}:${stage}-set-m${summary.materials}-p${summary.programs}-limit${Number(summary.truncated)}`)
        performance.mark(`vc:shader:${shaderOwner}:${stage}-selection-n${summary.selected}-limit${Number(summary.selectionTruncated)}`)
      }
    }
    let frameQueue = reviewShaderFrameQueues.get(gl)
    if (!frameQueue) {
      frameQueue = createVirtualChurchShaderFrameQueue(
        (callback) => requestAnimationFrame(callback),
        (frame) => cancelAnimationFrame(frame),
      )
      reviewShaderFrameQueues.set(gl, frameQueue)
    }
    const cancelWarmup = scheduleVirtualChurchShaderWarmup({
      now: () => performance.now(),
      // Submit an arriving model before older introspection slices, but only
      // after its environment/parent frame exists. Prioritising waiting jobs
      // would starve the initial scene that must render that parent frame.
      requestFrame: callback => frameQueue.requestFrame(callback, () =>
        programs === null && !!scene.environment
        && (!requireSubmittedFrame || gl.info.render.frame > frameAtMount) ? compilePriority : false),
      cancelFrame: frameQueue.cancelFrame,
      contextLost: () => context.isContextLost(),
      finish: () => {
        // Timeout/error also resumes the normal, shader-error-checked renderer.
        cancelParentSubmission?.()
        cancelRevealSubmission = reviewStartupSubmissions.get(gl)?.request(gl.info.render.frame)
        setPrepared(true)
        invalidate()
        if (skyPreparation) {
          // Releasing the temporary material before the internal background
          // acquires its programs would destroy the precompiled cache entries.
          const frameAtFinish = gl.info.render.frame
          const releaseAfterSubmission = () => {
            if (context.isContextLost() || gl.info.render.frame > frameAtFinish) {
              skyPreparation?.dispose(); skyPreparation = null
            } else {
              skyReleaseFrame = frameQueue.requestFrame(releaseAfterSubmission)
            }
          }
          skyReleaseFrame = frameQueue.requestFrame(releaseAfterSubmission)
        }
      },
      onError: (error) => console.warn('Review asset shader warm-up failed; using normal rendering.', error),
      step: () => {
        if (programs === null) {
          // Parent environment effects and the renderer's shadow setup must
          // settle first, or the real frame recompiles different variants.
          if (!scene.environment || (requireSubmittedFrame && gl.info.render.frame <= frameAtMount)) {
            invalidate()
            return false
          }
          if (!requireSubmittedFrame && model === scene && scene.background && 'isTexture' in scene.background) {
            skyPreparation = createVirtualChurchSkyShaderPreparation(scene.background)
            programAssociations?.register(skyPreparation.mesh, 'sky')
          }
          traceShaderStage('compile', () => {
            compile(model, 'compile')
            if (skyPreparation) compile(skyPreparation.mesh, 'compile')
          })
          // The same queue also prepares normal V3 arrivals before deferred
          // postprocessing. Without glass transmission there is no linear pass:
          // do not allocate a target or compile unused variants on mobile.
          if (perfConfig.glassTransmission) {
            const target = new WebGLRenderTarget(1, 1)
            const previousTarget = gl.getRenderTarget()
            const previousFace = gl.getActiveCubeFace()
            const previousMip = gl.getActiveMipmapLevel()
            try {
              gl.setRenderTarget(target)
              // The church introduces transmission for the whole visible scene.
              // Preparing only its glass misses the surrounding opaque materials
              // that are rendered into the newly created linear transmission pass.
              traceShaderStage('transmission', () => {
                compile(warmSceneTransmission ? scene : model, 'transmission')
                if (skyPreparation) compile(skyPreparation.mesh, 'transmission')
              })
              if (warmSceneTransmission) {
                const glassMaterials = new Set<MeshPhysicalMaterial>()
                model.traverse(object => {
                  if (!('isMesh' in object) || !object.isMesh) return
                  const mesh = object as Mesh
                  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                    if (material instanceof MeshPhysicalMaterial && material.transmission > 0 && material.side === DoubleSide) glassMaterials.add(material)
                  }
                })
                // Three's transmission pass also draws the back face of opaque,
                // double-sided glass; compile() does not prepare that variant.
                try {
                  glassMaterials.forEach(material => { material.side = BackSide; material.needsUpdate = true })
                  if (glassMaterials.size > 0) traceShaderStage('backface', () => { compile(model, 'backface') })
                } finally {
                  glassMaterials.forEach(material => { material.side = DoubleSide; material.needsUpdate = true })
                }
              }
            } finally {
              gl.setRenderTarget(previousTarget, previousFace, previousMip)
              target.dispose()
            }
          }
          programs = [...(gl.info.programs ?? [])]
          return false
        }
        if (!linkingComplete) {
          linkingComplete = programs.every(({ program }) => !program || context.getProgramParameter(
            program as WebGLProgram,
            extension.COMPLETION_STATUS_KHR,
          ))
          if (!linkingComplete) return false
        }
        // Some drivers still block during the first program introspection even
        // after linking. Yield between programs; a single driver call itself
        // cannot be interrupted, so 8 ms is a yield target, not a hard bound.
        if (!introspectionStarted) {
          introspectionStarted = true
          markShaderStage('introspection-start')
        }
        const sliceStartedAt = performance.now()
        while (nextProgram < programs.length) {
          const program = programs[nextProgram++]
          if (program.program) {
            if (traceShaderQuery) traceShaderQuery(program, programAssociations?.describe(program))
            else program.getUniforms()
          }
          if (performance.now() - sliceStartedAt >= 8) break
        }
        const complete = nextProgram === programs.length
        if (complete) markShaderStage('introspection-end')
        return complete
      },
    })
    return () => {
      cancelWarmup()
      frameQueue.cancelFrame(skyReleaseFrame)
      cancelParentSubmission?.()
      cancelRevealSubmission?.()
      skyPreparation?.dispose(); skyPreparation = null
    }
  }, [camera, enabled, gl, invalidate, model, scene, warmSceneTransmission, requireSubmittedFrame, diagnosticSource, compilePriority])

  return prepared
}

// The loading cover remains visible while the same scene's programs are linked
// and inspected in the existing per-renderer queue. A positive frame priority
// suppresses R3F's automatic loading submissions but keeps requested parent and
// reveal frames. Both current-route rendered-ready signals restore ordinary
// demand rendering. No separate scene, reduced material or extra Canvas.
const InitialSceneShaderPreparation = () => {
  const { gl, scene, camera, invalidate } = useThree()
  const [controlled, setControlled] = useState(true)
  const mountedAt = useRef(performance.now())
  useLayoutEffect(() => {
    const submissions = createVirtualChurchStartupSubmissions()
    reviewStartupSubmissions.set(gl, submissions)
    submissions.request(gl.info.render.frame)
    return () => {
      submissions.clear()
      if (reviewStartupSubmissions.get(gl) === submissions) reviewStartupSubmissions.delete(gl)
    }
  }, [gl])
  useLayoutEffect(() => {
    // Three lazily queries this immutable limit on the first anisotropic map.
    // Reading it before environment/scene submissions avoids a synchronous
    // driver round trip in the wordmark draw. Three owns the per-context cache;
    // keep the original filtering quality and shader-error checks unchanged.
    if (profile3DEnabled) performance.mark('vc:capabilities:anisotropy-start')
    try { gl.capabilities.getMaxAnisotropy() }
    finally { if (profile3DEnabled) performance.mark('vc:capabilities:anisotropy-end') }
  }, [gl])
  useLayoutEffect(() => {
    const preparation = createVirtualChurchFoyerFloorShaderPreparation()
    scene.add(preparation.mesh)
    return () => { scene.remove(preparation.mesh); preparation.dispose() }
  }, [scene])
  const prepared = usePreparedReviewAsset(scene, true, true, false)
  useFrame(() => {
    if (!controlled) return
    if (gl.getContext().isContextLost()) { setControlled(false); return }
    if (!prepared || document.visibilityState !== 'visible') return
    if (virtualChurchDeferredCanStart(
      document.documentElement.getAttribute(VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE),
      document.documentElement.getAttribute(VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE),
      mountedAt.current, true,
    )) {
      reviewStartupSubmissions.get(gl)?.clear()
      reviewStartupSubmissions.delete(gl)
      setControlled(false)
      invalidate()
      return
    }
    if (reviewStartupSubmissions.get(gl)?.needsFrame(gl.info.render.frame)) {
      gl.render(scene, camera)
      // Ordinary asset callbacks observe this completed submission next frame.
      invalidate()
    }
  }, controlled || !prepared ? 1 : 0)
  return null
}

type GateASkinnedHeroProps = {
  movementRef: MovementRef
  outfitId: OutfitId
  assetPath: string
  characterReview: VirtualChurchCharacterMotionProfile | null
  sharedMotion?: GLTF
}

const GateASkinnedFemaleHero = ({
  movementRef,
  outfitId,
  assetPath,
  characterReview,
  sharedMotion,
}: GateASkinnedHeroProps) => {
  const { invalidate, gl } = useThree()
  const originalMapBatchEnabled = virtualChurchShouldBatchOriginalOutfitMaps({
    visualVersion: config3D.visualVersion,
    characterReview,
    isDevelopment: import.meta.env.DEV,
    reviewOverride: new URLSearchParams(window.location.search).get('vcOriginalMapBatch'),
  })
  const gltf = useLoader(GLTFLoader, assetPath, (loader) => {
    loader.setDRACOLoader(VIRTUAL_CHURCH_DRACO_LOADER)
  }) as GLTF
  // A GLTF can resolve even when one of its image dependencies fails. Do not
  // reveal an incomplete, untextured avatar as the finished character.
  assertVirtualChurchGltfTextures(gltf)
  const sourceClips = useMemo(
    () => {
      if (sharedMotion) return composeVirtualChurchSharedMotion(gltf, sharedMotion)
      if (gltf.parser.json.extras?.alifeLodMotionBinding) {
        throw new VirtualChurchSharedMotionError('Split character requires its shared motion package', gltf)
      }
      return gltf.animations
    },
    [gltf, sharedMotion],
  )
  useEffect(() => {
    const release = VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(assetPath, gltf)
    if (profile3DEnabled) {
      virtualChurchCharacterActiveAssetPath = assetPath
      updateVirtualChurchCharacterResourceDiagnostic()
    }
    return () => {
      release()
      if (
        profile3DEnabled
        && virtualChurchCharacterActiveAssetPath === assetPath
      ) {
        virtualChurchCharacterActiveAssetPath = null
        queueMicrotask(updateVirtualChurchCharacterResourceDiagnostic)
      }
    }
  }, [assetPath, gltf])
  const modelBundle = useMemo(() => {
    if (profile3DEnabled) performance.mark('vc:character:prepare-start')
    const cloned = cloneSkeleton(gltf.scene)
    shareVirtualChurchOwnedCloneSkeletons(cloned)
    cloned.name = 'GateA_HeroFemale_Skinned'
    cloned.traverse((child: Object3D) => {
      if (!('isMesh' in child) || !child.isMesh) return
      const mesh = child as ThreeMesh
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const clonedMaterials = sourceMaterials.map((material) => {
        if (
          gateAIsSkinMaterial(material.name)
          && material instanceof MeshStandardMaterial
        ) {
          const skinMaterial = new MeshBasicMaterial({
            name: material.name,
            color: GATE_A_SKIN_UNLIT_COLOR,
            map: material.map,
            alphaMap: material.alphaMap,
            alphaTest: material.alphaTest,
            opacity: material.opacity,
            transparent: material.transparent,
            side: material.side,
            depthTest: material.depthTest,
            depthWrite: material.depthWrite,
            vertexColors: material.vertexColors,
            toneMapped: false,
          })
          if (gateAUsesOpaqueAlphaPath(skinMaterial.name)) {
            skinMaterial.alphaTest = 0
          }
          return skinMaterial
        }
        // Blender's VRoid conversion writes zero-strength clearcoat/specular
        // extensions on every slot. GLTFLoader consequently creates expensive
        // MeshPhysicalMaterial programs even though those lobes contribute no
        // visible light. The live avatar uses the equivalent standard PBR
        // inputs; the authored colour/normal/alpha textures remain unchanged.
        const clonedMaterial = material instanceof MeshStandardMaterial
          ? new MeshStandardMaterial().copy(material)
          : material.clone()
        if (clonedMaterial instanceof MeshStandardMaterial) {
          // VRoid also exports an opaque-black emissive texture for every
          // non-skin slot. It is mathematically inert but costs a texture fetch
          // per fragment. The fair skin slots take the unlit path above.
          clonedMaterial.emissiveMap = null
          clonedMaterial.emissive.set('#000000')
          clonedMaterial.emissiveIntensity = 0
          // Five exported MASK slots have fully opaque BaseColor alpha.
          // Removing their impossible discard branch is pixel-equivalent and
          // keeps the genuinely cut-out body, clothes, eyes and hair cards.
          if (gateAUsesOpaqueAlphaPath(clonedMaterial.name)) {
            clonedMaterial.alphaTest = 0
          }
        }
        return clonedMaterial
      })
      mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0]
      // The VRoid mesh has eighteen material groups. Casting the 2048 px
      // directional shadow map redraws every group and more than doubles the
      // entrance-view frame cost on the reference desktop. The scene already
      // supplies the avatar's grounding/contact treatment; receive the world
      // shadow, but do not submit this multi-material skinned mesh to the
      // expensive shadow pass.
      mesh.castShadow = false
      mesh.receiveShadow = true
    })
    const outfitBatch = originalMapBatchEnabled ? createVirtualChurchOutfitBatch(cloned, sourceClips, gl.capabilities.maxTextures) : null
    const staticBoneMatrices = config3D.visualVersion === 'v3'
      ? freezeVirtualChurchUnanimatedCloneBoneMatrices(cloned, sourceClips)
      : null
    if (profile3DEnabled) performance.mark('vc:character:prepare-end')
    return { model: cloned, outfitBatch, staticBoneMatrices }
  }, [gltf.scene, originalMapBatchEnabled, sourceClips, gl])
  const { model, outfitBatch, staticBoneMatrices } = modelBundle
  useEffect(() => {
    if (!originalMapBatchEnabled || !profile3DEnabled) return
    document.documentElement.setAttribute('data-virtual-church-outfit-batch', JSON.stringify(outfitBatch?.supported
      ? { supported: true, parts: outfitBatch.parts.length, maps: outfitBatch.maps.length }
      : { supported: false, reason: outfitBatch?.reason }))
    return () => document.documentElement.removeAttribute('data-virtual-church-outfit-batch')
  }, [originalMapBatchEnabled, outfitBatch])
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const cleanupGuard = useMemo(
    () => createVirtualChurchStrictModeCleanupGuard(),
    [],
  )
  const animationClips = useMemo(
    () => gateARefineFemaleWalkGait(
      sourceClips,
      characterReview === null || characterReview === 'female' || characterReview.startsWith('female-'),
    ),
    [characterReview, sourceClips],
  )
  const actions = useMemo(
    () => new Map(animationClips.map((clip) => [clip.name, mixer.clipAction(clip)])),
    [animationClips, mixer],
  )
  const animationDurations = useMemo(() => {
    const durations = {
      ...gateAAnimationContract.durationsSeconds,
    } as Record<GateAAnimationName, number>
    animationClips.forEach((clip) => {
      if (
        clip.name in durations
        && Number.isFinite(clip.duration)
        && clip.duration > 0
      ) {
        durations[clip.name as GateAAnimationName] = clip.duration
      }
    })
    return durations
  }, [animationClips])
  const activeActionRef = useRef<GateAAnimationName | ''>('')
  const idleVariantRef = useRef<'Idle_A' | 'Idle_B'>('Idle_A')
  const idleElapsedRef = useRef(0)
  const idleMixerDeltaRef = useRef(0)
  const reviewGaitBlendRef = useRef<GateAReviewGaitBlend | null>(null)
  const usesDistanceMatchedMotion = config3D.visualVersion === 'v3'
  const prepareCharacterShaders = config3D.visualVersion === 'v3' || (characterReview !== null && !perfConfig.postProcessing)
  const prepared = usePreparedReviewAsset(model, prepareCharacterShaders, false, true, 'character', config3D.visualVersion === 'v3' ? 2 : 1)
  const [poseReady, setPoseReady] = useState(false)
  const [appearanceReady, setAppearanceReady] = useState(false)
  const avatarReady = prepared && poseReady && appearanceReady
  useVirtualChurchRenderedAssetSignal(model, VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE, avatarReady)
  const measurements = useMemo(() => {
    const bounds = new Box3().setFromObject(model)
    const size = bounds.getSize(new Vector3())
    const scale = SCENE_SCALE.adultHeight / Math.max(size.y, 0.01)
    return { scale, groundOffset: -bounds.min.y * scale }
  }, [model])

  const reviewOutfitBaseColors = useMemo(() => {
    const colors = new Map<Material, Color>()
    if (!characterReview) return colors
    model.traverse((child: Object3D) => {
      if (!('material' in child)) return
      const material = (child as Object3D & { material: Material | Material[] }).material
      for (const item of Array.isArray(material) ? material : [material]) {
        if (gateAIsOutfitMaterial(item.name) && item instanceof MeshStandardMaterial) {
          colors.set(item, item.color.clone())
        }
      }
    })
    return colors
  }, [characterReview, model])

  useLayoutEffect(() => {
    const tint = new Color(gateAOutfitMaterialTint(outfitId))
    model.traverse((child: Object3D) => {
      if (!('material' in child)) return
      const material = (child as Object3D & { material: Material | Material[] }).material
      const materials = Array.isArray(material) ? material : [material]
      materials.forEach((item) => {
        if (!gateAIsOutfitMaterial(item.name) || !('color' in item)) return
        const colorMaterial = item as Material & { color: Color }
        // Review assets may carry authored GLB baseColorFactor (e.g. the
        // emerald coat). Keep it while leaving released r8 behaviour intact.
        gateAApplyOutfitMaterialTint(colorMaterial.color, tint, reviewOutfitBaseColors.get(item))
      })
    })
    // The first visible frame must use the selected wardrobe, not the GLB's
    // authored base colours. Keep the avatar hidden until this commit lands.
    setAppearanceReady(true)
    invalidate()
  }, [invalidate, model, outfitId, reviewOutfitBaseColors])

  useLayoutEffect(() => {
    cleanupGuard.activate()
    document.documentElement.setAttribute(
      VIRTUAL_CHURCH_CHARACTER_ACTION_ATTRIBUTE,
      'Idle_A',
    )
    const idle = actions.get('Idle_A')
    idle
      ?.reset()
      .setLoop(LoopRepeat, Infinity)
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .play()
    // Apply the reviewed idle pose before the first visible scene frame.
    // A fade from zero weight exposes the GLB's T-pose while it loads.
    mixer.update(0)
    setPoseReady(true)
    activeActionRef.current = 'Idle_A'
    idleVariantRef.current = 'Idle_A'
    idleElapsedRef.current = 0
    idleMixerDeltaRef.current = 0
    reviewGaitBlendRef.current = null

    return () => {
      document.documentElement.removeAttribute(VIRTUAL_CHURCH_CHARACTER_ACTION_ATTRIBUTE)
      cleanupGuard.release(() => {
        mixer.stopAllAction()
        mixer.uncacheRoot(model)
        if (staticBoneMatrices?.supported) staticBoneMatrices.restore()
        if (outfitBatch?.supported) outfitBatch.dispose()
        disposeVirtualChurchCharacterSkeletons(model)
        model.traverse((child: Object3D) => {
          if (!('material' in child)) return
          const material = (child as Object3D & { material: Material | Material[] }).material
          const materials = Array.isArray(material) ? material : [material]
          materials.forEach((item) => item.dispose())
        })
      })
    }
  }, [actions, cleanupGuard, mixer, model, outfitBatch, staticBoneMatrices])

  useFrame((_, delta) => {
    const motion = movementRef.current
    const isIdle = motion.avatarState === 'idle'
    if (isIdle) {
      idleElapsedRef.current += Math.min(delta, 0.05)
      const idleDuration = idleVariantRef.current === 'Idle_A' ? 7.5 : 2.4
      if (idleElapsedRef.current >= idleDuration) {
        idleVariantRef.current = idleVariantRef.current === 'Idle_A' ? 'Idle_B' : 'Idle_A'
        idleElapsedRef.current = 0
      }
    } else {
      idleVariantRef.current = 'Idle_A'
      idleElapsedRef.current = 0
    }

    const nextAction = gateAAnimationForMotionState(
      motion.avatarState,
      idleVariantRef.current,
    )

    if (activeActionRef.current !== nextAction) {
      const previousAction = activeActionRef.current || null
      const previousMixerAction = previousAction
        ? actions.get(previousAction)
        : undefined
      const syncLocomotionPhase = gateAAnimationShouldSyncLocomotionPhase(
        previousAction,
        nextAction,
      )
      const transitionSeconds = gateAAnimationTransitionSeconds(
        previousAction,
        nextAction,
      )
      const reviewGaitCrossfade = usesDistanceMatchedMotion && syncLocomotionPhase
      const currentWalkWeight = gateAReviewContributingActionWeight(actions.get('Walk'))
      const currentRunWeight = gateAReviewContributingActionWeight(actions.get('Run'))
      if (usesDistanceMatchedMotion && reviewGaitBlendRef.current && !syncLocomotionPhase) {
        // A stop, turn or jump interrupts both sides of an unfinished blend.
        actions.get('Walk')?.fadeOut(transitionSeconds)
        actions.get('Run')?.fadeOut(transitionSeconds)
        reviewGaitBlendRef.current = null
      }
      if (!syncLocomotionPhase) {
        previousMixerAction?.fadeOut(transitionSeconds)
      }
      const action = actions.get(nextAction)
      if (action) {
        const oneShot = gateAAnimationIsOneShot(
          nextAction,
          gateAAnimationContract.oneShotClips,
        )
        const repeatingTurn = nextAction === 'Turn_L' || nextAction === 'Turn_R'
        const resumeReviewLoop = usesDistanceMatchedMotion && (
          (previousAction === 'Walk_Stop' && nextAction === 'Walk')
          || (previousAction === 'Run_Stop' && nextAction === 'Run')
        )
        const previousLoopTime = action.time
        action.reset()
        action.enabled = true
        if (usesDistanceMatchedMotion) action.setEffectiveWeight(1)
        action.clampWhenFinished = oneShot && !repeatingTurn
        action.setLoop(
          oneShot && !repeatingTurn ? LoopOnce : LoopRepeat,
          oneShot && !repeatingTurn ? 1 : Infinity,
        )
        action.setEffectiveTimeScale(
          gateAAnimationPlaybackScale(
            nextAction,
            animationDurations,
            GATE_A_PHASE_DURATIONS,
          ) * gateATurnPlaybackScale(
            nextAction,
            animationDurations,
            PLAYER_TURN_SPEED,
          ),
        )
        if (syncLocomotionPhase && previousMixerAction) {
          action.time = gateASynchronizedLocomotionTime(
            previousMixerAction.time,
            previousMixerAction.getClip().duration,
            action.getClip().duration,
          )
          action.play()
          if (reviewGaitCrossfade) {
            reviewGaitBlendRef.current = {
              fromWalkWeight: currentWalkWeight + currentRunWeight > 0
                ? currentWalkWeight / (currentWalkWeight + currentRunWeight)
                : previousAction === 'Walk' ? 1 : 0,
              toWalkWeight: nextAction === 'Walk' ? 1 : 0,
              remaining: transitionSeconds,
              duration: transitionSeconds,
            }
          } else {
            action.crossFadeFrom(previousMixerAction, transitionSeconds, false)
          }
        } else {
          if (usesDistanceMatchedMotion) {
            action.time = resumeReviewLoop
              ? gateASynchronizedLocomotionTime(previousLoopTime, action.getClip().duration, action.getClip().duration)
              : gateAReviewLoopJoinTime(previousAction, nextAction, action.getClip().duration)
          }
          action.fadeIn(transitionSeconds).play()
        }
      }
      activeActionRef.current = nextAction
      document.documentElement.setAttribute(
        VIRTUAL_CHURCH_CHARACTER_ACTION_ATTRIBUTE,
        nextAction,
      )
    }

    const activeAction = actions.get(activeActionRef.current)
    const reviewGaitBlend = reviewGaitBlendRef.current
    const walkAction = actions.get('Walk')
    const runAction = actions.get('Run')
    if (usesDistanceMatchedMotion && reviewGaitBlend && walkAction && runAction) {
      const frame = gateAReviewGaitBlendFrame(
        reviewGaitBlend, Math.min(delta, 0.05), motion.travelledSpeedMps,
        walkAction.getClip().duration, runAction.getClip().duration,
        gateACharacterWalkSpeed(characterReview), gateACharacterRunSpeed(characterReview),
      )
      walkAction.setEffectiveWeight(frame.walkWeight).setEffectiveTimeScale(frame.walkRate)
      runAction.setEffectiveWeight(frame.runWeight).setEffectiveTimeScale(frame.runRate)
      reviewGaitBlend.remaining = frame.remaining
      if (frame.remaining === 0) {
        reviewGaitBlendRef.current = null
        if (frame.walkWeight === 0) walkAction.enabled = false
        if (frame.runWeight === 0) runAction.enabled = false
      }
    } else if (
      activeActionRef.current === 'Walk'
      || activeActionRef.current === 'Run'
    ) {
      activeAction?.setEffectiveTimeScale(selectedGateALocomotionPlaybackScale(
        characterReview,
        activeActionRef.current,
        motion.movementIntensity,
        motion.travelledSpeedMps,
        usesDistanceMatchedMotion,
      ))
    }
    const mixerDelta = Math.min(delta, 0.05)
    if (isIdle && !perfConfig.isMobile) {
      // The 187-bone VRoid idle is intentionally subtle at the 6.2 m play
      // camera. Evaluate it at a stable 30 Hz while the renderer and input
      // loop continue at display cadence. Locomotion, turns, jumps and greet
      // always flush the accumulated time and remain full-frame-rate.
      idleMixerDeltaRef.current += mixerDelta
      if (idleMixerDeltaRef.current >= GATE_A_DESKTOP_IDLE_MIXER_INTERVAL_SECONDS) {
        mixer.update(idleMixerDeltaRef.current)
        idleMixerDeltaRef.current = 0
      }
    } else {
      mixer.update(mixerDelta + idleMixerDeltaRef.current)
      idleMixerDeltaRef.current = 0
    }
    invalidate()
  })

  return (
    <primitive
      object={model}
      visible={avatarReady}
      scale={measurements.scale}
      position={[0, measurements.groundOffset, 0]}
    />
  )
}

const GateASharedMotionReviewHero = ({ motionPath, fallback, ...props }: GateASkinnedHeroProps & {
  motionPath: string; fallback: ReactNode
}) => {
  const motion = useLoader(GLTFLoader, motionPath) as GLTF
  useEffect(() => {
    const release = VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(motionPath, motion)
    if (profile3DEnabled) {
      document.documentElement.setAttribute('data-virtual-church-character-motion', JSON.stringify({
        path: motionPath, clips: motion.animations.length,
        tracks: motion.animations.reduce((count, clip) => count + clip.tracks.length, 0),
      }))
      updateVirtualChurchCharacterResourceDiagnostic()
    }
    return () => {
      release()
      if (profile3DEnabled) document.documentElement.removeAttribute('data-virtual-church-character-motion')
    }
  }, [motion, motionPath])
  // Commit the motion owner while the character is still loading, so a failed
  // model load/switch also releases the already decoded motion package.
  return <Suspense fallback={fallback}><GateASkinnedFemaleHero {...props} sharedMotion={motion} /></Suspense>
}

class OptionalSharedMotionBoundary extends Component<
  { motionPath: string; children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    // Corrupt character geometry/skin still belongs to the outer character
    // boundary. A missing optional motion review must not hide a sound model.
    if (error instanceof VirtualChurchSharedMotionError
      || error instanceof VirtualChurchGltfTextureIntegrityError) throw error
    console.warn('Optional character motion unavailable; using the standard character animation.', error)
    clearFailedGltfAsset(this.props.motionPath)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

class GateAHeroAssetBoundary extends Component<
  { assetPath: string; motionPath?: string | null; children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Gate A skinned Hero failed; hiding avatar until retry.', error, info)
    if (error instanceof VirtualChurchSharedMotionError
      || error instanceof VirtualChurchGltfTextureIntegrityError) {
      releaseLoadedGltfResource(this.props.assetPath, error.gltf)
    } else {
      clearFailedGltfAsset(this.props.assetPath)
    }
    if (this.props.motionPath) clearFailedGltfAsset(this.props.motionPath)
    document.documentElement.setAttribute(VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE, 'true')
    document.documentElement.setAttribute(
      VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE,
      window.performance.now().toFixed(1),
    )
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

class LegacyCharacterAssetBoundary extends Component<
  { assetPath: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn('Legacy character GLTF failed; hiding avatar until retry.', error, info)
    clearFailedGltfAsset(this.props.assetPath)
    document.documentElement.setAttribute(
      VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE,
      'true',
    )
    document.documentElement.setAttribute(
      VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE,
      window.performance.now().toFixed(1),
    )
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

const AnimatedPlayerAvatar = ({ movementRef, characterId, outfitId }: { movementRef: MovementRef; characterId: CharacterId; outfitId: OutfitId }) => {
  const { invalidate } = useThree()
  const assetPath = legacyCharacterAssetPath(characterId)
  const gltf = useLoader(GLTFLoader, assetPath) as GLTF
  const avatar = useMemo(() => {
    const cloned = cloneSkeleton(gltf.scene)
    const supportsWardrobe = characterId === 'pastor' || characterId === 'sister' || characterId === 'believerMan' || characterId === 'believerWoman'
    const wardrobeBaseColors = new Map<Material & { color: Color }, Color>()
    cloned.traverse((child: Object3D) => {
      if (!('material' in child)) return
      const mesh = child as Object3D & { material: Material | Material[] }
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const clonedMaterials = sourceMaterials.map((source) => {
        const material = source.clone() as Material & { color?: Color }
        if (
          supportsWardrobe
          && material.color
          && !/skin|hair|eye|eyebrow/i.test(material.name)
        ) {
          wardrobeBaseColors.set(
            material as Material & { color: Color },
            material.color.clone(),
          )
        }
        return material
      })
      mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0]
    })
    return { model: cloned, wardrobeBaseColors }
  }, [characterId, gltf.scene])
  const { model, wardrobeBaseColors } = avatar
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const cleanupGuard = useMemo(
    () => createVirtualChurchStrictModeCleanupGuard(),
    [],
  )
  const activeActionRef = useRef('')
  const poseWeightRef = useRef(0)
  const poseOffsetsRef = useRef({ hipsX: 0, torsoX: 0, upperLegLeftX: 0, upperLegRightX: 0, lowerLegLeftX: 0, lowerLegRightX: 0, shoulderLeftZ: 0, shoulderRightZ: 0 })
  const measurements = useMemo(() => {
    const bounds = new Box3().setFromObject(model)
    const size = bounds.getSize(new Vector3())
    const scale = SCENE_SCALE.adultHeight / Math.max(size.y, 0.01)
    return { scale, groundOffset: -bounds.min.y * scale }
  }, [model])
  const actions = useMemo(() => new Map(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)])), [gltf.animations, mixer])
  const [poseReady, setPoseReady] = useState(false)
  const [appearanceReady, setAppearanceReady] = useState(false)
  const avatarReady = poseReady && appearanceReady
  useVirtualChurchRenderedAssetSignal(model, VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE, avatarReady)
  const poseBones = useMemo(() => ({
    hips: model.getObjectByName('Hips'),
    torso: model.getObjectByName('Torso'),
    upperLegLeft: model.getObjectByName('UpperLeg.L'),
    upperLegRight: model.getObjectByName('UpperLeg.R'),
    lowerLegLeft: model.getObjectByName('LowerLeg.L'),
    lowerLegRight: model.getObjectByName('LowerLeg.R'),
    shoulderLeft: model.getObjectByName('Shoulder.L'),
    shoulderRight: model.getObjectByName('Shoulder.R'),
  }), [model])

  useEffect(
    () => VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(assetPath, gltf),
    [assetPath, gltf],
  )

  useLayoutEffect(() => {
    const tint = new Color(VIRTUAL_CHURCH_OUTFIT_SWATCHES[outfitId])
    const tintAmount = outfitId === 'classic' ? 0.12 : 0.42
    wardrobeBaseColors.forEach((baseColor, material) => {
      material.color.copy(baseColor).lerp(tint, tintAmount)
    })
    setAppearanceReady(true)
    invalidate()
  }, [invalidate, outfitId, wardrobeBaseColors])

  useLayoutEffect(() => {
    cleanupGuard.activate()
    model.traverse((child: Object3D) => {
      if ('isMesh' in child && child.isMesh) {
        const mesh = child as Object3D & { castShadow: boolean; receiveShadow: boolean }
    mesh.castShadow = false
        mesh.receiveShadow = true
      }
    })
    const idleName = actions.has(CHARACTER_IDLE_CLIPS[characterId]) ? CHARACTER_IDLE_CLIPS[characterId] : 'Idle'
    const idle = actions.get(idleName)
    idle?.reset().play()
    mixer.update(0)
    setPoseReady(true)
    activeActionRef.current = idleName
    return () => {
      cleanupGuard.release(() => {
        mixer.stopAllAction()
        mixer.uncacheRoot(model)
        disposeVirtualChurchCharacterSkeletons(model)
        model.traverse((child: Object3D) => {
          if (!('material' in child)) return
          const material = (child as Object3D & { material: Material | Material[] }).material
          const materials = Array.isArray(material) ? material : [material]
          materials.forEach((item) => item.dispose())
        })
      })
    }
  }, [actions, characterId, cleanupGuard, mixer, model])

  useFrame((_, delta) => {
    const input = movementRef.current
    const idleName = actions.has(CHARACTER_IDLE_CLIPS[characterId]) ? CHARACTER_IDLE_CLIPS[characterId] : 'Idle'
    const walking = input.avatarState === 'walkStart'
      || input.avatarState === 'walk'
      || input.avatarState === 'walkStop'
    const running = input.avatarState === 'runStart'
      || input.avatarState === 'run'
      || input.avatarState === 'runStop'
    const nextName = walking ? 'Walk' : running ? 'Run' : idleName
    if (activeActionRef.current !== nextName) {
      actions.get(activeActionRef.current)?.fadeOut(0.18)
      const nextAction = actions.get(nextName)
      nextAction?.reset().fadeIn(0.18).play()
      activeActionRef.current = nextName
    }
    const activeAction = actions.get(activeActionRef.current)
    if (activeActionRef.current === 'Walk') activeAction?.setEffectiveTimeScale(MathUtils.lerp(0.62, 1.18, input.movementIntensity))
    if (activeActionRef.current === 'Run') activeAction?.setEffectiveTimeScale(MathUtils.lerp(0.78, 1.16, input.movementIntensity))
    const clampedDelta = Math.min(delta, 0.05)
    const previous = poseOffsetsRef.current
    if (poseBones.hips) poseBones.hips.rotation.x -= previous.hipsX
    if (poseBones.torso) poseBones.torso.rotation.x -= previous.torsoX
    if (poseBones.upperLegLeft) poseBones.upperLegLeft.rotation.x -= previous.upperLegLeftX
    if (poseBones.upperLegRight) poseBones.upperLegRight.rotation.x -= previous.upperLegRightX
    if (poseBones.lowerLegLeft) poseBones.lowerLegLeft.rotation.x -= previous.lowerLegLeftX
    if (poseBones.lowerLegRight) poseBones.lowerLegRight.rotation.x -= previous.lowerLegRightX
    if (poseBones.shoulderLeft) poseBones.shoulderLeft.rotation.z -= previous.shoulderLeftZ
    if (poseBones.shoulderRight) poseBones.shoulderRight.rotation.z -= previous.shoulderRightZ
    mixer.update(clampedDelta)

    const airbornePose = input.avatarState === 'takeoff' || input.avatarState === 'jump' || input.avatarState === 'fall' || input.avatarState === 'land'
    poseWeightRef.current = MathUtils.damp(poseWeightRef.current, airbornePose ? 1 : 0, airbornePose ? 16 : 12, clampedDelta)
    const weight = poseWeightRef.current
    const jump = input.avatarState === 'jump'
    const fall = input.avatarState === 'fall'
    const land = input.avatarState === 'land'
    const takeoff = input.avatarState === 'takeoff'
    const nextOffsets = {
      hipsX: (takeoff ? 0.24 : jump ? -0.12 : land ? 0.22 : fall ? 0.05 : 0) * weight,
      torsoX: (takeoff ? 0.14 : jump ? -0.08 : land ? 0.16 : fall ? 0.08 : 0) * weight,
      upperLegLeftX: (takeoff ? -0.34 : jump ? -0.42 : land ? -0.3 : fall ? 0.08 : 0) * weight,
      upperLegRightX: (takeoff ? -0.34 : jump ? -0.34 : land ? -0.3 : fall ? -0.08 : 0) * weight,
      lowerLegLeftX: (takeoff ? 0.5 : jump ? 0.58 : land ? 0.42 : fall ? 0.16 : 0) * weight,
      lowerLegRightX: (takeoff ? 0.5 : jump ? 0.46 : land ? 0.42 : fall ? 0.12 : 0) * weight,
      shoulderLeftZ: (fall ? 0.32 : takeoff || land ? 0.12 : jump ? 0.18 : 0) * weight,
      shoulderRightZ: -(fall ? 0.32 : takeoff || land ? 0.12 : jump ? 0.18 : 0) * weight,
    }
    if (poseBones.hips) poseBones.hips.rotation.x += nextOffsets.hipsX
    if (poseBones.torso) poseBones.torso.rotation.x += nextOffsets.torsoX
    if (poseBones.upperLegLeft) poseBones.upperLegLeft.rotation.x += nextOffsets.upperLegLeftX
    if (poseBones.upperLegRight) poseBones.upperLegRight.rotation.x += nextOffsets.upperLegRightX
    if (poseBones.lowerLegLeft) poseBones.lowerLegLeft.rotation.x += nextOffsets.lowerLegLeftX
    if (poseBones.lowerLegRight) poseBones.lowerLegRight.rotation.x += nextOffsets.lowerLegRightX
    if (poseBones.shoulderLeft) poseBones.shoulderLeft.rotation.z += nextOffsets.shoulderLeftZ
    if (poseBones.shoulderRight) poseBones.shoulderRight.rotation.z += nextOffsets.shoulderRightZ
    poseOffsetsRef.current = nextOffsets
    invalidate()
  })

  return <primitive object={model} visible={avatarReady} scale={measurements.scale} position={[0, measurements.groundOffset, 0]} />
}

const DeferredPlayerAvatar = ({
  movementRef,
  characterId,
  outfitId,
  gateAAssetPath,
  characterReview,
  characterRetryRevision,
}: {
  movementRef: MovementRef
  characterId: CharacterId
  outfitId: OutfitId
  gateAAssetPath: string
  characterReview: VirtualChurchCharacterMotionProfile | null
  characterRetryRevision: number
}) => {
  const loadDetailedAvatar = useDeferredAfterHero(
    virtualChurchDeferredDelayMs('legacyCharacter', perfConfig.isMobile),
    true,
    config3D.visualVersion !== 'v3',
  )

  if (config3D.visualVersion === 'v3') {
    // Neither loading nor an asset failure may flash a different-looking person.
    // The degraded status and retry control remain available on real failure.
    const motionPath = getVirtualChurchSharedMotionReview(characterReview)
    const standardHero = <GateASkinnedFemaleHero
      key={gateAAssetPath}
      movementRef={movementRef}
      outfitId={outfitId}
      assetPath={gateAAssetPath}
      characterReview={characterReview}
    />
    return (
      <GateAHeroAssetBoundary
        key={`${gateAAssetPath}:${characterRetryRevision}`}
        assetPath={gateAAssetPath}
        motionPath={motionPath}
        fallback={null}
      >
        <Suspense fallback={null}>
          {motionPath ? <OptionalSharedMotionBoundary motionPath={motionPath} fallback={standardHero}>
            <GateASharedMotionReviewHero
              movementRef={movementRef}
              outfitId={outfitId}
              assetPath={gateAAssetPath}
              characterReview={characterReview}
              motionPath={motionPath}
              fallback={null}
            />
          </OptionalSharedMotionBoundary> : standardHero}
        </Suspense>
      </GateAHeroAssetBoundary>
    )
  }

  if (!loadDetailedAvatar) return null

  const legacyAssetPath = legacyCharacterAssetPath(characterId)
  return (
    <LegacyCharacterAssetBoundary
      key={`${characterId}:${characterRetryRevision}`}
      assetPath={legacyAssetPath}
    >
      <Suspense fallback={null}>
        <AnimatedPlayerAvatar
          movementRef={movementRef}
          characterId={characterId}
          outfitId={outfitId}
        />
      </Suspense>
    </LegacyCharacterAssetBoundary>
  )
}

const LandingDust = ({
  triggerRef,
  enabled,
}: {
  triggerRef: DustTriggerRef
  enabled: boolean
}) => {
  const groupRef = useRef<Group>(null)
  const elapsedRef = useRef(1)
  const { invalidate } = useThree()
  const particles = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2 + (index % 3) * 0.13
    return { x: Math.cos(angle), z: Math.sin(angle), speed: 0.75 + (index % 4) * 0.13, lift: 0.13 + (index % 3) * 0.035 }
  }), [])

  useEffect(() => {
    if (!enabled && groupRef.current) {
      groupRef.current.visible = false
      elapsedRef.current = 1
      invalidate()
    }
    triggerRef.current = (position) => {
      if (!enabled || !groupRef.current) return
      groupRef.current.position.set(...position)
      groupRef.current.visible = true
      elapsedRef.current = 0
      invalidate()
    }
    return () => { triggerRef.current = null }
  }, [enabled, invalidate, triggerRef])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!enabled || !group || elapsedRef.current >= 0.55) return
    elapsedRef.current += Math.min(delta, 0.05)
    const progress = Math.min(elapsedRef.current / 0.55, 1)
    group.children.forEach((particle, index) => {
      const config = particles[index]
      const distance = config.speed * progress
      particle.position.set(config.x * distance, config.lift * Math.sin(progress * Math.PI), config.z * distance)
      const scale = Math.max(0.01, (1 - progress) * (0.85 + (index % 3) * 0.12))
      particle.scale.setScalar(scale)
    })
    group.visible = progress < 1
    if (group.visible) invalidate()
  })

  return (
    <group ref={groupRef} visible={false}>
      {particles.map((_, index) => (
        <mesh key={index} position={[0, 0.04, 0]} scale={0.01}>
          <sphereGeometry args={[0.11, 6, 4]} />
          <meshBasicMaterial color={index % 2 ? '#b9a27f' : '#d0b995'} transparent opacity={0.62} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

const PlayerController = ({ movementRef, cameraViewRef, cameraModeRef, requestFrameRef, teleportRef, dustTriggerRef, characterId, outfitId, gateAAssetPath, characterReview, characterRetryRevision, avatarShadowVisible, reducedMotion, onNearEntrance, onNearMainHallDoor, onEnterMainHallDoor }: {
  movementRef: MovementRef
  cameraViewRef: CameraViewRef
  cameraModeRef: CameraModeRef
  requestFrameRef: RequestFrameRef
  teleportRef: TeleportRef
  dustTriggerRef: DustTriggerRef
  characterId: CharacterId
  outfitId: OutfitId
  gateAAssetPath: string
  characterReview: VirtualChurchCharacterMotionProfile | null
  characterRetryRevision: number
  avatarShadowVisible: boolean
  reducedMotion: boolean
  onNearEntrance: (near: boolean) => void
  onNearMainHallDoor: (door: number | null) => void
  onEnterMainHallDoor: (door: number) => void
}) => {
  const avatarForwardAxis = config3D.visualVersion === 'v3' ? '+Z' : '-Z'
  const usesGateAHeroMotion = config3D.visualVersion === 'v3'
  const walkStartDuration = usesGateAHeroMotion ? 0.6 : 0.36
  const walkStopDuration = usesGateAHeroMotion ? 0.8 : 0.32
  const runStartDuration = usesGateAHeroMotion ? 0.4 : 0.3
  const runStopDuration = usesGateAHeroMotion ? 0.85 : 0.38
  const initialPlayerYaw = gateAAvatarYawForMovement(
    -Math.sin(PLAYER_START_YAW),
    -Math.cos(PLAYER_START_YAW),
    avatarForwardAxis,
  )
  const playerRef = useRef<Group>(null)
  const doorInteraction = useContext(DoorInteractionContext)
  const nearEntranceRef = useRef(false)
  const nearMainHallDoorRef = useRef<number | null>(null)
  const enteredMainHallDoorRef = useRef(false)
  const verticalVelocityRef = useRef(0)
  const takeoffTimerRef = useRef(0)
  const landingTimerRef = useRef(0)
  const greetTimerRef = useRef(0)
  const locomotionStartTimerRef = useRef(0)
  const locomotionStopTimerRef = useRef(0)
  const wasTranslatingRef = useRef(false)
  const movementWasRequestedRef = useRef(false)
  const turnBeforeMoveRef = useRef(false)
  const lastLocomotionWasRunRef = useRef(false)
  const locomotionStartWasRunRef = useRef(false)
  const smoothedMovementIntensityRef = useRef(0)
  const lastTranslationSpeedRef = useRef(0)
  const reviewStopSpeedRef = useRef(0)
  const teleportCameraPendingRef = useRef(false)
  const reviewSpeedBlendRef = useRef({ from: 0, to: 0, remaining: 0 })
  const reviewStopDirection = useMemo(() => new Vector3(), [])
  const targetPlayerYawRef = useRef<number>(initialPlayerYaw)
  const direction = useMemo(() => new Vector3(), [])
  const desiredCamera = useMemo(() => new Vector3(), [])
  const lookAt = useMemo(() => new Vector3(), [])
  const { camera, invalidate } = useThree()
  const attachPlayer = useCallback((player: Group | null) => {
    playerRef.current = player
    if (player) teleportRef.flush()
  }, [teleportRef])

  useEffect(() => {
    requestFrameRef.current = invalidate
    const detachTeleport = teleportRef.attach((position, yaw) => {
      if (!playerRef.current) return false
      const playerYaw = gateAAvatarYawForMovement(
        -Math.sin(yaw),
        -Math.cos(yaw),
        avatarForwardAxis,
      )
      playerRef.current.position.set(...position)
      doorInteraction?.position.current.copy(playerRef.current.position)
      verticalVelocityRef.current = 0
      takeoffTimerRef.current = 0
      landingTimerRef.current = 0
      greetTimerRef.current = 0
      locomotionStartTimerRef.current = 0
      locomotionStopTimerRef.current = 0
      wasTranslatingRef.current = false
      movementWasRequestedRef.current = false
      turnBeforeMoveRef.current = false
      lastLocomotionWasRunRef.current = false
      locomotionStartWasRunRef.current = false
      smoothedMovementIntensityRef.current = 0
      lastTranslationSpeedRef.current = 0
      reviewStopSpeedRef.current = 0
      movementRef.current.travelledSpeedMps = 0
      reviewSpeedBlendRef.current.remaining = 0
      movementRef.current.turnDurationSeconds = 0
      movementRef.current.avatarState = 'idle'
      playerRef.current.rotation.y = playerYaw
      targetPlayerYawRef.current = playerYaw
      cameraViewRef.current.yaw = yaw
      teleportCameraPendingRef.current = true
      invalidate()
    })
    return () => {
      requestFrameRef.current = null
      detachTeleport()
    }
  }, [avatarForwardAxis, cameraViewRef, invalidate, requestFrameRef, teleportRef])

  useFrame((_, delta) => {
    const player = playerRef.current
    if (!player) return

    player.visible = cameraModeRef.current === 'follow'

    const input = movementRef.current
    const moveX = MathUtils.clamp(
      input.joystickX + input.keyboardX + input.diagnosticX,
      -1,
      1,
    )
    const moveZ = MathUtils.clamp(
      input.joystickZ + input.keyboardZ + input.diagnosticZ,
      -1,
      1,
    )
    const requestedMovementIntensity = MathUtils.clamp(Math.hypot(moveX, moveZ), 0, 1)
    const movementRequested = requestedMovementIntensity > 0.04
    const sprinting = input.sprint
      || input.diagnosticSprint
      || Math.hypot(input.joystickX, input.joystickZ) > 0.82

    const clampedDelta = Math.min(delta, 0.05)
    // Diagnostic input follows simulated motion time, not wall time. Shader
    // compilation or a suspended tab must not silently skip entire inputs.
    // Performance measurement keeps its independent real-time clock.
    if (input.diagnosticElapsedMs !== null && document.visibilityState === 'visible') {
      input.diagnosticElapsedMs += clampedDelta * 1000
    }
    smoothedMovementIntensityRef.current = MathUtils.damp(
      smoothedMovementIntensityRef.current,
      movementRequested ? requestedMovementIntensity : 0,
      movementRequested ? 10 : 14,
      clampedDelta,
    )
    let movementIntensity = smoothedMovementIntensityRef.current
    input.movementIntensity = movementIntensity

    if (movementRequested) {
      const { yaw } = cameraViewRef.current
      direction.set(
        -moveX * Math.cos(yaw) + moveZ * Math.sin(yaw),
        0,
        moveX * Math.sin(yaw) + moveZ * Math.cos(yaw),
      ).normalize()
      targetPlayerYawRef.current = gateAAvatarYawForMovement(
        direction.x,
        direction.z,
        avatarForwardAxis,
      )
    }
    const yawDeltaBeforeStep = Math.abs(gateAShortestYawDelta(
      player.rotation.y,
      targetPlayerYawRef.current,
    ))
    if (
      movementRequested
      && !movementWasRequestedRef.current
      && yawDeltaBeforeStep >= Math.PI / 6
    ) {
      // From rest, let the planted feet and hips finish the readable pivot
      // before translation begins. Direction changes while already moving
      // remain responsive and continue through the locomotion cycle.
      turnBeforeMoveRef.current = true
    }
    const turnStep = gateAStepYaw(
      player.rotation.y,
      targetPlayerYawRef.current,
      clampedDelta,
      PLAYER_TURN_SPEED,
    )
    player.rotation.y = turnStep.yaw
    input.turnDurationSeconds = turnStep.direction === 0
      ? 0
      : Math.max(0.12, turnStep.remainingRadians / PLAYER_TURN_SPEED)
    if (turnBeforeMoveRef.current && turnStep.remainingRadians <= 0.02) {
      turnBeforeMoveRef.current = false
    }
    if (!movementRequested) turnBeforeMoveRef.current = false
    movementWasRequestedRef.current = movementRequested
    const locomotionAlignment = movementRequested
      ? gateALocomotionFacingAlignment(
          player.rotation.y,
          targetPlayerYawRef.current,
        )
      : 1
    const translating = movementRequested
      && !turnBeforeMoveRef.current
      && gateALocomotionCanTranslate(locomotionAlignment)

    let locomotionStartStartedThisFrame = false
    let locomotionStopStartedThisFrame = false
    const resumingReviewBrake = translating && !wasTranslatingRef.current
      && locomotionStopTimerRef.current > 0 && lastTranslationSpeedRef.current > 0.04
      && turnStep.direction === 0
    const changingReviewGait = translating && wasTranslatingRef.current
      && sprinting !== lastLocomotionWasRunRef.current
    if (usesGateAHeroMotion && (resumingReviewBrake || changingReviewGait)) {
      // A moving body should not replay an Idle -> start pose or reset speed
      // to zero when the user resumes or changes gait before a clip finishes.
      locomotionStartTimerRef.current = 0
      locomotionStopTimerRef.current = 0
      movementIntensity = requestedMovementIntensity
      smoothedMovementIntensityRef.current = movementIntensity
      input.movementIntensity = movementIntensity
      reviewSpeedBlendRef.current = {
        from: lastTranslationSpeedRef.current,
        to: (sprinting ? gateACharacterRunSpeed(characterReview) : gateACharacterWalkSpeed(characterReview))
          * requestedMovementIntensity,
        remaining: GATE_A_REVIEW_SPEED_BLEND_SECONDS,
      }
    } else if (translating && !wasTranslatingRef.current) {
      reviewSpeedBlendRef.current.remaining = 0
      locomotionStartWasRunRef.current = sprinting
      locomotionStartTimerRef.current = sprinting
        ? runStartDuration
        : walkStartDuration
      locomotionStopTimerRef.current = 0
      locomotionStartStartedThisFrame = true
    } else if (!movementRequested && wasTranslatingRef.current) {
      reviewSpeedBlendRef.current.remaining = 0
      // If the player releases during a pivot, the turn animation owns the
      // planted feet. Playing a locomotion stop while the avatar root keeps
      // rotating produces a visibly twisted brake.
      locomotionStopTimerRef.current = turnStep.direction === 0
        ? (lastLocomotionWasRunRef.current ? runStopDuration : walkStopDuration)
        : 0
      locomotionStartTimerRef.current = 0
      locomotionStopStartedThisFrame = locomotionStopTimerRef.current > 0
      reviewStopSpeedRef.current = lastTranslationSpeedRef.current
      reviewStopDirection.copy(direction)
    } else if (
      movementRequested
      && !translating
      && turnStep.direction !== 0
    ) {
      // A new direction can interrupt either an unfinished start or stop.
      // Retire those stale phases so the pivot is visible immediately.
      reviewSpeedBlendRef.current.remaining = 0
      locomotionStartTimerRef.current = 0
      locomotionStopTimerRef.current = 0
    }
    const effectiveSprinting = usesGateAHeroMotion && locomotionStartTimerRef.current > 0
      ? locomotionStartWasRunRef.current
      : sprinting
    if (translating) lastLocomotionWasRunRef.current = effectiveSprinting
    wasTranslatingRef.current = translating

    const reviewStartActiveThisFrame = usesGateAHeroMotion && locomotionStartTimerRef.current > 0
    const reviewStopActiveThisFrame = usesGateAHeroMotion && locomotionStopTimerRef.current > 0
    const reviewBraking = reviewStopActiveThisFrame
      && !movementRequested && turnStep.direction === 0 && !input.jumpQueued
      && takeoffTimerRef.current <= 0 && landingTimerRef.current <= 0
    if (translating || reviewBraking) {
      const locomotionSpeed = config3D.visualVersion === 'v3'
        ? (effectiveSprinting
            ? gateACharacterRunSpeed(characterReview)
            : gateACharacterWalkSpeed(characterReview))
        : (sprinting ? RUN_SPEED : WALK_SPEED)
      const speedBlend = reviewSpeedBlendRef.current
      const blendedStep = usesGateAHeroMotion && translating && speedBlend.remaining > 0
        ? gateAReviewSpeedBlendStep(speedBlend.from, speedBlend.to, speedBlend.remaining, clampedDelta)
        : null
      if (blendedStep) speedBlend.remaining = blendedStep.remaining
      const step = reviewBraking
        ? gateAReviewTransitionStepDistance(
            locomotionStopTimerRef.current,
            lastLocomotionWasRunRef.current ? runStopDuration : walkStopDuration,
            reviewStopSpeedRef.current, clampedDelta, true,
          )
        : blendedStep
          ? blendedStep.distance * locomotionAlignment
        : reviewStartActiveThisFrame
          ? gateAReviewTransitionStepDistance(
              locomotionStartTimerRef.current,
              effectiveSprinting ? runStartDuration : walkStartDuration,
              locomotionSpeed, clampedDelta, false,
            ) * requestedMovementIntensity * locomotionAlignment
          : clampedDelta * locomotionSpeed * movementIntensity * locomotionAlignment
      const travelDirection = reviewBraking ? reviewStopDirection : direction
      const previousX = player.position.x
      const previousZ = player.position.z
      const nextX = MathUtils.clamp(
        player.position.x + travelDirection.x * step,
        VIRTUAL_CHURCH_PLAYER_BOUNDS.x[0],
        VIRTUAL_CHURCH_PLAYER_BOUNDS.x[1],
      )
      const nextZ = MathUtils.clamp(
        player.position.z + travelDirection.z * step,
        VIRTUAL_CHURCH_PLAYER_BOUNDS.z[0],
        VIRTUAL_CHURCH_PLAYER_BOUNDS.z[1],
      )

      if (!isBlocked(nextX, nextZ, player.position.y, config3D.visualVersion)) {
        player.position.x = nextX
        player.position.z = nextZ
      }
      // Preserve the actual collision-limited velocity when a stop starts.
      lastTranslationSpeedRef.current = clampedDelta > 0
        ? Math.hypot(player.position.x - previousX, player.position.z - previousZ) / clampedDelta
        : 0
    } else {
      lastTranslationSpeedRef.current = 0
    }
    input.travelledSpeedMps = lastTranslationSpeedRef.current

    // Vertical physics: jumping, landing on platforms, falling off edges.
    let verticalVelocity = verticalVelocityRef.current
    const groundY = groundHeightAt(player.position.x, player.position.z, player.position.y)
    const onGround = player.position.y <= groundY + 0.02 && verticalVelocity <= 0

    let takeoffStartedThisFrame = false
    if (input.jumpQueued) {
      input.jumpQueued = false
      if (
        onGround
        && takeoffTimerRef.current <= 0
        && landingTimerRef.current <= 0
      ) {
        takeoffTimerRef.current = TAKEOFF_DURATION
        takeoffStartedThisFrame = true
      }
    }

    if (takeoffTimerRef.current > 0) {
      takeoffTimerRef.current = gateAAnimationPhaseRemainingSeconds(
        takeoffTimerRef.current,
        clampedDelta,
        takeoffStartedThisFrame,
      )
      if (takeoffTimerRef.current === 0) verticalVelocity = JUMP_VELOCITY
    }

    // The 2 cm jump-input tolerance must not snap a descending avatar to
    // idle before actual contact, bypassing its landing animation.
    const airborne = !onGround || verticalVelocity !== 0
    let landedThisFrame = false
    if (airborne) {
      verticalVelocity -= GRAVITY * clampedDelta
      const nextY = player.position.y + verticalVelocity * clampedDelta
      if (nextY <= groundY) {
        if (!onGround || verticalVelocity < 0) {
          landingTimerRef.current = LANDING_DURATION
          landedThisFrame = true
          dustTriggerRef.current?.([player.position.x, groundY + 0.04, player.position.z])
        }
        player.position.y = groundY
        verticalVelocity = 0
      } else {
        player.position.y = nextY
      }
    } else if (player.position.y !== groundY) {
      player.position.y = groundY
      verticalVelocity = 0
    }
    verticalVelocityRef.current = verticalVelocity
    landingTimerRef.current = gateAAnimationPhaseRemainingSeconds(
      landingTimerRef.current,
      clampedDelta,
      landedThisFrame,
    )
    const groundedAfterPhysics = player.position.y <= groundY && verticalVelocity <= 0
    if (!groundedAfterPhysics) {
      locomotionStartTimerRef.current = 0
      locomotionStopTimerRef.current = 0
    } else {
      locomotionStartTimerRef.current = gateAAnimationPhaseRemainingSeconds(
        locomotionStartTimerRef.current,
        clampedDelta,
        usesGateAHeroMotion ? false : locomotionStartStartedThisFrame,
      )
      locomotionStopTimerRef.current = gateAAnimationPhaseRemainingSeconds(
        locomotionStopTimerRef.current,
        clampedDelta,
        usesGateAHeroMotion ? false : locomotionStopStartedThisFrame,
      )
    }
    const gestureRequested = input.gestureQueued
    input.gestureQueued = false
    const greetCanRun = gateAGreetCanRun({
      grounded: groundedAfterPhysics,
      moving: movementRequested || reviewBraking,
      takeoffRemainingSeconds: takeoffTimerRef.current,
      landingRemainingSeconds: landingTimerRef.current,
      turnDirection: turnStep.direction,
    })
    let greetStartedThisFrame = false
    if (gestureRequested && greetCanRun) {
      greetTimerRef.current = gateAAnimationContract.durationsSeconds.Greet
      greetStartedThisFrame = true
    } else if (!greetCanRun) {
      greetTimerRef.current = 0
    }
    greetTimerRef.current = gateAAnimationPhaseRemainingSeconds(
      greetTimerRef.current,
      clampedDelta,
      greetStartedThisFrame,
    )
    const nextAvatarState: AvatarMotionState = takeoffTimerRef.current > 0
      ? 'takeoff'
      : !groundedAfterPhysics
      ? (verticalVelocity > 0 ? 'jump' : 'fall')
      : landingTimerRef.current > 0
        ? 'land'
        : translating
          ? locomotionStartTimerRef.current > 0 || reviewStartActiveThisFrame
            ? (locomotionStartWasRunRef.current ? 'runStart' : 'walkStart')
            : (sprinting ? 'run' : 'walk')
          : locomotionStopTimerRef.current > 0 || reviewStopActiveThisFrame
            ? (lastLocomotionWasRunRef.current ? 'runStop' : 'walkStop')
            : turnStep.direction > 0
              ? 'turnLeft'
              : turnStep.direction < 0
                ? 'turnRight'
                : greetTimerRef.current > 0
                  ? 'greet'
                  : 'idle'
    input.avatarState = nextAvatarState

    if (profile3DInputDiagnostic === VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC
      || profile3DInputDiagnostic === VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC) {
      document.documentElement.setAttribute(
        VIRTUAL_CHURCH_PLAYER_POSE_ATTRIBUTE,
        JSON.stringify({
          x: Number(player.position.x.toFixed(4)),
          z: Number(player.position.z.toFixed(4)),
          yaw: Number(player.rotation.y.toFixed(4)),
          speedMps: Number(lastTranslationSpeedRef.current.toFixed(4)),
          diagnosticMs: input.diagnosticElapsedMs,
        }),
      )
    }

    doorInteraction?.position.current.copy(player.position)
    const { yaw, pitch } = cameraViewRef.current
    const cameraMode = cameraModeRef.current
    const snapTeleportedCamera = teleportCameraPendingRef.current
    if (camera instanceof PerspectiveCamera) {
      const nextFov = config3D.visualVersion === 'v3' && cameraMode === 'first'
        && virtualChurchPositionIsInsideFoyerInterior(player.position.x, player.position.z, config3D.visualVersion)
        ? 63 : 47
      if (camera.fov !== nextFov) {
        camera.fov = nextFov
        camera.updateProjectionMatrix()
      }
    }
    if (cameraMode === 'first') {
      desiredCamera.set(player.position.x, player.position.y + SCENE_SCALE.eyeHeight, -player.position.z)
      camera.position.lerp(
        desiredCamera,
        virtualChurchCameraLerpFactor(snapTeleportedCamera, reducedMotion, 11, clampedDelta),
      )
      const horizontal = Math.cos(pitch) * 12
      lookAt.set(
        camera.position.x - Math.sin(yaw) * horizontal,
        camera.position.y - Math.sin(pitch) * 12,
        camera.position.z + Math.cos(yaw) * horizontal,
      )
    } else if (cameraMode === 'showcase') {
      desiredCamera.copy(HERO_SHOWCASE_CAMERA_POSITION)
        .sub(HERO_SHOWCASE_LOOK_AT)
        .multiplyScalar(Math.max(1, 1 / ('aspect' in camera ? camera.aspect : 1)))
        .add(HERO_SHOWCASE_LOOK_AT)
      camera.position.lerp(
        desiredCamera,
        virtualChurchCameraLerpFactor(snapTeleportedCamera, reducedMotion, 5.5, clampedDelta),
      )
      lookAt.copy(HERO_SHOWCASE_LOOK_AT)
    } else {
      const cameraDistance = virtualChurchPositionIsInsideFoyerInterior(
        player.position.x,
        player.position.z,
        config3D.visualVersion,
      )
        ? THIRD_PERSON_FOYER_CAMERA_DISTANCE
        : THIRD_PERSON_CAMERA_DISTANCE
      desiredCamera.set(
        player.position.x + Math.sin(yaw) * cameraDistance,
        Math.max(
          0.85,
          THIRD_PERSON_CAMERA_BASE_HEIGHT + pitch * THIRD_PERSON_CAMERA_PITCH_HEIGHT,
        ) + player.position.y * 0.6,
        -(player.position.z + Math.cos(yaw) * cameraDistance),
      )
      constrainThirdPersonCamera(desiredCamera, player.position, true)
      camera.position.lerp(
        desiredCamera,
        virtualChurchCameraLerpFactor(snapTeleportedCamera, reducedMotion, 5.5, clampedDelta),
      )
      constrainThirdPersonCamera(camera.position, player.position, false)
      lookAt.set(player.position.x, 1.4 + player.position.y, -player.position.z)
    }
    camera.lookAt(lookAt)
    teleportCameraPendingRef.current = false

    const nearEntrance = !virtualChurchPositionIsInsideFoyerInterior(
      player.position.x, player.position.z, config3D.visualVersion,
    ) && virtualChurchPositionIsNearEntrance(
      [player.position.x, player.position.y, player.position.z],
      SCENE_LANDMARKS.entrance,
    )
    if (nearEntrance !== nearEntranceRef.current) {
      nearEntranceRef.current = nearEntrance
      onNearEntrance(nearEntrance)
    }
    const nearMainHallDoor = virtualChurchNearbyMainHallDoor(player.position.x, player.position.z, config3D.visualVersion)
    if (nearMainHallDoor !== nearMainHallDoorRef.current) {
      nearMainHallDoorRef.current = nearMainHallDoor
      onNearMainHallDoor(nearMainHallDoor)
    }
    const crossedMainHallDoor = virtualChurchCrossedMainHallThreshold(
      player.position.x, player.position.z, config3D.visualVersion,
    )
    if (crossedMainHallDoor !== null && !enteredMainHallDoorRef.current) {
      enteredMainHallDoorRef.current = true
      onEnterMainHallDoor(crossedMainHallDoor)
    }

    if (
      movementRequested
      || airborne
      || verticalVelocity !== 0
      || takeoffTimerRef.current > 0
      || landingTimerRef.current > 0
      || greetTimerRef.current > 0
      || locomotionStartTimerRef.current > 0
      || locomotionStopTimerRef.current > 0
      || turnStep.direction !== 0
      || camera.position.distanceToSquared(desiredCamera) > 0.0025
    ) invalidate()
  // Negative priority keeps automatic rendering, but updates the mobile camera
  // before tree visibility queries; async tree loading must not decide order.
  }, config3D.visualVersion === 'v3' && perfConfig.isMobile ? -1 : 0)

  return (
    <group name="vc:character" ref={attachPlayer} position={PLAYER_START} rotation={[0, initialPlayerYaw, 0]}>
      {/* 1.72m adult avatar: realistic world scale with an original stylised MMO silhouette. */}
      <mesh visible={avatarShadowVisible} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 20]} />
        <meshBasicMaterial color="#18332d" transparent opacity={0.22} />
      </mesh>
      <DeferredPlayerAvatar
        movementRef={movementRef}
        characterId={characterId}
        outfitId={outfitId}
        gateAAssetPath={gateAAssetPath}
        characterReview={characterReview}
        characterRetryRevision={characterRetryRevision}
      />
    </group>
  )
}

const CameraDragArea = ({ cameraViewRef, requestFrameRef, onFirstUse, label }: {
  cameraViewRef: CameraViewRef
  requestFrameRef: RequestFrameRef
  onFirstUse: () => void
  label: string
}) => {
  const lastPointer = useRef<{ x: number; y: number } | null>(null)

  const updateCamera = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!lastPointer.current) return
    const deltaX = event.clientX - lastPointer.current.x
    const deltaY = event.clientY - lastPointer.current.y
    const sensitivity = event.pointerType === 'mouse' ? 0.005 : 0.008
    lastPointer.current = { x: event.clientX, y: event.clientY }
    cameraViewRef.current.yaw += deltaX * sensitivity
    // Negative pitch raises the view. The previous positive-only clamp made it
    // impossible to look above the horizon.
    cameraViewRef.current.pitch = MathUtils.clamp(cameraViewRef.current.pitch + deltaY * sensitivity * 0.5, -0.72, 1.05)
    requestFrameRef.current?.()
  }

  const stopDragging = () => { lastPointer.current = null }

  useEffect(() => {
    const cancelDrag = () => { lastPointer.current = null }
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') cancelDrag()
    }
    window.addEventListener('blur', cancelDrag)
    window.addEventListener('resize', cancelDrag)
    window.addEventListener('orientationchange', cancelDrag)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', cancelDrag)
      window.removeEventListener('resize', cancelDrag)
      window.removeEventListener('orientationchange', cancelDrag)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return (
    <div
      role="application"
      aria-label={label}
      className="pointer-events-auto absolute inset-y-20 right-0 z-10 w-1/2 touch-none desktop:left-0 desktop:w-full desktop:cursor-grab desktop:active:cursor-grabbing"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        lastPointer.current = { x: event.clientX, y: event.clientY }
        onFirstUse()
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updateCamera(event)
      }}
      onPointerUp={(event) => {
        updateCamera(event)
        stopDragging()
      }}
      onPointerCancel={stopDragging}
      onLostPointerCapture={stopDragging}
    />
  )
}

const MovementJoystick = ({ movementRef, requestFrameRef, label }: { movementRef: MovementRef; requestFrameRef: RequestFrameRef; label: string }) => {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const radius = 38

  const updateMovement = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const rawX = event.clientX - (bounds.left + bounds.width / 2)
    const rawY = event.clientY - (bounds.top + bounds.height / 2)
    const distance = Math.hypot(rawX, rawY)
    const scale = distance > radius ? radius / distance : 1
    const x = rawX * scale
    const y = rawY * scale
    setKnob({ x, y })
    movementRef.current.joystickX = x / radius
    movementRef.current.joystickZ = y / radius
    requestFrameRef.current?.()
  }

  const stopMovement = () => {
    setKnob({ x: 0, y: 0 })
    movementRef.current.joystickX = 0
    movementRef.current.joystickZ = 0
    requestFrameRef.current?.()
  }

  useEffect(() => {
    const cancelMovement = () => {
      stopMovement()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') cancelMovement()
    }
    window.addEventListener('blur', cancelMovement)
    window.addEventListener('resize', cancelMovement)
    window.addEventListener('orientationchange', cancelMovement)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', cancelMovement)
      window.removeEventListener('resize', cancelMovement)
      window.removeEventListener('orientationchange', cancelMovement)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      movementRef.current.joystickX = 0
      movementRef.current.joystickZ = 0
    }
  }, [movementRef, requestFrameRef])

  return (
    <button
      type="button"
      aria-label={label}
      className="vc-movement-joystick relative h-28 w-28 touch-none rounded-full border border-white/55 bg-[#173f36]/70 shadow-[0_14px_35px_rgba(0,0,0,0.24)] backdrop-blur-md focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        updateMovement(event)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updateMovement(event)
      }}
      onPointerUp={stopMovement}
      onPointerCancel={stopMovement}
      onLostPointerCapture={stopMovement}
    >
      <span className="absolute inset-3 rounded-full border border-white/20" />
      <span
        className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-white/70 bg-white/90 shadow-md"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </button>
  )
}

const CameraModeSwitcher = ({ mode, labels, onChange, gateATouchLayout }: {
  mode: CameraMode
  labels: { group: string; first: string; follow: string; showcase: string }
  onChange: (mode: CameraMode) => void
  gateATouchLayout: boolean
}) => {
  const modes: Array<{ id: CameraMode; label: string; icon: typeof Eye }> = [
    { id: 'first', label: labels.first, icon: Eye },
    { id: 'follow', label: labels.follow, icon: Camera },
    { id: 'showcase', label: labels.showcase, icon: UserRound },
  ]
  return (
    <div role="group" aria-label={labels.group} className="vc-camera-panel pointer-events-auto flex rounded-2xl border border-white/60 bg-[#173f36]/78 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      {modes.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={mode === id}
          onClick={() => onChange(id)}
          className={[
            'vc-camera-choice inline-flex items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70',
            gateATouchLayout ? 'h-11 min-w-11' : 'h-10',
            mode === id ? 'bg-white text-[#173f36] shadow-sm' : 'text-white hover:bg-white/15',
          ].join(' ')}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden lg:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

type VirtualChurchCopy = typeof copy.zh | typeof copy.en

const GuidePanel = ({ t, onClose, onEntrance, onFoyer, onMainHallView, onSecondaryHallView, onJunction, onRightJunction, onParking, onStreetFront, onSurroundings, onNavigate, showFoyerFlags, onToggleFoyerFlags, v3 }: {
  t: VirtualChurchCopy
  onClose: () => void
  onEntrance: () => void
  onFoyer: () => void
  onMainHallView: () => void
  onSecondaryHallView: () => void
  onJunction: () => void
  onRightJunction: () => void
  onParking: () => void
  onStreetFront: () => void
  onSurroundings: () => void
  onNavigate: (path: string) => void
  showFoyerFlags: boolean
  onToggleFoyerFlags: () => void
  v3: boolean
}) => {
  const destinations = [
    { icon: MapPin, title: t.entrance, detail: t.entranceDetail, action: onEntrance },
    ...(v3 ? [{ icon: Eye, title: t.mainHallView, detail: t.mainHallViewDetail, action: onMainHallView }] : []),
    ...(v3 ? [{ icon: Building2, title: t.mainHallInterior, detail: t.mainHallInteriorDetail, action: () => onNavigate('/virtual-church/main-hall') }] : []),
    { icon: Building2, title: t.foyer, detail: t.foyerDetail, action: onFoyer },
    ...(v3 ? [{ icon: Eye, title: t.secondaryHallView, detail: t.secondaryHallViewDetail, action: onSecondaryHallView }] : []),
    ...(v3 ? [{ icon: Compass, title: t.junction, detail: t.junctionDetail, action: onJunction }] : []),
    ...(v3 ? [{ icon: Compass, title: t.rightJunction, detail: t.rightJunctionDetail, action: onRightJunction }] : []),
    { icon: Camera, title: t.parking, detail: t.parkingDetail, action: onParking },
    { icon: Compass, title: t.streetFront, detail: t.streetFrontDetail, action: onStreetFront },
    { icon: Building2, title: t.surroundings, detail: t.surroundingsDetail, action: onSurroundings },
    { icon: BookOpen, title: t.study, detail: t.studyDetail, action: () => onNavigate('/study') },
    { icon: Video, title: t.sermons, detail: t.sermonsDetail, action: () => onNavigate('/sermons') },
    { icon: CalendarDays, title: t.events, detail: t.eventsDetail, action: () => onNavigate('/events') },
  ]
  const dialogRef = useVirtualChurchDialogFocus(onClose)

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 bg-[#07130f]/35"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-keyshortcuts="Escape"
        aria-labelledby="virtual-church-guide-title"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-y-auto overscroll-contain border-l border-white/60 bg-[#f7fbf9]/[0.96] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-[#173f36] shadow-[-20px_0_60px_rgba(18,53,45,0.18)] backdrop-blur-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#aa7d27]">182 The Runway</p>
            <h2 id="virtual-church-guide-title" className="mt-2 text-2xl font-black">{t.guide}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5d7068]">{t.guideBody}</p>
          </div>
          <button type="button" data-autofocus onClick={onClose} aria-label={t.close} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d5e2dc] bg-white transition hover:bg-[#edf5f1] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b9d8cc]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-7 grid gap-3">
          {destinations.map(({ icon: Icon, title, detail, action }, index) => (
            <Fragment key={title}>
              <button type="button" onClick={action} className="group flex items-center gap-4 rounded-2xl border border-[#d9e5df] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#a9cbbf] hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b9d8cc]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e3f1eb] text-[#176b5a] transition group-hover:bg-[#176b5a] group-hover:text-white"><Icon className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block text-sm font-black">{title}</span><span className="mt-0.5 block text-xs leading-5 text-[#687971]">{detail}</span></span>
              </button>
              {index === 1 && v3 ? <div className="rounded-2xl border border-[#d9e5df] bg-white p-4">
                <p className="text-sm font-black">{t.foyerFlags}</p>
                <p className="mt-1 text-xs leading-5 text-[#687971]">{t.foyerFlagsDetail}</p>
                <button type="button" aria-pressed={showFoyerFlags} onClick={onToggleFoyerFlags} className="mt-3 min-h-11 rounded-xl border border-[#b5d5c9] bg-[#e3f1eb] px-4 text-sm font-bold text-[#176b5a] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b9d8cc]">
                  {showFoyerFlags ? t.foyerFlagsHide : t.foyerFlagsShow}
                </button>
              </div> : null}
            </Fragment>
          ))}
        </div>
        <div className="mt-auto flex items-start gap-2 rounded-2xl bg-[#edf5f1] p-4 text-xs leading-5 text-[#5a6d65]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#176b5a]" />{t.accuracy}
        </div>
      </div>
    </div>
  )
}

const CharacterPanel = ({ t, characterId, churchRole, outfitId, isGateAPreview, characterReview, heroId, onHeroChange, onCharacterReviewChange, onRoleChange, onOutfitChange, onClose }: {
  t: VirtualChurchCopy
  characterId: CharacterId
  churchRole: ChurchRole
  outfitId: OutfitId
  isGateAPreview: boolean
  characterReview: VirtualChurchCharacterReview | null
  heroId: VirtualChurchHeroId
  onHeroChange: (heroId: VirtualChurchHeroId) => void
  onCharacterReviewChange: (review: VirtualChurchCharacterReview) => void
  onRoleChange: (role: ChurchRole) => void
  onOutfitChange: (outfit: OutfitId) => void
  onClose: () => void
}) => {
  const roles: Array<{ id: ChurchRole; label: string; image: string; position: string }> = [
    { id: 'pastor', label: t.pastor, image: '/virtual-church-assets/thumbnails/modular-men-preview.jpg', position: '17%' },
    { id: 'sister', label: t.sisterRole, image: '/virtual-church-assets/thumbnails/modular-women-preview.jpg', position: '96%' },
    { id: 'brother', label: t.brother, image: '/virtual-church-assets/thumbnails/modular-men-preview.jpg', position: '65%' },
    { id: 'believerWoman', label: t.believerWoman, image: '/virtual-church-assets/thumbnails/modular-women-preview.jpg', position: '6%' },
  ]
  const outfits: Array<{ id: OutfitId; label: string }> = [
    { id: 'classic', label: t.classicOutfit },
    { id: 'service', label: t.serviceOutfit },
    { id: 'community', label: t.communityOutfit },
  ]
  const reviewCharacterIds: [
    VirtualChurchCharacterReview,
    VirtualChurchCharacterReview,
  ] = characterReview?.endsWith('-v14')
    ? ['female-v14', 'male-v14']
    : characterReview?.endsWith('-v13')
      ? ['female-v13', 'male-v13']
      : ['female-v12', 'male-v12']
  const reviewCharacters: Array<{
    id: VirtualChurchCharacterReview
    sourceModel: 'AvatarSample_Q' | 'AvatarSample_C'
    label: string
    role: string
    appearance: string
    wardrobe: string
    portraitAlt: string
    portraitPath: string
  }> = [
    {
      id: reviewCharacterIds[0],
      sourceModel: 'AvatarSample_Q',
      label: t.reviewFemaleLabel,
      role: t.reviewFemaleRole,
      appearance: t.reviewFemaleAppearance,
      wardrobe: t.reviewFemaleWardrobe,
      portraitAlt: t.reviewFemalePortraitAlt,
      portraitPath: characterReview ? virtualChurchCharacterPickerPath(reviewCharacterIds[0]) : CHARACTER_HERO_PICKER_PATH,
    },
    {
      id: reviewCharacterIds[1],
      sourceModel: 'AvatarSample_C',
      label: t.reviewMaleLabel,
      role: t.reviewMaleRole,
      appearance: t.reviewMaleAppearance,
      wardrobe: t.reviewMaleWardrobe,
      portraitAlt: t.reviewMalePortraitAlt,
      portraitPath: characterReview ? virtualChurchCharacterPickerPath(reviewCharacterIds[1]) : config3D.characters.gateAMalePicker,
    },
  ]
  const choiceClass = (selected: boolean) => ['rounded-2xl border p-4 text-left text-sm font-black transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b9d8cc]', selected ? 'border-[#176b5a] bg-[#176b5a] text-white shadow-md' : 'border-[#d9e5df] bg-white text-[#173f36] hover:border-[#8cb8a8]'].join(' ')
  const dialogRef = useVirtualChurchDialogFocus(onClose)

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 bg-[#07130f]/35"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-keyshortcuts="Escape"
      aria-labelledby="virtual-church-character-title"
      data-vc-character-ui={editorialCharacterPreview ? 'editorial' : undefined}
      tabIndex={-1}
      className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto overscroll-contain border-l border-white/60 bg-[#f7fbf9]/[0.96] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-[#173f36] shadow-[-20px_0_60px_rgba(18,53,45,0.18)] backdrop-blur-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#aa7d27]">Alife Avatar</p><h2 id="virtual-church-character-title" className="mt-2 text-2xl font-black">{t.characterTitle}</h2></div>
        <button type="button" data-autofocus onClick={onClose} aria-label={t.close} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d5e2dc] bg-white transition hover:bg-[#edf5f1] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b9d8cc]"><X className="h-5 w-5" /></button>
      </div>
      {characterReview || isGateAPreview ? (
        <section className="mt-7" aria-label={characterReview ? t.reviewCharactersLabel : t.characterTitle}>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#607169]">{characterReview ? t.reviewCharactersLabel : t.characterTitle}</p>
          <div className="grid gap-3">
            {reviewCharacters.map((reviewCharacter) => {
              const choiceId: VirtualChurchHeroId = reviewCharacter.id.startsWith('male-') ? 'male' : 'female'
              const selected = characterReview ? characterReview === reviewCharacter.id : heroId === choiceId
              return (
                <button
                  key={reviewCharacter.id}
                  type="button"
                  data-character-review={characterReview ? reviewCharacter.id : undefined}
                  data-hero-id={characterReview ? undefined : choiceId}
                  aria-pressed={selected}
                  onClick={() => characterReview ? onCharacterReviewChange(reviewCharacter.id) : onHeroChange(choiceId)}
                  className={[
                    'group grid min-h-44 grid-cols-[7.25rem_1fr] overflow-hidden rounded-[1.4rem] border text-left shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b9d8cc]',
                    selected
                      ? 'border-[#176b5a] bg-[#edf5f1] shadow-[0_14px_32px_rgba(23,107,90,0.14)]'
                      : 'border-[#d9e5df] bg-white hover:border-[#8cb8a8] hover:shadow-md',
                  ].join(' ')}
                >
                  <span className="relative flex min-h-44 items-end justify-center overflow-hidden border-r border-[#d7e4de] bg-[radial-gradient(circle_at_52%_28%,#ffffff_0%,#e7f1ed_54%,#c9ded5_100%)]">
                    <img
                      src={reviewCharacter.portraitPath}
                      alt={reviewCharacter.portraitAlt}
                      width="768"
                      height="960"
                      loading="lazy"
                      className="h-44 w-auto max-w-none object-contain object-bottom drop-shadow-[0_10px_14px_rgba(32,58,50,0.2)]"
                    />
                  </span>
                  <span className="min-w-0 p-4">
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span>
                        <span className="block text-base font-black text-[#173f36]">{reviewCharacter.label}</span>
                        <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a6a27]">{reviewCharacter.role}</span>
                      </span>
                      {selected ? <span className="rounded-full bg-[#176b5a] px-2.5 py-1 text-[10px] font-black text-white">{t.reviewSelected}</span> : null}
                    </span>
                    <span className="vc-character-detail-label mt-3 block text-xs font-black text-[#173f36]">{t.gateAHeroAppearanceLabel}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[#5a6d65]">{reviewCharacter.appearance}</span>
                    <span className="vc-character-detail-label mt-2 block text-xs font-black text-[#173f36]">{t.gateAHeroWardrobeLabel}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[#5a6d65]">{reviewCharacter.wardrobe}</span>
                    <span data-hero-source={choiceId} className="mt-2 block break-words text-[11px] leading-4 text-[#5a6d65]">{t.characterSourceLabel} · VRoid Studio {reviewCharacter.sourceModel}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : (
        <>
          <p className="mb-3 mt-7 text-xs font-black uppercase tracking-[0.14em] text-[#607169]">{t.churchRole}</p>
          <div className="grid grid-cols-2 gap-3">{roles.map(({ id, label, image, position }) => {
            const selected = churchRole === id && characterId === ROLE_CHARACTERS[id]
            return <button key={id} type="button" aria-pressed={selected} onClick={() => onRoleChange(id)} className={[choiceClass(selected), 'overflow-hidden p-0'].join(' ')}><img src={image} alt={`${label} · ${t.previewAlt}`} className="h-24 w-full object-cover" style={{ objectPosition: `${position} center` }} loading="lazy" /><span className="block px-3 py-3">{label}</span></button>
          })}</div>
        </>
      )}
      {!characterReview ? (
        <>
          <p className="mb-3 mt-7 text-xs font-black uppercase tracking-[0.14em] text-[#607169]">{t.wardrobe}</p>
          <div className="vc-character-outfits grid grid-cols-3 gap-2">{outfits.map(({ id, label }) => <button key={id} type="button" aria-pressed={outfitId === id} onClick={() => onOutfitChange(id)} className={choiceClass(outfitId === id)}><span className="mb-2 block h-5 w-5 rounded-full border-2 border-current" style={{ backgroundColor: VIRTUAL_CHURCH_OUTFIT_SWATCHES[id] }} />{label}</button>)}</div>
        </>
      ) : null}
      <div className="vc-character-note mt-7 flex items-start gap-2 rounded-2xl bg-[#edf5f1] p-4 text-xs leading-5 text-[#5a6d65]"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#176b5a]" />{characterReview ? t.reviewCharactersNote : isGateAPreview ? t.gateAWardrobeNote : t.characterNote}</div>
      {(characterReview || isGateAPreview) && (
        <p className="mt-3 text-xs leading-5 text-[#5a6d65]">{t.characterSourceNote}</p>
      )}
    </div>
    </div>
  )
}

const WelcomeDialog = ({
  t,
  v3,
  onDismiss,
  onNavigate,
}: {
  t: VirtualChurchCopy
  v3: boolean
  onDismiss: () => void
  onNavigate: (path: string) => void
}) => {
  const dialogRef = useVirtualChurchDialogFocus(onDismiss)

  return (
    <div className={v3
      ? 'pointer-events-auto absolute inset-0 z-30 flex items-end justify-center bg-[#081316]/25 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:items-center md:justify-end md:pr-[max(1.5rem,env(safe-area-inset-right))] xl:pr-[max(3rem,env(safe-area-inset-right))]'
      : 'pointer-events-auto absolute inset-0 z-30 flex items-end justify-center bg-[linear-gradient(180deg,rgba(20,15,5,0.1),rgba(20,15,5,0.8))] p-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6'}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-keyshortcuts="Escape"
        aria-labelledby="virtual-church-welcome-title"
        aria-describedby="virtual-church-welcome-body"
        tabIndex={-1}
        className={['max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain', v3
          ? 'max-w-[420px] rounded-[14px] border border-[#d8d8cc]/25 bg-[#182125]/95 p-6 text-[#f5f1e8] shadow-[0_18px_60px_rgba(0,0,0,0.28)] md:p-5 xl:p-7'
          : 'max-w-xl rounded-[1.75rem] border border-[#c8952a]/50 bg-gradient-to-b from-[#2a1f0a]/95 to-[#1a1208]/95 p-6 text-[#f4d89b] shadow-[0_28px_90px_rgba(8,30,25,0.34)] backdrop-blur-2xl sm:p-8 xl:max-w-2xl'].join(' ')}
      >
        <div className={v3
          ? 'flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c5bca9]'
          : 'flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#f4d89b]'}><Church className="h-4 w-4" />{t.welcomeEyebrow}</div>
        <h1 id="virtual-church-welcome-title" className={v3
          ? 'mt-4 text-[1.6rem] font-semibold leading-[1.35] tracking-[-0.02em] md:mt-3 md:text-[1.45rem] xl:mt-4 xl:text-[1.8rem]'
          : 'mt-4 text-2xl font-black leading-tight sm:text-3xl xl:text-4xl'}>{t.welcomeTitle}</h1>
        <p id="virtual-church-welcome-body" className={v3
          ? 'mt-4 text-sm leading-6 text-[#d5d8d3] md:mt-3 xl:mt-4'
          : 'mt-4 text-sm leading-6 text-[#c8a060] sm:text-base sm:leading-7'}>{v3 ? t.welcomeBodyV3 : t.welcomeBody}</p>
        <div className={v3 ? 'mt-6 flex flex-col gap-2.5 md:mt-4 xl:mt-6' : 'mt-6 flex flex-col gap-3 sm:flex-row'}>
          <button type="button" data-autofocus onClick={onDismiss} className={v3
            ? 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#f2ede2] px-5 text-sm font-semibold text-[#172024] transition-colors hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b9d8cc]'
            : 'inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#c8952a] px-5 text-sm font-black text-[#1a1208] transition hover:bg-[#daa84a] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b9d8cc]'}><Play className="h-4 w-4 fill-current" />{t.start}</button>
          <button type="button" onClick={() => onNavigate('/study')} className={v3
            ? 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#d8d8cc]/35 bg-transparent px-5 text-sm font-semibold text-[#f5f1e8] transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b9d8cc]'
            : 'inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#c8952a]/60 bg-[#1a1208]/80 px-5 text-sm font-black text-[#f4d89b] transition hover:bg-[#2a1f0a] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b9d8cc]'}><BookOpen className="h-4 w-4" />{v3 ? t.enterStudyV3 : t.enterStudy}</button>
        </div>
      </div>
    </div>
  )
}

const VirtualChurchRuntimeStatusIndicator = ({
  status,
  t,
  gateASafeArea,
  visualSuppressed,
  onRetryCharacter,
  characterRetryPending,
}: {
  status: VirtualChurchRuntimeStatus
  t: VirtualChurchCopy
  gateASafeArea: boolean
  visualSuppressed: boolean
  onRetryCharacter?: () => void
  characterRetryPending: boolean
}) => {
  const [slowLoading, setSlowLoading] = useState(false)
  useEffect(() => {
    setSlowLoading(false)
    if (status !== 'loading' || !gateASafeArea) return
    const timer = window.setTimeout(() => setSlowLoading(true), 8_000)
    return () => window.clearTimeout(timer)
  }, [status, gateASafeArea])

  if (status === 'idle') return null
  const message = characterRetryPending ? t.retryingCharacter : status === 'loading'
    ? slowLoading && gateASafeArea ? t.slowLoading3D : t.loading3D
    : status === 'degraded'
      ? onRetryCharacter ? t.characterUnavailable3D : t.degraded3D
      : t.ready3D

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
      {!visualSuppressed && (status === 'loading' || status === 'degraded') ? (
        <div
          className={[
            'pointer-events-none absolute left-1/2 z-20 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap justify-center items-center gap-2 rounded-2xl border border-[#c8952a]/40 bg-[#1a1208] px-4 py-2 text-xs font-black text-[#f4d89b] shadow-lg',
            gateASafeArea
              ? 'top-[calc(env(safe-area-inset-top)+6rem)] sm:top-24'
              : 'top-24',
          ].join(' ')}
        >
          {status === 'loading' ? (
            <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#f4d89b]/35 border-t-[#f4d89b] motion-safe:animate-spin" />
          ) : (
            <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 basis-40">{message}</span>
          {onRetryCharacter ? (
            <button
              type="button"
              onClick={onRetryCharacter}
              disabled={characterRetryPending}
              className="pointer-events-auto min-h-11 rounded-xl border border-[#f4d89b]/60 px-3 text-xs font-black text-[#f4d89b] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4d89b] disabled:cursor-wait disabled:opacity-60"
            >
              {characterRetryPending ? t.retryingCharacter : t.retryCharacter}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

const virtualChurchRuntimeErrorMessage = (error: unknown) =>
  error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error)

class VirtualChurchCanvasBoundary extends Component<
  {
    children: ReactNode
    onError: (error: unknown) => void
  },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Virtual Church Canvas failed:', error, info)
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

const VirtualChurchView = ({ routeStartedAt }: { routeStartedAt: number }) => {
  const pageRef = useVirtualChurchPageIsolation()
  const navigate = useNavigate()
  const auth = useAuthStore()
  const t = copy[auth.language === 'zh' ? 'zh' : 'en']
  const arrival = new URLSearchParams(window.location.search).get('vcArrival')
  const arrivalDoor = virtualChurchMainHallArrivalDoor(arrival)
  const arrivalFromStudyRoom = config3D.visualVersion === 'v3' && arrival === 'study-room'
  const arrivalCameraMode: CameraMode = config3D.visualVersion === 'v3' && (arrivalDoor !== null || arrivalFromStudyRoom || profile3DStartAtFoyer) ? 'first' : 'follow'
  const movementRef = useRef<MovementInput>({ joystickX: 0, joystickZ: 0, keyboardX: 0, keyboardZ: 0, diagnosticX: 0, diagnosticZ: 0, diagnosticElapsedMs: null, jumpQueued: false, gestureQueued: false, sprint: false, diagnosticSprint: false, movementIntensity: 0, travelledSpeedMps: 0, turnDurationSeconds: 0, avatarState: 'idle' })
  const doorPlayerPosition = useRef(new Vector3(...SCENE_LANDMARKS.playerStart))
  const cameraViewRef = useRef({ yaw: PLAYER_START_YAW, pitch: INITIAL_FOLLOW_CAMERA_PITCH })
  const cameraModeRef = useRef<CameraMode>(arrivalCameraMode)
  const requestFrameRef = useRef<(() => void) | null>(null)
  const teleportRef = useMemo(createVirtualChurchTeleport, [])
  const dustTriggerRef = useRef<((position: [number, number, number]) => void) | null>(null)
  const [nearEntrance, setNearEntrance] = useState(false)
  const [nearMainHallDoor, setNearMainHallDoor] = useState<number | null>(null)
  const mainHallArrivalPromptGateRef = useRef<MainHallArrivalPromptGate>(arrivalDoor === null ? 'ready' : 'awaiting-arrival')
  const updateNearMainHallDoor = useCallback((door: number | null) => {
    const next = virtualChurchMainHallPromptAfterProximity(mainHallArrivalPromptGateRef.current, door)
    mainHallArrivalPromptGateRef.current = next.gate
    setNearMainHallDoor(next.offeredDoor)
  }, [])
  useEffect(() => {
    if (config3D.visualVersion !== 'v3' || arrivalDoor === null) return
    const destination = virtualChurchMainHallDoorReturnView(arrivalDoor)
    cameraViewRef.current.pitch = destination.pitch
    teleportRef.request(destination.position, destination.yaw)
  }, [arrivalDoor, teleportRef])
  useEffect(() => {
    if (!arrivalFromStudyRoom) return
    cameraViewRef.current.pitch = VIRTUAL_CHURCH_FOYER_VIEW.pitch
    teleportRef.request(VIRTUAL_CHURCH_FOYER_VIEW.position, VIRTUAL_CHURCH_FOYER_VIEW.yaw)
  }, [arrivalFromStudyRoom, teleportRef])
  const [cameraMode, setCameraMode] = useState<CameraMode>(arrivalCameraMode)
  const [showCameraHint, setShowCameraHint] = useState(true)
  const [showControlsHint, setShowControlsHint] = useState(true)
  const [showGuide, setShowGuide] = useState(false)
  // Flags in the supplied photos were event dressing, not fixed architecture.
  // Keep the clear long-axis/cross view as the baseline; visitors can opt in.
  const [showFoyerFlags, setShowFoyerFlags] = useState(false)
  const [showGatherings, setShowGatherings] = useState(false)
  const [showCharacters, setShowCharacters] = useState(false)
  const [characterReview, setCharacterReview] = useState<
    VirtualChurchCharacterReview | null
  >(() => getVirtualChurchCharacterReview(config3D.visualVersion))
  const [heroId, setHeroId] = useState<VirtualChurchHeroId>(() => {
    try { return window.sessionStorage.getItem('alife:virtual-church:hero') === 'male' ? 'male' : 'female' }
    catch { return 'female' }
  })
  const characterMotionProfile: VirtualChurchCharacterMotionProfile | null = characterReview
    ?? (heroId === 'male' ? 'male' : null)
  const enterMainHallDoor = useCallback((door: number) => {
    navigate(virtualChurchMainHallEntryUrl(door, characterReview, window.location.search, import.meta.env.DEV))
  }, [characterReview, navigate])
  const navigateFromChurch = (path: string) => {
    if (path === '/events') { setShowGuide(false); setShowGatherings(true); return }
    if (path === '/virtual-church/main-hall') {
      navigate(virtualChurchMainHallEntryUrl(null, characterReview, window.location.search, import.meta.env.DEV))
      return
    }
    navigate(path === '/study' ? '/virtual-church/study-room' : path)
  }
  const gateACharacterAssetPath = useMemo(
    () => virtualChurchCharacterHeroAssetPath(characterReview, heroId),
    [characterReview, heroId],
  )
  const [characterId, setCharacterId] = useState<CharacterId>(() => {
    try {
      const saved = window.sessionStorage.getItem('alife:virtual-church:character')
      return saved === 'pastor' || saved === 'sister' || saved === 'believerMan' || saved === 'believerWoman' ? saved : 'believerWoman'
    } catch { return 'believerWoman' }
  })
  const [churchRole, setChurchRole] = useState<ChurchRole>(() => {
    try {
      const savedCharacter = window.sessionStorage.getItem('alife:virtual-church:character')
      if (savedCharacter === 'cleric' || savedCharacter === 'ranger' || savedCharacter === 'wizard') return 'believerWoman'
      const saved = window.sessionStorage.getItem('alife:virtual-church:role')
      return saved === 'pastor' || saved === 'sister' || saved === 'brother' || saved === 'believerWoman' ? saved : 'believerWoman'
    } catch { return 'believerWoman' }
  })
  const [outfitId, setOutfitId] = useState<OutfitId>(() => {
    try {
      const saved = window.sessionStorage.getItem('alife:virtual-church:outfit')
      return saved === 'service' || saved === 'community' ? saved : 'classic'
    } catch { return 'classic' }
  })
  useEffect(() => {
    try {
      // Persist the migrated role-only selection so retired RPG classes,
      // including Wizard, cannot reappear from stale session data.
      window.sessionStorage.setItem('alife:virtual-church:character', characterId)
      window.sessionStorage.setItem('alife:virtual-church:role', churchRole)
    } catch { /* continue without storage */ }
  }, [characterId, churchRole])
  const [showWelcome, setShowWelcome] = useState(() => {
    // Returning from either indoor room must not replay the first-visit card.
    // Do not cover their arrival with the first-visit welcome card.
    if (config3D.visualVersion === 'v3' && (arrivalDoor !== null || arrivalFromStudyRoom)) return false
    try { return window.sessionStorage.getItem('alife:virtual-church:welcomed') !== 'true' } catch { return true }
  })
  const [webGlAvailable, setWebGlAvailable] = useState(supportsWebGl)
  const [webGlLost, setWebGlLost] = useState(false)
  const [sceneRuntimeError, setSceneRuntimeError] = useState<string | null>(null)
  const [networkOnline, setNetworkOnline] = useState(() => navigator.onLine !== false)
  const [canvasSessionKey, setCanvasSessionKey] = useState(0)
  const [characterRetryRevision, setCharacterRetryRevision] = useState(0)
  const [runtimeSignalsReady, setRuntimeSignalsReady] = useState(false)
  const automaticRecoveryAttemptedRef = useRef(false)
  const contextLossInjectionCountRef = useRef(0)
  const reducedMotion = useVirtualChurchReducedMotion()
  const doorInteraction = useMemo(() => ({ position: doorPlayerPosition, reducedMotion }), [reducedMotion])
  const interactive3DEnabled =
    runtimeSignalsReady
    && webGlAvailable
    && !webGlLost
    && sceneRuntimeError === null
  const { status: runtimeStatus, characterFallback, characterReady } = useVirtualChurchRuntimeStatus(
    interactive3DEnabled,
    config3D.visualVersion,
  )
  const dialogOpen = showGuide
    || showGatherings
    || showCharacters
    || (showWelcome && interactive3DEnabled)
  const playerControlsEnabled = virtualChurchPlayerInputEnabled(
    config3D.visualVersion, interactive3DEnabled, runtimeStatus, dialogOpen,
  )

  useEffect(() => {
    if (
      (profile3DInputDiagnostic !== VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC
        && profile3DInputDiagnostic !== VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC)
      || config3D.visualVersion !== 'v3'
      || !playerControlsEnabled
    ) return

    let started = false
    let interval: number | undefined
    const applyDiagnosticInput = () => {
      if (
        !started
        && document.documentElement.hasAttribute(VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE)
      ) {
        movementRef.current.diagnosticElapsedMs = 0
        started = true
      }
      if (!started) return

      const diagnostic = virtualChurchLocomotionDiagnosticInputAt(
        movementRef.current.diagnosticElapsedMs ?? 0,
        config3D.visualVersion === 'v3',
        profile3DInputDiagnostic === VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC,
      )
      movementRef.current.diagnosticX = diagnostic.keyboardX
      movementRef.current.diagnosticZ = diagnostic.keyboardZ
      movementRef.current.diagnosticSprint = diagnostic.sprint
      document.documentElement.setAttribute(
        VIRTUAL_CHURCH_INPUT_DIAGNOSTIC_PHASE_ATTRIBUTE,
        diagnostic.phase,
      )
      requestFrameRef.current?.()
      if (diagnostic.complete && interval !== undefined) {
        window.clearInterval(interval)
        interval = undefined
        movementRef.current.diagnosticElapsedMs = null
      }
    }

    applyDiagnosticInput()
    interval = window.setInterval(applyDiagnosticInput, 25)
    return () => {
      if (interval !== undefined) window.clearInterval(interval)
      movementRef.current.diagnosticX = 0
      movementRef.current.diagnosticZ = 0
      movementRef.current.diagnosticSprint = false
      movementRef.current.diagnosticElapsedMs = null
      document.documentElement.removeAttribute(
        VIRTUAL_CHURCH_INPUT_DIAGNOSTIC_PHASE_ATTRIBUTE,
      )
      requestFrameRef.current?.()
    }
  }, [characterReview, playerControlsEnabled])

  useLayoutEffect(() => {
    clearVirtualChurchRuntimeSignals()
    setRuntimeSignalsReady(true)

    return clearVirtualChurchRuntimeSignals
  }, [])

  useLayoutEffect(() => {
    if (!interactive3DEnabled || !profile3DEnabled) return
    const scope = beginVirtualChurchCharacterDiagnosticScope()
    virtualChurchCharacterDiagnosticScope = scope
    updateVirtualChurchCharacterResourceDiagnostic()
    return () => {
      scope.dispose()
      if (virtualChurchCharacterDiagnosticScope === scope) virtualChurchCharacterDiagnosticScope = null
    }
  }, [interactive3DEnabled, canvasSessionKey])

  useLayoutEffect(() => {
    if (!interactive3DEnabled || config3D.visualVersion !== 'v3'
      || profile3DFailureMode === 'church-glb' || typeof createImageBitmap === 'undefined'
      || !virtualChurchCanPrefetchTextures(navigator.userAgent)) return
    const release = VIRTUAL_CHURCH_TEXTURE_PREFETCH.retain()
    VIRTUAL_CHURCH_TEXTURE_PREFETCH.prime()
    return release
  }, [interactive3DEnabled, canvasSessionKey])

  useEffect(() => {
    if (!sceneRuntimeError || !virtualChurchChunkLoadFailed(sceneRuntimeError)) return
    const updateConnectionState = () => setNetworkOnline(navigator.onLine !== false)
    updateConnectionState()
    window.addEventListener('online', updateConnectionState)
    window.addEventListener('offline', updateConnectionState)
    return () => {
      window.removeEventListener('online', updateConnectionState)
      window.removeEventListener('offline', updateConnectionState)
    }
  }, [sceneRuntimeError])

  const retryWebGl = useCallback(() => {
    if (sceneRuntimeError && virtualChurchChunkLoadFailed(sceneRuntimeError)) {
      const recovery = recoverVirtualChurchChunkOnce(true)
      if (recovery === null) setNetworkOnline(navigator.onLine !== false)
      return
    }
    clearVirtualChurchRuntimeSignals()
    setSceneRuntimeError(null)
    const available = supportsWebGl()
    setWebGlAvailable(available)
    if (!available) return
    // A loader may reject after its Canvas disappears, so no mounted asset
    // boundary observes it. Evict that unused promise before explicit retry;
    // clearFailedGltfAsset preserves any live generation owned by another view.
    if (config3D.visualVersion === 'v3') clearFailedGltfAsset(CHURCH_HERO_ASSET_PATH)
    setCanvasSessionKey((session) => session + 1)
    setWebGlLost(false)
  }, [sceneRuntimeError])

  const retryCharacter = useCallback(() => {
    if (!beginVirtualChurchCharacterRetry()) return
    // Only the failed avatar boundary remounts. Keep the controller, position,
    // camera, church and WebGL context alive; focus stays usable when ready.
    pageRef.current?.focus({ preventScroll: true })
    setCharacterRetryRevision(revision => revision + 1)
    requestFrameRef.current?.()
  }, [pageRef])

  useEffect(() => {
    let recoveryTimer: number | undefined
    const scheduleAutomaticRecovery = () => {
      if (!virtualChurchShouldAutomaticallyRecover({
        webGlAvailable,
        webGlLost,
        automaticRecoveryAttempted: automaticRecoveryAttemptedRef.current,
        diagnosticFailureMode: profile3DFailureMode,
        documentVisible: document.visibilityState === 'visible',
      })) return

      automaticRecoveryAttemptedRef.current = true
      recoveryTimer = window.setTimeout(retryWebGl, 900)
    }

    scheduleAutomaticRecovery()
    document.addEventListener('visibilitychange', scheduleAutomaticRecovery)
    return () => {
      document.removeEventListener('visibilitychange', scheduleAutomaticRecovery)
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer)
    }
  }, [retryWebGl, webGlAvailable, webGlLost])

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && webGlLost) retryWebGl()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [retryWebGl, webGlLost])

  const dismissWelcome = () => {
    setShowWelcome(false)
    try { window.sessionStorage.setItem('alife:virtual-church:welcomed', 'true') } catch { /* continue without storage */ }
  }

  const openGuide = () => {
    setShowCharacters(false)
    setShowGuide(true)
  }

  const openCharacters = () => {
    setShowGuide(false)
    setShowCharacters(true)
  }

  const returnToEntrance = () => {
    cameraModeRef.current = 'follow'
    setCameraMode('follow')
    cameraViewRef.current.pitch = .24
    teleportRef.request(SCENE_LANDMARKS.entranceApproachPoint, SCENE_LANDMARKS.entranceApproachYaw)
    setShowGuide(false)
    setShowCameraHint(false)
  }

  const viewParking = () => {
    cameraModeRef.current = 'showcase'
    setCameraMode('showcase')
    teleportRef.request(SCENE_LANDMARKS.parkingPreview, SCENE_LANDMARKS.parkingPreviewYaw)
    setShowGuide(false)
    setShowCameraHint(false)
  }

  const viewFoyer = () => {
    cameraModeRef.current = 'first'
    setCameraMode('first')
    cameraViewRef.current.pitch = VIRTUAL_CHURCH_FOYER_VIEW.pitch
    teleportRef.request(VIRTUAL_CHURCH_FOYER_VIEW.position, VIRTUAL_CHURCH_FOYER_VIEW.yaw)
    setShowGuide(false)
    setShowCameraHint(false)
  }

  const viewMainHall = () => {
    cameraModeRef.current = 'first'
    setCameraMode('first')
    cameraViewRef.current.pitch = VIRTUAL_CHURCH_MAIN_HALL_VIEW.pitch
    teleportRef.request(
      VIRTUAL_CHURCH_MAIN_HALL_VIEW.position,
      virtualChurchMainHallComparisonYaw(window.innerWidth / Math.max(1, window.innerHeight)),
    )
    setShowGuide(false)
    setShowCameraHint(false)
  }

  const viewSecondaryHall = () => {
    cameraModeRef.current = 'first'
    setCameraMode('first')
    cameraViewRef.current.pitch = VIRTUAL_CHURCH_SECONDARY_HALL_VIEW.pitch
    teleportRef.request(VIRTUAL_CHURCH_SECONDARY_HALL_VIEW.position, VIRTUAL_CHURCH_SECONDARY_HALL_VIEW.yaw)
    setShowGuide(false)
    setShowCameraHint(false)
  }

  const viewFoyerJunction = () => {
    cameraModeRef.current = 'first'
    setCameraMode('first')
    cameraViewRef.current.pitch = VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW.pitch
    teleportRef.request(VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW.position, VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW.yaw)
    setShowGuide(false)
    setShowCameraHint(false)
  }

  const viewFoyerRightJunction = () => {
    cameraModeRef.current = 'first'
    setCameraMode('first')
    cameraViewRef.current.pitch = VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW.pitch
    teleportRef.request(VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW.position, VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW.yaw)
    setShowGuide(false)
    setShowCameraHint(false)
  }

  const viewStreetFront = () => {
    cameraModeRef.current = 'follow'
    setCameraMode('follow')
    cameraViewRef.current.pitch = 0.12
    teleportRef.request(SCENE_LANDMARKS.streetFrontPreview, SCENE_LANDMARKS.streetFrontPreviewYaw)
    setShowGuide(false)
    setShowCameraHint(false)
  }

  const viewSurroundings = () => {
    cameraModeRef.current = 'follow'
    setCameraMode('follow')
    cameraViewRef.current.pitch = 0.1
    teleportRef.request(SCENE_LANDMARKS.surroundingsPreview, SCENE_LANDMARKS.surroundingsPreviewYaw)
    setShowGuide(false)
    setShowCameraHint(false)
  }

  // Direct public links may have only about:blank behind them in browser
  // history. The button promises Alife, so always return to its homepage.
  const returnToAlife = () => navigate('/', { replace: true })

  const changeCameraMode = (nextMode: CameraMode) => {
    cameraModeRef.current = nextMode
    setCameraMode(nextMode)
    cameraViewRef.current.pitch = nextMode === 'first' ? 0 : MathUtils.clamp(cameraViewRef.current.pitch, -0.35, 0.8)
    requestFrameRef.current?.()
  }

  const changeCharacter = (nextCharacter: CharacterId) => {
    setCharacterId(nextCharacter)
    try { window.sessionStorage.setItem('alife:virtual-church:character', nextCharacter) } catch { /* continue without storage */ }
    requestFrameRef.current?.()
  }

  const resetCharacterMovement = () => {
    movementRef.current.joystickX = 0
    movementRef.current.joystickZ = 0
    movementRef.current.keyboardX = 0
    movementRef.current.keyboardZ = 0
    movementRef.current.diagnosticX = 0
    movementRef.current.diagnosticZ = 0
    movementRef.current.sprint = false
    movementRef.current.diagnosticSprint = false
    movementRef.current.movementIntensity = 0
    movementRef.current.turnDurationSeconds = 0
    movementRef.current.avatarState = 'idle'
  }
  const changeCharacterReview = (nextReview: VirtualChurchCharacterReview) => {
    if (!initialCharacterReview || nextReview === characterReview) return
    resetCharacterMovement()
    setCharacterReview(nextReview)
    requestFrameRef.current?.()
  }
  const changeHero = (nextHero: VirtualChurchHeroId) => {
    if (config3D.visualVersion !== 'v3' || characterReview || nextHero === heroId) return
    resetCharacterMovement()
    setHeroId(nextHero)
    try { window.sessionStorage.setItem('alife:virtual-church:hero', nextHero) } catch { /* continue without storage */ }
    requestFrameRef.current?.()
  }

  const changeChurchRole = (nextRole: ChurchRole) => {
    setChurchRole(nextRole)
    changeCharacter(ROLE_CHARACTERS[nextRole])
    try { window.sessionStorage.setItem('alife:virtual-church:role', nextRole) } catch { /* continue without storage */ }
  }

  const changeOutfit = (nextOutfit: OutfitId) => {
    setOutfitId(nextOutfit)
    try { window.sessionStorage.setItem('alife:virtual-church:outfit', nextOutfit) } catch { /* continue without storage */ }
    requestFrameRef.current?.()
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const pressed = new Set<string>()
    let controlsIdleTimer: number | undefined
    const hideControlsHintUntilIdle = () => {
      setShowControlsHint(false)
      if (controlsIdleTimer !== undefined) window.clearTimeout(controlsIdleTimer)
      controlsIdleTimer = window.setTimeout(() => setShowControlsHint(true), 6000)
    }
    const updateKeyboard = () => {
      movementRef.current.keyboardX = (pressed.has('d') || pressed.has('arrowright') ? 1 : 0) - (pressed.has('a') || pressed.has('arrowleft') ? 1 : 0)
      movementRef.current.keyboardZ = (pressed.has('s') || pressed.has('arrowdown') ? 1 : 0) - (pressed.has('w') || pressed.has('arrowup') ? 1 : 0)
      movementRef.current.sprint = pressed.has('shift')
      requestFrameRef.current?.()
    }
    const resetKeyboard = () => {
      pressed.clear()
      movementRef.current.keyboardX = 0
      movementRef.current.keyboardZ = 0
      movementRef.current.sprint = false
      movementRef.current.jumpQueued = false
      movementRef.current.gestureQueued = false
      requestFrameRef.current?.()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const interactiveTarget = target?.closest(
        'button, a, input, select, textarea, [contenteditable="true"], [role="dialog"]',
      )
      if (!playerControlsEnabled || interactiveTarget) return
      const key = event.key.toLowerCase()
      if (key === 'shift') {
        hideControlsHintUntilIdle()
        pressed.add(key)
        updateKeyboard()
        return
      }
      if (key === ' ') {
        hideControlsHintUntilIdle()
        event.preventDefault()
        if (!event.repeat) {
          movementRef.current.jumpQueued = true
          requestFrameRef.current?.()
        }
        return
      }
      if (key === 'g') {
        hideControlsHintUntilIdle()
        event.preventDefault()
        if (
          !event.repeat
          && config3D.visualVersion === 'v3'
          && cameraModeRef.current === 'follow'
        ) {
          movementRef.current.gestureQueued = true
          requestFrameRef.current?.()
        }
        return
      }
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) return
      hideControlsHintUntilIdle()
      event.preventDefault()
      pressed.add(key)
      updateKeyboard()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      pressed.delete(event.key.toLowerCase())
      updateKeyboard()
    }
    const onPointerActivity = () => {
      if (!dialogOpen) hideControlsHintUntilIdle()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') resetKeyboard()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', resetKeyboard)
    window.addEventListener('resize', resetKeyboard)
    window.addEventListener('orientationchange', resetKeyboard)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pointerdown', onPointerActivity, { passive: true })
    window.addEventListener('pointermove', onPointerActivity, { passive: true })
    return () => {
      document.body.style.overflow = previousOverflow
      if (controlsIdleTimer !== undefined) window.clearTimeout(controlsIdleTimer)
      resetKeyboard()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', resetKeyboard)
      window.removeEventListener('resize', resetKeyboard)
      window.removeEventListener('orientationchange', resetKeyboard)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pointerdown', onPointerActivity)
      window.removeEventListener('pointermove', onPointerActivity)
    }
  }, [dialogOpen, playerControlsEnabled])

  const performanceCfg = perfConfig
  const postProcessingReady = useDeferredAfterHero(
    250,
    true,
    performanceCfg.postProcessing,
    config3D.visualVersion === 'v3',
  )
  const nearEntranceInfoVisible =
    config3D.visualVersion === 'v3'
    && nearEntrance
    && cameraMode === 'follow'
    && !dialogOpen
  const nearMainHallInfoVisible =
    config3D.visualVersion === 'v3'
    && nearMainHallDoor !== null
    && cameraMode !== 'showcase'
    && interactive3DEnabled
    && !dialogOpen

  return createPortal(
    <div ref={pageRef} tabIndex={-1} role="main" aria-label={t.churchName} className="virtual-church-ui fixed inset-0 z-[9999] overflow-hidden bg-[#0d0a04] text-[#f4d89b]" data-vc-visual={config3D.visualVersion}>
      {interactive3DEnabled ? (
        <VirtualChurchCanvasBoundary
          key={canvasSessionKey}
          onError={(error) => {
            clearVirtualChurchRuntimeSignals()
            if (virtualChurchChunkLoadFailed(error)) void recoverVirtualChurchChunkOnce()
            setSceneRuntimeError(virtualChurchRuntimeErrorMessage(error))
          }}
        >
          <Canvas
            dpr={virtualChurchDiagnosticDpr(performanceCfg.maxDevicePixelRatio, profile3DEnabled, profile3DSearchParams.get('profile3dDpr'))}
            shadows={config3D.visualVersion === 'v3' ? 'percentage' : true}
            frameloop="demand"
            camera={{ position: INITIAL_FOLLOW_CAMERA_POSITION.toArray(), fov: 47, near: 0.1, far: 190 }}
            gl={{ antialias: performanceCfg.antiAliasing !== 'none', powerPreference: 'high-performance' }}
            onCreated={({ gl, camera }) => {
              if (profile3DEnabled) performance.mark('vc:canvas:created-start')
              camera.lookAt(...INITIAL_FOLLOW_CAMERA.lookAt)
              gl.toneMapping = ACESFilmicToneMapping
              gl.toneMappingExposure = config3D.visualVersion === 'v3'
                ? ALIFE_V3_SCENE_TREATMENT.scene.exposure
                : ALIFE_SCENE.exposure
              updateVirtualChurchGpuReleaseDiagnostic((diagnostic) => {
                diagnostic.createdContexts += 1
                diagnostic.activeContexts += 1
                diagnostic.lastCreatedAt = window.performance.now()
              })
              gl.domElement.addEventListener('webglcontextlost', (event) => {
                const canvasConnected = gl.domElement.isConnected
                const canvasIsCurrent = pageRef.current?.querySelector('canvas') === gl.domElement
                updateVirtualChurchGpuReleaseDiagnostic((diagnostic) => {
                  diagnostic.releasedContexts += 1
                  diagnostic.activeContexts = Math.max(0, diagnostic.activeContexts - 1)
                  diagnostic.lastReleasedAt = window.performance.now()
                  diagnostic.lastReleasePath = window.location.pathname
                  diagnostic.canvasConnectedAtRelease = canvasConnected
                  diagnostic.memoryBeforeRelease = {
                    geometries: gl.info.memory.geometries,
                    textures: gl.info.memory.textures,
                  }
                })
                // R3F force-releases detached canvases after unmount; only a
                // loss on the current visible canvas needs user recovery.
                if (!virtualChurchShouldReportContextLoss(canvasConnected, canvasIsCurrent)) return
                event.preventDefault()
                clearVirtualChurchRuntimeSignals()
                setWebGlLost(true)
              }, { once: true })
              if (
                contextLossInjectionCountRef.current < contextLossDiagnosticLimit
              ) {
                contextLossInjectionCountRef.current += 1
                window.setTimeout(() => gl.forceContextLoss(), 250)
              }
              if (profile3DEnabled) performance.mark('vc:canvas:created-end')
            }}
          >
            {config3D.visualVersion === 'v3' ? <InitialSceneShaderPreparation /> : null}
            <VirtualChurchPerformanceProbe
              key={gateACharacterAssetPath}
              cameraMode={cameraMode}
              enabled={profile3DEnabled && !dialogOpen}
              preset={performanceCfg}
              routeStartedAt={routeStartedAt}
              visualVersion={config3D.visualVersion}
            />
            <DoorInteractionContext.Provider value={doorInteraction}>
            <SiteScene visualVersion={config3D.visualVersion} showFoyerFlags={showFoyerFlags} />
            {config3D.visualVersion === 'v3' ? <PlantVisibilityPass /> : null}
            <group scale={[1, 1, -1]}>
              <LandingDust triggerRef={dustTriggerRef} enabled={!reducedMotion} />
              <PlayerController movementRef={movementRef} cameraViewRef={cameraViewRef} cameraModeRef={cameraModeRef} requestFrameRef={requestFrameRef} teleportRef={teleportRef} dustTriggerRef={dustTriggerRef} characterId={characterId} outfitId={outfitId} gateAAssetPath={gateACharacterAssetPath} characterReview={characterMotionProfile} characterRetryRevision={characterRetryRevision} avatarShadowVisible={config3D.visualVersion !== 'v3' || (characterReady && !characterFallback)} reducedMotion={reducedMotion} onNearEntrance={setNearEntrance} onNearMainHallDoor={updateNearMainHallDoor} onEnterMainHallDoor={enterMainHallDoor} />
            </group>
            </DoorInteractionContext.Provider>
            {postProcessingReady ? (
              <Suspense fallback={null}>
                <DeferredPostProcessing />
              </Suspense>
            ) : null}
          </Canvas>
        </VirtualChurchCanvasBoundary>
      ) : runtimeSignalsReady ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="max-w-md rounded-3xl border border-[#c9d9d2] bg-white p-7 text-center shadow-xl">
            <Church className="mx-auto h-11 w-11 text-[#176b5a]" />
            <h1 className="mt-4 text-2xl font-black">
              {sceneRuntimeError
                ? virtualChurchChunkLoadFailed(sceneRuntimeError)
                  ? t.chunkConflictTitle
                  : t.sceneErrorTitle
                : webGlLost
                  ? t.contextLostTitle
                  : t.unavailableTitle}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#64756e]">
              {sceneRuntimeError
                ? virtualChurchChunkLoadFailed(sceneRuntimeError)
                  ? networkOnline ? t.chunkConflictBody : t.chunkOfflineBody
                  : t.sceneErrorBody
                : webGlLost
                  ? t.contextLostBody
                  : t.unavailableBody}
            </p>
            {sceneRuntimeError ? (
              <details className="mt-5 rounded-xl bg-[#f2f5f3] px-4 py-3 text-left">
                <summary className="cursor-pointer text-xs font-black text-[#176b5a]">
                  {t.technicalDetails}
                </summary>
                <code className="mt-2 block break-words text-xs leading-5 text-[#53635d]">
                  {sceneRuntimeError}
                </code>
              </details>
            ) : null}
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={retryWebGl} disabled={Boolean(sceneRuntimeError && virtualChurchChunkLoadFailed(sceneRuntimeError) && !networkOnline)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#176b5a] bg-white px-5 text-sm font-black text-[#176b5a] disabled:cursor-not-allowed disabled:opacity-60"><Play className="h-4 w-4" />{sceneRuntimeError && virtualChurchChunkLoadFailed(sceneRuntimeError) ? networkOnline ? t.cleanReload3D : t.reconnect3D : t.retry3D}</button>
              <button type="button" onClick={() => navigate('/study')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#173f36] px-5 text-sm font-black text-white"><BookOpen className="h-4 w-4" />{t.enterStudy}</button>
            </div>
          </div>
        </div>
      ) : null}

      {virtualChurchShouldCoverLoadingScene(config3D.visualVersion, interactive3DEnabled, runtimeStatus) ? (
        <div
          aria-hidden="true"
          data-vc-loading-cover="true"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#0d1511]"
        >
          <Church className="h-14 w-14 text-[#d4ac63]/70" strokeWidth={1.2} />
        </div>
      ) : null}

      <VirtualChurchRuntimeStatusIndicator
        status={runtimeStatus}
        t={t}
        gateASafeArea={config3D.visualVersion === 'v3'}
        visualSuppressed={nearEntranceInfoVisible || nearMainHallInfoVisible}
        onRetryCharacter={characterFallback ? retryCharacter : undefined}
        characterRetryPending={characterFallback && !characterReady}
      />

      {interactive3DEnabled ? (
        <CameraDragArea cameraViewRef={cameraViewRef} requestFrameRef={requestFrameRef} onFirstUse={() => setShowCameraHint(false)} label={t.cameraHint} />
      ) : null}

      <div
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {nearEntranceInfoVisible
          ? `${t.nearEntranceInfoTitle}. ${t.nearEntranceInfoDetail}`
          : nearMainHallInfoVisible ? t.mainHallDoorPrompt : ''}
      </div>

      {nearEntranceInfoVisible ? (
          <aside
            aria-label={t.nearEntranceInfoTitle}
            className="vc-tour-callout vc-edge-action pointer-events-auto absolute z-20"
          >
            <div className="sr-only">
              <p className="truncate text-sm font-black">{t.nearEntranceInfoTitle}</p>
              <p className="mt-1 truncate text-xs font-bold text-[#f4bc68]">
                {t.nearEntranceInfoDetail}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
              onClick={() => navigateFromChurch('/events')}
            >
              <CalendarDays className="h-4 w-4" />
              {t.nearEntranceInfoAction}
            </button>
          </aside>
        ) : null}

      {nearMainHallInfoVisible ? (
        <aside
          aria-label={t.mainHallInterior}
          className="vc-tour-callout vc-edge-action pointer-events-auto absolute z-20"
        >
          <p className="sr-only">{t.mainHallDoorPrompt}</p>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d5a94d] px-3 text-sm font-black text-[#102720] transition hover:bg-[#e2bb66] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
            onClick={() => enterMainHallDoor(nearMainHallDoor!)}
          >
            <Building2 className="h-4 w-4" />{t.mainHallDoorAction}
          </button>
        </aside>
      ) : null}

      <div className="vc-topbar pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
        <div className="flex gap-2">
          <button type="button" onClick={returnToAlife} aria-label={t.back} className="vc-tour-button pointer-events-auto inline-flex h-11 items-center gap-2 rounded-2xl border border-[#c8952a]/60 bg-[#1a1208]/85 px-3 text-sm font-black text-[#f4d89b] shadow-lg backdrop-blur-xl transition hover:bg-[#2a1f0a] hover:shadow-[0_0_12px_rgba(200,149,42,0.4)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70">
            <ArrowLeft className="h-5 w-5" /><span className="hidden sm:inline">{t.back}</span>
          </button>
          <button type="button" onClick={openGuide} aria-label={t.openGuide} className="vc-tour-button pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#c8952a]/60 bg-[#1a1208]/85 text-[#f4d89b] shadow-lg backdrop-blur-xl transition hover:bg-[#2a1f0a] hover:shadow-[0_0_12px_rgba(200,149,42,0.4)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70 sm:w-auto sm:gap-2 sm:px-3">
            <Compass className="h-5 w-5" /><span className="hidden text-sm font-black sm:inline">{t.guide}</span>
          </button>
          <button type="button" onClick={openCharacters} aria-label={t.character} className="vc-tour-button pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#c8952a]/60 bg-[#1a1208]/85 text-[#f4d89b] shadow-lg backdrop-blur-xl transition hover:bg-[#2a1f0a] hover:shadow-[0_0_12px_rgba(200,149,42,0.4)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70 sm:w-auto sm:gap-2 sm:px-3">
            <UsersRound className="h-5 w-5" /><span className="hidden text-sm font-black sm:inline">{t.character}</span>
          </button>
        </div>
        <div className="pointer-events-auto flex items-start gap-2">
          <button
            type="button"
            aria-label={auth.language === 'zh' ? 'Switch to English' : '切换到中文'}
            className="vc-tour-button inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border border-[#c8952a]/60 bg-[#1a1208]/85 px-2 text-xs font-black text-[#f4d89b] shadow-lg backdrop-blur-xl transition hover:bg-[#2a1f0a] hover:shadow-[0_0_12px_rgba(200,149,42,0.4)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
            onClick={() => void auth.updateLanguage(auth.language === 'en' ? 'zh' : 'en')}
          >
            {auth.language === 'zh' ? 'EN' : '中文'}
          </button>
          <div role="group" aria-label={`${t.churchName} · ${t.prototype}`} className="vc-church-badge flex h-11 min-w-11 max-w-[calc(100vw-14rem)] items-center justify-center rounded-2xl border border-[#c8952a]/60 bg-[#1a1208]/85 px-3 text-right shadow-lg backdrop-blur-xl sm:h-auto sm:max-w-[calc(100vw-9rem)] sm:block sm:px-4 sm:py-2">
            <div className="flex items-center justify-end gap-2"><span className="hidden rounded-full bg-[#3d2a0a] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#f4d89b] sm:inline-flex">{t.prototype}</span><Church className="h-4 w-4" /></div>
            <p className="mt-1 hidden truncate text-sm font-black text-[#f4d89b] sm:block sm:text-base">{t.churchName}</p>
          </div>
        </div>
      </div>

      {config3D.visualVersion === 'v3'
        && interactive3DEnabled
        && runtimeStatus === 'ready'
        && !dialogOpen
        && !nearEntranceInfoVisible
        && !nearMainHallInfoVisible ? (
        <p className="vc-tour-hint vc-portrait-hint pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+4.25rem)] z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#c8952a]/40 bg-[#1a1208]/85 px-3 py-2 text-xs leading-5 text-[#f4d89b] shadow-lg backdrop-blur-md">
          <Smartphone aria-hidden="true" className="h-4 w-4 shrink-0 -rotate-90" />
          <span>{t.landscapeHint}</span>
        </p>
      ) : null}

      {showControlsHint
        && !nearEntranceInfoVisible
        && !nearMainHallInfoVisible
        && runtimeStatus === 'ready'
        && cameraMode !== 'showcase'
        && interactive3DEnabled ? (
        <div className="vc-tour-hint vc-keyboard-hint pointer-events-none absolute left-1/2 top-24 hidden -translate-x-1/2 rounded-full border border-[#c8952a]/25 bg-[#1a1208]/45 px-4 py-2 text-xs font-bold text-[#f4d89b]/80 shadow-md backdrop-blur-sm transition-opacity duration-300 sm:flex sm:items-center sm:gap-2">
          <MapPin className="h-4 w-4" />{t.controls}
        </div>
      ) : null}

      {showCameraHint && runtimeStatus === 'ready' && cameraMode !== 'showcase' && interactive3DEnabled ? (
        <div className="vc-tour-hint pointer-events-none absolute right-4 top-[28%] z-20 -translate-y-1/2 rounded-full border border-[#c8952a]/40 bg-[#1a1208]/85 px-3 py-2 text-[11px] font-black text-[#f4d89b] shadow-lg backdrop-blur-md desktop:hidden">
          {t.cameraHint}
        </div>
      ) : null}

      {interactive3DEnabled ? (
        <div
          className={[
            'vc-camera-switcher pointer-events-none absolute left-1/2 z-30 -translate-x-1/2',
            config3D.visualVersion === 'v3' && cameraMode !== 'showcase'
              ? 'bottom-[calc(env(safe-area-inset-bottom)+10.5rem)] desktop:bottom-6'
              : 'bottom-[max(7rem,env(safe-area-inset-bottom))] sm:bottom-6',
          ].join(' ')}
        >
          <CameraModeSwitcher
            mode={cameraMode}
            labels={{ group: t.cameraModes, first: t.firstPerson, follow: t.thirdPerson, showcase: t.showcaseView }}
            onChange={changeCameraMode}
            gateATouchLayout={config3D.visualVersion === 'v3'}
          />
        </div>
      ) : null}

      {cameraMode !== 'showcase' && playerControlsEnabled ? (
        <div className="vc-touch-controls pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
        <div className="pointer-events-auto desktop:hidden">
          <MovementJoystick movementRef={movementRef} requestFrameRef={requestFrameRef} label={t.moveHint} />
          <p className="mt-2 text-center text-[11px] font-black text-white drop-shadow-md">{t.moveHint}</p>
        </div>

        <div className="flex max-w-xs flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {config3D.visualVersion === 'v3' && cameraMode === 'follow' ? (
              <button
                type="button"
                aria-label={t.greet}
                aria-keyshortcuts="G"
                title={t.greet}
                className="vc-tour-button pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#c8952a]/60 bg-[#1a1208]/85 text-white shadow-[0_14px_35px_rgba(0,0,0,0.28)] backdrop-blur-md transition active:scale-95 hover:shadow-[0_0_12px_rgba(200,149,42,0.4)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
                onClick={() => {
                  movementRef.current.gestureQueued = true
                  requestFrameRef.current?.()
                }}
              >
                <Hand className="h-6 w-6" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={t.jump}
              className="vc-tour-button pointer-events-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-[#c8952a]/60 bg-[#1a1208]/85 text-white shadow-[0_14px_35px_rgba(0,0,0,0.28)] backdrop-blur-md transition active:scale-95 hover:shadow-[0_0_12px_rgba(200,149,42,0.4)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70 desktop:hidden"
              onPointerDown={(event) => {
                event.preventDefault()
                movementRef.current.jumpQueued = true
                requestFrameRef.current?.()
              }}
            >
              <ArrowUp className="h-7 w-7" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigateFromChurch('/study')}
            className={['vc-tour-button pointer-events-auto inline-flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-black shadow-[0_14px_35px_rgba(0,0,0,0.25)] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70', nearEntrance ? 'bg-[#c8952a] text-[#fff5e0] hover:bg-[#daa84a]' : 'border border-[#c8952a]/60 bg-[#1a1208]/85 text-[#f4d89b] hover:bg-[#2a1f0a] hover:shadow-[0_0_12px_rgba(200,149,42,0.4)]'].join(' ')}
          >
            <BookOpen className="h-5 w-5" />{nearEntrance ? t.nearStudy : t.goStudy}
          </button>
          <div className={`vc-accuracy-note hidden items-start gap-2 rounded-2xl border border-[#c8952a]/40 bg-[#1a1208]/80 p-3 text-xs leading-5 text-[#c8a060] shadow-lg backdrop-blur-xl ${config3D.visualVersion === 'v3' ? '' : 'sm:flex'}`}>
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#f4d89b]" />{t.accuracy}
          </div>
        </div>
        </div>
      ) : null}

      {showWelcome && interactive3DEnabled ? (
        <WelcomeDialog t={t} v3={config3D.visualVersion === 'v3'} onDismiss={dismissWelcome} onNavigate={navigateFromChurch} />
      ) : null}

      {showGuide ? <GuidePanel t={t} onClose={() => setShowGuide(false)} onEntrance={returnToEntrance} onFoyer={viewFoyer} onMainHallView={viewMainHall} onSecondaryHallView={viewSecondaryHall} onJunction={viewFoyerJunction} onRightJunction={viewFoyerRightJunction} onParking={viewParking} onStreetFront={viewStreetFront} onSurroundings={viewSurroundings} onNavigate={navigateFromChurch} showFoyerFlags={showFoyerFlags} onToggleFoyerFlags={() => setShowFoyerFlags(value => !value)} v3={config3D.visualVersion === 'v3'} /> : null}
      {showGatherings ? <VirtualChurchGatheringsDialog language={auth.language} onClose={() => setShowGatherings(false)} /> : null}
      {showCharacters ? <CharacterPanel t={t} characterId={characterId} churchRole={churchRole} outfitId={outfitId} isGateAPreview={config3D.visualVersion === 'v3'} characterReview={characterReview} heroId={heroId} onHeroChange={changeHero} onCharacterReviewChange={changeCharacterReview} onRoleChange={changeChurchRole} onOutfitChange={changeOutfit} onClose={() => setShowCharacters(false)} /> : null}
    </div>,
    document.body,
  )
}

export default VirtualChurchView
