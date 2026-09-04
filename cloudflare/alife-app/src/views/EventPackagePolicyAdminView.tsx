import { useCallback, useEffect, useState, type FormEvent } from 'react'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { eventPackagePolicyAdminService } from '../services/eventPackagePolicyAdminService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { EventPackagePolicyAdmin, EventPackageRolloutReport } from '../types/eventPackagePolicyAdmin'
import SystemManagementFrame from './admin/SystemManagementFrame'

const defaultRules = JSON.stringify({
  schemaVersion: '1',
  preEventConfirmationWindowHours: 72,
  tierRules: [
    { tier: 'light', whenAnyConfirmedFactCodes: [], whenAnyActivityTypeCodes: [], whenAnyModuleCodes: [] },
    { tier: 'standard', whenAnyConfirmedFactCodes: ['money.hasMoneyFlow'], whenAnyActivityTypeCodes: [], whenAnyModuleCodes: ['PEOPLE.REGISTRATION'] },
    { tier: 'enhanced', whenAnyConfirmedFactCodes: ['people.childrenPresent', 'move.transportRequired'], whenAnyActivityTypeCodes: ['outdoor-activity'], whenAnyModuleCodes: ['SAFEGUARDING.CHILD', 'FESTIVAL.OPERATIONS'] },
  ],
  authorityByTier: { light: { minimumApproverCount: 1 }, standard: { minimumApproverCount: 1 }, enhanced: { minimumApproverCount: 1 } },
  approvalValidityByTier: { light: 'P30D', standard: 'P14D', enhanced: 'P7D' },
  materialChangeRules: [],
  conditionWaiverAllowed: false,
  delegationRules: { enabled: false, allowedTiers: [] },
  legacyRollout: {
    effectiveFromUtc: new Date().toISOString(), transitionDeadlineUtc: new Date(Date.now() + 90 * 86400000).toISOString(),
    cohortRule: 'new-events-first', safetyCriticalModuleCodes: ['SAFETY.RAM', 'SAFEGUARDING.CHILD'],
    transitionByMode: { off: 'legacyReadOnlyPackage', dryRun: 'timeLimitedCompatibility', enforced: 'formalPackageRequired' },
  },
}, null, 2)

const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 py-2 text-sm text-[#18332d] outline-none focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15'

const EventPackagePolicyAdminView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const zh = language === 'zh'
  const [policies, setPolicies] = useState<EventPackagePolicyAdmin[]>([])
  const [rollout, setRollout] = useState<EventPackageRolloutReport | null>(null)
  const [version, setVersion] = useState('')
  const [mode, setMode] = useState<EventPackagePolicyAdmin['enforcementMode']>('dryRun')
  const [rulesText, setRulesText] = useState(defaultRules)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [nextPolicies, nextRollout] = await Promise.all([
        eventPackagePolicyAdminService.list(), eventPackagePolicyAdminService.rolloutReport(),
      ])
      setPolicies(nextPolicies); setRollout(nextRollout)
    }
    catch (reason) { setError(normalizeApiError(reason).message) }
  }, [])
  useEffect(() => { void load() }, [load])

  const publish = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess('')
    let rules: Record<string, unknown>
    try { rules = JSON.parse(rulesText) as Record<string, unknown> }
    catch { setError(zh ? '政策规则不是有效 JSON。' : 'Policy rules are not valid JSON.'); return }
    setBusy(true)
    try {
      await eventPackagePolicyAdminService.publish({ version: version.trim(), schemaVersion: '1', rules,
        enforcementMode: mode, effectiveFromUtc: new Date().toISOString() })
      setConfirmed(false); setVersion(''); setSuccess(zh ? '新政策版本已发布；旧版本及审批历史仍保留。' : 'The new policy version is published; prior versions and approval history remain retained.')
      await load()
    } catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setBusy(false) }
  }

  return <AppPageShell>
    <SystemManagementFrame
      title={zh ? '活动方案治理政策' : 'Event Package governance policies'}
      subtitle={zh ? '发布不可变政策版本，控制审批等级、有效期、委派和渐进启用。' : 'Publish immutable policy versions controlling approval tiers, validity, delegation, and rollout.'}
      language={language}
      iconKey="eventPackagePolicies"
      bodyClassName="space-y-5 p-4 sm:p-5 lg:p-6"
    >
      {rollout ? <AppSectionCard title={zh ? `近 ${rollout.windowDays} 天 Dry Run` : `${rollout.windowDays}-day dry-run evidence`}>
      <div className="grid gap-3 text-sm tablet:grid-cols-3">
        <div className="rounded-xl bg-[#f4f8f6] p-3"><strong className="block text-2xl text-[#18332d]">{rollout.evaluatedOperationCount}</strong>{zh ? '已评估生命周期操作' : 'lifecycle operations evaluated'}</div>
        <div className="rounded-xl bg-amber-50 p-3 text-amber-950"><strong className="block text-2xl">{rollout.wouldBlockOperationCount}</strong>{zh ? '启用后会被阻止' : 'would be blocked when enforced'}</div>
        <div className="rounded-xl bg-[#f4f8f6] p-3"><strong className="block text-2xl text-[#18332d]">{rollout.affectedEventCount}</strong>{zh ? '受影响活动' : 'affected events'}</div>
      </div>
      {rollout.reasons.length ? <ul className="mt-3 space-y-1 text-xs text-[#52665f]">{rollout.reasons.map((reason) => <li key={reason.reasonCode}><strong>{reason.count}</strong> · {reason.reasonCode}</li>)}</ul> : <p className="mt-3 text-sm text-[#66766f]">{zh ? '窗口内没有观测到会阻止操作的原因。' : 'No would-block reasons were observed in this window.'}</p>}
    </AppSectionCard> : null}
    <div className="grid gap-5 desktop:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
      <AppSectionCard title={zh ? '已发布版本' : 'Published versions'}>
        <div className="space-y-3">{policies.map((policy) => <article key={policy.id} className="rounded-xl border border-[#2f4b42]/10 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><strong>{policy.version}</strong><AppBadge variant={policy.retiredUtc ? 'neutral' : 'info'}>{policy.enforcementMode}</AppBadge>{policy.retiredUtc ? <span>{zh ? '已退役' : 'retired'}</span> : <span>{zh ? '当前' : 'current'}</span>}</div>
          <p className="mt-1 text-xs text-[#66766f]">{new Date(policy.effectiveFromUtc).toLocaleString()} · schema {policy.schemaVersion}</p>
        </article>)}{!policies.length ? <p className="text-sm text-[#66766f]">{zh ? '尚无全局政策版本。' : 'No global policy version exists.'}</p> : null}</div>
      </AppSectionCard>
      <AppSectionCard title={zh ? '发布新版本' : 'Publish a new version'}>
        <form className="space-y-4" onSubmit={publish}>
          <label className="block text-xs font-black text-[#52665f]">{zh ? '版本' : 'Version'}<input className={fieldClass} value={version} onChange={(event) => setVersion(event.target.value)} required maxLength={40} /></label>
          <label className="block text-xs font-black text-[#52665f]">{zh ? '启用模式' : 'Enforcement mode'}<select className={fieldClass} value={mode} onChange={(event) => setMode(event.target.value as EventPackagePolicyAdmin['enforcementMode'])}><option value="off">off</option><option value="dryRun">dryRun</option><option value="enforced">enforced</option></select></label>
          <label className="block text-xs font-black text-[#52665f]">{zh ? '政策规则 JSON' : 'Policy rules JSON'}<textarea className={`${fieldClass} min-h-96 font-mono text-xs`} value={rulesText} onChange={(event) => setRulesText(event.target.value)} spellCheck={false} required /></label>
          <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{zh ? '我确认：发布会退役当前版本，并使受影响的现有批准安全失效；不会自动重新批准。' : 'I confirm publishing retires the current version and safely invalidates affected approvals; it never auto-approves them.'}</span></label>
          {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}{success ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p> : null}
          <AppActionButton type="submit" variant="primary" disabled={busy || !confirmed || !version.trim()}>{busy ? (zh ? '正在发布…' : 'Publishing…') : (zh ? '发布不可变政策版本' : 'Publish immutable policy version')}</AppActionButton>
        </form>
      </AppSectionCard>
      </div>
    </SystemManagementFrame>
  </AppPageShell>
}

export default EventPackagePolicyAdminView
