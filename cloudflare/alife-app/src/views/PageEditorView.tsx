import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileText, Globe2, Languages, Layers3, Save, ShieldCheck } from 'lucide-react'
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
import type { PageEditorValidation, PageEditModel } from '../types/page-editor'
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
    <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 py-5 sm:items-center sm:justify-center">
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

const visibilityLabel = (visibility: PageEditModel['visibility'], isZh: boolean) => {
  if (visibility === 'public') {
    return isZh ? '公开页面' : 'Public page'
  }

  if (visibility === 'group') {
    return isZh ? '小组可见' : 'Group visible'
  }

  return isZh ? '草稿' : 'Draft'
}

const PagePublicationWorkflow = ({
  model,
  validation,
  missingTranslationCount,
  hasUnsavedChanges,
  canEditVisibility,
  language,
}: {
  model: PageEditModel
  validation: PageEditorValidation
  missingTranslationCount: number
  hasUnsavedChanges: boolean
  canEditVisibility: boolean
  language: string
}) => {
  const isZh = language === 'zh'
  const titleReady = Boolean((isZh ? model.title.zh : model.title.en) || model.title.en || model.title.zh)
  const sectionsReady = model.sections.length > 0 && validation.sectionTypeErrors.every((item) => !item)
  const translationsReady = missingTranslationCount === 0
  const visibilityReady = model.visibility !== 'draft'
  const savedReady = Boolean(model.id) && !hasUnsavedChanges
  const items = [
    {
      label: isZh ? '1. 页面基础' : '1. Page basics',
      hint: isZh ? '标题与简介让访客先明白这页服事谁、邀请谁。' : 'Title and summary clarify who this page serves and invites.',
      ready: titleReady && !validation.title,
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: isZh ? '2. 内容区块' : '2. Content sections',
      hint: isZh ? `当前 ${model.sections.length} 个区块，保持信息清楚、行动明确。` : `${model.sections.length} sections in place; keep the message clear and actionable.`,
      ready: sectionsReady,
      icon: <Layers3 className="h-4 w-4" />,
    },
    {
      label: isZh ? '3. 双语复核' : '3. Bilingual review',
      hint: translationsReady
        ? (isZh ? '中英文内容已补齐，可以交给更多会友阅读。' : 'Chinese and English content is complete for wider reading.')
        : (isZh ? `还有 ${missingTranslationCount} 处可由 AI 辅助补齐。` : `${missingTranslationCount} fields can still be completed with AI assistance.`),
      ready: translationsReady,
      icon: <Languages className="h-4 w-4" />,
    },
    {
      label: isZh ? '4. 发布范围' : '4. Visibility',
      hint: canEditVisibility
        ? (isZh ? `当前为：${visibilityLabel(model.visibility, true)}。` : `Current setting: ${visibilityLabel(model.visibility, false)}.`)
        : (isZh ? '发布范围由小组领袖或管理员确认。' : 'Visibility is confirmed by group leaders or admins.'),
      ready: visibilityReady || !canEditVisibility,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      label: isZh ? '5. 保存交付' : '5. Save handoff',
      hint: savedReady
        ? (isZh ? '页面已保存，可以回到管理页继续下一步。' : 'Page is saved and ready for the next management step.')
        : (isZh ? '保存会先处理本地图片、双语补全与发布状态。' : 'Saving handles local images, bilingual completion, and visibility state.'),
      ready: savedReady,
      icon: <Save className="h-4 w-4" />,
    },
  ]
  const readyCount = items.filter((item) => item.ready).length
  const firstPendingIndex = items.findIndex((item) => !item.ready)

  return (
    <section className="overflow-hidden rounded-2xl border border-[#2f4b42]/10 bg-white/82 shadow-[0_14px_36px_rgba(31,56,48,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/70 bg-[#f7f3e9] px-5 py-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">
            {isZh ? '内容发布工作流' : 'Publishing workflow'}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">
            {isZh ? '让页面从草稿走向可服事的人群' : 'Move the page from draft to ministry-ready'}
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-black text-[#176b5a] shadow-sm">
          <Globe2 className="h-4 w-4" />
          {readyCount}/{items.length}
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
        {items.map((item, index) => {
          const isCurrent = index === firstPendingIndex
          return (
            <div
              key={item.label}
              className={[
                'flex min-h-[128px] flex-col gap-3 rounded-xl border p-3 transition',
                item.ready
                  ? 'border-emerald-200 bg-emerald-50/80'
                  : isCurrent
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    item.ready
                      ? 'bg-emerald-100 text-emerald-700'
                      : isCurrent
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500',
                  ].join(' ')}
                >
                  {item.ready ? <CheckCircle2 className="h-4 w-4" /> : item.icon}
                </span>
                <span
                  className={[
                    'rounded-full px-2 py-1 text-[11px] font-black',
                    item.ready
                      ? 'bg-white/80 text-emerald-700'
                      : isCurrent
                        ? 'bg-white text-amber-700'
                        : 'bg-slate-100 text-slate-500',
                  ].join(' ')}
                >
                  {item.ready ? (isZh ? '已完成' : 'Done') : isCurrent ? (isZh ? '下一步' : 'Next') : (isZh ? '待处理' : 'Pending')}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-950">{item.label}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.hint}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
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
  const isGlobalCreateMode = location.pathname === '/pages/new' && ['home', 'global'].includes((searchParams.get('scope') || '').toLowerCase())
  const isGlobalEditorMode = isGlobalCreateMode || (location.pathname === '/pages/edit' && ['home', 'global'].includes((searchParams.get('scope') || '').toLowerCase()))

  const activeIds = useActiveEntityIds({
    groupId: routeCreateGroupId || queryGroupId || undefined,
    pageId: editPageIdParam || undefined,
  })
  const createGroupId = isGlobalCreateMode ? '' : routeCreateGroupId || (location.pathname === '/pages/new' ? activeIds.groupId : '')
  const editPageId = editPageIdParam ?? (location.pathname === '/pages/edit' ? activeIds.pageId : '')

  const isCreateMode = isGlobalCreateMode || Boolean(createGroupId)

  const createInitialModel = (groupId: string): PageEditModel =>
    isGlobalCreateMode
      ? createDefaultHomeModel()
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

  const resolvedGroupId = isGlobalEditorMode ? '' : createGroupId || queryGroupId || activeIds.groupId || pageModel.groupId

  const membership = useMemo(
    () => auth.memberships.find((item) => item.groupId === resolvedGroupId),
    [auth.memberships, resolvedGroupId],
  )

  const canEditAllPages = useMemo(() => {
    if (!resolvedGroupId) {
      return auth.isAdmin
    }

    return auth.hasLeaderAccess(resolvedGroupId)
  }, [auth, resolvedGroupId])

  const isCreatorDraft = useMemo(() => {
    if (!pageModel.createdByMemberId || !auth.me?.id) {
      return false
    }

    return auth.me.id === pageModel.createdByMemberId && pageModel.visibility === 'draft'
  }, [auth.me?.id, pageModel.createdByMemberId, pageModel.visibility])

  const canCreatePage = isGlobalCreateMode ? auth.isAdmin : Boolean(membership?.status === 'approved' || canEditAllPages)
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
    if (!isGlobalEditorMode) {
      return
    }

    setPageModel((current) => createDefaultHomeModel({
      id: current.id,
      createdByMemberId: current.createdByMemberId,
    }))
    setMessage(t('defaultHomeRestored'))
  }, [isGlobalEditorMode, t])

  const loadExistingPage = async () => {
    const targetPageId = editPageId
    if (!targetPageId) {
      return
    }

    const pageData = await ensureFreshPageDetail(targetPageId)
    const targetGroupId = pageData.ownerGroupId ?? ''

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

    if (!resolvedGroupId && !isGlobalCreateMode && !editPageId) {
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
              scope: resolvedGroupId ? 'group' : 'church',
              groupId: resolvedGroupId || undefined,
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

      const imagePrefix = `${resolvedGroupId ? `g-${resolvedGroupId}` : 'global'}-${editPageId || 'new'}`
      if (cloudflareImageService.sectionsHaveLocalDataImages(modelToPersist.sections)) {
        setMessage(t('uploadingLocalImages'))
        sectionsToPersist = await cloudflareImageService.resolveSectionImages(modelToPersist.sections, imagePrefix)
        setPageModel((current) => ({ ...current, sections: normalizePageSections(sectionsToPersist) }))
      }

      if (isCreateMode) {
        const created = isGlobalCreateMode
          ? await pageService.createGlobalPage({
              title,
              description,
              tagsJson,
              titleDisplayStyle,
              sections: sectionsToPersist,
            })
          : await pageService.createGroupPage(resolvedGroupId, {
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
            ownerGroupId: publishedPage.ownerGroupId ?? savedPage.ownerGroupId,
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
        activeEntityService.setPage(targetPageId, resolvedGroupId || undefined)
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
        activeEntityService.setPage(pageId, resolvedGroupId || undefined)
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

  useEffect(() => {
    const saveHandler = () => {
      saveDraft().catch(() => undefined)
    }
    const exitHandler = () => {
      cancel().catch(() => undefined)
    }

    window.addEventListener('alife-page-editor-save', saveHandler)
    window.addEventListener('alife-page-editor-exit', exitHandler)

    return () => {
      window.removeEventListener('alife-page-editor-save', saveHandler)
      window.removeEventListener('alife-page-editor-exit', exitHandler)
    }
  }, [cancel, saveDraft])

  if (!isCreateMode && !editPageId) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <PageEditorShell
        loading={loading}
        error={error}
        main={
          <>
            <PagePublicationWorkflow
              model={pageModel}
              validation={validation}
              missingTranslationCount={missingTranslationCount}
              hasUnsavedChanges={hasUnsavedChanges}
              canEditVisibility={canEditVisibility}
              language={auth.language}
            />
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
          </>
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
            onResetDefaultHome={isGlobalEditorMode && canEditPage ? resetDefaultHome : undefined}
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
