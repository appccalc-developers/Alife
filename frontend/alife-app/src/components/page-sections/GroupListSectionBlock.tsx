import { GroupListSection as SmartGroupListSection } from '../sections/GroupListSection'
import { useUiText } from '../../i18n/uiText'
import { PropertyPanel, SelectInput, TextInput, patchContent, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'

const GroupListSectionBlock = ({ section, mode, disabled, contextGroupId, page, onUpdate }: SectionComponentProps) => {
  const t = useUiText()
  const sourceType = readText(section.contentJson, 'sourceType') || 'sermons'
  const sourceScope = readText(section.contentJson, 'sourceScope') || 'global'
  const sortBy = readText(section.contentJson, 'sortBy') || (sourceType === 'sermons' ? 'title' : sourceType === 'events' || sourceType === 'pages' ? 'date' : 'source')
  const sortDirection = readText(section.contentJson, 'sortDirection') || (sortBy === 'date' || (sourceType === 'sermons' && sortBy === 'title') ? 'desc' : 'asc')
  const filterText = readText(section.contentJson, 'filterText')
  const limit = typeof section.contentJson.limit === 'number' ? section.contentJson.limit : 10
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const groupId = contextGroupId || page?.ownerGroupId || undefined

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <SmartGroupListSection metadata={section.contentJson} groupId={groupId} compact={mode === 'edit'} />
      {mode === 'edit' ? (
        <PropertyPanel>
          <SelectInput label={t('sourceType')} value={sourceType} disabled={disabled} options={[{ value: 'sermons', label: t('sermons') }, { value: 'events', label: t('events') }, { value: 'pages', label: t('pages') }, { value: 'subgroups', label: t('subgroups') }, { value: 'members', label: t('members') }]} onChange={(value) => updateContent({ sourceType: value, sortBy: value === 'sermons' ? 'title' : value === 'events' || value === 'pages' ? 'date' : 'source', sortDirection: value === 'sermons' || value === 'events' || value === 'pages' ? 'desc' : 'asc' })} />
          <SelectInput label={t('sourceScope')} value={sourceScope} disabled={disabled || sourceType === 'pages' || sourceType === 'events'} options={[{ value: 'global', label: t('global') }, { value: 'group', label: t('group') }]} onChange={(value) => updateContent({ sourceScope: value })} />
          <TextInput label={t('limit')} value={String(limit)} disabled={disabled} onChange={(value) => updateContent({ limit: Math.min(Math.max(parseInt(value) || 10, 1), 50) })} />
          <SelectInput label={t('sortBy')} value={sortBy} disabled={disabled} options={[{ value: 'source', label: t('sourceOrder') }, { value: 'date', label: t('date') }, { value: 'title', label: t('title') }]} onChange={(value) => updateContent({ sortBy: value })} />
          <SelectInput label={t('sortDirection')} value={sortDirection} disabled={disabled || sortBy === 'source'} options={[{ value: 'desc', label: t('descending') }, { value: 'asc', label: t('ascending') }]} onChange={(value) => updateContent({ sortDirection: value })} />
          <TextInput label={t('filterText')} value={filterText} disabled={disabled} placeholder={t('filterTextPlaceholder')} onChange={(value) => updateContent({ filterText: value })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default GroupListSectionBlock
