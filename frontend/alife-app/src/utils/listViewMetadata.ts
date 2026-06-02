import type { ListSortBy, ListSortDirection, ListSourceScope, ListSourceType, ListViewLayout, ListViewMetadata, ListViewSource } from '../types/page-editor'

const SOURCE_TYPES: ListSourceType[] = ['sermons', 'pages', 'subgroups', 'events', 'members', 'groups', 'media', 'posts']
const SORT_FIELDS: ListSortBy[] = ['source', 'date', 'title']
const SORT_DIRECTIONS: ListSortDirection[] = ['asc', 'desc']
const CORE_SOURCES: ListViewSource[] = ['events', 'sermons', 'groups', 'media', 'posts']
const LAYOUTS: ListViewLayout[] = ['grid', 'list', 'cards', 'carousel']

const sourceTypeToSource = (sourceType: ListSourceType): ListViewSource =>
  sourceType === 'subgroups' ? 'groups'
    : sourceType === 'pages' || sourceType === 'members' ? 'groups'
      : CORE_SOURCES.includes(sourceType as ListViewSource) ? (sourceType as ListViewSource)
        : 'sermons'

const defaultPreset = (source: ListViewSource) => {
  switch (source) {
    case 'events':
      return 'upcoming'
    case 'sermons':
    case 'media':
      return 'latest'
    case 'groups':
      return 'featured'
    default:
      return 'all'
  }
}

const presetSort = (sourceType: ListSourceType, preset: string) => {
  if (sourceType === 'events') {
    return preset === 'recent'
      ? { sortBy: 'date' as const, sortDirection: 'desc' as const }
      : { sortBy: 'date' as const, sortDirection: 'asc' as const }
  }

  if (sourceType === 'sermons') {
    return preset === 'latest'
      ? { sortBy: 'date' as const, sortDirection: 'desc' as const }
      : { sortBy: 'title' as const, sortDirection: 'asc' as const }
  }

  return { sortBy: 'source' as const, sortDirection: 'asc' as const }
}

export function normalizeListViewMetadata(raw: Record<string, unknown>): ListViewMetadata {
  const candidateType = String(raw.sourceType ?? raw.source ?? 'sermons')
  const sourceType: ListSourceType = SOURCE_TYPES.includes(candidateType as ListSourceType)
    ? (candidateType as ListSourceType)
    : 'sermons'
  const sourceCandidate = String(raw.source ?? sourceTypeToSource(sourceType))
  const source: ListViewSource = CORE_SOURCES.includes(sourceCandidate as ListViewSource)
    ? (sourceCandidate as ListViewSource)
    : sourceTypeToSource(sourceType)
  const preset = typeof raw.preset === 'string' && raw.preset.trim() ? raw.preset.trim() : defaultPreset(source)
  const layoutCandidate = String(raw.layout ?? 'grid')
  const layout: ListViewLayout = LAYOUTS.includes(layoutCandidate as ListViewLayout)
    ? (layoutCandidate as ListViewLayout)
    : 'grid'
  const presetDefaults = presetSort(sourceType, preset)

  const candidateScope = String(raw.sourceScope ?? (sourceType === 'events' ? 'group' : 'global'))
  const sourceScope: ListSourceScope = candidateScope === 'group' ? 'group' : 'global'
  const candidateSortBy = String(raw.sortBy ?? presetDefaults.sortBy)
  const sortBy: ListSortBy = SORT_FIELDS.includes(candidateSortBy as ListSortBy)
    ? (candidateSortBy as ListSortBy)
    : 'source'
  const candidateSortDirection = String(raw.sortDirection ?? presetDefaults.sortDirection)
  const sortDirection: ListSortDirection = SORT_DIRECTIONS.includes(candidateSortDirection as ListSortDirection)
    ? (candidateSortDirection as ListSortDirection)
    : 'asc'

  let limit = 10
  if (typeof raw.limit === 'number' && Number.isFinite(raw.limit)) {
    limit = Math.min(Math.max(raw.limit, 1), 50)
  }

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : undefined
  const filterText = typeof raw.filterText === 'string' && raw.filterText.trim() ? raw.filterText.trim() : undefined

  return { sourceType, sourceScope, limit, sortBy, sortDirection, source, preset, layout, filterText, id }
}
