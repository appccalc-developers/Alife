import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from '@tanstack/react-db'
import PageContentRenderer from '../components/page/PageContentRenderer'
import { conditionalGet } from '../db/httpCache'
import { pageDetailQueryKey } from '../db/collections/pageCollection'
import { subgroupsCollection, groupPagesCollection } from '../db/collections/groupCollection'
import type { GroupPageDto } from '../types/group'
import type { SectionEditModel } from '../types/page-editor'

const parseSection = (section: { id?: string; order: number; type: number | string; contentJson: string; styleJson: string }): SectionEditModel => ({
  id: section.id,
  order: section.order,
  type: section.type as SectionEditModel['type'],
  contentJson: (() => {
    try { return JSON.parse(section.contentJson) } catch { return {} }
  })(),
  styleJson: (() => {
    try { return JSON.parse(section.styleJson) } catch { return {} }
  })(),
})

const PageView = () => {
  const { pageId = '' } = useParams<{ pageId: string }>()
  const navigate = useNavigate()

  const [page, setPage] = useState<(GroupPageDto & { sections?: Array<{ id?: string; order: number; type: number | string; contentJson: string; styleJson: string }> }) | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!pageId) return
    let cancelled = false
    setPageLoading(true)
    setError('')

    conditionalGet<GroupPageDto & { sections?: Array<{ id?: string; order: number; type: number | string; contentJson: string; styleJson: string }> }>({
      queryKey: pageDetailQueryKey(pageId),
      path: `/api/pages/${pageId}`,
    })
      .then((data) => {
        if (!cancelled) setPage(data)
      })
      .catch(() => {
        if (!cancelled) setError('Page not found or not accessible for your membership.')
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false)
      })

    return () => { cancelled = true }
  }, [pageId])

  const sections = useMemo(
    () => (page?.sections ?? []).slice().sort((a, b) => a.order - b.order).map(parseSection),
    [page?.sections],
  )

  const subColl = useMemo(() => (page?.ownerGroupId ? subgroupsCollection(page.ownerGroupId) : null), [page?.ownerGroupId])
  const { data: subgroupItems = [] } = useLiveQuery(subColl as NonNullable<typeof subColl>)

  const gpColl = useMemo(() => (page?.ownerGroupId ? groupPagesCollection(page.ownerGroupId) : null), [page?.ownerGroupId])
  const { data: groupPageItems = [] } = useLiveQuery(gpColl as NonNullable<typeof gpColl>)

  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 px-3 sm:px-4">
      {pageLoading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">Loading page...</p> : null}
      {!pageLoading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}

      {!pageLoading && !error && page ? (
        <PageContentRenderer
          page={page}
          sections={sections}
          subgroupItems={subgroupItems as Array<{ id: string; name: string; accessType: string }>}
          groupPageItems={groupPageItems as unknown as Array<{ id: string; title: string; visibility: string }>}
          onEditPage={(id, groupId) => {
            navigate(`/pages/${id}/edit?groupId=${groupId}`)
          }}
        />
      ) : null}
    </section>
  )
}

export default PageView
