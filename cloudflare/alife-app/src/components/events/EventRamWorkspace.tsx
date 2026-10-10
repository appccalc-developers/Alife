import { eventRamWorkspaceText } from '../../i18n/eventRamWorkspace.ts'
import RamSyncPanel from './RamSyncPanel'
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
  const [newVersion, setNewVersion] = useState(false)
  const [busy, setBusy] = useState(false)
  const [authoringBusy, setAuthoringBusy] = useState(false)
  const [comparison, setComparison] = useState<RamPrint | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [signed, setSigned] = useState(false)
  const [print, setPrint] = useState<RamPrint | null>(null)
  const attempt = useRef<{ signature: string; key: string } | null>(null)
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    const data = await ramService.workspace(eventId)
    if (sequence !== loadSequence.current) return
    setWorkspace(data); setDraft(upgradeRam(data.assessment?.ramDataJson)); setDirty(false); setNewVersion(false)
    setPolicyId(data.assessment?.schemaVersion === 2 ? data.assessment.policyVersionId : data.policy?.id || null)
  }, [eventId, viewerId])
  useEffect(() => { let live = true; setWorkspace(null); setDraft(null); setPrint(null); setError(''); void load().catch(e => { if (live) setError(normalizeApiError(e).message) }); return () => { live = false; loadSequence.current++ } }, [load])
  useEffect(() => { setUnsavedChangesGuard(dirty, zh ? eventRamWorkspaceText.ramHasUnsavedChanges.zh : eventRamWorkspaceText.ramHasUnsavedChanges.en, 'confirm'); return () => setUnsavedChangesGuard(false) }, [dirty, zh])
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
  if (!workspace || !draft) return <AppSectionCard title="RAM"><p role={error ? 'alert' : 'status'}>{error || (zh ? eventRamWorkspaceText.loadingRam.zh : eventRamWorkspaceText.loadingRam.en)}</p>{error ? <AppActionButton onClick={() => void run(load)}>{zh ? eventRamWorkspaceText.retry.zh : eventRamWorkspaceText.retry.en}</AppActionButton> : null}</AppSectionCard>
  const ram = workspace.assessment
  const current = workspace.history.find(r => r.id === ram?.currentRevisionId)
  const editable = workspace.canEdit && !busy
  const actionsDisabled = pendingEventChanges || busy || authoringBusy || dirty || ram?.schemaVersion !== 2
  const policy = workspace.policy?.data
  const previousSubmitted = workspace.history.filter(r => workspace.actions.some(a => a.revisionId === r.id && (a.action === 'submit' || a.action === 'legacy-submitted'))).sort((a, b) => b.version - a.version)[0]
  const history = [...workspace.history].sort((a,b)=>b.version-a.version)
  const titles: Record<string, string> = { 'request-confirmation': zh ? eventRamWorkspaceText.freezeVersionAndRequestPersonalConfirmation.zh : eventRamWorkspaceText.freezeVersionAndRequestPersonalConfirmation.en, confirm: zh ? eventRamWorkspaceText.iConfirmIWillAttendAndLeadThisVersion.zh : eventRamWorkspaceText.iConfirmIWillAttendAndLeadThisVersion.en, submit: zh ? eventRamWorkspaceText.requestIndependentRamReview.zh : eventRamWorkspaceText.requestIndependentRamReview.en, approve: zh ? eventRamWorkspaceText.approveIndependentRamReview.zh : eventRamWorkspaceText.approveIndependentRamReview.en, return: zh ? eventRamWorkspaceText.returnForChanges.zh : eventRamWorkspaceText.returnForChanges.en, 'request-review': zh ? eventRamWorkspaceText.requestReReview.zh : eventRamWorkspaceText.requestReReview.en, 'snapshot-draft': zh ? eventRamWorkspaceText.savePrintSnapshot.zh : eventRamWorkspaceText.savePrintSnapshot.en }
  return <div className="space-y-5" data-ram-workspace>
    <RamSyncPanel eventId={eventId} zh={zh} disabled={dirty || busy || authoringBusy || pendingEventChanges} onVersionChange={etag => { if (etag !== (workspace.assessment?.eTag || 'new')) { if (dirty || busy || authoringBusy) setNewVersion(true); else void load().catch(e => setError(normalizeApiError(e).message)) } }} />
    {newVersion ? <p role="alert" className="text-sm text-amber-900">{zh ? eventRamWorkspaceText.aNewerVersionIsAvailableCopyAnyEditsYou.zh : eventRamWorkspaceText.aNewerVersionIsAvailableCopyAnyEditsYou.en}</p> : null}
    {showEventPlan && workspace.eventPlanContext ? <RamEventPlanContext context={workspace.eventPlanContext} zh={zh} /> : null}
    {comparison ? <NativeSectionCard title={zh ? eventRamWorkspaceText.compareWithV.zh(comparison.revision.version) : eventRamWorkspaceText.compareWithV.en(comparison.revision.version)}><RamChangeList changes={ramChanges(upgradeRam(comparison.ramDataJson), draft)} zh={zh} /><p className="mt-3 text-sm">{comparison.actions.filter(a => a.action === 'return').map(a => a.reason).join('；')}</p></NativeSectionCard> : null}
    <NativeSectionCard title={zh ? eventRamWorkspaceText.riskAssessmentAndManagement.zh : eventRamWorkspaceText.riskAssessmentAndManagement.en} subtitle={zh ? eventRamWorkspaceText.identifyInitialRatingControlsResidualRatingPersonalConfirmationIndependent.zh : eventRamWorkspaceText.identifyInitialRatingControlsResidualRatingPersonalConfirmationIndependent.en}>
      <div className="flex flex-wrap items-center gap-3"><strong>{text(ramValidityLabels[ram?.validity || 'Draft'], zh)}</strong><span className="text-sm">{zh ? eventRamWorkspaceText.savedRating.zh : eventRamWorkspaceText.savedRating.en}</span><RamLevelBadge level={ram?.residualLevel} zh={zh} /><span className="text-sm">{workspace.isRequired ? (zh ? eventRamWorkspaceText.ramIsRequiredForThisEvent.zh : eventRamWorkspaceText.ramIsRequiredForThisEvent.en) : (zh ? eventRamWorkspaceText.everyFormalRamRequiresIndependentReview.zh : eventRamWorkspaceText.everyFormalRamRequiresIndependentReview.en)}</span></div>
      {ram?.schemaVersion === 1 ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">{zh ? eventRamWorkspaceText.legacyRecordsAndApprovalsAreRetainedSavingAnUpgrade.zh : eventRamWorkspaceText.legacyRecordsAndApprovalsAreRetainedSavingAnUpgrade.en}</p> : null}
      {!workspace.policy ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">{zh ? eventRamWorkspaceText.thisChurchHasNoPublishedRamPolicyDraftsCan.zh : eventRamWorkspaceText.thisChurchHasNoPublishedRamPolicyDraftsCan.en}</p> : <p className="mt-3 text-sm">{zh ? eventRamWorkspaceText.churchPolicyVersion.zh : eventRamWorkspaceText.churchPolicyVersion.en}: {workspace.policy.version} {policyId !== workspace.policy.id && workspace.canEdit ? <AppActionButton variant="secondary" onClick={() => { setPolicyId(workspace.policy!.id); setDirty(true) }}>{zh ? eventRamWorkspaceText.useCurrentPublishedPolicy.zh : eventRamWorkspaceText.useCurrentPublishedPolicy.en}</AppActionButton> : null}</p>}
      <p className="mt-3 text-sm text-[#66766f]">{zh ? eventRamWorkspaceText.scoresAndLevelsAreCalculatedByTheServerWhen.zh : eventRamWorkspaceText.scoresAndLevelsAreCalculatedByTheServerWhen.en}</p>
      {workspace.canEdit && workspace.latestPolicy && workspace.latestPolicy.id !== policyId ? <AppActionButton variant="secondary" disabled={busy} onClick={() => { setPolicyId(workspace.latestPolicy!.id); setWorkspace(w => w ? { ...w, policy: w.latestPolicy || null } : w); setDirty(true) }}>{zh ? eventRamWorkspaceText.adoptLatestPolicyV.zh(workspace.latestPolicy.version) : eventRamWorkspaceText.adoptLatestPolicyV.en(workspace.latestPolicy.version)}</AppActionButton> : null}
      {pendingEventChanges ? <p className="mt-3 text-sm text-amber-800">{zh ? eventRamWorkspaceText.eventDetailsOrArrangementsAreUnsavedYouCanSave.zh : eventRamWorkspaceText.eventDetailsOrArrangementsAreUnsavedYouCanSave.en}</p> : null}
      {error ? <p role="alert" className="mt-3 whitespace-pre-wrap rounded-xl bg-red-50 p-3 text-sm text-red-900">{zh ? eventRamWorkspaceText.label.zh : eventRamWorkspaceText.label.en}{error}</p> : null}
      {success ? <p role="status" className="mt-3 text-sm text-emerald-800">{zh ? eventRamWorkspaceText.actionCompleted.zh : eventRamWorkspaceText.actionCompleted.en}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">{workspace.canEdit ? <AppActionButton disabled={busy} onClick={() => void save()}>{busy ? (zh ? eventRamWorkspaceText.working.zh : eventRamWorkspaceText.working.en) : (zh ? eventRamWorkspaceText.saveRamDraft.zh : eventRamWorkspaceText.saveRamDraft.en)}</AppActionButton> : null}
        <AppActionButton variant="secondary" disabled={busy || dirty} onClick={() => void run(load)}>{zh ? eventRamWorkspaceText.refreshStatus.zh : eventRamWorkspaceText.refreshStatus.en}</AppActionButton>
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 underline" to={`/events/${eventId}/ram`}>{zh ? eventRamWorkspaceText.personalConfirmationPage.zh : eventRamWorkspaceText.personalConfirmationPage.en}</Link>
      </div>
    </NativeSectionCard>
    {ram ? <RamLegacyDetails json={ram.ramDataJson} zh={zh} /> : null}
    {previousSubmitted ? <NativeSectionCard title={zh ? eventRamWorkspaceText.lastSubmittedVersionAndReturnComments.zh : eventRamWorkspaceText.lastSubmittedVersionAndReturnComments.en}><AppActionButton disabled={busy} onClick={() => void run(async () => setComparison(await ramService.version(eventId, previousSubmitted.id)))}>{zh ? eventRamWorkspaceText.compareWithLastSubmittedV.zh(previousSubmitted.version) : eventRamWorkspaceText.compareWithLastSubmittedV.en(previousSubmitted.version)}</AppActionButton>{workspace.actions.filter(a => a.revisionId === previousSubmitted.id && a.action === 'return').map(a => <p key={a.id} className="mt-3 whitespace-pre-wrap text-sm text-amber-900">{a.reason}</p>)}</NativeSectionCard> : null}
    <RamDraftEditor eventId={eventId} {...{ draft, update, policy, editable, dirty, zh }} policyVersionId={policyId} savedDraft={upgradeRam(ram?.ramDataJson)} conditionsKey={JSON.stringify(workspace.eventPlanContext)} contextVersion={ram?.eTag} assistanceDisabled={pendingEventChanges} onBusy={setAuthoringBusy} />
    <div data-ram-field="ram.onsite"><AppSectionCard summary={text(ramValidityLabels[ram?.validity || 'Draft'], zh)} title={zh ? eventRamWorkspaceText.personalConfirmationAndIndependentRamReview.zh : eventRamWorkspaceText.personalConfirmationAndIndependentRamReview.en}>
      <div className="space-y-4"><label className="block text-sm font-semibold">{zh ? eventRamWorkspaceText.willTheAuthorPersonallyAttendAndLead.zh : eventRamWorkspaceText.willTheAuthorPersonallyAttendAndLead.en}<select className={ramInput} disabled={!editable} value={draft.authorAttendsAndLeads === null ? '' : String(draft.authorAttendsAndLeads)} onChange={e => update({ authorAttendsAndLeads: e.target.value === '' ? null : e.target.value === 'true', onsiteMemberId: null })}><option value="">{zh ? eventRamWorkspaceText.choose.zh : eventRamWorkspaceText.choose.en}</option><option value="true">{zh ? eventRamWorkspaceText.yes.zh : eventRamWorkspaceText.yes.en}</option><option value="false">{zh ? eventRamWorkspaceText.noAnotherMemberWithAnAcceptedDutyWillLead.zh : eventRamWorkspaceText.noAnotherMemberWithAnAcceptedDutyWillLead.en}</option></select></label>
        {draft.authorAttendsAndLeads === false ? <label className="block text-sm">{zh ? eventRamWorkspaceText.onSiteLeader.zh : eventRamWorkspaceText.onSiteLeader.en}<select className={ramInput} disabled={!editable} value={draft.onsiteMemberId || ''} onChange={e => update({ onsiteMemberId: e.target.value || null })}><option value="">{zh ? eventRamWorkspaceText.selectAMemberWithAnAcceptedEventDuty.zh : eventRamWorkspaceText.selectAMemberWithAnAcceptedEventDuty.en}</option>{workspace.onsiteCandidates.map(p => <option key={p.memberId} value={p.memberId}>{p.name}</option>)}</select></label> : null}
        {current ? <p className="break-all text-xs">{zh ? eventRamWorkspaceText.immutableVersionForThisAction.zh : eventRamWorkspaceText.immutableVersionForThisAction.en}: v{current.version} · {current.contentHash}</p> : null}
        <label className="block text-sm">{zh ? eventRamWorkspaceText.reviewReReviewReason.zh : eventRamWorkspaceText.reviewReReviewReason.en}<textarea className={ramInput} rows={3} value={reason} onChange={e => setReason(e.target.value)} /></label>
        {workspace.canAudit && ram?.residualLevel === 'Red' ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} />{zh ? eventRamWorkspaceText.iExplicitlySignTheHealthAndSafetyReviewFor.zh : eventRamWorkspaceText.iExplicitlySignTheHealthAndSafetyReviewFor.en}</label> : null}
        <div className="flex flex-wrap gap-2">{workspace.canEdit ? <><AppActionButton disabled={actionsDisabled || !workspace.policy} onClick={() => setPending('request-confirmation')}>{titles['request-confirmation']}</AppActionButton><AppActionButton disabled={actionsDisabled || ram?.validity !== 'Confirmed'} onClick={() => setPending('submit')}>{titles.submit}</AppActionButton><AppActionButton variant="secondary" disabled={actionsDisabled} onClick={() => void act('snapshot-draft')}>{titles['snapshot-draft']}</AppActionButton></> : null}
          {current?.onsiteMemberId === workspace.currentMemberId ? <AppActionButton disabled={actionsDisabled || ram?.validity !== 'AwaitingConfirmation'} onClick={() => setPending('confirm')}>{titles.confirm}</AppActionButton> : null}
          {workspace.canAudit ? <><AppActionButton disabled={actionsDisabled || ram?.validity !== 'AwaitingReview'} onClick={() => setPending('approve')}>{titles.approve}</AppActionButton><AppActionButton variant="secondary" disabled={actionsDisabled || ram?.validity !== 'AwaitingReview' || !reason.trim()} onClick={() => setPending('return')}>{titles.return}</AppActionButton></> : null}
          {workspace.canEdit || workspace.canAudit ? <AppActionButton variant="secondary" disabled={pendingEventChanges || busy || authoringBusy || dirty || !ram || !reason.trim()} onClick={() => setPending('request-review')}>{titles['request-review']}</AppActionButton> : null}
        </div>
      </div>
    </AppSectionCard>
    </div><AppSectionCard summary={zh ? eventRamWorkspaceText.savedVersions.zh(workspace.history.length) : eventRamWorkspaceText.savedVersions.en(workspace.history.length)} title={zh ? eventRamWorkspaceText.versionAndSignatureHistory.zh : eventRamWorkspaceText.versionAndSignatureHistory.en}>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{(zh?[...eventRamWorkspaceText.localizedCopy.zh]:[...eventRamWorkspaceText.localizedCopy.en]).map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{history.map(r=><tr key={r.id} className="border-t align-top"><td className="p-2">v{r.version}</td><td className="p-2">{new Date(r.createdUtc).toLocaleString(zh?'zh':'en')}</td><td className="p-2"><RamLevelBadge zh={zh} level={r.residualLevel}/></td><td className="p-2">{workspace.actions.filter(a=>a.revisionId===r.id).map(a=><p key={a.id}>{text(ramActionLabels[a.action],zh)||a.action} · {workspace.onsiteCandidates.find(p=>p.memberId===a.actorMemberId)?.name||a.actorMemberId}{a.reason?<span className="block">{a.reason}</span>:null}</p>)}</td><td className="p-2"><AppActionButton disabled={busy} onClick={()=>void run(async()=>setPrint(await ramService.version(eventId,r.id)))}>{zh?eventRamWorkspaceText.viewPrint.zh:eventRamWorkspaceText.viewPrint.en}</AppActionButton><AppActionButton disabled={busy} onClick={()=>void run(async()=>setComparison(await ramService.version(eventId,r.id)))}>{zh?eventRamWorkspaceText.compare.zh:eventRamWorkspaceText.compare.en}</AppActionButton></td></tr>)}</tbody></table>{!history.length?<p>{zh?eventRamWorkspaceText.noSavedVersions.zh:eventRamWorkspaceText.noSavedVersions.en}</p>:null}</div>
    </AppSectionCard>
    <AppConfirmationModal open={pending !== null} title={titles[pending || ''] || ''} description={zh ? eventRamWorkspaceText.thisActionAppliesToTheSavedRamContentPersonal.zh(current ? `（v${current.version}）` : '') : eventRamWorkspaceText.thisActionAppliesToTheSavedRamContentPersonal.en(current ? ` (v${current.version})` : '')} confirmLabel={titles[pending || ''] || ''} cancelLabel={zh ? eventRamWorkspaceText.cancel.zh : eventRamWorkspaceText.cancel.en} closeLabel={zh ? eventRamWorkspaceText.close.zh : eventRamWorkspaceText.close.en} busy={busy} onCancel={() => setPending(null)} onConfirm={() => { if (pending) void act(pending) }} />
    {print ? <RamPrintView document={print} zh={zh} onClose={() => setPrint(null)} /> : null}
  </div>
}
