import { GroupListSection as SmartGroupListSection } from '../sections/GroupListSection'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import { PropertyPanel, SelectInput, TextInput, patchContent, patchLocalizedSectionHeader, patchSectionHeader, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'
import SectionHeader from './SectionHeader'
import { pageSectionShellClass, sectionSpacingClass } from './sectionPresets'
import {
  LIST_VIEW_SOURCES,
  listViewContentDefaultsForSource,
  listViewPresetForSource,
  normalizeListViewSource,
} from '../../utils/sectionSourcePresets'
import type { ListViewSource } from '../../types/page-editor'

const sourceFromContent = (content: Record<string, unknown>) => {
  const source = readText(content, 'source')
  if (source) return normalizeListViewSource(source)

  const sourceType = readText(content, 'sourceType') || 'sermons'
  return normalizeListViewSource(sourceType === 'subgroups' ? 'groups' : sourceType)
}

const presetOptionsForSource = (source: ListViewSource, t: ReturnType<typeof useUiText>) => {
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

  if (source === 'pages' || source === 'members' || source === 'contacts' || source === 'posts') {
    return [
      { value: 'latest', label: t('latest') },
      { value: 'all', label: t('all') },
    ]
  }

  return [{ value: 'all', label: t('all') }]
}

const GroupListSectionBlock = ({ section, mode, domId, disabled, editorPreview, previewDensity = 'full', propertiesOnly, showProperties = true, contextGroupId, page, onUpdate, allowGroupDataSources = true }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const source = sourceFromContent(section.contentJson)
  const preset = readText(section.contentJson, 'preset') || listViewPresetForSource(source)
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
        focusKey="list-source"
        label={t('contentSource')}
        value={source}
        disabled={disabled}
        options={LIST_VIEW_SOURCES.map((sourceOption) => ({ value: sourceOption, label: t(sourceOption) }))}
        onChange={(value) => {
          const nextSource = normalizeListViewSource(value)
          updateContent(listViewContentDefaultsForSource(nextSource, section.contentJson.header))
        }}
      />
      <SelectInput focusKey="list-preset" label={t('preset')} value={preset} disabled={disabled} options={presetOptionsForSource(source, t)} onChange={(value) => updateContent({ preset: value })} />
      <SelectInput focusKey="list-layout" label={t('layout')} value={layout} disabled={disabled} options={[{ value: 'grid', label: t('grid') }, { value: 'list', label: t('list') }, { value: 'cards', label: t('cards') }, { value: 'carousel', label: t('carousel') }, { value: 'coverflow', label: t('coverflow') }]} onChange={(value) => updateContent({ layout: value })} />
      <TextInput focusKey="list-limit" label={t('limit')} value={String(limit)} disabled={disabled} onChange={(value) => updateContent({ limit: Math.min(Math.max(parseInt(value) || 10, 1), 50) })} />
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  const compactPreview = previewDensity === 'compact' || editorPreview === true
  const hasSectionHeader = Boolean(section.contentJson.header && typeof section.contentJson.header === 'object' && !Array.isArray(section.contentJson.header))

  return (
    <section id={domId} className={pageSectionShellClass}>
      <div className={`mx-auto max-w-6xl ${sectionSpacingClass(section)} rounded-lg border border-slate-200 bg-white px-4`}>
        {hasSectionHeader ? (
          <SectionHeader
            header={section.contentJson.header}
            titleFallback={mode === 'edit' ? t('previewNoTitle') : ''}
            subtitleFallback={mode === 'edit' ? t('previewNoSubtitle') : ''}
            disabled={!editable}
            onIconChange={editable ? (icon) => onUpdate?.(patchSectionHeader(section, { icon })) : undefined}
            onTitleChange={editable ? updateHeaderTitle : undefined}
            onSubtitleChange={editable ? updateHeaderSubtitle : undefined}
          />
        ) : null}
        <SmartGroupListSection
          metadata={section.contentJson}
          groupId={groupId}
          compact={compactPreview}
          enabled={allowGroupDataSources || source === 'sermons'}
        />
        {mode === 'edit' && showProperties ? renderProperties() : null}
      </div>
    </section>
  )
}

export default GroupListSectionBlock
