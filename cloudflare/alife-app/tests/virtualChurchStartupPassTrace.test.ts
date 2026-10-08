import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from '../node_modules/typescript/lib/typescript.js'
import { BackSide, BoxGeometry, ColorManagement, CubeTexture, DoubleSide, Group, LinearSRGBColorSpace, Mesh, MeshDepthMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Scene, ShaderLib, ShaderMaterial, SkinnedMesh, SRGBColorSpace, SRGBTransfer, Texture, UniformsUtils, Vector3, WebGLRenderTarget, type WebGLRenderer } from 'three'
import { installVirtualChurchStartupPassTrace, virtualChurchStartupSurfaceRole, virtualChurchDiagnosticDpr, virtualChurchStartupAssetsPending, virtualChurchStartupPending, virtualChurchStartupBeforePrepare, virtualChurchStartupStageMarks, createVirtualChurchShaderIntrospectionTrace, createVirtualChurchShaderProgramAssociations } from '../src/views/virtualChurchPerformanceContract.ts'
import { createVirtualChurchShaderFrameQueue, createVirtualChurchStartupSubmissions, scheduleVirtualChurchShaderWarmup, virtualChurchDeferredCanStart } from '../src/views/virtualChurchLoadingContract.ts'
import { createVirtualChurchFoyerFloorShaderPreparation } from '../src/views/virtualChurchFoyerContact.ts'

const sourceFunctionCode = (name: string) => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const file = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declaration = file.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
    .find(d => d.name.getText(file) === name)!
  return ts.transpileModule(`const ${declaration.getText(file)}`, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText
}

test('startup submissions coalesce actual frames while preserving independent cancellation and later requests', () => {
  const requests = createVirtualChurchStartupSubmissions()
  const cancelA = requests.request(10), cancelB = requests.request(10)
  assert.equal(requests.needsFrame(10), true)
  cancelA(); cancelA(); assert.equal(requests.needsFrame(10), true)
  assert.equal(requests.needsFrame(11), false)
  const cancelC = requests.request(11)
  cancelB(); assert.equal(requests.needsFrame(11), true, 'old cleanup cannot cancel a later asset')
  requests.clear(); assert.equal(requests.needsFrame(11), false)
  cancelC(); requests.request(12); assert.equal(requests.needsFrame(12), true)
  assert.equal(requests.needsFrame(13), false)
})

test('actual rendered-asset hook requests a real reveal and does not mark readiness until its completed visible frame', () => {
  const code = sourceFunctionCode('useVirtualChurchRenderedAssetSignal')
  for (const canRender of [false, true]) {
    const registry = createVirtualChurchStartupSubmissions(), signals: Array<[string, number]> = [], removed: string[] = []
    let callback = () => {}, cleanup = () => {}, invalidations = 0
    const gl = { info: { render: { frame: 10 } }, getContext: () => ({ isContextLost: () => false }) }
    const doc = { visibilityState: 'visible', documentElement: { removeAttribute(key: string) { removed.push(key) } } }
    const factory = new Function('useThree', 'useRef', 'useLayoutEffect', 'useFrame', 'document', 'reviewStartupSubmissions',
      'virtualChurchAssetHasRendered', 'markVirtualChurchRenderedAssetReady', 'window', `${code}; return useVirtualChurchRenderedAssetSignal`)
    const hook = factory(() => ({ gl, invalidate() { invalidations++ } }), (value: unknown) => ({ current: value }),
      (effect: () => (() => void)) => { cleanup = effect() }, (fn: () => void) => { callback = fn }, doc, new WeakMap([[gl, registry]]),
      (mount: number, current: number, visible: boolean) => visible && current > mount,
      (key: string, time: number) => signals.push([key, time]), { performance: { now: () => 123 } })
    hook({}, 'ready', canRender); assert.equal(registry.needsFrame(10), canRender)
    callback(); assert.deepEqual(signals, [])
    gl.info.render.frame++; doc.visibilityState = 'hidden'; callback(); assert.deepEqual(signals, [])
    doc.visibilityState = 'visible'; callback(); assert.deepEqual(signals, canRender ? [['ready', 123]] : [])
    callback(); assert.equal(signals.length, canRender ? 1 : 0)
    cleanup(); assert.equal(registry.needsFrame(10), false); assert.deepEqual(removed, ['ready', 'ready']); assert.ok(invalidations > 0)
  }
})

const skyPreparationFactory = () => new Function('CubeTexture', 'BoxGeometry', 'ShaderMaterial', 'UniformsUtils',
  'ShaderLib', 'BackSide', 'ColorManagement', 'SRGBTransfer', 'ThreeMesh',
  `${sourceFunctionCode('createVirtualChurchSkyShaderPreparation')}; return createVirtualChurchSkyShaderPreparation`)(
  CubeTexture, BoxGeometry, ShaderMaterial, UniformsUtils, ShaderLib, BackSide, ColorManagement, SRGBTransfer, Mesh,
) as (texture: Texture) => { mesh: Mesh<BoxGeometry, ShaderMaterial>; dispose: () => void }

test('shared shader queue prioritises only currently ready compile jobs, retaining FIFO and one callback per frame', () => {
  const frames = new Map<number, () => void>(), order: string[] = []
  let frameId = 0, parentSubmitted = false, environmentReady = false
  const queue = createVirtualChurchShaderFrameQueue(fn => { const id = ++frameId; frames.set(id, fn); return id }, id => { frames.delete(id) })
  const step = () => { assert.equal(frames.size, 1); const entry = frames.entries().next().value!; frames.delete(entry[0]); entry[1]() }
  queue.requestFrame(() => order.push('parent-introspection'))
  queue.requestFrame(() => order.push('waiting-child'), () => parentSubmitted && environmentReady)
  queue.requestFrame(() => order.push('old-introspection'))
  step(); assert.deepEqual(order, ['parent-introspection'], 'a waiting child cannot starve its parent')
  queue.requestFrame(() => order.push('ready-arrival'), () => parentSubmitted && environmentReady)
  parentSubmitted = true
  step(); assert.deepEqual(order, ['parent-introspection', 'waiting-child'], 'no environment means FIFO, not promotion')
  environmentReady = true
  step(); assert.equal(order.at(-1), 'ready-arrival', 'read readiness after enqueue, while selecting')
  step(); assert.equal(order.at(-1), 'old-introspection'); assert.equal(frames.size, 0)

  queue.requestFrame(() => { order.push('poll-1'); queue.requestFrame(() => order.push('poll-1-again')) })
  queue.requestFrame(() => order.push('poll-2'))
  step(); step(); step()
  assert.deepEqual(order.slice(-3), ['poll-1', 'poll-2', 'poll-1-again'])
})

test('shared shader queue cancellation retires stale frames, and a throwing callback cannot strand later work', () => {
  const frames = new Map<number, () => void>(), order: string[] = []
  let frameId = 0
  const queue = createVirtualChurchShaderFrameQueue(fn => { const id = ++frameId; frames.set(id, fn); return id }, id => { frames.delete(id) })
  const cancelled = queue.requestFrame(() => { throw Error('cancelled job must not execute') }, () => true)
  const stale = frames.values().next().value!
  queue.cancelFrame(cancelled); assert.equal(frames.size, 0)
  const error = new Error('native compile failure')
  queue.requestFrame(() => { order.push('throw'); throw error }, () => true)
  queue.requestFrame(() => order.push('after-error'))
  stale(); assert.deepEqual(order, []); assert.equal(frames.size, 1)
  const first = frames.entries().next().value!; frames.delete(first[0])
  assert.throws(first[1], value => value === error)
  assert.equal(frames.size, 1)
  const next = frames.entries().next().value!; frames.delete(next[0]); next[1]()
  assert.deepEqual(order, ['throw', 'after-error']); assert.equal(frames.size, 0)
})

test('ready character compile ranks ahead of equal-priority surfaces but never bypasses prerequisites or prioritises later polling', () => {
  const frames = new Map<number, () => void>(), order: string[] = []
  let id = 0, parent = false, environment = false, characterCompiled = false
  const queue = createVirtualChurchShaderFrameQueue(fn => { frames.set(++id, fn); return id }, n => { frames.delete(n) })
  const step = () => { assert.equal(frames.size, 1); const entry = frames.entries().next().value!; frames.delete(entry[0]); entry[1]() }
  queue.requestFrame(() => order.push('parent'))
  queue.requestFrame(() => order.push('surface-old'), () => true)
  queue.requestFrame(() => {
    order.push('character-compile'); characterCompiled = true
    queue.requestFrame(() => order.push('character-introspection'), () => !characterCompiled && parent && environment ? 2 : false)
  }, () => parent && environment ? 2 : false)
  step(); assert.deepEqual(order, ['surface-old'], 'only the surface is ready; no speculative character promotion')
  step(); assert.deepEqual(order, ['surface-old', 'parent'])
  queue.requestFrame(() => order.push('surface-new'), () => 1)
  parent = true; environment = true
  step(); assert.equal(order.at(-1), 'character-compile')
  step(); assert.equal(order.at(-1), 'surface-new')
  step(); assert.equal(order.at(-1), 'character-introspection'); assert.equal(frames.size, 0)
  queue.requestFrame(() => order.push('invalid-nan'), () => NaN)
  queue.requestFrame(() => order.push('invalid-infinite'), () => Infinity)
  queue.requestFrame(() => order.push('surface-equal1'), () => true)
  queue.requestFrame(() => order.push('surface-equal2'), () => 1)
  step(); step(); step(); step()
  assert.deepEqual(order.slice(-4), ['surface-equal1', 'surface-equal2', 'invalid-nan', 'invalid-infinite'], 'equal ranks retain FIFO; invalid ranks cannot jump the queue')
})

test('startup mark summary retains late preparation, bounds both ends and excludes other sessions', () => {
  const entries = Array.from({ length: 200 }, (_, index) => ({ name: `vc:frame:${index}`, startTime: 100 + index }))
  entries[199].name = 'vc:shader:character:introspection-end'
  const before = structuredClone(entries)
  const selected = virtualChurchStartupStageMarks(entries, 100, 300)
  assert.equal(selected.length, 128)
  assert.deepEqual(selected.map(entry => entry.startMs), [...Array.from({ length: 64 }, (_, i) => i), ...Array.from({ length: 64 }, (_, i) => 136 + i)])
  assert.equal(selected.at(-1)?.name, 'vc:shader:character:introspection-end')
  assert.deepEqual(entries, before)
  assert.equal(virtualChurchStartupStageMarks(entries.slice(0, 128), 100, 300).length, 128)
  assert.deepEqual(virtualChurchStartupStageMarks([
    { name: 'vc:old', startTime: 99 }, { name: 'unrelated', startTime: 101 },
    { name: 'vc:current', startTime: 101.234 }, { name: 'vc:invalid', startTime: NaN },
    { name: 'vc:after-ready', startTime: 300 },
  ], 100, 300), [{ name: 'vc:current', startMs: 1.2 }])
  assert.deepEqual(virtualChurchStartupStageMarks(entries, NaN, 300), [])
  const probe = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  assert.match(probe, /const startupStageMarks = virtualChurchStartupStageMarks\(\s*performance.getEntriesByType\('mark'\), routeStartedAt, heroReadyAt/)
})

test('introspection trace is opt-in, bounded, preserves receiver/result/throw and fixed labels only', () => {
  let clocks = 0, tick = 0
  const marks: Array<{ name: string; startTime: number }> = []
  const now = () => { clocks++; const result = tick; tick += 10; return result }
  const mark = (name: string, startTime: number) => marks.push({ name, startTime })
  assert.equal(createVirtualChurchShaderIntrospectionTrace(false, 'church', now, mark), null)
  assert.equal(clocks, 0)
  const trace = createVirtualChurchShaderIntrospectionTrace(true, 'church', now, mark)!
  const returned = {}, program = { name: 'private material name', type: 'MeshPhysicalMaterial', getUniforms() { assert.equal(this, program); return returned } }
  assert.equal(trace(program), returned)
  assert.deepEqual(marks, [{ name: 'vc:shader:church:uniform-physical-start', startTime: 0 }, { name: 'vc:shader:church:uniform-physical-end', startTime: 10 }])
  const error = new Error('original query error')
  assert.throws(() => trace({ name: 'BackgroundCubeMaterial', getUniforms() { throw error } }), value => value === error)
  assert.equal(marks.at(-1)?.name, 'vc:shader:church:uniform-sky-background-end')
  for (let i = 0; i < 20; i++) trace(program)
  assert.equal(marks.length, 32); assert.equal(clocks, 32)
  assert.equal(JSON.stringify(marks).includes('private'), false)
  let fastTime = 0
  const fast = createVirtualChurchShaderIntrospectionTrace(true, 'scene', () => fastTime++, mark)!
  fast(program); assert.equal(marks.length, 32)
})

test('introspection API timing scopes existing calls, preserves values/errors and restores only owned methods', () => {
  let clock = 0, calls = 0
  const marks: Array<{ name: string; startTime: number }> = []
  const result = {}, argument = {}, error = new Error('native query failure')
  const context = {
    getProgramInfoLog(value: unknown) { assert.equal(this, context); assert.equal(value, argument); calls++; clock += 12; return result },
    getActiveUniform() { assert.equal(this, context); clock += 9; throw error },
  }
  const originals = { ...context }
  const mark = (name: string, startTime: number) => marks.push({ name, startTime })
  assert.equal(createVirtualChurchShaderIntrospectionTrace(false, 'character', () => { throw Error('disabled clock') }, mark, context), null)
  assert.equal(context.getProgramInfoLog, originals.getProgramInfoLog)
  const trace = createVirtualChurchShaderIntrospectionTrace(true, 'character', () => clock, mark, context)!
  const program = { type: 'MeshBasicMaterial', getUniforms() { assert.equal(this, program); return context.getProgramInfoLog(argument) } }
  assert.equal(trace(program), result); assert.equal(calls, 1)
  assert.equal(context.getProgramInfoLog, originals.getProgramInfoLog)
  assert.deepEqual(marks.filter(m => m.name.includes(':api-')), [
    { name: 'vc:shader:character:api-getProgramInfoLog-start', startTime: 0 },
    { name: 'vc:shader:character:api-getProgramInfoLog-end', startTime: 12 },
  ])
  assert.throws(() => trace({ getUniforms: () => context.getActiveUniform() }), value => value === error)
  assert.equal(context.getActiveUniform, originals.getActiveUniform)
  const later = () => result
  trace({ getUniforms() { context.getProgramInfoLog = later; return result } })
  assert.equal(context.getProgramInfoLog, later)
  assert.equal(JSON.stringify(marks).includes('native query failure'), false)
  const frozen = Object.freeze({ getProgramInfoLog: () => result })
  const frozenTrace = createVirtualChurchShaderIntrospectionTrace(true, 'scene', () => 0, mark, frozen)!
  assert.equal(frozenTrace({ getUniforms: () => frozen.getProgramInfoLog() }), result)
})

test('introspection API timing caps clock calls and slow marks without dropping native calls', () => {
  let clocks = 0, calls = 0
  const context = { getUniformLocation() { calls++; return 'native' } }
  const original = context.getUniformLocation
  const marks: string[] = []
  const trace = createVirtualChurchShaderIntrospectionTrace(true, 'church', () => { clocks++; return 0 }, name => marks.push(name), context)!
  const program = { getUniforms() { for (let i = 0; i < 1100; i++) assert.equal(context.getUniformLocation(), 'native'); return calls } }
  assert.equal(trace(program), 1100); assert.equal(trace(program), 2200)
  assert.equal(clocks, 2052); assert.equal(marks.length, 0)
  assert.equal(context.getUniformLocation, original)
  let tick = 0, slowCalls = 0, slowClocks = 0
  const slowContext = { getProgramParameter() { slowCalls++; tick += 10; return true } }
  const slowTrace = createVirtualChurchShaderIntrospectionTrace(true, 'scene', () => { slowClocks++; return tick }, name => marks.push(name), slowContext)!
  slowTrace({ getUniforms() { for (let i = 0; i < 20; i++) slowContext.getProgramParameter() } })
  assert.equal(slowCalls, 20); assert.equal(slowClocks, 34)
  assert.equal(marks.filter(name => name.includes(':api-')).length, 32)
})

test('program association uses actual material identities, preserves sharing and never emits names or keys', () => {
  const a = {}, b = {}, c = {}, shared = {}, onlyA = {}, onlyB = {}, unclassified = {}
  const maps = new Map([[a, new Map([['private shader key A', shared], ['unused variant A', onlyA]])],
    [b, new Map([['private shader key B', shared], ['variant B', onlyB]])], [c, new Map([['unknown material', unclassified]])]])
  let reads = 0
  const properties = { get(material: object) { reads++; return { programs: maps.get(material), currentProgram: material === a ? onlyA : onlyB } } }
  assert.equal(createVirtualChurchShaderProgramAssociations(false, properties), null); assert.equal(reads, 0)
  const association = createVirtualChurchShaderProgramAssociations(true, properties)!
  const root = (materials: object[]) => ({ traverse(visit: (object: object) => void) { visit({}); visit({ material: materials }) } })
  association.register(root([a]), 'foyer'); association.register(root([b]), 'character')
  assert.deepEqual(association.compiled(new Set([a, b, c]), 'compile'), { materials: 3, programs: 4, truncated: false })
  assert.deepEqual(association.describe(shared), { sources: 10, phases: 1, currentPhases: 0 })
  association.compiled(new Set([a]), 'transmission')
  assert.deepEqual(association.describe(shared), { sources: 10, phases: 3, currentPhases: 0 })
  assert.deepEqual(association.describe(onlyB), { sources: 8, phases: 1, currentPhases: 1 })
  assert.deepEqual(association.describe(unclassified), { sources: 0, phases: 1, currentPhases: 0 })
  assert.deepEqual(association.describe({}), { sources: 0, phases: 0, currentPhases: 0 })
  // A late root registration uses the same material, not its arbitrary name.
  association.register(root([a]), 'surface'); association.compiled(new Set([a]), 'backface')
  assert.deepEqual(association.describe(onlyA), { sources: 6, phases: 7, currentPhases: 7 })
  const marks: string[] = []; let tick = 0
  const trace = createVirtualChurchShaderIntrospectionTrace(true, 'character', () => tick += 10, name => marks.push(name))!
  trace({ id: 71, name: 'private shader name', getUniforms() { return 'original' } }, association.describe(onlyA))
  assert.ok(marks.includes('vc:shader:character:association-p71-s6-v7-c7'))
  assert.equal(JSON.stringify(marks).includes('private'), false)
  assert.equal(maps.get(a)?.size, 2, 'renderer maps are never mutated')
})

test('program association bounds inspection and tolerates absent renderer maps', () => {
  let reads = 0
  const association = createVirtualChurchShaderProgramAssociations(true, { get() { reads++; return {} } })!
  const materials = Array.from({ length: 2050 }, () => ({}))
  assert.deepEqual(association.compiled(new Set(materials), 'compile'), { materials: 2050, programs: 0, truncated: true })
  assert.equal(reads, 2048)
  const shared = {}, map = new Map(Array.from({ length: 4100 }, (_, i) => [i, shared]))
  const bounded = createVirtualChurchShaderProgramAssociations(true, { get: () => ({ programs: map }) })!
  assert.deepEqual(bounded.compiled(new Set([{}]), 'transmission'), { materials: 1, programs: 1, truncated: true })
  assert.equal(map.size, 4100)
})

test('slow-program variants use selected renderer context, retain sharing, bound samples and never emit material data', () => {
  const clothing = new MeshStandardMaterial({ map: new Texture(), normalMap: new Texture(), alphaTest: .5, side: DoubleSide })
  const opaque = new MeshStandardMaterial({ map: clothing.map })
  clothing.name = 'private clothing name'; opaque.name = 'private opaque name'
  const selected = {}, notSelected = {}, returned = {}, cached = {
    programs: new Map([['private selected key', selected], ['private old key', notSelected]]), currentProgram: selected,
    outputColorSpace: LinearSRGBColorSpace, toneMapping: 0, envMap: new Texture(),
    uniforms: { directionalLights: { value: [{}] }, pointLights: { value: [{}, {}] }, spotLights: { value: [] },
      hemisphereLights: { value: [{}] }, directionalLightShadows: { value: [{}] }, pointLightShadows: { value: [] }, spotLightShadows: { value: [] } },
  }
  let reads = 0, visits = 0
  const root = { traverse(visit: (node: object) => void) { visits++; visit({ material: clothing, isSkinnedMesh: true }); visit({ material: opaque }) } }
  const disabled = createVirtualChurchShaderProgramAssociations(false, { get() { throw Error('ordinary visit must not read renderer properties') } })
  disabled?.register(root, 'character'); assert.equal(visits, 0)
  const associations = createVirtualChurchShaderProgramAssociations(true, { get() { reads++; return cached } })!
  associations.register(root, 'character'); associations.compiled(new Set([clothing]), 'transmission')
  assert.equal(reads, 1)
  assert.equal(associations.describe(notSelected).variants, undefined, 'current flags cannot describe an unselected cached program')
  assert.deepEqual(associations.describe(selected).variants, [{ features: 47, output: 2, tone: 0, environment: 1,
    lights: [1, 2, 0, 1], shadows: [1, 0, 0], phases: 2 }])
  cached.outputColorSpace = SRGBColorSpace; cached.toneMapping = 4
  associations.compiled(new Set([clothing]), 'compile'); associations.compiled(new Set([opaque]), 'compile')
  assert.deepEqual(associations.describe(selected).variants?.map(item => item.features), [47, 47, 1], 'shared program observations remain distinct, not a fictitious OR of materials')
  associations.compiled(new Set([clothing]), 'backface')
  assert.equal(associations.describe(selected).variants?.[1].phases, 5, 'matching observed contexts merge only phase membership')
  for (const tone of [5, 6, 7]) { cached.toneMapping = tone; associations.compiled(new Set([clothing]), 'compile') }
  assert.equal(associations.describe(selected).variants?.length, 4); assert.equal(associations.describe(selected).variantOverflow, true)
  const marks: string[] = []; let tick = 0
  const trace = createVirtualChurchShaderIntrospectionTrace(true, 'character', () => tick += 10, name => marks.push(name))!
  assert.equal(trace({ id: 90, type: 'MeshStandardMaterial', getUniforms() { return returned } }, associations.describe(selected)), returned)
  assert.ok(marks.includes('vc:shader:character:variant-p90-f47-o2-t0-e1-l1_2_0_1-s1_0_0-v2'))
  assert.ok(marks.includes('vc:shader:character:variant-p90-limit'))
  assert.equal(JSON.stringify(marks).includes('private'), false)
  assert.equal(cached.programs.size, 2); assert.equal(cached.currentProgram, selected)
  clothing.dispose(); opaque.dispose(); clothing.map!.dispose(); clothing.normalMap!.dispose(); cached.envMap.dispose()
})

test('fast f35 selection retains actual program identity and current context without extra renderer reads', () => {
  const material = new MeshStandardMaterial({ map: new Texture(), normalMap: new Texture() })
  const screen = { id: 41 }, linear = { id: 42 }, old = { id: 43 }
  const cached = { programs: new Map([['private screen key', screen], ['private linear key', linear], ['private old key', old]]),
    currentProgram: screen, outputColorSpace: SRGBColorSpace, toneMapping: 4, envMap: new Texture(),
    uniforms: { directionalLights: { value: [{}] }, pointLights: { value: Array(7).fill({}) }, spotLights: { value: [] },
      hemisphereLights: { value: [{}] }, directionalLightShadows: { value: [{}] }, pointLightShadows: { value: [] }, spotLightShadows: { value: [] } } }
  let reads = 0
  const association = createVirtualChurchShaderProgramAssociations(true, { get() { reads++; return cached } })!
  association.register({ traverse(visit) { visit({ material, isSkinnedMesh: true }) } }, 'character')
  const selected: Array<{ id: number; source: number; variant: unknown }> = []
  const observe: NonNullable<Parameters<typeof association.compiled>[2]> = (id, source, variant) => selected.push({ id, source, variant })
  assert.deepEqual(association.compiled(new Set([material]), 'compile', observe),
    { materials: 1, programs: 3, truncated: false, selected: 1, selectionTruncated: false })
  cached.currentProgram = linear; cached.outputColorSpace = LinearSRGBColorSpace; cached.toneMapping = 0
  association.compiled(new Set([material]), 'transmission', observe)
  cached.currentProgram = screen; cached.outputColorSpace = SRGBColorSpace; cached.toneMapping = 4
  association.compiled(new Set([material]), 'backface', observe)
  assert.equal(reads, 3, 'one existing properties read per material per compile, not another diagnostic lookup')
  assert.deepEqual(selected.map(x => x.id), [41, 42, 41], 'actual identities distinguish reuse from a different selected program')
  assert.deepEqual(selected[0], { id: 41, source: 8, variant: { features: 35, output: 1, tone: 4, environment: 1,
    lights: [1, 7, 0, 1], shadows: [1, 0, 0], phases: 1 } })
  assert.deepEqual(selected[1], { id: 42, source: 8, variant: { features: 35, output: 2, tone: 0, environment: 1,
    lights: [1, 7, 0, 1], shadows: [1, 0, 0], phases: 2 } })
  assert.equal(association.describe(screen).variants?.[0].phases, 5)
  assert.equal((selected[0].variant as { phases: number }).phases, 1, 'emitted snapshot is not changed by later association merging')
  assert.doesNotMatch(JSON.stringify(selected), /private|key|name/)
  assert.equal(cached.programs.size, 3); assert.equal(cached.currentProgram, screen)
  material.map!.dispose(); material.normalMap!.dispose(); material.dispose(); cached.envMap.dispose()
})

test('f35 selected observations deduplicate each compile, cap each stage and session, and expose incomplete coverage', () => {
  const materials = Array.from({ length: 15 }, () => new MeshStandardMaterial({ map: new Texture(), normalMap: new Texture() }))
  const programs = materials.map((_, id) => ({ id }))
  const cached = materials.map((_, id) => ({ programs: new Map([['private key', programs[id]]]), currentProgram: programs[id] }))
  const association = createVirtualChurchShaderProgramAssociations(true, { get(material) { return cached[materials.indexOf(material as MeshStandardMaterial)] } })!
  association.register({ traverse(visit) { for (const material of materials) visit({ material, isSkinnedMesh: true }) } }, 'character')
  let total = 0
  const observe = () => { total++ }
  const first = association.compiled(new Set(materials), 'compile', observe)
  assert.equal(first.selected, 12); assert.equal(first.selectionTruncated, true)
  for (let run = 0; run < 6; run++) association.compiled(new Set(materials), 'transmission', observe)
  assert.equal(total, 64)
  assert.equal(association.compiled(new Set(materials), 'compile', observe).selected, 0)
  assert.equal(association.compiled(new Set(materials), 'compile', observe).selectionTruncated, true)
  const duplicate = createVirtualChurchShaderProgramAssociations(true, { get() { return cached[0] } })!
  duplicate.register({ traverse(visit) { for (const material of materials) visit({ material, isSkinnedMesh: true }) } }, 'character')
  assert.equal(duplicate.compiled(new Set(materials), 'compile', observe).selected, 1)
  const unknown = createVirtualChurchShaderProgramAssociations(true, { get() { const program = {}; return { programs: new Map([[0, program]]), currentProgram: program } } })!
  unknown.register({ traverse(visit) { visit({ material: materials[0], isSkinnedMesh: true }) } }, 'character')
  assert.equal(unknown.compiled(new Set([materials[0]]), 'compile', observe).selectionTruncated, true)
  assert.equal(total, 65, 'unknown identity cannot be emitted as invented program zero')
  for (const material of materials) { material.map!.dispose(); material.normalMap!.dispose(); material.dispose() }
})

test('background preparation matches the installed public cube shader and owns only metadata/temporary material', () => {
  const create = skyPreparationFactory()
  for (const colorSpace of [SRGBColorSpace, LinearSRGBColorSpace]) {
    const original = new Texture(); original.colorSpace = colorSpace
    let originalDisposals = 0
    original.addEventListener('dispose', () => originalDisposals++)
    const preparation = create(original), { geometry, material } = preparation.mesh
    const cube = material.uniforms.envMap.value as CubeTexture
    assert.equal(material.name, 'BackgroundCubeMaterial')
    assert.equal(material.vertexShader, ShaderLib.backgroundCube.vertexShader)
    assert.equal(material.fragmentShader, ShaderLib.backgroundCube.fragmentShader)
    assert.notEqual(material.uniforms, ShaderLib.backgroundCube.uniforms)
    assert.equal(material.uniforms.backgroundIntensity.value, 1)
    assert.equal(material.side, BackSide); assert.equal(material.fog, false)
    assert.equal(material.depthTest, false); assert.equal(material.depthWrite, false); assert.equal(material.allowOverride, false)
    assert.equal(material.toneMapped, colorSpace !== SRGBColorSpace)
    assert.equal(Object.getOwnPropertyDescriptor(material, 'envMap')?.get?.call(material), cube)
    assert.equal(cube.colorSpace, colorSpace); assert.equal(cube.isRenderTargetTexture, true)
    assert.equal(cube.version, 0); assert.deepEqual(cube.image, [], 'no texture image/upload allocated')
    assert.equal(geometry.getAttribute('normal'), undefined); assert.equal(geometry.getAttribute('uv'), undefined)
    assert.equal(preparation.mesh.parent, null, 'never added to the visible scene')
    let disposed = 0
    for (const owned of [geometry, material, cube]) owned.addEventListener('dispose', () => disposed++)
    preparation.dispose(); preparation.dispose()
    assert.equal(disposed, 3); assert.equal(originalDisposals, 0)
    assert.equal(original.version, 0); assert.equal(ShaderLib.backgroundCube.uniforms.envMap.value, null)
    original.dispose()
  }
  const installed = readFileSync(new URL('../node_modules/three/src/renderers/webgl/WebGLBackground.js', import.meta.url), 'utf8')
  assert.match(installed, /cloneUniforms\( ShaderLib.backgroundCube.uniforms \)/)
  assert.match(installed, /vertexShader: ShaderLib.backgroundCube.vertexShader/)
  assert.match(installed, /fragmentShader: ShaderLib.backgroundCube.fragmentShader/)
  assert.match(installed, /boxMesh.geometry.deleteAttribute\( 'normal' \)/)
  assert.match(installed, /boxMesh.geometry.deleteAttribute\( 'uv' \)/)
  assert.match(installed, /ColorManagement.getTransfer\( background.colorSpace \) !== SRGBTransfer/)
})

test('actual warm-up hook prepares both background variants and retains them until real submission, cancellation or context loss', () => {
  const code = `const reviewStartupSubmissions = new WeakMap();\n${sourceFunctionCode('usePreparedReviewAsset')}`, create = skyPreparationFactory()
  for (const scenario of ['submit', 'cancel', 'lost', 'compile-error', 'mobile', 'no-extension', 'diagnostic']) {
    const scene = new Scene(), camera = {}, environment = new Texture(), background = new Texture()
    scene.environment = environment; scene.background = background; background.colorSpace = SRGBColorSpace
    let frameId = 0, clock = 0, lost = false, disposed = 0, cancelled: () => void = () => {}, ready = false
    const pending = new Map<number, () => void>(), compilations: Array<{ model: unknown; target: unknown }> = [], warnings: unknown[] = []
    const frameQueue = { requestFrame(fn: () => void) { const id = ++frameId; pending.set(id, fn); return id }, cancelFrame(id: number) { pending.delete(id) } }
    let target: unknown = null
    const context = { isContextLost: () => lost, getExtension: () => scenario === 'no-extension' ? null : ({ COMPLETION_STATUS_KHR: 0x91B1 }), getProgramParameter: () => true }
    const program = { id: 23, program: {}, getUniforms() { clock += 10 } }
    let propertyReads = 0
    const stageMarks: string[] = []
    const associations = new WeakMap()
    const gl = { info: { render: { frame: 0 }, programs: [program] }, getContext: () => context,
      properties: { get() { propertyReads++; return { programs: new Map([['private fixture key', program]]), currentProgram: program } } },
      getRenderTarget: () => target, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
      setRenderTarget(value: unknown) { target = value },
      compile(model: unknown) {
        compilations.push({ model, target }); if (scenario === 'compile-error' && model !== scene) throw new Error('compile fixture')
        return new Set(model instanceof Mesh ? [model.material] : [])
      },
      debug: { checkShaderErrors: true } }
    const queues = new WeakMap([[gl, frameQueue]])
    let helper: ReturnType<typeof create> | null = null
    const createOwned = (texture: Texture) => {
      helper = create(texture)
      for (const owned of [helper.mesh.geometry, helper.mesh.material, helper.mesh.material.uniforms.envMap.value]) {
        owned.addEventListener('dispose', () => disposed++)
      }
      return helper
    }
    const factory = new Function('useThree', 'useState', 'useLayoutEffect', 'profile3DEnabled', 'profile3DSearchParams', 'performance', 'createVirtualChurchShaderIntrospectionTrace',
      'reviewShaderProgramAssociations', 'createVirtualChurchShaderProgramAssociations',
      'reviewShaderFrameQueues', 'createVirtualChurchShaderFrameQueue', 'scheduleVirtualChurchShaderWarmup',
      'createVirtualChurchSkyShaderPreparation', 'perfConfig', 'WebGLRenderTarget', 'DoubleSide', 'BackSide', 'console',
      `${code}; return usePreparedReviewAsset`)
    const hook = factory(() => ({ gl, camera, scene, invalidate() {} }), () => [false, (value: boolean) => { ready = value }],
      (fn: () => (() => void)) => { cancelled = fn() }, scenario === 'diagnostic', new URLSearchParams('profile3dStartupPasses=assets'),
      { now: () => clock++, mark: (name: string) => stageMarks.push(name) }, createVirtualChurchShaderIntrospectionTrace,
      associations, (...args: Parameters<typeof createVirtualChurchShaderProgramAssociations>) => {
        assert.equal(scenario, 'diagnostic', 'normal visit cannot collect associations')
        return createVirtualChurchShaderProgramAssociations(...args)
      }, queues,
      createVirtualChurchShaderFrameQueue, scheduleVirtualChurchShaderWarmup, createOwned, { glassTransmission: scenario !== 'mobile' },
      WebGLRenderTarget, DoubleSide, BackSide, { warn: (...args: unknown[]) => warnings.push(args) })
    const step = () => { const entry = pending.entries().next().value; assert.ok(entry); pending.delete(entry[0]); entry[1]() }
    hook(scene, true, true, false)
    if (scenario === 'no-extension') {
      assert.equal(ready, true); assert.equal(helper, null); assert.equal(compilations.length, 0)
      assert.equal(pending.size, 0); assert.equal(disposed, 0); assert.equal(warnings.length, 0)
      assert.equal(gl.debug.checkShaderErrors, true)
      background.dispose(); environment.dispose()
      continue
    }
    step(); assert.ok(helper); assert.equal(disposed, 0)
    if (scenario !== 'compile-error') {
      assert.equal(compilations.length, scenario === 'mobile' ? 2 : 4)
      assert.equal(compilations[0].model, scene); assert.equal(compilations[1].model, helper!.mesh)
      assert.equal(compilations[1].target, null)
      if (scenario !== 'mobile') {
        assert.equal(compilations[2].model, scene); assert.equal(compilations[3].model, helper!.mesh)
        assert.ok(compilations[3].target instanceof WebGLRenderTarget)
      }
      assert.equal(target, null, 'original renderer target restored')
      step(); assert.equal(ready, true)
    } else { assert.equal(warnings.length, 1); assert.equal(ready, true) }
    assert.equal(disposed, 0, 'compiled cache is retained when warmup finishes')
    if (scenario === 'cancel') cancelled()
    else if (scenario === 'lost') { lost = true; step() }
    else {
      step(); assert.equal(disposed, 0, 'no actual scene submission yet')
      gl.info.render.frame++; step()
    }
    assert.equal(disposed, 3); cancelled(); cancelled()
    assert.equal(disposed, 3); assert.equal(pending.size, 0)
    assert.equal(gl.debug.checkShaderErrors, true); assert.equal(scene.background, background); assert.equal(scene.environment, environment)
    if (scenario === 'diagnostic') {
      assert.equal(propertyReads, 2); assert.equal(associations.has(gl), true)
      assert.ok(stageMarks.includes('vc:shader:scene:association-p23-s16-v3-c3'))
      assert.ok(stageMarks.includes('vc:shader:scene:compile-set-m1-p1-limit0'))
      assert.ok(stageMarks.includes('vc:shader:scene:transmission-set-m1-p1-limit0'))
    } else { assert.equal(propertyReads, 0); assert.equal(associations.has(gl), false) }
    background.dispose(); environment.dispose()
  }
})

test('committed foyer owns preparation and cannot be revealed by its LOD callback before preparation', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const file = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declaration = file.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
    .find(d => d.name.getText(file) === 'FoyerDetailLayer')!
  const code = ts.transpileModule(`const ${declaration.getText(file)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.React },
  }).outputText
  for (const [prepared, floorPrepared] of [[false, false], [false, true], [true, false], [true, true]]) {
    let stateCall = 0
    let frame: (state: unknown) => void = () => {}, warmup: unknown[] = [], ready: boolean[] = []
    const factory = new Function('React', 'useRef', 'useMemo', 'useState', 'useEffect', 'useFrame',
      'ThreeGroup', 'Vector3', 'usePreparedReviewAsset', 'virtualChurchWorldCameraIsInsideFoyer',
      'virtualChurchShouldLoadFoyerPhotos', 'virtualChurchShouldRenderFoyerDetail', 'perfConfig',
      'FoyerFlagLayer', 'FoyerCirculationLayer', `${code}; return FoyerDetailLayer`)
    const component = factory(
      { createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }) },
      (initial: unknown) => ({ current: initial }), (fn: () => unknown) => fn(),
      (initial: unknown) => [stateCall++ === 0 ? floorPrepared : initial, () => {}], (fn: () => void) => fn(),
      (fn: typeof frame) => { frame = fn }, Group, Vector3,
      (...args: unknown[]) => { warmup = args; return prepared },
      () => true, () => false, () => true, { isMobile: false }, () => null, () => null,
    )
    const output = component({ showFlags: false, onReady: (value: boolean) => ready.push(value) })
    assert.equal(output.type, 'primitive')
    assert.equal(output.props.object, warmup[0])
    assert.deepEqual(warmup.slice(1), [true, true, true, 'foyer'])
    assert.equal(output.props.visible, prepared)
    frame({ camera: { position: { x: 0, z: 0 } } })
    assert.equal(output.props.object.visible, prepared)
    assert.deepEqual(ready, [prepared && floorPrepared])
  }
  assert.match(source, /useVirtualChurchRenderedAssetSignal\(model, VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE, prepared && \(visualVersion !== 'v3' \|\| foyerPrepared\)\)/)
  assert.match(source, /foyerPrepared=\{foyerPrepared\}/)
  assert.match(source, /onReady=\{setFoyerPrepared\}/)
  assert.match(source, /<FoyerOakFloor onReady=\{onFloorReady\} \/>/)
  assert.match(source, /onFloorReady=\{setFloorPrepared\}/)
})

test('late image surface retains its children and waits for preparation without inventing a rendered signal', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const file = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declaration = file.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
    .find(d => d.name.getText(file) === 'PreparedFoyerSurface')!
  const code = ts.transpileModule(`const ${declaration.getText(file)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.React },
  }).outputText
  for (const prepared of [false, true]) for (const withCallback of [false, true]) {
    const ready: boolean[] = [], child = { originalMesh: true }
    let warmup: unknown[] = []
    const factory = new Function('React', 'useMemo', 'ThreeGroup', 'usePreparedReviewAsset', 'useEffect', `${code}; return PreparedFoyerSurface`)
    const component = factory({ createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }) },
      (fn: () => unknown) => fn(), Group, (...args: unknown[]) => { warmup = args; return prepared }, (fn: () => void) => fn())
    const result = component({ children: child, onReady: withCallback ? (value: boolean) => ready.push(value) : undefined })
    assert.deepEqual(warmup, [result.props.object, true, true, true, 'surface'])
    assert.equal(result.props.visible, prepared)
    assert.equal(result.children[0], child)
    assert.deepEqual(ready, withCallback ? [prepared] : [])
  }
})

test('actual arriving-surface hook preserves screen/linear variants, target restoration, cancellation and glass scene preparation', () => {
  const code = `const reviewStartupSubmissions = startupSubmissionsFixture;\n${sourceFunctionCode('usePreparedReviewAsset')}`
  for (const scenario of ['surface', 'mobile', 'linear-error', 'cancel', 'glass', 'diagnostic-character', 'diagnostic-fast-character']) {
    const scene = new Scene(), model = new Group(), environment = new Texture(), camera = {}
    const profiling = scenario.startsWith('diagnostic-'), marks: string[] = []
    const geometry = new BoxGeometry(), material = scenario === 'glass'
      ? new MeshPhysicalMaterial({ transmission: .14, side: DoubleSide }) : new MeshStandardMaterial(profiling ? { map: new Texture(), normalMap: new Texture() } : {})
    model.add(profiling ? new SkinnedMesh(geometry, material) : new Mesh(geometry, material)); scene.add(model, new Group()); scene.environment = environment
    let clock = 0, ready = false, frameId = 0, disposed = 0, propertyReads = 0, invalidations = 0
    let cleanup = () => {}, target: unknown = { existingTarget: true }, face = 3, mip = 2
    const originalTarget = target, pending = new Map<number, () => void>(), warnings: unknown[] = []
    const compilations: Array<{ object: unknown; target: unknown; side: number }> = []
    const context = { getExtension: () => ({ COMPLETION_STATUS_KHR: 1 }), isContextLost: () => false, getProgramParameter: () => true }
    const program = { id: 91, program: {}, getUniforms() { if (scenario !== 'diagnostic-fast-character') clock += 10 } }
    const gl = { getContext: () => context, info: { render: { frame: 0 }, programs: [program] },
      properties: { get() {
        propertyReads++
        if (!profiling) throw Error('normal visit must not read program associations')
        return { programs: new Map([['private fixture key', program]]), currentProgram: program,
          outputColorSpace: target === originalTarget ? SRGBColorSpace : LinearSRGBColorSpace,
          toneMapping: target === originalTarget ? 4 : 0, envMap: environment,
          uniforms: { directionalLights: { value: [{}] }, pointLights: { value: Array(7).fill({}) }, spotLights: { value: [] },
            hemisphereLights: { value: [{}] }, directionalLightShadows: { value: [{}] }, pointLightShadows: { value: [] }, spotLightShadows: { value: [] } } }
      } },
      getRenderTarget: () => target, getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
      setRenderTarget(value: unknown, cubeFace = 0, mipLevel = 0) { target = value; face = cubeFace; mip = mipLevel },
      compile(object: unknown, actualCamera: unknown, targetScene: unknown) {
        assert.equal(actualCamera, camera); assert.equal(targetScene, scene)
        compilations.push({ object, target, side: material.side })
        if (scenario === 'linear-error' && target !== originalTarget) throw Error('linear fixture failure')
        return new Set([material])
      }, debug: { checkShaderErrors: true } }
    const priorities: Array<(() => boolean | number) | undefined> = []
    const queue = { requestFrame(fn: () => void, priority?: () => boolean | number) { const id = ++frameId; pending.set(id, fn); priorities.push(priority); return id }, cancelFrame(id: number) { pending.delete(id) } }
    class Target extends WebGLRenderTarget { override dispose() { disposed++; super.dispose() } }
    const factory = new Function('useThree', 'useState', 'useLayoutEffect', 'profile3DEnabled', 'profile3DSearchParams', 'performance',
      'createVirtualChurchShaderIntrospectionTrace', 'reviewShaderProgramAssociations', 'createVirtualChurchShaderProgramAssociations',
      'reviewShaderFrameQueues', 'createVirtualChurchShaderFrameQueue', 'scheduleVirtualChurchShaderWarmup',
      'createVirtualChurchSkyShaderPreparation', 'perfConfig', 'WebGLRenderTarget', 'MeshPhysicalMaterial', 'DoubleSide', 'BackSide', 'console', 'startupSubmissionsFixture',
      `${code}; return usePreparedReviewAsset`)
    const submissionRequests = createVirtualChurchStartupSubmissions()
    const hook = factory(() => ({ gl, camera, scene, invalidate() { invalidations++ } }), () => [false, (value: boolean) => { ready = value }],
      (fn: () => (() => void)) => { cleanup = fn() }, profiling, new URLSearchParams('profile3dStartupPasses=all'), { now: () => clock++, mark: (name: string) => marks.push(name) },
      createVirtualChurchShaderIntrospectionTrace, new WeakMap(), (...args: Parameters<typeof createVirtualChurchShaderProgramAssociations>) => {
        assert.equal(profiling, true, 'normal visit cannot create association cache')
        return createVirtualChurchShaderProgramAssociations(...args)
      },
      new WeakMap([[gl, queue]]), createVirtualChurchShaderFrameQueue, scheduleVirtualChurchShaderWarmup,
      () => { throw Error('arriving surface must not create sky helper') }, { glassTransmission: scenario !== 'mobile' },
      Target, MeshPhysicalMaterial, DoubleSide, BackSide, { warn: (...args: unknown[]) => warnings.push(args) }, new WeakMap([[gl, submissionRequests]]))
    const step = () => { const entry = pending.entries().next().value; assert.ok(entry); pending.delete(entry[0]); entry[1]() }
    hook(model, true, scenario === 'glass', true, profiling ? 'character' : 'surface', profiling ? 2 : 1)
    assert.equal(submissionRequests.needsFrame(0), true, 'actual hook registers its parent submission')
    assert.equal(priorities[0]?.(), false, 'must not prioritise before the parent has rendered')
    step(); assert.equal(compilations.length, 0); assert.equal(ready, false, 'requires a real parent submission')
    if (scenario === 'cancel') {
      cleanup(); assert.equal(pending.size, 0); assert.equal(ready, false); assert.equal(disposed, 0)
    } else {
      gl.info.render.frame++
      assert.equal(priorities.at(-1)?.(), profiling ? 2 : 1, 'ready formal character compile has rank2; ordinary surfaces retain rank1')
      scene.environment = null
      assert.equal(priorities.at(-1)?.(), false, 'a missing environment cannot be prioritised')
      scene.environment = environment
      step()
      if (profiling) {
        assert.ok(marks.includes('vc:shader:character:compile-selected-p91-s8-f35-o1-t4-e1-l1_7_0_1-s1_0_0'))
        assert.ok(marks.includes('vc:shader:character:transmission-selected-p91-s8-f35-o2-t0-e1-l1_7_0_1-s1_0_0'))
        assert.ok(marks.includes('vc:shader:character:compile-selection-n1-limit0'))
        assert.equal(ready, false, 'selected observations exist before introspection/reveal, without changing readiness')
      }
      if (scenario === 'linear-error') assert.equal(pending.size, 0, 'failed job finishes instead of being requeued')
      else assert.equal(priorities.at(-1)?.(), false, 'compiled/linking/introspection jobs are no longer prioritised')
      assert.equal(compilations[0].object, model); assert.equal(compilations[0].target, originalTarget)
      assert.equal(compilations.length, scenario === 'mobile' ? 1 : scenario === 'glass' ? 3 : 2)
      if (scenario !== 'mobile') {
        assert.equal(compilations[1].object, scenario === 'glass' ? scene : model)
        assert.ok(compilations[1].target instanceof Target)
        assert.equal(disposed, 1)
      }
      if (scenario === 'glass') {
        assert.equal(compilations[2].object, model); assert.equal(compilations[2].side, BackSide)
        assert.equal(material.side, DoubleSide, 'original glass side restored')
      }
      assert.equal(target, originalTarget); assert.equal(face, 3); assert.equal(mip, 2)
      if (scenario === 'linear-error') { assert.equal(warnings.length, 1); assert.equal(ready, true) }
      else { assert.equal(ready, false); step(); assert.equal(ready, true); assert.equal(warnings.length, 0) }
      assert.equal(submissionRequests.needsFrame(gl.info.render.frame), true, 'finish/error retains a real reveal request')
      cleanup(); assert.equal(pending.size, 0)
    }
    assert.equal(submissionRequests.needsFrame(gl.info.render.frame), false, 'actual cancellation removes owned parent and reveal requests')
    assert.equal(propertyReads > 0, profiling); assert.equal(gl.debug.checkShaderErrors, true); assert.ok(invalidations > 0)
    if (profiling) {
      assert.ok(marks.includes('vc:shader:character:compile-set-m1-p1-limit0'))
      assert.ok(marks.includes('vc:shader:character:transmission-set-m1-p1-limit0'))
      if (scenario === 'diagnostic-fast-character') assert.ok(marks.every(mark => !mark.includes(':association-')), 'fast calls still emit selected observations without inventing a slow query')
      else assert.ok(marks.includes('vc:shader:character:association-p91-s8-v3-c3'), 'fixture selects this program in both screen and linear compiles')
      assert.ok(marks.includes('vc:shader:character:introspection-end'))
      assert.equal(compilations.length, 2)
      assert.ok(compilations.every(compilation => compilation.object === model), 'no unrelated scene traversal for an opaque arrival')
      assert.doesNotMatch(marks.join(','), /shader:church:|private fixture key/)
    } else assert.deepEqual(marks, [], 'no added ordinary diagnostic work')
    assert.equal(scene.environment, environment); assert.equal(model.parent, scene)
    geometry.dispose(); material.map?.dispose(); material.normalMap?.dispose(); material.dispose(); environment.dispose()
  }
})

test('floor image failure retains fallback readiness while cancelled requests cannot update readiness', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const file = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declaration = file.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
    .find(d => d.name.getText(file) === 'FoyerOakFloor')!
  const code = ts.transpileModule(`const ${declaration.getText(file)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.React },
  }).outputText
  for (const cancelled of [false, true]) {
    let failed: () => void = () => {}, disposed = 0
    const cleanups: Array<() => void> = [], ready: boolean[] = [], states: unknown[] = []
    const factory = new Function('useMemo', 'useState', 'useEffect', 'TextureLoader', 'FOYER_OAK_BASECOLOR',
      'addVirtualChurchFoyerContactUV', 'createVirtualChurchFoyerOakFloorGeometry', 'createVirtualChurchFoyerContactMask',
      'foyerFloorContacts', `${code}; return FoyerOakFloor`)
    const component = factory((fn: () => unknown) => fn(), (initial: unknown) => [initial, (value: unknown) => states.push(value)],
      (fn: () => (() => void)) => cleanups.push(fn()), class { load(_path: string, _ok: unknown, _progress: unknown, error: () => void) {
        failed = error; return { dispose: () => disposed++ }
      } }, '/same-owned-floor.jpg', (value: unknown) => value,
      () => ({ dispose() {} }), () => ({ dispose() {} }), [])
    assert.equal(component({ onReady: (value: boolean) => ready.push(value) }), null)
    assert.deepEqual(ready, [false])
    if (cancelled) cleanups[0]()
    failed()
    assert.deepEqual(ready, cancelled ? [false] : [false, true])
    assert.deepEqual(states, cancelled ? [] : [null])
    if (!cancelled) cleanups[0]()
    assert.equal(disposed, 1)
  }
})

test('V3 initial preparation caches the real anisotropy capability before shader work without changing filtering or error checks', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const file = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declaration = file.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
    .find(d => d.name.getText(file) === 'InitialSceneShaderPreparation')!
  const code = ts.transpileModule(`const ${declaration.getText(file)}`, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText
  for (const limit of [0, 8, 16]) for (const prepared of [false, true]) for (const profile of [false, true]) {
    const effects: Array<() => void | (() => void)> = [], marks: string[] = [], calls: string[] = []
    let queried = 0, cached: number | undefined, priority = -1
    const scene = new Group(), gl = { info: { render: { frame: 0 } }, capabilities: { getMaxAnisotropy() {
      assert.equal(this, gl.capabilities); calls.push('capability')
      if (cached === undefined) { queried++; cached = limit }
      return cached
    } }, debug: { checkShaderErrors: true } }
    const factory = new Function('useThree', 'useLayoutEffect', 'usePreparedReviewAsset', 'useFrame', 'profile3DEnabled', 'performance', 'createVirtualChurchFoyerFloorShaderPreparation', 'useState', 'useRef', 'createVirtualChurchStartupSubmissions', 'reviewStartupSubmissions', `${code}; return InitialSceneShaderPreparation`)
    const helpers: ReturnType<typeof createVirtualChurchFoyerFloorShaderPreparation>[] = []
    const component = factory(() => ({ gl, scene }), (fn: () => void, deps: unknown[]) => {
      assert.ok(deps.length === 1 && (deps[0] === gl || deps[0] === scene)); effects.push(fn)
    }, (model: unknown, ...options: unknown[]) => {
      assert.equal(model, scene); assert.deepEqual(options, [true, true, false]); effects.push(() => calls.push('shader')); return prepared
    }, (_fn: unknown, value: number) => { priority = value }, profile, { now: () => 100, mark: (name: string) => marks.push(name) }, () => {
      calls.push('floor-helper'); const helper = createVirtualChurchFoyerFloorShaderPreparation(); helpers.push(helper); return helper
    }, () => [true, () => {}], (value: unknown) => ({ current: value }), createVirtualChurchStartupSubmissions, new WeakMap())
    assert.equal(component(), null); assert.deepEqual(calls, [])
    const cleanups = effects.map(effect => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function')
    assert.deepEqual(calls, ['capability', 'floor-helper', 'shader']); assert.equal(queried, 1)
    assert.equal(scene.getObjectByName('vc:foyer-floor-shader-preparation'), helpers[0].mesh)
    assert.equal(helpers[0].mesh.visible, false)
    let disposed = 0
    for (const resource of [helpers[0].mesh.geometry, helpers[0].mesh.material, helpers[0].mesh.material.map!, helpers[0].mesh.material.aoMap!]) resource.addEventListener('dispose', () => disposed++)
    cleanups[1](); cleanups[1](); assert.equal(disposed, 4); assert.equal(scene.children.length, 0)
    const replayCleanup = effects[2]()
    assert.equal(helpers.length, 2); assert.equal(scene.children.length, 1); assert.notEqual(helpers[0].mesh, helpers[1].mesh)
    assert.equal(typeof replayCleanup, 'function'); if (typeof replayCleanup === 'function') replayCleanup()
    assert.equal(scene.children.length, 0)
    effects[1](); assert.equal(queried, 1, 'StrictMode replay uses Three-owned cache')
    cleanups[0]()
    assert.equal(cached, limit); assert.equal(gl.debug.checkShaderErrors, true)
    assert.equal(priority, 1, 'loading controller owns submissions until both real readiness signals')
    assert.deepEqual(marks, profile ? Array.from({ length: 2 }, () => ['vc:capabilities:anisotropy-start', 'vc:capabilities:anisotropy-end']).flat() : [])
  }
  assert.match(source, /config3D.visualVersion === 'v3' \? <InitialSceneShaderPreparation \/> : null/)
  assert.match(source, /result.anisotropy = 8/)
  assert.match(source, /result.anisotropy = perfConfig.isMobile \? 2 : 4/)
})

test('actual startup controller submits only requested frames, respects visibility/preparation, and restores ordinary rendering', () => {
  const code = sourceFunctionCode('InitialSceneShaderPreparation')
  for (const scenario of ['ordinary', 'background', 'preparing', 'lost']) {
    const scene = new Group(), camera = {}, cleanups: Array<() => void> = [], states: boolean[] = []
    const submissions = new WeakMap(), signals = new Map<string, string>(), priorities: number[] = []
    let callback = () => {}, renders = 0, invalidations = 0, lost = scenario === 'lost'
    const gl = { info: { render: { frame: 0 } }, getContext: () => ({ isContextLost: () => lost }),
      capabilities: { getMaxAnisotropy: () => 16 }, render(actualScene: unknown, actualCamera: unknown) {
        assert.equal(this, gl); assert.equal(actualScene, scene); assert.equal(actualCamera, camera)
        renders++; gl.info.render.frame++
      } }
    const factory = new Function('useThree', 'useState', 'useRef', 'useLayoutEffect', 'useFrame', 'performance', 'profile3DEnabled',
      'createVirtualChurchStartupSubmissions', 'reviewStartupSubmissions', 'createVirtualChurchFoyerFloorShaderPreparation',
      'usePreparedReviewAsset', 'document', 'virtualChurchDeferredCanStart', 'VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE', 'VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE',
      `${code}; return InitialSceneShaderPreparation`)
    const component = factory(() => ({ gl, scene, camera, invalidate() { invalidations++ } }),
      () => [true, (value: boolean) => states.push(value)], (value: unknown) => ({ current: value }),
      (effect: () => void | (() => void)) => { const cleanup = effect(); if (typeof cleanup === 'function') cleanups.push(cleanup) },
      (fn: () => void, priority: number) => { callback = fn; priorities.push(priority) }, { now: () => 100 }, false,
      createVirtualChurchStartupSubmissions, submissions, createVirtualChurchFoyerFloorShaderPreparation,
      () => scenario !== 'preparing', { visibilityState: scenario === 'background' ? 'hidden' : 'visible', documentElement: { getAttribute: (key: string) => signals.get(key) ?? null } },
      virtualChurchDeferredCanStart, 'hero', 'character')
    component(); assert.deepEqual(priorities, [1]); callback()
    if (scenario === 'ordinary') {
      assert.equal(renders, 1); callback(); assert.equal(renders, 1, 'no continuous rendering during downloads/introspection')
      const registry = submissions.get(gl)!
      registry.request(gl.info.render.frame); registry.request(gl.info.render.frame)
      callback(); assert.equal(renders, 2, 'two parents share the same real submission')
      callback(); assert.equal(renders, 2)
      signals.set('hero', '101'); signals.set('character', '99'); callback(); assert.deepEqual(states, [], 'stale signal cannot restore before current character')
      signals.set('character', '102'); callback(); assert.deepEqual(states, [false]); assert.equal(submissions.has(gl), false)
      assert.ok(invalidations >= 3)
    } else { assert.equal(renders, 0); assert.deepEqual(states, scenario === 'lost' ? [false] : []) }
    cleanups.forEach(cleanup => cleanup()); assert.equal(scene.children.length, 0); assert.equal(submissions.has(gl), false)
  }
})

const fixture = (steadyState?: { shouldSample: () => boolean; maximumFrames?: number; includeFrameStartTime?: boolean }) => {
  const scene = new Group(), category = new Group(), mesh = new Mesh()
  category.name = 'vc:church'; scene.add(category); category.add(mesh)
  let clock = 0, clocks = 0, fail = false, failDraw = false
  const standard = new MeshStandardMaterial(), depth = new MeshDepthMaterial()
  const renderer = {
    render(target: unknown) {
      assert.equal(this, renderer)
      if (target !== scene) { clock += 7; return }
      renderer.shadowMap.render()
      for (let i = 1; i <= 8; i++) renderer.renderBufferDirect(null, null, null, standard, mesh, i)
      if (fail) throw new Error('render fixture')
    },
    renderBufferDirect(_camera: unknown, _scene: unknown, _geometry: unknown, _material: unknown, _mesh: unknown, delay: number) {
      assert.equal(this, renderer); clock += delay
      if (failDraw) throw new Error('draw fixture')
    },
    shadowMap: { render() { assert.equal(this, renderer.shadowMap); renderer.renderBufferDirect(null, null, null, depth, mesh, 20) } },
  }
  const originals = { render: renderer.render, draw: renderer.renderBufferDirect, shadow: renderer.shadowMap.render }
  const trace = installVirtualChurchStartupPassTrace(renderer as unknown as Pick<WebGLRenderer, 'render' | 'renderBufferDirect' | 'shadowMap'>, scene, () => { clocks++; return clock }, steadyState)
  return { renderer, scene, trace, originals, clocks: () => clocks, advance: (ms: number) => { clock += ms }, setFailure: () => { fail = true }, setDrawFailure: () => { failDraw = true } }
}

test('asset startup tracing excludes stale preparation and stops only after both current-route rendered signals', () => {
  for (const preparedAt of [null, Number.NaN, 99]) assert.equal(virtualChurchStartupAssetsPending(100, preparedAt, null, null), false)
  assert.equal(virtualChurchStartupAssetsPending(Number.NaN, 110, null, null), false)
  for (const [church, character] of [[null, null], ['120', null], [null, '130'], ['99', '130'], ['invalid', '130']]) {
    assert.equal(virtualChurchStartupAssetsPending(100, 110, church, character), true)
  }
  assert.equal(virtualChurchStartupAssetsPending(100, 110, '120', '130'), false)
  assert.equal(virtualChurchStartupAssetsPending(0, 0, null, '0'), true)
  assert.equal(virtualChurchStartupAssetsPending(0, 0, '0', '0'), false)
})

test('whole startup tracing covers preparation gaps but closes only on both current rendered signals', () => {
  for (const route of [NaN, Infinity, -1]) assert.equal(virtualChurchStartupPending(route, null, null), false)
  for (const [church, character] of [[null, null], ['120', null], [null, '130'], ['99', '130'], ['invalid', '130'], ['', '130'], [' ', '130'], ['Infinity', '130']]) {
    assert.equal(virtualChurchStartupPending(100, church, character), true)
  }
  assert.equal(virtualChurchStartupPending(100, '120', '130'), false)
  assert.equal(virtualChurchStartupPending(0, '0', '0'), false)
  let church: string | null = null, character: string | null = null
  const f = fixture({ shouldSample: () => virtualChurchStartupPending(100, church, character), maximumFrames: 180, includeFrameStartTime: true })
  f.advance(150); f.renderer.render(f.scene)
  church = '200'; f.renderer.render(f.scene)
  assert.equal(f.trace.frames.length, 2)
  character = '220'; const clocks = f.clocks()
  f.trace.beginFrame(); f.renderer.render(f.scene); f.renderer.render(new Group())
  assert.equal(f.trace.frames.length, 2); assert.equal(f.clocks(), clocks)
  f.trace.dispose()
})

test('early startup window excludes current preparation but not old-route marks, with zero disabled clock work', () => {
  assert.equal(virtualChurchStartupBeforePrepare(100, null), true)
  assert.equal(virtualChurchStartupBeforePrepare(100, 99), true)
  assert.equal(virtualChurchStartupBeforePrepare(100, 100), false)
  assert.equal(virtualChurchStartupBeforePrepare(100, 101), false)
  assert.equal(virtualChurchStartupBeforePrepare(NaN, null), false)
  assert.equal(virtualChurchStartupBeforePrepare(100, NaN), false)
  let preparedAt: number | null = null
  const f = fixture({ shouldSample: () => virtualChurchStartupBeforePrepare(100, preparedAt), maximumFrames: 180, includeFrameStartTime: true })
  f.advance(120); f.renderer.render(f.scene)
  assert.equal(f.trace.frames[0].startedAtMs, 120)
  preparedAt = 200; const clocks = f.clocks()
  f.trace.beginFrame(); f.renderer.render(f.scene); f.renderer.render(new Group())
  assert.equal(f.clocks(), clocks); assert.equal(f.trace.frames.length, 1)
  f.trace.dispose()
})

test('explicit early frame limit caps both submissions and callbacks at180 and does not add clock reads', () => {
  const f = fixture({ shouldSample: () => true, maximumFrames: 10000, includeFrameStartTime: true })
  for (let frame = 0; frame < 180; frame++) { f.trace.beginFrame(); f.renderer.render(f.scene) }
  assert.equal(f.trace.frames.length, 180); assert.equal(f.trace.callbackFrames.length, 180)
  assert.deepEqual(f.trace.frames.slice(0, 2).map(x => x.startedAtMs), [0, 56])
  const clocks = f.clocks(); f.trace.beginFrame(); f.renderer.render(f.scene); f.renderer.render(new Group())
  assert.equal(f.clocks(), clocks); assert.equal(f.trace.frames.length, 180)
  f.trace.dispose()
  const ordinary = fixture(); ordinary.renderer.render(ordinary.scene)
  assert.equal(ordinary.trace.frames[0].startedAtMs, undefined)
  const timestamped = fixture({ shouldSample: () => true, includeFrameStartTime: true })
  timestamped.renderer.render(timestamped.scene)
  assert.equal(timestamped.clocks(), ordinary.clocks(), 'timestamp uses the existing render start clock, not a second read')
  timestamped.trace.dispose()
  ordinary.trace.dispose()
})

test('actual probe startup effect enables early tracing only on explicit request and cleans up its window', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  const file = ts.createSourceFile('probe.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let effect: ts.Node | undefined
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(file) === 'useLayoutEffect'
      && node.arguments[0]?.getText(file).includes("get('profile3dStartupPasses')")) effect = node.arguments[0]
    ts.forEachChild(node, visit)
  }
  visit(file); assert.ok(effect)
  const code = ts.transpileModule(`const effect = ${effect.getText(file)}`, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText
  const run = new Function('env', `const { window, URLSearchParams, traceStartupFramesRef, gl, scene,
    performance, installVirtualChurchStartupPassTrace, virtualChurchStartupBeforePrepare,
    virtualChurchStartupAssetsPending, virtualChurchStartupPending, routeStartedAt, document, VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE,
    VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE, startupPassPhaseRef, startupPassTimingsRef } = env;
    ${code}; return effect()`) as (env: object) => (() => void) | undefined
  let installations = 0, disposed = false, mark: number | null = null
  let options: { shouldSample: () => boolean; maximumFrames?: number; includeFrameStartTime?: boolean } | undefined
  const phaseRef = { current: null as string | null }, framesRef = { current: null as unknown }
  const env = {
    window: { location: { search: '' } }, URLSearchParams, traceStartupFramesRef: { current: true },
    gl: {}, scene: new Group(), routeStartedAt: 100,
    performance: { now: () => 200, getEntriesByName: () => mark === null ? [] : [{ startTime: mark }] },
    document: { documentElement: { getAttribute: (_name: string): string | null => null } },
    VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE: 'ready', VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE: 'character-ready',
    virtualChurchStartupBeforePrepare, virtualChurchStartupAssetsPending, virtualChurchStartupPending,
    startupPassPhaseRef: phaseRef, startupPassTimingsRef: framesRef,
    installVirtualChurchStartupPassTrace: (_gl: unknown, _scene: unknown, _now: unknown, selected: typeof options) => {
      installations++; options = selected; return { frames: [], dispose: () => { disposed = true } }
    },
  }
  assert.equal(run(env), undefined); assert.equal(installations, 0)
  env.window.location.search = '?profile3dStartupPasses=early'
  env.traceStartupFramesRef.current = false
  assert.equal(run(env), undefined); assert.equal(installations, 0)
  env.traceStartupFramesRef.current = true
  const cleanup = run(env)!
  assert.equal(installations, 1); assert.equal(phaseRef.current, 'early')
  assert.equal(options?.maximumFrames, 180); assert.equal(options?.includeFrameStartTime, true)
  assert.equal(options?.shouldSample(), true); mark = 99; assert.equal(options?.shouldSample(), true)
  mark = 200; assert.equal(options?.shouldSample(), false)
  cleanup(); assert.equal(disposed, true); assert.equal(phaseRef.current, null); assert.equal(framesRef.current, null)
  for (const phase of ['1', 'assets']) {
    env.window.location.search = `?profile3dStartupPasses=${phase}`
    run(env)!(); assert.equal(options?.maximumFrames, undefined); assert.equal(options?.includeFrameStartTime, undefined)
  }
  env.window.location.search = '?profile3dStartupPasses=all'; disposed = false
  const allCleanup = run(env)!
  assert.equal(phaseRef.current, 'all'); assert.equal(options?.maximumFrames, 180)
  assert.equal(options?.includeFrameStartTime, true)
  mark = null; assert.equal(options?.shouldSample(), true)
  mark = 200; assert.equal(options?.shouldSample(), true, 'must not stop at preparation')
  env.document.documentElement.getAttribute = name => name === 'ready' ? '220' : '99'
  assert.equal(options?.shouldSample(), true, 'stale character cannot close a new route')
  env.document.documentElement.getAttribute = () => '230'; assert.equal(options?.shouldSample(), false)
  allCleanup(); assert.equal(disposed, true); assert.equal(phaseRef.current, null); assert.equal(framesRef.current, null)
})

test('startup draw tracing reports program creation without querying driver internals', () => {
  const scene = new Group(), material = new MeshStandardMaterial(), mesh = new Mesh()
  const programs: unknown[] = [{}]
  const renderer = {
    info: { programs }, shadowMap: { render() {} },
    renderBufferDirect(..._args: unknown[]) { programs.push({}) },
    render(_target: unknown) { this.renderBufferDirect(null, null, null, material, mesh) },
  }
  const trace = installVirtualChurchStartupPassTrace(renderer as unknown as WebGLRenderer, scene, () => 0)
  renderer.render(scene)
  assert.equal(trace.frames[0].programsBefore, 1)
  assert.equal(trace.frames[0].programsAfter, 2)
  assert.equal(trace.frames[0].slowDraws[0].programsAdded, 1)
  trace.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); material.dispose()
})

test('startup surface roles only expose fixed wordmark, courtyard and renderer-background labels', () => {
  for (const [name, role] of [['vc:church-wordmark', 'wordmark'], ['vc:foyer-courtyard-photo-view', 'courtyard-view'], ['vc:foyer-side-courtyard-photo-view', 'courtyard-view']]) {
    assert.equal(virtualChurchStartupSurfaceRole({ name }, { name: '' }), role)
  }
  assert.equal(virtualChurchStartupSurfaceRole({ name: '' }, { name: 'BackgroundCubeMaterial' }), 'sky-background')
  assert.equal(virtualChurchStartupSurfaceRole({ name: '' }, { name: 'BackgroundMaterial' }), 'sky-background')
  assert.equal(virtualChurchStartupSurfaceRole({ name: '' }, { name: 'CubemapFromEquirect' }), 'sky-conversion')
  assert.equal(virtualChurchStartupSurfaceRole({ name: 'private-file-or-person-name' }, { name: 'private-material-name' }), 'other')
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /<mesh name="vc:church-wordmark" position=\{position\}/)
})

test('explicit texture tracing preserves GL calls, counts CPU spans, and stops at the frame cap', () => {
  const scene = new Group(), mesh = new Mesh(), material = new MeshStandardMaterial()
  let clock = 0, clockReads = 0
  const forwarded: unknown[][] = []
  const context = {
    texImage2D(...args: unknown[]) { assert.equal(this, context); forwarded.push(args); clock += 12; return 'uploaded' },
    texSubImage2D(...args: unknown[]) { assert.equal(this, context); forwarded.push(args); clock += 3 },
    generateMipmap(...args: unknown[]) { assert.equal(this, context); forwarded.push(args); clock += 5 },
    texStorage2D(...args: unknown[]) { assert.equal(this, context); forwarded.push(args); clock += 6 },
    texStorage3D(...args: unknown[]) { assert.equal(this, context); forwarded.push(args); clock += 2 },
  }
  const originals = { ...context }
  const renderer = {
    getContext: () => context, shadowMap: { render() {} },
    renderBufferDirect(..._args: unknown[]) {
      assert.equal(context.texImage2D('target', 0, mesh), 'uploaded')
      context.texSubImage2D('target', 0, material); context.generateMipmap('target')
      context.texStorage2D('storage', 1); context.texStorage3D('storage', 2)
    },
    render(_target: unknown) { this.renderBufferDirect(null, null, null, material, mesh) },
  }
  const trace = installVirtualChurchStartupPassTrace(renderer as unknown as WebGLRenderer, scene,
    () => { clockReads++; return clock }, undefined, true)
  context.texImage2D('outside')
  assert.equal(clockReads, 0)
  for (let run = 0; run < 3; run++) renderer.render(scene)
  assert.deepEqual(trace.frames.map(frame => frame.textureCpu), Array.from({ length: 3 }, () => ({ uploadMs: 15, mipmapMs: 5, storageMs: 8, uploads: 2, mipmaps: 1, storages: 2 })))
  assert.deepEqual(forwarded[1], ['target', 0, mesh])
  assert.deepEqual(forwarded[2], ['target', 0, material])
  const before = clockReads
  renderer.render(scene); assert.equal(clockReads, before)
  trace.dispose()
  assert.equal(context.texImage2D, originals.texImage2D)
  assert.equal(context.texSubImage2D, originals.texSubImage2D)
  assert.equal(context.generateMipmap, originals.generateMipmap)
  assert.equal(context.texStorage2D, originals.texStorage2D)
  assert.equal(context.texStorage3D, originals.texStorage3D)
  mesh.geometry.dispose(); mesh.material.dispose(); material.dispose()
})

test('texture diagnostic propagates failures, restores only its own hooks, and is absent by default', () => {
  const scene = new Group(), mesh = new Mesh(), material = new MeshStandardMaterial()
  let clock = 0, contextRequests = 0
  const context = { texImage2D(..._args: unknown[]) { assert.equal(this, context); clock += 4; throw new Error('upload fixture') }, generateMipmap() {} }
  const original = context.texImage2D
  const renderer = {
    getContext() { contextRequests++; return context }, shadowMap: { render() {} },
    renderBufferDirect(..._args: unknown[]) { context.texImage2D('target') },
    render(_target: unknown) { this.renderBufferDirect(null, null, null, material, mesh) },
  }
  const regular = installVirtualChurchStartupPassTrace(renderer as unknown as WebGLRenderer, scene, () => clock)
  assert.equal(contextRequests, 0); assert.equal(context.texImage2D, original)
  assert.throws(() => renderer.render(scene), /upload fixture/)
  assert.equal(regular.frames[0].textureCpu, undefined); regular.dispose()
  assert.equal(regular.frames[0].submissionCpu, undefined)
  const trace = installVirtualChurchStartupPassTrace(renderer as unknown as WebGLRenderer, scene, () => clock, undefined, true)
  assert.throws(() => renderer.render(scene), /upload fixture/)
  assert.equal(trace.frames[0].failed, true)
  assert.deepEqual(trace.frames[0].textureCpu, { uploadMs: 4, mipmapMs: 0, storageMs: 0, uploads: 1, mipmaps: 0, storages: 0 })
  const laterHook = () => 'later hook'
  context.texImage2D = laterHook as typeof context.texImage2D
  trace.dispose(); assert.equal(context.texImage2D, laterHook)
  context.texImage2D = original
  mesh.geometry.dispose(); mesh.material.dispose(); material.dispose()
})

test('explicit submission tracing forwards all selected GL APIs and totals CPU spans without new calls', () => {
  const scene = new Group(), mesh = new Mesh(), material = new MeshStandardMaterial()
  let clock = 0, clockReads = 0
  const forwarded: Array<{ name: string; args: unknown[] }> = []
  const context: Record<string, (...args: unknown[]) => unknown> = {}
  const durations: Record<string, number> = {
    useProgram: 6,
    drawArrays: 1, drawElements: 2, drawArraysInstanced: 3, drawElementsInstanced: 4,
    bufferData: 0.06, bufferSubData: 0.06,
    getProgramParameter: 12, getProgramInfoLog: 1, getShaderInfoLog: 2,
    getActiveUniform: 3, getUniformLocation: 4, getActiveAttrib: 5, getAttribLocation: 6,
    uniformMatrix4fv: 0.2, uniform1i: 0.2, bindTexture: 0.2, getParameter: 0.2,
  }
  const result = { result: 'fixture' }, argument = { privateName: 'not diagnostic data' }
  for (const [name, duration] of Object.entries(durations)) {
    context[name] = function (...args) {
      assert.equal(this, context); forwarded.push({ name, args }); clock += duration; return result
    }
  }
  context.texImage2D = () => { throw new Error('unselected upload must not run') }
  const originals = { ...context }
  const renderer = {
    getContext: () => context, shadowMap: { render() {} },
    renderBufferDirect(..._args: unknown[]) {
      for (const name of Object.keys(durations)) assert.equal(context[name](argument, 4, null), result)
    },
    render(_target: unknown) { this.renderBufferDirect(null, null, null, material, mesh) },
  }
  const trace = installVirtualChurchStartupPassTrace(renderer as unknown as WebGLRenderer, scene,
    () => { clockReads++; return clock }, undefined, false, true)
  assert.equal(context.texImage2D, originals.texImage2D)
  context.useProgram('outside'); assert.equal(clockReads, 0)
  for (let run = 0; run < 3; run++) renderer.render(scene)
  for (const frame of trace.frames) {
    assert.equal(frame.textureCpu, undefined)
    assert.deepEqual(frame.submissionCpu, {
      programUseMs: 6, drawMs: 10, bufferUploadMs: 0.1, programQueryMs: 33, uniformMs: 0.4, stateMs: 0.4,
      programUses: 1, draws: 4, bufferUploads: 2, programQueries: 7, uniforms: 2, stateCalls: 2,
      slowCalls: [
        { api: 'getProgramParameter', durationMs: 12, programRole: 'other' }, { api: 'useProgram', durationMs: 6 },
        { api: 'getAttribLocation', durationMs: 6 }, { api: 'getActiveAttrib', durationMs: 5 },
        { api: 'drawElementsInstanced', durationMs: 4 },
      ],
    })
    assert.equal(JSON.stringify(frame).includes('privateName'), false)
  }
  assert.equal(forwarded.length, 1 + 3 * Object.keys(durations).length)
  assert.deepEqual(forwarded[1], { name: 'useProgram', args: [argument, 4, null] })
  const before = clockReads; renderer.render(scene); assert.equal(clockReads, before)
  trace.dispose()
  for (const name of Object.keys(originals)) assert.equal(context[name], originals[name])
  mesh.geometry.dispose(); mesh.material.dispose(); material.dispose()
})

test('submission tracing propagates errors and restores only its own wrappers', () => {
  const scene = new Group(), mesh = new Mesh(), material = new MeshStandardMaterial()
  let clock = 0
  const context = {
    drawElements(..._args: unknown[]) { assert.equal(this, context); clock += 7; throw new Error('draw fixture') },
    useProgram() {},
  }
  const originals = { ...context }
  const renderer = {
    getContext: () => context, shadowMap: { render() {} },
    renderBufferDirect(..._args: unknown[]) { context.drawElements('target') },
    render(_target: unknown) { this.renderBufferDirect(null, null, null, material, mesh) },
  }
  const trace = installVirtualChurchStartupPassTrace(renderer as unknown as WebGLRenderer, scene, () => clock, undefined, false, true)
  assert.throws(() => renderer.render(scene), /draw fixture/)
  assert.equal(trace.frames[0].failed, true)
  assert.equal(trace.frames[0].submissionCpu?.drawMs, 7)
  assert.equal(trace.frames[0].submissionCpu?.draws, 1)
  const laterHook = () => {}; context.useProgram = laterHook
  trace.dispose(); trace.dispose()
  assert.equal(context.useProgram, laterHook); assert.equal(context.drawElements, originals.drawElements)
  mesh.geometry.dispose(); mesh.material.dispose(); material.dispose()
})

test('texture and submission opt-ins are independent and work with partial GL API fixtures', () => {
  const scene = new Group()
  let clock = 0
  const context = { texImage2D() { clock += 2 }, drawArrays() { clock += 3 } }
  const renderer = { getContext: () => context, shadowMap: { render() {} }, renderBufferDirect() {},
    render(_target: unknown) { context.texImage2D(); context.drawArrays() } }
  for (const [texture, submission] of [[true, false], [false, true], [true, true], [false, false]]) {
    const trace = installVirtualChurchStartupPassTrace(renderer as unknown as WebGLRenderer, scene, () => clock, undefined, texture, submission)
    renderer.render(scene)
    assert.equal(trace.frames[0].textureCpu?.uploadMs, texture ? 2 : undefined)
    assert.equal(trace.frames[0].submissionCpu?.drawMs, submission ? 3 : undefined)
    trace.dispose()
  }
})

test('state-query tracing identifies only the fixed anisotropy enum and never records arbitrary parameters', () => {
  const scene = new Group()
  let clock = 0
  const context = { getParameter(..._args: unknown[]) { clock += 7; return 8 } }
  const renderer = { getContext: () => context, shadowMap: { render() {} }, renderBufferDirect() {},
    render(_target: unknown) { context.getParameter(0x84FF); context.getParameter('private parameter'); context.getParameter(0x0BA2) } }
  const trace = installVirtualChurchStartupPassTrace(renderer as unknown as WebGLRenderer, scene, () => clock, undefined, false, true)
  renderer.render(scene)
  assert.deepEqual(trace.frames[0].submissionCpu?.slowCalls, [
    { api: 'getParameter', durationMs: 7, parameter: 'anisotropy-limit' },
    { api: 'getParameter', durationMs: 7, parameter: 'other' },
    { api: 'getParameter', durationMs: 7, parameter: 'other' },
  ])
  assert.equal(JSON.stringify(trace.frames[0]).includes('private parameter'), false)
  trace.dispose()
})

test('program queries distinguish renderer sky conversion/background without exposing arbitrary shader names', () => {
  const scene = new Group(), cube = {}, background = {}, privateProgram = {}
  let clock = 0
  const context = { getProgramInfoLog(_program: unknown) { clock += 1; return 'not retained' } }
  const renderer = { getContext: () => context, shadowMap: { render() {} }, renderBufferDirect() {},
    info: { programs: [{ program: cube, name: 'CubemapFromEquirect' }, { program: background, name: 'BackgroundCubeMaterial' }, { program: privateProgram, name: 'private-shader-name' }] },
    render(_target: unknown) { context.getProgramInfoLog(cube); context.getProgramInfoLog(background); context.getProgramInfoLog(privateProgram) } }
  const trace = installVirtualChurchStartupPassTrace(renderer as unknown as WebGLRenderer, scene, () => clock, undefined, false, true)
  renderer.render(scene)
  assert.deepEqual(trace.frames[0].submissionCpu?.slowCalls.map(call => call.programRole), ['sky-conversion', 'sky-background', 'other'])
  assert.equal(JSON.stringify(trace.frames[0]).includes('private-shader-name'), false)
  assert.equal(JSON.stringify(trace.frames[0]).includes('not retained'), false)
  trace.dispose()
})

test('fixed DPR requires explicit profiling opt-in and uses the existing quality ceiling, never a lower budget', () => {
  assert.equal(virtualChurchDiagnosticDpr(1.1, true, 'budget-max'), 1.1)
  assert.equal(virtualChurchDiagnosticDpr(1, true, 'budget-max'), 1)
  assert.deepEqual(virtualChurchDiagnosticDpr(1.1, false, 'budget-max'), [1, 1.1])
  for (const request of [null, '', '1', '0.5', '2', 'unknown']) {
    assert.deepEqual(virtualChurchDiagnosticDpr(1.1, true, request), [1, 1.1])
  }
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes("virtualChurchDiagnosticDpr(performanceCfg.maxDevicePixelRatio, profile3DEnabled, profile3DSearchParams.get('profile3dDpr'))"))
})

test('bounds three actual scene frames and five slow draws, separating shadow CPU submission', () => {
  const f = fixture()
  for (let i = 0; i < 3; i++) f.renderer.render(f.scene)
  assert.equal(f.trace.frames.length, 3)
  assert.deepEqual(f.trace.frames[0], { frame: 1, durationMs: 56, shadowMs: 20, drawCount: 9, failed: false,
    slowDraws: [
      { durationMs: 20, pass: 'shadow', category: 'church', material: 'MeshDepthMaterial', surface: 'other' },
      ...[8,7,6,5].map(durationMs => ({ durationMs, pass: 'scene', category: 'church', material: 'MeshStandardMaterial', surface: 'other' })),
    ] })
  const clocks = f.clocks(); f.renderer.render(f.scene)
  assert.equal(f.clocks(), clocks); assert.equal(f.trace.frames.length, 3)
  f.trace.dispose()
})

test('unrelated scenes and calls outside a scene frame delegate without timing', () => {
  const f = fixture()
  f.renderer.render(new Group()); f.renderer.shadowMap.render()
  assert.equal(f.clocks(), 0); assert.equal(f.trace.frames.length, 0)
  f.trace.dispose()
})

test('steady CPU tracing waits for sampling, bounds 60 scene frames and stops measuring secondary scenes at the cap', () => {
  let sampling = false
  const f = fixture({ shouldSample: () => sampling })
  f.renderer.render(f.scene); f.renderer.render(new Group())
  assert.equal(f.clocks(), 0); assert.equal(f.trace.frames.length, 0)
  sampling = true
  for (let frame = 0; frame < 60; frame++) { f.renderer.render(f.scene); f.renderer.render(new Group()) }
  assert.equal(f.trace.frames.length, 60)
  assert.deepEqual(f.trace.frames[0].drawCpuMsByCategory, { church: 56 })
  assert.equal(f.trace.frames[0].otherSceneCpuMs, 7)
  const clocks = f.clocks()
  f.renderer.render(f.scene); f.renderer.render(new Group())
  assert.equal(f.clocks(), clocks)
  assert.equal(f.trace.frames[59].otherSceneCpuMs, 7)
  f.trace.dispose()
})

test('steady CPU trace resets an interrupted window and respects disabled sampling', () => {
  let sampling = true
  const f = fixture({ shouldSample: () => sampling })
  f.renderer.render(f.scene); assert.equal(f.trace.frames.length, 1)
  sampling = false; const clocks = f.clocks()
  f.renderer.render(f.scene); f.renderer.render(new Group()); assert.equal(f.clocks(), clocks)
  f.trace.reset(); assert.equal(f.trace.frames.length, 0)
  sampling = true; f.renderer.render(f.scene)
  assert.equal(f.trace.frames[0].frame, 1)
  f.trace.dispose()
})

test('steady callback frame keeps pre-scene work, repeated scene passes and auxiliary draws separate', () => {
  const f = fixture({ shouldSample: () => true })
  f.trace.beginFrame(); f.advance(3)
  f.renderer.render(f.scene); f.renderer.renderBufferDirect(null, null, null, null, null, 2)
  f.renderer.render(f.scene); f.renderer.render(new Group())
  f.renderer.render(f.scene); f.renderer.renderBufferDirect(null, null, null, null, null, 5)
  assert.deepEqual(f.trace.frames.map(record => [record.callbackFrame, record.scenePass]), [[1, 1], [1, 2], [1, 3]])
  assert.deepEqual(f.trace.callbackFrames, [{ frame: 1, beforeFirstSceneMs: 3, sceneCpuMs: 168,
    otherSceneCpuMs: 7, auxiliaryDrawCpuMs: 7, callbackToLastSubmissionMs: 185, failed: false }])
  f.trace.beginFrame(); f.advance(1); f.renderer.render(f.scene)
  assert.equal(f.trace.frames[3].scenePass, 1)
  assert.equal(f.trace.callbackFrames[1].beforeFirstSceneMs, 1)
  f.trace.dispose()
})

test('callback timing is opt-in, resets with the sample and never includes a disabled or capped frame', () => {
  const startup = fixture(); startup.trace.beginFrame(); startup.renderer.render(startup.scene)
  assert.deepEqual(startup.trace.callbackFrames, [])
  assert.equal(startup.trace.frames[0].callbackFrame, undefined); startup.trace.dispose()
  let sampling = false; const f = fixture({ shouldSample: () => sampling })
  f.trace.beginFrame(); f.advance(100); f.renderer.render(f.scene)
  assert.deepEqual(f.trace.callbackFrames, [])
  sampling = true; f.trace.beginFrame(); f.advance(2); f.renderer.render(f.scene)
  f.trace.reset(); assert.deepEqual(f.trace.callbackFrames, [])
  for (let i = 0; i < 60; i++) { f.trace.beginFrame(); f.renderer.render(f.scene) }
  const clocks = f.clocks(); f.trace.beginFrame(); f.renderer.render(f.scene)
  f.renderer.render(new Group()); f.renderer.renderBufferDirect(null, null, null, null, null, 1)
  assert.equal(f.clocks(), clocks); assert.equal(f.trace.callbackFrames.length, 60)
  f.trace.dispose()
})

test('failed scene keeps failure evidence in its callback frame and disposal retires timing', () => {
  const f = fixture({ shouldSample: () => true }); f.trace.beginFrame(); f.setFailure()
  assert.throws(() => f.renderer.render(f.scene), /render fixture/)
  assert.equal(f.trace.callbackFrames[0].failed, true)
  f.trace.dispose(); const clocks = f.clocks(); f.trace.beginFrame()
  assert.equal(f.clocks(), clocks)
})

test('direct auxiliary exception propagates and cannot become a successful callback frame', () => {
  const f = fixture({ shouldSample: () => true }); f.trace.beginFrame(); f.renderer.render(f.scene)
  f.setDrawFailure()
  assert.throws(() => f.renderer.renderBufferDirect(null, null, null, null, null, 2), /draw fixture/)
  assert.equal(f.trace.callbackFrames[0].failed, true)
  assert.equal(f.trace.callbackFrames[0].auxiliaryDrawCpuMs, 2)
  f.trace.dispose()
})

test('steady CPU probe is explicit, discarded on sample restart and marked as instrumentation rather than FPS-gate evidence', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  assert.match(source, /get\('profile3dCpu'\) !== '1'/)
  assert.match(source, /steadyCpuTraceRef.current\?\.reset\(\)/)
  assert.match(source, /cpuSubmissionDiagnostics:/)
  assert.match(source, /trace.dispose\(\); steadyCpuTraceRef.current = null/)
  assert.match(source, /useFrame\(\(\) => trace.current\?\.beginFrame\(\), -100\)/)
  assert.match(source, /get\('profile3dCpu'\) === '1'\s*\? <VirtualChurchCpuFrameStart trace=\{steadyCpuTraceRef\} \/>/)
  assert.match(source, /callbackFrames: steadyCpuTraceRef.current.callbackFrames/)
})

test('render errors preserve thrown error and clear active tracing', () => {
  const f = fixture(); f.setFailure()
  assert.throws(() => f.renderer.render(f.scene), /render fixture/)
  assert.equal(f.trace.frames[0].failed, true)
  const clocks = f.clocks(); f.renderer.shadowMap.render()
  assert.equal(f.clocks(), clocks)
  f.trace.dispose()
})

test('dispose restores owned methods, is idempotent and preserves a newer wrapper', () => {
  const f = fixture(), later = () => {}
  f.renderer.render = later
  f.trace.dispose(); f.trace.dispose()
  assert.equal(f.renderer.render, later)
  assert.equal(f.renderer.renderBufferDirect, f.originals.draw)
  assert.equal(f.renderer.shadowMap.render, f.originals.shadow)
  const clocks = f.clocks(); f.renderer.render(f.scene)
  assert.equal(f.clocks(), clocks)
})

test('probe requires explicit profiling query and keeps ordinary schema payload unchanged', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  assert.match(source, /!traceStartupFramesRef.current \|\| \(phase !== '1' && phase !== 'assets' && phase !== 'early' && phase !== 'all'\)/)
  assert.match(source, /trace.dispose\(\); startupPassTimingsRef.current = null; startupPassPhaseRef.current = null/)
  assert.match(source, /startupPassTimingPhase: startupPassPhaseRef.current/)
  assert.match(source, /get\('profile3dTextureUploads'\) === '1'/)
  assert.match(source, /get\('profile3dDrawCalls'\) === '1'/)
})

test('normal V3 arriving church and avatar reuse cancellable preparation, preserving V2/review and readiness', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const prepareChurchShaders = visualVersion === 'v3' \|\| \(initialCharacterReview !== null && !perfConfig.postProcessing\)/)
  assert.match(source, /usePreparedReviewAsset\(model, prepareChurchShaders, true\)/)
  assert.match(source, /const prepareCharacterShaders = config3D.visualVersion === 'v3' \|\| \(characterReview !== null && !perfConfig.postProcessing\)/)
  assert.match(source, /usePreparedReviewAsset\(model, prepareCharacterShaders, false, true, 'character', config3D.visualVersion === 'v3' \? 2 : 1\)/)
  assert.match(source, /const avatarReady = prepared && poseReady && appearanceReady/)
  assert.match(source, /useVirtualChurchRenderedAssetSignal\(model, VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE, prepared && \(visualVersion !== 'v3' \|\| foyerPrepared\)\)/)
  assert.match(source, /if \(!scene.environment \|\| \(requireSubmittedFrame && gl.info.render.frame <= frameAtMount\)\)/)
  assert.match(source, /const cancelWarmup = scheduleVirtualChurchShaderWarmup/)
  assert.match(source, /return \(\) => \{\s+cancelWarmup\(\)\s+frameQueue.cancelFrame\(skyReleaseFrame\)/)
})
