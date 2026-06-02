import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import {
  EditableText,
  PropertyPanel,
  SelectInput,
  TextInput,
  patchContent,
  patchLocalizedContent,
  patchStyle,
  readLocalizedText,
  readText,
  toYouTubeEmbedUrl,
} from './sectionUtils'
import type { SectionComponentProps } from './types'

const SpotlightSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const editable = mode === 'edit' && !disabled && onUpdate
  const title = readLocalizedText(section.contentJson, auth.language, 'title', 'headline')
  const subtitle = readLocalizedText(section.contentJson, auth.language, 'subtitle', 'subheadline')
  const body = readLocalizedText(section.contentJson, auth.language, 'centerText', 'body', 'text')
  const imageUrl = readText(section.contentJson, 'imageUrl', 'backgroundImage', 'backgroundImageUrl')
  const youtubeUrl = readText(section.contentJson, 'youtubeUrl')
  const linkLabel = readLocalizedText(section.contentJson, auth.language, 'linkLabel', 'linkText', 'ctaLabel')
  const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
  const mediaPosition = readText(section.styleJson, 'mediaPosition', 'imagePosition') === 'right' ? 'right' : 'left'
  const embedUrl = toYouTubeEmbedUrl(youtubeUrl)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))
  const updateStyle = (patch: Record<string, unknown>) => onUpdate?.(patchStyle(section, patch))

  const media = embedUrl ? (
    <iframe
      src={embedUrl}
      referrerPolicy="strict-origin-when-cross-origin"
      title={title || t('sermonVideoPreview')}
      className="aspect-video w-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  ) : imageUrl ? (
    <img src={imageUrl} alt="" className="h-48 w-full object-cover sm:h-[240px] md:h-[300px]" />
  ) : (
    <div className="flex aspect-video w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      {t('noImageYet')}
    </div>
  )

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid gap-0 md:grid-cols-2 md:items-stretch">
        <div className={`overflow-hidden bg-slate-100 ${mediaPosition === 'right' ? 'md:order-2' : 'md:order-1'}`}>
          {media}
        </div>
        <div className={`flex flex-col justify-center p-5 sm:p-7 ${mediaPosition === 'right' ? 'md:order-1' : 'md:order-2'}`}>
          <EditableText
            as="h2"
            value={title}
            fallback={t('heroSectionTitle')}
            disabled={!editable}
            className="text-2xl font-semibold text-slate-900 sm:text-4xl"
            onChange={(value) => updateLocalizedContent({ title: value, headline: value })}
          />
          <EditableText
            as="p"
            value={subtitle}
            fallback={t('noSubtitleYet')}
            disabled={!editable}
            className="mt-2 block text-sm font-medium text-slate-500"
            onChange={(value) => updateLocalizedContent({ subtitle: value, subheadline: value })}
          />
          <EditableText
            as="p"
            multiline
            value={body}
            fallback={t('noHeroContentYet')}
            disabled={!editable}
            className="mt-4 block whitespace-pre-wrap text-base leading-7 text-slate-700"
            onChange={(value) => updateLocalizedContent({ centerText: value, body: value, text: value })}
          />
          {linkUrl || mode === 'edit' ? (
            <a
              href={mode === 'render' ? linkUrl : undefined}
              target={mode === 'render' && linkUrl ? '_blank' : undefined}
              rel={mode === 'render' && linkUrl ? 'noopener noreferrer' : undefined}
              className="mt-5 inline-flex w-fit rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400"
              onClick={(event) => mode === 'edit' && event.preventDefault()}
            >
              <EditableText
                value={linkLabel}
                fallback={linkUrl || t('readMore')}
                disabled={!editable}
                className="text-sm"
                onChange={(value) => updateLocalizedContent({ linkLabel: value, linkText: value, ctaLabel: value })}
              />
            </a>
          ) : null}
        </div>
      </div>
      {mode === 'edit' ? (
        <PropertyPanel>
          <SelectInput
            label={t('imagePosition')}
            value={mediaPosition}
            disabled={disabled}
            options={[{ value: 'left', label: t('left') }, { value: 'right', label: t('right') }]}
            onChange={(value) => updateStyle({ mediaPosition: value, imagePosition: value, layout: 'spotlight' })}
          />
          <TextInput label={t('youtubeUrl')} value={youtubeUrl} disabled={disabled} onChange={(value) => updateContent({ youtubeUrl: value })} />
          <TextInput
            label={t('imageUrl')}
            value={imageUrl}
            disabled={disabled}
            onChange={(value) => updateContent({ imageUrl: value, backgroundImage: value, backgroundImageUrl: value })}
          />
          <TextInput label={t('buttonLinkUrl')} value={linkUrl} disabled={disabled} onChange={(value) => updateContent({ linkUrl: value, ctaUrl: value, href: value })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default SpotlightSection
