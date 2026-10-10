import { personApplicationsPanelText } from '../../i18n/personApplicationsPanel.ts'
import { identityWorkflowError } from '../../services/identityWorkflowError'
import RecoveryMemberSelect from '../../components/identity/RecoveryMemberSelect'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Search, UserRoundCheck } from 'lucide-react'
import { identityAccessService, type MembershipApplication, type ManualActivationMessage } from '../../services/identityAccessService'
import { normalizeApiError } from '../../services/http'
import ManualActivationMessageModal from '../../components/identity/ManualActivationMessageModal'

const PersonApplicationsPanel = ({ language }: { language: string }) => {
  const zh = language === 'zh'
  const copy = zh ? { ...personApplicationsPanelText.localizedCopy.zh } : { ...personApplicationsPanelText.localizedCopy.en }
  const [items, setItems] = useState<MembershipApplication[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('submitted')
  const [sort, setSort] = useState('newest')
  const [expanded, setExpanded] = useState('')
  const [loading, setLoading] = useState(true)
  const [manualMessage, setManualMessage] = useState<ManualActivationMessage | null>(null)
  const loadVersion = useRef(0)
  const summaryRef = useRef<HTMLElement>(null)
  const statusLabel = (value: string) => ({ submitted: zh ? personApplicationsPanelText.pendingApproval.zh : personApplicationsPanelText.pendingApproval.en, needsInfo: zh ? personApplicationsPanelText.needsInformation.zh : personApplicationsPanelText.needsInformation.en, approved: zh ? personApplicationsPanelText.approved.zh : personApplicationsPanelText.approved.en, rejected: zh ? personApplicationsPanelText.rejected.zh : personApplicationsPanelText.rejected.en }[value] || value)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [links, setLinks] = useState<Record<string, string>>({})
  const [verified, setVerified] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const version = ++loadVersion.current
    setLoading(true); setError('')
    try {
      const result = await identityAccessService.listPersonApplications({ status: status || undefined, search: search || undefined, sort, page, pageSize: 20 })
      if (version === loadVersion.current) { setItems(result.items); setTotal(result.total) }
    } catch (caught) { if (version === loadVersion.current) setError(normalizeApiError(caught).message) }
    finally { if (version === loadVersion.current) setLoading(false) }
  }, [page, search, status, sort])

  useEffect(() => { void load(); return () => { loadVersion.current++ } }, [load])

  const decide = async (application: MembershipApplication, decision: 'approved' | 'needsInfo' | 'rejected') => {
    const note = notes[application.id]?.trim() ?? ''
    if (decision === 'needsInfo' && !note) return
    setBusy(application.id)
    setError('')
    try {
      const result = await identityAccessService.decidePersonApplication(application, decision, note || undefined, links[application.id]?.trim(), application.isIdentityVerified || verified[application.id] === true)
      if (result.manualActivationMessage) setManualMessage(result.manualActivationMessage)
      await load()
    } catch (caught) {
      setError(identityWorkflowError(caught, language))
    } finally {
      setBusy('')
    }
  }

  return (
    <details open className="border-b border-[#dce7e2] bg-[#f7faf8] px-4 py-4 sm:px-6">
      <summary ref={summaryRef} className="cursor-pointer list-none text-sm font-black text-[#18332d] marker:hidden"><span className="inline-flex items-center"><UserRoundCheck className="mr-2 h-4 w-4 text-[#176b5a]" />{copy.title}</span></summary>
      <p className="mt-2 text-xs leading-5 text-[#687770]">{copy.description}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="relative"><span className="sr-only">{copy.search}</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="alife-input pl-9" placeholder={copy.search} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
        <select aria-label={zh ? personApplicationsPanelText.applicationStatus.zh : personApplicationsPanelText.applicationStatus.en} className="alife-input" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">{copy.all}</option><option value="submitted">{statusLabel('submitted')}</option><option value="needsInfo">{statusLabel('needsInfo')}</option><option value="approved">{statusLabel('approved')}</option><option value="rejected">{statusLabel('rejected')}</option></select>
        <select aria-label={zh ? personApplicationsPanelText.sort.zh : personApplicationsPanelText.sort.en} className="alife-input" value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}><option value="newest">{zh ? personApplicationsPanelText.newestFirst.zh : personApplicationsPanelText.newestFirst.en}</option><option value="oldest">{zh ? personApplicationsPanelText.oldestFirst.zh : personApplicationsPanelText.oldestFirst.en}</option></select>
      </div>
      {loading ? <p role="status" className="mt-4 text-sm">{zh ? personApplicationsPanelText.loadingApplications.zh : personApplicationsPanelText.loadingApplications.en}</p> : items.length ? <div className="mt-4 overflow-x-auto rounded-xl border border-[#dce7e2]"><table className="w-full text-left text-sm">
        <thead className="bg-[#e3f0eb] text-[#18332d]"><tr><th className="p-3">{zh ? personApplicationsPanelText.name.zh : personApplicationsPanelText.name.en}</th><th className="p-3">{zh ? personApplicationsPanelText.status.zh : personApplicationsPanelText.status.en}</th><th className="p-3">{zh ? personApplicationsPanelText.submitted.zh : personApplicationsPanelText.submitted.en}</th><th className="p-3">{zh ? personApplicationsPanelText.details.zh : personApplicationsPanelText.details.en}</th></tr></thead>
        <tbody>{items.map(application => <Fragment key={application.id}>
          <tr className="border-t border-[#dce7e2] bg-white"><td className="p-3 font-bold">{application.displayName}</td><td className="p-3">{statusLabel(application.personStatus)}</td><td className="whitespace-nowrap p-3">{new Date(application.submittedUtc).toLocaleDateString(zh ? 'zh-CN' : 'en-NZ')}</td><td className="p-3"><button type="button" className="min-h-11 font-semibold text-[#176b5a]" aria-expanded={expanded === application.id} aria-controls={`application-${application.id}`} onClick={() => setExpanded(expanded === application.id ? '' : application.id)}>{expanded === application.id ? (zh ? personApplicationsPanelText.close.zh : personApplicationsPanelText.close.en) : (zh ? personApplicationsPanelText.review.zh : personApplicationsPanelText.review.en)}</button></td></tr>
          {expanded === application.id ? <tr id={`application-${application.id}`}><td colSpan={4} className="space-y-4 bg-white p-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold">{zh ? personApplicationsPanelText.reference.zh : personApplicationsPanelText.reference.en}</dt><dd className="break-all">{application.id}</dd></div>
              <div><dt className="font-semibold">{zh ? personApplicationsPanelText.sex.zh : personApplicationsPanelText.sex.en}</dt><dd>{application.sex === 'Male' ? (zh ? personApplicationsPanelText.male.zh : personApplicationsPanelText.male.en) : application.sex === 'Female' ? (zh ? personApplicationsPanelText.female.zh : personApplicationsPanelText.female.en) : (zh ? personApplicationsPanelText.notProvidedPrivate.zh : personApplicationsPanelText.notProvidedPrivate.en)}</dd></div>
              <div><dt className="font-semibold">Email</dt><dd className="break-all">{application.email || '—'}</dd></div>
              <div><dt className="font-semibold">{zh ? personApplicationsPanelText.phone.zh : personApplicationsPanelText.phone.en}</dt><dd>{application.maskedPhone || '—'}</dd></div>
              <div><dt className="font-semibold">{zh ? personApplicationsPanelText.contactPreference.zh : personApplicationsPanelText.contactPreference.en}</dt><dd>{application.replyPreference === 'email' ? 'Email' : application.replyPreference === 'sms' ? (zh ? personApplicationsPanelText.sms.zh : personApplicationsPanelText.sms.en) : application.replyPreference}</dd></div>
              <div><dt className="font-semibold">{zh ? personApplicationsPanelText.notificationConsent.zh : personApplicationsPanelText.notificationConsent.en}</dt><dd>{application.notificationConsentedUtc ? `${application.notificationConsentVersion} · ${new Date(application.notificationConsentedUtc).toLocaleString()}` : '—'}</dd></div>
            </dl>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{application.declaration}</p>
            {application.source === 'recoveryQr' || application.source === 'continuationQr' ? <p className="text-sm font-semibold">{application.source === 'recoveryQr' ? (zh ? personApplicationsPanelText.accountRecovery.zh : personApplicationsPanelText.accountRecovery.en) : (zh ? personApplicationsPanelText.continueAnApplication.zh : personApplicationsPanelText.continueAnApplication.en)}</p> : null}
            {application.responseDeliveryStatus === 'unavailable' || application.responseDeliveryStatus === 'failed' ? <p role="status" className="text-sm text-amber-900">{copy.deliveryUnavailable}</p> : null}
            <p className="text-xs text-[#687770]">{application.groupNameEn || application.groupNameZh} · {application.matchState}</p>
            {!['approved', 'rejected'].includes(application.personStatus) ? <div className="grid gap-3 border-t border-[#dce7e2] pt-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">{copy.note}<textarea className="alife-input mt-1 min-h-20 py-2" value={notes[application.id] ?? ''} onChange={event => setNotes(current => ({ ...current, [application.id]: event.target.value }))} /></label>
              <label className="text-sm font-semibold">{application.source === 'continuationQr' ? (zh ? personApplicationsPanelText.originalApplicationReference.zh : personApplicationsPanelText.originalApplicationReference.en) : copy.linked}{application.source === 'recoveryQr' ? <RecoveryMemberSelect groupId={application.groupId} zh={zh} value={links[application.id] ?? ''} onChange={value => setLinks(current => ({ ...current, [application.id]: value }))} /> : <input className="alife-input mt-1" value={links[application.id] ?? ''} onChange={event => setLinks(current => ({ ...current, [application.id]: event.target.value }))} />}</label>
              <label className="flex min-h-11 items-start gap-3 text-sm leading-6 sm:col-span-2"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#176b5a]" checked={application.isIdentityVerified || verified[application.id] === true} disabled={application.isIdentityVerified} onChange={event => setVerified(current => ({ ...current, [application.id]: event.target.checked }))} />{copy.verified}</label>
              <p className="text-xs leading-5 text-[#687770] sm:col-span-2">{zh ? personApplicationsPanelText.afterApprovalCopyTheRegistrationInstructionsAndSendThem.zh : personApplicationsPanelText.afterApprovalCopyTheRegistrationInstructionsAndSendThem.en}</p>
              <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="alife-primary-button" type="button" disabled={busy === application.id || (!application.isIdentityVerified && verified[application.id] !== true)} onClick={() => void decide(application, 'approved')}>{copy.approve}</button><button className="alife-secondary-button" type="button" disabled={busy === application.id || !notes[application.id]?.trim()} onClick={() => void decide(application, 'needsInfo')}>{copy.info}</button><button className="alife-secondary-button text-rose-700" type="button" disabled={busy === application.id} onClick={() => void decide(application, 'rejected')}>{copy.reject}</button></div>
            </div> : null}
          </td></tr> : null}
        </Fragment>)}</tbody>
      </table></div> : !error ? <p className="mt-4 text-sm text-[#687770]">{copy.empty}</p> : null}
      <div className="mt-4 flex items-center justify-between"><button className="min-h-9 rounded-lg border border-[#cbdad4] px-3 text-xs font-bold disabled:opacity-40" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{copy.previous}</button><span className="text-xs text-[#687770]">{page} / {Math.max(1, Math.ceil(total / 20))}</span><button className="min-h-9 rounded-lg border border-[#cbdad4] px-3 text-xs font-bold disabled:opacity-40" type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>{copy.next}</button></div>
      {error ? <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p> : null}
      <ManualActivationMessageModal value={manualMessage} language={language} onClose={() => { setManualMessage(null); requestAnimationFrame(() => summaryRef.current?.focus()) }} />
    </details>
  )
}

export default PersonApplicationsPanel
