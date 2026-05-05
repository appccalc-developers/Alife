import type { ReactElement } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import logo from './assets/logo.png'
import { useApiUpdates } from './hooks/useApiUpdates'
import { groupService } from './services/groupService'
import { pwaSyncService, syncKeys } from './services/pwaSyncService'
import { useAuthStore } from './stores/auth'
import { useCurrentGroupStore } from './stores/currentGroup'
import AdminView from './views/AdminView'
import GroupDetailView from './views/GroupDetailView'
import HomeView from './views/HomeView'
import OnboardingView from './views/OnboardingView'
import PageEditorView from './views/PageEditorView'
import PagePreviewDraftView from './views/PagePreviewDraftView'
import PageView from './views/PageView'
import SermonsView from './views/SermonsView'

type ShellNavItem = {
  label: string
  to: string
  icon: ReactElement
  matchSearch?: string
}

const RouteLoading = () => <p className="rounded bg-white p-3">Loading identity...</p>

const HomeIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m3 10 9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M9 20v-6h6v6" />
  </svg>
)

const SermonsIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 5h14" />
    <path d="M5 12h14" />
    <path d="M5 19h9" />
  </svg>
)

const PageIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 3h9l4 4v14H6Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h6" />
  </svg>
)

const OnboardingIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </svg>
)

const AdminIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

const MenuIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </svg>
)

const PlusIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
)

const CloseIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)

const BellIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10 21h4" />
  </svg>
)

const ShellNavLink = ({ item, mobile = false }: { item: ShellNavItem; mobile?: boolean }) => (
  <NavLink
    to={item.to}
    end={item.to === '/'}
    className={({ isActive }) =>
      [
        'flex items-center rounded-lg font-medium transition',
        mobile ? 'min-w-0 flex-1 flex-col justify-center gap-1 px-1 py-2 text-xs' : 'gap-3 px-3 py-2.5 text-sm',
        isActive ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
      ].join(' ')
    }
  >
    <span className={mobile ? 'flex h-6 items-center justify-center' : 'flex h-5 w-5 items-center justify-center'}>
      {item.icon}
    </span>
    <span className={mobile ? 'max-w-full truncate leading-tight' : ''}>{item.label}</span>
  </NavLink>
)

const ShellSearchNavLink = ({ item, mobile = false }: { item: ShellNavItem; mobile?: boolean }) => {
  const location = useLocation()
  const target = new URL(item.to, window.location.origin)
  const isActive = location.pathname === target.pathname && (!item.matchSearch || location.search === item.matchSearch)

  return (
    <Link
      to={item.to}
      className={[
        'flex items-center rounded-lg font-medium transition',
        mobile ? 'min-w-0 flex-1 flex-col justify-center gap-1 px-1 py-2 text-xs' : 'gap-3 px-3 py-2.5 text-sm',
        isActive ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
      ].join(' ')}
    >
      <span className={mobile ? 'flex h-6 items-center justify-center' : 'flex h-5 w-5 items-center justify-center'}>
        {item.icon}
      </span>
      <span className={mobile ? 'max-w-full truncate leading-tight' : ''}>{item.label}</span>
    </Link>
  )
}

const HeaderNav = ({ items }: { items: ShellNavItem[] }) => (
  <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="App navigation">
    {items.map((item) => (
      <ShellNavLink key={item.to} item={item} />
    ))}
  </nav>
)

const SideNav = ({ items }: { items: ShellNavItem[] }) => (
  <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-slate-200 bg-white/95 px-4 py-5 shadow-sm backdrop-blur desktop:block">
    <Link to="/" className="flex items-center gap-3 rounded-lg px-2 py-2 text-slate-950">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
        <img src={logo} alt="Alife" className="h-8 w-auto" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-tight">Alife</span>
        <span className="block text-sm text-slate-500">Community hub</span>
      </span>
    </Link>

    <nav className="mt-8 space-y-1" aria-label="Primary">
      {items.map((item) => (
        <ShellSearchNavLink key={item.to} item={item} />
      ))}
    </nav>
  </aside>
)

const BottomNav = ({ items }: { items: ShellNavItem[] }) => (
  <nav
    className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] pt-1.5 shadow-[0_-12px_30px_rgba(15,23,42,0.10)] backdrop-blur desktop:hidden"
    aria-label="Primary"
  >
    <div className="mx-auto flex max-w-lg items-stretch gap-1">
      {items.map((item) => (
        <ShellSearchNavLink key={item.to} item={item} mobile />
      ))}
    </div>
  </nav>
)

const NavigationDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <div className={open ? 'fixed inset-0 z-50' : 'pointer-events-none fixed inset-0 z-50'} aria-hidden={!open}>
    <button
      type="button"
      className={['absolute inset-0 bg-slate-950/35 transition-opacity', open ? 'opacity-100' : 'opacity-0'].join(' ')}
      aria-label="Close navigation drawer"
      onClick={onClose}
    />
    <aside
      className={[
        'absolute bottom-0 right-0 top-0 w-full max-w-sm border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200',
        open ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
      aria-label="Navigation drawer"
    >
      <button
        type="button"
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-950"
        aria-label="Close navigation drawer"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
    </aside>
  </div>
)

const FloatingActionButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    className="fixed bottom-24 right-5 z-40 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xl shadow-emerald-900/30 transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200 desktop:hidden"
    aria-label={label}
    title={label}
    onClick={onClick}
  >
    <PlusIcon />
  </button>
)

const AdminRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <RouteLoading />
  }

  if (!auth.me?.isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}

const OnboardingRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <RouteLoading />
  }

  if (!auth.loading && !auth.isGuest) {
    return <Navigate to="/" replace />
  }

  return children
}

const App = () => {
  const auth = useAuthStore()
  const { CurrentGroup } = useCurrentGroupStore()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentGroupPages, setCurrentGroupPages] = useState<ShellNavItem[]>([])
  const [syncRefreshToken, setSyncRefreshToken] = useState(0)
  const [notificationPermission, setNotificationPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'denied',
  )
  const isGroupScreen = /^\/groups\/[^/]+$/.test(location.pathname)

  const openContextualDrawer = () => {
    if (isGroupScreen) {
      window.dispatchEvent(new Event('open-group-tools'))
      return
    }

    setDrawerOpen(true)
  }

  const toggleLanguageLabel = auth.language.toUpperCase()
  const appNavItems: ShellNavItem[] = [
    { label: 'Home', to: '/', icon: <HomeIcon /> },
    { label: 'Sermons', to: '/sermons', icon: <SermonsIcon /> },
    ...(!auth.loading && auth.isGuest ? [{ label: 'Onboarding', to: '/onboarding', icon: <OnboardingIcon /> }] : []),
    ...(!auth.loading && auth.me?.isAdmin ? [{ label: 'Admin', to: '/admin', icon: <AdminIcon /> }] : []),
  ]

  const handleApiUpdate = useCallback(
    (message: { versionKeys?: string[]; entityType: string }) => {
      const keys = message.versionKeys ?? []
      const currentGroupId = CurrentGroup?.id

      if (
        message.entityType === 'member' ||
        keys.some((key) => key.startsWith('member:') || key.includes(':memberships:'))
      ) {
        auth.fetchMe().catch(() => undefined)
      }

      if (
        currentGroupId &&
        keys.some(
          (key) =>
            key === syncKeys.groupPages(currentGroupId, auth.language) ||
            key === syncKeys.groupTree(currentGroupId) ||
            key === syncKeys.groupMemberships(currentGroupId),
        )
      ) {
        setSyncRefreshToken((value) => value + 1)
      }
    },
    [CurrentGroup?.id, auth, auth.language],
  )

  useApiUpdates(handleApiUpdate)

  useEffect(() => {
    pwaSyncService.subscribeToPushIfAllowed().catch(() => undefined)
  }, [auth.me?.id])

  const enablePushSync = async () => {
    const granted = await pwaSyncService.requestPushSubscription()
    setNotificationPermission(granted ? 'granted' : 'denied')
  }

  useEffect(() => {
    const keys = [syncKeys.globalPages(auth.language)]
    if (auth.me?.id) {
      keys.push(syncKeys.member(auth.me.id))
    }

    if (CurrentGroup?.id) {
      keys.push(
        syncKeys.group(CurrentGroup.id),
        syncKeys.groupTree(CurrentGroup.id),
        syncKeys.groupMemberships(CurrentGroup.id),
        syncKeys.groupPages(CurrentGroup.id, auth.language),
      )
    }

    pwaSyncService.postVersionCheck(keys)
  }, [CurrentGroup?.id, auth.language, auth.me?.id])

  useEffect(() => {
    if (!CurrentGroup?.id) {
      setCurrentGroupPages([])
      return
    }

    let cancelled = false

    groupService
      .getGroupPages(CurrentGroup.id, auth.language)
      .then((pages) => {
        if (cancelled) {
          return
        }

        setCurrentGroupPages(
          pages.map((page) => ({
            label: page.title,
            to: `/groups/${CurrentGroup.id}?page=${encodeURIComponent(page.id)}`,
            matchSearch: `?page=${encodeURIComponent(page.id)}`,
            icon: <PageIcon />,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentGroupPages([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [CurrentGroup?.id, auth.language, syncRefreshToken])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <SideNav items={currentGroupPages} />

      <div className="min-h-screen desktop:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6 desktop:px-8">
            <Link to="/" className="flex items-center gap-2 rounded-lg text-slate-950 desktop:hidden" aria-label="Home">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                <img src={logo} alt="Alife" className="h-7 w-auto" />
              </span>
              <span className="text-base font-semibold">Alife</span>
            </Link>

            <HeaderNav items={appNavItems} />

            <div className="ml-auto flex items-center gap-2">
              {!auth.loading && auth.me ? (
                <span className="text-sm text-slate-700">{auth.me.displayName || 'Guest'}</span>
              ) : null}
              {auth.me && notificationPermission === 'default' && 'PushManager' in window ? (
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  aria-label="Enable update notifications"
                  title="Enable update notifications"
                  onClick={enablePushSync}
                >
                  <BellIcon />
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-10 min-w-12 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => auth.setLanguage(auth.language === 'en' ? 'zh' : 'en')}
              >
                {toggleLanguageLabel}
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 desktop:hidden"
                aria-label={isGroupScreen ? 'Open group tools' : 'Open navigation drawer'}
                title={isGroupScreen ? 'Group tools' : 'Open navigation drawer'}
                onClick={openContextualDrawer}
              >
                <MenuIcon />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 desktop:px-8 desktop:pb-10">
          {auth.loading ? <RouteLoading /> : null}
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/groups/:groupId" element={<GroupDetailView />} />
            <Route path="/pages/:slug" element={<PageView />} />
            <Route path="/sermons" element={<SermonsView />} />
            <Route path="/groups/:groupId/pages/new" element={<PageEditorView />} />
            <Route path="/pages/:pageId/edit" element={<PageEditorView />} />
            <Route path="/pages/preview-draft" element={<PagePreviewDraftView />} />
            <Route
              path="/onboarding"
              element={
                <OnboardingRoute>
                  <OnboardingView />
                </OnboardingRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminView />
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <BottomNav items={currentGroupPages} />
      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <FloatingActionButton label={isGroupScreen ? 'Open group tools' : 'Open navigation drawer'} onClick={openContextualDrawer} />
    </div>
  )
}

export default App
