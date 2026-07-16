import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { useListSourceResolver } from '../../hooks/useListSourceResolver'
import { activeEntityService } from '../../services/activeEntityService'
import {
  EditableText,
  PropertyPanel,
  SelectInput,
  TextInput,
  patchContent,
  patchLocalizedContent,
  patchLocalizedSectionHeader,
  patchSectionHeader,
  readLocalizedText,
  readText,
  isVideoSource,
  toYouTubeEmbedUrl,
} from './sectionUtils'
import type { SectionComponentProps } from './types'
import SectionHeader from './SectionHeader'
import { sectionSpacingClass } from './sectionPresets'
import { spotlightHeaderForSource } from '../../utils/sectionSourcePresets'
import type { SpotlightBinding, SpotlightDataSource } from '../../types'
import type { SermonDto } from '../../services/sermonService'
import {
  buildSpotlightMetadata,
  defaultSpotlightPreset,
  readSpotlightActionLinks,
  readSpotlightBinding,
  resolveDataSpotlightContent,
  resolveSpotlightSourceLabel,
  selectSpotlightItem,
  SPOTLIGHT_DATA_SOURCES,
  spotlightPresetOptionsForSource,
} from '../../utils/spotlight'
import MediaPickerInput from '../media/MediaPickerInput'

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

type SpotlightPresentation = 'spotlight' | 'visit'

const readStringValue = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

const readSpotlightPresentation = (content: Record<string, unknown>, style: Record<string, unknown>): SpotlightPresentation => {
  const raw = readStringValue(content, 'presentation', 'variant', 'template')
    || readStringValue(style, 'presentation', 'variant', 'layout')
  const normalized = raw.replace(/[-_\s]+/g, '').toLowerCase()

  return normalized === 'visit' || normalized === 'visitspotlight' || normalized === 'highlight' || normalized === 'visithighlight' || normalized === 'homevisit'
    ? 'visit'
    : 'spotlight'
}

const SpotlightSection = ({ section, mode, domId, disabled, propertiesOnly, showProperties = true, onUpdate, contextGroupId, page, allowGroupDataSources = true }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const editable = mode === 'edit' && !disabled && onUpdate
  const mediaConfig = readMediaConfig(section.contentJson, section.styleJson)
  const presentation = readSpotlightPresentation(section.contentJson, section.styleJson)
  const isVisitPresentation = presentation === 'visit'
  const rawSpotlightBinding = readSpotlightBinding(section.contentJson)
  const spotlightBinding = isVisitPresentation && rawSpotlightBinding.mode === 'data' && rawSpotlightBinding.source !== 'events'
    ? { ...rawSpotlightBinding, source: 'events' as SpotlightDataSource, preset: defaultSpotlightPreset('events') }
    : rawSpotlightBinding
  const isDataBound = spotlightBinding.mode === 'data'
  const groupId = contextGroupId || page?.ownerGroupId || undefined
  const spotlightMetadata = useMemo(
    () => buildSpotlightMetadata(spotlightBinding),
    [spotlightBinding.itemId, spotlightBinding.mode, spotlightBinding.preset, spotlightBinding.source],
  )
  const { data: spotlightItems, isLoading: spotlightLoading, error: spotlightError } = useListSourceResolver(spotlightMetadata, {
    groupId,
    enabled: isDataBound && (allowGroupDataSources || spotlightBinding.source === 'sermons'),
  })
  const spotlightItem = useMemo(
    () => selectSpotlightItem(spotlightItems, spotlightBinding),
    [spotlightBinding.itemId, spotlightBinding.source, spotlightItems],
  )
  const boundContent = useMemo(
    () => isDataBound && spotlightItem ? resolveDataSpotlightContent(spotlightBinding.source, spotlightItem, auth.language) : undefined,
    [auth.language, isDataBound, spotlightBinding.source, spotlightItem],
  )
  const title = readLocalizedText(section.contentJson, auth.language, 'title', 'headline') || boundContent?.title || ''
  const subtitle = readLocalizedText(section.contentJson, auth.language, 'subtitle', 'subheadline') || boundContent?.subtitle || ''
  const body = readLocalizedText(section.contentJson, auth.language, 'centerText', 'body', 'text') || boundContent?.body || ''
  const actionLinks = readSpotlightActionLinks(section.contentJson, auth.language)
  const actions = actionLinks.length > 0 ? actionLinks : boundContent?.actions ?? []
  const mediaPosition = mediaConfig.position
  const sermonItem = isDataBound && spotlightBinding.source === 'sermons' ? spotlightItem as SermonDto | undefined : undefined
  const sermonVideoUrl = sermonItem?.videoUrl || ''
  const resolvedMedia = sermonVideoUrl
    ? {
      type: 'youtube' as const,
      url: sermonVideoUrl,
    }
    : boundContent?.media?.url
      ? {
        type: boundContent.media.type === 'youtube' ? 'youtube' : 'image',
        url: boundContent.media.url,
      }
      : {
        type: mediaConfig.type,
        url: mediaConfig.url,
      }
  const imageUrl = resolvedMedia.type === 'image' ? resolvedMedia.url : ''
  const youtubeUrl = resolvedMedia.type === 'youtube' ? resolvedMedia.url : ''
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
  const updateSpotlight = (patch: Record<string, unknown>) => {
    const currentSpotlight = section.contentJson.spotlight && typeof section.contentJson.spotlight === 'object' && !Array.isArray(section.contentJson.spotlight)
      ? section.contentJson.spotlight
      : {}
    updateContent({ spotlight: { ...currentSpotlight, ...patch } })
  }
  const updatePresentation = (value: string) => {
    const nextPresentation: SpotlightPresentation = value === 'visit' ? 'visit' : 'spotlight'
    const currentSpotlight = section.contentJson.spotlight && typeof section.contentJson.spotlight === 'object' && !Array.isArray(section.contentJson.spotlight)
      ? section.contentJson.spotlight
      : {}
    const nextSpotlight: SpotlightBinding = nextPresentation === 'visit' && spotlightBinding.mode === 'data'
      ? {
        ...currentSpotlight,
        mode: 'data' as const,
        source: 'events' as const,
        preset: defaultSpotlightPreset('events'),
        itemId: spotlightBinding.itemId ?? '',
      }
      : currentSpotlight as SpotlightBinding

    onUpdate?.({
      ...section,
      contentJson: {
        ...section.contentJson,
        presentation: nextPresentation,
        spotlight: nextSpotlight,
      },
      styleJson: {
        ...section.styleJson,
        presentation: nextPresentation,
        layout: nextPresentation === 'visit' ? 'visitSpotlight' : 'spotlight',
      },
    })
  }
  const updateSpotlightSource = (source: SpotlightDataSource) => {
    const currentSpotlight = section.contentJson.spotlight && typeof section.contentJson.spotlight === 'object' && !Array.isArray(section.contentJson.spotlight)
      ? section.contentJson.spotlight
      : {}
    updateContent({
      spotlight: {
        ...currentSpotlight,
        source,
        preset: defaultSpotlightPreset(source),
        itemId: '',
      },
      header: spotlightHeaderForSource(source, section.contentJson.header),
    })
  }
  const spotlightSourceOptions: SpotlightDataSource[] = isVisitPresentation ? ['events'] : SPOTLIGHT_DATA_SOURCES
  const activateAction = (action: (typeof actions)[number]) => {
    if (action.entityType === 'group' && action.entityId) {
      activeEntityService.setGroup(action.entityId)
    } else if (action.entityType === 'event' && action.entityId) {
      activeEntityService.setEvent(action.entityId, action.groupId)
    } else if (action.entityType === 'sermon' && action.entityId) {
      activeEntityService.setSermon(action.entityId)
    }
  }

  const renderProperties = () => (
    <PropertyPanel>
      <SelectInput
        focusKey="spotlight-presentation"
        label={t('presentation')}
        value={presentation}
        disabled={disabled}
        options={[
          { value: 'spotlight', label: t('standardSpotlight') },
          { value: 'visit', label: t('visitSpotlight') },
        ]}
        onChange={updatePresentation}
      />
      <SelectInput
        focusKey="spotlight-mode"
        label={t('spotlightMode')}
        value={spotlightBinding.mode}
        disabled={disabled}
        options={[{ value: 'manual', label: t('manual') }, { value: 'data', label: t('dataBound') }]}
        onChange={(value) => updateSpotlight({
          mode: value,
          source: isVisitPresentation && value === 'data' ? 'events' : spotlightBinding.source,
          preset: isVisitPresentation && value === 'data' ? defaultSpotlightPreset('events') : spotlightBinding.preset,
          itemId: spotlightBinding.itemId ?? '',
        })}
      />
      <SelectInput
        focusKey="spotlight-media-position"
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
      {spotlightBinding.mode === 'data' ? (
        <>
          <SelectInput
            focusKey="spotlight-source"
            label={t('contentSource')}
            value={spotlightBinding.source}
            disabled={disabled}
            options={spotlightSourceOptions.map((source) => ({ value: source, label: t(source) }))}
            onChange={(value) => updateSpotlightSource(value as SpotlightDataSource)}
          />
          <SelectInput
            focusKey="spotlight-preset"
            label={t('preset')}
            value={spotlightBinding.preset}
            disabled={disabled}
            options={spotlightPresetOptionsForSource(spotlightBinding.source, t)}
            onChange={(value) => updateSpotlight({ preset: value })}
          />
          <TextInput
            focusKey="spotlight-reference-id"
            label={t('referenceId')}
            value={spotlightBinding.itemId ?? ''}
            disabled={disabled}
            placeholder={t('referenceId')}
            onChange={(value) => updateSpotlight({ itemId: value })}
          />
        </>
      ) : (
        <>
          <SelectInput
            focusKey="spotlight-media-type"
            label={t('mediaType')}
            value={mediaConfig.type}
            disabled={disabled}
            options={[{ value: 'image', label: t('image') }, { value: 'youtube', label: t('youtube') }]}
            onChange={(value) => updateMedia({ type: value, url: value === 'youtube' ? youtubeUrl : imageUrl, position: mediaPosition })}
          />
          {mediaConfig.type === 'youtube' ? (
            <TextInput
              focusKey="spotlight-media-url"
              label={t('youtubeUrl')}
              value={mediaConfig.url}
              disabled={disabled}
              onChange={(value) => updateContent({ media: mediaWith({ type: mediaConfig.type, url: value, position: mediaPosition }), youtubeUrl: value })}
            />
          ) : (
            <MediaPickerInput
              focusKey="spotlight-media-url"
              label={t('imageOrVideoUrl')}
              value={mediaConfig.url}
              disabled={disabled}
              groupId={groupId}
              accept="media"
              onChange={(value) => updateContent({ media: mediaWith({ type: mediaConfig.type, url: value, position: mediaPosition }), imageUrl: value, backgroundImage: value, backgroundImageUrl: value })}
            />
          )}
          <TextInput
            focusKey="spotlight-action-url"
            label={t('buttonLinkUrl')}
            value={readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')}
            disabled={disabled}
            onChange={(value) => updateContent({ linkUrl: value, ctaUrl: value, href: value })}
          />
        </>
      )}
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  const mediaPlaceholder = isDataBound
    ? t('noSourceItems', { source: resolveSpotlightSourceLabel(spotlightBinding, auth.language) })
    : t('noImageYet')
  const renderMedia = () => {
    if (embedUrl) {
      return (
        <iframe
          src={embedUrl}
          referrerPolicy="strict-origin-when-cross-origin"
          title={title || t('sermonVideoPreview')}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )
    }

    if (imageUrl && isVideoSource(imageUrl)) {
      return (
        <video
          src={imageUrl}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
          aria-hidden="true"
        />
      )
    }

    return imageUrl ? (
      <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-100 px-6 text-center text-sm text-slate-500">
        {mediaPlaceholder}
      </div>
    )
  }

  const spotlightBody = isDataBound && spotlightLoading
    ? <p className="mt-4 text-sm text-home-muted">{t('loadingPageSections')}</p>
    : isDataBound && spotlightError
      ? <p className="mt-4 text-sm text-red-600">{t('loadFailedWithMessage', { message: spotlightError.message })}</p>
      : isDataBound && !spotlightItem
        ? <p className="mt-4 text-sm text-home-muted">{mediaPlaceholder}</p>
        : (
          <EditableText
            as="p"
            multiline
            value={body}
            fallback={t('noHeroContentYet')}
            disabled={!editable || isDataBound}
            className="mt-4 block max-w-[45ch] whitespace-pre-wrap text-[0.94rem] leading-7 text-home-muted"
            onChange={(value) => updateLocalizedContent({ centerText: value, body: value, text: value })}
          />
        )
  const renderActionLink = (
    action: (typeof actions)[number],
    index: number,
    className: string,
    showArrow = false,
  ) => {
    const actionUrl = typeof action.url === 'string' ? action.url.trim() : ''
    const isExternalLink = Boolean(actionUrl && !actionUrl.startsWith('/') && !actionUrl.startsWith('#'))

    return (
      <a
        key={`${actionUrl || action.label || 'action'}-${index}`}
        href={mode === 'render' && actionUrl ? actionUrl : undefined}
        target={mode === 'render' && isExternalLink ? '_blank' : undefined}
        rel={mode === 'render' && isExternalLink ? 'noopener noreferrer' : undefined}
        className={className}
        onClick={(event) => {
          if (mode === 'edit') {
            event.preventDefault()
            return
          }

          activateAction(action)
        }}
      >
        {action.label || actionUrl || t('readMore')}
        {showArrow ? <ArrowRight className="h-3.5 w-3.5" /> : null}
      </a>
    )
  }
  const hasSectionHeader = Boolean(section.contentJson.header && typeof section.contentJson.header === 'object' && !Array.isArray(section.contentJson.header))

  return (
    <section id={domId} className={`scroll-mt-24 px-5 sm:px-8 lg:px-10 ${sectionSpacingClass(section)}`}>
      {hasSectionHeader ? (
        <SectionHeader
          header={section.contentJson.header}
          titleFallback={title || (mode === 'edit' ? t('previewNoTitle') : '')}
          subtitleFallback={subtitle || (mode === 'edit' ? t('previewNoSubtitle') : '')}
          disabled={!editable}
          onIconChange={editable ? (icon) => onUpdate?.(patchSectionHeader(section, { icon })) : undefined}
          onTitleChange={editable ? updateHeaderTitle : undefined}
          onSubtitleChange={editable ? updateHeaderSubtitle : undefined}
        />
      ) : null}
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(30,18,10,0.08)] lg:grid-cols-[0.46fr_0.54fr]">
        <div className={`relative min-h-[22rem] bg-slate-100 ${mediaPosition === 'right' ? 'lg:order-2' : 'lg:order-1'}`}>
          {renderMedia()}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-home-dark/50 to-transparent" />
        </div>
        <div className={`flex items-center p-7 sm:p-10 lg:p-14 ${mediaPosition === 'right' ? 'lg:order-1' : 'lg:order-2'}`}>
          <div>
            {spotlightBody}
            {actions.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {actions.map((action, index) => renderActionLink(
                  action,
                  index,
                  index === 0
                    ? 'inline-flex min-h-11 items-center gap-2 rounded-lg bg-home-green px-5 text-sm font-semibold text-white transition hover:bg-home-green-hover'
                    : 'inline-flex min-h-11 items-center gap-2 rounded-lg border border-home-border bg-white px-5 text-sm font-semibold text-home-gold-text transition hover:-translate-y-0.5 hover:border-home-green/35 hover:bg-[#fffaf0] focus:outline-none focus:ring-2 focus:ring-home-green/30',
                  index === 0,
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {mode === 'edit' && showProperties ? renderProperties() : null}
    </section>
  )
}

export default SpotlightSection
