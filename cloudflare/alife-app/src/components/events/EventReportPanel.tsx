import { eventReportPanelText } from '../../i18n/eventReportPanel.ts'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import AppSectionCard from '../layout/AppSectionCard'
import AppActionButton from '../layout/AppActionButton'
import { useAuthStore } from '../../stores/auth'
import { eventWorkService } from '../../services/eventWorkService'
import { normalizeApiError } from '../../services/http'
import { invalidateCurrentTasks } from '../../hooks/useCurrentTasks'
import useConfirmation from '../../hooks/useConfirmation'
import type { LocalizedText } from '../../types/eventComposition'
import { setUnsavedChangesGuard } from '../../utils/unsavedChangesGuard'

export default function EventReportPanel({ eventId, moduleCode, onSaved, onDirty, onBusy }: { eventId: string; moduleCode: string; onSaved?: () => void; onDirty?: (value: boolean) => void; onBusy?: (value: boolean) => void }) {
  const { me, language } = useAuthStore(), zh = language === 'zh', cache = useQueryClient()
  const key = ['event-report', me?.id, eventId, moduleCode]
  const query = useQuery({ queryKey: key, queryFn: () => eventWorkService.report(eventId, moduleCode), retry: false, gcTime: 0 })
  const row = query.data
  const [draft, setDraft] = useState<LocalizedText>({ en: '', zh: '' }), [base, setBase] = useState(''), [reason, setReason] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const attempt = useRef<{ signature: string; id: string } | null>(null)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  useEffect(() => { setBase(''); setDraft({ en: '', zh: '' }); setError('') }, [eventId, moduleCode, me?.id])
  useEffect(() => { if (row && !base) { setDraft(row.draft); setBase(row.eTag) } }, [row, base])
  const dirty = row && JSON.stringify(draft) !== JSON.stringify(row.draft)
  const callbacks = useRef({ onDirty, onBusy }); callbacks.current = { onDirty, onBusy }
  useEffect(() => { callbacks.current.onDirty?.(Boolean(dirty)) }, [dirty])
  useEffect(() => { callbacks.current.onBusy?.(busy) }, [busy])
  useEffect(() => () => { callbacks.current.onDirty?.(false); callbacks.current.onBusy?.(false) }, [])
  useEffect(() => {
    const scope = `report:${me?.id}:${eventId}:${moduleCode}`
    setUnsavedChangesGuard(Boolean(dirty), zh ? eventReportPanelText.theReportHasUnsavedChanges.zh : eventReportPanelText.theReportHasUnsavedChanges.en, 'confirm', scope)
    return () => setUnsavedChangesGuard(false, '', 'confirm', scope)
  }, [dirty, zh, me?.id, eventId, moduleCode])
  const status = (value: string) => ({ draft: zh ? eventReportPanelText.draft.zh : eventReportPanelText.draft.en, submitted: zh ? eventReportPanelText.awaitingOwnerReview.zh : eventReportPanelText.awaitingOwnerReview.en, returned: zh ? eventReportPanelText.returned.zh : eventReportPanelText.returned.en, adopted: zh ? eventReportPanelText.adopted.zh : eventReportPanelText.adopted.en }[value] || value)
  const actionText = (value: string) => ({ save: zh ? eventReportPanelText.savedDraft.zh : eventReportPanelText.savedDraft.en, submit: zh ? eventReportPanelText.submittedForReview.zh : eventReportPanelText.submittedForReview.en, withdraw: zh ? eventReportPanelText.withdrewForEditing.zh : eventReportPanelText.withdrewForEditing.en, return: zh ? eventReportPanelText.returnedForRevision.zh : eventReportPanelText.returnedForRevision.en, adopt: zh ? eventReportPanelText.adoptedReport.zh : eventReportPanelText.adoptedReport.en }[value] || value)
  const act = async (operation: string) => {
    if (!row || busy) return
    if (operation !== 'save' && !await requestConfirmation({ title: zh ? eventReportPanelText.confirmReportAction.zh : eventReportPanelText.confirmReportAction.en, description: zh ? eventReportPanelText.submissionAndAdoptionRecordExactVersionsAdoptionIncludesThe.zh : eventReportPanelText.submissionAndAdoptionRecordExactVersionsAdoptionIncludesThe.en, confirmLabel: zh ? eventReportPanelText.confirm.zh : eventReportPanelText.confirm.en })) return
    const body = operation === 'save' ? { text: draft } : { revisionId: row.submittedRevisionId, reason }
    const signature = JSON.stringify([operation, body, base])
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() }
    setBusy(true); setError('')
    try {
      const next = await eventWorkService.reportAction(eventId, moduleCode, operation, body, base, attempt.current.id)
      cache.setQueryData(key, next); setBase(next.eTag); setDraft(next.draft); setReason(''); attempt.current = null
      await invalidateCurrentTasks(me?.id); await cache.invalidateQueries({ queryKey: ['event-work', me?.id, eventId] }); onSaved?.()
    } catch (e) { setError(normalizeApiError(e).message); void query.refetch() } finally { setBusy(false) }
  }
  if (!row) return <AppSectionCard title={zh ? eventReportPanelText.moduleReport.zh : eventReportPanelText.moduleReport.en}><p role={query.error ? 'alert' : 'status'}>{query.error ? normalizeApiError(query.error).message : zh ? eventReportPanelText.loadingReport.zh : eventReportPanelText.loadingReport.en}</p>{query.error ? <AppActionButton onClick={() => void query.refetch()}>{zh ? eventReportPanelText.retry.zh : eventReportPanelText.retry.en}</AppActionButton> : null}</AppSectionCard>
  const adopted = row.revisions.find(x => x.id === row.adoptedRevisionId), submitted = row.revisions.find(x => x.id === row.submittedRevisionId)
  return <div className="space-y-4" data-module-report={moduleCode}>{confirmationModal}
    <AppSectionCard title={zh ? eventReportPanelText.writtenReport.zh : eventReportPanelText.writtenReport.en} subtitle={zh ? eventReportPanelText.theModuleLeadSubmitsTheAccountableOwnerReviewsAnd.zh : eventReportPanelText.theModuleLeadSubmitsTheAccountableOwnerReviewsAnd.en}>
      <p className="mb-3 text-sm font-semibold">{status(row.status)}{row.frozen ? ` · ${zh ? eventReportPanelText.formalPlanFrozen.zh : eventReportPanelText.formalPlanFrozen.en}` : ''}</p>
      {error ? <p role="alert" className="mb-3 text-sm text-rose-800">{error}</p> : null}
      {base !== row.eTag ? <p role="alert" className="mb-3 text-amber-900">{zh ? eventReportPanelText.theReportChangedYourDraftIsRetainedCopyAny.zh : eventReportPanelText.theReportChangedYourDraftIsRetainedCopyAny.en}<AppActionButton onClick={() => { setDraft(row.draft); setBase(row.eTag) }}>{zh ? eventReportPanelText.useLatestVersion.zh : eventReportPanelText.useLatestVersion.en}</AppActionButton></p> : null}
      {row.canEdit ? <fieldset disabled={busy || row.status === 'submitted'} className="space-y-3">{(['zh', 'en'] as const).map(lang => <label key={lang} className="grid gap-2 text-sm">{lang === 'zh' ? eventReportPanelText.englishReport.zh : eventReportPanelText.englishReport.en}<textarea aria-label={lang === 'zh' ? eventReportPanelText.englishReport.zh : eventReportPanelText.englishReport.en} className="min-h-40 w-full rounded-xl border border-[#176b5a]/25 p-3" value={draft[lang]} maxLength={20000} onChange={e => setDraft(value => ({ ...value, [lang]: e.target.value }))} /></label>)}<div className="flex flex-wrap gap-2"><AppActionButton onClick={() => void act('save')}>{zh ? eventReportPanelText.saveDraft.zh : eventReportPanelText.saveDraft.en}</AppActionButton><AppActionButton disabled={Boolean(dirty) || !row.id} onClick={() => void act('submit')}>{zh ? eventReportPanelText.submitToOwner.zh : eventReportPanelText.submitToOwner.en}</AppActionButton></div></fieldset> : <p className="text-sm text-[#66766f]">{zh ? eventReportPanelText.onlyTheAcceptedModuleLeadMayAuthorThisReport.zh : eventReportPanelText.onlyTheAcceptedModuleLeadMayAuthorThisReport.en}</p>}
      {submitted ? <div className="mt-4 rounded-xl bg-[#f5f2eb] p-3"><h3 className="font-semibold">{zh ? eventReportPanelText.submittedVersion.zh : eventReportPanelText.submittedVersion.en} {submitted.version}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{submitted.text[language] || submitted.text.en || submitted.text.zh}</p>{row.canAdopt ? <><label className="mt-3 grid gap-2 text-sm">{zh ? eventReportPanelText.returnReason.zh : eventReportPanelText.returnReason.en}<textarea className="rounded-xl border p-3" maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="mt-3 flex gap-2"><AppActionButton disabled={busy} onClick={() => void act('adopt')}>{zh ? eventReportPanelText.adoptIntoPlan.zh : eventReportPanelText.adoptIntoPlan.en}</AppActionButton><AppActionButton disabled={busy || !reason.trim()} onClick={() => void act('return')}>{zh ? eventReportPanelText.return.zh : eventReportPanelText.return.en}</AppActionButton></div></> : null}{row.canEdit ? <AppActionButton disabled={busy} onClick={() => void act('withdraw')}>{zh ? eventReportPanelText.withdrawToEdit.zh : eventReportPanelText.withdrawToEdit.en}</AppActionButton> : null}</div> : null}
      {adopted ? <details className="mt-4 rounded-xl border p-3" open><summary className="min-h-11 cursor-pointer font-semibold">{zh ? eventReportPanelText.adoptedVersion.zh : eventReportPanelText.adoptedVersion.en} {adopted.version}</summary><p className="whitespace-pre-wrap break-words text-sm">{adopted.text[language] || adopted.text.en || adopted.text.zh}</p></details> : null}
      <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-[#176b5a]" to={`/events/${eventId}/work?stage=preparation&plan=1`}>{zh ? eventReportPanelText.readFullEventPlan.zh : eventReportPanelText.readFullEventPlan.en}</Link>
    </AppSectionCard>
    <AppSectionCard title={zh ? eventReportPanelText.versionsAndHandoffs.zh : eventReportPanelText.versionsAndHandoffs.en}>{row.actions.length ? row.actions.map((action, i) => <div key={i} className="border-b py-3 text-sm"><span>{new Date(action.createdUtc).toLocaleString(language)} · {actionText(action.operation)}</span>{action.reason ? <p className="mt-1 whitespace-pre-wrap">{action.reason}</p> : null}</div>) : <p className="text-sm">{zh ? eventReportPanelText.noHandoffHistoryYet.zh : eventReportPanelText.noHandoffHistoryYet.en}</p>}{row.revisions.map(revision => <details key={revision.id} className="mt-2 rounded-xl border p-3"><summary className="min-h-11 cursor-pointer">{zh ? eventReportPanelText.reportVersion.zh : eventReportPanelText.reportVersion.en} {revision.version}</summary><p className="whitespace-pre-wrap break-words text-sm">{revision.text[language] || revision.text.en || revision.text.zh}</p></details>)}</AppSectionCard>
  </div>
}
