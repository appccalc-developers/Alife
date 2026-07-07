import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageContentRenderer, {
  createPresetPageSection,
  normalizePageSections,
  validatePageContent,
} from '../components/page/PageContentRenderer'
import PageEditorShell from '../components/page-editor/PageEditorShell'
import PageSettingsPanel from '../components/page-editor/PageSettingsPanel'
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
import { applyPageTranslations, collectMissingPageTranslations } from '../utils/pageBilingualCompletion'

const TRANSLATION_BATCH_SIZE = 12

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

const otherLanguage = (language: string): EditorLanguage => language === 'zh' ? 'en' : 'zh'

const createDefaultHomeModel = (base?: Partial<PageEditModel>): PageEditModel => ({
  groupId: '',
  title: { en: 'Home', zh: '首页' },
  description: {
    en: 'Public home page for visitors, seekers, and members.',
    zh: '面向访客、慕道朋友和成员的公共首页。',
  },
  tags: ['home'],
  titleDisplayStyle: 'Default',
  visibility: 'public',
  sections: normalizePageSections([
    createPresetPageSection('hero-home'),
    createPresetPageSection('rich-welcome'),
    createPresetPageSection('spotlight-visit'),
    createPresetPageSection('spotlight-groups'),
    createPresetPageSection('list-events'),
    createPresetPageSection('list-groups'),
    createPresetPageSection('spotlight-sermons'),
  ]),
  ...base,
})

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

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [languageReviewPrompt, setLanguageReviewPrompt] = useState<LanguageReviewPrompt | null>(null)
  const [savedModelSnapshot, setSavedModelSnapshot] = useState('')
  const queryGroupId = normalizeRouteGroupId(searchParams.get('groupId'))
  const isHomeTemplate = (searchParams.get('template') || '').toLowerCase() === 'home'

  const activeIds = useActiveEntityIds({
    groupId: routeCreateGroupId || queryGroupId || undefined,
    pageId: editPageIdParam || undefined,
  })
  const createGroupId = routeCreateGroupId
  const editPageId = editPageIdParam ?? (location.pathname === '/pages/edit' ? activeIds.pageId : '')

  const isCreateMode = Boolean(createGroupId)

  const createInitialModel = (groupId: string): PageEditModel =>
    isHomeTemplate
      ? createDefaultHomeModel({ groupId })
      : {
          groupId,
          title: { en: '', zh: '' },
          description: { en: '', zh: '' },
          tags: [],
          titleDisplayStyle: 'Default',
          visibility: 'draft',
          sections: [],
        }

  const [pageModel, setPageModel] = useState<PageEditModel>(() => createInitialModel(createGroupId))

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
  const hasLocalImages = useMemo(() => cloudflareImageService.sectionsHaveLocalDataImages(pageModel.sections), [pageModel.sections])
  const currentModelSnapshot = useMemo(() => JSON.stringify(pageModel), [pageModel])
  const hasUnsavedChanges = Boolean(savedModelSnapshot && currentModelSnapshot !== savedModelSnapshot)

  const hasValidationErrors = Boolean(validation.title) || validation.sectionTypeErrors.some((item) => item.length > 0)

  const canSaveDraft = canEditPage && !saving && !hasValidationErrors

  const resetDefaultHome = useCallback(() => {
    if (!isHomeTemplate) {
      return
    }

    setPageModel((current) => createDefaultHomeModel({
      id: current.id,
      groupId: resolvedGroupId,
      createdByMemberId: current.createdByMemberId,
    }))
    setMessage(t('defaultHomeRestored'))
  }, [isHomeTemplate, resolvedGroupId, t])

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
        const initialModel = createInitialModel(createGroupId)
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
  }, [auth.initialized, createGroupId, editPageId, queryGroupId])

  const persist = async () => {
    if (!canSaveDraft) {
      return
    }

    if (!resolvedGroupId && !editPageId) {
      setError(t('missingGroupContext'))
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    try {
      let modelToPersist = pageModel
      let translationSaveNotice = ''
      const missingTranslationFields = collectMissingPageTranslations(pageModel)
      if (missingTranslationFields.length > 0) {
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

          const completedModel = applyPageTranslations(pageModel, translatedFields, missingTranslationFields)
          setPageModel(completedModel)
          setMessage(t('pageAiBilingualAutofillComplete', { count: translatedFields.length }))
          setLanguageReviewPrompt({ reason: 'autofill', targetLanguage: otherLanguage(auth.language) })
          return
        } catch (reason) {
          console.warn('AI page translation failed; continuing page save.', reason)
          modelToPersist = translatedFields.length > 0
            ? applyPageTranslations(pageModel, translatedFields, missingTranslationFields)
            : pageModel
          setPageModel(modelToPersist)
          translationSaveNotice = t('pageAiBilingualAutofillFailedSaving')
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
        })
        savedPage = updated
        sectionsToPersist = updated.sections
      }

      let finalVisibility = savedPage?.visibility ?? selectedVisibility
      let visibilityChanged = false
      if (canEditVisibility && targetPageId && selectedVisibility !== finalVisibility) {
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
      setPageModel(savedModel)
      setSavedModelSnapshot(JSON.stringify(savedModel))
      const savedMessage =
        finalVisibility === 'draft'
          ? t('draftSaved')
          : visibilityChanged
            ? t('pageSavedPublished')
            : t('pageSaved')
      setMessage(translationSaveNotice ? `${translationSaveNotice} ${savedMessage}` : savedMessage)
      setLanguageReviewPrompt({ reason: 'save', targetLanguage: otherLanguage(auth.language) })

      if (isCreateMode && targetPageId) {
        activeEntityService.setPage(targetPageId, resolvedGroupId)
        navigate('/pages/edit', { replace: true })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('savePageFailed'))
    } finally {
      setSaving(false)
    }
  }

  const saveDraft = useCallback(async () => {
    await persist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSaveDraft, pageModel, resolvedGroupId, editPageId, isCreateMode, canEditAllPages, canEditVisibility])

  const leaveEditor = useCallback(() => {
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
  }, [editPageId, navigate, pageModel.id, resolvedGroupId])

  const cancel = useCallback(async () => {
    if (hasUnsavedChanges && !window.confirm(t('unsavedExitConfirm'))) {
      return
    }

    leaveEditor()
  }, [hasUnsavedChanges, leaveEditor, t])

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
            onPageChange={setPageModel}
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
