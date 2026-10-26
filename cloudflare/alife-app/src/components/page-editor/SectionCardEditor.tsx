import { sectionCardEditorText } from '../../i18n/sectionCardEditor.ts'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  Clapperboard,
  FileText,
  ImageUp,
  Languages,
  LayoutList,
  Link2,
  MapPin,
  Megaphone,
  MoveVertical,
  PlusCircle,
  Settings2,
  Sparkles,
  Type,
} from 'lucide-react'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
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
  pageId?: string
  isActive: boolean
  focusToken?: number
  editContentRequestToken?: number
  languageIssueCount?: number
  languageFixing?: boolean
  onSelect: () => void
  onEditContentRequestHandled?: () => void
  onInsertBefore: () => void
  onFixLanguageIssues?: () => void
}

const sectionTypeLabel = (type: SectionType, isZh: boolean) => {
  if (type === 'LandingHero') return isZh ? sectionCardEditorText.landingHero.zh : sectionCardEditorText.landingHero.en
  if (type === 'Countdown') return isZh ? sectionCardEditorText.countdown.zh : sectionCardEditorText.countdown.en
  if (type === 'ContactLocation') return isZh ? sectionCardEditorText.contactLocation.zh : sectionCardEditorText.contactLocation.en
  if (type === 'RichText') return isZh ? sectionCardEditorText.richText.zh : sectionCardEditorText.richText.en
  if (type === 'Spotlight') return isZh ? sectionCardEditorText.spotlight.zh : sectionCardEditorText.spotlight.en
  if (type === 'CollectionShowcase') return isZh ? sectionCardEditorText.listView.zh : sectionCardEditorText.listView.en
  if (type === 'ReviewedPageCarousel') return isZh ? sectionCardEditorText.reviewedPageShowcase.zh : sectionCardEditorText.reviewedPageShowcase.en
  if (type === 'Album') return isZh ? sectionCardEditorText.album.zh : sectionCardEditorText.album.en
  return type
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

const textValue = (value: unknown, language: string) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (isJsonMap(value)) {
    const current = value[language]
    const fallback = language === 'zh' ? value.en : value.zh
    return (typeof current === 'string' ? current : typeof fallback === 'string' ? fallback : '').trim()
  }

  return ''
}

type GuideTarget =
  | { type: 'preview'; index: number }
  | { type: 'editor'; focusKey: string }
  | { type: 'properties'; tab: 'common' | 'section'; focusKey: string }

type GuideItem = {
  label: string
  ready: boolean
  icon: ReactNode
  target: GuideTarget
  detail?: string
  requiresSectionHeader?: boolean
}

type SectionGuide = {
  title: string
  description: string
  items: GuideItem[]
  advice: string
}

type PropertyTab = 'guidance' | 'common' | 'section'

const readContentText = (section: SectionEditModel, language: string, ...keys: string[]) => {
  for (const key of keys) {
    const value = textValue(section.contentJson[key], language)
    if (value) {
      return value
    }
  }

  return ''
}

const readHeaderText = (section: SectionEditModel, language: string, key: 'title' | 'subtitle') => {
  const header = readHeader(section)
  return textValue(header[key], language)
}

const isMediaValue = (value: string) => Boolean(value && /^(https?:\/\/|\/|data:(image|video)|blob:)/i.test(value))

const fallbackText = (isZh: boolean) => isZh ? sectionCardEditorText.notSet.zh : sectionCardEditorText.notSet.en

const summarizeValue = (value: string, isZh: boolean, maxLength = 34) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return fallbackText(isZh)
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}...` : trimmed
}

const formatSource = (value: string, isZh: boolean) => {
  const labels: Record<string, { en: string; zh: string }> = sectionCardEditorText.labels
  const key = value.trim()
  const label = labels[key]
  return label ? (isZh ? label.zh : label.en) : summarizeValue(key, isZh)
}

const formatPreset = (value: string, isZh: boolean) => {
  const labels: Record<string, { en: string; zh: string }> = sectionCardEditorText.labelsAlternative
  const key = value.trim()
  const label = labels[key]
  return label ? (isZh ? label.zh : label.en) : summarizeValue(key, isZh)
}

const formatMode = (value: string, isZh: boolean) => value === 'data'
  ? (isZh ? sectionCardEditorText.filledFromExistingContent.zh : sectionCardEditorText.filledFromExistingContent.en)
  : (isZh ? sectionCardEditorText.manual.zh : sectionCardEditorText.manual.en)

const getSectionGuide = (section: SectionEditModel, language: string): SectionGuide => {
  const isZh = language === 'zh'
  const title = readHeaderText(section, language, 'title') || readContentText(section, language, 'title', 'headline')
  const subtitle = readHeaderText(section, language, 'subtitle') || readContentText(section, language, 'subtitle', 'subheadline', 'centerText', 'body')
  const media = readContentText(section, language, 'backgroundVideo', 'videoUrl', 'backgroundImage', 'backgroundImageUrl', 'imageUrl', 'imageOverrideUrl')
  const linkLabel = readContentText(section, language, 'linkLabel', 'linkText', 'ctaLabel')
  const linkUrl = readContentText(section, language, 'linkUrl', 'ctaUrl', 'href')
  const secondaryLinkLabel = readContentText(section, language, 'secondaryLinkLabel', 'secondaryLabel', 'secondaryCtaLabel')
  const secondaryLinkUrl = readContentText(section, language, 'secondaryLinkUrl', 'secondaryUrl', 'secondaryCtaUrl')
  const source = readContentText(section, language, 'source', 'sourceType')
  const primaryMenuId = readContentText(section, language, 'primaryMenuId')
  const layout = readContentText(section, language, 'layout')
  const spotlight = section.contentJson.spotlight && typeof section.contentJson.spotlight === 'object' && !Array.isArray(section.contentJson.spotlight)
    ? section.contentJson.spotlight as Record<string, unknown>
    : {}
  const spotlightMode = textValue(spotlight.mode, language) || 'manual'
  const spotlightSource = textValue(spotlight.source, language)
  const spotlightPreset = textValue(spotlight.preset, language)
  const spotlightItemId = textValue(spotlight.itemId, language)
  const contactUs = section.contentJson.contactUs && typeof section.contentJson.contactUs === 'object' && !Array.isArray(section.contentJson.contactUs)
    ? section.contentJson.contactUs as Record<string, unknown>
    : {}
  const contactUsGuidance = textValue(contactUs.guidance, language)
  const contactUsSuccessMessage = textValue(contactUs.successMessage, language)
  const isContactUsSpotlight = spotlightMode === 'data' && spotlightSource === 'contactUs'
  const countdown = section.contentJson.countdown && typeof section.contentJson.countdown === 'object' && !Array.isArray(section.contentJson.countdown)
    ? section.contentJson.countdown as Record<string, unknown>
    : {}
  const countdownMode = textValue(countdown.mode, language) || 'custom'
  const countdownEventId = textValue(countdown.eventId, language) || textValue(countdown.itemId, language)
  const countdownPreset = textValue(countdown.preset, language) || 'upcoming'
  const countdownTarget = readContentText(section, language, 'targetDateTime', 'countdownTarget', 'endDateTime')
  const limit = typeof section.contentJson.limit === 'number' ? section.contentJson.limit : 0
  const richText = readContentText(section, language, 'text')
  const locationName = readContentText(section, language, 'locationName', 'title')
  const streetAddress = readContentText(section, language, 'streetAddress', 'address')
  const locationAddress = readContentText(section, language, 'locationAddress', 'addressNote', 'body')
  const mapUrl = readContentText(section, language, 'mapUrl', 'linkUrl', 'ctaUrl', 'href')
  const mapEmbedUrl = readContentText(section, language, 'mapEmbedUrl', 'embedUrl')

  if (section.type === 'LandingHero') {
    return {
      title: isZh ? sectionCardEditorText.landingHeroGuidance.zh : sectionCardEditorText.landingHeroGuidance.en,
      description: isZh ? sectionCardEditorText.useThisAsAFirstScreenVideoInvitationWith.zh : sectionCardEditorText.useThisAsAFirstScreenVideoInvitationWith.en,
      items: [
        { label: isZh ? sectionCardEditorText.mainHeadline.zh : sectionCardEditorText.mainHeadline.en, ready: Boolean(title), detail: summarizeValue(title, isZh), icon: <Type className="h-4 w-4" />, target: { type: 'preview', index: 0 } },
        { label: isZh ? sectionCardEditorText.supportingCopy.zh : sectionCardEditorText.supportingCopy.en, ready: Boolean(subtitle), detail: summarizeValue(subtitle, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'preview', index: 1 } },
        { label: isZh ? sectionCardEditorText.backgroundVideoImage.zh : sectionCardEditorText.backgroundVideoImage.en, ready: isMediaValue(media), detail: summarizeValue(media, isZh), icon: <ImageUp className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'landing-hero-media' } },
        { label: isZh ? sectionCardEditorText.primaryAction.zh : sectionCardEditorText.primaryAction.en, ready: Boolean(linkLabel && linkUrl), detail: linkUrl ? summarizeValue(linkUrl, isZh) : summarizeValue(linkLabel, isZh), icon: <Link2 className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'landing-hero-primary-url' } },
        { label: isZh ? sectionCardEditorText.secondaryAction.zh : sectionCardEditorText.secondaryAction.en, ready: Boolean(secondaryLinkLabel && secondaryLinkUrl), detail: secondaryLinkUrl ? summarizeValue(secondaryLinkUrl, isZh) : summarizeValue(secondaryLinkLabel, isZh), icon: <Clapperboard className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'landing-hero-secondary-url' } },
      ] satisfies GuideItem[],
      advice: isZh ? sectionCardEditorText.useNearTheTopOfThePageAndKeep.zh : sectionCardEditorText.useNearTheTopOfThePageAndKeep.en,
    }
  }

  if (section.type === 'Countdown') {
    return {
      title: isZh ? sectionCardEditorText.countdownGuidance.zh : sectionCardEditorText.countdownGuidance.en,
      description: isZh ? sectionCardEditorText.useThisForEventRegistrationGatheringStartsDeadlinesOr.zh : sectionCardEditorText.useThisForEventRegistrationGatheringStartsDeadlinesOr.en,
      items: [
        {
          label: isZh ? sectionCardEditorText.datasource.zh : sectionCardEditorText.datasource.en,
          ready: countdownMode === 'custom' || countdownMode === 'event',
          detail: countdownMode === 'event' ? (isZh ? sectionCardEditorText.eventBound.zh : sectionCardEditorText.eventBound.en) : (isZh ? sectionCardEditorText.customized.zh : sectionCardEditorText.customized.en),
          icon: <LayoutList className="h-4 w-4" />,
          target: { type: 'properties', tab: 'section', focusKey: 'countdown-source-mode' },
        },
        {
          label: isZh ? sectionCardEditorText.targetTime.zh : sectionCardEditorText.targetTime.en,
          ready: countdownMode === 'event' || Boolean(countdownTarget),
          detail: countdownMode === 'event'
            ? (countdownEventId ? (isZh ? sectionCardEditorText.eventId.zh(summarizeValue(countdownEventId, true)) : sectionCardEditorText.eventId.en(summarizeValue(countdownEventId, false))) : (isZh ? sectionCardEditorText.nextEvent.zh(formatPreset(countdownPreset, true)) : sectionCardEditorText.nextEvent.en(formatPreset(countdownPreset, false))))
            : summarizeValue(countdownTarget, isZh),
          icon: <Settings2 className="h-4 w-4" />,
          target: { type: 'properties', tab: 'section', focusKey: countdownMode === 'event' ? 'countdown-event-id' : 'countdown-target-date' },
        },
        { label: isZh ? sectionCardEditorText.introCopy.zh : sectionCardEditorText.introCopy.en, ready: Boolean(title || subtitle || richText), detail: summarizeValue(title || subtitle || richText, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'preview', index: 1 } },
        {
          label: isZh ? sectionCardEditorText.media.zh : sectionCardEditorText.media.en,
          ready: countdownMode === 'event' || isMediaValue(media),
          detail: countdownMode === 'event' ? (isZh ? sectionCardEditorText.fromEventPosterOrOverride.zh : sectionCardEditorText.fromEventPosterOrOverride.en) : summarizeValue(media, isZh),
          icon: <ImageUp className="h-4 w-4" />,
          target: { type: 'properties', tab: 'section', focusKey: countdownMode === 'event' ? 'countdown-image-override' : 'countdown-image' },
        },
        {
          label: isZh ? sectionCardEditorText.actionLink.zh : sectionCardEditorText.actionLink.en,
          ready: countdownMode === 'event' || Boolean(linkLabel || linkUrl),
          detail: countdownMode === 'event' ? (isZh ? sectionCardEditorText.defaultsToEventDetails.zh : sectionCardEditorText.defaultsToEventDetails.en) : summarizeValue(linkUrl || linkLabel, isZh),
          icon: <Link2 className="h-4 w-4" />,
          target: { type: 'properties', tab: 'section', focusKey: 'countdown-action-url' },
        },
      ] satisfies GuideItem[],
      advice: isZh ? sectionCardEditorText.whenEventBoundTitleCopyLocationPosterAndTarget.zh : sectionCardEditorText.whenEventBoundTitleCopyLocationPosterAndTarget.en,
    }
  }

  if (section.type === 'ContactLocation') {
    return {
      title: isZh ? sectionCardEditorText.contactLocationGuidance.zh : sectionCardEditorText.contactLocationGuidance.en,
      description: isZh ? sectionCardEditorText.useThisToShowAHomepageStyleLocationMap.zh : sectionCardEditorText.useThisToShowAHomepageStyleLocationMap.en,
      items: [
        {
          label: isZh ? sectionCardEditorText.datasource.zh : sectionCardEditorText.datasource.en,
          ready: true,
          detail: isZh ? sectionCardEditorText.customized.zh : sectionCardEditorText.customized.en,
          icon: <LayoutList className="h-4 w-4" />,
          target: { type: 'properties', tab: 'section', focusKey: 'contact-location-source-mode' },
        },
        { label: isZh ? sectionCardEditorText.locationName.zh : sectionCardEditorText.locationName.en, ready: Boolean(locationName), detail: summarizeValue(locationName, isZh), icon: <MapPin className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'contact-location-name' } },
        { label: isZh ? sectionCardEditorText.streetAddress.zh : sectionCardEditorText.streetAddress.en, ready: Boolean(streetAddress), detail: summarizeValue(streetAddress, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'contact-location-street-address' } },
        { label: isZh ? sectionCardEditorText.addressNote.zh : sectionCardEditorText.addressNote.en, ready: Boolean(locationAddress), detail: summarizeValue(locationAddress, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'contact-location-address-note' } },
        { label: isZh ? sectionCardEditorText.mapLink.zh : sectionCardEditorText.mapLink.en, ready: Boolean(mapUrl), detail: summarizeValue(mapUrl, isZh), icon: <Link2 className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'contact-location-map-url' } },
        { label: isZh ? sectionCardEditorText.embeddedMap.zh : sectionCardEditorText.embeddedMap.en, ready: Boolean(mapEmbedUrl), detail: summarizeValue(mapEmbedUrl, isZh), icon: <ImageUp className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'contact-location-map-embed-url' } },
      ] satisfies GuideItem[],
      advice: isZh ? sectionCardEditorText.thisSectionCurrentlySupportsCustomizedLocationContentOnlyConfirm.zh : sectionCardEditorText.thisSectionCurrentlySupportsCustomizedLocationContentOnlyConfirm.en,
    }
  }

  if (section.type === 'RichText') {
    return {
      title: isZh ? sectionCardEditorText.richTextGuidance.zh : sectionCardEditorText.richTextGuidance.en,
      description: isZh ? sectionCardEditorText.bestForWelcomeCopyExplanationsFaqOrStepsKeep.zh : sectionCardEditorText.bestForWelcomeCopyExplanationsFaqOrStepsKeep.en,
      items: [
        { label: isZh ? sectionCardEditorText.sectionTitle.zh : sectionCardEditorText.sectionTitle.en, ready: Boolean(title), detail: summarizeValue(title, isZh), icon: <Type className="h-4 w-4" />, target: { type: 'preview', index: 0 }, requiresSectionHeader: true },
        { label: isZh ? sectionCardEditorText.bodyContent.zh : sectionCardEditorText.bodyContent.en, ready: Boolean(richText), detail: summarizeValue(richText, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'editor', focusKey: 'rich-text-body' } },
        { label: isZh ? sectionCardEditorText.readableLength.zh : sectionCardEditorText.readableLength.en, ready: !richText || richText.length <= 900, detail: isZh ? sectionCardEditorText.chars.zh(richText.length) : sectionCardEditorText.chars.en(richText.length), icon: <Sparkles className="h-4 w-4" />, target: { type: 'editor', focusKey: 'rich-text-body' } },
      ] satisfies GuideItem[],
      advice: isZh ? sectionCardEditorText.ifThisGrowsPastAFewParagraphsConsiderSplitting.zh : sectionCardEditorText.ifThisGrowsPastAFewParagraphsConsiderSplitting.en,
    }
  }

  if (section.type === 'CollectionShowcase') {
    return {
      title: isZh ? sectionCardEditorText.autoListGuidance.zh : sectionCardEditorText.autoListGuidance.en,
      description: isZh ? sectionCardEditorText.useThisForLatestSermonsEventsOrGroupsSo.zh : sectionCardEditorText.useThisForLatestSermonsEventsOrGroupsSo.en,
      items: [
        { label: isZh ? sectionCardEditorText.contentSource.zh : sectionCardEditorText.contentSource.en, ready: Boolean(source), detail: formatSource(source, isZh), icon: <LayoutList className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'list-source' } },
        { label: isZh ? sectionCardEditorText.displayLayout.zh : sectionCardEditorText.displayLayout.en, ready: Boolean(layout), detail: summarizeValue(layout, isZh), icon: <MoveVertical className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'list-layout' } },
        { label: isZh ? sectionCardEditorText.itemLimit.zh : sectionCardEditorText.itemLimit.en, ready: limit > 0 && limit <= 50, detail: limit ? (isZh ? sectionCardEditorText.items.zh(limit) : sectionCardEditorText.items.en(limit)) : fallbackText(isZh), icon: <Settings2 className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'list-limit' } },
      ] satisfies GuideItem[],
      advice: isZh ? sectionCardEditorText.forHomePages3To6ItemsUsuallyScans.zh : sectionCardEditorText.forHomePages3To6ItemsUsuallyScans.en,
    }
  }

  if (section.type === 'ReviewedPageCarousel') {
    return {
      title: isZh ? sectionCardEditorText.reviewedPageCarouselGuidance.zh : sectionCardEditorText.reviewedPageCarouselGuidance.en,
      description: isZh ? sectionCardEditorText.chooseOnePrimaryMenuToCarouselItsReviewedPublic.zh : sectionCardEditorText.chooseOnePrimaryMenuToCarouselItsReviewedPublic.en,
      items: [
        { label: isZh ? sectionCardEditorText.primaryMenu.zh : sectionCardEditorText.primaryMenu.en, ready: Boolean(primaryMenuId), detail: primaryMenuId ? (isZh ? sectionCardEditorText.selected.zh : sectionCardEditorText.selected.en) : fallbackText(isZh), icon: <LayoutList className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'reviewed-carousel-primary-menu' } },
        { label: isZh ? sectionCardEditorText.sectionTitle.zh : sectionCardEditorText.sectionTitle.en, ready: Boolean(title), detail: summarizeValue(title, isZh), icon: <Type className="h-4 w-4" />, target: { type: 'preview', index: 0 } },
        { label: isZh ? sectionCardEditorText.supportingCopy.zh : sectionCardEditorText.supportingCopy.en, ready: Boolean(subtitle), detail: summarizeValue(subtitle, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'preview', index: 1 } },
      ] satisfies GuideItem[],
      advice: isZh ? sectionCardEditorText.carouselItemsComeOnlyFromReviewedPublicPagesAnd.zh : sectionCardEditorText.carouselItemsComeOnlyFromReviewedPublicPagesAnd.en,
    }
  }

  return {
    title: isZh ? sectionCardEditorText.spotlightGuidance.zh : sectionCardEditorText.spotlightGuidance.en,
    description: isZh ? sectionCardEditorText.useAHomepageStyleImageConciseCopyAndOne.zh : sectionCardEditorText.useAHomepageStyleImageConciseCopyAndOne.en,
    items: [
      { label: isZh ? sectionCardEditorText.title.zh : sectionCardEditorText.title.en, ready: Boolean(title), detail: summarizeValue(title, isZh), icon: <Type className="h-4 w-4" />, target: { type: 'preview', index: 0 }, requiresSectionHeader: true },
      {
        label: isContactUsSpotlight ? (isZh ? sectionCardEditorText.formGuidance.zh : sectionCardEditorText.formGuidance.en) : (isZh ? sectionCardEditorText.supportingCopy.zh : sectionCardEditorText.supportingCopy.en),
        ready: isContactUsSpotlight ? Boolean(contactUsGuidance) : Boolean(richText),
        detail: summarizeValue(isContactUsSpotlight ? contactUsGuidance : richText, isZh),
        icon: <FileText className="h-4 w-4" />,
        target: isContactUsSpotlight
          ? { type: 'properties', tab: 'section', focusKey: 'spotlight-contact-us-guidance' }
          : spotlightMode === 'manual'
          ? { type: 'editor', focusKey: 'spotlight-body' }
          : { type: 'properties', tab: 'section', focusKey: 'spotlight-source' },
      },
      {
        label: isZh ? sectionCardEditorText.autoFilledContent.zh : sectionCardEditorText.autoFilledContent.en,
        ready: spotlightMode === 'manual' || Boolean(spotlightSource),
        detail: spotlightMode === 'data'
          ? isContactUsSpotlight ? formatSource(spotlightSource, isZh) : `${formatSource(spotlightSource, isZh)} · ${formatPreset(spotlightPreset, isZh)}`
          : formatMode(spotlightMode, isZh),
        icon: <LayoutList className="h-4 w-4" />,
        target: { type: 'properties', tab: 'section', focusKey: spotlightMode === 'data' ? 'spotlight-source' : 'spotlight-mode' },
      },
      {
        label: isZh ? sectionCardEditorText.media.zh : sectionCardEditorText.media.en,
        ready: isContactUsSpotlight ? isMediaValue(media) : spotlightMode === 'data' || isMediaValue(media),
        detail: spotlightMode === 'data'
          ? isContactUsSpotlight
            ? summarizeValue(media, isZh)
            : (isZh ? sectionCardEditorText.from.zh(formatSource(spotlightSource, true), formatPreset(spotlightPreset, true)) : sectionCardEditorText.from.en(formatSource(spotlightSource, false), formatPreset(spotlightPreset, false)))
          : summarizeValue(media, isZh),
        icon: <ImageUp className="h-4 w-4" />,
        target: { type: 'properties', tab: 'section', focusKey: isContactUsSpotlight || spotlightMode === 'manual' ? 'spotlight-media-url' : 'spotlight-preset' },
      },
      {
        label: isContactUsSpotlight ? (isZh ? sectionCardEditorText.successResponse.zh : sectionCardEditorText.successResponse.en) : (isZh ? sectionCardEditorText.actionLink.zh : sectionCardEditorText.actionLink.en),
        ready: isContactUsSpotlight ? Boolean(contactUsSuccessMessage) : spotlightMode === 'data' || Boolean(linkLabel || linkUrl),
        detail: isContactUsSpotlight
          ? summarizeValue(contactUsSuccessMessage, isZh)
          : spotlightMode === 'data'
            ? (spotlightItemId ? (isZh ? sectionCardEditorText.pinnedId.zh(summarizeValue(spotlightItemId, true)) : sectionCardEditorText.pinnedId.en(summarizeValue(spotlightItemId, false))) : (isZh ? sectionCardEditorText.usesSourceDefaultAction.zh : sectionCardEditorText.usesSourceDefaultAction.en))
          : summarizeValue(linkUrl || linkLabel, isZh),
        icon: <Link2 className="h-4 w-4" />,
        target: { type: 'properties', tab: 'section', focusKey: isContactUsSpotlight ? 'spotlight-contact-us-success' : spotlightMode === 'data' ? 'spotlight-reference-id' : 'spotlight-action-url' },
      },
    ] satisfies GuideItem[],
    advice: isZh ? sectionCardEditorText.endWithOneClearActionSuchAsLearnMore.zh : sectionCardEditorText.endWithOneClearActionSuchAsLearnMore.en,
  }
}

const SectionCardEditor = ({
  section,
  index,
  total,
  canEdit,
  typeError,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  contextGroupId,
  pageId,
  isActive,
  focusToken,
  editContentRequestToken,
  languageIssueCount = 0,
  languageFixing,
  onSelect,
  onEditContentRequestHandled,
  onInsertBefore,
  onFixLanguageIssues,
}: Props) => {
  const t = useUiText()
  const { language } = useAuthStore()
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [propertyTab, setPropertyTab] = useState<PropertyTab>('guidance')
  const [pendingFocusKey, setPendingFocusKey] = useState('')
  const [activeGuideLabel, setActiveGuideLabel] = useState('')
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const modalContentRef = useRef<HTMLDivElement | null>(null)
  const patchSection = (patch: Partial<SectionEditModel>) => onUpdate({ ...section, ...patch })
  const patchContentJson = (patch: JsonMap) => patchSection({ contentJson: { ...section.contentJson, ...patch } })
  const patchHeader = (patch: Partial<SectionHeader>) => patchContentJson({ header: { ...readHeader(section), ...patch } })
  const header = readHeader(section)
  const guide = getSectionGuide(section, language)
  const supportsSectionHeader = section.type === 'RichText' || section.type === 'Spotlight' || section.type === 'CollectionShowcase'
  const hasSectionHeader = supportsSectionHeader && isJsonMap(section.contentJson.header)
  const guideItems = hasSectionHeader ? guide.items : guide.items.filter((item) => !item.requiresSectionHeader)
  const readyCount = guideItems.filter((item) => item.ready).length
  const guideComplete = readyCount === guideItems.length
  const isZh = language === 'zh'
  const focusPreviewTarget = (index: number) => {
    window.setTimeout(() => {
      const editables = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('[contenteditable="true"]') ?? [])
      const target = editables[Math.min(index, Math.max(0, editables.length - 1))]
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.focus()
    }, 50)
  }
  const focusRichTextEditor = (focusKey: string) => {
    window.setTimeout(() => {
      const editorTargets = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('[data-editor-focus-key]') ?? [])
      const target = editorTargets.find((element) => element.dataset.editorFocusKey === focusKey)
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const iframe = target?.querySelector<HTMLIFrameElement>('iframe')
      const focusTarget = iframe ?? target
      focusTarget?.focus()
    }, 50)
  }
  const handleGuideItemClick = (item: GuideItem) => {
    setActiveGuideLabel(item.label)
    if (item.target.type === 'preview') {
      setPropertiesOpen(false)
      focusPreviewTarget(item.target.index)
      return
    }
    if (item.target.type === 'editor') {
      setPropertiesOpen(false)
      focusRichTextEditor(item.target.focusKey)
      return
    }

    setPendingFocusKey(item.target.focusKey)
    setPropertyTab(item.target.tab)
    setPropertiesOpen(true)
  }
  const renderGuide = (compact = false) => (
    <div className={compact ? 'rounded-xl border border-slate-200 bg-slate-50 p-3' : 'border-y border-slate-100 bg-[#f8faf7] px-4 py-3'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={['flex h-8 w-8 items-center justify-center rounded-lg', guideComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'].join(' ')}>
              {guideComplete ? <CheckCircle2 className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-sm font-black text-slate-950">{guide.title}</p>
              <p className="text-xs leading-5 text-slate-500">{guide.description}</p>
            </div>
          </div>
        </div>
        <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-black text-[#176b5a] shadow-sm">
          {readyCount}/{guideItems.length}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {guideItems.map((item: GuideItem) => (
          <button
            key={item.label}
            type="button"
            className={['flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#176b5a]/30', item.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600', activeGuideLabel === item.label ? 'ring-2 ring-[#176b5a]/30' : ''].join(' ')}
            onClick={(event) => {
              event.stopPropagation()
              handleGuideItemClick(item)
            }}
          >
            <span className={item.ready ? 'text-emerald-700' : 'text-slate-500'}>
              {item.ready ? <CheckCircle2 className="h-4 w-4" /> : item.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{item.label}</span>
              {item.detail ? (
                <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-70">{item.detail}</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-500">
        <span className="font-black text-slate-700">{isZh ? sectionCardEditorText.publishingTip.zh : sectionCardEditorText.publishingTip.en}: </span>
        {guide.advice}
      </p>
    </div>
  )
  const setSectionHeaderEnabled = (enabled: boolean) => {
    if (enabled) {
      patchContentJson({ header: readHeader(section) })
      return
    }

    const { header: _header, ...contentJson } = section.contentJson
    patchSection({ contentJson })
  }
  const renderCommonProperties = () => (
    <div className="grid gap-3 md:grid-cols-2">
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
      {supportsSectionHeader ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-[#176b5a] focus:ring-[#176b5a]"
              checked={hasSectionHeader}
              disabled={!canEdit}
              onChange={(event) => setSectionHeaderEnabled(event.target.checked)}
            />
            <span className="text-sm font-bold text-slate-900">{t('showSectionHeader')}</span>
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <SelectInput
              label={t('alignment')}
              value={header.align ?? 'center'}
              disabled={!canEdit || !hasSectionHeader}
              options={[{ value: 'left', label: t('left') }, { value: 'center', label: t('center') }]}
              onChange={(value) => patchHeader({ align: value as SectionHeader['align'] })}
            />
            <SelectInput
              label={t('scale')}
              value={header.scale ?? 'normal'}
              disabled={!canEdit || !hasSectionHeader}
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
              disabled={!canEdit || !hasSectionHeader}
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
        </div>
      ) : null}
    </div>
  )
  const openProperties = () => {
    setPendingFocusKey('')
    setActiveGuideLabel('')
    setPropertyTab('guidance')
    setPropertiesOpen(true)
  }
  const confirmRemove = () => {
    setRemoveConfirmOpen(false)
    onRemove()
  }

  useEffect(() => {
    if (!propertiesOpen || !pendingFocusKey) {
      return
    }

    const timer = window.setTimeout(() => {
      const target = modalContentRef.current?.querySelector<HTMLElement>(`[data-field-key="${pendingFocusKey}"]`)
      const input = target?.querySelector<HTMLElement>('input, textarea, select, [contenteditable="true"]')
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.classList.add('ring-2', 'ring-[#176b5a]/35', 'bg-emerald-50')
      input?.focus()
      window.setTimeout(() => {
        target?.classList.remove('ring-2', 'ring-[#176b5a]/35', 'bg-emerald-50')
      }, 1400)
    }, 100)

    return () => window.clearTimeout(timer)
  }, [pendingFocusKey, propertiesOpen, propertyTab])

  useEffect(() => {
    if (!isActive || !focusToken) {
      return
    }

    window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [focusToken, isActive])

  useEffect(() => {
    if (!isActive || !editContentRequestToken) {
      return
    }

    setPendingFocusKey('')
    setActiveGuideLabel('')
    setPropertyTab('guidance')
    setPropertiesOpen(true)
    onEditContentRequestHandled?.()
  }, [editContentRequestToken, isActive, onEditContentRequestHandled])

  return (
    <div
      ref={cardRef}
      role={isActive ? undefined : 'button'}
      tabIndex={isActive ? undefined : 0}
      className={`relative w-full min-w-0 outline-none transition ${isActive ? '' : 'cursor-pointer hover:ring-2 hover:ring-blue-200 focus-visible:ring-2 focus-visible:ring-blue-500'}`}
      onClick={(event) => {
        if (isActive) {
          return
        }
        if ((event.target as HTMLElement).closest('a')) {
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
      {isActive ? (
        <div className="rounded-2xl border border-[#2f4b42]/10 bg-white/90 shadow-[0_10px_26px_rgba(31,56,48,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <AppActionButton size="sm" disabled={!canEdit} onClick={onInsertBefore}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('insertSection')}
              </AppActionButton>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">{t('sectionHeading', { number: index + 1, type: section.type ? sectionTypeLabel(section.type, isZh) : t('selectType') })}</h3>
                {typeError ? <p className="mt-1 text-xs text-red-600">{typeError}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
              <AppActionButton size="sm" disabled={!section.type} onClick={openProperties}>{t('properties')}</AppActionButton>
              <AppActionButton size="sm" disabled={index === 0 || !canEdit} onClick={onMoveUp}>{t('moveUp')}</AppActionButton>
              <AppActionButton size="sm" disabled={index === total - 1 || !canEdit} onClick={onMoveDown}>{t('moveDown')}</AppActionButton>
              <AppActionButton size="sm" variant="danger" disabled={!canEdit} onClick={() => setRemoveConfirmOpen(true)}>{t('remove')}</AppActionButton>
            </div>
          </div>
          {languageIssueCount > 0 ? (
            <div className="mx-4 mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900" onClick={(event) => event.stopPropagation()}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <Languages className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-xs font-bold leading-5">
                    {t('sectionLanguageIssueWarning', {
                      count: languageIssueCount,
                      language: t(isZh ? 'english' : 'chinese'),
                    })}
                  </p>
                </div>
                {onFixLanguageIssues ? (
                  <AppActionButton
                    size="sm"
                    variant="secondary"
                    disabled={!canEdit || languageFixing}
                    onClick={onFixLanguageIssues}
                  >
                    {languageFixing ? t('aiFixingSectionLanguageIssues') : t('aiFixSectionLanguageIssues')}
                  </AppActionButton>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <SectionBlock
        section={section}
        mode={isActive ? 'edit' : 'render'}
        disabled={!canEdit}
        previewDensity="full"
        contextGroupId={contextGroupId}
        pageId={pageId}
        onUpdate={onUpdate}
        showProperties={false}
      />
      {propertiesOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:pb-4" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="absolute inset-0" aria-label={t('close')} onClick={() => setPropertiesOpen(false)} />
          <section className="relative z-10 flex h-[85vh] max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl sm:h-[min(74vh,640px)] sm:max-h-[74vh]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">{t('properties')}</h2>
                <p className="text-sm text-slate-500">{section.type ? sectionTypeLabel(section.type, isZh) : t('selectType')}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setPropertiesOpen(false)}
              >
                {t('close')}
              </button>
            </div>
            <div className="shrink-0 border-b border-slate-200 px-5 pt-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium ${propertyTab === 'guidance' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  onClick={() => setPropertyTab('guidance')}
                >
                  {t('sectionGuidance')}
                </button>
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
            <div ref={modalContentRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                {activeGuideLabel && propertyTab !== 'guidance' ? (
                  <div className="rounded-xl border border-[#176b5a]/20 bg-[#e3f0eb] px-3 py-2 text-xs font-bold text-[#176b5a]">
                    {isZh ? sectionCardEditorText.configuring.zh : sectionCardEditorText.configuring.en}{activeGuideLabel}
                  </div>
                ) : null}
                {propertyTab === 'guidance' ? renderGuide(true) : null}
                {propertyTab === 'common' ? renderCommonProperties() : null}
                {propertyTab === 'section' ? (
                  <SectionBlock
                    section={section}
                    mode="edit"
                    disabled={!canEdit}
                    contextGroupId={contextGroupId}
                    pageId={pageId}
                    onUpdate={onUpdate}
                    propertiesOnly
                  />
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {removeConfirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:pb-4" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="absolute inset-0" aria-label={t('cancel')} onClick={() => setRemoveConfirmOpen(false)} />
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`remove-section-title-${index}`}
            className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2 id={`remove-section-title-${index}`} className="text-lg font-semibold text-slate-950">{t('removeSectionConfirm')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t('sectionHeading', { number: index + 1, type: section.type ? sectionTypeLabel(section.type, isZh) : t('selectType') })}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AppActionButton variant="secondary" onClick={() => setRemoveConfirmOpen(false)}>
                {t('cancel')}
              </AppActionButton>
              <AppActionButton variant="danger" onClick={confirmRemove}>
                {t('remove')}
              </AppActionButton>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default SectionCardEditor
