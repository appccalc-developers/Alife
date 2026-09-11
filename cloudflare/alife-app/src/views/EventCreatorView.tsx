import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useAuthStore } from '../stores/auth'
import AppEmptyState from '../components/layout/AppEmptyState'
import EventCreationWizard from './EventCreationWizard'
import { setupPath } from '../utils/eventSetupFlow'

export default function EventCreatorView() {
  const location = useLocation(), route = useParams<{ eventId?: string; groupId?: string }>(), [params] = useSearchParams()
  const { language } = useAuthStore()
  const saved = useActiveEntityIds({ eventId: route.eventId || params.get('eventId') || undefined, groupId: route.groupId || params.get('groupId') || undefined })
  if (!route.eventId && location.pathname !== '/events/edit') return <EventCreationWizard />
  if (!saved.eventId) return <AppEmptyState title={language === 'zh' ? '请先选择活动' : 'Choose an event first'} description={language === 'zh' ? '从活动页面进入活动筹备。' : 'Open preparation from the event page.'} />
  const base = saved.groupId ? `/groups/${encodeURIComponent(saved.groupId)}/events/${encodeURIComponent(saved.eventId)}` : `/events/${encodeURIComponent(saved.eventId)}`
  return <Navigate replace to={setupPath(base, params.get('step') === 'ram' ? 'setup' : 'details', params.get('step') === 'ram' ? 'safety.ram' : undefined)} />
}
