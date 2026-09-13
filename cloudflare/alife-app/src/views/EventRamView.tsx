import { useParams, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import AppPageShell from '../components/layout/AppPageShell'
import EventRamWorkspace from '../components/events/EventRamWorkspace'
export default function EventRamView() {
  const { eventId } = useParams()
  const [searchParams] = useSearchParams()
  const { language } = useAuthStore()
  const zh = language === 'zh'
  const source = searchParams.get('from')
  const backLink = source === 'profile'
    ? { to: '/profile', label: zh ? '返回个人中心' : 'Back to Personal Center' }
    : source === 'church'
      ? { to: '/church?section=ram-reviews', label: zh ? '返回教会生活' : 'Back to Church Life' }
      : { to: `/events/${eventId}`, label: zh ? '返回活动' : 'Back to event' }
  return <AppPageShell
    title={zh ? 'RAM 独立审核' : 'Independent RAM review'}
    subtitle={zh ? '活动筹备 · 同时核对完整活动方案和 RAM 报告' : 'Event preparation · Review the complete Event Plan and RAM report together'}
    backLink={backLink}
  >{eventId ? <EventRamWorkspace eventId={eventId} language={language} showEventPlan /> : null}</AppPageShell>
}
