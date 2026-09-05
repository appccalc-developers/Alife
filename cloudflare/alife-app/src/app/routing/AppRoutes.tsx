import { lazy, Suspense, useEffect, type ReactElement } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { activeEntityService } from '../../services/activeEntityService'
import {
  resolveWorkspaceEntryLocation,
  resolveWorkspaceFallbackLocation,
  workspaceResumeService,
} from '../../services/workspaceResumeService'
import AppRouteLoading from '../components/AppRouteLoading'
import RouteChunkErrorBoundary from '../components/RouteChunkErrorBoundary'
import { isHomeLocation, isPublicPageLocation } from './publicRoutePolicy'
import { getRouteTransitionKey } from './routeTransitionPolicy'
import {
  canAccessChurchManagement,
  hasSystemManagementAdminPermission,
  normalizeChurchManagementSection,
} from './churchManagementAccess'
import { buildOnboardingLocation, normalizeIdentityReturnPath } from '../../services/identityPathPolicy'
import { PERSONAL_CENTER_PATH, PROFILE_SETTINGS_PATH } from './personalCenterRoutes'

const AdminView = lazy(() => import('../../views/AdminView'))
const AdminGroupView = lazy(() => import('../../views/AdminGroupView'))
const AlbumView = lazy(() => import('../../views/AlbumView'))
const ArticleDetailView = lazy(() => import('../../views/ArticleDetailView'))
const ArticlesView = lazy(() => import('../../views/ArticlesView'))
const BibleStudyView = lazy(() => import('../../views/BibleStudyView'))
const ChurchLifeView = lazy(() => import('../../views/ChurchLifeView'))
const SundayBulletinsView = lazy(() => import('../../views/SundayBulletinsView'))
const ChurchAlbumsView = lazy(() => import('../../views/ChurchAlbumsView'))
const ChurchManagementView = lazy(() => import('../../views/ChurchManagementView'))
const ContactDetailView = lazy(() => import('../../views/ContactDetailView'))
const EventCreatorView = lazy(() => import('../../views/EventCreatorView'))
const EventDetailView = lazy(() => import('../../views/EventDetailView'))
const EventEnrollmentView = lazy(() => import('../../views/EventEnrollmentView'))
const EventReviewView = lazy(() => import('../../views/EventReviewView'))
const EventTemplateAdminView = lazy(() => import('../../views/EventTemplateAdminView'))
const EventPackagePolicyAdminView = lazy(() => import('../../views/EventPackagePolicyAdminView'))
const EventWorkspaceView = lazy(() => import('../../views/EventWorkspaceView'))
const GroupDetailView = lazy(() => import('../../views/GroupDetailView'))
const GroupJoinView = lazy(() => import('../../views/GroupJoinView'))
const GroupManageView = lazy(() => import('../../views/GroupManageView'))
const GroupsView = lazy(() => import('../../views/GroupsView'))
const GroupTreeView = lazy(() => import('../../views/GroupTreeView'))
const ForumView = lazy(() => import('../../views/ForumView'))
const ForumPostView = lazy(() => import('../../views/ForumPostView'))
const HomeView = lazy(() => import('../../views/HomeView'))
const InviteMembersView = lazy(() => import('../../views/InviteMembersView'))
const IdentityLinkEntryView = lazy(() => import('../../views/IdentityLinkEntryView'))
const InternalAlphaLoginView = lazy(() => import('../../views/InternalAlphaLoginView'))
const OnboardingView = lazy(() => import('../../views/OnboardingView'))
const PageReviewView = lazy(() => import('../../views/PageReviewView'))
const PageEditorView = lazy(() => import('../../views/PageEditorView'))
const loadPageView = () => import('../../views/PageView')
const PageView = lazy(loadPageView)
const PersonalCenterView = lazy(() => import('../../views/PersonalCenterView'))
const ProfileView = lazy(() => import('../../views/ProfileView'))
const SermonsView = lazy(() => import('../../views/SermonsView'))
const SermonVideoView = lazy(() => import('../../views/SermonVideoView'))
const TasksView = lazy(() => import('../../views/TasksView'))

const AdminRoute = ({ children, permission }: { children: ReactElement; permission?: string }) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  const hasRequiredPermission = !permission || auth.hasAdminPermission(permission)
  return !auth.isGuest && hasRequiredPermission
    ? children
    : <Navigate to={resolveWorkspaceFallbackLocation(auth.isGuest)} replace />
}

const ChurchManagementRoute = ({
  children,
  churchGroupId,
  churchGroupLoading,
}: {
  children: ReactElement
  churchGroupId: string
  churchGroupLoading: boolean
}) => {
  const auth = useAuthStore()

  if (!auth.initialized || churchGroupLoading) {
    return <AppRouteLoading />
  }

  const canAccess = !auth.isGuest && canAccessChurchManagement({
    churchGroupId,
    canManageGroup: auth.canManageGroup,
  })

  return canAccess
    ? children
    : <Navigate to={resolveWorkspaceFallbackLocation(auth.isGuest)} replace />
}

const SystemManagementRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  const canAccess = !auth.isGuest && (
    auth.canReviewPages || hasSystemManagementAdminPermission(auth.hasAdminPermission)
  )

  return canAccess
    ? children
    : <Navigate to={resolveWorkspaceFallbackLocation(auth.isGuest)} replace />
}

const AdminLandingRoute = ({
  churchGroupId,
  churchGroupLoading,
}: {
  churchGroupId: string
  churchGroupLoading: boolean
}) => {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)

  if (searchParams.has('church')) {
    const legacySection = normalizeChurchManagementSection(searchParams.get('church'))
    const section = legacySection === 'dashboard' ? 'group' : legacySection
    return (
      <ChurchManagementRoute churchGroupId={churchGroupId} churchGroupLoading={churchGroupLoading}>
        <Navigate to={`/church/manage?section=${section}`} replace />
      </ChurchManagementRoute>
    )
  }

  return <SystemManagementRoute><AdminView /></SystemManagementRoute>
}

const PageReviewRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  return auth.canReviewPages
    ? children
    : <Navigate to={resolveWorkspaceFallbackLocation(auth.isGuest)} replace />
}

const OnboardingRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()
  const location = useLocation()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  const params = new URLSearchParams(location.search)
  const resumableIdentityIntent = ['activation', 'groupJoin'].includes(params.get('intent') ?? '')
  const returnPath = normalizeIdentityReturnPath(params.get('returnTo'))

  return !auth.loading && !auth.isGuest && !resumableIdentityIntent
    ? <Navigate to={returnPath || '/enter'} replace />
    : children
}

const MemberRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()
  const location = useLocation()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  return !auth.loading && !auth.isGuest
    ? children
    : <Navigate to={buildOnboardingLocation(`${location.pathname}${location.search}${location.hash}`)} replace />
}

const EntryRoute = () => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  if (auth.isGuest) {
    return <Navigate to="/onboarding" replace />
  }

  const rememberedLocation = workspaceResumeService.get(auth.me?.id)
  const activeGroupId = activeEntityService.getAll().groupId
  const destination = resolveWorkspaceEntryLocation(rememberedLocation, activeGroupId)

  return <Navigate to={destination} replace />
}

const WorkspaceFallbackRoute = () => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  return <Navigate to={resolveWorkspaceFallbackLocation(auth.isGuest)} replace />
}

const HomeRoute = () => {
  const location = useLocation()
  const pageMenuName = new URLSearchParams(location.search).get('page')?.trim()

  return pageMenuName ? <PageView /> : <HomeView />
}

type AppRoutesProps = {
  churchGroupId?: string
  churchGroupLoading?: boolean
}

const AppRoutes = ({ churchGroupId = '', churchGroupLoading = false }: AppRoutesProps) => {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const isManagedPublicPage = isHomeLocation(location) || isPublicPageLocation(location)
  const routeTransitionKey = getRouteTransitionKey({
    pathname: location.pathname,
    search: location.search,
    isManagedPublicPage,
  })

  useEffect(() => {
    if (isManagedPublicPage) {
      void loadPageView()
    }
  }, [isManagedPublicPage])

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={routeTransitionKey}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeInOut' }}
      >
        <RouteChunkErrorBoundary>
          <Suspense fallback={<AppRouteLoading />}>
            <Routes location={location}>
          <Route path="/" element={<HomeView />} />
          <Route path="/articles" element={<ArticlesView />} />
          <Route path="/articles/:slug" element={<ArticleDetailView />} />
          <Route path="/enter" element={<EntryRoute />} />
          <Route path="/activate/:selector" element={<IdentityLinkEntryView />} />
          <Route path="/join/:selector" element={<IdentityLinkEntryView />} />
          <Route path="/application/:selector" element={<IdentityLinkEntryView />} />
          <Route path="/internal/alpha-login" element={<InternalAlphaLoginView />} />
          <Route path="/home" element={<HomeRoute />} />
          <Route path="/church" element={<MemberRoute><ChurchLifeView /></MemberRoute>} />
          <Route path="/church/bulletins" element={<MemberRoute><SundayBulletinsView /></MemberRoute>} />
          <Route path="/church/albums" element={<MemberRoute><ChurchAlbumsView /></MemberRoute>} />
          <Route path="/church/forum" element={<MemberRoute><ForumView /></MemberRoute>} />
          <Route path="/church/forum/posts/:postId" element={<MemberRoute><ForumPostView /></MemberRoute>} />
          <Route
            path="/church/manage"
            element={
              <ChurchManagementRoute churchGroupId={churchGroupId} churchGroupLoading={churchGroupLoading}>
                <ChurchManagementView churchGroupId={churchGroupId} />
              </ChurchManagementRoute>
            }
          />
          <Route path="/groups" element={<GroupDetailView />} />
          <Route path="/groups/select" element={<GroupsView />} />
          <Route path="/groups/select/tree" element={<GroupTreeView />} />
          <Route path="/groups/join" element={<GroupJoinView />} />
          <Route path="/groups/manage" element={<GroupManageView />} />
          <Route path="/groups/manage/invite-members" element={<InviteMembersView />} />
          <Route path="/groups/:groupId" element={<GroupDetailView />} />
          <Route path="/groups/:groupId/join" element={<GroupJoinView />} />
          <Route path="/groups/:groupId/manage" element={<GroupManageView />} />
          <Route path="/groups/:groupId/manage/invite-members" element={<InviteMembersView />} />
          <Route path="/albums" element={<AlbumView />} />
          <Route path="/albums/:albumId" element={<AlbumView />} />
          <Route path="/groups/:groupId/albums" element={<AlbumView />} />
          <Route path="/groups/:groupId/albums/:albumId" element={<AlbumView />} />
          <Route path="/contacts/:contactId" element={<ContactDetailView />} />
          <Route path="/groups/:groupId/contacts/:contactId" element={<ContactDetailView />} />
          <Route path="/forum" element={<ForumView />} />
          <Route path="/forum/posts/:postId" element={<ForumPostView />} />
          <Route path="/groups/forum" element={<ForumView />} />
          <Route path="/groups/forum/posts/:postId" element={<ForumPostView />} />
          <Route path="/groups/:groupId/forum" element={<ForumView />} />
          <Route path="/groups/:groupId/forum/posts/:postId" element={<ForumPostView />} />
          <Route path="/public/pages/:pageId" element={<PageView />} />
          <Route path="/pages/:pageId" element={<PageView />} />
          <Route path="/pages" element={<PageView />} />
          <Route path={PERSONAL_CENTER_PATH} element={<MemberRoute><PersonalCenterView /></MemberRoute>} />
          <Route path={PROFILE_SETTINGS_PATH} element={<MemberRoute><ProfileView /></MemberRoute>} />
          <Route path="/tasks" element={<MemberRoute><TasksView /></MemberRoute>} />
          <Route path="/sermons" element={<SermonsView />} />
          <Route path="/sermons/:sermonId" element={<SermonVideoView />} />
          <Route path="/sermons/watch" element={<SermonVideoView />} />
          <Route
            path="/study"
            element={
              <MemberRoute>
                <BibleStudyView />
              </MemberRoute>
            }
          />
          <Route path="/events/new" element={<EventCreatorView />} />
          <Route path="/events/edit" element={<EventCreatorView />} />
          <Route path="/events/:eventId/edit" element={<EventCreatorView />} />
          <Route path="/events" element={<EventDetailView />} />
          <Route path="/events/:eventId" element={<EventDetailView />} />
          <Route path="/events/enroll" element={<EventEnrollmentView />} />
          <Route path="/events/:eventId/enroll" element={<EventEnrollmentView />} />
          <Route path="/events/review" element={<EventReviewView />} />
          <Route path="/events/:eventId/review" element={<EventReviewView />} />
          <Route path="/events/:eventId/workspace" element={<MemberRoute><EventWorkspaceView /></MemberRoute>} />
          <Route path="/events/:eventId/workspace/:surfacePath" element={<MemberRoute><EventWorkspaceView /></MemberRoute>} />
          <Route path="/groups/:groupId/events/new" element={<EventCreatorView />} />
          <Route path="/groups/:groupId/events/:eventId/edit" element={<EventCreatorView />} />
          <Route path="/groups/:groupId/events/:eventId" element={<EventDetailView />} />
          <Route path="/groups/:groupId/events/:eventId/enroll" element={<EventEnrollmentView />} />
          <Route path="/groups/:groupId/events/:eventId/review" element={<EventReviewView />} />
          <Route path="/groups/:groupId/events/:eventId/workspace" element={<MemberRoute><EventWorkspaceView /></MemberRoute>} />
          <Route path="/groups/:groupId/events/:eventId/workspace/:surfacePath" element={<MemberRoute><EventWorkspaceView /></MemberRoute>} />
          <Route path="/pages/new" element={<PageEditorView />} />
          <Route path="/groups/:groupId/pages/new" element={<PageEditorView />} />
          <Route path="/pages/:pageId/edit" element={<PageEditorView />} />
          <Route path="/pages/edit" element={<PageEditorView />} />
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
            element={<AdminLandingRoute churchGroupId={churchGroupId} churchGroupLoading={churchGroupLoading} />}
          />
          <Route
            path="/admin/users"
            element={
              <ChurchManagementRoute churchGroupId={churchGroupId} churchGroupLoading={churchGroupLoading}>
                <Navigate to="/church/manage?section=members" replace />
              </ChurchManagementRoute>
            }
          />
          <Route
            path="/admin/groups/:groupId"
            element={
              <AdminRoute permission="admin.access">
                <AdminGroupView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <AdminRoute permission="admin.roles.managePermissions">
                <AdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/logs"
            element={
              <AdminRoute permission="admin.auditLogs.view">
                <AdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/messages"
            element={
              <AdminRoute permission="admin.messages.manage">
                <AdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/visit-requests"
            element={
              <AdminRoute permission="admin.visitRequests.receive">
                <AdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/page-review"
            element={
              <PageReviewRoute>
                <PageReviewView />
              </PageReviewRoute>
            }
          />
          <Route
            path="/admin/event-templates"
            element={
              <AdminRoute permission="admin.events.manageTemplates">
                <EventTemplateAdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/event-package-policies"
            element={
              <AdminRoute permission="admin.events.managePackagePolicies">
                <EventPackagePolicyAdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/files"
            element={
              <AdminRoute permission="admin.files.view">
                <AdminView />
              </AdminRoute>
            }
          />
          <Route path="*" element={<WorkspaceFallbackRoute />} />
            </Routes>
          </Suspense>
        </RouteChunkErrorBoundary>
      </motion.div>
    </AnimatePresence>
  )
}

export default AppRoutes
