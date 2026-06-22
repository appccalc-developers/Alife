import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Home, LayoutGrid, Menu } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { activeEntityService } from '../../services/activeEntityService'
import { useUiText } from '../../i18n/uiText'
import { CloseIcon } from './icons'
import type { NavigationCopy, ShellNavItem } from './types'

const isItemActive = (item: ShellNavItem, pathname: string, search: string) => {
  let target: URL
  try {
    target = new URL(item.to || '/', window.location.origin)
  } catch {
    target = new URL('/', window.location.origin)
  }
  const pageEditMatch = pathname.match(/^\/pages\/([^/]+)\/edit$/)
  const activePageId = activeEntityService.getAll().pageId

  return (
    (Boolean(item.pageId) && item.pageId === activePageId && (pathname.startsWith('/groups/') || pathname.startsWith('/pages'))) ||
    (!item.pageId &&
      (!item.requireNoActivePage || !activePageId) &&
      pathname === target.pathname &&
      (item.matchSearch ? search === item.matchSearch : search === target.search)) ||
    (Boolean(item.pageId) && pageEditMatch?.[1] === item.pageId)
  )
}

const SearchNavLink = ({ item, mobile = false }: { item: ShellNavItem; mobile?: boolean }) => {
  const location = useLocation()
  const active = isItemActive(item, location.pathname, location.search)
  const className = [
    'group flex w-full items-center font-semibold transition duration-200',
    mobile ? 'min-w-0 flex-1 flex-col justify-center gap-1 rounded-2xl px-1 py-2 text-[11px]' : 'gap-3 rounded-xl px-3.5 py-3 text-sm',
    active ? 'bg-[#176b5a] text-white shadow-[0_9px_22px_rgba(23,107,90,0.22)]' : 'text-[#60716a] hover:bg-[#e3f0eb] hover:text-[#0d4f43]',
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
        <button type="button" className={className} onClick={item.onClick} aria-current={active ? 'page' : undefined}>
          {content}
        </button>
      ) : (
        <Link to={item.to} onClick={item.onClick} className={className}>
          {content}
        </Link>
      )}
    </motion.div>
  )
}

const SidebarLink = ({ item, collapsed = false }: { item: ShellNavItem; collapsed?: boolean }) => {
  const location = useLocation()
  const active = isItemActive(item, location.pathname, location.search)
  const className = [
    'group relative flex min-h-11 w-full items-center rounded-2xl font-semibold transition duration-200',
    collapsed ? 'justify-center px-2' : 'gap-3 px-3.5',
    active ? 'border border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[0_10px_24px_rgba(23,107,90,0.08)]' : 'text-[#60716a] hover:bg-white/80 hover:text-[#0d4f43]',
  ].join(' ')
  const content = (
    <>
      <span className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition', active ? 'bg-white text-emerald-700 shadow-sm' : 'bg-[#e7eee9] group-hover:bg-[#dcebe5]'].join(' ')}>
        {item.icon}
      </span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate text-left text-sm">{item.label}</span> : null}
      {active && !collapsed ? <span className="h-1.5 w-1.5 rounded-full bg-[#e8664b]" /> : null}
    </>
  )

  return item.actionOnly ? (
    <button
      type="button"
      onClick={item.onClick}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={className}
    >
      {content}
    </button>
  ) : (
    <Link
      to={item.to}
      onClick={item.onClick}
      title={collapsed ? item.label : undefined}
      className={className}
    >
      {content}
    </Link>
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

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto" aria-label={t('appNavigation')}>
      <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-xl text-[#18332d]" aria-label={t('home')}>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e3f0eb] ring-1 ring-[#176b5a]/10">
          <img src={logo} alt={t('appName')} className="h-8 w-auto drop-shadow-sm" />
        </span>
        <span className="hidden text-lg font-bold tracking-[-0.04em] sm:block">Alife</span>
      </Link>
      {currentGroupName && currentGroupManageTo ? (
        <Link to={currentGroupManageTo} className="inline-flex h-10 max-w-72 shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-300 sm:max-w-xs">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-emerald-700">
            <Home className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="truncate">{currentGroupName}</span>
        </Link>
      ) : currentGroupName ? (
        <span className="max-w-72 shrink-0 truncate border-l border-[#2f4b42]/15 pl-3 text-sm font-semibold text-[#40554e] sm:max-w-xs">{currentGroupName}</span>
      ) : null}
      {items.map((item) => (
        <motion.div key={item.key} whileTap={{ scale: 0.95 }}>
          <NavLink
            to={item.to}
            onClick={item.onClick}
            end={item.to === '/'}
            className={({ isActive }) => [
              'group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition duration-200',
              isActive ? 'bg-[#176b5a] text-white shadow-[0_9px_22px_rgba(23,107,90,0.22)]' : 'text-[#60716a] hover:bg-[#e3f0eb] hover:text-[#0d4f43]',
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
  workspaceVisible: boolean
  workspaceName?: string
  workspaceLabel: string
  workspaceTo?: string
  userName?: string
  copy: NavigationCopy
}

export const DesktopNavigation = ({
  collapsed,
  onToggle,
  ...props
}: WorkspaceNavigationProps & { collapsed: boolean; onToggle: () => void }) => {
  const t = useUiText()

  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={['fixed bottom-0 left-0 top-[4.5rem] z-20 hidden py-4 pl-4 transition-[width] duration-300 desktop:block', collapsed ? 'w-24 pr-3' : 'w-80 pr-4'].join(' ')}
    >
      <aside className="alife-panel flex h-full flex-col overflow-hidden rounded-[2rem]" aria-label={t('primaryNavigation')}>
        <div className={['border-b border-[#2f4b42]/10', collapsed ? 'p-3' : 'p-4'].join(' ')}>
          <Link
            to={props.workspaceTo || '/groups/select'}
            title={collapsed ? props.workspaceLabel : undefined}
            className={[
              'flex rounded-2xl transition hover:bg-white/70',
              collapsed ? 'justify-center p-1' : 'items-center gap-3 p-2',
            ].join(' ')}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a9892]">{props.workspaceLabel}</p>
                <p className="mt-0.5 truncate text-sm font-bold text-[#18332d]">{props.workspaceName || props.copy.communityWorkspace}</p>
              </div>
            ) : null}
          </Link>
        </div>
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {props.workspaceVisible ? (
            <section>
              {!collapsed ? <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#94a19c]">{props.workspaceLabel}</p> : null}
              <div className="space-y-1">
                {props.workspaceItems.map((item) => <SidebarLink key={item.key} item={item} collapsed={collapsed} />)}
              </div>
            </section>
          ) : null}
          <section className={props.workspaceVisible ? 'border-t border-[#2f4b42]/10 pt-4' : ''}>
            {!collapsed ? <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#94a19c]">{props.copy.platformWorkspace}</p> : null}
            <div className="space-y-1">{props.primaryItems.map((item) => <SidebarLink key={item.key} item={item} collapsed={collapsed} />)}</div>
          </section>
        </nav>
        <div className="border-t border-[#2f4b42]/10 p-3">
          {props.userName && !collapsed ? (
            <Link to="/profile" className="mb-2 flex items-center gap-3 rounded-2xl bg-white/55 px-3 py-2.5 transition hover:bg-white">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e3f0eb] text-sm font-bold text-[#176b5a]">{props.userName.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#18332d]">{props.userName}</p>
                <p className="text-[11px] text-[#7d8a85]">{props.copy.memberAccount}</p>
              </div>
            </Link>
          ) : null}
          <button type="button" className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-[#71807a] transition hover:bg-white/70 hover:text-[#18332d]" onClick={onToggle} aria-label={collapsed ? props.copy.expand : props.copy.collapse}>
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
    <motion.nav initial={{ y: 80 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }} className="alife-panel fixed inset-x-3 bottom-3 z-30 rounded-[1.6rem] px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1.5 desktop:hidden" aria-label={t('primaryNavigation')}>
      <div className="mx-auto flex max-w-lg items-stretch gap-1">
        {items.map((item) => <div key={item.key} className="flex-1"><SearchNavLink item={item} mobile /></div>)}
        <button type="button" className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold text-[#60716a] transition hover:bg-[#e3f0eb]" onClick={onOpenMenu} aria-label={copy.openMenu}>
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
}: WorkspaceNavigationProps & { open: boolean; onClose: () => void }) => (
  <AnimatePresence>
    {open ? (
      <>
        <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-emerald-950/25 backdrop-blur-sm desktop:hidden" aria-label={props.copy.closeMenu} onClick={onClose} />
        <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 340, damping: 32 }} className="fixed bottom-0 left-0 top-0 z-50 flex w-[min(88vw,22rem)] flex-col bg-[#f8f4eb] p-4 shadow-2xl desktop:hidden">
          <div className="mb-5 flex items-center justify-between">
            <Link to={props.userName ? '/profile' : '/'} onClick={onClose} className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e3f0eb]"><img src={logo} alt="Alife" className="h-8 w-auto" /></span>
              <div><p className="text-lg font-black tracking-[-0.04em] text-[#18332d]">Alife</p><p className="text-[11px] font-semibold text-[#7d8a85]">{props.userName || props.copy.communityWorkspace}</p></div>
            </Link>
            <button type="button" className="alife-icon-button" onClick={onClose} aria-label={props.copy.closeMenu}><CloseIcon /></button>
          </div>
          <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto">
            {props.workspaceVisible ? (
              <section>
                <Link to={props.workspaceTo || '/groups/select'} onClick={onClose} className="mb-2 block rounded-2xl px-2 py-2 transition hover:bg-white/70">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#94a19c]">{props.workspaceLabel}</p>
                  {props.workspaceName ? <p className="mt-1 truncate text-sm font-bold text-[#18332d]">{props.workspaceName}</p> : null}
                </Link>
                <div className="space-y-1">{props.workspaceItems.map((item) => <SidebarLink key={item.key} item={item} />)}</div>
              </section>
            ) : null}
            <section><p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#94a19c]">{props.copy.platformWorkspace}</p><div className="space-y-1">{props.primaryItems.map((item) => <SidebarLink key={item.key} item={item} />)}</div></section>
          </nav>
        </motion.aside>
      </>
    ) : null}
  </AnimatePresence>
)
