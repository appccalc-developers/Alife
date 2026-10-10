import { eventVenueWorkspaceText } from '../../i18n/eventVenueWorkspace.ts'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, CalendarRange, MapPin, Users } from 'lucide-react'
import useConfirmation from '../../hooks/useConfirmation'
import { eventOperationsService } from '../../services/eventOperationsService'
import { normalizeApiError } from '../../services/http'
import { eventVenueService } from '../../services/eventVenueService'
import type { EventOccurrence } from '../../types/eventOperations'
import type { EventVenue, EventVenueReservation, EventVenueWorkspace } from '../../types/eventVenue'
import { venueCapacityLabel, venueReadinessItems } from '../../utils/eventVenueState'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AppEmptyState from '../layout/AppEmptyState'
import { EventToolSection as AppSectionCard, useArrangementDraft, useArrangementFormDraft } from './ArrangementTileDeck'
import type { EventSurfaceProps } from './EventSurfaceRenderer'

type LoadState = 'loading' | 'ready' | 'empty' | 'error' | 'permission-denied'
type MutationState = 'idle' | 'saving' | 'success' | 'conflict' | 'stale' | 'error'
const fieldClass = 'min-h-11 min-w-0 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 text-sm text-[#18332d] outline-none focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15 disabled:bg-slate-50 disabled:text-slate-500'
const labelClass = 'grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#66766f]'
const localize = (value: { en: string; zh: string }, language: 'en' | 'zh') => value[language] || value.en || value.zh
const toLocalInput = (value: string) => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const toUtc = (value: string) => new Date(value).toISOString()
const formatInterval = (start: string, end: string, language: 'en' | 'zh') =>
  `${new Date(start).toLocaleString(language === 'zh' ? 'zh-TW' : 'en-NZ')} – ${new Date(end).toLocaleString(language === 'zh' ? 'zh-TW' : 'en-NZ')}`

export const EventVenueWorkspaceSurface = ({ eventId, groupId, item, language, onBusyChange, onSaved }: EventSurfaceProps) => {
  const [data, setData] = useState<EventVenueWorkspace | null>(null)
  const [occurrences, setOccurrences] = useState<EventOccurrence[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [mutationState, setMutationState] = useState<MutationState>('idle')
  const [message, setMessage] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [nameZh, setNameZh] = useState('')
  const [addressEn, setAddressEn] = useState('')
  const [addressZh, setAddressZh] = useState('')
  const [capacity, setCapacity] = useState(1)
  const [venueId, setVenueId] = useState('')
  const [occurrenceId, setOccurrenceId] = useState('')
  const [requiredCapacity, setRequiredCapacity] = useState(1)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  useArrangementDraft(Boolean(nameEn || nameZh || addressEn || addressZh || capacity !== 1))
  const load = useCallback(async () => {
    setLoadState('loading'); setMessage('')
    try {
      const [workspace, nextOccurrences] = await Promise.all([
        eventVenueService.getWorkspace(eventId),
        eventOperationsService.listOccurrences(eventId),
      ])
      setData(workspace); setOccurrences(nextOccurrences)
      setVenueId((current) => workspace.venues.some((venue) => venue.id === current && venue.isActive)
        ? current : workspace.venues.find((venue) => venue.isActive)?.id ?? '')
      if (!occurrenceId && nextOccurrences.length) {
        const occurrence = nextOccurrences[0]
        setOccurrenceId(occurrence.id); setStart(toLocalInput(occurrence.startUtc)); setEnd(toLocalInput(occurrence.endUtc))
      }
      setLoadState(workspace.venues.length || workspace.reservations.length ? 'ready' : 'empty')
    } catch (reason) {
      const error = normalizeApiError(reason)
      setLoadState(error.status === 403 ? 'permission-denied' : 'error'); setMessage(error.message); return false
    }
  }, [eventId])

  useEffect(() => { void load() }, [load])
  useEffect(() => { onBusyChange?.(mutationState === 'saving') }, [mutationState, onBusyChange])

  const mutate = async (action: () => Promise<EventVenueWorkspace | EventVenue>, success: string) => {
    setMutationState('saving'); setMessage('')
    try {
      const result = await action()
      if ('reservations' in result) setData(result)
      else await load()
      await onSaved?.(); setMutationState('success'); setMessage(success); return true
    } catch (reason) {
      const error = normalizeApiError(reason)
      setMutationState(error.status === 409 ? 'conflict' : error.status === 412 ? 'stale' : 'error')
      setMessage(error.message); return false
    }
  }

  const createVenue = (event: FormEvent) => {
    event.preventDefault()
    void mutate(() => eventVenueService.createVenue(groupId, {
      name: { en: nameEn.trim(), zh: nameZh.trim() }, address: { en: addressEn.trim(), zh: addressZh.trim() },
      capacity, isActive: true,
    }), language === 'zh' ? eventVenueWorkspaceText.venueAddedToTheCatalogue.zh : eventVenueWorkspaceText.venueAddedToTheCatalogue.en).then(saved => {
      if (!saved) return
      setNameEn(''); setNameZh(''); setAddressEn(''); setAddressZh(''); setCapacity(1)
    })
  }

  const selectOccurrence = (value: string) => {
    setOccurrenceId(value)
    const occurrence = occurrences.find((candidate) => candidate.id === value)
    if (occurrence) { setStart(toLocalInput(occurrence.startUtc)); setEnd(toLocalInput(occurrence.endUtc)) }
  }

  const reservationSaved = useArrangementFormDraft([venueId, requiredCapacity, start, end], loadState === 'ready' || loadState === 'empty')
  const reserve = (event: FormEvent) => {
    event.preventDefault()
    const venue = data?.venues.find((candidate) => candidate.id === venueId)
    if (!venue || !start || !end) return
    void mutate(() => eventVenueService.reserve(eventId, venue.eTag, {
      venueId, eventOccurrenceId: occurrenceId || null, startUtc: toUtc(start), endUtc: toUtc(end), requiredCapacity,
    }).then(reservationSaved), language === 'zh' ? eventVenueWorkspaceText.venueReservationConfirmed.zh : eventVenueWorkspaceText.venueReservationConfirmed.en)
  }

  if (loadState === 'loading') return <AppSectionCard dense><p className="text-sm text-[#66766f]" role="status">{language === 'zh' ? eventVenueWorkspaceText.loadingVenuesAndReservations.zh : eventVenueWorkspaceText.loadingVenuesAndReservations.en}</p></AppSectionCard>
  if (loadState === 'permission-denied') return <AppEmptyState title={language === 'zh' ? eventVenueWorkspaceText.resourceCoordinatorAccessRequired.zh : eventVenueWorkspaceText.resourceCoordinatorAccessRequired.en} description={language === 'zh' ? eventVenueWorkspaceText.onlyTheEventOwnerOwningGroupLeadersOrAn.zh : eventVenueWorkspaceText.onlyTheEventOwnerOwningGroupLeadersOrAn.en} />
  if (loadState === 'error' || !data) return <AppEmptyState title={language === 'zh' ? eventVenueWorkspaceText.venueWorkspaceUnavailable.zh : eventVenueWorkspaceText.venueWorkspaceUnavailable.en} description={message} actionLabel={language === 'zh' ? eventVenueWorkspaceText.retry.zh : eventVenueWorkspaceText.retry.en} onAction={() => void load()} />

  const readiness = venueReadinessItems(data.readiness)
  const activeReservations = data.reservations.filter((reservation) => reservation.status === 'confirmed')
  return (
    <div className="space-y-4">
      <AppSectionCard
        title={localize(item.label, language)}
        subtitle={language === 'zh' ? eventVenueWorkspaceText.venuesAreReusableManagedResourcesLegacySessionPlaceText.zh : eventVenueWorkspaceText.venuesAreReusableManagedResourcesLegacySessionPlaceText.en}
        action={<AppBadge variant={data.readiness.blockers.length ? 'warning' : 'success'}>{data.readiness.blockers.length ? (language === 'zh' ? eventVenueWorkspaceText.blocked.zh : eventVenueWorkspaceText.blocked.en) : (language === 'zh' ? eventVenueWorkspaceText.ready.zh : eventVenueWorkspaceText.ready.en)}</AppBadge>}
      >
        <div className="grid gap-3 tablet:grid-cols-3">
          {readiness.map((check) => <div key={check.code} className="flex items-center justify-between gap-3 rounded-xl border border-[#2f4b42]/10 bg-[#fbfcf8] px-3 py-3"><span className="min-w-0 break-words text-sm font-bold text-[#40554e]">{check.code}</span><AppBadge variant={check.ready ? 'success' : 'warning'}>{check.ready ? (language === 'zh' ? eventVenueWorkspaceText.readyLabel.zh : eventVenueWorkspaceText.readyLabel.en) : (language === 'zh' ? eventVenueWorkspaceText.pending.zh : eventVenueWorkspaceText.pending.en)}</AppBadge></div>)}
        </div>
        {data.readiness.blockers.length ? <ul className="mt-4 space-y-2" aria-label={language === 'zh' ? eventVenueWorkspaceText.venueReadinessBlockers.zh : eventVenueWorkspaceText.venueReadinessBlockers.en}>{data.readiness.blockers.map((blocker, index) => <li key={`${blocker.en}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{localize(blocker, language)}</li>)}</ul> : null}
      </AppSectionCard>

      {mutationState !== 'idle' && mutationState !== 'saving' ? <p className={`rounded-xl border px-4 py-3 text-sm ${mutationState === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : mutationState === 'conflict' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`} role={mutationState === 'success' ? 'status' : 'alert'}>{mutationState === 'conflict' ? <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" /> : null}{message}</p> : null}

      <AppSectionCard summary={language === 'zh' ? eventVenueWorkspaceText.venues.zh(data.venues.length, nameZh || nameEn ? eventVenueWorkspaceText.label.zh(nameZh || nameEn) : eventVenueWorkspaceText.label.en()) : eventVenueWorkspaceText.venues.en(data.venues.length, nameEn || nameZh ? ` · New: ${nameEn || nameZh}` : '')} title={language === 'zh' ? eventVenueWorkspaceText.venueCatalogue.zh : eventVenueWorkspaceText.venueCatalogue.en} subtitle={language === 'zh' ? eventVenueWorkspaceText.capacityIsAuthoritativeForReservationsAVenueWithConfirmed.zh : eventVenueWorkspaceText.capacityIsAuthoritativeForReservationsAVenueWithConfirmed.en}>
        {data.canManageCatalogue ? <form className="mb-5 grid gap-3 tablet:grid-cols-2 desktop:grid-cols-5" onSubmit={createVenue}><label className={labelClass}>English<input className={fieldClass} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required /></label><label className={labelClass}>{eventVenueWorkspaceText.label2}<input className={fieldClass} value={nameZh} onChange={(event) => setNameZh(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? eventVenueWorkspaceText.addressEnglish.zh : eventVenueWorkspaceText.addressEnglish.en}<input className={fieldClass} value={addressEn} onChange={(event) => setAddressEn(event.target.value)} /></label><label className={labelClass}>{language === 'zh' ? eventVenueWorkspaceText.addressChinese.zh : eventVenueWorkspaceText.addressChinese.en}<input className={fieldClass} value={addressZh} onChange={(event) => setAddressZh(event.target.value)} /></label><label className={labelClass}>{language === 'zh' ? eventVenueWorkspaceText.capacity.zh : eventVenueWorkspaceText.capacity.en}<input className={fieldClass} type="number" min="1" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} required /></label><AppActionButton className="tablet:col-span-2 desktop:col-span-1" type="submit" variant="primary" disabled={mutationState === 'saving'}>{language === 'zh' ? eventVenueWorkspaceText.addVenue.zh : eventVenueWorkspaceText.addVenue.en}</AppActionButton></form> : null}
        {data.venues.length ? <div className="grid gap-3 tablet:grid-cols-2">{data.venues.map((venue) => <VenueCard key={venue.id} venue={venue} groupId={groupId} language={language} busy={mutationState === 'saving'} editable={data.canManageCatalogue && venue.managingGroupId === groupId} onMutate={mutate} />)}</div> : <AppEmptyState title={language === 'zh' ? eventVenueWorkspaceText.noVenuesYet.zh : eventVenueWorkspaceText.noVenuesYet.en} description={language === 'zh' ? eventVenueWorkspaceText.addTheFirstReservableVenueAndItsSafeCapacity.zh : eventVenueWorkspaceText.addTheFirstReservableVenueAndItsSafeCapacity.en} />}
      </AppSectionCard>

      <AppSectionCard summary={language === 'zh' ? eventVenueWorkspaceText.people.zh(localize(data.venues.find(venue => venue.id === venueId)?.name || { en: '', zh: '' }, language) || eventVenueWorkspaceText.eventVenueWorkspaceSurface, requiredCapacity) : eventVenueWorkspaceText.people.en(localize(data.venues.find(venue => venue.id === venueId)?.name || { en: '', zh: '' }, language) || 'No venue selected', requiredCapacity)} title={language === 'zh' ? eventVenueWorkspaceText.reserveAVenue.zh : eventVenueWorkspaceText.reserveAVenue.en} subtitle={language === 'zh' ? eventVenueWorkspaceText.touchingBoundariesDoNotConflictAnyActualOverlapIs.zh : eventVenueWorkspaceText.touchingBoundariesDoNotConflictAnyActualOverlapIs.en}>
        {data.venues.some((venue) => venue.isActive) ? <form className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-5" onSubmit={reserve}><label className={labelClass}>{language === 'zh' ? eventVenueWorkspaceText.venue.zh : eventVenueWorkspaceText.venue.en}<select className={fieldClass} value={venueId} onChange={(event) => setVenueId(event.target.value)} required>{data.venues.filter((venue) => venue.isActive).map((venue) => <option key={venue.id} value={venue.id}>{localize(venue.name, language)} · {language === 'zh' ? eventVenueWorkspaceText.capacityLabel.zh : eventVenueWorkspaceText.capacityLabel.en} {venue.capacity}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? eventVenueWorkspaceText.scope.zh : eventVenueWorkspaceText.scope.en}<select className={fieldClass} value={occurrenceId} onChange={(event) => selectOccurrence(event.target.value)}><option value="">{language === 'zh' ? eventVenueWorkspaceText.eventWide.zh : eventVenueWorkspaceText.eventWide.en}</option>{occurrences.map((occurrence) => <option key={occurrence.id} value={occurrence.id}>{new Date(occurrence.startUtc).toLocaleString(language === 'zh' ? 'zh-TW' : 'en-NZ')}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? eventVenueWorkspaceText.requiredCapacity.zh : eventVenueWorkspaceText.requiredCapacity.en}<input className={fieldClass} type="number" min="1" value={requiredCapacity} onChange={(event) => setRequiredCapacity(Number(event.target.value))} required /></label><label className={labelClass}>{language === 'zh' ? eventVenueWorkspaceText.start.zh : eventVenueWorkspaceText.start.en}<input className={fieldClass} type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? eventVenueWorkspaceText.end.zh : eventVenueWorkspaceText.end.en}<input className={fieldClass} type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required /></label><AppActionButton type="submit" variant="primary" disabled={mutationState === 'saving' || !venueId}>{mutationState === 'saving' ? (language === 'zh' ? eventVenueWorkspaceText.saving.zh : eventVenueWorkspaceText.saving.en) : (language === 'zh' ? eventVenueWorkspaceText.confirmReservation.zh : eventVenueWorkspaceText.confirmReservation.en)}</AppActionButton></form> : <AppEmptyState title={language === 'zh' ? eventVenueWorkspaceText.noActiveVenue.zh : eventVenueWorkspaceText.noActiveVenue.en} description={language === 'zh' ? eventVenueWorkspaceText.addOrActivateAVenueInTheCatalogueFirst.zh : eventVenueWorkspaceText.addOrActivateAVenueInTheCatalogueFirst.en} />}
      </AppSectionCard>

      <AppSectionCard title={language === 'zh' ? eventVenueWorkspaceText.reservationRecord.zh : eventVenueWorkspaceText.reservationRecord.en} action={<AppBadge variant={activeReservations.length ? 'info' : 'warning'}>{activeReservations.length} {language === 'zh' ? eventVenueWorkspaceText.active.zh : eventVenueWorkspaceText.active.en}</AppBadge>}>
        {data.conflicts.length ? <div className="mb-4 space-y-2">{data.conflicts.map((conflict) => <p key={`${conflict.venueId}-${conflict.startUtc}-${conflict.endUtc}`} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert"><AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />{language === 'zh' ? eventVenueWorkspaceText.conflictAt.zh(localize(conflict.venueName, language)) : eventVenueWorkspaceText.conflictAt.en(localize(conflict.venueName, language))}{formatInterval(conflict.startUtc, conflict.endUtc, language)}</p>)}</div> : null}
        {data.reservations.length ? <div className="space-y-3">{data.reservations.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} language={language} busy={mutationState === 'saving'} onRelease={(value) => mutate(() => eventVenueService.release(eventId, value.id, value.eTag), language === 'zh' ? eventVenueWorkspaceText.reservationReleased.zh : eventVenueWorkspaceText.reservationReleased.en)} />)}</div> : <AppEmptyState title={language === 'zh' ? eventVenueWorkspaceText.noReservationsYet.zh : eventVenueWorkspaceText.noReservationsYet.en} description={language === 'zh' ? eventVenueWorkspaceText.confirmAVenueForEveryScheduledOccurrenceToSatisfy.zh : eventVenueWorkspaceText.confirmAVenueForEveryScheduledOccurrenceToSatisfy.en} />}
      </AppSectionCard>
    </div>
  )
}

const VenueCard = ({ venue, groupId, language, busy, editable, onMutate }: { venue: EventVenue; groupId: string; language: 'en' | 'zh'; busy: boolean; editable: boolean; onMutate: (action: () => Promise<EventVenue>, success: string) => Promise<unknown> }) => {
  const [capacity, setCapacity] = useState(venue.capacity)
  const [active, setActive] = useState(venue.isActive)
  useArrangementDraft(capacity !== venue.capacity || active !== venue.isActive)
  useEffect(() => { setCapacity(venue.capacity); setActive(venue.isActive) }, [venue.capacity, venue.isActive])
  const address = localize(venue.address, language)
  return <article className={`rounded-2xl border border-[#2f4b42]/10 bg-[#fbfcf8] p-4 ${venue.isActive ? '' : 'opacity-65'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-black text-[#18332d]">{localize(venue.name, language)}</h3>{address ? <p className="mt-1 flex items-start gap-1.5 text-sm text-[#66766f]"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{address}</p> : null}</div><div className="flex flex-wrap items-center gap-2">{!editable ? <AppBadge variant="info">{language === 'zh' ? eventVenueWorkspaceText.churchShared.zh : eventVenueWorkspaceText.churchShared.en}</AppBadge> : null}<AppBadge variant={venue.isActive ? 'success' : 'neutral'}>{venue.isActive ? (language === 'zh' ? eventVenueWorkspaceText.activeLabel.zh : eventVenueWorkspaceText.activeLabel.en) : (language === 'zh' ? eventVenueWorkspaceText.inactive.zh : eventVenueWorkspaceText.inactive.en)}</AppBadge></div></div>{editable ? <div className="mt-4 grid gap-3 tablet:grid-cols-[1fr_auto_auto]"><label className={labelClass}>{language === 'zh' ? eventVenueWorkspaceText.capacity.zh : eventVenueWorkspaceText.capacity.en}<input className={fieldClass} type="number" min="1" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label><label className="flex min-h-11 items-center gap-2 self-end text-sm font-bold text-[#40554e]"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />{language === 'zh' ? eventVenueWorkspaceText.active2.zh : eventVenueWorkspaceText.active2.en}</label><AppActionButton className="self-end" size="sm" disabled={busy || (capacity === venue.capacity && active === venue.isActive)} onClick={() => void onMutate(() => eventVenueService.updateVenue(groupId, venue.id, venue.eTag, { name: venue.name, address: venue.address, capacity, isActive: active }), language === 'zh' ? eventVenueWorkspaceText.venueUpdated.zh : eventVenueWorkspaceText.venueUpdated.en)}>{language === 'zh' ? eventVenueWorkspaceText.save.zh : eventVenueWorkspaceText.save.en}</AppActionButton></div> : <p className="mt-3 text-sm text-[#66766f]">{language === 'zh' ? eventVenueWorkspaceText.maintainedByChurchManagersThisGroupCanViewCapacity.zh : eventVenueWorkspaceText.maintainedByChurchManagersThisGroupCanViewCapacity.en}</p>}</article>
}

const ReservationCard = ({ reservation, language, busy, onRelease }: { reservation: EventVenueReservation; language: 'en' | 'zh'; busy: boolean; onRelease: (value: EventVenueReservation) => Promise<unknown> }) => {
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const release = async () => {
    const confirmed = await requestConfirmation({ title: language === 'zh' ? eventVenueWorkspaceText.releaseVenueReservation.zh : eventVenueWorkspaceText.releaseVenueReservation.en, description: language === 'zh' ? eventVenueWorkspaceText.willBecomeAvailableToOtherEventsTheAuditRecord.zh(localize(reservation.venueName, language)) : eventVenueWorkspaceText.willBecomeAvailableToOtherEventsTheAuditRecord.en(localize(reservation.venueName, language)), confirmLabel: language === 'zh' ? eventVenueWorkspaceText.releaseReservation.zh : eventVenueWorkspaceText.releaseReservation.en, tone: 'danger' })
    if (confirmed) await onRelease(reservation)
  }
  return <><article className={`rounded-2xl border p-4 ${reservation.status === 'confirmed' ? 'border-[#176b5a]/15 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-black text-[#18332d]">{localize(reservation.venueName, language)}</h3><p className="mt-2 flex items-start gap-2 text-sm text-[#40554e]"><CalendarRange className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{formatInterval(reservation.startUtc, reservation.endUtc, language)}</p><p className="mt-1 flex items-center gap-2 text-sm text-[#66766f]"><Users className="h-4 w-4" aria-hidden="true" />{language === 'zh' ? eventVenueWorkspaceText.requiredCapacityLabel.zh : eventVenueWorkspaceText.requiredCapacityLabel.en} {venueCapacityLabel(reservation.requiredCapacity, reservation.venueCapacity)}</p></div><div className="flex items-center gap-2"><AppBadge variant={reservation.status === 'confirmed' ? 'success' : 'neutral'}>{reservation.status}</AppBadge>{reservation.status === 'confirmed' ? <AppActionButton size="sm" variant="danger" disabled={busy} onClick={() => void release()}>{language === 'zh' ? eventVenueWorkspaceText.release.zh : eventVenueWorkspaceText.release.en}</AppActionButton> : null}</div></div></article>{confirmationModal}</>
}
