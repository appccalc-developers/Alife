import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ramService } from '../../services/ramGovernanceService'
import { normalizeApiError } from '../../services/http'
import { setUnsavedChangesGuard } from '../../utils/unsavedChangesGuard'
import type { RamDraft, RamPrint, RamWorkspace } from '../../types/ramGovernance'
import { displayRamText as text, ramActionLabels, ramValidityLabels, upgradeRam } from '../../types/ramGovernance'
import { RamLevelBadge, ramInput } from './RamFields'
import NativeSectionCard from '../layout/AppSectionCard'
import { EventToolSection as AppSectionCard } from './ArrangementTileDeck'
import AppActionButton from '../layout/AppActionButton'
import AppConfirmationModal from '../layout/AppConfirmationModal'
import RamPrintView from './RamPrintView'
import RamLegacyDetails from './RamLegacyDetails'
import RamDraftEditor, { RamChangeList } from './RamDraftEditor'
import { ramChanges } from '../../utils/ramAuthoring'
import { useAuthStore } from '../../stores/auth'
import RamEventPlanContext from './RamEventPlanContext'

export default function EventRamWorkspace({ eventId, language, onDirtyChange, onBusyChange, onSaved, beforeAction, pendingEventChanges = false, showEventPlan = false }: { eventId: string; language: string; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void; onSaved?: () => Promise<void>; beforeAction?: () => Promise<void>; pendingEventChanges?: boolean; showEventPlan?: boolean }) {
  const zh = language === 'zh'
  const viewerId = useAuthStore().me?.id
  const loadSequence = useRef(0)
  const [workspace, setWorkspace] = useState<RamWorkspace | null>(null)
  const [draft, setDraft] = useState<RamDraft | null>(null)
  const [policyId, setPolicyId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [authoringBusy, setAuthoringBusy] = useState(false)
  const [comparison, setComparison] = useState<RamPrint | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [signed, setSigned] = useState(false)
  const [print, setPrint] = useState<RamPrint | null>(null)
  const [historyPage, setHistoryPage] = useState(0)
  const [historySort, setHistorySort] = useState('desc')
  const [historyFilter, setHistoryFilter] = useState('')
  const attempt = useRef<{ signature: string; key: string } | null>(null)
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    const data = await ramService.workspace(eventId)
    if (sequence !== loadSequence.current) return
    setWorkspace(data); setDraft(upgradeRam(data.assessment?.ramDataJson)); setDirty(false)
    setPolicyId(data.assessment?.schemaVersion === 2 ? data.assessment.policyVersionId : data.policy?.id || null)
  }, [eventId, viewerId])
  useEffect(() => { let live = true; setWorkspace(null); setDraft(null); setPrint(null); setError(''); void load().catch(e => { if (live) setError(normalizeApiError(e).message) }); return () => { live = false; loadSequence.current++ } }, [load])
  useEffect(() => { setUnsavedChangesGuard(dirty, zh ? 'RAM 有未保存修改。' : 'RAM has unsaved changes.', 'confirm'); return () => setUnsavedChangesGuard(false) }, [dirty, zh])
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => { onBusyChange?.(busy || authoringBusy); return () => onBusyChange?.(false) }, [busy, authoringBusy, onBusyChange])
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); setSuccess(false); try { await work(); setSuccess(true) } catch (e) { setError(normalizeApiError(e).message); setPending(null) } finally { setBusy(false) } }
  const update = (change: Partial<RamDraft>) => { setDraft(d => { if (!d) return d; const next = { ...d, ...change }; setDirty(JSON.stringify(next) !== JSON.stringify(upgradeRam(workspace?.assessment?.ramDataJson))); return next }); setSuccess(false) }
  const save = () => run(async () => {
    if (!draft) return
    await beforeAction?.()
    const record = await ramService.save(eventId, draft, policyId, workspace?.assessment?.eTag || 'new')
    setWorkspace(w => w ? { ...w, assessment: record } : w); setDraft(upgradeRam(record.ramDataJson)); setDirty(false); await onSaved?.()
  })
  const act = (action: string) => run(async () => {
    const ram = workspace?.assessment
    if (!ram) return
    await beforeAction?.()
    const signature = JSON.stringify([action, ram.eTag, ram.currentRevisionId, reason, signed])
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() }
    await ramService.action(eventId, action, ram.eTag, ram.currentRevisionId, reason, signed, attempt.current.key)
    attempt.current = null; setPending(null); await load(); await onSaved?.()
  })
  if (!workspace || !draft) return <AppSectionCard title="RAM"><p role={error ? 'alert' : 'status'}>{error || (zh ? '正在载入 RAM…' : 'Loading RAM…')}</p>{error ? <AppActionButton onClick={() => void run(load)}>{zh ? '重试' : 'Retry'}</AppActionButton> : null}</AppSectionCard>
  const ram = workspace.assessment
  const current = workspace.history.find(r => r.id === ram?.currentRevisionId)
  const editable = workspace.canEdit && !busy
  const actionsDisabled = pendingEventChanges || busy || authoringBusy || dirty || ram?.schemaVersion !== 2
  const policy = workspace.policy?.data
  const previousSubmitted = workspace.history.filter(r => workspace.actions.some(a => a.revisionId === r.id && (a.action === 'submit' || a.action === 'legacy-submitted'))).sort((a, b) => b.version - a.version)[0]
  const history = workspace.history.filter(r => !historyFilter || String(r.version).includes(historyFilter)).sort((a, b) => historySort === 'desc' ? b.version - a.version : a.version - b.version)
  const titles: Record<string, string> = { 'request-confirmation': zh ? '固定版本并请求本人确认' : 'Freeze version and request personal confirmation', confirm: zh ? '本人确认出席并领导此版本活动' : 'I confirm I will attend and lead this version', submit: zh ? '申请 RAM 独立审核' : 'Request independent RAM review', approve: zh ? '通过 RAM 独立审核' : 'Approve independent RAM review', return: zh ? '退回修改' : 'Return for changes', 'request-review': zh ? '请求重审' : 'Request re-review', 'snapshot-draft': zh ? '保存打印快照' : 'Save print snapshot' }
  return <div className="space-y-5" data-ram-workspace>
    {showEventPlan && workspace.eventPlanContext ? <RamEventPlanContext context={workspace.eventPlanContext} zh={zh} /> : null}
    {comparison ? <NativeSectionCard title={zh ? `与 v${comparison.revision.version} 对照` : `Compare with v${comparison.revision.version}`}><RamChangeList changes={ramChanges(upgradeRam(comparison.ramDataJson), draft)} zh={zh} /><p className="mt-3 text-sm">{comparison.actions.filter(a => a.action === 'return').map(a => a.reason).join('；')}</p></NativeSectionCard> : null}
    <NativeSectionCard title={zh ? '风险评估与管理' : 'Risk Assessment and Management'} subtitle={zh ? '识别 → 初始评分 → 控制 → 剩余评分 → 本人确认 → 独立审核' : 'Identify → initial rating → controls → residual rating → personal confirmation → independent review'}>
      <div className="flex flex-wrap items-center gap-3"><strong>{text(ramValidityLabels[ram?.validity || 'Draft'], zh)}</strong><span className="text-sm">{zh ? '已保存评分' : 'Saved rating'}</span><RamLevelBadge level={ram?.residualLevel} zh={zh} /><span className="text-sm">{workspace.isRequired ? (zh ? '此活动必须提供 RAM' : 'RAM is required for this event') : (zh ? '所有正式 RAM 均需独立审核' : 'Every formal RAM requires independent review')}</span></div>
      {ram?.schemaVersion === 1 ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">{zh ? '旧版资料和批准保留。首次保存新版会进入新版规则；旧评分仅作为初始评分，剩余评分与签署须人工完成。' : 'Legacy records and approvals are retained. Saving an upgrade starts the new rules; old ratings become initial ratings only. Residual ratings and signatures require human completion.'}</p> : null}
      {!workspace.policy ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">{zh ? '所属教会尚未发布 RAM 政策。可保存草稿，暂不能请求确认或正式提交。' : 'This church has no published RAM policy. Drafts can be saved; confirmation and formal submission are blocked.'}</p> : <p className="mt-3 text-sm">{zh ? '教会政策版本' : 'Church policy version'}: {workspace.policy.version} {policyId !== workspace.policy.id && workspace.canEdit ? <AppActionButton variant="secondary" onClick={() => { setPolicyId(workspace.policy!.id); setDirty(true) }}>{zh ? '使用当前发布政策' : 'Use current published policy'}</AppActionButton> : null}</p>}
      <p className="mt-3 text-sm text-[#66766f]">{zh ? '评分和等级在保存时由服务器计算。修改任何内容都需要重新确认；当活动方案要求 RAM 时，必须先通过独立审核才能提交整个活动方案审批包。' : 'Scores and levels are calculated by the server when saved. Any content change requires fresh confirmation. When the Event Plan requires RAM, independent review must pass before the Event Package can be submitted.'}</p>
      {workspace.canEdit && workspace.latestPolicy && workspace.latestPolicy.id !== policyId ? <AppActionButton variant="secondary" disabled={busy} onClick={() => { setPolicyId(workspace.latestPolicy!.id); setWorkspace(w => w ? { ...w, policy: w.latestPolicy || null } : w); setDirty(true) }}>{zh ? `采用最新政策 v${workspace.latestPolicy.version}` : `Adopt latest policy v${workspace.latestPolicy.version}`}</AppActionButton> : null}
      {pendingEventChanges ? <p className="mt-3 text-sm text-amber-800">{zh ? '活动资料或安排尚未保存。可填写并保存 RAM 草稿；请保存活动修改后再确认或提交审核。' : 'Event details or arrangements are unsaved. You can save a RAM draft; save Event changes before confirmation or review.'}</p> : null}
      {error ? <p role="alert" className="mt-3 whitespace-pre-wrap rounded-xl bg-red-50 p-3 text-sm text-red-900">{zh ? '请核对以下问题后重试：\n' : ''}{error}</p> : null}
      {success ? <p role="status" className="mt-3 text-sm text-emerald-800">{zh ? '操作已完成。' : 'Action completed.'}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">{workspace.canEdit ? <AppActionButton disabled={busy} onClick={() => void save()}>{busy ? (zh ? '处理中…' : 'Working…') : (zh ? '保存 RAM 草稿' : 'Save RAM draft')}</AppActionButton> : null}
        <AppActionButton variant="secondary" disabled={busy || dirty} onClick={() => void run(load)}>{zh ? '刷新状态' : 'Refresh status'}</AppActionButton>
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 underline" to={`/events/${eventId}/ram`}>{zh ? '本人确认专用页面' : 'Personal confirmation page'}</Link>
      </div>
    </NativeSectionCard>
    {ram ? <RamLegacyDetails json={ram.ramDataJson} zh={zh} /> : null}
    {previousSubmitted ? <NativeSectionCard title={zh ? '上一提交版本与退回意见' : 'Last submitted version and return comments'}><AppActionButton disabled={busy} onClick={() => void run(async () => setComparison(await ramService.version(eventId, previousSubmitted.id)))}>{zh ? `与上一提交 v${previousSubmitted.version} 对照` : `Compare with last submitted v${previousSubmitted.version}`}</AppActionButton>{workspace.actions.filter(a => a.revisionId === previousSubmitted.id && a.action === 'return').map(a => <p key={a.id} className="mt-3 whitespace-pre-wrap text-sm text-amber-900">{a.reason}</p>)}</NativeSectionCard> : null}
    <RamDraftEditor eventId={eventId} {...{ draft, update, policy, editable, dirty, zh }} policyVersionId={policyId} savedDraft={upgradeRam(ram?.ramDataJson)} conditionsKey={JSON.stringify(workspace.eventPlanContext)} contextVersion={ram?.eTag} assistanceDisabled={pendingEventChanges} onBusy={setAuthoringBusy} />
    <div data-ram-field="ram.onsite"><AppSectionCard summary={text(ramValidityLabels[ram?.validity || 'Draft'], zh)} title={zh ? '本人确认与 RAM 独立审核' : 'Personal confirmation and independent RAM review'}>
      <div className="space-y-4"><label className="block text-sm font-semibold">{zh ? '填表人是否亲自出席并领导？' : 'Will the author personally attend and lead?'}<select className={ramInput} disabled={!editable} value={draft.authorAttendsAndLeads === null ? '' : String(draft.authorAttendsAndLeads)} onChange={e => update({ authorAttendsAndLeads: e.target.value === '' ? null : e.target.value === 'true', onsiteMemberId: null })}><option value="">{zh ? '请选择' : 'Choose'}</option><option value="true">{zh ? '是' : 'Yes'}</option><option value="false">{zh ? '否，由已接受职责的成员负责' : 'No, another member with an accepted duty will lead'}</option></select></label>
        {draft.authorAttendsAndLeads === false ? <label className="block text-sm">{zh ? '现场负责人' : 'On-site leader'}<select className={ramInput} disabled={!editable} value={draft.onsiteMemberId || ''} onChange={e => update({ onsiteMemberId: e.target.value || null })}><option value="">{zh ? '选择已接受活动职责的成员' : 'Select a member with an accepted Event duty'}</option>{workspace.onsiteCandidates.map(p => <option key={p.memberId} value={p.memberId}>{p.name}</option>)}</select></label> : null}
        {current ? <p className="break-all text-xs">{zh ? '待操作的固定版本' : 'Immutable version for this action'}: v{current.version} · {current.contentHash}</p> : null}
        <label className="block text-sm">{zh ? '审核／重审说明' : 'Review / re-review reason'}<textarea className={ramInput} rows={3} value={reason} onChange={e => setReason(e.target.value)} /></label>
        {workspace.canAudit && ram?.residualLevel === 'Red' ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} />{zh ? '我明确签署此版本的健康安全审核；活动方案仍须加强审批。' : 'I explicitly sign the health and safety review for this version; Enhanced Event Package approval is still required.'}</label> : null}
        <div className="flex flex-wrap gap-2">{workspace.canEdit ? <><AppActionButton disabled={actionsDisabled || !workspace.policy} onClick={() => setPending('request-confirmation')}>{titles['request-confirmation']}</AppActionButton><AppActionButton disabled={actionsDisabled || ram?.validity !== 'Confirmed'} onClick={() => setPending('submit')}>{titles.submit}</AppActionButton><AppActionButton variant="secondary" disabled={actionsDisabled} onClick={() => void act('snapshot-draft')}>{titles['snapshot-draft']}</AppActionButton></> : null}
          {current?.onsiteMemberId === workspace.currentMemberId ? <AppActionButton disabled={actionsDisabled || ram?.validity !== 'AwaitingConfirmation'} onClick={() => setPending('confirm')}>{titles.confirm}</AppActionButton> : null}
          {workspace.canAudit ? <><AppActionButton disabled={actionsDisabled || ram?.validity !== 'AwaitingReview'} onClick={() => setPending('approve')}>{titles.approve}</AppActionButton><AppActionButton variant="secondary" disabled={actionsDisabled || ram?.validity !== 'AwaitingReview' || !reason.trim()} onClick={() => setPending('return')}>{titles.return}</AppActionButton></> : null}
          {workspace.canEdit || workspace.canAudit ? <AppActionButton variant="secondary" disabled={pendingEventChanges || busy || authoringBusy || dirty || !ram || !reason.trim()} onClick={() => setPending('request-review')}>{titles['request-review']}</AppActionButton> : null}
        </div>
      </div>
    </AppSectionCard>
    </div><AppSectionCard summary={zh ? `${workspace.history.length} 个固定版本` : `${workspace.history.length} saved versions`} title={zh ? '版本与签署历史' : 'Version and signature history'}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">{zh ? '过滤版本号' : 'Filter version number'}<input className={ramInput} value={historyFilter} onChange={e => { setHistoryFilter(e.target.value); setHistoryPage(0) }} /></label><label className="text-sm">{zh ? '排序' : 'Sort'}<select className={ramInput} value={historySort} onChange={e => setHistorySort(e.target.value)}><option value="desc">{zh ? '最新在前' : 'Newest first'}</option><option value="asc">{zh ? '最旧在前' : 'Oldest first'}</option></select></label></div>
      {!history.length ? <p className="text-sm">{zh ? '暂无固定版本。可保存打印快照，或请求本人确认。' : 'No fixed versions yet. Save a print snapshot or request personal confirmation.'}</p> : history.slice(historyPage * 5, historyPage * 5 + 5).map(r => <details className="border-b py-3" key={r.id}><summary className="min-h-11 cursor-pointer font-semibold">v{r.version} · {r.createdUtc} · <RamLevelBadge zh={zh} level={r.residualLevel} /></summary><div className="space-y-3 pb-3"><p className="break-all text-xs">{r.contentHash}</p>{workspace.actions.filter(a => a.revisionId === r.id).map(a => <p className="break-words text-sm" key={a.id}>{text(ramActionLabels[a.action], zh) || a.action} · {a.createdUtc} · {a.actorMemberId}<br />{a.reason}</p>)}<AppActionButton variant="secondary" disabled={busy} onClick={() => void run(async () => setPrint(await ramService.version(eventId, r.id)))}>{zh ? '查看此版本／打印' : 'View version / print'}</AppActionButton><AppActionButton variant="secondary" disabled={busy} onClick={() => void run(async () => setComparison(await ramService.version(eventId, r.id)))}>{zh ? '对照此版本' : 'Compare this version'}</AppActionButton></div></details>)}
      <div className="mt-3 flex items-center gap-3"><AppActionButton variant="secondary" disabled={historyPage === 0} onClick={() => setHistoryPage(p => p - 1)}>{zh ? '上一页' : 'Previous'}</AppActionButton><span>{historyPage + 1} / {Math.max(1, Math.ceil(history.length / 5))}</span><AppActionButton variant="secondary" disabled={(historyPage + 1) * 5 >= history.length} onClick={() => setHistoryPage(p => p + 1)}>{zh ? '下一页' : 'Next'}</AppActionButton></div>
    </AppSectionCard>
    <AppConfirmationModal open={pending !== null} title={titles[pending || ''] || ''} description={zh ? `此操作针对当前保存的 RAM 内容${current ? `（v${current.version}）` : ''}。本人确认不可代签，后续修改会使签署失效。` : `This action applies to the saved RAM content${current ? ` (v${current.version})` : ''}. Personal confirmation cannot be signed by proxy; later edits invalidate signatures.`} confirmLabel={titles[pending || ''] || ''} cancelLabel={zh ? '取消' : 'Cancel'} closeLabel={zh ? '关闭' : 'Close'} busy={busy} onCancel={() => setPending(null)} onConfirm={() => { if (pending) void act(pending) }} />
    {print ? <RamPrintView document={print} zh={zh} onClose={() => setPrint(null)} /> : null}
  </div>
}
