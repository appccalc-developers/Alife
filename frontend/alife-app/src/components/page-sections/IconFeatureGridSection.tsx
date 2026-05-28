import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { EditableText, PropertyPanel, SelectInput, TextInput, patchContent, patchLocalizedContent, patchStyle, readLocalizedText, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'

type IconItem = { imageUrl: string; label: string; linkUrl: string }

const parseItems = (raw: unknown): IconItem[] =>
  Array.isArray(raw)
    ? raw.map((item) => {
      const obj = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return {
        imageUrl: typeof obj.imageUrl === 'string' ? obj.imageUrl : '',
        label: typeof obj.label === 'string' ? obj.label : '',
        linkUrl: typeof obj.linkUrl === 'string' ? obj.linkUrl : '',
      }
    }).filter((item) => item.imageUrl || item.label || item.linkUrl)
    : []

const IconFeatureGridSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const editable = mode === 'edit' && !disabled && onUpdate
  const title = readLocalizedText(section.contentJson, auth.language, 'title', 'headline')
  const subtitle = readLocalizedText(section.contentJson, auth.language, 'subtitle', 'subheadline')
  const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
  const displayStyle = readText(section.styleJson, 'displayStyle') === 'newsGrid' ? 'newsGrid' : 'iconGrid'
  const imageShape = readText(section.styleJson, 'imageShape') === 'circle' ? 'circle' : 'square'
  const items = parseItems(section.contentJson.iconItems)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))
  const updateStyle = (patch: Record<string, unknown>) => onUpdate?.(patchStyle(section, patch))

  if (displayStyle === 'newsGrid') {
    return (
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <div className="px-5 py-8">
          <div className="mx-auto max-w-5xl text-center">
            <EditableText as="h2" value={title} fallback={t('latestNews')} disabled={!editable} className="text-2xl font-semibold text-slate-700 sm:text-4xl" onChange={(value) => updateLocalizedContent({ title: value, headline: value })} />
            <EditableText as="p" value={subtitle} fallback={t('godLovesUsAll')} disabled={!editable} className="mt-1 block text-base text-slate-500 sm:text-lg" onChange={(value) => updateLocalizedContent({ subtitle: value, subheadline: value })} />
            <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              {(items.length ? items : [{ imageUrl: '', label: '[title]', linkUrl: '' }]).map((item, idx) => (
                <a key={`news-${idx}`} href={mode === 'render' ? item.linkUrl || undefined : undefined} target={mode === 'render' && item.linkUrl ? '_blank' : undefined} rel={mode === 'render' && item.linkUrl ? 'noopener noreferrer' : undefined} className="flex flex-col items-center gap-3" onClick={(event) => mode === 'edit' && event.preventDefault()}>
                  {item.imageUrl ? <img src={item.imageUrl} alt="" className={imageShape === 'circle' ? 'h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32' : 'h-28 w-full rounded-sm object-cover sm:h-40'} /> : <div className={imageShape === 'circle' ? 'flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 sm:h-32 sm:w-32' : 'flex h-28 w-full items-center justify-center rounded-sm border border-dashed border-slate-300 text-slate-400 sm:h-40'}>+</div>}
                  <span className="text-center text-xl text-slate-800 sm:text-3xl">{item.label || t('untitled')}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
        {mode === 'edit' ? <IconControls sectionItems={items} disabled={disabled} displayStyle={displayStyle} imageShape={imageShape} bg={bg} updateContent={updateContent} updateStyle={updateStyle} /> : null}
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <div className="bg-cover bg-center px-5 py-10 text-white" style={{ backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.7)), url(${bg})` }}>
        <div className="mx-auto max-w-4xl text-center">
          <EditableText as="h2" value={title} fallback={t('churchMainActivities')} disabled={!editable} className="text-2xl font-semibold sm:text-4xl" onChange={(value) => updateLocalizedContent({ title: value, headline: value })} />
          <EditableText as="p" value={subtitle} fallback={t('godLovesUsAll')} disabled={!editable} className="mt-2 block text-base text-slate-200 sm:text-lg" onChange={(value) => updateLocalizedContent({ subtitle: value, subheadline: value })} />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {(items.length ? items : [{ imageUrl: '', label: t('untitled'), linkUrl: '' }]).map((item, idx) => (
              <a key={`icon-${idx}`} href={mode === 'render' ? item.linkUrl || undefined : undefined} target={mode === 'render' && item.linkUrl ? '_blank' : undefined} rel={mode === 'render' && item.linkUrl ? 'noopener noreferrer' : undefined} className="flex flex-col items-center gap-2 rounded px-2 py-2 hover:bg-white/10" onClick={(event) => mode === 'edit' && event.preventDefault()}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" className={imageShape === 'circle' ? 'h-10 w-10 rounded-full object-cover' : 'h-10 w-10 object-contain'} /> : null}
                <span className="text-sm text-slate-100">{item.label || t('untitled')}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      {mode === 'edit' ? <IconControls sectionItems={items} disabled={disabled} displayStyle={displayStyle} imageShape={imageShape} bg={bg} updateContent={updateContent} updateStyle={updateStyle} /> : null}
    </section>
  )
}

const IconControls = ({ sectionItems, disabled, displayStyle, imageShape, bg, updateContent, updateStyle }: {
  sectionItems: IconItem[]
  disabled?: boolean
  displayStyle: string
  imageShape: string
  bg: string
  updateContent: (patch: Record<string, unknown>) => void
  updateStyle: (patch: Record<string, unknown>) => void
}) => {
  const t = useUiText()

  return (
    <PropertyPanel>
      <SelectInput label={t('displayStyle')} value={displayStyle} disabled={disabled} options={[{ value: 'iconGrid', label: t('iconGrid') }, { value: 'newsGrid', label: t('newsGrid') }]} onChange={(value) => updateStyle({ displayStyle: value })} />
      <SelectInput label={t('imageShape')} value={imageShape} disabled={disabled} options={[{ value: 'square', label: t('square') }, { value: 'circle', label: t('circle') }]} onChange={(value) => updateStyle({ imageShape: value })} />
      <TextInput label={t('backgroundImageUrl')} value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} />
      <label className="block space-y-1 md:col-span-2">
        <span className="text-xs font-medium text-slate-600">{t('itemsJson')}</span>
        <textarea value={JSON.stringify(sectionItems, null, 2)} disabled={disabled} className="min-h-28 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs disabled:bg-slate-100" onChange={(event) => {
          try {
            updateContent({ iconItems: JSON.parse(event.target.value) as unknown })
          } catch {
            updateContent({ iconItems: sectionItems })
          }
        }} />
      </label>
    </PropertyPanel>
  )
}

export default IconFeatureGridSection
