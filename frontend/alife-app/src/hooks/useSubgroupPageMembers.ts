import { useCallback, useEffect, useState } from 'react'
import { getSubgroupMembers, saveSubgroupMembersConfig, membersQueryKey } from '../api/subgroupPagesService'
import { getCachedRecord } from '../db/httpCache'
import type { SubgroupPageMembersConfig } from '../types/subgroup-pages'

interface UseSubgroupPageMembersOptions {
  config: SubgroupPageMembersConfig
  /** 是否自动加载（预览时 true，编辑时 false） */
  autoLoad?: boolean
}

interface MemberInfo {
  memberId: string
  name: string
  role: string
  status: string
}

interface UseSubgroupPageMembersReturn {
  members: MemberInfo[]
  loading: boolean
  error: string | null
  fromCache: boolean
  /** 手动刷新 - 预览时调用 */
  load: () => Promise<void>
  /** 保存配置 - 只传必要字段 */
  save: (newConfig: SubgroupPageMembersConfig) => Promise<void>
}

/**
 * Subgroup Page Members Hook
 *
 * 编辑时: 调用 save() 只传必要字段 (id, limit, sort)
 * 预览时: 调用 load() 通过 conditionalGet 获取最新数据，支持 304 缓存
 */
export function useSubgroupPageMembers(options: UseSubgroupPageMembersOptions): UseSubgroupPageMembersReturn {
  const { config, autoLoad = true } = options

  const [members, setMembers] = useState<MemberInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setFromCache(false)

    try {
      const data = await getSubgroupMembers(config)
      setMembers(data)
    } catch (err) {
      // 网络失败时尝试读缓存
      const cached = await getCachedRecord<MemberInfo[]>(membersQueryKey(config))
      if (cached?.data) {
        setMembers(cached.data)
        setFromCache(true)
        return
      }
      setError(err instanceof Error ? err.message : '获取成员列表失败')
    } finally {
      setLoading(false)
    }
  }, [config])

  const save = useCallback(async (newConfig: SubgroupPageMembersConfig) => {
    setLoading(true)
    setError(null)
    try {
      await saveSubgroupMembersConfig(newConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoLoad) {
      load()
    }
  }, [autoLoad, load])

  return {
    members,
    loading,
    error,
    fromCache,
    load,
    save,
  }
}

/**
 * 将 SubgroupPageMembersConfig 转为 ListViewMetadata
 * 用于在 GroupListSection 中直接渲染
 */
export function membersConfigToListViewMetadata(config: SubgroupPageMembersConfig) {
  return {
    sourceType: 'members' as const,
    sourceScope: 'group' as const,
    limit: config.limit,
    id: config.id,
  }
}
