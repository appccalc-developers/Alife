import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import logo from './assets/logo.png'
import AccessTypeBadge from './components/group/AccessTypeBadge'
import { groupService } from './services/groupService'
import { useAuthStore } from './stores/auth'
import { useCurrentGroupStore } from './stores/currentGroup'
import AdminView from './views/AdminView'
import GroupDetailView from './views/GroupDetailView'
import GroupJoinView from './views/GroupJoinView'
import HomeView from './views/HomeView'
import OnboardingView from './views/OnboardingView'
import PageEditorView from './views/PageEditorView'
import PagePreviewDraftView from './views/PagePreviewDraftView'
import PageView from './views/PageView'
import SermonsView from './views/SermonsView'
import EventCreatorView from './views/EventCreatorView'
import GroupManageView from './views/GroupManageView'
import { localizeText } from './utils/localizedText'
import type { GroupSummaryDto, PageSummaryDto } from './types'
import { translateUi, useUiText } from './i18n/uiText'

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
  tone: 'manage' | 'edit' | 'save' | 'exit'
  onClick: () => void
}

const RouteLoading = () => {
  const t = useUiText()
  return <p className="rounded bg-white p-3">{t('loadingIdentity')}</p>
}

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

const MenuIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
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

const ShellSearchNavLink = ({ item, mobile = false }: { item: ShellNavItem; mobile?: boolean }) => {
  const location = useLocation()
  const target = new URL(item.to, window.location.origin)
  const pageEditMatch = location.pathname.match(/^\/pages\/([^/]+)\/edit$/)
  const isActive =
    (location.pathname === target.pathname && (!item.matchSearch || location.search === item.matchSearch)) ||
    (Boolean(item.pageId) && pageEditMatch?.[1] === item.pageId)

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

const HeaderNav = ({ items }: { items: ShellNavItem[] }) => {
  const t = useUiText()

  return (
  <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" aria-label={t('appNavigation')}>
    <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-lg mr-1 text-slate-950" aria-label={t('home')}>
      <span className="flex items-center justify-center rounded-xl bg-emerald-50 p-1.5">
        <img src={logo} alt={t('appName')} className="h-8 w-auto drop-shadow-sm" />
      </span>
      <span className="text-base font-bold tracking-tight">{t('appName')}</span>
    </Link>
    {items.map((item) => (
      <ShellNavLink key={item.to} item={item} />
    ))}
  </nav>
  )
}

const SideNav = ({ items }: { items: ShellNavItem[] }) => {
  const t = useUiText()

  return (
  <aside className="fixed bottom-0 left-0 top-16 z-20 hidden w-72 bg-white/95 px-4 py-5 shadow-sm backdrop-blur desktop:block">
    <nav className="space-y-1" aria-label={t('primaryNavigation')}>
      {items.map((item) => (
        <ShellSearchNavLink key={item.to} item={item} />
      ))}
    </nav>
  </aside>
  )
}

const BottomNav = ({ items }: { items: ShellNavItem[] }) => {
  const t = useUiText()

  return (
  <nav
    className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] pt-1.5 shadow-[0_-12px_30px_rgba(15,23,42,0.10)] backdrop-blur desktop:hidden"
    aria-label={t('primaryNavigation')}
  >
    <div className="mx-auto flex max-w-lg items-stretch gap-1">
      {items.map((item) => (
        <ShellSearchNavLink key={item.to} item={item} mobile />
      ))}
    </div>
  </nav>
  )
}

const fabToneClass: Record<ShellFabItem['tone'], string> = {
  manage: 'bg-indigo-600 text-white shadow-indigo-950/25 hover:bg-indigo-700 focus:ring-indigo-200',
  edit: 'bg-amber-500 text-slate-950 shadow-amber-900/20 hover:bg-amber-400 focus:ring-amber-200',
  save: 'bg-emerald-600 text-white shadow-emerald-950/25 hover:bg-emerald-700 focus:ring-emerald-200',
  exit: 'bg-slate-700 text-white shadow-slate-950/20 hover:bg-slate-800 focus:ring-slate-200',
}

const FloatingActionButtons = ({ items }: { items: ShellFabItem[] }) => (
  <div className="fixed bottom-24 right-4 z-40 flex flex-col-reverse items-end gap-2.5 desktop:bottom-6 desktop:right-6">
    {items.map((item) => (
      <button
        key={item.label}
        type="button"
        className={`inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition focus:outline-none focus:ring-4 ${fabToneClass[item.tone]}`}
        aria-label={item.label}
        title={item.label}
        onClick={item.onClick}
      >
        {item.icon}
      </button>
    ))}
  </div>
)

type GroupDrawerProps = {
  currentGroup?: GroupSummaryDto | null
  churchGroup?: GroupSummaryDto | null
  items: GroupSummaryDto[]
  open: boolean
  onClose: () => void
  onOpenGroup: (groupId: string) => void
  onOpenSubgroup: (subgroupId: string) => void
}

const GroupDrawer = ({ currentGroup, churchGroup, items, open, onClose, onOpenGroup, onOpenSubgroup }: GroupDrawerProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const showParentActions = Boolean(currentGroup?.parentGroupId)

  return (
    <>
      <div
        className={[
          'fixed inset-0 z-40 bg-slate-950/25 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className={[
          'fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm transform flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform sm:top-16',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-label={t('subgroupMenu')}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">{t('subgroupMenu')}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{currentGroup?.name || t('group')}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            aria-label={t('close')}
            title={t('close')}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {showParentActions ? (
            <div className="mb-3 space-y-2 border-b border-slate-200 pb-3">
              <button
                type="button"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-semibold text-slate-900 transition hover:border-emerald-200 hover:bg-emerald-50"
                onClick={() => currentGroup?.parentGroupId && onOpenGroup(currentGroup.parentGroupId)}
              >
                {t('backToParentGroup')}
              </button>
              {churchGroup ? (
                <button
                  type="button"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-semibold text-slate-900 transition hover:border-emerald-200 hover:bg-emerald-50"
                  onClick={() => onOpenGroup(churchGroup.id)}
                >
                  {t('backToChurch')}
                </button>
              ) : null}
            </div>
          ) : null}

          {items.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">{t('noSubgroupsYet')}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((subgroup) => {
                const membership = auth.memberships.find((item) => item.groupId === subgroup.id)
                const isApproved = membership?.status === 'approved'
                const statusLabel = isApproved
                  ? t('approved')
                  : membership?.status === 'requested'
                    ? t('requested')
                    : membership?.status === 'invited'
                      ? t('invited')
                      : t('notJoined')

                return (
                  <li key={subgroup.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                      onClick={() => onOpenSubgroup(subgroup.id)}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-950">{subgroup.name}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {isApproved ? t('openGroup') : t('applyToJoin')}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <AccessTypeBadge accessType={subgroup.accessType} />
                          <span className="text-[11px] font-medium text-slate-500">{statusLabel}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
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
  const t = useUiText()
  const { CurrentGroup } = useCurrentGroupStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [currentGroupPages, setCurrentGroupPages] = useState<PageSummaryDto[]>([])
  const [currentSubgroups, setCurrentSubgroups] = useState<GroupSummaryDto[]>([])
  const [contextualGroup, setContextualGroup] = useState<GroupSummaryDto | null>(null)
  const [churchGroup, setChurchGroup] = useState<GroupSummaryDto | null>(null)
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false)
  const groupScreenMatch = location.pathname.match(/^\/groups\/([^/]+)$/)
  const groupJoinMatch = location.pathname.match(/^\/groups\/([^/]+)\/join$/)
  const groupManageMatch = location.pathname.match(/^\/groups\/([^/]+)\/manage$/)
  const groupCreatePageMatch = location.pathname.match(/^\/groups\/([^/]+)\/pages\/new$/)
  const pageEditMatch = location.pathname.match(/^\/pages\/([^/]+)\/edit$/)
  const searchParams = new URLSearchParams(location.search)
  const isGroupScreen = Boolean(groupScreenMatch)
  const isManagementScreen = Boolean(groupManageMatch)
  const isPageEditorScreen = Boolean(groupCreatePageMatch || pageEditMatch)
  const contextualGroupId =
    groupScreenMatch?.[1] ||
    groupJoinMatch?.[1] ||
    groupManageMatch?.[1] ||
    groupCreatePageMatch?.[1] ||
    (pageEditMatch ? searchParams.get('groupId') || CurrentGroup?.id || '' : '')
  const currentGroupMembership = contextualGroupId
    ? auth.memberships.find((item) => item.groupId === contextualGroupId)
    : null
  const canManageCurrentGroup =
    currentGroupMembership?.status === 'approved' &&
    (currentGroupMembership.role === 'leader' || currentGroupMembership.role === 'coLeader')
  const canUseSubgroupMenu = currentGroupMembership?.status === 'approved'
  const currentGroupPageNavItems = useMemo<ShellNavItem[]>(
    () =>
      currentGroupPages.map((page) => ({
        label: localizeText(page.title, auth.language) || translateUi(auth.language, 'untitledPage'),
        to: `/groups/${contextualGroupId}?page=${encodeURIComponent(page.id)}`,
        matchSearch: `?page=${encodeURIComponent(page.id)}`,
        pageId: page.id,
        icon: <PageIcon />,
      })),
    [auth.language, contextualGroupId, currentGroupPages],
  )
  const selectedPageId = searchParams.get('page') || currentGroupPageNavItems[0]?.pageId || ''
  const managementNavItems: ShellNavItem[] = contextualGroupId
    ? [
        { label: translateUi(auth.language, 'group'), to: `/groups/${contextualGroupId}/manage?section=group`, matchSearch: '?section=group', icon: <GroupIcon /> },
        { label: translateUi(auth.language, 'subgroups'), to: `/groups/${contextualGroupId}/manage?section=subgroups`, matchSearch: '?section=subgroups', icon: <SubgroupsIcon /> },
        { label: translateUi(auth.language, 'members'), to: `/groups/${contextualGroupId}/manage?section=members`, matchSearch: '?section=members', icon: <MembersIcon /> },
        { label: translateUi(auth.language, 'pages'), to: `/groups/${contextualGroupId}/manage?section=pages`, matchSearch: '?section=pages', icon: <PageIcon /> },
        { label: translateUi(auth.language, 'events'), to: `/groups/${contextualGroupId}/manage?section=events`, matchSearch: '?section=events', icon: <EventsIcon /> },
      ]
    : []
  const shellNavItems = isManagementScreen ? managementNavItems : isGroupScreen || isPageEditorScreen ? currentGroupPageNavItems : []
  const fabItems: ShellFabItem[] = isGroupScreen && canManageCurrentGroup
    ? [
        {
          label: translateUi(auth.language, 'manageGroup'),
          tone: 'manage',
          icon: <SettingsIcon />,
          onClick: () => navigate(`/groups/${contextualGroupId}/manage?section=group`),
        },
        ...(selectedPageId
          ? [
              {
                label: translateUi(auth.language, 'editCurrentPage'),
                tone: 'edit' as const,
                icon: <EditIcon />,
                onClick: () => navigate(`/pages/${selectedPageId}/edit?groupId=${contextualGroupId}`),
              },
            ]
          : []),
      ]
    : isPageEditorScreen
      ? [
          {
            label: translateUi(auth.language, 'savePage'),
            tone: 'save',
            icon: <SaveIcon />,
            onClick: () => window.dispatchEvent(new Event('alife-page-editor-save')),
          },
          {
            label: translateUi(auth.language, 'exitEditor'),
            tone: 'exit',
            icon: <BackIcon />,
            onClick: () => window.dispatchEvent(new Event('alife-page-editor-exit')),
          },
        ]
      : isManagementScreen
        ? [
            {
              label: translateUi(auth.language, 'backToGroup'),
              tone: 'exit',
              icon: <BackIcon />,
              onClick: () => navigate(`/groups/${contextualGroupId}`),
            },
          ]
        : []

  const toggleLanguageLabel = auth.language.toUpperCase()
  const appNavItems: ShellNavItem[] = [
    ...(!auth.loading && auth.isGuest ? [{ label: translateUi(auth.language, 'onboarding'), to: '/onboarding', icon: <OnboardingIcon /> }] : []),
  ]

  useEffect(() => {
    if (!contextualGroupId || isManagementScreen) {
      setCurrentGroupPages([])
      return
    }

    let cancelled = false

    groupService
      .getGroupPages(contextualGroupId)
      .then((pages) => {
        if (cancelled) {
          return
        }

        setCurrentGroupPages(pages)
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentGroupPages([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [contextualGroupId, isManagementScreen])

  useEffect(() => {
    if (!contextualGroupId) {
      setCurrentSubgroups([])
      setContextualGroup(null)
      setGroupDrawerOpen(false)
      return
    }

    let cancelled = false

    groupService
      .getGroup(contextualGroupId)
      .then((group) => {
        if (!cancelled) {
          setContextualGroup(group)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContextualGroup(null)
        }
      })

    groupService
      .getSubgroups(contextualGroupId)
      .then((subgroups) => {
        if (!cancelled) {
          setCurrentSubgroups(subgroups)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentSubgroups([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [contextualGroupId])

  useEffect(() => {
    if (!contextualGroup?.parentGroupId) {
      setChurchGroup(null)
      return
    }

    let cancelled = false

    groupService
      .getChurch()
      .then((group) => {
        if (!cancelled) {
          setChurchGroup(group)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChurchGroup(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [contextualGroup?.parentGroupId])

  useEffect(() => {
    setGroupDrawerOpen(false)
  }, [location.pathname, location.search])

  const openSubgroup = (subgroupId: string) => {
    const membership = auth.memberships.find((item) => item.groupId === subgroupId)
    navigate(membership?.status === 'approved' ? `/groups/${subgroupId}` : `/groups/${subgroupId}/join`)
  }

  const openGroup = (groupId: string) => {
    navigate(`/groups/${groupId}`)
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6 desktop:px-8">
          <HeaderNav items={appNavItems} />

          <div className="ml-auto flex items-center gap-2">
            {!auth.loading && auth.me ? (
              <span className="text-sm text-slate-700">{auth.me.displayName || translateUi(auth.language, 'guest')}</span>
            ) : null}
            <button
              type="button"
              className="inline-flex h-10 min-w-12 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => auth.setLanguage(auth.language === 'en' ? 'zh' : 'en')}
            >
              {toggleLanguageLabel}
            </button>
            {contextualGroupId ? (
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={t('subgroupMenu')}
                title={t('subgroupMenu')}
                disabled={!canUseSubgroupMenu}
                onClick={() => setGroupDrawerOpen(true)}
              >
                <MenuIcon />
              </button>
            ) : null}
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
            <Route path="/groups/:groupId/join" element={<GroupJoinView />} />
            <Route path="/groups/:groupId/manage" element={<GroupManageView />} />
            <Route path="/pages/:pageId" element={<PageView />} />
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
      <GroupDrawer
        currentGroup={contextualGroup || (CurrentGroup?.id === contextualGroupId ? CurrentGroup : null)}
        churchGroup={churchGroup}
        items={currentSubgroups}
        open={groupDrawerOpen}
        onClose={() => setGroupDrawerOpen(false)}
        onOpenGroup={openGroup}
        onOpenSubgroup={openSubgroup}
      />
    </div>
  )
}

export default App
