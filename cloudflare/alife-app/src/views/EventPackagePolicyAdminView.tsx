import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AppModal from '../components/layout/AppModal'
import AppConfirmationModal from '../components/layout/AppConfirmationModal'
import EventPolicyForm, { modeLabel, policyFieldClass, sectionLabel, policySummary } from '../components/events/EventPolicyForm'
import { eventPackagePolicyAdminService as service } from '../services/eventPackagePolicyAdminService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { EventPackagePolicyAdmin, EventPackageRolloutReport, PolicyEditorDefaults, PolicyImpact, PolicyRules, PublishEventPackagePolicyRequest } from '../types/eventPackagePolicyAdmin'
import { changedPolicySections, createPolicyDraft, isCurrentPolicy, readPolicyRules } from '../utils/eventPackagePolicyEditor'
import { setUnsavedChangesGuard, confirmUnsavedChangesNavigation } from '../utils/unsavedChangesGuard'
import SystemManagementFrame from './admin/SystemManagementFrame'

const policyError = (reason: unknown, zh: boolean) => {
  const failure = normalizeApiError(reason)
  if (failure.status === 403) return zh ? '你没有管理活动方案政策的权限。' : 'You do not have permission to manage Event Package policies.'
  if (failure.status === 409) return zh ? '当前政策或受影响的审批已变化，或版本名称已被使用。请刷新并重新审阅。' : 'The current policy or affected approvals changed, or the version name is already used. Refresh and review again.'
  if (failure.status === 400 || failure.status === 422) return zh ? '规则未通过校验。请核对审批人数、有效期、委托级别、触发条件和过渡日期。' : 'The rules did not pass validation. Check approver counts, validity, delegation tiers, triggers and transition dates.'
  return zh ? '暂时无法完成请求。你的草稿仍然保留，请重试。' : 'The request could not be completed. Your draft is retained; please retry.'
}

export default function EventPackagePolicyAdminView() {
  const { language } = useAuthStore()
  const navigate = useNavigate()
  const zh = language === 'zh'
  const [policies, setPolicies] = useState<EventPackagePolicyAdmin[]>([])
  const [catalog, setCatalog] = useState<PolicyEditorDefaults | null>(null)
  const [rollout, setRollout] = useState<EventPackageRolloutReport | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<PublishEventPackagePolicyRequest | null>(null)
  const [preview, setPreview] = useState<PolicyImpact | null>(null)
  const [pendingSelect, setPendingSelect] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [failureReason, setFailureReason] = useState<unknown>(null)
  const error = failureReason ? policyError(failureReason, zh) : ''
  const setError = (value: unknown) => setFailureReason(value)
  const [reportError, setReportError] = useState(false)
  const [success, setSuccess] = useState(false)
  const lock = useRef(false)
  const attempt = useRef<{ request: PublishEventPackagePolicyRequest; key: string } | null>(null)
  const current = policies.find(p => isCurrentPolicy(p))
  const selected = policies.find(p => p.id === selectedId)
  const selectedRules = useMemo(() => {
    if (!selected || !catalog) return null
    try { return readPolicyRules(selected.rules, catalog) } catch { return null }
  }, [selected, catalog])

  const loadReport = useCallback(async () => {
    try { setRollout(await service.rolloutReport()); setReportError(false) } catch { setReportError(true) }
  }, [])
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [list, defaults] = await Promise.all([service.list(), service.defaults()])
      setPolicies(list); setCatalog(defaults); setSelectedId((list.find(p => isCurrentPolicy(p)) ?? list[0])?.id ?? '')
    } catch (reason) { setError(reason) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); void loadReport() }, [load, loadReport])
  useEffect(() => {
    setUnsavedChangesGuard(!!draft, zh ? '政策草稿尚未发布，离开将丢失修改。' : 'The policy draft is not published. Leaving will discard changes.', 'confirm')
    return () => setUnsavedChangesGuard(false)
  }, [draft, zh])
  const discard = (id: string) => { setDraft(null); setPreview(null); attempt.current = null; setSelectedId(id); setError('') }
  const start = (source?: EventPackagePolicyAdmin) => {
    if (!catalog) return
    try { setDraft(createPolicyDraft(catalog, source, current)); setPreview(null); attempt.current = null; setError(''); setSuccess(false) }
    catch { setError(zh ? '此版本包含不支持的规则，无法安全恢复。' : 'This version contains unsupported rules and cannot be safely restored.') }
  }
  const edit = (patch: Partial<PublishEventPackagePolicyRequest>) => { setDraft(d => d ? { ...d, ...patch } : d); setPreview(null); attempt.current = null }
  const review = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const impact = await service.preview(draft)
      attempt.current = { request: { ...draft, impactToken: impact.impactToken }, key: crypto.randomUUID() }
      setPreview(impact)
    } catch (reason) { setError(reason) }
    finally { lock.current = false; setBusy(false) }
  }
  const publish = async () => {
    if (!attempt.current || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      await service.publish(attempt.current.request, attempt.current.key)
      setDraft(null); setPreview(null); attempt.current = null; setSuccess(true)
      await load(); void loadReport()
    } catch (reason) {
      const failure = normalizeApiError(reason)
      setError(reason)
      if (failure.status === 409) { setPreview(null); attempt.current = null }
    } finally { lock.current = false; setBusy(false) }
  }
  const displayedRules = draft?.rules as PolicyRules | undefined ?? selectedRules
  const currentRules = useMemo(() => { if (!current || !catalog) return null; try { return readPolicyRules(current.rules, catalog) } catch { return null } }, [current, catalog])
  const changes = draft ? changedPolicySections(current?.rules, draft.rules as PolicyRules) : []
  const choose = (id: string) => { if (draft) setPendingSelect(id); else discard(id) }
  return <AppPageShell><div onClickCapture={event => {
    const link = (event.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
    if (!draft || !link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    if (!confirmUnsavedChangesNavigation(link.href, () => { setUnsavedChangesGuard(false); navigate(link.pathname + link.search + link.hash) })) event.preventDefault()
  }}><SystemManagementFrame title={zh ? '活动方案治理政策' : 'Event Package governance policies'} subtitle={zh ? '用清楚的规则管理审批；每次发布保留完整版本历史。' : 'Manage approval with clear rules and a retained publication history.'} language={language} iconKey="eventPackagePolicies" bodyClassName="space-y-5 p-4 sm:p-5 lg:p-6">
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{zh ? '政策已发布并生效。历史版本和审批记录已保留。' : 'The policy is published and effective. Version and approval history are retained.'}</p>}
    {error && !preview && <div role="alert" className="space-y-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p><AppActionButton disabled={busy || loading} onClick={() => draft ? setPendingSelect(selectedId) : void load()}>{zh ? '刷新政策列表' : 'Refresh policies'}</AppActionButton></div>}
    {loading ? <p role="status">{zh ? '正在读取政策…' : 'Loading policies…'}</p> : catalog && <>
      <AppSectionCard title={zh ? '政策版本' : 'Policy version'}>
        <label className="block text-sm">{zh ? '选择查看的版本' : 'Select a version'}<select aria-label={zh ? '选择查看的版本' : 'Select a version'} className={policyFieldClass} disabled={busy || !policies.length} value={selectedId} onChange={e => choose(e.target.value)}>{!policies.length && <option value="">{zh ? '尚无已发布版本' : 'No published versions'}</option>}{policies.map(p => <option key={p.id} value={p.id}>{p.version} · {isCurrentPolicy(p) ? (zh ? '当前生效' : 'Current') : (zh ? '历史版本' : 'Historical')} · {modeLabel(p.enforcementMode, zh)} · {new Date(p.publishedUtc).toLocaleString(zh ? 'zh-CN' : 'en-AU')}</option>)}</select></label>
        {selected && <p className="mt-3 text-sm text-[#66766f]">{zh ? '发布时间：' : 'Published: '}{new Date(selected.publishedUtc).toLocaleString(zh ? 'zh-CN' : 'en-AU')}{zh ? ' · 发布人：' : ' · Publisher: '}{selected.publishedByDisplayName || (zh ? '身份保留在审计记录中' : 'Identity retained in audit history')}</p>}
        {!current && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{zh ? '尚无有效的全局政策。生成审批包前，请初始化政策或恢复历史版本。' : 'No effective global policy exists. Initialize a policy or restore a version before generating packages.'}</p>}
        {!draft && <div className="mt-4 flex flex-wrap gap-3">{!current && <AppActionButton variant="primary" onClick={() => start()}>{zh ? '初始化试运行政策' : 'Initialize a dry-run policy'}</AppActionButton>}{selected && <AppActionButton disabled={!selectedRules} variant={current ? 'primary' : 'secondary'} onClick={() => start(selected)}>{isCurrentPolicy(selected) ? (zh ? '基于当前版本编辑' : 'Edit from current version') : (zh ? '以此版本恢复' : 'Restore from this version')}</AppActionButton>}</div>}
      </AppSectionCard>
      {displayedRules && <AppSectionCard title={draft ? (zh ? '新版本草稿' : 'New version draft') : (zh ? '已发布规则（只读）' : 'Published rules (read-only)')}>
        <form onSubmit={review} className="space-y-5">
          {draft && <><label className="block text-sm">{zh ? '新版本名称' : 'New version name'}<input required maxLength={40} className={policyFieldClass} disabled={busy} value={draft.version} onChange={e => edit({ version: e.target.value })} /></label><p className="text-sm text-[#66766f]">{draft.sourcePolicyId ? (zh ? '从所选版本复制规则。生效时间已更新，过渡期限重置为 90 天后，请核对后发布。恢复不会重新激活旧审批。' : 'Rules are copied from the selected version. Effective time is renewed and the transition deadline reset to 90 days; review before publishing. Restoration never reactivates old approvals.') : (zh ? '默认值来自服务器。只有明确确认发布后才会生效。' : 'Defaults come from the server. They become effective only after explicit publication.')}</p></>}
          <EventPolicyForm rules={displayedRules} mode={draft?.enforcementMode ?? selected!.enforcementMode} catalog={catalog} zh={zh} disabled={!draft || busy} onRules={rules => edit({ rules })} onMode={enforcementMode => edit({ enforcementMode })} />
          {draft && <div className="flex flex-wrap gap-3"><AppActionButton type="submit" variant="primary" disabled={busy}>{busy ? (zh ? '正在处理…' : 'Working…') : (zh ? '预览变更与审批影响' : 'Preview changes and approval impact')}</AppActionButton><AppActionButton disabled={busy} onClick={() => setPendingSelect(selectedId)}>{zh ? '放弃草稿' : 'Discard draft'}</AppActionButton></div>}
        </form>
      </AppSectionCard>}
      {selected && !selectedRules && !draft && <p role="alert">{zh ? '此历史版本包含不可编辑的规则或已停用条件。已保留原始记录，不会自动转换。' : 'This version contains unsupported rules or retired conditions. Its original record is retained without automatic conversion.'}</p>}
    </>}
    <AppSectionCard title={zh ? '近 30 天试运行记录' : 'Dry-run observations over 30 days'}>
      {reportError ? <div role="alert"><p>{zh ? '试运行记录读取失败。' : 'Could not load dry-run observations.'}</p><AppActionButton onClick={() => void loadReport()}>{zh ? '重试' : 'Retry'}</AppActionButton></div> : rollout ? <><div className="grid gap-3 text-sm md:grid-cols-3">{[[rollout.evaluatedOperationCount, zh ? '已观测操作' : 'Observed operations'], [rollout.wouldBlockOperationCount, zh ? '正式执行时将被拦截' : 'Would be blocked'], [rollout.affectedEventCount, zh ? '涉及活动' : 'Affected events']].map(([count, label]) => <div key={label} className="rounded-xl bg-[#f4f8f6] p-3"><strong className="block text-2xl">{count}</strong>{label}</div>)}</div><p className="mt-3 text-sm text-[#66766f]">{zh ? '仅反映已记录的生命周期操作；零次记录不表示所有活动均已符合规则。' : 'Only recorded lifecycle operations are represented; zero observations do not prove that all events comply.'}</p></> : <p role="status">{zh ? '正在读取记录…' : 'Loading observations…'}</p>}
    </AppSectionCard>
    <AppConfirmationModal open={pendingSelect !== null} title={zh ? '放弃未发布的修改？' : 'Discard unpublished changes?'} description={zh ? '草稿修改将丢失，已发布政策不受影响。' : 'Draft changes will be lost. Published policies are unaffected.'} confirmLabel={zh ? '放弃并继续' : 'Discard and continue'} cancelLabel={zh ? '继续编辑' : 'Keep editing'} closeLabel={zh ? '关闭' : 'Close'} onCancel={() => setPendingSelect(null)} onConfirm={() => { const id = pendingSelect!; discard(id); setPendingSelect(null); if (error) void load() }} />
    <AppModal open={!!preview} title={zh ? '确认政策变更' : 'Confirm policy changes'} closeLabel={zh ? '关闭' : 'Close'} onClose={() => { if (!busy) { setPreview(null); attempt.current = null } }} closeDisabled={busy} closeOnEscape={!busy} closeOnBackdrop={!busy} footer={<><AppActionButton disabled={busy} onClick={() => { setPreview(null); attempt.current = null }}>{zh ? '返回修改' : 'Back to edit'}</AppActionButton><AppActionButton variant="primary" disabled={busy} onClick={() => void publish()}>{busy ? (zh ? '正在发布…' : 'Publishing…') : (zh ? '确认发布并生效' : 'Confirm and publish')}</AppActionButton></>}>
      {preview && draft && <div className="space-y-4 text-sm"><p>{zh ? '新版本：' : 'New version: '}{draft.version} · {modeLabel(draft.enforcementMode, zh)}</p><p>{zh ? '执行方式：' : 'Enforcement: '}{current ? modeLabel(current.enforcementMode, zh) : (zh ? '无有效政策' : 'No current policy')} → {modeLabel(draft.enforcementMode, zh)}</p><ul className="list-disc space-y-1 pl-5">{changes.map(key => <li key={key} className="space-y-1"><strong>{sectionLabel(key, zh)}</strong><p className="text-[#66766f]">{zh ? '之前：' : 'Before: '}{policySummary(currentRules, key, catalog!, zh)}</p><p>{zh ? '之后：' : 'After: '}{policySummary(draft.rules as PolicyRules, key, catalog!, zh)}</p></li>)}</ul><p>{zh ? `涉及 ${preview.affectedEventCount} 个活动；${preview.affectedApprovalCount} 份有效审批将失效并需要重新审阅。` : `${preview.affectedEventCount} events are affected; ${preview.affectedApprovalCount} active approvals will be invalidated and require review.`}</p><p className="rounded-xl bg-amber-50 p-3 text-amber-950">{zh ? '发布立即生效并替换当前版本，包括试运行模式。历史记录保留，任何旧审批都不会自动恢复。' : 'Publishing immediately replaces the current version, including in dry-run mode. History is retained; old approvals are never automatically restored.'}</p>{error && <p role="alert" className="text-rose-800">{error}</p>}</div>}
    </AppModal>
  </SystemManagementFrame></div></AppPageShell>
}
