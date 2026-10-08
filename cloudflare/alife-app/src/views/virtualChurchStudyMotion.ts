import { Quaternion, Vector3, type Object3D } from 'three'

export const STUDY_MOTION_HZ = 24

/** Room-copy motion only: no mixer, root bob, leg movement or source clip edits. */
export function createStudyCompanionMotion(model: Object3D, index: number) {
  const chest = model.getObjectByName('J_Bip_C_Chest')
  const head = model.getObjectByName('J_Bip_C_Head')!
  const chestScale = chest?.scale.clone()
  const headRotation = head.quaternion.clone()
  const rotation = new Quaternion(), axis = new Vector3(1, 0, 0)
  return (seconds: number) => {
    const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
    const fade = Math.min(1, time / 1.5)
    const breath = Math.sin(time * (1.24 + index * .037) + index * 1.71) * fade
    // A few millimetres of upper-body movement; the pelvis/feet stay planted.
    if (chest && chestScale) chest.scale.set(chestScale.x, chestScale.y * (1 + .003 * breath), chestScale.z * (1 + .006 * breath))
    head.quaternion.copy(headRotation).multiply(rotation.setFromAxisAngle(axis, .009 * breath))
  }
}

export interface StudyMotionHost {
  now: () => number
  hidden: () => boolean
  schedule: (callback: () => void, delay: number) => number
  cancel: (handle: number) => void
  listen: (callback: () => void) => () => void
}

/** Capped demand rendering. Background time never advances the seated pose. */
export function startStudyMotionLoop(host: StudyMotionHost, advance: (delta: number) => void) {
  let timer: number | undefined, previous = host.now(), stopped = false
  const cancel = () => { if (timer !== undefined) host.cancel(timer); timer = undefined }
  const tick = () => {
    timer = undefined
    if (stopped || host.hidden()) return
    const now = host.now()
    advance(Math.min(.1, Math.max(0, (now - previous) / 1000)))
    previous = now
    if (stopped || host.hidden()) return
    timer = host.schedule(tick, 1000 / STUDY_MOTION_HZ)
  }
  const visibility = () => {
    cancel()
    previous = host.now()
    if (!stopped && !host.hidden()) timer = host.schedule(tick, 1000 / STUDY_MOTION_HZ)
  }
  const unlisten = host.listen(visibility)
  visibility()
  return () => { stopped = true; cancel(); unlisten() }
}
