import { useEffect, useMemo, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import PageSettingsPanel from '../page-editor/PageSettingsPanel'
import PageContentRenderer, {
  normalizePageSections,
  validatePageContent,
} from '../page/PageContentRenderer'
import { ensureFreshPageDetail } from '../../db/collections/pageCollection'
import { cloudflareImageService } from '../../services/cloudflareImageService'
import { pageService } from '../../services/pageService'
import type { GroupPageDto, GroupSummaryDto } from '../../types/group'
import type { PageEditModel, SectionEditModel } from '../../types/page-editor'
import { localizeText, toLocalizedText } from '../../utils/localizedText'
import { collectMissingPageTranslations } from '../../utils/pageBilingualCompletion'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'

type Props = {
  pages: GroupPageDto[]
  subgroups: GroupSummaryDto[]
  selectedPageId?: string
  mode?: 'view' | 'edit'
  canEditAllPages?: boolean
  onSaved?: () => void
  onCreate: () => void
  showCreateAction?: boolean
  flatSections?: boolean
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

const formatReviewDate = (value: string, language: string) => {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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
  flatSections = false,
}: Props) => {
  const t = useUiText()
  const { language } = useAuthStore()
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
  const validation = activeModel ? validatePageContent(activeModel, language) : undefined
  const hasValidationErrors = validation
    ? Boolean(validation.title) || validation.sectionTypeErrors.some((item) => item.length > 0)
    : false
  const missingTranslationCount = activeModel ? collectMissingPageTranslations(activeModel).length : 0
  const hasLocalImages = activeModel ? cloudflareImageService.sectionsHaveLocalDataImages(activeModel.sections) : false
  const baselineActiveModel = activePage
    ? {
        ...toEditModel(activePage),
        sections: sectionsByPageId[activePage.id] ?? [],
      }
    : null
  const hasUnsavedChanges = Boolean(activeModel && baselineActiveModel && JSON.stringify(activeModel) !== JSON.stringify(baselineActiveModel))
  const localizedSubgroups = useMemo(
    () => subgroups.map((subgroup) => ({ ...subgroup, name: localizeText(subgroup.name, language) })),
    [language, subgroups],
  )
  const activeRefusal = activePage?.reviewRefusal ?? null
  const refusalNotice = activeRefusal ? (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <p className="font-black text-rose-900">{t('pageGlobalReviewRefused')}</p>
      <p className="mt-1 font-semibold">
        {t('pageGlobalReviewRefusalMeta', {
          reviewer: activeRefusal.reviewerDisplayName || t('unknownReviewer'),
          time: formatReviewDate(activeRefusal.refusedUtc, language),
        })}
      </p>
      <p className="mt-2 leading-6">{t('pageGlobalReviewRefusalReason', { reason: activeRefusal.reason })}</p>
    </section>
  ) : null

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

    ensureFreshPageDetail(activePage.id)
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
        setError(t('loadPageSectionsFailed'))
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
        setMessage(t('uploadingLocalImages'))
        sectionsToPersist = await cloudflareImageService.resolveSectionImages(sectionsToPersist, `g-${activeModel.groupId || 'group'}-${pageId}`)
        updateActiveModel({ ...activeModel, sections: normalizePageSections(sectionsToPersist) })
      }

      const savedPage = await pageService.updatePage(pageId, {
        title: activeModel.title,
        description: activeModel.description,
        tagsJson: JSON.stringify(activeModel.tags),
        titleDisplayStyle: activeModel.titleDisplayStyle.trim() || 'Default',
        sections: sectionsToPersist,
      })

      if (activeModel.visibility !== activePage.visibility) {
        await pageService.publishPage(pageId, { visibility: activeModel.visibility })
      }

      const savedSections = normalizePageSections(savedPage.sections)
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
      setMessage(t('pageSaved'))
      onSaved?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('savePageFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (pages.length === 0) {
    const emptyState = (
      <AppEmptyState
        title={t('noPagesYetTitle')}
        description={t('noPagesYetDescription')}
        actionLabel={showCreateAction ? t('createPage') : undefined}
        onAction={showCreateAction ? onCreate : undefined}
      />
    )

    return flatSections ? <section className="mx-auto w-full max-w-6xl">{emptyState}</section> : emptyState
  }

  if (flatSections && mode === 'view') {
    return (
      <>
        {showCreateAction ? (
          <section className="flex justify-end">
            <AppActionButton variant="primary" onClick={onCreate}>
              {t('createPage')}
            </AppActionButton>
          </section>
        ) : null}

        {loadingPageId && activePage?.id === loadingPageId ? (
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{t('loadingPageSections')}</section>
        ) : null}

        {error ? <section className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</section> : null}

        {refusalNotice}

        {activePage && !error && (!loadingPageId || activePage.id !== loadingPageId) ? (
          <PageContentRenderer
            page={activePage}
            sections={sectionsByPageId[activePage.id] ?? []}
            subgroupItems={localizedSubgroups}
            groupPageItems={pages}
            showHeader={false}
            framed={false}
          />
        ) : null}
      </>
    )
  }

  return (
      <div className="space-y-4">
        {showCreateAction ? (
          <div className="flex justify-end">
            <AppActionButton variant="primary" onClick={onCreate}>
              {t('createPage')}
            </AppActionButton>
          </div>
        ) : null}

        {loadingPageId && activePage?.id === loadingPageId ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{t('loadingPageSections')}</p>
        ) : null}

        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        {refusalNotice}

        {activePage && mode === 'view' && !error && (!loadingPageId || activePage.id !== loadingPageId) ? (
          <PageContentRenderer
            page={activePage}
            sections={sectionsByPageId[activePage.id] ?? []}
            subgroupItems={localizedSubgroups}
            groupPageItems={pages}
            showHeader={false}
            framed={false}
          />
        ) : null}

        {activePage && mode === 'edit' && activeModel && validation && !loadingPageId ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <PageContentRenderer
                page={activeModel}
                sections={activeModel.sections}
                subgroupItems={localizedSubgroups}
                groupPageItems={pages}
                editing
                canEdit={canEditAllPages}
                message={message}
                validation={validation}
                contextGroupId={activePage.ownerGroupId ?? activeModel.groupId}
                showHeader={false}
                framed={false}
                onPageChange={updateActiveModel}
                onSectionsChange={(sections) => updateActiveModel({ ...activeModel, sections })}
              />
              <PageSettingsPanel
                model={activeModel}
                canEdit={canEditAllPages}
                canEditVisibility={canEditAllPages}
                message={message}
                publishReadiness={{
                  missingTranslationCount,
                  hasLocalImages,
                  hasUnsavedChanges,
                  hasValidationErrors,
                  canSave: canEditAllPages && !saving && !hasValidationErrors,
                  saving,
                }}
                onSave={() => {
                  saveActivePage().catch(() => undefined)
                }}
                onChange={updateActiveModel}
              />
            </div>
          </div>
        ) : null}
      </div>
  )
}

export default GroupPageTabs
