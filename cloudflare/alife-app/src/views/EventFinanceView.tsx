import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Bot, CheckCircle2, ChevronRight, FileCheck2, Pencil, Plus, Save, Trash2, WalletCards } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import AppBadge from '../components/layout/AppBadge'
import AppPageShell from '../components/layout/AppPageShell'
import EventModuleSuggestionsPanel from '../components/events/EventModuleSuggestionsPanel'
import { eventFinanceService } from '../services/eventFinanceService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { EventFinanceEntry, EventFinanceEntryType, EventFinanceOption } from '../types/eventFinance'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

const optionId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
const optionalNumber = (value: string) => value.trim() === '' ? null : Number(value)
const toLocalDateTimeInput = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const fromLocalDateTimeInput = (value: string) => value ? new Date(value).toISOString() : ''

const EventFinanceView = () => {
  const { eventId = '', groupId = '' } = useParams<{ eventId: string; groupId: string }>()
  const { language } = useAuthStore()
  const chinese = language === 'zh'
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(groupId))
  const query = useQuery({ queryKey: ['eventFinance', eventId], queryFn: () => eventFinanceService.getWorkspace(eventId), enabled: Boolean(eventId) })
  const [enabled, setEnabled] = useState(false)
  const [currency, setCurrency] = useState('NZD')
  const [adultFee, setAdultFee] = useState('')
  const [childFee, setChildFee] = useState('')
  const [paymentEn, setPaymentEn] = useState('')
  const [paymentZh, setPaymentZh] = useState('')
  const [refundEn, setRefundEn] = useState('')
  const [refundZh, setRefundZh] = useState('')
  const [evidenceRequired, setEvidenceRequired] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [options, setOptions] = useState<EventFinanceOption[]>([])
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [entryType, setEntryType] = useState<EventFinanceEntryType>('Expense')
  const [entryCategory, setEntryCategory] = useState('')
  const [entryDescriptionEn, setEntryDescriptionEn] = useState('')
  const [entryDescriptionZh, setEntryDescriptionZh] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryOccurredUtc, setEntryOccurredUtc] = useState(() => new Date().toISOString())
  const [entryDirty, setEntryDirty] = useState(false)
  const [reconciliationEn, setReconciliationEn] = useState('')
  const [reconciliationZh, setReconciliationZh] = useState('')
  const [reconciliationConfirmed, setReconciliationConfirmed] = useState(false)
  const [reconciliationDirty, setReconciliationDirty] = useState(false)

  useEffect(() => {
    if (!query.data) return
    const data = query.data
    setEnabled(Boolean((data.adultFee ?? 0) > 0 || (data.childFee ?? 0) > 0 || data.options.some((x) => x.extraFee > 0)))
    setCurrency(data.currency || 'NZD')
    setAdultFee(data.adultFee == null ? '' : String(data.adultFee))
    setChildFee(data.childFee == null ? '' : String(data.childFee))
    setPaymentEn(data.paymentInstructions.en)
    setPaymentZh(data.paymentInstructions.zh)
    setRefundEn(data.refundPolicy.en)
    setRefundZh(data.refundPolicy.zh)
    setEvidenceRequired(data.paymentEvidenceRequired)
    setConfirmed(data.leaderConfirmed)
    setOptions(data.options)
    if (!reconciliationDirty) {
      setReconciliationEn(data.reconciliation.notes.en)
      setReconciliationZh(data.reconciliation.notes.zh)
      setReconciliationConfirmed(data.reconciliation.leaderConfirmed)
    }
    setDirty(false)
  }, [query.data, reconciliationDirty])

  useEffect(() => {
    const hasUnsavedChanges = dirty || entryDirty || reconciliationDirty
    setUnsavedChangesGuard(hasUnsavedChanges, chinese ? '还有未保存的费用或对账内容，确定离开吗？' : 'Finance or reconciliation changes are not saved. Leave this page?', 'confirm')
    if (!hasUnsavedChanges) return () => setUnsavedChangesGuard(false)
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); setUnsavedChangesGuard(false) }
  }, [chinese, dirty, entryDirty, reconciliationDirty])

  const change = (apply: () => void) => { apply(); setDirty(true); setMessage(''); setConfirmed(false) }
  const mutation = useMutation({
    mutationFn: () => eventFinanceService.updateSettings(eventId, {
      enabled, currency, adultFee: optionalNumber(adultFee), childFee: optionalNumber(childFee),
      paymentInstructionsEn: paymentEn, paymentInstructionsZh: paymentZh,
      refundPolicyEn: refundEn, refundPolicyZh: refundZh,
      paymentEvidenceRequired: evidenceRequired, leaderConfirmed: confirmed,
      options: options.map((x) => ({ id: x.id, nameEn: x.name.en, nameZh: x.name.zh, extraFee: x.extraFee })),
    }),
    onSuccess: () => { setDirty(false); setMessage(chinese ? '费用设置已保存，主流程状态已重新计算。' : 'Finance settings saved and the plan was recalculated.') },
  })
  const resetEntryForm = () => {
    setEditingEntryId(null); setEntryType('Expense'); setEntryCategory(''); setEntryDescriptionEn(''); setEntryDescriptionZh('')
    setEntryAmount(''); setEntryOccurredUtc(new Date().toISOString()); setEntryDirty(false)
  }
  const editEntry = (entry: EventFinanceEntry) => {
    setEditingEntryId(entry.id); setEntryType(entry.type); setEntryCategory(entry.category)
    setEntryDescriptionEn(entry.description.en); setEntryDescriptionZh(entry.description.zh)
    setEntryAmount(String(entry.amount)); setEntryOccurredUtc(entry.occurredUtc); setEntryDirty(false); setMessage('')
    window.requestAnimationFrame(() => document.getElementById('actual-finance-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
  const entryMutation = useMutation({
    mutationFn: () => eventFinanceService.saveEntry(eventId, {
      type: entryType, category: entryCategory, descriptionEn: entryDescriptionEn,
      descriptionZh: entryDescriptionZh, amount: Number(entryAmount), occurredUtc: entryOccurredUtc,
    }, editingEntryId),
    onSuccess: () => { resetEntryForm(); setMessage(chinese ? '实际收支已保存；此前的对账和结项确认需要重新确认。' : 'Actual finance saved. Previous reconciliation and closure confirmation now require confirmation again.') },
  })
  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => eventFinanceService.deleteEntry(eventId, entryId),
    onSuccess: () => { resetEntryForm(); setMessage(chinese ? '实际收支记录已删除，对账状态已重置。' : 'Actual entry removed and reconciliation reset.') },
  })
  const reconciliationMutation = useMutation({
    mutationFn: () => eventFinanceService.reconcile(eventId, {
      notesEn: reconciliationEn, notesZh: reconciliationZh, leaderConfirmed: reconciliationConfirmed,
    }),
    onSuccess: (record) => {
      setReconciliationEn(record.notes.en); setReconciliationZh(record.notes.zh)
      setReconciliationConfirmed(record.leaderConfirmed); setReconciliationDirty(false)
      setMessage(record.leaderConfirmed ? (chinese ? '实际收支已经负责人确认，可用于活动结项。' : 'Actual finances reconciled and ready for closure.') : (chinese ? '对账说明草稿已保存。' : 'Reconciliation notes saved as a draft.'))
    },
  })

  if (query.isLoading) return <AppPageShell><p className="py-12 text-sm text-slate-600">{chinese ? '正在打开费用工作区…' : 'Opening finance workspace…'}</p></AppPageShell>
  if (query.error || !query.data) {
    const error = normalizeApiError(query.error)
    return <AppPageShell><section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-black text-amber-950">{error.status === 409 ? (chinese ? '这项活动还没有加入费用管理' : 'Finance is not in this event yet') : (chinese ? '无法打开费用工作区' : 'Unable to open finance workspace')}</h1><p className="mt-2 text-sm leading-6 text-amber-800">{error.status === 409 ? (chinese ? '请先回到活动设置，在“按需筹备”中加入费用；加入后再设置收费、实际收支和对账。' : 'Return to event settings and add Finance under optional preparation before setting charges, actual entries and reconciliation.') : error.message}</p><Link to={`${eventBasePath}/edit?step=setup#event-module-selector`} className="mt-5 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white">{chinese ? '返回活动设置' : 'Back to event settings'}</Link></section></AppPageShell>
  }
  const workspace = query.data
  const title = chinese ? workspace.titleZh || workspace.titleEn : workspace.titleEn || workspace.titleZh
  const ready = workspace.status === 'Ready'
  const entryAmountValue = Number(entryAmount)
  const entryOccurredTime = Date.parse(entryOccurredUtc)
  const entryValid = entryCategory.trim().length > 0
    && entryDescriptionEn.trim().length > 0
    && entryDescriptionZh.trim().length > 0
    && Number.isFinite(entryAmountValue) && entryAmountValue > 0
    && Number.isFinite(entryOccurredTime) && entryOccurredTime <= Date.now() + 5 * 60_000
  const money = (value: number) => new Intl.NumberFormat(chinese ? 'zh-CN' : 'en-NZ', { style: 'currency', currency: workspace.currency || 'NZD' }).format(value)

  return <AppPageShell>
    <nav aria-label={chinese ? '当前位置' : 'Breadcrumb'} className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#687a73]"><Link to={`${eventBasePath}?section=workflow`} className="inline-flex items-center gap-2 hover:text-[#123d34]"><ArrowLeft className="h-4 w-4" />{chinese ? '活动流程' : 'Event plan'}</Link><ChevronRight className="h-4 w-4 text-[#a2ada8]" /><span className="text-[#123d34]">{chinese ? '费用管理' : 'Finance'}</span></nav>
    <header className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#123d34_0%,#176b5a_58%,#2c6079_100%)] px-6 py-7 text-white shadow-[0_24px_60px_rgba(18,61,52,0.18)] sm:px-8 sm:py-9"><div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/[0.035]" /><div className="relative flex flex-wrap items-end justify-between gap-5"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '按需筹备 · 费用' : 'Optional preparation · Finance'}</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{title}</h1><p className="mt-3 text-sm leading-6 text-emerald-50/80">{chinese ? '先决定是否向参加者收费；活动实际收入、支出和对账在举办后记录，两部分不会互相覆盖。' : 'First decide whether participants are charged. Actual income, expenses and reconciliation are recorded after delivery; the two areas do not overwrite each other.'}</p></div><AppBadge variant={ready ? 'success' : workspace.status === 'Blocked' ? 'warning' : 'neutral'}>{ready ? (chinese ? '已经就绪' : 'Ready') : (chinese ? '正在设置' : 'In progress')}</AppBadge></div></header>

    <article className="overflow-hidden rounded-[2rem] border border-[#2f4b42]/10 bg-white shadow-[0_24px_65px_rgba(31,56,48,0.08)]"><div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]"><div>
      <section className="p-5 sm:p-7 lg:p-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">01</p><h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">{chinese ? '参加者收费设置' : 'Participant charge settings'}</h2><label className="mt-5 flex items-start gap-3 rounded-xl bg-[#f3f6f3] p-4"><input type="checkbox" checked={enabled} onChange={(e) => change(() => setEnabled(e.target.checked))} className="mt-1 h-4 w-4 accent-[#176b5a]" /><span><span className="block text-sm font-black text-[#18332d]">{chinese ? '需要向参加者收费' : 'Charge participants for this event'}</span><span className="mt-1 block text-xs leading-5 text-[#687a73]">{chinese ? '关闭只代表不向参加者收费；实际收入、支出、报销和活动后对账仍保留。' : 'Turning this off means participants are not charged. Actual income, expenses, reimbursements and post-event reconciliation remain available.'}</span></span></label>
        {enabled ? <div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-sm font-bold text-slate-700">{chinese ? '币种' : 'Currency'}<input value={currency} maxLength={3} onChange={(e) => change(() => setCurrency(e.target.value.toUpperCase()))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-bold text-slate-700">{chinese ? '成人费用' : 'Adult fee'}<input type="number" min={0} step="0.01" value={adultFee} onChange={(e) => change(() => setAdultFee(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-bold text-slate-700">{chinese ? '儿童费用' : 'Child fee'}<input type="number" min={0} step="0.01" value={childFee} onChange={(e) => change(() => setChildFee(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label></div> : null}
      </section>
      {enabled ? <section className="border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">02</p><h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">{chinese ? '付款和退款说明' : 'Payment and refund information'}</h2><p className="mt-2 text-sm leading-6 text-[#687a73]">{chinese ? '两种语言都要核对，避免成员收到不同规则。' : 'Check both languages so members receive the same rules.'}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">付款说明 · 中文<textarea rows={4} value={paymentZh} onChange={(e) => change(() => setPaymentZh(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Payment instructions · English<textarea rows={4} value={paymentEn} onChange={(e) => change(() => setPaymentEn(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">退款规则 · 中文<textarea rows={4} value={refundZh} onChange={(e) => change(() => setRefundZh(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Refund policy · English<textarea rows={4} value={refundEn} onChange={(e) => change(() => setRefundEn(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label></div><label className="mt-4 flex items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={evidenceRequired} onChange={(e) => change(() => setEvidenceRequired(e.target.checked))} className="accent-[#176b5a]" />{chinese ? '报名时要求上传付款凭证' : 'Require payment evidence during registration'}</label></section> : null}
      {enabled ? <section className="border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">03</p><h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">{chinese ? '可选收费项目' : 'Optional charged items'}</h2></div><button type="button" onClick={() => change(() => setOptions((items) => [...items, { id: optionId(), name: { en: '', zh: '' }, extraFee: 0 }]))} className="inline-flex items-center gap-1 rounded-lg bg-[#18332d] px-3 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" />{chinese ? '添加' : 'Add'}</button></div><div className="mt-5 divide-y divide-[#2f4b42]/10">{options.map((option) => <div key={option.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_1fr_8rem_auto]"><input aria-label="中文名称" value={option.name.zh} placeholder="中文名称" onChange={(e) => change(() => setOptions((items) => items.map((x) => x.id === option.id ? { ...x, name: { ...x.name, zh: e.target.value } } : x)))} className="rounded-lg border border-slate-300 px-3 py-2" /><input aria-label="English name" value={option.name.en} placeholder="English name" onChange={(e) => change(() => setOptions((items) => items.map((x) => x.id === option.id ? { ...x, name: { ...x.name, en: e.target.value } } : x)))} className="rounded-lg border border-slate-300 px-3 py-2" /><input aria-label="Extra fee" type="number" min={0} step="0.01" value={option.extraFee} onChange={(e) => change(() => setOptions((items) => items.map((x) => x.id === option.id ? { ...x, extraFee: Number(e.target.value) } : x)))} className="rounded-lg border border-slate-300 px-3 py-2" /><button type="button" aria-label={chinese ? '删除项目' : 'Remove option'} onClick={() => change(() => setOptions((items) => items.filter((x) => x.id !== option.id)))} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></div>)}</div></section> : null}
    </div><aside className="border-t border-[#2f4b42]/10 bg-[#f6f8f5] lg:border-l lg:border-t-0">
      <section className="p-5 sm:p-7 lg:p-8"><h2 className="font-black text-[#18332d]">{chinese ? '负责人确认' : 'Leader confirmation'}</h2><label className="mt-4 flex items-start gap-3"><input type="checkbox" checked={confirmed} onChange={(e) => { setConfirmed(e.target.checked); setDirty(true); setMessage('') }} className="mt-1 h-4 w-4 accent-[#176b5a]" /><span className="text-sm leading-6 text-[#52645d]">{enabled ? (chinese ? '我已核对收费、付款和退款规则，并确认可以向成员使用。' : 'I checked the charges, payment instructions and refund rules and confirm they can be used with members.') : (chinese ? '我已确认本次不向参加者收费，但仍会记录实际收入、支出和对账结果。' : 'I confirm participants are not charged, while actual income, expenses and reconciliation will still be recorded.')}</span></label><p className="mt-3 text-xs leading-5 text-violet-800"><Bot className="mr-1 inline h-4 w-4" />{chinese ? '这项确认只能由负责人完成。' : 'Only the leader can make this confirmation.'}</p>{enabled ? <div className="mt-5"><EventModuleSuggestionsPanel eventId={eventId} module="finance" language={language} onApply={(suggestion) => change(() => {
        if (suggestion.key === 'currency') setCurrency(suggestion.value)
        if (suggestion.key === 'paymentInstructionsZh') setPaymentZh(suggestion.value)
        if (suggestion.key === 'paymentInstructionsEn') setPaymentEn(suggestion.value)
        if (suggestion.key === 'refundPolicyZh') setRefundZh(suggestion.value)
        if (suggestion.key === 'refundPolicyEn') setRefundEn(suggestion.value)
        if (suggestion.key === 'paymentEvidenceRequired') setEvidenceRequired(suggestion.value === 'true')
      })} formatValue={(suggestion) => suggestion.key === 'paymentEvidenceRequired'
        ? (suggestion.value === 'true' ? (chinese ? '报名时收集付款凭证' : 'Collect payment evidence during registration') : (chinese ? '不要求上传付款凭证' : 'Do not require payment evidence'))
        : suggestion.value} /></div> : null}</section>
      <section className="border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8"><h2 className="font-black text-[#18332d]">{chinese ? '付款凭证概览' : 'Payment evidence overview'}</h2><dl className="mt-4 divide-y divide-[#2f4b42]/10"><div className="flex items-baseline justify-between py-3"><dt className="text-sm text-[#687a73]">{chinese ? '已提交报名' : 'Submissions'}</dt><dd className="text-2xl font-black text-[#18332d]">{workspace.evidenceSubmissionCount}</dd></div><div className="flex items-baseline justify-between py-3"><dt className="text-sm text-[#687a73]">{chinese ? '凭证文件' : 'Evidence files'}</dt><dd className="text-2xl font-black text-[#18332d]">{workspace.evidenceFileCount}</dd></div></dl><p className="mt-3 text-xs leading-5 text-amber-800">{chinese ? '这里不显示文件地址。只有活动负责人可在受保护的报名记录中办理凭证。' : 'File URLs are not shown here. Leaders handle evidence only in protected registration records.'}</p>{workspace.evidenceSummaries.length ? <ul className="mt-3 divide-y divide-[#2f4b42]/10">{workspace.evidenceSummaries.map((x) => <li key={x.enrollmentId} className="flex items-center justify-between py-3 text-sm"><span className="font-bold text-[#18332d]">{x.applicantName || (chinese ? '未填写姓名' : 'Name unavailable')}</span><span className="inline-flex items-center gap-1 text-[#687a73]"><FileCheck2 className="h-4 w-4" />{x.fileCount}</span></li>)}</ul> : null}</section>
    </aside></div>
      <footer className="flex justify-end border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8"><button type="button" disabled={mutation.isPending || !dirty || (enabled && currency.trim().length !== 3)} onClick={() => mutation.mutate()} className="inline-flex items-center gap-2 rounded-xl bg-[#176b5a] px-5 py-3 text-sm font-black text-white shadow-[0_10px_25px_rgba(23,107,90,0.2)] disabled:opacity-45"><Save className="h-4 w-4" />{mutation.isPending ? (chinese ? '正在保存…' : 'Saving…') : (chinese ? '保存费用设置' : 'Save finance settings')}</button></footer>
    </article>

    <section id="actual-finance" className="scroll-mt-24" aria-labelledby="actual-finance-title">
      <div className="mb-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">{chinese ? '活动执行与结项' : 'Delivery and closure'}</p><h2 id="actual-finance-title" className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#18332d]">{chinese ? '实际收入、支出与对账' : 'Actual income, expenses and reconciliation'}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#687a73]">{chinese ? '这里只记录已经发生的款项，不会改变上面的收费规则。修改实际记录后，原有对账和结项确认会自动失效。' : 'Record only transactions that actually happened. They do not change participant charge rules. Changing an actual entry invalidates prior reconciliation and closure confirmation.'}</p></div>
      <article className="overflow-hidden rounded-[2rem] border border-[#2f4b42]/10 bg-white shadow-[0_24px_65px_rgba(31,56,48,0.08)]">
        <dl className="grid divide-y divide-[#2f4b42]/10 bg-[#f6f8f5] sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="p-5 sm:p-6"><dt className="text-xs font-black uppercase tracking-[0.14em] text-[#718079]">{chinese ? '实际收入' : 'Actual income'}</dt><dd className="mt-2 text-2xl font-black text-emerald-800">{money(workspace.actualIncome)}</dd></div><div className="p-5 sm:p-6"><dt className="text-xs font-black uppercase tracking-[0.14em] text-[#718079]">{chinese ? '实际支出' : 'Actual expense'}</dt><dd className="mt-2 text-2xl font-black text-rose-700">{money(workspace.actualExpense)}</dd></div><div className="p-5 sm:p-6"><dt className="text-xs font-black uppercase tracking-[0.14em] text-[#718079]">{chinese ? '结余' : 'Balance'}</dt><dd className={['mt-2 text-2xl font-black', workspace.actualBalance >= 0 ? 'text-[#18332d]' : 'text-rose-700'].join(' ')}>{money(workspace.actualBalance)}</dd></div></dl>

        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section className="p-5 sm:p-7 lg:p-8"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black text-[#18332d]">{chinese ? '实际收支明细' : 'Actual finance entries'}</h3><WalletCards className="h-5 w-5 text-[#176b5a]" /></div>
          {workspace.actualEntries.length ? <div className="mt-5 divide-y divide-[#2f4b42]/10">{workspace.actualEntries.map((entry) => <article key={entry.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><AppBadge variant={entry.type === 'Income' ? 'success' : 'neutral'}>{entry.type === 'Income' ? (chinese ? '收入' : 'Income') : (chinese ? '支出' : 'Expense')}</AppBadge><span className="text-xs font-bold text-[#718079]">{entry.category}</span></div><p className="mt-2 font-black text-[#18332d]">{chinese ? entry.description.zh || entry.description.en : entry.description.en || entry.description.zh}</p><p className="mt-1 text-xs text-[#718079]">{new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.occurredUtc))}</p></div><p className={['text-xl font-black', entry.type === 'Income' ? 'text-emerald-800' : 'text-rose-700'].join(' ')}>{entry.type === 'Income' ? '+' : '-'}{money(entry.amount)}</p></div><div className="mt-3 flex justify-end gap-3"><button type="button" onClick={() => editEntry(entry)} className="inline-flex items-center gap-1 text-xs font-black text-emerald-800"><Pencil className="h-4 w-4" />{chinese ? '修改' : 'Edit'}</button><button type="button" disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(chinese ? '确定删除这条实际收支记录吗？对账状态会被重置。' : 'Delete this actual finance entry? Reconciliation will be reset.')) deleteMutation.mutate(entry.id) }} className="inline-flex items-center gap-1 text-xs font-black text-rose-700"><Trash2 className="h-4 w-4" />{chinese ? '删除' : 'Delete'}</button></div></article>)}</div> : <p className="mt-5 rounded-xl bg-[#f6f8f5] px-4 py-5 text-sm text-[#718079]">{chinese ? '尚未记录实际收支。如果没有任何款项，活动结束后仍要在对账说明中写明“无实际收支”。' : 'No actual transactions recorded. If none occurred, state “no actual transactions” in reconciliation after the event.'}</p>}
        </section>

        <section className="border-t border-[#2f4b42]/10 bg-[#fafbf9] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8"><h3 className="text-lg font-black text-[#18332d]">{editingEntryId ? (chinese ? '修改收支记录' : 'Edit finance entry') : (chinese ? '添加收支记录' : 'Add finance entry')}</h3>
          <div id="actual-finance-entry-form" className="space-y-4">
            <fieldset><legend className="text-sm font-black text-slate-800">{chinese ? '类型' : 'Type'}</legend><div className="mt-2 grid grid-cols-2 gap-2">{(['Income', 'Expense'] as const).map((type) => <label key={type} className={['cursor-pointer rounded-lg border px-3 py-2 text-sm font-bold', entryType === type ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'].join(' ')}><input type="radio" name="actual-finance-type" value={type} checked={entryType === type} onChange={() => { setEntryType(type); setEntryDirty(true) }} className="mr-2" />{type === 'Income' ? (chinese ? '收入' : 'Income') : (chinese ? '支出' : 'Expense')}</label>)}</div></fieldset>
            <label className="block text-sm font-bold text-slate-700">{chinese ? '类别' : 'Category'}<input list="actual-finance-categories" maxLength={100} value={entryCategory} onChange={(event) => { setEntryCategory(event.target.value); setEntryDirty(true) }} placeholder={chinese ? '例如：场地、交通、奉献' : 'For example: venue, transport, donation'} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /><datalist id="actual-finance-categories"><option value="Participant fees" /><option value="Donations" /><option value="Venue" /><option value="Transport" /><option value="Food" /><option value="Supplies" /><option value="Reimbursement" /><option value="Other" /></datalist></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">说明 · 中文<input maxLength={500} value={entryDescriptionZh} onChange={(event) => { setEntryDescriptionZh(event.target.value); setEntryDirty(true) }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-bold text-slate-700">Description · English<input maxLength={500} value={entryDescriptionEn} onChange={(event) => { setEntryDescriptionEn(event.target.value); setEntryDirty(true) }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">{chinese ? `金额（${workspace.currency}）` : `Amount (${workspace.currency})`}<input type="number" min={0.01} step={0.01} value={entryAmount} onChange={(event) => { setEntryAmount(event.target.value); setEntryDirty(true) }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-bold text-slate-700">{chinese ? '发生时间' : 'Occurred at'}<input type="datetime-local" value={toLocalDateTimeInput(entryOccurredUtc)} onChange={(event) => { setEntryOccurredUtc(fromLocalDateTimeInput(event.target.value)); setEntryDirty(true) }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label></div>
            <div className="flex flex-wrap justify-end gap-3">{editingEntryId ? <button type="button" onClick={resetEntryForm} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">{chinese ? '取消修改' : 'Cancel'}</button> : null}<button type="button" disabled={!entryDirty || !entryValid || entryMutation.isPending} onClick={() => entryMutation.mutate()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{entryMutation.isPending ? (chinese ? '保存中…' : 'Saving…') : editingEntryId ? (chinese ? '保存修改' : 'Save changes') : (chinese ? '添加记录' : 'Add entry')}</button></div>
          </div>
        </section>
      </div>

      <section className="border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8"><h3 className="text-lg font-black text-[#18332d]">{chinese ? '活动后对账' : 'Post-event reconciliation'}</h3><p className="mt-2 text-sm leading-6 text-[#687a73]">{workspace.eventEnded ? (chinese ? '核对所有实际收入和支出；即使没有款项，也要写明“无实际收支”。' : 'Check all actual income and expenses. If none occurred, state that explicitly.') : (chinese ? '可以先写草稿，活动结束后才能由负责人确认。' : 'You may draft notes now; leader confirmation unlocks after the event ends.')}</p>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">对账说明 · 中文<textarea rows={4} maxLength={2000} value={reconciliationZh} onChange={(event) => { setReconciliationZh(event.target.value); setReconciliationDirty(true); setReconciliationConfirmed(false) }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Reconciliation notes · English<textarea rows={4} maxLength={2000} value={reconciliationEn} onChange={(event) => { setReconciliationEn(event.target.value); setReconciliationDirty(true); setReconciliationConfirmed(false) }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label></div>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><label className="flex max-w-2xl items-start gap-3"><input type="checkbox" checked={reconciliationConfirmed} disabled={!workspace.eventEnded} onChange={(event) => { setReconciliationConfirmed(event.target.checked); setReconciliationDirty(true) }} className="mt-1 h-4 w-4" /><span className="text-sm leading-6 text-slate-700">{chinese ? '我已核对以上实际收支和差异，并确认这些记录可以用于活动结项。' : 'I checked the actual entries and variances and confirm they can be used for event closure.'}</span></label><button type="button" disabled={!reconciliationDirty || reconciliationMutation.isPending || (reconciliationConfirmed && (!reconciliationZh.trim() || !reconciliationEn.trim()))} onClick={() => reconciliationMutation.mutate()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{reconciliationMutation.isPending ? (chinese ? '保存中…' : 'Saving…') : reconciliationConfirmed ? (chinese ? '确认对账' : 'Confirm reconciliation') : (chinese ? '保存对账草稿' : 'Save reconciliation draft')}</button></div>
        {workspace.reconciliation.leaderConfirmed ? <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{chinese ? `已由 ${workspace.reconciliation.confirmedByMemberName || '负责人'} 确认` : `Confirmed by ${workspace.reconciliation.confirmedByMemberName || 'a leader'}`}</p> : null}
      </section>
      </article>
    </section>

    {mutation.error || entryMutation.error || deleteMutation.error || reconciliationMutation.error ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{normalizeApiError(mutation.error ?? entryMutation.error ?? deleteMutation.error ?? reconciliationMutation.error).message}</p> : null}{message ? <p className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{message}</p> : null}
  </AppPageShell>
}

export default EventFinanceView
