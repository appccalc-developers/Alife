import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import {
  VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION,
  virtualChurchResourceTimingChecks,
} from './performance-profile-contract.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const probePath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'views',
  'VirtualChurchPerformanceProbe.tsx',
)
const validatorPath = resolve(scriptDir, 'validate-performance-profile.mjs')
const [probeSource, validatorSource] = await Promise.all([
  readFile(probePath, 'utf8'),
  readFile(validatorPath, 'utf8'),
])

const timeline = [
  ['/assets/VirtualChurchView-test.js', 0, 4, 10, true],
  ['/assets/vendor-3d-test.js', 0.2, 5, 12, true],
  ['/virtual-church-assets/v3/releases/gate-a-baseline-r9/buildings/church-hero.glb', 13, 15, 100, true],
  ['/virtual-church-assets/v3/releases/gate-a-baseline-r9/characters/character-hero-female-medium.glb', 13.2, 16, 90, true],
  ['/virtual-church-assets/v3/releases/gate-a-baseline-r9/textures/church-material-atlas-basecolor.png', 14, 18, 80, true],
  ['/virtual-church-assets/draco/draco_decoder.wasm', 14.2, 20, 60, true],
].map(([path, startMs, responseStartMs, responseEndMs, initial], index) => ({
  sequence: index + 1,
  path,
  initiatorType: 'fetch',
  startMs,
  responseStartMs,
  responseEndMs,
  durationMs: responseEndMs - startMs,
  transferSizeBytes: 1024,
  encodedBodySizeBytes: 724,
  serviceWorkerIntercepted: false,
  initial,
}))

const baseProfile = {
  schemaVersion: VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION,
  visualVersion: 'v3',
  sampledAt: '2026-08-13T00:00:00.000Z',
  averageFps: 60,
  sampling: {
    documentVisibilityState: 'visible',
    maximumCallbackGapMs: 20,
    interruptionCount: 0,
    uninterruptedForeground: true,
  },
  fallback: { church: false, character: false },
  frameTimeMs: { p50: 16, p95: 18, max: 24 },
  loading: {
    diagnosticTransport: 'network',
    diagnosticNetwork: { kilobitsPerSecond: 20000, latencyMs: 100 },
    heroReadyMs: 3000,
    initialCriticalEncodedBodySizeBytes: 4 * 1024 * 1024,
    criticalResourceCount: timeline.length,
    criticalResourceTimeline: timeline,
  },
  render: {
    visibleTrianglesEstimate: 200000,
    visibleDrawCallsEstimate: 70,
  },
  memory: { estimate: { totalBytes: 128 * 1024 * 1024 } },
  preset: { isMobile: false },
}

const clone = (value) => structuredClone(value)
const errors = []
const validChecks = virtualChurchResourceTimingChecks(baseProfile)
if (!validChecks.every((check) => check.passed)) {
  errors.push(`valid timeline failed: ${JSON.stringify(validChecks.filter((check) => !check.passed))}`)
}

const invalidCases = [
  ['duplicate path', (profile) => {
    profile.loading.criticalResourceTimeline.push({
      ...profile.loading.criticalResourceTimeline.at(-1),
      sequence: profile.loading.criticalResourceTimeline.length + 1,
      startMs: 15,
      responseStartMs: 21,
      responseEndMs: 61,
    })
    profile.loading.criticalResourceCount += 1
  }, 'No duplicate critical request paths'],
  ['retired Wizard', (profile) => {
    profile.loading.criticalResourceTimeline.push({
      ...profile.loading.criticalResourceTimeline.at(-1),
      sequence: profile.loading.criticalResourceTimeline.length + 1,
      path: '/virtual-church-assets/characters/wizard.gltf',
      startMs: 15,
      responseStartMs: 21,
      responseEndMs: 61,
    })
    profile.loading.criticalResourceCount += 1
  }, 'Retired characters excluded from V3'],
  ['wrong Hero LOD', (profile) => {
    profile.loading.criticalResourceTimeline[3].path =
      '/virtual-church-assets/v3/releases/gate-a-baseline-r9/characters/character-hero-female-high.glb'
  }, 'Selected character asset only'],
  ['Service Worker interception', (profile) => {
    profile.loading.criticalResourceTimeline[2].serviceWorkerIntercepted = true
  }, 'Declared direct-network transport'],
  ['chunk finishes after GLB starts', (profile) => {
    profile.loading.criticalResourceTimeline[1].responseEndMs = 20
  }, 'Chunks precede selected GLBs'],
  ['selected character is deferred', (profile) => {
    profile.loading.criticalResourceTimeline[3].initial = false
  }, 'Selected asset timing'],
]

for (const [name, mutate, rejectedCheck] of invalidCases) {
  const profile = clone(baseProfile)
  mutate(profile)
  const checks = virtualChurchResourceTimingChecks(profile)
  if (checks.find((check) => check.name === rejectedCheck)?.passed !== false) {
    errors.push(`${name}: ${rejectedCheck} did not reject the invalid timeline`)
  }
}

const v2Profile = clone(baseProfile)
v2Profile.visualVersion = 'v2'
v2Profile.loading.criticalResourceTimeline[2].path =
  '/virtual-church-assets/buildings/church-hero.glb'
v2Profile.loading.criticalResourceTimeline[3].path =
  '/virtual-church-assets/characters/believer-woman.gltf'
v2Profile.loading.criticalResourceTimeline[3].initial = false
const v2TimingCheck = virtualChurchResourceTimingChecks(v2Profile)
  .find((check) => check.name === 'Selected asset timing')
if (v2TimingCheck?.passed !== true) {
  errors.push('V2 intentionally delayed legacy character was rejected')
}
v2Profile.loading.criticalResourceTimeline[3].initial = true
if (virtualChurchResourceTimingChecks(v2Profile)
  .find((check) => check.name === 'Selected asset timing')?.passed !== false) {
  errors.push('V2 character incorrectly counted as initial')
}

for (const requiredSource of [
  'criticalResourceTimeline',
  'initiatorType',
  'sequence: index + 1',
]) {
  if (!probeSource.includes(requiredSource)) {
    errors.push(`performance probe does not emit ${requiredSource}`)
  }
}
if (!validatorSource.includes('--require-resource-timing')) {
  errors.push('performance CLI does not expose the Resource Timing gate')
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

const tempRoot = await mkdtemp(join(tmpdir(), 'alife-vc-resource-timing-'))
try {
  const validPath = join(tempRoot, 'valid.json')
  const invalidPath = join(tempRoot, 'invalid.json')
  const invalidProfile = clone(baseProfile)
  invalidProfile.loading.criticalResourceTimeline[3].path =
    '/virtual-church-assets/characters/wizard.gltf'
  await Promise.all([
    writeFile(validPath, JSON.stringify(baseProfile)),
    writeFile(invalidPath, JSON.stringify(invalidProfile)),
  ])
  const validRun = await runCli([validPath, '--require-resource-timing'])
  if (validRun.code !== 0) {
    errors.push(`CLI rejected valid Resource Timing evidence: ${validRun.output}`)
  }
  const invalidRun = await runCli([invalidPath, '--require-resource-timing'])
  if (invalidRun.code === 0) {
    errors.push('CLI accepted a Resource Timing timeline with the retired Wizard path')
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

if (errors.length > 0) {
  console.error(JSON.stringify({ errors, passed: false }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  schemaVersion: VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION,
  timelineEntries: timeline.length,
  checks: validChecks.map((check) => check.name),
  invalidCases: invalidCases.map(([name]) => name),
  cliRequiresResourceTimingFlag: true,
  passed: true,
}, null, 2))
