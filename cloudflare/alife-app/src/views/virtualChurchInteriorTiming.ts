// Completed-frame cadence, not GPU execution time. No timer or render driver.
export const INTERIOR_TIMING_PROTOCOL = Object.freeze({ warmupMs: 1000, durationMs: 5000, windows: 3, maximumGapMs: 250, maximumIntervals: 2048 })
export type InteriorTimingWindow = { durationMs: number; intervals: number; completedFrameHz: number; p95IntervalMs: number; maximumIntervalMs: number }

export function createInteriorTimingSampler() {
  const protocol = INTERIOR_TIMING_PROTOCOL
  let warmupStart: number | null = null, last: number | null = null, start: number | null = null
  let intervals: number[] = [], windows: InteriorTimingWindow[] = []
  let interruptions = 0, maximumObservedGapMs = 0
  let status: 'warming-up' | 'sampling' | 'complete' = 'warming-up'
  const restart = () => { warmupStart = null; last = null; start = null; intervals = []; status = 'warming-up' }
  const snapshot = () => ({
    schemaVersion: 1, kind: 'completed-frame-cadence-not-gpu-time', status,
    protocol, interruptions, maximumObservedGapMs,
    // Long gaps are never silently filtered into a passing result.
    uninterruptedVisibleSample: status === 'complete' && interruptions === 0,
    windows: windows.map(window => ({ ...window })),
  })
  return {
    snapshot,
    observe(now: number, visible: boolean) {
      if (status === 'complete') return null
      if (!Number.isFinite(now) || !visible || (last !== null && now <= last)) {
        interruptions++; restart(); return snapshot()
      }
      const gap = last === null ? 0 : now - last
      maximumObservedGapMs = Math.max(maximumObservedGapMs, gap)
      if (gap > protocol.maximumGapMs) {
        interruptions++; restart(); warmupStart = last = now; return snapshot()
      }
      last = now
      if (warmupStart === null) warmupStart = now
      if (now - warmupStart < protocol.warmupMs) return null
      if (start === null) { start = now; status = 'sampling'; return snapshot() }
      intervals.push(gap)
      if (intervals.length > protocol.maximumIntervals) {
        interruptions++; restart(); return snapshot()
      }
      const durationMs = now - start
      if (durationMs < protocol.durationMs) return null
      const sorted = [...intervals].sort((a, b) => a - b)
      windows.push({ durationMs, intervals: intervals.length,
        completedFrameHz: intervals.length * 1000 / durationMs,
        p95IntervalMs: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))],
        maximumIntervalMs: sorted[sorted.length - 1],
      })
      start = now; intervals = []
      if (windows.length === protocol.windows) status = 'complete'
      return snapshot()
    },
  }
}
