import { useThree } from '@react-three/fiber'
import { useLayoutEffect, type MutableRefObject } from 'react'
import { createInteriorTimingSampler } from './virtualChurchInteriorTiming'

/** Explicit review URLs only. Observe the existing main-camera submission;
 * never invalidate a demand Canvas to manufacture a continuous FPS result. */
export function VirtualChurchInteriorTimingProbe({ pageRef, active, room, mode, preset, motionUpdateLimitHz, samplingActivity }: {
  pageRef: MutableRefObject<HTMLDivElement | null>
  active: boolean
  room: 'main-hall' | 'study-room'
  mode: string
  preset: 'mobile' | 'desktop'
  motionUpdateLimitHz: number | null
  samplingActivity?: MutableRefObject<boolean>
}) {
  const { scene, gl, size } = useThree()
  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page || !active) return
    const previous = scene.onAfterRender
    let sampler = createInteriorTimingSampler(), sampling = !samplingActivity, retired = false
    const publish = (sample: ReturnType<typeof sampler.snapshot>) => page.setAttribute('data-vc-interior-timing', JSON.stringify({
      ...sample, room, mode, preset, motionUpdateLimitHz,
      drawingBuffer: [gl.domElement.width, gl.domElement.height], dpr: gl.getPixelRatio(),
    }))
    if (sampling) publish(sampler.snapshot())
    const hook: typeof scene.onAfterRender = function (this: typeof scene, ...args) {
      previous.apply(this, args)
      if (retired) return
      if (args[0] !== gl || gl.getRenderTarget() !== null) return
      if (samplingActivity && !samplingActivity.current) {
        // Standing in walk mode is intentional demand idling, not a slow
        // frame. Retain a completed result; discard an unfinished walk burst.
        if (sampling && sampler.snapshot().status !== 'complete') page.removeAttribute('data-vc-interior-timing')
        sampling = false
        return
      }
      if (!sampling) { sampler = createInteriorTimingSampler(); sampling = true; publish(sampler.snapshot()) }
      const sample = sampler.observe(performance.now(), !document.hidden)
      if (sample) publish(sample)
    }
    scene.onAfterRender = hook
    const visibility = () => {
      if (document.hidden && sampling) {
        const sample = sampler.observe(performance.now(), false)
        if (sample) publish(sample)
      }
    }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      retired = true
      document.removeEventListener('visibilitychange', visibility)
      if (scene.onAfterRender === hook) scene.onAfterRender = previous
      page.removeAttribute('data-vc-interior-timing')
    }
    // A mode/size/readiness change starts a fresh collection, not mixed samples.
  }, [scene, gl, size.width, size.height, pageRef, active, room, mode, preset, motionUpdateLimitHz, samplingActivity])
  return null
}
