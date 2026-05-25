import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from '@tanstack/react-db'
import { useQuery } from '@tanstack/react-query'
import PageContentRenderer from '../components/page/PageContentRenderer'
import { fetchPageDetail, pageDetailQueryKey } from '../db/collections/pageCollection'
import { subgroupsCollection, groupPagesCollection } from '../db/collections/groupCollection'

const PageView = () => {
  const { pageId = '' } = useParams<{ pageId: string }>()
  const navigate = useNavigate()

  const {
    data: page = null,
    isLoading: pageLoading,
    isError,
  } = useQuery({
    queryKey: pageDetailQueryKey(pageId),
    queryFn: () => fetchPageDetail(pageId),
    enabled: Boolean(pageId),
  })

  const sections = useMemo(
    () => (page?.sections ?? []).slice().sort((a, b) => a.order - b.order),
    [page?.sections],
  )

  const subColl = useMemo(() => (page?.ownerGroupId ? subgroupsCollection(page.ownerGroupId) : null), [page?.ownerGroupId])
  const { data: subgroupItems = [] } = useLiveQuery(subColl as NonNullable<typeof subColl>)

  const gpColl = useMemo(() => (page?.ownerGroupId ? groupPagesCollection(page.ownerGroupId) : null), [page?.ownerGroupId])
  const { data: groupPageItems = [] } = useLiveQuery(gpColl as NonNullable<typeof gpColl>)

  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 px-3 sm:px-4">
      {pageLoading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">Loading page...</p> : null}
      {!pageLoading && isError ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">Page not found or not accessible for your membership.</p> : null}

      {!pageLoading && !isError && page ? (
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
