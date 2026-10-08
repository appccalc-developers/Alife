import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { Group, type WebGLRenderer } from 'three'
import { installVirtualChurchGpuTiming } from '../src/views/virtualChurchGpuTiming.ts'

function fixture({ extension = true, bits = 64 } = {}) {
  const scene = new Group()
  let sampling = false, clock = 0, nextId = 0, lost = false, disjoint = false, available = false, fail = false
  let active: { id: number } | null = null
  const queries = new Map<{ id: number }, { start: number; value: number }>()
  const deleted: number[] = [], extensionObject = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2, QUERY_COUNTER_BITS_EXT: 3 }
  let resultReads = 0
  const gl = {
    CURRENT_QUERY: 4, QUERY_RESULT_AVAILABLE: 5, QUERY_RESULT: 6,
    getExtension: () => extension ? extensionObject : null,
    isContextLost: () => lost,
    getQuery: (_target: number, parameter: number) => parameter === 3 ? bits : active,
    getParameter: () => disjoint,
    createQuery: () => { const q = { id: ++nextId }; queries.set(q, { start: clock, value: 0 }); return q },
    beginQuery: (_target: number, query: { id: number }) => { assert.equal(active, null); active = query; queries.get(query)!.start = clock },
    endQuery: () => { assert.ok(active); queries.get(active)!.value = clock - queries.get(active)!.start; active = null },
    getQueryParameter: (query: { id: number }, parameter: number) => {
      if (parameter === 5) return available
      resultReads++; assert.ok(available, 'never read unfinished GPU result'); return queries.get(query)!.value
    },
    deleteQuery: (query: { id: number }) => { deleted.push(query.id); queries.delete(query) },
  }
  const renderer = {
    getContext: () => gl,
    render(target: Group) { assert.equal(this, renderer); if (target !== scene) return
      renderer.renderBufferDirect(); renderer.renderBufferDirect()
      if (fail) throw Error('original render failure')
    },
    renderBufferDirect() { assert.equal(this, renderer); clock += 2e6 },
  }
  const original = { render: renderer.render, draw: renderer.renderBufferDirect }
  const trace = installVirtualChurchGpuTiming(renderer as unknown as WebGLRenderer, scene, () => sampling)
  return { scene, gl, renderer, original, trace, deleted, reads: () => resultReads,
    sample: () => { sampling = true }, available: () => { available = true }, disjoint: () => { disjoint = true },
    lost: () => { lost = true }, fail: () => { fail = true }, externalQuery: () => { active = { id: -1 } },
    badResult: () => { for (const entry of queries.values()) entry.value = Number.NaN },
  }
}

test('unsupported GPU extension or timer bits never wrap renderer or manufacture samples', () => {
  for (const options of [{ extension: false }, { bits: 0 }]) {
    const f = fixture(options); f.sample(); f.renderer.render(f.scene); f.trace.poll()
    assert.equal(f.renderer.render, f.original.render); assert.equal(f.renderer.renderBufferDirect, f.original.draw)
    assert.equal(f.trace.snapshot().supported, false); assert.deepEqual(f.trace.snapshot().samples, [])
    f.trace.dispose()
  }
})

test('only warmed sample window is timed, primary draw queries never nest, asynchronous results convert full nanoseconds', () => {
  const f = fixture(); f.renderer.render(f.scene); assert.equal(f.trace.snapshot().queriesIssued, 0)
  f.sample(); f.renderer.render(f.scene); f.renderer.renderBufferDirect()
  assert.equal(f.trace.snapshot().queriesIssued, 2)
  f.trace.poll(); assert.equal(f.reads(), 0); assert.equal(f.trace.snapshot().pendingQueries, 2)
  f.available(); f.trace.poll()
  assert.deepEqual(f.trace.snapshot().samples, [
    { render: 1, frame: 0, scenePass: 1, phase: 'scene-render', elapsedMs: 4 },
    { render: 1, frame: 0, scenePass: 1, phase: 'auxiliary-draw', elapsedMs: 2 },
  ])
  assert.equal(f.trace.snapshot().pendingQueries, 0); assert.equal(f.deleted.length, 2)
  f.trace.dispose()
})

test('repeated same-scene passes keep separate per-frame ordinals instead of a misleading single median', () => {
  const f = fixture(); f.sample(); f.trace.beginFrame()
  f.renderer.render(f.scene); f.renderer.render(f.scene); f.renderer.renderBufferDirect()
  f.trace.beginFrame(); f.renderer.renderBufferDirect(); f.renderer.render(f.scene)
  f.available(); f.trace.poll()
  assert.deepEqual(f.trace.snapshot().samples.map(({ frame, scenePass, phase }) => [frame, scenePass, phase]), [
    [1, 1, 'scene-render'], [1, 2, 'scene-render'], [1, 2, 'auxiliary-draw'], [2, 1, 'scene-render'],
  ])
  f.trace.dispose()
})

test('render cap stops auxiliary measurement, and query cap bounds pending allocations', () => {
  const f = fixture(); f.sample()
  for (let i = 0; i < 31; i++) { f.renderer.render(f.scene); f.renderer.renderBufferDirect() }
  assert.equal(f.trace.snapshot().primaryRenders, 30); assert.equal(f.trace.snapshot().queriesIssued, 60)
  f.trace.reset(); f.renderer.render(f.scene)
  for (let i = 0; i < 300; i++) f.renderer.renderBufferDirect()
  assert.equal(f.trace.snapshot().queriesIssued, 240); assert.equal(f.trace.snapshot().pendingQueries, 240)
  f.trace.dispose(); assert.equal(f.trace.snapshot().pendingQueries, 0)
})

test('disjoint invalidates resolved and pending intervals, and halts collection until reset', () => {
  const f = fixture(); f.sample(); f.renderer.render(f.scene); f.available(); f.trace.poll()
  assert.equal(f.trace.snapshot().samples.length, 1)
  f.renderer.render(f.scene); f.disjoint(); f.trace.poll()
  assert.equal(f.trace.snapshot().disjoint, true); assert.equal(f.trace.snapshot().samples.length, 0)
  assert.equal(f.trace.snapshot().pendingQueries, 0)
  const count = f.trace.snapshot().queriesIssued; f.renderer.render(f.scene)
  assert.equal(f.trace.snapshot().queriesIssued, count)
  f.trace.dispose()
})

test('context loss discards queries without calling invalid context deletion, while existing external queries are not hijacked', () => {
  const f = fixture(); f.sample(); f.renderer.render(f.scene); f.lost(); f.trace.poll()
  assert.equal(f.trace.snapshot().disjoint, true); assert.equal(f.trace.snapshot().pendingQueries, 0)
  assert.equal(f.deleted.length, 0); f.trace.dispose()
  const other = fixture(); other.sample(); other.externalQuery(); other.renderer.render(other.scene)
  assert.equal(other.trace.snapshot().queriesIssued, 0); assert.equal(other.trace.snapshot().skipped, 1)
  other.trace.dispose()
})

test('render exception is preserved and its failed interval retired, invalid result does not become zero', () => {
  const f = fixture(); f.sample(); f.fail()
  assert.throws(() => f.renderer.render(f.scene), /original render failure/)
  assert.equal(f.trace.snapshot().pendingQueries, 0); assert.equal(f.deleted.length, 1); f.trace.dispose()
  const bad = fixture(); bad.sample(); bad.renderer.render(bad.scene); bad.badResult(); bad.available(); bad.trace.poll()
  assert.deepEqual(bad.trace.snapshot().samples, []); assert.equal(bad.trace.snapshot().skipped, 1); bad.trace.dispose()
})

test('reset deletes pending window resources; dispose is idempotent and preserves newer wrappers', () => {
  const f = fixture(); f.sample(); f.renderer.render(f.scene); f.trace.reset()
  assert.equal(f.deleted.length, 1); assert.equal(f.trace.snapshot().queriesIssued, 0)
  f.renderer.render(f.scene); assert.equal(f.trace.snapshot().primaryRenders, 1)
  const later = () => {}; f.renderer.render = later
  f.trace.dispose(); f.trace.dispose()
  assert.equal(f.renderer.render, later); assert.equal(f.renderer.renderBufferDirect, f.original.draw)
  assert.equal(f.deleted.length, 2)
})

test('GPU probe requires explicit query, resets interrupted windows and marks formal FPS-ineligible evidence', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  assert.match(source, /get\('profile3dGpuTiming'\) !== '1'/)
  assert.match(source, /gpuTimingRef.current\?\.reset\(\)/)
  assert.match(source, /gpuTimingDiagnostics:/)
  assert.match(source, /trace.dispose\(\); gpuTimingRef.current = null/)
})
