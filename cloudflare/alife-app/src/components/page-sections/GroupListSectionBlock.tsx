import { GroupListSection as SmartGroupListSection } from '../sections/GroupListSection'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import { PropertyPanel, SelectInput, TextInput, patchContent, patchLocalizedSectionHeader, patchSectionHeader, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'
import SectionHeader from './SectionHeader'
import { sectionSpacingClass } from './sectionPresets'

const sourceFromContent = (content: Record<string, unknown>) => {
  const source = readText(content, 'source')
  if (source) return source

  const sourceType = readText(content, 'sourceType') || 'sermons'
  return sourceType === 'subgroups' ? 'groups' : sourceType === 'pages' || sourceType === 'members' ? sourceType : sourceType
}

const presetOptionsForSource = (source: string, t: ReturnType<typeof useUiText>) => {
  if (source === 'events') {
    return [
      { value: 'upcoming', label: t('upcoming') },
      { value: 'recent', label: t('recent') },
      { value: 'all', label: t('all') },
    ]
  }

  if (source === 'sermons' || source === 'media') {
    return [
      { value: 'latest', label: t('latest') },
      { value: 'all', label: t('all') },
    ]
  }

  if (source === 'groups') {
    return [
      { value: 'featured', label: t('featured') },
      { value: 'all', label: t('all') },
    ]
  }

  return [{ value: 'all', label: t('all') }]
}

const GroupListSectionBlock = ({ section, mode, disabled, propertiesOnly, showProperties = true, contextGroupId, page, onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const source = sourceFromContent(section.contentJson)
  const preset = readText(section.contentJson, 'preset') || (source === 'events' ? 'upcoming' : source === 'groups' ? 'featured' : source === 'sermons' || source === 'media' ? 'latest' : 'all')
  const layout = readText(section.contentJson, 'layout') || 'grid'
  const limit = typeof section.contentJson.limit === 'number' ? section.contentJson.limit : 10
  const editable = mode === 'edit' && !disabled && onUpdate
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateHeaderTitle = (value: string) => onUpdate?.(patchLocalizedSectionHeader(section, auth.language, 'title', value))
  const updateHeaderSubtitle = (value: string) => onUpdate?.(patchLocalizedSectionHeader(section, auth.language, 'subtitle', value))
  const groupId = contextGroupId || page?.ownerGroupId || undefined
  const renderProperties = () => (
    <PropertyPanel>
      <SelectInput
        label={t('source')}
        value={source}
        disabled={disabled}
        options={[
          { value: 'events', label: t('events') },
          { value: 'sermons', label: t('sermons') },
          { value: 'groups', label: t('groups') },
          { value: 'media', label: t('media') },
        ]}
        onChange={(value) => updateContent({
          source: value,
          sourceType: value,
          sourceScope: value === 'events' || value === 'groups' ? 'group' : 'global',
          preset: value === 'events' ? 'upcoming' : value === 'groups' ? 'featured' : 'latest',
        })}
      />
      <SelectInput label={t('preset')} value={preset} disabled={disabled} options={presetOptionsForSource(source, t)} onChange={(value) => updateContent({ preset: value })} />
      <SelectInput label={t('layout')} value={layout} disabled={disabled} options={[{ value: 'grid', label: t('grid') }, { value: 'list', label: t('list') }, { value: 'cards', label: t('cards') }, { value: 'carousel', label: t('carousel') }]} onChange={(value) => updateContent({ layout: value })} />
      <TextInput label={t('limit')} value={String(limit)} disabled={disabled} onChange={(value) => updateContent({ limit: Math.min(Math.max(parseInt(value) || 10, 1), 50) })} />
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  return (
    <section className={`${sectionSpacingClass(section)} rounded-lg border border-slate-200 bg-white px-4`}>
      <SectionHeader
        header={section.contentJson.header}
        titleFallback={mode === 'edit' ? t('previewNoTitle') : ''}
        subtitleFallback={mode === 'edit' ? t('previewNoSubtitle') : ''}
        disabled={!editable}
        onIconChange={editable ? (icon) => onUpdate?.(patchSectionHeader(section, { icon })) : undefined}
        onTitleChange={editable ? updateHeaderTitle : undefined}
        onSubtitleChange={editable ? updateHeaderSubtitle : undefined}
      />
      <SmartGroupListSection metadata={section.contentJson} groupId={groupId} compact={mode === 'edit'} />
      {mode === 'edit' && showProperties ? renderProperties() : null}
    </section>
  )
}

export default GroupListSectionBlock
