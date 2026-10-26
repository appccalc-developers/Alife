import { virtualChurchStudyRoomText } from '../i18n/virtualChurchStudyRoom'
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { VirtualChurchInteriorTimingProbe } from './VirtualChurchInteriorTimingProbe'
import { ACESFilmicToneMapping, InstancedMesh, Mesh, Object3D, PMREMGenerator, Texture, type BufferGeometry, type DirectionalLight, type Material } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Eye, Pause, Play } from 'lucide-react'
import { useAuthStore } from '../stores/auth'
import './virtualChurchInteriorControls.css'
import { get3DConfig, getPerformanceConfig, VIRTUAL_CHURCH_CHARACTER_REVIEW_ASSETS } from '../services/virtualChurchService'
import { useVirtualChurchPageIsolation, useVirtualChurchReducedMotion } from './virtualChurchAccessibility'
import { createSeatedStudyCompanion, STUDY_COMPANION_SEATS as seats } from './virtualChurchStudyPose'
import { createVirtualChurchStrictModeCleanupGuard, disposeVirtualChurchCharacterSkeletons } from './virtualChurchResourceLeaseContract'
import { STUDY_CAMERA_FOV, studyCameraFraming } from './virtualChurchStudyCamera'
import { buildStudyFurnitureBatches, type StudyFurnitureBatch } from './virtualChurchStudyFurniture'
import { createStudyFurnitureGeometry } from './virtualChurchStudyFurnitureGeometry'
import { createStudyCompanionBatch } from './virtualChurchStudyCompanionBatch'
import { STUDY_DAYLIGHT, studyFloorMaterialProps, studyWallMaterialProps, studyTableMaterialProps, studyVerticalTimberMaterialProps, studyRugMaterialProps, studyCushionMaterialProps } from './virtualChurchStudyMaterials'
import { createStudyWindowGeometry, studyGardenMaterialProps } from './virtualChurchStudyWindows'
import { measureMainHallSceneBudget } from './virtualChurchMainHallBudget'
import { startStudyMotionLoop, STUDY_MOTION_HZ } from './virtualChurchStudyMotion'
import { fetchStudyRoomSource, loadStudyRoomSourcePair, startStudyRoomLoad } from './virtualChurchStudyLoading'
import { virtualChurchContextLossDiagnosticLimit, virtualChurchShouldReportContextLoss } from './virtualChurchRecoveryContract'

type Companion = ReturnType<typeof createSeatedStudyCompanion>

type StudyGpuReleaseDiagnostic = {
  createdContexts: number
  releasedContexts: number
  activeContexts: number
  canvasConnectedAtRelease: boolean | null
  memoryBeforeRelease: { geometries: number; textures: number } | null
}

const STUDY_GPU_RELEASE_ATTRIBUTE = 'data-virtual-church-study-gpu-release-diagnostic'
const studyGpuReleaseDiagnosticEnabled = new URLSearchParams(window.location.search)
  .get('profile3dGpu') === 'release'

function updateStudyGpuReleaseDiagnostic(update: (current: StudyGpuReleaseDiagnostic) => void) {
  if (!studyGpuReleaseDiagnosticEnabled) return
  const diagnosticWindow = window as Window & { __alifeVirtualChurchStudyGpuRelease?: StudyGpuReleaseDiagnostic }
  const current = diagnosticWindow.__alifeVirtualChurchStudyGpuRelease ?? {
    createdContexts: 0,
    releasedContexts: 0,
    activeContexts: 0,
    canvasConnectedAtRelease: null,
    memoryBeforeRelease: null,
  }
  update(current)
  diagnosticWindow.__alifeVirtualChurchStudyGpuRelease = current
  document.documentElement.setAttribute(STUDY_GPU_RELEASE_ATTRIBUTE, JSON.stringify(current))
}

function disposeSource(source: Object3D) {
  const geometries = new Set<Mesh['geometry']>(), materials = new Set<Material>(), textures = new Set<Texture>()
  source.traverse(node => {
    if (!(node instanceof Mesh)) return
    geometries.add(node.geometry)
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material)
      Object.values(material).forEach(value => { if (value instanceof Texture) textures.add(value) })
    }
  })
  geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose())
  textures.forEach(item => { item.dispose(); if (typeof ImageBitmap !== 'undefined' && item.image instanceof ImageBitmap) item.image.close() })
  disposeVirtualChurchCharacterSkeletons(source)
}

function RoomCamera({ overview }: { overview: boolean }) {
  const { camera, invalidate, size } = useThree()
  useEffect(() => {
    const framing = studyCameraFraming(size.width, size.height, overview)
    camera.position.copy(framing.position)
    camera.lookAt(framing.target)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, overview, size.width, size.height])
  return null
}

function RoomLighting({ companions, overview }: { companions: number; overview: boolean }) {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const previous = scene.environment
    const previousIntensity = scene.environmentIntensity
    const generator = new PMREMGenerator(gl), room = new RoomEnvironment()
    const target = generator.fromScene(room, .04)
    scene.environment = target.texture
    scene.environmentIntensity = .48
    invalidate()
    return () => { scene.environment = previous; scene.environmentIntensity = previousIntensity; target.dispose(); generator.dispose(); room.dispose() }
  }, [gl, scene, invalidate])
  useEffect(() => {
    // Structural refresh; RoomMotion also refreshes when a seated pose changes.
    gl.shadowMap.needsUpdate = true
    invalidate()
  }, [gl, invalidate, companions, overview])
  return null
}

function RoomMotion({ companions, enabled, reducedMotion }: { companions: Companion[]; enabled: boolean; reducedMotion: boolean }) {
  const { gl, invalidate } = useThree()
  const elapsed = useRef(0)
  const motionDiagnostic = new URLSearchParams(window.location.search).has('profile3d')
  useEffect(() => { elapsed.current = 0 }, [companions])
  useEffect(() => {
    const render = () => {
      if (import.meta.env.DEV || motionDiagnostic) gl.domElement.dataset.studyMotionSeconds = elapsed.current.toFixed(3)
      // Breathing moves only the upper body by millimetres. Keep the initial
      // seated shadow instead of redrawing five skinned meshes at 24 Hz.
      invalidate()
    }
    if (reducedMotion) {
      elapsed.current = 0
      companions.forEach(companion => companion.updateMotion(0))
      // A changed motion preference resets the pose once; refresh its shadow.
      gl.shadowMap.needsUpdate = true
      render()
    }
    if (!enabled || reducedMotion || !companions.length) return
    const stop = startStudyMotionLoop({
      now: () => performance.now(), hidden: () => document.hidden,
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: handle => window.clearTimeout(handle),
      listen: callback => {
        document.addEventListener('visibilitychange', callback)
        return () => document.removeEventListener('visibilitychange', callback)
      },
    }, delta => {
      elapsed.current += delta
      companions.forEach(companion => companion.updateMotion(elapsed.current))
      render()
    })
    return () => { stop(); delete gl.domElement.dataset.studyMotionSeconds }
  }, [companions, enabled, reducedMotion, gl, invalidate, motionDiagnostic])
  return null
}

function Boxes({ positions, size, color, shadows = false }: { positions: Array<[number, number, number]>; size: [number, number, number]; color: string; shadows?: boolean }) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const transform = new Object3D()
    positions.forEach((position, index) => { transform.position.set(...position); transform.updateMatrix(); mesh.current?.setMatrixAt(index, transform.matrix) })
    if (mesh.current) { mesh.current.instanceMatrix.needsUpdate = true; mesh.current.computeBoundingSphere() }
  }, [positions])
  return <instancedMesh ref={mesh} args={[undefined, undefined, positions.length]} castShadow={shadows} receiveShadow={shadows}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.9} /></instancedMesh>
}

function FurnitureBatch({ batch, geometry }: { batch: StudyFurnitureBatch; geometry?: BufferGeometry }) {
  const mesh = useRef<InstancedMesh>(null)
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    if (!mesh.current) return
    batch.matrices.forEach((matrix, index) => mesh.current!.setMatrixAt(index, matrix))
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingBox(); mesh.current.computeBoundingSphere()
    invalidate()
  }, [batch, invalidate])
  return <instancedMesh ref={mesh} name={batch.id} args={[undefined, undefined, batch.matrices.length]} castShadow={batch.shadows} receiveShadow={batch.shadows}>
    {geometry ? <primitive object={geometry} attach="geometry" dispose={null} /> : <boxGeometry args={[1, 1, 1]} />}
    <meshStandardMaterial color={batch.color} roughness={batch.roughness} {...(batch.id === 'chair-legs' ? studyVerticalTimberMaterialProps : batch.id === 'chair-upholstery' ? studyCushionMaterialProps : {})} />
  </instancedMesh>
}

function Room({ companions, overview, motion, reducedMotion, lowDetail, shadowMapSize }: { companions: Companion[]; overview: boolean; motion: boolean; reducedMotion: boolean; lowDetail: boolean; shadowMapSize: number }) {
  const furniture = useMemo(() => buildStudyFurnitureBatches(companions.map(companion => companion.book), overview), [companions, overview])
  const geometry = useMemo(() => createStudyFurnitureGeometry(lowDetail), [lowDetail])
  useEffect(() => () => { Object.values(geometry).forEach(part => part.dispose()) }, [geometry])
  const windows = useMemo(() => createStudyWindowGeometry(), [])
  const windowCleanup = useMemo(() => createVirtualChurchStrictModeCleanupGuard(), [windows])
  useEffect(() => {
    windowCleanup.activate()
    return () => windowCleanup.release(() => Object.values(windows).forEach(part => part.dispose()))
  }, [windows, windowCleanup])
  const companionBatch = useMemo(() => createStudyCompanionBatch(companions.map(companion => companion.model)), [companions])
  const batchCleanup = useMemo(() => createVirtualChurchStrictModeCleanupGuard(), [companionBatch])
  useEffect(() => {
    batchCleanup.activate()
    return () => batchCleanup.release(() => companionBatch?.dispose())
  }, [companionBatch, batchCleanup])
  // Unmounted source clones retain independent bones. Refresh their matrices
  // before demand rendering; do not introduce another animation timer.
  useFrame(() => companionBatch?.update(), -1)
  return <>
    <RoomCamera overview={overview} />
    <RoomLighting companions={companions.length} overview={overview} />
    <RoomMotion companions={companions} enabled={motion} reducedMotion={reducedMotion} />
    <color attach="background" args={['#ddd7c9']} />
    <ambientLight intensity={STUDY_DAYLIGHT.ambientIntensity} />
    <hemisphereLight args={[STUDY_DAYLIGHT.skyColor, STUDY_DAYLIGHT.groundColor, STUDY_DAYLIGHT.hemisphereIntensity]} />
    <directionalLight name="study-key-light" position={[-1.5, 4.5, -8]} intensity={STUDY_DAYLIGHT.keyIntensity} color={STUDY_DAYLIGHT.keyColor} castShadow shadow-intensity={STUDY_DAYLIGHT.shadowIntensity} shadow-radius={STUDY_DAYLIGHT.shadowRadius} shadow-mapSize={[shadowMapSize, shadowMapSize]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-camera-near={.5} shadow-camera-far={20} shadow-normalBias={.025} shadow-bias={-.00015} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[30, 30]} /><meshStandardMaterial color="#95734f" roughness={.82} {...studyFloorMaterialProps} /></mesh>
    {/* Larger backing surfaces also enclose the portrait overview camera. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .008, 0]} receiveShadow><circleGeometry args={[2.72, 64]} /><meshStandardMaterial color={STUDY_DAYLIGHT.rugEdgeColor} roughness={1} {...studyRugMaterialProps} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .01, 0]} receiveShadow><circleGeometry args={[2.64, 64]} /><meshStandardMaterial color={STUDY_DAYLIGHT.rugColor} roughness={1} {...studyRugMaterialProps} /></mesh>
    <mesh name="study-openings-wall" castShadow receiveShadow><primitive object={windows.wall} attach="geometry" dispose={null} /><meshStandardMaterial color={STUDY_DAYLIGHT.wallColor} roughness={1} {...studyWallMaterialProps} /></mesh>
    <mesh position={[-4.1, 6, 3]} receiveShadow><boxGeometry args={[.15, 12, 24]} /><meshStandardMaterial color={STUDY_DAYLIGHT.wallColor} roughness={1} {...studyWallMaterialProps} /></mesh>
    <Boxes positions={[[0, .1, -3.49]]} size={[8.1, .2, .06]} color="#eee8da" />
    <mesh name="study-window-frames" castShadow receiveShadow><primitive object={windows.frames} attach="geometry" dispose={null} /><meshStandardMaterial color="#394942" roughness={.42} metalness={.35} /></mesh>
    <mesh name="study-window-sills" castShadow receiveShadow><primitive object={windows.sills} attach="geometry" dispose={null} /><meshStandardMaterial color="#e2dbcc" roughness={.76} /></mesh>
    <mesh name="study-concept-garden"><primitive object={windows.vista} attach="geometry" dispose={null} /><meshBasicMaterial {...studyGardenMaterialProps} /></mesh>
    <mesh name="study-window-glazing"><primitive object={windows.glazing} attach="geometry" dispose={null} /><meshBasicMaterial color="#dce9e8" transparent opacity={.12} depthWrite={false} /></mesh>
    <mesh position={[0, .68, 0]} castShadow receiveShadow><primitive object={geometry.tabletop} attach="geometry" dispose={null} /><meshStandardMaterial color="#8b613d" roughness={.66} {...studyTableMaterialProps} /></mesh>
    <mesh position={[0, .33, 0]} castShadow receiveShadow><primitive object={geometry.pedestal} attach="geometry" dispose={null} /><meshStandardMaterial color="#654d35" {...studyVerticalTimberMaterialProps} /></mesh>
    {furniture.map(batch => <FurnitureBatch key={`${batch.id}-${batch.matrices.length}`} batch={batch} geometry={batch.id === 'chair-upholstery' ? geometry.cushions : batch.id === 'chair-legs' ? geometry.legs : undefined} />)}
    {companionBatch ? <primitive object={companionBatch.group} dispose={null} /> : seats.map((seat, index) => <group key={index} position={seat.position} rotation={[0, seat.yaw, 0]}>
      {companions[index] ? <primitive object={companions[index].model} dispose={null} /> : null}
    </group>)}
  </>
}

// Reuse the pure scene-cost counter, not the auditorium's budget or FPS probe.
// This diagnostic exists only on an explicit profile3d review URL.
function StudyBudgetProbe({ pageRef, lowDetail }: { pageRef: MutableRefObject<HTMLDivElement | null>; lowDetail: boolean }) {
  useFrame(({ scene, camera, gl }) => {
    const keyLight = scene.getObjectByName('study-key-light') as DirectionalLight | undefined
    pageRef.current?.setAttribute('data-study-room-budget', JSON.stringify({
      kind: 'scene-cost-only', preset: lowDetail ? 'mobile' : 'desktop',
      ...measureMainHallSceneBudget(scene, camera),
      dpr: gl.getPixelRatio(), drawingBuffer: [gl.domElement.width, gl.domElement.height],
      cameraPosition: camera.position.toArray(),
      shadow: {
        type: gl.shadowMap.type, autoUpdate: gl.shadowMap.autoUpdate,
        mapSize: keyLight?.shadow.mapSize.toArray(),
        allocatedSize: keyLight?.shadow.map ? [keyLight.shadow.map.width, keyLight.shadow.map.height] : null,
      },
      // Previous completed render, not a timing/FPS sample or shadow budget.
      lastRenderedFrame: { frame: gl.info.render.frame, calls: gl.info.render.calls, triangles: gl.info.render.triangles },
    }))
  })
  useEffect(() => {
    const page = pageRef.current
    return () => page?.removeAttribute('data-study-room-budget')
  }, [pageRef])
  return null
}

class RoomCanvasBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

export default function VirtualChurchStudyRoomView() {
  const pageRef = useVirtualChurchPageIsolation()
  const navigate = useNavigate()
  const { language, updateLanguage } = useAuthStore()
  // Freeze furniture detail for this visit; rotation/language/view changes
  // never rebuild the shared buffers or promote a phone to desktop geometry.
  const [performancePreset] = useState(() => getPerformanceConfig())
  const budgetDiagnostic = new URLSearchParams(window.location.search).has('profile3d')
  const timingDiagnostic = budgetDiagnostic && new URLSearchParams(window.location.search).get('profile3dTiming') === '1'
  const zh = language === 'zh'
  const [companions, setCompanions] = useState<Companion[]>([])
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const contextLossInjections = useRef(0)
  const contextLossTimer = useRef<number | undefined>(undefined)
  const contextLossLimit = virtualChurchContextLossDiagnosticLimit(new URLSearchParams(window.location.search).get('profile3dFailure'))
  useEffect(() => () => window.clearTimeout(contextLossTimer.current), [])
  const [overview, setOverview] = useState(false)
  const [motion, setMotion] = useState(true)
  const reducedMotion = useVirtualChurchReducedMotion()
  // The mixed-gender composition is an unpublished local review, not a new
  // production dependency or an approval of the seated male coat silhouette.
  const mixedReview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('vcStudyReview') === 'mixed-v14'
  const maleReviewPath = mixedReview ? VIRTUAL_CHURCH_CHARACTER_REVIEW_ASSETS['male-v14']?.low : undefined
  useEffect(() => {
    setCompanions([])
    // Retiring this attempt releases decoded sources and partial companions;
    // retry explicitly re-arms it rather than silently reloading after failure.
    if (failed) return
    const config = get3DConfig('v3')
    const draco = new DRACOLoader().setDecoderPath(config.dracoDecoderPath)
    const loader = new GLTFLoader().setDRACOLoader(draco)
    const loadModel = (url: string, signal: AbortSignal) =>
      fetchStudyRoomSource(url, signal, (bytes, base) => loader.parseAsync(bytes, base))
    const attempt = startStudyRoomLoad({
      load: signal => maleReviewPath
        ? loadStudyRoomSourcePair<GLTF>(
          signal,
          currentSignal => loadModel(config.characters.gateAFemaleLow, currentSignal),
          currentSignal => loadModel(maleReviewPath, currentSignal),
          source => disposeSource(source.scene),
        )
        : loadModel(config.characters.gateAFemaleLow, signal).then(source => [source] as GLTF[]),
      count: seats.length,
      clone: (sources, index) => createSeatedStudyCompanion(
        (sources[index === 1 || index === 3 ? 1 : 0] ?? sources[0]).scene,
        seats[index].tint,
        index,
      ),
      disposeSource: sources => sources.forEach(source => disposeSource(source.scene)),
      disposeDecoder: () => draco.dispose(),
      ready: setCompanions,
      failed: () => setFailed(true),
    })
    return attempt.cancel
  }, [revision, maleReviewPath, failed])
  const action = 'vc-interior-button min-h-11'
  return createPortal(<main ref={pageRef} tabIndex={-1} data-vc-interior="study-room" className="virtual-church-ui fixed inset-0 z-[9999] flex flex-col" aria-label={zh ? virtualChurchStudyRoomText.virtualBibleStudyRoom.zh : virtualChurchStudyRoomText.virtualBibleStudyRoom.en}>
    <header className="vc-interior-header">
      <button type="button" onClick={() => navigate('/virtual-church?vcArrival=study-room')} className={action}><ArrowLeft size={17} />{zh ? virtualChurchStudyRoomText.backToFoyer.zh : virtualChurchStudyRoomText.backToFoyer.en}</button>
      <div className="vc-interior-caption"><h1>{zh ? virtualChurchStudyRoomText.scriptureAroundTheTable.zh : virtualChurchStudyRoomText.scriptureAroundTheTable.en}</h1><p>{zh ? virtualChurchStudyRoomText.virtualCompanionsNotLiveMembersConceptRoom.zh : virtualChurchStudyRoomText.virtualCompanionsNotLiveMembersConceptRoom.en}{maleReviewPath ? zh ? virtualChurchStudyRoomText.localMixedCharacterReview.zh : virtualChurchStudyRoomText.localMixedCharacterReview.en : null}</p></div>
      <button type="button" onClick={() => void updateLanguage(zh ? 'en' : 'zh')} className={action}>{zh ? virtualChurchStudyRoomText.switchLanguage.zh : virtualChurchStudyRoomText.switchLanguage.en}</button>
    </header>
    <div className="relative min-h-0 flex-1" aria-label={zh ? virtualChurchStudyRoomText.fiveVirtualCompanionsSeatedInACircleHolding.zh : virtualChurchStudyRoomText.fiveVirtualCompanionsSeatedInACircleHolding.en}>
      {!failed ? <RoomCanvasBoundary key={revision} onFailure={() => setFailed(true)}>
        <Canvas frameloop="demand" shadows="percentage" dpr={[1, performancePreset.maxDevicePixelRatio]} camera={{ position: [0, 1.55, 3.65], fov: STUDY_CAMERA_FOV, near: .1, far: 40 }} gl={{ antialias: true }} onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = .9
          gl.shadowMap.autoUpdate = false
          gl.shadowMap.needsUpdate = true
          updateStudyGpuReleaseDiagnostic(current => { current.createdContexts++; current.activeContexts++ })
          gl.domElement.addEventListener('webglcontextlost', event => {
            const canvasConnected = gl.domElement.isConnected
            updateStudyGpuReleaseDiagnostic(current => {
              current.releasedContexts++
              current.activeContexts = Math.max(0, current.activeContexts - 1)
              current.canvasConnectedAtRelease = canvasConnected
              current.memoryBeforeRelease = {
                geometries: gl.info.memory.geometries,
                textures: gl.info.memory.textures,
              }
            })
            if (!virtualChurchShouldReportContextLoss(canvasConnected, pageRef.current?.querySelector('canvas') === gl.domElement)) return
            event.preventDefault()
            setFailed(true)
          }, { once: true })
          if (contextLossInjections.current < contextLossLimit) {
            contextLossInjections.current++
            contextLossTimer.current = window.setTimeout(() => gl.forceContextLoss(), 250)
          }
        }}><Room companions={companions} overview={overview} motion={motion && !failed} reducedMotion={reducedMotion} lowDetail={performancePreset.isMobile} shadowMapSize={Math.min(1024, performancePreset.shadowMapSize)} />
          {budgetDiagnostic ? <StudyBudgetProbe pageRef={pageRef} lowDetail={performancePreset.isMobile} /> : null}
          {timingDiagnostic ? <VirtualChurchInteriorTimingProbe pageRef={pageRef} active={companions.length === 5 && motion && !reducedMotion} room="study-room" mode={overview ? 'overview' : 'seated'} preset={performancePreset.isMobile ? 'mobile' : 'desktop'} motionUpdateLimitHz={STUDY_MOTION_HZ} /> : null}
        </Canvas>
      </RoomCanvasBoundary> : null}
      {failed || !companions.length ? <div role={failed ? 'alert' : 'status'} className="vc-interior-panel absolute left-1/2 top-4 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 p-4 text-center"><p>{failed ? zh ? virtualChurchStudyRoomText.theRoomCouldNotBeFullyDisplayedYou.zh : virtualChurchStudyRoomText.theRoomCouldNotBeFullyDisplayedYou.en : zh ? virtualChurchStudyRoomText.preparingYourStudyCompanions.zh : virtualChurchStudyRoomText.preparingYourStudyCompanions.en}</p>{failed ? <button type="button" className={`${action} mt-3`} onClick={() => { setFailed(false); setRevision(value => value + 1) }}>{zh ? virtualChurchStudyRoomText.retryRoom.zh : virtualChurchStudyRoomText.retryRoom.en}</button> : null}</div> : null}
    </div>
    <footer className="vc-interior-footer">
      <button type="button" aria-pressed={motion && !reducedMotion} disabled={reducedMotion || failed || !companions.length} className={action} onClick={() => setMotion(value => !value)}>{motion && !reducedMotion ? <Pause size={18} /> : <Play size={18} />}{reducedMotion ? zh ? virtualChurchStudyRoomText.reducedMotion.zh : virtualChurchStudyRoomText.reducedMotion.en : motion ? zh ? virtualChurchStudyRoomText.pauseCompanions.zh : virtualChurchStudyRoomText.pauseCompanions.en : zh ? virtualChurchStudyRoomText.animateCompanions.zh : virtualChurchStudyRoomText.animateCompanions.en}</button>
      <button type="button" aria-pressed={overview} className={action} onClick={() => setOverview(value => !value)}><Eye size={18} />{overview ? zh ? virtualChurchStudyRoomText.seatedView.zh : virtualChurchStudyRoomText.seatedView.en : zh ? virtualChurchStudyRoomText.roomOverview.zh : virtualChurchStudyRoomText.roomOverview.en}</button>
      <button type="button" className={`${action} vc-interior-primary`} onClick={() => navigate('/study?from=virtual-church-study-room')}><BookOpen size={18} />{zh ? virtualChurchStudyRoomText.readScripture.zh : virtualChurchStudyRoomText.readScripture.en}</button>
    </footer>
  </main>, document.body)
}
