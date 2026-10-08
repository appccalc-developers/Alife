import {
  AnimationClip,
  Quaternion,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
  type KeyframeTrack,
} from 'three'

const FEMALE_WALK_CLIPS = new Set(['Walk_Start', 'Walk', 'Walk_Stop'])

// The approved capture has a pronounced catwalk-style lateral transfer. Keep
// the planted-foot timing and forward cadence, but bring the pelvis travel and
// arm counter-swing back to a calm, everyday walk.
export const GATE_A_FEMALE_WALK_HIPS_LATERAL_SCALE = 0.42
export const GATE_A_FEMALE_WALK_ARM_ROTATION_SCALE = {
  upper: 0.58,
  lower: 0.7,
} as const

const isTrackFor = (track: KeyframeTrack, boneName: string, property: string) =>
  track.name.endsWith(`${boneName}.${property}`)

const firstQuaternion = (track: KeyframeTrack | undefined) => {
  if (!(track instanceof QuaternionKeyframeTrack) || track.values.length < 4) {
    return null
  }
  return new Quaternion(
    track.values[0],
    track.values[1],
    track.values[2],
    track.values[3],
  ).normalize()
}

const refineHipsTranslation = (
  track: VectorKeyframeTrack,
  neutralX: number,
) => {
  const refined = track.clone()
  for (let offset = 0; offset < refined.values.length; offset += 3) {
    refined.values[offset] = neutralX
      + (refined.values[offset] - neutralX) * GATE_A_FEMALE_WALK_HIPS_LATERAL_SCALE
  }
  return refined
}

const refineArmRotation = (
  track: QuaternionKeyframeTrack,
  neutral: Quaternion,
  scale: number,
) => {
  const refined = track.clone()
  const current = new Quaternion()
  const softened = new Quaternion()
  for (let offset = 0; offset < refined.values.length; offset += 4) {
    current.fromArray(refined.values, offset).normalize()
    softened.copy(neutral).slerp(current, scale).normalize()
    softened.toArray(refined.values, offset)
  }
  return refined
}

const neutralTrack = (
  idle: AnimationClip | undefined,
  source: KeyframeTrack,
) => idle?.tracks.find((track) => track.name === source.name)

/**
 * Return female-only walk clips with restrained lateral styling.
 *
 * Source GLTF clips are cached and can also back the male review asset, so the
 * function never mutates them. Running, turning, jumping and idle clips retain
 * their exact source tracks and timings.
 */
export const gateARefineFemaleWalkGait = (
  clips: readonly AnimationClip[],
  enabled: boolean,
) => {
  if (!enabled) return [...clips]
  const idle = clips.find((clip) => clip.name === 'Idle_A')

  return clips.map((clip) => {
    if (!FEMALE_WALK_CLIPS.has(clip.name)) return clip

    let changed = false
    const tracks = clip.tracks.map((track) => {
      if (
        track instanceof VectorKeyframeTrack
        && isTrackFor(track, 'J_Bip_C_Hips', 'position')
      ) {
        const idleTrack = neutralTrack(idle, track)
        const neutralX = idleTrack instanceof VectorKeyframeTrack
          ? idleTrack.values[0]
          : 0
        changed = true
        return refineHipsTranslation(track, neutralX)
      }

      if (!(track instanceof QuaternionKeyframeTrack)) return track
      const upperArm = isTrackFor(track, 'J_Bip_L_UpperArm', 'quaternion')
        || isTrackFor(track, 'J_Bip_R_UpperArm', 'quaternion')
      const lowerArm = isTrackFor(track, 'J_Bip_L_LowerArm', 'quaternion')
        || isTrackFor(track, 'J_Bip_R_LowerArm', 'quaternion')
      if (!upperArm && !lowerArm) return track

      const neutral = firstQuaternion(neutralTrack(idle, track))
      if (!neutral) return track
      changed = true
      return refineArmRotation(
        track,
        neutral,
        upperArm
          ? GATE_A_FEMALE_WALK_ARM_ROTATION_SCALE.upper
          : GATE_A_FEMALE_WALK_ARM_ROTATION_SCALE.lower,
      )
    })

    return changed ? new AnimationClip(clip.name, clip.duration, tracks) : clip
  })
}
