import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import {
  VIRTUAL_CHURCH_PROFILE_RUNS_PER_SET,
  VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION,
  virtualChurchMedian,
  virtualChurchMedianProfile,
  virtualChurchProfileComparisonChecks,
  virtualChurchProfileSetChecks,
} from './performance-profile-contract.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const validatorPath = resolve(scriptDir, 'validate-performance-profile.mjs')
const probePath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'views',
  'VirtualChurchPerformanceProbe.tsx',
)
const viewPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'views',
  'VirtualChurchView.tsx',
)
const [validatorSource, probeSource, viewSource] = await Promise.all([
  readFile(validatorPath, 'utf8').then(source => source.replace(/\r\n?/g, '\n')),
  readFile(probePath, 'utf8').then(source => source.replace(/\r\n?/g, '\n')),
  readFile(viewPath, 'utf8').then(source => source.replace(/\r\n?/g, '\n')),
])

const baseProfile = {
  schemaVersion: VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION,
  visualVersion: 'v3',
  sampledAt: '2026-07-30T00:00:00.000Z',
  averageFps: 60,
  sampling: {
    documentVisibilityState: 'visible',
    maximumCallbackGapMs: 20,
    interruptionCount: 0,
    uninterruptedForeground: true,
  },
  frameTimeMs: { p50: 16.5, p95: 18, max: 24 },
  fallback: { church: false, character: false },
  loading: {
    diagnosticTransport: 'network',
    diagnosticNetwork: {
      kilobitsPerSecond: 20000,
      latencyMs: 100,
    },
    heroReadyMs: 3000,
    initialCriticalEncodedBodySizeBytes: 4 * 1024 * 1024,
  },
  render: {
    visibleTrianglesEstimate: 200000,
    visibleDrawCallsEstimate: 70,
  },
  memory: {
    estimate: { totalBytes: 128 * 1024 * 1024 },
  },
  preset: {
    isMobile: false,
    maxTextureResolution: 2048,
    shadowQuality: 'high',
    shadowMapSize: 2048,
    antiAliasing: 'smaa',
    lodDistances: { tree: 50, detail: 30, building: 120 },
    postProcessing: true,
    glassTransmission: true,
    maxDevicePixelRatio: 1.1,
    vrSupport: false,
  },
  drawingBuffer: { width: 1280, height: 720, pixelRatio: 1.1 },
  camera: {
    mode: 'showcase',
    position: [42, 6.5, 12],
    quaternion: [0, 0, 0, 1],
    fov: 47,
  },
  environment: {
    userAgent: 'Alife validation browser',
    hardwareConcurrency: 8,
    deviceMemoryGiB: 8,
    webGlRenderer: 'WebGL 2',
  },
}
const baseBaseline = {
  ...baseProfile,
  visualVersion: 'v2',
}

const clone = (value) => structuredClone(value)
const invalidCases = [
  ['current schema', (current) => { current.schemaVersion = 5 }],
  ['baseline schema', (_current, baseline) => { baseline.schemaVersion = 5 }],
  ['visual direction', (current) => { current.visualVersion = 'v2' }],
  ['quality preset', (current) => { current.preset.isMobile = true }],
  ['anti-aliasing preset', (current) => { current.preset.antiAliasing = 'fxaa' }],
  ['LOD preset', (current) => { current.preset.lodDistances.tree = 25 }],
  ['drawing-buffer width', (current) => { current.drawingBuffer.width = 390 }],
  ['drawing-buffer DPR', (current) => { current.drawingBuffer.pixelRatio = 1 }],
  ['transport', (current) => { current.loading.diagnosticTransport = 'pwa' }],
  ['network bandwidth', (current) => { current.loading.diagnosticNetwork.kilobitsPerSecond = 10000 }],
  ['network latency', (current) => { current.loading.diagnosticNetwork.latencyMs = 150 }],
  ['camera mode', (current) => { current.camera.mode = 'follow' }],
  ['camera position', (current) => { current.camera.position[0] += 0.06 }],
  ['camera orientation', (current) => { current.camera.quaternion = [0, 0.1, 0, 0.995] }],
  ['camera field of view', (current) => { current.camera.fov = 50 }],
  ['browser', (current) => { current.environment.userAgent = 'Different browser' }],
  ['hardware', (current) => { current.environment.hardwareConcurrency = 4 }],
  ['device memory', (current) => { current.environment.deviceMemoryGiB = 4 }],
  ['renderer', (current) => { current.environment.webGlRenderer = 'Different GPU' }],
  ['current fallback', (current) => { current.fallback.church = true }],
  ['baseline fallback', (_current, baseline) => { baseline.fallback.character = true }],
  ['background sampling', (current) => { current.sampling.interruptionCount = 1 }],
  ['current CPU instrumentation', (current) => { current.cpuSubmissionDiagnostics = null }],
  ['baseline CPU instrumentation', (_current, baseline) => { baseline.cpuSubmissionDiagnostics = null }],
  ['current GPU instrumentation', (current) => { current.gpuTimingDiagnostics = null }],
  ['baseline GPU instrumentation', (_current, baseline) => { baseline.gpuTimingDiagnostics = null }],
]

// Two equally incomplete or malformed reports must not count as matched quality.
for (const field of Object.keys(baseProfile.preset)) {
  invalidCases.push([`both missing quality ${field}`, (current, baseline) => {
    delete current.preset[field]
    delete baseline.preset[field]
  }])
}
for (const [field, value] of [['shadowQuality', 'unknown'], ['antiAliasing', 'unknown'], ['vrSupport', 'false'], ['maxTextureResolution', 0], ['shadowMapSize', NaN], ['maxDevicePixelRatio', -1], ['lodDistances', { tree: 0, detail: 30, building: 120 }]]) {
  invalidCases.push([`both invalid quality ${field}`, (current, baseline) => {
    current.preset[field] = value
    baseline.preset[field] = value
  }])
}

const errors = []
const validChecks = virtualChurchProfileComparisonChecks(
  clone(baseProfile),
  clone(baseBaseline),
)
if (!validChecks.every((check) => check.passed)) {
  errors.push(
    `valid v2/v3 pair failed: ${JSON.stringify(validChecks.filter((check) => !check.passed))}`,
  )
}

const v3Runs = [
  { ...clone(baseProfile), sampledAt: '2026-07-30T00:00:01.000Z', averageFps: 55, loading: { ...baseProfile.loading, heroReadyMs: 3200 } },
  { ...clone(baseProfile), sampledAt: '2026-07-30T00:00:02.000Z', averageFps: 60, loading: { ...baseProfile.loading, heroReadyMs: 3000 } },
  { ...clone(baseProfile), sampledAt: '2026-07-30T00:00:03.000Z', averageFps: 5, loading: { ...baseProfile.loading, heroReadyMs: 9000 } },
]
const v2Runs = [0, 1, 2].map((index) => ({
  ...clone(baseBaseline),
  sampledAt: `2026-07-30T00:01:0${index}.000Z`,
  averageFps: 60,
  frameTimeMs: { ...baseBaseline.frameTimeMs, p95: 18 },
}))
const validCurrentSetChecks = virtualChurchProfileSetChecks(v3Runs, 'v3')
const validBaselineSetChecks = virtualChurchProfileSetChecks(v2Runs, 'v2')
if (
  !validCurrentSetChecks.every((check) => check.passed)
  || !validBaselineSetChecks.every((check) => check.passed)
) {
  errors.push('valid three-run profile sets failed consistency checks')
}
if (virtualChurchMedian([55, 60, 5]) !== 55) {
  errors.push('median contract did not reject a single low outlier')
}
const medianCurrent = virtualChurchMedianProfile(v3Runs)
if (
  medianCurrent?.averageFps !== 55
  || medianCurrent?.loading?.heroReadyMs !== 3200
  || medianCurrent?.profileSet?.runs !== VIRTUAL_CHURCH_PROFILE_RUNS_PER_SET
) {
  errors.push(`median profile aggregation drifted: ${JSON.stringify(medianCurrent)}`)
}
if (
  virtualChurchProfileSetChecks(v3Runs.slice(0, 2), 'v3')
    .find((check) => check.name === 'Run count')?.passed !== false
) {
  errors.push('two-run profile set was accepted')
}
const mismatchedRunSet = clone(v3Runs)
mismatchedRunSet[1].environment.webGlRenderer = 'Different GPU'
if (
  virtualChurchProfileSetChecks(mismatchedRunSet, 'v3')
    .every((check) => check.passed)
) {
  errors.push('profile set with a different GPU was accepted')
}

for (const [name, mutate] of invalidCases) {
  const current = clone(baseProfile)
  const baseline = clone(baseBaseline)
  mutate(current, baseline)
  const checks = virtualChurchProfileComparisonChecks(current, baseline)
  if (checks.every((check) => check.passed)) {
    errors.push(`${name}: incompatible profiles were accepted`)
  }
}

const runCli = (args) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(process.execPath, [validatorPath, ...args], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  child.on('error', rejectRun)
  child.on('close', (code) => resolveRun({ code, output }))
})

const tempRoot = await mkdtemp(join(tmpdir(), 'alife-vc-profile-'))
try {
  const currentPath = join(tempRoot, 'current-v3.json')
  const baselinePath = join(tempRoot, 'baseline-v2.json')
  const invalidBaselinePath = join(tempRoot, 'baseline-schema-5.json')
  const incompleteQualityPath = join(tempRoot, 'current-v3-incomplete-quality.json')
  const incompleteQuality = clone(baseProfile)
  delete incompleteQuality.preset.antiAliasing
  const invalidBaseline = clone(baseBaseline)
  invalidBaseline.schemaVersion = 5
  const currentRunPaths = v3Runs.map((_profile, index) =>
    join(tempRoot, `current-v3-run-${index + 1}.json`))
  const baselineRunPaths = v2Runs.map((_profile, index) =>
    join(tempRoot, `baseline-v2-run-${index + 1}.json`))
  const mismatchedRunPath = join(tempRoot, 'current-v3-run-2-mismatched.json')
  const regressionRunPaths = [0, 1, 2].map((index) =>
    join(tempRoot, `current-v3-regression-${index + 1}.json`))
  const regressionRuns = [40, 40, 60].map((averageFps, index) => ({
    ...clone(baseProfile),
    sampledAt: `2026-07-30T00:02:0${index}.000Z`,
    averageFps,
  }))
  await Promise.all([
    writeFile(currentPath, JSON.stringify(baseProfile), 'utf8'),
    writeFile(baselinePath, JSON.stringify(baseBaseline), 'utf8'),
    writeFile(invalidBaselinePath, JSON.stringify(invalidBaseline), 'utf8'),
    writeFile(incompleteQualityPath, JSON.stringify(incompleteQuality), 'utf8'),
    ...currentRunPaths.map((path, index) =>
      writeFile(path, JSON.stringify(v3Runs[index]), 'utf8')),
    ...baselineRunPaths.map((path, index) =>
      writeFile(path, JSON.stringify(v2Runs[index]), 'utf8')),
    writeFile(
      mismatchedRunPath,
      JSON.stringify(mismatchedRunSet[1]),
      'utf8',
    ),
    ...regressionRunPaths.map((path, index) =>
      writeFile(path, JSON.stringify(regressionRuns[index]), 'utf8')),
  ])

  const validRun = await runCli([
    currentPath,
    `--baseline=${baselinePath}`,
  ])
  if (validRun.code !== 0) {
    errors.push(`valid CLI pair exited ${validRun.code}:\n${validRun.output}`)
  }

  const incompleteSingleRun = await runCli([incompleteQualityPath])
  if (incompleteSingleRun.code !== 1 || !incompleteSingleRun.output.includes('FAIL Quality evidence')) {
    errors.push(`incomplete standalone quality report was accepted (exit ${incompleteSingleRun.code})`)
  }

  const invalidRun = await runCli([
    currentPath,
    `--baseline=${invalidBaselinePath}`,
  ])
  if (
    invalidRun.code !== 1
    || !invalidRun.output.includes('FAIL Baseline Baseline schema')
  ) {
    errors.push(
      `invalid CLI pair was not rejected clearly (exit ${invalidRun.code}):\n${invalidRun.output}`,
    )
  }

  const baselineRunArguments = baselineRunPaths.map((path) =>
    `--baseline=${path}`)
  const validSetRun = await runCli([
    ...currentRunPaths,
    ...baselineRunArguments,
  ])
  if (
    validSetRun.code !== 0
    || !validSetRun.output.includes('Current set aggregation: median of 3 runs')
  ) {
    errors.push(
      `valid CLI profile sets failed (exit ${validSetRun.code}):\n${validSetRun.output}`,
    )
  }

  const shortSetRun = await runCli([
    ...currentRunPaths.slice(0, 2),
    ...baselineRunArguments,
  ])
  if (
    shortSetRun.code !== 1
    || !shortSetRun.output.includes('FAIL Current set Run count')
  ) {
    errors.push(
      `two-run CLI set was not rejected clearly (exit ${shortSetRun.code}):\n${shortSetRun.output}`,
    )
  }

  const mismatchSetRun = await runCli([
    currentRunPaths[0],
    mismatchedRunPath,
    currentRunPaths[2],
    ...baselineRunArguments,
  ])
  if (
    mismatchSetRun.code !== 1
    || !mismatchSetRun.output.includes(
      'FAIL Current set Run 2 Browser and device class',
    )
  ) {
    errors.push(
      `mismatched CLI environment was not rejected clearly (exit ${mismatchSetRun.code}):\n${mismatchSetRun.output}`,
    )
  }

  const regressionSetRun = await runCli([
    ...regressionRunPaths,
    ...baselineRunArguments,
  ])
  if (
    regressionSetRun.code !== 1
    || !regressionSetRun.output.includes('FAIL FPS regression')
  ) {
    errors.push(
      `median regression was not rejected clearly (exit ${regressionSetRun.code}):\n${regressionSetRun.output}`,
    )
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

for (const [source, fragment, label] of [
  [probeSource, 'schemaVersion: 7', 'Performance probe schema'],
  [viewSource, 'enabled={profile3DEnabled && !dialogOpen}', 'Do not profile dialog overlays'],
  [probeSource, 'if (enabled && !reportedRef.current) invalidate()', 'Wake demand rendering when profiling resumes'],
  [probeSource, 'document.documentElement.removeAttribute(VIRTUAL_CHURCH_SAMPLING_ATTRIBUTE)', 'Clear transient sampling diagnostics'],
  [probeSource, 'if (!enabled) {\n      if (warmupStartedAtRef.current !== null) samplingInterruptionCountRef.current += 1\n      warmupStartedAtRef.current = null\n      samplingStartedAtRef.current = null\n      frameCountRef.current = 0\n      frameTimesRef.current.length = 0\n      lastFrameAtRef.current = null\n      maximumCallbackGapMsRef.current = 0\n      return', 'Discard partial samples when dialogs open'],
  [probeSource, "const hiddenDocument = document.visibilityState !== 'visible'", 'Hidden-document guard'],
  [probeSource, 'const interruptedActiveSample = callbackGapMs > 250', 'Foreground callback-gap guard'],
  [probeSource, 'if (hiddenDocument || interruptedActiveSample)', 'Foreground sample restart'],
  [viewSource, 'cameraMode={cameraMode}', 'Camera mode wiring'],
  [probeSource, 'webGlRenderer:', 'Renderer evidence'],
  [probeSource, 'hardwareConcurrency:', 'Device-class evidence'],
  [probeSource, 'shadowQuality: preset.shadowQuality', 'Shadow-quality evidence'],
  [probeSource, 'antiAliasing: preset.antiAliasing', 'Anti-aliasing evidence'],
  [probeSource, 'lodDistances: { ...preset.lodDistances }', 'LOD-budget evidence'],
  [probeSource, 'vrSupport: preset.vrSupport', 'VR-budget evidence'],
  [validatorSource, 'virtualChurchProfileComparisonChecks(', 'CLI comparison gate'],
  [validatorSource, 'const comparable = comparisonChecks.every', 'Relative metric guard'],
  [validatorSource, 'virtualChurchProfileSetChecks(', 'Three-run set gate'],
  [validatorSource, 'virtualChurchMedianProfile(', 'Median aggregation'],
]) {
  if (!source.includes(fragment)) {
    errors.push(`${label}: missing ${JSON.stringify(fragment)}`)
  }
}

if (errors.length > 0) {
  throw new Error(
    `Virtual Church profile-comparison validation failed:\n- ${errors.join('\n- ')}`,
  )
}

console.log(JSON.stringify({
  schemaVersion: VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION,
  validPairs: 1,
  cliValidPairExitCode: 0,
  cliInvalidPairExitCode: 1,
  runsPerSet: VIRTUAL_CHURCH_PROFILE_RUNS_PER_SET,
  medianRejectsSingleOutlier: true,
  cliValidSetExitCode: 0,
  cliShortSetExitCode: 1,
  cliMismatchedSetExitCode: 1,
  cliRegressionSetExitCode: 1,
  rejectedPairs: invalidCases.map(([name]) => name),
  requiredMatchDimensions: validChecks.map((check) => check.name),
  fallbackCanBeRelativeBaseline: false,
  passed: true,
}, null, 2))
