import { useMemo } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useLiveQuery } from '@tanstack/react-db'
import { useQuery } from '@tanstack/react-query'
import PageContentRenderer from '../components/page/PageContentRenderer'
import AppBackButton from '../components/layout/AppBackButton'
import { pageSectionsCanvasClass, pageSectionsChromeClass } from '../components/page-sections/sectionPresets'
import { fetchPageDetail, pageDetailQueryKey } from '../db/collections/pageCollection'
import { subgroupsCollection, groupPagesCollection } from '../db/collections/groupCollection'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
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
  const menuName = new URLSearchParams(location.search).get('page')
  const isPublicMenuPage = location.pathname === '/home' && Boolean(menuName?.trim())
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
    enabled: isPublicMenuPage,
  })

  const publicPage = useMemo(
    () => isPublicMenuPage ? findPublicPageByMenuName(publicPages, menuName, language) : null,
    [isPublicMenuPage, language, menuName, publicPages],
  )
  const pageId = isPublicMenuPage ? publicPage?.id ?? '' : activePageId

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

  const publicPageNotFound = isPublicMenuPage && !publicPagesLoading && !publicPagesError && !publicPage
  const backFallbackTo = page?.ownerGroupId ? '/groups' : '/'
  const showBackButton = !isPublicPage
  const showPageStatus = publicPagesLoading || pageLoading || publicPagesError || publicPageNotFound || isError
  const showPageChrome = showBackButton || showPageStatus

  return (
    !pageId && !isPublicMenuPage ? <Navigate to="/" replace /> :
    <main className={pageSectionsCanvasClass}>
      {showPageChrome ? (
        <div className={`${pageSectionsChromeClass} space-y-4 pt-20 sm:pt-24`}>
          {showBackButton ? <AppBackButton fallbackTo={backFallbackTo} /> : null}
          {publicPagesLoading || pageLoading ? (
            <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">{t('loadingPage')}</p>
          ) : null}
          {!publicPagesLoading && !pageLoading && (publicPagesError || publicPageNotFound || isError) ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{t('pageAccessDenied')}</p>
          ) : null}
        </div>
      ) : null}
      {!publicPagesLoading && !pageLoading && !publicPagesError && !publicPageNotFound && !isError && page ? (
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
