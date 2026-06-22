import { BookOpenText, CalendarDays, Repeat2, Settings, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppSectionCard from '../layout/AppSectionCard'
import type { GroupDto, GroupPageDto, GroupSummaryDto } from '../../types/group'
import type { GroupEventRecord } from '../../types/event'
import { useAuthStore } from '../../stores/auth'
import { activeEntityService } from '../../services/activeEntityService'
import { localizeText } from '../../utils/localizedText'

type Props = {
  group: GroupDto
  pages: GroupPageDto[]
  subgroups: GroupSummaryDto[]
  events: GroupEventRecord[]
  canManage: boolean
}

const GroupDashboard = ({ group, pages, subgroups, events, canManage }: Props) => {
  const auth = useAuthStore()
  const language = auth.language
  const groupName = localizeText(group.name, language)
  const groupDescription = localizeText(group.description, language)
  const upcomingEvents = [...events]
    .filter((event) => !event.endDate || new Date(event.endDate).getTime() >= Date.now())
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-[#fff4ea] px-6 py-8 text-[#18332d] shadow-[0_20px_55px_rgba(23,107,90,0.08)] sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">{language === 'zh' ? '小组工作台' : 'Group workspace'}</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{groupName}</h1>
            {groupDescription ? <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5f716a]">{groupDescription}</p> : null}
          </div>
          <Link
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-50"
            to="/groups/select"
          >
            <Repeat2 className="h-4 w-4" />
            {language === 'zh' ? '切换小组' : 'Switch group'}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { key: 'pages', label: language === 'zh' ? '小组页面' : 'Group pages', value: pages.length, icon: BookOpenText },
          { key: 'events', label: language === 'zh' ? '近期活动' : 'Upcoming events', value: upcomingEvents.length, icon: CalendarDays },
          { key: 'groups', label: language === 'zh' ? '下属小组' : 'Subgroups', value: subgroups.length, icon: UsersRound },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.key} className="alife-panel rounded-[1.5rem] p-5">
              <Icon className="h-6 w-6 text-[#176b5a]" />
              <p className="mt-4 text-3xl font-black text-[#18332d]">{item.value}</p>
              <p className="mt-1 text-sm font-semibold text-[#66766f]">{item.label}</p>
            </div>
          )
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <AppSectionCard title={language === 'zh' ? '小组页面' : 'Group pages'} subtitle={language === 'zh' ? '打开已发布的小组页面，小组长仍可通过右下角按钮编辑当前页面。' : 'Open published group pages. Leaders can still edit the current page from the floating action button.'}>
          <div className="space-y-2">
            {pages.slice(0, 5).map((page) => (
              <Link
                key={page.id}
                className="flex items-center justify-between rounded-2xl border border-[#2f4b42]/10 bg-white/75 px-4 py-3 font-semibold text-[#18332d] transition hover:bg-[#e3f0eb]/60"
                to="/groups"
                onClick={() => activeEntityService.setPage(page.id, group.id)}
              >
                <span>{localizeText(page.title, language)}</span>
                <span className="text-[#176b5a]">→</span>
              </Link>
            ))}
            {pages.length === 0 ? <p className="text-sm text-[#66766f]">{language === 'zh' ? '这个小组还没有发布内容。' : 'This group has not published any content yet.'}</p> : null}
          </div>
        </AppSectionCard>

        <AppSectionCard title={language === 'zh' ? '近期活动' : 'Upcoming events'} subtitle={language === 'zh' ? '小组接下来的安排' : 'What is coming up for the group'}>
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                className="block rounded-2xl border border-[#2f4b42]/10 bg-white/75 px-4 py-3 transition hover:bg-[#e3f0eb]/60"
                to="/events"
                onClick={() => activeEntityService.setEvent(event.id, group.id)}
              >
                <p className="font-semibold text-[#18332d]">{(language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh}</p>
                <p className="mt-1 text-xs text-[#66766f]">{new Date(event.startDate).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-NZ')}</p>
              </Link>
            ))}
            {upcomingEvents.length === 0 ? <p className="text-sm text-[#66766f]">{language === 'zh' ? '暂时没有近期活动。' : 'There are no upcoming events yet.'}</p> : null}
          </div>
        </AppSectionCard>
      </div>

      {canManage ? (
        <Link className="inline-flex items-center gap-2 rounded-full bg-[#176b5a] px-5 py-3 text-sm font-bold text-white" to="/groups/manage?section=group">
          <Settings className="h-4 w-4" /> {language === 'zh' ? '管理小组' : 'Manage group'}
        </Link>
      ) : null}
    </div>
  )
}

export default GroupDashboard
