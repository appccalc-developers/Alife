import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { groupService } from '../api/groupService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import type { GroupPageDto } from '../types/group'
import type { SectionEditModel } from '../types/page-editor'

const readText = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return ''
}

const parseLimit = (source: Record<string, unknown>, key: string, fallback = 5) => {
  const raw = source[key]
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }

  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return fallback
}

const PageView = () => {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const auth = useAuthStore()

  const [page, setPage] = useState<GroupPageDto | null>(null)
  const [sections, setSections] = useState<SectionEditModel[]>([])
  const [subgroupItems, setSubgroupItems] = useState<Array<{ id: string; name: string; accessType: string }>>([])
  const [groupPageItems, setGroupPageItems] = useState<Array<{ id: string; title: string; slug: string; visibility: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!slug) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const nextPage = await groupService.getPageBySlug(slug, auth.language)
      setPage(nextPage)

      const nextSections = nextPage?.id ? await pageService.getPageSections(nextPage.id) : []
      setSections(nextSections)

      if (nextPage?.ownerGroupId) {
        const [subgroups, pages] = await Promise.all([
          groupService.getSubgroups(nextPage.ownerGroupId),
          groupService.getGroupPages(nextPage.ownerGroupId, auth.language),
        ])
        setSubgroupItems(subgroups)
        setGroupPageItems(pages)
      } else {
        setSubgroupItems([])
        setGroupPageItems([])
      }
    } catch {
      setError('Page not found or not accessible for your membership.')
      setSections([])
      setSubgroupItems([])
      setGroupPageItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, auth.language])

  const sectionItems = useMemo(() => sections, [sections])

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      {loading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">Loading page...</p> : null}
      {!loading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}

      {!loading && !error && page ? (
        <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="space-y-2 border-b border-slate-200 pb-3">
            <h1 className="text-3xl font-bold text-slate-900">{page.title}</h1>
            <p className="text-sm text-slate-600">{page.description || 'No description for this page yet.'}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Slug: {page.slug}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Visibility: {page.visibility}</span>
            </div>
          </header>

          <div className="space-y-4">
            {sectionItems.map((section) => {
              const key = section.id || `${section.order}-${section.type}`

              if (section.type === 'Hero') {
                return (
                  <section key={key} className="overflow-hidden rounded-lg border border-slate-200">
                    <div
                      className="bg-cover bg-center px-5 py-12 text-white"
                      style={{
                        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.45)), url(${readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl') || ''})`,
                      }}
                    >
                      <h2 className="text-2xl font-bold">{readText(section.contentJson, 'title', 'headline') || 'Hero Section'}</h2>
                      <p className="mt-2 text-sm text-slate-100">{readText(section.contentJson, 'subtitle', 'subheadline') || 'No subtitle yet.'}</p>
                    </div>
                  </section>
                )
              }

              if (section.type === 'RichText') {
                return (
                  <section key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-700">
                    <p className="whitespace-pre-wrap">{readText(section.contentJson, 'text') || 'No rich text content yet.'}</p>
                  </section>
                )
              }

              if (section.type === 'GroupList') {
                return (
                  <section key={key} className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="text-lg font-semibold text-slate-900">{readText(section.contentJson, 'title') || 'Groups'}</h3>
                    {readText(section.contentJson, 'description') ? (
                      <p className="mt-1 text-sm text-slate-600">{readText(section.contentJson, 'description')}</p>
                    ) : null}
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {subgroupItems.slice(0, parseLimit(section.contentJson, 'limit', 6)).map((group) => (
                        <li key={group.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="font-medium text-slate-900">{group.name}</p>
                          <p className="text-xs text-slate-500">Access: {group.accessType}</p>
                        </li>
                      ))}
                    </ul>
                    {subgroupItems.length === 0 ? <p className="mt-3 text-sm text-slate-500">No groups available.</p> : null}
                  </section>
                )
              }

              if (section.type === 'PageList') {
                return (
                  <section key={key} className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="text-lg font-semibold text-slate-900">{readText(section.contentJson, 'title') || 'Pages'}</h3>
                    <ul className="mt-3 space-y-2">
                      {groupPageItems.slice(0, parseLimit(section.contentJson, 'limit', 8)).map((item) => (
                        <li key={item.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <Link className="font-medium text-blue-700 hover:underline" to={`/pages/${item.slug}`}>
                            {item.title}
                          </Link>
                          <p className="text-xs text-slate-500">Visibility: {item.visibility}</p>
                        </li>
                      ))}
                    </ul>
                    {groupPageItems.length === 0 ? <p className="mt-3 text-sm text-slate-500">No pages available.</p> : null}
                  </section>
                )
              }

              if (section.type === 'SermonList') {
                return (
                  <section key={key} className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="text-lg font-semibold text-slate-900">{readText(section.contentJson, 'title') || 'Sermons'}</h3>
                    <p className="mt-1 text-sm text-slate-600">Sermons are synced into this section. Set a YouTube channel to drive updates.</p>
                    {readText(section.contentJson, 'youtubeChannelId') ? (
                      <a
                        className="mt-3 inline-flex rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                        href={`https://www.youtube.com/channel/${readText(section.contentJson, 'youtubeChannelId')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open YouTube Channel
                      </a>
                    ) : null}
                  </section>
                )
              }

              return (
                <section key={key} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  {section.type} section configured.
                </section>
              )
            })}

            {sections.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No sections yet.</div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {page.ownerGroupId ? (
              <button
                className="rounded border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                type="button"
                onClick={() => {
                  navigate(`/pages/${page.id}/edit?groupId=${page.ownerGroupId}`)
                }}
              >
                Edit Page
              </button>
            ) : null}
          </div>
        </article>
      ) : null}
    </section>
  )
}

export default PageView
