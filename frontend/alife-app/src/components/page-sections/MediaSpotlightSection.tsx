import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { EditableText, PropertyPanel, SelectInput, TextInput, patchContent, patchLocalizedContent, patchStyle, readLocalizedText, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'

const MediaSpotlightSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const editable = mode === 'edit' && !disabled && onUpdate
  const title = readLocalizedText(section.contentJson, auth.language, 'title', 'headline')
  const subtitle = readLocalizedText(section.contentJson, auth.language, 'subtitle', 'subheadline')
  const body = readLocalizedText(section.contentJson, auth.language, 'centerText', 'body')
  const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
  const linkLabel = readLocalizedText(section.contentJson, auth.language, 'linkLabel', 'linkText', 'ctaLabel')
  const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
  const imagePosition = readText(section.styleJson, 'imagePosition') === 'left' ? 'left' : 'right'
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))
  const updateStyle = (patch: Record<string, unknown>) => onUpdate?.(patchStyle(section, patch))

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 md:items-center">
        <div className={`order-2 ${imagePosition === 'left' ? 'md:order-2' : ''}`}>
          <EditableText as="h2" value={title} fallback={t('heroSectionTitle')} disabled={!editable} className="text-2xl font-semibold text-slate-800 sm:text-4xl" onChange={(value) => updateLocalizedContent({ title: value, headline: value })} />
          <EditableText as="p" multiline value={body || subtitle} fallback={t('noHeroContentYet')} disabled={!editable} className="mt-2 block text-base text-slate-700" onChange={(value) => updateLocalizedContent({ centerText: value, body: value, subtitle: value, subheadline: value })} />
          {linkUrl || mode === 'edit' ? (
            <a href={mode === 'render' ? linkUrl : undefined} target={mode === 'render' && linkUrl ? '_blank' : undefined} rel={mode === 'render' && linkUrl ? 'noopener noreferrer' : undefined} className="mt-4 inline-flex rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400" onClick={(event) => mode === 'edit' && event.preventDefault()}>
              <EditableText value={linkLabel} fallback={linkUrl || t('readMore')} disabled={!editable} className="text-sm" onChange={(value) => updateLocalizedContent({ linkLabel: value, linkText: value, ctaLabel: value })} />
            </a>
          ) : null}
        </div>
        <div className={`order-1 ${imagePosition === 'left' ? 'md:order-1' : ''}`}>
          {bg ? <img src={bg} alt="" className="h-48 w-full rounded-lg object-cover sm:h-[220px] md:h-[280px]" /> : <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500 sm:h-[220px] md:h-[280px]">{t('noImageYet')}</div>}
        </div>
      </div>
      {mode === 'edit' ? (
        <PropertyPanel>
          <SelectInput label={t('imagePosition')} value={imagePosition} disabled={disabled} options={[{ value: 'left', label: t('left') }, { value: 'right', label: t('right') }]} onChange={(value) => updateStyle({ imagePosition: value })} />
          <TextInput label={t('buttonLinkUrl')} value={linkUrl} disabled={disabled} onChange={(value) => updateContent({ linkUrl: value, ctaUrl: value, href: value })} />
          <TextInput label={t('imageUrl')} value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default MediaSpotlightSection
