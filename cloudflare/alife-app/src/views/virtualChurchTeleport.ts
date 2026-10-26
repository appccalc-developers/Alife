type Destination = { position: [number, number, number]; yaw: number }
type TeleportHandler = (position: [number, number, number], yaw: number) => boolean | void

/** A guide jump is discontinuous: interpolating the camera across the old and
 * new rooms briefly exposes walls and roof interiors. Ordinary movement keeps
 * the existing exponential follow smoothing. */
export const virtualChurchCameraLerpFactor = (
  snapToDestination: boolean,
  reducedMotion: boolean,
  followRate: number,
  deltaSeconds: number,
) => snapToDestination || reducedMotion ? 1 : 1 - Math.exp(-followRate * deltaSeconds)

/** View-owned mailbox: guide choices may precede the Canvas/controller mount.
 * Keep only the latest choice until the player can accept it; never poll.
 * Nothing is persisted across route visits or shared between church views.
 */
export function createVirtualChurchTeleport() {
  let pending: Destination | null = null
  let handler: TeleportHandler | null = null
  const flush = () => {
    if (!handler || !pending) return
    const destination = pending
    if (handler(destination.position, destination.yaw) === false) return
    if (pending === destination) pending = null
  }
  return {
    request(position: readonly [number, number, number], yaw: number) {
      if (![...position, yaw].every(Number.isFinite)) throw new Error('Invalid church destination')
      pending = { position: [...position], yaw }
      flush()
    },
    attach(next: TeleportHandler) {
      handler = next
      flush()
      return () => { if (handler === next) handler = null }
    },
    flush,
  }
}
