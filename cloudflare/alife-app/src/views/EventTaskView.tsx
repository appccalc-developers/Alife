import { useParams, useSearchParams } from 'react-router-dom'
import AppPageShell from '../components/layout/AppPageShell'
import EventTaskDetailPanel from '../components/events/EventTaskDetailPanel'
import { useAuthStore } from '../stores/auth'
import { dutyReturnPath } from '../utils/eventDutyNavigation'

export default function EventTaskView() {
  const { eventId = '', taskId = '' } = useParams()
  const [params] = useSearchParams()
  const zh = useAuthStore().language === 'zh'
  return <AppPageShell title={zh ? '活动任务' : 'Event task'} backLink={{ to: params.has('returnTo') ? dutyReturnPath(params.get('returnTo')) : `/events/${eventId}/workspace/team`, label: zh ? '返回' : 'Back' }}>
    <EventTaskDetailPanel eventId={eventId} taskId={taskId} />
  </AppPageShell>
}
