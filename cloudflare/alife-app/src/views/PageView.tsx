import { useCallback, useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from '@tanstack/react-db'
import { useQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import FloatingActionButtons from '../app/actions/FloatingActionButtons'
import PageContentRenderer from '../components/page/PageContentRenderer'
import AppBackButton from '../components/layout/AppBackButton'
import { pageSectionsCanvasClass, pageSectionsChromeClass } from '../components/page-sections/sectionPresets'
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
  const location = useLocation()
  const navigate = useNavigate()
  const t = useUiText()
  const auth = useAuthStore()
  const { language } = auth

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

  const canEditPage = useMemo(() => {
    if (!page || !auth.initialized) {
      return false
    }

    if (auth.canReviewPages) {
      return true
    }

    if (auth.me?.id === page.createdByMemberId && page.visibility === 'draft') {
      return true
    }

    if (page.ownerGroupId) {
      return auth.hasLeaderAccess(page.ownerGroupId)
    }

    return auth.isAdmin
  }, [auth, page])

  const editPage = useCallback(() => {
    if (!page?.id) {
      return
    }

    if (
      page.ownerGroupId &&
      page.visibility === 'public' &&
      auth.hasLeaderAccess(page.ownerGroupId) &&
      !window.confirm(t('editPublishedGroupPageConfirm'))
    ) {
      return
    }

    activeEntityService.setPage(page.id, page.ownerGroupId || undefined)
    navigate(page.ownerGroupId ? '/pages/edit' : '/pages/edit?scope=global')
  }, [auth, navigate, page, t])

  const editActions = useMemo(
    () => canEditPage
      ? [{
          label: t('editPage'),
          tone: 'edit' as const,
          icon: <Pencil className="h-6 w-6" aria-hidden="true" />,
          onClick: editPage,
        }]
      : [],
    [canEditPage, editPage, t],
  )
  const backFallbackTo = location.pathname.startsWith('/public/pages/')
    ? '/'
    : page?.ownerGroupId ? '/groups' : '/'

  return (
    !pageId ? <Navigate to="/" replace /> :
    <main className={pageSectionsCanvasClass}>
      <div className={`${pageSectionsChromeClass} space-y-4 pt-20 sm:pt-24`}>
        <AppBackButton fallbackTo={backFallbackTo} />
        {pageLoading ? (
          <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">{t('loadingPage')}</p>
        ) : null}
        {!pageLoading && isError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{t('pageAccessDenied')}</p>
        ) : null}
      </div>
      {!pageLoading && !isError && page ? (
        <PageContentRenderer
          page={page}
          sections={sections}
          subgroupItems={localizedSubgroupItems as Array<{ id: string; name: string; accessType: string }>}
          groupPageItems={groupPageItems as unknown as Array<{ id: string; title: string; visibility: string }>}
          showHeader={false}
          framed={false}
        />
      ) : null}
      <FloatingActionButtons items={editActions} />
    </main>
  )
}

export default PageView
