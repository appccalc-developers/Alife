import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Crown, Loader2, Search, Settings2, ShieldCheck, UserPlus, UsersRound, X } from 'lucide-react'
import AppPageShell from '../components/layout/AppPageShell'
import { groupService, type MemberSummaryDto } from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { GroupDto, GroupMembershipDto } from '../types'
import { localizeText } from '../utils/localizedText'

type AdminGroupTab = 'profile' | 'leadership' | 'members'
type AdminGroupMembership = Awaited<ReturnType<typeof groupService.getGroupMemberships>>[number]

const adminGroupTabs = new Set<AdminGroupTab>(['profile', 'leadership', 'members'])
const normalizeTab = (value: string | null): AdminGroupTab =>
  adminGroupTabs.has(value as AdminGroupTab) ? value as AdminGroupTab : 'profile'

const roleLabel = (role: GroupMembershipDto['role'], isZh: boolean) => {
  if (role === 'leader') return isZh ? '组长' : 'Leader'
  if (role === 'coLeader') return isZh ? 'Co-leader' : 'Co-leader'
  return isZh ? '成员' : 'Member'
}

const statusLabel = (status: GroupMembershipDto['status'], isZh: boolean) => {
  if (status === 'approved') return isZh ? '已加入' : 'Approved'
  if (status === 'requested') return isZh ? '待审核' : 'Requested'
  if (status === 'invited') return isZh ? '已邀请' : 'Invited'
  if (status === 'rejected') return isZh ? '已拒绝' : 'Rejected'
  return isZh ? '已移除' : 'Removed'
}

const AdminGroupView = () => {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const [searchParams] = useSearchParams()
  const activeTab = normalizeTab(searchParams.get('tab'))
  const auth = useAuthStore()
  const isZh = auth.language === 'zh'
  const [group, setGroup] = useState<GroupDto | null>(null)
  const [memberships, setMemberships] = useState<AdminGroupMembership[]>([])
  const [directory, setDirectory] = useState<MemberSummaryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [appointingLeader, setAppointingLeader] = useState(false)
  const [updatingCoLeaderId, setUpdatingCoLeaderId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [leaderMemberId, setLeaderMemberId] = useState('')
  const [coLeaderMemberId, setCoLeaderMemberId] = useState('')
  const [profile, setProfile] = useState({ nameEn: '', nameZh: '', descriptionEn: '', descriptionZh: '' })

  const loadMemberships = useCallback(async () => {
    if (!groupId) return []
    const nextMemberships = await groupService.getGroupMemberships(groupId)
    setMemberships(nextMemberships)
    return nextMemberships
  }, [groupId])

  const load = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    setError('')
    try {
      const [nextGroup, nextMemberships, nextDirectory] = await Promise.all([
        groupService.getGroup(groupId),
        groupService.getGroupMemberships(groupId),
        groupService.getMembers(),
      ])
      setGroup(nextGroup)
      setMemberships(nextMemberships)
      setDirectory(nextDirectory)
      setProfile({
        nameEn: nextGroup.name.en || '',
        nameZh: nextGroup.name.zh || '',
        descriptionEn: nextGroup.description?.en || '',
        descriptionZh: nextGroup.description?.zh || '',
      })
      setLeaderMemberId(nextMemberships.find((membership) => membership.status === 'approved' && membership.role === 'leader')?.memberId || '')
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    load().catch(() => undefined)
  }, [load])

  const approvedMemberships = useMemo(
    () => memberships.filter((membership) => membership.status === 'approved'),
    [memberships],
  )
  const currentLeader = approvedMemberships.find((membership) => membership.role === 'leader') ?? null
  const currentCoLeaders = approvedMemberships.filter((membership) => membership.role === 'coLeader')
  const approvedMemberIds = useMemo(() => new Set(approvedMemberships.map((membership) => membership.memberId)), [approvedMemberships])
  const selectedLeaderIsOutsideGroup = Boolean(leaderMemberId && !approvedMemberIds.has(leaderMemberId))
  const coLeaderCandidates = approvedMemberships.filter((membership) => membership.role === 'member')
  const visibleMemberships = useMemo(() => {
    const query = memberSearch.trim().toLocaleLowerCase()
    if (!query) return memberships
    return memberships.filter((membership) =>
      (membership.displayName || '').toLocaleLowerCase().includes(query) ||
      (membership.memberId || '').toLocaleLowerCase().includes(query),
    )
  }, [memberSearch, memberships])

  useEffect(() => {
    if (coLeaderMemberId && coLeaderCandidates.some((membership) => membership.memberId === coLeaderMemberId)) return
    setCoLeaderMemberId(coLeaderCandidates[0]?.memberId || '')
  }, [coLeaderCandidates, coLeaderMemberId])

  const saveProfile = async () => {
    if (!group) return
    if (!profile.nameEn.trim() && !profile.nameZh.trim()) {
      setError(isZh ? '请至少填写一种语言的小组名称。' : 'Enter the group name in at least one language.')
      return
    }

    setSavingProfile(true)
    setError('')
    setMessage('')
    try {
      const updated = await groupService.updateGroup(group.id, {
        name: { ...group.name, en: profile.nameEn.trim(), zh: profile.nameZh.trim() },
        description: { ...group.description, en: profile.descriptionEn.trim(), zh: profile.descriptionZh.trim() },
        accessType: group.accessType,
        isClosed: group.isClosed,
      })
      setGroup(updated)
      setMessage(isZh ? '小组名称和描述已保存。' : 'Group name and description saved.')
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setSavingProfile(false)
    }
  }

  const appointLeader = async () => {
    if (!group || !leaderMemberId) return
    setAppointingLeader(true)
    setError('')
    setMessage('')
    try {
      await groupService.appointLeader(group.id, { memberId: leaderMemberId }, auth.me?.id)
      const nextMemberships = await loadMemberships()
      await auth.fetchMe()
      setLeaderMemberId(nextMemberships.find((membership) => membership.status === 'approved' && membership.role === 'leader')?.memberId || leaderMemberId)
      setMessage(isZh ? '组长任命已更新。' : 'Group leader updated.')
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setAppointingLeader(false)
    }
  }

  const updateCoLeader = async (memberId: string, isCoLeader: boolean) => {
    if (!group) return
    setUpdatingCoLeaderId(memberId)
    setError('')
    setMessage('')
    try {
      await groupService.setCoLeader(group.id, { memberId, isCoLeader }, auth.me?.id)
      await loadMemberships()
      await auth.fetchMe()
      setMessage(isZh
        ? (isCoLeader ? 'Co-leader 已任命。' : 'Co-leader 任命已取消。')
        : (isCoLeader ? 'Co-leader appointed.' : 'Co-leader appointment removed.'))
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setUpdatingCoLeaderId(null)
    }
  }

  const tabs = [
    { key: 'profile' as const, label: isZh ? '小组资料' : 'Group profile', icon: Settings2 },
    { key: 'leadership' as const, label: isZh ? '负责人' : 'Leadership', icon: Crown },
    { key: 'members' as const, label: isZh ? '成员名册' : 'Member directory', icon: UsersRound },
  ]
  const groupName = localizeText(group?.name, auth.language) || (isZh ? '小组管理' : 'Group management')

  return (
    <AppPageShell fullBleed>
      <div className="space-y-5">
        <header className="overflow-hidden rounded-[2rem] border border-[#24493f] bg-[#0e3029] text-white shadow-[0_22px_65px_rgba(14,48,41,0.18)]">
          <div className="relative isolate px-5 py-5 sm:px-7 sm:py-6">
            <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[#df9362]/25 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <Link to="/church/manage?section=subgroups" className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-200 transition hover:text-white">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />{isZh ? '返回组织架构' : 'Back to organization'}
                </Link>
                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">{isZh ? '小组行政管理' : 'Group administration'}</p>
                <h1 className="mt-1.5 truncate text-3xl font-black tracking-[-0.045em]">{groupName}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{isZh ? '维护小组资料、负责人和只读成员名册。' : 'Maintain the group profile, leadership, and read-only member directory.'}</p>
              </div>
              <span className="inline-flex self-start items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white/75 sm:self-auto">
                <ShieldCheck className="h-4 w-4 text-emerald-200" aria-hidden="true" />{isZh ? '不会切换当前小组' : 'Current group stays unchanged'}
              </span>
            </div>
          </div>
          <nav aria-label={isZh ? '小组管理页面' : 'Group administration views'} className="overflow-x-auto border-t border-white/10 bg-black/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max px-3 sm:px-5" role="tablist">
              {tabs.map(({ key, label, icon: Icon }) => {
                const active = activeTab === key
                return (
                  <Link
                    key={key}
                    to={`/admin/groups/${encodeURIComponent(groupId)}?tab=${key}`}
                    role="tab"
                    aria-selected={active}
                    className={`relative inline-flex min-h-12 items-center gap-2 px-3.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f3b080] ${active ? 'text-white' : 'text-white/55 hover:text-white/85'}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />{label}
                    {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#f2a36f]" /> : null}
                  </Link>
                )
              })}
            </div>
          </nav>
        </header>

        {message ? <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><Check className="h-4 w-4" />{message}</div> : null}
        {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}

        {loading ? (
          <section className="flex min-h-52 items-center justify-center rounded-[1.75rem] border border-[#dbe5e0] bg-white text-sm font-bold text-[#66766f]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isZh ? '正在加载小组管理资料…' : 'Loading group administration…'}</section>
        ) : null}

        {!loading && group && activeTab === 'profile' ? (
          <section className="overflow-hidden rounded-[1.75rem] border border-[#dbe5e0] bg-white shadow-[0_12px_38px_rgba(24,51,45,0.06)]">
            <div className="border-b border-[#e1e9e5] px-5 py-5 sm:px-6">
              <h2 className="text-xl font-black tracking-[-0.025em] text-[#18332d]">{isZh ? '名称与描述' : 'Name and description'}</h2>
              <p className="mt-1 text-sm leading-6 text-[#687770]">{isZh ? '双语资料会用于管理页面和成员看到的小组信息。' : 'Bilingual details are used in administration and member-facing group information.'}</p>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label className="grid gap-2 text-sm font-bold text-[#36564e]">{isZh ? '中文名称' : 'Chinese name'}<input className="min-h-11 rounded-xl border border-[#cfddd7] px-3 text-sm font-normal text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-4 focus:ring-emerald-100" value={profile.nameZh} onChange={(event) => setProfile({ ...profile, nameZh: event.target.value })} /></label>
              <label className="grid gap-2 text-sm font-bold text-[#36564e]">{isZh ? '英文名称' : 'English name'}<input className="min-h-11 rounded-xl border border-[#cfddd7] px-3 text-sm font-normal text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-4 focus:ring-emerald-100" value={profile.nameEn} onChange={(event) => setProfile({ ...profile, nameEn: event.target.value })} /></label>
              <label className="grid gap-2 text-sm font-bold text-[#36564e]">{isZh ? '中文描述' : 'Chinese description'}<textarea className="min-h-36 rounded-xl border border-[#cfddd7] px-3 py-2 text-sm font-normal leading-6 text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-4 focus:ring-emerald-100" value={profile.descriptionZh} onChange={(event) => setProfile({ ...profile, descriptionZh: event.target.value })} /></label>
              <label className="grid gap-2 text-sm font-bold text-[#36564e]">{isZh ? '英文描述' : 'English description'}<textarea className="min-h-36 rounded-xl border border-[#cfddd7] px-3 py-2 text-sm font-normal leading-6 text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-4 focus:ring-emerald-100" value={profile.descriptionEn} onChange={(event) => setProfile({ ...profile, descriptionEn: event.target.value })} /></label>
            </div>
            <div className="flex justify-end border-t border-[#e1e9e5] bg-[#f8faf9] px-5 py-4 sm:px-6"><button type="button" disabled={savingProfile} onClick={() => saveProfile().catch(() => undefined)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5a] px-5 text-sm font-black text-white transition hover:bg-[#10584a] disabled:cursor-wait disabled:opacity-60">{savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{isZh ? '保存小组资料' : 'Save group profile'}</button></div>
          </section>
        ) : null}

        {!loading && group && activeTab === 'leadership' ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)]">
            <section className="overflow-hidden rounded-[1.75rem] border border-[#dbe5e0] bg-white shadow-[0_12px_38px_rgba(24,51,45,0.06)]">
              <div className="border-b border-[#e1e9e5] px-5 py-5 sm:px-6"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#176b5a]">{isZh ? '主要负责人' : 'Primary leader'}</p><h2 className="mt-1 text-xl font-black text-[#18332d]">{currentLeader?.displayName || (isZh ? '尚未任命组长' : 'No leader appointed')}</h2><p className="mt-2 text-sm leading-6 text-[#687770]">{isZh ? '可以从已注册成员中任命。若对方尚未加入本组，保存时会直接加入并成为组长。' : 'Choose any registered member. If they are not in this group, they will be added and approved as leader.'}</p></div>
              <div className="space-y-4 p-5 sm:p-6">
                <label className="grid gap-2 text-sm font-bold text-[#36564e]">{isZh ? '选择组长' : 'Choose leader'}
                  <select className="min-h-11 rounded-xl border border-[#cfddd7] bg-white px-3 text-sm font-normal text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-4 focus:ring-emerald-100" value={leaderMemberId} onChange={(event) => setLeaderMemberId(event.target.value)}>
                    <option value="">{isZh ? '请选择成员' : 'Select a member'}</option>
                    {directory.map((member) => <option key={member.id} value={member.id}>{member.displayName || member.id}</option>)}
                  </select>
                </label>
                {selectedLeaderIsOutsideGroup ? <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs font-bold leading-5 text-sky-800"><UserPlus className="mt-0.5 h-4 w-4 shrink-0" />{isZh ? '这位成员不在本组；任命时会自动加入。' : 'This member is outside the group and will be added automatically.'}</p> : null}
                <button type="button" disabled={!leaderMemberId || leaderMemberId === currentLeader?.memberId || appointingLeader} onClick={() => appointLeader().catch(() => undefined)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b5a] px-5 text-sm font-black text-white transition hover:bg-[#10584a] disabled:cursor-not-allowed disabled:opacity-50">{appointingLeader ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}{isZh ? '任命组长' : 'Appoint leader'}</button>
              </div>
            </section>

            <section className="overflow-hidden rounded-[1.75rem] border border-[#dbe5e0] bg-[#f8faf9]">
              <div className="border-b border-[#e1e9e5] px-5 py-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a25f3c]">Co-leaders</p><h2 className="mt-1 text-xl font-black text-[#18332d]">{isZh ? '协同负责人' : 'Supporting leaders'}</h2><p className="mt-2 text-sm leading-6 text-[#687770]">{isZh ? 'Co-leader 必须已经是本组的已批准成员。' : 'A co-leader must already be an approved member of this group.'}</p></div>
              <div className="space-y-4 p-5">
                {currentCoLeaders.length ? <ul className="space-y-2">{currentCoLeaders.map((membership) => <li key={membership.memberId} className="flex items-center justify-between gap-3 rounded-xl border border-[#d8e4de] bg-white px-3 py-2.5"><span className="min-w-0 truncate text-sm font-bold text-[#27473f]">{membership.displayName || membership.memberId}</span><button type="button" disabled={updatingCoLeaderId === membership.memberId} onClick={() => updateCoLeader(membership.memberId || '', false).catch(() => undefined)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8a4b3e] transition hover:bg-rose-50 disabled:opacity-50" aria-label={isZh ? `取消 ${membership.displayName || ''} 的 Co-leader 任命` : `Remove ${membership.displayName || ''} as co-leader`}>{updatingCoLeaderId === membership.memberId ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}</button></li>)}</ul> : <p className="rounded-xl border border-dashed border-[#cbd9d3] bg-white/70 px-3 py-4 text-sm text-[#708079]">{isZh ? '目前没有 Co-leader。' : 'No co-leaders appointed yet.'}</p>}
                <div className="grid gap-2 border-t border-[#dfe8e3] pt-4">
                  <label className="text-xs font-bold text-[#526860]">{isZh ? '从现有成员任命' : 'Appoint from existing members'}</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#cfddd7] bg-white px-3 text-sm text-[#18332d] outline-none focus:border-[#176b5a] focus:ring-4 focus:ring-emerald-100" value={coLeaderMemberId} onChange={(event) => setCoLeaderMemberId(event.target.value)} disabled={!coLeaderCandidates.length}><option value="">{isZh ? '选择成员' : 'Select member'}</option>{coLeaderCandidates.map((membership) => <option key={membership.memberId} value={membership.memberId}>{membership.displayName || membership.memberId}</option>)}</select>
                    <button type="button" disabled={!coLeaderMemberId || updatingCoLeaderId !== null} onClick={() => updateCoLeader(coLeaderMemberId, true).catch(() => undefined)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#176b5a] bg-white px-4 text-sm font-black text-[#176b5a] transition hover:bg-emerald-50 disabled:opacity-50">{updatingCoLeaderId === coLeaderMemberId ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{isZh ? '任命' : 'Appoint'}</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {!loading && group && activeTab === 'members' ? (
          <section className="overflow-hidden rounded-[1.75rem] border border-[#dbe5e0] bg-white shadow-[0_12px_38px_rgba(24,51,45,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[#e1e9e5] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6"><div><h2 className="text-xl font-black text-[#18332d]">{isZh ? '成员名册' : 'Member directory'}</h2><p className="mt-1 text-sm leading-6 text-[#687770]">{isZh ? '此表仅供查看；成员状态不能从这里修改。' : 'This table is read-only; membership status cannot be changed here.'}</p></div><label className="relative block sm:w-72"><span className="sr-only">{isZh ? '搜索成员' : 'Search members'}</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#829089]" /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder={isZh ? '搜索姓名' : 'Search by name'} className="min-h-11 w-full rounded-xl border border-[#cfddd7] pl-9 pr-3 text-sm outline-none focus:border-[#176b5a] focus:ring-4 focus:ring-emerald-100" /></label></div>
            {visibleMemberships.length ? <div className="overflow-x-auto"><table className="min-w-full divide-y divide-[#e1e9e5] text-sm"><thead className="bg-[#f8faf9] text-left text-[11px] font-black uppercase tracking-[0.12em] text-[#687770]"><tr><th className="px-5 py-3 sm:px-6">{isZh ? '成员' : 'Member'}</th><th className="px-5 py-3">{isZh ? '组内角色' : 'Group role'}</th><th className="px-5 py-3">{isZh ? '状态' : 'Status'}</th></tr></thead><tbody className="divide-y divide-[#edf1ef]">{visibleMemberships.map((membership) => <tr key={membership.memberId} className="hover:bg-[#fbfcfb]"><td className="px-5 py-4 sm:px-6"><p className="font-bold text-[#27473f]">{membership.displayName || (isZh ? '未命名成员' : 'Unnamed member')}</p><p className="mt-1 font-mono text-[10px] text-[#96a19c]">{membership.memberId}</p></td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${membership.role === 'leader' ? 'border-amber-200 bg-amber-50 text-amber-800' : membership.role === 'coLeader' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{roleLabel(membership.role, isZh)}</span></td><td className="px-5 py-4 text-[#5f716a]">{statusLabel(membership.status, isZh)}</td></tr>)}</tbody></table></div> : <p className="px-5 py-10 text-center text-sm text-[#708079]">{memberSearch ? (isZh ? '没有匹配的成员。' : 'No members match this search.') : (isZh ? '这个小组还没有成员记录。' : 'This group has no membership records yet.')}</p>}
          </section>
        ) : null}
      </div>
    </AppPageShell>
  )
}

export default AdminGroupView
