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
  const roleLabel = (role: string) => ({ leader: zh ? '组长' : 'Leader', coLeader: zh ? '副组长' : 'Co-leader', member: zh ? '成员' : 'Member' }[role] || (zh ? '成员' : 'Member'))
  const mutate = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(''); setNotice('')
    try { await action(); await load(); await onChanged(); setNotice(zh ? '委派已更新。' : 'Delegation updated.') }
    catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setBusy(false) }
  }
  const grant = async () => {
    if (!selectedMember || !futureDelegationExpiry(expires) || busy || disabled || loading || error) return
    const confirmed = await requestConfirmation({ title: zh ? '确认临时委派审批权限？' : 'Delegate approval temporarily?', description: zh ? `将本活动的方案审批权限委派给 ${selectedMember.name}，至 ${new Date(expires).toLocaleString('zh-CN')}（${timeZone}）。资格与回避规则仍由系统校验；不会自动批准活动。` : `Delegate this event’s approval to ${selectedMember.name} until ${new Date(expires).toLocaleString('en-NZ')} (${timeZone}). Eligibility and separation rules still apply. This does not approve the event.`, confirmLabel: zh ? '确认委派' : 'Confirm delegation' })
    if (confirmed) await mutate(() => eventPackageDelegationService.grantForEvent(groupId, eventId, selectedMember.id, new Date().toISOString(), new Date(expires).toISOString()))
  }
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="mt-4 rounded-xl border border-[#dce5e0] bg-white p-4">
    <summary className="min-h-11 cursor-pointer font-semibold text-[#18332d]">{zh ? '高级选项：临时委派审批（可选）' : 'Advanced: temporary approval delegation (optional)'}</summary>
    <p className="mt-2 text-sm text-[#40554e]">{zh ? '只有需要由他人代为审批时才使用，不是提交审批的必填步骤。委派仅限本活动，政策及独立审批要求仍然适用。' : 'Use only when another member needs to review on your behalf. This is not required to submit for approval. The delegation is limited to this event; policy and independent-review rules still apply.'}</p>
    {open ? <>
      {loading ? <p role="status" className="mt-3 text-sm">{zh ? '正在读取可见成员与委派…' : 'Loading visible members and delegations…'}</p> : null}
      {error ? <div role="alert" className="mt-3 space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><p>{zh ? '无法完成读取或更新。请重试；如无成员查看权限，请联系组织管理员。不会要求你手填成员 ID。' : 'Unable to load or update. Retry, or contact an organisation administrator if you cannot view members. You do not need to enter member IDs.'}</p><details><summary>{zh ? '错误详情' : 'Error details'}</summary><p className="break-words">{error}</p></details><AppActionButton disabled={loading || busy} onClick={() => void load()}>{zh ? '重试' : 'Retry'}</AppActionButton></div> : null}
      <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void grant() }}>
        <fieldset disabled={disabled || busy || loading || Boolean(error)} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-semibold">{zh ? '按姓名查找成员' : 'Find a member by name'}<input type="search" className={field} value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label className="min-w-0 text-sm font-semibold">{zh ? '委派给谁' : 'Delegate to'}<select aria-label={zh ? '委派给谁' : 'Delegate to'} required className={field} value={selected} onChange={event => setSelected(event.target.value)}><option value="">{zh ? '请选择成员' : 'Select a member'}</option>{candidates.map(member => <option key={member.id} value={member.id}>{member.name} · {roleLabel(member.role)}</option>)}</select></label>
          <label className="min-w-0 text-sm font-semibold">{zh ? '有效期至' : 'Valid until'}<input type="datetime-local" required className={field} value={expires} onChange={event => setExpires(event.target.value)} /><span className="mt-1 block text-xs font-normal">{zh ? '按你当前时区：' : 'Your current time zone: '}{timeZone}</span></label>
          <div className="flex items-end"><AppActionButton type="submit" variant="primary" disabled={!selectedMember || !futureDelegationExpiry(expires)}>{zh ? '委派本活动审批' : 'Delegate this event’s approval'}</AppActionButton></div>
        </fieldset>
        {!loading && !error && !candidates.length ? <p className="text-sm">{zh ? '没有匹配的已加入成员。请调整搜索；姓名缺失的成员需先完善资料。' : 'No matching approved members. Adjust the search; members without a name need their profile completed first.'}</p> : null}
        {expires && !futureDelegationExpiry(expires) ? <p role="alert" className="text-sm text-amber-900">{zh ? '请选择未来的有效到期时间。' : 'Choose a valid future expiry time.'}</p> : null}
        <p className="text-xs text-[#596a63]">{zh ? '名单仅表示你可查看的已加入成员，不保证符合审批资格；提交时会再次校验。' : 'The list contains approved members visible to you, not guaranteed eligible approvers. Eligibility is checked on submission.'}</p>
      </form>
      {eventDelegations(items, eventId).map(item => { const reason = reasons[item.id] ?? { en: '', zh: '' }; return <section key={item.id} className="mt-4 space-y-2 rounded-xl bg-[#f4f8f6] p-3 text-sm"><strong>{members.find(member => member.id === item.delegatedToMemberId)?.name || (zh ? '成员姓名暂不可用' : 'Member name unavailable')}</strong><p>{zh ? '仅本活动 · 到期：' : 'This event only · Expires: '}{new Date(item.expiresUtc).toLocaleString(zh ? 'zh-CN' : 'en-NZ')} · {timeZone}</p><div className="grid min-w-0 gap-2 sm:grid-cols-2">{(['en', 'zh'] as const).map(locale => <label key={locale}>{locale === 'en' ? (zh ? '撤销理由（英文）' : 'Revocation reason (English)') : (zh ? '撤销理由（中文）' : 'Revocation reason (Chinese)')}<input disabled={busy || disabled} className={field} value={reason[locale]} onChange={event => setReasons(previous => ({ ...previous, [item.id]: { ...reason, [locale]: event.target.value } }))} /></label>)}</div><AppActionButton variant="danger" disabled={busy || disabled || !reason.en.trim() || !reason.zh.trim()} onClick={async () => { if (await requestConfirmation({ title: zh ? '撤销这项审批委派？' : 'Revoke this delegation?', description: zh ? '该成员将不再凭此委派审批本活动。已有决定不会因此自动删除。' : 'The member can no longer review this event through this delegation. Existing decisions are not deleted.', confirmLabel: zh ? '撤销委派' : 'Revoke delegation', tone: 'danger' })) await mutate(() => eventPackageDelegationService.revoke(item, { en: reason.en.trim(), zh: reason.zh.trim() })) }}>{zh ? '撤销委派' : 'Revoke delegation'}</AppActionButton></section> })}
      {notice ? <p role="status" className="mt-3 text-sm text-[#176b5a]">{notice}</p> : null}
    </> : null}{confirmationModal}
  </details>
}
