import React, { useState } from 'react'
import { useUiText } from '../../i18n/uiText'
import type { JsonMap } from '../../types/page-editor'

interface SubgroupMembersFieldEditorProps {
  contentJson: JsonMap
  disabled?: boolean
  onChange: (value: JsonMap) => void
}

/**
 * SubgroupMembers field editor.
 * Used to configure "members list" type sections in the Page Editor.
 *
 * Fields saved to contentJson:
 * - sourceType: 'members'
 * - sourceScope: 'group'
 * - limit: number
 * - id: string (subgroupId)
 *
 * Does not carry full member data — only stores configuration parameters.
 */
export const SubgroupMembersFieldEditor: React.FC<SubgroupMembersFieldEditorProps> = ({
  contentJson,
  disabled = false,
  onChange,
}) => {
  const t = useUiText()
  const [subgroupId, setSubgroupId] = useState((contentJson.id as string) || '')
  const [limit, setLimit] = useState((contentJson.limit as number) || 10)

  const handleSubgroupIdChange = (value: string) => {
    setSubgroupId(value)
    onChange({
      ...contentJson,
      sourceType: 'members',
      sourceScope: 'group',
      id: value,
      limit,
    })
  }

  const handleLimitChange = (value: number) => {
    const newLimit = Math.min(Math.max(value, 1), 100)
    setLimit(newLimit)
    onChange({
      ...contentJson,
      sourceType: 'members',
      sourceScope: 'group',
      id: subgroupId,
      limit: newLimit,
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('memberListConfig')}</p>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-700">Subgroup ID</span>
        <input
          type="text"
          value={subgroupId}
          disabled={disabled}
          placeholder={t('subgroupIdInputPlaceholder')}
          onChange={(e) => handleSubgroupIdChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-700">{t('displayCount')}</span>
        <input
          type="number"
          min={1}
          max={100}
          value={limit}
          disabled={disabled}
          onChange={(e) => handleLimitChange(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
        />
      </label>

      <p className="text-[10px] text-slate-400">
        {t('memberListConfigHint')}
      </p>
    </div>
  )
}

export default SubgroupMembersFieldEditor
