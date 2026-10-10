import { eventPackagePolicyAdminViewText } from '../i18n/eventPackagePolicyAdminView.ts'
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
  if (failure.status === 403) return zh ? eventPackagePolicyAdminViewText.youDoNotHavePermissionToManageEventPackage.zh : eventPackagePolicyAdminViewText.youDoNotHavePermissionToManageEventPackage.en
  if (failure.status === 409) return zh ? eventPackagePolicyAdminViewText.theCurrentPolicyOrAffectedApprovalsChangedOrThe.zh : eventPackagePolicyAdminViewText.theCurrentPolicyOrAffectedApprovalsChangedOrThe.en
  if (failure.status === 400 || failure.status === 422) return zh ? eventPackagePolicyAdminViewText.theRulesDidNotPassValidationCheckApproverCounts.zh : eventPackagePolicyAdminViewText.theRulesDidNotPassValidationCheckApproverCounts.en
  return zh ? eventPackagePolicyAdminViewText.theRequestCouldNotBeCompletedYourDraftIs.zh : eventPackagePolicyAdminViewText.theRequestCouldNotBeCompletedYourDraftIs.en
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
    setUnsavedChangesGuard(!!draft, zh ? eventPackagePolicyAdminViewText.thePolicyDraftIsNotPublishedLeavingWillDiscard.zh : eventPackagePolicyAdminViewText.thePolicyDraftIsNotPublishedLeavingWillDiscard.en, 'confirm')
    return () => setUnsavedChangesGuard(false)
  }, [draft, zh])
  const discard = (id: string) => { setDraft(null); setPreview(null); attempt.current = null; setSelectedId(id); setError('') }
  const start = (source?: EventPackagePolicyAdmin) => {
    if (!catalog) return
    try { setDraft(createPolicyDraft(catalog, source, current)); setPreview(null); attempt.current = null; setError(''); setSuccess(false) }
    catch { setError(zh ? eventPackagePolicyAdminViewText.thisVersionContainsUnsupportedRulesAndCannotBeSafely.zh : eventPackagePolicyAdminViewText.thisVersionContainsUnsupportedRulesAndCannotBeSafely.en) }
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
  }}><SystemManagementFrame title={zh ? eventPackagePolicyAdminViewText.eventPackageGovernancePolicies.zh : eventPackagePolicyAdminViewText.eventPackageGovernancePolicies.en} subtitle={zh ? eventPackagePolicyAdminViewText.manageApprovalWithClearRulesAndARetainedPublication.zh : eventPackagePolicyAdminViewText.manageApprovalWithClearRulesAndARetainedPublication.en} language={language} iconKey="eventPackagePolicies" bodyClassName="space-y-5 p-4 sm:p-5 lg:p-6">
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{zh ? eventPackagePolicyAdminViewText.thePolicyIsPublishedAndEffectiveVersionAndApproval.zh : eventPackagePolicyAdminViewText.thePolicyIsPublishedAndEffectiveVersionAndApproval.en}</p>}
    {error && !preview && <div role="alert" className="space-y-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p><AppActionButton disabled={busy || loading} onClick={() => draft ? setPendingSelect(selectedId) : void load()}>{zh ? eventPackagePolicyAdminViewText.refreshPolicies.zh : eventPackagePolicyAdminViewText.refreshPolicies.en}</AppActionButton></div>}
    {loading ? <p role="status">{zh ? eventPackagePolicyAdminViewText.loadingPolicies.zh : eventPackagePolicyAdminViewText.loadingPolicies.en}</p> : catalog && <>
      <AppSectionCard title={zh ? eventPackagePolicyAdminViewText.policyVersion.zh : eventPackagePolicyAdminViewText.policyVersion.en}>
        <label className="block text-sm">{zh ? eventPackagePolicyAdminViewText.selectAVersion.zh : eventPackagePolicyAdminViewText.selectAVersion.en}<select aria-label={zh ? eventPackagePolicyAdminViewText.selectAVersion.zh : eventPackagePolicyAdminViewText.selectAVersion.en} className={policyFieldClass} disabled={busy || !policies.length} value={selectedId} onChange={e => choose(e.target.value)}>{!policies.length && <option value="">{zh ? eventPackagePolicyAdminViewText.noPublishedVersions.zh : eventPackagePolicyAdminViewText.noPublishedVersions.en}</option>}{policies.map(p => <option key={p.id} value={p.id}>{p.version} · {isCurrentPolicy(p) ? (zh ? eventPackagePolicyAdminViewText.current.zh : eventPackagePolicyAdminViewText.current.en) : (zh ? eventPackagePolicyAdminViewText.historical.zh : eventPackagePolicyAdminViewText.historical.en)} · {modeLabel(p.enforcementMode, zh)} · {new Date(p.publishedUtc).toLocaleString(zh ? 'zh-CN' : 'en-AU')}</option>)}</select></label>
        {selected && <p className="mt-3 text-sm text-[#66766f]">{zh ? eventPackagePolicyAdminViewText.published.zh : eventPackagePolicyAdminViewText.published.en}{new Date(selected.publishedUtc).toLocaleString(zh ? 'zh-CN' : 'en-AU')}{zh ? eventPackagePolicyAdminViewText.publisher.zh : eventPackagePolicyAdminViewText.publisher.en}{selected.publishedByDisplayName || (zh ? eventPackagePolicyAdminViewText.identityRetainedInAuditHistory.zh : eventPackagePolicyAdminViewText.identityRetainedInAuditHistory.en)}</p>}
        {!current && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{zh ? eventPackagePolicyAdminViewText.noEffectiveGlobalPolicyExistsInitializeAPolicyOr.zh : eventPackagePolicyAdminViewText.noEffectiveGlobalPolicyExistsInitializeAPolicyOr.en}</p>}
        {!draft && <div className="mt-4 flex flex-wrap gap-3">{!current && <AppActionButton variant="primary" onClick={() => start()}>{zh ? eventPackagePolicyAdminViewText.initializeADryRunPolicy.zh : eventPackagePolicyAdminViewText.initializeADryRunPolicy.en}</AppActionButton>}{selected && <AppActionButton disabled={!selectedRules} variant={current ? 'primary' : 'secondary'} onClick={() => start(selected)}>{isCurrentPolicy(selected) ? (zh ? eventPackagePolicyAdminViewText.editFromCurrentVersion.zh : eventPackagePolicyAdminViewText.editFromCurrentVersion.en) : (zh ? eventPackagePolicyAdminViewText.restoreFromThisVersion.zh : eventPackagePolicyAdminViewText.restoreFromThisVersion.en)}</AppActionButton>}</div>}
      </AppSectionCard>
      {displayedRules && <AppSectionCard title={draft ? (zh ? eventPackagePolicyAdminViewText.newVersionDraft.zh : eventPackagePolicyAdminViewText.newVersionDraft.en) : (zh ? eventPackagePolicyAdminViewText.publishedRulesReadOnly.zh : eventPackagePolicyAdminViewText.publishedRulesReadOnly.en)}>
        <form onSubmit={review} className="space-y-5">
          {draft && <><label className="block text-sm">{zh ? eventPackagePolicyAdminViewText.newVersionName.zh : eventPackagePolicyAdminViewText.newVersionName.en}<input required maxLength={40} className={policyFieldClass} disabled={busy} value={draft.version} onChange={e => edit({ version: e.target.value })} /></label><p className="text-sm text-[#66766f]">{draft.sourcePolicyId ? (zh ? eventPackagePolicyAdminViewText.rulesAreCopiedFromTheSelectedVersionEffectiveTime.zh : eventPackagePolicyAdminViewText.rulesAreCopiedFromTheSelectedVersionEffectiveTime.en) : (zh ? eventPackagePolicyAdminViewText.defaultsComeFromTheServerTheyBecomeEffectiveOnly.zh : eventPackagePolicyAdminViewText.defaultsComeFromTheServerTheyBecomeEffectiveOnly.en)}</p></>}
          <EventPolicyForm rules={displayedRules} mode={draft?.enforcementMode ?? selected!.enforcementMode} catalog={catalog} zh={zh} disabled={!draft || busy} onRules={rules => edit({ rules })} onMode={enforcementMode => edit({ enforcementMode })} />
          {draft && <div className="flex flex-wrap gap-3"><AppActionButton type="submit" variant="primary" disabled={busy}>{busy ? (zh ? eventPackagePolicyAdminViewText.working.zh : eventPackagePolicyAdminViewText.working.en) : (zh ? eventPackagePolicyAdminViewText.previewChangesAndApprovalImpact.zh : eventPackagePolicyAdminViewText.previewChangesAndApprovalImpact.en)}</AppActionButton><AppActionButton disabled={busy} onClick={() => setPendingSelect(selectedId)}>{zh ? eventPackagePolicyAdminViewText.discardDraft.zh : eventPackagePolicyAdminViewText.discardDraft.en}</AppActionButton></div>}
        </form>
      </AppSectionCard>}
      {selected && !selectedRules && !draft && <p role="alert">{zh ? eventPackagePolicyAdminViewText.thisVersionContainsUnsupportedRulesOrRetiredConditionsIts.zh : eventPackagePolicyAdminViewText.thisVersionContainsUnsupportedRulesOrRetiredConditionsIts.en}</p>}
    </>}
    <AppSectionCard title={zh ? eventPackagePolicyAdminViewText.dryRunObservationsOver30Days.zh : eventPackagePolicyAdminViewText.dryRunObservationsOver30Days.en}>
      {reportError ? <div role="alert"><p>{zh ? eventPackagePolicyAdminViewText.couldNotLoadDryRunObservations.zh : eventPackagePolicyAdminViewText.couldNotLoadDryRunObservations.en}</p><AppActionButton onClick={() => void loadReport()}>{zh ? eventPackagePolicyAdminViewText.retry.zh : eventPackagePolicyAdminViewText.retry.en}</AppActionButton></div> : rollout ? <><div className="grid gap-3 text-sm md:grid-cols-3">{[[rollout.evaluatedOperationCount, zh ? eventPackagePolicyAdminViewText.observedOperations.zh : eventPackagePolicyAdminViewText.observedOperations.en], [rollout.wouldBlockOperationCount, zh ? eventPackagePolicyAdminViewText.wouldBeBlocked.zh : eventPackagePolicyAdminViewText.wouldBeBlocked.en], [rollout.affectedEventCount, zh ? eventPackagePolicyAdminViewText.affectedEvents.zh : eventPackagePolicyAdminViewText.affectedEvents.en]].map(([count, label]) => <div key={label} className="rounded-xl bg-[#f4f8f6] p-3"><strong className="block text-2xl">{count}</strong>{label}</div>)}</div><p className="mt-3 text-sm text-[#66766f]">{zh ? eventPackagePolicyAdminViewText.onlyRecordedLifecycleOperationsAreRepresentedZeroObservationsDo.zh : eventPackagePolicyAdminViewText.onlyRecordedLifecycleOperationsAreRepresentedZeroObservationsDo.en}</p></> : <p role="status">{zh ? eventPackagePolicyAdminViewText.loadingObservations.zh : eventPackagePolicyAdminViewText.loadingObservations.en}</p>}
    </AppSectionCard>
    <AppConfirmationModal open={pendingSelect !== null} title={zh ? eventPackagePolicyAdminViewText.discardUnpublishedChanges.zh : eventPackagePolicyAdminViewText.discardUnpublishedChanges.en} description={zh ? eventPackagePolicyAdminViewText.draftChangesWillBeLostPublishedPoliciesAreUnaffected.zh : eventPackagePolicyAdminViewText.draftChangesWillBeLostPublishedPoliciesAreUnaffected.en} confirmLabel={zh ? eventPackagePolicyAdminViewText.discardAndContinue.zh : eventPackagePolicyAdminViewText.discardAndContinue.en} cancelLabel={zh ? eventPackagePolicyAdminViewText.keepEditing.zh : eventPackagePolicyAdminViewText.keepEditing.en} closeLabel={zh ? eventPackagePolicyAdminViewText.close.zh : eventPackagePolicyAdminViewText.close.en} onCancel={() => setPendingSelect(null)} onConfirm={() => { const id = pendingSelect!; discard(id); setPendingSelect(null); if (error) void load() }} />
    <AppModal open={!!preview} title={zh ? eventPackagePolicyAdminViewText.confirmPolicyChanges.zh : eventPackagePolicyAdminViewText.confirmPolicyChanges.en} closeLabel={zh ? eventPackagePolicyAdminViewText.close.zh : eventPackagePolicyAdminViewText.close.en} onClose={() => { if (!busy) { setPreview(null); attempt.current = null } }} closeDisabled={busy} closeOnEscape={!busy} closeOnBackdrop={!busy} footer={<><AppActionButton disabled={busy} onClick={() => { setPreview(null); attempt.current = null }}>{zh ? eventPackagePolicyAdminViewText.backToEdit.zh : eventPackagePolicyAdminViewText.backToEdit.en}</AppActionButton><AppActionButton variant="primary" disabled={busy} onClick={() => void publish()}>{busy ? (zh ? eventPackagePolicyAdminViewText.publishing.zh : eventPackagePolicyAdminViewText.publishing.en) : (zh ? eventPackagePolicyAdminViewText.confirmAndPublish.zh : eventPackagePolicyAdminViewText.confirmAndPublish.en)}</AppActionButton></>}>
      {preview && draft && <div className="space-y-4 text-sm"><p>{zh ? eventPackagePolicyAdminViewText.newVersion.zh : eventPackagePolicyAdminViewText.newVersion.en}{draft.version} · {modeLabel(draft.enforcementMode, zh)}</p><p>{zh ? eventPackagePolicyAdminViewText.enforcement.zh : eventPackagePolicyAdminViewText.enforcement.en}{current ? modeLabel(current.enforcementMode, zh) : (zh ? eventPackagePolicyAdminViewText.noCurrentPolicy.zh : eventPackagePolicyAdminViewText.noCurrentPolicy.en)} → {modeLabel(draft.enforcementMode, zh)}</p><ul className="list-disc space-y-1 pl-5">{changes.map(key => <li key={key} className="space-y-1"><strong>{sectionLabel(key, zh)}</strong><p className="text-[#66766f]">{zh ? eventPackagePolicyAdminViewText.before.zh : eventPackagePolicyAdminViewText.before.en}{policySummary(currentRules, key, catalog!, zh)}</p><p>{zh ? eventPackagePolicyAdminViewText.after.zh : eventPackagePolicyAdminViewText.after.en}{policySummary(draft.rules as PolicyRules, key, catalog!, zh)}</p></li>)}</ul><p>{zh ? eventPackagePolicyAdminViewText.eventsAreAffectedActiveApprovalsWillBeInvalidatedAnd.zh(preview.affectedEventCount, preview.affectedApprovalCount) : eventPackagePolicyAdminViewText.eventsAreAffectedActiveApprovalsWillBeInvalidatedAnd.en(preview.affectedEventCount, preview.affectedApprovalCount)}</p><p className="rounded-xl bg-amber-50 p-3 text-amber-950">{zh ? eventPackagePolicyAdminViewText.publishingImmediatelyReplacesTheCurrentVersionIncludingInDry.zh : eventPackagePolicyAdminViewText.publishingImmediatelyReplacesTheCurrentVersionIncludingInDry.en}</p>{error && <p role="alert" className="text-rose-800">{error}</p>}</div>}
    </AppModal>
  </SystemManagementFrame></div></AppPageShell>
}
