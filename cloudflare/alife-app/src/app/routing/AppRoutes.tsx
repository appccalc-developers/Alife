import { lazy, Suspense, type ReactElement } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import AppRouteLoading from '../components/AppRouteLoading'

const AdminView = lazy(() => import('../../views/AdminView'))
const AlbumView = lazy(() => import('../../views/AlbumView'))
const ArticleDetailView = lazy(() => import('../../views/ArticleDetailView'))
const ArticlesView = lazy(() => import('../../views/ArticlesView'))
const BibleStudyView = lazy(() => import('../../views/BibleStudyView'))
const ContactDetailView = lazy(() => import('../../views/ContactDetailView'))
const EventCreatorView = lazy(() => import('../../views/EventCreatorView'))
const EventDetailView = lazy(() => import('../../views/EventDetailView'))
const EventEnrollmentView = lazy(() => import('../../views/EventEnrollmentView'))
const EventReviewView = lazy(() => import('../../views/EventReviewView'))
const GroupDetailView = lazy(() => import('../../views/GroupDetailView'))
const GroupJoinView = lazy(() => import('../../views/GroupJoinView'))
const GroupManageView = lazy(() => import('../../views/GroupManageView'))
const GroupsView = lazy(() => import('../../views/GroupsView'))
const ForumView = lazy(() => import('../../views/ForumView'))
const ForumPostView = lazy(() => import('../../views/ForumPostView'))
const HomeView = lazy(() => import('../../views/HomeView'))
const InviteMembersView = lazy(() => import('../../views/InviteMembersView'))
const OnboardingView = lazy(() => import('../../views/OnboardingView'))
const PageReviewView = lazy(() => import('../../views/PageReviewView'))
const PageEditorView = lazy(() => import('../../views/PageEditorView'))
const PageView = lazy(() => import('../../views/PageView'))
const ProfileView = lazy(() => import('../../views/ProfileView'))
const SermonsView = lazy(() => import('../../views/SermonsView'))
const SermonVideoView = lazy(() => import('../../views/SermonVideoView'))

const AdminRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  return auth.me?.isAdmin || auth.hasAdminPermission('admin.access') ? children : <Navigate to="/" replace />
}

const PageReviewRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  return auth.canReviewPages ? children : <Navigate to="/" replace />
}

const OnboardingRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  return !auth.loading && !auth.isGuest ? <Navigate to="/" replace /> : children
}

const MemberRoute = ({ children }: { children: ReactElement }) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  return !auth.loading && !auth.isGuest ? children : <Navigate to="/" replace />
}

const EntryRoute = () => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    return <AppRouteLoading />
  }

  return <Navigate to={auth.isGuest ? '/onboarding' : '/groups/select'} replace />
}

const HomeRoute = () => {
  const location = useLocation()
  const pageMenuName = new URLSearchParams(location.search).get('page')?.trim()

  return pageMenuName ? <PageView /> : <HomeView />
}

const isGroupWorkspaceSectionPath = (pathname: string) =>
  pathname === '/groups' ||
  pathname === '/groups/manage' ||
  /^\/groups\/(?!select$|join$|manage$)[^/]+(?:\/manage)?$/.test(pathname)

const AppRoutes = () => {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const routeTransitionKey = location.pathname === '/study' || isGroupWorkspaceSectionPath(location.pathname)
    ? location.pathname
    : location.pathname + location.search

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={routeTransitionKey}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeInOut' }}
      >
        <Suspense fallback={<AppRouteLoading />}>
          <Routes location={location}>
          <Route path="/" element={<HomeView />} />
          <Route path="/articles" element={<ArticlesView />} />
          <Route path="/articles/:slug" element={<ArticleDetailView />} />
          <Route path="/enter" element={<EntryRoute />} />
          <Route path="/home" element={<HomeRoute />} />
          <Route path="/groups" element={<GroupDetailView />} />
          <Route path="/groups/select" element={<GroupsView />} />
          <Route path="/groups/join" element={<GroupJoinView />} />
          <Route path="/groups/manage" element={<GroupManageView />} />
          <Route path="/groups/manage/invite-members" element={<InviteMembersView />} />
          <Route path="/groups/:groupId" element={<GroupDetailView />} />
          <Route path="/groups/:groupId/join" element={<GroupJoinView />} />
          <Route path="/groups/:groupId/manage" element={<GroupManageView />} />
          <Route path="/groups/:groupId/manage/invite-members" element={<InviteMembersView />} />
          <Route path="/groups/:groupId/albums" element={<AlbumView />} />
          <Route path="/groups/:groupId/albums/:albumId" element={<AlbumView />} />
          <Route path="/groups/:groupId/contacts/:contactId" element={<ContactDetailView />} />
          <Route path="/forum" element={<ForumView />} />
          <Route path="/forum/posts/:postId" element={<ForumPostView />} />
          <Route path="/public/pages/:pageId" element={<PageView />} />
          <Route path="/pages/:pageId" element={<PageView />} />
          <Route path="/pages" element={<PageView />} />
          <Route path="/profile" element={<ProfileView />} />
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
          <Route path="/events/enroll" element={<EventEnrollmentView />} />
          <Route path="/events/review" element={<EventReviewView />} />
          <Route path="/groups/:groupId/events/new" element={<EventCreatorView />} />
          <Route path="/groups/:groupId/events/:eventId/edit" element={<EventCreatorView />} />
          <Route path="/groups/:groupId/events/:eventId" element={<EventDetailView />} />
          <Route path="/groups/:groupId/events/:eventId/enroll" element={<EventEnrollmentView />} />
          <Route path="/groups/:groupId/events/:eventId/review" element={<EventReviewView />} />
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
            element={
              <AdminRoute>
                <AdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <AdminRoute>
                <AdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/logs"
            element={
              <AdminRoute>
                <AdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/messages"
            element={
              <AdminRoute>
                <AdminView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/visit-requests"
            element={
              <AdminRoute>
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
            path="/admin/files"
            element={
              <AdminRoute>
                <AdminView />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

export default AppRoutes
