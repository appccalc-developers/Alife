import { useUiText } from '../../i18n/uiText'
import AppActionButton from '../layout/AppActionButton'
import SectionBlock from '../page-sections/SectionBlock'
import { DEFAULT_HERO_ASPECT_RATIO, SelectInput, TextAreaInput, TextInput } from '../page-sections/sectionUtils'
import type { JsonMap, SectionEditModel, SectionType } from '../../types/page-editor'
import type { ListViewLayout, ListViewSource, SectionHeader, SectionIconKey, SectionSpacing, SpotlightDataSource } from '../../types'
import { SECTION_ICON_KEYS } from '../../types/models'
import { defaultSpotlightPreset, readSpotlightBinding, SPOTLIGHT_DATA_SOURCES } from '../../utils/spotlight'

type Props = {
  section: SectionEditModel
  index: number
  total: number
  canEdit: boolean
  typeError?: string
  onUpdate: (value: SectionEditModel) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  contextGroupId?: string
  isActive: boolean
  onSelect: () => void
}

const sectionTypes: SectionType[] = ['Hero', 'RichText', 'Spotlight', 'ListView']
const sectionTypeLabel = (type: SectionType) => {
  switch (type) {
    case 'RichText':
      return 'Rich Text'
    case 'ListView':
      return 'List View'
    default:
      return type
  }
}

const DEFAULT_HERO_IMAGE = 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1600&q=80'

const isJsonMap = (value: unknown): value is JsonMap => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const toHeaderText = (value: unknown): Record<string, string> => {
  if (typeof value === 'string') {
    return { en: value, cn: value }
  }

  if (isJsonMap(value)) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'string')) as Record<string, string>
  }

  return { en: '', cn: '' }
}

const createHeroHeader = (contentJson: JsonMap): SectionHeader => {
  const currentHeader = isJsonMap(contentJson.header) ? contentJson.header : {}
  const title = contentJson.title || contentJson.headline
  const subtitle = contentJson.body || contentJson.centerText || contentJson.subtitle || contentJson.subheadline
  const icon = typeof currentHeader.icon === 'string' && SECTION_ICON_KEYS.includes(currentHeader.icon as SectionIconKey) ? currentHeader.icon as SectionIconKey : undefined
  const align = currentHeader.align === 'left' || currentHeader.align === 'center' ? currentHeader.align : 'center'
  const scale = currentHeader.scale === 'compact' || currentHeader.scale === 'normal' || currentHeader.scale === 'feature' ? currentHeader.scale : 'normal'
  const tone =
    currentHeader.tone === 'default' ||
    currentHeader.tone === 'primary' ||
    currentHeader.tone === 'warm' ||
    currentHeader.tone === 'fresh' ||
    currentHeader.tone === 'rose'
      ? currentHeader.tone
      : 'default'

  return {
    ...(icon ? { icon } : {}),
    title: toHeaderText(currentHeader.title ?? title),
    subtitle: toHeaderText(currentHeader.subtitle ?? subtitle),
    align,
    scale,
    tone,
  }
}

const createDefaultHeader = (contentJson: JsonMap = {}): SectionHeader => ({
  title: toHeaderText(contentJson.title ?? contentJson.headline),
  subtitle: toHeaderText(contentJson.subtitle ?? contentJson.subheadline ?? contentJson.body ?? contentJson.centerText),
  align: 'center',
  scale: 'normal',
  tone: 'default',
})

const createDefaultSpacing = (value: unknown): SectionSpacing =>
  value === 'compact' || value === 'large' ? value : 'normal'

const readSpotlightSource = (contentJson: JsonMap): SpotlightDataSource | undefined => {
  const spotlight = readSpotlightBinding(contentJson)
  if (spotlight.mode === 'data') {
    return spotlight.source
  }

  const sourceType = String(contentJson.sourceType ?? contentJson.source ?? '').trim()
  return SPOTLIGHT_DATA_SOURCES.includes(sourceType as SpotlightDataSource) ? sourceType as SpotlightDataSource : undefined
}

const readHeader = (section: SectionEditModel): SectionHeader =>
  section.contentJson.header && typeof section.contentJson.header === 'object' && !Array.isArray(section.contentJson.header)
    ? { ...createDefaultHeader(section.contentJson), ...section.contentJson.header }
    : createDefaultHeader(section.contentJson)

const readHeaderTextValue = (header: SectionHeader, field: 'title' | 'subtitle', key: 'en' | 'cn') =>
  header[field]?.[key] ?? ''

const readLocalizedJsonValue = (source: JsonMap, field: string, key: 'en' | 'cn') => {
  const value = source[field]
  if (typeof value === 'string') {
    return key === 'en' ? value : ''
  }
  if (isJsonMap(value)) {
    const item = value[key]
    return typeof item === 'string' ? item : ''
  }
  return ''
}

const SectionCardEditor = ({ section, index, total, canEdit, typeError, onUpdate, onRemove, onMoveUp, onMoveDown, contextGroupId, isActive, onSelect }: Props) => {
  const t = useUiText()
  const patchSection = (patch: Partial<SectionEditModel>) => onUpdate({ ...section, ...patch })
  const patchContentJson = (patch: JsonMap) => patchSection({ contentJson: { ...section.contentJson, ...patch } })
  const patchHeader = (patch: Partial<SectionHeader>) => patchContentJson({ header: { ...readHeader(section), ...patch } })
  const patchLocalizedContentField = (field: string, key: 'en' | 'cn', value: string, aliases: string[] = []) => {
    const current = isJsonMap(section.contentJson[field]) ? section.contentJson[field] as JsonMap : {}
    const localized = { ...current, [key]: value }
    patchContentJson(Object.fromEntries([field, ...aliases].map((name) => [name, localized])))
  }
  const patchHeaderText = (field: 'title' | 'subtitle', key: 'en' | 'cn', value: string) => {
    const header = readHeader(section)
    patchHeader({
      [field]: {
        ...(header[field] ?? {}),
        [key]: value,
      },
    })
  }

  const applyTypeDefaults = (nextType: SectionEditModel['type']) => {
    if (nextType === '') {
      patchSection({ type: '' })
      return
    }

    if (nextType === 'RichText') {
      patchSection({
        type: 'RichText',
        contentJson: {
          ...section.contentJson,
          header: readHeader(section),
          spacing: createDefaultSpacing(section.contentJson.spacing),
          title: (section.contentJson.title as string) || '',
          subtitle: (section.contentJson.subtitle as string) || '',
          text: (section.contentJson.text as string) || '',
        },
        styleJson: {},
      })
      return
    }

    if (nextType === 'ListView') {
      patchSection({
        type: 'ListView',
        contentJson: {
          ...section.contentJson,
          header: readHeader(section),
          spacing: createDefaultSpacing(section.contentJson.spacing),
          source: ((section.contentJson.source as string) || (section.contentJson.sourceType === 'subgroups' ? 'groups' : section.contentJson.sourceType as string) || 'sermons') as ListViewSource,
          preset: (section.contentJson.preset as string) || 'latest',
          layout: ((section.contentJson.layout as string) || 'grid') as ListViewLayout,
          sourceType: (section.contentJson.sourceType as string) || (section.contentJson.source as string) || 'sermons',
          sourceScope: (section.contentJson.sourceScope as string) || 'global',
          limit: typeof section.contentJson.limit === 'number' ? section.contentJson.limit : 10,
          sortBy: (section.contentJson.sortBy as string) || 'date',
          sortDirection: (section.contentJson.sortDirection as string) || 'desc',
        },
        styleJson: {},
      })
      return
    }

    if (nextType === 'Spotlight') {
      const source = readSpotlightSource(section.contentJson)
      const spotlight = source
        ? {
          mode: 'data' as const,
          source,
          preset: (section.contentJson.preset as string) || defaultSpotlightPreset(source),
          ...(typeof section.contentJson.itemId === 'string' && section.contentJson.itemId.trim() ? { itemId: section.contentJson.itemId.trim() } : {}),
        }
        : readSpotlightBinding(section.contentJson)
      patchSection({
        type: 'Spotlight',
        contentJson: {
          ...section.contentJson,
          header: readHeader(section),
          spacing: createDefaultSpacing(section.contentJson.spacing),
          spotlight,
          media: {
            type: (section.contentJson.youtubeUrl as string) ? 'youtube' : 'image',
            url:
              (section.contentJson.youtubeUrl as string) ||
              (section.contentJson.imageUrl as string) ||
              (section.contentJson.backgroundImage as string) ||
              (section.contentJson.backgroundImageUrl as string) ||
              DEFAULT_HERO_IMAGE,
            position: section.styleJson.mediaPosition === 'right' || section.styleJson.imagePosition === 'right' ? 'right' : 'left',
          },
          imageUrl:
            (section.contentJson.imageUrl as string) ||
            (section.contentJson.backgroundImage as string) ||
            (section.contentJson.backgroundImageUrl as string) ||
            DEFAULT_HERO_IMAGE,
          backgroundImage:
            (section.contentJson.backgroundImage as string) ||
            (section.contentJson.imageUrl as string) ||
            (section.contentJson.backgroundImageUrl as string) ||
            DEFAULT_HERO_IMAGE,
          backgroundImageUrl:
            (section.contentJson.backgroundImageUrl as string) ||
            (section.contentJson.imageUrl as string) ||
            (section.contentJson.backgroundImage as string) ||
            DEFAULT_HERO_IMAGE,
          title: (section.contentJson.title as string) || (section.contentJson.headline as string) || '',
          headline: (section.contentJson.headline as string) || (section.contentJson.title as string) || '',
          subtitle: (section.contentJson.subtitle as string) || (section.contentJson.subheadline as string) || '',
          subheadline: (section.contentJson.subheadline as string) || (section.contentJson.subtitle as string) || '',
          centerText: (section.contentJson.centerText as string) || (section.contentJson.body as string) || '',
          body: (section.contentJson.body as string) || (section.contentJson.centerText as string) || '',
          youtubeUrl: (section.contentJson.youtubeUrl as string) || '',
          linkLabel: (section.contentJson.linkLabel as string) || (section.contentJson.linkText as string) || (section.contentJson.ctaLabel as string) || '',
          linkText: (section.contentJson.linkText as string) || (section.contentJson.linkLabel as string) || (section.contentJson.ctaLabel as string) || '',
          ctaLabel: (section.contentJson.ctaLabel as string) || (section.contentJson.linkLabel as string) || (section.contentJson.linkText as string) || '',
          linkUrl: (section.contentJson.linkUrl as string) || (section.contentJson.ctaUrl as string) || (section.contentJson.href as string) || '',
          ctaUrl: (section.contentJson.ctaUrl as string) || (section.contentJson.linkUrl as string) || (section.contentJson.href as string) || '',
          href: (section.contentJson.href as string) || (section.contentJson.linkUrl as string) || (section.contentJson.ctaUrl as string) || '',
        },
        styleJson: {
          ...section.styleJson,
          layout: 'spotlight',
          mediaPosition: (section.styleJson.mediaPosition as string) || (section.styleJson.imagePosition as string) || 'left',
          imagePosition: (section.styleJson.imagePosition as string) || (section.styleJson.mediaPosition as string) || 'left',
        },
      })
      return
    }

    if (nextType === 'Sermon') {
      patchSection({
        type: 'Sermon',
        contentJson: {
          ...section.contentJson,
          title: (section.contentJson.title as string) || '',
          youtubeUrl: (section.contentJson.youtubeUrl as string) || '',
        },
        styleJson: {},
      })
      return
    }

    patchSection({
      type: 'Hero',
      contentJson: {
        ...section.contentJson,
        header: createHeroHeader(section.contentJson),
        spacing: createDefaultSpacing(section.contentJson.spacing),
        backgroundImage: (section.contentJson.backgroundImage as string) || (section.contentJson.backgroundImageUrl as string) || DEFAULT_HERO_IMAGE,
        backgroundImageUrl: (section.contentJson.backgroundImageUrl as string) || (section.contentJson.backgroundImage as string) || DEFAULT_HERO_IMAGE,
        title: (section.contentJson.title as string) || (section.contentJson.headline as string) || '',
        headline: (section.contentJson.headline as string) || (section.contentJson.title as string) || '',
        subtitle: (section.contentJson.subtitle as string) || (section.contentJson.subheadline as string) || '',
        subheadline: (section.contentJson.subheadline as string) || (section.contentJson.subtitle as string) || '',
        centerText: (section.contentJson.centerText as string) || (section.contentJson.body as string) || '',
        body: (section.contentJson.body as string) || (section.contentJson.centerText as string) || '',
        linkLabel:
          (section.contentJson.linkLabel as string) ||
          (section.contentJson.linkText as string) ||
          (section.contentJson.ctaLabel as string) ||
          '',
        linkText:
          (section.contentJson.linkText as string) ||
          (section.contentJson.linkLabel as string) ||
          (section.contentJson.ctaLabel as string) ||
          '',
        ctaLabel:
          (section.contentJson.ctaLabel as string) ||
          (section.contentJson.linkLabel as string) ||
          (section.contentJson.linkText as string) ||
          '',
        linkUrl:
          (section.contentJson.linkUrl as string) ||
          (section.contentJson.ctaUrl as string) ||
          (section.contentJson.href as string) ||
          '',
        ctaUrl:
          (section.contentJson.ctaUrl as string) ||
          (section.contentJson.linkUrl as string) ||
          (section.contentJson.href as string) ||
          '',
        href:
          (section.contentJson.href as string) ||
          (section.contentJson.linkUrl as string) ||
          (section.contentJson.ctaUrl as string) ||
          '',
      },
      styleJson: {
        ...section.styleJson,
        layout: 'featured',
        aspectRatio: DEFAULT_HERO_ASPECT_RATIO,
        imagePosition: (section.styleJson.imagePosition as string) || 'right',
      },
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm outline-none transition ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : 'cursor-pointer hover:ring-2 hover:ring-blue-200 hover:ring-offset-2'}`}
      onClick={(event) => {
        if (!isActive && (event.target as HTMLElement).closest('a')) {
          event.preventDefault()
        }
        onSelect()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      {isActive ? (<>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{t('sectionHeading', { number: index + 1, type: section.type || t('selectType') })}</h3>
        {isActive ? <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <AppActionButton size="sm" disabled={index === 0 || !canEdit} onClick={onMoveUp}>{t('moveUp')}</AppActionButton>
          <AppActionButton size="sm" disabled={index === total - 1 || !canEdit} onClick={onMoveDown}>{t('moveDown')}</AppActionButton>
          <AppActionButton size="sm" variant="danger" disabled={!canEdit} onClick={onRemove}>{t('remove')}</AppActionButton>
        </div> : null}
      </div>
      <div className="border-t border-slate-100 px-4 py-3" onClick={(event) => event.stopPropagation()}>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">{t('sectionType')}</span>
          <select
            value={section.type}
            disabled={!canEdit}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            onChange={(event) => applyTypeDefaults(event.target.value as SectionEditModel['type'])}
          >
            <option value="">{t('selectType')}</option>
            {sectionTypes.map((sectionType) => (
              <option key={sectionType} value={sectionType}>{sectionTypeLabel(sectionType)}</option>
            ))}
          </select>
          {typeError ? <p className="text-xs text-red-600">{typeError}</p> : null}
        </label>
      </div>
      {section.type ? (
        <div className="border-t border-slate-100 px-4 py-3" onClick={(event) => event.stopPropagation()}>
          <div className="mb-3">
            <p className="text-sm font-semibold text-slate-900">{t('sectionHeader')}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <SelectInput
              label={t('icon')}
              value={readHeader(section).icon ?? ''}
              disabled={!canEdit}
              options={[
                { value: '', label: t('none') },
                ...SECTION_ICON_KEYS.map((icon) => ({ value: icon, label: icon })),
              ]}
              onChange={(value) => patchHeader({ icon: value ? value as SectionIconKey : undefined })}
            />
            <SelectInput
              label={t('spacing')}
              value={createDefaultSpacing(section.contentJson.spacing)}
              disabled={!canEdit}
              options={[
                { value: 'compact', label: t('compact') },
                { value: 'normal', label: t('normal') },
                { value: 'large', label: t('large') },
              ]}
              onChange={(value) => patchContentJson({ spacing: value })}
            />
            <TextInput label={t('titleEnglish')} value={readHeaderTextValue(readHeader(section), 'title', 'en')} disabled={!canEdit} onChange={(value) => patchHeaderText('title', 'en', value)} />
            <TextInput label={t('titleChinese')} value={readHeaderTextValue(readHeader(section), 'title', 'cn')} disabled={!canEdit} onChange={(value) => patchHeaderText('title', 'cn', value)} />
            <TextInput label={t('subtitleEnglish')} value={readHeaderTextValue(readHeader(section), 'subtitle', 'en')} disabled={!canEdit} onChange={(value) => patchHeaderText('subtitle', 'en', value)} />
            <TextInput label={t('subtitleChinese')} value={readHeaderTextValue(readHeader(section), 'subtitle', 'cn')} disabled={!canEdit} onChange={(value) => patchHeaderText('subtitle', 'cn', value)} />
            <SelectInput
              label={t('alignment')}
              value={readHeader(section).align ?? 'center'}
              disabled={!canEdit}
              options={[{ value: 'left', label: t('left') }, { value: 'center', label: t('center') }]}
              onChange={(value) => patchHeader({ align: value as SectionHeader['align'] })}
            />
            <SelectInput
              label={t('scale')}
              value={readHeader(section).scale ?? 'normal'}
              disabled={!canEdit}
              options={[
                { value: 'compact', label: t('compact') },
                { value: 'normal', label: t('normal') },
                { value: 'feature', label: t('feature') },
              ]}
              onChange={(value) => patchHeader({ scale: value as SectionHeader['scale'] })}
            />
            <SelectInput
              label={t('tone')}
              value={readHeader(section).tone ?? 'default'}
              disabled={!canEdit}
              options={[
                { value: 'default', label: t('defaultTone') },
                { value: 'primary', label: t('primary') },
                { value: 'warm', label: t('warm') },
                { value: 'fresh', label: t('fresh') },
                { value: 'rose', label: t('rose') },
              ]}
              onChange={(value) => patchHeader({ tone: value as SectionHeader['tone'] })}
            />
          </div>
          {section.type === 'RichText' ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <TextAreaInput label={t('bodyEnglish')} value={readLocalizedJsonValue(section.contentJson, 'text', 'en')} disabled={!canEdit} onChange={(value) => patchLocalizedContentField('text', 'en', value)} />
              <TextAreaInput label={t('bodyChinese')} value={readLocalizedJsonValue(section.contentJson, 'text', 'cn')} disabled={!canEdit} onChange={(value) => patchLocalizedContentField('text', 'cn', value)} />
            </div>
          ) : null}
          {section.type === 'Spotlight' ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <TextAreaInput label={t('bodyEnglish')} value={readLocalizedJsonValue(section.contentJson, 'body', 'en')} disabled={!canEdit} onChange={(value) => patchLocalizedContentField('body', 'en', value, ['centerText', 'text'])} />
              <TextAreaInput label={t('bodyChinese')} value={readLocalizedJsonValue(section.contentJson, 'body', 'cn')} disabled={!canEdit} onChange={(value) => patchLocalizedContentField('body', 'cn', value, ['centerText', 'text'])} />
            </div>
          ) : null}
        </div>
      ) : null}
      </>) : null}

      <div className="border-t border-slate-100" onClick={(event) => isActive && event.stopPropagation()}>
        <SectionBlock
          section={section}
          mode={isActive ? 'edit' : 'render'}
          disabled={!canEdit}
          contextGroupId={contextGroupId}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  )
}

export default SectionCardEditor
