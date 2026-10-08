import { Component, type ErrorInfo, type ReactNode } from 'react'
import {
  VIRTUAL_CHURCH_RECOVERY_CLEANUP_TIMEOUT_MS,
  VIRTUAL_CHURCH_RECOVERY_NAVIGATION_GRACE_MS,
  virtualChurchChunkLoadFailed,
  virtualChurchRecoveryCacheIsAffected,
  virtualChurchRecoveryMarkerIsPresent,
  virtualChurchRecoveryNavigationUrl,
  virtualChurchRecoveryServiceWorkerIsAffected,
  virtualChurchRecoveryShouldStart,
} from './virtualChurchRouteRecoveryContract'

export const VIRTUAL_CHURCH_CHUNK_RECOVERY_KEY =
  'alife:virtual-church:chunk-recovery-attempted'
export const VIRTUAL_CHURCH_LAST_ERROR_KEY =
  'alife:virtual-church:last-route-error'

const virtualChurchErrorMessage = (error: unknown) =>
  error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error)

let virtualChurchRecoveryInFlight: Promise<void> | null = null

export const recoverVirtualChurchChunkOnce = (force = false) => {
  if (virtualChurchRecoveryInFlight !== null) return virtualChurchRecoveryInFlight

  let storageAttempted: boolean | null = null
  try {
    storageAttempted =
      window.sessionStorage.getItem(VIRTUAL_CHURCH_CHUNK_RECOVERY_KEY) === 'true'
  } catch {
    // The URL marker supplies the reload-loop guard when storage is unavailable.
  }

  if (!virtualChurchRecoveryShouldStart({
    force,
    markerPresent: virtualChurchRecoveryMarkerIsPresent(window.location.href),
    storageAttempted,
    online: navigator.onLine !== false,
  })) {
    return null
  }

  try {
    window.sessionStorage.setItem(VIRTUAL_CHURCH_CHUNK_RECOVERY_KEY, 'true')
  } catch {
    // Continue: the navigation marker prevents an automatic reload loop.
  }

  const recovery = (async () => {
    const cleanupTasks: Promise<unknown>[] = []

    if ('serviceWorker' in navigator) {
      cleanupTasks.push(
        navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.allSettled(
            registrations
              .filter((registration) =>
                virtualChurchRecoveryServiceWorkerIsAffected(
                  registration.scope,
                  window.location.href,
                ))
              .map((registration) => registration.unregister()),
          )),
      )
    }

    if ('caches' in window) {
      cleanupTasks.push(
        window.caches.keys().then((cacheNames) =>
          Promise.allSettled(
            cacheNames
              // The shell entry is in Workbox precache. If it remains while
              // the route-code cache is cleared, the old shell immediately
              // requests the same deleted chunk and recovery loops.
              .filter(virtualChurchRecoveryCacheIsAffected)
              .map((cacheName) => window.caches.delete(cacheName)),
          )),
      )
    }

    let cleanupTimeout: number | undefined
    try {
      await Promise.race([
        Promise.allSettled(cleanupTasks),
        new Promise<void>((resolvePromise) => {
          cleanupTimeout = window.setTimeout(
            resolvePromise,
            VIRTUAL_CHURCH_RECOVERY_CLEANUP_TIMEOUT_MS,
          )
        }),
      ])
    } finally {
      if (cleanupTimeout !== undefined) window.clearTimeout(cleanupTimeout)
    }

    // A normal reload can reuse stale HTTP-cached index.html even after
    // CacheStorage is clean. The one-time query marker forces a fresh
    // navigation while preserving every real route/query parameter.
    window.location.replace(virtualChurchRecoveryNavigationUrl(
      window.location.href,
      Date.now().toString(36),
    ))

    // Keep the action locked while the replacement navigation starts. If the
    // document remains mounted after this grace period, the promise settles
    // and requestChunkRecovery exposes the manual retry again.
    await new Promise<void>((resolvePromise) => {
      window.setTimeout(
        resolvePromise,
        VIRTUAL_CHURCH_RECOVERY_NAVIGATION_GRACE_MS,
      )
    })
  })()

  virtualChurchRecoveryInFlight = recovery
  void recovery.then(
    () => {
      if (virtualChurchRecoveryInFlight === recovery) {
        virtualChurchRecoveryInFlight = null
      }
    },
    () => {
      if (virtualChurchRecoveryInFlight === recovery) {
        virtualChurchRecoveryInFlight = null
      }
    },
  )
  return recovery
}

type VirtualChurchRouteBoundaryState = {
  error: unknown
  recoveryRequested: boolean
  offline: boolean
}

class VirtualChurchRouteBoundary extends Component<
  { children: ReactNode },
  VirtualChurchRouteBoundaryState
> {
  private routeMounted = false

  state: VirtualChurchRouteBoundaryState = {
    error: null,
    recoveryRequested: false,
    offline: typeof navigator !== 'undefined' && navigator.onLine === false,
  }

  componentDidMount() {
    this.routeMounted = true
    window.addEventListener('online', this.updateConnectionState)
    window.addEventListener('offline', this.updateConnectionState)
  }

  componentWillUnmount() {
    this.routeMounted = false
    window.removeEventListener('online', this.updateConnectionState)
    window.removeEventListener('offline', this.updateConnectionState)
  }

  updateConnectionState = () => {
    this.setState({ offline: navigator.onLine === false })
  }

  static getDerivedStateFromError(error: unknown): Pick<VirtualChurchRouteBoundaryState, 'error' | 'recoveryRequested'> {
    return { error, recoveryRequested: false }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Keep the exact runtime failure visible in DevTools while ensuring members
    // receive a recovery screen instead of an empty application root.
    // eslint-disable-next-line no-console
    console.error('Virtual Church route failed:', error, info)

    try {
      window.sessionStorage.setItem(
        VIRTUAL_CHURCH_LAST_ERROR_KEY,
        virtualChurchErrorMessage(error),
      )
    } catch {
      // The visible recovery details remain available without session storage.
    }

    if (virtualChurchChunkLoadFailed(error)) {
      this.requestChunkRecovery()
    }
  }

  requestChunkRecovery = (force = false) => {
    const recovery = recoverVirtualChurchChunkOnce(force)
    if (recovery === null) {
      this.updateConnectionState()
      return false
    }

    this.setState({ recoveryRequested: true })
    void recovery.then(
      () => {
        // A successful location.replace normally unloads this component. If
        // navigation is cancelled, re-enable the explicit recovery action.
        if (this.routeMounted) this.setState({ recoveryRequested: false })
      },
      (error) => {
        // Keep the original route error visible, but do not permanently lock
        // the user out of a second clean-reload attempt.
        // eslint-disable-next-line no-console
        console.error('Virtual Church clean reload failed:', error)
        if (this.routeMounted) this.setState({ recoveryRequested: false })
      },
    )
    return true
  }

  handleReload = () => {
    if (!virtualChurchChunkLoadFailed(this.state.error)) {
      window.location.reload()
      return
    }

    this.requestChunkRecovery(true)
  }

  render() {
    if (this.state.error === null) return this.props.children

    const chunkLoadError = virtualChurchChunkLoadFailed(this.state.error)
    const errorMessage = virtualChurchErrorMessage(this.state.error)

    return (
      <main className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f4f7f5] px-6 text-[#173f36]">
        <section
          aria-labelledby="virtual-church-recovery-title"
          className="w-full max-w-lg rounded-3xl border border-[#c9d9d2] bg-white p-7 text-center shadow-xl"
          role="alert"
        >
          <h1 id="virtual-church-recovery-title" className="text-2xl font-black">
            虚拟教堂暂时无法打开
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#64756e]">
            {chunkLoadError
              ? this.state.offline
                ? '当前离线，暂时无法取得更新后的教堂资源。现有缓存已保留；联网后再清理并重载。'
                : '页面代码更新时发生了加载冲突。我们已尝试刷新失效缓存；如果页面没有自动恢复，请重新加载。'
              : '加载 3D 场景时发生了运行时错误。教堂页面已安全停止，普通查经和小组功能不受影响。'}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#82918b]">
            {chunkLoadError
              ? this.state.offline
                ? 'Offline: existing caches are preserved. Reconnect, then clean and reload the church resources.'
                : 'The page code could not finish updating. Reload to recover the latest resources.'
              : 'The 3D scene stopped after a runtime error. Other Alife features remain available.'}
          </p>
          <details className="mt-5 rounded-xl bg-[#f2f5f3] px-4 py-3 text-left">
            <summary className="cursor-pointer text-xs font-black text-[#176b5a]">
              技术详情 / Technical details
            </summary>
            <code className="mt-2 block break-words text-xs leading-5 text-[#53635d]">
              {errorMessage}
            </code>
          </details>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              aria-busy={this.state.recoveryRequested}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#176b5a] px-5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-65"
              disabled={this.state.recoveryRequested || (chunkLoadError && this.state.offline)}
              onClick={this.handleReload}
            >
              {this.state.recoveryRequested
                ? '正在清理并重载 / Cleaning…'
                : chunkLoadError && this.state.offline
                  ? '联网后重试 / Reconnect to retry'
                : chunkLoadError
                  ? '清理并重载 / Clean reload'
                  : '重新加载 / Reload'}
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#176b5a] bg-white px-5 text-sm font-black text-[#176b5a]"
              onClick={() => window.location.assign('/')}
            >
              返回首页 / Home
            </button>
          </div>
        </section>
      </main>
    )
  }
}

export default VirtualChurchRouteBoundary
