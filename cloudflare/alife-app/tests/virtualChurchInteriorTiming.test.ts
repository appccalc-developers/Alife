import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createInteriorTimingSampler, INTERIOR_TIMING_PROTOCOL } from '../src/views/virtualChurchInteriorTiming.ts'

test('three bounded, uninterrupted windows measure completed intervals, not warmup or GPU time', () => {
  const sampler = createInteriorTimingSampler()
  for (let now = 0; now <= 16000; now += 50) sampler.observe(now, true)
  const result = sampler.snapshot()
  assert.equal(result.status, 'complete')
  assert.equal(result.kind, 'completed-frame-cadence-not-gpu-time')
  assert.equal(result.uninterruptedVisibleSample, true)
  assert.equal(result.interruptions, 0)
  assert.equal(result.windows.length, 3)
  for (const window of result.windows) assert.deepEqual(window, { durationMs: 5000, intervals: 100, completedFrameHz: 20, p95IntervalMs: 50, maximumIntervalMs: 50 })
  assert.equal(sampler.observe(17000, true), null)
  result.windows[0].intervals = 0
  assert.equal(sampler.snapshot().windows[0].intervals, 100)
  assert.ok(Object.isFrozen(INTERIOR_TIMING_PROTOCOL))
})

test('one-Hz callbacks and hidden frames remain explicit interruptions, never passing samples', () => {
  const sampler = createInteriorTimingSampler()
  for (let now = 0; now <= 20000; now += 1000) sampler.observe(now, true)
  assert.equal(sampler.snapshot().windows.length, 0)
  assert.equal(sampler.snapshot().interruptions, 20)
  assert.equal(sampler.snapshot().maximumObservedGapMs, 1000)
  sampler.observe(21000, false)
  for (let now = 22000; now <= 38000; now += 50) sampler.observe(now, true)
  assert.equal(sampler.snapshot().windows.length, 3)
  assert.equal(sampler.snapshot().uninterruptedVisibleSample, false)
})

test('clock failures, duplicate timestamps and oversized buffers cannot yield a passing result', () => {
  const sampler = createInteriorTimingSampler()
  sampler.observe(100, true); sampler.observe(100, true)
  sampler.observe(NaN, true); sampler.observe(Infinity, true)
  assert.equal(sampler.snapshot().interruptions, 3)
  const fast = createInteriorTimingSampler()
  for (let now = 0; now <= 4500; now++) fast.observe(now, true)
  assert.equal(fast.snapshot().interruptions, 1)
  assert.equal(fast.snapshot().windows.length, 0)
})

test('probe is passive, main-target only, query-gated and cleaned on exit or mode changes', () => {
  const probe = readFileSync(new URL('../src/views/VirtualChurchInteriorTimingProbe.tsx', import.meta.url), 'utf8')
  assert.match(probe, /previous.apply\(this, args\)/)
  assert.match(probe, /args\[0\] !== gl \|\| gl.getRenderTarget\(\) !== null/)
  assert.match(probe, /sampler.observe\(performance.now\(\), !document.hidden\)/)
  assert.match(probe, /if \(scene.onAfterRender === hook\) scene.onAfterRender = previous/)
  assert.match(probe, /page.removeAttribute\('data-vc-interior-timing'\)/)
  assert.match(probe, /size.width, size.height, pageRef, active, room, mode, preset, motionUpdateLimitHz/)
  assert.match(probe, /if \(retired\) return/)
  assert.match(probe, /document.removeEventListener\('visibilitychange', visibility\)/)
  assert.match(probe, /samplingActivity && !samplingActivity.current/)
  assert.match(probe, /sampler.snapshot\(\).status !== 'complete'/)
  assert.doesNotMatch(probe, /invalidate\(|requestAnimationFrame\(|setTimeout\(|setInterval\(|fetch\(|console\./)
  for (const name of ['VirtualChurchMainHallView', 'VirtualChurchStudyRoomView']) {
    const view = readFileSync(new URL(`../src/views/${name}.tsx`, import.meta.url), 'utf8')
    assert.match(view, /budgetDiagnostic && new URLSearchParams\(window.location.search\).get\('profile3dTiming'\) === '1'/)
    assert.match(view, /\{timingDiagnostic \? <VirtualChurchInteriorTimingProbe/)
  }
})

test('study metadata describes the real motion-update cap, not a forced renderer frame limit', () => {
  const motion = readFileSync(new URL('../src/views/virtualChurchStudyMotion.ts', import.meta.url), 'utf8')
  const view = readFileSync(new URL('../src/views/VirtualChurchStudyRoomView.tsx', import.meta.url), 'utf8')
  assert.match(motion, /export const STUDY_MOTION_HZ = 24/)
  assert.equal((motion.match(/1000 \/ STUDY_MOTION_HZ/g) ?? []).length, 2)
  assert.match(view, /motionUpdateLimitHz=\{STUDY_MOTION_HZ\}/)
  assert.match(view, /active=\{companions.length === 5 && motion && !reducedMotion\}/)
})
