import { http } from '../services/http'
import { conditionalGet } from '../db/httpCache'
import type { SubgroupPageMembersConfig } from '../types/subgroup-pages'

/**
 * Subgroup Pages API
 *
 * Save: only required fields are sent (id, limit, sort, etc.)
 * Preview: conditionalGet handles ETag / 304 automatically
 */

// ---- Members ----

export const membersQueryKey = (config: SubgroupPageMembersConfig) =>
  ['subgroupMembers', config.id, config.limit, config.offset ?? 0, config.sort ?? 'latest'] as const

/** Save members config — only required fields are sent */
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

/** Fetch members data — uses conditionalGet for ETag/304 caching */
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
