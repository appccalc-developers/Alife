import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const contractPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchRecoveryContract.ts',
)
const normalizeSource = (source) => source.replace(/\r\n?/gu, '\n')

const [viewSource, contractSource] = await Promise.all([
  readFile(viewPath, 'utf8').then(normalizeSource),
  readFile(contractPath, 'utf8').then(normalizeSource),
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
  throw new Error(`Unable to transpile recovery contract:\n${formatted}`)
}
const contractUrl =
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const contract = await import(contractUrl)

const baseSignals = {
  webGlAvailable: true,
  webGlLost: true,
  automaticRecoveryAttempted: false,
  diagnosticFailureMode: null,
  documentVisible: true,
}
const recoveryCases = [
  { name: 'real visible context loss', signals: baseSignals, expected: true },
  {
    name: 'healthy context',
    signals: { ...baseSignals, webGlLost: false },
    expected: false,
  },
  {
    name: 'WebGL unavailable',
    signals: { ...baseSignals, webGlAvailable: false },
    expected: false,
  },
  {
    name: 'automatic recovery already attempted',
    signals: { ...baseSignals, automaticRecoveryAttempted: true },
    expected: false,
  },
  {
    name: 'diagnostic context loss',
    signals: { ...baseSignals, diagnosticFailureMode: 'context-loss' },
    expected: false,
  },
  {
    name: 'diagnostic WebGL unavailable',
    signals: { ...baseSignals, diagnosticFailureMode: 'webgl-unavailable' },
    expected: false,
  },
  {
    name: 'hidden document',
    signals: { ...baseSignals, documentVisible: false },
    expected: false,
  },
]

const contextLossDiagnosticCases = [
  { mode: null, expected: 0 },
  { mode: 'context-loss', expected: 1 },
  { mode: 'context-loss-repeat', expected: 2 },
  { mode: 'webgl-unavailable', expected: 0 },
  { mode: 'character-glb', expected: 0 },
]

const contextLossReportingCases = [
  { name: 'visible current canvas', connected: true, current: true, expected: true },
  { name: 'detached old canvas', connected: false, current: false, expected: false },
  { name: 'superseded canvas still attached', connected: true, current: false, expected: false },
]

const errors = []
for (const testCase of recoveryCases) {
  const actual = contract.virtualChurchShouldAutomaticallyRecover(
    testCase.signals,
  )
  if (actual !== testCase.expected) {
    errors.push(
      `${testCase.name}: expected ${testCase.expected}, received ${actual}`,
    )
  }
}
for (const testCase of contextLossDiagnosticCases) {
  const actual = contract.virtualChurchContextLossDiagnosticLimit(testCase.mode)
  if (actual !== testCase.expected) {
    errors.push(
      `diagnostic ${testCase.mode ?? 'none'}: expected ${testCase.expected} context losses, received ${actual}`,
    )
  }
}
for (const testCase of contextLossReportingCases) {
  const actual = contract.virtualChurchShouldReportContextLoss(testCase.connected, testCase.current)
  if (actual !== testCase.expected) {
    errors.push(`${testCase.name}: expected context-loss report ${testCase.expected}, received ${actual}`)
  }
}

const requireSource = (fragment, label) => {
  if (!viewSource.includes(fragment)) {
    errors.push(`${label}: missing ${JSON.stringify(fragment)}`)
  }
}
for (const [fragment, label] of [
  ['key={canvasSessionKey}', 'Canvas session remount'],
  ['setCanvasSessionKey((session) => session + 1)', 'Session increment'],
  ['clearVirtualChurchRuntimeSignals()\n    setSceneRuntimeError(null)\n    const available = supportsWebGl()', 'Signal cleanup before capability recheck'],
  ['setWebGlAvailable(available)', 'Capability state refresh'],
  ['automaticRecoveryAttemptedRef.current = true', 'One-shot automatic recovery'],
  ['window.setTimeout(retryWebGl, 900)', 'Controlled recovery delay'],
  ["document.visibilityState === 'visible'", 'Visible-document guard'],
  ["window.addEventListener('pageshow', onPageShow)", 'BFCache restore listener'],
  ['event.persisted && webGlLost', 'BFCache loss guard'],
  ['contextLossInjectionCountRef.current < contextLossDiagnosticLimit', 'Bounded context-loss diagnostic'],
  ['contextLossInjectionCountRef.current += 1', 'Diagnostic injection count'],
  ['virtualChurchShouldReportContextLoss(canvasConnected, canvasIsCurrent)', 'Ignore detached or superseded Canvas release'],
  ['onClick={retryWebGl}', 'Manual retry action'],
  ["contextLostTitle: '教堂空间需要重新载入'", 'Chinese recovery title'],
  ["contextLostTitle: 'The church space needs to reload'", 'English recovery title'],
  ["retry3D: '重新载入 3D'", 'Chinese retry label'],
  ["retry3D: 'Reload 3D'", 'English retry label'],
  ['sceneRuntimeError\n                ? virtualChurchChunkLoadFailed(sceneRuntimeError)', 'Chunk-conflict failure classification'],
  ['? t.chunkConflictTitle\n                  : t.sceneErrorTitle', 'Distinct chunk and scene failure titles'],
  ['webGlLost\n                  ? t.contextLostTitle', 'Context-loss failure title'],
  ['<VirtualChurchCanvasBoundary', 'Canvas-level recovery boundary'],
  ['setSceneRuntimeError(virtualChurchRuntimeErrorMessage(error))', 'Visible scene error evidence'],
]) {
  requireSource(fragment, label)
}

const resizeListeners =
  (viewSource.match(/window\.addEventListener\('resize'/gu) ?? []).length
const orientationListeners =
  (viewSource.match(/window\.addEventListener\('orientationchange'/gu) ?? []).length
if (resizeListeners !== 3 || orientationListeners !== 3) {
  errors.push(
    `camera, joystick and keyboard must cancel input on viewport changes, received resize=${resizeListeners}, orientation=${orientationListeners}`,
  )
}

if (errors.length > 0) {
  throw new Error(
    `Virtual Church recovery validation failed:\n- ${errors.join('\n- ')}`,
  )
}

console.log(JSON.stringify({
  recoveryCases: recoveryCases.map(({ name, expected }) => ({ name, expected })),
  contextLossDiagnosticCases,
  contextLossReportingCases: contextLossReportingCases.map(({ name, expected }) => ({ name, expected })),
  automaticRecoveryAttempts: 1,
  manualRetry: true,
  canvasRuntimeRetry: true,
  visibleSceneErrorEvidence: true,
  bfcacheRecovery: true,
  diagnosticInjectionAttempts: {
    single: 1,
    repeated: 2,
  },
  viewportInputCancellation: {
    surfaces: ['camera drag', 'movement joystick', 'keyboard'],
    resize: true,
    orientationChange: true,
  },
  passed: true,
}, null, 2))
