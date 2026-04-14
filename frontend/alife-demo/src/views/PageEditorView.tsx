import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import PageEditorShell from '../components/page-editor/PageEditorShell'
import PageMetaForm from '../components/page-editor/PageMetaForm'
import PageSettingsPanel from '../components/page-editor/PageSettingsPanel'
import SectionListEditor from '../components/page-editor/SectionListEditor'
import { groupService } from '../api/groupService'
import { useAuthStore } from '../stores/auth'
import type { GroupPageDto, PageVisibility } from '../types/group'
import type { PageEditModel, PageEditorValidation, SectionEditModel } from '../types/page-editor'

const createEmptySection = (): SectionEditModel => ({
  order: 0,
  type: 'RichText',
  contentJson: { text: '' },
  styleJson: {},
})

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

const normalizeSort = (sections: SectionEditModel[]) =>
  sections.map((section, index) => ({
    ...section,
    order: index,
  }))

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
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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
  const editorTitle = isCreateMode ? 'Create Group Page' : 'Edit Group Page'

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
  const canPublish = canEditAllPages && !isCreateMode
  const canDelete = !isCreateMode && (canEditAllPages || isCreatorDraft)
  const canEditVisibility = canEditAllPages

  const visibilityVariant = useMemo(() => {
    if (pageModel.visibility === 'VisiblePublic') {
      return 'success' as const
    }
    if (pageModel.visibility === 'VisibleToGroup') {
      return 'info' as const
    }
    return 'warning' as const
  }, [pageModel.visibility])

  const validation = useMemo<PageEditorValidation>(() => {
    const title = pageModel.title.trim()
    const sectionTypeErrors = pageModel.sections.map((section) => (section.type ? '' : 'Section type is required.'))

    return {
      title: title ? undefined : 'Page title is required.',
      sectionTypeErrors,
    }
  }, [pageModel.sections, pageModel.title])

  const hasValidationErrors = Boolean(validation.title) || validation.sectionTypeErrors.some((item) => item.length > 0)

  const canSaveDraft = canEditPage && !saving && !hasValidationErrors

  const saveSectionsWithFallback = async (targetPageId: string) => {
    await groupService.savePageSections(targetPageId, pageModel.sections)
  }

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

    setPageModel({
      ...baseModel,
      sections: normalizeSort(sections),
    })
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
        setPageModel(createInitialModel(createGroupId))
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

  const applyVisibility = async (targetPageId: string, visibility: PageVisibility) => {
    await groupService.publishPage(targetPageId, visibility)
  }

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

      if (isCreateMode) {
        const slug = pageModel.slug.trim() || slugify(pageModel.title)
        const created = await groupService.createGroupPage(resolvedGroupId, {
          title: pageModel.title.trim(),
          slug,
          language: pageModel.language.trim() || auth.language,
          description: pageModel.description.trim(),
          tagsJson,
          titleDisplayStyle: pageModel.titleDisplayStyle.trim() || 'Default',
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

        await saveSectionsWithFallback(targetPageId)
      } else {
        await groupService.updatePage(targetPageId, {
          title: pageModel.title.trim(),
          description: pageModel.description.trim(),
          tagsJson,
          titleDisplayStyle: pageModel.titleDisplayStyle.trim() || 'Default',
        })
        await saveSectionsWithFallback(targetPageId)
      }

      if (publish && canEditAllPages && targetPageId) {
        const nextVisibility = pageModel.visibility === 'VisiblePublic' ? 'VisiblePublic' : 'VisibleToGroup'
        await applyVisibility(targetPageId, nextVisibility)
        setPageModel((current) => ({ ...current, visibility: nextVisibility }))
        setMessage('Page saved and published.')
      } else if (canEditVisibility && targetPageId && pageModel.visibility === 'InvisibleDraft') {
        await applyVisibility(targetPageId, 'InvisibleDraft')
        setMessage('Draft saved.')
      } else {
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

  const saveDraft = async () => {
    await persist(false)
  }

  const publish = async () => {
    if (!canPublish) {
      return
    }

    await persist(true)
  }

  const removePage = async () => {
    if (!canDelete || !editPageId) {
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      await groupService.deletePage(editPageId)
      navigate(resolvedGroupId ? `/groups/${resolvedGroupId}` : '/')
    } catch {
      setError('Failed to delete page.')
    } finally {
      setSaving(false)
    }
  }

  const cancel = async () => {
    const fromManage = searchParams.get('from') === 'manage'

    if (fromManage && resolvedGroupId) {
      navigate(`/groups/${resolvedGroupId}/manage`)
      return
    }

    if (resolvedGroupId) {
      navigate(`/groups/${resolvedGroupId}`)
      return
    }

    navigate('/')
  }

  const addSection = () => {
    setPageModel((current) => ({
      ...current,
      sections: normalizeSort([...current.sections, createEmptySection()]),
    }))
  }

  const updateSection = (index: number, section: SectionEditModel) => {
    setPageModel((current) => {
      const sections = [...current.sections]
      sections[index] = section
      return { ...current, sections: normalizeSort(sections) }
    })
  }

  const removeSection = (index: number) => {
    setPageModel((current) => {
      const sections = [...current.sections]
      sections.splice(index, 1)
      return { ...current, sections: normalizeSort(sections) }
    })
  }

  const moveSection = (index: number, direction: -1 | 1) => {
    setPageModel((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.sections.length) {
        return current
      }

      const sections = [...current.sections]
      const [item] = sections.splice(index, 1)
      if (!item) {
        return current
      }
      sections.splice(nextIndex, 0, item)

      return { ...current, sections: normalizeSort(sections) }
    })
  }

  return (
    <PageEditorShell
      title={editorTitle}
      loading={loading}
      error={error}
      actions={
        <>
          <AppBadge variant={visibilityVariant}>{pageModel.visibility}</AppBadge>
          <AppActionButton variant="ghost" disabled={saving} onClick={() => cancel().catch(() => undefined)}>
            Back
          </AppActionButton>
          <AppActionButton variant="primary" disabled={!canSaveDraft || saving} onClick={() => saveDraft().catch(() => undefined)}>
            Save Draft
          </AppActionButton>
          <AppActionButton variant="secondary" disabled={!canPublish || saving} onClick={() => publish().catch(() => undefined)}>
            Publish
          </AppActionButton>
          {!isCreateMode ? (
            <AppActionButton variant="danger" disabled={!canDelete || saving} onClick={() => removePage().catch(() => undefined)}>
              Delete
            </AppActionButton>
          ) : null}
        </>
      }
      main={
        <>
          <PageMetaForm
            model={pageModel}
            canEdit={canEditPage}
            isCreateMode={isCreateMode}
            titleError={validation.title}
            onChange={setPageModel}
          />

          <SectionListEditor
            sections={pageModel.sections}
            canEdit={canEditPage}
            sectionTypeErrors={validation.sectionTypeErrors}
            onAdd={addSection}
            onUpdate={({ index, section }) => updateSection(index, section)}
            onRemove={removeSection}
            onMoveUp={(index) => moveSection(index, -1)}
            onMoveDown={(index) => moveSection(index, 1)}
          />
        </>
      }
      sidebar={
        <PageSettingsPanel
          model={pageModel}
          canEditVisibility={canEditVisibility}
          canPublish={canPublish}
          canDelete={canDelete}
          canSaveDraft={canSaveDraft}
          isCreateMode={isCreateMode}
          isBusy={saving}
          message={message}
          onChange={setPageModel}
          onSaveDraft={() => {
            saveDraft().catch(() => undefined)
          }}
          onPublish={() => {
            publish().catch(() => undefined)
          }}
          onDelete={() => {
            removePage().catch(() => undefined)
          }}
          onCancel={() => {
            cancel().catch(() => undefined)
          }}
        />
      }
    />
  )
}

export default PageEditorView
