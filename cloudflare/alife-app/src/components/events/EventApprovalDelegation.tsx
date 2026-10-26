import { eventApprovalDelegationText } from '../../i18n/eventApprovalDelegation.ts'
import { useCallback, useEffect, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import useConfirmation from '../../hooks/useConfirmation'
import { groupService } from '../../services/groupService'
import { eventPackageDelegationService } from '../../services/eventPackageDelegationService'
import { normalizeApiError } from '../../services/http'
import type { EventPackageApprovalDelegation } from '../../types/eventPackage'
import { eventDelegations, futureDelegationExpiry } from '../../utils/eventActionGuidance'

const field = 'mt-1 min-h-11 w-full min-w-0 rounded-xl border border-[#9aada5] bg-white px-3 py-2 text-sm text-[#18332d] focus:outline-none focus:ring-2 focus:ring-[#176b5a]'
type Member = { id: string; name: string; role: string; approved: boolean }

export default function EventApprovalDelegation({ groupId, eventId, zh, disabled, onBusy, onChanged }: {
  groupId: string; eventId: string; zh: boolean; disabled: boolean; onBusy: (busy: boolean) => void; onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false)
  const [members, setMembers] = useState<Member[]>([]), [items, setItems] = useState<EventPackageApprovalDelegation[]>([])
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [search, setSearch] = useState('')
  const [selected, setSelected] = useState(''), [expires, setExpires] = useState('')
  const [reasons, setReasons] = useState<Record<string, { en: string; zh: string }>>({})
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [memberships, delegations] = await Promise.all([groupService.getGroupMemberships(groupId), eventPackageDelegationService.list(groupId)])
      setMembers(memberships.map(member => ({ id: member.memberId, name: member.displayName?.trim() || '', role: member.role, approved: member.status === 'approved' })))
      setItems(delegations)
    } catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setLoading(false) }
  }, [groupId])
  useEffect(() => { if (open) void load() }, [open, load])
  useEffect(() => { onBusy(busy); return () => onBusy(false) }, [busy, onBusy])
  const selectedMember = members.find(member => member.id === selected && member.approved && member.name)
  const candidates = members.filter(member => member.approved && member.name && (member.id === selected || member.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
  const roleLabel = (role: string) => ({ leader: zh ? eventApprovalDelegationText.leader.zh : eventApprovalDelegationText.leader.en, coLeader: zh ? eventApprovalDelegationText.coLeader.zh : eventApprovalDelegationText.coLeader.en, member: zh ? eventApprovalDelegationText.member.zh : eventApprovalDelegationText.member.en }[role] || (zh ? eventApprovalDelegationText.member.zh : eventApprovalDelegationText.member.en))
  const mutate = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(''); setNotice('')
    try { await action(); await load(); await onChanged(); setNotice(zh ? eventApprovalDelegationText.delegationUpdated.zh : eventApprovalDelegationText.delegationUpdated.en) }
    catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setBusy(false) }
  }
  const grant = async () => {
    if (!selectedMember || !futureDelegationExpiry(expires) || busy || disabled || loading || error) return
    const confirmed = await requestConfirmation({ title: zh ? eventApprovalDelegationText.delegateApprovalTemporarily.zh : eventApprovalDelegationText.delegateApprovalTemporarily.en, description: zh ? eventApprovalDelegationText.delegateThisEventSApprovalToUntilEligibilityAnd.zh(selectedMember.name, new Date(expires).toLocaleString('zh-CN'), timeZone) : eventApprovalDelegationText.delegateThisEventSApprovalToUntilEligibilityAnd.en(selectedMember.name, new Date(expires).toLocaleString('en-NZ'), timeZone), confirmLabel: zh ? eventApprovalDelegationText.confirmDelegation.zh : eventApprovalDelegationText.confirmDelegation.en })
    if (confirmed) await mutate(() => eventPackageDelegationService.grantForEvent(groupId, eventId, selectedMember.id, new Date().toISOString(), new Date(expires).toISOString()))
  }
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="mt-4 rounded-xl border border-[#dce5e0] bg-white p-4">
    <summary className="min-h-11 cursor-pointer font-semibold text-[#18332d]">{zh ? eventApprovalDelegationText.advancedTemporaryApprovalDelegationOptional.zh : eventApprovalDelegationText.advancedTemporaryApprovalDelegationOptional.en}</summary>
    <p className="mt-2 text-sm text-[#40554e]">{zh ? eventApprovalDelegationText.useOnlyWhenAnotherMemberNeedsToReviewOn.zh : eventApprovalDelegationText.useOnlyWhenAnotherMemberNeedsToReviewOn.en}</p>
    {open ? <>
      {loading ? <p role="status" className="mt-3 text-sm">{zh ? eventApprovalDelegationText.loadingVisibleMembersAndDelegations.zh : eventApprovalDelegationText.loadingVisibleMembersAndDelegations.en}</p> : null}
      {error ? <div role="alert" className="mt-3 space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><p>{zh ? eventApprovalDelegationText.unableToLoadOrUpdateRetryOrContactAn.zh : eventApprovalDelegationText.unableToLoadOrUpdateRetryOrContactAn.en}</p><details><summary>{zh ? eventApprovalDelegationText.errorDetails.zh : eventApprovalDelegationText.errorDetails.en}</summary><p className="break-words">{error}</p></details><AppActionButton disabled={loading || busy} onClick={() => void load()}>{zh ? eventApprovalDelegationText.retry.zh : eventApprovalDelegationText.retry.en}</AppActionButton></div> : null}
      <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void grant() }}>
        <fieldset disabled={disabled || busy || loading || Boolean(error)} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-semibold">{zh ? eventApprovalDelegationText.findAMemberByName.zh : eventApprovalDelegationText.findAMemberByName.en}<input type="search" className={field} value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label className="min-w-0 text-sm font-semibold">{zh ? eventApprovalDelegationText.delegateTo.zh : eventApprovalDelegationText.delegateTo.en}<select aria-label={zh ? eventApprovalDelegationText.delegateTo.zh : eventApprovalDelegationText.delegateTo.en} required className={field} value={selected} onChange={event => setSelected(event.target.value)}><option value="">{zh ? eventApprovalDelegationText.selectAMember.zh : eventApprovalDelegationText.selectAMember.en}</option>{candidates.map(member => <option key={member.id} value={member.id}>{member.name} · {roleLabel(member.role)}</option>)}</select></label>
          <label className="min-w-0 text-sm font-semibold">{zh ? eventApprovalDelegationText.validUntil.zh : eventApprovalDelegationText.validUntil.en}<input type="datetime-local" required className={field} value={expires} onChange={event => setExpires(event.target.value)} /><span className="mt-1 block text-xs font-normal">{zh ? eventApprovalDelegationText.yourCurrentTimeZone.zh : eventApprovalDelegationText.yourCurrentTimeZone.en}{timeZone}</span></label>
          <div className="flex items-end"><AppActionButton type="submit" variant="primary" disabled={!selectedMember || !futureDelegationExpiry(expires)}>{zh ? eventApprovalDelegationText.delegateThisEventSApproval.zh : eventApprovalDelegationText.delegateThisEventSApproval.en}</AppActionButton></div>
        </fieldset>
        {!loading && !error && !candidates.length ? <p className="text-sm">{zh ? eventApprovalDelegationText.noMatchingApprovedMembersAdjustTheSearchMembersWithout.zh : eventApprovalDelegationText.noMatchingApprovedMembersAdjustTheSearchMembersWithout.en}</p> : null}
        {expires && !futureDelegationExpiry(expires) ? <p role="alert" className="text-sm text-amber-900">{zh ? eventApprovalDelegationText.chooseAValidFutureExpiryTime.zh : eventApprovalDelegationText.chooseAValidFutureExpiryTime.en}</p> : null}
        <p className="text-xs text-[#596a63]">{zh ? eventApprovalDelegationText.theListContainsApprovedMembersVisibleToYouNot.zh : eventApprovalDelegationText.theListContainsApprovedMembersVisibleToYouNot.en}</p>
      </form>
      {eventDelegations(items, eventId).map(item => { const reason = reasons[item.id] ?? { en: '', zh: '' }; return <section key={item.id} className="mt-4 space-y-2 rounded-xl bg-[#f4f8f6] p-3 text-sm"><strong>{members.find(member => member.id === item.delegatedToMemberId)?.name || (zh ? eventApprovalDelegationText.memberNameUnavailable.zh : eventApprovalDelegationText.memberNameUnavailable.en)}</strong><p>{zh ? eventApprovalDelegationText.thisEventOnlyExpires.zh : eventApprovalDelegationText.thisEventOnlyExpires.en}{new Date(item.expiresUtc).toLocaleString(zh ? 'zh-CN' : 'en-NZ')} · {timeZone}</p><div className="grid min-w-0 gap-2 sm:grid-cols-2">{(['en', 'zh'] as const).map(locale => <label key={locale}>{locale === 'en' ? (zh ? eventApprovalDelegationText.revocationReasonEnglish.zh : eventApprovalDelegationText.revocationReasonEnglish.en) : (zh ? eventApprovalDelegationText.revocationReasonChinese.zh : eventApprovalDelegationText.revocationReasonChinese.en)}<input disabled={busy || disabled} className={field} value={reason[locale]} onChange={event => setReasons(previous => ({ ...previous, [item.id]: { ...reason, [locale]: event.target.value } }))} /></label>)}</div><AppActionButton variant="danger" disabled={busy || disabled || !reason.en.trim() || !reason.zh.trim()} onClick={async () => { if (await requestConfirmation({ title: zh ? eventApprovalDelegationText.revokeThisDelegation.zh : eventApprovalDelegationText.revokeThisDelegation.en, description: zh ? eventApprovalDelegationText.theMemberCanNoLongerReviewThisEventThrough.zh : eventApprovalDelegationText.theMemberCanNoLongerReviewThisEventThrough.en, confirmLabel: zh ? eventApprovalDelegationText.revokeDelegation.zh : eventApprovalDelegationText.revokeDelegation.en, tone: 'danger' })) await mutate(() => eventPackageDelegationService.revoke(item, { en: reason.en.trim(), zh: reason.zh.trim() })) }}>{zh ? eventApprovalDelegationText.revokeDelegation.zh : eventApprovalDelegationText.revokeDelegation.en}</AppActionButton></section> })}
      {notice ? <p role="status" className="mt-3 text-sm text-[#176b5a]">{notice}</p> : null}
    </> : null}{confirmationModal}
  </details>
}
