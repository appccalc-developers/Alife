import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { activeEntityService } from '../../services/activeEntityService'
import { useUiText } from '../../i18n/uiText'
import { confirmUnsavedChangesNavigation } from '../../utils/unsavedChangesGuard'
import { CloseIcon } from './icons'
import { matchesRequiredSearch } from './searchMatch'
import type { NavigationCopy, ShellNavBadge, ShellNavItem, ShellNavSection } from './types'

const isItemActive = (item: ShellNavItem, pathname: string, search: string) => {
  if (item.children?.some((child) => isItemActive(child, pathname, search))) return true
  let target: URL
  try {
    target = new URL(item.to || '/', window.location.origin)
  } catch {
    target = new URL('/', window.location.origin)
  }
  const pageEditMatch = pathname.match(/^\/pages\/([^/]+)\/edit$/)
  const activePageId = activeEntityService.getAll().pageId
  const matchesSearch = item.matchSearch
    ? (Array.isArray(item.matchSearch)
        ? item.matchSearch.some((requiredSearch) => matchesRequiredSearch(search, requiredSearch))
        : matchesRequiredSearch(search, item.matchSearch))
    : search === target.search

  return (
    (Boolean(item.pageId) && item.pageId === activePageId && (pathname.startsWith('/groups/') || pathname.startsWith('/pages'))) ||
    (!item.pageId &&
      (!item.requireNoActivePage || !activePageId) &&
      (pathname === target.pathname || (item.matchDescendants && pathname.startsWith(`${target.pathname}/`))) &&
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

const NavItemBadge = ({ badge, collapsed, itemLabel }: { badge: ShellNavBadge; collapsed: boolean; itemLabel: string }) => {
  const toneClass = badge.tone === 'urgent'
    ? 'bg-[#de6c4d] text-white ring-[#bd4c33]/30'
    : badge.tone === 'general'
      ? 'bg-[#176b5a] text-white ring-[#0d4f43]/25'
      : badge.tone === 'attention'
        ? 'bg-amber-100 text-amber-800 ring-amber-200'
        : 'bg-slate-100 text-slate-600 ring-slate-200'

  if (collapsed) {
    return (
      <>
        <span
          aria-hidden="true"
          className={['absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black leading-none ring-1', toneClass].join(' ')}
        >
          {badge.compactText}
        </span>
        <span className="sr-only">{itemLabel}, {badge.accessibleLabel}</span>
      </>
    )
  }

  return (
    <span
      title={badge.accessibleLabel}
      className={['inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[10px] font-black leading-none ring-1 desktop:font-semibold', toneClass].join(' ')}
    >
      {badge.text}
    </span>
  )
}

const NavItemBadges = ({ badges, collapsed, itemLabel }: { badges: ShellNavBadge[]; collapsed: boolean; itemLabel: string }) => (
  <span
    className={collapsed ? 'absolute -right-1.5 -top-1.5 flex flex-col gap-0.5' : 'flex shrink-0 items-center gap-1'}
    aria-label={`${itemLabel}: ${badges.map((badge) => badge.accessibleLabel).join(', ')}`}
  >
    {badges.map((badge) => {
      const toneClass = badge.tone === 'urgent'
        ? 'bg-[#de6c4d] text-white ring-[#bd4c33]/30'
        : 'bg-[#176b5a] text-white ring-[#0d4f43]/25'
      return (
        <span
          key={`${badge.tone}:${badge.accessibleLabel}`}
          aria-hidden="true"
          title={badge.accessibleLabel}
          className={[
            'inline-flex items-center justify-center rounded-full font-black leading-none ring-1',
            collapsed ? 'h-4 min-w-4 px-1 text-[8px]' : 'h-5 min-w-5 px-1.5 text-[10px]',
            toneClass,
          ].join(' ')}
        >
          {badge.compactText}
        </span>
      )
    })}
  </span>
)

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
    {item.badges?.length
      ? <NavItemBadges badges={item.badges} collapsed={collapsed} itemLabel={item.label} />
      : item.badge
        ? <NavItemBadge badge={item.badge} collapsed={collapsed} itemLabel={item.label} />
        : null}
  </>
)

const SidebarLink = ({ item, collapsed = false, nested = false, onClick }: { item: ShellNavItem; collapsed?: boolean; nested?: boolean; onClick?: () => void }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const active = isItemActive(item, location.pathname, location.search)
  const className = [
    'group relative flex w-full items-center font-bold outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45',
    collapsed ? 'mx-auto h-11 w-11 justify-center rounded-2xl p-0 desktop:rounded-xl' : nested ? 'min-h-10 gap-2 rounded-xl py-1 pl-7 pr-2.5' : [active ? 'min-h-14' : 'min-h-12', 'gap-2.5 rounded-2xl py-1.5 pl-4 pr-2.5 desktop:rounded-xl'].join(' '),
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
  const content = <NavItemContent item={item} active={active} compact={nested} collapsed={collapsed} />

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

const NestedSidebarItem = ({ item, onItemClick }: { item: ShellNavItem; onItemClick?: () => void }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const childActive = Boolean(item.children?.some((child) => isItemActive(child, location.pathname, location.search)))
  const [open, setOpen] = useState(childActive)

  useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive])

  if (!item.children?.length) return <SidebarLink item={item} onClick={onItemClick} />

  return (
    <div className={['overflow-hidden rounded-xl transition', childActive ? 'bg-white/80 ring-1 ring-[#dbe4de]' : 'bg-transparent'].join(' ')}>
      <div className="group flex min-h-11 w-full items-center rounded-xl text-[#4e5f58] transition hover:bg-white/72 hover:text-[#123d34]">
        <Link
          to={item.to}
          onClick={(event) => guardNavigationClick(event, item.to, () => { item.onClick?.(); onItemClick?.() }, () => navigate(item.to))}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-1.5 font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45"
        >
          <NavItemContent item={item} active={childActive} compact />
        </Link>
        <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`} className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-[#e3f0eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45">
          <ChevronDown className={['h-3.5 w-3.5 transition-transform duration-200', open ? '' : '-rotate-90'].join(' ')} aria-hidden="true" />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }} className="space-y-1 overflow-hidden px-1 pb-1.5">
            {item.children.map((child) => <SidebarLink key={child.key} item={child} nested onClick={onItemClick} />)}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

const isSectionActive = (section: ShellNavSection, pathname: string, search: string) => {
  const sectionTargetPath = section.to?.split('?')[0] || ''
  const sectionDestinationActive = Boolean(sectionTargetPath) && (
    pathname === sectionTargetPath ||
    (sectionTargetPath === '/groups' && pathname.startsWith('/groups/'))
  )

  return sectionDestinationActive || section.items.some((item) => isItemActive(item, pathname, search))
}

const NavigationSection = ({
  section,
  collapsed = false,
  open: controlledOpen,
  onToggle,
  onItemClick,
}: {
  section: ShellNavSection
  collapsed?: boolean
  open?: boolean
  onToggle?: () => void
  onItemClick?: () => void
}) => {
  const [localOpen, setLocalOpen] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()
  const open = controlledOpen ?? localOpen
  const sectionTargetPath = section.to?.split('?')[0] || ''
  const sectionDestinationActive = Boolean(sectionTargetPath) && (
    location.pathname === sectionTargetPath ||
    (sectionTargetPath === '/groups' && location.pathname.startsWith('/groups/'))
  )
  const sectionActive = isSectionActive(section, location.pathname, location.search)
  const collapsible = section.collapsible ?? section.items.length > 0
  const sectionHeaderClassName = [
    'group flex w-full items-center gap-2 rounded-[1.1rem] px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45 desktop:rounded-lg desktop:px-2.5',
    open ? 'text-[#53665f] hover:bg-white/62 desktop:hover:bg-[#f1eee7]' : 'bg-white text-[#18332d] shadow-[0_10px_22px_rgba(30,54,48,0.06)] desktop:bg-[#f1eee7] desktop:shadow-none',
  ].join(' ')
  const sectionIcon = section.icon ? (
    <span className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', sectionActive ? 'bg-[#173f36] text-white' : 'bg-[#e7eee9] text-[#53665f]'].join(' ')}>{section.icon}</span>
  ) : null
  const sectionText = (
    <span className="min-w-0 flex-1">
      <span className={['block truncate text-xs font-black leading-4 desktop:font-semibold', sectionActive ? 'text-[#173f36]' : 'text-[#314840]'].join(' ')}>{section.label}</span>
      {(section.showDescription || !open) && section.description ? <span className="mt-0.5 block truncate text-[11px] font-semibold leading-4 text-[#87938e]">{section.description}</span> : null}
    </span>
  )
  const sectionChevron = collapsible ? (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#6b7a74] transition group-hover:bg-[#edf5f1] group-hover:text-[#123d34]">
      <ChevronDown
        className={['h-3.5 w-3.5 transition-transform duration-200', open ? '' : '-rotate-90'].join(' ')}
        aria-hidden="true"
      />
    </span>
  ) : null

  const toggleSection = () => {
    if (onToggle) {
      onToggle()
      return
    }

    setLocalOpen((current) => !current)
  }

  const handleSectionHeaderClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!section.to) {
      toggleSection()
      return
    }

    guardNavigationClick(event, section.to, () => {
      toggleSection()
      onItemClick?.()
      navigate(section.to || '/')
    })
  }

  useEffect(() => {
    if (sectionActive && !section.toggleOnHeaderClick && controlledOpen === undefined) setLocalOpen(true)
  }, [controlledOpen, sectionActive, section.toggleOnHeaderClick])

  if (!section.items.length && !section.to && !collapsible) return null

  if (collapsed) {
    return (
      <section className={[
        'flex flex-col items-center gap-1.5 rounded-[1.25rem] p-1 transition desktop:gap-2 desktop:rounded-none desktop:bg-transparent desktop:p-0 desktop:ring-0',
        sectionActive ? 'bg-[#eef5f1] ring-1 ring-[#c9ddd4]' : 'bg-transparent',
        section.alignToBottom ? 'mt-auto' : '',
      ].join(' ')}>
        {section.to && section.icon ? (
          <SidebarLink
            item={{
              key: `${section.key}:home`,
              label: section.label,
              description: section.description,
              to: section.to,
              icon: section.icon,
              matchPathOnly: true,
            }}
            collapsed
            onClick={onItemClick}
          />
        ) : null}
        {section.items.map((item) => <SidebarLink key={item.key} item={{ ...item, children: undefined }} collapsed onClick={onItemClick} />)}
      </section>
    )
  }

  return (
    <section className={[
      'rounded-[1.35rem] p-1.5 transition desktop:rounded-none desktop:bg-transparent desktop:p-0 desktop:ring-0',
      sectionActive ? 'bg-[#f4f8f5] ring-1 ring-[#cddfd6]' : 'bg-[#f7f3ec] ring-1 ring-[#ded6cb]/70',
      section.alignToBottom ? 'mt-auto' : '',
    ].join(' ')}>
      {section.toggleOnHeaderClick ? (
        <button type="button" onClick={handleSectionHeaderClick} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${section.label}`} className={sectionHeaderClassName}>
          {sectionIcon}
          {sectionText}
          {sectionChevron}
        </button>
      ) : (
        <div className={sectionHeaderClassName}>
          {section.to ? (
            <Link
              to={section.to}
              onClick={(event) => guardNavigationClick(event, section.to || '/', onItemClick, () => navigate(section.to || '/'))}
              aria-current={sectionDestinationActive ? 'page' : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45"
            >
              {sectionIcon}
              {sectionText}
            </Link>
          ) : sectionText}
          {collapsible ? (
            <button type="button" onClick={toggleSection} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${section.label}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45">
              {sectionChevron}
            </button>
          ) : null}
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && section.items.length ? (
          <motion.div
            key="items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="mt-1 space-y-1 overflow-hidden px-0.5 pb-0.5"
          >
            {section.items.map((item) => <NestedSidebarItem key={item.key} item={item} onItemClick={onItemClick} />)}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

const NavigationSectionGroup = ({
  sections,
  collapsed = false,
  onItemClick,
}: {
  sections: ShellNavSection[]
  collapsed?: boolean
  onItemClick?: () => void
}) => {
  const location = useLocation()
  const activeSectionKey = sections.find((section) => isSectionActive(section, location.pathname, location.search))?.key
  const firstAccordionSectionKey = sections.find((section) => section.toggleOnHeaderClick)?.key
  const [openSectionKey, setOpenSectionKey] = useState<string | null>(() => activeSectionKey || firstAccordionSectionKey || null)

  useEffect(() => {
    if (activeSectionKey) setOpenSectionKey(activeSectionKey)
  }, [activeSectionKey])

  return sections.map((section) => (
    <NavigationSection
      key={section.key}
      section={section}
      collapsed={collapsed}
      open={section.toggleOnHeaderClick ? openSectionKey === section.key : undefined}
      onToggle={section.toggleOnHeaderClick
        ? () => setOpenSectionKey((current) => current === section.key ? null : section.key)
        : undefined}
      onItemClick={onItemClick}
    />
  ))
}

export const HeaderNavigation = ({ items }: { items: ShellNavItem[] }) => {
  const t = useUiText()
  const navigate = useNavigate()

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3" aria-label={t('appNavigation')}>
      <Link to="/" onClick={(event) => guardNavigationClick(event, '/', undefined, () => navigate('/'))} className="flex shrink-0 items-center gap-2.5 rounded-xl text-[#18332d] desktop:hidden" aria-label={t('home')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3f0eb] ring-1 ring-[#176b5a]/10 sm:h-10 sm:w-10 sm:rounded-2xl">
          <img src={logo} alt={t('appName')} className="h-full w-full object-contain p-1 drop-shadow-sm" />
        </span>
        <span className="hidden text-lg font-bold tracking-[-0.04em] desktop:block">Alife</span>
      </Link>
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
  platformSections: ShellNavSection[]
  workspaceSections: ShellNavSection[]
  workspaceVisible: boolean
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
        <img src={logo} alt={t('appName')} className="h-full w-full object-contain p-1 drop-shadow-sm" />
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

export const DesktopNavigation = ({
  collapsed,
  onToggle,
  ...props
}: WorkspaceNavigationProps & { collapsed: boolean; onToggle: () => void }) => {
  const t = useUiText()
  const workspaceSections = props.workspaceVisible ? props.workspaceSections : []

  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={['fixed bottom-0 left-0 top-0 z-20 hidden transition-[width] duration-300 desktop:block', collapsed ? 'w-20' : 'w-72'].join(' ')}
    >
      <aside className="flex h-full flex-col overflow-hidden border-r border-[#ddd4c8] bg-[#f8f5ee]/97 shadow-[10px_0_32px_rgba(30,54,48,0.06)] backdrop-blur-xl" aria-label={t('primaryNavigation')}>
        <div className={['border-b border-[#e2d8cc]', collapsed ? 'p-3' : 'p-4'].join(' ')}>
          <SidebarBrand collapsed={collapsed} />
        </div>

        <nav className={['flex min-h-0 flex-1 flex-col overflow-y-auto', collapsed ? 'gap-3 px-3 py-4' : 'gap-5 px-3 py-4'].join(' ')}>
          {workspaceSections.length ? (
            <div className={collapsed ? 'space-y-2 border-b border-[#e5ddd2] pb-3' : 'space-y-3'}>
              {workspaceSections.map((section) => <NavigationSection key={section.key} section={section} collapsed={collapsed} />)}
            </div>
          ) : null}
          <div className={collapsed ? 'flex flex-1 flex-col gap-2' : 'flex flex-1 flex-col gap-3'}>
            <NavigationSectionGroup sections={props.platformSections} collapsed={collapsed} />
          </div>
        </nav>

        <div className={['border-t border-[#e2d8cc]', collapsed ? 'p-3' : 'p-3'].join(' ')}>
          <button type="button" className={['flex h-11 items-center justify-center rounded-xl text-xs font-semibold text-[#62736c] transition hover:bg-white hover:text-[#18332d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45', collapsed ? 'w-full' : 'w-full gap-2'].join(' ')} onClick={onToggle} aria-label={collapsed ? props.copy.expand : props.copy.collapse}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>{props.copy.collapse}</span></>}
          </button>
        </div>
      </aside>
    </motion.aside>
  )
}

export const BottomNavigation = ({
  sections,
  copy,
}: {
  sections: ShellNavSection[]
  copy: NavigationCopy
}) => {
  const t = useUiText()
  const location = useLocation()
  const navigate = useNavigate()
  const [openSectionKey, setOpenSectionKey] = useState<string | null>(null)
  const openSection = sections.find((section) => section.key === openSectionKey)

  useEffect(() => {
    setOpenSectionKey(null)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!openSectionKey) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenSectionKey(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [openSectionKey])

  const handleSectionClick = (event: MouseEvent<HTMLButtonElement>, section: ShellNavSection) => {
    if (section.items.length > 0) {
      setOpenSectionKey((current) => current === section.key ? null : section.key)
      return
    }

    if (section.to) {
      guardNavigationClick(event, section.to, () => navigate(section.to || '/'))
    }
  }

  return (
    <>
      <motion.nav
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
        className="alife-panel fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-[calc(0.75rem+env(safe-area-inset-left))] right-[calc(0.75rem+env(safe-area-inset-right))] z-30 rounded-[1.6rem] px-2 py-1.5 desktop:hidden"
        aria-label={t('primaryNavigation')}
      >
        <div className="mx-auto flex max-w-xl items-stretch gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((section) => {
            const active = isSectionActive(section, location.pathname, location.search)
            const sheetOpen = openSectionKey === section.key
            const submenuId = `mobile-submenu-${section.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`

            return (
              <motion.button
                key={section.key}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={(event) => handleSectionClick(event, section)}
                aria-current={active ? 'page' : undefined}
                aria-expanded={section.items.length > 0 ? sheetOpen : undefined}
                aria-controls={section.items.length > 0 ? submenuId : undefined}
                aria-haspopup={section.items.length > 0 ? 'dialog' : undefined}
                className={[
                  'group flex min-w-[4.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[10px] font-black leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/55',
                  active || sheetOpen
                    ? 'bg-[#173f36] text-white shadow-[0_8px_18px_rgba(23,63,54,0.18)]'
                    : 'text-[#60716a] hover:bg-[#e3f0eb] hover:text-[#0d4f43]',
                ].join(' ')}
              >
                <span className={['flex h-6 w-7 items-center justify-center transition', active || sheetOpen ? 'text-white' : 'text-[#53665f] group-hover:text-[#176b5a]'].join(' ')}>
                  {section.icon || <Menu className="h-5 w-5" aria-hidden="true" />}
                </span>
                <span className="max-w-full truncate">{section.label}</span>
              </motion.button>
            )
          })}
        </div>
      </motion.nav>

      <AnimatePresence>
        {openSection && openSection.items.length > 0 ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-[#102f28]/48 backdrop-blur-[2px] desktop:hidden"
              aria-label={copy.closeMenu}
              onClick={() => setOpenSectionKey(null)}
            />
            <motion.section
              id={`mobile-submenu-${openSection.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
              role="dialog"
              aria-modal="true"
              aria-label={openSection.label}
              initial={{ y: '100%', opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.8 }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[min(76dvh,42rem)] overflow-hidden rounded-t-[2rem] border-t border-[#ded6cb] bg-[#f8f5ee] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-24px_60px_rgba(16,47,40,0.24)] desktop:hidden"
            >
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-[#c8d2cd]" aria-hidden="true" />
              <div className="flex items-start gap-2">
                {openSection.to ? (
                  <Link
                    to={openSection.to}
                    onClick={(event) => guardNavigationClick(event, openSection.to || '/', () => setOpenSectionKey(null), () => navigate(openSection.to || '/'))}
                    className="group flex min-w-0 flex-1 items-center gap-3 rounded-[1.25rem] px-2 py-2.5 transition hover:bg-[#e7eee9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/55"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#173f36] text-white">{openSection.icon || <Menu className="h-5 w-5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-black text-[#18332d]">{openSection.label}</span>
                      {openSection.description ? <span className="mt-0.5 block line-clamp-2 text-xs font-semibold leading-5 text-[#718079]">{openSection.description}</span> : null}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#7a8983] transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#173f36] text-white">{openSection.icon || <Menu className="h-5 w-5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-black text-[#18332d]">{openSection.label}</span>
                      {openSection.description ? <span className="mt-0.5 block line-clamp-2 text-xs font-semibold leading-5 text-[#718079]">{openSection.description}</span> : null}
                    </span>
                  </div>
                )}
                <button type="button" className="alife-icon-button mt-2 shrink-0" onClick={() => setOpenSectionKey(null)} aria-label={copy.closeMenu}><CloseIcon /></button>
              </div>

              <div className="mt-2 max-h-[calc(min(76dvh,42rem)-6.5rem)] space-y-1 overflow-y-auto rounded-[1.5rem] bg-white/72 p-2 ring-1 ring-[#ded6cb]/75">
                {openSection.items.map((item) => <NestedSidebarItem key={item.key} item={item} onItemClick={() => setOpenSectionKey(null)} />)}
              </div>
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
