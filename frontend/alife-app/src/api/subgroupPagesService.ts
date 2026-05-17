import { http } from '../services/http'
import { conditionalGet } from '../db/httpCache'
import type { SubgroupPageMembersConfig } from '../types/subgroup-pages'

/**
 * Subgroup Pages API
 *
 * 保存: 只传必要字段 (id, limit, sort 等)
 * 预览: 用 conditionalGet 自动处理 ETag / 304
 */

// ---- Members ----

export const membersQueryKey = (config: SubgroupPageMembersConfig) =>
  ['subgroupMembers', config.id, config.limit, config.offset ?? 0, config.sort ?? 'latest'] as const

/** 保存 members 配置 - 只传必要字段 */
export async function saveSubgroupMembersConfig(config: SubgroupPageMembersConfig) {
  const payload = {
    id: config.id,
    limit: config.limit,
    offset: config.offset ?? 0,
    sort: config.sort ?? 'latest',
  }
  const { data } = await http.post('/api/subgroup/pages/members', payload)
  return data
}

/** 获取 members 数据 - 通过 conditionalGet 支持 ETag/304 缓存 */
export async function getSubgroupMembers(config: SubgroupPageMembersConfig) {
  const params = new URLSearchParams({
    id: config.id,
    limit: String(config.limit),
    offset: String(config.offset ?? 0),
    sort: config.sort ?? 'latest',
  })

  return conditionalGet<Array<{ memberId: string; name: string; role: string; status: string }>>({
    queryKey: membersQueryKey(config),
    path: `/api/subgroup/members?${params}`,
  })
}

// ---- Events ----

export const pageEventsQueryKey = (config: { id?: string; limit: number; offset?: number; sort?: string }) =>
  ['subgroupPageEvents', config.id ?? '__global__', config.limit, config.offset ?? 0, config.sort ?? 'latest'] as const

export async function saveSubgroupEventsConfig(config: { id?: string; limit: number; offset?: number; sort?: string }) {
  const { data } = await http.post('/api/subgroup/pages/events', {
    id: config.id ?? '__global__',
    limit: config.limit,
    offset: config.offset ?? 0,
    sort: config.sort ?? 'latest',
  })
  return data
}

export async function getSubgroupPageEvents(config: { id?: string; limit: number; offset?: number; sort?: string }) {
  const params = new URLSearchParams({
    id: config.id ?? '__global__',
    limit: String(config.limit),
    offset: String(config.offset ?? 0),
    sort: config.sort ?? 'latest',
  })

  return conditionalGet<Array<{ id: string; title: string; startDate: string }>>({
    queryKey: pageEventsQueryKey(config),
    path: `/api/subgroup/events?${params}`,
  })
}

// ---- Subgroups ----

export const pageSubgroupsQueryKey = (config: { id: string; limit: number; offset?: number; sort?: string }) =>
  ['subgroupPageSubgroups', config.id, config.limit, config.offset ?? 0, config.sort ?? 'name'] as const

export async function saveSubgroupSubgroupsConfig(config: { id: string; limit: number; offset?: number; sort?: string }) {
  const { data } = await http.post('/api/subgroup/pages/subgroups', {
    id: config.id,
    limit: config.limit,
    offset: config.offset ?? 0,
    sort: config.sort ?? 'name',
  })
  return data
}

export async function getSubgroupPageSubgroups(config: { id: string; limit: number; offset?: number; sort?: string }) {
  const params = new URLSearchParams({
    id: config.id,
    limit: String(config.limit),
    offset: String(config.offset ?? 0),
    sort: config.sort ?? 'name',
  })

  return conditionalGet<Array<{ id: string; name: string; accessType: string }>>({
    queryKey: pageSubgroupsQueryKey(config),
    path: `/api/subgroup/subgroups?${params}`,
  })
}
