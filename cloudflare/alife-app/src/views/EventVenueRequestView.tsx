import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CalendarClock, CheckCircle2, ChevronRight, FilePenLine, Send, UsersRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { normalizeApiError } from '../services/http'
import { venueService } from '../services/venueService'
import { useAuthStore } from '../stores/auth'
import type { SaveVenueBookingPayload, VenueBookingDto } from '../types/venue'
import { localizeText } from '../utils/localizedText'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'
import EventModuleSuggestionsPanel from '../components/events/EventModuleSuggestionsPanel'
import type { EventModuleSuggestionItem } from '../types/eventModuleSuggestion'
import { validateVenueDraft, type VenueDraftValidationCode } from '../utils/eventWorkflowValidation'

type BookingForm = {
  id: string | null
  eventOccurrenceId: string
  venueSpaceId: string
  purposeEn: string
  purposeZh: string
  notes: string
  startLocal: string
  endLocal: string
  attendeeCount: number
}

const toLocalInput = (value: string) => {
  const date = new Date(value)
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}

const statusCopy = (status: VenueBookingDto['status'], chinese: boolean) => ({
  draft: chinese ? '草稿' : 'Draft',
  submitted: chinese ? '等待审批' : 'Submitted',
  approved: chinese ? '已批准' : 'Approved',
  rejected: chinese ? '已退回' : 'Rejected',
  cancelled: chinese ? '已取消' : 'Cancelled',
}[status])

const EventVenueRequestView = () => {
  const { eventId = '', groupId = '' } = useParams<{ eventId: string; groupId: string }>()
  const auth = useAuthStore()
  const isChinese = auth.language === 'zh'
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const [form, setForm] = useState<BookingForm>({ id: null, eventOccurrenceId: '', venueSpaceId: '', purposeEn: '', purposeZh: '', notes: '', startLocal: '', endLocal: '', attendeeCount: 1 })
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(groupId))
  const workspaceQuery = useQuery({
    queryKey: ['eventVenueWorkspace', eventId],
    queryFn: () => venueService.getEventWorkspace(eventId),
    enabled: Boolean(eventId),
  })
  const workspace = workspaceQuery.data
  const spaces = useMemo(() => workspace?.venues.flatMap((venue) => venue.spaces.map((space) => ({ venue, space }))) ?? [], [workspace])

  useEffect(() => {
    if (!workspace || form.startLocal) return
    setForm((current) => ({
      ...current,
      eventOccurrenceId: current.eventOccurrenceId || workspace.occurrences[0]?.id || '',
      venueSpaceId: current.venueSpaceId || spaces[0]?.space.id || '',
      startLocal: toLocalInput(workspace.occurrences[0]?.startUtc || workspace.eventStartUtc),
      endLocal: toLocalInput(workspace.occurrences[0]?.endUtc || workspace.eventEndUtc),
    }))
  }, [form.startLocal, spaces, workspace])

  useEffect(() => {
    setUnsavedChangesGuard(dirty, isChinese ? '场地申请草稿尚未保存，确定离开吗？' : 'The venue request draft is not saved. Leave this page?', 'confirm')
    if (!dirty) return () => setUnsavedChangesGuard(false)
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); setUnsavedChangesGuard(false) }
  }, [dirty, isChinese])

  const updateForm = (changes: Partial<BookingForm>) => {
    setForm((current) => ({ ...current, ...changes }))
    setDirty(true)
    setMessage('')
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: SaveVenueBookingPayload = {
        eventOccurrenceId: form.eventOccurrenceId || null,
        venueSpaceId: form.venueSpaceId,
        purposeEn: form.purposeEn,
        purposeZh: form.purposeZh,
        notes: form.notes,
        startUtc: new Date(form.startLocal).toISOString(),
        endUtc: new Date(form.endLocal).toISOString(),
        attendeeCount: form.attendeeCount,
      }
      return venueService.saveBooking(eventId, form.id, payload)
    },
    onSuccess: async (booking) => {
      setMessage(isChinese ? '场地申请草稿已保存，请检查后再提交。' : 'Venue request draft saved. Review it before submitting.')
      setForm((current) => ({ ...current, id: booking.id }))
      setDirty(false)
      await queryClient.invalidateQueries({ queryKey: ['eventVenueWorkspace', eventId] })
    },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })
  const submitMutation = useMutation({
    mutationFn: (bookingId: string) => venueService.submitBooking(eventId, bookingId),
    onSuccess: async () => {
      setMessage(isChinese ? '申请已提交，等待场地负责人审批。' : 'Request submitted for venue review.')
      setForm((current) => ({ ...current, id: null, purposeEn: '', purposeZh: '', notes: '' }))
      await queryClient.invalidateQueries({ queryKey: ['eventVenueWorkspace', eventId] })
    },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })

  const editBooking = (booking: VenueBookingDto) => {
    setForm({ id: booking.id, eventOccurrenceId: booking.eventOccurrenceId || '', venueSpaceId: booking.venueSpaceId, purposeEn: booking.purpose.en || '', purposeZh: booking.purpose.zh || '', notes: booking.notes, startLocal: toLocalInput(booking.startUtc), endLocal: toLocalInput(booking.endUtc), attendeeCount: booking.attendeeCount })
    setDirty(false)
  }

  const formatDate = (value: string) => new Intl.DateTimeFormat(isChinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  const resourceText = (json: string) => {
    try {
      const value = JSON.parse(json)
      return Array.isArray(value) && value.length ? value.join('、') : (isChinese ? '未登记设备' : 'No equipment listed')
    } catch { return isChinese ? '设备资料格式有误' : 'Equipment details unavailable' }
  }

  const applyAiSuggestion = (suggestion: EventModuleSuggestionItem) => {
    if (suggestion.key === 'venueSpaceId') updateForm({ venueSpaceId: suggestion.value })
    if (suggestion.key === 'purposeEn') updateForm({ purposeEn: suggestion.value })
    if (suggestion.key === 'purposeZh') updateForm({ purposeZh: suggestion.value })
    if (suggestion.key === 'notes') updateForm({ notes: suggestion.value })
  }

  const formatAiValue = (suggestion: EventModuleSuggestionItem) => {
    if (suggestion.key !== 'venueSpaceId') return suggestion.value
    const match = spaces.find(({ space }) => space.id === suggestion.value)
    return match ? `${localizeText(match.venue.name, auth.language)} · ${localizeText(match.space.name, auth.language)}` : suggestion.value
  }

  const venueValidationMessage = (code: VenueDraftValidationCode) => ({
    occurrenceRequired: isChinese ? '请选择这份申请对应的活动场次。' : 'Choose the event session for this request.',
    spaceRequired: isChinese ? '请选择一个已登记的场地空间。' : 'Choose a registered venue space.',
    purposeRequired: isChinese ? '请至少填写一种语言的场地用途。' : 'Add the venue purpose in at least one language.',
    invalidTime: isChinese ? '请填写有效的开始和结束时间。' : 'Enter a valid start and end time.',
    endBeforeStart: isChinese ? '结束时间必须晚于开始时间。' : 'The end time must be later than the start time.',
    outsideOccurrence: isChinese ? '申请时间必须在所选场次时间范围内。' : 'The request time must stay inside the selected session.',
    attendanceRequired: isChinese ? '预计人数必须是大于 0 的整数。' : 'Expected attendance must be a positive whole number.',
    capacityExceeded: isChinese ? '预计人数超过所选空间容量，请更换空间或修正人数。' : 'Expected attendance exceeds this space. Choose another space or correct the count.',
  })[code]

  const submitDraft = () => {
    if (!workspace) return
    const occurrence = workspace.occurrences.find((item) => item.id === form.eventOccurrenceId)
    const selectedSpace = spaces.find(({ space }) => space.id === form.venueSpaceId)?.space
    const issue = validateVenueDraft({
      occurrenceRequired: workspace.occurrences.length > 1,
      occurrenceId: form.eventOccurrenceId,
      occurrenceStartUtc: occurrence?.startUtc,
      occurrenceEndUtc: occurrence?.endUtc,
      venueSpaceId: form.venueSpaceId,
      purposeEn: form.purposeEn,
      purposeZh: form.purposeZh,
      startLocal: form.startLocal,
      endLocal: form.endLocal,
      attendeeCount: form.attendeeCount,
      spaceCapacity: selectedSpace?.capacity,
    })
    if (issue) {
      setMessage(venueValidationMessage(issue))
      return
    }
    setMessage('')
    saveMutation.mutate()
  }

  if (workspaceQuery.isLoading) return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-[#718079]">{isChinese ? '正在打开场地申请…' : 'Opening venue request…'}</div>
  if (workspaceQuery.error || !workspace) {
    const error = normalizeApiError(workspaceQuery.error)
    return <div className="mx-auto max-w-6xl px-4 py-10"><section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-black text-amber-950">{error.status === 409 ? (isChinese ? '这项活动还没有加入场地申请' : 'Venue preparation is not in this event yet') : (isChinese ? '无法打开场地申请' : 'Unable to open venue request')}</h1><p className="mt-2 text-sm leading-6 text-amber-800">{error.status === 409 ? (isChinese ? '请先回到活动设置，在“按需筹备”中加入场地；加入后这里才会显示申请流程。' : 'Return to event settings and add Venue under optional preparation. The request workflow will appear after that.') : error.message}</p><Link to={`${eventBasePath}/edit?step=setup#event-module-selector`} className="mt-5 inline-flex rounded-xl bg-[#176b5a] px-4 py-2.5 text-sm font-black text-white">{isChinese ? '返回活动设置' : 'Back to event settings'}</Link></section></div>
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <nav aria-label={isChinese ? '当前位置' : 'Breadcrumb'} className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#687a73]"><Link to={`${eventBasePath}?section=workflow`} className="hover:text-[#123d34]">{isChinese ? '活动流程' : 'Event plan'}</Link><ChevronRight className="h-4 w-4 text-[#a2ada8]" /><span className="text-[#123d34]">{isChinese ? '场地申请' : 'Venue request'}</span></nav>
      <section className="mt-5 rounded-[2rem] bg-[#173f36] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b9ddd1]">{isChinese ? '活动筹备 · 场地' : 'Event preparation · Venue'}</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">{localizeText(workspace.eventTitle, auth.language)}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d7e8e2]">{isChinese ? '从教会已经维护好的场地中选择，先保存草稿，确认时间、人数和用途后再提交。提交不会自动批准。' : 'Choose from the church-maintained catalog, save a draft, then confirm the time, attendance, and purpose before submitting. Submission does not mean automatic approval.'}</p>
        <ol className="mt-6 flex flex-col gap-3 text-xs font-black text-emerald-50/90 sm:flex-row sm:items-center">
          {[isChinese ? '选择空间' : 'Choose space', isChinese ? '保存草稿' : 'Save draft', isChinese ? '负责人提交' : 'Leader submits', isChinese ? '场地负责人审批' : 'Venue review'].map((label, index) => <li key={label} className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10">{index + 1}</span><span>{label}</span>{index < 3 ? <ChevronRight className="hidden h-4 w-4 text-white/40 sm:block" /> : null}</li>)}
        </ol>
      </section>

      {message ? <div role="status" className="mt-5 rounded-xl border border-[#ddcdbd] bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-[#6f523f]">{message}</div> : null}

      {!spaces.length ? (
        <section className="mt-6 rounded-[1.75rem] border border-[#ded6cb] bg-white p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-[#8a9a94]" /><h2 className="mt-3 text-xl font-black text-[#18332d]">{isChinese ? '目前没有可申请的场地' : 'No venue is available yet'}</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#718079]">{isChinese ? '请联系有场地目录维护权限的负责人，先登记真实场地和空间。系统不会在申请页面临时创建场地。' : 'Ask a venue catalog manager to register the real venue and spaces first. Venues cannot be created from an event request.'}</p>
          {auth.hasAdminPermission('admin.venues.manageCatalog') ? <Link to="/system/venues" className="mt-5 inline-flex rounded-xl bg-[#176b5a] px-4 py-2.5 text-sm font-black text-white">{isChinese ? '前往场地目录维护' : 'Open venue catalog'}</Link> : null}
        </section>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); submitDraft() }} className="mt-6 rounded-[1.75rem] border border-[#ded6cb] bg-[#fbfaf7] p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">{form.id ? (isChinese ? '修改草稿' : 'Edit draft') : (isChinese ? '新申请' : 'New request')}</p><h2 className="mt-1 text-2xl font-black text-[#18332d]">{isChinese ? '活动场地申请' : 'Event venue request'}</h2></div>{form.id ? <button type="button" onClick={() => { setForm((current) => ({ ...current, id: null, purposeEn: '', purposeZh: '', notes: '' })); setDirty(false) }} className="text-sm font-bold text-[#176b5a]">{isChinese ? '开始另一份申请' : 'Start another request'}</button> : null}</div>
          <div className="mt-5"><EventModuleSuggestionsPanel eventId={eventId} module="venue" language={auth.language} onApply={applyAiSuggestion} formatValue={formatAiValue} guidancePlaceholder={{ zh: '例如：约 80 人，需要厨房和无障碍入口；只比较目录中已有场地。', en: 'For example: about 80 people, with a kitchen and accessible entry; compare maintained venues only.' }} /></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-[#445b53] sm:col-span-2">{isChinese ? '这份申请属于哪个场次' : 'Session for this request'}<select required={workspace.occurrences.length > 1} value={form.eventOccurrenceId} onChange={(event) => { const occurrence = workspace.occurrences.find((item) => item.id === event.target.value); updateForm({ eventOccurrenceId: event.target.value, ...(occurrence ? { startLocal: toLocalInput(occurrence.startUtc), endLocal: toLocalInput(occurrence.endUtc) } : {}) }) }} className="mt-1 w-full rounded-xl border border-[#d8d1c7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#176b5a]">{!workspace.occurrences.length ? <option value="">{isChinese ? '活动整体' : 'Overall event'}</option> : workspace.occurrences.map((occurrence) => <option key={occurrence.id} value={occurrence.id}>{localizeText(occurrence.name, auth.language)} · {formatDate(occurrence.startUtc)}</option>)}</select><span className="mt-1 block text-xs font-normal text-[#718079]">{isChinese ? '选择场次后，时间会自动带入；不同场次可以申请不同空间。' : 'Selecting a session fills its time; different sessions may request different spaces.'}</span></label>
            <label className="text-sm font-bold text-[#445b53] sm:col-span-2">{isChinese ? '选择场地与空间' : 'Venue and space'}<select required value={form.venueSpaceId} onChange={(event) => updateForm({ venueSpaceId: event.target.value })} className="mt-1 w-full rounded-xl border border-[#d8d1c7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#176b5a]">{spaces.map(({ venue, space }) => <option key={space.id} value={space.id}>{localizeText(venue.name, auth.language)} · {localizeText(space.name, auth.language)} · {space.capacity} {isChinese ? '人' : 'people'} · {resourceText(space.resourcesJson)}</option>)}</select></label>
            <label className="text-sm font-bold text-[#445b53]">{isChinese ? '开始时间' : 'Start time'}<input required type="datetime-local" value={form.startLocal} onChange={(event) => updateForm({ startLocal: event.target.value })} className="mt-1 w-full rounded-xl border border-[#d8d1c7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#176b5a]" /></label>
            <label className="text-sm font-bold text-[#445b53]">{isChinese ? '结束时间' : 'End time'}<input required type="datetime-local" value={form.endLocal} onChange={(event) => updateForm({ endLocal: event.target.value })} className="mt-1 w-full rounded-xl border border-[#d8d1c7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#176b5a]" /></label>
            <label className="text-sm font-bold text-[#445b53]">{isChinese ? '用途（中文）' : 'Purpose (Chinese)'}<input value={form.purposeZh} onChange={(event) => updateForm({ purposeZh: event.target.value })} className="mt-1 w-full rounded-xl border border-[#d8d1c7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#176b5a]" /></label>
            <label className="text-sm font-bold text-[#445b53]">{isChinese ? '用途（英文）' : 'Purpose (English)'}<input value={form.purposeEn} onChange={(event) => updateForm({ purposeEn: event.target.value })} className="mt-1 w-full rounded-xl border border-[#d8d1c7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#176b5a]" /></label>
            <label className="text-sm font-bold text-[#445b53]">{isChinese ? '预计人数' : 'Expected attendance'}<input required type="number" min={1} value={form.attendeeCount} onChange={(event) => updateForm({ attendeeCount: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-[#d8d1c7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#176b5a]" /></label>
            <label className="text-sm font-bold text-[#445b53] sm:col-span-2">{isChinese ? '补充说明' : 'Notes'}<textarea rows={3} value={form.notes} onChange={(event) => updateForm({ notes: event.target.value })} className="mt-1 w-full rounded-xl border border-[#d8d1c7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#176b5a]" /></label>
          </div>
          <div className="mt-6 flex justify-end"><button type="submit" disabled={saveMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#176b5a] px-5 py-3 text-sm font-black text-white disabled:opacity-50"><FilePenLine className="h-4 w-4" />{saveMutation.isPending ? (isChinese ? '正在保存…' : 'Saving…') : (isChinese ? '保存草稿' : 'Save draft')}</button></div>
        </form>
      )}

      <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#ded6cb] bg-white shadow-[0_18px_45px_rgba(31,56,48,0.06)]">
        <div className="p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#176b5a]">{isChinese ? '申请记录' : 'Request history'}</p><h2 className="mt-1 text-2xl font-black text-[#18332d]">{isChinese ? '这项活动的场地申请' : 'Venue requests for this event'}</h2></div>
        <div className="divide-y divide-[#2f4b42]/10 border-t border-[#2f4b42]/10">
          {!workspace.bookings.length ? <p className="p-7 text-sm text-[#718079]">{isChinese ? '还没有保存过场地申请。' : 'No venue request has been saved yet.'}</p> : null}
          {workspace.bookings.map((booking) => (
            <article key={booking.id} className="p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-black text-[#18332d]">{localizeText(booking.venueName, auth.language)} · {localizeText(booking.spaceName, auth.language)}</h3>{booking.eventOccurrenceName ? <p className="mt-1 text-xs font-black text-[#176b5a]">{isChinese ? '场次：' : 'Session: '}{localizeText(booking.eventOccurrenceName, auth.language)}</p> : null}<p className="mt-1 text-sm text-[#60716a]">{localizeText(booking.purpose, auth.language)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${booking.status === 'approved' ? 'bg-[#e2f3e9] text-[#176b5a]' : booking.status === 'rejected' ? 'bg-[#fde8e4] text-[#9a4034]' : 'bg-[#fff0cf] text-[#8b651d]'}`}>{statusCopy(booking.status, isChinese)}</span></div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#556b63]"><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />{formatDate(booking.startUtc)} — {formatDate(booking.endUtc)}</span><span className="inline-flex items-center gap-1.5"><UsersRound className="h-4 w-4" />{booking.attendeeCount}</span></div>
              {booking.decisionNotes ? <p className="mt-3 rounded-xl bg-[#f6f3ed] px-3 py-2 text-sm text-[#60716a]"><strong>{isChinese ? '审批说明：' : 'Decision note: '}</strong>{booking.decisionNotes}</p> : null}
              {(booking.status === 'draft' || booking.status === 'rejected') ? <div className="mt-4 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => editBooking(booking)} className="rounded-xl border border-[#bdd2ca] px-4 py-2 text-sm font-black text-[#176b5a]">{isChinese ? '修改草稿' : 'Edit draft'}</button>{booking.status === 'draft' ? <button type="button" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate(booking.id)} className="inline-flex items-center gap-2 rounded-xl bg-[#176b5a] px-4 py-2 text-sm font-black text-white disabled:opacity-50"><Send className="h-4 w-4" />{isChinese ? '确认并提交' : 'Confirm and submit'}</button> : null}</div> : booking.status === 'approved' ? <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#176b5a]"><CheckCircle2 className="h-4 w-4" />{isChinese ? '场地已经预留' : 'Space reserved'}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default EventVenueRequestView
