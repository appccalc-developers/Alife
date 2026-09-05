import { useCallback, useEffect, useState } from 'react'
import { Download, Pause, Play, Printer, QrCode, RefreshCw, Search, ShieldX } from 'lucide-react'
import QRCode from 'qrcode'
import { identityAccessService, type GroupJoinInvite, type ManualActivationMessage, type MembershipApplication } from '../../services/identityAccessService'
import { normalizeApiError } from '../../services/http'
import ManualActivationMessageModal from '../identity/ManualActivationMessageModal'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AppEmptyState from '../layout/AppEmptyState'

type Props = {
  groupId: string
  language: string
}

const GroupApplicationsPanel = ({ groupId, language }: Props) => {
  const zh = language === 'zh'
  const copy = zh ? {
    title: '入组申请', subtitle: '手机号选填。组长现场核实本人并核对申请编号后批准；申请人可在原浏览器接续建立 Passkey。',
    qrTitle: '当前申请二维码', qrEmpty: '尚未建立二维码。', generate: '生成二维码', pause: '暂停', resume: '恢复', rotate: '轮换', revoke: '撤销',
    downloadPng: '下载 PNG', downloadSvg: '下载 SVG', print: '打印', expires: '有效期至', submissions: '提交数',
    applications: '待处理申请', search: '搜索姓名', allStatuses: '全部状态', newest: '最新优先', oldest: '最早优先',
    noApplications: '没有符合条件的申请。', approve: '确认身份并批准', needsInfo: '补充资料', reject: '拒绝', note: '决定说明（补充资料时必填）', verified: '我已现场核实本人，并核对其手机上的申请编号', deliveryUnavailable: '补充资料通知未能送达；状态已保留，请改用人工联系。', activationReady: '申请人可在原浏览器查看审批结果并建立 Passkey；无法接续时请从成员名单提供个人二维码。', activationPending: '成员身份已批准，但旧邀请尚未交付；请在成员管理生成新消息。',
    previous: '上一页', next: '下一页', security: 'selector 不包含小组 ID；fragment 中的签名只在浏览器中用于安全解析。',
  } : {
    title: 'Membership applications', subtitle: 'Phone numbers are optional. A leader verifies the person in person and checks their application reference before approval; applicants can then continue Passkey setup in the original browser.',
    qrTitle: 'Current application QR', qrEmpty: 'No QR code has been created.', generate: 'Generate QR', pause: 'Pause', resume: 'Resume', rotate: 'Rotate', revoke: 'Revoke',
    downloadPng: 'Download PNG', downloadSvg: 'Download SVG', print: 'Print', expires: 'Expires', submissions: 'Submissions',
    applications: 'Applications', search: 'Search by name', allStatuses: 'All statuses', newest: 'Newest first', oldest: 'Oldest first',
    noApplications: 'No applications match these filters.', approve: 'Verify identity and approve', needsInfo: 'Request information', reject: 'Reject', note: 'Decision note (required when requesting information)', verified: 'I verified this person in person and checked the application reference on their phone', deliveryUnavailable: 'The information request was not delivered. The state is preserved for manual follow-up.', activationReady: 'The applicant can check approval in the original browser and create a Passkey. If they cannot resume, provide a personal QR from the member list.', activationPending: 'Membership was approved, but the old invitation was not delivered. Generate a new message in member management.',
    previous: 'Previous', next: 'Next', security: 'The selector contains no group ID; the fragment signature grants browser-only resolution.',
  }
  const [invite, setInvite] = useState<GroupJoinInvite | null>(null)
  const [pngUrl, setPngUrl] = useState('')
  const [svg, setSvg] = useState('')
  const [items, setItems] = useState<MembershipApplication[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [verified, setVerified] = useState<Record<string, boolean>>({})
  const [links, setLinks] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [manualActivationMessage, setManualActivationMessage] = useState<ManualActivationMessage | null>(null)

  const loadApplications = useCallback(async () => {
    const result = await identityAccessService.listGroupApplications(groupId, { status: status || undefined, search: search || undefined, sort, page, pageSize: 20 })
    setItems(result.items)
    setTotal(result.total)
  }, [groupId, page, search, sort, status])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      identityAccessService.getGroupInvite(groupId).catch((caught) => normalizeApiError(caught).status === 404 ? null : Promise.reject(caught)),
      identityAccessService.listGroupApplications(groupId, { status: status || undefined, search: search || undefined, sort, page, pageSize: 20 }),
    ]).then(([currentInvite, result]) => {
      if (!active) return
      setInvite(currentInvite)
      setItems(result.items)
      setTotal(result.total)
    }).catch((caught) => { if (active) setError(normalizeApiError(caught).message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [groupId, page, search, sort, status])

  useEffect(() => {
    const url = invite?.joinUrl
    if (!url || invite?.status !== 'active') {
      setPngUrl('')
      setSvg('')
      return
    }
    Promise.all([
      QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#18332d', light: '#fffdf8' } }),
      QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#18332d', light: '#fffdf8' } }),
    ]).then(([png, svgValue]) => { setPngUrl(png); setSvg(svgValue) }).catch(() => setError('qr_render_failed'))
  }, [invite])

  const changeInvite = async (action: 'pause' | 'resume' | 'revoke' | 'rotate') => {
    setBusy(`invite-${action}`)
    setError('')
    try {
      setInvite(await identityAccessService.changeGroupInvite(groupId, action))
    } catch (caught) {
      setError(normalizeApiError(caught).message)
    } finally {
      setBusy('')
    }
  }

  const decide = async (application: MembershipApplication, decision: 'approved' | 'needsInfo' | 'rejected') => {
    const note = notes[application.id]?.trim() ?? ''
    if (decision === 'needsInfo' && !note) return
    setBusy(application.id)
    setError('')
    try {
      const result = await identityAccessService.decideGroupApplication(
        groupId,
        application,
        decision,
        note || undefined,
        application.isIdentityVerified || verified[application.id] === true,
        links[application.id]?.trim() || undefined,
      )
      if (result.manualActivationMessage) setManualActivationMessage(result.manualActivationMessage)
      await loadApplications()
    } catch (caught) {
      setError(normalizeApiError(caught).message)
    } finally {
      setBusy('')
    }
  }

  const downloadSvg = () => {
    if (!svg) return
    const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `alife-group-join-${groupId}.svg`
    anchor.click()
    URL.revokeObjectURL(href)
  }

  const activeQr = invite?.status === 'active' && pngUrl

  return (
    <section className="space-y-6">
      <header><h2 className="text-lg font-black text-[#18332d]">{copy.title}</h2><p className="mt-1 text-sm leading-6 text-[#66766f]">{copy.subtitle}</p></header>
      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="rounded-2xl border border-[#2f4b42]/10 bg-[#f7faf8] p-4 print:border-0 print:bg-white" aria-labelledby="join-qr-heading">
          <div className="flex items-center justify-between gap-3 print:hidden"><h3 id="join-qr-heading" className="font-black text-[#18332d]">{copy.qrTitle}</h3>{invite ? <AppBadge variant={invite.status === 'active' ? 'success' : 'neutral'}>{invite.status}</AppBadge> : null}</div>
          {activeQr ? <img className="mx-auto mt-4 aspect-square w-full max-w-72 rounded-xl bg-white p-2" src={pngUrl} alt={zh ? '小组申请二维码' : 'Group application QR code'} /> : <div className="mt-4"><AppEmptyState title={copy.qrEmpty} description={invite?.status ?? ''} /></div>}
          {invite ? <p className="mt-3 text-center text-xs text-slate-500">{copy.expires}: {new Date(invite.expiresUtc).toLocaleDateString()} · {copy.submissions}: {invite.submissionCount}</p> : null}
          <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600 print:hidden">{copy.security}</p>
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {!invite || !['active', 'paused'].includes(invite.status) ? <AppActionButton variant="primary" onClick={() => void identityAccessService.generateGroupInvite(groupId).then(setInvite).catch((caught) => setError(normalizeApiError(caught).message))}><QrCode className="mr-1.5 h-4 w-4" />{copy.generate}</AppActionButton> : null}
            {invite?.status === 'active' ? <AppActionButton disabled={Boolean(busy)} onClick={() => void changeInvite('pause')}><Pause className="mr-1.5 h-4 w-4" />{copy.pause}</AppActionButton> : null}
            {invite?.status === 'paused' ? <AppActionButton disabled={Boolean(busy)} onClick={() => void changeInvite('resume')}><Play className="mr-1.5 h-4 w-4" />{copy.resume}</AppActionButton> : null}
            {invite && ['active', 'paused'].includes(invite.status) ? <><AppActionButton disabled={Boolean(busy)} onClick={() => void changeInvite('rotate')}><RefreshCw className="mr-1.5 h-4 w-4" />{copy.rotate}</AppActionButton><AppActionButton variant="danger" disabled={Boolean(busy)} onClick={() => void changeInvite('revoke')}><ShieldX className="mr-1.5 h-4 w-4" />{copy.revoke}</AppActionButton></> : null}
            {activeQr ? <><a className="alife-secondary-button" href={pngUrl} download={`alife-group-join-${groupId}.png`}><Download className="h-4 w-4" />{copy.downloadPng}</a><AppActionButton onClick={downloadSvg}><Download className="mr-1.5 h-4 w-4" />{copy.downloadSvg}</AppActionButton><AppActionButton onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />{copy.print}</AppActionButton></> : null}
          </div>
        </section>

        <section className="min-w-0 print:hidden" aria-labelledby="applications-heading">
          <h3 id="applications-heading" className="font-black text-[#18332d]">{copy.applications}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="relative"><span className="sr-only">{copy.search}</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="alife-input pl-9" value={search} placeholder={copy.search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
            <select className="alife-input" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">{copy.allStatuses}</option><option value="submitted">submitted</option><option value="needsInfo">needsInfo</option><option value="approvedWaitingForChurch">approvedWaitingForChurch</option><option value="approved">approved</option><option value="rejected">rejected</option></select>
            <select className="alife-input" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">{copy.newest}</option><option value="oldest">{copy.oldest}</option></select>
          </div>
          {loading ? <p className="mt-4 text-sm text-slate-500">…</p> : items.length ? <div className="mt-4 space-y-3">{items.map((application) => <article key={application.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{application.displayName}</p><p className="mt-1 text-xs text-slate-500">{application.id}<br />{application.maskedPhone} · {new Date(application.submittedUtc).toLocaleString()}</p></div><div className="flex flex-wrap gap-2"><AppBadge variant="neutral">{application.personStatus}</AppBadge><AppBadge variant={application.status === 'approved' ? 'success' : 'neutral'}>{application.status}</AppBadge></div></div><p className="mt-3 text-sm leading-6 text-slate-700">{application.declaration}</p>{['unavailable', 'failed'].includes(application.responseDeliveryStatus ?? '') ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900" role="status">{copy.deliveryUnavailable}</p> : null}{['manual', 'sent'].includes(application.activationDeliveryStatus ?? '') ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-900" role="status">{copy.activationReady}</p> : ['unavailable', 'failed', 'pending'].includes(application.activationDeliveryStatus ?? '') ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900" role="status">{copy.activationPending}</p> : null}{['submitted', 'needsInfo', 'approvedWaitingForChurch'].includes(application.status) ? <div className="mt-4 space-y-3 border-t border-slate-100 pt-3"><label className="block text-xs font-bold text-slate-600">{copy.note}<textarea className="alife-input mt-1 min-h-20 py-2" value={notes[application.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [application.id]: event.target.value }))} /></label><label className="block text-xs font-bold text-slate-600">{language === 'zh' ? '关联已有成员编号（选填，仅在核实已有账号后填写）' : 'Existing member ID (optional; only after verifying the existing account)'}<input className="alife-input mt-1" value={links[application.id] ?? ''} onChange={(event) => setLinks(current => ({ ...current, [application.id]: event.target.value }))} /></label><label className="flex min-h-11 items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold leading-5 text-emerald-900"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#176b5a]" checked={application.isIdentityVerified || verified[application.id] === true} disabled={application.isIdentityVerified} onChange={(event) => setVerified((current) => ({ ...current, [application.id]: event.target.checked }))} />{copy.verified}</label><div className="flex flex-wrap gap-2"><AppActionButton size="sm" variant="primary" disabled={busy === application.id || (!application.isIdentityVerified && verified[application.id] !== true)} onClick={() => void decide(application, 'approved')}>{copy.approve}</AppActionButton><AppActionButton size="sm" disabled={busy === application.id || !(notes[application.id]?.trim())} onClick={() => void decide(application, 'needsInfo')}>{copy.needsInfo}</AppActionButton><AppActionButton size="sm" variant="danger" disabled={busy === application.id} onClick={() => void decide(application, 'rejected')}>{copy.reject}</AppActionButton></div></div> : null}</article>)}</div> : <div className="mt-4"><AppEmptyState title={copy.noApplications} description="" /></div>}
          <div className="mt-4 flex items-center justify-between"><AppActionButton size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{copy.previous}</AppActionButton><span className="text-xs text-slate-500">{page} / {Math.max(1, Math.ceil(total / 20))}</span><AppActionButton size="sm" disabled={page * 20 >= total} onClick={() => setPage((current) => current + 1)}>{copy.next}</AppActionButton></div>
        </section>
      </div>
      {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
      <ManualActivationMessageModal value={manualActivationMessage} language={language} onClose={() => setManualActivationMessage(null)} />
    </section>
  )
}

export default GroupApplicationsPanel
