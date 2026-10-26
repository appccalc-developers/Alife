export const VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC = 'locomotion'
export const VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC = 'continuous'

export type VirtualChurchLocomotionDiagnosticPhase =
  | 'idle'
  | 'walk'
  | 'walk-stop'
  | 'run'
  | 'run-stop'
  | 'turn-45-pulse'
  | 'turn-45-settle'
  | 'turn-90-pulse'
  | 'turn-90-settle'
  | 'turn-180-pulse'
  | 'turn-180-settle'
  | 'complete'
  | 'short-walk-start'
  | 'accelerate-during-start'
  | 'brief-brake'
  | 'resume-run'
  | 'run-to-walk'
  | 'walk-to-run'
  | 'reverse-held'
  | 'reverse-release'
  | 'half-walk'
  | 'quarter-walk'
  | 'analog-release'
  | 'gait-flick-walk'
  | 'gait-flick-run'

export type VirtualChurchLocomotionDiagnosticInput = {
  phase: VirtualChurchLocomotionDiagnosticPhase
  keyboardX: number
  keyboardZ: number
  sprint: boolean
  complete: boolean
}

type DiagnosticSegment = Omit<
  VirtualChurchLocomotionDiagnosticInput,
  'complete'
> & {
  durationMs: number
}

/**
 * A deterministic, opt-in input sequence for browser review of the released
 * avatar. It exercises the same controller fields as keyboard input without
 * bypassing MemberRoute or changing normal controls.
 *
 * The walk window includes enough headroom for the initial facing correction,
 * authored start clip and at least one visible loop before the stop window.
 * Stop windows expose the authored deceleration clips. The diagonal/cardinal
 * pulses then establish successive 45, 90 and 180 degree target-yaw changes;
 * their idle windows let the controller finish each full-body pivot.
 */
export const VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC_SEGMENTS = [
  { phase: 'idle', durationMs: 400, keyboardX: 0, keyboardZ: 0, sprint: false },
  { phase: 'walk', durationMs: 2200, keyboardX: 0, keyboardZ: -1, sprint: false },
  { phase: 'walk-stop', durationMs: 500, keyboardX: 0, keyboardZ: 0, sprint: false },
  { phase: 'run', durationMs: 1200, keyboardX: 0, keyboardZ: -1, sprint: true },
  { phase: 'run-stop', durationMs: 600, keyboardX: 0, keyboardZ: 0, sprint: false },
  { phase: 'turn-45-pulse', durationMs: 100, keyboardX: -1, keyboardZ: -1, sprint: false },
  { phase: 'turn-45-settle', durationMs: 600, keyboardX: 0, keyboardZ: 0, sprint: false },
  { phase: 'turn-90-pulse', durationMs: 100, keyboardX: 1, keyboardZ: -1, sprint: false },
  { phase: 'turn-90-settle', durationMs: 1000, keyboardX: 0, keyboardZ: 0, sprint: false },
  { phase: 'turn-180-pulse', durationMs: 100, keyboardX: -1, keyboardZ: 1, sprint: false },
  { phase: 'turn-180-settle', durationMs: 1900, keyboardX: 0, keyboardZ: 0, sprint: false },
] as const satisfies readonly DiagnosticSegment[]

export const VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC_DURATION_MS =
  VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC_SEGMENTS.reduce(
    (total, segment) => total + segment.durationMs,
    0,
  )

// Keep interruptions separate from the full-clip review. These inputs use the
// normal controller; they deliberately do not wait for authored clips to end.
export const VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC_SEGMENTS = [
  { phase: 'idle', durationMs: 400, keyboardX: 0, keyboardZ: 0, sprint: false },
  { phase: 'short-walk-start', durationMs: 200, keyboardX: 0, keyboardZ: -1, sprint: false },
  { phase: 'accelerate-during-start', durationMs: 1100, keyboardX: 0, keyboardZ: -1, sprint: true },
  { phase: 'brief-brake', durationMs: 200, keyboardX: 0, keyboardZ: 0, sprint: false },
  { phase: 'resume-run', durationMs: 1000, keyboardX: 0, keyboardZ: -1, sprint: true },
  { phase: 'run-to-walk', durationMs: 1100, keyboardX: 0, keyboardZ: -1, sprint: false },
  { phase: 'walk-to-run', durationMs: 80, keyboardX: 0, keyboardZ: -1, sprint: true },
  { phase: 'gait-flick-walk', durationMs: 80, keyboardX: 0, keyboardZ: -1, sprint: false },
  { phase: 'gait-flick-run', durationMs: 700, keyboardX: 0, keyboardZ: -1, sprint: true },
  { phase: 'reverse-held', durationMs: 2300, keyboardX: 0, keyboardZ: 1, sprint: true },
  { phase: 'reverse-release', durationMs: 1200, keyboardX: 0, keyboardZ: 0, sprint: false },
  { phase: 'half-walk', durationMs: 1800, keyboardX: 0, keyboardZ: 0.5, sprint: false },
  { phase: 'quarter-walk', durationMs: 1200, keyboardX: 0, keyboardZ: 0.25, sprint: false },
  { phase: 'analog-release', durationMs: 1000, keyboardX: 0, keyboardZ: 0, sprint: false },
] as const satisfies readonly DiagnosticSegment[]

const COMPLETE_INPUT: VirtualChurchLocomotionDiagnosticInput = {
  phase: 'complete',
  keyboardX: 0,
  keyboardZ: 0,
  sprint: false,
  complete: true,
}

// Entire existing continuous input sequence, not the unrelated five-second FPS
// window. Keep every long interval and missing phase; never reset to green.
export function createVirtualChurchContinuousSubmissionSampler() {
  const expected = VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC_SEGMENTS.map(segment => segment.phase as string)
  const intervals: number[] = [], phases: string[] = []
  let first: number | null = null, previous: number | null = null, currentPhase = ''
  let firstSimulatedMs: number | null = null, lastSimulatedMs: number | null = null
  let frames = 0, interruptions = 0, maximumGapMs = 0, overflow = false, ordered = true, readyThroughout = true, complete = false
  const snapshot = () => {
    const sorted = [...intervals].sort((a, b) => a - b)
    const durationMs = first === null || previous === null ? 0 : Math.max(0, previous - first)
    const covered = expected.every((phase, index) => phases[index] === phase) && phases.length === expected.length
    return { kind: 'whole-input-sequence-main-scene-submission-cadence-not-gpu-time', status: complete ? 'complete' : 'running',
      phase: currentPhase, expectedPhases: [...expected], observedPhases: [...phases], frames, durationMs,
      firstSimulatedMs, lastSimulatedMs, interruptions, maximumGapMs, overflow, ordered, readyThroughout,
      coversWholeSequence: covered && firstSimulatedMs !== null && firstSimulatedMs <= 50,
      uninterrupted: complete && covered && firstSimulatedMs !== null && firstSimulatedMs <= 50 && interruptions === 0 && !overflow && ordered && readyThroughout,
      completedSubmissionHz: durationMs > 0 ? (frames - 1) * 1000 / durationMs : null,
      p95IntervalMs: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : null }
  }
  return {
    snapshot,
    observe(now: number, visible: boolean, phase: string | null, simulatedMs: number | null, assetsReady: boolean) {
      if (complete || phase === null) return null
      if (!Number.isFinite(now) || (previous !== null && now <= previous)) { interruptions++; return snapshot() }
      if (!visible) interruptions++
      readyThroughout &&= assetsReady
      if (first === null) { first = now; firstSimulatedMs = simulatedMs }
      if (previous !== null) {
        const gap = now - previous
        maximumGapMs = Math.max(maximumGapMs, gap)
        if (gap > 250) interruptions++
        if (intervals.length < 4096) intervals.push(gap)
        else overflow = true
      }
      previous = now; frames++
      if (simulatedMs !== null && Number.isFinite(simulatedMs)) lastSimulatedMs = simulatedMs
      const changed = phase !== currentPhase
      if (changed && phase !== 'complete') {
        if (expected.indexOf(phase) !== phases.length) ordered = false
        if (phases.length < expected.length + 1) phases.push(phase)
        else overflow = true
      }
      currentPhase = phase
      if (phase === 'complete') complete = true
      return changed || complete ? snapshot() : null
    },
  }
}

export const virtualChurchLocomotionDiagnosticInputAt = (
  elapsedMs: number,
  reviewMotion = false,
  continuous = false,
): VirtualChurchLocomotionDiagnosticInput => {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return {
      phase: 'idle',
      keyboardX: 0,
      keyboardZ: 0,
      sprint: false,
      complete: false,
    }
  }

  let remainingMs = elapsedMs
  const segments = continuous
    ? VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC_SEGMENTS
    : VIRTUAL_CHURCH_LOCOMOTION_DIAGNOSTIC_SEGMENTS
  for (const segment of segments) {
    // Candidate stops are 0.80/0.85 s, longer than the released clips. Leave
    // an idle window so this review observes the entire brake before turning.
    const durationMs = reviewMotion && (segment.phase === 'walk-stop' || segment.phase === 'run-stop')
      ? segment.phase === 'walk-stop' ? 1100 : 1150
      : segment.durationMs
    if (remainingMs < durationMs) {
      return {
        phase: segment.phase,
        keyboardX: segment.keyboardX,
        keyboardZ: segment.keyboardZ,
        sprint: segment.sprint,
        complete: false,
      }
    }
    remainingMs -= durationMs
  }

  return COMPLETE_INPUT
}
