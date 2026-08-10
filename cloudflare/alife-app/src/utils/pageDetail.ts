import type { PageDetailDto, SectionEditModel, SectionHeader, SectionIconKey, SectionSpacing, SpotlightMedia } from '../types'
import { SECTION_ICON_KEYS } from '../types/models'
import { normalizePageVisibility } from './apiEnums'
import { toLocalizedText } from './localizedText'
import { readSpotlightBinding } from './spotlight'

type SectionDto = {
  id?: string
  pageId?: string
  order: number
  type: number | string
  contentJson: string | Record<string, unknown>
  styleJson: string | Record<string, unknown>
}

const sectionIconKeys: readonly SectionIconKey[] = SECTION_ICON_KEYS
const sectionHeaderAlignments: Array<NonNullable<SectionHeader['align']>> = ['left', 'center']
const sectionHeaderScales: Array<NonNullable<SectionHeader['scale']>> = ['compact', 'normal', 'feature']
const sectionHeaderTones: Array<NonNullable<SectionHeader['tone']>> = ['default', 'primary', 'warm', 'fresh', 'rose']
const sectionSpacings: SectionSpacing[] = ['compact', 'normal', 'large']

const pickEnumValue = <T extends string>(value: unknown, validValues: readonly T[]): T | undefined =>
  typeof value === 'string' && validValues.includes(value as T) ? (value as T) : undefined

const toLocalizedHeaderText = (value: unknown) =>
  toLocalizedText(
    typeof value === 'string' || (value && typeof value === 'object' && !Array.isArray(value))
      ? (value as Record<string, string> | string)
      : undefined,
  )

const normalizeSectionHeader = (value: unknown): SectionHeader | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const header = value as Record<string, unknown>
  const icon = pickEnumValue(header.icon, sectionIconKeys)
  const align = pickEnumValue(header.align, sectionHeaderAlignments)
  const scale = pickEnumValue(header.scale, sectionHeaderScales)
  const tone = pickEnumValue(header.tone, sectionHeaderTones)
  const title = toLocalizedHeaderText(header.title)
  const subtitle = toLocalizedHeaderText(header.subtitle)
  const hasTitle = Object.values(title).some((item) => item.trim().length > 0)
  const hasSubtitle = Object.values(subtitle).some((item) => item.trim().length > 0)

  if (!icon && !align && !scale && !tone && !hasTitle && !hasSubtitle) {
    return undefined
  }

  return {
    ...(icon ? { icon } : {}),
    ...(hasTitle ? { title } : {}),
    ...(hasSubtitle ? { subtitle } : {}),
    align: align ?? 'center',
    scale: scale ?? 'normal',
    tone: tone ?? 'default',
  }
}

const normalizeSectionSpacing = (value: unknown): SectionSpacing =>
  pickEnumValue(value, sectionSpacings) ?? 'normal'

const readString = (value: unknown) => typeof value === 'string' ? value : ''

const firstString = (...values: unknown[]) => values.map(readString).find((item) => item.trim().length > 0) ?? ''

const isLandingHeroMetadata = (contentJson: Record<string, unknown>, styleJson: Record<string, unknown>) => {
  const marker = firstString(
    contentJson.sectionKind,
    contentJson.frontendType,
    styleJson.sectionKind,
    styleJson.frontendType,
    styleJson.layout,
  )
  const normalized = marker.replace(/[-_\s]+/g, '').toLowerCase()
  return normalized === 'landinghero' || normalized === 'landingherosection'
}

const isContactLocationMetadata = (contentJson: Record<string, unknown>, styleJson: Record<string, unknown>) => {
  const marker = firstString(
    contentJson.sectionKind,
    contentJson.frontendType,
    styleJson.sectionKind,
    styleJson.frontendType,
    styleJson.layout,
  )
  const normalized = marker.replace(/[-_\s]+/g, '').toLowerCase()
  return normalized === 'contactlocation' || normalized === 'contactlocationsection'
}

const isCountdownMetadata = (contentJson: Record<string, unknown>, styleJson: Record<string, unknown>) => {
  const marker = firstString(
    contentJson.sectionKind,
    contentJson.frontendType,
    styleJson.sectionKind,
    styleJson.frontendType,
    styleJson.layout,
  )
  const normalized = marker.replace(/[-_\s]+/g, '').toLowerCase()
  return normalized === 'countdown' || normalized === 'countdownsection'
}

const isSpotlightLayout = (layout: string) => {
  const normalized = layout.replace(/[-_\s]+/g, '').toLowerCase()
  return normalized === 'mediaspotlight'
    || normalized === 'split'
    || normalized === 'sermonspotlight'
    || normalized === 'spotlight'
    || normalized === 'visitspotlight'
    || normalized === 'visithighlight'
    || normalized === 'homevisit'
    || normalized === 'highlight'
}

const isLegacyVisitSpotlight = (contentJson: Record<string, unknown>, styleJson: Record<string, unknown>) => {
  const marker = firstString(
    contentJson.presentation,
    contentJson.variant,
    contentJson.template,
    styleJson.presentation,
    styleJson.variant,
    styleJson.layout,
  )
  const normalized = marker.replace(/[-_\s]+/g, '').toLowerCase()
  return normalized === 'visit' || normalized === 'visitspotlight' || normalized === 'highlight' || normalized === 'visithighlight' || normalized === 'homevisit'
}

const normalizeSpotlightMedia = (contentJson: Record<string, unknown>, styleJson: Record<string, unknown>): SpotlightMedia => {
  const media = contentJson.media && typeof contentJson.media === 'object' && !Array.isArray(contentJson.media)
    ? contentJson.media as Record<string, unknown>
    : {}
  const legacyYoutubeUrl = firstString(contentJson.youtubeUrl)
  const legacyImageUrl = firstString(contentJson.imageUrl, contentJson.backgroundImage, contentJson.backgroundImageUrl)
  const type = media.type === 'youtube' || legacyYoutubeUrl ? 'youtube' : 'image'
  const url = firstString(media.url, type === 'youtube' ? legacyYoutubeUrl : legacyImageUrl)
  const position = media.position === 'right' || styleJson.mediaPosition === 'right' || styleJson.imagePosition === 'right' ? 'right' : 'left'

  return {
    type,
    url,
    position,
    ...(media.alt ? { alt: toLocalizedHeaderText(media.alt) } : {}),
  }
}

const listSourceFromType = (value: number | string) => {
  if (value === 5 || value === 'PageList' || value === 'pageList') {
    return 'pages'
  }

  if (value === 6 || value === 'SermonList' || value === 'sermonList') {
    return 'sermons'
  }

  if (value === 'GroupList' || value === 'groupList') {
    return 'groups'
  }

  if (value === 'EventList' || value === 'eventList') {
    return 'events'
  }

  if (value === 'Gallery' || value === 'gallery' || value === 'MediaGallery' || value === 'mediaGallery') {
    return 'media'
  }

  return ''
}

const parseJsonObject = (value: string | Record<string, unknown> | null | undefined): Record<string, unknown> => {
  if (!value) {
    return {}
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return {}
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

const sectionTypeMapByNumber: Record<number, SectionEditModel['type']> = {
  1: 'RichText',
  2: 'RichText',
  4: 'CollectionShowcase',
  20: 'LandingHero',
  21: 'Countdown',
  22: 'ContactLocation',
  23: 'Spotlight',
  24: 'Album',
}

const normalizeSectionType = (value: number | string): SectionEditModel['type'] => {
  if (typeof value === 'number') {
    return sectionTypeMapByNumber[value] ?? 'RichText'
  }

  const normalized = String(value)
  const sectionTypeMapByName: Record<string, SectionEditModel['type']> = {
    landingHero: 'LandingHero',
    countdown: 'Countdown',
    contactLocation: 'ContactLocation',
    contactLocationSection: 'ContactLocation',
    mediaSpotlight: 'Spotlight',
    spotlight: 'Spotlight',
    sermonSpotlight: 'Spotlight',
    richText: 'RichText',
    postFeed: 'RichText',
    groupList: 'CollectionShowcase',
    eventList: 'CollectionShowcase',
    gallery: 'CollectionShowcase',
    mediaGallery: 'CollectionShowcase',
    listView: 'CollectionShowcase',
    collectionShowcase: 'CollectionShowcase',
    album: 'Album',
    pageList: 'CollectionShowcase',
    sermonList: 'CollectionShowcase',
  }
  if (sectionTypeMapByName[normalized]) {
    return sectionTypeMapByName[normalized]
  }

  const legacySectionTypeMap: Record<string, SectionEditModel['type']> = {
    LandingHero: 'LandingHero',
    Countdown: 'Countdown',
    ContactLocation: 'ContactLocation',
    ContactLocationSection: 'ContactLocation',
    MediaSpotlight: 'Spotlight',
    SermonSpotlight: 'Spotlight',
    PostFeed: 'RichText',
    Gallery: 'CollectionShowcase',
    MediaGallery: 'CollectionShowcase',
    EventList: 'CollectionShowcase',
    GroupList: 'CollectionShowcase',
    ListView: 'CollectionShowcase',
    Album: 'Album',
  }
  if (legacySectionTypeMap[normalized]) {
    return legacySectionTypeMap[normalized]
  }

  const values = ['LandingHero', 'Countdown', 'ContactLocation', 'Spotlight', 'RichText', 'CollectionShowcase', 'Album'] as const
  return values.includes(normalized as (typeof values)[number]) ? (normalized as SectionEditModel['type']) : 'RichText'
}

const isHeroStorageType = (value: number | string) => {
  if (value === 0) {
    return true
  }

  const normalized = String(value).replace(/[-_\s]+/g, '').toLowerCase()
  return normalized === 'hero' || normalized === 'iconfeaturegrid'
}

export const normalizePageSection = (section: SectionDto): SectionEditModel => {
  const contentJson = parseJsonObject(section.contentJson)
  const styleJson = parseJsonObject(section.styleJson)
  const normalizedHeader = normalizeSectionHeader(contentJson.header)
  if (normalizedHeader) {
    contentJson.header = normalizedHeader
  } else if (Object.prototype.hasOwnProperty.call(contentJson, 'header')) {
    delete contentJson.header
  }
  contentJson.spacing = normalizeSectionSpacing(contentJson.spacing)
  const normalizedType = normalizeSectionType(section.type)
  const legacySourceType = listSourceFromType(section.type)
  if (legacySourceType && !contentJson.sourceType) {
    contentJson.sourceType = legacySourceType
    contentJson.sourceScope = typeof contentJson.sourceScope === 'string' ? contentJson.sourceScope : 'global'
  }
  const layout = typeof styleJson.layout === 'string' ? styleJson.layout : ''

  const isStoredAsHero = isHeroStorageType(section.type)
  const type =
    isStoredAsHero && isContactLocationMetadata(contentJson, styleJson)
      ? 'ContactLocation'
      : isStoredAsHero && isLandingHeroMetadata(contentJson, styleJson)
      ? 'LandingHero'
      : isStoredAsHero && isCountdownMetadata(contentJson, styleJson)
      ? 'Countdown'
      : isStoredAsHero && isSpotlightLayout(layout)
      ? 'Spotlight'
      // Recover album sections saved through the former RichText fallback.
      : normalizedType === 'RichText' && typeof contentJson.albumId === 'string'
      ? 'Album'
      : normalizedType

  if (type === 'LandingHero') {
    contentJson.sectionKind = 'landingHero'
    styleJson.layout = 'landingHero'
    styleJson.frontendType = 'LandingHero'
  }

  if (type === 'Countdown') {
    contentJson.sectionKind = 'countdown'
    styleJson.layout = 'countdown'
    styleJson.frontendType = 'Countdown'
  }

  if (type === 'ContactLocation') {
    contentJson.sectionKind = 'contactLocation'
    contentJson.datasource = 'custom'
    styleJson.layout = 'contactLocation'
    styleJson.frontendType = 'ContactLocation'
  }

  if (type === 'Spotlight') {
    const media = normalizeSpotlightMedia(contentJson, styleJson)
    const legacyVisitSpotlight = isLegacyVisitSpotlight(contentJson, styleJson)
    const hasSpotlightConfig = Boolean(contentJson.spotlight && typeof contentJson.spotlight === 'object' && !Array.isArray(contentJson.spotlight))
    const binding = readSpotlightBinding(contentJson)
    contentJson.media = media
    contentJson.presentation = 'spotlight'
    contentJson.spotlight = legacyVisitSpotlight && !hasSpotlightConfig
      ? { ...binding, source: 'events', preset: 'upcoming' }
      : binding
    if (!contentJson.body) {
      contentJson.body = toLocalizedHeaderText(firstString(contentJson.body, contentJson.centerText, contentJson.text))
    }
    styleJson.layout = 'spotlight'
    styleJson.presentation = 'spotlight'
    styleJson.mediaPosition = media.position ?? 'left'
    styleJson.imagePosition = media.position ?? 'left'
  }

  if (type === 'CollectionShowcase') {
    const sourceType = firstString(contentJson.sourceType, legacySourceType, contentJson.source) || 'sermons'
    const source = firstString(contentJson.source, sourceType === 'subgroups' ? 'groups' : sourceType) || 'sermons'
    contentJson.source = source
    contentJson.sourceType = sourceType === 'groups' ? 'groups' : sourceType
    contentJson.preset = firstString(contentJson.preset) || (source === 'events' ? 'upcoming' : source === 'groups' ? 'featured' : source === 'sermons' || source === 'media' ? 'latest' : 'all')
    contentJson.layout = firstString(contentJson.layout) || 'grid'
    contentJson.limit = typeof contentJson.limit === 'number' && Number.isFinite(contentJson.limit)
      ? Math.min(Math.max(Math.floor(contentJson.limit), 1), 50)
      : 10
  }

  return {
    id: section.id,
    order: section.order,
    type,
    contentJson,
    styleJson,
  }
}

const parseTags = (tagsJson: string | undefined) => {
  if (!tagsJson) {
    return [] as string[]
  }

  try {
    const parsed = JSON.parse(tagsJson) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map((item) => String(item)).filter(Boolean)
  } catch {
    return []
  }
}

export const normalizePageDetail = (page: PageDetailDto & { tagsJson?: string }): PageDetailDto => ({
  ...page,
  title: toLocalizedText(page.title),
  description: toLocalizedText(page.description),
  tags: Array.isArray(page.tags) ? page.tags : parseTags(page.tagsJson),
  titleDisplayStyle: page.titleDisplayStyle ?? 'Default',
  visibility: normalizePageVisibility(page.visibility),
  sections: (page.sections ?? []).map((section) => normalizePageSection(section as unknown as SectionDto)),
})
