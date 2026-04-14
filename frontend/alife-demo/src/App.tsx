import type { ReactElement } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
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

const RouteLoading = () => <p className="rounded bg-white p-3">Loading identity...</p>

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

  const toggleLanguageLabel = auth.language.toUpperCase()
  const primaryMembershipGroupId = auth.memberships[0]?.groupId || ''

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-slate-100 text-slate-900">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-slate-800"
              aria-label="Home"
              title="Home"
            >
              <img src={logo} alt="Alife" className="h-7 w-auto" />
            </Link>
            <Link to="/sermons">Sermons</Link>
            {primaryMembershipGroupId ? <Link to={`/groups/${primaryMembershipGroupId}`}>My Group</Link> : null}
            {!auth.loading && auth.isGuest ? <Link to="/onboarding">Onboarding</Link> : null}
            {!auth.loading && auth.me?.isAdmin ? <Link to="/admin">Admin</Link> : null}
          </nav>

          <div className="flex items-center gap-2">
            {!auth.loading && auth.me ? <span className="text-sm text-slate-700">{auth.me.displayName || 'Guest'}</span> : null}
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={() => auth.setLanguage(auth.language === 'en' ? 'zh' : 'en')}
            >
              {toggleLanguageLabel}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
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
  )
}

export default App