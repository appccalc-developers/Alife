import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Bell, CalendarDays, ClipboardCheck, Settings2 } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useChurchSiteGroups } from '../components/church-life/ChurchSiteLayout'
import ChurchLifeResultsRegion from '../components/church-life/ChurchLifeResultsRegion'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppOverflowMenu from '../components/layout/AppOverflowMenu'
import AppPageShell from '../components/layout/AppPageShell'
import { churchQueryKey } from '../db/collections/groupCollection'
import { churchLifeQueryKeys, churchLifeService, type ChurchLifeGroup, type ChurchLifeRamReview } from '../services/churchLifeService'
import { groupService } from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { AnnouncementDto } from '../types/announcement'
import type { GroupEventRecord } from '../types/event'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { localizeText } from '../utils/localizedText'
import { churchGroupPath } from '../utils/churchLifeGroups'

const GroupPathBadge = ({ groupId, groups, language }: { groupId: string; groups: ChurchLifeGroup[]; language: string }) => (
  <span className="inline-flex max-w-full rounded-full bg-[#e7f2ed] px-2.5 py-1 text-[0.65rem] font-black text-[#176b5a]">
    <span className="truncate">{churchGroupPath(groupId, groups, language)}</span>
  </span>
)

const QueryError = ({ error, language, retry }: { error: unknown; language: string; retry: () => void }) => (
  <AppEmptyState
    title={language === 'zh' ? '无法加载这部分内容' : 'This content could not be loaded'}
    description={normalizeApiError(error).message}
    actionLabel={language === 'zh' ? '重试' : 'Retry'}
    onAction={retry}
  />
)

const LoadingBlock = ({ language }: { language: string }) => (
  <div className="grid gap-3" aria-live="polite">
    {[0, 1].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-[var(--alife-line)] bg-[var(--alife-surface-strong)]" />)}
    <span className="sr-only">{language === 'zh' ? '正在加载' : 'Loading'}</span>
  </div>
)

const ManageOwnerMenu = ({ groupId, groups, section, language }: {
  groupId: string
  groups: ChurchLifeGroup[]
  section: 'pages' | 'events' | 'announcements'
  language: string
}) => {
  const group = groups.find((item) => item.id === groupId)
  if (!group?.canManage) return null
  return (
    <AppOverflowMenu
      label={language === 'zh' ? '更多操作' : 'More actions'}
      actions={[{
        label: language === 'zh' ? '在所属组管理' : 'Manage in owning group',
        to: `/groups/${encodeURIComponent(groupId)}/manage?section=${section}`,
        icon: <Settings2 className="h-4 w-4" />,
      }]}
    />
  )
}

const EventCards = ({ events, groups, language }: { events: GroupEventRecord[]; groups: ChurchLifeGroup[]; language: string }) => {
  const locale = language === 'zh' ? 'zh-CN' : 'en-NZ'
  if (!events.length) {
    return <AppEmptyState title={language === 'zh' ? '没有符合条件的活动' : 'No matching events'} description={language === 'zh' ? '更换所属组筛选，或稍后再来查看。' : 'Choose another owning group or check again later.'} />
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {events.map((event) => (
        <article key={event.id} className="flex min-w-0 gap-4 rounded-2xl border border-[var(--alife-line)] bg-[var(--alife-surface-strong)] p-5 shadow-[var(--alife-shadow-soft)]">
          <time className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#f8eee6] text-[#8f5e43]">
            <span className="text-[0.62rem] font-black uppercase">{new Date(event.startDate).toLocaleDateString(locale, { month: 'short' })}</span>
            <strong className="text-2xl leading-none">{new Date(event.startDate).getDate()}</strong>
          </time>
          <div className="min-w-0 flex-1">
            <GroupPathBadge groupId={event.groupId} groups={groups} language={language} />
            <Link to={buildScopedEventDetailPath(event.groupId, event.id, true)} className="group mt-2 flex items-start gap-2">
              <h2 className="min-w-0 flex-1 text-base font-black text-[#27473f] group-hover:text-[#176b5a]">{(language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh}</h2>
              <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[#91a29b] group-hover:text-[#176b5a]" aria-hidden="true" />
            </Link>
            <p className="mt-1 text-xs text-[#718079]">{new Date(event.startDate).toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            <div className="mt-3 flex justify-end"><ManageOwnerMenu groupId={event.groupId} groups={groups} section="events" language={language} /></div>
          </div>
        </article>
      ))}
    </div>
  )
}

const AnnouncementCards = ({ announcements, groups, language }: { announcements: AnnouncementDto[]; groups: ChurchLifeGroup[]; language: string }) => {
  if (!announcements.length) {
    return <AppEmptyState title={language === 'zh' ? '没有符合条件的公告' : 'No matching announcements'} description={language === 'zh' ? '更换所属组筛选，或稍后再来查看。' : 'Choose another owning group or check again later.'} />
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {announcements.map((item) => (
        <article key={item.id} className="rounded-2xl border border-[var(--alife-line)] bg-[var(--alife-surface-strong)] p-5 shadow-[var(--alife-shadow-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <GroupPathBadge groupId={item.groupId} groups={groups} language={language} />
            {item.isPinned ? <span className="rounded-full bg-[#f8eee6] px-2.5 py-1 text-[0.62rem] font-black text-[#9b6447]">{language === 'zh' ? '置顶' : 'Pinned'}</span> : null}
          </div>
          <h2 className="mt-3 text-lg font-black text-[#27473f]">{localizeText(item.title, language)}</h2>
          <p className="mt-2 text-sm leading-6 text-[#718079]">{localizeText(item.summary, language)}</p>
          {item.content ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#52665e]">{localizeText(item.content, language)}</p> : null}
          <div className="mt-4 flex justify-end"><ManageOwnerMenu groupId={item.groupId} groups={groups} section="announcements" language={language} /></div>
        </article>
      ))}
    </div>
  )
}

const RamReviewCards = ({ reviews, groups, language }: { reviews: ChurchLifeRamReview[]; groups: ChurchLifeGroup[]; language: string }) => {
  if (!reviews.length) {
    return <AppEmptyState title={language === 'zh' ? '目前没有待独立审核的 RAM' : 'No independent RAM reviews are waiting'} description={language === 'zh' ? '活动组织方申请 RAM 独立审核后，会出现在这里。' : 'A RAM appears here after an event organiser requests independent review.'} />
  }
  const locale = language === 'zh' ? 'zh-CN' : 'en-NZ'
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {reviews.map((review) => (
        <article key={review.revisionId} className="rounded-2xl border border-[#e1cdbd] bg-[#fffaf4] p-5 shadow-[var(--alife-shadow-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <GroupPathBadge groupId={review.groupId} groups={groups} language={language} />
            <span className="rounded-full bg-[#f8e7db] px-2.5 py-1 text-[0.62rem] font-black text-[#9b583c]">
              {language === 'zh' ? `剩余风险 ${review.residualLevel}` : `Residual risk ${review.residualLevel}`}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-black text-[#27473f]">{localizeText(review.title, language)}</h2>
          <p className="mt-2 text-xs font-semibold text-[#718079]">
            {language === 'zh' ? `RAM 版本 ${review.revisionVersion} · 提交于 ` : `RAM version ${review.revisionVersion} · Submitted `}
            {new Date(review.submittedUtc).toLocaleString(locale)}
          </p>
          <Link to={`/events/${encodeURIComponent(review.eventId)}/ram?from=church`} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5a] px-4 text-sm font-black text-white transition hover:bg-[#105849]">
            {language === 'zh' ? '打开方案并独立审核' : 'Open plan and review'}<ArrowUpRight className="h-4 w-4" />
          </Link>
        </article>
      ))}
    </div>
  )
}

const ChurchLifeView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const viewerId = auth.me?.id ?? 'member'
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const section = searchParams.get('section')?.trim() ?? ''
  const ownerGroupId = searchParams.get('ownerGroupId')?.trim() ?? ''
  const selectedPageId = searchParams.get('page')?.trim() ?? ''
  const overview = section !== 'events' && section !== 'announcements' && section !== 'ram-reviews'

  const churchQuery = useQuery({ queryKey: churchQueryKey, queryFn: groupService.getChurch, staleTime: 5 * 60_000 })
  const pagesQuery = useQuery({
    queryKey: churchLifeQueryKeys.content('pages', viewerId, ownerGroupId || undefined),
    queryFn: () => churchLifeService.listPages(ownerGroupId || undefined),
    enabled: overview && Boolean(selectedPageId),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const eventsQuery = useQuery({
    queryKey: churchLifeQueryKeys.content('events', viewerId, ownerGroupId || undefined),
    queryFn: () => churchLifeService.listEvents(ownerGroupId || undefined),
    enabled: overview || section === 'events',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const announcementsQuery = useQuery({
    queryKey: churchLifeQueryKeys.content('announcements', viewerId, ownerGroupId || undefined),
    queryFn: () => churchLifeService.listAnnouncements(ownerGroupId || undefined),
    enabled: overview || section === 'announcements',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const ramReviewsQuery = useQuery({
    queryKey: churchLifeQueryKeys.content('ram-reviews', viewerId, ownerGroupId || undefined),
    queryFn: () => churchLifeService.listRamReviews(ownerGroupId || undefined),
    enabled: section === 'ram-reviews',
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  const queriedGroups = useMemo(() => {
    const byId = new Map<string, ChurchLifeGroup>()
    ;[pagesQuery.data?.groups, eventsQuery.data?.groups, announcementsQuery.data?.groups, ramReviewsQuery.data?.groups]
      .forEach((items) => items?.forEach((group) => byId.set(group.id, group)))
    return [...byId.values()]
  }, [announcementsQuery.data?.groups, eventsQuery.data?.groups, pagesQuery.data?.groups, ramReviewsQuery.data?.groups])
  useChurchSiteGroups(pagesQuery.data || eventsQuery.data || announcementsQuery.data || ramReviewsQuery.data ? queriedGroups : undefined)
  const [retainedGroups, setRetainedGroups] = useState<ChurchLifeGroup[]>([])
  const groups = queriedGroups.length ? queriedGroups : retainedGroups

  useEffect(() => {
    if (queriedGroups.length) setRetainedGroups(queriedGroups)
  }, [queriedGroups])

  useEffect(() => {
    if (!selectedPageId || !pagesQuery.data) return
    const page = pagesQuery.data.items.find((item) => item.id === selectedPageId)
    if (page) navigate(`/groups/${encodeURIComponent(page.ownerGroupId)}?page=${encodeURIComponent(page.id)}`, { replace: true })
  }, [navigate, pagesQuery.data, selectedPageId])


  if (churchQuery.isPending) return <AppPageShell title={language === 'zh' ? '教会生活' : 'Church Life'} context={language === 'zh' ? '教会生活 / 总览' : 'Church Life / Overview'}><LoadingBlock language={language} /></AppPageShell>
  if (churchQuery.error || !churchQuery.data) return <AppPageShell title={language === 'zh' ? '教会生活' : 'Church Life'} context={language === 'zh' ? '教会生活 / 总览' : 'Church Life / Overview'}><QueryError error={churchQuery.error} language={language} retry={() => void churchQuery.refetch()} /></AppPageShell>

  const title = section === 'events'
    ? (language === 'zh' ? '教会活动' : 'Church events')
    : section === 'announcements'
      ? (language === 'zh' ? '教会公告' : 'Church announcements')
      : section === 'ram-reviews'
        ? (language === 'zh' ? 'RAM 独立审核' : 'Independent RAM review')
      : localizeText(churchQuery.data.name, language)
  const context = section === 'events'
    ? (language === 'zh' ? '教会生活 / 活动' : 'Church Life / Events')
    : section === 'announcements'
      ? (language === 'zh' ? '教会生活 / 公告' : 'Church Life / Announcements')
      : section === 'ram-reviews'
        ? (language === 'zh' ? '教会生活 / RAM 独立审核' : 'Church Life / Independent RAM review')
      : (language === 'zh' ? '教会生活 / 总览' : 'Church Life / Overview')

  return (
    <AppPageShell
      title={title}
      context={context}
      subtitle={section === 'ram-reviews'
        ? (language === 'zh' ? '核对完整活动方案及 RAM 报告，并处理你的独立审核职务。' : 'Review the complete Event Plan and RAM report, then handle your independent-review duty.')
        : (language === 'zh' ? '一起聆听主日信息，关注教会近况，分享生活中的点滴。' : 'Listen to Sunday messages, catch up on church news, and share in everyday life together.')}
    >
      <div className="space-y-7 pb-4">
        {section === 'events' ? (
          <section aria-labelledby="church-events-heading" className="space-y-4">
            <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-[#176b5a]" /><h2 id="church-events-heading" className="text-2xl font-black text-[#18332d]">{language === 'zh' ? '所有已批准活动' : 'All approved events'}</h2></div>
            <ChurchLifeResultsRegion busy={eventsQuery.isFetching && !eventsQuery.isPending} language={language}>
              {eventsQuery.isPending ? <LoadingBlock language={language} /> : eventsQuery.error ? <QueryError error={eventsQuery.error} language={language} retry={() => void eventsQuery.refetch()} /> : <EventCards events={eventsQuery.data?.items ?? []} groups={groups} language={language} />}
            </ChurchLifeResultsRegion>
          </section>
        ) : section === 'announcements' ? (
          <section aria-labelledby="church-announcements-heading" className="space-y-4">
            <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-[#176b5a]" /><h2 id="church-announcements-heading" className="text-2xl font-black text-[#18332d]">{language === 'zh' ? '当前有效公告' : 'Active announcements'}</h2></div>
            <ChurchLifeResultsRegion busy={announcementsQuery.isFetching && !announcementsQuery.isPending} language={language}>
              {announcementsQuery.isPending ? <LoadingBlock language={language} /> : announcementsQuery.error ? <QueryError error={announcementsQuery.error} language={language} retry={() => void announcementsQuery.refetch()} /> : <AnnouncementCards announcements={announcementsQuery.data?.items ?? []} groups={groups} language={language} />}
            </ChurchLifeResultsRegion>
          </section>
        ) : section === 'ram-reviews' ? (
          <section aria-labelledby="church-ram-reviews-heading" className="space-y-4">
            <div className="flex items-center gap-3"><ClipboardCheck className="h-5 w-5 text-[#9b583c]" /><h2 id="church-ram-reviews-heading" className="text-2xl font-black text-[#18332d]">{language === 'zh' ? '等待你的 RAM 独立审核' : 'Waiting for your independent RAM review'}</h2></div>
            <ChurchLifeResultsRegion busy={ramReviewsQuery.isFetching && !ramReviewsQuery.isPending} language={language}>
              {ramReviewsQuery.isPending ? <LoadingBlock language={language} /> : ramReviewsQuery.error ? <QueryError error={ramReviewsQuery.error} language={language} retry={() => void ramReviewsQuery.refetch()} /> : <RamReviewCards reviews={ramReviewsQuery.data?.items ?? []} groups={groups} language={language} />}
            </ChurchLifeResultsRegion>
          </section>
        ) : (
          <>
            <section aria-labelledby="church-events-heading" className="space-y-4">
              <div className="flex items-end justify-between gap-4"><div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-[#176b5a]" /><h2 id="church-events-heading" className="text-2xl font-black text-[#18332d]">{language === 'zh' ? '近期活动' : 'Upcoming events'}</h2></div><Link className="text-sm font-black text-[#176b5a]" to={`/church?section=events${ownerGroupId ? `&ownerGroupId=${encodeURIComponent(ownerGroupId)}` : ''}`}>{language === 'zh' ? '查看全部' : 'View all'}</Link></div>
              <ChurchLifeResultsRegion busy={eventsQuery.isFetching && !eventsQuery.isPending} language={language}>
                {eventsQuery.isPending ? <LoadingBlock language={language} /> : eventsQuery.error ? <QueryError error={eventsQuery.error} language={language} retry={() => void eventsQuery.refetch()} /> : <EventCards events={(eventsQuery.data?.items ?? []).filter((event) => !event.endDate || new Date(event.endDate).getTime() >= Date.now()).slice(0, 4)} groups={groups} language={language} />}
              </ChurchLifeResultsRegion>
            </section>

            <section aria-labelledby="church-announcements-heading" className="space-y-4">
              <div className="flex items-end justify-between gap-4"><div className="flex items-center gap-3"><Bell className="h-5 w-5 text-[#176b5a]" /><h2 id="church-announcements-heading" className="text-2xl font-black text-[#18332d]">{language === 'zh' ? '最新公告' : 'Latest announcements'}</h2></div><Link className="text-sm font-black text-[#176b5a]" to={`/church?section=announcements${ownerGroupId ? `&ownerGroupId=${encodeURIComponent(ownerGroupId)}` : ''}`}>{language === 'zh' ? '查看全部' : 'View all'}</Link></div>
              <ChurchLifeResultsRegion busy={announcementsQuery.isFetching && !announcementsQuery.isPending} language={language}>
                {announcementsQuery.isPending ? <LoadingBlock language={language} /> : announcementsQuery.error ? <QueryError error={announcementsQuery.error} language={language} retry={() => void announcementsQuery.refetch()} /> : <AnnouncementCards announcements={(announcementsQuery.data?.items ?? []).slice(0, 4)} groups={groups} language={language} />}
              </ChurchLifeResultsRegion>
            </section>
          </>
        )}
      </div>
    </AppPageShell>
  )
}

export default ChurchLifeView
