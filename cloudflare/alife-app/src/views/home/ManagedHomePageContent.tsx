import { useMemo } from 'react'
import PageContentRenderer from '../../components/page/PageContentRenderer'
import PageViewSkeleton from '../../components/page/PageViewSkeleton'
import {
  pageSectionsCanvasClass,
  pageSectionsChromeClass,
} from '../../components/page-sections/sectionPresets'
import { usePublicPageDetailQuery } from '../../hooks/usePublicPageQueries'
import type { HomeCopy } from './homeCopy'

type Props = {
  copy: HomeCopy
  pageId: string
  navigationPending: boolean
  navigationFailed: boolean
}

const ManagedHomePageContent = ({ copy, pageId, navigationPending, navigationFailed }: Props) => {
  const pageQuery = usePublicPageDetailQuery(pageId)
  const page = pageQuery.data ?? null
  const sections = useMemo(
    () => (page?.sections ?? []).slice().sort((left, right) => left.order - right.order),
    [page?.sections],
  )
  const pagePending = !page && (navigationPending || (Boolean(pageId) && pageQuery.isPending))
  const pageFailed = !page && (navigationFailed || (Boolean(pageId) && (pageQuery.isError || pageQuery.data === null)))
  const statusMessage = pageFailed ? copy.homepageUnavailable : copy.homepageEmpty

  return (
    <main className={`${pageSectionsCanvasClass} bg-[linear-gradient(180deg,#f3eee4_0%,#faf7f0_36%,#f3eee4_100%)]`} aria-busy={pagePending || undefined}>
      {pagePending ? <PageViewSkeleton label={copy.homepageLoading} /> : null}
      {!pagePending && page ? (
        <PageContentRenderer
          page={page}
          sections={sections}
          subgroupItems={[]}
          groupPageItems={[]}
          allowGroupDataSources={false}
          showHeader={false}
          framed={false}
        />
      ) : null}
      {!pagePending && !page ? (
        <section className={`${pageSectionsChromeClass} flex min-h-[70vh] items-center justify-center pb-16 pt-28`} role={pageFailed ? 'alert' : 'status'}>
          <p className="max-w-md rounded-2xl border border-home-border/55 bg-[#fffaf2]/90 px-7 py-6 text-center text-sm leading-7 text-home-muted shadow-[0_20px_60px_rgba(58,42,24,0.08)] backdrop-blur">
            {statusMessage}
          </p>
        </section>
      ) : null}
    </main>
  )
}

export default ManagedHomePageContent
