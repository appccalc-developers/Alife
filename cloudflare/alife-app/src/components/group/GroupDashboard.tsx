import { useEffect, useState } from 'react'
import { Bell, Repeat2, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppSectionCard from '../layout/AppSectionCard'
import type { GroupDto, GroupPageDto } from '../../types/group'
import type { GroupEventRecord } from '../../types/event'
import { useAuthStore } from '../../stores/auth'
import { activeEntityService } from '../../services/activeEntityService'
import { localizeText } from '../../utils/localizedText'
import { announcementService } from '../../services/announcementService'
import type { AnnouncementDto } from '../../types/announcement'

type Props = {
  group: GroupDto
  pages: GroupPageDto[]
  events: GroupEventRecord[]
  canManage: boolean
  scope?: 'group' | 'church'
}

const GroupDashboard = ({ group, pages, events, canManage, scope = 'group' }: Props) => {
  const auth = useAuthStore()
  const language = auth.language
  const groupName = localizeText(group.name, language)
  const groupDescription = localizeText(group.description, language)
  const upcomingEvents = [...events]
    .filter((event) => event.ramStatus === 'approved' && (!event.endDate || new Date(event.endDate).getTime() >= Date.now()))
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
    .slice(0, 3)
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([])

  useEffect(() => {
    let cancelled = false
    announcementService.listActive(group.id)
      .then((items) => { if (!cancelled) setAnnouncements(items) })
      .catch(() => { if (!cancelled) setAnnouncements([]) })
    return () => { cancelled = true }
  }, [group.id, auth.me?.id])

  return (
    <>
      <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-[#fff4ea] px-6 py-8 text-[#18332d] shadow-[0_20px_55px_rgba(23,107,90,0.08)] sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              {scope === 'church'
                ? (language === 'zh' ? '教会生活' : 'Church Life')
                : (language === 'zh' ? '小组生活' : 'Group Life')}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{groupName}</h1>
            {groupDescription ? <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5f716a]">{groupDescription}</p> : null}
          </div>
          {scope === 'group' ? <Link
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-50"
            to="/groups/select"
          >
            <Repeat2 className="h-4 w-4" />
            {language === 'zh' ? '切换小组' : 'Switch group'}
          </Link> : null}
        </div>
      </section>

      {announcements.length > 0 ? (
        <section aria-label={language === 'zh' ? '当前公告' : 'Active announcements'} className="space-y-3">
          {announcements.map((announcement) => (
            <article
              key={announcement.id}
              className={[
                'rounded-2xl border px-5 py-4 shadow-sm',
                announcement.priority === 'urgent' ? 'border-rose-200 bg-rose-50 text-rose-950'
                  : announcement.priority === 'important' ? 'border-amber-200 bg-amber-50 text-amber-950'
                    : 'border-emerald-100 bg-white/85 text-[#18332d]',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black">{localizeText(announcement.title, language)}</h2>
                    {announcement.isPinned ? <span className="rounded-full bg-white/70 px-2 py-0.5 text-[0.65rem] font-bold uppercase">{language === 'zh' ? '置顶' : 'Pinned'}</span> : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 opacity-80">{localizeText(announcement.summary, language)}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <AppSectionCard
          title={scope === 'church' ? (language === 'zh' ? '教会页面' : 'Church pages') : (language === 'zh' ? '小组页面' : 'Group pages')}
          subtitle={scope === 'church'
            ? (language === 'zh' ? '浏览教会范围内已发布的内容。' : 'Browse published church-wide content.')
            : (language === 'zh' ? '打开已发布的小组页面，小组长仍可通过右下角按钮编辑当前页面。' : 'Open published group pages. Leaders can still edit the current page from the floating action button.')}
        >
          <div className="space-y-2">
            {pages.slice(0, 5).map((page) => (
              <Link
                key={page.id}
                className="flex items-center justify-between rounded-2xl border border-[#2f4b42]/10 bg-white/75 px-4 py-3 font-semibold text-[#18332d] transition hover:bg-[#e3f0eb]/60"
                to={scope === 'church' ? `/church?page=${encodeURIComponent(page.id)}` : '/groups'}
                onClick={scope === 'group' ? () => activeEntityService.setPage(page.id, group.id) : undefined}
              >
                <span>{localizeText(page.title, language)}</span>
                <span className="text-[#176b5a]">→</span>
              </Link>
            ))}
            {pages.length === 0 ? <p className="text-sm text-[#66766f]">{scope === 'church' ? (language === 'zh' ? '教会还没有发布内容。' : 'The church has not published any content yet.') : (language === 'zh' ? '这个小组还没有发布内容。' : 'This group has not published any content yet.')}</p> : null}
          </div>
        </AppSectionCard>

        <AppSectionCard title={language === 'zh' ? '近期活动' : 'Upcoming events'} subtitle={scope === 'church' ? (language === 'zh' ? '教会接下来的安排' : 'What is coming up for the church') : (language === 'zh' ? '小组接下来的安排' : 'What is coming up for the group')}>
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              scope === 'group' ? (
                <Link
                  key={event.id}
                  className="block rounded-2xl border border-[#2f4b42]/10 bg-white/75 px-4 py-3 transition hover:bg-[#e3f0eb]/60"
                  to="/events"
                  onClick={() => activeEntityService.setEvent(event.id, group.id)}
                >
                  <p className="font-semibold text-[#18332d]">{(language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh}</p>
                  <p className="mt-1 text-xs text-[#66766f]">{new Date(event.startDate).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-NZ')}</p>
                </Link>
              ) : (
                <article key={event.id} className="block rounded-2xl border border-[#2f4b42]/10 bg-white/75 px-4 py-3">
                  <p className="font-semibold text-[#18332d]">{(language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh}</p>
                  <p className="mt-1 text-xs text-[#66766f]">{new Date(event.startDate).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-NZ')}</p>
                </article>
              )
            ))}
            {upcomingEvents.length === 0 ? <p className="text-sm text-[#66766f]">{language === 'zh' ? '暂时没有近期活动。' : 'There are no upcoming events yet.'}</p> : null}
          </div>
        </AppSectionCard>
      </section>

      {canManage && scope === 'group' ? (
        <section>
          <Link className="inline-flex items-center gap-2 rounded-full bg-[#176b5a] px-5 py-3 text-sm font-bold text-white" to="/groups/manage?section=group">
            <Settings className="h-4 w-4" /> {language === 'zh' ? '管理小组' : 'Manage group'}
          </Link>
        </section>
      ) : null}
    </>
  )
}

export default GroupDashboard
