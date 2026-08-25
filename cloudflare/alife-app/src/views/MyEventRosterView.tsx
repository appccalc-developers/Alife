import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarClock, CheckCircle2, MessageSquareText, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { normalizeApiError } from '../services/http'
import { rosterService } from '../services/rosterService'
import { useAuthStore } from '../stores/auth'
import type { RosterMemberResponse } from '../types/roster'
import { localizeText } from '../utils/localizedText'

const MyEventRosterView = () => {
  const { eventId = '' } = useParams()
  const auth = useAuthStore()
  const chinese = auth.language === 'zh'
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['myEventRoster', eventId],
    queryFn: () => rosterService.getMyAssignments(eventId),
    enabled: Boolean(eventId),
  })
  const mutation = useMutation({
    mutationFn: ({ assignmentId, response }: { assignmentId: string; response: RosterMemberResponse }) =>
      rosterService.respondAssignment(eventId, assignmentId, response, notes[assignmentId] ?? ''),
    onSuccess: async (_, variables) => {
      setMessage(variables.response === 'accept'
        ? (chinese ? '你已接受这项安排。负责人会看到你的确认。' : 'You accepted this assignment. The leader can see your response.')
        : variables.response === 'decline'
          ? (chinese ? '你已拒绝这项安排，负责人会重新安排。' : 'You declined this assignment. The leader can arrange someone else.')
          : (chinese ? '你的调整请求已发送给负责人。' : 'Your change request was sent to the leader.'))
      await queryClient.invalidateQueries({ queryKey: ['myEventRoster', eventId] })
    },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })

  if (query.isLoading) return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-600">{chinese ? '正在打开我的活动排班…' : 'Opening my event assignments…'}</main>
  if (query.error || !query.data) return <main className="mx-auto max-w-3xl px-4 py-10"><p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{normalizeApiError(query.error).message}</p></main>
  const workspace = query.data
  const eventPath = `/groups/${workspace.groupId}/events/${workspace.eventId}`
  const format = (value: string) => new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  const statusLabel = (status: string) => ({
    confirmed: chinese ? '等待你确认' : 'Your response needed',
    accepted: chinese ? '已接受' : 'Accepted',
    declined: chinese ? '已拒绝' : 'Declined',
    changeRequested: chinese ? '已请求调整' : 'Change requested',
    cancelled: chinese ? '已取消' : 'Cancelled',
  }[status] ?? status)

  return <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
    <Link to={eventPath} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-800"><ArrowLeft className="h-4 w-4" />{chinese ? '返回活动' : 'Back to event'}</Link>
    <section className="mt-5 rounded-[2rem] bg-[#173f36] p-6 text-white sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '我的活动排班' : 'My event assignments'}</p>
      <h1 className="mt-2 text-3xl font-black">{localizeText(workspace.eventTitle, auth.language)}</h1>
      <p className="mt-3 text-sm leading-6 text-emerald-50/85">{chinese ? '负责人提出安排后，由你本人接受、拒绝或请求调整。AI 和负责人都不能替你作出这个回答。' : 'After a leader proposes an assignment, you personally accept, decline or request a change. AI and leaders cannot answer for you.'}</p>
    </section>
    {message ? <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status">{message}</p> : null}
    <div className="mt-5 space-y-4">
      {workspace.assignments.length === 0 ? <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">{chinese ? '目前没有分配给你的岗位。' : 'You do not have an assignment for this event.'}</section> : null}
      {workspace.assignments.map((assignment) => <article key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">{localizeText(assignment.shiftName, auth.language)}</h2><p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-600"><CalendarClock className="h-4 w-4" />{format(assignment.startUtc)} – {format(assignment.endUtc)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{statusLabel(assignment.status)}</span></div>
        {assignment.memberResponseNotes ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{assignment.memberResponseNotes}</p> : null}
        {assignment.status === 'confirmed' ? <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="block text-sm font-bold text-slate-700">{chinese ? '给负责人的说明（请求调整时必填）' : 'Note to the leader (required for a change request)'}<textarea value={notes[assignment.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [assignment.id]: event.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ assignmentId: assignment.id, response: 'accept' })} className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white"><CheckCircle2 className="h-4 w-4" />{chinese ? '接受安排' : 'Accept'}</button><button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ assignmentId: assignment.id, response: 'requestChange' })} className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-black text-amber-900"><MessageSquareText className="h-4 w-4" />{chinese ? '请求调整' : 'Request change'}</button><button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ assignmentId: assignment.id, response: 'decline' })} className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-black text-rose-800"><XCircle className="h-4 w-4" />{chinese ? '无法参加' : 'Decline'}</button></div>
        </div> : null}
      </article>)}
    </div>
  </main>
}

export default MyEventRosterView
