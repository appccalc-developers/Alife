/** Subgroup page members config. Persist only these fields. */
export interface SubgroupPageMembersConfig {
  id: string
  limit: number
  offset?: number
  sort?: 'latest' | 'oldest' | 'popular'
}

/** Subgroup page events config. */
export interface SubgroupPageEventsConfig {
  id?: string
  limit: number
  offset?: number
  sort?: 'latest' | 'oldest'
}

/** Subgroup page subgroups config. */
export interface SubgroupPageSubgroupsConfig {
  id: string
  limit: number
  offset?: number
  sort?: 'name' | 'latest'
}

/** Unified payload for saving sections. Send only the required fields. */
export type SubgroupSectionSavePayload =
  | { type: 'members'; config: SubgroupPageMembersConfig }
  | { type: 'events'; config: SubgroupPageEventsConfig }
  | { type: 'subgroups'; config: SubgroupPageSubgroupsConfig }
