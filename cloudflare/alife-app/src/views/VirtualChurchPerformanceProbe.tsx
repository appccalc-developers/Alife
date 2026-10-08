import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { Box3, Frustum, Matrix4, Vector2, Vector3, type BufferGeometry, type InstancedMesh, type Material, type Mesh, type Texture } from 'three'
import type { PerformanceConfig, VirtualChurchVisualVersion } from '../services/virtualChurchService'
import { SCENE_LANDMARKS } from './virtualChurchScene'
import { installVirtualChurchGpuTiming } from './virtualChurchGpuTiming'
import { createVirtualChurchContinuousSubmissionSampler } from './virtualChurchInputDiagnostic'
import {
  VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_ASSET_ATTRIBUTE,
  VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE,
  VIRTUAL_CHURCH_PROFILE_ATTRIBUTE,
  VIRTUAL_CHURCH_SAMPLING_ATTRIBUTE,
  VIRTUAL_CHURCH_CONTINUOUS_TIMING_ATTRIBUTE,
  VIRTUAL_CHURCH_INPUT_DIAGNOSTIC_PHASE_ATTRIBUTE,
  VIRTUAL_CHURCH_PLAYER_POSE_ATTRIBUTE,
  readVirtualChurchFallbackSignals,
} from './virtualChurchRuntimeSignals'
import {
  VIRTUAL_CHURCH_GPU_MEMORY_BUDGET_BYTES,
  virtualChurchResourceBelongsToProfile,
  virtualChurchSessionElapsedMs,
  virtualChurchDrawCategory,
  installVirtualChurchStartupPassTrace,
  virtualChurchStartupAssetsPending,
  virtualChurchStartupPending,
  virtualChurchStartupBeforePrepare,
  virtualChurchStartupStageMarks,
  type VirtualChurchStartupPassTiming,
  type VirtualChurchDrawCategory,
} from './virtualChurchPerformanceContract'

export {
  VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE,
  VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE,
  VIRTUAL_CHURCH_PROFILE_ATTRIBUTE,
} from './virtualChurchRuntimeSignals'

// Use a 50 × 50 metre entrance area as a stable AABB so the metric is independent of
// camera mode and can be reproduced on desktop and mobile presets. SiteScene
// mirrors source Z once at its root, so convert the landmark to world Z here.
const HERO_AREA_HALF_EXTENT_METRES = 25
const HERO_AREA_VERTICAL_MIN_METRES = -2
const HERO_AREA_VERTICAL_MAX_METRES = 15
const HERO_AREA_WORLD_CENTER = new Vector3(
  SCENE_LANDMARKS.entrance[0],
  0,
  -SCENE_LANDMARKS.entrance[2],
)
const HERO_AREA_WORLD_BOUNDS = new Box3(
  new Vector3(
    HERO_AREA_WORLD_CENTER.x - HERO_AREA_HALF_EXTENT_METRES,
    HERO_AREA_VERTICAL_MIN_METRES,
    HERO_AREA_WORLD_CENTER.z - HERO_AREA_HALF_EXTENT_METRES,
  ),
  new Vector3(
    HERO_AREA_WORLD_CENTER.x + HERO_AREA_HALF_EXTENT_METRES,
    HERO_AREA_VERTICAL_MAX_METRES,
    HERO_AREA_WORLD_CENTER.z + HERO_AREA_HALF_EXTENT_METRES,
  ),
)

type VirtualChurchPerformanceProbeProps = {
  cameraMode: 'first' | 'follow' | 'showcase'
  enabled: boolean
  preset: PerformanceConfig
  routeStartedAt: number
  visualVersion: VirtualChurchVisualVersion
}

// Explicit continuous review only. Observe the real main-camera scene pass,
// including an offscreen pass when postprocessing is active, not final GPU
// presentation. No timer, invalidation, or independent input/render driver.
const VirtualChurchContinuousTimingProbe = ({ preset }: { preset: PerformanceConfig }) => {
  const { scene, camera, gl } = useThree()
  const epoch = useRef(0)
  useFrame(() => { epoch.current++ })
  useLayoutEffect(() => {
    const root = document.documentElement, previous = scene.onAfterRender
    const sampler = createVirtualChurchContinuousSubmissionSampler()
    const phaseEntries: Array<{ phase: string; pose: unknown }> = []
    const targets = new Set<string>()
    let retired = false, observedEpoch = -1
    const hook: typeof scene.onAfterRender = function (this: typeof scene, ...args) {
      previous.apply(this, args)
      if (retired || args[0] !== gl || args[2] !== camera || observedEpoch === epoch.current) return
      observedEpoch = epoch.current
      const phase = root.getAttribute(VIRTUAL_CHURCH_INPUT_DIAGNOSTIC_PHASE_ATTRIBUTE)
      if (phase === null) return
      const poseText = root.getAttribute(VIRTUAL_CHURCH_PLAYER_POSE_ATTRIBUTE)
      let pose: { diagnosticMs?: number | null } | null = null
      try { pose = poseText ? JSON.parse(poseText) : null } catch { /* malformed diagnostics cannot break the scene */ }
      const fallback = readVirtualChurchFallbackSignals(root)
      const sample = sampler.observe(performance.now(), !document.hidden, phase, pose?.diagnosticMs ?? null,
        root.hasAttribute(VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE) && root.hasAttribute(VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE)
        && !fallback.character && !fallback.church)
      targets.add(gl.getRenderTarget() === null ? 'default' : 'offscreen')
      if (!sample) return
      if (phaseEntries.length < 15) phaseEntries.push({ phase, pose })
      root.setAttribute(VIRTUAL_CHURCH_CONTINUOUS_TIMING_ATTRIBUTE, JSON.stringify({ ...sample, phaseEntries,
        targets: [...targets], preset: preset.isMobile ? 'mobile' : 'desktop',
        drawingBuffer: [gl.domElement.width, gl.domElement.height], dpr: gl.getPixelRatio() }))
    }
    scene.onAfterRender = hook
    return () => {
      retired = true
      if (scene.onAfterRender === hook) scene.onAfterRender = previous
      root.removeAttribute(VIRTUAL_CHURCH_CONTINUOUS_TIMING_ATTRIBUTE)
    }
  }, [scene, camera, gl, preset])
  return null
}

// Mounted only for the explicit CPU diagnostic. Do not add a frame callback or
// change automatic rendering ownership for ordinary/regular FPS visits.
const VirtualChurchCpuFrameStart = ({ trace }: {
  trace: RefObject<ReturnType<typeof installVirtualChurchStartupPassTrace> | null>
}) => {
  useFrame(() => trace.current?.beginFrame(), -100)
  return null
}

const percentile = (sortedValues: number[], ratio: number) => {
  if (sortedValues.length === 0) return 0
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * ratio))]
}

type TextureImageLike = {
  width?: number
  height?: number
  videoWidth?: number
  videoHeight?: number
}

const textureDimensions = (texture: Texture) => {
  const source = texture.source?.data ?? texture.image
  const images = Array.isArray(source) ? source : [source]

  return images.reduce((result, image) => {
    const candidate = image as TextureImageLike | null | undefined
    const width = candidate?.width ?? candidate?.videoWidth ?? 0
    const height = candidate?.height ?? candidate?.videoHeight ?? 0
    return {
      pixels: result.pixels + Math.max(0, width) * Math.max(0, height),
      maxDimension: Math.max(result.maxDimension, width, height),
    }
  }, { pixels: 0, maxDimension: 0 })
}

const collectMaterialTextures = (material: Material, target: Set<Texture>) => {
  Object.values(material).forEach((value) => {
    if (
      value
      && typeof value === 'object'
      && 'isTexture' in value
      && value.isTexture === true
    ) {
      target.add(value as Texture)
    }
  })
}

const estimateTextureMemory = (textures: Set<Texture>) =>
  [...textures].reduce((result, texture) => {
    const dimensions = textureDimensions(texture)
    const mipFactor = texture.generateMipmaps ? 4 / 3 : 1
    return {
      bytes: result.bytes + Math.ceil(dimensions.pixels * 4 * mipFactor),
      maxDimension: Math.max(result.maxDimension, dimensions.maxDimension),
    }
  }, { bytes: 0, maxDimension: 0 })

const readDiagnosticNetworkProfile = async () => {
  try {
    const response = await fetch('/__alife_profile_network.json', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      return null
    }
    const payload = await response.json() as {
      kilobitsPerSecond?: unknown
      latencyMs?: unknown
    }
    return typeof payload.kilobitsPerSecond === 'number'
      && Number.isFinite(payload.kilobitsPerSecond)
      && typeof payload.latencyMs === 'number'
      && Number.isFinite(payload.latencyMs)
      ? {
          kilobitsPerSecond: Number(payload.kilobitsPerSecond),
          latencyMs: Number(payload.latencyMs),
        }
      : null
  } catch {
    return null
  }
}

export const VirtualChurchPerformanceProbe = ({
  cameraMode,
  enabled,
  preset,
  routeStartedAt,
  visualVersion,
}: VirtualChurchPerformanceProbeProps) => {
  const { camera, gl, scene, invalidate } = useThree()
  const warmupStartedAtRef = useRef<number | null>(null)
  const samplingStartedAtRef = useRef<number | null>(null)
  const frameCountRef = useRef(0)
  const frameTimesRef = useRef<number[]>([])
  const lastFrameAtRef = useRef<number | null>(null)
  const maximumCallbackGapMsRef = useRef(0)
  const samplingInterruptionCountRef = useRef(0)
  const samplingRestartCountRef = useRef(0)
  const reportedRef = useRef(false)
  const publicationEpochRef = useRef(0)
  const longTasksRef = useRef<Array<{ startMs: number; durationMs: number }>>([])
  const startupFrameMarksRef = useRef(0)
  const startupProgramChangesRef = useRef<Array<{
    frame: number
    durationMs: number
    programsBefore: number
    programsAfter: number
    addedByShader: Record<string, number>
  }>>([])
  const traceStartupFramesRef = useRef(new URLSearchParams(window.location.search).has('profile3d'))
  const startupPassTimingsRef = useRef<VirtualChurchStartupPassTiming[] | null>(null)
  const startupPassPhaseRef = useRef<string | null>(null)
  const steadyCpuTraceRef = useRef<ReturnType<typeof installVirtualChurchStartupPassTrace> | null>(null)
  const gpuTimingRef = useRef<ReturnType<typeof installVirtualChurchGpuTiming> | null>(null)

  useLayoutEffect(() => {
    if (!traceStartupFramesRef.current) return
    const originalRender = gl.render
    let sceneRenderCount = 0
    gl.render = (...args) => {
      const trace = args[0] === scene && sceneRenderCount < 3
      const programsBefore = trace ? [...(gl.info.programs ?? [])] : []
      const renderStartedAt = trace ? performance.now() : 0
      if (trace) {
        sceneRenderCount += 1
        performance.mark(`vc:renderer:scene-start-${sceneRenderCount}:programs-${gl.info.programs?.length ?? 0}`)
      }
      try {
        return originalRender.apply(gl, args)
      } finally {
        if (trace) {
          performance.mark(`vc:renderer:scene-end-${sceneRenderCount}:programs-${gl.info.programs?.length ?? 0}`)
          const currentPrograms = gl.info.programs ?? []
          const knownIds = new Set(programsBefore.map(program => program.id))
          const addedByShader: Record<string, number> = {}
          for (const program of currentPrograms) {
            if (knownIds.has(program.id)) continue
            const shaderId = program.cacheKey.split(',', 1)[0]
            const shader = /^(standard|physical|basic|depth|distanceRGBA|phong|lambert|normal)$/.test(shaderId)
              ? shaderId
              : 'other'
            addedByShader[shader] = (addedByShader[shader] ?? 0) + 1
          }
          startupProgramChangesRef.current.push({
            frame: sceneRenderCount,
            durationMs: Number((performance.now() - renderStartedAt).toFixed(1)),
            programsBefore: programsBefore.length,
            programsAfter: currentPrograms.length,
            addedByShader,
          })
        }
      }
    }
    return () => { gl.render = originalRender }
  }, [gl, scene])

  useLayoutEffect(() => {
    const phase = new URLSearchParams(window.location.search).get('profile3dStartupPasses')
    if (!traceStartupFramesRef.current || (phase !== '1' && phase !== 'assets' && phase !== 'early' && phase !== 'all')) return
    // The first three scene renders predate network-delivered models. This
    // assets covers up to 60 renders after church preparation; early covers
    // at most 180 before its prepare callback. Explicit all spans both initial
    // and arriving assets, capped at180 and closed by current rendered readiness.
    // Instrumented submissions are not formal FPS-gate evidence or GPU time.
    const trace = installVirtualChurchStartupPassTrace(gl, scene, () => performance.now(), phase === 'all' ? {
      shouldSample: () => virtualChurchStartupPending(
        routeStartedAt,
        document.documentElement.getAttribute(VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE),
        document.documentElement.getAttribute(VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE),
      ),
      maximumFrames: 180,
      includeFrameStartTime: true,
    } : phase === 'early' ? {
      shouldSample: () => virtualChurchStartupBeforePrepare(
        routeStartedAt,
        performance.getEntriesByName('vc:church:prepare-start').at(-1)?.startTime ?? null,
      ),
      maximumFrames: 180,
      includeFrameStartTime: true,
    } : phase === 'assets' ? {
      shouldSample: () => virtualChurchStartupAssetsPending(
        routeStartedAt,
        performance.getEntriesByName('vc:church:prepare-end').at(-1)?.startTime ?? null,
        document.documentElement.getAttribute(VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE),
        document.documentElement.getAttribute(VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE),
      ),
    } : undefined, new URLSearchParams(window.location.search).get('profile3dTextureUploads') === '1',
    new URLSearchParams(window.location.search).get('profile3dDrawCalls') === '1')
    startupPassPhaseRef.current = phase
    startupPassTimingsRef.current = trace.frames
    return () => { trace.dispose(); startupPassTimingsRef.current = null; startupPassPhaseRef.current = null }
  }, [gl, scene, routeStartedAt])

  useLayoutEffect(() => {
    if (!traceStartupFramesRef.current || new URLSearchParams(window.location.search).get('profile3dCpu') !== '1') return
    const trace = installVirtualChurchStartupPassTrace(gl, scene, () => performance.now(), {
      shouldSample: () => samplingStartedAtRef.current !== null && !reportedRef.current,
    })
    steadyCpuTraceRef.current = trace
    return () => { trace.dispose(); steadyCpuTraceRef.current = null }
  }, [gl, scene])

  useLayoutEffect(() => {
    if (!traceStartupFramesRef.current || new URLSearchParams(window.location.search).get('profile3dGpuTiming') !== '1') return
    const trace = installVirtualChurchGpuTiming(gl, scene,
      () => samplingStartedAtRef.current !== null && !reportedRef.current)
    gpuTimingRef.current = trace
    return () => { trace.dispose(); gpuTimingRef.current = null }
  }, [gl, scene])

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('profile3d')
      || typeof PerformanceObserver === 'undefined'
      || !PerformanceObserver.supportedEntryTypes.includes('longtask')) return
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        longTasksRef.current.push({ startMs: entry.startTime, durationMs: entry.duration })
      }
      // Diagnostic only; keep startup evidence bounded on a long-lived route.
      if (longTasksRef.current.length > 256) longTasksRef.current.splice(0, longTasksRef.current.length - 256)
    })
    observer.observe({ type: 'longtask', buffered: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // Resuming a diagnostic must wake a settled demand-rendered scene.
    if (enabled && !reportedRef.current) invalidate()
  }, [enabled, invalidate])

  useEffect(() => {
    const resetInterruptedSample = () => {
      samplingInterruptionCountRef.current += 1
      warmupStartedAtRef.current = null
      samplingStartedAtRef.current = null
      frameCountRef.current = 0
      frameTimesRef.current = []
      lastFrameAtRef.current = null
      maximumCallbackGapMsRef.current = 0
      if (document.visibilityState === 'visible') invalidate()
    }
    document.addEventListener('visibilitychange', resetInterruptedSample)
    return () => {
      publicationEpochRef.current += 1
      document.removeEventListener('visibilitychange', resetInterruptedSample)
      document.documentElement.removeAttribute(VIRTUAL_CHURCH_PROFILE_ATTRIBUTE)
      document.documentElement.removeAttribute(VIRTUAL_CHURCH_SAMPLING_ATTRIBUTE)
    }
  }, [invalidate])

  useFrame((_state, delta) => {
    gpuTimingRef.current?.beginFrame()
    gpuTimingRef.current?.poll()
    if (traceStartupFramesRef.current && startupFrameMarksRef.current < 3) {
      startupFrameMarksRef.current += 1
      performance.mark(`vc:frame:callback-${startupFrameMarksRef.current}`)
    }
    if (reportedRef.current) return
    // A welcome/guide/character dialog is not the playable scene. Discard a
    // partial window and warm up afresh after it closes, even for a short pause.
    if (!enabled) {
      if (warmupStartedAtRef.current !== null) samplingInterruptionCountRef.current += 1
      warmupStartedAtRef.current = null
      samplingStartedAtRef.current = null
      frameCountRef.current = 0
      frameTimesRef.current.length = 0
      lastFrameAtRef.current = null
      maximumCallbackGapMsRef.current = 0
      return
    }

    const now = performance.now()
    const callbackGapMs = lastFrameAtRef.current === null
      ? 0
      : now - lastFrameAtRef.current
    lastFrameAtRef.current = now

    // requestAnimationFrame is deliberately throttled for background tabs.
    // Never turn a one-frame-per-second browser scheduling gap into an Alife
    // FPS result. Restart both warm-up and sampling after any hidden state or
    // long callback stall, so a report proves one uninterrupted foreground
    // interval instead of merely accumulating five seconds of wall time.
    const hiddenDocument = document.visibilityState !== 'visible'
    const interruptedActiveSample = callbackGapMs > 250
      && warmupStartedAtRef.current !== null
    if (hiddenDocument || interruptedActiveSample) {
      if (hiddenDocument) samplingInterruptionCountRef.current += 1
      if (interruptedActiveSample) samplingRestartCountRef.current += 1
      warmupStartedAtRef.current = now
      samplingStartedAtRef.current = null
      frameCountRef.current = 0
      frameTimesRef.current = []
      maximumCallbackGapMsRef.current = 0
      document.documentElement.setAttribute(VIRTUAL_CHURCH_SAMPLING_ATTRIBUTE, JSON.stringify({
        phase: 'interrupted',
        visibility: document.visibilityState,
        callbackGapMs: Number(callbackGapMs.toFixed(2)),
        restartCount: samplingRestartCountRef.current,
      }))
      invalidate()
      return
    }
    maximumCallbackGapMsRef.current = Math.max(
      maximumCallbackGapMsRef.current,
      callbackGapMs,
    )
    const heroReadyAttribute = document.documentElement.getAttribute(VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE)
    const entranceReadyAt = heroReadyAttribute === null ? Number.NaN : Number(heroReadyAttribute)
    const characterReadyAttribute = document.documentElement.getAttribute(
      VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE,
    )
    const characterReadyAt = characterReadyAttribute === null
      ? Number.NaN
      : Number(characterReadyAttribute)
    const heroReadyAt = visualVersion === 'v3'
      ? Number.isFinite(entranceReadyAt) && Number.isFinite(characterReadyAt)
        ? Math.max(entranceReadyAt, characterReadyAt)
        : Number.NaN
      : entranceReadyAt
    const heroReadyMs = virtualChurchSessionElapsedMs(heroReadyAt, routeStartedAt)
    if (!Number.isFinite(heroReadyMs)) {
      invalidate()
      return
    }
    if (warmupStartedAtRef.current === null) {
      warmupStartedAtRef.current = now
      maximumCallbackGapMsRef.current = 0
      document.documentElement.setAttribute(VIRTUAL_CHURCH_SAMPLING_ATTRIBUTE, JSON.stringify({ phase: 'warmup' }))
    }

    if (now - warmupStartedAtRef.current < 4000) {
      invalidate()
      return
    }

    if (samplingStartedAtRef.current === null) {
      steadyCpuTraceRef.current?.reset()
      gpuTimingRef.current?.reset()
      samplingStartedAtRef.current = now
      document.documentElement.setAttribute(VIRTUAL_CHURCH_SAMPLING_ATTRIBUTE, JSON.stringify({ phase: 'sampling' }))
    }
    frameCountRef.current += 1

    const frameTimeMs = delta * 1000
    if (frameTimeMs > 0 && frameTimeMs < 250) {
      frameTimesRef.current.push(frameTimeMs)
    }

    const elapsedMs = now - samplingStartedAtRef.current
    if (elapsedMs < 5000) {
      invalidate()
      return
    }

    const frameTimes = [...frameTimesRef.current].sort((a, b) => a - b)
    const drawingBuffer = gl.getDrawingBufferSize(new Vector2())
    const navigationEntry = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const criticalResources = (window.performance.getEntriesByType('resource') as PerformanceResourceTiming[])
      .filter((entry) => virtualChurchResourceBelongsToProfile(entry, routeStartedAt))
    const initialCriticalResources = criticalResources
      .filter((entry) => entry.responseEnd <= heroReadyAt)
    const criticalResourceTimeline = criticalResources
      .map((entry) => ({
        path: new URL(entry.name).pathname,
        initiatorType: entry.initiatorType || 'unknown',
        startMs: Number(
          (entry.startTime - (navigationEntry?.startTime ?? 0)).toFixed(1),
        ),
        responseStartMs: Number(
          (entry.responseStart - (navigationEntry?.startTime ?? 0)).toFixed(1),
        ),
        responseEndMs: Number(
          (entry.responseEnd - (navigationEntry?.startTime ?? 0)).toFixed(1),
        ),
        durationMs: Number(entry.duration.toFixed(1)),
        transferSizeBytes: entry.transferSize,
        encodedBodySizeBytes: entry.encodedBodySize,
        serviceWorkerIntercepted: entry.workerStart > 0,
        initial: entry.responseEnd <= heroReadyAt,
      }))
      .sort((left, right) =>
        left.startMs - right.startMs
        || left.responseEndMs - right.responseEndMs
        || left.path.localeCompare(right.path),
      )
      .map((entry, index) => ({ sequence: index + 1, ...entry }))
    const criticalResourceBreakdown = criticalResourceTimeline
      .map((entry) => ({
        path: entry.path,
        responseEndMs: entry.responseEndMs,
        transferSizeBytes: entry.transferSizeBytes,
        encodedBodySizeBytes: entry.encodedBodySizeBytes,
        serviceWorkerIntercepted: entry.serviceWorkerIntercepted,
        initial: entry.initial,
      }))
      .sort((a, b) => b.transferSizeBytes - a.transferSizeBytes)
      .slice(0, 12)
    const startupLongTasks = longTasksRef.current
      .filter(task => task.startMs >= routeStartedAt && task.startMs < heroReadyAt)
    const startupLongTaskSummary = {
      supported: typeof PerformanceObserver !== 'undefined'
        && PerformanceObserver.supportedEntryTypes.includes('longtask'),
      count: startupLongTasks.length,
      totalDurationMs: Number(startupLongTasks.reduce((sum, task) => sum + task.durationMs, 0).toFixed(1)),
      longest: [...startupLongTasks]
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 12)
        .map(task => ({
          startMs: Number((task.startMs - routeStartedAt).toFixed(1)),
          durationMs: Number(task.durationMs.toFixed(1)),
        })),
    }
    const startupStageMarks = virtualChurchStartupStageMarks(
      performance.getEntriesByType('mark'), routeStartedAt, heroReadyAt,
    )
    const materials = new Set<Material>()
    const visibleMaterials = new Set<Material>()
    const geometries = new Set<BufferGeometry>()
    const textures = new Set<Texture>()
    const visibleTextures = new Set<Texture>()
    const repeatGroups = new Map<string, {
      geometry: string
      material: string
      color: string | null
      meshes: number
      instances: number
      names: string[]
    }>()
    const frustum = new Frustum()
    const projectionScreenMatrix = new Matrix4()
    const instanceMatrix = new Matrix4()
    const instanceWorldMatrix = new Matrix4()
    const objectBounds = new Box3()
    let meshCount = 0
    let shadowCasterCount = 0
    let visibleMeshCount = 0
    let visibleDrawCalls = 0
    let visibleTriangles = 0
    const drawCategories = new Map<VirtualChurchDrawCategory, { category: VirtualChurchDrawCategory; drawCalls: number; triangles: number; meshes: number }>()
    const uncategorizedVisibleMeshes: Array<{
      geometry: string; trianglesPerInstance: number; material: string; color: string | null
      worldPosition: [number, number, number]
    }> = []
    const visibleSurfaceBatches: Array<{
      triangles: number; color: string | null; roughness: number | null; metalness: number | null
      mapId: string | null; normalMapId: string | null; vertexColors: boolean
      receivesShadow: boolean; side: number
    }> = []
    // Opt-in only: identical material identity is a conservative starting point
    // for reviewing draw-call reduction, not proof that meshes can be merged.
    const inspectDrawStates = new URLSearchParams(window.location.search).has('profile3dDrawStates')
    const drawStateCandidates = new Map<string, {
      category: VirtualChurchDrawCategory; materialId: string; geometryAttributes: string
      castShadow: boolean; receiveShadow: boolean; meshes: number; triangles: number
      worldPositions: Array<[number, number, number]>
    }>()
    let heroAreaTriangles = 0
    let heroAreaMeshCount = 0
    let heroAreaInstanceCount = 0

    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld()
    projectionScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(projectionScreenMatrix)

    scene.traverse((object) => {
      if (!('isMesh' in object)) return
      const mesh = object as Mesh
      meshCount += 1
      geometries.add(mesh.geometry)
      const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      meshMaterials.forEach((material) => {
        materials.add(material)
        collectMaterialTextures(material, textures)
      })

      let effectivelyVisible = true
      let ancestor: typeof mesh.parent | typeof mesh = mesh
      while (ancestor) {
        if (!ancestor.visible) {
          effectivelyVisible = false
          break
        }
        ancestor = ancestor.parent
      }
      if (mesh.castShadow && effectivelyVisible) shadowCasterCount += 1

      const indexCount = mesh.geometry.index?.count
      const positionCount = mesh.geometry.getAttribute('position')?.count ?? 0
      const instanceCount = 'isInstancedMesh' in mesh
        ? (mesh as Mesh & { count: number }).count
        : 1
      const trianglesPerInstance = Math.round((indexCount ?? positionCount) / 3)

      if (effectivelyVisible) {
        mesh.geometry.computeBoundingBox()
        const geometryBounds = mesh.geometry.boundingBox
        if (geometryBounds) {
          if ('isInstancedMesh' in mesh) {
            let intersectingInstances = 0
            const instancedMesh = mesh as InstancedMesh
            for (let index = 0; index < instancedMesh.count; index += 1) {
              instancedMesh.getMatrixAt(index, instanceMatrix)
              instanceWorldMatrix.multiplyMatrices(instancedMesh.matrixWorld, instanceMatrix)
              objectBounds.copy(geometryBounds).applyMatrix4(instanceWorldMatrix)
              if (objectBounds.intersectsBox(HERO_AREA_WORLD_BOUNDS)) intersectingInstances += 1
            }
            if (intersectingInstances > 0) {
              heroAreaMeshCount += 1
              heroAreaInstanceCount += intersectingInstances
              heroAreaTriangles += trianglesPerInstance * intersectingInstances
            }
          } else {
            objectBounds.copy(geometryBounds).applyMatrix4(mesh.matrixWorld)
            if (objectBounds.intersectsBox(HERO_AREA_WORLD_BOUNDS)) {
              heroAreaMeshCount += 1
              heroAreaInstanceCount += 1
              heroAreaTriangles += trianglesPerInstance
            }
          }
        }
      }

      if (!effectivelyVisible || instanceCount === 0 || (mesh.frustumCulled && !frustum.intersectsObject(mesh))) return

      visibleMeshCount += 1
      meshMaterials.forEach((material) => {
        visibleMaterials.add(material)
        collectMaterialTextures(material, visibleTextures)
      })
      const meshDrawCalls = Array.isArray(mesh.material)
        ? Math.max(1, mesh.geometry.groups.length)
        : 1
      visibleDrawCalls += meshDrawCalls
      visibleTriangles += trianglesPerInstance * instanceCount
      const category = virtualChurchDrawCategory(mesh)
      const bucket = drawCategories.get(category) ?? { category, drawCalls: 0, triangles: 0, meshes: 0 }
      bucket.drawCalls += meshDrawCalls
      bucket.triangles += trianglesPerInstance * instanceCount
      bucket.meshes += 1
      drawCategories.set(category, bucket)

      if (inspectDrawStates && !Array.isArray(mesh.material) && !('isInstancedMesh' in mesh)
        && !('isSkinnedMesh' in mesh) && mesh.geometry.groups.length <= 1) {
        const geometryAttributes = Object.keys(mesh.geometry.attributes).sort().join(',')
        const drawStateKey = [
          category, mesh.material.uuid, geometryAttributes, mesh.castShadow,
          mesh.receiveShadow, mesh.renderOrder, mesh.layers.mask,
        ].join('|')
        const candidate = drawStateCandidates.get(drawStateKey) ?? {
          category,
          materialId: mesh.material.uuid,
          geometryAttributes,
          castShadow: mesh.castShadow,
          receiveShadow: mesh.receiveShadow,
          meshes: 0,
          triangles: 0,
          worldPositions: [],
        }
        candidate.meshes += 1
        candidate.triangles += trianglesPerInstance
        if (candidate.worldPositions.length < 6) {
          const world = mesh.matrixWorld.elements
          candidate.worldPositions.push(
            [world[12], world[13], world[14]].map(value => Number(value.toFixed(2))) as [number, number, number],
          )
        }
        drawStateCandidates.set(drawStateKey, candidate)
      }

      const primaryMaterial = meshMaterials[0] as Material & { color?: { getHexString: () => string } }
      const color = primaryMaterial.color ? `#${primaryMaterial.color.getHexString()}` : null
      if (category === 'surfaces') {
        const surface = primaryMaterial as typeof primaryMaterial & {
          roughness?: number; metalness?: number; map?: Texture | null
          normalMap?: Texture | null; vertexColors?: boolean
        }
        visibleSurfaceBatches.push({
          triangles: trianglesPerInstance * instanceCount,
          color,
          roughness: surface.roughness ?? null,
          metalness: surface.metalness ?? null,
          mapId: surface.map?.uuid ?? null,
          normalMapId: surface.normalMap?.uuid ?? null,
          vertexColors: Boolean(surface.vertexColors),
          receivesShadow: mesh.receiveShadow,
          side: primaryMaterial.side,
        })
      }
      if (category === 'other') {
        const world = mesh.matrixWorld.elements
        uncategorizedVisibleMeshes.push({
          geometry: mesh.geometry.type,
          trianglesPerInstance,
          material: primaryMaterial.type,
          color,
          worldPosition: [world[12], world[13], world[14]].map((value) => Number(value.toFixed(2))) as [number, number, number],
        })
      }
      const groupKey = [
        mesh.geometry.type,
        indexCount ?? positionCount,
        primaryMaterial.type,
        color ?? 'none',
        'isInstancedMesh' in mesh ? 'instanced' : 'mesh',
      ].join('|')
      const group = repeatGroups.get(groupKey) ?? {
        geometry: mesh.geometry.type,
        material: primaryMaterial.type,
        color,
        meshes: 0,
        instances: 0,
        names: [],
      }
      group.meshes += 1
      group.instances += instanceCount
      if (group.names.length < 4) {
        const namedAncestor = [mesh, mesh.parent, mesh.parent?.parent]
          .find((candidate) => candidate?.name)?.name
        if (namedAncestor && !group.names.includes(namedAncestor)) group.names.push(namedAncestor)
      }
      repeatGroups.set(groupKey, group)
    })

    const geometryBuffers = new Set<ArrayBufferLike>()
    const collectAttributeBuffer = (attribute: unknown) => {
      if (!attribute || typeof attribute !== 'object') return
      const candidate = attribute as {
        array?: { buffer?: ArrayBufferLike }
        data?: { array?: { buffer?: ArrayBufferLike } }
      }
      const buffer = candidate.array?.buffer ?? candidate.data?.array?.buffer
      if (buffer) geometryBuffers.add(buffer)
    }
    geometries.forEach((geometry) => {
      Object.values(geometry.attributes).forEach(collectAttributeBuffer)
      collectAttributeBuffer(geometry.index)
      Object.values(geometry.morphAttributes)
        .flat()
        .forEach(collectAttributeBuffer)
    })
    const geometryBytes = [...geometryBuffers]
      .reduce((sum, buffer) => sum + buffer.byteLength, 0)
    const textureMetrics = estimateTextureMemory(textures)
    const visibleTextureMetrics = estimateTextureMemory(visibleTextures)
    const textureBreakdown = [...textures]
      .map((texture) => {
        const dimensions = textureDimensions(texture)
        const estimatedBytes = Math.ceil(
          dimensions.pixels * 4 * (texture.generateMipmaps ? 4 / 3 : 1),
        )
        return {
          name: texture.name || '(unnamed)',
          sourceId: texture.source?.uuid ?? null,
          maxDimension: dimensions.maxDimension,
          estimatedBytes,
          visible: visibleTextures.has(texture),
        }
      })
      .sort((a, b) => b.estimatedBytes - a.estimatedBytes)
      .slice(0, 20)
    const missingImageTextures = [...textures]
      .filter((texture) => (texture.source?.data ?? texture.image) == null)
      .map((texture) => ({
        name: texture.name || '(unnamed)',
        sourceId: texture.source?.uuid ?? null,
        version: texture.version,
        visible: visibleTextures.has(texture),
      }))
    const drawingBufferPixels = drawingBuffer.width * drawingBuffer.height
    const baseFramebufferBytes = drawingBufferPixels * 8
    const shadowMapBytes = preset.shadowMapSize * preset.shadowMapSize * 4
    const postProcessingBytes = preset.postProcessing
      ? drawingBufferPixels * 17
      : 0
    const renderTargetBytes = baseFramebufferBytes + shadowMapBytes + postProcessingBytes
    const gpuMemoryEstimateBytes = geometryBytes + textureMetrics.bytes + renderTargetBytes
    const gpuMemoryBudgetBytes = VIRTUAL_CHURCH_GPU_MEMORY_BUDGET_BYTES[preset.isMobile ? 'mobile' : 'desktop']

    const diagnosticTransport = new URLSearchParams(window.location.search)
      .get('profile3dTransport') ?? 'pwa'
    const report = {
      schemaVersion: 7,
      sampledAt: new Date().toISOString(),
      visualVersion,
      sampleDurationMs: Math.round(elapsedMs),
      frameCount: frameCountRef.current,
      averageFps: Number((frameCountRef.current / (elapsedMs / 1000)).toFixed(1)),
      sampling: {
        documentVisibilityState: document.visibilityState,
        maximumCallbackGapMs: Number(maximumCallbackGapMsRef.current.toFixed(2)),
        interruptionCount: samplingInterruptionCountRef.current,
        restartCount: samplingRestartCountRef.current,
        uninterruptedForeground: true,
      },
      loading: {
        routeStartedAtMs: Number(routeStartedAt.toFixed(1)),
        routeSessionAgeAtSampleMs: Number((now - routeStartedAt).toFixed(1)),
        navigation: navigationEntry ? {
          responseStartMs: Number(navigationEntry.responseStart.toFixed(1)),
          domContentLoadedMs: Number(navigationEntry.domContentLoadedEventEnd.toFixed(1)),
          loadEventMs: Number(navigationEntry.loadEventEnd.toFixed(1)),
          transferSizeBytes: navigationEntry.transferSize,
          encodedBodySizeBytes: navigationEntry.encodedBodySize,
        } : null,
        heroReadyMs: Number(heroReadyMs.toFixed(1)),
        entranceReadyMs: Number.isFinite(entranceReadyAt)
          ? Number(virtualChurchSessionElapsedMs(entranceReadyAt, routeStartedAt).toFixed(1))
          : null,
        characterReadyMs: Number.isFinite(characterReadyAt)
          ? Number(virtualChurchSessionElapsedMs(characterReadyAt, routeStartedAt).toFixed(1))
          : null,
        initialCritical3DResponseEndMs: initialCriticalResources.length > 0
          ? Number(virtualChurchSessionElapsedMs(
              Math.max(...initialCriticalResources.map((entry) => entry.responseEnd)),
              routeStartedAt,
            ).toFixed(1))
          : null,
        initialCriticalTransferSizeBytes: initialCriticalResources.reduce((sum, entry) => sum + entry.transferSize, 0),
        initialCriticalEncodedBodySizeBytes: initialCriticalResources.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
        initialCriticalResourceCount: initialCriticalResources.length,
        critical3DResponseEndMs: criticalResources.length > 0
          ? Number(virtualChurchSessionElapsedMs(
              Math.max(...criticalResources.map((entry) => entry.responseEnd)),
              routeStartedAt,
            ).toFixed(1))
          : null,
        criticalTransferSizeBytes: criticalResources.reduce((sum, entry) => sum + entry.transferSize, 0),
        criticalEncodedBodySizeBytes: criticalResources.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
        criticalResourceCount: criticalResources.length,
        criticalServiceWorkerInterceptCount: criticalResources.filter((entry) => entry.workerStart > 0).length,
        criticalDirectNetworkTransferCount: criticalResources
          .filter((entry) => entry.workerStart === 0 && entry.transferSize > 0).length,
        criticalZeroTransferCount: criticalResources.filter((entry) => entry.transferSize === 0).length,
        diagnosticTransport,
        diagnosticNetwork: null as null | {
          kilobitsPerSecond: number
          latencyMs: number
        },
        deferredCriticalResourceCount: criticalResources.length - initialCriticalResources.length,
        deferredCriticalTransferSizeBytes: criticalResources
          .filter((entry) => entry.responseEnd > heroReadyAt)
          .reduce((sum, entry) => sum + entry.transferSize, 0),
        criticalResourceTimelineOrigin: 'navigation',
        criticalResourceTimeline,
        criticalResourceBreakdown,
        startupLongTaskSummary,
        startupStageMarks,
        startupProgramChanges: startupProgramChangesRef.current,
        ...(startupPassTimingsRef.current ? { startupPassTimings: startupPassTimingsRef.current,
          startupPassTimingPhase: startupPassPhaseRef.current } : {}),
      },
      fallback: readVirtualChurchFallbackSignals(),
      characterAssetPath: document.documentElement.getAttribute(VIRTUAL_CHURCH_CHARACTER_ASSET_ATTRIBUTE),
      frameTimeMs: {
        p50: Number(percentile(frameTimes, 0.5).toFixed(2)),
        p95: Number(percentile(frameTimes, 0.95).toFixed(2)),
        max: Number((frameTimes.at(-1) ?? 0).toFixed(2)),
      },
      ...(steadyCpuTraceRef.current ? { cpuSubmissionDiagnostics: {
        method: 'Up to 60 actual scene renders. Negative-priority callback start separates pre-scene work, repeated scene passes, and direct auxiliary submissions by callback frame. Callback-to-last-submission span excludes caller work after the final draw and browser/GPU waiting outside the callback; not complete frame CPU/GPU or formal FPS-gate evidence. Coarse clock and instrumentation overhead apply.',
        frames: steadyCpuTraceRef.current.frames,
        callbackFrames: steadyCpuTraceRef.current.callbackFrames,
      } } : {}),
      ...(gpuTimingRef.current ? { gpuTimingDiagnostics: gpuTimingRef.current.snapshot() } : {}),
      render: {
        visibleDrawCallsEstimate: visibleDrawCalls,
        visibleTrianglesEstimate: visibleTriangles,
        // Same visibility and counting rules as the totals above; not GPU time.
        categories: [...drawCategories.values()].sort((a, b) => b.drawCalls - a.drawCalls),
        // Fixed structural data only: never publish arbitrary imported mesh names.
        uncategorizedVisibleMeshes,
        // Diagnostic-only material signatures; texture IDs are per-load UUIDs,
        // not source filenames or URLs.
        visibleSurfaceBatches,
        // Bounded opt-in review data; UUIDs are per-load and never asset paths.
        // Candidates still require geometry, transparency and visual review.
        visibleDrawStateCandidates: inspectDrawStates
          ? [...drawStateCandidates.values()]
            .filter(candidate => candidate.meshes > 1)
            .sort((left, right) => right.meshes - left.meshes)
            .slice(0, 12)
          : [],
        heroArea: {
          trianglesEstimate: heroAreaTriangles,
          meshOrBatchCount: heroAreaMeshCount,
          intersectingInstanceCount: heroAreaInstanceCount,
          worldCenterMetres: HERO_AREA_WORLD_CENTER.toArray(),
          horizontalHalfExtentMetres: HERO_AREA_HALF_EXTENT_METRES,
          verticalRangeMetres: [
            HERO_AREA_VERTICAL_MIN_METRES,
            HERO_AREA_VERTICAL_MAX_METRES,
          ],
          recommendedRange: preset.isMobile
            ? { min: 80000, max: 150000 }
            : { min: 150000, max: 300000 },
          withinRecommendedRange: preset.isMobile
            ? heroAreaTriangles >= 80000 && heroAreaTriangles <= 150000
            : heroAreaTriangles >= 150000 && heroAreaTriangles <= 300000,
          withinPerformanceCeiling: heroAreaTriangles <= (preset.isMobile ? 150000 : 300000),
          method: 'Triangles from effectively visible meshes and individual instances whose world-space geometry bounds intersect the 50 m × 50 m entrance AABB.',
        },
        rendererLastPassCalls: gl.info.render.calls,
        rendererLastPassTriangles: gl.info.render.triangles,
      },
      memory: {
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
        estimate: {
          geometryBytes,
          textureBytes: textureMetrics.bytes,
          visibleTextureBytes: visibleTextureMetrics.bytes,
          renderTargetBytes,
          totalBytes: gpuMemoryEstimateBytes,
          budgetBytes: gpuMemoryBudgetBytes,
          withinBudget: gpuMemoryEstimateBytes <= gpuMemoryBudgetBytes,
          textureCount: textures.size,
          visibleTextureCount: visibleTextures.size,
          maxTextureDimension: textureMetrics.maxDimension,
          missingImageTextures,
          method: 'Unique geometry buffers + RGBA8 texture texels with mipmaps + conservative framebuffer, shadow, and post-processing targets.',
          topTextures: textureBreakdown,
        },
      },
      scene: {
        meshes: meshCount,
        materials: materials.size,
        shadowCasters: shadowCasterCount,
        visibleMeshes: visibleMeshCount,
        visibleMaterials: visibleMaterials.size,
        topRepeatGroups: [...repeatGroups.values()]
          .sort((a, b) => b.meshes - a.meshes)
          .slice(0, 12),
      },
      drawingBuffer: {
        width: drawingBuffer.width,
        height: drawingBuffer.height,
        pixelRatio: gl.getPixelRatio(),
      },
      camera: {
        mode: cameraMode,
        position: camera.position.toArray().map((value) => Number(value.toFixed(4))),
        quaternion: camera.quaternion.toArray().map((value) => Number(value.toFixed(6))),
        fov: 'fov' in camera ? camera.fov : null,
      },
      environment: {
        userAgent: window.navigator.userAgent,
        hardwareConcurrency: window.navigator.hardwareConcurrency || null,
        deviceMemoryGiB:
          (window.navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
        webGlRenderer: String(
          gl.getContext().getParameter(gl.getContext().RENDERER) ?? 'unknown',
        ),
      },
      preset: {
        isMobile: preset.isMobile,
        maxTextureResolution: preset.maxTextureResolution,
        shadowQuality: preset.shadowQuality,
        shadowMapSize: preset.shadowMapSize,
        antiAliasing: preset.antiAliasing,
        lodDistances: { ...preset.lodDistances },
        postProcessing: preset.postProcessing,
        glassTransmission: preset.glassTransmission,
        maxDevicePixelRatio: preset.maxDevicePixelRatio,
        vrSupport: preset.vrSupport,
      },
    }

    reportedRef.current = true
    const publicationEpoch = publicationEpochRef.current
    void (async () => {
      report.loading.diagnosticNetwork = diagnosticTransport === 'network'
        ? await readDiagnosticNetworkProfile()
        : null
      // A slower network diagnostic from the previous avatar/route must not
      // overwrite the new avatar's report after its probe has been unmounted.
      if (publicationEpoch !== publicationEpochRef.current) return
      document.documentElement.setAttribute(VIRTUAL_CHURCH_PROFILE_ATTRIBUTE, JSON.stringify(report))
      document.documentElement.removeAttribute(VIRTUAL_CHURCH_SAMPLING_ATTRIBUTE)
      // eslint-disable-next-line no-console
      console.info(`[VirtualChurchProfile] ${JSON.stringify(report)}`)
    })()
  })

  const params = new URLSearchParams(window.location.search)
  return <>
    {traceStartupFramesRef.current && params.get('profile3dCpu') === '1' ? <VirtualChurchCpuFrameStart trace={steadyCpuTraceRef} /> : null}
    {params.has('profile3d') && params.get('profile3dInput') === 'continuous' && visualVersion === 'v3' ? <VirtualChurchContinuousTimingProbe preset={preset} /> : null}
  </>
}
