import React, { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, ContactRound, FileText, MicVocal, UserRound, Users } from 'lucide-react'
import { useListSourceResolver } from '../../hooks/useListSourceResolver'
import type { ListViewMetadata } from '../../types/page-editor'
import { normalizeListViewMetadata } from '../../utils/listViewMetadata'
import type { SermonDto } from '../../services/sermonService'
import type { GroupSummaryDto } from '../../types'
import type { GroupEventRecord } from '../../types/event'
import { useImagePreloader } from '../../hooks/useImagePreloader'
import CoverImage from '../CoverImage'
import { localizeText } from '../../utils/localizedText'
import { useAuthStore } from '../../stores/auth'
import { translateUi, type UiTextKey, useUiText } from '../../i18n/uiText'
import { activeEntityService } from '../../services/activeEntityService'
import { buildSermonVideoPath, extractYouTubeVideoId } from '../../utils/youtube'
import type { ContactProfileDto } from '../../types/contact'
import FeaturedCarousel, { type FeaturedCarouselItem } from '../FeaturedCarousel'

// ---------- Universal Card Interface ----------

export interface UniversalCardItem {
  id: string
  title: string
  subtitle: string
  imageUrl?: string
  date?: string
  url: string
  type: 'sermon' | 'event' | 'page' | 'member' | 'contact' | 'subgroup'
  groupId?: string
}

// ---------- Adapter functions ----------

export function sermonToCardItem(sermon: SermonDto): UniversalCardItem {
  const videoId = extractYouTubeVideoId(sermon.videoUrl)

  return {
    id: sermon.id,
    title: sermon.title,
    subtitle: sermon.speakerName || 'Sermon',
    imageUrl: sermon.thumbnailUrl || undefined,
    date: sermon.preachedAt || undefined,
    url: buildSermonVideoPath(sermon.id, videoId),
    type: 'sermon',
  }
}

export function subgroupToCardItem(subgroup: GroupSummaryDto, language = 'en'): UniversalCardItem {
  return {
    id: subgroup.id,
    title: localizeText(subgroup.name, language),
    subtitle:
      localizeText(subgroup.description, language) ||
      (subgroup.accessType === 'public'
        ? translateUi(language, 'publicGroup')
        : subgroup.accessType === 'protected'
          ? translateUi(language, 'protectedGroup')
          : translateUi(language, 'privateGroup')),
    imageUrl: undefined,
    url: `/groups/${encodeURIComponent(subgroup.id)}?view=overview`,
    type: 'subgroup',
    groupId: subgroup.id,
  }
}

export function memberToCardItem(member: { memberId: string; status: string; role: string; name?: string; displayName?: string }, language = 'en'): UniversalCardItem {
  const displayName = member.name || member.displayName || `Member ${member.memberId.slice(0, 8)}`
  return {
    id: member.memberId,
    title: displayName,
    subtitle: translateUi(language, 'role', { role: member.role || 'member' }),
    url: '/profile',
    type: 'member',
  }
}

export function pageToCardItem(page: any, groupId?: string, language = 'en'): UniversalCardItem {
  const pageId = (page as { id: string }).id
  return {
    id: pageId,
    title: localizeText(page.title, language) || translateUi(language, 'untitledPage'),
    subtitle: localizeText((page as { description?: unknown }).description as never, language),
    date: (page as { updatedUtc?: string }).updatedUtc,
    url: groupId ? '/groups' : '/pages',
    type: 'page',
    groupId,
  }
}

export function eventToCardItem(event: GroupEventRecord, language = 'en'): UniversalCardItem {
  let posterImageUrl: string | undefined
  try {
    const eventData = JSON.parse(event.eventDataJson) as { posterImageUrl?: unknown }
    posterImageUrl = typeof eventData.posterImageUrl === 'string' && eventData.posterImageUrl.trim()
      ? eventData.posterImageUrl
      : undefined
  } catch {
    posterImageUrl = undefined
  }
  const title = language === 'zh'
    ? event.titleZh || event.titleEn || translateUi(language, 'untitled')
    : event.titleEn || event.titleZh || translateUi(language, 'untitled')
  const dateStr = event.startDate || ''
  const locale = language === 'zh' ? 'zh-CN' : 'en-NZ'
  const dateDisplay = dateStr ? new Date(dateStr).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
  return {
    id: event.id,
    title,
    subtitle: dateDisplay,
    imageUrl: posterImageUrl,
    date: dateStr,
    url: '/events',
    type: 'event',
    groupId: event.groupId,
  }
}

export function contactToCardItem(contact: ContactProfileDto, language = 'en'): UniversalCardItem {
  return {
    id: contact.id,
    title: localizeText(contact.name, language),
    subtitle: localizeText(contact.role, language),
    imageUrl: contact.photoUrl || undefined,
    url: `/groups/${contact.ownerGroupId}/contacts/${contact.id}`,
    type: 'contact',
    groupId: contact.ownerGroupId,
  }
}

// ---------- Card Component ----------

const sourceTypeLabels: Record<string, UiTextKey> = {
  sermons: 'sermons',
  events: 'events',
  pages: 'pages',
  subgroups: 'subgroups',
  groups: 'groups',
  members: 'members',
  contacts: 'contacts',
  media: 'media',
  posts: 'posts',
}

const fallbackIcons = {
  event: CalendarDays,
  member: UserRound,
  contact: ContactRound,
  page: FileText,
  sermon: MicVocal,
  subgroup: Users,
} satisfies Record<UniversalCardItem['type'], typeof FileText>

const activateCardItem = (item: UniversalCardItem) => {
  if (item.type === 'sermon') {
    activeEntityService.setSermon(item.id)
  } else if (item.type === 'subgroup') {
    activeEntityService.setGroup(item.groupId || item.id)
  } else if (item.type === 'page') {
    activeEntityService.setPage(item.id, item.groupId)
  } else if (item.type === 'event') {
    activeEntityService.setEvent(item.id, item.groupId)
  }
}

export const ListCard: React.FC<{ item: UniversalCardItem; compact?: boolean; cardIndex?: number }> = ({ item, compact, cardIndex = 0 }) => {
  const { language } = useAuthStore()
  const t = useUiText()
  const imgH = compact ? 'h-24' : 'h-36 sm:h-40'
  const iconH = compact ? 'h-16' : 'h-28 sm:h-32'
  const pad = compact ? 'p-2.5' : 'p-3 sm:p-4'
  const titleCls = compact ? 'text-xs' : 'text-sm sm:text-base'
  const dateLocale = language === 'zh' ? 'zh-CN' : 'en-NZ'
  const FallbackIcon = fallbackIcons[item.type]
  return (
    <Link
      to={item.url}
      onClick={() => activateCardItem(item)}
      className="group block h-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-300"
    >
      {item.imageUrl ? (
        <div className={`${imgH} overflow-hidden`}>
          <CoverImage
            src={item.imageUrl}
            alt={item.title}
            index={cardIndex}
            aspectRatio={16 / 9}
            className="h-full w-full"
            fixedHeight
          />
        </div>
      ) : (
        <div className={`flex ${iconH} items-center justify-center bg-slate-50`}>
          <span className={`flex items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 ${compact ? 'h-10 w-10' : 'h-12 w-12'}`}>
            <FallbackIcon aria-hidden="true" className={compact ? 'h-5 w-5' : 'h-6 w-6'} strokeWidth={1.8} />
          </span>
        </div>
      )}
      <div className={pad}>
        <h3 className={`break-words font-semibold text-slate-900 line-clamp-2 ${titleCls}`}>{item.title}</h3>
        <p className={`mt-1 text-slate-500 line-clamp-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>{item.subtitle}</p>
        {item.date && (
          <p className={`mt-1 text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {new Date(item.date).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        )}
        <span className={`mt-2 inline-flex items-center font-medium text-blue-600 hover:text-blue-800 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {t('viewDetails')}
          <ChevronRight aria-hidden="true" className="ml-1 h-3 w-3" strokeWidth={2} />
        </span>
      </div>
    </Link>
  )
}

// ---------- Section Component ----------

interface GroupListSectionProps {
  metadata: ListViewMetadata | Record<string, unknown>
  /** When not on /groups/:groupId routes, pass the page's group id so subgroup/member/page lists resolve */
  groupId?: string
  /** Smaller cards for editor inline preview */
  compact?: boolean
  enabled?: boolean
}

const adapterMap: Record<string, (item: any) => UniversalCardItem> = {
  sermons: sermonToCardItem,
  subgroups: subgroupToCardItem,
  groups: subgroupToCardItem,
  members: memberToCardItem,
  pages: pageToCardItem,
  events: eventToCardItem,
  contacts: contactToCardItem,
}

export const GroupListSection: React.FC<GroupListSectionProps> = ({ metadata, groupId, compact, enabled = true }) => {
  const { language } = useAuthStore()
  const t = useUiText()
  const raw = metadata as Record<string, unknown>
  const meta = useMemo(
    () => normalizeListViewMetadata(raw),
    [raw.source, raw.sourceType, raw.sourceScope, raw.preset, raw.layout, raw.limit, raw.sortBy, raw.sortDirection, raw.filterText, raw.id],
  )

  const { data, isLoading, error } = useListSourceResolver(meta, { groupId, enabled })

  const cardItems = useMemo(() => {
    const resolvedSourceType = meta.sourceType === 'groups' ? 'subgroups' : meta.sourceType
    if (resolvedSourceType === 'pages') {
      return (data ?? []).map((item: any) => pageToCardItem(item, groupId, language)).filter(Boolean)
    }
    if (resolvedSourceType === 'events') {
      return (data ?? []).map((item: GroupEventRecord) => eventToCardItem(item, language)).filter(Boolean)
    }
    if (resolvedSourceType === 'contacts') {
      return (data ?? []).map((item: ContactProfileDto) => contactToCardItem(item, language)).filter(Boolean)
    }
    const adapter = adapterMap[resolvedSourceType]
    if (!adapter || !data) return []
    return data
      .map((item) => {
        if (resolvedSourceType === 'subgroups') {
          return subgroupToCardItem(item as GroupSummaryDto, language)
        }
        if (resolvedSourceType === 'members') {
          return memberToCardItem(item, language)
        }
        return adapter(item)
      })
      .filter(Boolean)
  }, [data, meta.sourceType, groupId, language])

  // Preload images for first 4 cards when data is ready
  const { preloadImages } = useImagePreloader()
  const initialLoadDone = useRef(false)

  useEffect(() => {
    if (cardItems.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true
      const imageUrls = cardItems.slice(0, 4).map((item) => item.imageUrl)
      preloadImages(imageUrls).catch(() => undefined)
    }
  }, [cardItems, preloadImages])

  const layout = meta.layout ?? 'grid'
  const gridCls =
    layout === 'list'
      ? 'grid grid-cols-1 gap-3 sm:gap-4'
      : layout === 'carousel'
        ? 'flex snap-x gap-3 overflow-x-auto pb-2 sm:gap-4 [&>*]:min-w-64 [&>*]:snap-start'
        : compact ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3'
  const shellPad = compact ? 'p-2' : 'p-3 sm:p-4'

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-white ${shellPad}`}>
        <div className={gridCls}>
          {[...Array(compact ? 2 : 3)].map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className={`${compact ? 'h-16' : 'h-28 sm:h-32'} bg-slate-100`} />
              <div className={compact ? 'p-2.5' : 'p-3 sm:p-4'}>
                <div className="h-3 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-2 w-1/2 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 ${shellPad}`}>
        {t('loadFailedWithMessage', { message: error.message })}
      </div>
    )
  }

  if (cardItems.length === 0) {
    return (
      <div className={`rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500 ${shellPad}`}>
        {t('noSourceItems', { source: t(sourceTypeLabels[meta.sourceType] ?? 'content') })}
      </div>
    )
  }

  if (layout === 'carousel') {
    const dateLocale = language === 'zh' ? 'zh-CN' : 'en-NZ'
    const badge = t(sourceTypeLabels[meta.sourceType] ?? 'content')
    const carouselItems: FeaturedCarouselItem[] = cardItems.map((item) => {
      const date = item.date
        ? new Date(item.date).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' })
        : ''
      const description = item.subtitle && item.subtitle !== date
        ? [item.subtitle, date].filter(Boolean).join(' · ')
        : item.subtitle || date

      return {
        id: item.id,
        title: item.title,
        description,
        imageUrl: item.imageUrl,
        to: item.url,
        badge,
        onActivate: () => activateCardItem(item),
      }
    })

    return (
      <FeaturedCarousel
        items={carouselItems}
        ariaLabel={badge}
        previousLabel={language === 'zh' ? `上一项${badge}` : `Previous ${badge}`}
        nextLabel={language === 'zh' ? `下一项${badge}` : `Next ${badge}`}
        compact={compact}
      />
    )
  }

  if (layout === 'coverflow') {
    const primary = cardItems[0]
    const previous = cardItems.length > 1 ? cardItems[cardItems.length - 1] : undefined
    const next = cardItems.length > 1 ? cardItems[1] : undefined

    return (
      <div className={`overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#ecfdf5)] ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
        <div className="grid items-center gap-3 lg:grid-cols-[0.76fr_1fr_0.76fr]">
          <div className="hidden opacity-55 blur-[0.2px] transition duration-300 lg:block">
            {previous ? <ListCard item={previous} compact={compact} cardIndex={cardItems.length - 1} /> : (
              <div className="min-h-64 rounded-lg border border-dashed border-slate-200 bg-white/55" />
            )}
          </div>
          <div className="relative z-10 lg:scale-105">
            <ListCard item={primary} compact={compact} cardIndex={0} />
          </div>
          <div className="hidden opacity-55 blur-[0.2px] transition duration-300 lg:block">
            {next ? <ListCard item={next} compact={compact} cardIndex={1} /> : (
              <div className="min-h-64 rounded-lg border border-dashed border-slate-200 bg-white/55" />
            )}
          </div>
        </div>
        {cardItems.length > 3 ? (
          <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-1 lg:hidden">
            {cardItems.slice(1).map((item, index) => (
              <div key={item.id} className="min-w-64 snap-start">
                <ListCard item={item} compact cardIndex={index + 1} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${shellPad}`}>
      <div className={gridCls}>
        {cardItems.map((item, index) => (
          <ListCard key={item.id} item={item} compact={compact} cardIndex={index} />
        ))}
      </div>
    </div>
  )
}

export default GroupListSection
