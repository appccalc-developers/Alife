import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const runtimeSignalsPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchRuntimeSignals.ts',
)
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const probePath = resolve(
  appRoot,
  'src',
  'views',
  'VirtualChurchPerformanceProbe.tsx',
)
const performanceValidatorPath = resolve(
  repoRoot,
  'tools',
  'virtual-church',
  'validate-performance-profile.mjs',
)
const normalizeSource = (source) => source.replace(/\r\n?/gu, '\n')

const [
  runtimeSignalsSource,
  viewSource,
  probeSource,
  performanceValidatorSource,
] = await Promise.all([
  readFile(runtimeSignalsPath, 'utf8').then(normalizeSource),
  readFile(viewPath, 'utf8').then(normalizeSource),
  readFile(probePath, 'utf8').then(normalizeSource),
  readFile(performanceValidatorPath, 'utf8').then(normalizeSource),
])

const errors = []
const requireSource = (source, fragment, label) => {
  if (!source.includes(fragment)) {
    errors.push(`${label}: missing ${JSON.stringify(fragment)}`)
  }
}

const transpiled = ts.transpileModule(runtimeSignalsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: runtimeSignalsPath,
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
  throw new Error(`Unable to transpile runtime signals:\n${formatted}`)
}

const contractUrl =
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const contract = await import(contractUrl)
const expectedAttributes = [
  'data-virtual-church-profile',
  'data-virtual-church-sampling',
  'data-virtual-church-hero-ready-ms',
  'data-virtual-church-character-ready-ms',
  'data-virtual-church-character-action',
  'data-virtual-church-input-diagnostic-phase',
  'data-virtual-church-player-pose',
  'data-virtual-church-church-fallback',
  'data-virtual-church-character-fallback',
  'data-virtual-church-character-asset',
  'data-virtual-church-character-resource',
]
if (
  JSON.stringify(contract.VIRTUAL_CHURCH_TRANSIENT_ATTRIBUTES) !==
  JSON.stringify(expectedAttributes)
) {
  errors.push(
    `transient attribute inventory changed: ${JSON.stringify(contract.VIRTUAL_CHURCH_TRANSIENT_ATTRIBUTES)}`,
  )
}

const attributes = new Map(expectedAttributes.map((attribute) => [attribute, 'stale']))
const fakeRoot = {
  getAttribute: (attribute) => attributes.get(attribute) ?? null,
  removeAttribute: (attribute) => attributes.delete(attribute),
}
contract.clearVirtualChurchRuntimeSignals(fakeRoot)
if (attributes.size !== 0) {
  errors.push(`runtime reset left stale attributes: ${JSON.stringify([...attributes.keys()])}`)
}
if (
  JSON.stringify(contract.readVirtualChurchFallbackSignals(fakeRoot)) !==
  JSON.stringify({ church: false, character: false })
) {
  errors.push('clean runtime must report both fallback flags as false')
}
attributes.set(contract.VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE, 'true')
attributes.set(contract.VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE, 'true')
if (
  JSON.stringify(contract.readVirtualChurchFallbackSignals(fakeRoot)) !==
  JSON.stringify({ church: true, character: true })
) {
  errors.push('runtime fallback snapshot did not preserve both explicit failure flags')
}

requireSource(
  viewSource,
  'useLayoutEffect(() => {\n    clearVirtualChurchRuntimeSignals()\n    setRuntimeSignalsReady(true)',
  'Virtual Church session bootstrap',
)
requireSource(
  viewSource,
  'return clearVirtualChurchRuntimeSignals',
  'Virtual Church session cleanup',
)
requireSource(
  viewSource,
  'const interactive3DEnabled =\n    runtimeSignalsReady\n    && webGlAvailable\n    && !webGlLost\n    && sceneRuntimeError === null',
  'Canvas readiness gate',
)
requireSource(
  viewSource,
  "gl.domElement.addEventListener('webglcontextlost', (event) => {",
  'WebGL context-loss handler',
)
requireSource(
  viewSource,
  'if (!interactive3DEnabled || dialogOpen || interactiveTarget) return',
  'Unavailable WebGL keyboard guard',
)
requireSource(
  viewSource,
  "cameraMode !== 'showcase' && interactive3DEnabled",
  'Unavailable WebGL movement-control guard',
)
requireSource(
  viewSource,
  "typeof WebGL2RenderingContext !== 'undefined'",
  'Three.js WebGL2 capability probe',
)
requireSource(
  viewSource,
  '<VirtualChurchCanvasBoundary',
  'Canvas runtime boundary',
)
requireSource(
  viewSource,
  'setSceneRuntimeError(virtualChurchRuntimeErrorMessage(error))',
  'Canvas error state',
)
requireSource(
  viewSource,
  'document.documentElement.setAttribute(VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE, \'true\')',
  'Church GLB fallback',
)
requireSource(
  viewSource,
  'document.documentElement.setAttribute(VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE, \'true\')',
  'Character GLB fallback',
)

const contextLossHandler = viewSource.match(
  /gl\.domElement\.addEventListener\('webglcontextlost',[\s\S]*?\}, \{ once: true \}\)/u,
)?.[0]
if (
  !contextLossHandler ||
  contextLossHandler.indexOf('clearVirtualChurchRuntimeSignals()') >
    contextLossHandler.indexOf('setWebGlLost(true)')
) {
  errors.push('context loss must clear the old runtime session before showing fallback UI')
}

for (const [boundary, fallbackAttribute, readyAttribute] of [
  [
    'ChurchHeroAssetBoundary',
    'VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE',
    'VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE',
  ],
  [
    'GateAHeroAssetBoundary',
    'VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE',
    'VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE',
  ],
  [
    'LegacyCharacterAssetBoundary',
    'VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE',
    'VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE',
  ],
]) {
  const boundaryStart = viewSource.indexOf(`class ${boundary}`)
  const nextBoundary = viewSource.indexOf('\nclass ', boundaryStart + 1)
  const boundarySource = viewSource.slice(
    boundaryStart,
    nextBoundary < 0 ? viewSource.length : nextBoundary,
  )
  if (
    boundaryStart < 0 ||
    !boundarySource.includes(fallbackAttribute) ||
    !boundarySource.includes(readyAttribute) ||
    !boundarySource.includes('clearFailedGltfAsset(this.props.assetPath)')
  ) {
    errors.push(
      `${boundary} must clear its rejected loader cache and mark fallback/ready so profiling cannot wait forever`,
    )
  }
}

const failedGltfCacheClearCalls = (
  viewSource.match(/clearFailedGltfAsset\(this\.props\.assetPath\)/gu) ?? []
).length
if (failedGltfCacheClearCalls !== 3) {
  errors.push(
    `church, Gate A Hero and legacy character boundaries must each clear only their failed GLTF cache; received ${failedGltfCacheClearCalls} paths`,
  )
}
for (const fragment of [
  "return profile3DFailureMode === 'character-glb'",
  '? `${configuredAsset}.missing`',
  'const assetPath = legacyCharacterAssetPath(characterId)',
  'const legacyAssetPath = legacyCharacterAssetPath(characterId)',
  'assetPath={CHURCH_HERO_ASSET_PATH}',
  'assetPath={gateAAssetPath}',
  '<LegacyCharacterAssetBoundary',
  'key={`${characterId}:${characterRetryRevision}`}',
  'assetPath={legacyAssetPath}',
]) {
  requireSource(viewSource, fragment, 'Recoverable asset boundary wiring')
}

requireSource(
  probeSource,
  'schemaVersion: 7',
  'Performance report schema',
)
requireSource(
  probeSource,
  'fallback: readVirtualChurchFallbackSignals()',
  'Performance fallback evidence',
)
requireSource(
  probeSource,
  'document.documentElement.removeAttribute(VIRTUAL_CHURCH_PROFILE_ATTRIBUTE)',
  'Performance report cleanup',
)
requireSource(
  performanceValidatorSource,
  'VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION',
  'Performance report schema gate',
)
requireSource(
  performanceValidatorSource,
  'if (!normalAssetRun && !allowFallback) failed = true',
  'Performance fallback gate',
)

if (errors.length > 0) {
  throw new Error(`Virtual Church fallback-runtime validation failed:\n- ${errors.join('\n- ')}`)
}

console.log(JSON.stringify({
  transientAttributes: expectedAttributes,
  sessionBootstrapBeforeCanvas: true,
  routeExitCleanup: true,
  churchGlbFailureCompletesHeroReady: true,
  characterGlbFailureCompletesHeroReady: true,
  failedLoaderCacheClearedForNextMount: {
    church: true,
    gateAHero: true,
    legacyCharacter: true,
  },
  legacyCharacterFailureIsolatedFromCanvas: true,
  selectingAnotherLegacyCharacterResetsBoundary: true,
  webGlUnavailableShowsNon3DFallback: true,
  webGl2MatchesThreeRendererRequirement: true,
  canvasRuntimeFailureShowsInRouteFallback: true,
  contextLossClearsRuntimeSignals: true,
  unavailableMovementControlsHidden: true,
  performanceReportIncludesFallback: true,
  fallbackProfilesRejectedUnlessDiagnostic: true,
  passed: true,
}, null, 2))
