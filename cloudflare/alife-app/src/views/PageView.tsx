import { useMemo } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useLiveQuery } from '@tanstack/react-db'
import { useQuery } from '@tanstack/react-query'
import PageContentRenderer from '../components/page/PageContentRenderer'
import PageViewSkeleton from '../components/page/PageViewSkeleton'
import AppBackButton from '../components/layout/AppBackButton'
import { pageSectionsCanvasClass, pageSectionsChromeClass } from '../components/page-sections/sectionPresets'
import { fetchPageDetail, pageDetailQueryKey } from '../db/collections/pageCollection'
import { subgroupsCollection, groupPagesCollection } from '../db/collections/groupCollection'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { usePublicPageDetailQuery } from '../hooks/usePublicPageQueries'
import { useUiText } from '../i18n/uiText'
import { pageService, publicPagesQueryKey } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import { findPublicPageByMenuName } from './home/homeUtils'
import { localizeText } from '../utils/localizedText'

const PageView = () => {
  const { pageId: routePageId } = useParams<{ pageId: string }>()
  const location = useLocation()
  const t = useUiText()
  const auth = useAuthStore()
  const { language } = auth
  const searchParams = new URLSearchParams(location.search)
  const menuName = searchParams.get('page')
  const isPublicMenuPage = location.pathname === '/home' && Boolean(menuName?.trim())
  const menuPageId = isPublicMenuPage ? searchParams.get('pageId')?.trim() ?? '' : ''
  const isLegacyPublicPage = location.pathname.startsWith('/public/pages/')
  const isPublicPage = isLegacyPublicPage || isPublicMenuPage
  const { pageId: activePageId } = useActiveEntityIds({ pageId: routePageId })

  const {
    data: publicPages = [],
    isLoading: publicPagesLoading,
    isError: publicPagesError,
  } = useQuery({
    queryKey: publicPagesQueryKey(),
    queryFn: () => pageService.getPublicPages(),
    enabled: isPublicMenuPage && !menuPageId,
  })

  const publicPage = useMemo(
    () => isPublicMenuPage && !menuPageId ? findPublicPageByMenuName(publicPages, menuName, language) : null,
    [isPublicMenuPage, language, menuName, menuPageId, publicPages],
  )
  const pageId = isPublicMenuPage ? menuPageId || publicPage?.id || '' : activePageId

  const privatePageQuery = useQuery({
    queryKey: pageDetailQueryKey(pageId),
    queryFn: () => fetchPageDetail(pageId),
    enabled: Boolean(pageId) && !isPublicPage,
  })
  const publicPageQuery = usePublicPageDetailQuery(isPublicPage ? pageId : '')
  const {
    data: page = null,
    isLoading: pageLoading,
    isError,
  } = isPublicPage ? publicPageQuery : privatePageQuery

  const sections = useMemo(
    () => (page?.sections ?? []).slice().sort((a, b) => a.order - b.order),
    [page?.sections],
  )

  const subColl = useMemo(
    () => (!isPublicPage && page?.ownerGroupId ? subgroupsCollection(page.ownerGroupId) : null),
    [isPublicPage, page?.ownerGroupId],
  )
  const { data: subgroupItems = [] } = useLiveQuery(
    () => subColl ?? undefined,
    [subColl],
  )
  const localizedSubgroupItems = useMemo(
    () => subgroupItems.map((subgroup) => ({ ...subgroup, name: localizeText(subgroup.name, language) })),
    [language, subgroupItems],
  )

  const gpColl = useMemo(
    () => (!isPublicPage && page?.ownerGroupId ? groupPagesCollection(page.ownerGroupId) : null),
    [isPublicPage, page?.ownerGroupId],
  )
  const { data: groupPageItems = [] } = useLiveQuery(
    () => gpColl ?? undefined,
    [gpColl],
  )

  const publicPageNotFound = isPublicMenuPage && !menuPageId && !publicPagesLoading && !publicPagesError && !publicPage
  const publicPageUnavailable = isPublicPage && Boolean(pageId) && !pageLoading && page === null
  const backFallbackTo = page?.ownerGroupId ? '/groups' : '/'
  const showBackButton = !isPublicPage
  const pagePending = publicPagesLoading || pageLoading
  const publicPageFailed = isPublicPage && !page && (
    (publicPagesError && publicPages.length === 0) ||
    publicPageNotFound ||
    publicPageUnavailable ||
    isError
  )
  const pageFailed = !pagePending && (publicPageFailed || (!isPublicPage && isError))
  const showPageChrome = showBackButton || pageFailed

  return (
    !pageId && !isPublicMenuPage ? <Navigate to="/" replace /> :
    <main className={pageSectionsCanvasClass} aria-busy={pagePending || undefined}>
      {showPageChrome ? (
        <div className={`${pageSectionsChromeClass} space-y-4 pt-20 sm:pt-24`}>
          {showBackButton ? <AppBackButton fallbackTo={backFallbackTo} /> : null}
          {pageFailed ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{t('pageAccessDenied')}</p>
          ) : null}
        </div>
      ) : null}
      {pagePending ? <PageViewSkeleton label={t('loadingPage')} /> : null}
      {!pagePending && !pageFailed && page ? (
        <PageContentRenderer
          page={page}
          sections={sections}
          subgroupItems={localizedSubgroupItems as Array<{ id: string; name: string; accessType: string }>}
          groupPageItems={groupPageItems as unknown as Array<{ id: string; title: string; visibility: string }>}
          allowGroupDataSources={!isPublicPage}
          showHeader={false}
          framed={false}
        />
      ) : null}
    </main>
  )
}

export default PageView
