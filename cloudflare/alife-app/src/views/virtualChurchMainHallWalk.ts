import { MAIN_HALL_CHAIR_PARTS, MAIN_HALL_CHAIRS, MAIN_HALL_DIMENSIONS, MAIN_HALL_STAGE_ACCESS } from './virtualChurchMainHallLayout.ts'

// This only navigates the 2017 photo-informed review candidate. It is not a
// surveyed circulation plan or a replacement for the church's player physics.
export type MainHallWalkPose = { x: number; z: number; yaw: number }
// Positive turn is a rightward look, consistent with E/Right and the touch label.
export type MainHallWalkInput = { forward: number; strafe: number; turn: number }

// Explicit, bounded input review only. This feeds the ordinary walk/collision
// controller; it must not drive an idle scene merely to manufacture FPS.
export const MAIN_HALL_WALK_REVIEW_DURATION_MS = 18000
export const mainHallWalkReviewEnabled = (params: URLSearchParams) =>
  params.has('profile3d') && params.get('profile3dTiming') === '1'
  && params.get('profile3dInput') === 'main-hall-walk'

export function createMainHallWalkReview() {
  let startedAt: number | null = null, previous: number | null = null, elapsedMs = 0
  let status: 'running' | 'complete' | 'cancelled' = 'running', reason = ''
  const cancel = (cause: string) => { if (status === 'running') { status = 'cancelled'; reason = cause } }
  return {
    cancel,
    advance(now: number, visible: boolean, manualInput: boolean) {
      if (!visible) cancel('hidden')
      if (manualInput) cancel('manual-input')
      if (!Number.isFinite(now) || (previous !== null && now <= previous)) cancel('clock')
      if (previous !== null && now - previous > 250) cancel('frame-gap')
      if (status === 'running') {
        startedAt ??= now
        previous = now
        elapsedMs = now - startedAt
        if (elapsedMs >= MAIN_HALL_WALK_REVIEW_DURATION_MS) status = 'complete'
      }
      const phase = status !== 'running' ? status
        : elapsedMs < 4000 ? 'forward'
          : elapsedMs < 8000 ? 'backward'
            : elapsedMs < 12000 ? 'forward' : 'turn'
      const input: MainHallWalkInput = { forward: phase === 'forward' ? 1 : phase === 'backward' ? -1 : 0, strafe: 0, turn: phase === 'turn' ? 1 : 0 }
      return { status, phase, reason, elapsedMs, durationMs: MAIN_HALL_WALK_REVIEW_DURATION_MS, input }
    },
  }
}

// The two provisional rear openings align with the foyer's two left door
// banks. They are scene hand-off thresholds, not surveyed auditorium exits.
export const MAIN_HALL_FOYER_EXIT_CENTERS = [3.12, -3.12] as const
export const MAIN_HALL_FOYER_EXIT_WIDTH = 1.6
export const MAIN_HALL_FOYER_EXIT_THRESHOLD_Z = 10.76

// The two foyer door banks lead to opposite rear aisles in this review layout.
// The mapping is provisional until the real auditorium circulation is checked.
export const mainHallWalkStartForDoor = (door: number): MainHallWalkPose => ({
  x: MAIN_HALL_FOYER_EXIT_CENTERS[door === 1 ? 1 : 0],
  z: 10.05,
  yaw: 0,
})
export const MAIN_HALL_WALK_START: MainHallWalkPose = mainHallWalkStartForDoor(0)
export const MAIN_HALL_WALK_EYE_HEIGHT = 1.68

const playerRadius = .22
const chairHalfWidth = Math.max(
  MAIN_HALL_CHAIR_PARTS.seat.width / 2,
  MAIN_HALL_CHAIR_PARTS.back.width / 2,
  MAIN_HALL_CHAIR_PARTS.lowerBack.width / 2,
  ...MAIN_HALL_CHAIR_PARTS.leg.xOffsets.map(x => Math.abs(x) + .014),
) + .01 // small allowance for the photographed rows' slight chair yaw
const chairFrontZ = Math.min(
  MAIN_HALL_CHAIR_PARTS.seat.z - MAIN_HALL_CHAIR_PARTS.seat.depth / 2,
  ...MAIN_HALL_CHAIR_PARTS.leg.zOffsets.map(z => z - .014),
) - .01
const chairRearZ = Math.max(
  MAIN_HALL_CHAIR_PARTS.back.z + MAIN_HALL_CHAIR_PARTS.back.depth / 2,
  MAIN_HALL_CHAIR_PARTS.lowerBack.z + MAIN_HALL_CHAIR_PARTS.lowerBack.depth / 2,
  ...MAIN_HALL_CHAIR_PARTS.leg.zOffsets.map(z => z + .014),
) + .01
const stageFront = MAIN_HALL_DIMENSIONS.stageZ + MAIN_HALL_DIMENSIONS.stageDepth / 2
const rearWallLimitZ = MAIN_HALL_DIMENSIONS.depth / 2 - playerRadius - .12

export function mainHallFoyerExitDoorAt(x: number, z: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)
    || z < MAIN_HALL_FOYER_EXIT_THRESHOLD_Z
    || z > MAIN_HALL_DIMENSIONS.depth / 2 - .1) return null
  const index = MAIN_HALL_FOYER_EXIT_CENTERS.findIndex(center =>
    Math.abs(x - center) < MAIN_HALL_FOYER_EXIT_WIDTH / 2 - playerRadius,
  )
  return index < 0 ? null : index
}

export function mainHallWalkable(x: number, z: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false
  if (Math.abs(x) > MAIN_HALL_DIMENSIONS.width / 2 - playerRadius - .12) return false
  if (z > rearWallLimitZ
    && (z > MAIN_HALL_DIMENSIONS.depth / 2 - .1
      || !MAIN_HALL_FOYER_EXIT_CENTERS.some(center => Math.abs(x - center) < MAIN_HALL_FOYER_EXIT_WIDTH / 2 - playerRadius))) return false
  if (z < stageFront + playerRadius + .08) return false
  if (z > MAIN_HALL_STAGE_ACCESS.railBackZ - playerRadius
    && z < MAIN_HALL_STAGE_ACCESS.railFrontZ + playerRadius
    && MAIN_HALL_STAGE_ACCESS.stairCentersX.some(centerX =>
      [-1, 1].some(side => Math.abs(x - (centerX + side * MAIN_HALL_STAGE_ACCESS.railOffsetX)) < playerRadius + .03)
    )) return false
  return !MAIN_HALL_CHAIRS.some(chair =>
    Math.abs(x - chair.x) < chairHalfWidth + playerRadius
    && z > chair.z + chairFrontZ - playerRadius
    && z < chair.z + chairRearZ + playerRadius,
  )
}

export function stepMainHallWalk(
  pose: MainHallWalkPose,
  input: MainHallWalkInput,
  deltaSeconds: number,
): MainHallWalkPose {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return pose
  const dt = Math.min(deltaSeconds, .05)
  const yaw = pose.yaw - Math.max(-1, Math.min(1, input.turn)) * dt * 1.65
  const length = Math.hypot(input.forward, input.strafe)
  if (length === 0) return { ...pose, yaw }
  const forward = input.forward / Math.max(1, length)
  const strafe = input.strafe / Math.max(1, length)
  const distance = dt * 2.1
  const dx = (strafe * Math.cos(yaw) - forward * Math.sin(yaw)) * distance
  const dz = (-forward * Math.cos(yaw) - strafe * Math.sin(yaw)) * distance
  const x = mainHallWalkable(pose.x + dx, pose.z) ? pose.x + dx : pose.x
  const z = mainHallWalkable(x, pose.z + dz) ? pose.z + dz : pose.z
  return { x, z, yaw }
}
