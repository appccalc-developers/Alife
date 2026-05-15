import React, { useMemo } from 'react'
import { useListSourceResolver } from '../../hooks/useListSourceResolver'
import type { ListViewMetadata } from '../../types/page-editor'
import { normalizeListViewMetadata } from '../../utils/listViewMetadata'
import type { SermonDto } from '../../services/sermonService'
import type { GroupSummaryDto } from '../../types'

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

export function subgroupToCardItem(subgroup: GroupSummaryDto): UniversalCardItem {
  return {
    id: subgroup.id,
    title: subgroup.name,
    subtitle: subgroup.accessType === 'Public' ? 'Public Group' : subgroup.accessType === 'Protected' ? 'Protected Group' : 'Private Group',
    imageUrl: undefined,
    url: `/groups/${subgroup.id}`,
    type: 'subgroup',
  }
}

export function memberToCardItem(member: { memberId: string; status: string; role: string }): UniversalCardItem {
  return {
    id: member.memberId,
    title: `Member ${member.memberId.slice(0, 8)}`,
    subtitle: `Role: ${member.role || 'Member'}`,
    url: `/members/${member.memberId}`,
    type: 'member',
  }
}

export function pageToCardItem(page: any): UniversalCardItem {
  return {
    id: page.id,
    title: page.title || 'Untitled Page',
    subtitle: (page as { description?: string }).description || (page as { slug?: string }).slug || '',
    date: (page as { updatedUtc?: string }).updatedUtc,
    url: `/pages/${(page as { slug?: string }).slug || page.id}`,
    type: 'page',
  }
}

// ---------- Card Component ----------

const sourceTypeLabels: Record<string, string> = {
  sermons: '讲道',
  events: '活动',
  pages: '页面',
  subgroups: '子小组',
  members: '成员',
}

export const ListCard: React.FC<{ item: UniversalCardItem; compact?: boolean }> = ({ item, compact }) => {
  const imgH = compact ? 'h-24' : 'h-40'
  const iconH = compact ? 'h-14' : 'h-20'
  const pad = compact ? 'p-2' : 'p-4'
  const titleCls = compact ? 'text-xs' : 'text-sm'

  return (
    <div className="group rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-slate-300">
      {item.imageUrl ? (
        <div className={`${imgH} overflow-hidden rounded-t-lg`}>
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
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
            {new Date(item.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        )}
        <a
          href={item.url}
          target={item.type === 'sermon' ? '_blank' : undefined}
          rel={item.type === 'sermon' ? 'noopener noreferrer' : undefined}
          className={`mt-2 inline-flex items-center font-medium text-blue-600 hover:text-blue-800 ${compact ? 'text-[10px]' : 'text-xs'}`}
        >
          查看详情
          <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
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
  // events: eventToCardItem, // TODO: implement when events collection exists
}

export const GroupListSection: React.FC<GroupListSectionProps> = ({ metadata, groupId, compact }) => {
  const raw = metadata as Record<string, unknown>
  const meta = useMemo(
    () => normalizeListViewMetadata(raw),
    [raw.sourceType, raw.sourceScope, raw.limit],
  )

  const { data, isLoading, error } = useListSourceResolver(meta, { groupId })

  const cardItems = useMemo(() => {
    const adapter = adapterMap[meta.sourceType]
    if (!adapter || !data) return []
    return data.map((item) => adapter(item)).filter(Boolean)
  }, [data, meta.sourceType])

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
        加载失败: {error.message}
      </div>
    )
  }

  if (cardItems.length === 0) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-white text-center text-sm text-slate-400 ${shellPad}`}>
        暂无 {sourceTypeLabels[meta.sourceType] || '内容'}
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${shellPad}`}>
      <div className={gridCls}>
        {cardItems.map((item) => (
          <ListCard key={item.id} item={item} compact={compact} />
        ))}
      </div>
    </div>
  )
}

export default GroupListSection
