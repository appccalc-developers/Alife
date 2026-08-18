import { useEffect, useState } from 'react'
import { ArrowUpRight, Bell, CalendarDays, FileText, Repeat2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { GroupDto, GroupPageDto } from '../../types/group'
import type { GroupEventRecord } from '../../types/event'
import { useAuthStore } from '../../stores/auth'
import { activeEntityService } from '../../services/activeEntityService'
import { localizeText } from '../../utils/localizedText'
import { announcementService } from '../../services/announcementService'
import type { AnnouncementDto } from '../../types/announcement'
import { buildScopedEventDetailPath } from '../../utils/eventRoutes'

type Props = {
  group: GroupDto
  pages: GroupPageDto[]
  events: GroupEventRecord[]
  canManage: boolean
  scope?: 'group' | 'church'
  explicitGroupRoute?: boolean
}

const GroupDashboard = ({ group, pages, events, scope = 'group', explicitGroupRoute = false }: Props) => {
  const auth = useAuthStore()
  const language = auth.language
  const groupName = localizeText(group.name, language)
  const groupDescription = localizeText(group.description, language)
  const upcomingEvents = [...events]
    .filter((event) => event.ramStatus === 'approved' && (!event.endDate || new Date(event.endDate).getTime() >= Date.now()))
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
    .slice(0, 3)
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([])
  const openEvent = (eventId: string) => {
    activeEntityService.set({ pageId: '', eventId })
  }
  const eventPath = (eventId: string) => buildScopedEventDetailPath(group.id, eventId, scope === 'church' || explicitGroupRoute)

  useEffect(() => {
    let cancelled = false
    announcementService.listActive(group.id)
      .then((items) => { if (!cancelled) setAnnouncements(items) })
      .catch(() => { if (!cancelled) setAnnouncements([]) })
    return () => { cancelled = true }
  }, [group.id, auth.me?.id])

  if (scope === 'church') {
    const now = new Date()
    const churchUpcomingEvents = [...events]
      .filter((event) => event.ramStatus === 'approved' && (!event.endDate || new Date(event.endDate).getTime() >= Date.now()))
      .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
    const weekBuckets = Array.from({ length: 4 }, (_, index) => {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() + index * 7)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      return {
        label: language === 'zh' ? `第 ${index + 1} 周` : `Week ${index + 1}`,
        count: churchUpcomingEvents.filter((event) => {
          const date = new Date(event.startDate)
          return date >= start && date < end
        }).length,
      }
    })
    const maxWeekCount = Math.max(1, ...weekBuckets.map((bucket) => bucket.count))
    const chartPoints = weekBuckets.map((bucket, index) => ({
      ...bucket,
      x: 8 + index * 28,
      y: 68 - (bucket.count / maxWeekCount) * 46,
    }))
    const chartLine = chartPoints.map((point) => `${point.x},${point.y}`).join(' ')
    const nextEvent = churchUpcomingEvents[0]
    const locale = language === 'zh' ? 'zh-CN' : 'en-NZ'
    const eventTitle = (event: GroupEventRecord) => (language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh

    return (
      <div className="space-y-7 pb-4">
        <header className="relative isolate overflow-hidden rounded-[2rem] border border-[#dce8e2] bg-[linear-gradient(135deg,#fffdf8_0%,#f2f8f5_52%,#f8eee6_100%)] px-6 py-8 text-[#17362f] shadow-[0_24px_65px_rgba(35,73,63,0.10)] sm:px-9 sm:py-10">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#edc6a9]/45 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-9 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,.8fr)] lg:items-end">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-[#19705d]">{language === 'zh' ? '教会生活 · 总览' : 'Church Life · Overview'}</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.05em] sm:text-5xl">{groupName}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#61756d] sm:text-base">{groupDescription || (language === 'zh' ? '在这里了解教会近期安排、重要公告与公开内容。' : 'Find the church’s upcoming schedule, important notices, and published content here.')}</p>
              <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 border-t border-[#cadbd4] pt-5 text-xs font-bold text-[#687c74]">
                <span><strong className="mr-2 text-xl font-black text-[#17362f]">{churchUpcomingEvents.length}</strong>{language === 'zh' ? '近期活动' : 'upcoming events'}</span>
                <span><strong className="mr-2 text-xl font-black text-[#17362f]">{announcements.length}</strong>{language === 'zh' ? '当前公告' : 'active notices'}</span>
                <span><strong className="mr-2 text-xl font-black text-[#17362f]">{pages.length}</strong>{language === 'zh' ? '内容入口' : 'content links'}</span>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/80 bg-white/70 p-5 shadow-[0_16px_40px_rgba(35,73,63,0.08)] backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#19705d]">{language === 'zh' ? '未来四周' : 'Next four weeks'}</p>
                  <p className="mt-1 text-sm font-bold text-[#25463e]">{language === 'zh' ? '已发布活动安排' : 'Published event schedule'}</p>
                </div>
                <CalendarDays className="h-5 w-5 text-[#f1b486]" aria-hidden="true" />
              </div>
              <svg className="mt-4 h-24 w-full overflow-visible" viewBox="0 0 100 78" role="img" aria-label={language === 'zh' ? '未来四周已发布活动数量折线图' : 'Published event count for the next four weeks'}>
                <defs><linearGradient id="church-overview-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9ed9c5" stopOpacity="0.32" /><stop offset="100%" stopColor="#9ed9c5" stopOpacity="0" /></linearGradient></defs>
                <polygon points={`8,72 ${chartLine} 92,72`} fill="url(#church-overview-area)" />
                <polyline points={chartLine} fill="none" stroke="#258b73" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                {chartPoints.map((point) => <circle key={point.label} cx={point.x} cy={point.y} r="2.8" fill="#fffdf8" stroke="#d98b5f" strokeWidth="2" />)}
              </svg>
              <div className="grid grid-cols-4 gap-2 text-center text-[0.62rem] font-bold text-[#85938d]">{chartPoints.map((point) => <span key={point.label}>{point.label}<strong className="mt-0.5 block text-xs text-[#25463e]">{point.count}</strong></span>)}</div>
              <p className="mt-3 text-[0.62rem] leading-4 text-[#89968f]">{language === 'zh' ? '数据仅来自已批准且尚未结束的教会活动。' : 'Only approved church events that have not ended are included.'}</p>
            </div>
          </div>
        </header>

        {nextEvent ? (
          <Link to={eventPath(nextEvent.id)} onClick={() => openEvent(nextEvent.id)} className="group flex flex-col gap-4 rounded-[1.5rem] border border-[#d9e5df] bg-white px-5 py-5 shadow-[0_14px_40px_rgba(24,51,45,0.06)] transition hover:-translate-y-0.5 hover:border-[#9cc8b9] hover:shadow-[0_18px_45px_rgba(24,51,45,0.10)] sm:flex-row sm:items-center sm:px-7">
            <time className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#edf6f2] text-[#176b5a]">
              <span className="text-[0.62rem] font-black uppercase tracking-[0.12em]">{new Date(nextEvent.startDate).toLocaleDateString(locale, { month: 'short' })}</span>
              <span className="text-2xl font-black leading-none">{new Date(nextEvent.startDate).getDate()}</span>
            </time>
            <div className="min-w-0 flex-1">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#9b6447]">{language === 'zh' ? '下一个教会活动' : 'Next church event'}</p>
              <h2 className="mt-1 truncate text-xl font-black tracking-[-0.025em] text-[#18332d]">{eventTitle(nextEvent)}</h2>
              <p className="mt-1 text-sm text-[#708078]">{new Date(nextEvent.startDate).toLocaleString(locale, { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-[#123c33] text-white transition group-hover:rotate-6 group-hover:bg-[#176b5a] sm:self-auto"><ArrowUpRight className="h-4 w-4" /></span>
          </Link>
        ) : null}

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1.08fr)_minmax(19rem,.92fr)]">
          <section aria-labelledby="church-events-heading">
            <div className="mb-4 flex items-end justify-between gap-4 px-1">
              <div><p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#176b5a]">{language === 'zh' ? '日程' : 'Schedule'}</p><h2 id="church-events-heading" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{language === 'zh' ? '近期活动' : 'Upcoming events'}</h2></div>
              <span className="text-xs font-bold text-[#89958f]">{churchUpcomingEvents.length}</span>
            </div>
            <div className="overflow-hidden rounded-[1.65rem] border border-[#dfe7e3] bg-white shadow-[0_12px_36px_rgba(24,51,45,0.05)]">
              {churchUpcomingEvents.slice(0, 5).map((event) => (
                <Link key={event.id} to={eventPath(event.id)} onClick={() => openEvent(event.id)} className="group grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-[#e9eeeb] px-5 py-4 last:border-b-0 hover:bg-[#f5faf7]">
                  <time className="text-center"><span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#9b6447]">{new Date(event.startDate).toLocaleDateString(locale, { month: 'short' })}</span><span className="mt-0.5 block text-2xl font-black text-[#18332d]">{new Date(event.startDate).getDate()}</span></time>
                  <div className="min-w-0"><h3 className="truncate text-sm font-black text-[#27473f]">{eventTitle(event)}</h3><p className="mt-1 text-xs text-[#7c8983]">{new Date(event.startDate).toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>
                  <ArrowUpRight className="h-4 w-4 text-[#9aaba4] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#176b5a]" aria-hidden="true" />
                </Link>
              ))}
              {churchUpcomingEvents.length === 0 ? <p className="px-6 py-8 text-sm leading-6 text-[#718079]">{language === 'zh' ? '目前没有已发布的近期活动。' : 'There are no published upcoming events.'}</p> : null}
            </div>
          </section>

          <section aria-labelledby="church-notices-heading" className="rounded-[1.65rem] border border-[#dfe7e3] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,51,45,0.05)] sm:px-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#176b5a]">{language === 'zh' ? '请留意' : 'Noticeboard'}</p><h2 id="church-notices-heading" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{language === 'zh' ? '教会公告' : 'Church notices'}</h2></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8eee6] text-[#a86b4c]"><Bell className="h-4 w-4" aria-hidden="true" /></span></div>
            <div className="mt-5 divide-y divide-[#e8eeeb]">
              {announcements.slice(0, 4).map((item) => <article key={item.id} className="py-4 first:pt-0"><div className="flex items-center gap-2"><h3 className="text-sm font-black text-[#27473f]">{localizeText(item.title, language)}</h3>{item.isPinned ? <span className="rounded-full bg-[#f8eee6] px-2 py-0.5 text-[0.58rem] font-black uppercase text-[#9b6447]">{language === 'zh' ? '置顶' : 'Pinned'}</span> : null}</div><p className="mt-2 text-xs leading-5 text-[#718079]">{localizeText(item.summary, language)}</p></article>)}
              {announcements.length === 0 ? <p className="py-4 text-sm leading-6 text-[#74837d]">{language === 'zh' ? '目前没有需要特别留意的公告。' : 'There are no active notices right now.'}</p> : null}
            </div>
          </section>
        </div>

        <section aria-labelledby="church-pages-heading">
          <div className="mb-4 px-1"><p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#176b5a]">{language === 'zh' ? '探索' : 'Explore'}</p><h2 id="church-pages-heading" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{language === 'zh' ? '教会内容' : 'Church content'}</h2></div>
          {pages.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{pages.slice(0, 6).map((page, index) => <Link key={page.id} to={`/church?page=${encodeURIComponent(page.id)}`} className="group relative min-h-32 overflow-hidden rounded-[1.4rem] border border-[#dfe7e3] bg-white p-5 shadow-[0_10px_30px_rgba(24,51,45,0.04)] transition hover:-translate-y-0.5 hover:border-[#a9cabe]"><span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#93a099]">{String(index + 1).padStart(2, '0')}</span><h3 className="mt-5 pr-8 text-base font-black text-[#27473f]">{localizeText(page.title, language)}</h3><ArrowUpRight className="absolute bottom-5 right-5 h-4 w-4 text-[#9aaba4] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#176b5a]" aria-hidden="true" /></Link>)}</div> : <div className="rounded-[1.5rem] border border-dashed border-[#cfdcd6] px-6 py-8 text-sm text-[#718079]">{language === 'zh' ? '教会还没有发布内容。' : 'No church content has been published.'}</div>}
        </section>
      </div>
    )
  }

  const locale = language === 'zh' ? 'zh-CN' : 'en-NZ'
  const eventTitle = (event: GroupEventRecord) => (language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh

  return (
    <div className="space-y-7 pb-4">
      <header className="relative isolate overflow-hidden rounded-[2rem] border border-[#dce7e2] bg-[#fbfcf9] px-6 py-7 shadow-[0_24px_60px_rgba(30,63,54,0.09)] sm:px-8 sm:py-8">
        <div className="absolute inset-y-0 right-0 w-2/5 bg-[linear-gradient(135deg,rgba(219,239,231,0.25),rgba(241,205,178,0.38))]" aria-hidden="true" />
        <div className="absolute -right-12 -top-20 h-52 w-52 rounded-full border-[36px] border-white/45" aria-hidden="true" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full bg-[#e5f1ec] px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#176b5a]">{language === 'zh' ? '小组总览' : 'Group overview'}</span>
              <span className="text-xs font-bold text-[#89968f]">{language === 'zh' ? '小组生活' : 'Group Life'}</span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] text-[#18332d] sm:text-5xl">{groupName}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#65766f] sm:text-base">{groupDescription || (language === 'zh' ? '查看小组最近的活动、公告与已发布内容。' : 'See the group’s latest events, notices, and published content.')}</p>
          </div>
          <div className="relative rounded-[1.5rem] border border-white/80 bg-white/72 p-5 shadow-[0_15px_35px_rgba(30,63,54,0.07)] backdrop-blur-sm">
            <div className="grid grid-cols-3 divide-x divide-[#dce7e2] text-center">
              <div><strong className="block text-2xl font-black text-[#18332d]">{upcomingEvents.length}</strong><span className="mt-1 block text-[0.65rem] font-bold text-[#7c8b85]">{language === 'zh' ? '近期活动' : 'Events'}</span></div>
              <div><strong className="block text-2xl font-black text-[#18332d]">{announcements.length}</strong><span className="mt-1 block text-[0.65rem] font-bold text-[#7c8b85]">{language === 'zh' ? '公告' : 'Notices'}</span></div>
              <div><strong className="block text-2xl font-black text-[#18332d]">{pages.length}</strong><span className="mt-1 block text-[0.65rem] font-bold text-[#7c8b85]">{language === 'zh' ? '内容' : 'Pages'}</span></div>
            </div>
            <Link className="mt-5 flex items-center justify-between rounded-xl bg-[#183f35] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#176b5a]" to="/groups/select">
              <span className="inline-flex items-center gap-2"><Repeat2 className="h-4 w-4" />{language === 'zh' ? '切换小组' : 'Switch group'}</span>
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.08fr)_minmax(19rem,.92fr)]">
        <section aria-labelledby="group-events-heading">
          <div className="mb-4 flex items-end justify-between gap-4 px-1">
            <div><p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#176b5a]">{language === 'zh' ? '接下来' : 'Coming up'}</p><h2 id="group-events-heading" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{language === 'zh' ? '小组日程' : 'Group schedule'}</h2></div>
            <CalendarDays className="h-5 w-5 text-[#c07c56]" aria-hidden="true" />
          </div>
          <div className="overflow-hidden rounded-[1.65rem] border border-[#dfe7e3] bg-white shadow-[0_12px_36px_rgba(24,51,45,0.05)]">
            {upcomingEvents.map((event, index) => (
              <Link key={event.id} to={eventPath(event.id)} onClick={() => openEvent(event.id)} className="group grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-[#e8eeeb] px-5 py-5 last:border-b-0 hover:bg-[#f5faf7]">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf6f2] text-sm font-black text-[#176b5a]">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0"><h3 className="truncate text-sm font-black text-[#27473f]">{eventTitle(event)}</h3><p className="mt-1 text-xs text-[#7c8983]">{new Date(event.startDate).toLocaleString(locale, { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>
                <ArrowUpRight className="h-4 w-4 text-[#a0ada7] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#176b5a]" aria-hidden="true" />
              </Link>
            ))}
            {upcomingEvents.length === 0 ? <div className="px-6 py-10"><p className="text-sm font-bold text-[#405c54]">{language === 'zh' ? '日程正在准备中' : 'The schedule is taking shape'}</p><p className="mt-2 text-sm text-[#74837d]">{language === 'zh' ? '暂时没有已发布的近期活动。' : 'There are no published upcoming events yet.'}</p></div> : null}
          </div>
        </section>

        <section aria-labelledby="group-notices-heading" className="rounded-[1.65rem] border border-[#dfe7e3] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,51,45,0.05)] sm:px-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#176b5a]">{language === 'zh' ? '公告板' : 'Noticeboard'}</p><h2 id="group-notices-heading" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{language === 'zh' ? '小组公告' : 'Group notices'}</h2></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8eee6] text-[#a86b4c]"><Bell className="h-4 w-4" aria-hidden="true" /></span></div>
          <div className="mt-5 divide-y divide-[#e8eeeb]">
            {announcements.slice(0, 4).map((item) => <article key={item.id} className="py-4 first:pt-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-[#27473f]">{localizeText(item.title, language)}</h3>{item.isPinned ? <span className="rounded-full bg-[#f8eee6] px-2 py-0.5 text-[0.58rem] font-black uppercase text-[#9b6447]">{language === 'zh' ? '置顶' : 'Pinned'}</span> : null}</div><p className="mt-2 text-xs leading-5 text-[#718079]">{localizeText(item.summary, language)}</p></article>)}
            {announcements.length === 0 ? <div className="py-5"><p className="text-sm font-bold text-[#405c54]">{language === 'zh' ? '暂无重要提醒' : 'Nothing urgent right now'}</p><p className="mt-2 text-xs leading-5 text-[#74837d]">{language === 'zh' ? '新的小组公告会显示在这里。' : 'New group notices will appear here.'}</p></div> : null}
          </div>
        </section>
      </div>

      <section aria-labelledby="group-pages-heading">
        <div className="mb-4 flex items-end justify-between gap-4 px-1"><div><p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#176b5a]">{language === 'zh' ? '发现' : 'Discover'}</p><h2 id="group-pages-heading" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{language === 'zh' ? '小组内容' : 'Group content'}</h2></div><FileText className="h-5 w-5 text-[#87968f]" aria-hidden="true" /></div>
        {pages.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{pages.slice(0, 6).map((page, index) => <Link key={page.id} to={explicitGroupRoute ? `/groups/${encodeURIComponent(group.id)}?page=${encodeURIComponent(page.id)}` : '/groups'} onClick={() => { if (!explicitGroupRoute) activeEntityService.setPage(page.id, group.id) }} className="group relative min-h-32 overflow-hidden rounded-[1.4rem] border border-[#dfe7e3] bg-white p-5 shadow-[0_10px_30px_rgba(24,51,45,0.04)] transition hover:-translate-y-0.5 hover:border-[#a9cabe] hover:shadow-[0_16px_38px_rgba(24,51,45,0.08)]"><span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#9aa69f]">{String(index + 1).padStart(2, '0')}</span><h3 className="mt-5 pr-8 text-base font-black text-[#27473f]">{localizeText(page.title, language)}</h3><ArrowUpRight className="absolute bottom-5 right-5 h-4 w-4 text-[#9aaba4] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#176b5a]" aria-hidden="true" /></Link>)}</div> : <div className="rounded-[1.5rem] border border-dashed border-[#cfdcd6] bg-white/55 px-6 py-8 text-sm text-[#718079]">{language === 'zh' ? '这个小组还没有发布内容。' : 'This group has not published any content yet.'}</div>}
      </section>
    </div>
  )
}

export default GroupDashboard
