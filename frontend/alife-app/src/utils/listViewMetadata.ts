import type { ListSourceScope, ListSourceType, ListViewMetadata } from '../types/page-editor'

const SOURCE_TYPES: ListSourceType[] = ['sermons', 'pages', 'subgroups', 'events', 'members']

export function normalizeListViewMetadata(raw: Record<string, unknown>): ListViewMetadata {
  const candidateType = String(raw.sourceType ?? 'sermons')
  const sourceType: ListSourceType = SOURCE_TYPES.includes(candidateType as ListSourceType)
    ? (candidateType as ListSourceType)
    : 'sermons'

  const candidateScope = String(raw.sourceScope ?? (sourceType === 'events' ? 'group' : 'global'))
  const sourceScope: ListSourceScope = candidateScope === 'group' ? 'group' : 'global'

  let limit = 10
  if (typeof raw.limit === 'number' && Number.isFinite(raw.limit)) {
    limit = Math.min(Math.max(raw.limit, 1), 50)
  }

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : undefined

  return { sourceType, sourceScope, limit, id }
}
