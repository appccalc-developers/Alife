import type { MouseEventHandler, ReactNode } from 'react'
import AppOverflowMenu, { type AppOverflowAction } from './AppOverflowMenu'
import AppPageBackLink from './AppPageBackLink'

type BackLink = {
  label: string
  to: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

type Props = {
  title: string
  context?: ReactNode
  subtitle?: string
  showSubtitleOnMobile?: boolean
  status?: ReactNode
  primaryAction?: ReactNode
  overflowActions?: AppOverflowAction[]
  overflowLabel?: string
  controls?: ReactNode
  backLink?: BackLink
  navigation?: ReactNode
}

const AppPageTitleBar = ({
  title,
  context,
  subtitle,
  showSubtitleOnMobile = false,
  status,
  primaryAction,
  overflowActions = [],
  overflowLabel = 'More actions',
  controls,
  backLink,
  navigation,
}: Props) => (
  <header className="alife-titlebar relative z-20 rounded-[var(--alife-radius-card)] px-4 py-4 sm:px-6 sm:py-5 desktop:px-7 desktop:py-6">
    <span className="alife-titlebar-accent absolute left-6 top-0 h-1 w-16 rounded-b-full" aria-hidden="true" />
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 sm:gap-x-5">
      <div className="col-span-2 row-start-1 flex min-h-11 min-w-0 flex-wrap items-center gap-2">
        {backLink ? (
          <AppPageBackLink {...backLink} />
        ) : null}
        {context ? <div className="alife-titlebar-context min-w-0 truncate text-xs font-bold tracking-[0.02em]">{context}</div> : null}
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>

      <h1 className="alife-titlebar-title col-start-1 row-start-2 min-w-0 truncate text-2xl font-black leading-tight tracking-[-0.035em] sm:overflow-visible sm:text-clip sm:whitespace-normal sm:text-3xl desktop:text-[2.15rem]">
        {title}
      </h1>

      {primaryAction || overflowActions.length ? (
        <div className="col-start-2 row-start-2 flex shrink-0 items-center gap-2 self-center">
          {primaryAction}
          <AppOverflowMenu actions={overflowActions} label={overflowLabel} />
        </div>
      ) : null}

      {subtitle ? <p className={`alife-titlebar-subtitle col-span-2 row-start-3 max-w-3xl text-sm leading-6 sm:line-clamp-2 sm:block desktop:col-span-1 ${showSubtitleOnMobile ? '' : 'hidden'} ${navigation ? 'min-h-12 line-clamp-2' : ''}`}>{subtitle}</p> : null}
      {controls ? (
        <div className={`alife-titlebar-controls col-span-2 min-w-0 rounded-[var(--alife-radius-control)] p-2.5 desktop:col-span-1 desktop:col-start-2 desktop:p-2 ${primaryAction || overflowActions.length ? 'desktop:row-start-3' : 'desktop:row-start-2'}`}>
          {controls}
        </div>
      ) : null}
    </div>
    {navigation}
  </header>
)

export default AppPageTitleBar
