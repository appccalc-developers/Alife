import { GroupListSection as SmartGroupListSection } from '../sections/GroupListSection'
import { PropertyPanel, SelectInput, TextInput, patchContent, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'

const GroupListSectionBlock = ({ section, mode, disabled, contextGroupId, page, onUpdate }: SectionComponentProps) => {
  const sourceType = readText(section.contentJson, 'sourceType') || 'sermons'
  const sourceScope = readText(section.contentJson, 'sourceScope') || 'global'
  const limit = typeof section.contentJson.limit === 'number' ? section.contentJson.limit : 10
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const groupId = contextGroupId || page?.ownerGroupId || undefined

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <SmartGroupListSection metadata={section.contentJson} groupId={groupId} compact={mode === 'edit'} />
      {mode === 'edit' ? (
        <PropertyPanel>
          <SelectInput label="Source Type" value={sourceType} disabled={disabled} options={[{ value: 'sermons', label: 'Sermons' }, { value: 'events', label: 'Events' }, { value: 'pages', label: 'Pages' }, { value: 'subgroups', label: 'Subgroups' }, { value: 'members', label: 'Members' }]} onChange={(value) => updateContent({ sourceType: value })} />
          <SelectInput label="Source Scope" value={sourceScope} disabled={disabled || sourceType === 'pages' || sourceType === 'events'} options={[{ value: 'global', label: 'Global' }, { value: 'group', label: 'Group' }]} onChange={(value) => updateContent({ sourceScope: value })} />
          <TextInput label="Limit" value={String(limit)} disabled={disabled} onChange={(value) => updateContent({ limit: Math.min(Math.max(parseInt(value) || 10, 1), 50) })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default GroupListSectionBlock
