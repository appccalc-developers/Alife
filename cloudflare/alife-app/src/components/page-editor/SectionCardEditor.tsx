import { useState } from 'react'
import { useUiText } from '../../i18n/uiText'
import AppActionButton from '../layout/AppActionButton'
import SectionBlock from '../page-sections/SectionBlock'
import { SelectInput } from '../page-sections/sectionUtils'
import type { JsonMap, SectionEditModel, SectionType } from '../../types/page-editor'
import type { SectionHeader, SectionSpacing } from '../../types'

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

const isJsonMap = (value: unknown): value is JsonMap => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const toHeaderText = (value: unknown): Record<string, string> => {
  if (typeof value === 'string') {
    return { en: value, zh: value }
  }

  if (isJsonMap(value)) {
    return {
      en: typeof value.en === 'string' ? value.en : '',
      zh: typeof value.zh === 'string' ? value.zh : '',
    }
  }

  return { en: '', zh: '' }
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

const readHeader = (section: SectionEditModel): SectionHeader =>
  section.contentJson.header && typeof section.contentJson.header === 'object' && !Array.isArray(section.contentJson.header)
    ? { ...createDefaultHeader(section.contentJson), ...section.contentJson.header }
    : createDefaultHeader(section.contentJson)

const SectionCardEditor = ({ section, index, total, canEdit, typeError, onUpdate, onRemove, onMoveUp, onMoveDown, contextGroupId, isActive, onSelect }: Props) => {
  const t = useUiText()
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [propertyTab, setPropertyTab] = useState<'common' | 'section'>('common')
  const patchSection = (patch: Partial<SectionEditModel>) => onUpdate({ ...section, ...patch })
  const patchContentJson = (patch: JsonMap) => patchSection({ contentJson: { ...section.contentJson, ...patch } })
  const patchHeader = (patch: Partial<SectionHeader>) => patchContentJson({ header: { ...readHeader(section), ...patch } })
  const header = readHeader(section)
  const renderCommonProperties = () => (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="block space-y-1">
        <span className="text-xs font-medium text-slate-600">{t('sectionType')}</span>
        <div className="flex h-9 items-center rounded border border-slate-300 bg-slate-50 px-2 text-sm text-slate-700">
          {section.type ? sectionTypeLabel(section.type) : t('selectType')}
        </div>
        <p className="text-xs text-slate-500">{t('sectionTypeLocked')}</p>
        {typeError ? <p className="text-xs text-red-600">{typeError}</p> : null}
      </div>
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
      <SelectInput
        label={t('alignment')}
        value={header.align ?? 'center'}
        disabled={!canEdit}
        options={[{ value: 'left', label: t('left') }, { value: 'center', label: t('center') }]}
        onChange={(value) => patchHeader({ align: value as SectionHeader['align'] })}
      />
      <SelectInput
        label={t('scale')}
        value={header.scale ?? 'normal'}
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
        value={header.tone ?? 'default'}
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
  )
  const openProperties = () => {
    setPropertyTab('common')
    setPropertiesOpen(true)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm outline-none transition ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : 'cursor-pointer hover:ring-2 hover:ring-blue-200 hover:ring-offset-2'}`}
      onClick={(event) => {
        if (!isActive && (event.target as HTMLElement).closest('a')) {
          event.preventDefault()
        }
        onSelect()
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      {isActive ? (<>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t('sectionHeading', { number: index + 1, type: section.type || t('selectType') })}</h3>
          {typeError ? <p className="mt-1 text-xs text-red-600">{typeError}</p> : null}
        </div>
        {isActive ? <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <AppActionButton size="sm" disabled={!section.type} onClick={openProperties}>{t('properties')}</AppActionButton>
          <AppActionButton size="sm" disabled={index === 0 || !canEdit} onClick={onMoveUp}>{t('moveUp')}</AppActionButton>
          <AppActionButton size="sm" disabled={index === total - 1 || !canEdit} onClick={onMoveDown}>{t('moveDown')}</AppActionButton>
          <AppActionButton size="sm" variant="danger" disabled={!canEdit} onClick={onRemove}>{t('remove')}</AppActionButton>
        </div> : null}
      </div>
      </>) : null}

      <div className="min-w-0 border-t border-slate-100" onClick={(event) => isActive && event.stopPropagation()}>
        <SectionBlock
          section={section}
          mode={isActive ? 'edit' : 'render'}
          disabled={!canEdit}
          editorPreview
          contextGroupId={contextGroupId}
          onUpdate={onUpdate}
          showProperties={false}
        />
      </div>
      {propertiesOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 py-5 sm:items-center sm:justify-center" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="absolute inset-0" aria-label={t('close')} onClick={() => setPropertiesOpen(false)} />
          <section className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">{t('properties')}</h2>
                <p className="text-sm text-slate-500">{section.type ? sectionTypeLabel(section.type) : t('selectType')}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setPropertiesOpen(false)}
              >
                {t('close')}
              </button>
            </div>
            <div className="border-b border-slate-200 px-5 pt-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium ${propertyTab === 'common' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  onClick={() => setPropertyTab('common')}
                >
                  {t('commonProperties')}
                </button>
                <button
                  type="button"
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium ${propertyTab === 'section' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  onClick={() => setPropertyTab('section')}
                >
                  {t('sectionProperties')}
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {propertyTab === 'common' ? renderCommonProperties() : (
                <SectionBlock
                  section={section}
                  mode="edit"
                  disabled={!canEdit}
                  contextGroupId={contextGroupId}
                  onUpdate={onUpdate}
                  propertiesOnly
                />
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default SectionCardEditor
