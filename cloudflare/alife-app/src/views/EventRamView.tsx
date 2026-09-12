import { useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import AppPageShell from '../components/layout/AppPageShell'
import EventRamWorkspace from '../components/events/EventRamWorkspace'
export default function EventRamView() {
  const { eventId } = useParams()
  const { language } = useAuthStore()
  return <AppPageShell backLink={{ to: `/events/${eventId}`, label: language === 'zh' ? '返回活动' : 'Back to event' }}>{eventId ? <EventRamWorkspace eventId={eventId} language={language} /> : null}</AppPageShell>
}
