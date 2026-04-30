import { useEffect, useMemo, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import AppSectionCard from '../layout/AppSectionCard'
import PageContentRenderer from '../page/PageContentRenderer'
import { pageService } from '../../services/pageService'
import type { GroupPageDto, GroupSummaryDto } from '../../types/group'
import type { SectionEditModel } from '../../types/page-editor'

type Props = {
  pages: GroupPageDto[]
  subgroups: GroupSummaryDto[]
  selectedPageId?: string
  onCreate: () => void
  showCreateAction?: boolean
}

const GroupPageTabs = ({ pages, subgroups, selectedPageId = '', onCreate, showCreateAction = false }: Props) => {
  const [sectionsByPageId, setSectionsByPageId] = useState<Record<string, SectionEditModel[]>>({})
  const [loadingPageId, setLoadingPageId] = useState('')
  const [error, setError] = useState('')

  const activePage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null,
    [selectedPageId, pages],
  )

  useEffect(() => {
    if (!activePage) {
      return
    }

    if (sectionsByPageId[activePage.id]) {
      setError('')
      return
    }

    setLoadingPageId(activePage.id)
    setError('')

    pageService
      .getPageSections(activePage.id)
      .then((sections) => {
        setSectionsByPageId((current) => ({
          ...current,
          [activePage.id]: sections,
        }))
      })
      .catch(() => {
        setError('Unable to load page sections.')
      })
      .finally(() => {
        setLoadingPageId((current) => (current === activePage.id ? '' : current))
      })
  }, [activePage, sectionsByPageId])

  if (pages.length === 0) {
    return (
      <AppSectionCard title="Pages" subtitle="Published and draft pages for this group.">
        <AppEmptyState
          title="No pages yet"
          description="Create a page to share updates, events, and resources."
          actionLabel={showCreateAction ? 'Create Page' : undefined}
          onAction={showCreateAction ? onCreate : undefined}
        />
      </AppSectionCard>
    )
  }

  return (
    <AppSectionCard title={activePage?.title || 'Page'} subtitle={activePage?.description || 'Selected group page.'}>
      <div className="space-y-4">
        {showCreateAction ? (
          <div className="flex justify-end">
            <AppActionButton variant="primary" onClick={onCreate}>
              Create Page
            </AppActionButton>
          </div>
        ) : null}

        {loadingPageId && activePage?.id === loadingPageId ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Loading page sections...</p>
        ) : null}

        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        {activePage && !error && (!loadingPageId || activePage.id !== loadingPageId) ? (
          <PageContentRenderer
            page={activePage}
            sections={sectionsByPageId[activePage.id] ?? []}
            subgroupItems={subgroups}
            groupPageItems={pages}
            showHeader
            framed={false}
          />
        ) : null}
      </div>
    </AppSectionCard>
  )
}

export default GroupPageTabs
