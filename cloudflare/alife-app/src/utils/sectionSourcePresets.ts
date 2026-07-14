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

const localized = (en: string, zh: string): LocalizedText => ({ en, zh })

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

export const LIST_VIEW_SOURCES: ListViewSource[] = ['events', 'sermons', 'groups', 'pages', 'members', 'media', 'posts']

const listSourcePresets: Record<ListViewSource, ListSourcePreset> = {
  events: {
    icon: 'calendar',
    title: localized('Upcoming events', '近期活动'),
    subtitle: localized('Help people find the next gathering and respond in time.', '帮助大家看见接下来的活动，并及时回应。'),
    sourceType: 'events',
    sourceScope: 'group',
    preset: 'upcoming',
    limit: 4,
    tone: 'warm',
  },
  sermons: {
    icon: 'mic',
    title: localized('Latest sermons', '最新讲道'),
    subtitle: localized('Share recent teaching and messages from the community.', '分享群体近期的教导与信息。'),
    sourceType: 'sermons',
    sourceScope: 'global',
    preset: 'latest',
    limit: 4,
    tone: 'primary',
  },
  groups: {
    icon: 'people',
    title: localized('Find a group', '寻找小组'),
    subtitle: localized('Show groups where people can belong, serve, and grow.', '展示可以建立关系、服事和成长的小组。'),
    sourceType: 'groups',
    sourceScope: 'group',
    preset: 'featured',
    limit: 6,
    tone: 'fresh',
  },
  pages: {
    icon: 'book',
    title: localized('Explore pages', '浏览页面'),
    subtitle: localized('Guide people to related pages, updates, and resources.', '引导大家阅读相关页面、更新和资源。'),
    sourceType: 'pages',
    sourceScope: 'group',
    preset: 'latest',
    limit: 4,
  },
  members: {
    icon: 'handshake',
    title: localized('Meet members', '认识成员'),
    subtitle: localized('Introduce approved group members when the viewer has access.', '在有权限时介绍已批准的小组成员。'),
    sourceType: 'members',
    sourceScope: 'group',
    preset: 'latest',
    limit: 8,
    tone: 'rose',
  },
  media: {
    icon: 'image',
    title: localized('Latest media', '最新媒体'),
    subtitle: localized('Collect recent photos, videos, and visual memories.', '整理近期照片、视频和视觉记录。'),
    sourceType: 'media',
    sourceScope: 'global',
    preset: 'latest',
    limit: 6,
  },
  posts: {
    icon: 'book',
    title: localized('Latest posts', '最新文章'),
    subtitle: localized('Reserve space for future posts and written updates.', '为之后的文章和文字更新预留空间。'),
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
    title: localized('Latest announcement', '最新公告'),
    subtitle: localized('Highlight timely information for the right audience.', '向合适的对象突出显示及时信息。'),
    tone: 'primary',
  },
  events: {
    icon: 'calendar',
    title: localized('Featured event', '精选活动'),
    subtitle: localized('Highlight one gathering with details and a clear next step.', '突出一个活动，并提供清楚的下一步。'),
    tone: 'warm',
  },
  sermons: {
    icon: 'mic',
    title: localized('Featured sermon', '精选讲道'),
    subtitle: localized('Feature one message, speaker, or teaching theme.', '突出一篇信息、讲员或教导主题。'),
    tone: 'primary',
  },
  groups: {
    icon: 'people',
    title: localized('Featured group', '精选小组'),
    subtitle: localized('Invite people into belonging, care, and shared growth.', '邀请大家进入归属、关怀和共同成长。'),
    tone: 'fresh',
  },
  members: {
    icon: 'handshake',
    title: localized('Featured member', '精选成员'),
    subtitle: localized('Introduce a member story or ministry connection.', '介绍成员故事或服事连接。'),
    tone: 'rose',
  },
}

export const spotlightHeaderForSource = (source: SpotlightDataSource, currentHeader?: unknown) =>
  applyHeaderPreset(currentHeader, spotlightSourcePresets[source])
