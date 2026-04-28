import type { ReactElement } from 'react'
import { useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useParams } from 'react-router-dom'
import logo from './assets/logo.png'
import { useAuthStore } from './stores/auth'
import AdminView from './views/AdminView'
import GroupDetailView from './views/GroupDetailView'
import GroupManageView from './views/GroupManageView'
import HomeView from './views/HomeView'
import OnboardingView from './views/OnboardingView'
import PageEditorView from './views/PageEditorView'
import PageView from './views/PageView'
import SermonsView from './views/SermonsView'

type ShellNavItem = {
  label: string
  to: string
  icon: ReactElement
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

const GroupIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3.3 2.7-6 6-6" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M14 15c2.8.4 5 2.8 5 5" />
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

const SideNav = ({ items }: { items: ShellNavItem[] }) => (
  <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-slate-200 bg-white/95 px-4 py-5 shadow-sm backdrop-blur lg:block">
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
        <ShellNavLink key={item.to} item={item} />
      ))}
    </nav>
  </aside>
)

const BottomNav = ({ items }: { items: ShellNavItem[] }) => (
  <nav
    className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] pt-1.5 shadow-[0_-12px_30px_rgba(15,23,42,0.10)] backdrop-blur lg:hidden"
    aria-label="Primary"
  >
    <div className="mx-auto flex max-w-lg items-stretch gap-1">
      {items.map((item) => (
        <ShellNavLink key={item.to} item={item} mobile />
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

const FloatingActionButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    className="fixed bottom-24 right-5 z-40 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xl shadow-emerald-900/30 transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200 lg:bottom-8 lg:right-8"
    aria-label="Open navigation drawer"
    title="Open navigation drawer"
    onClick={onClick}
  >
    <PlusIcon />
  </button>
)

const LeaderRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()
  const { groupId } = useParams<{ groupId: string }>()

  if (!auth.initialized) {
    return <RouteLoading />
  }

  if (!groupId || !auth.hasLeaderAccess(groupId)) {
    return <Navigate to={groupId ? `/groups/${groupId}` : '/'} replace />
  }

  return children
}

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
  const [drawerOpen, setDrawerOpen] = useState(false)

  const toggleLanguageLabel = auth.language.toUpperCase()
  const primaryMembershipGroupId = auth.memberships[0]?.groupId || ''
  const navItems: ShellNavItem[] = [
    { label: 'Home', to: '/', icon: <HomeIcon /> },
    { label: 'Sermons', to: '/sermons', icon: <SermonsIcon /> },
    ...(primaryMembershipGroupId
      ? [{ label: 'My Group', to: `/groups/${primaryMembershipGroupId}`, icon: <GroupIcon /> }]
      : []),
    ...(!auth.loading && auth.isGuest ? [{ label: 'Onboarding', to: '/onboarding', icon: <OnboardingIcon /> }] : []),
    ...(!auth.loading && auth.me?.isAdmin ? [{ label: 'Admin', to: '/admin', icon: <AdminIcon /> }] : []),
  ]

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <SideNav items={navItems} />

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Link to="/" className="flex items-center gap-2 rounded-lg text-slate-950 lg:hidden" aria-label="Home">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                <img src={logo} alt="Alife" className="h-7 w-auto" />
              </span>
              <span className="text-base font-semibold">Alife</span>
            </Link>

            <div className="hidden lg:block">
              <p className="text-sm font-medium text-slate-500">Alife</p>
              <h1 className="text-xl font-semibold leading-tight text-slate-950">Community workspace</h1>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {!auth.loading && auth.me ? (
                <span className="text-sm text-slate-700">{auth.me.displayName || 'Guest'}</span>
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                aria-label="Open navigation drawer"
                onClick={() => setDrawerOpen(true)}
              >
                <MenuIcon />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          {auth.loading ? <RouteLoading /> : null}
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/groups/:groupId" element={<GroupDetailView />} />
            <Route
              path="/groups/:groupId/manage"
              element={
                <LeaderRoute>
                  <GroupManageView />
                </LeaderRoute>
              }
            />
            <Route path="/pages/:slug" element={<PageView />} />
            <Route path="/sermons" element={<SermonsView />} />
            <Route path="/groups/:groupId/pages/new" element={<PageEditorView />} />
            <Route path="/pages/:pageId/edit" element={<PageEditorView />} />
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

      <BottomNav items={navItems} />
      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <FloatingActionButton onClick={() => setDrawerOpen(true)} />
    </div>
  )
}

export default App
