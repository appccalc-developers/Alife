import type { MouseEventHandler, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getWorkspaceArea } from '../../app/routing/workspaceArea'
import AppPageTitleBar from './AppPageTitleBar'
import { getChurchSiteSection } from '../../app/navigation/churchSiteNavigation'
import AppOverflowMenu, { type AppOverflowAction } from './AppOverflowMenu'
import { useGroupSiteLayout } from '../group/GroupSiteLayout'

type Props = {
  title?: string
  context?: ReactNode
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
  controls?: ReactNode
  status?: ReactNode
  primaryAction?: ReactNode
  overflowActions?: AppOverflowAction[]
  overflowLabel?: string
  backLink?: { label: string; to: string; onClick?: MouseEventHandler<HTMLAnchorElement> }
  fullBleed?: boolean
}

const AppPageShell = ({
  title,
  context,
  subtitle,
  actions,
  controls,
  status,
  primaryAction,
  overflowActions,
  overflowLabel,
  backLink,
  children,
  fullBleed = false,
}: Props) => {
  const { pathname, search } = useLocation()
  const usesLegacySystemHeader = getWorkspaceArea(pathname) === 'system'
  const groupSite = useGroupSiteLayout()
  const churchSite = groupSite || getChurchSiteSection(pathname) !== null
  const groupFeed = groupSite && !backLink && !/\/albums\/[^/]+$/.test(pathname)
  const churchFeed = groupFeed || pathname === '/church' || pathname === '/church/albums' || pathname === '/church/forum' || pathname === '/sermons'

  return (
    <section className={fullBleed ? 'mx-auto w-full max-w-none space-y-5 desktop:space-y-6' : 'mx-auto w-full max-w-6xl space-y-5 desktop:space-y-6'}>
      {churchSite ? (
        (title && !churchFeed && getChurchSiteSection(pathname, search) !== 'home') || backLink || status || primaryAction || overflowActions?.length || controls || actions ? (
          <header className={churchFeed ? 'flex flex-wrap items-center justify-end gap-3' : 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--alife-line)] bg-[var(--alife-surface-strong)] px-4 py-3'}>
            <div className="min-w-0">
              {backLink ? <Link className="mb-2 block text-sm font-bold text-[#176b5a] hover:underline" to={backLink.to} onClick={backLink.onClick}>← {backLink.label}</Link> : null}
              {title && !churchFeed ? <h2 className="text-lg font-bold text-[#18332d]">{title}</h2> : null}
              {subtitle && !churchFeed ? <p className="mt-1 max-w-3xl text-sm leading-6 text-[#66766f]">{subtitle}</p> : null}
              {status}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {controls ?? actions}
              {primaryAction}
              <AppOverflowMenu actions={overflowActions ?? []} label={overflowLabel ?? 'More actions'} />
            </div>
          </header>
        ) : null
      ) : title && usesLegacySystemHeader ? (
        <header className="flex flex-col gap-4 rounded-[var(--alife-radius-card)] border border-[#2f4b42]/10 bg-white/70 px-5 py-5 shadow-[0_10px_30px_rgba(31,56,48,0.06)] backdrop-blur sm:flex-row sm:items-end sm:justify-between sm:px-6 desktop:rounded-none desktop:border-x-0 desktop:border-t-0 desktop:bg-transparent desktop:px-1 desktop:pt-1 desktop:shadow-none desktop:backdrop-blur-none">
          <div className="min-w-0">
            <h1 className="text-2xl font-black leading-tight tracking-[-0.03em] text-[#18332d] sm:text-3xl desktop:font-bold">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66766f]">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : title ? (
        <AppPageTitleBar
          title={title}
          context={context}
          subtitle={subtitle}
          status={status}
          primaryAction={primaryAction}
          overflowActions={overflowActions}
          overflowLabel={overflowLabel}
          controls={controls ?? actions}
          backLink={backLink}
        />
      ) : null}
      {children}
    </section>
  )
}

export default AppPageShell
