import { CalendarDays, Repeat2 } from 'lucide-react'
import { Link } from 'react-router-dom'

type Props = {
  groupId: string
  currentGroupRoute: boolean
  active: 'events' | 'series'
  language: string
}

const EventWorkspaceNav = ({ groupId, currentGroupRoute, active, language }: Props) => {
  const chinese = language === 'zh'
  const eventsPath = currentGroupRoute ? '/groups?section=events' : `/groups/${encodeURIComponent(groupId)}?section=events`
  const seriesPath = currentGroupRoute ? '/event-series' : `/groups/${encodeURIComponent(groupId)}/event-series`
  const items = [
    { key: 'events' as const, label: chinese ? '活动列表' : 'Event list', detail: chinese ? '创建、筹备、举办与结项' : 'Create, prepare, run and close', path: eventsPath, icon: CalendarDays },
    { key: 'series' as const, label: chinese ? '定期活动' : 'Recurring events', detail: chinese ? '只管理重复举办的安排' : 'Schedules that repeat', path: seriesPath, icon: Repeat2 },
  ]
  return <nav aria-label={chinese ? '活动工作区' : 'Event workspace'} className="inline-flex max-w-full gap-1 rounded-2xl border border-[#2f4b42]/10 bg-[#edf4f0]/85 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
    {items.map((item) => {
      const selected = active === item.key
      const Icon = item.icon
      return <Link key={item.key} to={item.path} aria-current={selected ? 'page' : undefined} className={[
        'flex min-w-0 items-center gap-2.5 rounded-xl px-3.5 py-2 text-left transition sm:px-4',
        selected ? 'bg-white text-[#123d34] shadow-[0_5px_18px_rgba(31,56,48,0.09)]' : 'text-[#64756f] hover:bg-white/55 hover:text-[#123d34]',
      ].join(' ')}>
        <Icon className={['h-4 w-4 shrink-0', selected ? 'text-[#176b5a]' : 'text-[#82918c]'].join(' ')} />
        <span className="min-w-0"><span className="block text-sm font-black leading-tight">{item.label}</span><span className="hidden text-[10px] font-semibold leading-tight text-[#87938e] sm:block">{item.detail}</span></span>
      </Link>
    })}
  </nav>
}

export default EventWorkspaceNav
