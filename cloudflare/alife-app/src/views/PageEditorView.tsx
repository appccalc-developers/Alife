import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageContentRenderer, {
  normalizePageSections,
  validatePageContent,
} from '../components/page/PageContentRenderer'
import PageEditorShell from '../components/page-editor/PageEditorShell'
import PagePresetPicker from '../components/page-editor/PagePresetPicker'
import PageSettingsPanel from '../components/page-editor/PageSettingsPanel'
import { createPagePresetModel, isPagePresetId, type PagePresetId } from '../components/page/pagePresets'
import { ensureFreshPageDetail, setPageDetailCache } from '../db/collections/pageCollection'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { activeEntityService } from '../services/activeEntityService'
import { cloudflareImageService } from '../services/cloudflareImageService'
import { aiTranslationService } from '../services/aiTranslationService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import { useUiText } from '../i18n/uiText'
import type { PageDetailDto } from '../types'
import type { PageEditModel } from '../types/page-editor'
import { normalizeRouteGroupId } from '../utils/groupRouteIds'
import { toLocalizedText } from '../utils/localizedText'
import {
  applyPageTranslations,
  collectMissingPageTranslations,
  collectPageLanguageQualityIssues,
  collectPageI18nStructureIssues,
  normalizePageI18nStructure,
  preparePageForLanguageQualityTranslations,
} from '../utils/pageBilingualCompletion'
import { confirmUnsavedChangesNavigation, setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

const TRANSLATION_BATCH_SIZE = 12
const SECTION_AUTO_SAVE_DELAY_MS = 1200

const chunkFields = <T,>(fields: T[], size: number) => {
  const chunks: T[][] = []
  for (let index = 0; index < fields.length; index += size) {
    chunks.push(fields.slice(index, index + size))
  }
  return chunks
}

const mapPageToEditModel = (page: PageDetailDto, groupId: string): PageEditModel => ({
  id: page.id,
  groupId,
  createdByMemberId: page.createdByMemberId,
  title: toLocalizedText(page.title),
  description: toLocalizedText(page.description),
  tags: page.tags,
  titleDisplayStyle: page.titleDisplayStyle ?? 'Default',
  visibility: page.visibility,
  sections: normalizePageSections(page.sections ?? []),
})

type EditorLanguage = 'en' | 'zh'
type LanguageReviewPrompt = {
  reason: 'autofill' | 'save'
  targetLanguage: EditorLanguage
}
type SaveTrigger = 'manual' | 'section-auto-save'

const otherLanguage = (language: string): EditorLanguage => language === 'zh' ? 'en' : 'zh'

const PageLanguageReviewModal = ({
  prompt,
  onStay,
  onSwitch,
}: {
  prompt: LanguageReviewPrompt
  onStay: () => void
  onSwitch: (language: EditorLanguage) => void
}) => {
  const t = useUiText()
  const targetLanguageLabel = t(prompt.targetLanguage === 'zh' ? 'chinese' : 'english')

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:pb-4">
      <button type="button" className="absolute inset-0" aria-label={t('cancel')} onClick={onStay} />
      <section className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-950">{t('reviewOtherLanguageTitle')}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {t(prompt.reason === 'autofill' ? 'reviewOtherLanguageAfterAutofill' : 'reviewOtherLanguageAfterSave', {
            language: targetLanguageLabel,
          })}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onStay}
          >
            {t('stayInCurrentLanguage')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500"
            onClick={() => onSwitch(prompt.targetLanguage)}
          >
            {t('switchToLanguage', { language: targetLanguageLabel })}
          </button>
        </div>
      </section>
    </div>
  )
}

const PageEditorView = () => {
  const { groupId: createGroupIdParam, pageId: editPageIdParam } = useParams<{ groupId?: string; pageId?: string }>()
  const routeCreateGroupId = normalizeRouteGroupId(createGroupIdParam)
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuthStore()
  const t = useUiText()
  const browserBackGuardRegistered = useRef(false)
  const browserBackAllowed = useRef(false)
  const persistInFlight = useRef(false)
  const sectionAutoSaveTimer = useRef<number | null>(null)
  const lastSectionAutoSaveAttempt = useRef('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [languageReviewPrompt, setLanguageReviewPrompt] = useState<LanguageReviewPrompt | null>(null)
  const [savedModelSnapshot, setSavedModelSnapshot] = useState('')
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [activeSectionFocusToken, setActiveSectionFocusToken] = useState(0)
  const [languageFixingSectionIndex, setLanguageFixingSectionIndex] = useState<number | null>(null)
  const queryGroupId = normalizeRouteGroupId(searchParams.get('groupId'))
  const requestedPreset = searchParams.get('preset') ?? ((searchParams.get('template') || '').toLowerCase() === 'home' ? 'home' : null)
  const selectedPreset: PagePresetId | null = isPagePresetId(requestedPreset) ? requestedPreset : null
  const isHomeTemplate = selectedPreset === 'home'
  const preservePublicationReviewStatus = searchParams.get('preservePublicationReviewStatus') === 'true'
  const fromPageReview = searchParams.get('fromReview') === 'true'
  const reviewStatusParam = searchParams.get('reviewStatus')
  const reviewReturnPath =
    reviewStatusParam === 'pending' || reviewStatusParam === 'approved' || reviewStatusParam === 'returned'
      ? `/admin/page-review?status=${reviewStatusParam}`
      : '/admin/page-review'

  const activeIds = useActiveEntityIds({
    groupId: routeCreateGroupId || queryGroupId || undefined,
    pageId: editPageIdParam || undefined,
  })
  const createGroupId = routeCreateGroupId
  const editPageId = editPageIdParam ?? (location.pathname === '/pages/edit' ? activeIds.pageId : '')

  const isCreateMode = Boolean(createGroupId)

  const createInitialModel = (groupId: string): PageEditModel =>
    createPagePresetModel(selectedPreset ?? 'blank', groupId)

  const [pageModel, setPageModel] = useState<PageEditModel>(() => normalizePageI18nStructure(createInitialModel(createGroupId)))
  const pageModelRef = useRef(pageModel)

  useEffect(() => {
    pageModelRef.current = pageModel
  }, [pageModel])

  const resolvedGroupId = createGroupId || queryGroupId || activeIds.groupId || pageModel.groupId

  const membership = useMemo(
    () => auth.memberships.find((item) => item.groupId === resolvedGroupId),
    [auth.memberships, resolvedGroupId],
  )

  const canEditAllPages = useMemo(() => {
    if (!resolvedGroupId) {
      return false
    }

    return auth.hasLeaderAccess(resolvedGroupId)
  }, [auth, resolvedGroupId])

  const isCreatorDraft = useMemo(() => {
    if (!pageModel.createdByMemberId || !auth.me?.id) {
      return false
    }

    return auth.me.id === pageModel.createdByMemberId && pageModel.visibility === 'draft'
  }, [auth.me?.id, pageModel.createdByMemberId, pageModel.visibility])
  const canCreatePage = Boolean(membership?.status === 'approved' || canEditAllPages)
  const canEditPage = isCreateMode ? canCreatePage : canEditAllPages || isCreatorDraft
  const canEditVisibility = canEditAllPages

  const validation = useMemo(() => validatePageContent(pageModel, auth.language), [auth.language, pageModel])
  const missingTranslationCount = useMemo(() => collectMissingPageTranslations(pageModel).length, [pageModel])
  const languageQualityIssues = useMemo(() => collectPageLanguageQualityIssues(pageModel), [pageModel])
  const sectionLanguageIssueCounts = useMemo(
    () => languageQualityIssues.reduce<Record<number, number>>((counts, issue) => {
      if (issue.sectionIndex === undefined) {
        return counts
      }

      counts[issue.sectionIndex] = (counts[issue.sectionIndex] ?? 0) + 1
      return counts
    }, {}),
    [languageQualityIssues],
  )
  const hasLocalImages = useMemo(() => cloudflareImageService.sectionsHaveLocalDataImages(pageModel.sections), [pageModel.sections])
  const currentModelSnapshot = useMemo(() => JSON.stringify(pageModel), [pageModel])
  const hasUnsavedChanges = Boolean(savedModelSnapshot && currentModelSnapshot !== savedModelSnapshot)
  const currentSectionsSnapshot = useMemo(() => JSON.stringify(pageModel.sections), [pageModel.sections])
  const savedSectionsSnapshot = useMemo(() => {
    if (!savedModelSnapshot) {
      return ''
    }

    try {
      return JSON.stringify((JSON.parse(savedModelSnapshot) as PageEditModel).sections)
    } catch {
      return ''
    }
  }, [savedModelSnapshot])

  const hasValidationErrors = Boolean(validation.title) || validation.sectionTypeErrors.some((item) => item.length > 0)

  const canSaveDraft = canEditPage && !saving && !hasValidationErrors

  const resetDefaultHome = useCallback(() => {
    if (!isHomeTemplate) {
      return
    }

    setPageModel((current) => normalizePageI18nStructure({
      ...createPagePresetModel('home', resolvedGroupId),
      id: current.id,
      createdByMemberId: current.createdByMemberId,
    }))
    setMessage(t('defaultHomeRestored'))
  }, [isHomeTemplate, resolvedGroupId, t])

  const focusFirstI18nStructureIssue = useCallback((model: PageEditModel) => {
    const issues = collectPageI18nStructureIssues(model)
    if (issues.length === 0) {
      return
    }

    const sectionIssue = issues.find((issue) => issue.sectionIndex !== undefined)
    if (sectionIssue?.sectionIndex !== undefined) {
      setActiveSectionIndex(sectionIssue.sectionIndex)
      setActiveSectionFocusToken((current) => current + 1)
      setMessage(t('pageI18nStructureIssueLocated', {
        count: issues.length,
        section: sectionIssue.sectionIndex + 1,
      }))
      return
    }

    setMessage(t('pageI18nStructurePageIssue', { count: issues.length }))
  }, [t])

  const loadExistingPage = async () => {
    const targetPageId = editPageId
    if (!targetPageId) {
      return
    }

    const pageData = await ensureFreshPageDetail(targetPageId)
    const targetGroupId = pageData.ownerGroupId

    if (!pageData) {
      throw new Error(t('loadEditorFailed'))
    }

    const editModel = mapPageToEditModel(pageData, targetGroupId)

    setPageModel(editModel)
    setSavedModelSnapshot(JSON.stringify(editModel))
    focusFirstI18nStructureIssue(editModel)
  }

  const initialize = async () => {
    if (!auth.initialized) {
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (isCreateMode) {
        const initialModel = normalizePageI18nStructure(createInitialModel(createGroupId))
        setPageModel(initialModel)
        setSavedModelSnapshot(JSON.stringify(initialModel))
        if (!canCreatePage) {
          setMessage(t('needApprovedMembershipForPage'))
        }
        return
      }

      await loadExistingPage()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('loadEditorFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initialize().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.initialized, createGroupId, editPageId, queryGroupId, selectedPreset])

  useEffect(() => {
    setUnsavedChangesGuard(hasUnsavedChanges, t('unsavedExitConfirm'), 'confirm')
    return () => setUnsavedChangesGuard(false)
  }, [hasUnsavedChanges, t])

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      browserBackGuardRegistered.current = false
      browserBackAllowed.current = false
      return
    }

    if (!browserBackGuardRegistered.current) {
      window.history.pushState({ alifeUnsavedPageEditorGuard: true }, '', window.location.href)
      browserBackGuardRegistered.current = true
    }

    const handlePopState = () => {
      if (browserBackAllowed.current) {
        browserBackAllowed.current = false
        return
      }

      const continueNavigation = () => {
        browserBackAllowed.current = true
        setUnsavedChangesGuard(false)
        window.history.back()
      }

      if (confirmUnsavedChangesNavigation(undefined, continueNavigation)) {
        continueNavigation()
        return
      }

      window.history.pushState({ alifeUnsavedPageEditorGuard: true }, '', window.location.href)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [hasUnsavedChanges, t])

  const persist = async (trigger: SaveTrigger) => {
    const isManualSave = trigger === 'manual'
    const canPersist = canEditPage && !hasValidationErrors

    if ((isManualSave && !canSaveDraft) || (!isManualSave && (!canPersist || isCreateMode || !editPageId))) {
      return
    }

    if (persistInFlight.current) {
      return
    }

    if (!resolvedGroupId && !editPageId) {
      setError(t('missingGroupContext'))
      return
    }

    const requestedModel = pageModelRef.current
    const requestedModelSnapshot = JSON.stringify(requestedModel)
    persistInFlight.current = true
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const structureIssueCount = collectPageI18nStructureIssues(requestedModel).length
      let modelToPersist = normalizePageI18nStructure(requestedModel)
      let translationSaveNotice = ''

      if (structureIssueCount > 0) {
        setPageModel(modelToPersist)
        translationSaveNotice = t('pageI18nStructureNormalizedOnSave', { count: structureIssueCount })
      }

      const missingTranslationFields = collectMissingPageTranslations(modelToPersist)
      if (isManualSave && missingTranslationFields.length > 0) {
        if (!window.confirm(t('pageAiBilingualAutofillConfirm', { count: missingTranslationFields.length }))) {
          setMessage(t('bilingualContentIncompleteBlock'))
          return
        }

        setMessage(t('aiAutofilling'))
        const translatedFields = []
        try {
          for (const fields of chunkFields(missingTranslationFields, TRANSLATION_BATCH_SIZE)) {
            const translatedBatch = await aiTranslationService.translateTextFields({
              scope: 'group',
              groupId: resolvedGroupId,
              fields,
            })
            translatedFields.push(...translatedBatch)
          }

          const completedModel = normalizePageI18nStructure(applyPageTranslations(modelToPersist, translatedFields, missingTranslationFields))
          setPageModel(completedModel)
          setMessage(t('pageAiBilingualAutofillComplete', { count: translatedFields.length }))
          setLanguageReviewPrompt({ reason: 'autofill', targetLanguage: otherLanguage(auth.language) })
          return
        } catch (reason) {
          console.warn('AI page translation failed; continuing page save.', reason)
          modelToPersist = translatedFields.length > 0
            ? normalizePageI18nStructure(applyPageTranslations(modelToPersist, translatedFields, missingTranslationFields))
            : modelToPersist
          setPageModel(modelToPersist)
          translationSaveNotice = `${translationSaveNotice} ${t('pageAiBilingualAutofillFailedSaving')}`.trim()
          setMessage(translationSaveNotice)
        }
      }

      let targetPageId = editPageId
      const tagsJson = JSON.stringify(modelToPersist.tags)
      const title = modelToPersist.title
      const description = modelToPersist.description
      const titleDisplayStyle = modelToPersist.titleDisplayStyle.trim() || 'Default'
      const selectedVisibility = modelToPersist.visibility

      let sectionsToPersist = modelToPersist.sections
      let savedPage: PageDetailDto | null = null

      const imagePrefix = `g-${resolvedGroupId}-${editPageId || 'new'}`
      if (cloudflareImageService.sectionsHaveLocalDataImages(modelToPersist.sections)) {
        setMessage(t('uploadingLocalImages'))
        sectionsToPersist = await cloudflareImageService.resolveSectionImages(modelToPersist.sections, imagePrefix)
        setPageModel((current) => ({ ...current, sections: normalizePageSections(sectionsToPersist) }))
      }

      if (isCreateMode) {
        const created = await pageService.createGroupPage(resolvedGroupId, {
          title,
          description,
          tagsJson,
          titleDisplayStyle,
          sections: sectionsToPersist,
        })

        targetPageId = created.id
        savedPage = created
        sectionsToPersist = created.sections
        setPageModel((current) => ({
          ...current,
          id: created.id,
          groupId: resolvedGroupId,
          createdByMemberId: created.createdByMemberId,
          visibility: selectedVisibility,
          sections: created.sections,
        }))
      } else {
        const updated = await pageService.updatePage(targetPageId, {
          title,
          description,
          tagsJson,
          titleDisplayStyle,
          sections: sectionsToPersist,
          preservePublicationReviewStatus,
        })
        savedPage = updated
        sectionsToPersist = updated.sections
      }

      let finalVisibility = savedPage?.visibility ?? selectedVisibility
      let visibilityChanged = false
      if (isManualSave && canEditVisibility && targetPageId && selectedVisibility !== finalVisibility) {
        setMessage(t('publishing'))
        const publishedPage = await pageService.publishPage(targetPageId, { visibility: selectedVisibility })
        finalVisibility = publishedPage.visibility
        visibilityChanged = true
        if (savedPage) {
          savedPage = {
            ...savedPage,
            visibility: finalVisibility,
            title: publishedPage.title ?? savedPage.title,
            description: publishedPage.description ?? savedPage.description,
            titleDisplayStyle: publishedPage.titleDisplayStyle ?? savedPage.titleDisplayStyle,
            ownerGroupId: publishedPage.ownerGroupId,
          }
        }
      }

      const savedModel = {
        ...modelToPersist,
        id: targetPageId,
        groupId: resolvedGroupId,
        createdByMemberId: savedPage?.createdByMemberId ?? modelToPersist.createdByMemberId,
        sections: normalizePageSections(savedPage?.sections ?? sectionsToPersist),
        visibility: finalVisibility,
      }
      if (savedPage) {
        setPageDetailCache(savedPage)
      }
      setPageModel((current) => {
        if (JSON.stringify(current) === requestedModelSnapshot) {
          return isManualSave
            ? savedModel
            : { ...savedModel, visibility: requestedModel.visibility }
        }

        return {
          ...current,
          id: savedModel.id,
          groupId: savedModel.groupId,
          createdByMemberId: savedModel.createdByMemberId,
          sections: current.sections.map((section, index) => {
            if (section.id || !savedModel.sections[index]?.id) {
              return section
            }

            return { ...section, id: savedModel.sections[index].id }
          }),
        }
      })
      setSavedModelSnapshot(JSON.stringify(savedModel))
      const savedMessage =
        finalVisibility === 'draft'
          ? t('draftSaved')
          : visibilityChanged
            ? t('pageSavedPublished')
            : t('pageSaved')
      setMessage(
        isManualSave
          ? (translationSaveNotice ? `${translationSaveNotice} ${savedMessage}` : savedMessage)
          : t('pageAutoSaved'),
      )
      if (isManualSave) {
        setLanguageReviewPrompt({ reason: 'save', targetLanguage: otherLanguage(auth.language) })
      }

      if (isCreateMode && targetPageId) {
        activeEntityService.setPage(targetPageId, resolvedGroupId)
        navigate('/pages/edit', { replace: true })
      }
    } catch (reason) {
      if (isManualSave) {
        setError(reason instanceof Error ? reason.message : t('savePageFailed'))
      } else {
        console.warn('Automatic page section save failed.', reason)
        setMessage(t('pageAutoSaveFailed'))
      }
    } finally {
      persistInFlight.current = false
      setSaving(false)
    }
  }

  const saveDraft = useCallback(async () => {
    await persist('manual')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSaveDraft, pageModel, resolvedGroupId, editPageId, isCreateMode, canEditAllPages, canEditVisibility, preservePublicationReviewStatus])

  useEffect(() => {
    const autoSaveAttemptKey = `${editPageId}:${currentSectionsSnapshot}`

    if (sectionAutoSaveTimer.current !== null) {
      window.clearTimeout(sectionAutoSaveTimer.current)
      sectionAutoSaveTimer.current = null
    }

    if (
      loading ||
      saving ||
      isCreateMode ||
      !editPageId ||
      !canEditPage ||
      hasValidationErrors ||
      !savedSectionsSnapshot ||
      currentSectionsSnapshot === savedSectionsSnapshot ||
      autoSaveAttemptKey === lastSectionAutoSaveAttempt.current
    ) {
      return
    }

    sectionAutoSaveTimer.current = window.setTimeout(() => {
      sectionAutoSaveTimer.current = null
      lastSectionAutoSaveAttempt.current = autoSaveAttemptKey
      persist('section-auto-save').catch(() => undefined)
    }, SECTION_AUTO_SAVE_DELAY_MS)

    return () => {
      if (sectionAutoSaveTimer.current !== null) {
        window.clearTimeout(sectionAutoSaveTimer.current)
        sectionAutoSaveTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canEditPage,
    currentSectionsSnapshot,
    editPageId,
    hasValidationErrors,
    isCreateMode,
    loading,
    savedSectionsSnapshot,
    saving,
  ])

  const fixSectionLanguageIssues = useCallback(async (sectionIndex: number) => {
    const normalizedModel = normalizePageI18nStructure(pageModel)
    const issues = collectPageLanguageQualityIssues(normalizedModel)
      .filter((issue) => issue.sectionIndex === sectionIndex)

    if (issues.length === 0) {
      setMessage(t('sectionLanguageIssuesAlreadyClear'))
      return
    }

    if (!window.confirm(t('aiFixSectionLanguageIssuesConfirm', { count: issues.length }))) {
      return
    }

    setLanguageFixingSectionIndex(sectionIndex)
    setMessage(t('aiFixingSectionLanguageIssues'))
    setError('')

    try {
      const preparedModel = preparePageForLanguageQualityTranslations(normalizedModel, issues)
      setPageModel(preparedModel)

      const translatedFields: Array<{ field: string; language: EditorLanguage; text: string }> = []
      for (const fields of chunkFields(issues, TRANSLATION_BATCH_SIZE)) {
        const translatedBatch = await aiTranslationService.translateTextFields({
          scope: 'group',
          groupId: resolvedGroupId,
          fields,
        })
        translatedFields.push(...translatedBatch)
      }

      const completedModel = normalizePageI18nStructure(applyPageTranslations(preparedModel, translatedFields, issues))
      setPageModel(completedModel)
      setMessage(t('aiFixSectionLanguageIssuesComplete', { count: translatedFields.length }))
    } catch (reason) {
      console.warn('AI section language fix failed.', reason)
      setError(t('aiFixSectionLanguageIssuesFailed'))
    } finally {
      setLanguageFixingSectionIndex(null)
    }
  }, [pageModel, resolvedGroupId, t])

  const leaveEditor = useCallback(() => {
    if (fromPageReview) {
      const pageId = editPageId || pageModel.id
      if (pageId) {
        activeEntityService.setPage(pageId, resolvedGroupId)
      }
      navigate(reviewReturnPath)
      return
    }

    if (resolvedGroupId) {
      const pageId = editPageId || pageModel.id
      if (pageId) {
        activeEntityService.setPage(pageId, resolvedGroupId)
      } else {
        activeEntityService.setGroup(resolvedGroupId)
      }
      navigate(resolvedGroupId ? '/groups' : '/')
      return
    }

    navigate('/')
  }, [editPageId, fromPageReview, navigate, pageModel.id, resolvedGroupId, reviewReturnPath])

  const cancel = useCallback(async () => {
    if (!hasUnsavedChanges) {
      leaveEditor()
      return
    }

    if (confirmUnsavedChangesNavigation(undefined, leaveEditor)) {
      leaveEditor()
    }
  }, [hasUnsavedChanges, leaveEditor])

  const closeLanguageReviewPrompt = useCallback(() => {
    setLanguageReviewPrompt(null)
  }, [])

  const switchLanguageForReview = useCallback(async (language: EditorLanguage) => {
    setLanguageReviewPrompt(null)
    await auth.updateLanguage(language)
  }, [auth])

  if (!isCreateMode && !editPageId) {
    return <Navigate to="/" replace />
  }

  if (isCreateMode && auth.initialized && !selectedPreset) {
    return (
      <PagePresetPicker
        onSelect={(preset) => {
          const nextSearchParams = new URLSearchParams(searchParams)
          nextSearchParams.delete('template')
          nextSearchParams.set('preset', preset)
          navigate({ pathname: location.pathname, search: nextSearchParams.toString() }, { replace: true })
        }}
      />
    )
  }

  return (
    <>
      <PageEditorShell
        loading={loading}
        error={error}
        main={
          <PageContentRenderer
            page={pageModel}
            sections={pageModel.sections}
            subgroupItems={[]}
            groupPageItems={[]}
            editing
            canEdit={canEditPage}
            message={message}
            validation={validation}
            contextGroupId={resolvedGroupId}
            showHeader={false}
            framed={false}
            activeSectionIndex={activeSectionIndex}
            activeSectionFocusToken={activeSectionFocusToken}
            sectionLanguageIssueCounts={sectionLanguageIssueCounts}
            languageFixingSectionIndex={languageFixingSectionIndex}
            onPageChange={setPageModel}
            onActiveSectionIndexChange={setActiveSectionIndex}
            onFixSectionLanguageIssues={(index) => {
              fixSectionLanguageIssues(index).catch(() => undefined)
            }}
            onSectionsChange={(sections) => setPageModel((current) => ({ ...current, sections }))}
          />
        }
        sidebar={
          <PageSettingsPanel
            model={pageModel}
            canEdit={canEditPage}
            canEditVisibility={canEditVisibility}
            message={message}
            publishReadiness={{
              missingTranslationCount,
              hasLocalImages,
              hasUnsavedChanges,
              hasValidationErrors,
              canSave: canSaveDraft,
              saving,
            }}
            onSave={() => {
              saveDraft().catch(() => undefined)
            }}
            onExit={() => {
              cancel().catch(() => undefined)
            }}
            onChange={setPageModel}
            onResetDefaultHome={isHomeTemplate && canEditPage ? resetDefaultHome : undefined}
          />
        }
      />
      {languageReviewPrompt ? (
        <PageLanguageReviewModal
          prompt={languageReviewPrompt}
          onStay={closeLanguageReviewPrompt}
          onSwitch={(language) => {
            switchLanguageForReview(language).catch(() => undefined)
          }}
        />
      ) : null}
    </>
  )
}

export default PageEditorView
