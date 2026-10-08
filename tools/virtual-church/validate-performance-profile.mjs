import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { decodeVirtualChurchProfileCapture } from './performance-profile-capture.mjs'
import {
  VIRTUAL_CHURCH_PROFILE_RUNS_PER_SET,
  VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION,
  virtualChurchMedianProfile,
  virtualChurchProfileComparisonChecks,
  virtualChurchProfileQualityIsComplete,
  virtualChurchResourceTimingChecks,
  virtualChurchProfileSetChecks,
  virtualChurchProfileSamplingIsValid,
  virtualChurchProfileUsesFallback,
} from './performance-profile-contract.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const profilePaths = args.filter((argument) => !argument.startsWith('--'))
const baselineArguments = args.filter((argument) => argument.startsWith('--baseline='))
const allowFallback = args.includes('--allow-fallback')
const requireResourceTiming = args.includes('--require-resource-timing')

if (profilePaths.length === 0) {
  console.error(
    'Usage: node validate-performance-profile.mjs <profile.json|profile.log|-> [profile-run-2 profile-run-3] [--baseline=<profile.json|profile.log>]... [--allow-fallback] [--require-resource-timing]',
  )
  process.exit(2)
}
if (
  [...profilePaths, ...baselineArguments.map((argument) =>
    argument.slice('--baseline='.length))]
    .filter((path) => path === '-').length > 1
) {
  console.error('Only one profile may be read from stdin.')
  process.exit(2)
}

const readStdin = async () => {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

const parseProfile = async (path) => {
  const raw = (
    path === '-'
      ? await readStdin()
      : await readFile(resolve(path), 'utf8')
  ).trim()
  const marker = '[VirtualChurchProfile]'
  const markerIndex = raw.lastIndexOf(marker)
  const json = markerIndex >= 0 ? raw.slice(markerIndex + marker.length).trim() : raw
  return decodeVirtualChurchProfileCapture(JSON.parse(json))
}

const budgets = JSON.parse(
  await readFile(resolve(scriptDir, 'performance-budgets.json'), 'utf8'),
)
const profiles = (await Promise.all(profilePaths.map(parseProfile))).flat()
const baselines = (await Promise.all(baselineArguments.map((argument) =>
  parseProfile(argument.slice('--baseline='.length))))).flat()
const profileSetMode =
  profiles.length > 1
  || baselines.length > 1
let profile = profileSetMode
  ? virtualChurchMedianProfile(profiles)
  : profiles[0]
const presetName = profile.preset?.isMobile ? 'mobile' : 'desktop'
const target = budgets[presetName]
let failed = false

if (profileSetMode) {
  const profileSetChecks = virtualChurchProfileSetChecks(profiles, 'v3')
  for (const check of profileSetChecks) {
    if (!check.passed) failed = true
    console.log(
      `${check.passed ? 'PASS' : 'FAIL'} Current set ${check.name}: ${check.detail}`,
    )
  }
  console.log(
    `Current set aggregation: median of ${profiles.length} runs `
      + `(required ${VIRTUAL_CHURCH_PROFILE_RUNS_PER_SET})`,
  )
}

const rules = [
  {
    name: 'Diagnostic bandwidth',
    actual: profile.loading?.diagnosticNetwork?.kilobitsPerSecond,
    expected: target.network.kilobitsPerSecond,
    compare: (actual, expected) => actual === expected,
    format: (value) => `${value} kbps`,
    relation: '=',
  },
  {
    name: 'Diagnostic latency',
    actual: profile.loading?.diagnosticNetwork?.latencyMs,
    expected: target.network.latencyMs,
    compare: (actual, expected) => actual === expected,
    format: (value) => `${value} ms`,
    relation: '=',
  },
  {
    name: 'Hero ready',
    actual: profile.loading?.heroReadyMs,
    expected: target.heroReadyMsMax,
    compare: (actual, expected) => actual <= expected,
    format: (value) => `${value} ms`,
    relation: '≤',
  },
  {
    name: 'Average FPS',
    actual: profile.averageFps,
    expected: target.averageFpsMin,
    compare: (actual, expected) => actual >= expected,
    format: (value) => `${value} FPS`,
    relation: '≥',
  },
  {
    name: 'Visible triangles',
    actual: profile.render?.visibleTrianglesEstimate,
    expected: target.visibleTrianglesMax,
    compare: (actual, expected) => actual <= expected,
    format: (value) => Math.round(value).toLocaleString('en-NZ'),
    relation: '≤',
  },
  {
    name: 'Visible draw calls',
    actual: profile.render?.visibleDrawCallsEstimate,
    expected: target.visibleDrawCallsMax,
    compare: (actual, expected) => actual <= expected,
    format: (value) => Math.round(value).toLocaleString('en-NZ'),
    relation: '≤',
  },
  {
    name: 'Initial critical 3D body',
    actual: profile.loading?.initialCriticalEncodedBodySizeBytes,
    expected: target.initialCriticalEncodedBodySizeBytesMax,
    compare: (actual, expected) => actual <= expected,
    format: (value) => `${(value / 1024 / 1024).toFixed(2)} MiB`,
    relation: '≤',
  },
  {
    name: 'Estimated GPU memory',
    actual: profile.memory?.estimate?.totalBytes,
    expected: target.gpuMemoryEstimateBytesMax,
    compare: (actual, expected) => actual <= expected,
    format: (value) => `${(value / 1024 / 1024).toFixed(1)} MiB`,
    relation: '≤',
  },
]

console.log(
  `Virtual Church ${profile.visualVersion ?? 'unknown'} ${presetName} `
    + `${profileSetMode ? 'median profile set' : 'profile'} `
    + `(${Array.isArray(profile.sampledAt) ? profile.sampledAt.join(', ') : profile.sampledAt ?? 'unknown time'})`,
)

const schemaPassed =
  profile.schemaVersion === VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION
if (!schemaPassed) failed = true
console.log(
  `${schemaPassed ? 'PASS' : 'FAIL'} Profile schema: ${profile.schemaVersion ?? 'missing'} `
    + `(target ${VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION})`,
)

const normalAssetRun = !virtualChurchProfileUsesFallback(profile)
const qualityEvidencePassed = virtualChurchProfileQualityIsComplete(profile.preset)
if (!qualityEvidencePassed) failed = true
console.log(`${qualityEvidencePassed ? 'PASS' : 'FAIL'} Quality evidence: all preset dimensions required`)
if (!normalAssetRun && !allowFallback) failed = true
console.log(
  `${normalAssetRun || allowFallback ? 'PASS' : 'FAIL'} Asset fallback: `
    + `church=${profile.fallback?.church === true}, `
    + `character=${profile.fallback?.character === true}`
    + (allowFallback && !normalAssetRun ? ' (--allow-fallback diagnostic)' : ''),
)

const foregroundSampling = virtualChurchProfileSamplingIsValid(profile)
if (!foregroundSampling) failed = true
console.log(
  `${foregroundSampling ? 'PASS' : 'FAIL'} Foreground sampling: `
    + `cpuInstrumented=${Object.hasOwn(profile, 'cpuSubmissionDiagnostics')}, `
    + `startupInstrumented=${Object.hasOwn(profile?.loading ?? {}, 'startupPassTimings')}, `
    + `gpuInstrumented=${Object.hasOwn(profile, 'gpuTimingDiagnostics')}, `
    + `visibility=${profile.sampling?.documentVisibilityState ?? 'missing'}, `
    + `interruptions=${profile.sampling?.interruptionCount ?? 'missing'}, `
    + `maxGap=${profile.sampling?.maximumCallbackGapMs ?? 'missing'} ms`,
)

if (requireResourceTiming) {
  for (const [index, currentProfile] of profiles.entries()) {
    for (const check of virtualChurchResourceTimingChecks(currentProfile, target)) {
      if (!check.passed) failed = true
      console.log(
        `${check.passed ? 'PASS' : 'FAIL'} Resource Timing run ${index + 1} `
          + `${check.name}: ${check.detail}`,
      )
    }
  }
  for (const [index, baselineProfile] of baselines.entries()) {
    for (const check of virtualChurchResourceTimingChecks(baselineProfile)) {
      if (!check.passed) failed = true
      console.log(`${check.passed ? 'PASS' : 'FAIL'} Baseline Resource Timing run ${index + 1} ${check.name}: ${check.detail}`)
    }
  }
}

for (const rule of rules) {
  const actualIsNumber = Number.isFinite(rule.actual)
  const passed = actualIsNumber && rule.compare(rule.actual, rule.expected)
  if (!passed) failed = true
  console.log(
    `${passed ? 'PASS' : 'FAIL'} ${rule.name}: ${
      actualIsNumber ? rule.format(rule.actual) : 'missing'
    } (target ${rule.relation} ${rule.format(rule.expected)})`,
  )
}

if (baselineArguments.length > 0) {
  if (profileSetMode) {
    const baselineSetChecks = virtualChurchProfileSetChecks(baselines, 'v2')
    for (const check of baselineSetChecks) {
      if (!check.passed) failed = true
      console.log(
        `${check.passed ? 'PASS' : 'FAIL'} Baseline set ${check.name}: ${check.detail}`,
      )
    }
  }
  const baseline = profileSetMode
    ? virtualChurchMedianProfile(baselines)
    : baselines[0]
  const comparisonChecks = virtualChurchProfileComparisonChecks(
    profile,
    baseline,
  )
  for (const check of comparisonChecks) {
    if (!check.passed) failed = true
    console.log(
      `${check.passed ? 'PASS' : 'FAIL'} Baseline ${check.name}: ${check.detail}`,
    )
  }
  const comparable = comparisonChecks.every((check) => check.passed)
  const fpsRegression = baseline.averageFps > 0
    ? (baseline.averageFps - profile.averageFps) / baseline.averageFps
    : Number.POSITIVE_INFINITY
  const baselineP95 = baseline.frameTimeMs?.p95
  const currentP95 = profile.frameTimeMs?.p95
  const p95Increase = baselineP95 > 0
    ? (currentP95 - baselineP95) / baselineP95
    : Number.POSITIVE_INFINITY
  const fpsPassed =
    comparable
    && fpsRegression <= budgets.relativeGate.averageFpsRegressionMaxRatio
  const p95Passed =
    comparable
    && p95Increase <= budgets.relativeGate.p95FrameTimeIncreaseMaxRatio

  if (!fpsPassed || !p95Passed) failed = true
  console.log(
    `${fpsPassed ? 'PASS' : 'FAIL'} FPS regression: ${(fpsRegression * 100).toFixed(1)}% `
      + `(target ≤ ${(budgets.relativeGate.averageFpsRegressionMaxRatio * 100).toFixed(0)}%)`,
  )
  console.log(
    `${p95Passed ? 'PASS' : 'FAIL'} p95 frame-time increase: ${(p95Increase * 100).toFixed(1)}% `
      + `(target ≤ ${(budgets.relativeGate.p95FrameTimeIncreaseMaxRatio * 100).toFixed(0)}%)`,
  )
}

process.exitCode = failed ? 1 : 0
