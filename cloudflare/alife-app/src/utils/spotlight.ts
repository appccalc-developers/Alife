import type {
  SectionAction,
  SpotlightBinding,
  SpotlightDataSource,
  SpotlightMedia,
  SpotlightMode,
  SpotlightPreset,
} from '../types'
import type { ListViewMetadata } from '../types/page-editor'
import type { GroupSummaryDto } from '../types'
import type { AnnouncementDto } from '../types/announcement'
import type { GroupEventRecord } from '../types/event'
import type { SermonDto } from '../services/sermonService'
import type { ContactProfileDto } from '../types/contact'
import { translateUi, type UiTextKey } from '../i18n/uiText'
import { normalizeListViewMetadata } from './listViewMetadata'
import { localizeText } from './localizedText'
import { buildSermonVideoPath, extractYouTubeVideoId } from './youtube'
import { buildEventDetailPath } from './eventRoutes'

export type SpotlightMemberRecord = {
  memberId: string
  status: string
  role: string
  name?: string
  displayName?: string
}

export type SpotlightActionLink = {
  label: string
  url: string
  entityType?: 'group' | 'event' | 'sermon' | 'contact'
  entityId?: string
  groupId?: string
}

export type SpotlightResolvedContent = {
  title: string
  subtitle: string
  body: string
  media?: SpotlightMedia
  actions: SpotlightActionLink[]
}

export const SPOTLIGHT_DATA_SOURCES: SpotlightDataSource[] = ['announcements', 'events', 'sermons', 'groups', 'members', 'contacts', 'contactUs']

const trimString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const parseJsonObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value !== 'string' || !value.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

const formatDate = (value: string, language: string) => {
  if (!value.trim()) {
    return ''
  }

  const time = new Date(value)
  if (Number.isNaN(time.getTime())) {
    return value
  }

  return time.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const accessTypeLabel = (accessType: unknown, language: string) => {
  if (accessType === 'public') {
    return translateUi(language, 'publicGroup')
  }
  if (accessType === 'protected') {
    return translateUi(language, 'protectedGroup')
  }
  return translateUi(language, 'privateGroup')
}

const spotlightSourceLabelKey = (source: SpotlightDataSource): UiTextKey => {
  switch (source) {
    case 'announcements':
      return 'announcements'
    case 'groups':
      return 'groups'
    case 'members':
      return 'members'
    case 'contacts':
      return 'contacts'
    case 'contactUs':
      return 'contactUs'
    case 'events':
      return 'events'
    case 'sermons':
    default:
      return 'sermons'
  }
}

export const defaultSpotlightPreset = (source: SpotlightDataSource): SpotlightPreset => {
  switch (source) {
    case 'announcements':
      return 'latest'
    case 'events':
      return 'upcoming'
    case 'groups':
      return 'featured'
    case 'members':
      return 'latest'
    case 'contacts':
      return 'latest'
    case 'contactUs':
      return 'all'
    case 'sermons':
    default:
      return 'latest'
  }
}

export const readSpotlightBinding = (content: Record<string, unknown>): Required<Pick<SpotlightBinding, 'mode' | 'source' | 'preset'>> & SpotlightBinding => {
  const raw = content.spotlight && typeof content.spotlight === 'object' && !Array.isArray(content.spotlight)
    ? content.spotlight as Record<string, unknown>
    : {}
  const sourceCandidate = trimString(raw.source ?? raw.sourceType)
  const source = SPOTLIGHT_DATA_SOURCES.includes(sourceCandidate as SpotlightDataSource)
    ? sourceCandidate as SpotlightDataSource
    : 'sermons'
  const modeCandidate = trimString(raw.mode)
  const itemId = trimString(raw.itemId)
  const preset = trimString(raw.preset) || defaultSpotlightPreset(source)
  const hasDataBinding = modeCandidate === 'data' || Boolean(itemId) || Boolean(sourceCandidate) || Boolean(trimString(raw.preset))
  const mode: SpotlightMode = modeCandidate === 'manual'
    ? 'manual'
    : hasDataBinding
      ? 'data'
      : 'manual'

  return {
    mode,
    source,
    preset,
    ...(itemId ? { itemId } : {}),
  }
}

export const spotlightPresetOptionsForSource = (source: SpotlightDataSource, t: (key: UiTextKey) => string) => {
  if (source === 'events') {
    return [
      { value: 'upcoming', label: t('upcoming') },
      { value: 'recent', label: t('recent') },
      { value: 'all', label: t('all') },
    ]
  }

  if (source === 'groups') {
    return [
      { value: 'featured', label: t('featured') },
      { value: 'all', label: t('all') },
    ]
  }

  return [
    { value: 'latest', label: t('latest') },
    { value: 'all', label: t('all') },
  ]
}

export const buildSpotlightMetadata = (binding: SpotlightBinding): ListViewMetadata => {
  const normalized = readSpotlightBinding({ spotlight: binding })
  const source = normalized.source === 'contactUs' ? 'sermons' : normalized.source
  return normalizeListViewMetadata({
    sourceType: source,
    source: source === 'members' ? 'groups' : source === 'announcements' ? undefined : source,
    sourceScope: source === 'sermons' ? 'global' : 'group',
    preset: normalized.preset,
    limit: normalized.itemId ? 50 : 1,
  })
}

const spotlightItemId = (source: SpotlightDataSource, item: unknown) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return ''
  }

  const record = item as Record<string, unknown>
  return source === 'members' ? trimString(record.memberId) : trimString(record.id)
}

export const selectSpotlightItem = (items: unknown[] | undefined, binding: SpotlightBinding) => {
  if (!items?.length) {
    return undefined
  }

  const normalized = readSpotlightBinding({ spotlight: binding })
  if (!normalized.itemId) {
    return items[0]
  }

  return items.find((item) => spotlightItemId(normalized.source, item) === normalized.itemId) ?? items[0]
}

export const readSpotlightActionLinks = (content: Record<string, unknown>, language: string): SpotlightActionLink[] => {
  const rawActions = Array.isArray(content.actions) ? content.actions : []
  const mapped = rawActions
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return undefined
      }

      const action = entry as SectionAction
      const label = localizeText(action.label, language)
      const url = trimString(action.url)
      return url ? { label: label || url, url } : undefined
    })
    .filter((entry): entry is SpotlightActionLink => Boolean(entry))

  if (mapped.length > 0) {
    return mapped
  }

  const legacyUrl = trimString(content.linkUrl ?? content.ctaUrl ?? content.href)
  if (!legacyUrl) {
    return []
  }

  const legacyLabel = localizeText((content.linkLabel ?? content.linkText ?? content.ctaLabel) as Record<string, string> | string | undefined, language)
  return [{ label: legacyLabel || legacyUrl, url: legacyUrl }]
}

export const resolveSpotlightSourceLabel = (binding: SpotlightBinding, language: string) => {
  const normalized = readSpotlightBinding({ spotlight: binding })
  return translateUi(language, spotlightSourceLabelKey(normalized.source))
}

export const resolveDataSpotlightContent = (source: SpotlightDataSource, item: unknown, language: string): SpotlightResolvedContent => {
  if (source === 'contactUs') {
    return {
      title: translateUi(language, 'contactUs'),
      subtitle: '',
      body: '',
      actions: [],
    }
  }

  if (source === 'announcements') {
    const announcement = item as AnnouncementDto
    return {
      title: localizeText(announcement.title, language),
      subtitle: localizeText(announcement.summary, language),
      body: localizeText(announcement.content, language),
      actions: [],
    }
  }

  if (source === 'sermons') {
    const sermon = item as SermonDto
    const videoId = extractYouTubeVideoId(sermon.videoUrl)
    return {
      title: sermon.title || translateUi(language, 'sermons'),
      subtitle: sermon.speakerName || translateUi(language, 'todaysSermon'),
      body: sermon.preachedAt ? formatDate(sermon.preachedAt, language) : '',
      media: sermon.thumbnailUrl
        ? { type: 'image', url: sermon.thumbnailUrl }
        : sermon.videoUrl
          ? { type: 'youtube', url: sermon.videoUrl }
          : undefined,
      actions: videoId
        ? [{ label: translateUi(language, 'viewDetails'), url: buildSermonVideoPath(sermon.id, videoId), entityType: 'sermon', entityId: sermon.id }]
        : [],
    }
  }

  if (source === 'groups') {
    const group = item as GroupSummaryDto
    return {
      title: localizeText(group.name, language) || translateUi(language, 'groups'),
      subtitle: accessTypeLabel(group.accessType, language),
      body: localizeText(group.description, language),
      actions: [{ label: translateUi(language, 'viewDetails'), url: `/groups/${encodeURIComponent(group.id)}?view=overview`, entityType: 'group', entityId: group.id }],
    }
  }

  if (source === 'members') {
    const member = item as SpotlightMemberRecord
    const displayName = member.name || member.displayName || translateUi(language, 'memberShort', { id: member.memberId.slice(0, 8) })
    return {
      title: displayName,
      subtitle: translateUi(language, 'role', { role: member.role || 'member' }),
      body: member.status,
      actions: [{ label: translateUi(language, 'viewDetails'), url: '/profile/settings' }],
    }
  }

  if (source === 'contacts') {
    const contact = item as ContactProfileDto
    return {
      title: localizeText(contact.name, language),
      subtitle: localizeText(contact.role, language),
      body: localizeText(contact.notes ?? undefined, language),
      media: contact.photoUrl ? { type: 'image', url: contact.photoUrl } : undefined,
      actions: [{
        label: translateUi(language, 'viewDetails'),
        url: `/groups/${contact.ownerGroupId}/contacts/${contact.id}`,
        entityType: 'contact',
        entityId: contact.id,
        groupId: contact.ownerGroupId,
      }],
    }
  }

  const event = item as GroupEventRecord
  const details = parseJsonObject(event.eventDataJson)
  const title = language === 'zh'
    ? trimString(event.titleZh) || trimString(event.titleEn)
    : trimString(event.titleEn) || trimString(event.titleZh)
  const description = localizeText(details.description as Record<string, string> | undefined, language)
  const location = localizeText(details.locationName as Record<string, string> | undefined, language)
  const posterImageUrl = trimString(details.posterImageUrl)

  return {
    title: title || translateUi(language, 'events'),
    subtitle: formatDate(event.startDate, language),
    body: description || location,
    media: posterImageUrl ? { type: 'image', url: posterImageUrl } : undefined,
    actions: [{ label: translateUi(language, 'viewDetails'), url: buildEventDetailPath(event.groupId, event.id), entityType: 'event', entityId: event.id, groupId: event.groupId }],
  }
}
