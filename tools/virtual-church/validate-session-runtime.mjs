import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const contractPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchPerformanceContract.ts',
)
const routesPath = resolve(
  appRoot,
  'src',
  'app',
  'routing',
  'AppRoutes.tsx',
)
const routeBoundaryPath = resolve(
  appRoot,
  'src',
  'app',
  'routing',
  'VirtualChurchRouteBoundary.tsx',
)
const routeRecoveryContractPath = resolve(
  appRoot,
  'src',
  'app',
  'routing',
  'virtualChurchRouteRecoveryContract.ts',
)
const registerServiceWorkerPath = resolve(appRoot, 'src', 'registerSW.ts')
const serviceWorkerControllerChangePath = resolve(appRoot, 'src', 'serviceWorkerControllerChange.ts')
const mainPath = resolve(appRoot, 'src', 'main.tsx')
const viteConfigPath = resolve(appRoot, 'vite.config.ts')
const probePath = resolve(
  appRoot,
  'src',
  'views',
  'VirtualChurchPerformanceProbe.tsx',
)
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const profileValidatorPath = resolve(
  repoRoot,
  'tools',
  'virtual-church',
  'validate-performance-profile.mjs',
)
const localDevScriptPath = resolve(repoRoot, 'scripts', 'start-local-dev.ps1')

const [
  contractSource,
  routesSource,
  routeBoundarySource,
  routeRecoveryContractSource,
  registerServiceWorkerSource,
  serviceWorkerControllerChangeSource,
  mainSource,
  viteConfigSource,
  probeSource,
  viewSource,
  profileValidatorSource,
  localDevScriptSource,
] = await Promise.all([
  readFile(contractPath, 'utf8'),
  readFile(routesPath, 'utf8'),
  readFile(routeBoundaryPath, 'utf8'),
  readFile(routeRecoveryContractPath, 'utf8'),
  readFile(registerServiceWorkerPath, 'utf8'),
  readFile(serviceWorkerControllerChangePath, 'utf8'),
  readFile(mainPath, 'utf8'),
  readFile(viteConfigPath, 'utf8'),
  readFile(probePath, 'utf8'),
  readFile(viewPath, 'utf8'),
  readFile(profileValidatorPath, 'utf8'),
  readFile(localDevScriptPath, 'utf8'),
])

const transpiled = ts.transpileModule(contractSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: contractPath,
  reportDiagnostics: true,
})
if ((transpiled.diagnostics ?? []).length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(
    transpiled.diagnostics,
    {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    },
  )
  throw new Error(`Unable to transpile performance session contract:\n${formatted}`)
}
const contractUrl =
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const contract = await import(contractUrl)

const routeRecoveryTranspiled = ts.transpileModule(routeRecoveryContractSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: routeRecoveryContractPath,
  reportDiagnostics: true,
})
if ((routeRecoveryTranspiled.diagnostics ?? []).length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(
    routeRecoveryTranspiled.diagnostics,
    {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    },
  )
  throw new Error(`Unable to transpile route recovery contract:\n${formatted}`)
}
const routeRecoveryUrl =
  `data:text/javascript;base64,${Buffer.from(routeRecoveryTranspiled.outputText).toString('base64')}`
const routeRecovery = await import(routeRecoveryUrl)

// Keep the audit runnable with the repository's default Node 20 as well as
// newer Node releases: execute the small, dependency-free helper after TS
// transpilation rather than relying on Node's newer type-stripping flag.
const serviceWorkerTranspiled = ts.transpileModule(serviceWorkerControllerChangeSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
  fileName: serviceWorkerControllerChangePath,
  reportDiagnostics: true,
})
if ((serviceWorkerTranspiled.diagnostics ?? []).length > 0) {
  throw new Error('Unable to transpile Service Worker controller-change contract')
}
const serviceWorkerUrl = `data:text/javascript;base64,${Buffer.from(serviceWorkerTranspiled.outputText).toString('base64')}`
const serviceWorker = await import(serviceWorkerUrl)

const routeStartedAt = 5000
const resourceCases = [
  {
    name: 'current route chunk',
    entry: {
      name: 'https://app.example/assets/VirtualChurchView-current.js',
      startTime: 5000,
    },
    expected: true,
  },
  {
    name: 'current 3D vendor',
    entry: {
      name: 'https://app.example/assets/vendor-3d-current.js',
      startTime: 5001,
    },
    expected: true,
  },
  {
    name: 'current lazy chunk just before route commit',
    entry: {
      name: 'https://app.example/assets/VirtualChurchView-current.js',
      startTime: 4800,
    },
    expected: true,
  },
  {
    name: 'current church asset',
    entry: {
      name: 'https://app.example/virtual-church-assets/buildings/church.glb',
      startTime: 5200,
    },
    expected: true,
  },
  {
    name: 'previous route church asset',
    entry: {
      name: 'https://app.example/virtual-church-assets/buildings/church.glb',
      startTime: 4200,
    },
    expected: false,
  },
  {
    name: 'unrelated current resource',
    entry: {
      name: 'https://app.example/assets/index-current.js',
      startTime: 5100,
    },
    expected: false,
  },
  ...['female', 'male'].flatMap((character) =>
    ['high', 'medium', 'low'].map((quality) => ({
      name: `current ${character} V14 ${quality} review GLB`,
      entry: {
        name: `https://app.example/__alife-review/virtual-church/character-hero-${character}-v14-${quality}.glb`,
        startTime: 5200,
      },
      expected: true,
    }))),
  {
    name: 'previous route review GLB',
    entry: {
      name: 'https://app.example/__alife-review/virtual-church/character-hero-male-v14-low.glb',
      startTime: 4200,
    },
    expected: false,
  },
  {
    name: 'review portrait is not a critical 3D resource',
    entry: {
      name: 'https://app.example/__alife-review/virtual-church/character-hero-male-v12-picker.webp',
      startTime: 5200,
    },
    expected: false,
  },
  {
    name: 'unrelated review endpoint',
    entry: {
      name: 'https://app.example/__alife-review/virtual-church/status.json',
      startTime: 5200,
    },
    expected: false,
  },
]

const errors = []

if (routeRecovery.VIRTUAL_CHURCH_RECOVERY_CLEANUP_TIMEOUT_MS !== 2500) {
  errors.push('route recovery cleanup timeout must remain bounded at 2500 ms')
}
if (routeRecovery.VIRTUAL_CHURCH_RECOVERY_NAVIGATION_GRACE_MS !== 1200) {
  errors.push('route recovery navigation grace must remain bounded at 1200 ms')
}

const recoveryCacheCases = [
  { name: 'Workbox application precache', cache: 'workbox-precache-v2-https://app.example/', expected: true },
  { name: 'current route code cache', cache: 'alife-virtual-church-code-gate-a-baseline-r9', expected: true },
  { name: 'older route code cache', cache: 'alife-virtual-church-code-v2', expected: true },
  { name: 'application shell cache', cache: 'alife-app-cache', expected: true },
  { name: 'application runtime cache', cache: 'alife-runtime-cache', expected: true },
  { name: 'large 3D asset cache', cache: 'alife-virtual-church-assets-gate-a-baseline-r9', expected: false },
  { name: 'similar cache name', cache: 'alife-virtual-church-codex-similar', expected: false },
  { name: 'unrelated image cache', cache: 'alife-image-cache', expected: false },
]
for (const testCase of recoveryCacheCases) {
  const actual = routeRecovery.virtualChurchRecoveryCacheIsAffected(testCase.cache)
  if (actual !== testCase.expected) {
    errors.push(
      `${testCase.name}: expected cache decision ${testCase.expected}, received ${actual}`,
    )
  }
}

const currentRecoveryPage =
  'https://app.example/alife/virtual-church?vcVisual=v3#hero'
const recoveryServiceWorkerCases = [
  {
    name: 'root application scope',
    scope: 'https://app.example/',
    expected: true,
  },
  {
    name: 'application base-path scope',
    scope: 'https://app.example/alife/',
    expected: true,
  },
  {
    name: 'unrelated same-origin scope',
    scope: 'https://app.example/admin-tools/',
    expected: false,
  },
  {
    name: 'deeper non-controlling scope',
    scope: 'https://app.example/alife/virtual-church/admin/',
    expected: false,
  },
  {
    name: 'cross-origin scope',
    scope: 'https://other.example/',
    expected: false,
  },
  {
    name: 'invalid scope',
    scope: 'not a valid URL',
    expected: false,
  },
]
for (const testCase of recoveryServiceWorkerCases) {
  const actual = routeRecovery.virtualChurchRecoveryServiceWorkerIsAffected(
    testCase.scope,
    currentRecoveryPage,
  )
  if (actual !== testCase.expected) {
    errors.push(
      `${testCase.name}: expected Service Worker decision ${testCase.expected}, received ${actual}`,
    )
  }
}

const originalRecoveryUrl =
  'https://app.example/virtual-church?vcVisual=v3&profile3d=1#hero'
const markedRecoveryUrl = routeRecovery.virtualChurchRecoveryNavigationUrl(
  originalRecoveryUrl,
  'attempt-fixed',
)
const markedRecoveryLocation = new URL(markedRecoveryUrl)
if (
  markedRecoveryLocation.searchParams.get('vcRecovery') !== 'attempt-fixed'
  || markedRecoveryLocation.searchParams.get('vcVisual') !== 'v3'
  || markedRecoveryLocation.searchParams.get('profile3d') !== '1'
  || markedRecoveryLocation.hash !== '#hero'
) {
  errors.push('route recovery navigation must add one marker and preserve the real URL')
}
if (
  routeRecovery.virtualChurchUrlWithoutRecoveryMarker(markedRecoveryUrl)
  !== originalRecoveryUrl
  || routeRecovery.virtualChurchUrlWithoutRecoveryMarker(originalRecoveryUrl)
  !== null
) {
  errors.push('successful route recovery must remove only its temporary marker')
}
if (
  !routeRecovery.virtualChurchRecoveryMarkerIsPresent(markedRecoveryUrl)
  || routeRecovery.virtualChurchRecoveryMarkerIsPresent(originalRecoveryUrl)
) {
  errors.push('route recovery marker detection must distinguish attempted navigation')
}

const recoveryStartCases = [
  {
    name: 'normal first automatic attempt',
    input: { force: false, markerPresent: false, storageAttempted: false, online: true },
    expected: true,
  },
  {
    name: 'stored automatic attempt blocks a loop',
    input: { force: false, markerPresent: false, storageAttempted: true, online: true },
    expected: false,
  },
  {
    name: 'storage unavailable first automatic attempt',
    input: { force: false, markerPresent: false, storageAttempted: null, online: true },
    expected: true,
  },
  {
    name: 'storage unavailable marker blocks a loop',
    input: { force: false, markerPresent: true, storageAttempted: null, online: true },
    expected: false,
  },
  {
    name: 'explicit retry overrides stored attempt',
    input: { force: true, markerPresent: true, storageAttempted: true, online: true },
    expected: true,
  },
  {
    name: 'explicitly offline automatic attempt preserves caches',
    input: { force: false, markerPresent: false, storageAttempted: false, online: false },
    expected: false,
  },
  {
    name: 'explicitly offline manual retry preserves caches',
    input: { force: true, markerPresent: true, storageAttempted: true, online: false },
    expected: false,
  },
]
for (const testCase of recoveryStartCases) {
  const actual = routeRecovery.virtualChurchRecoveryShouldStart(testCase.input)
  if (actual !== testCase.expected) {
    errors.push(
      `${testCase.name}: expected recovery start ${testCase.expected}, received ${actual}`,
    )
  }
}

for (const testCase of resourceCases) {
  const actual = contract.virtualChurchResourceBelongsToSession(
    testCase.entry,
    routeStartedAt,
  )
  if (actual !== testCase.expected) {
    errors.push(
      `${testCase.name}: expected ${testCase.expected}, received ${actual}`,
    )
  }
}

const elapsedCases = [
  { name: 'route start', timestamp: 5000, expected: 0 },
  { name: 'ready after route start', timestamp: 5325.5, expected: 325.5 },
  { name: 'stale ready timestamp', timestamp: 4999, expected: Number.NaN },
  { name: 'invalid timestamp', timestamp: Number.NaN, expected: Number.NaN },
]
for (const testCase of elapsedCases) {
  const actual = contract.virtualChurchSessionElapsedMs(
    testCase.timestamp,
    routeStartedAt,
  )
  const passed = Number.isNaN(testCase.expected)
    ? Number.isNaN(actual)
    : actual === testCase.expected
  if (!passed) {
    errors.push(
      `${testCase.name}: expected ${testCase.expected}, received ${actual}`,
    )
  }
}

const profileResourceCases = [
  {
    name: 'navigation route chunk before protected route commit',
    entry: {
      name: 'https://app.example/assets/VirtualChurchView-current.js',
      startTime: 100,
    },
    expected: true,
  },
  {
    name: 'navigation 3D vendor before protected route commit',
    entry: {
      name: 'https://app.example/assets/vendor-3d-current.js',
      startTime: 120,
    },
    expected: true,
  },
  {
    name: 'stale 3D asset before protected route commit',
    entry: {
      name: 'https://app.example/virtual-church-assets/buildings/church.glb',
      startTime: 100,
    },
    expected: false,
  },
]
for (const testCase of profileResourceCases) {
  const actual = contract.virtualChurchResourceBelongsToProfile(
    testCase.entry,
    routeStartedAt,
  )
  if (actual !== testCase.expected) {
    errors.push(
      `${testCase.name}: expected profile membership ${testCase.expected}, received ${actual}`,
    )
  }
}

const resourceElapsedCases = [
  { name: 'chunk starts just before route commit', timestamp: 4800, expected: 0 },
  { name: 'asset starts after route commit', timestamp: 5325.5, expected: 325.5 },
  { name: 'previous route resource', timestamp: 4749, expected: Number.NaN },
]
for (const testCase of resourceElapsedCases) {
  const actual = contract.virtualChurchResourceSessionElapsedMs(
    testCase.timestamp,
    routeStartedAt,
  )
  const passed = Number.isNaN(testCase.expected)
    ? Number.isNaN(actual)
    : actual === testCase.expected
  if (!passed) {
    errors.push(
      `${testCase.name}: expected resource elapsed ${testCase.expected}, received ${actual}`,
    )
  }
}

const requireSource = (source, fragment, label) => {
  if (!source.includes(fragment)) {
    errors.push(`${label}: missing ${JSON.stringify(fragment)}`)
  }
}
for (const fragment of [
  'const VirtualChurchRouteEntry = () => {',
  'useState(() => window.performance.now())',
  '<VirtualChurchView routeStartedAt={routeStartedAt} />',
  '<VirtualChurchRouteBoundary>',
  '<VirtualChurchRouteEntry />',
  'window.sessionStorage.removeItem(VIRTUAL_CHURCH_CHUNK_RECOVERY_KEY)',
  'virtualChurchUrlWithoutRecoveryMarker(window.location.href)',
  "window.history.replaceState(window.history.state, '', cleanUrl)",
]) {
  requireSource(routesSource, fragment, 'Route session start')
}
for (const fragment of [
  'virtualChurchChunkLoadFailed(error)',
  'storageAttempted: boolean | null = null',
  'virtualChurchRecoveryMarkerIsPresent(window.location.href)',
  'virtualChurchRecoveryShouldStart({',
  'online: navigator.onLine !== false',
  'window.sessionStorage.setItem(VIRTUAL_CHURCH_CHUNK_RECOVERY_KEY, \'true\')',
  'navigator.serviceWorker.getRegistrations()',
  'virtualChurchRecoveryServiceWorkerIsAffected(',
  'registration.scope',
  'const cleanupTasks: Promise<unknown>[] = []',
  'Promise.allSettled(',
  'await Promise.race([',
  'VIRTUAL_CHURCH_RECOVERY_CLEANUP_TIMEOUT_MS',
  'VIRTUAL_CHURCH_RECOVERY_NAVIGATION_GRACE_MS',
  'window.clearTimeout(cleanupTimeout)',
  '.filter(virtualChurchRecoveryCacheIsAffected)',
  'virtualChurchRecoveryInFlight = null',
  'window.sessionStorage.setItem(',
  'VIRTUAL_CHURCH_LAST_ERROR_KEY',
  'window.location.replace(virtualChurchRecoveryNavigationUrl(',
  'Date.now().toString(36)',
  'this.requestChunkRecovery(true)',
  'this.setState({ recoveryRequested: false })',
  'disabled={this.state.recoveryRequested || (chunkLoadError && this.state.offline)}',
  "window.addEventListener('online', this.updateConnectionState)",
  "window.addEventListener('offline', this.updateConnectionState)",
  'copy.offline',
  'copy.title',
  'copy.technicalDetails',
  'copy.cleanReload',
  "document.documentElement.lang.startsWith('zh') ? 'zh' : 'en'",
]) {
  requireSource(routeBoundarySource, fragment, 'Route white-screen recovery')
}
for (const fragment of [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
]) {
  requireSource(routeRecoveryContractSource, fragment, 'Route chunk-error classifier')
}
for (const fragment of [
  'if (import.meta.env.DEV) {',
  'return prepareDevelopmentServiceWorker({',
  'wasControlled: Boolean(navigator.serviceWorker.controller)',
  'navigator.serviceWorker.getRegistrations()',
  'await Promise.all(registrations.map((registration) => registration.unregister()))',
  'const keys = await caches.keys()',
  'await Promise.all(keys.map((key) => caches.delete(key)))',
  'getItem: key => sessionStorage.getItem(key)',
  'setItem: (key, value) => sessionStorage.setItem(key, value)',
  'removeItem: key => sessionStorage.removeItem(key)',
  'reload: () => window.location.reload()',
]) {
  requireSource(
    registerServiceWorkerSource,
    fragment,
    'Development Service Worker cleanup',
  )
}
for (const fragment of [
  "const DEVELOPMENT_CLEANUP_RELOAD_KEY = 'alife:dev-service-worker-cleanup-reload'",
  'await cleanup()',
  "wasControlled && storage.getItem(DEVELOPMENT_CLEANUP_RELOAD_KEY) !== 'done'",
  "storage.setItem(DEVELOPMENT_CLEANUP_RELOAD_KEY, 'done')",
  'reload()',
  'return false',
  'storage.removeItem(DEVELOPMENT_CLEANUP_RELOAD_KEY)',
  'onError(error)',
  'return true',
]) {
  requireSource(serviceWorkerControllerChangeSource, fragment, 'Development Service Worker mount gate')
}
const controllerEvents = []
const firstController = {}, replacementController = {}
const onControllerChange = serviceWorker.createServiceWorkerControllerChangeHandler(null, () => controllerEvents.push('reload'))
onControllerChange(firstController)
onControllerChange(replacementController)
onControllerChange({})
if (controllerEvents.join(',') !== 'reload') {
  errors.push('Development Service Worker behavior: first claim must not reload; a later replacement reloads once')
}
const cleanupEvents = [], stored = new Map()
const cleanupInputs = {
  wasControlled: true,
  cleanup: async () => { cleanupEvents.push('cleanup') },
  storage: {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => { stored.set(key, value) },
    removeItem: key => { stored.delete(key) },
  },
  reload: () => { cleanupEvents.push('reload') },
  onError: () => { cleanupEvents.push('error') },
}
const firstPreparation = await serviceWorker.prepareDevelopmentServiceWorker(cleanupInputs)
const secondPreparation = await serviceWorker.prepareDevelopmentServiceWorker(cleanupInputs)
if (firstPreparation !== false || secondPreparation !== true
  || cleanupEvents.join(',') !== 'cleanup,reload,cleanup' || stored.size !== 0) {
  errors.push('Development Service Worker behavior: controlled cleanup must reload before mount exactly once')
}
let cleanupFailureReported = false
const readyAfterCleanupFailure = await serviceWorker.prepareDevelopmentServiceWorker({
  ...cleanupInputs,
  cleanup: async () => { throw new Error('cache unavailable') },
  reload: () => { throw new Error('unexpected reload') },
  onError: () => { cleanupFailureReported = true },
})
if (readyAfterCleanupFailure !== true || !cleanupFailureReported) {
  errors.push('Development Service Worker behavior: cleanup failure must not strand the app blank')
}
let storageFailureReported = false
const readyAfterStorageFailure = await serviceWorker.prepareDevelopmentServiceWorker({
  ...cleanupInputs,
  storage: { ...cleanupInputs.storage, getItem: () => { throw new Error('storage denied') } },
  reload: () => { throw new Error('unexpected reload') },
  onError: () => { storageFailureReported = true },
})
if (readyAfterStorageFailure !== true || !storageFailureReported) {
  errors.push('Development Service Worker behavior: restricted storage must not strand the app blank')
}
for (const fragment of [
  'function Get-ListeningProcessIds {',
  'Get-NetTCPConnection -LocalPort $Port -State Listen',
  'netstat -ano -p tcp',
  'function Assert-FrontendFallbackPortIsFree {',
  'param([int]$Port = 5174)',
  'Alife requires the stable frontend origin http://localhost:5173 and will not reuse Vite fallback ports',
  'if (-not $SkipFrontend) {',
  'Assert-FrontendFallbackPortIsFree',
  '$processIds = @(Get-ListeningProcessIds -Port $Port)',
]) {
  requireSource(
    localDevScriptSource,
    fragment,
    'Local development frontend origin guard',
  )
}
for (const fragment of [
  "const networkOnly3DProfile = new URLSearchParams(window.location.search)",
  ".get('profile3dTransport') === 'network'",
  'const workerReady = networkOnly3DProfile || registerServiceWorker()',
  "if (typeof workerReady === 'boolean') {",
  'if (workerReady) renderApp()',
  'workerReady.then(shouldRender => { if (shouldRender) renderApp() })',
]) {
  requireSource(mainSource, fragment, 'Service Worker registration policy')
}
for (const fragment of [
  "name: 'alife-dev-no-store'",
  "pathname === '/sw.js'",
  "response.setHeader('Content-Type', 'text/javascript; charset=utf-8')",
  'self.registration.unregister()',
  'client.navigate(client.url)',
  "name.toLowerCase() === 'cache-control' ? 'no-store, max-age=0' : value",
  "response.setHeader('Cache-Control', 'no-store, max-age=0')",
  "response.setHeader('Pragma', 'no-cache')",
  "response.setHeader('Expires', '0')",
  'strictPort: true',
]) {
  requireSource(
    viteConfigSource,
    fragment,
    'Development origin and HTTP cache policy',
  )
}
if (viteConfigSource.includes('self.clients.claim()')) {
  errors.push('Development origin and HTTP cache policy: retiring worker must not claim unrelated tabs')
}
for (const fragment of [
  'routeStartedAt: number',
  'virtualChurchResourceBelongsToProfile(entry, routeStartedAt)',
  "criticalResourceTimelineOrigin: 'navigation'",
  'virtualChurchSessionElapsedMs(heroReadyAt, routeStartedAt)',
  'schemaVersion: 7',
  'routeStartedAtMs:',
  'routeSessionAgeAtSampleMs:',
]) {
  requireSource(probeSource, fragment, 'Performance session probe')
}
requireSource(
  viewSource,
  'routeStartedAt={routeStartedAt}',
  'Performance probe wiring',
)
requireSource(
  profileValidatorSource,
  'VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION',
  'Performance profile schema gate',
)

if (errors.length > 0) {
  throw new Error(
    `Virtual Church route-session validation failed:\n- ${errors.join('\n- ')}`,
  )
}

console.log(JSON.stringify({
  schemaVersion: 7,
  routeStartedBeforeLazyImport: true,
  resourceSessionStartGraceMs:
    contract.VIRTUAL_CHURCH_RESOURCE_SESSION_START_GRACE_MS,
  resourceCases: resourceCases.map(({ name, expected }) => ({ name, expected })),
  elapsedCases: elapsedCases.map(({ name, expected }) => ({
    name,
    expected: Number.isNaN(expected) ? 'NaN' : expected,
  })),
  priorRouteResourcesExcluded: true,
  heroReadyRelativeToRouteEntry: true,
  staleChunkRecovery: {
    oneAutomaticAttemptPerSession: true,
    independentServiceWorkerCleanup: true,
    onlyControllingServiceWorkerScopesUnregistered: true,
    serviceWorkerScopeCases: recoveryServiceWorkerCases.map(
      ({ name, expected }) => ({ name, expected }),
    ),
    staleWorkboxPrecacheCleared: true,
    affectedCodeCachesCleared: true,
    unaffected3DAssetCachePreserved: true,
    httpCacheBypassNavigation: true,
    temporaryMarkerRemovedAfterSuccess: true,
    storageUnavailableUsesNavigationMarkerGuard: true,
    explicitManualCleanRetry: true,
    explicitlyOfflinePreservesCaches: true,
    cleanupTimeoutMs: routeRecovery.VIRTUAL_CHURCH_RECOVERY_CLEANUP_TIMEOUT_MS,
    navigationGraceMs: routeRecovery.VIRTUAL_CHURCH_RECOVERY_NAVIGATION_GRACE_MS,
    retryUnlocksIfNavigationDoesNotComplete: true,
    developmentServiceWorkerCleanup: {
      unregistersExistingRegistrations: true,
      clearsCacheStorage: true,
      reloadsOnceWhenPreviouslyControlled: true,
      defersAppMountUntilCleanup: true,
      servesRetirementWorkerOnReusedDevelopmentOrigins: true,
      behavioralTestsPassed: true,
      developmentResponsesUseNoStore: true,
      developmentPortDriftRejected: true,
      networkOnlyProfileSkipsRegistration: true,
    },
    bilingualFallbackVisible: true,
    technicalErrorVisibleAndPersisted: true,
  },
  passed: true,
}, null, 2))
