import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { TerminalSquare } from 'lucide-react'
import logo from './assets/logo.png'
import AccessTypeBadge from './components/group/AccessTypeBadge'
import { groupService } from './services/groupService'
import { conditionalGet } from './db/httpCache'
import { groupQueryKey, groupPagesQueryKey, subgroupsQueryKey } from './db/collections/groupCollection'
import { normalizeGroup, normalizePageSummary } from './utils/apiEnums'
import { useAuthStore } from './stores/auth'
import { useCurrentGroupStore } from './stores/currentGroup'
import AdminView from './views/AdminView'
import GroupDetailView from './views/GroupDetailView'
import GroupJoinView from './views/GroupJoinView'
import HomeView from './views/HomeView'
import OnboardingView from './views/OnboardingView'
import PageEditorView from './views/PageEditorView'
import PageView from './views/PageView'
import ProfileView from './views/ProfileView'
import SermonsView from './views/SermonsView'
import SermonVideoView from './views/SermonVideoView'
import EventCreatorView from './views/EventCreatorView'
import EventDetailView from './views/EventDetailView'
import EventEnrollmentView from './views/EventEnrollmentView'
import EventReviewView from './views/EventReviewView'
import GroupManageView from './views/GroupManageView'
import InviteMembersView from './views/InviteMembersView'
import { localizeText } from './utils/localizedText'
import type { GroupDto, GroupSummaryDto, PageSummaryDto } from './types'
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
  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded bg-white p-3"
    >
      {t('loadingIdentity')}
    </motion.p>
  )
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

const EnrollmentIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 7h8" />
    <path d="M8 12h8" />
    <path d="M8 17h5" />
    <rect x="4" y="3" width="16" height="18" rx="2" />
  </svg>
)

const MemoriesIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="m3 16 5-5 4 4 2-2 5 5" />
    <circle cx="16" cy="9" r="1.5" />
  </svg>
)

const EditIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
  <motion.div
    whileTap={{ scale: 0.95 }}
    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
  >
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
  </motion.div>
)

const ShellSearchNavLink = ({ item, mobile = false }: { item: ShellNavItem; mobile?: boolean }) => {
  const location = useLocation()
  const target = new URL(item.to, window.location.origin)
  const pageEditMatch = location.pathname.match(/^\/pages\/([^/]+)\/edit$/)
  const isActive =
    (location.pathname === target.pathname && (item.matchSearch ? location.search === item.matchSearch : location.search === target.search)) ||
    (Boolean(item.pageId) && pageEditMatch?.[1] === item.pageId)

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
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
    </motion.div>
  )
}

const HeaderNav = ({ items, currentGroupName, currentGroupManageTo }: { items: ShellNavItem[]; currentGroupName?: string; currentGroupManageTo?: string }) => {
  const t = useUiText()

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" aria-label={t('appNavigation')}>
      <Link to="/" className="mr-1 flex shrink-0 items-center rounded-lg text-slate-950" aria-label={t('home')}>
        <span className="flex items-center justify-center rounded-xl bg-emerald-50 p-1.5">
          <img src={logo} alt={t('appName')} className="h-8 w-auto drop-shadow-sm" />
        </span>
      </Link>
      {currentGroupName && currentGroupManageTo ? (
        <Link
          to={currentGroupManageTo}
          className="max-w-72 shrink-0 truncate text-sm font-semibold text-slate-700 hover:text-emerald-700 sm:max-w-xs"
        >
          {currentGroupName}
        </Link>
      ) : currentGroupName ? (
        <span className="max-w-72 shrink-0 truncate text-sm font-semibold text-slate-700 sm:max-w-xs">{currentGroupName}</span>
      ) : null}
      {items.map((item) => (
        <ShellNavLink key={item.to} item={item} />
      ))}
    </nav>
  )
}

const SideNav = ({ items }: { items: ShellNavItem[] }) => {
  const t = useUiText()

  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed bottom-0 left-0 top-16 z-20 hidden w-72 bg-white/95 px-4 py-5 shadow-sm backdrop-blur desktop:block"
    >
      <nav className="space-y-1" aria-label={t('primaryNavigation')}>
        <AnimatePresence mode="wait">
          {items.map((item, i) => (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25, ease: 'easeOut' }}
            >
              <ShellSearchNavLink item={item} />
            </motion.div>
          ))}
        </AnimatePresence>
      </nav>
    </motion.aside>
  )
}

const BottomNav = ({ items }: { items: ShellNavItem[] }) => {
  const t = useUiText()

  return (
    <motion.nav
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] pt-1.5 shadow-[0_-12px_30px_rgba(15,23,42,0.10)] backdrop-blur desktop:hidden"
      aria-label={t('primaryNavigation')}
    >
      <div className="mx-auto flex max-w-lg items-stretch gap-1">
        {items.map((item, i) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05, duration: 0.3, ease: 'easeOut' }}
            className="flex-1"
          >
            <ShellSearchNavLink item={item} mobile />
          </motion.div>
        ))}
      </div>
    </motion.nav>
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
    {items.map((item, i) => (
      <motion.div
        key={item.label}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.2 + i * 0.08,
          type: 'spring',
          stiffness: 400,
          damping: 20,
        }}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
      >
        <button
          type="button"
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition focus:outline-none focus:ring-4 ${fabToneClass[item.tone]}`}
          aria-label={item.label}
          title={item.label}
          onClick={item.onClick}
        >
          {item.icon}
        </button>
      </motion.div>
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
  const currentGroupName = localizeText(currentGroup?.name, auth.language) || t('group')

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className={[
          'fixed inset-0 z-40 bg-slate-950/25',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        ].join(' ')}
        aria-hidden="true"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: open ? 0 : '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl sm:top-16"
        aria-label={t('subgroupMenu')}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">{t('subgroupMenu')}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{currentGroupName}</p>
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
            <motion.ul
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
              className="space-y-2"
            >
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
                  <motion.li
                    key={subgroup.id}
                    variants={{
                      hidden: { opacity: 0, x: 20 },
                      visible: { opacity: 1, x: 0 },
                    }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                      onClick={() => onOpenSubgroup(subgroup.id)}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-950">{localizeText(subgroup.name, auth.language)}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {isApproved ? t('openGroup') : t('applyToJoin')}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <AccessTypeBadge accessType={subgroup.accessType} />
                          <span className="text-[11px] font-medium text-slate-500">{statusLabel}</span>
                        </span>
                      </span>
                    </motion.button>
                  </motion.li>
                )
              })}
            </motion.ul>
          )}
        </div>
      </motion.aside>
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
  const [debugGroupApiLoading, setDebugGroupApiLoading] = useState(false)
  const groupScreenMatch = location.pathname.match(/^\/groups\/([^/]+)$/)
  const groupJoinMatch = location.pathname.match(/^\/groups\/([^/]+)\/join$/)
  const groupManageMatch = location.pathname.match(/^\/groups\/([^/]+)\/manage$/)
  const groupCreatePageMatch = location.pathname.match(/^\/groups\/([^/]+)\/pages\/new$/)
  const groupEventDetailMatch = location.pathname.match(/^\/groups\/([^/]+)\/events\/([^/]+)$/)
  const groupEventEnrollmentMatch = location.pathname.match(/^\/groups\/([^/]+)\/events\/[^/]+\/enroll$/)
  const groupEventReviewMatch = location.pathname.match(/^\/groups\/([^/]+)\/events\/[^/]+\/review$/)
  const eventCreateMatch = location.pathname.match(/^\/events\/new$/)
  const eventEditMatch = location.pathname.match(/^\/events\/[^/]+\/edit$/)
  const sermonDetailMatch = location.pathname.match(/^\/sermons\/[^/]+$/)
  const pageEditMatch = location.pathname.match(/^\/pages\/([^/]+)\/edit$/)
  const profileMatch = location.pathname.match(/^\/profile$/)
  const searchParams = new URLSearchParams(location.search)
  const isGroupScreen = Boolean(groupScreenMatch)
  const isManagementScreen = Boolean(groupManageMatch)
  const isPageEditorScreen = Boolean(groupCreatePageMatch || pageEditMatch)
  const isEventScreen = Boolean(eventCreateMatch || eventEditMatch || groupEventDetailMatch || groupEventEnrollmentMatch || groupEventReviewMatch)
  const isSermonDetailScreen = Boolean(sermonDetailMatch)
  const isProfileScreen = Boolean(profileMatch)
  const contextualGroupId =
    groupScreenMatch?.[1] ||
    groupJoinMatch?.[1] ||
    groupManageMatch?.[1] ||
    groupCreatePageMatch?.[1] ||
    groupEventDetailMatch?.[1] ||
    groupEventEnrollmentMatch?.[1] ||
    groupEventReviewMatch?.[1] ||
    (eventCreateMatch || eventEditMatch ? searchParams.get('groupId') || CurrentGroup?.id || '' : '') ||
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
  const eventDetailNavItems: ShellNavItem[] = contextualGroupId && groupEventDetailMatch?.[2]
    ? [
      { label: auth.language === 'zh' ? '活动通知' : 'Notice', to: `/groups/${contextualGroupId}/events/${groupEventDetailMatch[2]}`, icon: <EventsIcon /> },
      { label: auth.language === 'zh' ? '报名' : 'Enrollment', to: `/groups/${contextualGroupId}/events/${groupEventDetailMatch[2]}?section=enrollments`, matchSearch: '?section=enrollments', icon: <EnrollmentIcon /> },
      { label: auth.language === 'zh' ? '图文回忆' : 'Memories', to: `/groups/${contextualGroupId}/events/${groupEventDetailMatch[2]}?section=memories`, matchSearch: '?section=memories', icon: <MemoriesIcon /> },
    ]
    : []
  const shellNavItems = isManagementScreen ? managementNavItems : groupEventDetailMatch ? eventDetailNavItems : isGroupScreen || isPageEditorScreen ? currentGroupPageNavItems : []
  const fabItems: ShellFabItem[] = isGroupScreen && canManageCurrentGroup
    ? [
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
            label: translateUi(auth.language, 'backToViews'),
            tone: 'exit',
            icon: <BackIcon />,
            onClick: () => navigate(`/groups/${contextualGroupId}`),
          },
        ]
        : isEventScreen
          ? [
            {
              label: translateUi(auth.language, 'back'),
              tone: 'exit',
              icon: <BackIcon />,
              onClick: () => navigate(-1),
            },
          ]
          : isSermonDetailScreen
            ? [
              {
                label: translateUi(auth.language, 'back'),
                tone: 'exit',
                icon: <BackIcon />,
                onClick: () => navigate(-1),
              },
            ]
            : isProfileScreen
              ? [
                {
                  label: translateUi(auth.language, 'back'),
                  tone: 'exit',
                  icon: <BackIcon />,
                  onClick: () => navigate(-1),
                },
              ]
              : []

  const toggleLanguageLabel = auth.language === 'zh' ? '漢' : auth.language.toUpperCase()
  const appNavItems: ShellNavItem[] = [
    ...(!auth.loading && auth.isGuest ? [{ label: translateUi(auth.language, 'onboarding'), to: '/onboarding', icon: <OnboardingIcon /> }] : []),
  ]
  const headerGroup = CurrentGroup?.id === contextualGroupId ? CurrentGroup : contextualGroup
  const headerGroupName = contextualGroupId ? localizeText(headerGroup?.name, auth.language) : ''
  const headerGroupManageTo = contextualGroupId && canManageCurrentGroup ? `/groups/${contextualGroupId}/manage?section=group` : undefined
  const showDebugGroupApiButton = import.meta.env.DEV && Boolean(contextualGroupId)
  // const debugGroupApiPath = contextualGroupId ? `/api/groups/${contextualGroupId}` : ''
  const debugGroupApiPath = '/api/sermons'

  useEffect(() => {
    if (!contextualGroupId || isManagementScreen) {
      setCurrentGroupPages([])
      return
    }

    let cancelled = false

    conditionalGet<PageSummaryDto[]>({
      queryKey: groupPagesQueryKey(contextualGroupId),
      path: `/api/groups/${contextualGroupId}/pages`,
    })
      .then((pages) => {
        if (!cancelled) {
          setCurrentGroupPages(pages.map(normalizePageSummary))
        }
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

    conditionalGet<GroupDto>({
      queryKey: groupQueryKey(contextualGroupId),
      path: `/api/groups/${contextualGroupId}`,
    })
      .then((group) => {
        if (!cancelled) {
          setContextualGroup(normalizeGroup(group))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContextualGroup(null)
        }
      })

    if (auth.isGuest) {
      setCurrentSubgroups([])
    } else {
      conditionalGet<GroupSummaryDto[]>({
        queryKey: subgroupsQueryKey(contextualGroupId),
        path: `/api/groups/${contextualGroupId}/subgroups`,
      })
        .then((subgroups) => {
          if (!cancelled) {
            setCurrentSubgroups(subgroups.map(normalizeGroup))
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCurrentSubgroups([])
          }
        })
    }

    return () => {
      cancelled = true
    }
  }, [auth.isGuest, contextualGroupId])

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

  const sendDebugGroupApiCall = async () => {
    if (!contextualGroupId || debugGroupApiLoading) {
      return
    }

    setDebugGroupApiLoading(true)
    try {
      const group = await groupService.getGroup(contextualGroupId)
      console.info(`[debug] GET ${debugGroupApiPath}`, group)
    } catch (error) {
      console.error(`[debug] GET ${debugGroupApiPath} failed`, error)
    } finally {
      setDebugGroupApiLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur"
      >
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6 desktop:px-8">
          <HeaderNav items={appNavItems} currentGroupName={headerGroupName} currentGroupManageTo={headerGroupManageTo} />

          <div className="ml-auto flex items-center gap-2">
            {!auth.loading && auth.me?.displayName ? (
              <Link className="max-w-36 truncate text-sm font-medium text-slate-700 hover:text-slate-950" to="/profile">
                {auth.me.displayName}
              </Link>
            ) : null}
            <button
              type="button"
              className="inline-flex h-10 min-w-12 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => void auth.updateLanguage(auth.language === 'en' ? 'zh' : 'en')}
            >
              {toggleLanguageLabel}
            </button>
            {showDebugGroupApiButton ? (
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-800 shadow-sm hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
                aria-label={`Debug GET ${debugGroupApiPath}`}
                title={`Debug GET ${debugGroupApiPath}`}
                disabled={debugGroupApiLoading}
                onClick={() => void sendDebugGroupApiCall()}
              >
                <TerminalSquare aria-hidden="true" className="h-5 w-5" />
              </button>
            ) : null}
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
      </motion.header>
      <div className="min-h-screen desktop:pl-72">
        <SideNav items={shellNavItems} />

        <motion.main
          key={location.pathname + location.search}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 desktop:px-8 desktop:pb-10"
        >
          {auth.loading ? <RouteLoading /> : null}
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname + location.search}>
              <Route path="/" element={<HomeView />} />
              <Route path="/groups/:groupId" element={<GroupDetailView />} />
              <Route path="/groups/:groupId/join" element={<GroupJoinView />} />
              <Route path="/groups/:groupId/manage" element={<GroupManageView />} />
              <Route path="/groups/:groupId/manage/invite-members" element={<InviteMembersView />} />
              <Route path="/pages/:pageId" element={<PageView />} />
              <Route path="/profile" element={<ProfileView />} />
              <Route path="/sermons" element={<SermonsView />} />
              <Route path="/sermons/:sermonId" element={<SermonVideoView />} />
              <Route path="/events/new" element={<EventCreatorView />} />
              <Route path="/events/:eventId/edit" element={<EventCreatorView />} />
              <Route path="/groups/:groupId/events/:eventId" element={<EventDetailView />} />
              <Route path="/groups/:groupId/events/:eventId/enroll" element={<EventEnrollmentView />} />
              <Route path="/groups/:groupId/events/:eventId/review" element={<EventReviewView />} />
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
          </AnimatePresence>
        </motion.main>
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
