import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from '@tanstack/react-db'
import { useQuery } from '@tanstack/react-query'
import PageContentRenderer from '../components/page/PageContentRenderer'
import { pageSectionShellClass } from '../components/page-sections/sectionPresets'
import { fetchPageDetail, pageDetailQueryKey } from '../db/collections/pageCollection'
import { subgroupsCollection, groupPagesCollection } from '../db/collections/groupCollection'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useUiText } from '../i18n/uiText'
import { activeEntityService } from '../services/activeEntityService'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'

const PageView = () => {
  const { pageId: routePageId } = useParams<{ pageId: string }>()
  const { pageId } = useActiveEntityIds({ pageId: routePageId })
  const navigate = useNavigate()
  const t = useUiText()
  const { language } = useAuthStore()

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
  const { data: subgroupItems = [] } = useLiveQuery(
    () => subColl ?? undefined,
    [subColl],
  )
  const localizedSubgroupItems = useMemo(
    () => subgroupItems.map((subgroup) => ({ ...subgroup, name: localizeText(subgroup.name, language) })),
    [language, subgroupItems],
  )

  const gpColl = useMemo(() => (page?.ownerGroupId ? groupPagesCollection(page.ownerGroupId) : null), [page?.ownerGroupId])
  const { data: groupPageItems = [] } = useLiveQuery(
    () => gpColl ?? undefined,
    [gpColl],
  )

  return (
    !pageId ? <Navigate to="/" replace /> :
    <>
      {pageLoading ? (
        <section className={pageSectionShellClass}>
          <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">{t('loadingPage')}</p>
        </section>
      ) : null}
      {!pageLoading && isError ? (
        <section className={pageSectionShellClass}>
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{t('pageAccessDenied')}</p>
        </section>
      ) : null}

      {!pageLoading && !isError && page ? (
        <PageContentRenderer
          page={page}
          sections={sections}
          subgroupItems={localizedSubgroupItems as Array<{ id: string; name: string; accessType: string }>}
          groupPageItems={groupPageItems as unknown as Array<{ id: string; title: string; visibility: string }>}
          showHeader={false}
          framed={false}
          onEditPage={(id, groupId) => {
            activeEntityService.setPage(id, groupId)
            navigate('/pages/edit')
          }}
        />
      ) : null}
    </>
  )
}

export default PageView
