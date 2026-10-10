import { sectionSourcePresetsText } from '../i18n/sectionSourcePresets.ts'
import type { ListSourceScope, ListSourceType, ListViewSource } from '../types/page-editor'
import type { LocalizedText, SectionHeader, SectionIconKey, SpotlightDataSource } from '../types'

type HeaderPreset = {
  icon: SectionIconKey
  title: LocalizedText
  subtitle: LocalizedText
  align?: SectionHeader['align']
  tone?: SectionHeader['tone']
}

type ListSourcePreset = HeaderPreset & {
  sourceType: ListSourceType
  sourceScope: ListSourceScope
  preset: string
  limit: number
}

const readHeader = (value: unknown): SectionHeader =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as SectionHeader
    : {}

const applyHeaderPreset = (currentHeader: unknown, preset: HeaderPreset): SectionHeader => {
  const current = readHeader(currentHeader)

  return {
    ...current,
    icon: preset.icon,
    title: preset.title,
    subtitle: preset.subtitle,
    align: current.align ?? preset.align ?? 'left',
    scale: current.scale ?? 'normal',
    tone: current.tone ?? preset.tone ?? 'default',
  }
}

export const LIST_VIEW_SOURCES: ListViewSource[] = ['events', 'sermons', 'groups', 'pages', 'members', 'contacts', 'media', 'posts']

const listSourcePresets: Record<ListViewSource, ListSourcePreset> = {
  events: {
    icon: 'calendar',
    title: { ...sectionSourcePresetsText.eventsTitle },
    subtitle: { ...sectionSourcePresetsText.eventsSubtitle },
    sourceType: 'events',
    sourceScope: 'group',
    preset: 'upcoming',
    limit: 4,
    tone: 'warm',
  },
  sermons: {
    icon: 'mic',
    title: { ...sectionSourcePresetsText.sermonsTitle },
    subtitle: { ...sectionSourcePresetsText.sermonsSubtitle },
    sourceType: 'sermons',
    sourceScope: 'global',
    preset: 'latest',
    limit: 4,
    tone: 'primary',
  },
  groups: {
    icon: 'people',
    title: { ...sectionSourcePresetsText.groupsTitle },
    subtitle: { ...sectionSourcePresetsText.groupsSubtitle },
    sourceType: 'groups',
    sourceScope: 'group',
    preset: 'featured',
    limit: 6,
    tone: 'fresh',
  },
  pages: {
    icon: 'book',
    title: { ...sectionSourcePresetsText.pagesTitle },
    subtitle: { ...sectionSourcePresetsText.pagesSubtitle },
    sourceType: 'pages',
    sourceScope: 'group',
    preset: 'latest',
    limit: 4,
  },
  members: {
    icon: 'handshake',
    title: { ...sectionSourcePresetsText.membersTitle },
    subtitle: { ...sectionSourcePresetsText.membersSubtitle },
    sourceType: 'members',
    sourceScope: 'group',
    preset: 'latest',
    limit: 8,
    tone: 'rose',
  },
  contacts: {
    icon: 'handshake',
    title: { ...sectionSourcePresetsText.contactsTitle },
    subtitle: { ...sectionSourcePresetsText.contactsSubtitle },
    sourceType: 'contacts',
    sourceScope: 'group',
    preset: 'latest',
    limit: 8,
    tone: 'fresh',
  },
  media: {
    icon: 'image',
    title: { ...sectionSourcePresetsText.mediaTitle },
    subtitle: { ...sectionSourcePresetsText.mediaSubtitle },
    sourceType: 'media',
    sourceScope: 'global',
    preset: 'latest',
    limit: 6,
  },
  posts: {
    icon: 'book',
    title: { ...sectionSourcePresetsText.postsTitle },
    subtitle: { ...sectionSourcePresetsText.postsSubtitle },
    sourceType: 'posts',
    sourceScope: 'global',
    preset: 'latest',
    limit: 4,
  },
}

export const normalizeListViewSource = (value: string): ListViewSource =>
  LIST_VIEW_SOURCES.includes(value as ListViewSource) ? value as ListViewSource : 'sermons'

export const listViewHeaderForSource = (source: ListViewSource, currentHeader?: unknown) =>
  applyHeaderPreset(currentHeader, listSourcePresets[source])

export const listViewContentDefaultsForSource = (source: ListViewSource, currentHeader?: unknown) => {
  const preset = listSourcePresets[source]

  return {
    header: listViewHeaderForSource(source, currentHeader),
    source,
    sourceType: preset.sourceType,
    sourceScope: preset.sourceScope,
    preset: preset.preset,
    limit: preset.limit,
    sortBy: source === 'events' || source === 'sermons' ? 'date' : 'source',
    sortDirection: source === 'events' ? 'asc' : source === 'sermons' ? 'desc' : 'asc',
  } as const
}

export const listViewPresetForSource = (source: ListViewSource) => listSourcePresets[source].preset

const spotlightSourcePresets: Record<SpotlightDataSource, HeaderPreset> = {
  announcements: {
    icon: 'church',
    title: { ...sectionSourcePresetsText.announcementsTitle },
    subtitle: { ...sectionSourcePresetsText.announcementsSubtitle },
    tone: 'primary',
  },
  events: {
    icon: 'calendar',
    title: { ...sectionSourcePresetsText.eventsTitleFeaturedEvent },
    subtitle: { ...sectionSourcePresetsText.eventsSubtitleHighlightOneGatheringWithDetailsAndAClearNextStep },
    tone: 'warm',
  },
  sermons: {
    icon: 'mic',
    title: { ...sectionSourcePresetsText.sermonsTitleFeaturedSermon },
    subtitle: { ...sectionSourcePresetsText.sermonsSubtitleFeatureOneMessageSpeakerOrTeachingTheme },
    tone: 'primary',
  },
  groups: {
    icon: 'people',
    title: { ...sectionSourcePresetsText.groupsTitleFeaturedGroup },
    subtitle: { ...sectionSourcePresetsText.groupsSubtitleInvitePeopleIntoBelongingCareAndSharedGrowth },
    tone: 'fresh',
  },
  members: {
    icon: 'handshake',
    title: { ...sectionSourcePresetsText.membersTitleFeaturedMember },
    subtitle: { ...sectionSourcePresetsText.membersSubtitleIntroduceAMemberStoryOrMinistryConnection },
    tone: 'rose',
  },
  contacts: {
    icon: 'handshake',
    title: { ...sectionSourcePresetsText.contactsTitleFeaturedContact },
    subtitle: { ...sectionSourcePresetsText.contactsSubtitleConnectPeopleWithTheRightMinistryContact },
    tone: 'fresh',
  },
  contactUs: {
    icon: 'handshake',
    title: { ...sectionSourcePresetsText.contactUsTitle },
    subtitle: { ...sectionSourcePresetsText.contactUsSubtitle },
    tone: 'fresh',
  },
}

export const spotlightHeaderForSource = (source: SpotlightDataSource, currentHeader?: unknown) =>
  applyHeaderPreset(currentHeader, spotlightSourcePresets[source])
