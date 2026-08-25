import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CalendarClock, Check, ChevronLeft, UsersRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { groupService } from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { venueService } from '../services/venueService'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'

const VenueBookingReviewView = () => {
  const { language, me } = useAuthStore()
  const isChinese = language === 'zh'
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const churchQuery = useQuery({ queryKey: ['church'], queryFn: groupService.getChurch, staleTime: 5 * 60_000 })
  const churchId = churchQuery.data?.id || ''
  const bookingsQuery = useQuery({
    queryKey: ['venueBookingsForReview', churchId],
    queryFn: () => venueService.listBookingsForReview(churchId),
    enabled: Boolean(churchId),
  })
  const reviewMutation = useMutation({
    mutationFn: ({ bookingId, approve }: { bookingId: string; approve: boolean }) =>
      venueService.reviewBooking(bookingId, approve, notes[bookingId] || ''),
    onSuccess: async (_, variables) => {
      setMessage(variables.approve ? (isChinese ? '场地申请已批准，所选空间已经预留。' : 'Venue request approved and the space is now reserved.') : (isChinese ? '场地申请已退回修改。' : 'Venue request returned for changes.'))
      await queryClient.invalidateQueries({ queryKey: ['venueBookingsForReview', churchId] })
    },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })

  const formatDate = (value: string) => new Intl.DateTimeFormat(isChinese ? 'zh-CN' : 'en-NZ', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/system/venues" className="inline-flex items-center gap-1 text-sm font-bold text-[#176b5a]"><ChevronLeft className="h-4 w-4" />{isChinese ? '返回场地管理' : 'Back to venue management'}</Link>
      </div>
      <section className="rounded-[2rem] bg-[#173f36] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b9ddd1]">{isChinese ? '人工确认' : 'Human decision'}</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">{isChinese ? '场地申请审批' : 'Venue request review'}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d7e8e2]">{isChinese ? '这里回答一个具体问题：所选空间在申请的时间、人数和用途下能否预留。申请人与审批人必须是不同的人。' : 'This page answers one concrete question: can the selected space be reserved for the requested time, attendance and purpose? The requester and reviewer must be different people.'}</p>
      </section>

      {message ? <div role="status" className="mt-5 rounded-xl border border-[#ddcdbd] bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-[#6f523f]">{message}</div> : null}
      {bookingsQuery.isLoading ? <p className="mt-6 rounded-2xl bg-white p-6 text-sm text-[#718079]">{isChinese ? '正在读取待审批申请…' : 'Loading submitted requests…'}</p> : null}
      {bookingsQuery.error ? <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{normalizeApiError(bookingsQuery.error).message}</p> : null}
      {!bookingsQuery.isLoading && !bookingsQuery.data?.length ? <section className="mt-6 rounded-[1.75rem] border border-[#ded6cb] bg-white p-8 text-center"><Check className="mx-auto h-9 w-9 text-[#176b5a]" /><h2 className="mt-3 text-xl font-black text-[#18332d]">{isChinese ? '没有待处理的申请' : 'No requests waiting'}</h2><p className="mt-2 text-sm text-[#718079]">{isChinese ? '活动负责人提交后会显示在这里。' : 'Submitted requests from event leaders will appear here.'}</p></section> : null}

      <div className="mt-6 space-y-5">
        {bookingsQuery.data?.map((booking) => {
          const isOwnRequest = booking.requestedByMemberId === me?.id || booking.submittedByMemberId === me?.id
          return <article key={booking.id} className="rounded-[1.75rem] border border-[#ded6cb] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#176b5a]">{localizeText(booking.eventTitle, language)}</p>
                <h2 className="mt-1 text-xl font-black text-[#18332d]">{localizeText(booking.venueName, language)} · {localizeText(booking.spaceName, language)}</h2>
                <p className="mt-2 text-sm font-semibold text-[#556b63]">{localizeText(booking.purpose, language)}</p>
              </div>
              <span className="rounded-full bg-[#fff0cf] px-3 py-1 text-xs font-black text-[#8b651d]">{isChinese ? '待审批' : 'Submitted'}</span>
            </div>
            <div className="mt-5 grid gap-3 rounded-2xl bg-[#f6f3ed] p-4 sm:grid-cols-3">
              <div className="flex gap-2 text-sm text-[#445b53]"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#176b5a]" /><span>{formatDate(booking.startUtc)}<br />{formatDate(booking.endUtc)}</span></div>
              <div className="flex gap-2 text-sm text-[#445b53]"><UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-[#176b5a]" /><span>{booking.attendeeCount} {isChinese ? '人' : 'people'}</span></div>
              <div className="flex gap-2 text-sm text-[#445b53]"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#176b5a]" /><span>{isChinese ? '提交人' : 'Submitted by'}<br />{booking.submittedByDisplayName || booking.requestedByDisplayName || '—'}</span></div>
            </div>
            <section className="mt-4 border-y border-[#2f4b42]/10 py-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#176b5a]">{isChinese ? '本次要决定什么' : 'Decision to make'}</p><p className="mt-1 text-sm font-black text-[#18332d]">{isChinese ? '是否批准在上述时段为这项活动预留这个空间？' : 'Approve reserving this space for the event during the time above?'}</p><div className="mt-3 grid gap-3 text-xs leading-5 text-[#60716a] sm:grid-cols-2"><p><strong className="text-[#18332d]">{isChinese ? '系统会检查：' : 'The system checks: '}</strong>{isChinese ? '申请状态、空间容量和与已批准预订的时间冲突。' : 'request status, space capacity and time conflicts with approved reservations.'}</p><p><strong className="text-[#18332d]">{isChinese ? '审批人要核对：' : 'The reviewer confirms: '}</strong>{isChinese ? '用途是否合适，以及备注中的门禁、设备或交接要求。' : 'whether the purpose is appropriate and any access, equipment or handover needs in the notes.'}</p></div></section>
            {booking.notes ? <p className="mt-4 rounded-xl border border-[#e4ddd3] px-4 py-3 text-sm leading-6 text-[#60716a]">{booking.notes}</p> : null}
            {isOwnRequest ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">{isChinese ? '这是你提交的申请。即使你拥有场地审批权限，也必须由另一位有权限的人员决定。' : 'You submitted this request. Even with venue-review permission, another authorized person must make the decision.'}</p> : null}
            <label className="mt-5 block text-sm font-bold text-[#445b53]">{isChinese ? '审批说明（拒绝时必须填写）' : 'Decision note (required when rejecting)'}<textarea rows={3} value={notes[booking.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [booking.id]: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#d8d1c7] px-3 py-2.5 text-sm outline-none focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15" /></label>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button type="button" disabled={isOwnRequest || reviewMutation.isPending || !(notes[booking.id] || '').trim()} onClick={() => reviewMutation.mutate({ bookingId: booking.id, approve: false })} className="inline-flex items-center gap-2 rounded-xl border border-[#d6a79e] bg-white px-4 py-2.5 text-sm font-black text-[#9a4034] disabled:opacity-40"><X className="h-4 w-4" />{isChinese ? '退回修改' : 'Return for changes'}</button>
              <button type="button" disabled={isOwnRequest || reviewMutation.isPending} onClick={() => reviewMutation.mutate({ bookingId: booking.id, approve: true })} className="inline-flex items-center gap-2 rounded-xl bg-[#176b5a] px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"><Check className="h-4 w-4" />{isChinese ? '批准并预留空间' : 'Approve and reserve space'}</button>
            </div>
          </article>
        })}
      </div>
    </div>
  )
}

export default VenueBookingReviewView
