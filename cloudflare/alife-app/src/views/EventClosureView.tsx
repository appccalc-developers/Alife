import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Bot, CheckCircle2, ChevronRight, History, Plus, Save, Trash2, UserCheck, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppPageShell from '../components/layout/AppPageShell'
import { eventClosureService } from '../services/eventClosureService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { ClosureLearning } from '../types/eventClosure'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { localizeText } from '../utils/localizedText'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

const learningId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

const EventClosureView = () => {
  const { eventId = '', groupId = '' } = useParams<{ eventId: string; groupId: string }>()
  const { language } = useAuthStore()
  const chinese = language === 'zh'
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(groupId))
  const query = useQuery({ queryKey: ['eventClosure', eventId], queryFn: () => eventClosureService.getWorkspace(eventId), enabled: Boolean(eventId) })
  const [summaryEn, setSummaryEn] = useState('')
  const [summaryZh, setSummaryZh] = useState('')
  const [attendanceNotes, setAttendanceNotes] = useState('')
  const [financeNotes, setFinanceNotes] = useState('')
  const [incidentNotes, setIncidentNotes] = useState('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [learnings, setLearnings] = useState<ClosureLearning[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!query.data) return
    const report = query.data.report
    setSummaryEn(report.summary.en); setSummaryZh(report.summary.zh)
    setAttendanceNotes(report.attendanceNotes); setFinanceNotes(report.financeNotes)
    setIncidentNotes(report.incidentNotes); setFollowUpNotes(report.followUpNotes)
    setLearnings(report.learnings); setConfirmed(report.leaderConfirmed); setDirty(false)
  }, [query.data])

  useEffect(() => {
    setUnsavedChangesGuard(dirty, chinese ? '活动总结尚未保存，确定离开吗？' : 'The closure report is not saved. Leave this page?', 'confirm')
    if (!dirty) return () => setUnsavedChangesGuard(false)
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); setUnsavedChangesGuard(false) }
  }, [chinese, dirty])

  const change = (apply: () => void) => { apply(); setConfirmed(false); setDirty(true); setMessage('') }
  const mutation = useMutation({
    mutationFn: () => eventClosureService.update(eventId, {
      summaryEn, summaryZh, attendanceNotes, financeNotes, incidentNotes, followUpNotes, learnings, leaderConfirmed: confirmed,
    }),
    onSuccess: async () => {
      setDirty(false)
      setMessage(confirmed ? (chinese ? '活动已确认结项，可复用经验已进入往期参考。' : 'Closure confirmed. Adopted learnings are now available as history.') : (chinese ? '活动总结草稿已保存。' : 'Closure draft saved.'))
      await query.refetch()
    },
  })
  const aiMutation = useMutation({
    mutationFn: () => eventClosureService.generateAiDraft(eventId),
    onSuccess: ({ draft }) => {
      setSummaryEn(draft.summary.en)
      setSummaryZh(draft.summary.zh)
      setAttendanceNotes(draft.attendanceNotes)
      setFinanceNotes(draft.financeNotes)
      setIncidentNotes(draft.incidentNotes)
      setFollowUpNotes(draft.followUpNotes)
      setLearnings(draft.learnings.map((item) => ({ ...item, reuseNextTime: false })))
      setConfirmed(false)
      setDirty(true)
      setMessage(chinese
        ? 'AI 草稿已放入表单，但尚未保存。请逐项核对，负责人确认必须由你本人完成。'
        : 'The AI draft is in the form but is not saved. Review every field; leader confirmation remains your decision.')
    },
  })

  const requestAiDraft = () => {
    if (dirty && !window.confirm(chinese
      ? 'AI 草稿会替换当前尚未保存的内容，是否继续？'
      : 'The AI draft will replace your current unsaved content. Continue?')) return
    setMessage('')
    aiMutation.mutate()
  }

  if (query.isLoading) return <AppPageShell><p className="py-12 text-sm text-slate-600">{chinese ? '正在打开活动总结…' : 'Opening closure report…'}</p></AppPageShell>
  if (query.error || !query.data) return <AppPageShell><div className="rounded-3xl border border-rose-200 bg-rose-50 p-6"><h1 className="font-black text-rose-950">{chinese ? '无法打开活动总结' : 'Unable to open closure report'}</h1><p className="mt-2 text-sm text-rose-700">{normalizeApiError(query.error).message}</p></div></AppPageShell>
  const workspace = query.data
  const addLearning = () => change(() => setLearnings((items) => [...items, { id: learningId(), title: { en: '', zh: '' }, detail: { en: '', zh: '' }, reuseNextTime: false }]))
  const updateLearning = (id: string, update: (item: ClosureLearning) => ClosureLearning) => change(() => setLearnings((items) => items.map((item) => item.id === id ? update(item) : item)))

  return <AppPageShell>
    <nav aria-label={chinese ? '当前位置' : 'Breadcrumb'} className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#687a73]"><Link to={`${eventBasePath}?section=workflow`} className="inline-flex items-center gap-2 hover:text-[#123d34]"><ArrowLeft className="h-4 w-4" />{chinese ? '活动流程' : 'Event plan'}</Link><ChevronRight className="h-4 w-4 text-[#a2ada8]" /><span className="text-[#123d34]">{chinese ? '结项复盘' : 'Closure'}</span></nav>
    <header className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#123d34_0%,#176b5a_58%,#2c6079_100%)] px-6 py-7 text-white shadow-[0_24px_60px_rgba(18,61,52,0.18)] sm:px-8 sm:py-9"><div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/[0.035]" /><div className="relative"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '活动完成后 · 结项复盘' : 'After the event · Closure'}</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{localizeText(workspace.eventTitle, language)}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/80">{chinese ? '先核对实际出席、财务和事故记录，再总结经验。成员个人分享不会在这里公开；负责人只保存已经核实的结论。' : 'Check actual attendance, finance and incident records before summarising. Personal member reflections stay private; leaders save verified conclusions only.'}</p></div></header>
    {!workspace.eventHasEnded ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{chinese ? '活动尚未结束。可以查看现有资料，但结束后才能保存结项。' : 'The event has not ended. You may review evidence now, but closure can only be saved afterwards.'}</p> : null}

    <article className="overflow-hidden rounded-[2rem] border border-[#2f4b42]/10 bg-white shadow-[0_24px_65px_rgba(31,56,48,0.08)]">
      <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
        <div>
          <section className="p-5 sm:p-7 lg:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">01</p><h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">{chinese ? '负责人总结' : 'Leader summary'}</h2><p className="mt-2 text-sm leading-6 text-[#687a73]">{chinese ? '两种语言都要由负责人核对。AI 可以起草，但不会保存或确认。' : 'A leader checks both languages. AI may draft, but cannot save or confirm.'}</p></div><button type="button" onClick={requestAiDraft} disabled={!workspace.eventHasEnded || aiMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-45"><Bot className="h-4 w-4" />{aiMutation.isPending ? (chinese ? '正在整理…' : 'Drafting…') : (chinese ? '根据现有记录起草' : 'Draft from evidence')}</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[#40534c]">总结 · 中文<textarea rows={6} value={summaryZh} onChange={(e) => change(() => setSummaryZh(e.target.value))} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3" /></label><label className="text-sm font-bold text-[#40534c]">Summary · English<textarea rows={6} value={summaryEn} onChange={(e) => change(() => setSummaryEn(e.target.value))} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3" /></label></div><p className="mt-3 text-xs leading-5 text-[#718079]">{chinese ? 'AI 只使用汇总数量、当前草稿和负责人确认过的往期经验，不读取成员姓名、个人回顾或付款凭证。' : 'AI uses aggregate counts, the current draft and leader-confirmed learning, not member names, personal reflections or payment evidence.'}</p></section>

          <section className="border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">02</p><h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">{chinese ? '核对结项依据' : 'Check closure evidence'}</h2><p className="mt-2 text-sm leading-6 text-[#687a73]">{chinese ? '没有事故或差异时也要明确写“无”，不要留空。' : 'Write “none” explicitly when there was no incident or variance.'}</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[#40534c]">{chinese ? '出席与签到结果' : 'Attendance outcome'}<textarea rows={4} value={attendanceNotes} onChange={(e) => change(() => setAttendanceNotes(e.target.value))} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3" /></label><label className="text-sm font-bold text-[#40534c]">{chinese ? '财务与差异' : 'Finance and variance'}<textarea rows={4} value={financeNotes} onChange={(e) => change(() => setFinanceNotes(e.target.value))} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3" /></label><label className="text-sm font-bold text-[#40534c]">{chinese ? '事故、险情与处理' : 'Incidents and response'}<textarea rows={4} value={incidentNotes} onChange={(e) => change(() => setIncidentNotes(e.target.value))} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3" /></label><label className="text-sm font-bold text-[#40534c]">{chinese ? '跟进事项' : 'Follow-up actions'}<textarea rows={4} value={followUpNotes} onChange={(e) => change(() => setFollowUpNotes(e.target.value))} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3" /></label></div></section>

          <section className="border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">03</p><h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">{chinese ? '选择可复用经验' : 'Choose reusable learning'}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#687a73]">{chinese ? '只选择已经核实、适合其他活动参考的经验。日期、联系人、价格和审批结论不会复制。' : 'Select verified learning suitable for future events. Dates, contacts, prices and approvals are never copied.'}</p></div><button type="button" onClick={addLearning} className="inline-flex items-center gap-1 rounded-lg bg-[#18332d] px-3 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" />{chinese ? '添加经验' : 'Add learning'}</button></div><div className="mt-5 divide-y divide-[#2f4b42]/10">{learnings.length ? learnings.map((item) => <div key={item.id} className="py-5 first:pt-0 last:pb-0"><div className="grid gap-3 sm:grid-cols-2"><input value={item.title.zh} placeholder="经验标题 · 中文" onChange={(e) => updateLearning(item.id, (x) => ({ ...x, title: { ...x.title, zh: e.target.value } }))} className="rounded-xl border border-[#b9c7c1] px-3.5 py-3" /><input value={item.title.en} placeholder="Learning title · English" onChange={(e) => updateLearning(item.id, (x) => ({ ...x, title: { ...x.title, en: e.target.value } }))} className="rounded-xl border border-[#b9c7c1] px-3.5 py-3" /><textarea rows={3} value={item.detail.zh} placeholder="具体经验 · 中文" onChange={(e) => updateLearning(item.id, (x) => ({ ...x, detail: { ...x.detail, zh: e.target.value } }))} className="rounded-xl border border-[#b9c7c1] px-3.5 py-3" /><textarea rows={3} value={item.detail.en} placeholder="Learning detail · English" onChange={(e) => updateLearning(item.id, (x) => ({ ...x, detail: { ...x.detail, en: e.target.value } }))} className="rounded-xl border border-[#b9c7c1] px-3.5 py-3" /></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="inline-flex items-center gap-2 text-sm font-bold text-[#176b5a]"><input type="checkbox" checked={item.reuseNextTime} onChange={(e) => updateLearning(item.id, (x) => ({ ...x, reuseNextTime: e.target.checked }))} className="accent-[#176b5a]" />{chinese ? '允许作为往期参考' : 'Allow as future reference'}</label><button type="button" onClick={() => change(() => setLearnings((items) => items.filter((x) => x.id !== item.id)))} className="inline-flex items-center gap-1 text-xs font-bold text-rose-700"><Trash2 className="h-4 w-4" />{chinese ? '删除' : 'Remove'}</button></div></div>) : <p className="rounded-2xl border border-dashed border-[#b9c7c1] bg-[#fafbf9] p-6 text-center text-sm text-[#718079]">{chinese ? '还没有可复用经验。' : 'No reusable learning added yet.'}</p>}</div></section>
        </div>

        <aside className="border-t border-[#2f4b42]/10 bg-[#f6f8f5] lg:border-l lg:border-t-0">
          <section className="p-5 sm:p-7 lg:p-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">{chinese ? '已有记录' : 'Recorded evidence'}</p><dl className="mt-4 divide-y divide-[#2f4b42]/10"><div className="flex items-baseline justify-between py-3"><dt className="text-sm text-[#687a73]">{chinese ? '报名记录' : 'Registrations'}</dt><dd className="text-2xl font-black text-[#18332d]">{workspace.evidence.enrollmentSubmissions}</dd></div><div className="flex items-baseline justify-between py-3"><dt className="text-sm text-[#687a73]">{chinese ? '成员回顾' : 'Member reviews'}</dt><dd className="text-2xl font-black text-[#18332d]">{workspace.evidence.memberReviews}</dd></div><div className="flex items-baseline justify-between py-3"><dt className="text-sm text-[#687a73]">{chinese ? '已接受排班' : 'Accepted roster'}</dt><dd className="text-2xl font-black text-[#18332d]">{workspace.evidence.acceptedRosterAssignments}/{workspace.evidence.requiredRosterAssignments}</dd></div></dl><div className="mt-4 divide-y divide-[#2f4b42]/10 border-y border-[#2f4b42]/10"><Link to={`${eventBasePath}/attendance`} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="inline-flex items-center gap-2 font-black text-[#18332d]"><UserCheck className="h-4 w-4 text-[#176b5a]" />{chinese ? '实际出席' : 'Actual attendance'}</span><span className={workspace.evidence.attendanceRecorded ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>{workspace.evidence.attendanceRecorded ? `${workspace.evidence.actualAttendanceUnits}` : (chinese ? '去记录' : 'Record')}</span></Link><Link to={`${eventBasePath}/finance#actual-finance`} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="inline-flex items-center gap-2 font-black text-[#18332d]"><WalletCards className="h-4 w-4 text-[#176b5a]" />{chinese ? '实际收支' : 'Actual finances'}</span><span className={workspace.evidence.financeReconciled ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>{workspace.evidence.financeReconciled ? (chinese ? '已对账' : 'Reconciled') : (chinese ? '去核对' : 'Review')}</span></Link></div></section>
          <section className="border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8"><h2 className="text-base font-black text-[#18332d]">{chinese ? '负责人确认' : 'Leader confirmation'}</h2><label className="mt-4 flex items-start gap-3"><input type="checkbox" checked={confirmed} disabled={!workspace.eventHasEnded} onChange={(e) => { setConfirmed(e.target.checked); setDirty(true); setMessage('') }} className="mt-1 h-4 w-4 accent-[#176b5a]" /><span className="text-sm leading-6 text-[#52645d]">{chinese ? '我已核对结项内容，并确认勾选的经验可以成为以后活动的参考。' : 'I checked the closure content and confirm the selected learning may guide future events.'}</span></label><p className="mt-3 text-xs leading-5 text-violet-800"><Bot className="mr-1 inline h-4 w-4" />{chinese ? '这项确认只能由负责人完成，AI 不能代替。' : 'Only the leader can make this confirmation; AI cannot.'}</p></section>
          <section className="border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8"><h2 className="flex items-center gap-2 text-base font-black text-[#18332d]"><History className="h-5 w-5 text-[#176b5a]" />{chinese ? '往期已确认经验' : 'Confirmed past learning'}</h2>{workspace.previousLearnings.length ? <ul className="mt-4 divide-y divide-[#2f4b42]/10">{workspace.previousLearnings.map((source) => <li key={`${source.eventId}-${source.learning.id}`} className="py-4 first:pt-0 last:pb-0"><p className="font-black text-[#18332d]">{localizeText(source.learning.title, language)}</p><p className="mt-1 text-xs leading-5 text-[#687a73]">{localizeText(source.learning.detail, language)}</p><p className="mt-2 text-[11px] font-bold text-[#718079]">{localizeText(source.eventTitle, language)}</p></li>)}</ul> : <p className="mt-3 text-sm text-[#718079]">{chinese ? '还没有负责人确认过的可复用经验。' : 'No leader-confirmed reusable learning yet.'}</p>}</section>
        </aside>
      </div>
      <footer className="flex flex-col gap-4 border-t border-[#2f4b42]/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7 lg:p-8"><p className="text-xs leading-5 text-[#687a73]">{dirty ? (chinese ? '有尚未保存的修改。' : 'You have unsaved changes.') : (chinese ? '当前内容已保存。' : 'Current content is saved.')}</p><button type="button" disabled={!workspace.eventHasEnded || !dirty || mutation.isPending} onClick={() => mutation.mutate()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176b5a] px-5 py-3 text-sm font-black text-white shadow-[0_10px_25px_rgba(23,107,90,0.2)] disabled:opacity-45"><Save className="h-4 w-4" />{mutation.isPending ? (chinese ? '正在保存…' : 'Saving…') : (chinese ? '保存活动总结' : 'Save closure report')}</button></footer>
    </article>
    {mutation.error || aiMutation.error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{normalizeApiError(mutation.error ?? aiMutation.error).message}</p> : null}{message ? <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{message}</p> : null}
  </AppPageShell>
}

export default EventClosureView
