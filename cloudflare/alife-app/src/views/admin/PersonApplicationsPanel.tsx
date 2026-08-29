import { useCallback, useEffect, useState } from 'react'
import { Search, UserRoundCheck } from 'lucide-react'
import { identityAccessService, type MembershipApplication } from '../../services/identityAccessService'
import { normalizeApiError } from '../../services/http'

const PersonApplicationsPanel = ({ language }: { language: string }) => {
  const zh = language === 'zh'
  const copy = zh ? {
    title: '个人／教会身份申请', description: '只有人工核验并批准后，系统才会关联联系人或建立教会成员身份。任何人都不能审批自己的申请。',
    search: '搜索姓名', all: '全部状态', note: '决定说明', linked: '核验后关联的 Member ID', verified: '我已人工核验申请人的联系方式', approve: '批准教会身份', info: '补充资料', reject: '拒绝', empty: '没有符合条件的身份申请。', previous: '上一页', next: '下一页', deliveryUnavailable: '补充资料短信未能送达，请安排人工联系。',
  } : {
    title: 'Person / church applications', description: 'A contact is linked and church membership is created only after explicit human verification. Nobody may approve their own application.',
    search: 'Search by name', all: 'All statuses', note: 'Decision note', linked: 'Verified existing Member ID', verified: 'I manually verified the applicant’s contact channel', approve: 'Approve church identity', info: 'Request information', reject: 'Reject', empty: 'No person applications match.', previous: 'Previous', next: 'Next', deliveryUnavailable: 'The information-request message was not delivered. Arrange manual follow-up.',
  }
  const [items, setItems] = useState<MembershipApplication[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [links, setLinks] = useState<Record<string, string>>({})
  const [verified, setVerified] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const result = await identityAccessService.listPersonApplications({ status: status || undefined, search: search || undefined, sort: 'newest', page, pageSize: 20 })
    setItems(result.items)
    setTotal(result.total)
  }, [page, search, status])

  useEffect(() => { load().catch((caught) => setError(normalizeApiError(caught).message)) }, [load])

  const decide = async (application: MembershipApplication, decision: 'approved' | 'needsInfo' | 'rejected') => {
    const note = notes[application.id]?.trim() ?? ''
    if (decision === 'needsInfo' && !note) return
    setBusy(application.id)
    setError('')
    try {
      await identityAccessService.decidePersonApplication(application, decision, note || undefined, links[application.id]?.trim(), application.isContactVerified || verified[application.id] === true)
      await load()
    } catch (caught) {
      setError(normalizeApiError(caught).message)
    } finally {
      setBusy('')
    }
  }

  return (
    <details className="border-b border-[#dce7e2] bg-[#f7faf8] px-4 py-4 sm:px-6">
      <summary className="cursor-pointer list-none text-sm font-black text-[#18332d] marker:hidden"><span className="inline-flex items-center"><UserRoundCheck className="mr-2 h-4 w-4 text-[#176b5a]" />{copy.title}</span></summary>
      <p className="mt-2 text-xs leading-5 text-[#687770]">{copy.description}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative"><span className="sr-only">{copy.search}</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="alife-input pl-9" placeholder={copy.search} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
        <select className="alife-input" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">{copy.all}</option><option value="submitted">submitted</option><option value="needsInfo">needsInfo</option><option value="approved">approved</option><option value="rejected">rejected</option></select>
      </div>
      {items.length ? <div className="mt-4 space-y-3">{items.map((application) => <article key={application.id} className="rounded-xl border border-[#dce7e2] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-[#18332d]">{application.displayName}</p><p className="mt-1 text-xs text-[#687770]">{application.maskedPhone} · {application.groupNameEn || application.groupNameZh} · {application.id}</p></div><div className="flex gap-2"><span className="rounded-full bg-[#e3f0eb] px-2 py-1 text-xs font-bold text-[#176b5a]">{application.personStatus}</span><span className="rounded-full bg-[#f1eee7] px-2 py-1 text-xs font-bold text-[#6e655b]">{application.matchState}</span></div></div>{application.responseDeliveryStatus === 'unavailable' || application.responseDeliveryStatus === 'failed' ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900" role="status">{copy.deliveryUnavailable}</p> : null}{!['approved', 'rejected'].includes(application.personStatus) ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold text-[#62736c]">{copy.note}<textarea className="alife-input mt-1 min-h-20 py-2" value={notes[application.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [application.id]: event.target.value }))} /></label>{application.matchState === 'possible' || application.matchState === 'ambiguous' ? <label className="text-xs font-bold text-[#62736c]">{copy.linked}<input className="alife-input mt-1" value={links[application.id] ?? ''} onChange={(event) => setLinks((current) => ({ ...current, [application.id]: event.target.value }))} /></label> : null}<label className="flex items-center gap-2 text-xs font-bold text-[#62736c] sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[#176b5a]" checked={application.isContactVerified || verified[application.id] === true} disabled={application.isContactVerified} onChange={(event) => setVerified((current) => ({ ...current, [application.id]: event.target.checked }))} />{copy.verified}</label><div className="flex flex-wrap gap-2 sm:col-span-2"><button className="min-h-9 rounded-lg bg-[#176b5a] px-3 text-xs font-black text-white disabled:opacity-50" type="button" disabled={busy === application.id || (!application.isContactVerified && verified[application.id] !== true)} onClick={() => void decide(application, 'approved')}>{copy.approve}</button><button className="min-h-9 rounded-lg border border-[#cbdad4] px-3 text-xs font-black disabled:opacity-50" type="button" disabled={busy === application.id || !notes[application.id]?.trim()} onClick={() => void decide(application, 'needsInfo')}>{copy.info}</button><button className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-black text-rose-700 disabled:opacity-50" type="button" disabled={busy === application.id} onClick={() => void decide(application, 'rejected')}>{copy.reject}</button></div></div> : null}</article>)}</div> : <p className="mt-4 text-sm text-[#687770]">{copy.empty}</p>}
      <div className="mt-4 flex items-center justify-between"><button className="min-h-9 rounded-lg border border-[#cbdad4] px-3 text-xs font-bold disabled:opacity-40" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{copy.previous}</button><span className="text-xs text-[#687770]">{page} / {Math.max(1, Math.ceil(total / 20))}</span><button className="min-h-9 rounded-lg border border-[#cbdad4] px-3 text-xs font-bold disabled:opacity-40" type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>{copy.next}</button></div>
      {error ? <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p> : null}
    </details>
  )
}

export default PersonApplicationsPanel
