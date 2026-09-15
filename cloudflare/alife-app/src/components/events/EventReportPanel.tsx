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
    setUnsavedChangesGuard(Boolean(dirty), zh ? '报告有未保存修改。' : 'The report has unsaved changes.', 'confirm', scope)
    return () => setUnsavedChangesGuard(false, '', 'confirm', scope)
  }, [dirty, zh, me?.id, eventId, moduleCode])
  const status = (value: string) => ({ draft: zh ? '草稿' : 'Draft', submitted: zh ? '等待总负责人审阅' : 'Awaiting owner review', returned: zh ? '已退回' : 'Returned', adopted: zh ? '已采用' : 'Adopted' }[value] || value)
  const actionText = (value: string) => ({ save: zh ? '保存草稿' : 'Saved draft', submit: zh ? '提交审阅' : 'Submitted for review', withdraw: zh ? '撤回编辑' : 'Withdrew for editing', return: zh ? '退回修改' : 'Returned for revision', adopt: zh ? '采用报告' : 'Adopted report' }[value] || value)
  const act = async (operation: string) => {
    if (!row || busy) return
    if (operation !== 'save' && !await requestConfirmation({ title: zh ? '确认报告操作' : 'Confirm report action', description: zh ? '提交和采用会记录确定版本；采用后纳入正式方案。' : 'Submission and adoption record exact versions. Adoption includes the report in the formal plan.', confirmLabel: zh ? '确认' : 'Confirm' })) return
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
  if (!row) return <AppSectionCard title={zh ? '模块报告' : 'Module report'}><p role={query.error ? 'alert' : 'status'}>{query.error ? normalizeApiError(query.error).message : zh ? '正在读取报告…' : 'Loading report…'}</p>{query.error ? <AppActionButton onClick={() => void query.refetch()}>{zh ? '重试' : 'Retry'}</AppActionButton> : null}</AppSectionCard>
  const adopted = row.revisions.find(x => x.id === row.adoptedRevisionId), submitted = row.revisions.find(x => x.id === row.submittedRevisionId)
  return <div className="space-y-4" data-module-report={moduleCode}>{confirmationModal}
    <AppSectionCard title={zh ? '文字报告' : 'Written report'} subtitle={zh ? '模块负责人提交，活动总负责人审阅采用。' : 'The module lead submits; the accountable owner reviews and adopts.'}>
      <p className="mb-3 text-sm font-semibold">{status(row.status)}{row.frozen ? ` · ${zh ? '正式方案已冻结' : 'Formal plan frozen'}` : ''}</p>
      {error ? <p role="alert" className="mb-3 text-sm text-rose-800">{error}</p> : null}
      {base !== row.eTag ? <p role="alert" className="mb-3 text-amber-900">{zh ? '报告已改变。你的草稿保留，请复制所需内容，再重新读取。' : 'The report changed. Your draft is retained. Copy any needed text before reloading.'}<AppActionButton onClick={() => { setDraft(row.draft); setBase(row.eTag) }}>{zh ? '采用最新版本' : 'Use latest version'}</AppActionButton></p> : null}
      {row.canEdit ? <fieldset disabled={busy || row.status === 'submitted'} className="space-y-3">{(['zh', 'en'] as const).map(lang => <label key={lang} className="grid gap-2 text-sm">{lang === 'zh' ? '中文报告' : 'English report'}<textarea aria-label={lang === 'zh' ? '中文报告' : 'English report'} className="min-h-40 w-full rounded-xl border border-[#176b5a]/25 p-3" value={draft[lang]} maxLength={20000} onChange={e => setDraft(value => ({ ...value, [lang]: e.target.value }))} /></label>)}<div className="flex flex-wrap gap-2"><AppActionButton onClick={() => void act('save')}>{zh ? '保存草稿' : 'Save draft'}</AppActionButton><AppActionButton disabled={Boolean(dirty) || !row.id} onClick={() => void act('submit')}>{zh ? '提交总负责人审阅' : 'Submit to owner'}</AppActionButton></div></fieldset> : <p className="text-sm text-[#66766f]">{zh ? '只有已接受此模块职责的负责人可以编写报告。' : 'Only the accepted module lead may author this report.'}</p>}
      {submitted ? <div className="mt-4 rounded-xl bg-[#f5f2eb] p-3"><h3 className="font-semibold">{zh ? '待审阅版本' : 'Submitted version'} {submitted.version}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{submitted.text[language] || submitted.text.en || submitted.text.zh}</p>{row.canAdopt ? <><label className="mt-3 grid gap-2 text-sm">{zh ? '退回理由' : 'Return reason'}<textarea className="rounded-xl border p-3" maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="mt-3 flex gap-2"><AppActionButton disabled={busy} onClick={() => void act('adopt')}>{zh ? '采用进正式方案' : 'Adopt into plan'}</AppActionButton><AppActionButton disabled={busy || !reason.trim()} onClick={() => void act('return')}>{zh ? '退回修改' : 'Return'}</AppActionButton></div></> : null}{row.canEdit ? <AppActionButton disabled={busy} onClick={() => void act('withdraw')}>{zh ? '撤回并继续编辑' : 'Withdraw to edit'}</AppActionButton> : null}</div> : null}
      {adopted ? <details className="mt-4 rounded-xl border p-3" open><summary className="min-h-11 cursor-pointer font-semibold">{zh ? '正式采用版本' : 'Adopted version'} {adopted.version}</summary><p className="whitespace-pre-wrap break-words text-sm">{adopted.text[language] || adopted.text.en || adopted.text.zh}</p></details> : null}
      <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-[#176b5a]" to={`/events/${eventId}/work?stage=preparation&plan=1`}>{zh ? '查看完整活动方案' : 'Read full event plan'}</Link>
    </AppSectionCard>
    <AppSectionCard title={zh ? '版本与交接记录' : 'Versions and handoffs'}>{row.actions.length ? row.actions.map((action, i) => <div key={i} className="border-b py-3 text-sm"><span>{new Date(action.createdUtc).toLocaleString(language)} · {actionText(action.operation)}</span>{action.reason ? <p className="mt-1 whitespace-pre-wrap">{action.reason}</p> : null}</div>) : <p className="text-sm">{zh ? '尚无交接记录。' : 'No handoff history yet.'}</p>}{row.revisions.map(revision => <details key={revision.id} className="mt-2 rounded-xl border p-3"><summary className="min-h-11 cursor-pointer">{zh ? '报告版本' : 'Report version'} {revision.version}</summary><p className="whitespace-pre-wrap break-words text-sm">{revision.text[language] || revision.text.en || revision.text.zh}</p></details>)}</AppSectionCard>
  </div>
}
