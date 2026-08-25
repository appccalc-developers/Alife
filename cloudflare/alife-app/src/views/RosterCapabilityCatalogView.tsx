import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { normalizeApiError } from '../services/http'
import { rosterService } from '../services/rosterService'
import { useAuthStore } from '../stores/auth'
import type { RosterCapability, SaveRosterCapabilityPayload } from '../types/roster'
import { localizeText } from '../utils/localizedText'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

const emptyForm = (): SaveRosterCapabilityPayload => ({
  key: '', nameEn: '', nameZh: '', descriptionEn: '', descriptionZh: '',
  requiresExpiry: false, defaultValidityDays: null, isActive: true,
})

const presets: Array<SaveRosterCapabilityPayload> = [
  { key: 'first-aid', nameEn: 'First-aid qualification', nameZh: '急救资格', descriptionEn: 'Current first-aid certificate required.', descriptionZh: '需要仍在有效期内的急救证书。', requiresExpiry: true, defaultValidityDays: 730, isActive: true },
  { key: 'licensed-driver', nameEn: 'Licensed driver', nameZh: '有效驾驶资格', descriptionEn: 'Current driving licence appropriate for the assigned vehicle.', descriptionZh: '持有适用于所安排车辆的有效驾照。', requiresExpiry: true, defaultValidityDays: 365, isActive: true },
  { key: 'children-team-training', nameEn: 'Children team training', nameZh: '儿童事工培训', descriptionEn: 'Required safeguarding and ministry training is current.', descriptionZh: '所需儿童保护与事工培训仍然有效。', requiresExpiry: true, defaultValidityDays: 730, isActive: true },
  { key: 'bilingual', nameEn: 'Bilingual support', nameZh: '双语协助', descriptionEn: 'Can support the role in Chinese and English.', descriptionZh: '可以用中文和英文协助该岗位。', requiresExpiry: false, defaultValidityDays: null, isActive: true },
]

const RosterCapabilityCatalogView = () => {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const auth = useAuthStore()
  const chinese = auth.language === 'zh'
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<RosterCapability | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SaveRosterCapabilityPayload>(emptyForm)
  const [formBaseline, setFormBaseline] = useState('')
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['rosterCapabilities', groupId],
    queryFn: () => rosterService.listCapabilities(groupId),
    enabled: Boolean(groupId),
  })
  const formDirty = showForm && JSON.stringify(form) !== formBaseline

  useEffect(() => {
    setUnsavedChangesGuard(formDirty, chinese ? '岗位资格尚未保存，确定离开吗？' : 'The capability is not saved. Leave this page?', 'confirm')
    if (!formDirty) return () => setUnsavedChangesGuard(false)
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); setUnsavedChangesGuard(false) }
  }, [chinese, formDirty])
  const mutation = useMutation({
    mutationFn: () => rosterService.saveCapability(groupId, editing?.id ?? null, form),
    onSuccess: async () => {
      setMessage(chinese ? '常用能力已保存。成员资格到期后会自动停止用于推荐。' : 'Capability saved. Expired member qualifications will no longer influence suggestions.')
      setEditing(null); setShowForm(false); setForm(emptyForm()); setFormBaseline('')
      await queryClient.invalidateQueries({ queryKey: ['rosterCapabilities', groupId] })
    },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })

  const openExisting = (item: RosterCapability) => {
    setEditing(item); setShowForm(true); setMessage('')
    const nextForm = {
      key: item.key, nameEn: item.name.en, nameZh: item.name.zh,
      descriptionEn: item.description.en, descriptionZh: item.description.zh,
      requiresExpiry: item.requiresExpiry, defaultValidityDays: item.defaultValidityDays, isActive: item.isActive,
    }
    setForm(nextForm); setFormBaseline(JSON.stringify(nextForm))
  }
  const openPreset = (preset: SaveRosterCapabilityPayload) => {
    setEditing(null); setShowForm(true); setMessage(''); setForm({ ...preset }); setFormBaseline(JSON.stringify(preset))
  }
  const closeForm = () => {
    if (formDirty && !window.confirm(chinese ? '这些修改还没有保存，确定关闭吗？' : 'These changes are not saved. Close anyway?')) return
    setShowForm(false)
  }
  const canSave = form.key.trim().length >= 2 && Boolean(form.nameEn.trim() || form.nameZh.trim())
    && (!form.requiresExpiry || Boolean(form.defaultValidityDays && form.defaultValidityDays > 0))

  if (query.isLoading) return <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-600">{chinese ? '正在打开常用能力目录…' : 'Opening capability catalog…'}</main>
  if (query.error) return <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-rose-700">{normalizeApiError(query.error).message}</main>

  return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <Link to="/groups?section=events" className="inline-flex items-center gap-2 text-sm font-black text-emerald-800"><ArrowLeft className="h-4 w-4" />{chinese ? '返回活动管理' : 'Back to event management'}</Link>
    <header className="mt-5 rounded-[2rem] bg-[#173f36] px-6 py-7 text-white sm:px-8"><p className="text-xs font-black uppercase tracking-[0.17em] text-emerald-200">{chinese ? '小组设置 · 同工排班' : 'Group settings · Roster'}</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black">{chinese ? '常用能力与资格' : 'Common capabilities'}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/85">{chinese ? '这里只定义教会实际会使用的岗位资格。需要有效期的项目，到期后不会继续满足班次要求；成员的证书号码和个人原因不需要记录。' : 'Define only capabilities the group really uses. Expiring qualifications stop satisfying shift requirements after expiry; certificate numbers and private reasons are not needed.'}</p></div><button type="button" onClick={() => { const next = emptyForm(); setEditing(null); setForm(next); setFormBaseline(JSON.stringify(next)); setShowForm(true); setMessage('') }} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#173f36]"><Plus className="h-4 w-4" />{chinese ? '新建能力' : 'New capability'}</button></div></header>
    {message ? <p role="status" className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{message}</p> : null}

    <section className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#ded6cb] bg-white shadow-[0_18px_45px_rgba(31,56,48,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#fbfaf7] px-5 py-4 sm:px-7"><div><h2 className="font-black text-slate-950">{chinese ? '能力目录' : 'Capability catalog'}</h2><p className="mt-1 text-xs text-slate-500">{chinese ? '点击一行可以修改；停用后不会再用于新的智能建议。' : 'Select a row to edit it. Inactive items are not used by new suggestions.'}</p></div><span className="text-xs font-black text-slate-500">{query.data?.filter((item) => item.isActive).length ?? 0} {chinese ? '项启用' : 'active'}</span></div>
      <div className="divide-y divide-slate-200">{query.data?.length ? query.data.map((item) => <button type="button" key={item.id} onClick={() => openExisting(item)} className="grid w-full gap-2 px-5 py-4 text-left hover:bg-emerald-50/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-7"><span><span className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-950">{localizeText(item.name, auth.language)}</strong><code className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{item.key}</code>{item.isActive ? <span className="text-[11px] font-black text-emerald-700">{chinese ? '启用' : 'Active'}</span> : <span className="text-[11px] font-black text-slate-400">{chinese ? '停用' : 'Inactive'}</span>}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{localizeText(item.description, auth.language) || (chinese ? '暂无说明' : 'No description')}</span></span><span className="text-xs font-black text-slate-600">{item.requiresExpiry ? (chinese ? `需到期日 · 默认 ${item.defaultValidityDays} 天` : `Expiry required · ${item.defaultValidityDays} days`) : (chinese ? '长期能力' : 'No expiry')}</span></button>) : <p className="px-6 py-10 text-center text-sm text-slate-500">{chinese ? '还没有能力项目。可以从下方常用示例开始。' : 'No capabilities yet. Start from a common example below.'}</p>}</div>
      <div className="border-t border-slate-200 bg-[#fbfaf7] px-5 py-4 sm:px-7"><p className="text-xs font-black text-slate-700">{chinese ? '从常用示例开始' : 'Start from a common example'}</p><div className="mt-2 flex flex-wrap gap-2">{presets.map((preset) => <button type="button" key={preset.key} onClick={() => openPreset(preset)} className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-800">{chinese ? preset.nameZh : preset.nameEn}</button>)}</div></div>
    </section>

    {showForm ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4"><section className="my-6 w-full max-w-2xl overflow-hidden rounded-[1.75rem] bg-white shadow-2xl"><header className="flex items-start justify-between gap-3 bg-[#173f36] px-6 py-5 text-white"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">{editing ? (chinese ? '修改能力' : 'Edit capability') : (chinese ? '新建能力' : 'New capability')}</p><h2 className="mt-1 text-xl font-black">{form.nameZh || form.nameEn || (chinese ? '未命名能力' : 'Unnamed capability')}</h2></div><button type="button" aria-label={chinese ? '关闭' : 'Close'} onClick={closeForm}><X className="h-5 w-5" /></button></header><div className="grid max-h-[75vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700 sm:col-span-2">{chinese ? '能力代号' : 'Capability key'}<input disabled={Boolean(editing)} value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} placeholder="first-aid" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100" /><span className="mt-1 block text-xs font-normal text-slate-500">{chinese ? '创建后不能修改，用于班次要求和历史记录。' : 'Immutable after creation; used by shift requirements and history.'}</span></label><label className="text-sm font-bold text-slate-700">English<input value={form.nameEn} onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">中文<input value={form.nameZh} onChange={(event) => setForm((current) => ({ ...current, nameZh: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">{chinese ? '英文说明' : 'English description'}<textarea rows={3} value={form.descriptionEn} onChange={(event) => setForm((current) => ({ ...current, descriptionEn: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">{chinese ? '中文说明' : 'Chinese description'}<textarea rows={3} value={form.descriptionZh} onChange={(event) => setForm((current) => ({ ...current, descriptionZh: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950 sm:col-span-2"><input type="checkbox" checked={form.requiresExpiry} onChange={(event) => setForm((current) => ({ ...current, requiresExpiry: event.target.checked, defaultValidityDays: event.target.checked ? current.defaultValidityDays ?? 365 : null }))} className="mt-1 h-4 w-4" /><span>{chinese ? '这项资格必须设置有效期' : 'This qualification requires an expiry date'}<small className="mt-1 block font-normal text-amber-800">{chinese ? '适用于驾照、急救、儿童保护培训等需要定期复核的资格。' : 'Use for licences, first aid, safeguarding training, and other regularly reviewed qualifications.'}</small></span></label>{form.requiresExpiry ? <label className="text-sm font-bold text-slate-700 sm:col-span-2">{chinese ? '默认有效天数' : 'Default validity days'}<input type="number" min={1} max={3650} value={form.defaultValidityDays ?? ''} onChange={(event) => setForm((current) => ({ ...current, defaultValidityDays: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label> : null}<label className="flex items-center gap-3 text-sm font-bold text-slate-700 sm:col-span-2"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4" />{chinese ? '启用这项能力' : 'Capability is active'}</label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={closeForm} className="rounded-xl px-4 py-2 text-sm font-black text-slate-600">{chinese ? '取消' : 'Cancel'}</button><button type="button" disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{chinese ? '保存能力' : 'Save capability'}</button></div></div></section></div> : null}
  </main>
}

export default RosterCapabilityCatalogView
