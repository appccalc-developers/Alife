import { eventRegistrationWorkspaceText } from '../../i18n/eventRegistrationWorkspace.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import EventEnrollmentPanel from './EventEnrollmentPanel'
import EventActivitySelectionPanel from './EventActivitySelectionPanel'
import AppActionButton from '../layout/AppActionButton'
import { EventToolSection as AppSectionCard } from './ArrangementTileDeck'
import { registrationWorkService, type RegistrationWork } from '../../services/eventRegistrationWorkService'
import { eventService } from '../../services/eventService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { parseEventDto } from '../../utils/eventDetailPresentation'
import type { GroupEventRecord } from '../../types/event'
import type { EventSurfaceProps } from './EventSurfaceRenderer'

export default function EventRegistrationWorkspace({ eventId, groupId, language }: EventSurfaceProps) {
  const viewer = useAuthStore().me, memberId = viewer?.id, zh = language === 'zh'
  const sequence = useRef(0)
  const [event, setEvent] = useState<GroupEventRecord | null>(null)
  const [work, setWork] = useState<RegistrationWork | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const load = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true); setError(''); setEvent(null); setWork(null)
    try {
      const [events, nextWork] = await Promise.all([eventService.getGroupEvents(groupId, memberId), registrationWorkService.get(eventId)])
      if (request !== sequence.current) return
      const saved = events.find(item => item.id === eventId)
      if (!saved) throw new Error(eventRegistrationWorkspaceText.load)
      setEvent(saved); setWork(nextWork)
    } catch (reason) { if (request === sequence.current) { setEvent(null); setWork(null); setError(normalizeApiError(reason).message) } }
    finally { if (request === sequence.current) setLoading(false) }
  }, [eventId, groupId, memberId])
  useEffect(() => { void load(); return () => { sequence.current++ } }, [load])
  return <div className="space-y-3">
    {loading ? <p role="status">{zh ? eventRegistrationWorkspaceText.loadingEnrollment.zh : eventRegistrationWorkspaceText.loadingEnrollment.en}</p> : null}
    {error ? <AppSectionCard summary={zh ? eventRegistrationWorkspaceText.loadingFailedExpandToRetry.zh : eventRegistrationWorkspaceText.loadingFailedExpandToRetry.en} title={zh ? eventRegistrationWorkspaceText.unableToLoadEnrollment.zh : eventRegistrationWorkspaceText.unableToLoadEnrollment.en}><p role="alert">{error}</p><AppActionButton onClick={() => void load()}>{zh ? eventRegistrationWorkspaceText.retry.zh : eventRegistrationWorkspaceText.retry.en}</AppActionButton></AppSectionCard> : null}
    {event && work ? <><EventEnrollmentPanel eventId={eventId} work={work} language={language} memberId={memberId} isGuest={viewer?.isGuest ?? true} loading={loading} /><EventActivitySelectionPanel eventId={eventId} language={language} timeZone={parseEventDto(event).timeZone}/></> : null}
  </div>
}
