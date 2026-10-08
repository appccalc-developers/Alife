export type VirtualChurchDeferredAssetGroup =
  | 'siteDetails'
  | 'legacyCharacter'

export const VIRTUAL_CHURCH_DEFERRED_DELAYS_MS = {
  siteDetails: {
    desktop: 750,
    mobile: 2000,
  },
  legacyCharacter: {
    desktop: 500,
    mobile: 2000,
  },
} as const

export const virtualChurchDeferredDelayMs = (
  group: VirtualChurchDeferredAssetGroup,
  isMobile: boolean,
) => VIRTUAL_CHURCH_DEFERRED_DELAYS_MS[group][
  isMobile ? 'mobile' : 'desktop'
]

/** V3 post-processing must not compete with the character's first visible frame. */
export const virtualChurchDeferredCanStart = (
  churchReadyValue: string | null,
  characterReadyValue: string | null,
  mountedAt: number,
  requireCharacterReady: boolean,
) => {
  const readyAfterMount = (value: string | null) => value !== null
    && Number.isFinite(Number(value))
    && Number(value) >= mountedAt
  return readyAfterMount(churchReadyValue)
    && (!requireCharacterReady || readyAfterMount(characterReadyValue))
}

// A decoded/mounted GLB is not yet a rendered scene. The renderer counter is
// observed on the following frame, after the previous render call returned.
// This does not claim GPU completion or a steady-state performance pass.
export const virtualChurchAssetHasRendered = (
  frameAtMount: number,
  currentFrame: number,
  documentVisible: boolean,
) => documentVisible
  && Number.isFinite(frameAtMount)
  && Number.isFinite(currentFrame)
  && frameAtMount >= 0
  && currentFrame > frameAtMount

export const VIRTUAL_CHURCH_SHADER_WARMUP_TIMEOUT_MS = 5000

// Coalesce requests for a real parent/reveal submission, never readiness itself.
// Requests expire only after the renderer's existing frame counter advances.
// Cancellation must not cancel a different asset's request at the same frame.
export const createVirtualChurchStartupSubmissions = () => {
  const requests = new Map<object, number>()
  return {
    request(afterFrame: number) {
      const owner = {}
      requests.set(owner, afterFrame)
      return () => { requests.delete(owner) }
    },
    needsFrame(currentFrame: number) {
      for (const [owner, afterFrame] of requests) {
        if (currentFrame > afterFrame) requests.delete(owner)
      }
      return requests.size > 0
    },
    clear() { requests.clear() },
  }
}

// Share one queue per renderer: separate asset jobs must not each spend their
// introspection slice in the same animation frame. Ready compile jobs can submit
// first, so arrivals link while older jobs query uniforms. Waiting jobs and
// introspection retain FIFO order; callers must not prioritise unmet conditions.
export const createVirtualChurchShaderFrameQueue = (
  requestFrame: (callback: () => void) => number,
  cancelFrame: (frame: number) => void,
) => {
  const pending = new Map<number, { callback: () => void; readyToCompile?: () => boolean | number }>()
  let nextId = 0
  let scheduledFrame: number | null = null
  let generation = 0
  const schedule = () => {
    if (scheduledFrame !== null || pending.size === 0) return
    const currentGeneration = ++generation
    scheduledFrame = requestFrame(() => {
      if (currentGeneration !== generation) return
      scheduledFrame = null
      let entry = pending.entries().next().value
      let highestPriority = 0
      // Read readiness when selecting, not when enqueuing: the renderer may
      // submit the required parent frame while this job is waiting its turn.
      // Rank2 is reserved for a ready formal-character compile. Equal ranks
      // remain FIFO; ordinary linking/introspection callbacks have no rank.
      for (const candidate of pending) {
        const readiness = candidate[1].readyToCompile?.()
        const priority = readiness === true ? 1 : typeof readiness === 'number'
          && Number.isFinite(readiness) && readiness > 0 ? Math.min(readiness, 2) : 0
        if (priority > highestPriority) { entry = candidate; highestPriority = priority }
      }
      if (!entry) return
      const [id, job] = entry
      pending.delete(id)
      try {
        job.callback()
      } finally {
        schedule()
      }
    })
  }
  return {
    requestFrame: (callback: () => void, readyToCompile?: () => boolean | number) => {
      const id = ++nextId
      pending.set(id, { callback, readyToCompile })
      schedule()
      return id
    },
    cancelFrame: (id: number) => {
      pending.delete(id)
      if (pending.size === 0 && scheduledFrame !== null) {
        cancelFrame(scheduledFrame)
        scheduledFrame = null
        generation += 1
      }
    },
  }
}

export const scheduleVirtualChurchShaderWarmup = ({
  step, finish, onError, contextLost, now, requestFrame, cancelFrame,
}: {
  step: () => boolean
  finish: () => void
  onError: (error: unknown) => void
  contextLost: () => boolean
  now: () => number
  requestFrame: (callback: () => void) => number
  cancelFrame: (frame: number) => void
}) => {
  const startedAt = now()
  let cancelled = false
  let frame = 0
  const poll = () => {
    if (cancelled || contextLost()) return
    try {
      if (now() - startedAt >= VIRTUAL_CHURCH_SHADER_WARMUP_TIMEOUT_MS || step()) {
        cancelled = true
        finish()
        return
      }
    } catch (error) {
      cancelled = true
      onError(error)
      finish()
      return
    }
    frame = requestFrame(poll)
  }
  frame = requestFrame(poll)
  return () => {
    cancelled = true
    cancelFrame(frame)
  }
}
