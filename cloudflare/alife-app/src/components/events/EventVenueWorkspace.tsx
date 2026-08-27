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
import AppSectionCard from '../layout/AppSectionCard'
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

export const EventVenueWorkspaceSurface = ({ eventId, groupId, item, language }: EventSurfaceProps) => {
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
      setLoadState(error.status === 403 ? 'permission-denied' : 'error'); setMessage(error.message)
    }
  }, [eventId])

  useEffect(() => { void load() }, [load])

  const mutate = async (action: () => Promise<EventVenueWorkspace | EventVenue>, success: string) => {
    setMutationState('saving'); setMessage('')
    try {
      const result = await action()
      if ('reservations' in result) setData(result)
      else await load()
      setMutationState('success'); setMessage(success)
    } catch (reason) {
      const error = normalizeApiError(reason)
      setMutationState(error.status === 409 ? 'conflict' : error.status === 412 ? 'stale' : 'error')
      setMessage(error.message)
    }
  }

  const createVenue = (event: FormEvent) => {
    event.preventDefault()
    void mutate(() => eventVenueService.createVenue(groupId, {
      name: { en: nameEn.trim(), zh: nameZh.trim() }, address: { en: addressEn.trim(), zh: addressZh.trim() },
      capacity, isActive: true,
    }), language === 'zh' ? '場地已加入目錄。' : 'Venue added to the catalogue.').then(() => {
      setNameEn(''); setNameZh(''); setAddressEn(''); setAddressZh(''); setCapacity(1)
    })
  }

  const selectOccurrence = (value: string) => {
    setOccurrenceId(value)
    const occurrence = occurrences.find((candidate) => candidate.id === value)
    if (occurrence) { setStart(toLocalInput(occurrence.startUtc)); setEnd(toLocalInput(occurrence.endUtc)) }
  }

  const reserve = (event: FormEvent) => {
    event.preventDefault()
    const venue = data?.venues.find((candidate) => candidate.id === venueId)
    if (!venue || !start || !end) return
    void mutate(() => eventVenueService.reserve(eventId, venue.eTag, {
      venueId, eventOccurrenceId: occurrenceId || null, startUtc: toUtc(start), endUtc: toUtc(end), requiredCapacity,
    }), language === 'zh' ? '場地預訂已確認。' : 'Venue reservation confirmed.')
  }

  if (loadState === 'loading') return <AppSectionCard dense><p className="text-sm text-[#66766f]" role="status">{language === 'zh' ? '正在載入場地與預訂…' : 'Loading venues and reservations…'}</p></AppSectionCard>
  if (loadState === 'permission-denied') return <AppEmptyState title={language === 'zh' ? '需要場地協調權限' : 'Resource coordinator access required'} description={language === 'zh' ? '只有活動負責人、所屬小組領袖或已接受 resource.coordinator 角色的人員可管理場地預訂。' : 'Only the event owner, owning-group leaders, or an accepted resource.coordinator can manage venue reservations.'} />
  if (loadState === 'error' || !data) return <AppEmptyState title={language === 'zh' ? '無法載入場地工作區' : 'Venue workspace unavailable'} description={message} actionLabel={language === 'zh' ? '重試' : 'Retry'} onAction={() => void load()} />

  const readiness = venueReadinessItems(data.readiness)
  const activeReservations = data.reservations.filter((reservation) => reservation.status === 'confirmed')
  return (
    <div className="space-y-4">
      <AppSectionCard
        title={localize(item.label, language)}
        subtitle={language === 'zh' ? 'Venue 是可重用的受管資源；舊有 Session place 文字保持兼容，但不作為預訂依據。' : 'Venues are reusable managed resources. Legacy Session place text remains compatible but is not reservation authority.'}
        action={<AppBadge variant={data.readiness.blockers.length ? 'warning' : 'success'}>{data.readiness.blockers.length ? (language === 'zh' ? '尚有阻塞' : 'Blocked') : (language === 'zh' ? '已準備' : 'Ready')}</AppBadge>}
      >
        <div className="grid gap-3 tablet:grid-cols-3">
          {readiness.map((check) => <div key={check.code} className="flex items-center justify-between gap-3 rounded-xl border border-[#2f4b42]/10 bg-[#fbfcf8] px-3 py-3"><span className="min-w-0 break-words text-sm font-bold text-[#40554e]">{check.code}</span><AppBadge variant={check.ready ? 'success' : 'warning'}>{check.ready ? (language === 'zh' ? '通過' : 'Ready') : (language === 'zh' ? '待處理' : 'Pending')}</AppBadge></div>)}
        </div>
        {data.readiness.blockers.length ? <ul className="mt-4 space-y-2" aria-label={language === 'zh' ? '場地準備度阻塞' : 'Venue readiness blockers'}>{data.readiness.blockers.map((blocker, index) => <li key={`${blocker.en}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{localize(blocker, language)}</li>)}</ul> : null}
      </AppSectionCard>

      {mutationState !== 'idle' && mutationState !== 'saving' ? <p className={`rounded-xl border px-4 py-3 text-sm ${mutationState === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : mutationState === 'conflict' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`} role={mutationState === 'success' ? 'status' : 'alert'}>{mutationState === 'conflict' ? <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" /> : null}{message}</p> : null}

      <AppSectionCard title={language === 'zh' ? '場地目錄' : 'Venue catalogue'} subtitle={language === 'zh' ? '容量是預訂檢查的權威值；有確認預訂時不能停用或降到所需容量以下。' : 'Capacity is authoritative for reservations. A venue with confirmed bookings cannot be deactivated or reduced below demand.'}>
        {data.canManage ? <form className="mb-5 grid gap-3 tablet:grid-cols-2 desktop:grid-cols-5" onSubmit={createVenue}><label className={labelClass}>English<input className={fieldClass} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required /></label><label className={labelClass}>中文<input className={fieldClass} value={nameZh} onChange={(event) => setNameZh(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '英文地址' : 'Address (English)'}<input className={fieldClass} value={addressEn} onChange={(event) => setAddressEn(event.target.value)} /></label><label className={labelClass}>{language === 'zh' ? '中文地址' : 'Address (Chinese)'}<input className={fieldClass} value={addressZh} onChange={(event) => setAddressZh(event.target.value)} /></label><label className={labelClass}>{language === 'zh' ? '容量' : 'Capacity'}<input className={fieldClass} type="number" min="1" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} required /></label><AppActionButton className="tablet:col-span-2 desktop:col-span-1" type="submit" variant="primary" disabled={mutationState === 'saving'}>{language === 'zh' ? '加入目錄' : 'Add venue'}</AppActionButton></form> : null}
        {data.venues.length ? <div className="grid gap-3 tablet:grid-cols-2">{data.venues.map((venue) => <VenueCard key={venue.id} venue={venue} groupId={groupId} language={language} busy={mutationState === 'saving'} onMutate={mutate} />)}</div> : <AppEmptyState title={language === 'zh' ? '尚無場地' : 'No venues yet'} description={language === 'zh' ? '加入第一個可預訂場地，並設定可安全接待的人數。' : 'Add the first reservable venue and its safe capacity.'} />}
      </AppSectionCard>

      <AppSectionCard title={language === 'zh' ? '新增預訂' : 'Reserve a venue'} subtitle={language === 'zh' ? '邊界相接不算衝突；任何實際重疊都會由伺服器拒絕並指出場地和時段。' : 'Touching boundaries do not conflict. Any actual overlap is rejected by the server with the venue and interval.'}>
        {data.venues.some((venue) => venue.isActive) ? <form className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-5" onSubmit={reserve}><label className={labelClass}>{language === 'zh' ? '場地' : 'Venue'}<select className={fieldClass} value={venueId} onChange={(event) => setVenueId(event.target.value)} required>{data.venues.filter((venue) => venue.isActive).map((venue) => <option key={venue.id} value={venue.id}>{localize(venue.name, language)} · {language === 'zh' ? '容量' : 'capacity'} {venue.capacity}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '範圍' : 'Scope'}<select className={fieldClass} value={occurrenceId} onChange={(event) => selectOccurrence(event.target.value)}><option value="">{language === 'zh' ? '整個 Event' : 'Event-wide'}</option>{occurrences.map((occurrence) => <option key={occurrence.id} value={occurrence.id}>{new Date(occurrence.startUtc).toLocaleString(language === 'zh' ? 'zh-TW' : 'en-NZ')}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '所需容量' : 'Required capacity'}<input className={fieldClass} type="number" min="1" value={requiredCapacity} onChange={(event) => setRequiredCapacity(Number(event.target.value))} required /></label><label className={labelClass}>{language === 'zh' ? '開始' : 'Start'}<input className={fieldClass} type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '結束' : 'End'}<input className={fieldClass} type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required /></label><AppActionButton type="submit" variant="primary" disabled={mutationState === 'saving' || !venueId}>{mutationState === 'saving' ? (language === 'zh' ? '儲存中…' : 'Saving…') : (language === 'zh' ? '確認預訂' : 'Confirm reservation')}</AppActionButton></form> : <AppEmptyState title={language === 'zh' ? '沒有可用場地' : 'No active venue'} description={language === 'zh' ? '先在目錄中新增或啟用場地。' : 'Add or activate a venue in the catalogue first.'} />}
      </AppSectionCard>

      <AppSectionCard title={language === 'zh' ? '預訂紀錄' : 'Reservation record'} action={<AppBadge variant={activeReservations.length ? 'info' : 'warning'}>{activeReservations.length} {language === 'zh' ? '項生效' : 'active'}</AppBadge>}>
        {data.conflicts.length ? <div className="mb-4 space-y-2">{data.conflicts.map((conflict) => <p key={`${conflict.venueId}-${conflict.startUtc}-${conflict.endUtc}`} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert"><AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />{language === 'zh' ? `場地「${localize(conflict.venueName, language)}」衝突：` : `Conflict at ${localize(conflict.venueName, language)}: `}{formatInterval(conflict.startUtc, conflict.endUtc, language)}</p>)}</div> : null}
        {data.reservations.length ? <div className="space-y-3">{data.reservations.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} language={language} busy={mutationState === 'saving'} onRelease={(value) => mutate(() => eventVenueService.release(eventId, value.id, value.eTag), language === 'zh' ? '預訂已釋放。' : 'Reservation released.')} />)}</div> : <AppEmptyState title={language === 'zh' ? '尚無預訂' : 'No reservations yet'} description={language === 'zh' ? '為每個排程場次確認場地後，bookings-confirmed 才會通過。' : 'Confirm a venue for every scheduled occurrence to satisfy bookings-confirmed.'} />}
      </AppSectionCard>
    </div>
  )
}

const VenueCard = ({ venue, groupId, language, busy, onMutate }: { venue: EventVenue; groupId: string; language: 'en' | 'zh'; busy: boolean; onMutate: (action: () => Promise<EventVenue>, success: string) => Promise<void> }) => {
  const [capacity, setCapacity] = useState(venue.capacity)
  const [active, setActive] = useState(venue.isActive)
  useEffect(() => { setCapacity(venue.capacity); setActive(venue.isActive) }, [venue.capacity, venue.isActive])
  const address = localize(venue.address, language)
  return <article className={`rounded-2xl border border-[#2f4b42]/10 bg-[#fbfcf8] p-4 ${venue.isActive ? '' : 'opacity-65'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-black text-[#18332d]">{localize(venue.name, language)}</h3>{address ? <p className="mt-1 flex items-start gap-1.5 text-sm text-[#66766f]"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{address}</p> : null}</div><AppBadge variant={venue.isActive ? 'success' : 'neutral'}>{venue.isActive ? (language === 'zh' ? '可預訂' : 'Active') : (language === 'zh' ? '停用' : 'Inactive')}</AppBadge></div><div className="mt-4 grid gap-3 tablet:grid-cols-[1fr_auto_auto]"><label className={labelClass}>{language === 'zh' ? '容量' : 'Capacity'}<input className={fieldClass} type="number" min="1" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label><label className="flex min-h-11 items-center gap-2 self-end text-sm font-bold text-[#40554e]"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />{language === 'zh' ? '啟用' : 'Active'}</label><AppActionButton className="self-end" size="sm" disabled={busy || (capacity === venue.capacity && active === venue.isActive)} onClick={() => void onMutate(() => eventVenueService.updateVenue(groupId, venue.id, venue.eTag, { name: venue.name, address: venue.address, capacity, isActive: active }), language === 'zh' ? '場地已更新。' : 'Venue updated.')}>{language === 'zh' ? '儲存' : 'Save'}</AppActionButton></div></article>
}

const ReservationCard = ({ reservation, language, busy, onRelease }: { reservation: EventVenueReservation; language: 'en' | 'zh'; busy: boolean; onRelease: (value: EventVenueReservation) => Promise<unknown> }) => {
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const release = async () => {
    const confirmed = await requestConfirmation({ title: language === 'zh' ? '釋放場地預訂？' : 'Release venue reservation?', description: language === 'zh' ? `「${localize(reservation.venueName, language)}」將可供其他活動預訂。此動作會保留審計紀錄。` : `${localize(reservation.venueName, language)} will become available to other events. The audit record is retained.`, confirmLabel: language === 'zh' ? '釋放預訂' : 'Release reservation', tone: 'danger' })
    if (confirmed) await onRelease(reservation)
  }
  return <><article className={`rounded-2xl border p-4 ${reservation.status === 'confirmed' ? 'border-[#176b5a]/15 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-black text-[#18332d]">{localize(reservation.venueName, language)}</h3><p className="mt-2 flex items-start gap-2 text-sm text-[#40554e]"><CalendarRange className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{formatInterval(reservation.startUtc, reservation.endUtc, language)}</p><p className="mt-1 flex items-center gap-2 text-sm text-[#66766f]"><Users className="h-4 w-4" aria-hidden="true" />{language === 'zh' ? '所需／容量' : 'Required / capacity'} {venueCapacityLabel(reservation.requiredCapacity, reservation.venueCapacity)}</p></div><div className="flex items-center gap-2"><AppBadge variant={reservation.status === 'confirmed' ? 'success' : 'neutral'}>{reservation.status}</AppBadge>{reservation.status === 'confirmed' ? <AppActionButton size="sm" variant="danger" disabled={busy} onClick={() => void release()}>{language === 'zh' ? '釋放' : 'Release'}</AppActionButton> : null}</div></div></article>{confirmationModal}</>
}
