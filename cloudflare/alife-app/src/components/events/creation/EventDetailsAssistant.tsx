import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import AppSectionCard from '../../layout/AppSectionCard'
import AppActionButton from '../../layout/AppActionButton'
import { createAiSessionService } from '../../../services/aiSessionService'
import { normalizeApiError } from '../../../services/http'
import type { EventActivityType } from '../../../types/eventComposition'
import type { CreationDraft } from '../../../utils/eventCreationDraft'
import { applyDetailsResult, detailsSnapshot } from '../../../utils/eventDetailsAssistant'
import { applicableDetails, detailCompletion, detailLabels, validDetail, type Bilingual, type DetailsResult } from '../../../../../shared/eventDetails'
import { creationInput } from './CreationSteps'

const service = createAiSessionService<DetailsResult>('/api/events/details-session')
type Turn = { role: 'user' | 'assistant'; text: string | Bilingual }
export default function EventDetailsAssistant({ draft, setDraft, type, isSeries, zh, onBusy }: {
  draft: CreationDraft; setDraft: Dispatch<SetStateAction<CreationDraft>>; type: EventActivityType; isSeries: boolean; zh: boolean; onBusy: (busy: boolean) => void
}) {
  const [prompt, setPrompt] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [turns, setTurns] = useState<Turn[]>([]), [result, setResult] = useState<DetailsResult | null>(null)
  const [resultSignature, setResultSignature] = useState('')
  const sessionId = useRef(crypto.randomUUID()), alive = useRef(true), pending = useRef(false), started = useRef(false)
  const revision = useRef(0), previous = useRef('')
  const signature = JSON.stringify({ draft, type: type.code, isSeries })
  if (previous.current !== signature) { previous.current = signature; revision.current++ }
  const latest = useRef(signature); latest.current = signature
  const snapshot = detailsSnapshot(draft, type, isSeries, revision.current)
  const completion = detailCompletion(snapshot.form, snapshot.sources, isSeries)
  const text = (value: Bilingual) => (zh ? value.zh : value.en) || value.en || value.zh
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; if (started.current) void service.close(sessionId.current).catch(() => undefined) }
  }, [])
  const send = async () => {
    if (pending.current || !prompt.trim()) return
    pending.current = true; started.current = true; setBusy(true); onBusy(true); setError('')
    const submitted = prompt.trim(), sentSignature = signature, sentRevision = snapshot.revision
    try {
      const response = await service.sendMessage(sessionId.current, submitted, { inputMode: 'text', appContext: { language: zh ? 'zh' : 'en', knownFacts: { snapshot } } })
      if (!alive.current) return
      if (latest.current !== sentSignature || response.result?.revision !== sentRevision) {
        setError(zh ? '资料已修改，未采用旧回复。请按最新资料重新发送。' : 'Details changed; the old reply was not adopted. Send again using the latest form.'); return
      }
      if (!response.result) throw new Error(zh ? 'AI 未返回资料草稿。' : 'AI returned no details draft.')
      const next = response.result
      const nextDraft = applyDetailsResult(draft, next)
      setDraft(current => JSON.stringify({ draft: current, type: type.code, isSeries }) === sentSignature ? applyDetailsResult(current, next) : current)
      setResult(next); setResultSignature(JSON.stringify({ draft: nextDraft, type: type.code, isSeries }))
      setTurns(current => [...current, { role: 'user', text: submitted }, { role: 'assistant', text: next.assistantReply }].slice(-24) as Turn[])
      setPrompt('')
    } catch (reason) {
      if (alive.current) {
        const failure = normalizeApiError(reason)
        setError(/cut off before completion/.test(failure.message)
          ? (zh ? 'AI 回复未完成，表单和输入已保留，请重试。' : 'The AI reply was incomplete. Your form and message were kept; please retry.')
          : failure.message.replace(/\s*\((?:POST|GET) \/api\/.*\)$/, ''))
      }
    }
    finally { pending.current = false; if (alive.current) { setBusy(false); onBusy(false) } }
  }
  const confirmDefaults = () => setDraft(current => {
    const sources = { ...current.detailSources }
    for (const field of applicableDetails(snapshot.form, isSeries)) if ((sources[field] ?? 'default') === 'default' && validDetail(field, snapshot.form)) sources[field] = 'human'
    return { ...current, detailSources: sources }
  })
  const currentResult = resultSignature === signature ? result : null
  const defaultsPending = completion.pending.filter(field => (snapshot.sources[field] ?? 'default') === 'default' && validDetail(field, snapshot.form))
  return <AppSectionCard><details open><summary className="min-h-11 cursor-pointer py-2 font-semibold">{zh ? 'AI 资料助手（可选）' : 'AI details assistant (optional)'}</summary>
    <p className="text-sm text-[#66766f]">{zh ? '明确提供的资料会填入草稿；不确定之处会继续询问。请在创建前审阅。' : 'Explicit details fill the draft; uncertain details prompt a follow-up. Review before creating.'}</p>
    <div className="my-3 rounded-xl bg-[#e3f0eb] p-3 text-sm" aria-live="polite">
      <p className="font-semibold">{zh ? '字段完成度' : 'Field completion'}：{completion.percent}% ({completion.completed}/{completion.total})</p>
      <progress className="mt-2 w-full accent-[#176b5a]" aria-label={zh ? '字段完成度' : 'Field completion'} value={completion.percent} max={100} />
      <p>{zh ? '100% 表示资料完整，不表示已批准或发布。' : '100% means complete details, not approval or publication.'}</p>
      {completion.pending.length ? <p className="mt-2">{zh ? '待填写或确认：' : 'Pending: '}{completion.pending.map(field => text(detailLabels[field])).join('、')}</p> : null}
      {defaultsPending.length ? <><p className="mt-2">{zh ? '请核对表单中的默认设置：' : 'Review the defaults in the form: '}{defaultsPending.map(field => text(detailLabels[field])).join('、')}</p><AppActionButton className="mt-2" disabled={busy} onClick={confirmDefaults}>{zh ? '确认当前默认设置' : 'Confirm current defaults'}</AppActionButton></> : null}
    </div>
    <div role="log" aria-label={zh ? '资料助手对话' : 'Details assistant conversation'} className="max-h-80 space-y-3 overflow-y-auto">
      {turns.map((turn, index) => <div key={index} className={`rounded-xl p-3 text-sm ${turn.role === 'user' ? 'bg-[#f5f2eb]' : 'border border-[#2f4b42]/15'}`}><strong>{turn.role === 'user' ? (zh ? '你' : 'You') : (zh ? 'AI 助手' : 'AI assistant')}</strong><p className="mt-1 whitespace-pre-wrap break-words">{typeof turn.text === 'string' ? turn.text : text(turn.text)}</p></div>)}
    </div>
    {currentResult ? <div className="my-3 text-sm" aria-live="polite"><p>{zh ? 'AI 充分性评估' : 'AI sufficiency assessment'}：{currentResult.assessment.sufficiencyScore}/100 · {text(currentResult.assessment.summary)}</p>
      {currentResult.adoptedFields.length ? <p className="mt-2">{zh ? '本轮更新：' : 'Updated: '}{currentResult.adoptedFields.map(field => text(detailLabels[field])).join('、')}</p> : null}
      {currentResult.issues.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{currentResult.issues.slice(0, 2).map((issue, index) => <li key={index}>{text(detailLabels[issue.field])}：{text(issue.question)}</li>)}</ul> : null}
    </div> : result ? <p className="my-2 text-sm text-[#66766f]">{zh ? '表单已更新；上轮 AI 评估已过期，请继续补充。' : 'The form changed; the previous AI assessment is out of date. Continue with the latest details.'}</p> : null}
    <label className="mt-3 block text-sm">{zh ? '需要整理或补充的资料' : 'Details to organise or add'}<textarea className={`${creationInput} py-2`} rows={3} maxLength={8000} value={prompt} disabled={busy} onChange={e => setPrompt(e.target.value)} /></label>
    {error ? <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p> : null}
    <AppActionButton className="mt-3" disabled={busy || !prompt.trim()} onClick={() => void send()}>{busy ? (zh ? '整理中……' : 'Organising…') : (zh ? '发送并整理资料' : 'Send and organise details')}</AppActionButton>
  </details></AppSectionCard>
}
