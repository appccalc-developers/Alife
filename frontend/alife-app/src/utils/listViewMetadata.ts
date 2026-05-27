import type { ListSortBy, ListSortDirection, ListSourceScope, ListSourceType, ListViewMetadata } from '../types/page-editor'

const SOURCE_TYPES: ListSourceType[] = ['sermons', 'pages', 'subgroups', 'events', 'members']
const SORT_FIELDS: ListSortBy[] = ['source', 'date', 'title']
const SORT_DIRECTIONS: ListSortDirection[] = ['asc', 'desc']

export function normalizeListViewMetadata(raw: Record<string, unknown>): ListViewMetadata {
  const candidateType = String(raw.sourceType ?? 'sermons')
  const sourceType: ListSourceType = SOURCE_TYPES.includes(candidateType as ListSourceType)
    ? (candidateType as ListSourceType)
    : 'sermons'

  const candidateScope = String(raw.sourceScope ?? (sourceType === 'events' ? 'group' : 'global'))
  const sourceScope: ListSourceScope = candidateScope === 'group' ? 'group' : 'global'
  const candidateSortBy = String(raw.sortBy ?? (sourceType === 'sermons' ? 'title' : sourceType === 'events' || sourceType === 'pages' ? 'date' : 'source'))
  const sortBy: ListSortBy = SORT_FIELDS.includes(candidateSortBy as ListSortBy)
    ? (candidateSortBy as ListSortBy)
    : 'source'
  const candidateSortDirection = String(raw.sortDirection ?? (sortBy === 'date' || (sourceType === 'sermons' && sortBy === 'title') ? 'desc' : 'asc'))
  const sortDirection: ListSortDirection = SORT_DIRECTIONS.includes(candidateSortDirection as ListSortDirection)
    ? (candidateSortDirection as ListSortDirection)
    : 'asc'

  let limit = 10
  if (typeof raw.limit === 'number' && Number.isFinite(raw.limit)) {
    limit = Math.min(Math.max(raw.limit, 1), 50)
  }

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : undefined
  const filterText = typeof raw.filterText === 'string' && raw.filterText.trim() ? raw.filterText.trim() : undefined

  return { sourceType, sourceScope, limit, sortBy, sortDirection, filterText, id }
}
