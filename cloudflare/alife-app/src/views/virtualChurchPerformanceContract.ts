import type { Object3D, WebGLRenderer } from 'three'

export type VirtualChurchResourceTimingLike = {
  name: string
  startTime: number
}

export const VIRTUAL_CHURCH_RESOURCE_SESSION_START_GRACE_MS = 250

// Keep the in-page diagnostic aligned with tools/virtual-church/performance-budgets.json.
// The CLI remains the authority for accepting captured profiles.
export const VIRTUAL_CHURCH_GPU_MEMORY_BUDGET_BYTES = {
  desktop: 420 * 1024 * 1024,
  mobile: 220 * 1024 * 1024,
} as const

const DRAW_CATEGORIES = ['church', 'character', 'trees', 'plants', 'vehicles', 'ground-details', 'surroundings', 'culvert', 'swale', 'surfaces', 'lights', 'fences'] as const
export type VirtualChurchDrawCategory = (typeof DRAW_CATEGORIES)[number] | 'other'
type DrawCategoryNode = { name: string; parent: DrawCategoryNode | null }

// Only our fixed labels enter the local profile, never arbitrary asset names.
// The nearest labelled owner wins; each visible mesh belongs to one bucket.
export function virtualChurchDrawCategory(node: DrawCategoryNode | null): VirtualChurchDrawCategory {
  while (node) {
    for (const category of DRAW_CATEGORIES) if (node.name === `vc:${category}`) return category
    node = node.parent
  }
  return 'other'
}

// A phone rotated to landscape still needs the mobile GPU/asset budget.
// Retain the existing UA and 768px policy, measured on the short edge.
export const virtualChurchUsesMobileBudget = (userAgent: string, width: number, height: number) =>
  /iPhone|iPad|Android/i.test(userAgent) && Math.min(width, height) < 768

// Match the preset's existing maximum drawing cost for explicit diagnostics.
// Ordinary visits retain the responsive [1, max] policy. No numeric query can
// lower quality or exceed the phone/desktop ceiling to manufacture results.
export const virtualChurchDiagnosticDpr = (maximum: number, enabled: boolean, request: string | null): number | [number, number] =>
  enabled && request === 'budget-max' ? maximum : [1, maximum]

const VIRTUAL_CHURCH_CRITICAL_RESOURCE_PATTERN =
  /VirtualChurchView-|vendor-3d-|virtual-church-assets\/|draco/
const VIRTUAL_CHURCH_CODE_RESOURCE_PATTERN = /VirtualChurchView-|vendor-3d-/
// Development candidates live outside the production asset directory, but
// their actual GLB transfer must still count toward the review-page budget.
// Portraits and unrelated review endpoints are not critical 3D resources.
const VIRTUAL_CHURCH_REVIEW_CHARACTER_PATTERN =
  /\/__alife-review\/virtual-church\/character-hero-(?:female|male)-v\d+-(?:high|medium|low|motion)\.glb(?:[?#]|$)/

export const virtualChurchResourceBelongsToSession = (
  entry: VirtualChurchResourceTimingLike,
  routeStartedAt: number,
) =>
  Number.isFinite(routeStartedAt)
  // React can initiate the lazy route and its shared vendor dependency a few
  // milliseconds before the protected route entry commits its timestamp.
  // Keep a narrow grace window so those current requests remain attributable
  // without admitting assets from an earlier route visit.
  && entry.startTime >= routeStartedAt - VIRTUAL_CHURCH_RESOURCE_SESSION_START_GRACE_MS
  && (
    VIRTUAL_CHURCH_CRITICAL_RESOURCE_PATTERN.test(entry.name)
    || VIRTUAL_CHURCH_REVIEW_CHARACTER_PATTERN.test(entry.name)
  )

export const virtualChurchResourceBelongsToProfile = (
  entry: VirtualChurchResourceTimingLike,
  routeStartedAt: number,
) =>
  // The route and shared 3D chunks can be fetched while authentication is
  // resolving, before the protected route commits. They belong to the current
  // navigation-wide profile; 3D assets remain constrained to the route window.
  VIRTUAL_CHURCH_CODE_RESOURCE_PATTERN.test(entry.name)
  || virtualChurchResourceBelongsToSession(entry, routeStartedAt)

export const virtualChurchResourceSessionElapsedMs = (
  timestamp: number,
  routeStartedAt: number,
) =>
  Number.isFinite(timestamp)
  && Number.isFinite(routeStartedAt)
  && timestamp >= routeStartedAt - VIRTUAL_CHURCH_RESOURCE_SESSION_START_GRACE_MS
    ? Math.max(0, timestamp - routeStartedAt)
    : Number.NaN

// Explicit profile only: retain both ends of startup, not just the first 64
// marks that can omit character introspection after late church preparation.
// Keep a finite payload and do not create additional runtime marks or queries.
export const virtualChurchStartupStageMarks = (
  entries: ReadonlyArray<{ name: string; startTime: number }>,
  routeStartedAt: number,
  heroReadyAt: number,
) => {
  const current = entries.filter(entry => entry.name.startsWith('vc:')
    && Number.isFinite(entry.startTime)
    && entry.startTime >= routeStartedAt && entry.startTime < heroReadyAt)
  const selected = current.length <= 128 ? current : [...current.slice(0, 64), ...current.slice(-64)]
  return selected.map(entry => ({ name: entry.name, startMs: Number((entry.startTime - routeStartedAt).toFixed(1)) }))
}

export type VirtualChurchStartupPassTiming = {
  frame: number; durationMs: number; shadowMs: number; drawCount: number; failed: boolean
  // Opt-in early-window trace only; navigation-origin clock, not route-relative.
  startedAtMs?: number
  programsBefore?: number
  programsAfter?: number
  slowDraws: Array<{ durationMs: number; pass: 'shadow' | 'scene'; category: VirtualChurchDrawCategory; material: string; surface: ReturnType<typeof virtualChurchStartupSurfaceRole>; programsAdded?: number }>
  // Explicit steady-state CPU diagnostic only; never interpreted as GPU time.
  drawCpuMsByCategory?: Partial<Record<VirtualChurchDrawCategory, number>>
  otherSceneCpuMs?: number
  callbackFrame?: number
  scenePass?: number
  // Explicit upload diagnostic: CPU API call durations, not GPU execution or
  // transfer bytes. Absent unless texture tracing was explicitly requested.
  textureCpu?: { uploadMs: number; mipmapMs: number; storageMs: number; uploads: number; mipmaps: number; storages: number }
  // Existing GL calls only: no added queries or GPU timers. Kept separate from
  // texture tracing, and absent unless submission tracing was requested.
  submissionCpu?: {
    programUseMs: number; drawMs: number; bufferUploadMs: number; programQueryMs: number; uniformMs: number; stateMs: number
    programUses: number; draws: number; bufferUploads: number; programQueries: number; uniforms: number; stateCalls: number
    slowCalls: Array<{ api: string; durationMs: number; parameter?: 'anisotropy-limit' | 'other'; programRole?: ReturnType<typeof virtualChurchStartupSurfaceRole> }>
  }
}

export type VirtualChurchCallbackCpuTiming = {
  frame: number; beforeFirstSceneMs: number; sceneCpuMs: number; otherSceneCpuMs: number
  auxiliaryDrawCpuMs: number; callbackToLastSubmissionMs: number; failed: boolean
}

// Deliberately whitelist fixed semantic labels. Never publish arbitrary model,
// material, file or personal names in the local startup diagnostic.
export const virtualChurchStartupSurfaceRole = (object: { name: string }, material: { name: string }) => {
  if (object.name === 'vc:church-wordmark') return 'wordmark'
  if (object.name === 'vc:foyer-courtyard-photo-view' || object.name === 'vc:foyer-side-courtyard-photo-view') return 'courtyard-view'
  if (material.name === 'BackgroundCubeMaterial' || material.name === 'BackgroundMaterial') return 'sky-background'
  if (material.name === 'CubemapFromEquirect') return 'sky-conversion'
  return 'other'
}

// Observe only existing getUniforms calls in an explicit startup diagnostic.
// No new GL queries, shader text/logs, arbitrary names or ordinary-visit clocks.
export type VirtualChurchShaderSource = 'church' | 'foyer' | 'surface' | 'character' | 'sky'
const shaderSourceBits = { church: 1, foyer: 2, surface: 4, character: 8, sky: 16 } as const
const shaderPhaseBits = { compile: 1, transmission: 2, backface: 4 } as const

type VirtualChurchShaderVariant = {
  features: number; output: number; tone: number; environment: number
  lights: number[]; shadows: number[]; phases: number
}
type VirtualChurchShaderAssociation = {
  sources: number; phases: number; currentPhases: number
  variants?: VirtualChurchShaderVariant[]; variantOverflow?: boolean
}

// Read only the installed renderer's existing material/program associations.
// A program can be shared by multiple roots/stages: these are observed material
// memberships, not exclusive ownership, GPU timings or recompilation counts.
export const createVirtualChurchShaderProgramAssociations = (
  enabled: boolean,
  properties: { get: (material: object) => unknown },
) => {
  if (!enabled) return null
  const sources = new WeakMap<object, number>()
  const meshFeatures = new WeakMap<object, number>()
  const associations = new WeakMap<object, VirtualChurchShaderAssociation>()
  let selectedSamples = 0
  return {
    register(model: { traverse: (visit: (object: object) => void) => void }, source: VirtualChurchShaderSource) {
      let visited = 0
      model.traverse(node => {
        const object = node as { material?: object | object[]; isSkinnedMesh?: boolean; geometry?: { morphAttributes?: Record<string, unknown[]> } }
        for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
          if (++visited > 4096) return
          sources.set(material, (sources.get(material) ?? 0) | shaderSourceBits[source])
          const morphs = object.geometry?.morphAttributes
          meshFeatures.set(material, (meshFeatures.get(material) ?? 0) | (object.isSkinnedMesh ? 32 : 0)
            | (morphs && Object.values(morphs).some(values => values.length > 0) ? 64 : 0))
        }
      })
    },
    compiled(materials: Set<object>, phase: keyof typeof shaderPhaseBits,
      onSelected?: (id: number, source: number, variant: VirtualChurchShaderVariant) => void) {
      const unique = new Set<object>()
      const selections = onSelected ? new Set<string>() : null
      let selectionTruncated = false
      let inspected = 0, entries = 0, truncated = false
      for (const material of materials) {
        if (++inspected > 2048) { truncated = true; break }
        const cached = properties.get(material) as { programs?: unknown; currentProgram?: unknown; outputColorSpace?: unknown;
          toneMapping?: unknown; envMap?: unknown; uniforms?: Record<string, { value?: unknown }> } | undefined
        const programs = cached?.programs
        if (!(programs instanceof Map)) continue
        for (const program of programs.values()) {
          if (++entries > 4096) { truncated = true; break }
          if (!program || typeof program !== 'object') continue
          unique.add(program)
          const previous = associations.get(program)
          const next: VirtualChurchShaderAssociation = {
            ...previous,
            sources: (previous?.sources ?? 0) | (sources.get(material) ?? 0),
            // All cached variants are associated, but only currentProgram is
            // selected at this compile's end. Neither proves it was newly linked.
            phases: (previous?.phases ?? 0) | shaderPhaseBits[phase],
            currentPhases: (previous?.currentPhases ?? 0) | (cached?.currentProgram === program ? shaderPhaseBits[phase] : 0),
          }
          // Associate only the selected program with the observed material and
          // renderer context at compile's end, never every cached variant.
          // These are not shader-define readbacks: mesh bits are registered
          // memberships and Three can split transparent DoubleSide internally.
          // Shared programs retain distinct bounded material observations.
          const input = material as { isMaterial?: boolean; map?: unknown; normalMap?: unknown; alphaTest?: number;
            side?: number; transparent?: boolean; vertexColors?: boolean; aoMap?: unknown; metalnessMap?: unknown;
            roughnessMap?: unknown; emissiveMap?: unknown }
          if (input.isMaterial === true && cached?.currentProgram === program) {
            const count = (name: string) => {
              const value = cached!.uniforms?.[name]?.value
              return Array.isArray(value) && value.length <= 64 ? value.length : -1
            }
            const variant: VirtualChurchShaderVariant = {
              // Fixed feature bits: map/normal/mask/double/transparent/skin/
              // morph/back/vertex-colour/AO/metalness/roughness/emissive.
              features: (input.map ? 1 : 0) | (input.normalMap ? 2 : 0) | ((input.alphaTest ?? 0) > 0 ? 4 : 0)
                | (input.side === 2 ? 8 : 0) | (input.transparent ? 16 : 0) | (meshFeatures.get(material) ?? 0)
                | (input.side === 1 ? 128 : 0) | (input.vertexColors ? 256 : 0) | (input.aoMap ? 512 : 0)
                | (input.metalnessMap ? 1024 : 0) | (input.roughnessMap ? 2048 : 0) | (input.emissiveMap ? 4096 : 0),
              output: cached!.outputColorSpace === 'srgb' ? 1 : cached!.outputColorSpace === 'srgb-linear' ? 2 : 0,
              tone: Number.isInteger(cached!.toneMapping) && Number(cached!.toneMapping) >= 0 && Number(cached!.toneMapping) <= 16
                ? Number(cached!.toneMapping) : -1,
              environment: cached!.envMap ? 1 : 0,
              lights: ['directionalLights', 'pointLights', 'spotLights', 'hemisphereLights'].map(count),
              shadows: ['directionalLightShadows', 'pointLightShadows', 'spotLightShadows'].map(count),
              phases: shaderPhaseBits[phase],
            }
            // Observe the actual selected f35 program even when introspection
            // is fast. Fixed numeric metadata only, no extra properties/GL
            // reads, and never infer reuse from equal synthetic parameters.
            if (onSelected && variant.features === 35) {
              const id = (program as { id?: unknown }).id
              const source = sources.get(material) ?? 0
              if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 0) selectionTruncated = true
              else {
                const label = `${id}-${source}-${variant.output}-${variant.tone}-${variant.environment}-${variant.lights.join('_')}-${variant.shadows.join('_')}`
                if (!selections!.has(label)) {
                  if (selections!.size >= 12 || selectedSamples >= 64) selectionTruncated = true
                  else {
                    selections!.add(label); selectedSamples++
                    onSelected(id, source, { ...variant, lights: [...variant.lights], shadows: [...variant.shadows] })
                  }
                }
              }
            }
            const variants = next.variants ?? (next.variants = [])
            const matching = variants.find(item => item.features === variant.features && item.output === variant.output
              && item.tone === variant.tone && item.environment === variant.environment
              && item.lights.every((value, i) => value === variant.lights[i]) && item.shadows.every((value, i) => value === variant.shadows[i]))
            if (matching) matching.phases |= variant.phases
            else if (variants.length < 4) variants.push(variant)
            else next.variantOverflow = true
          }
          associations.set(program, next)
        }
        if (truncated) break
      }
      return { materials: materials.size, programs: unique.size, truncated,
        ...(onSelected ? { selected: selections!.size, selectionTruncated } : {}) }
    },
    describe(program: object) { return associations.get(program) ?? { sources: 0, phases: 0, currentPhases: 0 } },
  }
}

export const createVirtualChurchShaderIntrospectionTrace = (
  enabled: boolean,
  owner: 'scene' | 'church' | 'character',
  now: () => number,
  mark: (name: string, startTime: number) => void,
  context?: object,
) => {
  if (!enabled) return null
  let slowQueries = 0
  let timedApiCalls = 0, slowApiCalls = 0
  const api = context as Record<string, unknown> | undefined
  const queryNames = ['getProgramParameter', 'getProgramInfoLog', 'getShaderInfoLog',
    'getActiveUniform', 'getUniformLocation', 'getActiveAttrib', 'getAttribLocation'] as const
  type QueryCall = (...args: unknown[]) => unknown
  return (program: { name?: string; type?: string; id?: number; getUniforms: () => unknown }, association?: VirtualChurchShaderAssociation) => {
    if (slowQueries >= 16) return program.getUniforms()
    const started = now()
    const hooks: Array<{ name: string; original: QueryCall; replacement: QueryCall }> = []
    // Scope wrappers to this existing synchronous introspection call only.
    // No API arguments/results/logs retained. Limits bound clock/mark cost;
    // absence of a recorded slow call is not proof after a limit is reached.
    if (api && timedApiCalls < 1024 && slowApiCalls < 16) {
      for (const name of queryNames) {
        if (typeof api[name] !== 'function') continue
        const original = api[name] as QueryCall
        const replacement: QueryCall = (...args) => {
          if (timedApiCalls >= 1024 || slowApiCalls >= 16) return original.apply(context, args)
          timedApiCalls++
          const callStarted = now()
          try { return original.apply(context, args) } finally {
            const callEnded = now()
            if (callEnded - callStarted >= 8) {
              slowApiCalls++
              mark(`vc:shader:${owner}:api-${name}-start`, callStarted)
              mark(`vc:shader:${owner}:api-${name}-end`, callEnded)
            }
          }
        }
        // A non-writable method must not stop ordinary shader preparation.
        try {
          api[name] = replacement
          if (api[name] === replacement) hooks.push({ name, original, replacement })
        } catch { /* Unsupported diagnostic hook; leave the native call intact. */ }
      }
    }
    try { return program.getUniforms() }
    finally {
      for (const { name, original, replacement } of hooks) {
        if (api?.[name] === replacement) api[name] = original
      }
      const ended = now()
      if (ended - started >= 8) {
        slowQueries++
        if (association) {
          const id = Number.isSafeInteger(program.id) && program.id! >= 0 ? program.id : 0
          mark(`vc:shader:${owner}:association-p${id}-s${association.sources}-v${association.phases}-c${association.currentPhases}`, started)
          for (const variant of association.variants ?? []) {
            mark(`vc:shader:${owner}:variant-p${id}-f${variant.features}-o${variant.output}-t${variant.tone}-e${variant.environment}-l${variant.lights.join('_')}-s${variant.shadows.join('_')}-v${variant.phases}`, started)
          }
          if (association.variantOverflow) mark(`vc:shader:${owner}:variant-p${id}-limit`, started)
        }
        const role = virtualChurchStartupSurfaceRole({ name: '' }, { name: program.name ?? '' })
        const type = program.type === 'MeshPhysicalMaterial' ? 'physical'
          : program.type === 'MeshStandardMaterial' ? 'standard'
          : program.type === 'MeshBasicMaterial' ? 'basic'
          : program.type === 'MeshDepthMaterial' ? 'depth'
          : program.type === 'ShaderMaterial' ? 'shader' : 'other'
        const label = role === 'other' ? type : role
        mark(`vc:shader:${owner}:uniform-${label}-start`, started)
        mark(`vc:shader:${owner}:uniform-${label}-end`, ended)
      }
    }
  }
}

// The whole startup window spans initial scene and arriving assets without a
// prepare-callback gap. It closes only on both current-route rendered signals.
export const virtualChurchStartupPending = (
  routeStartedAt: number,
  churchReadyAt: string | null,
  characterReadyAt: string | null,
) => {
  if (!Number.isFinite(routeStartedAt) || routeStartedAt < 0) return false
  const ready = (value: string | null) => value !== null && value.trim() !== ''
    && Number.isFinite(Number(value)) && Number(value) >= routeStartedAt
  return !ready(churchReadyAt) || !ready(characterReadyAt)
}

// Late asset tracing uses current-route preparation and rendered readiness,
// never download completion or a stale mark from a previous visit.
export const virtualChurchStartupAssetsPending = (
  routeStartedAt: number,
  churchPreparedAt: number | null,
  churchReadyAt: string | null,
  characterReadyAt: string | null,
) => {
  if (!Number.isFinite(routeStartedAt) || churchPreparedAt === null
    || !Number.isFinite(churchPreparedAt) || churchPreparedAt < routeStartedAt) return false
  const ready = (value: string | null) => value !== null
    && Number.isFinite(Number(value)) && Number(value) >= routeStartedAt
  return !ready(churchReadyAt) || !ready(characterReadyAt)
}

// Cover arriving assets before the church's prepare callback. A previous
// route's mark cannot close this window; malformed current timing fails closed.
export const virtualChurchStartupBeforePrepare = (
  routeStartedAt: number,
  churchPrepareStartedAt: number | null,
) => Number.isFinite(routeStartedAt)
  && (churchPrepareStartedAt === null
    || (Number.isFinite(churchPrepareStartedAt) && churchPrepareStartedAt < routeStartedAt))

// Explicit local diagnostic only. Bound CPU submission timings to three actual
// scene renders and five slow draws per frame; steadyState explicitly switches
// to 60 selected frames by default, or at most 180 for explicit startup windows.
// Program counts show creation, not GPU compile durations. Never read pixels or asset names.
export const installVirtualChurchStartupPassTrace = (
  renderer: Pick<WebGLRenderer, 'render' | 'renderBufferDirect' | 'shadowMap'> & Partial<Pick<WebGLRenderer, 'info' | 'getContext'>>,
  scene: Object3D,
  now: () => number,
  steadyState?: { shouldSample: () => boolean; maximumFrames?: number; includeFrameStartTime?: boolean },
  traceTextureUploads = false,
  traceSubmissionCalls = false,
) => {
  const originalRender = renderer.render
  const originalDraw = renderer.renderBufferDirect
  const originalShadow = renderer.shadowMap.render
  const frames: VirtualChurchStartupPassTiming[] = []
  const callbackFrames: VirtualChurchCallbackCpuTiming[] = []
  let usesCallbackFrames = false, callbackOrdinal = 0, insideOtherScene = false
  let callback: { started: number; scenePass: number; record: VirtualChurchCallbackCpuTiming | null } | null = null
  let active: VirtualChurchStartupPassTiming | null = null
  let pendingOtherScene: VirtualChurchStartupPassTiming | null = null
  let inShadow = false
  let disposed = false
  const round = (value: number) => Number(value.toFixed(1))
  const maximumFrames = steadyState
    ? Number.isFinite(steadyState.maximumFrames)
      ? Math.min(180, Math.max(1, Math.floor(steadyState.maximumFrames!)))
      : 60
    : 3
  const context = traceTextureUploads || traceSubmissionCalls ? renderer.getContext?.() : undefined
  type ApiCall = (...args: unknown[]) => unknown
  const api = context as unknown as Record<string, ApiCall> | undefined
  const apiHooks: Array<{ name: string; original: ApiCall; replacement: ApiCall }> = []
  // Preserve exact arguments, return/throw behaviour and the context receiver.
  // Calls outside the selected primary scene frame do not read the clock.
  for (const name of traceTextureUploads ? ['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D',
    'compressedTexImage2D', 'compressedTexSubImage2D', 'compressedTexImage3D',
    'compressedTexSubImage3D', 'generateMipmap', 'texStorage2D', 'texStorage3D'] : []) {
    const original = api?.[name]
    if (typeof original !== 'function') continue
    const replacement: ApiCall = (...args) => {
      const record = active
      if (disposed || !record?.textureCpu) return original.apply(context, args)
      const started = now()
      try { return original.apply(context, args) } finally {
        const duration = round(now() - started)
        if (name === 'generateMipmap') {
          record.textureCpu.mipmapMs += duration; record.textureCpu.mipmaps++
        } else if (name === 'texStorage2D' || name === 'texStorage3D') {
          record.textureCpu.storageMs += duration; record.textureCpu.storages++
        } else {
          record.textureCpu.uploadMs += duration; record.textureCpu.uploads++
        }
      }
    }
    apiHooks.push({ name, original, replacement })
    api![name] = replacement
  }
  const hasTextureHooks = apiHooks.length > 0
  const textureHookCount = apiHooks.length
  const submissionMethods = [
    ['useProgram', 'programUseMs', 'programUses'],
    ...['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'].map(name => [name, 'drawMs', 'draws']),
    ...['bufferData', 'bufferSubData'].map(name => [name, 'bufferUploadMs', 'bufferUploads']),
    ...['getProgramParameter', 'getProgramInfoLog', 'getShaderInfoLog', 'getActiveUniform', 'getUniformLocation', 'getActiveAttrib', 'getAttribLocation'].map(name => [name, 'programQueryMs', 'programQueries']),
    ...['uniform1f', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform1i', 'uniform2i', 'uniform3i', 'uniform4i',
      'uniform1fv', 'uniform2fv', 'uniform3fv', 'uniform4fv', 'uniform1iv', 'uniform2iv', 'uniform3iv', 'uniform4iv',
      'uniform1ui', 'uniform2ui', 'uniform3ui', 'uniform4ui', 'uniform1uiv', 'uniform2uiv', 'uniform3uiv', 'uniform4uiv',
      'uniformMatrix2fv', 'uniformMatrix3fv', 'uniformMatrix4fv', 'uniformMatrix2x3fv', 'uniformMatrix2x4fv',
      'uniformMatrix3x2fv', 'uniformMatrix3x4fv', 'uniformMatrix4x2fv', 'uniformMatrix4x3fv'].map(name => [name, 'uniformMs', 'uniforms']),
    ...['activeTexture', 'bindTexture', 'texParameteri', 'texParameterf', 'pixelStorei', 'getParameter',
      'bindBuffer', 'bindVertexArray', 'enableVertexAttribArray', 'vertexAttribPointer', 'vertexAttribDivisor'].map(name => [name, 'stateMs', 'stateCalls']),
  ] as Array<[string, 'programUseMs' | 'drawMs' | 'bufferUploadMs' | 'programQueryMs' | 'uniformMs' | 'stateMs', 'programUses' | 'draws' | 'bufferUploads' | 'programQueries' | 'uniforms' | 'stateCalls']>
  for (const [name, durationKey, countKey] of traceSubmissionCalls ? submissionMethods : []) {
    const original = api?.[name]
    if (typeof original !== 'function') continue
    const replacement: ApiCall = (...args) => {
      const record = active?.submissionCpu
      if (disposed || !record) return original.apply(context, args)
      const started = now()
      try { return original.apply(context, args) } finally {
        const durationMs = now() - started
        record[durationKey] += durationMs; record[countKey]++
        record.slowCalls.push({ api: name, durationMs: round(durationMs),
          ...(name === 'getParameter' ? { parameter: args[0] === 0x84FF ? 'anisotropy-limit' as const : 'other' as const } : {}),
          ...(name === 'getProgramInfoLog' || name === 'getProgramParameter' ? {
            programRole: virtualChurchStartupSurfaceRole({ name: '' }, {
              name: renderer.info?.programs?.find(program => program.program === args[0])?.name ?? '',
            }),
          } : {}) })
        record.slowCalls.sort((a, b) => b.durationMs - a.durationMs)
        record.slowCalls.length = Math.min(5, record.slowCalls.length)
      }
    }
    apiHooks.push({ name, original, replacement }); api![name] = replacement
  }
  const hasSubmissionHooks = apiHooks.length > textureHookCount
  const render = (...args: Parameters<typeof originalRender>) => {
    if (disposed || active) return originalRender.apply(renderer, args)
    if (steadyState && (!steadyState.shouldSample() || (usesCallbackFrames && !callback))) {
      pendingOtherScene = null; return originalRender.apply(renderer, args)
    }
    // Secondary scenes submitted via renderer.render belong to this frame.
    // Direct post-processing draw calls outside render are NOT timed here.
    if (args[0] !== scene) {
      const record = pendingOtherScene
      if (!record) return originalRender.apply(renderer, args)
      const started = now()
      insideOtherScene = true
      try { return originalRender.apply(renderer, args) }
      finally {
        const ended = now()
        record.otherSceneCpuMs = (record.otherSceneCpuMs ?? 0) + ended - started
        if (callback?.record) {
          callback.record.otherSceneCpuMs += ended - started
          callback.record.callbackToLastSubmissionMs = round(ended - callback.started)
        }
        insideOtherScene = false
      }
    }
    if (frames.length >= maximumFrames) { pendingOtherScene = null; callback = null; return originalRender.apply(renderer, args) }
    const record: VirtualChurchStartupPassTiming = { frame: frames.length + 1, durationMs: 0, shadowMs: 0, drawCount: 0, failed: true, slowDraws: [] }
    if (hasTextureHooks) record.textureCpu = { uploadMs: 0, mipmapMs: 0, storageMs: 0, uploads: 0, mipmaps: 0, storages: 0 }
    if (hasSubmissionHooks) record.submissionCpu = { programUseMs: 0, drawMs: 0, bufferUploadMs: 0, programQueryMs: 0,
      uniformMs: 0, stateMs: 0, programUses: 0, draws: 0, bufferUploads: 0, programQueries: 0, uniforms: 0, stateCalls: 0, slowCalls: [] }
    if (renderer.info?.programs) record.programsBefore = renderer.info.programs.length
    if (steadyState) { record.drawCpuMsByCategory = {}; record.otherSceneCpuMs = 0; pendingOtherScene = record }
    const started = now()
    if (steadyState?.includeFrameStartTime) record.startedAtMs = round(started)
    if (callback) {
      if (!callback.record) {
        callback.record = { frame: callbackOrdinal, beforeFirstSceneMs: round(started - callback.started),
          sceneCpuMs: 0, otherSceneCpuMs: 0, auxiliaryDrawCpuMs: 0, callbackToLastSubmissionMs: 0, failed: false }
        callbackFrames.push(callback.record)
      }
      record.callbackFrame = callback.record.frame; record.scenePass = ++callback.scenePass
    }
    active = record
    try { const result = originalRender.apply(renderer, args); record.failed = false; return result }
    finally {
      const ended = now()
      if (record.submissionCpu) {
        for (const key of ['programUseMs', 'drawMs', 'bufferUploadMs', 'programQueryMs', 'uniformMs', 'stateMs'] as const) {
          record.submissionCpu[key] = round(record.submissionCpu[key])
        }
      }
      if (renderer.info?.programs) record.programsAfter = renderer.info.programs.length
      record.durationMs = round(ended - started); frames.push(record); active = null; inShadow = false
      if (callback?.record) {
        callback.record.sceneCpuMs += ended - started
        callback.record.callbackToLastSubmissionMs = round(ended - callback.started)
        callback.record.failed ||= record.failed
      }
    }
  }
  const shadow = (...args: Parameters<typeof originalShadow>) => {
    if (disposed || !active) return originalShadow.apply(renderer.shadowMap, args)
    const record = active, started = now(), previous = inShadow
    inShadow = true
    try { return originalShadow.apply(renderer.shadowMap, args) }
    finally { record.shadowMs += round(now() - started); inShadow = previous }
  }
  const draw = (...args: Parameters<typeof originalDraw>) => {
    if (disposed) return originalDraw.apply(renderer, args)
    if (!active) {
      // Direct post-processing submissions between scene passes. They are not
      // full effect CPU time: caller work after the last draw is outside this span.
      const current = callback
      if (!current?.record || insideOtherScene || !steadyState?.shouldSample()) return originalDraw.apply(renderer, args)
      const started = now()
      let failed = true
      try { const result = originalDraw.apply(renderer, args); failed = false; return result }
      finally {
        const ended = now()
        current.record.auxiliaryDrawCpuMs += ended - started
        current.record.callbackToLastSubmissionMs = round(ended - current.started)
        current.record.failed ||= failed
      }
    }
    const record = active, started = now(), pass = inShadow ? 'shadow' : 'scene'
    const programsBefore = renderer.info?.programs?.length
    try { return originalDraw.apply(renderer, args) }
    finally {
      const durationMs = now() - started
      const category = virtualChurchDrawCategory(args[4])
      if (record.drawCpuMsByCategory) {
        record.drawCpuMsByCategory[category] = (record.drawCpuMsByCategory[category] ?? 0) + durationMs
      }
      const type = args[3].type
      record.drawCount++
      record.slowDraws.push({ durationMs: round(durationMs), pass, category,
        ...(programsBefore !== undefined && renderer.info?.programs ? { programsAdded: renderer.info.programs.length - programsBefore } : {}),
        surface: virtualChurchStartupSurfaceRole(args[4], args[3]),
        material: /^(MeshDepthMaterial|MeshDistanceMaterial|MeshPhysicalMaterial|MeshStandardMaterial|MeshBasicMaterial|ShaderMaterial)$/.test(type) ? type : 'other' })
      record.slowDraws.sort((a, b) => b.durationMs - a.durationMs)
      record.slowDraws.length = Math.min(5, record.slowDraws.length)
    }
  }
  renderer.render = render
  renderer.shadowMap.render = shadow
  renderer.renderBufferDirect = draw
  return { frames, callbackFrames, beginFrame: () => {
    // Called by a diagnostic-only negative-priority R3F callback, before the
    // animation/input callbacks. Negative priority never takes over rendering.
    // No clock reads while disabled, after cap, or in ordinary startup tracing.
    callback = null; pendingOtherScene = null
    if (!steadyState || disposed) return
    usesCallbackFrames = true
    if (!steadyState.shouldSample() || frames.length >= maximumFrames) return
    callbackOrdinal++; callback = { started: now(), scenePass: 0, record: null }
  }, reset: () => {
    frames.length = 0; callbackFrames.length = 0; callbackOrdinal = 0; callback = null; pendingOtherScene = null
  }, dispose: () => {
    disposed = true
    callback = null; pendingOtherScene = null
    if (renderer.render === render) renderer.render = originalRender
    if (renderer.shadowMap.render === shadow) renderer.shadowMap.render = originalShadow
    if (renderer.renderBufferDirect === draw) renderer.renderBufferDirect = originalDraw
    for (const { name, original, replacement } of apiHooks) {
      if (api?.[name] === replacement) api[name] = original
    }
  } }
}

export const virtualChurchSessionElapsedMs = (
  timestamp: number,
  routeStartedAt: number,
) =>
  Number.isFinite(timestamp)
  && Number.isFinite(routeStartedAt)
  && timestamp >= routeStartedAt
    ? timestamp - routeStartedAt
    : Number.NaN
