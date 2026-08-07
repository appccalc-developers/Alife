import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, Home, LayoutGrid, Menu } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { activeEntityService } from '../../services/activeEntityService'
import { useUiText } from '../../i18n/uiText'
import { confirmUnsavedChangesNavigation } from '../../utils/unsavedChangesGuard'
import { CloseIcon } from './icons'
import type { NavigationCopy, ShellNavItem, ShellNavSection } from './types'

const isItemActive = (item: ShellNavItem, pathname: string, search: string) => {
  let target: URL
  try {
    target = new URL(item.to || '/', window.location.origin)
  } catch {
    target = new URL('/', window.location.origin)
  }
  const pageEditMatch = pathname.match(/^\/pages\/([^/]+)\/edit$/)
  const activePageId = activeEntityService.getAll().pageId
  const matchesSearch = item.matchSearch
    ? (Array.isArray(item.matchSearch) ? item.matchSearch.includes(search) : search === item.matchSearch)
    : search === target.search

  return (
    (Boolean(item.pageId) && item.pageId === activePageId && (pathname.startsWith('/groups/') || pathname.startsWith('/pages'))) ||
    (!item.pageId &&
      (!item.requireNoActivePage || !activePageId) &&
      pathname === target.pathname &&
      (item.matchPathOnly || matchesSearch)) ||
    (Boolean(item.pageId) && pageEditMatch?.[1] === item.pageId)
  )
}

type NavigationClickEvent = MouseEvent<HTMLAnchorElement | HTMLButtonElement>

const isPlainClientNavigationClick = (event: NavigationClickEvent) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.shiftKey

const guardNavigationClick = (
  event: NavigationClickEvent,
  target: string,
  onAllowed?: () => void,
  onConfirmedNavigate?: () => void,
) => {
  if (!isPlainClientNavigationClick(event)) {
    return
  }

  const continueNavigation = () => {
    onAllowed?.()
    onConfirmedNavigate?.()
  }

  if (!confirmUnsavedChangesNavigation(target, continueNavigation)) {
    event.preventDefault()
    return
  }

  onAllowed?.()
}

const NavItemContent = ({ item, active, compact = false, collapsed = false }: { item: ShellNavItem; active: boolean; compact?: boolean; collapsed?: boolean }) => (
  <>
    {active && !collapsed && !compact ? <span className="absolute left-2 h-5 w-1 rounded-full bg-[#de6c4d]" aria-hidden="true" /> : null}
    <span
      className={[
        'flex shrink-0 items-center justify-center transition duration-200',
        collapsed ? 'h-10 w-10 rounded-2xl desktop:rounded-xl' : compact ? 'h-6 w-6 rounded-xl' : 'h-9 w-9 rounded-2xl desktop:rounded-xl',
        collapsed
          ? active
            ? 'bg-[#173f36] text-white desktop:shadow-none'
            : 'text-[#6d7b76] group-hover:bg-[#edf5f1] group-hover:text-[#123d34]'
          : active
            ? 'bg-[#173f36] text-white shadow-[0_10px_20px_rgba(23,63,54,0.14)] desktop:shadow-none'
            : 'bg-[#f2eee6] text-[#68766f] group-hover:bg-[#e8f1ed] group-hover:text-[#123d34]',
      ].join(' ')}
    >
      {item.icon}
    </span>
    {!collapsed ? (
      <span className="min-w-0 flex-1 text-left">
        <span className={compact ? 'block truncate text-[11px] font-bold leading-tight' : 'block truncate text-sm font-extrabold leading-5 desktop:font-semibold'}>{item.label}</span>
        {!compact && active && item.description ? <span className="mt-0.5 block truncate text-[11px] font-semibold leading-4 text-[#74837d]">{item.description}</span> : null}
      </span>
    ) : null}
  </>
)

const SidebarLink = ({ item, collapsed = false, onClick }: { item: ShellNavItem; collapsed?: boolean; onClick?: () => void }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const active = isItemActive(item, location.pathname, location.search)
  const className = [
    'group relative flex w-full items-center font-bold outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45',
    collapsed ? 'mx-auto h-11 w-11 justify-center rounded-2xl p-0 desktop:rounded-xl' : [active ? 'min-h-14' : 'min-h-12', 'gap-2.5 rounded-2xl py-1.5 pl-4 pr-2.5 desktop:rounded-xl'].join(' '),
    collapsed
      ? active
        ? 'text-[#123d34]'
        : 'text-[#53665f] hover:bg-white/60 hover:text-[#123d34]'
      : active
        ? 'bg-white text-[#123d34] shadow-[0_12px_26px_rgba(27,55,48,0.08)] ring-1 ring-[#dbe4de] desktop:bg-[#e7f0eb] desktop:shadow-none desktop:ring-0'
        : 'text-[#4e5f58] hover:bg-white/72 hover:text-[#123d34]',
  ].join(' ')
  const handleClick = (event: NavigationClickEvent) => {
    guardNavigationClick(event, item.to, () => {
      item.onClick?.()
      onClick?.()
    }, item.actionOnly ? undefined : () => navigate(item.to))
  }
  const content = <NavItemContent item={item} active={active} collapsed={collapsed} />

  return item.actionOnly ? (
    <button type="button" onClick={handleClick} title={collapsed ? item.label : undefined} aria-current={active ? 'page' : undefined} className={className}>
      {content}
    </button>
  ) : (
    <Link to={item.to} onClick={handleClick} title={collapsed ? item.label : item.description} aria-current={active ? 'page' : undefined} className={className}>
      {content}
    </Link>
  )
}

const NavigationSection = ({ section, collapsed = false, onItemClick }: { section: ShellNavSection; collapsed?: boolean; onItemClick?: () => void }) => {
  const [open, setOpen] = useState(true)
  const location = useLocation()
  const sectionActive = section.items.some((item) => isItemActive(item, location.pathname, location.search))

  useEffect(() => {
    if (sectionActive) setOpen(true)
  }, [sectionActive])

  if (!section.items.length) return null

  if (collapsed) {
    return (
      <section className={[
        'flex flex-col items-center gap-1.5 rounded-[1.25rem] p-1 transition desktop:gap-2 desktop:rounded-none desktop:bg-transparent desktop:p-0 desktop:ring-0',
        sectionActive ? 'bg-[#eef5f1] ring-1 ring-[#c9ddd4]' : 'bg-transparent',
      ].join(' ')}>
        {section.items.map((item) => <SidebarLink key={item.key} item={item} collapsed onClick={onItemClick} />)}
      </section>
    )
  }

  return (
    <section className={[
      'rounded-[1.35rem] p-1.5 transition desktop:rounded-none desktop:bg-transparent desktop:p-0 desktop:ring-0',
      sectionActive ? 'bg-[#f4f8f5] ring-1 ring-[#cddfd6]' : 'bg-[#f7f3ec] ring-1 ring-[#ded6cb]/70',
    ].join(' ')}>
      <button
        type="button"
        className={[
          'group flex w-full items-center gap-2 rounded-[1.1rem] px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45 desktop:rounded-lg desktop:px-2.5',
          open ? 'text-[#53665f] hover:bg-white/62 desktop:hover:bg-[#f1eee7]' : 'bg-white text-[#18332d] shadow-[0_10px_22px_rgba(30,54,48,0.06)] desktop:bg-[#f1eee7] desktop:shadow-none',
        ].join(' ')}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className={['block truncate text-xs font-black leading-4 desktop:font-semibold', sectionActive ? 'text-[#173f36]' : 'text-[#314840]'].join(' ')}>{section.label}</span>
          {!open && section.description ? <span className="mt-0.5 block truncate text-[11px] font-semibold leading-4 text-[#87938e]">{section.description}</span> : null}
        </span>
        <span className={['inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-black desktop:font-semibold', sectionActive ? 'bg-[#173f36] text-white' : 'bg-[#e7eee9] text-[#53665f]'].join(' ')}>
          {section.items.length}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#6b7a74] transition group-hover:bg-[#edf5f1] group-hover:text-[#123d34]">
          <ChevronDown
            className={['h-3.5 w-3.5 transition-transform duration-200', open ? '' : '-rotate-90'].join(' ')}
            aria-hidden="true"
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="mt-1 space-y-1 overflow-hidden px-0.5 pb-0.5"
          >
            {section.items.map((item) => <SidebarLink key={item.key} item={item} collapsed={collapsed} onClick={onItemClick} />)}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

const SearchNavLink = ({ item, mobile = false }: { item: ShellNavItem; mobile?: boolean }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const active = isItemActive(item, location.pathname, location.search)
  const className = [
    'group flex w-full items-center font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45',
    mobile ? 'min-w-0 flex-1 flex-col justify-center gap-1 rounded-2xl px-1 py-2 text-[11px]' : 'gap-3 rounded-xl px-3.5 py-3 text-sm',
    active ? 'bg-[#173f36] text-white shadow-[0_9px_22px_rgba(23,63,54,0.18)]' : 'text-[#60716a] hover:bg-[#e3f0eb] hover:text-[#0d4f43]',
  ].join(' ')
  const content = (
    <>
      <span className={mobile ? 'flex h-6 items-center justify-center' : 'flex h-5 w-5 items-center justify-center'}>{item.icon}</span>
      <span className={mobile ? 'max-w-full truncate leading-tight' : ''}>{item.label}</span>
    </>
  )

  return (
    <motion.div whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
      {item.actionOnly ? (
        <button type="button" className={className} onClick={(event) => guardNavigationClick(event, item.to, item.onClick)} aria-current={active ? 'page' : undefined}>
          {content}
        </button>
      ) : (
        <Link to={item.to} onClick={(event) => guardNavigationClick(event, item.to, item.onClick, () => navigate(item.to))} className={className}>
          {content}
        </Link>
      )}
    </motion.div>
  )
}

export const HeaderNavigation = ({
  items,
  currentGroupName,
  currentGroupManageTo,
}: {
  items: ShellNavItem[]
  currentGroupName?: string
  currentGroupManageTo?: string
}) => {
  const t = useUiText()
  const navigate = useNavigate()

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3" aria-label={t('appNavigation')}>
      <Link to="/" onClick={(event) => guardNavigationClick(event, '/', undefined, () => navigate('/'))} className="flex shrink-0 items-center gap-2.5 rounded-xl text-[#18332d] desktop:hidden" aria-label={t('home')}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e3f0eb] ring-1 ring-[#176b5a]/10 sm:h-10 sm:w-10 sm:rounded-2xl">
          <img src={logo} alt={t('appName')} className="h-7 w-auto drop-shadow-sm sm:h-8" />
        </span>
        <span className="hidden text-lg font-bold tracking-[-0.04em] desktop:block">Alife</span>
      </Link>
      {currentGroupName && currentGroupManageTo ? (
        <Link to={currentGroupManageTo} onClick={(event) => guardNavigationClick(event, currentGroupManageTo, undefined, () => navigate(currentGroupManageTo))} className="inline-flex h-9 min-w-0 max-w-72 flex-1 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-300 sm:h-10 sm:max-w-xs sm:flex-none sm:gap-2 sm:px-3 sm:text-sm desktop:hidden">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-emerald-700">
            <Home className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="truncate">{currentGroupName}</span>
        </Link>
      ) : currentGroupName ? (
        <span className="min-w-0 max-w-72 flex-1 truncate border-l border-[#2f4b42]/15 pl-2 text-xs font-semibold text-[#40554e] sm:max-w-xs sm:pl-3 sm:text-sm desktop:hidden">{currentGroupName}</span>
      ) : null}
      {items.map((item) => (
        <motion.div key={item.key} whileTap={{ scale: 0.95 }}>
          <NavLink
            to={item.to}
            onClick={(event) => guardNavigationClick(event, item.to, item.onClick, () => navigate(item.to))}
            end={item.to === '/'}
            className={({ isActive }) => [
              'group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition duration-200 desktop:font-semibold',
              isActive ? 'bg-[#173f36] text-white shadow-[0_9px_22px_rgba(23,63,54,0.18)]' : 'text-[#60716a] hover:bg-[#e3f0eb] hover:text-[#0d4f43]',
            ].join(' ')}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        </motion.div>
      ))}
    </nav>
  )
}

type WorkspaceNavigationProps = {
  primaryItems: ShellNavItem[]
  workspaceItems: ShellNavItem[]
  platformSections: ShellNavSection[]
  workspaceSections: ShellNavSection[]
  workspaceVisible: boolean
  workspaceName?: string
  workspaceLabel: string
  workspaceTo?: string
  userName?: string
  copy: NavigationCopy
}

const SidebarBrand = ({ collapsed }: { collapsed: boolean }) => {
  const t = useUiText()
  const navigate = useNavigate()

  return (
    <Link
      to="/"
      onClick={(event) => guardNavigationClick(event, '/', undefined, () => navigate('/'))}
      className={['flex items-center text-[#18332d] transition', collapsed ? 'mx-auto h-12 w-12 justify-center rounded-[var(--alife-radius-control)] hover:bg-[#e7eee9]' : 'gap-3 px-0.5 py-1.5'].join(' ')}
      aria-label={t('home')}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--alife-radius-control)] bg-[#e3f0eb] ring-1 ring-[#176b5a]/10">
        <img src={logo} alt={t('appName')} className="h-8 w-auto drop-shadow-sm" />
      </span>
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-5 tracking-[-0.02em]">{t('appName')}</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#78857f]">Alife</span>
        </span>
      ) : null}
    </Link>
  )
}

const CurrentSpaceLink = ({ collapsed, workspaceName, workspaceLabel, workspaceTo, copy }: {
  collapsed?: boolean
  workspaceName?: string
  workspaceLabel: string
  workspaceTo?: string
  copy: NavigationCopy
}) => {
  const target = workspaceTo || '/groups/select'
  const navigate = useNavigate()

  return (
    <Link
      to={target}
      title={collapsed ? workspaceLabel : undefined}
      onClick={(event) => guardNavigationClick(event, target, undefined, () => navigate(target))}
      className={[
        'group flex transition',
        collapsed
          ? 'h-12 w-12 items-center justify-center rounded-[var(--alife-radius-control)] bg-[#173f36] p-0 text-white hover:bg-[#12352e]'
          : 'items-center gap-3 rounded-[var(--alife-radius-control)] bg-[#f1eee7]/85 px-2.5 py-2.5 hover:bg-[#e7eee9]',
      ].join(' ')}
    >
      <div className={[
        'flex shrink-0 items-center justify-center rounded-[var(--alife-radius-control)]',
        collapsed ? 'h-10 w-10 text-white' : 'h-10 w-10 bg-[#173f36] text-white',
      ].join(' ')}>
        <LayoutGrid className="h-5 w-5" aria-hidden="true" />
      </div>
      {!collapsed ? (
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[#60716a]">{copy.currentSpace}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-[#18332d]">{workspaceName || copy.communityWorkspace}</p>
        </div>
      ) : null}
    </Link>
  )
}

export const DesktopNavigation = ({
  collapsed,
  onToggle,
  ...props
}: WorkspaceNavigationProps & { collapsed: boolean; onToggle: () => void }) => {
  const t = useUiText()
  const navigate = useNavigate()
  const workspaceSections = props.workspaceVisible ? props.workspaceSections : []

  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={['fixed bottom-0 left-0 top-0 z-20 hidden transition-[width] duration-300 desktop:block', collapsed ? 'w-20' : 'w-72'].join(' ')}
    >
      <aside className="flex h-full flex-col overflow-hidden border-r border-[#ddd4c8] bg-[#f8f5ee]/97 shadow-[10px_0_32px_rgba(30,54,48,0.06)] backdrop-blur-xl" aria-label={t('primaryNavigation')}>
        <div className={['border-b border-[#e2d8cc]', collapsed ? 'space-y-2 p-3' : 'space-y-3 p-4'].join(' ')}>
          <SidebarBrand collapsed={collapsed} />
          <CurrentSpaceLink
            collapsed={collapsed}
            workspaceName={props.workspaceName}
            workspaceLabel={props.workspaceLabel}
            workspaceTo={props.workspaceTo}
            copy={props.copy}
          />
        </div>

        <nav className={['min-h-0 flex-1 overflow-y-auto', collapsed ? 'space-y-3 px-3 py-4' : 'space-y-5 px-3 py-4'].join(' ')}>
          {workspaceSections.length ? (
            <div className={collapsed ? 'space-y-2 border-b border-[#e5ddd2] pb-3' : 'space-y-3'}>
              {workspaceSections.map((section) => <NavigationSection key={section.key} section={section} collapsed={collapsed} />)}
            </div>
          ) : null}
          <div className={collapsed ? 'space-y-2' : 'space-y-3'}>
            {props.platformSections.map((section) => <NavigationSection key={section.key} section={section} collapsed={collapsed} />)}
          </div>
        </nav>

        <div className={['border-t border-[#e2d8cc]', collapsed ? 'p-3' : 'p-3'].join(' ')}>
          {props.userName && !collapsed ? (
            <Link to="/profile" onClick={(event) => guardNavigationClick(event, '/profile', undefined, () => navigate('/profile'))} className="mb-2 flex items-center gap-3 rounded-2xl bg-white/74 px-3 py-2.5 transition hover:bg-white">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e3f0eb] text-sm font-black text-[#176b5a]">{props.userName.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#18332d]">{props.userName}</p>
                <p className="text-[11px] font-semibold text-[#7d8a85]">{props.copy.memberAccount}</p>
              </div>
            </Link>
          ) : null}
          <button type="button" className={['flex h-11 items-center justify-center rounded-xl text-xs font-semibold text-[#62736c] transition hover:bg-white hover:text-[#18332d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45', collapsed ? 'w-full' : 'w-full gap-2'].join(' ')} onClick={onToggle} aria-label={collapsed ? props.copy.expand : props.copy.collapse}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>{props.copy.collapse}</span></>}
          </button>
        </div>
      </aside>
    </motion.aside>
  )
}

export const BottomNavigation = ({
  items,
  onOpenMenu,
  copy,
}: {
  items: ShellNavItem[]
  onOpenMenu: () => void
  copy: NavigationCopy
}) => {
  const t = useUiText()
  return (
    <motion.nav initial={{ y: 80 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }} className="alife-panel fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-[calc(0.75rem+env(safe-area-inset-left))] right-[calc(0.75rem+env(safe-area-inset-right))] z-30 rounded-[1.6rem] px-2 pb-1 pt-1.5 desktop:hidden" aria-label={t('primaryNavigation')}>
      <div className="mx-auto flex max-w-lg items-stretch gap-1">
        {items.map((item) => <div key={item.key} className="flex-1"><SearchNavLink item={item} mobile /></div>)}
        <button type="button" className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold text-[#60716a] transition hover:bg-[#e3f0eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45" onClick={onOpenMenu} aria-label={copy.openMenu}>
          <span className="flex h-6 items-center justify-center"><Menu className="h-5 w-5" /></span>
          <span>{copy.menu}</span>
        </button>
      </div>
    </motion.nav>
  )
}

export const MobileNavigationDrawer = ({
  open,
  onClose,
  ...props
}: WorkspaceNavigationProps & { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate()
  const accountTarget = props.userName ? '/profile' : '/'

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-emerald-950/35 backdrop-blur-sm desktop:hidden" aria-label={props.copy.closeMenu} onClick={onClose} />
          <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 340, damping: 32 }} className="fixed bottom-[env(safe-area-inset-bottom)] left-[env(safe-area-inset-left)] top-[env(safe-area-inset-top)] z-50 flex w-[min(90vw,24rem)] flex-col bg-[#f4f0e8] p-4 shadow-2xl desktop:hidden">
            <div className="mb-4 flex items-center justify-between">
              <Link to={accountTarget} onClick={(event) => guardNavigationClick(event, accountTarget, onClose, () => navigate(accountTarget))} className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e3f0eb]"><img src={logo} alt="Alife" className="h-8 w-auto" /></span>
                <div><p className="text-lg font-black tracking-[-0.04em] text-[#18332d]">Alife</p><p className="text-[11px] font-semibold text-[#7d8a85]">{props.userName || props.copy.communityWorkspace}</p></div>
              </Link>
              <button type="button" className="alife-icon-button" onClick={onClose} aria-label={props.copy.closeMenu}><CloseIcon /></button>
            </div>

            <CurrentSpaceLink
              workspaceName={props.workspaceName}
              workspaceLabel={props.workspaceLabel}
              workspaceTo={props.workspaceTo}
              copy={props.copy}
            />

            <nav className="mt-5 min-h-0 flex-1 space-y-6 overflow-y-auto pb-8">
              {props.workspaceVisible && props.workspaceSections.length ? (
                <div className="space-y-4 rounded-[1.35rem] border border-[#ded6cb] bg-[#ece6dc]/72 p-2">
                  {props.workspaceSections.map((section) => <NavigationSection key={section.key} section={section} onItemClick={onClose} />)}
                </div>
              ) : null}
              <div className="space-y-4">
                {props.platformSections.map((section) => <NavigationSection key={section.key} section={section} onItemClick={onClose} />)}
              </div>
            </nav>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
