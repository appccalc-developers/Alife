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
  onCreate: () => void
  showCreateAction?: boolean
}

const GroupPageTabs = ({ pages, subgroups, onCreate, showCreateAction = false }: Props) => {
  const [activePageId, setActivePageId] = useState('')
  const [sectionsByPageId, setSectionsByPageId] = useState<Record<string, SectionEditModel[]>>({})
  const [loadingPageId, setLoadingPageId] = useState('')
  const [error, setError] = useState('')

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0] ?? null,
    [activePageId, pages],
  )

  useEffect(() => {
    setActivePageId((current) => {
      if (current && pages.some((page) => page.id === current)) {
        return current
      }

      return pages[0]?.id ?? ''
    })
  }, [pages])

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
    <AppSectionCard title="Pages" subtitle="Select a group page to view its content.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Group pages">
            {pages.map((page) => {
              const selected = activePage?.id === page.id

              return (
                <button
                  key={page.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={[
                    'shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition',
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950',
                  ].join(' ')}
                  onClick={() => {
                    setError('')
                    setActivePageId(page.id)
                  }}
                >
                  {page.title}
                </button>
              )
            })}
          </div>

          {showCreateAction ? (
            <AppActionButton variant="primary" onClick={onCreate}>
              Create Page
            </AppActionButton>
          ) : null}
        </div>

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
