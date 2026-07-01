import { useMemo } from 'react'
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
import { pageSectionShellClass, sectionSpacingClass } from './sectionPresets'
import { spotlightHeaderForSource } from '../../utils/sectionSourcePresets'
import type { SpotlightDataSource } from '../../types'
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

const SpotlightSection = ({ section, mode, domId, disabled, propertiesOnly, showProperties = true, onUpdate, contextGroupId, page }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const editable = mode === 'edit' && !disabled && onUpdate
  const spotlightBinding = readSpotlightBinding(section.contentJson)
  const isDataBound = spotlightBinding.mode === 'data'
  const mediaConfig = readMediaConfig(section.contentJson, section.styleJson)
  const groupId = contextGroupId || page?.ownerGroupId || undefined
  const spotlightMetadata = useMemo(
    () => buildSpotlightMetadata(spotlightBinding),
    [spotlightBinding.itemId, spotlightBinding.mode, spotlightBinding.preset, spotlightBinding.source],
  )
  const { data: spotlightItems, isLoading: spotlightLoading, error: spotlightError } = useListSourceResolver(spotlightMetadata, {
    groupId,
    enabled: isDataBound,
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
        focusKey="spotlight-mode"
        label={t('spotlightMode')}
        value={spotlightBinding.mode}
        disabled={disabled}
        options={[{ value: 'manual', label: t('manual') }, { value: 'data', label: t('dataBound') }]}
        onChange={(value) => updateSpotlight({ mode: value, source: spotlightBinding.source, preset: spotlightBinding.preset, itemId: spotlightBinding.itemId ?? '' })}
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
            options={SPOTLIGHT_DATA_SOURCES.map((source) => ({ value: source, label: t(source) }))}
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
          <TextInput
            focusKey="spotlight-media-url"
            label={mediaConfig.type === 'youtube' ? t('youtubeUrl') : t('imageOrVideoUrl')}
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

  const media = embedUrl ? (
    <iframe
      src={embedUrl}
      referrerPolicy="strict-origin-when-cross-origin"
      title={title || t('sermonVideoPreview')}
      className="aspect-video w-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  ) : imageUrl && isVideoSource(imageUrl) ? (
    <video
      src={imageUrl}
      className="h-48 w-full object-cover sm:h-[240px] md:h-[300px]"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      tabIndex={-1}
      aria-hidden="true"
    />
  ) : imageUrl ? (
    <img src={imageUrl} alt="" className="h-48 w-full object-cover sm:h-[240px] md:h-[300px]" />
  ) : (
    <div className="flex aspect-video w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      {isDataBound ? t('noSourceItems', { source: resolveSpotlightSourceLabel(spotlightBinding, auth.language) }) : t('noImageYet')}
    </div>
  )

  const contentBody = isDataBound && spotlightLoading
    ? <p className="mt-4 text-sm text-slate-500">{t('loadingPageSections')}</p>
    : isDataBound && spotlightError
      ? <p className="mt-4 text-sm text-red-600">{t('loadFailedWithMessage', { message: spotlightError.message })}</p>
      : isDataBound && !spotlightItem
        ? <p className="mt-4 text-sm text-slate-500">{t('noSourceItems', { source: resolveSpotlightSourceLabel(spotlightBinding, auth.language) })}</p>
        : (
          <EditableText
            as="p"
            multiline
            value={body}
            fallback={t('noHeroContentYet')}
            disabled={!editable || isDataBound}
            className="mt-4 block whitespace-pre-wrap text-base leading-7 text-slate-700"
            onChange={(value) => updateLocalizedContent({ centerText: value, body: value, text: value })}
          />
        )

  return (
    <section id={domId} className={pageSectionShellClass}>
      <div className={`${sectionSpacingClass(section)} rounded-lg border border-slate-200 bg-white px-4`}>
        <SectionHeader
          header={section.contentJson.header}
          titleFallback={title || (mode === 'edit' ? t('previewNoTitle') : '')}
          subtitleFallback={subtitle || (mode === 'edit' ? t('previewNoSubtitle') : '')}
          disabled={!editable}
          onIconChange={editable ? (icon) => onUpdate?.(patchSectionHeader(section, { icon })) : undefined}
          onTitleChange={editable ? updateHeaderTitle : undefined}
          onSubtitleChange={editable ? updateHeaderSubtitle : undefined}
        />
        <div className="grid gap-0 md:grid-cols-2 md:items-stretch">
          <div className={`overflow-hidden bg-slate-100 ${mediaPosition === 'right' ? 'md:order-2' : 'md:order-1'}`}>
            {media}
          </div>
          <div className={`flex flex-col justify-center p-5 sm:p-7 ${mediaPosition === 'right' ? 'md:order-1' : 'md:order-2'}`}>
            {contentBody}
            {actions.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {actions.map((action, index) => {
                  const actionUrl = typeof action.url === 'string' ? action.url.trim() : ''
                  const isExternalLink = Boolean(actionUrl && !actionUrl.startsWith('/') && !actionUrl.startsWith('#'))

                  return (
                    <a
                      key={`${actionUrl || action.label || 'action'}-${index}`}
                      href={mode === 'render' && actionUrl ? actionUrl : undefined}
                      target={mode === 'render' && isExternalLink ? '_blank' : undefined}
                      rel={mode === 'render' && isExternalLink ? 'noopener noreferrer' : undefined}
                      className="inline-flex w-fit rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400"
                      onClick={(event) => {
                        if (mode === 'edit') {
                          event.preventDefault()
                          return
                        }

                        activateAction(action)
                      }}
                    >
                      {action.label || actionUrl || t('readMore')}
                    </a>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
        {mode === 'edit' && showProperties ? renderProperties() : null}
      </div>
    </section>
  )
}

export default SpotlightSection
