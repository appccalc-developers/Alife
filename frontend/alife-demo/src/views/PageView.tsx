import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PagePreview from '../components/page/PagePreview'
import PageDrawerContent from '../components/page-editor/PageDrawerContent'
import { createEmptySection, mapPageToEditModel, normalizeSort, slugify } from '../components/page-editor/pageEditorUtils'
import { useNavigationDrawer } from '../components/layout/NavigationDrawerContext'
import { groupService } from '../api/groupService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import type { PageVisibility } from '../types/group'
import type { PageEditModel, PageEditorValidation, SectionEditModel } from '../types/page-editor'

const PageView = () => {
  const { groupId: createGroupIdParam = '', slug = '', pageId = '' } = useParams<{ groupId?: string; slug?: string; pageId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const auth = useAuthStore()
  const { setDrawer, closeDrawer } = useNavigationDrawer()

  const isCreateMode = Boolean(createGroupIdParam && !slug && !pageId)

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

  const [pageModel, setPageModel] = useState<PageEditModel | null>(() => (isCreateMode ? createInitialModel(createGroupIdParam) : null))
  const [subgroupItems, setSubgroupItems] = useState<Array<{ id: string; name: string; accessType: string }>>([])
  const [groupPageItems, setGroupPageItems] = useState<Array<{ id: string; title: string; slug: string; visibility: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const routeGroupId = searchParams.get('groupId') ?? ''
  const resolvedGroupId = createGroupIdParam || routeGroupId || pageModel?.groupId || ''

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

  const isAuthor = useMemo(() => {
    if (!pageModel?.createdByMemberId || !auth.me?.id) {
      return false
    }

    return auth.me.id === pageModel.createdByMemberId
  }, [auth.me?.id, pageModel?.createdByMemberId])

  const canCreatePage = Boolean(membership?.status === 'Approved' || canEditAllPages)
  const canEditPage = isCreateMode ? canCreatePage : Boolean(canEditAllPages || isAuthor)
  const canDelete = !isCreateMode && canEditPage
  const canPublish = canEditAllPages && !isCreateMode
  const canEditVisibility = canEditAllPages
  const showDrawer = isCreateMode ? canCreatePage : canEditPage

  const validation = useMemo<PageEditorValidation>(() => {
    if (!pageModel) {
      return {
        title: undefined,
        sectionTypeErrors: [],
      }
    }

    const title = pageModel.title.trim()
    const sectionTypeErrors = pageModel.sections.map((section) => (section.type ? '' : 'Section type is required.'))

    return {
      title: title ? undefined : 'Page title is required.',
      sectionTypeErrors,
    }
  }, [pageModel])

  const hasValidationErrors = Boolean(validation.title) || validation.sectionTypeErrors.some((item) => item.length > 0)
  const canSaveDraft = Boolean(pageModel) && canEditPage && !saving && !hasValidationErrors

  const loadPreviewCollections = async (targetGroupId: string) => {
    const [subgroups, pages] = await Promise.all([
      groupService.getSubgroups(targetGroupId),
      groupService.getGroupPages(targetGroupId, auth.language),
    ])

    setSubgroupItems(subgroups)
    setGroupPageItems(pages)
  }

  const load = async () => {
    if (!auth.initialized) {
      return
    }

    if (isCreateMode) {
      setLoading(true)
      setError('')
      setMessage('')

      try {
        setPageModel(createInitialModel(createGroupIdParam))
        if (createGroupIdParam) {
          await loadPreviewCollections(createGroupIdParam)
        } else {
          setSubgroupItems([])
          setGroupPageItems([])
        }

        if (!canCreatePage) {
          setMessage('You need approved membership to create a page in this group.')
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Failed to load page editor.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!slug && !pageId) {
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const nextPage = pageId ? await groupService.getPageById(pageId, auth.language) : await groupService.getPageBySlug(slug, auth.language)
      const nextGroupId = nextPage.ownerGroupId ?? routeGroupId
      const nextSections = nextPage.id ? await pageService.getPageSections(nextPage.id) : []

      setPageModel({
        ...mapPageToEditModel(nextPage, nextGroupId || ''),
        sections: normalizeSort(nextSections),
      })

      if (nextGroupId) {
        await loadPreviewCollections(nextGroupId)
      } else {
        setSubgroupItems([])
        setGroupPageItems([])
      }
    } catch {
      setError('Page not found or not accessible for your membership.')
      setPageModel(null)
      setSubgroupItems([])
      setGroupPageItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.initialized, auth.language, canCreatePage, createGroupIdParam, isCreateMode, pageId, routeGroupId, slug])

  const applyVisibility = async (targetPageId: string, visibility: PageVisibility) => {
    await groupService.publishPage(targetPageId, visibility)
  }

  const saveSectionsWithFallback = async (targetPageId: string) => {
    if (!pageModel) {
      return
    }

    await groupService.savePageSections(targetPageId, pageModel.sections)
  }

  const persist = async (publishChanges: boolean) => {
    if (!pageModel || !canSaveDraft) {
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
      let targetPageId = pageModel.id
      let targetSlug = pageModel.slug.trim() || slugify(pageModel.title)

      if (isCreateMode) {
        const created = await groupService.createGroupPage(resolvedGroupId, {
          title: pageModel.title.trim(),
          slug: targetSlug,
          language: pageModel.language.trim() || auth.language,
          description: pageModel.description.trim(),
          tagsJson: JSON.stringify(pageModel.tags),
          titleDisplayStyle: pageModel.titleDisplayStyle.trim() || 'Default',
        })

        targetPageId = created.id
        targetSlug = created.slug
        setPageModel((current) =>
          current
            ? {
                ...current,
                id: created.id,
                groupId: resolvedGroupId,
                slug: created.slug,
                createdByMemberId: created.createdByMemberId,
                visibility: created.visibility,
              }
            : current,
        )
      } else if (pageModel.id) {
        await groupService.updatePage(pageModel.id, {
          title: pageModel.title.trim(),
          description: pageModel.description.trim(),
          tagsJson: JSON.stringify(pageModel.tags),
          titleDisplayStyle: pageModel.titleDisplayStyle.trim() || 'Default',
        })
      }

      if (!targetPageId) {
        throw new Error('Missing page id after save.')
      }

      await saveSectionsWithFallback(targetPageId)

      if (publishChanges && canEditAllPages && !isCreateMode) {
        const nextVisibility = pageModel.visibility === 'VisiblePublic' ? 'VisiblePublic' : 'VisibleToGroup'
        await applyVisibility(targetPageId, nextVisibility)
        setPageModel((current) => (current ? { ...current, visibility: nextVisibility } : current))
        setMessage('Page saved and published.')
      } else if (canEditVisibility && pageModel.visibility === 'InvisibleDraft' && !isCreateMode) {
        await applyVisibility(targetPageId, 'InvisibleDraft')
        setMessage('Draft saved.')
      } else {
        setMessage('Page saved.')
      }

      if (isCreateMode) {
        navigate(`/pages/${targetSlug}`, { replace: true })
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
    if (!pageModel?.id || !canDelete) {
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      await groupService.deletePage(pageModel.id)
      navigate(resolvedGroupId ? `/groups/${resolvedGroupId}` : '/')
    } catch {
      setError('Failed to delete page.')
    } finally {
      setSaving(false)
    }
  }

  const cancel = async () => {
    if (isCreateMode) {
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
      return
    }

    await load()
  }

  const addSection = () => {
    setPageModel((current) =>
      current
        ? {
            ...current,
            sections: normalizeSort([...current.sections, createEmptySection()]),
          }
        : current,
    )
  }

  const updateSection = (index: number, section: SectionEditModel) => {
    setPageModel((current) => {
      if (!current) {
        return current
      }

      const sections = [...current.sections]
      sections[index] = section
      return { ...current, sections: normalizeSort(sections) }
    })
  }

  const removeSection = (index: number) => {
    setPageModel((current) => {
      if (!current) {
        return current
      }

      const sections = [...current.sections]
      sections.splice(index, 1)
      return { ...current, sections: normalizeSort(sections) }
    })
  }

  const moveSection = (index: number, direction: -1 | 1) => {
    setPageModel((current) => {
      if (!current) {
        return current
      }

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

  const drawerContent = useMemo(
    () =>
      showDrawer && pageModel ? (
        <PageDrawerContent
          model={pageModel}
          canEdit={canEditPage}
          canEditVisibility={canEditVisibility}
          canPublish={canPublish}
          canDelete={canDelete}
          canSaveDraft={canSaveDraft}
          isCreateMode={isCreateMode}
          isBusy={saving}
          titleError={validation.title}
          sectionTypeErrors={validation.sectionTypeErrors}
          message={message}
          onChange={(value) => setPageModel(value)}
          onAdd={addSection}
          onUpdate={({ index, section }) => updateSection(index, section)}
          onRemove={removeSection}
          onMoveUp={(index) => moveSection(index, -1)}
          onMoveDown={(index) => moveSection(index, 1)}
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
      ) : undefined,
    [
      canDelete,
      canEditVisibility,
      canPublish,
      canSaveDraft,
      canEditPage,
      isCreateMode,
      message,
      pageModel,
      saving,
      showDrawer,
      validation.sectionTypeErrors,
      validation.title,
    ],
  )

  useEffect(() => {
    if (!drawerContent) {
      setDrawer({})
      closeDrawer()
      return
    }

    setDrawer({
      title: isCreateMode ? 'Create Group Page' : 'Edit Group Page',
      content: drawerContent,
    })
  }, [closeDrawer, drawerContent, isCreateMode, setDrawer])

  useEffect(
    () => () => {
      closeDrawer()
      setDrawer({})
    },
    [closeDrawer, setDrawer],
  )

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      {loading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">Loading page...</p> : null}
      {!loading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}

      {!loading && !error && pageModel ? (
        <PagePreview
          page={{
            id: pageModel.id,
            ownerGroupId: resolvedGroupId,
            title: pageModel.title,
            description: pageModel.description,
            slug: pageModel.slug.trim() || slugify(pageModel.title),
            visibility: pageModel.visibility,
          }}
          sections={pageModel.sections}
          subgroupItems={subgroupItems}
          groupPageItems={groupPageItems}
        />
      ) : null}
    </section>
  )
}

export default PageView
