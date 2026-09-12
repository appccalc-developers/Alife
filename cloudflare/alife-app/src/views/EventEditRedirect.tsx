import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'

// Saved-event editing belongs to Workspace. Keep bookmarked legacy URLs usable
// without mounting the retired AI editor or starting its assistant session.
export default function EventEditRedirect() {
  const params = useParams(), [query] = useSearchParams()
  const groupId = params.groupId || query.get('groupId')
  const { eventId } = useActiveEntityIds({ groupId: groupId || undefined, eventId: params.eventId || query.get('eventId') || undefined })
  if (!eventId) return <Navigate to="/" replace />
  const base = groupId ? `/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}` : `/events/${encodeURIComponent(eventId)}`
  const target = query.get('step') === 'ram'
    ? `${base}/workspace/ram${query.get('flow') === 'setup' ? '?flow=setup' : ''}`
    : `${base}/workspace?flow=setup&stage=details`
  return <Navigate to={target} replace />
}
