export const PASSKEY_REQUEST_TIMEOUT_MS = 2 * 60 * 1000

type TimerHandle = ReturnType<typeof globalThis.setTimeout>

type TimerScheduler = {
  setTimeout: (handler: () => void, delayMs: number) => TimerHandle
  clearTimeout: (handle: TimerHandle) => void
}

export type PasskeyRequestGuard = {
  signal: AbortSignal
  complete: () => void
  dispose: () => void
}

const defaultScheduler: TimerScheduler = {
  setTimeout: (handler, delayMs) => globalThis.setTimeout(handler, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
}

export const createPasskeyRequestGuard = (
  timeoutMs = PASSKEY_REQUEST_TIMEOUT_MS,
  scheduler: TimerScheduler = defaultScheduler,
): PasskeyRequestGuard => {
  const controller = new AbortController()
  let timer: TimerHandle | undefined = scheduler.setTimeout(() => {
    timer = undefined
    controller.abort(new DOMException('Passkey request timed out.', 'TimeoutError'))
  }, timeoutMs)

  const clearTimer = () => {
    if (timer === undefined) return
    scheduler.clearTimeout(timer)
    timer = undefined
  }

  return {
    signal: controller.signal,
    complete: clearTimer,
    dispose: () => {
      clearTimer()
      if (!controller.signal.aborted) {
        controller.abort(new DOMException('Passkey request stopped.', 'AbortError'))
      }
    },
  }
}
