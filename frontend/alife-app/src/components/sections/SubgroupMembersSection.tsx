import React, { useState } from 'react'
import { useSubgroupPageMembers, membersConfigToListViewMetadata } from '../../hooks/useSubgroupPageMembers'
import type { SubgroupPageMembersConfig } from '../../types/subgroup-pages'
import { GroupListSection } from './GroupListSection'
import { useUiText } from '../../i18n/uiText'

interface SubgroupMembersSectionProps {
  /** Subgroup ID */
  subgroupId: string
  /** Number of items per page */
  limit?: number
  /** Sort order */
  sort?: 'latest' | 'oldest' | 'popular'
  /** Use compact mode (for in-editor preview) */
  compact?: boolean
  /** Auto-load data on mount */
  autoLoad?: boolean
  /** Edit mode: show save button */
  editMode?: boolean
}

/**
 * Subgroup Members Section component
 *
 * Preview mode (editMode=false):
 *   Fetches latest data via conditionalGet with 304 caching support.
 *
 * Edit mode (editMode=true):
 *   Shows config fields and a save button; only required fields (id, limit, sort) are sent on save.
 */
export const SubgroupMembersSection: React.FC<SubgroupMembersSectionProps> = ({
  subgroupId,
  limit = 20,
  sort = 'latest',
  compact = false,
  autoLoad = true,
  editMode = false,
}) => {
  const t = useUiText()
  const config: SubgroupPageMembersConfig = {
    id: subgroupId,
    limit,
    sort,
  }

  // Edit mode — use hook for save/load
  const { loading, error, fromCache, save } = useSubgroupPageMembers({
    config,
    autoLoad: !editMode && autoLoad,
  })

  // Local state for edit mode
  const [editLimit, setEditLimit] = useState(limit)
  const [editSort, setEditSort] = useState<'latest' | 'oldest' | 'popular'>(sort)

  const handleSave = async () => {
    await save({
      id: subgroupId,
      limit: editLimit,
      sort: editSort,
    })
  }

  // Preview mode: render directly using GroupListSection via useListSourceResolver
  if (!editMode) {
    const meta = membersConfigToListViewMetadata(config)
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">{t('subgroupMembers')}</h3>
          {fromCache && (
            <span className="text-[10px] text-slate-400">{t('fromCacheLabel')}</span>
          )}
        </div>
        <GroupListSection
          metadata={meta}
          groupId={subgroupId}
          compact={compact}
        />
      </div>
    )
  }

  // Edit mode: show configuration form
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{t('memberListConfig')}</h3>

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">{t('displayCount')}</span>
          <input
            type="number"
            min={1}
            max={100}
            value={editLimit}
            onChange={(e) => setEditLimit(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">{t('sortOrder')}</span>
          <select
            value={editSort}
            onChange={(e) => setEditSort(e.target.value as typeof editSort)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="latest">{t('joinedLatest')}</option>
            <option value="oldest">{t('joinedOldest')}</option>
            <option value="popular">{t('mostActive')}</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? t('saving') : t('saveConfig')}
      </button>

      <p className="text-[10px] text-slate-400">
        {t('memberListConfigHint')}
      </p>

      {/* Preview current config */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-medium text-slate-500">{t('livePreview')}</p>
        <GroupListSection
          metadata={membersConfigToListViewMetadata({ id: subgroupId, limit: editLimit, sort: editSort })}
          groupId={subgroupId}
          compact
        />
      </div>
    </div>
  )
}

export default SubgroupMembersSection
