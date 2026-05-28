import React, { useEffect, useMemo, useRef } from 'react'
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

// ---------- Universal Card Interface ----------

export interface UniversalCardItem {
  id: string
  title: string
  subtitle: string
  imageUrl?: string
  date?: string
  url: string
  type: 'sermon' | 'event' | 'page' | 'member' | 'subgroup'
}

// ---------- Adapter functions ----------

export function sermonToCardItem(sermon: SermonDto): UniversalCardItem {
  return {
    id: sermon.id,
    title: sermon.title,
    subtitle: sermon.speakerName || 'Sermon',
    imageUrl: sermon.thumbnailUrl || undefined,
    date: sermon.preachedAt || undefined,
    url: sermon.videoUrl || `/sermons/${sermon.id}`,
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
    url: `/groups/${subgroup.id}`,
    type: 'subgroup',
  }
}

export function memberToCardItem(member: { memberId: string; status: string; role: string; name?: string; displayName?: string }, language = 'en'): UniversalCardItem {
  const displayName = member.name || member.displayName || `Member ${member.memberId.slice(0, 8)}`
  return {
    id: member.memberId,
    title: displayName,
    subtitle: translateUi(language, 'role', { role: member.role || 'member' }),
    url: `/members/${member.memberId}`,
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
    url: groupId ? `/groups/${groupId}?page=${encodeURIComponent(pageId)}` : `/pages/${pageId}`,
    type: 'page',
  }
}

export function eventToCardItem(event: GroupEventRecord, language = 'en'): UniversalCardItem {
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
    imageUrl: undefined,
    date: dateStr,
    url: `/groups/${event.groupId}/events/${event.id}/enroll`,
    type: 'event',
  }
}

// ---------- Card Component ----------

const sourceTypeLabels: Record<string, UiTextKey> = {
  sermons: 'sermons',
  events: 'events',
  pages: 'pages',
  subgroups: 'subgroups',
  members: 'members',
}

export const ListCard: React.FC<{ item: UniversalCardItem; compact?: boolean; cardIndex?: number }> = ({ item, compact, cardIndex = 0 }) => {
  const { language } = useAuthStore()
  const t = useUiText()
  const imgH = compact ? 'h-24' : 'h-40'
  const iconH = compact ? 'h-14' : 'h-20'
  const pad = compact ? 'p-2' : 'p-4'
  const titleCls = compact ? 'text-xs' : 'text-sm'
  const dateLocale = language === 'zh' ? 'zh-CN' : 'en-NZ'

  return (
    <a
      href={item.url}
      target={item.type === 'sermon' ? '_blank' : undefined}
      rel={item.type === 'sermon' ? 'noopener noreferrer' : undefined}
      className="group block rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-slate-300"
    >
      {item.imageUrl ? (
        <div className={`${imgH} overflow-hidden rounded-t-lg`}>
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
        <div className={`flex ${iconH} items-center justify-center rounded-t-lg bg-gradient-to-br from-slate-100 to-slate-200`}>
          <span className={compact ? 'text-2xl text-slate-400' : 'text-3xl text-slate-400'}>
            {item.type === 'sermon' ? '🎙️' : item.type === 'subgroup' ? '👥' : item.type === 'member' ? '👤' : '📄'}
          </span>
        </div>
      )}
      <div className={pad}>
        <h3 className={`font-semibold text-slate-900 line-clamp-2 ${titleCls}`}>{item.title}</h3>
        <p className={`mt-1 text-slate-500 line-clamp-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>{item.subtitle}</p>
        {item.date && (
          <p className={`mt-1 text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {new Date(item.date).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        )}
        <span className={`mt-2 inline-flex items-center font-medium text-blue-600 hover:text-blue-800 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {t('viewDetails')}
          <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </a>
  )
}

// ---------- Section Component ----------

interface GroupListSectionProps {
  metadata: ListViewMetadata | Record<string, unknown>
  /** When not on /groups/:groupId routes, pass the page's group id so subgroup/member/page lists resolve */
  groupId?: string
  /** Smaller cards for editor inline preview */
  compact?: boolean
}

const adapterMap: Record<string, (item: any) => UniversalCardItem> = {
  sermons: sermonToCardItem,
  subgroups: subgroupToCardItem,
  members: memberToCardItem,
  pages: pageToCardItem,
  events: eventToCardItem,
}

export const GroupListSection: React.FC<GroupListSectionProps> = ({ metadata, groupId, compact }) => {
  const { language } = useAuthStore()
  const t = useUiText()
  const raw = metadata as Record<string, unknown>
  const meta = useMemo(
    () => normalizeListViewMetadata(raw),
    [raw.sourceType, raw.sourceScope, raw.limit, raw.sortBy, raw.sortDirection, raw.filterText],
  )

  const { data, isLoading, error } = useListSourceResolver(meta, { groupId })

  const cardItems = useMemo(() => {
    if (meta.sourceType === 'pages') {
      return (data ?? []).map((item: any) => pageToCardItem(item, groupId, language)).filter(Boolean)
    }
    if (meta.sourceType === 'events') {
      return (data ?? []).map((item: GroupEventRecord) => eventToCardItem(item, language)).filter(Boolean)
    }
    const adapter = adapterMap[meta.sourceType]
    if (!adapter || !data) return []
    return data
      .map((item) => {
        if (meta.sourceType === 'subgroups') {
          return subgroupToCardItem(item as GroupSummaryDto, language)
        }
        if (meta.sourceType === 'members') {
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

  const gridCls = compact ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
  const shellPad = compact ? 'p-2' : 'p-4'

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-white ${shellPad}`}>
        <div className={gridCls}>
          {[...Array(compact ? 2 : 3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="h-3 w-3/4 rounded bg-slate-200" />
              <div className="mt-2 h-2 w-1/2 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 text-sm text-red-600 ${shellPad}`}>
        {t('loadFailedWithMessage', { message: error.message })}
      </div>
    )
  }

  if (cardItems.length === 0) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-white text-center text-sm text-slate-400 ${shellPad}`}>
        {t('noSourceItems', { source: t(sourceTypeLabels[meta.sourceType] ?? 'content') })}
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
