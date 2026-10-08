import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const statusPath = resolve(appRoot, 'src', 'views', 'virtualChurchStatus.ts')
const contractPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchStatusContract.ts',
)
const accessibilityPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchAccessibility.ts',
)
const teleportPath = resolve(appRoot, 'src', 'views', 'virtualChurchTeleport.ts')
const normalizeSource = (source) => source.replace(/\r\n?/gu, '\n')

const [viewSource, statusSource, contractSource, accessibilitySource, teleportSource] =
  await Promise.all([
    readFile(viewPath, 'utf8').then(normalizeSource),
    readFile(statusPath, 'utf8').then(normalizeSource),
    readFile(contractPath, 'utf8').then(normalizeSource),
    readFile(accessibilityPath, 'utf8').then(normalizeSource),
    readFile(teleportPath, 'utf8').then(normalizeSource),
  ])

const errors = []
const requireSource = (source, fragment, label) => {
  if (!source.includes(fragment)) {
    errors.push(`${label}: missing ${JSON.stringify(fragment)}`)
  }
}

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
  throw new Error(`Unable to transpile status contract:\n${formatted}`)
}
const contractUrl =
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const contract = await import(contractUrl)

const baseSignals = {
  enabled: true,
  visualVersion: 'v3',
  entranceReady: true,
  characterReady: true,
  churchFallback: false,
  characterFallback: false,
}
const statusCases = [
  {
    name: 'disabled',
    signals: { ...baseSignals, enabled: false },
    expected: 'idle',
  },
  {
    name: 'v2 entrance pending',
    signals: {
      ...baseSignals,
      visualVersion: 'v2',
      entranceReady: false,
      characterReady: false,
    },
    expected: 'loading',
  },
  {
    name: 'v2 character pending',
    signals: {
      ...baseSignals,
      visualVersion: 'v2',
      characterReady: false,
    },
    expected: 'loading',
  },
  {
    name: 'v2 character ready',
    signals: { ...baseSignals, visualVersion: 'v2' },
    expected: 'ready',
  },
  {
    name: 'v3 character pending',
    signals: { ...baseSignals, characterReady: false },
    expected: 'loading',
  },
  {
    name: 'v3 hero ready',
    signals: baseSignals,
    expected: 'ready',
  },
  {
    name: 'church fallback',
    signals: { ...baseSignals, churchFallback: true },
    expected: 'degraded',
  },
  {
    name: 'v3 character fallback',
    signals: { ...baseSignals, characterFallback: true },
    expected: 'degraded',
  },
  {
    name: 'v2 reports deferred character fallback',
    signals: {
      ...baseSignals,
      visualVersion: 'v2',
      characterFallback: true,
    },
    expected: 'degraded',
  },
]
for (const testCase of statusCases) {
  const actual = contract.virtualChurchRuntimeStatus(testCase.signals)
  if (actual !== testCase.expected) {
    errors.push(
      `${testCase.name}: expected ${testCase.expected}, received ${actual}`,
    )
  }
}

for (const [visualVersion, enabled, status, expected] of [
  ['v3', true, 'idle', true],
  ['v3', true, 'loading', true],
  ['v3', true, 'ready', false],
  ['v3', true, 'degraded', false],
  ['v3', false, 'loading', false],
  ['v2', true, 'loading', false],
]) {
  const actual = contract.virtualChurchShouldCoverLoadingScene(visualVersion, enabled, status)
  if (actual !== expected) {
    errors.push(`loading cover ${visualVersion}/${enabled}/${status}: expected ${expected}, received ${actual}`)
  }
}

for (const fragment of [
  'new MutationObserver(updateStatus)',
  'VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE',
  'VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE',
  'VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE',
  'VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE',
  'return () => observer.disconnect()',
]) {
  requireSource(statusSource, fragment, 'Runtime status observer')
}

for (const fragment of [
  "loading3D: '正在准备教堂与角色…'",
  "ready3D: '教堂空间已准备好'",
  "degraded3D: '部分 3D 资产正在使用兼容显示'",
  "loading3D: 'Preparing the church and character…'",
  "ready3D: 'The church space is ready'",
  "degraded3D: 'Some 3D assets are using compatibility display'",
  'role="status"',
  'aria-live="polite"',
  'aria-atomic="true"',
  'motion-safe:animate-spin',
  '!visualSuppressed && (status === \'loading\' || status === \'degraded\')',
  'gateASafeArea',
  "'top-[calc(env(safe-area-inset-top)+6rem)] sm:top-24'",
  ": 'top-24'",
  'gateASafeArea={config3D.visualVersion === \'v3\'}',
  'visualSuppressed={nearEntranceInfoVisible || nearMainHallInfoVisible}',
  'useVirtualChurchRuntimeStatus(',
  'virtualChurchShouldCoverLoadingScene(config3D.visualVersion, interactive3DEnabled, runtimeStatus)',
  'data-vc-loading-cover="true"',
  "runtimeStatus === 'ready'",
  '<LandingDust triggerRef={dustTriggerRef} enabled={!reducedMotion} />',
  'if (!enabled && groupRef.current) {\n      groupRef.current.visible = false',
  'reducedMotion={reducedMotion}',
]) {
  requireSource(viewSource, fragment, 'Runtime status and motion wiring')
}

if (
  !/<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">[\s\S]*?<\/div>\s*\{!visualSuppressed && \(status === 'loading' \|\| status === 'degraded'\)/u
    .test(viewSource)
) {
  errors.push(
    'runtime status live region must remain outside the visually suppressed pill',
  )
}

const reducedLerpBranches =
  (viewSource.match(/virtualChurchCameraLerpFactor\(snapTeleportedCamera, reducedMotion,/gu) ?? []).length
if (reducedLerpBranches !== 3) {
  errors.push(
    `first/follow/showcase camera settling must respect reduced motion, received ${reducedLerpBranches}`,
  )
}
requireSource(teleportSource, 'snapToDestination || reducedMotion ? 1 : 1 - Math.exp(-followRate * deltaSeconds)', 'Camera reduced-motion helper')
const lostPointerCaptureHandlers =
  (viewSource.match(/onLostPointerCapture=\{stop/gu) ?? []).length
if (lostPointerCaptureHandlers !== 2) {
  errors.push(
    `camera and joystick must handle lost pointer capture, received ${lostPointerCaptureHandlers}`,
  )
}
const blurListeners =
  (viewSource.match(/window\.addEventListener\('blur'/gu) ?? []).length
const visibilityListeners =
  (viewSource.match(/document\.addEventListener\('visibilitychange'/gu) ?? []).length
const resizeListeners =
  (viewSource.match(/window\.addEventListener\('resize'/gu) ?? []).length
const orientationListeners =
  (viewSource.match(/window\.addEventListener\('orientationchange'/gu) ?? []).length
if (
  blurListeners !== 3
  || visibilityListeners !== 4
  || resizeListeners !== 3
  || orientationListeners !== 3
) {
  errors.push(
    `camera, joystick and keyboard must reset on blur/visibility/resize/orientation, received blur=${blurListeners}, visibility=${visibilityListeners}, resize=${resizeListeners}, orientation=${orientationListeners}`,
  )
}
for (const fragment of [
  "window.matchMedia('(prefers-reduced-motion: reduce)')",
  "media.addEventListener('change', update)",
  "media.removeEventListener('change', update)",
]) {
  requireSource(accessibilitySource, fragment, 'Reduced-motion preference')
}

if (errors.length > 0) {
  throw new Error(
    `Virtual Church status/motion validation failed:\n- ${errors.join('\n- ')}`,
  )
}

console.log(JSON.stringify({
  statusCases: statusCases.map(({ name, expected }) => ({ name, expected })),
  bilingualAnnouncements: ['loading', 'ready', 'degraded'],
  liveRegion: {
    roleStatus: true,
    polite: true,
    atomic: true,
    preservedWhenVisualStatusHidden: true,
  },
  visualStatus: {
    hiddenBehindNearEntranceInformation: true,
    gateATopSafeAreaAware: true,
    v2TopPositionPreserved: true,
  },
  reducedMotion: {
    livePreferenceUpdates: true,
    automaticCameraSettlingDisabled: true,
    landingDustDisabled: true,
    loadingSpinnerMotionSafe: true,
  },
  inputCancellation: {
    surfaces: ['camera drag', 'movement joystick', 'keyboard'],
    pointerCaptureLoss: true,
    windowBlur: true,
    documentHidden: true,
    windowResize: true,
    orientationChange: true,
  },
  passed: true,
}, null, 2))
