import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'
import { Group, Mesh, MeshPhysicalMaterial, BackSide, DoubleSide, CanvasTexture, Texture, WebGLRenderTarget, EquirectangularReflectionMapping, SRGBColorSpace } from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'
import { createVirtualChurchFoyerFloorShaderPreparation } from '../../cloudflare/alife-app/src/views/virtualChurchFoyerContact.ts'
import { createVirtualChurchStartupSubmissions, virtualChurchDeferredCanStart } from '../../cloudflare/alife-app/src/views/virtualChurchLoadingContract.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const loadingContractPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchLoadingContract.ts',
)
const resourceLeaseContractPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchResourceLeaseContract.ts',
)
const sharedImageBitmapLoaderPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchSharedImageBitmapLoader.ts',
)

const [viewSource, loadingContractSource, resourceLeaseContractSource, sharedImageBitmapLoaderSource] = await Promise.all([
  readFile(viewPath, 'utf8'),
  readFile(loadingContractPath, 'utf8'),
  readFile(resourceLeaseContractPath, 'utf8'),
  readFile(sharedImageBitmapLoaderPath, 'utf8'),
])

const errors = []
const requireSource = (fragment, label = 'Virtual Church view') => {
  if (!viewSource.includes(fragment)) {
    errors.push(`${label}: missing ${JSON.stringify(fragment)}`)
  }
}

const transpiled = ts.transpileModule(loadingContractSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: loadingContractPath,
  reportDiagnostics: true,
})
if ((transpiled.diagnostics ?? []).length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(
    transpiled.diagnostics,
    {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    },
  )
  throw new Error(`Unable to transpile loading contract:\n${formatted}`)
}
const contractUrl =
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const contract = await import(contractUrl)
const performanceContractSource = await readFile(resolve(appRoot, 'src', 'views', 'virtualChurchPerformanceContract.ts'), 'utf8')
const performanceContractCode = ts.transpileModule(performanceContractSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
}).outputText
const performanceContract = await import(`data:text/javascript;base64,${Buffer.from(performanceContractCode).toString('base64')}`)

const renderedReadyCases = [
  { name: 'mount is not ready', mount: 10, current: 10, visible: true, ready: false },
  { name: 'next completed scene submission', mount: 10, current: 11, visible: true, ready: true },
  { name: 'fresh renderer', mount: 0, current: 1, visible: true, ready: true },
  { name: 'hidden document', mount: 10, current: 20, visible: false, ready: false },
  { name: 'restored context counter', mount: 10, current: 1, visible: true, ready: false },
  { name: 'not mounted', mount: Number.NaN, current: 11, visible: true, ready: false },
  { name: 'invalid renderer counter', mount: 10, current: Infinity, visible: true, ready: false },
]
for (const { name, mount, current, visible, ready } of renderedReadyCases) {
  if (contract.virtualChurchAssetHasRendered(mount, current, visible) !== ready) {
    errors.push(`rendered asset readiness: ${name}`)
  }
}
for (const fragment of [
  "useVirtualChurchRenderedAssetSignal(model, VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE, prepared && (visualVersion !== 'v3' || foyerPrepared))",
  'useVirtualChurchRenderedAssetSignal(model, VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE, avatarReady)',
  'mountedFrameRef.current = gl.info.render.frame',
  'if (!pendingRef.current || gl.getContext().isContextLost()) return',
]) {
  requireSource(fragment, 'Post-render asset readiness')
}
const playerAvatarStart = viewSource.indexOf('const DeferredPlayerAvatar =')
const v3AvatarStart = viewSource.indexOf("if (config3D.visualVersion === 'v3')", playerAvatarStart)
const legacyAvatarStart = viewSource.indexOf('if (!loadDetailedAvatar) return null', v3AvatarStart)
const v3AvatarSource = playerAvatarStart >= 0 && v3AvatarStart > playerAvatarStart && legacyAvatarStart > v3AvatarStart
  ? viewSource.slice(v3AvatarStart, legacyAvatarStart)
  : ''
if (!v3AvatarSource.includes('<GateAHeroAssetBoundary')
  || !v3AvatarSource.includes('fallback={null}')
  || !v3AvatarSource.includes('<Suspense fallback={null}>')
  || !viewSource.includes('const avatarReady = prepared && poseReady && appearanceReady')
  || !viewSource.includes('visible={avatarReady}')) {
  errors.push('V3 avatar must remain hidden until its full model, pose and appearance are ready, without a temporary stand-in')
}
for (const fragment of [
  "usePreparedReviewAsset(model, prepareCharacterShaders, false, true, 'character', config3D.visualVersion === 'v3' ? 2 : 1)",
  'usePreparedReviewAsset(model, initialCharacterReview !== null && !perfConfig.postProcessing)',
  "const prepareChurchShaders = visualVersion === 'v3' || (initialCharacterReview !== null && !perfConfig.postProcessing)",
  'usePreparedReviewAsset(model, prepareChurchShaders, true)',
  "const prepareCharacterShaders = config3D.visualVersion === 'v3' || (characterReview !== null && !perfConfig.postProcessing)",
  "usePreparedReviewAsset(model, prepareCharacterShaders, false, true, 'character', config3D.visualVersion === 'v3' ? 2 : 1)",
  'const materials = gl.compile(object, camera, scene)',
  "compile(warmSceneTransmission ? scene : model, 'transmission')",
  'onReady(prepared)',
  'requestFrame: callback => frameQueue.requestFrame(callback, () =>',
  'programs === null && !!scene.environment',
  'cancelFrame: frameQueue.cancelFrame',
  'reviewShaderFrameQueues.get(gl)',
  "visualVersion !== 'v3' && !prepared && <VehicleFallback position={position} rotation={rotation[1]} color={fallbackColor}",
  "<Suspense fallback={visualVersion === 'v3' ? null : <VehicleFallback position={position} rotation={rotation} color={fallbackColor} />}",
  ") : visualVersion !== 'v3' ? (\n        <>\n          <VehicleFallback position={[-24.4, 0, 0.55]}",
  "context.getExtension('KHR_parallel_shader_compile')",
  'if (!scene.environment || (requireSubmittedFrame && gl.info.render.frame <= frameAtMount))',
  'gl.setRenderTarget(previousTarget, previousFace, previousMip)',
  'target.dispose()',
  'extension.COMPLETION_STATUS_KHR',
  'else program.getUniforms()',
  'performance.now() - sliceStartedAt >= 8',
  'visible={prepared}',
  'const cancelWarmup = scheduleVirtualChurchShaderWarmup({',
  'cancelWarmup()',
]) requireSource(fragment, 'Cancellable shader warm-up')

const sharedQueueCases = ['round-robin', 'cancel-one', 'cancel-all-and-restart', 'context-loss', 'timeout']
for (const scenario of sharedQueueCases) {
  const nativeFrames = new Map()
  let frameId = 0
  let time = 0
  let lost = false
  const trace = []
  const finished = []
  const queue = contract.createVirtualChurchShaderFrameQueue(
    callback => { nativeFrames.set(++frameId, callback); return frameId },
    id => nativeFrames.delete(id),
  )
  const start = name => {
    let steps = 0
    return contract.scheduleVirtualChurchShaderWarmup({
      ...queue,
      now: () => time,
      contextLost: () => lost,
      step: () => { trace.push(name); return ++steps === 2 },
      finish: () => finished.push(name),
      onError: error => { throw error },
    })
  }
  const cancelA = start('hero')
  const cancelB = start('sedan')
  const cancelC = start('suv')
  if (nativeFrames.size !== 1) errors.push(`${scenario}: concurrent assets must share one native frame`)
  if (scenario === 'cancel-one') cancelB()
  if (scenario === 'cancel-all-and-restart') {
    const staleCallback = [...nativeFrames.values()][0]
    cancelA(); cancelB(); cancelC()
    if (nativeFrames.size !== 0) errors.push('empty shader queue must cancel its native frame')
    start('van')
    staleCallback()
    if (trace.length !== 0 || nativeFrames.size !== 1) errors.push('cancelled native callback must not consume a new queue job')
  }
  if (scenario === 'context-loss') lost = true
  if (scenario === 'timeout') time = contract.VIRTUAL_CHURCH_SHADER_WARMUP_TIMEOUT_MS
  for (let tick = 0; nativeFrames.size && tick < 12; tick += 1) {
    const callbacks = [...nativeFrames.values()]
    nativeFrames.clear()
    const before = trace.length
    callbacks.forEach(callback => callback())
    if (trace.length - before > 1 || nativeFrames.size > 1) errors.push(`${scenario}: more than one asset slice per native frame`)
  }
  const expected = scenario === 'round-robin' ? ['hero', 'sedan', 'suv', 'hero', 'sedan', 'suv']
    : scenario === 'cancel-one' ? ['hero', 'suv', 'hero', 'suv']
    : scenario === 'cancel-all-and-restart' ? ['van', 'van'] : []
  const expectedFinished = scenario === 'context-loss' ? []
    : scenario === 'timeout' ? ['hero', 'sedan', 'suv'] : expected.slice(expected.length / 2)
  if (JSON.stringify(trace) !== JSON.stringify(expected)
    || JSON.stringify(finished) !== JSON.stringify(expectedFinished)
    || nativeFrames.size !== 0) errors.push(`${scenario}: unexpected shared shader queue lifecycle`)
}

const warmupCases = ['complete', 'pending', 'timeout', 'cancel', 'context-loss', 'error', 'strict-mode-replay']
for (const scenario of warmupCases) {
  let time = 0
  let nextFrame = 0
  let lost = false
  let steps = 0
  let finished = 0
  let failures = 0
  let ready = scenario === 'complete'
  const frames = new Map()
  const options = {
    step: () => { steps += 1; if (scenario === 'error') throw new Error('driver fixture'); return ready },
    finish: () => { finished += 1 },
    onError: () => { failures += 1 },
    contextLost: () => lost,
    now: () => time,
    requestFrame: (callback) => { frames.set(++nextFrame, callback); return nextFrame },
    cancelFrame: (frame) => frames.delete(frame),
  }
  const tick = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()) }
  const cancel = contract.scheduleVirtualChurchShaderWarmup(options)
  if (steps !== 0) errors.push(`warm-up ${scenario}: must yield before first work`)
  if (scenario === 'cancel' || scenario === 'strict-mode-replay') {
    const staleCallback = [...frames.values()][0]
    cancel()
    staleCallback()
    if (steps !== 0 || finished !== 0 || frames.size !== 0) errors.push(`warm-up ${scenario}: stale work after cancellation`)
    if (scenario === 'strict-mode-replay') {
      ready = true
      contract.scheduleVirtualChurchShaderWarmup(options)
      tick()
      if (steps !== 1 || finished !== 1 || frames.size !== 0) errors.push('warm-up replay must start a fresh job')
    }
    continue
  }
  if (scenario === 'timeout') time = contract.VIRTUAL_CHURCH_SHADER_WARMUP_TIMEOUT_MS
  if (scenario === 'context-loss') lost = true
  tick()
  if (scenario === 'pending') {
    if (finished !== 0 || frames.size !== 1) errors.push('pending shader work must yield and reschedule')
    ready = true
    tick()
  }
  if (scenario === 'context-loss') {
    if (steps !== 0 || finished !== 0 || frames.size !== 0) errors.push('lost context must stop shader polling')
  } else if (finished !== 1 || frames.size !== 0) errors.push(`warm-up ${scenario}: must finish exactly once`)
  if (scenario === 'timeout' && steps !== 0) errors.push('timeout must resume normal rendering without more driver calls')
  if (failures !== (scenario === 'error' ? 1 : 0)) errors.push(`warm-up ${scenario}: error handling mismatch`)
}
for (const [start, end] of [
  ['const LoadedChurchHeroAsset =', 'const ChurchHeroAsset ='],
  ['const GateASkinnedFemaleHero =', 'class GateAHeroAssetBoundary'],
]) {
  const componentSource = viewSource.slice(viewSource.indexOf(start), viewSource.indexOf(end))
  if (/setAttribute\(\s*VIRTUAL_CHURCH_(?:HERO|CHARACTER)_READY_ATTRIBUTE/u.test(componentSource)) {
    errors.push(`${start} must not publish asset readiness directly on mount`)
  }
}

const resourceLeaseTranspiled = ts.transpileModule(
  resourceLeaseContractSource,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
    },
    fileName: resourceLeaseContractPath,
    reportDiagnostics: true,
  },
)
if ((resourceLeaseTranspiled.diagnostics ?? []).length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(
      resourceLeaseTranspiled.diagnostics,
    {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    },
  )
  throw new Error(`Unable to transpile resource lease contract:\n${formatted}`)
}
const resourceLeaseModule = resourceLeaseTranspiled.outputText.replace(
  /from (['"])three\1/g,
  `from ${JSON.stringify(pathToFileURL(resolve(appRoot, 'node_modules/three/build/three.module.js')).href)}`,
)
const resourceLeaseUrl =
  `data:text/javascript;base64,${Buffer.from(resourceLeaseModule).toString('base64')}`
const resourceLeaseContract = await import(resourceLeaseUrl)

const queuedCloneCleanups = []
let releasedCloneCount = 0
const cloneCleanupGuard =
  resourceLeaseContract.createVirtualChurchStrictModeCleanupGuard(
    (cleanup) => queuedCloneCleanups.push(cleanup),
  )
cloneCleanupGuard.activate()
cloneCleanupGuard.release(() => { releasedCloneCount += 1 })
cloneCleanupGuard.activate()
queuedCloneCleanups.splice(0).forEach((cleanup) => cleanup())
if (releasedCloneCount !== 0) {
  errors.push('cloned animation roots must survive React StrictMode effect replay')
}
cloneCleanupGuard.release(() => { releasedCloneCount += 1 })
queuedCloneCleanups.splice(0).forEach((cleanup) => cleanup())
if (releasedCloneCount !== 1) {
  errors.push('cloned animation roots must clean up once after final unmount')
}

const queuedReleases = []
const releasedResources = []
const resourceRegistry =
  resourceLeaseContract.createVirtualChurchResourceLeaseRegistry(
    (key, resource) => releasedResources.push({ key, resource }),
    (release) => queuedReleases.push(release),
  )
const firstPastorResource = { id: 'pastor-v1' }
const releasePastor = resourceRegistry.retain('pastor', firstPastorResource)
releasePastor()
const renewPastor = resourceRegistry.retain('pastor', firstPastorResource)
queuedReleases.splice(0).forEach((release) => release())
if (
  releasedResources.length !== 0
  || JSON.stringify(resourceRegistry.snapshot()) !==
    JSON.stringify([{ key: 'pastor', users: 1 }])
) {
  errors.push('character resource lease must survive StrictMode replay or immediate reselection')
}
renewPastor()
renewPastor()
queuedReleases.splice(0).forEach((release) => release())
if (
  releasedResources.length !== 1
  || releasedResources[0].key !== 'pastor'
  || releasedResources[0].resource !== firstPastorResource
  || resourceRegistry.snapshot().length !== 0
) {
  errors.push('character resource lease must release once after its final user leaves')
}

const queuedCharacterSwitchReleases = []
const releasedCharacterSwitchResources = []
const characterSwitchRegistry =
  resourceLeaseContract.createVirtualChurchResourceLeaseRegistry(
    (key, resource) => releasedCharacterSwitchResources.push({ key, resource }),
    (release) => queuedCharacterSwitchReleases.push(release),
  )
const femaleReviewResource = { id: 'female-v12-medium' }
const maleReviewResource = { id: 'male-v12-medium' }
const releaseFemaleReview = characterSwitchRegistry.retain(
  'female-v12-medium',
  femaleReviewResource,
)
releaseFemaleReview()
const releaseMaleReview = characterSwitchRegistry.retain(
  'male-v12-medium',
  maleReviewResource,
)
queuedCharacterSwitchReleases.splice(0).forEach((release) => release())
if (
  JSON.stringify(releasedCharacterSwitchResources) !== JSON.stringify([{
    key: 'female-v12-medium',
    resource: femaleReviewResource,
  }])
  || JSON.stringify(characterSwitchRegistry.snapshot()) !== JSON.stringify([{
    key: 'male-v12-medium',
    users: 1,
  }])
) {
  errors.push('switching characters must release the previous decoded source and retain only the selected source')
}
releaseMaleReview()
queuedCharacterSwitchReleases.splice(0).forEach((release) => release())
if (
  releasedCharacterSwitchResources.length !== 2
  || characterSwitchRegistry.snapshot().length !== 0
) {
  errors.push('the selected character source must release after its final rendered consumer leaves')
}

const expectedDelays = {
  siteDetails: { desktop: 750, mobile: 2000 },
  legacyCharacter: { desktop: 500, mobile: 2000 },
}
if (
  JSON.stringify(contract.VIRTUAL_CHURCH_DEFERRED_DELAYS_MS) !==
  JSON.stringify(expectedDelays)
) {
  errors.push(
    `loading contract delays changed without review: ${JSON.stringify(contract.VIRTUAL_CHURCH_DEFERRED_DELAYS_MS)}`,
  )
}
for (const group of Object.keys(expectedDelays)) {
  const desktop = contract.virtualChurchDeferredDelayMs(group, false)
  const mobile = contract.virtualChurchDeferredDelayMs(group, true)
  if (desktop <= 0 || mobile <= 0 || mobile < desktop) {
    errors.push(`${group}: delays must be positive and mobile must not load before desktop`)
  }
}

const sourceFile = ts.createSourceFile(
  viewPath,
  viewSource,
  ts.ScriptTarget.ESNext,
  true,
  ts.ScriptKind.TSX,
)

// Execute the actual hook with a hidden multi-part model and a fake renderer,
// not only source-string guards or the pure frame scheduler.
const preparedHookDeclaration = sourceFile.statements
  .filter(ts.isVariableStatement)
  .flatMap(statement => [...statement.declarationList.declarations])
  .find(declaration => declaration.name.getText(sourceFile) === 'usePreparedReviewAsset')
if (!preparedHookDeclaration) throw new Error('Review asset warm-up hook is missing')
const preparedHookCode = 'const reviewStartupSubmissions = new WeakMap();\n' + ts.transpileModule(`const ${preparedHookDeclaration.getText(sourceFile)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2023 },
}).outputText
const preparedHookFactory = new Function(
  'useThree', 'useState', 'useLayoutEffect', 'WebGLRenderTarget', 'MeshPhysicalMaterial', 'BackSide', 'DoubleSide',
  'reviewShaderFrameQueues', 'createVirtualChurchShaderFrameQueue', 'scheduleVirtualChurchShaderWarmup',
  'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'console', 'perfConfig', 'profile3DEnabled',
  'profile3DSearchParams', 'reviewShaderProgramAssociations', 'createVirtualChurchShaderProgramAssociations',
  'createVirtualChurchShaderIntrospectionTrace', 'createVirtualChurchSkyShaderPreparation',
  `${preparedHookCode}\nreturn usePreparedReviewAsset`,
)
const committedWarmupCases = ['hidden-model', 'scene-transmission', 'initial-scene', 'offscreen-error', 'backface-error', 'unsupported', 'disabled', 'disabled-transmission']
for (const { scenario, glassTransmission, profiling } of committedWarmupCases.flatMap(scenario =>
  [false, true].flatMap(glassTransmission => [false, true].map(profiling => ({ scenario, glassTransmission, profiling }))))) {
  const label = `${scenario}/${glassTransmission ? 'transmission' : 'mobile-no-transmission'}/${profiling ? 'diagnostic' : 'ordinary'}`
  const field = new Group()
  const body = new Mesh(undefined, new MeshPhysicalMaterial({ transmission: 1, side: DoubleSide }))
  const wheel = new Mesh()
  field.add(body, wheel)
  field.visible = false
  const scene = new Group()
  scene.add(field)
  scene.environment = {}
  const previousTarget = new WebGLRenderTarget(2, 2)
  const targetChanges = []
  const compiled = []
  const compiledSides = []
  const states = []
  const marks = []
  const frames = new Map()
  let nextFrame = 0
  let initializeCount = 0
  let targetsDisposed = 0
  let targetsCreated = 0
  let warnings = 0
  let effect
  const gl = {
    getContext: () => ({
      getExtension: () => scenario === 'unsupported' ? null : { COMPLETION_STATUS_KHR: 0x91b1 },
      getProgramParameter: () => true,
      isContextLost: () => false,
    }),
    info: { render: { frame: 0 }, programs: [{ program: {}, getUniforms: () => { initializeCount += 1 } }] },
    compile: model => {
      compiled.push(model)
      compiledSides.push(body.material.side)
      if (scenario === 'offscreen-error' && compiled.length === 2) throw new Error('offscreen driver fixture')
      if (scenario === 'backface-error' && compiled.length === 3) throw new Error('glass backface driver fixture')
    },
    getRenderTarget: () => previousTarget,
    getActiveCubeFace: () => 2,
    getActiveMipmapLevel: () => 3,
    setRenderTarget: (...args) => {
      targetChanges.push(args)
      if (args[0] !== previousTarget) args[0].addEventListener('dispose', () => { targetsDisposed += 1 })
    },
  }
  const hook = preparedHookFactory(
    () => ({ gl, camera: {}, scene, invalidate: () => {} }),
    initial => [initial, value => states.push(value)],
    callback => { effect = callback }, class extends WebGLRenderTarget {
      constructor(...args) { super(...args); targetsCreated += 1 }
    }, MeshPhysicalMaterial, BackSide, DoubleSide,
    new WeakMap(), contract.createVirtualChurchShaderFrameQueue, contract.scheduleVirtualChurchShaderWarmup,
    callback => { frames.set(++nextFrame, callback); return nextFrame }, id => frames.delete(id), { now: () => 0, mark: name => marks.push(name) },
    { warn: () => { warnings += 1 } },
    { glassTransmission },
    profiling,
    new URLSearchParams(), new WeakMap(), performanceContract.createVirtualChurchShaderProgramAssociations,
    performanceContract.createVirtualChurchShaderIntrospectionTrace,
    () => { throw new Error('This fixture has no texture background; sky preparation must not run') },
  )
  const warmSceneTransmission = ['scene-transmission', 'initial-scene', 'offscreen-error', 'backface-error', 'disabled-transmission'].includes(scenario)
  const enabled = !scenario.startsWith('disabled')
  hook(field, enabled, warmSceneTransmission, scenario !== 'initial-scene')
  const cleanup = effect()
  const tick = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()) }
  tick()
  if (scenario === 'initial-scene') {
    if (compiled[0] !== field) errors.push(`${label}: initial preparation must not deadlock waiting for its suppressed submission`)
  } else if (compiled.length !== 0) errors.push(`${label}: must wait for a completed scene frame`)
  gl.info.render.frame = 1
  for (let i = 0; i < 5; i += 1) tick()
  const shouldCompile = enabled && (scenario === 'hidden-model' || warmSceneTransmission)
  const failed = glassTransmission && scenario.endsWith('-error')
  const backfaceCompiled = glassTransmission && warmSceneTransmission && scenario !== 'offscreen-error'
  if (states.at(-1) !== true || frames.size !== 0) errors.push(`${label}: preparation did not terminate`)
  if (shouldCompile) {
    if (compiled.length !== (glassTransmission ? (backfaceCompiled ? 3 : 2) : 1) || compiled[0] !== field
      || (glassTransmission && compiled[1] !== (warmSceneTransmission ? scene : field))
      || field.children[0] !== body || field.children[1] !== wheel
      || (backfaceCompiled && (compiled[2] !== field || compiledSides[2] !== BackSide))
      || body.material.side !== DoubleSide || body.material.transmission !== 1
      || initializeCount !== (failed ? 0 : 1)
      || targetsCreated !== Number(glassTransmission) || targetsDisposed !== Number(glassTransmission)
      || warnings !== (failed ? 1 : 0)
      || (glassTransmission && (targetChanges.at(-1)?.[0] !== previousTarget
        || targetChanges.at(-1)?.[1] !== 2 || targetChanges.at(-1)?.[2] !== 3))
      || (!glassTransmission && targetChanges.length !== 0)) {
      errors.push(`${label}: must prepare only budgeted passes and restore the renderer target`)
    }
  } else if (compiled.length || initializeCount || targetChanges.length || targetsCreated) errors.push(`${label}: ordinary rendering must not perform warm-up work`)
  const owner = scenario === 'initial-scene' ? 'scene' : warmSceneTransmission ? 'church' : 'character'
  const expectedStages = shouldCompile && profiling
    ? ['compile', ...(glassTransmission ? ['transmission', ...(backfaceCompiled ? ['backface'] : [])] : [])]
    : []
  const expectedMarks = expectedStages.flatMap(stage => [`vc:shader:${owner}:${stage}-start`, `vc:shader:${owner}:${stage}-end`])
  if (shouldCompile && profiling && !failed) expectedMarks.push(`vc:shader:${owner}:introspection-start`, `vc:shader:${owner}:introspection-end`)
  if (marks.join(',') !== expectedMarks.join(',')) errors.push(`${label}: diagnostic marks must name only fixed stages, close failed stages and stay absent from ordinary visits`)
  cleanup?.()
  previousTarget.dispose()
  for (const mesh of [body, wheel]) { mesh.geometry.dispose(); mesh.material.dispose() }
}

const initialPreparation = sourceFile.statements.filter(ts.isVariableStatement)
  .flatMap(statement => [...statement.declarationList.declarations])
  .find(declaration => declaration.name.getText(sourceFile) === 'InitialSceneShaderPreparation')
if (!initialPreparation) throw new Error('Initial scene preparation component is missing')
const initialPreparationCode = ts.transpileModule(`const ${initialPreparation.getText(sourceFile)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2023 },
}).outputText
for (const prepared of [false, true]) {
  const scene = new Group()
  const camera = {}
  let priority, argumentsReceived, callback, submissions = 0
  const requests = new WeakMap(), signals = new Map(), states = []
  const gl = { info: { render: { frame: 0 } }, getContext: () => ({ isContextLost: () => false }), capabilities: { getMaxAnisotropy() { return 16 } }, render(model, view) {
    if (this !== gl || model !== scene || view !== camera) errors.push('Preparation must retain actual renderer, scene and camera')
    submissions++
    gl.info.render.frame++
  } }
  const cleanupEffects = []
  const component = new Function('useThree', 'usePreparedReviewAsset', 'useFrame', 'useLayoutEffect', 'profile3DEnabled', 'createVirtualChurchFoyerFloorShaderPreparation',
    'useState', 'useRef', 'performance', 'createVirtualChurchStartupSubmissions', 'reviewStartupSubmissions', 'document', 'virtualChurchDeferredCanStart', 'VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE', 'VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE',
    `${initialPreparationCode}\nreturn InitialSceneShaderPreparation`)(
    () => ({ gl, scene, camera, invalidate() {} }),
    (...args) => { argumentsReceived = args; return prepared },
    (fn, value) => { callback = fn; priority = value },
    effect => { const cleanup = effect(); if (typeof cleanup === 'function') cleanupEffects.push(cleanup) }, false, createVirtualChurchFoyerFloorShaderPreparation,
    () => [true, value => states.push(value)], value => ({ current: value }), { now: () => 100 }, createVirtualChurchStartupSubmissions, requests,
    { visibilityState: 'visible', documentElement: { getAttribute: key => signals.get(key) ?? null } }, virtualChurchDeferredCanStart, 'hero', 'character',
  )
  component()
  const helper = scene.getObjectByName('vc:foyer-floor-shader-preparation')
  if (!helper || helper.visible || !helper.receiveShadow) errors.push('Floor shader helper must be present for compile, never draw, and retain the real shadow feature')
  callback()
  callback()
  if (argumentsReceived[0] !== scene || argumentsReceived.slice(1).join(',') !== 'true,true,false'
    || priority !== 1
    || submissions !== (prepared ? 1 : 0)) errors.push('Initial preparation must retain necessary real submission without continuous loading renders')
  if (prepared) {
    signals.set('hero', '101'); signals.set('character', '102'); callback()
    if (states.join(',') !== 'false' || requests.has(gl)) errors.push('Both actual readiness signals must restore normal rendering and retire submission requests')
  }
  cleanupEffects.forEach(cleanup => cleanup())
  if (scene.children.length) errors.push('Initial floor shader helper must be removed at cleanup')
}
requireSource("{config3D.visualVersion === 'v3' ? <InitialSceneShaderPreparation /> : null}", 'V3-only startup preparation')
requireSource("shadows={config3D.visualVersion === 'v3' ? 'percentage' : true}", 'Stable actual PCF type before startup compilation')

const environmentDeclaration = sourceFile.statements
  .filter(ts.isVariableStatement)
  .flatMap(statement => [...statement.declarationList.declarations])
  .find(declaration => declaration.name.getText(sourceFile) === 'PbrEnvironmentMap')
if (!environmentDeclaration) throw new Error('PBR environment component is missing')
const environmentCode = ts.transpileModule(`const ${environmentDeclaration.getText(sourceFile)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2023 },
}).outputText
const environmentFactory = new Function(
  'useThree', 'useLayoutEffect', 'document', 'CanvasTexture', 'PMREMGenerator',
  'EquirectangularReflectionMapping', 'SRGBColorSpace', 'createV3VisibleSkyTexture',
  'perfConfig', 'ALIFE_V3_SCENE_TREATMENT', 'profile3DEnabled', `${environmentCode}\nreturn PbrEnvironmentMap`,
)
const environmentCleanupCases = []
for (const visualVersion of ['v2', 'v3']) {
  const original = { environment: new Texture(), background: new Texture(), backgroundIntensity: 0.7 }
  const scene = { ...original }
  const targets = []
  const textures = []
  let effect
  let generatorsDisposed = 0
  let targetsDisposed = 0
  let texturesDisposed = 0
  const trackTexture = texture => {
    textures.push(texture)
    texture.addEventListener('dispose', () => { texturesDisposed += 1 })
    return texture
  }
  class TestCanvasTexture extends CanvasTexture {
    constructor(canvas) { super(canvas); trackTexture(this) }
  }
  class TestPMREMGenerator {
    compileEquirectangularShader() {}
    fromEquirectangular() {
      const target = new WebGLRenderTarget(4, 4)
      target.addEventListener('dispose', () => { targetsDisposed += 1 })
      targets.push(target)
      return target
    }
    dispose() { generatorsDisposed += 1 }
  }
  const ctx = {
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {}, beginPath() {}, ellipse() {}, fill() {},
  }
  const render = environmentFactory(
    () => ({ gl: {}, scene }), callback => { effect = callback },
    { createElement: () => ({ getContext: () => ctx }) }, TestCanvasTexture, TestPMREMGenerator,
    EquirectangularReflectionMapping, SRGBColorSpace, () => trackTexture(new Texture()),
    { isMobile: true }, { scene: { backgroundIntensity: { mobile: 0.8 } } }, false,
  )
  render({ visualVersion })
  // React effect replay / re-entry must allocate and release each owned target.
  for (let cycle = 1; cycle <= 2; cycle += 1) {
    const cleanup = effect()
    if (scene.environment !== targets.at(-1).texture || targetsDisposed !== cycle - 1) {
      errors.push(`${visualVersion}: environment target must remain alive while mounted`)
    }
    cleanup()
    if (targetsDisposed !== cycle || generatorsDisposed !== cycle
      || texturesDisposed !== cycle * (visualVersion === 'v3' ? 2 : 1)
      || scene.environment !== original.environment || scene.background !== original.background
      || scene.backgroundIntensity !== original.backgroundIntensity) {
      errors.push(`${visualVersion}: cleanup must restore scene and release the complete PMREM target`)
    }
  }
  original.environment.dispose(); original.background.dispose()
  environmentCleanupCases.push({ visualVersion, cycles: 2, targetsDisposed, texturesDisposed, generatorsDisposed })
}

// Evaluate JSX element types across two renders without mounting a WebGL canvas.
// A component factory declared inside the render would change type every time,
// causing React to unmount its materials even when the visual profile is unchanged.
const parkingSymbolsDeclaration = sourceFile.statements
  .filter(ts.isVariableStatement)
  .flatMap((statement) => [...statement.declarationList.declarations])
  .find((declaration) => declaration.name.getText(sourceFile) === 'AccessibleParkingSymbols')
if (!parkingSymbolsDeclaration) {
  throw new Error('AccessibleParkingSymbols component is missing')
}
const parkingSymbolsCode = ts.transpileModule(
  `const ${parkingSymbolsDeclaration.getText(sourceFile)}`,
  {
    fileName: viewPath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      jsx: ts.JsxEmit.React,
      jsxFactory: 'createElement',
    },
  },
).outputText
const createParkingSymbols = new Function(
  'useRef', 'useLayoutEffect', 'config3D', 'ALIFE_V3_ENVIRONMENT_TREATMENT', 'createElement',
  'useMemo', 'useEffect', 'createVirtualChurchAccessibleSymbol',
  `${parkingSymbolsCode}\nreturn AccessibleParkingSymbols`,
)
const accessibleParkingMaterialChecks = []
for (const visualVersion of ['v2', 'v3']) {
  const parkingDetails = { accessibleLine: '#decfa1', lineRoughness: 0.88 }
  const render = createParkingSymbols(
    (initial) => ({ current: initial }),
    () => {},
    { visualVersion },
    { parkingDetails },
    (type, props, ...children) => ({ type, props, children }),
    (factory) => factory(),
    () => {},
    () => ({ dispose() {} }),
  )
  const props = { positions: [[0, 0], [3, 0]], angle: 0 }
  const first = [render(props)]
  const second = [render({ ...props, positions: props.positions.map((position) => [...position]) })]
  const expectedType = visualVersion === 'v3' ? 'meshStandardMaterial' : 'meshBasicMaterial'
  const expectedColor = visualVersion === 'v3' ? parkingDetails.accessibleLine : '#e8c44e'
  if (first[0].type !== 'instancedMesh' || second[0].type !== 'instancedMesh'
    || first[0].props.args[2] !== 2 || second[0].props.args[2] !== 2) {
    errors.push(`${visualVersion}: accessible parking must retain both symbols in one instanced batch`)
  }
  first.forEach((mesh, index) => {
    const before = mesh.children.at(-1)
    const after = second[index]?.children.at(-1)
    if (before.type !== expectedType || after?.type !== before.type) {
      errors.push(`${visualVersion}: accessible parking material ${index} must keep a stable host type`)
    } else if (
      before.props.color !== expectedColor
      || JSON.stringify(before.props) !== JSON.stringify(after.props)
      || (visualVersion === 'v3' && (
        before.props.roughness !== parkingDetails.lineRoughness || before.props.metalness !== 0
      ))
    ) {
      errors.push(`${visualVersion}: accessible parking material ${index} changed its profile properties`)
    }
  })
  accessibleParkingMaterialChecks.push({ visualVersion, materialType: expectedType, meshes: first.length })
}

const enclosingFunctionName = (node) => {
  let current = node.parent
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text
    }
    current = current.parent
  }
  return '(module)'
}

const ancestorConditions = (node) => {
  const conditions = []
  let current = node.parent
  while (current) {
    if (ts.isConditionalExpression(current)) {
      conditions.push(current.condition.getText(sourceFile))
    }
    current = current.parent
  }
  return conditions
}

const loaderCalls = []
const preloadCalls = []
const deferredJsx = []
const deferredTags = new Set([
  'ParkedVehicle',
  'InstancedTreeField',
  'DetailedBush',
  'InstancedStaticAssetField',
])

const visit = (node) => {
  if (ts.isCallExpression(node)) {
    if (ts.isIdentifier(node.expression) && node.expression.text === 'useLoader') {
      loaderCalls.push({
        component: enclosingFunctionName(node),
        asset: node.arguments[1]?.getText(sourceFile) ?? '(missing)',
      })
    }
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'preload'
    ) {
      preloadCalls.push(node.expression.expression.getText(sourceFile))
    }
  }

  const jsxTag = ts.isJsxSelfClosingElement(node)
    ? node.tagName.getText(sourceFile)
    : ts.isJsxOpeningElement(node)
      ? node.tagName.getText(sourceFile)
      : null
  if (jsxTag && deferredTags.has(jsxTag)) {
    deferredJsx.push({
      component: enclosingFunctionName(node),
      tag: jsxTag,
      conditions: ancestorConditions(node),
    })
  }
  ts.forEachChild(node, visit)
}
visit(sourceFile)

const expectedLoaderCalls = [
  { component: 'LoadedInstancedStaticAssetField', asset: 'path' },
  { component: 'LoadedBatchedCulvertRocks', asset: 'V3_LOW_ROCK_PATHS[0]' },
  { component: 'LoadedBatchedCulvertRocks', asset: 'V3_LOW_ROCK_PATHS[1]' },
  { component: 'LoadedBatchedCulvertRocks', asset: 'V3_LOW_ROCK_PATHS[2]' },
  { component: 'LoadedPbrVehicle', asset: 'path' },
  { component: 'LoadedInstancedTreeField', asset: 'NATURE_ASSETS[variant]' },
  { component: 'DetailedBush', asset: 'assetPath' },
  { component: 'LoadedChurchHeroAsset', asset: 'CHURCH_HERO_ASSET_PATH' },
  { component: 'FoyerCourtyardPhoto', asset: 'FOYER_COURTYARD_REFERENCE' },
  { component: 'FoyerSideCourtyardPhoto', asset: 'FOYER_SIDE_COURTYARD_REFERENCE' },
  { component: 'GateASkinnedFemaleHero', asset: 'assetPath' },
  { component: 'GateASharedMotionReviewHero', asset: 'motionPath' },
  { component: 'AnimatedPlayerAvatar', asset: 'assetPath' },
]
if (JSON.stringify(loaderCalls) !== JSON.stringify(expectedLoaderCalls)) {
  errors.push(
    `useLoader inventory changed: expected ${JSON.stringify(expectedLoaderCalls)}, received ${JSON.stringify(loaderCalls)}`,
  )
}
if (JSON.stringify(preloadCalls) !== JSON.stringify(['VIRTUAL_CHURCH_DRACO_LOADER'])) {
  errors.push(
    `only the shared Draco decoder may be preloaded, received ${JSON.stringify(preloadCalls)}`,
  )
}

for (const entry of deferredJsx) {
  const siteGuarded =
    entry.component === 'SiteScene' &&
    entry.conditions.includes('detailedSiteAssetsReady')
  const culvertGuarded =
    entry.component === 'CulvertDrainDetails' &&
    entry.tag === 'InstancedStaticAssetField' &&
    entry.conditions.includes('detailed')
  const batchedCulvertFallback =
    entry.component === 'LoadedBatchedCulvertRocks' &&
    entry.tag === 'InstancedStaticAssetField' &&
    viewSource.includes('if (!batch) return <>') &&
    viewSource.includes('detailed={detailedSiteAssetsReady}')
  if (!siteGuarded && !culvertGuarded && !batchedCulvertFallback) {
    errors.push(
      `${entry.tag} in ${entry.component} is not guarded by the reviewed site-details boundary`,
    )
  }
}

requireSource(
  "virtualChurchDeferredDelayMs('siteDetails', perfConfig.isMobile)",
)
requireSource(
  "virtualChurchDeferredDelayMs('legacyCharacter', perfConfig.isMobile)",
)
requireSource("config3D.visualVersion !== 'v3'")
requireSource('if (!enabled || !shouldDefer || ready) return')
requireSource('return enabled && ready')
requireSource('detailed={detailedSiteAssetsReady}')
requireSource('const assetPath = legacyCharacterAssetPath(characterId)')
requireSource('VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(assetPath, gltf)')
requireSource('VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.snapshot()')
requireSource('useLoader.clear(GLTFLoader, assetPath)')
requireSource('textures.forEach((texture) => texture.dispose())')
requireSource('geometries.forEach((geometry) => geometry.dispose())')
if (
  viewSource.includes('Cache.enabled = true')
  || viewSource.includes('retainVirtualChurchThreeCache')
) {
  errors.push(
    'Three.Cache must stay disabled because concurrent ImageBitmap cache hits resolve without image data',
  )
}
for (const fragment of [
  'class VirtualChurchSharedImageBitmapLoader',
  'private readonly entries = new Map<string, SharedBitmapEntry>()',
  'promise: this.loadBitmap(url, requestInit)',
  'if (this.entries.get(url) === ownedEntry) this.entries.delete(url)',
  'if (entry.bitmap) entry.bitmap.close()',
]) {
  if (!sharedImageBitmapLoaderSource.includes(fragment)) {
    errors.push(`Shared vehicle ImageBitmap loader: missing ${JSON.stringify(fragment)}`)
  }
}
requireSource('DefaultLoadingManager.addHandler(')
requireSource('/(?:^|\\/)Textures\\/colormap\\.png(?:[?#].*)?$/i')
requireSource('VIRTUAL_CHURCH_SHARED_VEHICLE_TEXTURE_LOADER.clear()')
requireSource("profile3DSearchParams.get('profile3dGpu') === 'release'")
requireSource('__alifeVirtualChurchGpuRelease')
requireSource('data-virtual-church-gpu-release-diagnostic')
requireSource('JSON.stringify(current)')
requireSource('diagnostic.createdContexts += 1')
requireSource('diagnostic.releasedContexts += 1')
requireSource('diagnostic.activeContexts = Math.max(0, diagnostic.activeContexts - 1)')
requireSource('const canvasConnected = gl.domElement.isConnected')
requireSource('diagnostic.canvasConnectedAtRelease = canvasConnected')
requireSource('geometries: gl.info.memory.geometries')
requireSource('textures: gl.info.memory.textures')
requireSource('material.color.copy(baseColor).lerp(tint, tintAmount)')
requireSource('key={`${characterId}:${characterRetryRevision}`}')
requireSource('key={gateAAssetPath}')
requireSource('<LegacyCharacterAssetBoundary')
requireSource('assetPath={legacyAssetPath}')
requireSource('assetPath={gateAAssetPath}')
requireSource('characterReview={characterReview}')
requireSource('VIRTUAL_CHURCH_CHARACTER_RESOURCE_ATTRIBUTE')
requireSource('virtualChurchCharacterReleasedResources += 1')
const sharedMotionOwner = viewSource.slice(
  viewSource.indexOf('const GateASharedMotionReviewHero ='),
  viewSource.indexOf('class GateAHeroAssetBoundary'),
)
for (const fragment of [
  'useLoader(GLTFLoader, motionPath)',
  'VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(motionPath, motion)',
  'release()',
  // The owner must commit independently of the suspended character, otherwise
  // a model failure could orphan a successfully decoded motion package.
  '<Suspense fallback={fallback}><GateASkinnedFemaleHero {...props} sharedMotion={motion} /></Suspense>',
]) {
  if (!sharedMotionOwner.includes(fragment)) errors.push(`Shared-motion lifetime: missing ${JSON.stringify(fragment)}`)
}
requireSource('if (this.props.motionPath) clearFailedGltfAsset(this.props.motionPath)')

const gltfResourceLeaseRetains = (
  viewSource.match(/VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES\.retain\(/gu) ?? []
).length
const expectedGltfLoaderCalls = expectedLoaderCalls.filter(({ component }) => !component.startsWith('Foyer'))
// The three Low rock GLTFs share one effect that retains each source in a map.
const groupedRockRetain = 'VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain(V3_LOW_ROCK_PATHS[index], gltf)'
if (!viewSource.includes(groupedRockRetain)) errors.push('all three batched Low rock GLTFs must retain their decoded sources')
const expectedRetainCallSites = expectedGltfLoaderCalls.length - 2
if (gltfResourceLeaseRetains !== expectedRetainCallSites) {
  errors.push(
    `every GLTF loader must lease its decoded source until the final rendered consumer leaves; expected ${expectedRetainCallSites} retain sites including one grouped rock site, received ${gltfResourceLeaseRetains}`,
  )
}
const externallyOwnedInstanceMeshes = (
  viewSource.match(/dispose=\{null\}/gu) ?? []
).length
if (externallyOwnedInstanceMeshes !== 4) {
  errors.push(
    `the two instanced fields and two locally disposed flag meshes must preserve explicit ownership; received ${externallyOwnedInstanceMeshes}`,
  )
}
for (const fragment of [
  'resources.geometry.dispose()',
  'resources.material.map?.dispose()',
  'resources.material.dispose()',
  'resources.cordGeometry.dispose()',
  'resources.cordMaterial.dispose()',
]) requireSource(fragment)

if (viewSource.includes('key={`${characterId}-${outfitId}`}')) {
  errors.push('outfit changes must not remount and reload the entire legacy character')
}
const avatarMemoStart = viewSource.indexOf('const avatar = useMemo(() => {')
const avatarMemoEnd = viewSource.indexOf(
  'const { model, wardrobeBaseColors } = avatar',
  avatarMemoStart,
)
const avatarMemoSource = viewSource.slice(avatarMemoStart, avatarMemoEnd)
if (
  avatarMemoStart < 0
  || avatarMemoEnd < 0
  || avatarMemoSource.includes('[characterId, gltf.scene, outfitId]')
) {
  errors.push('legacy character model clone must be independent from outfit-only changes')
}

const v3BranchIndex = viewSource.indexOf("if (config3D.visualVersion === 'v3')")
const legacyGuardIndex = viewSource.indexOf(
  'if (!loadDetailedAvatar) return null',
)
const legacyAvatarIndex = viewSource.indexOf('<AnimatedPlayerAvatar', legacyGuardIndex)
if (
  v3BranchIndex < 0 ||
  legacyGuardIndex < 0 ||
  legacyAvatarIndex < 0 ||
  !(v3BranchIndex < legacyGuardIndex && legacyGuardIndex < legacyAvatarIndex)
) {
  errors.push('V3 Hero branch must return before the guarded legacy character render path')
}

const expectedDeferredCounts = {
  ParkedVehicle: 3,
  InstancedTreeField: 1,
  DetailedBush: 1,
  InstancedStaticAssetField: 10,
}
const actualDeferredCounts = Object.fromEntries(
  Object.keys(expectedDeferredCounts).map((tag) => [
    tag,
    deferredJsx.filter((entry) => entry.tag === tag).length,
  ]),
)
if (JSON.stringify(actualDeferredCounts) !== JSON.stringify(expectedDeferredCounts)) {
  errors.push(
    `deferred JSX inventory changed: expected ${JSON.stringify(expectedDeferredCounts)}, received ${JSON.stringify(actualDeferredCounts)}`,
  )
}

const uncacheRootCalls = (
  viewSource.match(/mixer\.uncacheRoot\(model\)/gu) ?? []
).length
if (uncacheRootCalls !== 2) {
  errors.push(
    `both Gate A and legacy cloned characters must uncache their animation roots, received ${uncacheRootCalls} cleanup calls`,
  )
}
const clonedMaterialDisposeCalls = (
  viewSource.match(/materials\.forEach\(\(item\) => item\.dispose\(\)\)/gu) ?? []
).length
if (clonedMaterialDisposeCalls !== 2) {
  errors.push(
    `both Gate A and legacy cloned characters must release cloned materials, received ${clonedMaterialDisposeCalls} cleanup calls`,
  )
}

if (errors.length > 0) {
  throw new Error(`Virtual Church loading-boundary validation failed:\n- ${errors.join('\n- ')}`)
}

console.log(JSON.stringify({
  delaysMs: contract.VIRTUAL_CHURCH_DEFERRED_DELAYS_MS,
  renderedReadyCases,
  warmupCases,
  sharedQueueCases,
  committedWarmupCases,
  committedWarmupGlassTransmissionBudgets: [false, true],
  environmentCleanupCases,
  heroReadyLoaders: loaderCalls.filter((entry) =>
    ['LoadedChurchHeroAsset', 'GateASkinnedFemaleHero'].includes(entry.component),
  ),
  deferredLoaders: loaderCalls.filter((entry) =>
    !['LoadedChurchHeroAsset', 'GateASkinnedFemaleHero', 'GateASharedMotionReviewHero'].includes(entry.component),
  ),
  conditionalReviewMotionLoaders: loaderCalls.filter((entry) => entry.component === 'GateASharedMotionReviewHero'),
  preloadCalls,
  deferredJsxCounts: actualDeferredCounts,
  v3LegacyCharacterSchedulerDisabled: true,
  v3LegacyCharacterAssetsExcluded: true,
  clonedCharacterAnimationRootsUncached: uncacheRootCalls,
  clonedCharacterMaterialCleanupPaths: clonedMaterialDisposeCalls,
  legacyCharacterDecodedCacheClearedOnFinalRelease: true,
  legacyCharacterGpuSourceCleanup: {
    textures: true,
    geometries: true,
    materials: true,
  },
  outfitChangesReuseCharacterClone: true,
  strictModeLeaseReplayProtected: true,
  allGltfLoadersReleaseDecodedSourcesOnFinalUnmount: gltfResourceLeaseRetains,
  leasedInstancedSourceOwnershipPaths: externallyOwnedInstanceMeshes,
  sharedVehicleTextureRequestsUseOwnedPromiseCache: true,
  accessibleParkingMaterialElementChecks: accessibleParkingMaterialChecks,
  threeImageBitmapPromiseCacheDisabled: true,
  optInGpuReleaseDiagnostic: {
    query: 'profile3d&profile3dGpu=release',
    recordsContextCreation: true,
    recordsRealContextLoss: true,
    recordsPreReleaseRendererMemory: true,
    bypassesMemberRoute: false,
  },
  passed: true,
}, null, 2))
