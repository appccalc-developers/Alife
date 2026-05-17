import React, { useState } from 'react'
import { useSubgroupPageMembers, membersConfigToListViewMetadata } from '../../hooks/useSubgroupPageMembers'
import type { SubgroupPageMembersConfig } from '../../types/subgroup-pages'
import { GroupListSection } from './GroupListSection'

interface SubgroupMembersSectionProps {
  /** Subgroup ID */
  subgroupId: string
  /** 每页显示数量 */
  limit?: number
  /** 排序方式 */
  sort?: 'latest' | 'oldest' | 'popular'
  /** 是否使用精简版（编辑器内预览用） */
  compact?: boolean
  /** 是否自动加载数据 */
  autoLoad?: boolean
  /** 编辑模式：显示保存按钮 */
  editMode?: boolean
}

/**
 * Subgroup Members Section 组件
 *
 * 预览模式 (editMode=false):
 *   通过 conditionalGet 获取最新数据，支持 304 缓存
 *
 * 编辑模式 (editMode=true):
 *   显示配置项和保存按钮，保存时只传必要字段 (id, limit, sort)
 */
export const SubgroupMembersSection: React.FC<SubgroupMembersSectionProps> = ({
  subgroupId,
  limit = 20,
  sort = 'latest',
  compact = false,
  autoLoad = true,
  editMode = false,
}) => {
  const config: SubgroupPageMembersConfig = {
    id: subgroupId,
    limit,
    sort,
  }

  // 编辑模式 - 使用 hook 管理保存/加载
  const { loading, error, fromCache, save } = useSubgroupPageMembers({
    config,
    autoLoad: !editMode && autoLoad,
  })

  // 编辑模式下的本地状态
  const [editLimit, setEditLimit] = useState(limit)
  const [editSort, setEditSort] = useState<'latest' | 'oldest' | 'popular'>(sort)

  const handleSave = async () => {
    await save({
      id: subgroupId,
      limit: editLimit,
      sort: editSort,
    })
  }

  // 预览模式：直接使用 GroupListSection 通过 useListSourceResolver 渲染
  if (!editMode) {
    const meta = membersConfigToListViewMetadata(config)
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">子群组成员</h3>
          {fromCache && (
            <span className="text-[10px] text-slate-400">（缓存数据）</span>
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

  // 编辑模式：显示配置表单
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">成员列表配置</h3>

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">每页数量</span>
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
          <span className="text-xs font-medium text-slate-700">排序方式</span>
          <select
            value={editSort}
            onChange={(e) => setEditSort(e.target.value as typeof editSort)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="latest">最新加入</option>
            <option value="oldest">最早加入</option>
            <option value="popular">最活跃</option>
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
        {loading ? '保存中...' : '保存配置'}
      </button>

      <p className="text-[10px] text-slate-400">
        保存时只传必要字段 (id, limit, sort)，预览时通过 ETag/304 获取最新数据
      </p>

      {/* 预览当前配置 */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-medium text-slate-500">实时预览</p>
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
