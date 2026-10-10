import { routeChunkErrorBoundaryText } from '../../i18n/routeChunkErrorBoundary.ts'
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
            {isChunkError ? routeChunkErrorBoundaryText.message : routeChunkErrorBoundaryText.message2}
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">
            {isChunkError
              ? 'Alife could not load the latest page files.'
              : 'Alife could not open this page.'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {isChunkError
              ? routeChunkErrorBoundaryText.message3
              : routeChunkErrorBoundaryText.message4}
          </p>
          {this.state.recoveryFailed && (
            <p className="mt-3 text-sm font-medium text-red-700">{routeChunkErrorBoundaryText.label}</p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
              disabled={this.state.recovering}
              onClick={() => void this.handleRefresh()}
              type="button"
            >
              {this.state.recovering ? routeChunkErrorBoundaryText.message5 : routeChunkErrorBoundaryText.message6}
            </button>
            <a
              className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-50"
              href="/"
            >{routeChunkErrorBoundaryText.label2}</a>
          </div>
        </section>
      </main>
    )
  }
}

export default RouteChunkErrorBoundary
