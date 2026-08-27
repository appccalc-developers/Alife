import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Bus, CalendarClock, CarFront, LockKeyhole, MapPin, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import useConfirmation from '../../hooks/useConfirmation'
import { eventTravelService } from '../../services/eventTravelService'
import { normalizeApiError } from '../../services/http'
import type {
  EventTravelDriver,
  EventTravelJourney,
  EventTravelMyJourneys,
  EventTravelPickupStop,
  EventTravelVehicle,
  EventTravelWorkspace as EventTravelWorkspaceData,
} from '../../types/eventTravel'
import { passengerCapacity, resolveTravelLoadFailure, resolveTravelMutationFailure, travelReadinessItems } from '../../utils/eventTravelState'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AppEmptyState from '../layout/AppEmptyState'
import AppSectionCard from '../layout/AppSectionCard'
import type { EventSurfaceProps } from './EventSurfaceRenderer'

type LoadState = 'loading' | 'ready' | 'self' | 'error' | 'permission-denied'
type MutationState = 'idle' | 'saving' | 'success' | 'stale' | 'conflict' | 'error'
type Language = 'en' | 'zh'

const fieldClass = 'min-h-11 w-full min-w-0 rounded-xl border border-[#2f4b42]/15 bg-white px-3 py-2 text-sm text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15'
const labelClass = 'grid min-w-0 gap-1.5 text-xs font-bold text-[#40554e]'
const checkClass = 'flex min-h-11 items-center gap-2 rounded-xl border border-[#2f4b42]/10 bg-white px-3 text-sm font-bold text-[#40554e]'
const localize = (value: { en: string; zh: string }, language: Language) => value[language] || value.en || value.zh
const toInput = (value: string) => {
  const date = new Date(value)
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}
const toUtc = (value: string) => new Date(value).toISOString()
const formatDateTime = (value: string, language: Language) => new Date(value).toLocaleString(language === 'zh' ? 'zh-TW' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' })

export const EventTravelWorkspace = ({ eventId, eventBasePath, language }: EventSurfaceProps) => {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [mutationState, setMutationState] = useState<MutationState>('idle')
  const [data, setData] = useState<EventTravelWorkspaceData | null>(null)
  const [selfData, setSelfData] = useState<EventTravelMyJourneys | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading'); setError('')
    try {
      setData(await eventTravelService.getWorkspace(eventId)); setSelfData(null); setLoadState('ready')
    } catch (workspaceError) {
      const normalized = normalizeApiError(workspaceError)
      if (normalized.status === 403) {
        try {
          setSelfData(await eventTravelService.getMyJourneys(eventId)); setData(null); setLoadState('self')
          return
        } catch (selfError) {
          const selfNormalized = normalizeApiError(selfError)
          setError(selfNormalized.message); setLoadState(resolveTravelLoadFailure(selfNormalized.status))
          return
        }
      }
      setError(normalized.message); setLoadState(resolveTravelLoadFailure(normalized.status))
    }
  }, [eventId])

  useEffect(() => { void load() }, [load])

  const mutate = async (action: () => Promise<EventTravelWorkspaceData>, message: string) => {
    setMutationState('saving'); setError(''); setSuccess('')
    try {
      setData(await action()); setMutationState('success'); setSuccess(message)
    } catch (caught) {
      const failure = normalizeApiError(caught)
      setError(failure.message)
      setMutationState(resolveTravelMutationFailure(failure.status))
    }
  }

  if (loadState === 'loading') return <AppSectionCard title={language === 'zh' ? '交通与乘车名单' : 'Travel & passenger manifest'}><p role="status" className="text-sm text-[#66766f]">{language === 'zh' ? '正在载入受限交通资料…' : 'Loading restricted travel data…'}</p></AppSectionCard>
  if (loadState === 'permission-denied') return <AppEmptyState title={language === 'zh' ? '需要交通权限' : 'Travel access required'} description={language === 'zh' ? '完整乘车名单只对活动负责人或已接受的交通协调员开放。' : 'The full passenger manifest is available only to event managers and accepted travel coordinators.'} />
  if (loadState === 'error' || !data && loadState !== 'self') return <AppEmptyState title={language === 'zh' ? '无法载入交通工作区' : 'Travel workspace unavailable'} description={error || (language === 'zh' ? '请稍后重试。' : 'Try again shortly.')} actionLabel={language === 'zh' ? '重试' : 'Retry'} onAction={() => void load()} />
  if (loadState === 'self' && selfData) return <MyJourneys data={selfData} language={language} />
  if (!data) return null

  return (
    <div className="min-w-0 space-y-5">
      <section className="overflow-hidden rounded-[1.45rem] border border-[#176b5a]/15 bg-[linear-gradient(135deg,#0d4f43_0%,#176b5a_66%,#347b68_100%)] p-5 text-white shadow-[0_18px_48px_rgba(13,79,67,0.2)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#d8eee6]">MOVE.STAY · roleRestricted</p><h2 className="mt-2 break-words text-xl font-black sm:text-2xl">{language === 'zh' ? '接送行程与乘车名单' : 'Pickup journeys & passenger manifests'}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#e3f0eb]">{language === 'zh' ? '每个场次独立安排司机、车辆、接送点与乘客。乘客身份不会进入公开资料或共享缓存。' : 'Plan drivers, vehicles, pickup stops and passengers per occurrence. Passenger identity never enters public projections or shared caches.'}</p></div>
          <AppBadge variant={data.readiness.blockers.length ? 'warning' : 'success'}>{data.readiness.blockers.length ? (language === 'zh' ? `${data.readiness.blockers.length} 项阻塞` : `${data.readiness.blockers.length} blockers`) : (language === 'zh' ? '交通已就绪' : 'Travel ready')}</AppBadge>
        </div>
      </section>

      {error ? <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${mutationState === 'stale' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}><p className="min-w-0 flex-1">{mutationState === 'stale' ? (language === 'zh' ? '资料已被其他人修改，请重新载入。 ' : 'This data changed elsewhere; reload before trying again. ') : ''}{error}</p>{mutationState === 'stale' || mutationState === 'conflict' ? <AppActionButton size="sm" onClick={() => void load()}>{language === 'zh' ? '重新载入' : 'Reload'}</AppActionButton> : null}</div> : null}
      {success ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p> : null}

      <ReadinessPanel data={data} language={language} ramPath={`${eventBasePath}/edit?step=ram`} />
      <div className="grid min-w-0 gap-5 desktop:grid-cols-2">
        <DriverPanel data={data} language={language} busy={mutationState === 'saving'} mutate={mutate} />
        <VehiclePanel data={data} language={language} busy={mutationState === 'saving'} mutate={mutate} />
      </div>
      <JourneyPanel data={data} language={language} busy={mutationState === 'saving'} mutate={mutate} />
    </div>
  )
}

const ReadinessPanel = ({ data, language, ramPath }: { data: EventTravelWorkspaceData; language: Language; ramPath: string }) => (
  <AppSectionCard title={language === 'zh' ? '交通准备度' : 'Transport readiness'} subtitle={language === 'zh' ? '运营证据会汇入同一份 Event readiness；RAM 仍由既有独立批准流程管理。' : 'Operational evidence feeds the shared Event readiness. RAM remains in its existing independent approval flow.'} action={<Link className="text-sm font-bold text-[#176b5a] underline-offset-4 hover:underline" to={ramPath}>{language === 'zh' ? '打开 RAM' : 'Open RAM'}</Link>}>
    <div className="grid gap-3 tablet:grid-cols-3">{travelReadinessItems(data.readiness).map((item) => <div key={item.code} className={`rounded-xl border px-3 py-3 ${item.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" /><span className="break-all text-xs font-black text-[#18332d]">{item.code}</span></div><p className="mt-1 text-xs text-[#66766f]">{item.ready ? (language === 'zh' ? '已满足' : 'Satisfied') : (language === 'zh' ? '尚未满足' : 'Not satisfied')}</p></div>)}</div>
    {data.readiness.blockers.length ? <ul className="mt-4 space-y-2" aria-label={language === 'zh' ? '交通阻塞项' : 'Travel blockers'}>{data.readiness.blockers.map((blocker, index) => <li key={`${blocker.en}-${index}`} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{localize(blocker, language)}</span></li>)}</ul> : null}
    <p className="mt-4 text-xs text-[#66766f]">RAM: {data.ramEvidence.status} · {language === 'zh' ? '交通检查' : 'transport checks'} {data.ramEvidence.checksComplete ? '✓' : '—'}</p>
  </AppSectionCard>
)

const DriverPanel = ({ data, language, busy, mutate }: PanelProps) => {
  const [memberId, setMemberId] = useState(data.eligibleMembers[0]?.memberId ?? '')
  const [licenceClass, setLicenceClass] = useState('Class 1')
  const [expiry, setExpiry] = useState('')
  const [notes, setNotes] = useState('')
  const create = (event: FormEvent) => {
    event.preventDefault()
    void mutate(() => eventTravelService.createDriver(data.eventId, { memberId, licenceClass, licenceExpiresOn: expiry || null, licenceConfirmed: true, fitToDriveConfirmed: true, evidenceNotes: notes, isActive: true }), language === 'zh' ? '司机证据已加入。' : 'Driver evidence added.')
  }
  return <AppSectionCard title={language === 'zh' ? '司机证据' : 'Driver evidence'} action={<AppBadge variant="info">{data.drivers.length}</AppBadge>}><form className="grid gap-3 tablet:grid-cols-2" onSubmit={create}><label className={labelClass}>{language === 'zh' ? '成员' : 'Member'}<select className={fieldClass} value={memberId} onChange={(event) => setMemberId(event.target.value)} required><option value="">{language === 'zh' ? '选择成员' : 'Choose member'}</option>{data.eligibleMembers.map((member) => <option key={member.memberId} value={member.memberId}>{member.displayName}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '驾照类别' : 'Licence class'}<input className={fieldClass} value={licenceClass} onChange={(event) => setLicenceClass(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '驾照到期日' : 'Licence expiry'}<input className={fieldClass} type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '受限证据备注' : 'Restricted evidence note'}<input className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><AppActionButton className="tablet:col-span-2" type="submit" variant="primary" disabled={busy || !memberId || !expiry}>{language === 'zh' ? '加入司机' : 'Add driver'}</AppActionButton></form><div className="mt-4 space-y-3">{data.drivers.map((driver) => <DriverCard key={driver.id} driver={driver} language={language} eventId={data.eventId} busy={busy} mutate={mutate} />)}{!data.drivers.length ? <AppEmptyState title={language === 'zh' ? '尚无司机证据' : 'No driver evidence'} description={language === 'zh' ? '加入事件范围证据；系统不会保存驾照文件内容。' : 'Add event-scoped evidence. Raw licence documents are not stored.'} /> : null}</div></AppSectionCard>
}

const DriverCard = ({ driver, language, eventId, busy, mutate }: { driver: EventTravelDriver; language: Language; eventId: string; busy: boolean; mutate: Mutate }) => {
  const [expiry, setExpiry] = useState(driver.licenceExpiresOn ?? '')
  const [licenceConfirmed, setLicenceConfirmed] = useState(driver.licenceConfirmed)
  const [fit, setFit] = useState(driver.fitToDriveConfirmed)
  useEffect(() => { setExpiry(driver.licenceExpiresOn ?? ''); setLicenceConfirmed(driver.licenceConfirmed); setFit(driver.fitToDriveConfirmed) }, [driver])
  return <article className="rounded-2xl border border-[#2f4b42]/10 bg-[#fbfcf8] p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-black text-[#18332d]">{driver.memberDisplayName}</h3><p className="text-xs text-[#66766f]">{driver.licenceClass}</p></div><AppBadge variant={driver.isEligible ? 'success' : 'warning'}>{driver.isEligible ? (language === 'zh' ? '合格' : 'Eligible') : (language === 'zh' ? '证据未完成' : 'Incomplete')}</AppBadge></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><label className={labelClass}>{language === 'zh' ? '到期日' : 'Expiry'}<input className={fieldClass} type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} /></label><label className={checkClass}><input type="checkbox" checked={licenceConfirmed} onChange={(event) => setLicenceConfirmed(event.target.checked)} />{language === 'zh' ? '驾照已核实' : 'Licence checked'}</label><label className={checkClass}><input type="checkbox" checked={fit} onChange={(event) => setFit(event.target.checked)} />{language === 'zh' ? '适合驾驶' : 'Fit to drive'}</label></div><AppActionButton className="mt-3" size="sm" disabled={busy || !expiry} onClick={() => void mutate(() => eventTravelService.updateDriver(eventId, driver.id, driver.eTag, { memberId: driver.memberId, licenceClass: driver.licenceClass, licenceExpiresOn: expiry || null, licenceConfirmed, fitToDriveConfirmed: fit, evidenceNotes: driver.evidenceNotes, isActive: driver.isActive }), language === 'zh' ? '司机证据已更新。' : 'Driver evidence updated.')}>{language === 'zh' ? '保存证据' : 'Save evidence'}</AppActionButton></article>
}

const VehiclePanel = ({ data, language, busy, mutate }: PanelProps) => {
  const [nameEn, setNameEn] = useState('')
  const [nameZh, setNameZh] = useState('')
  const [registration, setRegistration] = useState('')
  const [seats, setSeats] = useState(4)
  const [expiry, setExpiry] = useState('')
  const create = (event: FormEvent) => {
    event.preventDefault()
    void mutate(() => eventTravelService.createVehicle(data.eventId, { name: { en: nameEn, zh: nameZh }, registrationReference: registration, seatCapacity: seats, registrationConfirmed: true, registrationExpiresOn: expiry || null, wofConfirmed: true, wofExpiresOn: expiry || null, evidenceNotes: '', isActive: true }), language === 'zh' ? '车辆证据已加入。' : 'Vehicle evidence added.')
  }
  return <AppSectionCard title={language === 'zh' ? '车辆证据' : 'Vehicle evidence'} action={<AppBadge variant="info">{data.vehicles.length}</AppBadge>}><form className="grid gap-3 tablet:grid-cols-2" onSubmit={create}><label className={labelClass}>English name<input className={fieldClass} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required /></label><label className={labelClass}>中文名称<input className={fieldClass} value={nameZh} onChange={(event) => setNameZh(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '车辆识别／车牌' : 'Registration reference'}<input className={fieldClass} value={registration} onChange={(event) => setRegistration(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '座位数' : 'Seats'}<input className={fieldClass} type="number" min="1" value={seats} onChange={(event) => setSeats(Number(event.target.value))} required /></label><label className={labelClass}>{language === 'zh' ? 'Rego 与 WOF 到期日' : 'Rego & WOF expiry'}<input className={fieldClass} type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} required /></label><AppActionButton className="self-end" type="submit" variant="primary" disabled={busy || !expiry}>{language === 'zh' ? '加入车辆' : 'Add vehicle'}</AppActionButton></form><div className="mt-4 space-y-3">{data.vehicles.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} language={language} eventId={data.eventId} busy={busy} mutate={mutate} />)}{!data.vehicles.length ? <AppEmptyState title={language === 'zh' ? '尚无车辆证据' : 'No vehicle evidence'} description={language === 'zh' ? '加入座位容量与 Rego/WOF 有效期。' : 'Add seat capacity and current Rego/WOF evidence.'} /> : null}</div></AppSectionCard>
}

const VehicleCard = ({ vehicle, language, eventId, busy, mutate }: { vehicle: EventTravelVehicle; language: Language; eventId: string; busy: boolean; mutate: Mutate }) => {
  const [seats, setSeats] = useState(vehicle.seatCapacity)
  const [regoExpiry, setRegoExpiry] = useState(vehicle.registrationExpiresOn ?? '')
  const [wofExpiry, setWofExpiry] = useState(vehicle.wofExpiresOn ?? '')
  useEffect(() => { setSeats(vehicle.seatCapacity); setRegoExpiry(vehicle.registrationExpiresOn ?? ''); setWofExpiry(vehicle.wofExpiresOn ?? '') }, [vehicle])
  return <article className="rounded-2xl border border-[#2f4b42]/10 bg-[#fbfcf8] p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-black text-[#18332d]">{localize(vehicle.name, language)}</h3><p className="text-xs text-[#66766f]">{vehicle.registrationReference} · {vehicle.seatCapacity} {language === 'zh' ? '座' : 'seats'}</p></div><AppBadge variant={vehicle.evidenceComplete ? 'success' : 'warning'}>{vehicle.evidenceComplete ? (language === 'zh' ? '证据完整' : 'Complete') : (language === 'zh' ? '证据未完成' : 'Incomplete')}</AppBadge></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><label className={labelClass}>{language === 'zh' ? '座位数' : 'Seats'}<input className={fieldClass} type="number" min="1" value={seats} onChange={(event) => setSeats(Number(event.target.value))} /></label><label className={labelClass}>Rego expiry<input className={fieldClass} type="date" value={regoExpiry} onChange={(event) => setRegoExpiry(event.target.value)} /></label><label className={labelClass}>WOF expiry<input className={fieldClass} type="date" value={wofExpiry} onChange={(event) => setWofExpiry(event.target.value)} /></label></div><AppActionButton className="mt-3" size="sm" disabled={busy || !regoExpiry || !wofExpiry} onClick={() => void mutate(() => eventTravelService.updateVehicle(eventId, vehicle.id, vehicle.eTag, { name: vehicle.name, registrationReference: vehicle.registrationReference, seatCapacity: seats, registrationConfirmed: true, registrationExpiresOn: regoExpiry, wofConfirmed: true, wofExpiresOn: wofExpiry, evidenceNotes: vehicle.evidenceNotes, isActive: vehicle.isActive }), language === 'zh' ? '车辆证据已更新。' : 'Vehicle evidence updated.')}>{language === 'zh' ? '保存证据' : 'Save evidence'}</AppActionButton></article>
}

const JourneyPanel = ({ data, language, busy, mutate }: PanelProps) => {
  const firstOccurrence = data.occurrences.find((value) => value.status !== 'cancelled')
  const [occurrenceId, setOccurrenceId] = useState(firstOccurrence?.id ?? '')
  const [nameEn, setNameEn] = useState('Pickup journey')
  const [nameZh, setNameZh] = useState('接送行程')
  const [start, setStart] = useState(firstOccurrence ? toInput(new Date(new Date(firstOccurrence.startUtc).getTime() - 60 * 60_000).toISOString()) : '')
  const [end, setEnd] = useState(firstOccurrence ? toInput(firstOccurrence.startUtc) : '')
  const selectOccurrence = (id: string) => { setOccurrenceId(id); const occurrence = data.occurrences.find((value) => value.id === id); if (occurrence) { setStart(toInput(new Date(new Date(occurrence.startUtc).getTime() - 60 * 60_000).toISOString())); setEnd(toInput(occurrence.startUtc)) } }
  const create = (event: FormEvent) => { event.preventDefault(); void mutate(() => eventTravelService.createJourney(data.eventId, { eventOccurrenceId: occurrenceId, name: { en: nameEn, zh: nameZh }, startUtc: toUtc(start), endUtc: toUtc(end), driverId: data.drivers.find((x) => x.isActive)?.id ?? null, vehicleId: data.vehicles.find((x) => x.isActive)?.id ?? null }), language === 'zh' ? '接送行程已建立。' : 'Pickup journey created.') }
  return <AppSectionCard title={language === 'zh' ? '接送行程' : 'Pickup journeys'} subtitle={language === 'zh' ? 'EventOccurrence 是时间边界；每个行程拥有司机、车辆、接送点与受限乘车名单。' : 'EventOccurrence is the time boundary; each journey owns its driver, vehicle, pickup stops and restricted manifest.'} action={<AppBadge variant="info">{data.journeys.length}</AppBadge>}><form className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-5" onSubmit={create}><label className={labelClass}>{language === 'zh' ? '场次' : 'Occurrence'}<select className={fieldClass} value={occurrenceId} onChange={(event) => selectOccurrence(event.target.value)} required>{data.occurrences.filter((value) => value.status !== 'cancelled').map((occurrence) => <option key={occurrence.id} value={occurrence.id}>{formatDateTime(occurrence.startUtc, language)}</option>)}</select></label><label className={labelClass}>English name<input className={fieldClass} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required /></label><label className={labelClass}>中文名称<input className={fieldClass} value={nameZh} onChange={(event) => setNameZh(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '开始' : 'Start'}<input className={fieldClass} type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '结束' : 'End'}<input className={fieldClass} type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required /></label><AppActionButton type="submit" variant="primary" disabled={busy || !occurrenceId}>{language === 'zh' ? '建立行程' : 'Create journey'}</AppActionButton></form><div className="mt-5 space-y-4">{data.journeys.map((journey) => <JourneyCard key={journey.id} journey={journey} data={data} language={language} busy={busy} mutate={mutate} />)}{!data.journeys.length ? <AppEmptyState title={language === 'zh' ? '尚无接送行程' : 'No pickup journeys'} description={language === 'zh' ? '先建立一个行程，再加入接送点与乘客。' : 'Create a journey, then add pickup stops and passengers.'} /> : null}</div></AppSectionCard>
}

const JourneyCard = ({ journey, data, language, busy, mutate }: { journey: EventTravelJourney; data: EventTravelWorkspaceData; language: Language; busy: boolean; mutate: Mutate }) => {
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const [driverId, setDriverId] = useState(journey.driver?.id ?? '')
  const [vehicleId, setVehicleId] = useState(journey.vehicle?.id ?? '')
  const [confirmed, setConfirmed] = useState(journey.manifestConfirmed)
  const [status, setStatus] = useState(journey.status)
  const [stopEn, setStopEn] = useState('')
  const [stopZh, setStopZh] = useState('')
  const [stopAddress, setStopAddress] = useState('')
  const [pickup, setPickup] = useState(toInput(journey.startUtc))
  const [passengerId, setPassengerId] = useState('')
  const [pickupStopId, setPickupStopId] = useState(journey.pickupStops[0]?.id ?? '')
  useEffect(() => { setDriverId(journey.driver?.id ?? ''); setVehicleId(journey.vehicle?.id ?? ''); setConfirmed(journey.manifestConfirmed); setStatus(journey.status); if (!pickupStopId) setPickupStopId(journey.pickupStops[0]?.id ?? '') }, [journey, pickupStopId])
  const capacity = passengerCapacity(journey.passengerCount, journey.vehicle?.seatCapacity)
  const save = () => mutate(() => eventTravelService.updateJourney(data.eventId, journey.id, journey.eTag, { name: journey.name, startUtc: journey.startUtc, endUtc: journey.endUtc, driverId: driverId || null, vehicleId: vehicleId || null, manifestConfirmed: confirmed, status }), language === 'zh' ? '行程已更新。' : 'Journey updated.')
  const addStop = (event: FormEvent) => { event.preventDefault(); void mutate(() => eventTravelService.addStop(data.eventId, journey.id, journey.eTag, { sortOrder: journey.pickupStops.length, name: { en: stopEn, zh: stopZh }, address: { en: stopAddress, zh: stopAddress }, pickupUtc: toUtc(pickup) }), language === 'zh' ? '接送点已加入。' : 'Pickup stop added.') }
  const assign = (event: FormEvent) => { event.preventDefault(); void mutate(() => eventTravelService.assignPassenger(data.eventId, journey.id, journey.eTag, passengerId, pickupStopId), language === 'zh' ? '乘客已加入受限名单。' : 'Passenger added to the restricted manifest.') }
  return <><article className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${journey.status === 'cancelled' ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-[#176b5a]/15 bg-white'}`}><header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-base font-black text-[#18332d]">{localize(journey.name, language)}</h3><p className="mt-1 flex items-center gap-2 text-sm text-[#66766f]"><CalendarClock className="h-4 w-4" aria-hidden="true" />{formatDateTime(journey.startUtc, language)} – {formatDateTime(journey.endUtc, language)}</p></div><div className="flex flex-wrap gap-2"><AppBadge variant={journey.driver?.isEligible && journey.vehicle?.evidenceComplete ? 'success' : 'warning'}>{language === 'zh' ? '司机＋车辆' : 'Driver + vehicle'}</AppBadge><AppBadge variant={journey.manifestConfirmed ? 'success' : 'warning'}>{journey.passengerCount} {language === 'zh' ? '名乘客' : 'passengers'}</AppBadge></div></header><div className="mt-4 grid gap-3 tablet:grid-cols-2 desktop:grid-cols-5"><label className={labelClass}>{language === 'zh' ? '司机' : 'Driver'}<select className={fieldClass} value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="">{language === 'zh' ? '尚未指派' : 'Unassigned'}</option>{data.drivers.filter((x) => x.isActive).map((driver) => <option key={driver.id} value={driver.id}>{driver.memberDisplayName}{driver.isEligible ? '' : ' · !'}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '车辆' : 'Vehicle'}<select className={fieldClass} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">{language === 'zh' ? '尚未指派' : 'Unassigned'}</option>{data.vehicles.filter((x) => x.isActive).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{localize(vehicle.name, language)} · {vehicle.seatCapacity}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '状态' : 'Status'}<select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as EventTravelJourney['status'])}><option value="planned">{language === 'zh' ? '规划中' : 'Planned'}</option><option value="confirmed">{language === 'zh' ? '已确认' : 'Confirmed'}</option><option value="cancelled">{language === 'zh' ? '已取消' : 'Cancelled'}</option></select></label><label className={checkClass}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{language === 'zh' ? '名单已确认' : 'Manifest confirmed'}</label><AppActionButton className="self-end" disabled={busy} onClick={() => void save()}>{language === 'zh' ? '保存行程' : 'Save journey'}</AppActionButton></div>
      <div className="mt-5 grid min-w-0 gap-4 desktop:grid-cols-[0.9fr_1.1fr]"><section className="min-w-0 rounded-2xl bg-[#f5f2eb] p-4"><h4 className="flex items-center gap-2 text-sm font-black text-[#18332d]"><MapPin className="h-4 w-4" aria-hidden="true" />{language === 'zh' ? '接送点与时间' : 'Pickup stops & times'}</h4><div className="mt-3 space-y-2">{journey.pickupStops.map((stop) => <StopRow key={stop.id} stop={stop} journey={journey} eventId={data.eventId} language={language} busy={busy} mutate={mutate} />)}</div><form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={addStop}><label className={labelClass}>English<input className={fieldClass} value={stopEn} onChange={(event) => setStopEn(event.target.value)} required /></label><label className={labelClass}>中文<input className={fieldClass} value={stopZh} onChange={(event) => setStopZh(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '地址' : 'Address'}<input className={fieldClass} value={stopAddress} onChange={(event) => setStopAddress(event.target.value)} /></label><label className={labelClass}>{language === 'zh' ? '接送时间' : 'Pickup time'}<input className={fieldClass} type="datetime-local" value={pickup} onChange={(event) => setPickup(event.target.value)} required /></label><AppActionButton className="sm:col-span-2" type="submit" size="sm" disabled={busy}>{language === 'zh' ? '加入接送点' : 'Add pickup stop'}</AppActionButton></form></section>
        <section className="min-w-0 rounded-2xl border border-[#e37b63]/20 bg-[#fff8f5] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-sm font-black text-[#18332d]"><LockKeyhole className="h-4 w-4 text-[#e37b63]" aria-hidden="true" />{language === 'zh' ? '受限乘车名单' : 'Restricted passenger manifest'}</h4><span className={`text-xs font-bold ${capacity.exceeded ? 'text-rose-700' : 'text-[#66766f]'}`}>{capacity.count}/{capacity.seats ?? '—'}</span></div><form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={assign}><label className={labelClass}>{language === 'zh' ? '乘客' : 'Passenger'}<select className={fieldClass} value={passengerId} onChange={(event) => setPassengerId(event.target.value)} required><option value="">{language === 'zh' ? '选择成员' : 'Choose member'}</option>{data.eligibleMembers.filter((member) => !journey.passengerManifest.some((passenger) => passenger.memberId === member.memberId)).map((member) => <option key={member.memberId} value={member.memberId}>{member.displayName}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '接送点' : 'Pickup stop'}<select className={fieldClass} value={pickupStopId} onChange={(event) => setPickupStopId(event.target.value)} required><option value="">{language === 'zh' ? '选择接送点' : 'Choose stop'}</option>{journey.pickupStops.map((stop) => <option key={stop.id} value={stop.id}>{localize(stop.name, language)}</option>)}</select></label><AppActionButton className="self-end" type="submit" size="sm" disabled={busy || !passengerId || !pickupStopId || capacity.full}>{language === 'zh' ? '加入' : 'Assign'}</AppActionButton></form><div className="mt-3 space-y-2">{journey.passengerManifest.map((passenger) => <div key={passenger.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e37b63]/15 bg-white px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-bold text-[#18332d]">{passenger.memberDisplayName}</p><p className="text-xs text-[#66766f]">{localize(passenger.pickupStopName, language)} · {formatDateTime(passenger.pickupUtc, language)}</p></div><AppActionButton size="sm" variant="danger" disabled={busy} onClick={() => void (async () => { const confirmedRemoval = await requestConfirmation({ title: language === 'zh' ? '移除乘客？' : 'Remove passenger?', description: language === 'zh' ? '该乘客会从此行程名单结束指派；审计记录仍会保留。' : 'The passenger assignment will end for this journey; its audit record is retained.', confirmLabel: language === 'zh' ? '移除' : 'Remove', tone: 'danger' }); if (confirmedRemoval) await mutate(() => eventTravelService.removePassenger(data.eventId, journey.id, passenger.id, journey.eTag), language === 'zh' ? '乘客已移除。' : 'Passenger removed.') })()}>{language === 'zh' ? '移除' : 'Remove'}</AppActionButton></div>)}{!journey.passengerManifest.length ? <p className="rounded-xl border border-dashed border-[#e37b63]/25 px-3 py-4 text-center text-sm text-[#66766f]">{language === 'zh' ? '尚未指派乘客。' : 'No passengers assigned.'}</p> : null}</div></section></div>
    </article>{confirmationModal}</>
}

const StopRow = ({ stop, journey, eventId, language, busy, mutate }: { stop: EventTravelPickupStop; journey: EventTravelJourney; eventId: string; language: Language; busy: boolean; mutate: Mutate }) => {
  const [pickup, setPickup] = useState(toInput(stop.pickupUtc))
  useEffect(() => setPickup(toInput(stop.pickupUtc)), [stop.pickupUtc])
  return <div className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end"><div className="min-w-0"><p className="truncate text-sm font-bold text-[#18332d]">{stop.sortOrder + 1}. {localize(stop.name, language)}</p><p className="truncate text-xs text-[#66766f]">{localize(stop.address, language)}</p></div><label className={labelClass}>{language === 'zh' ? '时间' : 'Time'}<input className={fieldClass} type="datetime-local" value={pickup} onChange={(event) => setPickup(event.target.value)} /></label><AppActionButton size="sm" disabled={busy || pickup === toInput(stop.pickupUtc)} onClick={() => void mutate(() => eventTravelService.updateStop(eventId, journey.id, stop.id, journey.eTag, { sortOrder: stop.sortOrder, name: stop.name, address: stop.address, pickupUtc: toUtc(pickup) }), language === 'zh' ? '接送时间已更新。' : 'Pickup time updated.')}>{language === 'zh' ? '保存' : 'Save'}</AppActionButton></div>
}

const MyJourneys = ({ data, language }: { data: EventTravelMyJourneys; language: Language }) => <AppSectionCard title={language === 'zh' ? '我的接送安排' : 'My pickup journeys'} subtitle={language === 'zh' ? '这里只显示你自己的司机／乘车安排，不会显示其他乘客。' : 'Only your own driver or passenger details are shown; other passengers are never included.'} action={<AppBadge variant="info">userSpecific</AppBadge>}>{data.journeys.length ? <div className="space-y-3">{data.journeys.map((journey) => <article key={journey.journeyId} className="rounded-2xl border border-[#176b5a]/15 bg-white p-4"><h3 className="font-black text-[#18332d]">{localize(journey.name, language)}</h3><p className="mt-2 flex items-center gap-2 text-sm text-[#40554e]"><Bus className="h-4 w-4" aria-hidden="true" />{formatDateTime(journey.startUtc, language)} – {formatDateTime(journey.endUtc, language)}</p>{journey.pickupStopName ? <p className="mt-2 flex items-start gap-2 text-sm text-[#40554e]"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{localize(journey.pickupStopName, language)} · {journey.pickupUtc ? formatDateTime(journey.pickupUtc, language) : ''}</p> : null}{journey.vehicleName ? <p className="mt-2 flex items-center gap-2 text-sm text-[#40554e]"><CarFront className="h-4 w-4" aria-hidden="true" />{localize(journey.vehicleName, language)} · {journey.vehicleRegistrationReference}</p> : null}{journey.driverDisplayName ? <p className="mt-2 flex items-center gap-2 text-sm text-[#40554e]"><Users className="h-4 w-4" aria-hidden="true" />{language === 'zh' ? '司机：' : 'Driver: '}{journey.driverDisplayName}</p> : null}</article>)}</div> : <AppEmptyState title={language === 'zh' ? '目前没有接送安排' : 'No pickup journey assigned'} description={language === 'zh' ? '交通协调员确认乘车名单后，你的安排会显示在这里。' : 'Your journey will appear here after the travel coordinator assigns it.'} />}</AppSectionCard>

type Mutate = (action: () => Promise<EventTravelWorkspaceData>, message: string) => Promise<void>
type PanelProps = { data: EventTravelWorkspaceData; language: Language; busy: boolean; mutate: Mutate }

export const EventTravelWorkspaceSurface = (props: EventSurfaceProps) => <EventTravelWorkspace {...props} />
