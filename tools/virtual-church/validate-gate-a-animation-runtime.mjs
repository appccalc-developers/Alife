import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'
import { AnimationMixer, AnimationClip, NumberKeyframeTrack, Object3D } from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const helperPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'views',
  'virtualChurchCharacterAnimation.ts',
)
const contractPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'views',
  'virtualChurchCharacterAnimationContract.json',
)
const viewPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'views',
  'VirtualChurchView.tsx',
)
const inputDiagnosticPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'views',
  'virtualChurchInputDiagnostic.ts',
)
const heroManifestPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
  'v3',
  'releases',
  'gate-a-baseline-r9',
  'characters',
  'character-hero-female.manifest.json',
)

const [
  helperSource,
  contractSource,
  viewSource,
  inputDiagnosticSource,
  heroManifestSource,
] = await Promise.all([
  readFile(helperPath, 'utf8'),
  readFile(contractPath, 'utf8'),
  readFile(viewPath, 'utf8').then((source) => source.replace(/\r\n?/g, '\n')),
  readFile(inputDiagnosticPath, 'utf8'),
  readFile(heroManifestPath, 'utf8'),
])
const contract = JSON.parse(contractSource)
const heroManifest = JSON.parse(heroManifestSource)
const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: helperPath,
  reportDiagnostics: true,
})
const diagnostics = transpiled.diagnostics ?? []
if (diagnostics.length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => repoRoot,
    getNewLine: () => '\n',
  })
  throw new Error(`Unable to transpile Gate A animation runtime helper:\n${formatted}`)
}

const helperUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const helper = await import(helperUrl)
const transpiledInputDiagnostic = ts.transpileModule(inputDiagnosticSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: inputDiagnosticPath,
  reportDiagnostics: true,
})
if ((transpiledInputDiagnostic.diagnostics ?? []).length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(
    transpiledInputDiagnostic.diagnostics,
    {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    },
  )
  throw new Error(`Unable to transpile locomotion diagnostic helper:\n${formatted}`)
}
const inputDiagnosticUrl = `data:text/javascript;base64,${Buffer.from(transpiledInputDiagnostic.outputText).toString('base64')}`
const inputDiagnostic = await import(inputDiagnosticUrl)
const errors = []
// Execute the actual controller's vertical-physics block, not a duplicate
// physics model. A tolerant grounded check used to skip Jump_Land when a
// descending frame entered the last 2 cm above the ground.
const verticalStart = viewSource.indexOf('    let verticalVelocity = verticalVelocityRef.current')
const verticalEnd = viewSource.indexOf('    if (!groundedAfterPhysics)', verticalStart)
if (verticalStart < 0 || verticalEnd < verticalStart) throw new Error('Vertical controller block not found')
const verticalStep = new Function('context', `
  const { player, input, verticalVelocityRef, takeoffTimerRef, landingTimerRef,
    groundHeightAt, dustTriggerRef, clampedDelta, TAKEOFF_DURATION, LANDING_DURATION,
    JUMP_VELOCITY, GRAVITY, gateAAnimationPhaseRemainingSeconds } = context;
  ${viewSource.slice(verticalStart, verticalEnd)}
  return { landedThisFrame, groundedAfterPhysics, takeoffStartedThisFrame };
`)
const controllerConstant = (name) => {
  const match = viewSource.match(new RegExp(`const ${name} = ([\\d.]+)`))
  if (!match) throw new Error(`Missing vertical controller constant ${name}`)
  return Number(match[1])
}
const verticalFixture = (hz, groundY = 0, height = groundY, velocity = 0) => ({
  player: { position: { x: 0, y: height, z: 0 } }, input: { jumpQueued: false },
  verticalVelocityRef: { current: velocity }, takeoffTimerRef: { current: 0 },
  landingTimerRef: { current: 0 }, groundHeightAt: () => groundY,
  dustTriggerRef: { current: null }, clampedDelta: 1 / hz,
  TAKEOFF_DURATION: controllerConstant('TAKEOFF_DURATION'),
  LANDING_DURATION: controllerConstant('LANDING_DURATION'),
  JUMP_VELOCITY: controllerConstant('JUMP_VELOCITY'), GRAVITY: controllerConstant('GRAVITY'),
  gateAAnimationPhaseRemainingSeconds: helper.gateAAnimationPhaseRemainingSeconds,
})
const verticalLandingCases = []
for (const hz of [20, 30, 60, 90, 120, 144, 240]) {
  for (const groundY of [0, 0.3, -0.4]) {
    const edge = verticalFixture(hz, groundY, groundY + 0.01, -3)
    const edgeResult = verticalStep(edge)
    if (!edgeResult.landedThisFrame || edge.landingTimerRef.current !== edge.LANDING_DURATION) {
      errors.push(`Landing skipped in final 1 cm at ${hz} Hz / ground ${groundY}`)
    }
    // Ground-following without falling velocity must retain its tolerance:
    // small terrain changes are not a fresh jump/landing on every step.
    for (const offset of [-0.01, 0, 0.01]) {
      const walking = verticalFixture(hz, groundY, groundY + offset)
      const result = verticalStep(walking)
      if (result.landedThisFrame || !result.groundedAfterPhysics
        || walking.player.position.y !== groundY || walking.landingTimerRef.current !== 0) {
        errors.push(`Ground-following falsely lands at ${hz} Hz / offset ${offset}`)
      }
    }
    const jump = verticalFixture(hz, groundY)
    jump.input.jumpQueued = true
    let landings = 0
    let airborneFrames = 0
    let landingFrames = 0
    for (let frame = 0; frame < hz * 2; frame += 1) {
      const result = verticalStep(jump)
      if (result.landedThisFrame) landings += 1
      if (!result.groundedAfterPhysics) airborneFrames += 1
      if (jump.landingTimerRef.current > 0) landingFrames += 1
    }
    if (landings !== 1 || airborneFrames === 0 || landingFrames < Math.ceil(jump.LANDING_DURATION * hz)
      || jump.player.position.y !== groundY || jump.verticalVelocityRef.current !== 0) {
      errors.push(`Jump does not land exactly once and settle at ${hz} Hz / ground ${groundY}`)
    }
    verticalLandingCases.push({ hz, groundY, landings, airborneFrames, landingFrames })
  }
}
if (errors.length > 0) throw new Error(errors.join('\n'))
const gaitEntryCases = []
for (const hz of [20, 30, 60, 120]) {
  for (const direction of ['walk-run', 'run-walk']) {
    const root = new Object3D()
    const mixer = new AnimationMixer(root)
    const walk = mixer.clipAction(new AnimationClip('Walk', 31 / 30, [new NumberKeyframeTrack('.position[x]', [0, 31 / 30], [0, 0])]))
    const run = mixer.clipAction(new AnimationClip('Run', 22 / 30, [new NumberKeyframeTrack('.position[x]', [0, 22 / 30], [1, 1])]))
    const outgoing = direction === 'walk-run' ? walk : run
    const incoming = direction === 'walk-run' ? run : walk
    outgoing.play(); mixer.update(1 / hz)
    // Reproduce the previously missed initial state: the destination exists
    // in the cache with effective weight 1, but has never been scheduled.
    if (incoming.getEffectiveWeight() !== 1 || incoming.isScheduled()) errors.push('first-entry fixture invalid')
    const walkWeight = helper.gateAReviewContributingActionWeight(walk)
    const runWeight = helper.gateAReviewContributingActionWeight(run)
    const fromWalkWeight = walkWeight / (walkWeight + runWeight)
    if (fromWalkWeight !== (direction === 'walk-run' ? 1 : 0)) errors.push('unplayed destination contributes a phantom gait pose')
    incoming.reset().setEffectiveWeight(1).play()
    const frame = helper.gateAReviewGaitBlendFrame({fromWalkWeight, toWalkWeight: direction === 'walk-run' ? 0 : 1, remaining: .18, duration: .18}, 1 / hz, 2, 31 / 30, 22 / 30, 1.6022, 3.0531)
    walk.setEffectiveWeight(frame.walkWeight); run.setEffectiveWeight(frame.runWeight)
    mixer.update(1 / hz)
    const q = (1 / hz) / .18, expectedTransition = q * q * (3 - 2 * q)
    const expectedX = direction === 'walk-run' ? expectedTransition : 1 - expectedTransition
    if (Math.abs(root.position.x - expectedX) > 1e-10) errors.push('first gait frame jumps past smooth transition')
    incoming.setEffectiveWeight(.4).setEffectiveTimeScale(0); mixer.update(1 / hz)
    if (incoming.isRunning() || helper.gateAReviewContributingActionWeight(incoming) !== .4) errors.push('held zero-speed pose discarded')
    incoming.paused = true; mixer.update(1 / hz)
    if (helper.gateAReviewContributingActionWeight(incoming) !== .4) errors.push('paused scheduled pose discarded')
    incoming.enabled = false
    if (helper.gateAReviewContributingActionWeight(incoming) !== 0) errors.push('disabled pose counted before next mixer update')
    outgoing.stop()
    if (helper.gateAReviewContributingActionWeight(outgoing) !== 0) errors.push('stopped cached action still contributes')
    mixer.stopAllAction(); mixer.uncacheRoot(root)
    gaitEntryCases.push({hz,direction,fromWalkWeight,firstFrameRunWeight:frame.runWeight})
  }
}
if (helper.gateAReviewContributingActionWeight(undefined) !== 0) errors.push('missing gait action must contribute zero')
const gaitBlendCases = []
for (const [character, walkSpeed, runSpeed] of [['female', 1.5497, 4.1015], ['male', 1.6022, 3.0531]]) {
  for (const hz of [20, 30, 60, 120]) {
    for (const direction of ['walk-run', 'run-walk', 'interrupted']) {
      const mixer = new AnimationMixer(new Object3D())
      const walk = mixer.clipAction(new AnimationClip('Walk', 31 / 30, [])).play()
      const run = mixer.clipAction(new AnimationClip('Run', 22 / 30, [])).play()
      const toWalk = direction === 'run-walk' ? 1 : 0
      walk.time = .375 * walk.getClip().duration
      run.time = .375 * run.getClip().duration
      walk.setEffectiveWeight(1 - toWalk)
      run.setEffectiveWeight(toWalk)
      let blend = { fromWalkWeight: 1 - toWalk, toWalkWeight: toWalk, remaining: .18, duration: .18 }
      let maximumPhaseError = 0, frames = 0, reversed = false
      while (blend.remaining > 1e-10) {
        const delta = Math.min(1 / hz, blend.remaining)
        if (direction === 'interrupted' && !reversed && blend.remaining < .1) {
          const currentWeight = walk.getEffectiveWeight()
          blend = { fromWalkWeight: currentWeight, toWalkWeight: 1, remaining: .18, duration: .18 }
          const unchanged = helper.gateAReviewGaitBlendFrame(blend, 0, 2, 31 / 30, 22 / 30, walkSpeed, runSpeed)
          if (Math.abs(unchanged.walkWeight - currentWeight) > 1e-10) errors.push('gait reversal snaps current weight')
          reversed = true
        }
        const speed = .5 * (walkSpeed + runSpeed)
        const result = helper.gateAReviewGaitBlendFrame(blend, delta, speed,
          walk.getClip().duration, run.getClip().duration, walkSpeed, runSpeed)
        walk.setEffectiveWeight(result.walkWeight).setEffectiveTimeScale(result.walkRate)
        run.setEffectiveWeight(result.runWeight).setEffectiveTimeScale(result.runRate)
        mixer.update(delta)
        const phase = walk.time / walk.getClip().duration - run.time / run.getClip().duration
        maximumPhaseError = Math.max(maximumPhaseError, Math.abs(phase - Math.round(phase)))
        const blendedSpeed = walk.getEffectiveWeight() * walkSpeed * walk.getEffectiveTimeScale()
          + run.getEffectiveWeight() * runSpeed * run.getEffectiveTimeScale()
        if (Math.abs(blendedSpeed - speed) > 1e-9) errors.push('gait blend cadence disagrees with calibrated speed')
        if (Math.abs(walk.getEffectiveWeight() + run.getEffectiveWeight() - 1) > 1e-10) errors.push('gait weights not normalized')
        blend.remaining = result.remaining
        if (++frames > 100) throw new Error('gait blend did not finish')
      }
      if (maximumPhaseError > 1e-10) errors.push(`gait phase drift ${character}/${hz}/${direction}`)
      // Interrupting the two weighted sides must not leave an old loop visible.
      walk.fadeOut(.1); run.fadeOut(.1)
      mixer.update(.11)
      if (walk.getEffectiveWeight() !== 0 || run.getEffectiveWeight() !== 0) errors.push('gait interruption leaves a ghost loop')
      walk.reset().setEffectiveWeight(1).fadeIn(.08).play()
      mixer.update(.09)
      if (walk.getEffectiveWeight() !== 1) errors.push('a completed zero-weight loop cannot resume')
      mixer.stopAllAction()
      mixer.uncacheRoot(mixer.getRoot())
      gaitBlendCases.push({ character, hz, direction, maximumPhaseError, frames })
    }
  }
}
for (const usage of ['const reviewGaitCrossfade = usesDistanceMatchedMotion && syncLocomotionPhase',
  "const currentWalkWeight = gateAReviewContributingActionWeight(actions.get('Walk'))",
  "const currentRunWeight = gateAReviewContributingActionWeight(actions.get('Run'))",
  'gateAReviewGaitBlendFrame(', 'walkAction.setEffectiveWeight(frame.walkWeight).setEffectiveTimeScale(frame.walkRate)',
  'runAction.setEffectiveWeight(frame.runWeight).setEffectiveTimeScale(frame.runRate)',
  'if (usesDistanceMatchedMotion) action.setEffectiveWeight(1)',
  "actions.get('Walk')?.fadeOut(transitionSeconds)", "actions.get('Run')?.fadeOut(transitionSeconds)"]) {
  if (!viewSource.includes(usage)) errors.push(`Missing gait blend integration: ${usage}`)
}
const playerControllerStart = viewSource.indexOf('const PlayerController =')
const playerControllerSource = viewSource.slice(playerControllerStart, viewSource.indexOf('\nconst ', playerControllerStart + 1))
if (!playerControllerSource.includes('input.diagnosticElapsedMs += clampedDelta * 1000')) {
  errors.push('diagnostic time must advance in the shared player controller, not a particular avatar renderer')
}
const reviewTransitionTravel = []
const speedBlendCases = [[2.78, 3.0531], [3.0531, 1.6022], [1.6022, 3.0531], [0.4, 4.1015]]
for (const [from, to] of speedBlendCases) {
  for (const hz of [20, 30, 60, 120]) {
    let remaining = .18, distance = 0, elapsed = 0, previousSpeed = from
    while (remaining > 1e-10) {
      const delta = 1 / hz
      const result = helper.gateAReviewSpeedBlendStep(from, to, remaining, delta)
      const speed = result.distance / delta
      if (speed < Math.min(from, to) - 1e-9 || speed > Math.max(from, to) + 1e-9) {
        errors.push(`speed blend lost momentum or overshot: ${speed}`)
      }
      if ((to - from) * (speed - previousSpeed) < -1e-9) errors.push('speed blend is not monotone')
      previousSpeed = speed
      distance += result.distance
      remaining = result.remaining
      elapsed += delta
    }
    const expected = (from + to) * .18 / 2 + to * (elapsed - .18)
    if (Math.abs(distance - expected) > 1e-9) errors.push(`speed blend distance differs at ${hz} Hz`)
  }
}
if (helper.gateAReviewSpeedBlendStep(2.78, 3.0531, .18, 1 / 60).distance * 60 < 2.78) {
  errors.push('resuming a brake resets its velocity')
}
let continuousElapsed = 0
for (const segment of inputDiagnostic.VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC_SEGMENTS) {
  const value = inputDiagnostic.virtualChurchLocomotionDiagnosticInputAt(continuousElapsed, true, true)
  if (value.phase !== segment.phase || value.keyboardZ !== segment.keyboardZ || value.sprint !== segment.sprint) {
    errors.push(`continuous input segment ${segment.phase} not exercised`)
  }
  continuousElapsed += segment.durationMs
}
if (continuousElapsed !== 12360 || !inputDiagnostic.virtualChurchLocomotionDiagnosticInputAt(12360, true, true).complete) {
  errors.push('continuous input must finish with neutral controls at 12360 ms')
}
const cadenceSource = viewSource.slice(viewSource.indexOf('const gateACharacterWalkSpeed ='),
  viewSource.indexOf('const clearFailedGltfAsset ='))
const cadenceJs = ts.transpileModule(cadenceSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2023 },
}).outputText
const selectedCadence = new Function('gateALocomotionPlaybackScale',
  'gateAReviewLocomotionPlaybackScale',
  `${cadenceJs}; return selectedGateALocomotionPlaybackScale`)(
  helper.gateALocomotionPlaybackScale, helper.gateAReviewLocomotionPlaybackScale)
const reviewCadenceCases = []
for (const [character, animation, authoredSpeed] of [
  ['female-v14', 'Walk', 1.5497], ['female-v14', 'Run', 4.1015],
  ['male-v14', 'Walk', 1.6022], ['male-v14', 'Run', 3.0531],
]) {
  for (const intensity of [0, 0.05, 0.25, 0.5, 0.82, 1]) {
    for (const alignment of [0.55, 0.75, 1]) {
      const speed = authoredSpeed * intensity * alignment
      // Execute the actual page selector, not just its helper. Deliberately
      // keep requested input at 1 to catch a return to input-based cadence.
      const rate = selectedCadence(character, animation, 1, speed, true)
      if (Math.abs(rate * authoredSpeed - speed) > 1e-10) {
        errors.push(`review cadence disagrees with travelled speed: ${speed}/${authoredSpeed}`)
      }
      reviewCadenceCases.push({ character, animation, intensity, alignment, rate })
    }
  }
}
for (const [animation, authoredSpeed] of [['Walk', 1.5497], ['Run', 4.1015]]) {
  for (const intensity of [0, 0.25, 0.5, 1]) {
    const travelledSpeed = authoredSpeed * intensity
    if (selectedCadence(null, animation, 1, travelledSpeed, true) !== intensity) {
      errors.push('released V3 cadence must match actual travelled distance')
    }
    if (selectedCadence(null, animation, intensity, 0, false)
      !== helper.gateALocomotionPlaybackScale(animation, intensity)) {
      errors.push('legacy cadence changed while enabling released V3 motion')
    }
  }
}
for (const clip of ['Walk_Start', 'Run_Start', 'Walk_Stop', 'Run_Stop']) {
  if (selectedCadence('male-v14', clip, 0.5, 0.5, true) !== 1) {
    errors.push('authored transition time must not be rescaled as a loop')
  }
}
for (const [speed, authored] of [[NaN, 1], [1, 0], [-1, 1], [Infinity, 1]]) {
  if (helper.gateAReviewLocomotionPlaybackScale(speed, authored) !== 0) {
    errors.push('invalid review cadence must be stationary')
  }
}
for (const usage of ['input.travelledSpeedMps = lastTranslationSpeedRef.current',
  'motion.travelledSpeedMps,', 'movementRef.current.travelledSpeedMps = 0']) {
  if (!viewSource.includes(usage)) errors.push(`Missing actual-travel cadence integration: ${usage}`)
}
for (const [character, walkSpeed, runSpeed] of [
  ['female', 1.5497, 4.1015], ['male', 1.6022, 3.0531],
]) {
  for (const [clip, duration, speed, stopping] of [
    ['Walk_Start', 0.6, walkSpeed, false], ['Walk_Stop', 0.8, walkSpeed, true],
    ['Run_Start', 0.4, runSpeed, false], ['Run_Stop', 0.85, runSpeed, true],
  ]) {
    // Independent quadrature of velocity 3q²−2q³, not the runtime integral.
    let reference = 0
    for (let i = 0; i < 10000; i += 1) {
      const q = (i + 0.5) / 10000
      const velocity = 3 * q * q - 2 * q * q * q
      reference += speed * duration / 10000 * (stopping ? 1 - velocity : velocity)
    }
    for (const hz of [20, 30, 60, 120]) {
      let remaining = duration
      let distance = 0
      while (remaining > 1e-10) {
        const step = helper.gateAReviewTransitionStepDistance(remaining, duration, speed, 1 / hz, stopping)
        if (step < 0 || step > speed / hz + 1e-9) errors.push(`${clip}: unsafe step ${step}`)
        distance += step
        remaining = Math.max(0, remaining - 1 / hz)
      }
      if (Math.abs(distance - reference) > 1e-8) errors.push(`${character} ${clip} ${hz} Hz: ${distance} != ${reference}`)
    }
    reviewTransitionTravel.push({ character, clip, metres: Number(reference.toFixed(6)) })
  }
}
for (const args of [[0, .8, 2, .02, true], [.8, 0, 2, .02, true], [.8, .8, NaN, .02, true], [.8, .8, 2, -1, true]]) {
  if (helper.gateAReviewTransitionStepDistance(...args) !== 0) errors.push('invalid review transition must not move')
}
for (const [previous, next, duration, expected] of [
  ['Walk_Start', 'Walk', 1.2, .45], ['Run_Start', 'Run', .8, .3],
  ['Walk_Stop', 'Idle_A', 2, 0], ['Walk', 'Run', .8, 0],
]) {
  if (Math.abs(helper.gateAReviewLoopJoinTime(previous, next, duration) - expected) > 1e-9) {
    errors.push(`wrong authored loop join: ${previous} -> ${next}`)
  }
}
for (const [elapsed, expected] of [[2600, 'walk-stop'], [3699, 'walk-stop'], [3700, 'run'], [4900, 'run-stop'], [6049, 'run-stop'], [6050, 'turn-45-pulse'], [9849, 'turn-180-settle'], [9850, 'complete']]) {
  if (inputDiagnostic.virtualChurchLocomotionDiagnosticInputAt(elapsed, true).phase !== expected) {
    errors.push(`candidate diagnostic truncates its full stop at ${elapsed}`)
  }
}
if (heroManifest.coordinateSystem?.forwardAxis !== '+Z') {
  errors.push(`released V3 hero forward axis is ${heroManifest.coordinateSystem?.forwardAxis}, expected +Z`)
}
const expectedStateMapping = {
  idle: 'Idle_A',
  walkStart: 'Walk_Start',
  walk: 'Walk',
  walkStop: 'Walk_Stop',
  runStart: 'Run_Start',
  run: 'Run',
  runStop: 'Run_Stop',
  takeoff: 'Jump_Start',
  jump: 'Jump_Loop',
  fall: 'Jump_Loop',
  land: 'Jump_Land',
  turnLeft: 'Turn_L',
  turnRight: 'Turn_R',
  greet: 'Greet',
}
for (const [state, expected] of Object.entries(expectedStateMapping)) {
  const actual = helper.gateAAnimationForMotionState(state, 'Idle_A')
  if (actual !== expected) errors.push(`${state} maps to ${actual}, expected ${expected}`)
}
if (helper.gateAAnimationForMotionState('idle', 'Idle_B') !== 'Idle_B') {
  errors.push('idle variant B is not preserved')
}

const cardinalFacingCases = [
  { direction: [0, 1], expected: 0 },
  { direction: [1, 0], expected: Math.PI / 2 },
  { direction: [0, -1], expected: Math.PI },
  { direction: [-1, 0], expected: -Math.PI / 2 },
]
for (const { direction, expected } of cardinalFacingCases) {
  const v3Yaw = helper.gateAAvatarYawForMovement(
    direction[0],
    direction[1],
    '+Z',
  )
  const v2Yaw = helper.gateAAvatarYawForMovement(
    direction[0],
    direction[1],
    '-Z',
  )
  const v3Delta = Math.atan2(Math.sin(v3Yaw - expected), Math.cos(v3Yaw - expected))
  const expectedV2 = expected + Math.PI
  const v2Delta = Math.atan2(Math.sin(v2Yaw - expectedV2), Math.cos(v2Yaw - expectedV2))
  if (Math.abs(v3Delta) > 1e-9) {
    errors.push(`V3 +Z avatar faces ${v3Yaw} for ${direction}, expected ${expected}`)
  }
  if (Math.abs(v2Delta) > 1e-9) {
    errors.push(`V2 -Z avatar faces ${v2Yaw} for ${direction}, expected ${expectedV2}`)
  }
}

const locomotionAlignmentCases = [
  { yawDelta: 0, expectedAlignment: 1, canTranslate: true },
  { yawDelta: Math.PI / 4, expectedAlignment: Math.SQRT1_2, canTranslate: true },
  { yawDelta: Math.PI / 3, expectedAlignment: 0.5, canTranslate: false },
  { yawDelta: Math.PI / 2, expectedAlignment: 0, canTranslate: false },
  { yawDelta: Math.PI, expectedAlignment: 0, canTranslate: false },
]
for (const testCase of locomotionAlignmentCases) {
  const alignment = helper.gateALocomotionFacingAlignment(0, testCase.yawDelta)
  const canTranslate = helper.gateALocomotionCanTranslate(alignment)
  if (Math.abs(alignment - testCase.expectedAlignment) > 1e-9) {
    errors.push(
      `locomotion alignment for ${testCase.yawDelta} rad is ${alignment}, expected ${testCase.expectedAlignment}`,
    )
  }
  if (canTranslate !== testCase.canTranslate) {
    errors.push(
      `locomotion translation for ${testCase.yawDelta} rad is ${canTranslate}, expected ${testCase.canTranslate}`,
    )
  }
}
if (helper.gateALocomotionCanTranslate(Number.NaN)) {
  errors.push('non-finite locomotion alignment must not allow translation')
}

const locomotionPhaseCases = [
  { previousTime: 0, previousDuration: 1, nextDuration: 0.8, expected: 0 },
  { previousTime: 0.25, previousDuration: 1, nextDuration: 0.8, expected: 0.2 },
  { previousTime: 0.75, previousDuration: 1, nextDuration: 0.8, expected: 0.6 },
  { previousTime: 1.25, previousDuration: 1, nextDuration: 0.8, expected: 0.2 },
  { previousTime: -0.25, previousDuration: 1, nextDuration: 0.8, expected: 0.6 },
]

const locomotionDiagnosticCases = [
  { elapsedMs: -1, phase: 'idle', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 0, phase: 'idle', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 399, phase: 'idle', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 400, phase: 'walk', keyboardX: 0, keyboardZ: -1, sprint: false, complete: false },
  { elapsedMs: 2599, phase: 'walk', keyboardX: 0, keyboardZ: -1, sprint: false, complete: false },
  { elapsedMs: 2600, phase: 'walk-stop', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 3099, phase: 'walk-stop', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 3100, phase: 'run', keyboardX: 0, keyboardZ: -1, sprint: true, complete: false },
  { elapsedMs: 4299, phase: 'run', keyboardX: 0, keyboardZ: -1, sprint: true, complete: false },
  { elapsedMs: 4300, phase: 'run-stop', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 4899, phase: 'run-stop', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 4900, phase: 'turn-45-pulse', keyboardX: -1, keyboardZ: -1, sprint: false, complete: false },
  { elapsedMs: 5000, phase: 'turn-45-settle', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 5600, phase: 'turn-90-pulse', keyboardX: 1, keyboardZ: -1, sprint: false, complete: false },
  { elapsedMs: 5700, phase: 'turn-90-settle', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 6700, phase: 'turn-180-pulse', keyboardX: -1, keyboardZ: 1, sprint: false, complete: false },
  { elapsedMs: 6800, phase: 'turn-180-settle', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 8699, phase: 'turn-180-settle', keyboardX: 0, keyboardZ: 0, sprint: false, complete: false },
  { elapsedMs: 8700, phase: 'complete', keyboardX: 0, keyboardZ: 0, sprint: false, complete: true },
]
for (const testCase of locomotionDiagnosticCases) {
  const actual = inputDiagnostic.virtualChurchLocomotionDiagnosticInputAt(
    testCase.elapsedMs,
  )
  if (JSON.stringify(actual) !== JSON.stringify({
    phase: testCase.phase,
    keyboardX: testCase.keyboardX,
    keyboardZ: testCase.keyboardZ,
    sprint: testCase.sprint,
    complete: testCase.complete,
  })) {
    const expected = {
      phase: testCase.phase,
      keyboardX: testCase.keyboardX,
      keyboardZ: testCase.keyboardZ,
      sprint: testCase.sprint,
      complete: testCase.complete,
    }
    errors.push(
      `locomotion diagnostic at ${testCase.elapsedMs}ms returned ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    )
  }
}
if (inputDiagnostic.VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC_DURATION_MS !== 8700) {
  errors.push(
    `locomotion diagnostic duration is ${inputDiagnostic.VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC_DURATION_MS}ms, expected 8700ms`,
  )
}
for (const testCase of locomotionPhaseCases) {
  const actual = helper.gateASynchronizedLocomotionTime(
    testCase.previousTime,
    testCase.previousDuration,
    testCase.nextDuration,
  )
  if (Math.abs(actual - testCase.expected) > 1e-9) {
    errors.push(`locomotion phase ${JSON.stringify(testCase)} returned ${actual}`)
  }
}
for (const invalidCase of [
  [Number.NaN, 1, 0.8],
  [0.25, 0, 0.8],
  [0.25, 1, 0],
]) {
  if (helper.gateASynchronizedLocomotionTime(...invalidCase) !== 0) {
    errors.push(`invalid locomotion phase input ${JSON.stringify(invalidCase)} must reset safely`)
  }
}
for (const [previous, next, expected] of [
  ['Walk', 'Run', true],
  ['Run', 'Walk', true],
  ['Idle_A', 'Walk', false],
  ['Walk', 'Jump_Start', false],
]) {
  if (helper.gateAAnimationShouldSyncLocomotionPhase(previous, next) !== expected) {
    errors.push(`${previous} -> ${next} locomotion phase sync must be ${expected}`)
  }
}

const durationNames = Object.keys(contract.durationsSeconds)
const looping = new Set(contract.loopingClips)
const oneShot = new Set(contract.oneShotClips)
for (const name of durationNames) {
  if (looping.has(name) === oneShot.has(name)) {
    errors.push(`${name} must belong to exactly one playback mode`)
  }
  if (helper.gateAAnimationIsOneShot(name, contract.oneShotClips) !== oneShot.has(name)) {
    errors.push(`${name} one-shot classification differs from the shared contract`)
  }
}

const expectedLocomotionContactWindows = {
  Walk: {
    L: [0.25, 0.78],
    R: [0.8, 0.98],
  },
  Run: {
    L: [0.29, 0.62],
    R: [0.8, 0.98],
  },
}
const actualContactWindows = contract.locomotionContactWindows
if (
  actualContactWindows === null
  || typeof actualContactWindows !== 'object'
  || Array.isArray(actualContactWindows)
) {
  errors.push('locomotionContactWindows must be an object')
} else {
  const actualClipNames = Object.keys(actualContactWindows).sort()
  const expectedClipNames = Object.keys(expectedLocomotionContactWindows).sort()
  if (JSON.stringify(actualClipNames) !== JSON.stringify(expectedClipNames)) {
    errors.push(
      `locomotion contact clips ${JSON.stringify(actualClipNames)} differ from `
      + JSON.stringify(expectedClipNames),
    )
  }

  for (const [clipName, expectedSides] of Object.entries(
    expectedLocomotionContactWindows,
  )) {
    const actualSides = actualContactWindows[clipName]
    if (
      actualSides === null
      || typeof actualSides !== 'object'
      || Array.isArray(actualSides)
    ) {
      errors.push(`${clipName} contact windows must define L and R`)
      continue
    }

    const actualSideNames = Object.keys(actualSides).sort()
    if (JSON.stringify(actualSideNames) !== JSON.stringify(['L', 'R'])) {
      errors.push(`${clipName} contact windows must contain exactly L and R`)
    }

    for (const [side, expectedWindow] of Object.entries(expectedSides)) {
      const actualWindow = actualSides[side]
      if (
        !Array.isArray(actualWindow)
        || actualWindow.length !== 2
        || actualWindow.some((value) => !Number.isFinite(value))
      ) {
        errors.push(`${clipName}.${side} contact window must contain two finite values`)
        continue
      }
      const [start, end] = actualWindow
      if (start < 0 || end > 1 || start >= end) {
        errors.push(`${clipName}.${side} contact window must be ordered inside [0, 1]`)
      }
      if (start !== expectedWindow[0] || end !== expectedWindow[1]) {
        errors.push(
          `${clipName}.${side} contact window ${JSON.stringify(actualWindow)} `
          + `differs from ${JSON.stringify(expectedWindow)}`,
        )
      }
    }

    const left = actualSides.L
    const right = actualSides.R
    if (
      Array.isArray(left)
      && left.length === 2
      && Array.isArray(right)
      && right.length === 2
      && left[1] > right[0]
      && right[1] > left[0]
    ) {
      errors.push(`${clipName} left and right contact windows overlap`)
    }
  }
}

const phaseDuration = (name) => {
  const match = viewSource.match(new RegExp(`const ${name} = ([0-9.]+)`))
  if (!match) throw new Error(`Unable to read ${name} from VirtualChurchView.tsx`)
  return Number(match[1])
}
const phaseDurations = {
  takeoff: phaseDuration('TAKEOFF_DURATION'),
  landing: phaseDuration('LANDING_DURATION'),
}
const takeoffScale = helper.gateAAnimationPlaybackScale(
  'Jump_Start',
  contract.durationsSeconds,
  phaseDurations,
)
const landingScale = helper.gateAAnimationPlaybackScale(
  'Jump_Land',
  contract.durationsSeconds,
  phaseDurations,
)
const takeoffWallClock = contract.durationsSeconds.Jump_Start / takeoffScale
const landingWallClock = contract.durationsSeconds.Jump_Land / landingScale
if (Math.abs(takeoffWallClock - phaseDurations.takeoff) > 0.000001) {
  errors.push('Jump_Start playback does not fit the takeoff phase')
}
if (Math.abs(landingWallClock - phaseDurations.landing) > 0.000001) {
  errors.push('Jump_Land playback does not fit the landing phase')
}
for (const name of durationNames.filter((item) =>
  item !== 'Jump_Start' && item !== 'Jump_Land')) {
  const scale = helper.gateAAnimationPlaybackScale(
    name,
    contract.durationsSeconds,
    phaseDurations,
  )
  if (scale !== 1) errors.push(`${name} unexpectedly changes playback speed`)
}

const locomotionScaleCases = [
  { animation: 'Walk', intensity: 0, expected: 0.45 },
  { animation: 'Walk', intensity: 1, expected: 1.12 },
  { animation: 'Walk', intensity: 2, expected: 1.12 },
  { animation: 'Run', intensity: 0, expected: 0.75 },
  { animation: 'Run', intensity: 1, expected: 1.41 },
  { animation: 'Run', intensity: -1, expected: 0.75 },
  { animation: 'Idle_A', intensity: 1, expected: 1 },
]
for (const testCase of locomotionScaleCases) {
  const actual = helper.gateALocomotionPlaybackScale(
    testCase.animation,
    testCase.intensity,
  )
  if (Math.abs(actual - testCase.expected) > 0.000001) {
    errors.push(
      `${testCase.animation} intensity ${testCase.intensity} playback scale `
      + `${actual} differs from ${testCase.expected}`,
    )
  }
}

const turnPlaybackCases = [
  { clip: 'Turn_L', duration: 0.8, expected: 1 },
  { clip: 'Turn_R', duration: 0.8, expected: 1 },
]
for (const testCase of turnPlaybackCases) {
  const actual = helper.gateATurnPlaybackScale(
    testCase.clip,
    { ...contract.durationsSeconds, [testCase.clip]: testCase.duration },
    (Math.PI / 2) / 0.8,
  )
  if (Math.abs(actual - testCase.expected) > 0.000001) {
    errors.push(
      `${testCase.clip} angular playback scale ${actual} differs `
      + `from ${testCase.expected}`,
    )
  }
}
const turnCycleCases = [
  { angleDegrees: 45, expectedCycles: 0.5 },
  { angleDegrees: 90, expectedCycles: 1 },
  { angleDegrees: 180, expectedCycles: 2 },
]
for (const testCase of turnCycleCases) {
  const worldRadians = testCase.angleDegrees * Math.PI / 180
  const worldDuration = worldRadians / ((Math.PI / 2) / 0.8)
  const scale = helper.gateATurnPlaybackScale(
    'Turn_L',
    contract.durationsSeconds,
    (Math.PI / 2) / 0.8,
  )
  const actionCycles = worldDuration * scale / contract.durationsSeconds.Turn_L
  if (Math.abs(actionCycles - testCase.expectedCycles) > 0.000001) {
    errors.push(
      `${testCase.angleDegrees}-degree turn advances ${actionCycles} action cycles; `
      + `expected ${testCase.expectedCycles}`,
    )
  }
}
if (helper.gateATurnPlaybackScale('Walk', contract.durationsSeconds, 1) !== 1) {
  errors.push('non-turn clips must not use turn-angle playback scaling')
}
if (helper.gateATurnPlaybackScale('Turn_R', contract.durationsSeconds, 0) !== 1) {
  errors.push('invalid turn angular speed must reset to playback scale 1')
}

for (const [previous, next, expected] of [
  ['Idle_A', 'Walk_Start', 0.08],
  ['Walk_Start', 'Walk', 0.1],
  ['Walk', 'Walk_Stop', 0.1],
  ['Walk_Stop', 'Idle_A', 0.14],
  ['Idle_A', 'Run_Start', 0.08],
  ['Run_Start', 'Run', 0.1],
  ['Run', 'Run_Stop', 0.1],
  ['Run_Stop', 'Idle_A', 0.14],
]) {
  const actual = helper.gateAAnimationTransitionSeconds(previous, next)
  if (actual !== expected) {
    errors.push(`${previous} → ${next} transition ${actual} differs from ${expected}`)
  }
}
if (helper.gateAAnimationTransitionSeconds('Walk', 'Run') !== 0.18) {
  errors.push('Walk to Run transition duration differs from the contract')
}
for (const [previous, next] of [
  ['Idle_A', 'Jump_Start'],
  ['Jump_Start', 'Jump_Loop'],
  ['Jump_Loop', 'Jump_Land'],
  ['Jump_Land', 'Idle_A'],
]) {
  if (helper.gateAAnimationTransitionSeconds(previous, next) !== 0.06) {
    errors.push(`${previous} → ${next} does not use the responsive jump transition`)
  }
}

const simulatePhase = (duration, delta) => {
  let remaining = helper.gateAAnimationPhaseRemainingSeconds(
    duration,
    delta,
    true,
  )
  const createdFrameRemaining = remaining
  let elapsedAfterCreation = 0
  while (remaining > 0 && elapsedAfterCreation < duration + delta) {
    remaining = helper.gateAAnimationPhaseRemainingSeconds(
      remaining,
      delta,
      false,
    )
    elapsedAfterCreation += delta
  }
  return {
    createdFrameRemaining,
    elapsedAfterCreation: Number(elapsedAfterCreation.toFixed(4)),
    finalRemaining: remaining,
  }
}
const takeoffTimerSimulation = simulatePhase(phaseDurations.takeoff, 0.05)
const landingTimerSimulation = simulatePhase(phaseDurations.landing, 0.05)
const locomotionTransitionTimerSimulations = Object.fromEntries(
  Object.entries(contract.locomotionTransitionDurationsSeconds).map(
    ([name, duration]) => [name, simulatePhase(duration, 0.05)],
  ),
)
if (takeoffTimerSimulation.createdFrameRemaining !== phaseDurations.takeoff) {
  errors.push('takeoff timer is decremented on its creation frame')
}
if (landingTimerSimulation.createdFrameRemaining !== phaseDurations.landing) {
  errors.push('landing timer is decremented on its creation frame')
}
if (
  takeoffTimerSimulation.elapsedAfterCreation < phaseDurations.takeoff
  || landingTimerSimulation.elapsedAfterCreation < phaseDurations.landing
  || takeoffTimerSimulation.finalRemaining !== 0
  || landingTimerSimulation.finalRemaining !== 0
) {
  errors.push('jump phase timers do not cover their configured wall-clock duration')
}
for (const [name, duration] of Object.entries(
  contract.locomotionTransitionDurationsSeconds,
)) {
  const simulation = locomotionTransitionTimerSimulations[name]
  if (
    simulation.createdFrameRemaining !== duration
    || simulation.elapsedAfterCreation < duration
    || simulation.finalRemaining !== 0
  ) {
    errors.push(`${name} timer does not cover its authored wall-clock duration`)
  }
}

const turnSpeed = (Math.PI / 2) / 0.8
const degrees = (value) => value * Math.PI / 180
const wrapLeft = helper.gateAStepYaw(
  degrees(170),
  degrees(-170),
  0.05,
  turnSpeed,
)
const wrapRight = helper.gateAStepYaw(
  degrees(-170),
  degrees(170),
  0.05,
  turnSpeed,
)
if (
  wrapLeft.direction !== 1
  || wrapRight.direction !== -1
  || wrapLeft.remainingRadians >= degrees(20)
  || wrapRight.remainingRadians >= degrees(20)
) {
  errors.push('turn helper does not use the shortest wrapped yaw direction')
}
let simulatedYaw = 0
let turnFrames = 0
while (
  Math.abs(helper.gateAShortestYawDelta(simulatedYaw, Math.PI)) > 0.02
  && turnFrames < 100
) {
  simulatedYaw = helper.gateAStepYaw(
    simulatedYaw,
    Math.PI,
    0.05,
    turnSpeed,
  ).yaw
  turnFrames += 1
}
if (turnFrames <= 1 || turnFrames >= 100) {
  errors.push('180-degree turn is instant or never settles')
}
const settledTurn = helper.gateAStepYaw(
  simulatedYaw,
  Math.PI,
  0.05,
  turnSpeed,
)
if (settledTurn.direction !== 0 || settledTurn.remainingRadians > 0.02) {
  errors.push('turn helper does not settle at the target yaw')
}

const greetReadyContext = {
  grounded: true,
  moving: false,
  takeoffRemainingSeconds: 0,
  landingRemainingSeconds: 0,
  turnDirection: 0,
}
if (!helper.gateAGreetCanRun(greetReadyContext)) {
  errors.push('Greet cannot start from a settled grounded idle')
}
for (const blockedContext of [
  { ...greetReadyContext, grounded: false },
  { ...greetReadyContext, moving: true },
  { ...greetReadyContext, takeoffRemainingSeconds: 0.01 },
  { ...greetReadyContext, landingRemainingSeconds: 0.01 },
  { ...greetReadyContext, turnDirection: 1 },
  { ...greetReadyContext, turnDirection: -1 },
]) {
  if (helper.gateAGreetCanRun(blockedContext)) {
    errors.push(`Greet runs in blocked context ${JSON.stringify(blockedContext)}`)
  }
}

for (const requiredUsage of [
  'gateAAnimationForMotionState(',
  'gateAAnimationIsOneShot(',
  'gateAAnimationPlaybackScale(',
  'gateALocomotionPlaybackScale(',
  'gateATurnPlaybackScale(',
  'gateAAnimationTransitionSeconds(',
  'gateAAnimationPhaseRemainingSeconds(',
  'gateAAvatarYawForMovement(',
  'gateAAnimationShouldSyncLocomotionPhase(',
  'gateASynchronizedLocomotionTime(',
  'gateALocomotionFacingAlignment(',
  'gateALocomotionCanTranslate(',
  'gateAStepYaw(',
  'gateAGreetCanRun(',
  'gateAReviewTransitionStepDistance(',
  'gateAReviewLoopJoinTime(',
  'gateAReviewSpeedBlendStep(',
  'usesGateAHeroMotion && (resumingReviewBrake || changingReviewGait)',
  'const previousLoopTime = action.time',
  'input.diagnosticElapsedMs += clampedDelta * 1000',
  'movementRef.current.diagnosticElapsedMs ?? 0',
  'movementRef.current.diagnosticElapsedMs = null',
  'const reviewBraking = reviewStopActiveThisFrame',
  'const travelDirection = reviewBraking ? reviewStopDirection : direction',
  'usesGateAHeroMotion ? false : locomotionStopStartedThisFrame',
  'takeoffStartedThisFrame',
  'landedThisFrame',
  'takeoffTimerRef.current > 0',
  'landingTimerRef.current > 0',
  'targetPlayerYawRef',
  'greetTimerRef',
  'gestureQueued',
  'greetTimerRef.current > 0',
  'locomotionStartTimerRef.current > 0',
  'locomotionStopTimerRef.current > 0',
  "? (locomotionStartWasRunRef.current ? 'runStart' : 'walkStart')",
  "? (lastLocomotionWasRunRef.current ? 'runStop' : 'walkStop')",
  'turnStep.remainingRadians / PLAYER_TURN_SPEED',
  'PLAYER_QUARTER_TURN_DURATION_SECONDS = 0.8',
  "nextAction === 'Turn_L' || nextAction === 'Turn_R'",
  'input.turnDurationSeconds = turnStep.direction === 0',
  'locomotionStopTimerRef.current = turnStep.direction === 0',
  'movementRequested\n      && !translating\n      && turnStep.direction !== 0',
  'turnBeforeMoveRef.current = true',
  'aria-label={t.greet}',
  'aria-keyshortcuts="G"',
  "config3D.visualVersion === 'v3'",
  "cameraModeRef.current === 'follow'",
  "cameraMode === 'follow'",
  'const GATE_A_DESKTOP_IDLE_MIXER_INTERVAL_SECONDS = 1 / 30',
  'if (isIdle && !perfConfig.isMobile)',
  'idleMixerDeltaRef.current += mixerDelta',
  'mixer.update(mixerDelta + idleMixerDeltaRef.current)',
  'action.crossFadeFrom(previousMixerAction, transitionSeconds, false)',
  'VIRTUAL_CHURCH_CHARACTER_ACTION_ATTRIBUTE',
  "document.documentElement.setAttribute(\n        VIRTUAL_CHURCH_CHARACTER_ACTION_ATTRIBUTE,\n        nextAction,",
  'const avatarReady = prepared && poseReady && appearanceReady',
  'useVirtualChurchRenderedAssetSignal(model, VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE, avatarReady)',
  'visible={avatarReady}',
  'position={[0, measurements.groundOffset, 0]}',
  "profile3DSearchParams.get('profile3dInput')",
  "profile3DInputDiagnostic !== VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC",
  'virtualChurchLocomotionDiagnosticInputAt(',
  'movementRef.current.diagnosticX = diagnostic.keyboardX',
  'movementRef.current.diagnosticZ = diagnostic.keyboardZ',
  'movementRef.current.diagnosticSprint = diagnostic.sprint',
  'document.documentElement.hasAttribute(VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE)',
  'VIRTUAL_CHURCH_INPUT_DIAGNOSTIC_PHASE_ATTRIBUTE',
  'VIRTUAL_CHURCH_PLAYER_POSE_ATTRIBUTE',
  'player.position.x.toFixed(4)',
  'player.position.z.toFixed(4)',
  'player.rotation.y.toFixed(4)',
  'const translating = movementRequested',
  '* locomotionAlignment',
  'const VIRTUAL_CHURCH_DRACO_LOADER = new DRACOLoader()',
]) {
  if (!viewSource.includes(requiredUsage)) {
    errors.push(`VirtualChurchView.tsx does not use ${requiredUsage}`)
  }
}
const sharedDracoLoaderUsages = viewSource.match(
  /loader\.setDRACOLoader\(VIRTUAL_CHURCH_DRACO_LOADER\)/gu,
) ?? []
if (sharedDracoLoaderUsages.length < 2) {
  errors.push('church and compressed character must both use the shared Draco loader')
}
if (viewSource.includes('return <primitive object={model} scale={measurements.scale} position={[0, measurements.groundOffset, 0]} rotation={[0, Math.PI, 0]} />')) {
  errors.push('released +Z V3 hero must not retain the legacy 180-degree model rotation')
}

if (errors.length > 0) {
  throw new Error(`Gate A animation runtime validation failed:\n- ${errors.join('\n- ')}`)
}

process.stdout.write(`${JSON.stringify({
  stateMapping: expectedStateMapping,
  verticalPhysics: { verticalLandingCases, actualControllerBlockExecuted: true },
  playbackModes: {
    looping: [...looping],
    oneShot: [...oneShot],
  },
  phaseDurationsSeconds: phaseDurations,
  playbackScales: {
    Jump_Start: Number(takeoffScale.toFixed(4)),
    Jump_Land: Number(landingScale.toFixed(4)),
    WalkAtFullInput: helper.gateALocomotionPlaybackScale('Walk', 1),
    RunAtFullInput: helper.gateALocomotionPlaybackScale('Run', 1),
    turnCadence: Object.fromEntries(turnCycleCases.map(({ angleDegrees }) => {
      const worldRadians = angleDegrees * Math.PI / 180
      const worldDurationSeconds = worldRadians / turnSpeed
      const playbackScale = helper.gateATurnPlaybackScale(
        'Turn_L',
        contract.durationsSeconds,
        turnSpeed,
      )
      return [angleDegrees, {
        worldDurationSeconds: Number(worldDurationSeconds.toFixed(3)),
        actionCycles: Number((
          worldDurationSeconds
          * playbackScale
          / contract.durationsSeconds.Turn_L
        ).toFixed(3)),
      }]
    })),
  },
  locomotionContactWindows: expectedLocomotionContactWindows,
  locomotionPhaseContinuity: {
    transitions: ['Walk -> Run', 'Run -> Walk'],
    cases: locomotionPhaseCases.length,
    crossFadeSeconds: helper.gateAAnimationTransitionSeconds('Walk', 'Run'),
  },
  locomotionDiagnostic: {
    query: 'profile3d&profile3dInput=locomotion',
    durationMs: inputDiagnostic.VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC_DURATION_MS,
    phases: inputDiagnostic.VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC_SEGMENTS.map(
      ({ phase }) => phase,
    ).concat('complete'),
    cases: locomotionDiagnosticCases.length,
    memberRouteBypass: false,
  },
  reviewTransitionTravel,
  speedBlendCases,
  reviewCadenceCases,
  gaitBlendCases,
  gaitEntryCases,
  continuousDiagnosticDurationMs: continuousElapsed,
  reviewTransitionFrameRates: [20, 30, 60, 120],
  reviewDiagnosticDurationMs: 9850,
  reviewLoopJoinPhase: 0.375,
  locomotionFacingGate: {
    minimumAlignment: helper.GATE_A_LOCOMOTION_TRANSLATION_ALIGNMENT,
    maximumTranslationAngleDegrees: Number(
      (Math.acos(helper.GATE_A_LOCOMOTION_TRANSLATION_ALIGNMENT) * 180 / Math.PI)
        .toFixed(2),
    ),
    cases: locomotionAlignmentCases.length + 1,
    reverseTranslationAllowed: false,
  },
  cardinalFacing: cardinalFacingCases.map(({ direction, expected }) => ({
    direction,
    v3LocalForwardAxis: '+Z',
    v3Yaw: expected,
    v2LocalForwardAxis: '-Z',
    v2Yaw: Number(helper.gateAAvatarYawForMovement(
      direction[0],
      direction[1],
      '-Z',
    ).toFixed(4)),
  })),
  jumpTransitionSeconds: 0.06,
  locomotionTransitionSeconds: {
    enterStartClip: 0.08,
    startToLoop: 0.1,
    loopToStop: 0.1,
    stopToIdle: 0.14,
    walkRun: 0.18,
  },
  timerSimulationAt50ms: {
    takeoff: takeoffTimerSimulation,
    landing: landingTimerSimulation,
    locomotionTransitions: locomotionTransitionTimerSimulations,
  },
  turnSimulationAt50ms: {
    maximumRadiansPerSecond: Number(turnSpeed.toFixed(4)),
    halfTurnFrames: turnFrames,
    halfTurnSeconds: Number((turnFrames * 0.05).toFixed(2)),
    wrappedLeftDirection: wrapLeft.direction,
    wrappedRightDirection: wrapRight.direction,
  },
  greetRules: {
    startsFromGroundedIdle: true,
    blockedWhileMovingAirborneLandingOrTurning: true,
    durationSeconds: contract.durationsSeconds.Greet,
  },
  idleMixerCadence: {
    desktopIdleHz: 30,
    mobileIdleFullFrameRate: true,
    nonIdleFullFrameRate: true,
    accumulatedTimeFlushedOnMotion: true,
  },
  source: pathToFileURL(helperPath).href,
  passed: true,
}, null, 2)}\n`)
