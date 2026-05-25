import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppSectionCard from '../components/layout/AppSectionCard'
import PageContentRenderer, {
  normalizePageSections,
  validatePageContent,
} from '../components/page/PageContentRenderer'
import PageEditorShell from '../components/page-editor/PageEditorShell'
import GroupPagePreview from '../components/page-editor/GroupPagePreview'
import { groupService } from '../api/groupService'
import { cloudflareImageService } from '../services/cloudflareImageService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import type { GroupPageDto, PageVisibility } from '../types/group'
import type { PageEditModel } from '../types/page-editor'

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const parseTags = (tagsJson?: string): string[] => {
  if (!tagsJson) {
    return []
  }

  try {
    const parsed = JSON.parse(tagsJson) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map((item) => String(item)).filter(Boolean)
  } catch {
    return []
  }
}

const mapPageToEditModel = (page: GroupPageDto, groupId: string): PageEditModel => ({
  id: page.id,
  groupId,
  createdByMemberId: page.createdByMemberId,
  slug: page.slug,
  title: page.title,
  description: page.description ?? '',
  tags: parseTags(page.tagsJson),
  titleDisplayStyle: page.titleDisplayStyle ?? 'Default',
  language: page.language,
  visibility: page.visibility,
  sections: [],
})

const PageEditorView = () => {
  const { groupId: createGroupIdParam, pageId: editPageIdParam } = useParams<{ groupId?: string; pageId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const auth = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [savedModelSnapshot, setSavedModelSnapshot] = useState('')

  const createGroupId = createGroupIdParam ?? ''
  const editPageId = editPageIdParam ?? ''
  const queryGroupId = searchParams.get('groupId') ?? ''

  const isCreateMode = Boolean(createGroupId)

  const createInitialModel = (groupId: string): PageEditModel => ({
    groupId,
    slug: '',
    title: '',
    description: '',
    tags: [],
    titleDisplayStyle: 'Default',
    language: auth.language,
    visibility: 'InvisibleDraft',
    sections: [],
  })

  const [pageModel, setPageModel] = useState<PageEditModel>(() => createInitialModel(createGroupId))

  const resolvedGroupId = createGroupId || queryGroupId || pageModel.groupId

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

    return auth.me.id === pageModel.createdByMemberId && pageModel.visibility === 'InvisibleDraft'
  }, [auth.me?.id, pageModel.createdByMemberId, pageModel.visibility])

  const canCreatePage = Boolean(membership?.status === 'Approved' || canEditAllPages)
  const canEditPage = isCreateMode ? canCreatePage : canEditAllPages || isCreatorDraft
  const canEditVisibility = canEditAllPages

  const validation = useMemo(() => validatePageContent(pageModel), [pageModel])
  const currentModelSnapshot = useMemo(() => JSON.stringify(pageModel), [pageModel])
  const hasUnsavedChanges = Boolean(savedModelSnapshot && currentModelSnapshot !== savedModelSnapshot)

  const hasValidationErrors = Boolean(validation.title) || validation.sectionTypeErrors.some((item) => item.length > 0)

  const canSaveDraft = canEditPage && !saving && !hasValidationErrors

  const loadExistingPage = async () => {
    const targetPageId = editPageId
    if (!targetPageId) {
      return
    }

    let targetGroupId = resolvedGroupId
    let pageData: GroupPageDto | null = null

    if (targetGroupId) {
      const pages = await groupService.getGroupPages(targetGroupId, auth.language)
      pageData = pages.find((page) => page.id === targetPageId) ?? null
    }

    if (!pageData) {
      const fallbackPage = await groupService.getPageById(targetPageId, auth.language)
      pageData = fallbackPage
      targetGroupId = fallbackPage.ownerGroupId ?? targetGroupId
    }

    if (!pageData || !targetGroupId) {
      throw new Error('Failed to resolve page/group context for editor.')
    }

    const baseModel = mapPageToEditModel(pageData, targetGroupId)
    const sections = await groupService.getPageSections(targetPageId)

    const editModel = {
      ...baseModel,
      sections: normalizePageSections(sections),
    }

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
          setMessage('You need approved membership to create a page in this group.')
        }
        return
      }

      await loadExistingPage()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load page editor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initialize().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.initialized, createGroupId, editPageId, queryGroupId, auth.language])

  const persist = async (publish: boolean) => {
    if (!canSaveDraft) {
      return
    }

    if (!resolvedGroupId) {
      setError('Missing group context.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    try {
      let targetPageId = editPageId
      const tagsJson = JSON.stringify(pageModel.tags)
      const title = pageModel.title.trim()
      const slug = pageModel.slug.trim() || slugify(pageModel.title)
      const language = pageModel.language.trim() || auth.language
      const description = pageModel.description.trim()
      const titleDisplayStyle = pageModel.titleDisplayStyle.trim() || 'Default'

      let sectionsToPersist = pageModel.sections

      const imagePrefix = `g-${resolvedGroupId}-${editPageId || 'new'}`
      if (cloudflareImageService.sectionsHaveLocalDataImages(pageModel.sections)) {
        setMessage('Uploading local images…')
        sectionsToPersist = await cloudflareImageService.resolveSectionImages(pageModel.sections, imagePrefix)
        setPageModel((current) => ({ ...current, sections: normalizePageSections(sectionsToPersist) }))
      }

      if (isCreateMode) {
        const created = await groupService.createGroupPage(resolvedGroupId, {
          title,
          slug,
          language,
          description,
          tagsJson,
          titleDisplayStyle,
        })

        targetPageId = created.id
        setPageModel((current) => ({
          ...current,
          id: created.id,
          groupId: resolvedGroupId,
          slug: created.slug,
          createdByMemberId: created.createdByMemberId,
          visibility: created.visibility,
        }))

        await groupService.savePageSections(targetPageId, sectionsToPersist)
      } else {
        await groupService.updatePage(targetPageId, {
          title,
          description,
          tagsJson,
          titleDisplayStyle,
        })
        await groupService.savePageSections(targetPageId, sectionsToPersist)
      }

      if (publish && canEditAllPages && targetPageId) {
        const nextVisibility: PageVisibility = pageModel.visibility === 'VisiblePublic' ? 'VisiblePublic' : 'VisibleToGroup'
        const publishPayload = {
          visibility: nextVisibility,
          page: { title, slug, language, description, tagsJson, titleDisplayStyle },
          sections: pageService.toSectionPublishPayload(sectionsToPersist),
        }
        setMessage('Publishing…')
        try {
          await groupService.publishPageOptimized(targetPageId, publishPayload)
        } catch {
          await groupService.publishPage(targetPageId, nextVisibility)
        }
        setPageModel((current) => ({ ...current, visibility: nextVisibility }))
        setSavedModelSnapshot(JSON.stringify({ ...pageModel, sections: normalizePageSections(sectionsToPersist), visibility: nextVisibility }))
        setMessage('Page saved and published.')
      } else if (canEditVisibility && targetPageId && pageModel.visibility === 'InvisibleDraft') {
        await groupService.publishPage(targetPageId, 'InvisibleDraft')
        setSavedModelSnapshot(JSON.stringify({ ...pageModel, sections: normalizePageSections(sectionsToPersist) }))
        setMessage('Draft saved.')
      } else {
        setSavedModelSnapshot(JSON.stringify({ ...pageModel, sections: normalizePageSections(sectionsToPersist) }))
        setMessage('Page saved.')
      }

      if (isCreateMode && targetPageId) {
        navigate(`/pages/${targetPageId}/edit?groupId=${resolvedGroupId}`, { replace: true })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save page.')
    } finally {
      setSaving(false)
    }
  }

  const saveDraft = useCallback(async () => {
    await persist(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSaveDraft, pageModel, resolvedGroupId, editPageId, isCreateMode, canEditAllPages, canEditVisibility, auth.language])

  const leaveEditor = useCallback(() => {
    if (resolvedGroupId) {
      const pageId = editPageId || pageModel.id
      const pageSearch = pageId ? `?page=${encodeURIComponent(pageId)}` : ''
      navigate(`/groups/${resolvedGroupId}${pageSearch}`)
      return
    }

    navigate('/')
  }, [editPageId, navigate, pageModel.id, resolvedGroupId])

  const cancel = useCallback(async () => {
    if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Exit without saving?')) {
      return
    }

    leaveEditor()
  }, [hasUnsavedChanges, leaveEditor])

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
        previewOpen ? (
          <AppSectionCard title="Page Preview" subtitle="Preview current unsaved edits.">
            <div className="mb-3">
              <AppActionButton variant="ghost" onClick={() => setPreviewOpen(false)}>
                Back to Editor
              </AppActionButton>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-100/70 p-2">
              <GroupPagePreview
                title={pageModel.title}
                description={pageModel.description}
                slug={pageModel.slug}
                visibility={pageModel.visibility}
                sections={pageModel.sections}
                previewGroupId={resolvedGroupId}
              />
            </div>
          </AppSectionCard>
        ) : (
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
            onSectionsChange={(sections) => setPageModel((current) => ({ ...current, sections }))}
          />
        )
      }
      sidebar={null}
    />
  )
}

export default PageEditorView
