import { useCallback, useEffect, useRef, useState } from 'react'
import EventEnrollmentPanel from './EventEnrollmentPanel'
import AppActionButton from '../layout/AppActionButton'
import { EventToolSection as AppSectionCard } from './ArrangementTileDeck'
import { enrollmentSessionService } from '../../services/enrollmentSessionService'
import { eventService } from '../../services/eventService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { parseEventDto } from '../../utils/eventDetailPresentation'
import type { GroupEventRecord } from '../../types/event'
import type { EventEnrollmentRecord } from '../../types/enrollment'
import type { EventSurfaceProps } from './EventSurfaceRenderer'

export default function EventRegistrationWorkspace({ eventId, groupId, language }: EventSurfaceProps) {
  const viewer = useAuthStore().me, memberId = viewer?.id, zh = language === 'zh'
  const sequence = useRef(0)
  const [event, setEvent] = useState<GroupEventRecord | null>(null)
  const [enrollments, setEnrollments] = useState<EventEnrollmentRecord[]>([])
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const load = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true); setError(''); setEvent(null); setEnrollments([])
    try {
      const [events, rows] = await Promise.all([eventService.getGroupEvents(groupId, memberId), enrollmentSessionService.listEventEnrollments(eventId)])
      if (request !== sequence.current) return
      const saved = events.find(item => item.id === eventId)
      if (!saved) throw new Error('Event unavailable. / 活动不可用。')
      setEvent(saved); setEnrollments(rows)
    } catch (reason) { if (request === sequence.current) { setEvent(null); setEnrollments([]); setError(normalizeApiError(reason).message) } }
    finally { if (request === sequence.current) setLoading(false) }
  }, [eventId, groupId, memberId])
  useEffect(() => { void load(); return () => { sequence.current++ } }, [load])
  return <div className="space-y-3">
    {loading ? <p role="status">{zh ? '正在读取报名资料……' : 'Loading enrollment…'}</p> : null}
    {error ? <AppSectionCard title={zh ? '无法读取报名资料' : 'Unable to load enrollment'}><p role="alert">{error}</p><AppActionButton onClick={() => void load()}>{zh ? '重试' : 'Retry'}</AppActionButton></AppSectionCard> : null}
    {event ? <EventEnrollmentPanel event={event} eventDto={parseEventDto(event)} enrollments={enrollments} language={language} memberId={memberId} isGuest={viewer?.isGuest ?? true} loading={loading} onRefresh={load} /> : null}
  </div>
}
