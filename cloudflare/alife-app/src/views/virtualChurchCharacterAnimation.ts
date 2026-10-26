import type { AnimationAction } from 'three'

export type AvatarMotionState =
  | 'idle'
  | 'walkStart'
  | 'walk'
  | 'walkStop'
  | 'runStart'
  | 'run'
  | 'runStop'
  | 'takeoff'
  | 'jump'
  | 'fall'
  | 'land'
  | 'turnLeft'
  | 'turnRight'
  | 'greet'

export type GateAAnimationName =
  | 'Idle_A'
  | 'Idle_B'
  | 'Walk_Start'
  | 'Walk'
  | 'Walk_Stop'
  | 'Run_Start'
  | 'Run'
  | 'Run_Stop'
  | 'Jump_Start'
  | 'Jump_Loop'
  | 'Jump_Land'
  | 'Turn_L'
  | 'Turn_R'
  | 'Greet'

type GateAIdleAnimation = 'Idle_A' | 'Idle_B'
type GateAAnimationDurations = Record<GateAAnimationName, number>

export const gateAAnimationForMotionState = (
  state: AvatarMotionState,
  idleAnimation: GateAIdleAnimation,
): GateAAnimationName => {
  switch (state) {
    case 'walkStart':
      return 'Walk_Start'
    case 'walk':
      return 'Walk'
    case 'walkStop':
      return 'Walk_Stop'
    case 'runStart':
      return 'Run_Start'
    case 'run':
      return 'Run'
    case 'runStop':
      return 'Run_Stop'
    case 'takeoff':
      return 'Jump_Start'
    case 'jump':
    case 'fall':
      return 'Jump_Loop'
    case 'land':
      return 'Jump_Land'
    case 'turnLeft':
      return 'Turn_L'
    case 'turnRight':
      return 'Turn_R'
    case 'greet':
      return 'Greet'
    case 'idle':
      return idleAnimation
  }
}

export const gateAAnimationIsOneShot = (
  animation: GateAAnimationName,
  oneShotAnimations: readonly string[],
) => oneShotAnimations.includes(animation)

export const gateAAnimationPlaybackScale = (
  animation: GateAAnimationName,
  durations: GateAAnimationDurations,
  phaseDurations: { takeoff: number; landing: number },
) => {
  if (animation === 'Jump_Start') {
    return durations.Jump_Start / phaseDurations.takeoff
  }
  if (animation === 'Jump_Land') {
    return durations.Jump_Land / phaseDurations.landing
  }
  return 1
}

export const gateALocomotionPlaybackScale = (
  animation: GateAAnimationName,
  movementIntensity: number,
) => {
  const intensity = Math.max(0, Math.min(1, movementIntensity))
  if (animation === 'Walk') return 0.45 + (1.12 - 0.45) * intensity
  if (animation === 'Run') return 0.75 + (1.41 - 0.75) * intensity
  return 1
}

/** Review clips are calibrated at 1x. Drive their cadence from distance
 * actually travelled, including analogue input, steering and collisions.
 * A minimum playback floor would make planted feet slide at low speed.
 */
export const gateAReviewLocomotionPlaybackScale = (
  travelledSpeed: number,
  authoredSpeed: number,
) => Number.isFinite(travelledSpeed) && Number.isFinite(authoredSpeed)
  && travelledSpeed >= 0 && authoredSpeed > 0
  ? travelledSpeed / authoredSpeed
  : 0

export type GateAReviewGaitBlend = {
  fromWalkWeight: number
  toWalkWeight: number
  remaining: number
  duration: number
}

/** An unplayed cached Action reports weight 1 but contributes no pose.
 * Scheduled paused/zero-speed actions do contribute, so isRunning() is not
 * a suitable filter when a collision holds a planted-foot pose.
 */
export const gateAReviewContributingActionWeight = (
  action: AnimationAction | undefined,
) => {
  if (!action?.enabled || !action.isScheduled()) return 0
  const weight = action.getEffectiveWeight()
  return Number.isFinite(weight) ? Math.max(0, weight) : 0
}

/** Blend calibrated strides, not independent clocks. Both clips advance by
 * the same fraction of a cycle so their planted-foot phases stay together.
 */
export const gateAReviewGaitBlendFrame = (
  blend: GateAReviewGaitBlend,
  delta: number,
  travelledSpeed: number,
  walkDuration: number,
  runDuration: number,
  walkSpeed: number,
  runSpeed: number,
) => {
  const remaining = Math.max(0, blend.remaining - Math.max(0, delta))
  const q = blend.duration > 0 ? Math.max(0, Math.min(1, 1 - remaining / blend.duration)) : 1
  const weight = blend.fromWalkWeight + (blend.toWalkWeight - blend.fromWalkWeight) * q * q * (3 - 2 * q)
  const walkWeight = Math.max(0, Math.min(1, weight))
  const stride = walkWeight * walkSpeed * walkDuration + (1 - walkWeight) * runSpeed * runDuration
  const cyclesPerSecond = gateAReviewLocomotionPlaybackScale(travelledSpeed, stride)
  return {
    remaining, walkWeight, runWeight: 1 - walkWeight,
    walkRate: cyclesPerSecond * walkDuration,
    runRate: cyclesPerSecond * runDuration,
  }
}

export const gateATurnPlaybackScale = (
  animation: GateAAnimationName,
  durations: GateAAnimationDurations,
  turnRadiansPerSecond: number,
  quarterTurnRadians = Math.PI / 2,
) => {
  if (animation !== 'Turn_L' && animation !== 'Turn_R') return 1
  if (
    !Number.isFinite(turnRadiansPerSecond)
    || !Number.isFinite(quarterTurnRadians)
    || turnRadiansPerSecond <= 0
    || quarterTurnRadians <= 0
  ) return 1
  // Advance the authored quarter-turn by the same normalized amount as the
  // controller's world yaw. A 45-degree input therefore uses half of the
  // planted-foot sequence, 90 degrees uses one complete sequence, and a
  // 180-degree input repeats it twice instead of stretching one slow pivot.
  return durations[animation] * turnRadiansPerSecond / quarterTurnRadians
}

export const gateAAnimationTransitionSeconds = (
  previous: GateAAnimationName | null,
  next: GateAAnimationName,
) => {
  if (
    previous === 'Jump_Start'
  || previous === 'Jump_Land'
  || next === 'Jump_Start'
  || next === 'Jump_Land'
  ) return 0.06
  if (gateAAnimationShouldSyncLocomotionPhase(previous, next)) return 0.18
  if (next === 'Walk_Start' || next === 'Run_Start') return 0.08
  if (next === 'Walk_Stop' || next === 'Run_Stop') return 0.1
  if (previous === 'Walk_Start' || previous === 'Run_Start') return 0.1
  if (previous === 'Walk_Stop' || previous === 'Run_Stop') return 0.14
  if (
    previous === 'Idle_A'
    || previous === 'Idle_B'
    || next === 'Idle_A'
    || next === 'Idle_B'
  ) return 0.22
  return 0.14
}

export const gateAAnimationShouldSyncLocomotionPhase = (
  previous: GateAAnimationName | null,
  next: GateAAnimationName,
) => (
  (previous === 'Walk' && next === 'Run')
  || (previous === 'Run' && next === 'Walk')
)

export const gateASynchronizedLocomotionTime = (
  previousTimeSeconds: number,
  previousDurationSeconds: number,
  nextDurationSeconds: number,
) => {
  if (
    !Number.isFinite(previousTimeSeconds)
    || !Number.isFinite(previousDurationSeconds)
    || !Number.isFinite(nextDurationSeconds)
    || previousDurationSeconds <= 0
    || nextDurationSeconds <= 0
  ) return 0

  const wrappedPreviousTime = (
    (previousTimeSeconds % previousDurationSeconds)
    + previousDurationSeconds
  ) % previousDurationSeconds
  return (wrappedPreviousTime / previousDurationSeconds) * nextDurationSeconds
}

export const gateAAnimationPhaseRemainingSeconds = (
  remainingSeconds: number,
  deltaSeconds: number,
  startedThisFrame: boolean,
) => (
  startedThisFrame
    ? remainingSeconds
    : Math.max(0, remainingSeconds - deltaSeconds)
)

/** Match refine_mixamo_locomotion.py's authored in-place transition path.
 * Integrate between frames rather than sampling speed: travel is independent
 * of frame rate and cannot overshoot at the final partial frame.
 */
export const gateAReviewTransitionStepDistance = (
  remainingSeconds: number,
  durationSeconds: number,
  speedMetresPerSecond: number,
  deltaSeconds: number,
  stopping: boolean,
) => {
  if (
    ![remainingSeconds, durationSeconds, speedMetresPerSecond, deltaSeconds].every(Number.isFinite)
    || durationSeconds <= 0 || remainingSeconds <= 0
    || speedMetresPerSecond <= 0 || deltaSeconds <= 0
  ) return 0
  const before = Math.max(0, Math.min(1, 1 - remainingSeconds / durationSeconds))
  const after = Math.min(1, before + deltaSeconds / durationSeconds)
  const integral = (q: number) => {
    const acceleration = q ** 3 - 0.5 * q ** 4
    return stopping ? q - acceleration : acceleration
  }
  return speedMetresPerSecond * durationSeconds * (integral(after) - integral(before))
}

export const gateAReviewLoopJoinTime = (
  previous: GateAAnimationName | null,
  next: GateAAnimationName,
  loopDurationSeconds: number,
) => (
  ((previous === 'Walk_Start' && next === 'Walk')
    || (previous === 'Run_Start' && next === 'Run'))
  && Number.isFinite(loopDurationSeconds) && loopDurationSeconds > 0
    ? 0.375 * loopDurationSeconds
    : 0
)

export const GATE_A_REVIEW_SPEED_BLEND_SECONDS = 0.18

/** Keep momentum through an interrupted brake or gait change. */
export const gateAReviewSpeedBlendStep = (
  from: number, to: number, remaining: number, delta: number,
  duration = GATE_A_REVIEW_SPEED_BLEND_SECONDS,
) => {
  if (![from, to, remaining, delta, duration].every(Number.isFinite)
    || from < 0 || to < 0 || delta <= 0 || duration <= 0) {
    return { distance: 0, remaining: 0 }
  }
  const timeLeft = Math.max(0, Math.min(duration, remaining))
  const interval = Math.min(delta, timeLeft)
  const before = 1 - timeLeft / duration
  const after = before + interval / duration
  const integral = (q: number) => q ** 3 - 0.5 * q ** 4
  return {
    distance: from * interval + (to - from) * duration * (integral(after) - integral(before))
      + to * (delta - interval),
    remaining: Math.max(0, timeLeft - delta),
  }
}

const normalizeYaw = (yaw: number) => Math.atan2(Math.sin(yaw), Math.cos(yaw))

export const gateAAvatarYawForMovement = (
  directionX: number,
  directionZ: number,
  localForwardAxis: '+Z' | '-Z',
) => normalizeYaw(
  Math.atan2(directionX, directionZ)
  + (localForwardAxis === '-Z' ? Math.PI : 0),
)

export const gateAShortestYawDelta = (
  currentYaw: number,
  targetYaw: number,
) => normalizeYaw(targetYaw - currentYaw)

export const GATE_A_LOCOMOTION_TRANSLATION_ALIGNMENT = 0.55

export const gateALocomotionFacingAlignment = (
  currentYaw: number,
  targetYaw: number,
) => Math.max(0, Math.cos(gateAShortestYawDelta(currentYaw, targetYaw)))

export const gateALocomotionCanTranslate = (
  facingAlignment: number,
  minimumAlignment = GATE_A_LOCOMOTION_TRANSLATION_ALIGNMENT,
) => Number.isFinite(facingAlignment)
  && Number.isFinite(minimumAlignment)
  && facingAlignment >= Math.max(0, Math.min(1, minimumAlignment))

export const gateAStepYaw = (
  currentYaw: number,
  targetYaw: number,
  deltaSeconds: number,
  maximumRadiansPerSecond: number,
  settledToleranceRadians = 0.02,
) => {
  const delta = gateAShortestYawDelta(currentYaw, targetYaw)
  const maximumStep = Math.max(0, deltaSeconds) * maximumRadiansPerSecond
  const step = Math.sign(delta) * Math.min(Math.abs(delta), maximumStep)
  const yaw = normalizeYaw(currentYaw + step)
  const remainingRadians = Math.abs(gateAShortestYawDelta(yaw, targetYaw))
  return {
    yaw,
    remainingRadians,
    direction: remainingRadians > settledToleranceRadians
      ? Math.sign(delta)
      : 0,
  }
}

export const gateAGreetCanRun = ({
  grounded,
  moving,
  takeoffRemainingSeconds,
  landingRemainingSeconds,
  turnDirection,
}: {
  grounded: boolean
  moving: boolean
  takeoffRemainingSeconds: number
  landingRemainingSeconds: number
  turnDirection: number
}) => (
  grounded
  && !moving
  && takeoffRemainingSeconds <= 0
  && landingRemainingSeconds <= 0
  && turnDirection === 0
)
