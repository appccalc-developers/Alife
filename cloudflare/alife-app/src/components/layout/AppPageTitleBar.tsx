import type { MouseEventHandler, ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppOverflowMenu, { type AppOverflowAction } from './AppOverflowMenu'

type BackLink = {
  label: string
  to: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

type Props = {
  title: string
  context?: ReactNode
  subtitle?: string
  status?: ReactNode
  primaryAction?: ReactNode
  overflowActions?: AppOverflowAction[]
  overflowLabel?: string
  controls?: ReactNode
  backLink?: BackLink
}

const AppPageTitleBar = ({
  title,
  context,
  subtitle,
  status,
  primaryAction,
  overflowActions = [],
  overflowLabel = 'More actions',
  controls,
  backLink,
}: Props) => (
  <header className="alife-titlebar relative z-20 rounded-[var(--alife-radius-card)] px-4 py-3 sm:px-5 sm:py-4 desktop:px-6 desktop:py-5">
    <span className="alife-titlebar-accent absolute bottom-3 left-0 top-3 w-1 rounded-r-full" aria-hidden="true" />
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 sm:gap-x-5">
      <div className="col-span-2 row-start-1 flex min-h-5 min-w-0 items-center gap-2 pl-1">
        {backLink ? (
          <Link
            to={backLink.to}
            className="alife-titlebar-back inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition sm:h-auto sm:w-auto sm:gap-1 sm:px-1 sm:text-xs sm:font-bold"
            aria-label={backLink.label}
            title={backLink.label}
            onClick={backLink.onClick}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{backLink.label}</span>
          </Link>
        ) : null}
        {context ? <div className="alife-titlebar-context min-w-0 truncate text-[0.68rem] font-black uppercase tracking-[0.14em] sm:tracking-[0.18em]">{context}</div> : null}
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>

      <h1 className="alife-titlebar-title col-start-1 row-start-2 min-w-0 truncate pl-1 text-xl font-black leading-tight tracking-[-0.035em] sm:overflow-visible sm:text-clip sm:whitespace-normal sm:text-3xl desktop:text-[2rem]">
        {title}
      </h1>

      {primaryAction || overflowActions.length ? (
        <div className="col-start-2 row-start-2 flex shrink-0 items-center gap-2 self-center">
          {primaryAction}
          <AppOverflowMenu actions={overflowActions} label={overflowLabel} />
        </div>
      ) : null}

      {subtitle ? <p className="alife-titlebar-subtitle col-span-2 row-start-3 hidden max-w-3xl pl-1 text-sm leading-6 sm:line-clamp-2 sm:block desktop:col-span-1">{subtitle}</p> : null}
      {controls ? (
        <div className={`alife-titlebar-controls-slot col-span-2 min-w-0 border-t pt-3 desktop:col-span-1 desktop:col-start-2 desktop:border-0 desktop:pt-0 ${primaryAction || overflowActions.length ? 'desktop:row-start-3' : 'desktop:row-start-2'}`}>
          <div className="alife-titlebar-controls rounded-xl p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.48),0_8px_20px_rgba(7,42,35,0.12)] desktop:p-2">
            {controls}
          </div>
        </div>
      ) : null}
    </div>
  </header>
)

export default AppPageTitleBar
