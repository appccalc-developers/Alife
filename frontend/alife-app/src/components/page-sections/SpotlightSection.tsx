import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import {
  EditableText,
  PropertyPanel,
  SelectInput,
  TextInput,
  patchContent,
  patchLocalizedContent,
  patchLocalizedSectionHeader,
  readLocalizedText,
  readText,
  toYouTubeEmbedUrl,
} from './sectionUtils'
import type { SectionComponentProps } from './types'
import SectionHeader from './SectionHeader'
import { sectionSpacingClass } from './sectionPresets'

const readMediaConfig = (source: Record<string, unknown>, style: Record<string, unknown>) => {
  const media = source.media && typeof source.media === 'object' && !Array.isArray(source.media)
    ? source.media as Record<string, unknown>
    : {}
  const youtubeUrl = typeof media.url === 'string' && media.type === 'youtube'
    ? media.url
    : readText(source, 'youtubeUrl')
  const imageUrl = typeof media.url === 'string' && media.type === 'image'
    ? media.url
    : readText(source, 'imageUrl', 'backgroundImage', 'backgroundImageUrl')
  const type = media.type === 'youtube' || youtubeUrl ? 'youtube' : 'image'
  const url = type === 'youtube' ? youtubeUrl : imageUrl
  const position = media.position === 'right' || readText(style, 'mediaPosition', 'imagePosition') === 'right' ? 'right' : 'left'

  return { type, url, position, youtubeUrl, imageUrl }
}

const SpotlightSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const editable = mode === 'edit' && !disabled && onUpdate
  const title = readLocalizedText(section.contentJson, auth.language, 'title', 'headline')
  const subtitle = readLocalizedText(section.contentJson, auth.language, 'subtitle', 'subheadline')
  const body = readLocalizedText(section.contentJson, auth.language, 'centerText', 'body', 'text')
  const mediaConfig = readMediaConfig(section.contentJson, section.styleJson)
  const imageUrl = mediaConfig.imageUrl
  const youtubeUrl = mediaConfig.youtubeUrl
  const linkLabel = readLocalizedText(section.contentJson, auth.language, 'linkLabel', 'linkText', 'ctaLabel')
  const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
  const mediaPosition = mediaConfig.position
  const embedUrl = toYouTubeEmbedUrl(youtubeUrl)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))
  const updateHeaderTitle = (value: string) => {
    const nextSection = patchLocalizedContent(section, auth.language, { title: value, headline: value })
    onUpdate?.(patchLocalizedSectionHeader(nextSection, auth.language, 'title', value))
  }
  const updateHeaderSubtitle = (value: string) => {
    const nextSection = patchLocalizedContent(section, auth.language, { subtitle: value, subheadline: value })
    onUpdate?.(patchLocalizedSectionHeader(nextSection, auth.language, 'subtitle', value))
  }
  const updateMedia = (patch: Record<string, unknown>) => {
    const currentMedia = section.contentJson.media && typeof section.contentJson.media === 'object' && !Array.isArray(section.contentJson.media)
      ? section.contentJson.media
      : {}
    updateContent({ media: { ...currentMedia, ...patch } })
  }
  const mediaWith = (patch: Record<string, unknown>) => {
    const currentMedia = section.contentJson.media && typeof section.contentJson.media === 'object' && !Array.isArray(section.contentJson.media)
      ? section.contentJson.media
      : {}
    return { ...currentMedia, ...patch }
  }

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
    <section className={`${sectionSpacingClass(section)} rounded-lg border border-slate-200 bg-white px-4`}>
      <SectionHeader
        header={section.contentJson.header}
        titleFallback={title}
        subtitleFallback={subtitle}
        disabled={!editable}
        onTitleChange={editable ? updateHeaderTitle : undefined}
        onSubtitleChange={editable ? updateHeaderSubtitle : undefined}
      />
      <div className="grid gap-0 md:grid-cols-2 md:items-stretch">
        <div className={`overflow-hidden bg-slate-100 ${mediaPosition === 'right' ? 'md:order-2' : 'md:order-1'}`}>
          {media}
        </div>
        <div className={`flex flex-col justify-center p-5 sm:p-7 ${mediaPosition === 'right' ? 'md:order-1' : 'md:order-2'}`}>
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
            label={t('mediaType')}
            value={mediaConfig.type}
            disabled={disabled}
            options={[{ value: 'image', label: t('image') }, { value: 'youtube', label: t('youtube') }]}
            onChange={(value) => updateMedia({ type: value, url: value === 'youtube' ? youtubeUrl : imageUrl, position: mediaPosition })}
          />
          <SelectInput
            label={t('mediaPosition')}
            value={mediaPosition}
            disabled={disabled}
            options={[{ value: 'left', label: t('left') }, { value: 'right', label: t('right') }]}
            onChange={(value) => {
              onUpdate?.({
                ...section,
                contentJson: { ...section.contentJson, media: mediaWith({ position: value }) },
                styleJson: { ...section.styleJson, mediaPosition: value, imagePosition: value, layout: 'spotlight' },
              })
            }}
          />
          <TextInput
            label={mediaConfig.type === 'youtube' ? t('youtubeUrl') : t('imageUrl')}
            value={mediaConfig.url}
            disabled={disabled}
            onChange={(value) => {
              if (mediaConfig.type === 'youtube') {
                updateContent({ media: mediaWith({ type: mediaConfig.type, url: value, position: mediaPosition }), youtubeUrl: value })
              } else {
                updateContent({ media: mediaWith({ type: mediaConfig.type, url: value, position: mediaPosition }), imageUrl: value, backgroundImage: value, backgroundImageUrl: value })
              }
            }}
          />
          <TextInput label={t('buttonLinkUrl')} value={linkUrl} disabled={disabled} onChange={(value) => updateContent({ linkUrl: value, ctaUrl: value, href: value })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default SpotlightSection
