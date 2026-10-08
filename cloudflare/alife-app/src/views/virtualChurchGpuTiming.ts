import type { Object3D, WebGLRenderer } from 'three'

type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number; QUERY_COUNTER_BITS_EXT: number }
type GpuSample = { render: number; frame: number; scenePass: number; phase: 'scene-render' | 'auxiliary-draw'; elapsedMs: number }

/** Explicit local diagnostic. No blocking read, finish(), fence, pixel read,
 * animation/quality change, or timer. Pending queries are polled by the existing
 * frame callback; extension loss/disjoint never fabricates a zero duration.
 * Reference: registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/
 */
export function installVirtualChurchGpuTiming(
  renderer: Pick<WebGLRenderer, 'render' | 'renderBufferDirect' | 'getContext'>,
  scene: Object3D,
  shouldSample: () => boolean,
) {
  const context = renderer.getContext()
  const extension = context.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null
  const gl = context as WebGL2RenderingContext
  // TypeScript's core WebGL overload describes CURRENT_QUERY only; the
  // extension's QUERY_COUNTER_BITS_EXT result is a numeric capability.
  const counterBits: unknown = extension && typeof gl.createQuery === 'function'
    ? gl.getQuery(extension.TIME_ELAPSED_EXT, extension.QUERY_COUNTER_BITS_EXT) : null
  const supported = Boolean(extension && typeof gl.createQuery === 'function'
    && typeof counterBits === 'number' && counterBits > 0)
  const samples: GpuSample[] = []
  const pending = new Map<WebGLQuery, Omit<GpuSample, 'elapsedMs'>>()
  const originalRender = renderer.render, originalDraw = renderer.renderBufferDirect
  let renders = 0, queryCount = 0, skipped = 0, disjoint = false, disposed = false, insidePrimary = false
  let frame = 0, scenePass = 0
  let auxiliaryRender: number | null = null
  const release = (query: WebGLQuery) => { if (!gl.isContextLost()) gl.deleteQuery(query); pending.delete(query) }
  const poll = () => {
    if (!supported || disposed) return
    if (gl.isContextLost() || gl.getParameter(extension!.GPU_DISJOINT_EXT)) {
      disjoint = true; samples.length = 0
      for (const query of pending.keys()) release(query)
      return
    }
    for (const [query, record] of pending) {
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue
      const nanos: unknown = gl.getQueryParameter(query, gl.QUERY_RESULT)
      if (typeof nanos === 'number' && Number.isFinite(nanos) && nanos > 0) {
        samples.push({ ...record, elapsedMs: nanos / 1e6 })
      } else skipped++
      release(query)
    }
  }
  const measure = <T>(render: number, phase: GpuSample['phase'], work: () => T): T => {
    if (!supported || disjoint || disposed || queryCount >= 240
      || gl.isContextLost() || gl.getQuery(extension!.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== null) {
      skipped++; return work()
    }
    const query = gl.createQuery()
    if (!query) { skipped++; return work() }
    queryCount++
    gl.beginQuery(extension!.TIME_ELAPSED_EXT, query)
    let completed = false
    try { const result = work(); completed = true; return result }
    finally {
      if (!gl.isContextLost()) gl.endQuery(extension!.TIME_ELAPSED_EXT)
      if (completed) pending.set(query, { render, frame, scenePass, phase })
      else release(query)
    }
  }
  const render = (...args: Parameters<typeof originalRender>) => {
    if (!supported || disposed || insidePrimary || !shouldSample()) {
      if (!insidePrimary) auxiliaryRender = null
      return originalRender.apply(renderer, args)
    }
    if (args[0] !== scene) return originalRender.apply(renderer, args)
    if (renders >= 30 || disjoint) { auxiliaryRender = null; return originalRender.apply(renderer, args) }
    renders++; scenePass++; auxiliaryRender = renders; insidePrimary = true
    try { return measure(renders, 'scene-render', () => originalRender.apply(renderer, args)) }
    finally { insidePrimary = false }
  }
  const draw = (...args: Parameters<typeof originalDraw>) => {
    if (!supported || disposed || insidePrimary || auxiliaryRender === null || !shouldSample()) return originalDraw.apply(renderer, args)
    return measure(auxiliaryRender, 'auxiliary-draw', () => originalDraw.apply(renderer, args))
  }
  // An unsupported extension installs no wrappers at all.
  if (supported) { renderer.render = render; renderer.renderBufferDirect = draw }
  return {
    beginFrame: () => { frame++; scenePass = 0; auxiliaryRender = null },
    poll,
    snapshot: () => ({ supported, disjoint, primaryRenders: renders, queriesIssued: queryCount, skipped,
      pendingQueries: pending.size, samples: [...samples],
      method: 'Up to 30 renderer.render calls for the app scene (including repeated post-processing scene passes), plus direct auxiliary draws; maximum 240 elapsed queries. Frame and scene-pass ordinals separate repeated passes; cap may truncate auxiliary coverage. Asynchronous nanosecond results, disjoint invalidates the whole window. Instrumented GPU timeline intervals, not formal FPS or complete whole-frame GPU-active time.' }),
    reset: () => {
      for (const query of pending.keys()) release(query)
      samples.length = 0; renders = 0; queryCount = 0; skipped = 0; disjoint = false; auxiliaryRender = null; frame = 0; scenePass = 0
    },
    dispose: () => {
      disposed = true
      if (renderer.render === render) renderer.render = originalRender
      if (renderer.renderBufferDirect === draw) renderer.renderBufferDirect = originalDraw
      for (const query of pending.keys()) release(query)
    },
  }
}
