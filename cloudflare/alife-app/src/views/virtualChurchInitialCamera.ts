/** Match the first rendered frame to the controller's follow-camera target. */
export const virtualChurchYawTowardLogicalPoint = (
  player: readonly [number, number, number],
  target: readonly [number, number, number],
) => -Math.atan2(target[0] - player[0], player[2] - target[2])

export const virtualChurchInitialFollowCamera = (
  player: readonly [number, number, number],
  yaw: number,
  pitch: number,
  distance: number,
  baseHeight: number,
  pitchHeight: number,
) => ({
  position: [
    player[0] + Math.sin(yaw) * distance,
    Math.max(0.85, baseHeight + pitch * pitchHeight) + player[1] * 0.6,
    -(player[2] + Math.cos(yaw) * distance),
  ] as [number, number, number],
  lookAt: [player[0], 1.4 + player[1], -player[2]] as [number, number, number],
})
