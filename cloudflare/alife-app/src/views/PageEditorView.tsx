import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageContentRenderer, {
  normalizePageSections,
  validatePageContent,
} from '../components/page/PageContentRenderer'
import PageEditorShell from '../components/page-editor/PageEditorShell'
import { groupService } from '../api/groupService'
import { ensureFreshPageDetail, setPageDetailCache } from '../db/collections/pageCollection'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { activeEntityService } from '../services/activeEntityService'
import { cloudflareImageService } from '../services/cloudflareImageService'
import { aiTranslationService } from '../services/aiTranslationService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import { useUiText } from '../i18n/uiText'
import type { PageDetailDto } from '../types'
import type { PageVisibility } from '../types/group'
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
  const [savedModelSnapshot, setSavedModelSnapshot] = useState('')
  const queryGroupId = normalizeRouteGroupId(searchParams.get('groupId'))

  const activeIds = useActiveEntityIds({
    groupId: routeCreateGroupId || queryGroupId || undefined,
    pageId: editPageIdParam || undefined,
  })
  const createGroupId = routeCreateGroupId || (location.pathname === '/pages/new' ? activeIds.groupId : '')
  const editPageId = editPageIdParam ?? (location.pathname === '/pages/edit' ? activeIds.pageId : '')

  const isCreateMode = Boolean(createGroupId)

  const createInitialModel = (groupId: string): PageEditModel => ({
    groupId,
    title: { en: '', zh: '' },
    description: { en: '', zh: '' },
    tags: [],
    titleDisplayStyle: 'Default',
    visibility: 'draft',
    sections: [],
  })

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
  const currentModelSnapshot = useMemo(() => JSON.stringify(pageModel), [pageModel])
  const hasUnsavedChanges = Boolean(savedModelSnapshot && currentModelSnapshot !== savedModelSnapshot)

  const hasValidationErrors = Boolean(validation.title) || validation.sectionTypeErrors.some((item) => item.length > 0)

  const canSaveDraft = canEditPage && !saving && !hasValidationErrors

  const loadExistingPage = async () => {
    const targetPageId = editPageId
    if (!targetPageId) {
      return
    }

    const pageData = await ensureFreshPageDetail(targetPageId)
    const targetGroupId = pageData.ownerGroupId ?? resolvedGroupId

    if (!pageData || !targetGroupId) {
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

  const persist = async (publish: boolean) => {
    if (!canSaveDraft) {
      return
    }

    if (!resolvedGroupId) {
      setError(t('missingGroupContext'))
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    try {
      const missingTranslationFields = collectMissingPageTranslations(pageModel)
      if (missingTranslationFields.length > 0) {
        if (!window.confirm(t('pageAiBilingualAutofillConfirm', { count: missingTranslationFields.length }))) {
          setMessage(t('bilingualContentIncompleteBlock'))
          return
        }

        setMessage(t('aiAutofilling'))
        const translatedFields = []
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
        return
      }

      let targetPageId = editPageId
      const tagsJson = JSON.stringify(pageModel.tags)
      const title = pageModel.title
      const description = pageModel.description
      const titleDisplayStyle = pageModel.titleDisplayStyle.trim() || 'Default'

      let sectionsToPersist = pageModel.sections
      let savedPage: PageDetailDto | null = null

      const imagePrefix = `g-${resolvedGroupId}-${editPageId || 'new'}`
      if (cloudflareImageService.sectionsHaveLocalDataImages(pageModel.sections)) {
        setMessage(t('uploadingLocalImages'))
        sectionsToPersist = await cloudflareImageService.resolveSectionImages(pageModel.sections, imagePrefix)
        setPageModel((current) => ({ ...current, sections: normalizePageSections(sectionsToPersist) }))
      }

      if (isCreateMode) {
        const created = await groupService.createGroupPage(resolvedGroupId, {
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
          visibility: created.visibility,
          sections: created.sections,
        }))
      } else {
        const updated = await groupService.updatePage(targetPageId, {
          title,
          description,
          tagsJson,
          titleDisplayStyle,
          sections: sectionsToPersist,
        })
        savedPage = updated
        sectionsToPersist = updated.sections
      }

      if (publish && canEditAllPages && targetPageId) {
        const nextVisibility: PageVisibility = pageModel.visibility === 'public' ? 'public' : 'group'
        const publishPayload = {
          visibility: nextVisibility,
          page: { title, description, tagsJson, titleDisplayStyle },
          sections: pageService.toSectionPublishPayload(sectionsToPersist),
        }
        setMessage(t('publishing'))
        try {
          savedPage = await groupService.publishPageOptimized(targetPageId, publishPayload)
        } catch {
          await groupService.publishPage(targetPageId, nextVisibility)
          if (savedPage) {
            savedPage = { ...savedPage, visibility: nextVisibility }
            setPageDetailCache(savedPage)
          }
        }
        const savedModel = {
          ...pageModel,
          id: targetPageId,
          groupId: resolvedGroupId,
          createdByMemberId: savedPage?.createdByMemberId ?? pageModel.createdByMemberId,
          sections: normalizePageSections(savedPage?.sections ?? sectionsToPersist),
          visibility: nextVisibility,
        }
        setPageModel(savedModel)
        setSavedModelSnapshot(JSON.stringify(savedModel))
        setMessage(t('pageSavedPublished'))
      } else if (canEditVisibility && targetPageId && pageModel.visibility === 'draft') {
        await groupService.publishPage(targetPageId, 'draft')
        const savedModel = {
          ...pageModel,
          id: targetPageId,
          groupId: resolvedGroupId,
          createdByMemberId: savedPage?.createdByMemberId ?? pageModel.createdByMemberId,
          sections: normalizePageSections(savedPage?.sections ?? sectionsToPersist),
        }
        if (savedPage) {
          setPageDetailCache(savedPage)
        }
        setPageModel(savedModel)
        setSavedModelSnapshot(JSON.stringify(savedModel))
        setMessage(t('draftSaved'))
      } else {
        const savedModel = {
          ...pageModel,
          id: targetPageId,
          groupId: resolvedGroupId,
          createdByMemberId: savedPage?.createdByMemberId ?? pageModel.createdByMemberId,
          sections: normalizePageSections(savedPage?.sections ?? sectionsToPersist),
        }
        if (savedPage) {
          setPageDetailCache(savedPage)
        }
        setPageModel(savedModel)
        setSavedModelSnapshot(JSON.stringify(savedModel))
        setMessage(t('pageSaved'))
      }

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
    await persist(false)
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
      navigate('/groups')
      return
    }

    navigate('/')
  }, [editPageId, navigate, pageModel.id, resolvedGroupId])

  if (!isCreateMode && !editPageId) {
    return <Navigate to="/" replace />
  }

  const cancel = useCallback(async () => {
    if (hasUnsavedChanges && !window.confirm(t('unsavedExitConfirm'))) {
      return
    }

    leaveEditor()
  }, [hasUnsavedChanges, leaveEditor, t])

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

  return (
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
          onPageChange={setPageModel}
          onSectionsChange={(sections) => setPageModel((current) => ({ ...current, sections }))}
        />
      }
      sidebar={null}
    />
  )
}

export default PageEditorView
