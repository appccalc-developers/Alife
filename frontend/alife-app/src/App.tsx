import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import logo from './assets/logo.png'
import { groupService } from './services/groupService'
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
import EventCreatorView from './views/EventCreatorView'
import GroupManageView from './views/GroupManageView'

type ShellNavItem = {
  label: string
  to: string
  icon: ReactElement
  matchSearch?: string
  pageId?: string
}

type ShellFabItem = {
  label: string
  icon: ReactElement
  onClick: () => void
}

const RouteLoading = () => <p className="rounded bg-white p-3">Loading identity...</p>

const PageIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 3h9l4 4v14H6Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h6" />
  </svg>
)

const GroupIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 20V8l8-4 8 4v12" />
    <path d="M9 20v-6h6v6" />
    <path d="M8 10h.01M16 10h.01" />
  </svg>
)

const SubgroupsIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="7" height="6" rx="1" />
    <rect x="14" y="4" width="7" height="6" rx="1" />
    <rect x="8.5" y="14" width="7" height="6" rx="1" />
    <path d="M10 7h4M12 10v4" />
  </svg>
)

const MembersIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const OnboardingIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </svg>
)

const EventsIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
  </svg>
)

const EditIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

const SettingsIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
    <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.65V21a2 2 0 1 1-4 0v-.09A1.8 1.8 0 0 0 8.75 19.3a1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.8 1.8 0 0 0 .36-1.98 1.8 1.8 0 0 0-1.65-1.1H2.5a2 2 0 1 1 0-4h.09A1.8 1.8 0 0 0 4.2 8.7a1.8 1.8 0 0 0-.36-1.98l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.8 1.8 0 0 0 1.98.36h.1A1.8 1.8 0 0 0 9.85 2.6V2.5a2 2 0 1 1 4 0v.09a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.36 1.98v.1a1.8 1.8 0 0 0 1.65 1.1h.09a2 2 0 1 1 0 4h-.09A1.8 1.8 0 0 0 19.4 15Z" />
  </svg>
)

const SaveIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </svg>
)

const BackIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
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
  <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" aria-label="App navigation">
    <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-lg mr-1 text-slate-950" aria-label="Home">
      <span className="flex items-center justify-center rounded-xl bg-emerald-50 p-1.5">
        <img src={logo} alt="Aboundant Life Church" className="h-8 w-auto drop-shadow-sm" />
      </span>
      <span className="text-base font-bold tracking-tight">Aboundant Life Church</span>
    </Link>
    {items.map((item) => (
      <ShellNavLink key={item.to} item={item} />
    ))}
  </nav>
)

const SideNav = ({ items }: { items: ShellNavItem[] }) => (
  <aside className="fixed bottom-0 left-0 top-16 z-20 hidden w-72 bg-white/95 px-4 py-5 shadow-sm backdrop-blur desktop:block">
    <nav className="space-y-1" aria-label="Primary">
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

const FloatingActionButtons = ({ items }: { items: ShellFabItem[] }) => (
  <div className="fixed bottom-24 right-5 z-40 flex flex-col-reverse items-end gap-3 desktop:bottom-6">
    {items.map((item) => (
      <button
        key={item.label}
        type="button"
        className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xl shadow-emerald-900/30 transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200"
        aria-label={item.label}
        title={item.label}
        onClick={item.onClick}
      >
        {item.icon}
      </button>
    ))}
  </div>
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
  const navigate = useNavigate()
  const [currentGroupPages, setCurrentGroupPages] = useState<ShellNavItem[]>([])
  const groupScreenMatch = location.pathname.match(/^\/groups\/([^/]+)$/)
  const groupManageMatch = location.pathname.match(/^\/groups\/([^/]+)\/manage$/)
  const groupCreatePageMatch = location.pathname.match(/^\/groups\/([^/]+)\/pages\/new$/)
  const pageEditMatch = location.pathname.match(/^\/pages\/([^/]+)\/edit$/)
  const searchParams = new URLSearchParams(location.search)
  const isGroupScreen = Boolean(groupScreenMatch)
  const isManagementScreen = Boolean(groupManageMatch)
  const isPageEditorScreen = Boolean(groupCreatePageMatch || pageEditMatch)
  const contextualGroupId =
    groupScreenMatch?.[1] ||
    groupManageMatch?.[1] ||
    groupCreatePageMatch?.[1] ||
    (pageEditMatch ? searchParams.get('groupId') || CurrentGroup?.id || '' : '')
  const currentGroupMembership = contextualGroupId
    ? auth.memberships.find((item) => item.groupId === contextualGroupId)
    : null
  const canManageCurrentGroup =
    currentGroupMembership?.status === 'Approved' &&
    (currentGroupMembership.role === 'Leader' || currentGroupMembership.role === 'CoLeader')
  const selectedPageId = searchParams.get('page') || currentGroupPages[0]?.pageId || ''
  const managementNavItems: ShellNavItem[] = contextualGroupId
    ? [
        { label: 'Group', to: `/groups/${contextualGroupId}/manage?section=group`, matchSearch: '?section=group', icon: <GroupIcon /> },
        { label: 'Subgroups', to: `/groups/${contextualGroupId}/manage?section=subgroups`, matchSearch: '?section=subgroups', icon: <SubgroupsIcon /> },
        { label: 'Members', to: `/groups/${contextualGroupId}/manage?section=members`, matchSearch: '?section=members', icon: <MembersIcon /> },
        { label: 'Pages', to: `/groups/${contextualGroupId}/manage?section=pages`, matchSearch: '?section=pages', icon: <PageIcon /> },
        { label: 'Events', to: `/groups/${contextualGroupId}/manage?section=events`, matchSearch: '?section=events', icon: <EventsIcon /> },
      ]
    : []
  const shellNavItems = isManagementScreen ? managementNavItems : isGroupScreen || isPageEditorScreen ? currentGroupPages : []
  const fabItems: ShellFabItem[] = isGroupScreen && canManageCurrentGroup
    ? [
        ...(selectedPageId
          ? [
              {
                label: 'Edit current page',
                icon: <EditIcon />,
                onClick: () => navigate(`/pages/${selectedPageId}/edit?groupId=${contextualGroupId}`),
              },
            ]
          : []),
        {
          label: 'Manage group',
          icon: <SettingsIcon />,
          onClick: () => navigate(`/groups/${contextualGroupId}/manage?section=group`),
        },
      ]
    : isPageEditorScreen
      ? [
          {
            label: 'Save page',
            icon: <SaveIcon />,
            onClick: () => window.dispatchEvent(new Event('alife-page-editor-save')),
          },
          {
            label: 'Exit editor',
            icon: <BackIcon />,
            onClick: () => window.dispatchEvent(new Event('alife-page-editor-exit')),
          },
        ]
      : isManagementScreen
        ? [
            {
              label: 'Back to group',
              icon: <BackIcon />,
              onClick: () => navigate(`/groups/${contextualGroupId}`),
            },
          ]
        : []

  const toggleLanguageLabel = auth.language.toUpperCase()
  const appNavItems: ShellNavItem[] = [
    ...(!auth.loading && auth.isGuest ? [{ label: 'Onboarding', to: '/onboarding', icon: <OnboardingIcon /> }] : []),
  ]

  useEffect(() => {
    if (!contextualGroupId || isManagementScreen) {
      setCurrentGroupPages([])
      return
    }

    let cancelled = false

    groupService
      .getGroupPages(contextualGroupId, auth.language)
      .then((pages) => {
        if (cancelled) {
          return
        }

        setCurrentGroupPages(
          pages.map((page) => ({
            label: page.title,
            to: `/groups/${contextualGroupId}?page=${encodeURIComponent(page.id)}`,
            matchSearch: `?page=${encodeURIComponent(page.id)}`,
            pageId: page.id,
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
  }, [contextualGroupId, auth.language, isManagementScreen])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6 desktop:px-8">
          <HeaderNav items={appNavItems} />

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
          </div>
        </div>
      </header>
      <div className="min-h-screen desktop:pl-72">
        <SideNav items={shellNavItems} />

        <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 desktop:px-8 desktop:pb-10">
          {auth.loading ? <RouteLoading /> : null}
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/groups/:groupId" element={<GroupDetailView />} />
            <Route path="/groups/:groupId/manage" element={<GroupManageView />} />
            <Route path="/pages/:slug" element={<PageView />} />
            <Route path="/sermons" element={<SermonsView />} />
            <Route path="/events/new" element={<EventCreatorView />} />
            <Route path="/events/:eventId/edit" element={<EventCreatorView />} />
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

      <BottomNav items={shellNavItems} />
      <FloatingActionButtons items={fabItems} />
    </div>
  )
}

export default App
