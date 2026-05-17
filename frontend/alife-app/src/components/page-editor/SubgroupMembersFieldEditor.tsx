import React, { useState } from 'react'
import type { JsonMap } from '../../types/page-editor'

interface SubgroupMembersFieldEditorProps {
  contentJson: JsonMap
  disabled?: boolean
  onChange: (value: JsonMap) => void
}

/**
 * SubgroupMembers 字段编辑器
 * 用于 Page Editor 中配置 "成员列表" 类型的 section
 *
 * 保存到 contentJson 的字段:
 * - sourceType: 'members'
 * - sourceScope: 'group'
 * - limit: number
 * - id: string (subgroupId)
 *
 * 不携带完整成员数据，只存配置参数
 */
export const SubgroupMembersFieldEditor: React.FC<SubgroupMembersFieldEditorProps> = ({
  contentJson,
  disabled = false,
  onChange,
}) => {
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
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">成员列表配置</p>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-700">Subgroup ID</span>
        <input
          type="text"
          value={subgroupId}
          disabled={disabled}
          placeholder="请输入子群组 ID"
          onChange={(e) => handleSubgroupIdChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-700">显示数量</span>
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
        保存时只传这些必要字段，预览时从接口实时获取最新数据
      </p>
    </div>
  )
}

export default SubgroupMembersFieldEditor
