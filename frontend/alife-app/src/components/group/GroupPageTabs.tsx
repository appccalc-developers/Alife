import { useEffect, useMemo, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import PageContentRenderer, {
  normalizePageSections,
  validatePageContent,
} from '../page/PageContentRenderer'
import { cloudflareImageService } from '../../services/cloudflareImageService'
import { pageService } from '../../services/pageService'
import type { GroupPageDto, GroupSummaryDto } from '../../types/group'
import type { PageEditModel, SectionEditModel } from '../../types/page-editor'
import { toLocalizedText } from '../../utils/localizedText'

type Props = {
  pages: GroupPageDto[]
  subgroups: GroupSummaryDto[]
  selectedPageId?: string
  mode?: 'view' | 'edit'
  canEditAllPages?: boolean
  onSaved?: () => void
  onCreate: () => void
  showCreateAction?: boolean
}

const parseTags = (tagsJson?: string): string[] => {
  if (!tagsJson) {
    return []
  }

  try {
    const parsed = JSON.parse(tagsJson) as unknown
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : []
  } catch {
    return []
  }
}

const toEditModel = (page: GroupPageDto): PageEditModel => ({
  id: page.id,
  groupId: page.ownerGroupId ?? '',
  createdByMemberId: page.createdByMemberId,
  title: toLocalizedText(page.title),
  description: toLocalizedText(page.description),
  tags: parseTags(page.tagsJson),
  titleDisplayStyle: page.titleDisplayStyle ?? 'Default',
  visibility: page.visibility,
  sections: [],
})

const GroupPageTabs = ({
  pages,
  subgroups,
  selectedPageId = '',
  mode = 'view',
  canEditAllPages = false,
  onSaved,
  onCreate,
  showCreateAction = false,
}: Props) => {
  const [sectionsByPageId, setSectionsByPageId] = useState<Record<string, SectionEditModel[]>>({})
  const [modelsByPageId, setModelsByPageId] = useState<Record<string, PageEditModel>>({})
  const [loadingPageId, setLoadingPageId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const activePage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null,
    [selectedPageId, pages],
  )

  const activeModel = activePage ? modelsByPageId[activePage.id] : undefined
  const validation = activeModel ? validatePageContent(activeModel) : undefined
  const hasValidationErrors = validation
    ? Boolean(validation.title) || validation.sectionTypeErrors.some((item) => item.length > 0)
    : false

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
      .getPageById(activePage.id)
      .then((detail) => {
        const normalizedSections = normalizePageSections(detail.sections)
        setSectionsByPageId((current) => ({
          ...current,
          [activePage.id]: normalizedSections,
        }))
        setModelsByPageId((current) => ({
          ...current,
          [activePage.id]: {
            ...(current[activePage.id] ?? toEditModel({ ...activePage, ...detail })),
            sections: normalizedSections,
          },
        }))
      })
      .catch(() => {
        setError('Unable to load page sections.')
      })
      .finally(() => {
        setLoadingPageId((current) => (current === activePage.id ? '' : current))
      })
  }, [activePage, sectionsByPageId])

  useEffect(() => {
    if (!activePage || !sectionsByPageId[activePage.id]) {
      return
    }

    setModelsByPageId((current) => {
      if (current[activePage.id]) {
        return current
      }

      return {
        ...current,
        [activePage.id]: {
          ...toEditModel(activePage),
          sections: sectionsByPageId[activePage.id],
        },
      }
    })
  }, [activePage, sectionsByPageId])

  const updateActiveModel = (model: PageEditModel) => {
    if (!activePage) {
      return
    }

    setModelsByPageId((current) => ({
      ...current,
      [activePage.id]: model,
    }))
  }

  const saveActivePage = async () => {
    if (!activePage || !activeModel || !canEditAllPages || saving || hasValidationErrors) {
      return
    }

    const pageId = activeModel.id || activePage.id

    setSaving(true)
    setMessage('')
    setError('')

    try {
      let sectionsToPersist = activeModel.sections

      if (cloudflareImageService.sectionsHaveLocalDataImages(sectionsToPersist)) {
        setMessage('Uploading local images...')
        sectionsToPersist = await cloudflareImageService.resolveSectionImages(sectionsToPersist, `g-${activeModel.groupId || 'group'}-${pageId}`)
        updateActiveModel({ ...activeModel, sections: normalizePageSections(sectionsToPersist) })
      }

      await pageService.updatePage(pageId, {
        title: activeModel.title,
        description: activeModel.description,
        tagsJson: JSON.stringify(activeModel.tags),
        titleDisplayStyle: activeModel.titleDisplayStyle.trim() || 'Default',
        sections: sectionsToPersist,
      })

      if (activeModel.visibility !== activePage.visibility) {
        await pageService.publishPage(pageId, { visibility: activeModel.visibility })
      }

      const savedSections = normalizePageSections(sectionsToPersist)
      setSectionsByPageId((current) => ({
        ...current,
        [pageId]: savedSections,
      }))
      setModelsByPageId((current) => ({
        ...current,
        [pageId]: {
          ...activeModel,
          id: pageId,
          sections: savedSections,
        },
      }))
      setMessage('Page saved.')
      onSaved?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save page.')
    } finally {
      setSaving(false)
    }
  }

  if (pages.length === 0) {
    return (
        <AppEmptyState
          title="No pages yet"
          description="Create a page to share updates, events, and resources."
          actionLabel={showCreateAction ? 'Create Page' : undefined}
          onAction={showCreateAction ? onCreate : undefined}
        />
    )
  }

  return (
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

        {activePage && mode === 'view' && !error && (!loadingPageId || activePage.id !== loadingPageId) ? (
          <PageContentRenderer
            page={activePage}
            sections={sectionsByPageId[activePage.id] ?? []}
            subgroupItems={subgroups}
            groupPageItems={pages}
            showHeader
            framed={false}
          />
        ) : null}

        {activePage && mode === 'edit' && activeModel && validation && !loadingPageId ? (
          <div className="space-y-4">
            <PageContentRenderer
              page={activeModel}
              sections={activeModel.sections}
              subgroupItems={subgroups}
              groupPageItems={pages}
              editing
              canEdit={canEditAllPages}
              message={message}
              validation={validation}
              contextGroupId={activePage.ownerGroupId ?? activeModel.groupId}
              onSectionsChange={(sections) => updateActiveModel({ ...activeModel, sections })}
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <AppActionButton
                variant="primary"
                disabled={!canEditAllPages || saving || hasValidationErrors}
                onClick={() => saveActivePage().catch(() => undefined)}
              >
                {saving ? 'Saving...' : 'Save Page'}
              </AppActionButton>
            </div>
          </div>
        ) : null}
      </div>
  )
}

export default GroupPageTabs
