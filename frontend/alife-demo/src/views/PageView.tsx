import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from '@tanstack/react-db'
import PageContentRenderer from '../components/page/PageContentRenderer'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import { conditionalGet } from '../db/httpCache'
import { pageBySlugQueryKey } from '../db/collections/pageCollection'
import { pageSectionsCollection, getCachedPageSections } from '../db/collections/pageCollection'
import { subgroupsCollection } from '../db/collections/groupCollection'
import { groupPagesCollection } from '../db/collections/groupCollection'
import type { GroupPageDto } from '../types/group'
import type { SectionEditModel } from '../types/page-editor'

const PageView = () => {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const auth = useAuthStore()

  const [page, setPage] = useState<GroupPageDto | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')

  // page by slug（单个对象，用 conditionalGet）
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setPageLoading(true)
    setError('')

    conditionalGet<{ id: string; title: string; slug: string; language: string; visibility: string; createdByMemberId: string; description?: string | null; tagsJson?: string; titleDisplayStyle?: string; updatedUtc?: string; scope?: string; ownerGroupId?: string | null }>({
      queryKey: pageBySlugQueryKey(slug, auth.language),
      path: `/api/pages/${slug}`,
    })
      .then((data) => {
        if (!cancelled) setPage(data as unknown as GroupPageDto)
      })
      .catch(() => {
        if (!cancelled) setError('Page not found or not accessible for your membership.')
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false)
      })

    return () => { cancelled = true }
  }, [slug, auth.language])

  // sections（数组，用 useLiveQuery）
  const sectionsColl = useMemo(() => (page?.id ? pageSectionsCollection(page.id) : null), [page?.id])
  const { data: sectionsRaw = [] } = useLiveQuery(sectionsColl as NonNullable<typeof sectionsColl>)
  const sections = useMemo(
    () =>
      (sectionsRaw as Array<{ id: string; pageId: string; order: number; type: number | string; contentJson: string; styleJson: string }>)
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          id: s.id,
          order: s.order,
          type: s.type,
          contentJson: (() => {
            try { return JSON.parse(s.contentJson) } catch { return {} }
          })(),
          styleJson: (() => {
            try { return JSON.parse(s.styleJson) } catch { return {} }
          })(),
        })) as SectionEditModel[],
    [sectionsRaw],
  )

  // subgroups & pages for sidebar（数组，用 useLiveQuery）
  const subColl = useMemo(() => (page?.ownerGroupId ? subgroupsCollection(page.ownerGroupId) : null), [page?.ownerGroupId])
  const { data: subgroupItems = [] } = useLiveQuery(subColl as NonNullable<typeof subColl>)

  const gpColl = useMemo(
    () => (page?.ownerGroupId ? groupPagesCollection(page.ownerGroupId, auth.language) : null),
    [page?.ownerGroupId, auth.language],
  )
  const { data: groupPageItems = [] } = useLiveQuery(gpColl as NonNullable<typeof gpColl>)

  const loading = pageLoading

  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 px-3 sm:px-4">
      {loading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">Loading page...</p> : null}
      {!loading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}

      {!loading && !error && page ? (
        <PageContentRenderer
          page={page}
          sections={sections}
          subgroupItems={subgroupItems as Array<{ id: string; name: string; accessType: string }>}
          groupPageItems={groupPageItems as Array<{ id: string; title: string; slug: string; visibility: string }>}
          onEditPage={(pageId, groupId) => {
            navigate(`/pages/${pageId}/edit?groupId=${groupId}`)
          }}
        />
      ) : null}
    </section>
  )
}

export default PageView
