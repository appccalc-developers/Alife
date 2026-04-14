import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AppEmptyState from '../layout/AppEmptyState'
import AppSectionCard from '../layout/AppSectionCard'
import type { GroupPageDto } from '../../types/group'

type Props = {
  items: GroupPageDto[]
  canManage?: boolean
  canPublish?: boolean
  showCreateAction?: boolean
  onCreate: () => void
  onOpen: (slug: string) => void
  onEdit: (pageId: string) => void
  onDelete: (pageId: string) => void
  onToggleVisibility: (page: GroupPageDto) => void
}

const dateLabel = (value?: string) => {
  if (!value) {
    return 'N/A'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString()
}

const visibilityVariant = (value: GroupPageDto['visibility']) => {
  if (value === 'VisiblePublic') {
    return 'success' as const
  }
  if (value === 'VisibleToGroup') {
    return 'info' as const
  }
  return 'warning' as const
}

const PageList = ({
  items,
  canManage,
  canPublish,
  showCreateAction = true,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
  onToggleVisibility,
}: Props) => (
  <AppSectionCard title="Pages" subtitle="Published and draft pages for this group.">
    <div className="mb-4 flex items-center justify-end">
      {showCreateAction ? (
        <AppActionButton variant="primary" onClick={onCreate}>Create Page</AppActionButton>
      ) : null}
    </div>

    {items.length === 0 ? (
      <AppEmptyState
        title="No pages yet"
        description="Create a page to share updates, events, and resources."
        actionLabel={showCreateAction ? 'Create Page' : undefined}
        onAction={onCreate}
      />
    ) : (
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((page) => (
          <li key={page.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-900">{page.title}</h3>
                <p className="text-sm text-slate-600">{page.description || 'No description yet.'}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <AppBadge variant={visibilityVariant(page.visibility)}>{page.visibility}</AppBadge>
                  <span className="text-slate-500">Updated: {dateLabel(page.updatedUtc)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <AppActionButton size="sm" onClick={() => onOpen(page.slug)}>Open</AppActionButton>
                {canManage ? (
                  <>
                    <AppActionButton size="sm" variant="ghost" onClick={() => onEdit(page.id)}>Edit</AppActionButton>
                    <AppActionButton size="sm" variant="danger" onClick={() => onDelete(page.id)}>Delete</AppActionButton>
                    {canPublish ? (
                      <AppActionButton size="sm" variant="secondary" onClick={() => onToggleVisibility(page)}>
                        {page.visibility === 'InvisibleDraft' ? 'Publish' : 'Unpublish'}
                      </AppActionButton>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    )}
  </AppSectionCard>
)

export default PageList
