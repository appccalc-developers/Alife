/** Subgroup Page Members 配置 - 保存时只需传这些 */
export interface SubgroupPageMembersConfig {
  id: string
  limit: number
  offset?: number
  sort?: 'latest' | 'oldest' | 'popular'
}

/** Subgroup Page Events 配置 */
export interface SubgroupPageEventsConfig {
  id?: string
  limit: number
  offset?: number
  sort?: 'latest' | 'oldest'
}

/** Subgroup Page Subgroups 配置 */
export interface SubgroupPageSubgroupsConfig {
  id: string
  limit: number
  offset?: number
  sort?: 'name' | 'latest'
}

/** 保存区块时的统一载荷 - 只传必要字段 */
export type SubgroupSectionSavePayload =
  | { type: 'members'; config: SubgroupPageMembersConfig }
  | { type: 'events'; config: SubgroupPageEventsConfig }
  | { type: 'subgroups'; config: SubgroupPageSubgroupsConfig }
