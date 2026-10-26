import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AnimationClip,
  Quaternion,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three'
import {
  GATE_A_FEMALE_WALK_HIPS_LATERAL_SCALE,
  gateARefineFemaleWalkGait,
} from '../src/views/virtualChurchCharacterGait.ts'

const rotation = (angle: number) => new Quaternion()
  .setFromAxisAngle({ x: 1, y: 0, z: 0 }, angle)
  .toArray()

const idle = new AnimationClip('Idle_A', 1, [
  new VectorKeyframeTrack('J_Bip_C_Hips.position', [0], [0.02, 0.9, 0]),
  new QuaternionKeyframeTrack('J_Bip_L_UpperArm.quaternion', [0], rotation(0)),
])
const walk = new AnimationClip('Walk', 1, [
  new VectorKeyframeTrack(
    'J_Bip_C_Hips.position',
    [0, 0.5, 1],
    [-0.01, 0.9, 0, 0.05, 0.91, 0, -0.01, 0.9, 0],
  ),
  new QuaternionKeyframeTrack(
    'J_Bip_L_UpperArm.quaternion',
    [0, 0.5, 1],
    [...rotation(-0.6), ...rotation(0.6), ...rotation(-0.6)],
  ),
])
const run = new AnimationClip('Run', 0.7, [
  new VectorKeyframeTrack('J_Bip_C_Hips.position', [0, 0.7], [-0.03, 0.9, 0, 0.07, 0.9, 0]),
])

test('female walk refinement reduces lateral pelvis travel without changing height or cadence', () => {
  const sourceBefore = Array.from(walk.tracks[0].values)
  const [originalIdle, refinedWalk, originalRun] = gateARefineFemaleWalkGait(
    [idle, walk, run],
    true,
  )
  const source = walk.tracks[0] as VectorKeyframeTrack
  const refined = refinedWalk.tracks[0] as VectorKeyframeTrack

  assert.equal(originalIdle, idle)
  assert.equal(originalRun, run)
  assert.notEqual(refinedWalk, walk)
  assert.equal(refinedWalk.duration, walk.duration)
  assert.equal(refined.values[1], source.values[1])
  assert.equal(refined.values[4], source.values[4])
  assert.ok(Math.abs(
    (refined.values[3] - 0.02)
      - (source.values[3] - 0.02) * GATE_A_FEMALE_WALK_HIPS_LATERAL_SCALE,
  ) < 1e-8)
  assert.deepEqual(Array.from(source.values), sourceBefore)
})

test('female walk arm swing is softened and the loop seam remains exact', () => {
  const refinedWalk = gateARefineFemaleWalkGait([idle, walk], true)[1]
  const refined = refinedWalk.tracks[1] as QuaternionKeyframeTrack
  const first = new Quaternion().fromArray(refined.values, 0)
  const middle = new Quaternion().fromArray(refined.values, 4)
  const last = new Quaternion().fromArray(refined.values, 8)

  assert.ok(first.angleTo(new Quaternion()) < 0.6)
  assert.ok(middle.angleTo(new Quaternion()) < 0.6)
  assert.ok(first.angleTo(last) < 1e-7)
})

test('disabled refinement leaves every source clip untouched', () => {
  const result = gateARefineFemaleWalkGait([idle, walk, run], false)
  assert.deepEqual(result, [idle, walk, run])
  assert.equal(result[1], walk)
})
