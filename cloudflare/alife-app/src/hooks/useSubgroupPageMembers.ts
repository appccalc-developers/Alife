import { useCallback, useEffect, useState } from 'react'
import { getSubgroupMembers, saveSubgroupMembersConfig, membersQueryKey } from '../api/subgroupPagesService'
import { getCachedRecord } from '../db/httpCache'
import { translateUi } from '../i18n/uiText'
import { useAuthStore } from '../stores/auth'
import type { SubgroupPageMembersConfig } from '../types/subgroup-pages'

interface UseSubgroupPageMembersOptions {
  config: SubgroupPageMembersConfig
  /** Whether to load automatically: true for preview, false for edit mode. */
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
  /** Manually refresh data, primarily used in preview mode. */
  load: () => Promise<void>
  /** Save config while sending only the required fields. */
  save: (newConfig: SubgroupPageMembersConfig) => Promise<void>
}

/**
 * Subgroup Page Members Hook
 *
 * In edit mode, call save() with only the required fields: id, limit, and sort.
 * In preview mode, call load() to fetch the latest data through conditionalGet with 304 cache support.
 */
export function useSubgroupPageMembers(options: UseSubgroupPageMembersOptions): UseSubgroupPageMembersReturn {
  const { config, autoLoad = true } = options
  const { language } = useAuthStore()

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
      // Fall back to cached data when the network request fails.
      const cached = await getCachedRecord<MemberInfo[]>(membersQueryKey(config))
      if (cached?.data) {
        setMembers(cached.data)
        setFromCache(true)
        return
      }
      setError(err instanceof Error ? err.message : translateUi(language, 'memberListLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [config, language])

  const save = useCallback(async (newConfig: SubgroupPageMembersConfig) => {
    setLoading(true)
    setError(null)
    try {
      await saveSubgroupMembersConfig(newConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : translateUi(language, 'memberConfigSaveFailed'))
    } finally {
      setLoading(false)
    }
  }, [language])

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
 * Convert SubgroupPageMembersConfig into ListViewMetadata
 * for direct rendering in GroupListSection.
 */
export function membersConfigToListViewMetadata(config: SubgroupPageMembersConfig) {
  return {
    sourceType: 'members' as const,
    sourceScope: 'group' as const,
    limit: config.limit,
    sortBy: 'source' as const,
    sortDirection: 'asc' as const,
    id: config.id,
  }
}
