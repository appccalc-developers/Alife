import { churchLifeViewText } from '../i18n/churchLifeView.ts'
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
    title={language === 'zh' ? churchLifeViewText.thisContentCouldNotBeLoaded.zh : churchLifeViewText.thisContentCouldNotBeLoaded.en}
    description={normalizeApiError(error).message}
    actionLabel={language === 'zh' ? churchLifeViewText.retry.zh : churchLifeViewText.retry.en}
    onAction={retry}
  />
)

const LoadingBlock = ({ language }: { language: string }) => (
  <div className="grid gap-3" aria-live="polite">
    {[0, 1].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-[var(--alife-line)] bg-[var(--alife-surface-strong)]" />)}
    <span className="sr-only">{language === 'zh' ? churchLifeViewText.loading.zh : churchLifeViewText.loading.en}</span>
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
      label={language === 'zh' ? churchLifeViewText.moreActions.zh : churchLifeViewText.moreActions.en}
      actions={[{
        label: language === 'zh' ? churchLifeViewText.manageInOwningGroup.zh : churchLifeViewText.manageInOwningGroup.en,
        to: `/groups/${encodeURIComponent(groupId)}/manage?section=${section}`,
        icon: <Settings2 className="h-4 w-4" />,
      }]}
    />
  )
}

const EventCards = ({ events, groups, language }: { events: GroupEventRecord[]; groups: ChurchLifeGroup[]; language: string }) => {
  const locale = language === 'zh' ? 'zh-CN' : 'en-NZ'
  if (!events.length) {
    return <AppEmptyState title={language === 'zh' ? churchLifeViewText.noMatchingEvents.zh : churchLifeViewText.noMatchingEvents.en} description={language === 'zh' ? churchLifeViewText.chooseAnotherOwningGroupOrCheckAgainLater.zh : churchLifeViewText.chooseAnotherOwningGroupOrCheckAgainLater.en} />
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
    return <AppEmptyState title={language === 'zh' ? churchLifeViewText.noMatchingAnnouncements.zh : churchLifeViewText.noMatchingAnnouncements.en} description={language === 'zh' ? churchLifeViewText.chooseAnotherOwningGroupOrCheckAgainLater.zh : churchLifeViewText.chooseAnotherOwningGroupOrCheckAgainLater.en} />
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {announcements.map((item) => (
        <article key={item.id} className="rounded-2xl border border-[var(--alife-line)] bg-[var(--alife-surface-strong)] p-5 shadow-[var(--alife-shadow-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <GroupPathBadge groupId={item.groupId} groups={groups} language={language} />
            {item.isPinned ? <span className="rounded-full bg-[#f8eee6] px-2.5 py-1 text-[0.62rem] font-black text-[#9b6447]">{language === 'zh' ? churchLifeViewText.pinned.zh : churchLifeViewText.pinned.en}</span> : null}
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
    return <AppEmptyState title={language === 'zh' ? churchLifeViewText.noIndependentRamReviewsAreWaiting.zh : churchLifeViewText.noIndependentRamReviewsAreWaiting.en} description={language === 'zh' ? churchLifeViewText.aRamAppearsHereAfterAnEventOrganiserRequests.zh : churchLifeViewText.aRamAppearsHereAfterAnEventOrganiserRequests.en} />
  }
  const locale = language === 'zh' ? 'zh-CN' : 'en-NZ'
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {reviews.map((review) => (
        <article key={review.revisionId} className="rounded-2xl border border-[#e1cdbd] bg-[#fffaf4] p-5 shadow-[var(--alife-shadow-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <GroupPathBadge groupId={review.groupId} groups={groups} language={language} />
            <span className="rounded-full bg-[#f8e7db] px-2.5 py-1 text-[0.62rem] font-black text-[#9b583c]">
              {language === 'zh' ? churchLifeViewText.residualRisk.zh(review.residualLevel) : churchLifeViewText.residualRisk.en(review.residualLevel)}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-black text-[#27473f]">{localizeText(review.title, language)}</h2>
          <p className="mt-2 text-xs font-semibold text-[#718079]">
            {language === 'zh' ? churchLifeViewText.ramVersionSubmitted.zh(review.revisionVersion) : churchLifeViewText.ramVersionSubmitted.en(review.revisionVersion)}
            {new Date(review.submittedUtc).toLocaleString(locale)}
          </p>
          <Link to={`/events/${encodeURIComponent(review.eventId)}/ram?from=church`} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5a] px-4 text-sm font-black text-white transition hover:bg-[#105849]">
            {language === 'zh' ? churchLifeViewText.openPlanAndReview.zh : churchLifeViewText.openPlanAndReview.en}<ArrowUpRight className="h-4 w-4" />
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


  if (churchQuery.isPending) return <AppPageShell title={language === 'zh' ? churchLifeViewText.churchLife.zh : churchLifeViewText.churchLife.en} context={language === 'zh' ? churchLifeViewText.churchLifeOverview.zh : churchLifeViewText.churchLifeOverview.en}><LoadingBlock language={language} /></AppPageShell>
  if (churchQuery.error || !churchQuery.data) return <AppPageShell title={language === 'zh' ? churchLifeViewText.churchLife.zh : churchLifeViewText.churchLife.en} context={language === 'zh' ? churchLifeViewText.churchLifeOverview.zh : churchLifeViewText.churchLifeOverview.en}><QueryError error={churchQuery.error} language={language} retry={() => void churchQuery.refetch()} /></AppPageShell>

  const title = section === 'events'
    ? (language === 'zh' ? churchLifeViewText.churchEvents.zh : churchLifeViewText.churchEvents.en)
    : section === 'announcements'
      ? (language === 'zh' ? churchLifeViewText.churchAnnouncements.zh : churchLifeViewText.churchAnnouncements.en)
      : section === 'ram-reviews'
        ? (language === 'zh' ? churchLifeViewText.independentRamReview.zh : churchLifeViewText.independentRamReview.en)
      : localizeText(churchQuery.data.name, language)
  const context = section === 'events'
    ? (language === 'zh' ? churchLifeViewText.churchLifeEvents.zh : churchLifeViewText.churchLifeEvents.en)
    : section === 'announcements'
      ? (language === 'zh' ? churchLifeViewText.churchLifeAnnouncements.zh : churchLifeViewText.churchLifeAnnouncements.en)
      : section === 'ram-reviews'
        ? (language === 'zh' ? churchLifeViewText.churchLifeIndependentRamReview.zh : churchLifeViewText.churchLifeIndependentRamReview.en)
      : (language === 'zh' ? churchLifeViewText.churchLifeOverview.zh : churchLifeViewText.churchLifeOverview.en)

  return (
    <AppPageShell
      title={title}
      context={context}
      subtitle={section === 'ram-reviews'
        ? (language === 'zh' ? churchLifeViewText.reviewTheCompleteEventPlanAndRamReportThen.zh : churchLifeViewText.reviewTheCompleteEventPlanAndRamReportThen.en)
        : (language === 'zh' ? churchLifeViewText.listenToSundayMessagesCatchUpOnChurchNews.zh : churchLifeViewText.listenToSundayMessagesCatchUpOnChurchNews.en)}
    >
      <div className="space-y-7 pb-4">
        {section === 'events' ? (
          <section aria-labelledby="church-events-heading" className="space-y-4">
            <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-[#176b5a]" /><h2 id="church-events-heading" className="text-2xl font-black text-[#18332d]">{language === 'zh' ? churchLifeViewText.allApprovedEvents.zh : churchLifeViewText.allApprovedEvents.en}</h2></div>
            <ChurchLifeResultsRegion busy={eventsQuery.isFetching && !eventsQuery.isPending} language={language}>
              {eventsQuery.isPending ? <LoadingBlock language={language} /> : eventsQuery.error ? <QueryError error={eventsQuery.error} language={language} retry={() => void eventsQuery.refetch()} /> : <EventCards events={eventsQuery.data?.items ?? []} groups={groups} language={language} />}
            </ChurchLifeResultsRegion>
          </section>
        ) : section === 'announcements' ? (
          <section aria-labelledby="church-announcements-heading" className="space-y-4">
            <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-[#176b5a]" /><h2 id="church-announcements-heading" className="text-2xl font-black text-[#18332d]">{language === 'zh' ? churchLifeViewText.activeAnnouncements.zh : churchLifeViewText.activeAnnouncements.en}</h2></div>
            <ChurchLifeResultsRegion busy={announcementsQuery.isFetching && !announcementsQuery.isPending} language={language}>
              {announcementsQuery.isPending ? <LoadingBlock language={language} /> : announcementsQuery.error ? <QueryError error={announcementsQuery.error} language={language} retry={() => void announcementsQuery.refetch()} /> : <AnnouncementCards announcements={announcementsQuery.data?.items ?? []} groups={groups} language={language} />}
            </ChurchLifeResultsRegion>
          </section>
        ) : section === 'ram-reviews' ? (
          <section aria-labelledby="church-ram-reviews-heading" className="space-y-4">
            <div className="flex items-center gap-3"><ClipboardCheck className="h-5 w-5 text-[#9b583c]" /><h2 id="church-ram-reviews-heading" className="text-2xl font-black text-[#18332d]">{language === 'zh' ? churchLifeViewText.waitingForYourIndependentRamReview.zh : churchLifeViewText.waitingForYourIndependentRamReview.en}</h2></div>
            <ChurchLifeResultsRegion busy={ramReviewsQuery.isFetching && !ramReviewsQuery.isPending} language={language}>
              {ramReviewsQuery.isPending ? <LoadingBlock language={language} /> : ramReviewsQuery.error ? <QueryError error={ramReviewsQuery.error} language={language} retry={() => void ramReviewsQuery.refetch()} /> : <RamReviewCards reviews={ramReviewsQuery.data?.items ?? []} groups={groups} language={language} />}
            </ChurchLifeResultsRegion>
          </section>
        ) : (
          <>
            <section aria-labelledby="church-events-heading" className="space-y-4">
              <div className="flex items-end justify-between gap-4"><div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-[#176b5a]" /><h2 id="church-events-heading" className="text-2xl font-black text-[#18332d]">{language === 'zh' ? churchLifeViewText.upcomingEvents.zh : churchLifeViewText.upcomingEvents.en}</h2></div><Link className="text-sm font-black text-[#176b5a]" to={`/church?section=events${ownerGroupId ? `&ownerGroupId=${encodeURIComponent(ownerGroupId)}` : ''}`}>{language === 'zh' ? churchLifeViewText.viewAll.zh : churchLifeViewText.viewAll.en}</Link></div>
              <ChurchLifeResultsRegion busy={eventsQuery.isFetching && !eventsQuery.isPending} language={language}>
                {eventsQuery.isPending ? <LoadingBlock language={language} /> : eventsQuery.error ? <QueryError error={eventsQuery.error} language={language} retry={() => void eventsQuery.refetch()} /> : <EventCards events={(eventsQuery.data?.items ?? []).filter((event) => !event.endDate || new Date(event.endDate).getTime() >= Date.now()).slice(0, 4)} groups={groups} language={language} />}
              </ChurchLifeResultsRegion>
            </section>

            <section aria-labelledby="church-announcements-heading" className="space-y-4">
              <div className="flex items-end justify-between gap-4"><div className="flex items-center gap-3"><Bell className="h-5 w-5 text-[#176b5a]" /><h2 id="church-announcements-heading" className="text-2xl font-black text-[#18332d]">{language === 'zh' ? churchLifeViewText.latestAnnouncements.zh : churchLifeViewText.latestAnnouncements.en}</h2></div><Link className="text-sm font-black text-[#176b5a]" to={`/church?section=announcements${ownerGroupId ? `&ownerGroupId=${encodeURIComponent(ownerGroupId)}` : ''}`}>{language === 'zh' ? churchLifeViewText.viewAll.zh : churchLifeViewText.viewAll.en}</Link></div>
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
