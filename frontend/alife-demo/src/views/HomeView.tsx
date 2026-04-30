import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { groupService } from '../api/groupService'
import { useAuthStore } from '../stores/auth'
import type { GroupDto, GroupPageDto, GroupSummaryDto } from '../types/group'

const HomeView = () => {
  const auth = useAuthStore()
  const [church, setChurch] = useState<GroupDto | null>(null)
  const [subgroups, setSubgroups] = useState<GroupSummaryDto[]>([])
  const [pages, setPages] = useState<GroupPageDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')

    try {
      const nextGlobalPages = await groupService.getGlobalPages(auth.language)
      setPages(nextGlobalPages)

      if (!auth.isGuest) {
        const nextChurch = await groupService.getChurch()
        setChurch(nextChurch)
        setSubgroups(await groupService.getSubgroups(nextChurch.id))
        return
      }

      setChurch(null)
      setSubgroups([])
    } catch {
      setError('Unable to load home feed right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.language, auth.isGuest])

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Alife Church Hub</h1>
        <p className="text-sm text-slate-600">Browse church updates and public pages.</p>
      </header>

      {loading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">Loading home data...</p> : null}
      {!loading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}

      {!loading && !error ? (
        <>
          {church ? (
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary Group</p>
                  <h2 className="text-xl font-semibold text-slate-900">{church.name}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/groups/${church.id}`} className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                    Open Group
                  </Link>
                </div>
              </div>
            </article>
          ) : null}

          {!auth.isGuest ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Subgroups</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {subgroups.map((subgroup) => (
                  <article key={subgroup.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900">{subgroup.name}</h3>
                    <p className="text-sm text-slate-600">Access: {subgroup.accessType}</p>
                    <Link to={`/groups/${subgroup.id}`} className="mt-2 inline-flex text-sm font-medium text-blue-700 hover:text-blue-600">
                      View details
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Global Pages</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {pages.map((page) => (
                <article key={page.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900">{page.title}</h3>
                  <p className="text-sm text-slate-600">{page.description || 'No description.'}</p>
                  <Link to={`/pages/${page.slug}`} className="mt-2 inline-flex text-sm font-medium text-blue-700 hover:text-blue-600">
                    Read page
                  </Link>
                </article>
              ))}
            </div>
            {pages.length === 0 ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">No global pages yet.</p> : null}
          </section>
        </>
      ) : null}
    </section>
  )
}

export default HomeView
