import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { normalizeApiError } from '../services/http'
import { rosterService } from '../services/rosterService'
import { useAuthStore } from '../stores/auth'
import type { SchedulingUnavailableWindow } from '../types/roster'
import { localizeText } from '../utils/localizedText'

const dayNames = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
}

const SchedulingProfileView = () => {
  const auth = useAuthStore()
  const chinese = auth.language === 'zh'
  const memberships = useMemo(() => auth.memberships.filter((item) => item.status === 'approved'), [auth.memberships])
  const [groupId, setGroupId] = useState(memberships[0]?.groupId ?? '')
  const [roles, setRoles] = useState('')
  const [windows, setWindows] = useState<SchedulingUnavailableWindow[]>([])
  const [maxAssignments, setMaxAssignments] = useState(1)
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['selfSchedulingProfile', groupId], queryFn: () => rosterService.getSelfProfile(groupId), enabled: Boolean(groupId) })
  useEffect(() => {
    if (!query.data) return
    setRoles(query.data.preferredRoleKeys.join(', ')); setWindows(query.data.unavailableWindows)
    setMaxAssignments(query.data.maxAssignmentsPerDay); setNotes(query.data.selfNotes)
  }, [query.data])
  const save = useMutation({
    mutationFn: () => rosterService.saveSelfProfile(groupId, {
      preferredRoleKeys: roles.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
      unavailableWindows: windows, maxAssignmentsPerDay: maxAssignments, selfNotes: notes,
    }),
    onSuccess: async () => { setMessage(chinese ? '排班偏好已保存。活动负责人只能在排班工作区中查看这些资料。' : 'Scheduling preferences saved. Event leaders see them only inside the roster workspace.'); await queryClient.invalidateQueries({ queryKey: ['selfSchedulingProfile', groupId] }) },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })
  const addWindow = () => setWindows((current) => [...current, { daysOfWeek: [1, 2, 3, 4, 5], startLocalTime: '15:00', endLocalTime: '17:00', reason: '' }])
  const updateWindow = (index: number, next: SchedulingUnavailableWindow) => setWindows((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))

  return <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
    <Link to="/profile" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-800"><ArrowLeft className="h-4 w-4" />{chinese ? '返回个人资料' : 'Back to profile'}</Link>
    <section className="mt-5 rounded-[2rem] bg-[#173f36] p-6 text-white sm:p-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '个人资料 · 排班偏好' : 'Profile · Scheduling preferences'}</p><h1 className="mt-2 text-3xl font-black">{chinese ? '告诉负责人哪些时间不方便' : 'Tell leaders when you are unavailable'}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/85">{chinese ? '例如每天接孩子、固定看诊或不适合连续排班。只填写排班真正需要的资料，不必填写家庭身份、诊断或其他隐私。' : 'For example: a daily school pickup, a recurring appointment, or a limit on consecutive duties. Share only what rostering needs, not family status, diagnoses or unrelated private details.'}</p></section>
    {message ? <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{message}</p> : null}
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="block text-sm font-bold text-slate-700">{chinese ? '所属小组' : 'Group'}<select value={groupId} onChange={(event) => { setGroupId(event.target.value); setMessage('') }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">{memberships.map((item) => <option key={item.groupId} value={item.groupId}>{localizeText(item.groupName, auth.language) || item.groupId}</option>)}</select></label>
      {query.isLoading ? <p className="mt-4 text-sm text-slate-600">{chinese ? '正在读取…' : 'Loading…'}</p> : null}
      {query.error ? <p className="mt-4 text-sm text-rose-700">{normalizeApiError(query.error).message}</p> : null}
      {query.data ? <div className="mt-5 space-y-5">
        <label className="block text-sm font-bold text-slate-700">{chinese ? '愿意参与的岗位（逗号分隔）' : 'Preferred roles (comma separated)'}<input value={roles} onChange={(event) => setRoles(event.target.value)} placeholder={chinese ? '例如：接待, 场地布置' : 'e.g. welcome-team, setup'} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
        <label className="block text-sm font-bold text-slate-700">{chinese ? '每天最多安排几次' : 'Maximum assignments per day'}<input type="number" min={1} max={10} value={maxAssignments} onChange={(event) => setMaxAssignments(Number(event.target.value))} className="mt-1 w-32 rounded-xl border border-slate-300 px-3 py-2" /></label>
        <div><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-slate-950">{chinese ? '固定不方便时间' : 'Recurring unavailable times'}</h2><p className="mt-1 text-xs text-slate-600">{chinese ? '只写时间和简单原因即可。' : 'A time and short practical reason are enough.'}</p></div><button type="button" onClick={addWindow} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-black text-emerald-800"><Plus className="h-4 w-4" />{chinese ? '增加时间' : 'Add time'}</button></div>
          <div className="mt-3 space-y-3">{windows.map((window, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap gap-2">{dayNames[chinese ? 'zh' : 'en'].map((name, day) => <label key={name} className={['cursor-pointer rounded-full border px-2.5 py-1 text-xs font-bold', window.daysOfWeek.includes(day) ? 'border-emerald-400 bg-emerald-100 text-emerald-900' : 'border-slate-300 bg-white text-slate-600'].join(' ')}><input type="checkbox" className="sr-only" checked={window.daysOfWeek.includes(day)} onChange={(event) => updateWindow(index, { ...window, daysOfWeek: event.target.checked ? [...window.daysOfWeek, day].sort() : window.daysOfWeek.filter((item) => item !== day) })} />{name}</label>)}</div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]"><input type="time" value={window.startLocalTime} onChange={(event) => updateWindow(index, { ...window, startLocalTime: event.target.value })} className="rounded-lg border border-slate-300 px-2 py-2" /><input type="time" value={window.endLocalTime} onChange={(event) => updateWindow(index, { ...window, endLocalTime: event.target.value })} className="rounded-lg border border-slate-300 px-2 py-2" /><input value={window.reason} onChange={(event) => updateWindow(index, { ...window, reason: event.target.value })} placeholder={chinese ? '例如：接孩子' : 'e.g. school pickup'} className="rounded-lg border border-slate-300 px-2 py-2" /><button type="button" onClick={() => setWindows((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
        </div>
        <label className="block text-sm font-bold text-slate-700">{chinese ? '给排班负责人的补充说明' : 'Note for roster leaders'}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={1000} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{chinese ? '智能建议只比较已填写的时间、偏好和岗位标签。它不会猜测你的家庭、健康或能力，也不会自动把你排进活动。' : 'Smart suggestions compare only recorded times, preferences and role labels. They do not infer family, health or ability, and never assign you automatically.'}</p>
        <button type="button" disabled={save.isPending || !groupId} onClick={() => save.mutate()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{save.isPending ? (chinese ? '保存中…' : 'Saving…') : (chinese ? '保存排班偏好' : 'Save scheduling preferences')}</button>
      </div> : null}
    </section>
  </main>
}

export default SchedulingProfileView
