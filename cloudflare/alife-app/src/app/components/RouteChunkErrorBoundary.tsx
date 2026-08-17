import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isRouteChunkLoadError, refreshFailedRouteModule } from '../routing/routeChunkRecovery'

type Props = {
  children: ReactNode
}

type State = {
  error?: unknown
  recovering: boolean
  recoveryFailed: boolean
}

const initialState: State = {
  recovering: false,
  recoveryFailed: false,
}

class RouteChunkErrorBoundary extends Component<Props, State> {
  state: State = initialState

  static getDerivedStateFromError(error: unknown): State {
    return {
      error,
      recovering: false,
      recoveryFailed: false,
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Route rendering failed.', error, info)
  }

  private handleRefresh = async () => {
    this.setState({ recovering: true, recoveryFailed: false })

    try {
      const refreshed = await refreshFailedRouteModule(this.state.error)
      if (refreshed || !isRouteChunkLoadError(this.state.error)) {
        window.location.reload()
        return
      }
    } catch (error) {
      console.warn('Route module refresh failed.', error)
    }

    this.setState({ recovering: false, recoveryFailed: true })
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    const isChunkError = isRouteChunkLoadError(this.state.error)

    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center px-4 py-12 sm:px-6">
        <section
          aria-live="assertive"
          className="w-full rounded-3xl border border-amber-200 bg-amber-50 p-6 text-stone-900 shadow-sm sm:p-8"
          role="alert"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-800">
            {isChunkError ? 'Update required / 需要更新' : 'Page unavailable / 页面暂时不可用'}
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">
            {isChunkError
              ? 'Alife could not load the latest page files.'
              : 'Alife could not open this page.'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {isChunkError
              ? 'Alife 无法加载最新页面文件。请刷新模块缓存后重试。'
              : '页面加载时发生错误，请刷新后重试。'}
          </p>
          {this.state.recoveryFailed && (
            <p className="mt-3 text-sm font-medium text-red-700">
              The updated file is not available yet. Please try again shortly. / 更新文件暂时不可用，请稍后重试。
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
              disabled={this.state.recovering}
              onClick={() => void this.handleRefresh()}
              type="button"
            >
              {this.state.recovering ? 'Refreshing… / 正在刷新…' : 'Refresh / 刷新'}
            </button>
            <a
              className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-50"
              href="/"
            >
              Home / 首页
            </a>
          </div>
        </section>
      </main>
    )
  }
}

export default RouteChunkErrorBoundary
