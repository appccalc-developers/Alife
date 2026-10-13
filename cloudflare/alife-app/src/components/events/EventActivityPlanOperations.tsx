import { useCallback, useEffect, useState } from 'react'
import EventActivityPlanPanel from './EventActivityPlanPanel'
import EventActivityProjectConfiguration, { type ActivityOperationsMutation } from './EventActivityProjectConfiguration'
import EventActivityModuleConfigurations from './EventActivityModuleConfigurations'
import { eventActivityOperationsService } from '../../services/eventActivityOperationsService'
import { eventActivityModuleConfigurationService } from '../../services/eventActivityModuleConfigurationService'
import { eventOperationsService } from '../../services/eventOperationsService'
import { eventVenueService } from '../../services/eventVenueService'
import { normalizeApiError } from '../../services/http'
import type { ActivityOperationsWorkspace } from '../../types/eventActivityOperations'
import type { ProjectModuleConfigurationWorkspace, ProjectModuleDetails, ProjectModuleKind } from '../../types/eventActivityModuleConfigurations'
import type { EventOccurrence } from '../../types/eventOperations'
import type { EventVenueReservation } from '../../types/eventVenue'
import type { PlannedActivity } from '../../types/eventActivityPlan'
import type { FormAssistantContext } from '../../../../shared/eventFormAssistant'
import AppActionButton from '../layout/AppActionButton'
import { eventActivityOperationsText as copy } from '../../i18n/eventActivityOperations'

export default function EventActivityPlanOperations({ eventId, groupId, zh, eventContext, onSaved, onPlanChange, onBusy, timeZone }: { eventId: string; groupId: string; zh: boolean; eventContext?: FormAssistantContext; onSaved?: () => Promise<void>; onPlanChange?: (plan: import('../../types/eventActivityPlan').ActivityPlanData) => void; onBusy?: (busy: boolean) => void; timeZone?: string }) {
  const [workspace, setWorkspace] = useState<ActivityOperationsWorkspace | null>(null)
  const [moduleConfigurations, setModuleConfigurations] = useState<ProjectModuleConfigurationWorkspace | null>(null)
  const [occurrences, setOccurrences] = useState<EventOccurrence[]>([])
  const [reservations, setReservations] = useState<EventVenueReservation[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const language = zh ? 'zh' : 'en'
  const load = useCallback(async () => {
    const [operations, slots, venue, configurations] = await Promise.all([eventActivityOperationsService.get(eventId), eventOperationsService.listOccurrences(eventId), eventVenueService.getWorkspace(eventId).catch(() => null), eventActivityModuleConfigurationService.get(eventId).catch(() => null)])
    setWorkspace(operations); setOccurrences(slots); setReservations(venue?.reservations ?? []); setModuleConfigurations(configurations); setError('')
  }, [eventId])
  useEffect(() => { let active = true; void Promise.all([eventActivityOperationsService.get(eventId), eventOperationsService.listOccurrences(eventId), eventVenueService.getWorkspace(eventId).catch(() => null), eventActivityModuleConfigurationService.get(eventId).catch(() => null)])
    .then(([operations, slots, venue, configurations]) => { if (active) { setWorkspace(operations); setOccurrences(slots); setReservations(venue?.reservations ?? []); setModuleConfigurations(configurations) } })
    .catch(reason => { if (active) setError(normalizeApiError(reason).message) }); return () => { active = false } }, [eventId])
  const mutate: ActivityOperationsMutation = async action => {
    setBusy(true); setError(''); setNotice('')
    try { setWorkspace(await action()); setNotice(copy.savedNotice[language]); await onSaved?.() }
    catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setBusy(false) }
  }
  const saveConfiguration = async (activityId: string, kind: ProjectModuleKind, details: ProjectModuleDetails, eTag: string) => {
    setBusy(true); setError(''); setNotice('')
    try { const saved = await eventActivityModuleConfigurationService.save(eventId, activityId, kind, details, eTag); setModuleConfigurations(previous => previous ? { ...previous, items: [...previous.items.filter(row => !(row.activityId === activityId && row.kind === kind && row.occurrenceId === details.occurrenceId)), saved] } : previous); setNotice(copy.savedNotice[language]); await onSaved?.() }
    catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setBusy(false) }
  }
  const renderConfiguration = (activity: PlannedActivity, planDirty = false) => <div className="space-y-3"><EventActivityProjectConfiguration eventId={eventId} activity={activity} project={workspace?.projects.find(project => project.activityId === activity.id)} workspace={workspace} occurrences={occurrences} reservations={reservations} timeZone={timeZone || 'UTC'} language={language} planDirty={planDirty} busy={busy} mutate={mutate}/><EventActivityModuleConfigurations eventId={eventId} activity={activity} workspace={moduleConfigurations} occurrences={occurrences} timeZone={timeZone || 'UTC'} language={language} planDirty={planDirty} busy={busy} onSave={(kind, details, eTag) => saveConfiguration(activity.id, kind, details, eTag)}/></div>
  return <>
    {error ? <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}<AppActionButton className="ml-2" size="sm" onClick={() => void load()}>{copy.retry[language]}</AppActionButton></div> : null}
    {notice ? <p role="status" className="mb-2 text-sm text-[#176b5a]">{notice}</p> : null}
    <EventActivityPlanPanel eventId={eventId} groupId={groupId} zh={zh} eventContext={eventContext} onSaved={async () => { await load(); await onSaved?.() }} onPlanChange={onPlanChange} onBusy={onBusy} timeZone={timeZone} renderProjectConfiguration={renderConfiguration}/>
  </>
}
