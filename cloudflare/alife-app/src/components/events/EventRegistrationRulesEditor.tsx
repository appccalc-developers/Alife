import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { groupService } from '../../services/groupService'
import { inputStyle, localDateTime, registrationWorkService, type RegistrationRules } from '../../services/eventRegistrationWorkService'
import { normalizeApiError } from '../../services/http'
import type { LocalizedText } from '../../types/eventComposition'
import AppActionButton from '../layout/AppActionButton'
import AppSectionCard from '../layout/AppSectionCard'
import { setUnsavedChangesGuard } from '../../utils/unsavedChangesGuard'
import DetailsWorkspace from './creation/DetailsWorkspace'
import EventFormAssistant from './creation/EventFormAssistant'
import { DetailsBilingualField } from './creation/DetailsStep'
import { registrationAssistantForm, applyRegistrationAssistantForm } from '../../utils/eventFormAssistant'
import { revealArrangementControl } from './ArrangementTileDeck'
import { currencyScale } from '../../services/eventRegistrationWorkService'

export function BilingualRuleField({ label, value, onChange, required = false }: { label: string; value: LocalizedText; onChange: (value: LocalizedText) => void; required?: boolean }) {
  return <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">{label}{required ? ' *' : ''}</legend>{(['zh', 'en'] as const).map(lang => <label key={lang} className="grid gap-1 text-xs">{lang === 'zh' ? '中文' : 'English'}<textarea maxLength={10000} value={value?.[lang] || ''} onChange={e => onChange({ ...value, [lang]: e.target.value })} className={`${inputStyle} min-h-24`} /></label>)}</fieldset>
}
function RegistrationBilingualField({ field, label, value, onChange, required = false }: { field?: string; label: string; value: LocalizedText; onChange: (value: LocalizedText) => void; required?: boolean }) {
  const { language } = useAuthStore()
  return <DetailsBilingualField field={field || label} label={`${label}${required ? ' *' : ''}`} value={{ en: value?.en || '', zh: value?.zh || '' }} onChange={onChange} zh={language === 'zh'} multiline maxLength={10000} />
}
export default function EventRegistrationRulesEditor({ eventId, onDirty, onSaved, onBusy }: { eventId: string; onDirty?: (dirty: boolean) => void; onSaved?: () => void; onBusy?: (busy: boolean) => void }) {
  const { me, language } = useAuthStore(), zh = language === 'zh', cache = useQueryClient()
  const query = useQuery({ queryKey: ['registration-work', me?.id, eventId, 'rules'], queryFn: () => registrationWorkService.get(eventId), retry: false, gcTime: 0 })
  const groups = useQuery({ queryKey: ['registration-groups', me?.id], queryFn: () => groupService.getVisibleGroups(me?.id), enabled: Boolean(query.data?.canConfigure), gcTime: 0 })
  const [draft, setDraft] = useState<RegistrationRules | null>(null), [base, setBase] = useState(''), [saved, setSaved] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { setDraft(null); setBase(''); setSaved('') }, [eventId, me?.id])
  useEffect(() => {
    if (!query.data || base) return
    const blank = { en: '', zh: '' }, data = query.data
    const initial: RegistrationRules = data.policy?.rules ?? { purpose: blank, audience: 'group', eligibleGroupId: data.groupId, eligibility: blank, capacity: 30, opensUtc: new Date().toISOString(), deadlineUtc: data.eventStartUtc, allowWaitlist: true, channel: 'app', terms: blank, privacyNotice: blank, cancellationTerms: blank, manualReview: false, materials: [], feeMinor: 0, currency: 'NZD', paymentInstructions: blank, refundTerms: blank, moneyFlowScope: 'unspecified' }
    setDraft(initial); setSaved(JSON.stringify(initial)); setBase(data.policy?.eTag || '"registration-new"')
  }, [query.data, base])
  const [aiBusy, setAiBusy] = useState(false)
  const busyCallback = useRef(onBusy); busyCallback.current = onBusy
  useEffect(() => { busyCallback.current?.(busy || aiBusy) }, [busy, aiBusy])
  useEffect(() => () => busyCallback.current?.(false), [])
  const dirty = Boolean(draft && JSON.stringify(draft) !== saved)
  const callback = useRef(onDirty); callback.current = onDirty
  useEffect(() => { callback.current?.(dirty) }, [dirty])
  useEffect(() => () => callback.current?.(false), [])
  useEffect(() => {
    const scope = `registration-rules:${me?.id}:${eventId}`
    setUnsavedChangesGuard(dirty, zh ? '报名规则有未保存修改。' : 'Registration rules have unsaved changes.', 'confirm', scope)
    return () => setUnsavedChangesGuard(false, '', 'confirm', scope)
  }, [dirty, zh, me?.id, eventId])
  const update = <K extends keyof RegistrationRules>(key: K, value: RegistrationRules[K]) => setDraft(d => d ? { ...d, [key]: value } : d)
  const save = async () => {
    if (!draft || busy || aiBusy || !query.data?.canConfigure) return
    setBusy(true); setError('')
    try {
      const next = await registrationWorkService.rules(eventId, draft, base)
      setBase(next.eTag); setSaved(JSON.stringify(next.rules)); setDraft(next.rules)
      await cache.invalidateQueries({ queryKey: ['registration-work', me?.id, eventId] }); await cache.invalidateQueries({ queryKey: ['event-work', me?.id, eventId] }); onSaved?.()
    } catch (e) { setError(normalizeApiError(e).message) } finally { setBusy(false) }
  }
  if (!draft || !query.data) return <p role={query.error ? 'alert' : 'status'}>{query.error ? normalizeApiError(query.error).message : zh ? '正在读取报名方案…' : 'Loading registration plan…'}</p>
  return <AppSectionCard title={zh ? '报名规则与办理程序' : 'Registration rules and procedures'} subtitle={zh ? '这里制定规则。邀请、名单、材料和收款在报名工作空间处理。' : 'Define rules here. Invitations, participants, materials and receipts are handled in the registration workspace.'}>
    {error ? <p role="alert" className="mb-4 text-sm text-rose-800">{error}</p> : null}
    {!query.data.canConfigure ? <p className="mb-3 text-sm">{zh ? '当前为只读。只有活动总负责人可在方案开放编辑时修改规则。' : 'Read only. The event owner can change rules while the plan is open for editing.'}</p> : null}
    {query.data.policy && base !== query.data.policy.eTag ? <p role="alert" className="mb-3 text-amber-900">{zh ? '服务端规则已改变。你的草稿仍保留，请核对后重新读取。' : 'The saved rules changed. Your draft is retained; review before reloading.'}</p> : null}
    <DetailsWorkspace key={`${me?.id}:${eventId}`} zh={zh} active readOnly={busy || !query.data.canConfigure} limitAssistantHeight
      labels={{ workspace: zh ? '报名规则工作区' : 'Registration rules workspace', form: zh ? '报名规则表单' : 'Registration rules form', assistant: zh ? 'AI 报名资料助手' : 'AI registration assistant' }}
      assistant={active => <EventFormAssistant eventId={eventId} scope="registration" form={registrationAssistantForm(draft)} contextSignature={JSON.stringify([draft, base])} zh={zh} active={active} initiallyConfirmed={Boolean(query.data.policy)} onBusy={setAiBusy} onAdopt={(form, fields) => setDraft(current => current && JSON.stringify(current) === JSON.stringify(draft) ? applyRegistrationAssistantForm(current, form, fields, Intl.DateTimeFormat().resolvedOptions().timeZone) : current)} />}
      form={<form onInvalidCapture={e => revealArrangementControl(e.target as HTMLElement)} onSubmit={e => { e.preventDefault(); void save() }}><fieldset disabled={busy || !query.data.canConfigure} className="space-y-5">
      <RegistrationBilingualField label={zh ? '为什么需要报名' : 'Why registration is needed'} field="purpose" value={draft.purpose} onChange={v => update('purpose', v)} required />
      <div className="grid gap-4 sm:grid-cols-2"><label data-detail-field="audience" className="grid gap-2 text-sm">{zh ? '报名资格' : 'Eligible participants'}<select className={inputStyle} value={draft.audience} onChange={e => update('audience', e.target.value)}>{[['invited', '仅点名邀请', 'Named invitations'], ['group', '指定小组成员', 'Selected group members'], ['church', '本教会成员', 'Church members'], ['public', '符合公开范围的用户', 'Users within event visibility']].map(([v, cn, en]) => <option key={v} value={v}>{zh ? cn : en}</option>)}</select></label>
        {draft.audience === 'group' ? <label className="grid gap-2 text-sm">{zh ? '指定小组' : 'Eligible group'}<select className={inputStyle} value={draft.eligibleGroupId || query.data.groupId} onChange={e => update('eligibleGroupId', e.target.value)}><option value={query.data.groupId}>{zh ? '活动所属小组' : 'Event group'}</option>{groups.data?.filter(g => g.id !== query.data?.groupId).map(g => <option key={g.id} value={g.id}>{g.name[language] || g.name.en || g.name.zh}</option>)}</select></label> : null}
      </div>
      <RegistrationBilingualField label={zh ? '附加资格条件' : 'Additional eligibility conditions'} field="eligibility" value={draft.eligibility} onChange={v => update('eligibility', v)} />
      <div className="grid gap-4 sm:grid-cols-3"><label data-detail-field="capacity" className="grid gap-2 text-sm">{zh ? '人数上限（实际参加人数）' : 'Capacity (actual people)'}<input className={inputStyle} type="number" min={1} max={1000000} required value={draft.capacity} onChange={e => update('capacity', Number(e.target.value))} /></label>{(['opensUtc', 'deadlineUtc'] as const).map(k => <label data-detail-field={k === 'opensUtc' ? 'opensLocal' : 'deadlineLocal'} key={k} className="grid gap-2 text-sm">{k === 'opensUtc' ? zh ? '报名开放时间' : 'Opens' : zh ? '报名截止时间' : 'Deadline'}<input className={inputStyle} type="datetime-local" required value={localDateTime(draft[k])} onChange={e => e.target.value && update(k, new Date(e.target.value).toISOString())} /></label>)}</div>
      <p className="text-xs text-[#66766f]">{zh ? '时间按当前设备时区显示。邀请预留和家庭人数均计入总容量。' : 'Times use your device time zone. Invitation reservations and household members count toward capacity.'}</p>
      <label data-detail-field="allowWaitlist" className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.allowWaitlist} onChange={e => update('allowWaitlist', e.target.checked)} />{zh ? '满额后允许按顺序候补' : 'Allow a first-in-first-out waitlist'}</label>
      {(['terms', 'privacyNotice', 'cancellationTerms'] as const).map((k, i) => <RegistrationBilingualField field={k} key={k} label={(zh ? ['参加规则', '隐私说明', '取消条款'] : ['Participation rules', 'Privacy notice', 'Cancellation terms'])[i]} value={draft[k]} onChange={v => update(k, v)} required />)}
      <label data-detail-field="channel" className="grid gap-2 text-sm">{zh ? '办理渠道' : 'Registration channel'}<select className={inputStyle} value={draft.channel} onChange={e => update('channel', e.target.value)}>{[['app', 'App 内办理', 'In app'], ['manual', '人工登记', 'Manual entry'], ['both', '两者并用', 'Both']].map(([v, cn, en]) => <option key={v} value={v}>{zh ? cn : en}</option>)}</select></label>
      <ol className="list-decimal space-y-2 pl-5 text-sm">{(zh ? ['填写每位参加者资料', '本人或监护人同意规则；无账号访客核实线下同意', '提交要求的文字和材料', '需要收费时核实付款', '需要人工审核时核实资格和材料', '完成手续并检查名额状态'] : ['Enter each participant', 'Personal or guardian consent; verified offline consent for guests', 'Submit required answers and materials', 'Verify payment when fees apply', 'Review eligibility and materials when required', 'Complete procedures and check place status']).map(step => <li key={step}>{step}</li>)}</ol>
      <label data-detail-field="manualReview" className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.manualReview} onChange={e => update('manualReview', e.target.checked)} />{zh ? '报名负责人须人工核实资格和材料' : 'Require manager verification of eligibility and materials'}</label>
      <div data-detail-field="materials" tabIndex={-1} className="space-y-4"><h3 className="font-semibold">{zh ? '每位参加者的材料要求' : 'Requirements for each participant'}</h3>{draft.materials.map((m, i) => <fieldset key={m.id} className="space-y-3 rounded-xl border p-4"><legend className="px-2 text-sm">{zh ? '材料' : 'Requirement'} {i + 1}</legend><RegistrationBilingualField label={zh ? '材料名称与说明' : 'Name and instructions'} value={m.label} onChange={v => update('materials', draft.materials.map(x => x.id === m.id ? { ...x, label: v } : x))} required /><label className="grid gap-2 text-sm">{zh ? '类型' : 'Type'}<select className={inputStyle} value={m.kind} onChange={e => update('materials', draft.materials.map(x => x.id === m.id ? { ...x, kind: e.target.value as typeof m.kind } : x))}>{[['text', '文字', 'Text'], ['image', 'JPG / PNG', 'JPG / PNG'], ['file', 'JPG / PNG / PDF / TXT', 'JPG / PNG / PDF / TXT']].map(([v, cn, en]) => <option key={v} value={v}>{zh ? cn : en}</option>)}</select></label><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={m.required} onChange={e => update('materials', draft.materials.map(x => x.id === m.id ? { ...x, required: e.target.checked } : x))} />{zh ? '必填' : 'Required'}</label>{m.kind !== 'text' ? <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm">{zh ? '最多文件数' : 'Maximum files'}<input className={inputStyle} type="number" min={1} max={10} value={m.maxCount} onChange={e => update('materials', draft.materials.map(x => x.id === m.id ? { ...x, maxCount: Number(e.target.value) } : x))} /></label><label className="grid gap-2 text-sm">{zh ? '单个文件上限（MB）' : 'Limit per file (MB)'}<input className={inputStyle} type="number" min={1} max={20} value={m.maxBytes / 1048576} onChange={e => update('materials', draft.materials.map(x => x.id === m.id ? { ...x, maxBytes: Number(e.target.value) * 1048576 } : x))} /></label></div> : null}<AppActionButton onClick={() => update('materials', draft.materials.filter(x => x.id !== m.id))}>{zh ? '移除此要求' : 'Remove requirement'}</AppActionButton></fieldset>)}<AppActionButton disabled={draft.materials.length >= 20} onClick={() => update('materials', [...draft.materials, { id: crypto.randomUUID(), label: { en: '', zh: '' }, kind: 'text', required: true, maxCount: 1, maxBytes: 10485760 }])}>{zh ? '添加材料要求' : 'Add requirement'}</AppActionButton></div>
      <div className="grid gap-4 sm:grid-cols-2"><label data-detail-field="feeMinor" className="grid gap-2 text-sm">{zh ? '每人报名费' : 'Fee per person'}<input type="number" className={inputStyle} min={0} max={100000000 / currencyScale(draft.currency)} step={1 / currencyScale(draft.currency)} value={draft.feeMinor / currencyScale(draft.currency)} onChange={e => update('feeMinor', Math.round(Number(e.target.value) * currencyScale(draft.currency)))} /></label><label data-detail-field="currency" className="grid gap-2 text-sm">{zh ? '币种' : 'Currency'}<input className={inputStyle} required minLength={3} maxLength={3} value={draft.currency} onChange={e => update('currency', e.target.value.toUpperCase())} /></label></div>
      {draft.feeMinor > 0 ? <><label data-detail-field="moneyFlowScope" className="grid gap-2 text-sm">{zh ? '本活动的金流范围' : 'Money flows in this event'}<select className={inputStyle} value={draft.moneyFlowScope} onChange={e => update('moneyFlowScope', e.target.value)}><option value="unspecified">{zh ? '请选择' : 'Select'}</option><option value="registrationFeesOnly">{zh ? '仅报名费及其退款' : 'Registration fees and their refunds only'}</option><option value="otherMoney">{zh ? '还涉及其他金流（目前不支持）' : 'Includes other money flows (not supported)'}</option></select></label><RegistrationBilingualField label={zh ? '收付款说明' : 'Payment instructions'} field="paymentInstructions" value={draft.paymentInstructions} onChange={v => update('paymentInstructions', v)} required /><RegistrationBilingualField label={zh ? '退款条款' : 'Refund terms'} field="refundTerms" value={draft.refundTerms} onChange={v => update('refundTerms', v)} required /><p className="text-sm">{zh ? '保存后由收款负责人提交独立审批。规则改动会要求重新审批。' : 'The finance owner submits the saved fee plan for independent approval. Rule changes require a new approval.'}</p></> : null}
      {query.data.canConfigure ? <AppActionButton type="submit" disabled={busy || aiBusy || !dirty && Boolean(query.data.policy)}>{busy ? zh ? '保存中…' : 'Saving…' : zh ? '保存报名方案' : 'Save registration plan'}</AppActionButton> : null}
    </fieldset></form>} />
    <Link className="mt-5 inline-flex min-h-11 items-center font-semibold text-[#176b5a]" to={`/events/${eventId}/registration-work`}>{zh ? '进入报名办理空间' : 'Open registration workspace'}</Link>
  </AppSectionCard>
}
