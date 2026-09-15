import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { MessageCircle, Mic, Send, Square } from 'lucide-react'
import AppActionButton from '../../layout/AppActionButton'
import AppBadge from '../../layout/AppBadge'
import { createAiSessionService } from '../../../services/aiSessionService'
import { normalizeApiError } from '../../../services/http'
import type { EventActivityType } from '../../../types/eventComposition'
import { invalidateArrangementConfirmation, type CreationDraft } from '../../../utils/eventCreationDraft'
import { applyDetailsResult, detailsSnapshot } from '../../../utils/eventDetailsAssistant'
import { applicableDetails, detailCompletion, detailLabels, validDetail, type Bilingual, type DetailsResult } from '../../../../../shared/eventDetails'
import { creationInput, localText } from './CreationFields'
import { useDetailsWorkspace } from './DetailsWorkspace'
import { useDetailsVoiceInput } from './useDetailsVoiceInput'

const service = createAiSessionService<DetailsResult>('/api/events/details-session')
type Turn = { id: string; role: 'user' | 'assistant'; text: string | Bilingual }
export default function EventDetailsAssistant({ draft, setDraft, type, isSeries, zh, active, onBusy }: {
  draft: CreationDraft; setDraft: Dispatch<SetStateAction<CreationDraft>>; type: EventActivityType; isSeries: boolean; zh: boolean; active: boolean; onBusy: (busy: boolean) => void
}) {
  const { readOnly, revealField, markUpdated } = useDetailsWorkspace()
  const editable = useRef(!readOnly); editable.current = !readOnly
  const [prompt, setPrompt] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const promptId = useId()
  const voice = useDetailsVoiceInput({ value: prompt, onChange: setPrompt, enabled: active && !busy && !readOnly, language: zh ? 'zh-CN' : 'en-NZ', maxLength: 8000 })
  const voiceError = !voice.supported || voice.error === 'unsupported'
    ? (zh ? '此浏览器暂不支持语音输入，请继续打字或粘贴文字。' : 'Voice input is unavailable in this browser. You can type or paste text.')
    : voice.error === 'not-allowed' || voice.error === 'service-not-allowed'
      ? (zh ? '麦克风或语音服务权限未获允许。请检查浏览器权限后重试，或继续打字。' : 'Microphone or speech service access was denied. Check browser permissions and retry, or keep typing.')
      : voice.error === 'audio-capture'
        ? (zh ? '无法使用麦克风，请检查麦克风连接和权限后重试。' : 'The microphone is unavailable. Check its connection and permissions, then retry.')
        : voice.error === 'no-speech'
          ? (zh ? '没有听到语音，请重试或继续打字。' : 'No speech was detected. Try again or keep typing.')
          : voice.error === 'network'
            ? (zh ? '语音识别连接失败，请检查网络后重试，或继续打字。' : 'Speech recognition could not connect. Check your network and retry, or keep typing.')
            : voice.error === 'language-not-supported'
              ? (zh ? '此浏览器的语音服务不支持当前语言，请继续打字。' : 'The browser speech service does not support this language. Please keep typing.')
              : voice.error === 'limit'
                ? (zh ? '输入已达到 8,000 字符，语音输入已停止；超出部分未填入，请核对并缩短文字。' : 'The 8,000-character limit was reached and voice input stopped. Excess text was not added; review and shorten the message.')
                : voice.error ? (zh ? '语音输入已停止，已有文字已保留。请重试或继续打字。' : 'Voice input stopped. Your text was kept; try again or keep typing.') : ''
  const [turns, setTurns] = useState<Turn[]>([]), [result, setResult] = useState<DetailsResult | null>(null)
  const conversation = useRef<HTMLDivElement>(null)
  const [resultSignature, setResultSignature] = useState('')
  const sessionId = useRef(crypto.randomUUID()), alive = useRef(true), pending = useRef(false), started = useRef(false)
  const revision = useRef(0), previous = useRef('')
  const signature = JSON.stringify({ draft, type: type.code, isSeries })
  if (previous.current !== signature) { previous.current = signature; revision.current++ }
  const latest = useRef(signature); latest.current = signature
  const snapshot = detailsSnapshot(draft, type, isSeries, revision.current)
  const completion = detailCompletion(snapshot.form, snapshot.sources, isSeries)
  const text = (value: Bilingual) => (zh ? value.zh : value.en) || value.en || value.zh
  useEffect(() => { if (conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight }, [turns, active, zh])
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; if (started.current) void service.close(sessionId.current).catch(() => undefined) }
  }, [])
  const send = async () => {
    if (pending.current || readOnly || !active || voice.active || !prompt.trim()) return
    pending.current = true; started.current = true; setBusy(true); onBusy(true); setError('')
    const submitted = prompt.trim(), sentSignature = signature, sentRevision = snapshot.revision
    try {
      const response = await service.sendMessage(sessionId.current, submitted, { inputMode: 'text', appContext: { language: zh ? 'zh' : 'en', knownFacts: { snapshot } } })
      if (!alive.current || !editable.current) return
      if (latest.current !== sentSignature || response.result?.revision !== sentRevision) {
        setError(zh ? '资料已修改，未采用旧回复。请按最新资料重新发送。' : 'Details changed; the old reply was not adopted. Send again using the latest form.'); return
      }
      if (!response.result) throw new Error(zh ? 'AI 未返回资料草稿。' : 'AI returned no details draft.')
      const next = response.result
      const nextDraft = invalidateArrangementConfirmation(applyDetailsResult(draft, next, submitted))
      setDraft(current => JSON.stringify({ draft: current, type: type.code, isSeries }) === sentSignature ? nextDraft : current)
      const updatedForm = detailsSnapshot(nextDraft, type, isSeries, snapshot.revision).form
      markUpdated(next.adoptedFields.filter(field => JSON.stringify(snapshot.form[field]) !== JSON.stringify(updatedForm[field])))
      setResult(next); setResultSignature(JSON.stringify({ draft: nextDraft, type: type.code, isSeries }))
      setTurns(current => [...current, { id: crypto.randomUUID(), role: 'user', text: submitted }, { id: crypto.randomUUID(), role: 'assistant', text: next.assistantReply }].slice(-24) as Turn[])
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
    if (readOnly) return current
    const sources = { ...current.detailSources }
    for (const field of applicableDetails(snapshot.form, isSeries)) if ((sources[field] ?? 'default') === 'default' && validDetail(field, snapshot.form)) sources[field] = 'human'
    return { ...current, detailSources: sources }
  })
  const currentResult = resultSignature === signature ? result : null
  const defaultsPending = completion.pending.filter(field => (snapshot.sources[field] ?? 'default') === 'default' && validDetail(field, snapshot.form))
  return <section className="event-assistant-content space-y-3">
    <div className="event-assistant-heading"><h3>{zh ? 'AI 资料助手' : 'AI details assistant'}</h3><AppBadge className="max-w-full break-words align-middle">{zh ? '已选模板：' : 'Selected template: '}{localText(type.name, zh)}</AppBadge></div>
    <div ref={conversation} role="log" tabIndex={0} aria-label={zh ? '资料助手对话（按时间顺序）' : 'Details assistant conversation (chronological)'} className="event-assistant-log mt-3 max-h-80 min-h-40 space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-[#2f4b42]/10 bg-[#f5f2eb] px-3 py-4 sm:px-5" style={{ backgroundImage: 'radial-gradient(rgba(47,75,66,0.08) 0.75px, transparent 0.75px)', backgroundSize: '16px 16px' }}>
      {turns.length ? turns.map(turn => <div key={turn.id} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`relative w-fit min-w-0 max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[80%] ${turn.role === 'user' ? 'rounded-tr-sm bg-[#e3f0eb]' : 'rounded-tl-sm bg-white'}`}>
          <span aria-hidden="true" className={`absolute top-0 h-2.5 w-2.5 ${turn.role === 'user' ? '-right-1.5 bg-[#e3f0eb] [clip-path:polygon(0_0,100%_0,0_100%)]' : '-left-1.5 bg-white [clip-path:polygon(0_0,100%_0,100%_100%)]'}`} />
          <strong className="text-xs font-semibold text-[#176b5a]">{turn.role === 'user' ? (zh ? '你' : 'You') : (zh ? 'AI 助手' : 'AI assistant')}</strong>
          <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-[#18332d] [overflow-wrap:anywhere]">{typeof turn.text === 'string' ? turn.text : text(turn.text)}</p>
        </div>
      </div>) : <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-2 text-center text-sm text-[#475569]">
        <MessageCircle className="text-[#176b5a]" size={28} aria-hidden="true" />
        <span>{zh ? '先说说这是什么活动、何时在哪里举行。也可以补充可见范围、报名方式和最多参加人数，我们一起把资料整理好。' : 'Tell me about the event, when it happens and where. You can also add visibility, registration and maximum capacity. We’ll organise the details together.'}</span>
      </div>}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={promptId} className="min-w-[12rem] flex-1 text-sm leading-6 text-[#66766f]">{zh ? '可直接继续补充活动信息，AI 会据你提供内容更新草稿。' : 'Continue entering event details; AI will update the draft from what you provide.'}</label>
      <AppActionButton className="ml-auto min-h-11 gap-2" variant={voice.active ? 'primary' : 'secondary'} aria-controls={promptId} aria-pressed={voice.active} aria-describedby={`${promptId}-voice-help`} disabled={readOnly || busy || !voice.supported || voice.phase === 'stopping'} onClick={voice.active ? voice.stop : voice.start}>
        {voice.active ? <Square size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
        {voice.phase === 'stopping' ? (zh ? '正在停止……' : 'Stopping…') : voice.active ? (zh ? '停止语音输入' : 'Stop voice input') : (zh ? '语音输入' : 'Voice input')}
      </AppActionButton>
    </div>
    <textarea id={promptId} aria-describedby={`${promptId}-voice-help`} className={`${creationInput} py-2`} rows={3} maxLength={8000} value={prompt} disabled={readOnly || busy} onChange={e => setPrompt(e.target.value)} />
    <p id={`${promptId}-voice-help`} className="mt-2 text-xs leading-5 text-[#66766f]">{voice.supported ? (zh ? '浏览器可能使用在线语音服务；请核对文字后发送。' : 'Your browser may use an online speech service. Review the text before sending.') : voiceError}</p>
    <div role="status" className="mt-2 text-sm text-[#176b5a]">
      {voice.active ? <p>{voice.phase === 'starting' ? (zh ? '正在启动麦克风，请允许浏览器使用麦克风。' : 'Starting the microphone. Allow microphone access in your browser.') : voice.phase === 'stopping' ? (zh ? '正在完成最后的识别……' : 'Finishing the last transcription…') : (zh ? '正在聆听（中文）……' : 'Listening (English)…')}</p> : null}
      {voice.interim ? <p className="mt-1 whitespace-pre-wrap break-words">{zh ? '正在识别：' : 'Recognising: '}{voice.interim}</p> : null}
    </div>
    {voice.supported && voiceError ? <p role="alert" className="mt-2 text-sm text-rose-800">{voiceError}</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p> : null}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <AppActionButton variant="primary" className="min-h-11 gap-2" disabled={readOnly || busy || voice.active || !prompt.trim()} onClick={() => void send()}><Send size={16} aria-hidden="true" />{busy ? (zh ? '整理中……' : 'Organising…') : (zh ? '发送并整理资料' : 'Send and organise details')}</AppActionButton>
    </div>
    <p className="event-assistant-review">{readOnly ? (zh ? '当前资料只读，暂不能发送或修改。' : 'These details are read-only. Sending and editing are unavailable.') : (zh ? '明确资料填入草稿，不确定之处继续询问；保存或创建前请核对。' : 'Explicit details fill the draft; uncertain details prompt a follow-up. Review before saving or creating.')}</p>
    <div className="event-assistant-completion" aria-live="polite">
      <div className="event-completion-count"><strong>{zh ? '字段完成度' : 'Field completion'}</strong><span>{completion.completed}/{completion.total} · {completion.percent}%</span></div>
      <progress aria-label={zh ? '字段完成度' : 'Field completion'} value={completion.percent} max={100} />
      <p>{zh ? '仅表示填写完整度' : 'Form completeness only'}</p>
      {completion.pending.length ? <div className="event-pending-fields" aria-label={zh ? '待填写或确认' : 'Fields to complete or confirm'}>{completion.pending.map(field => <button key={field} type="button" onClick={() => revealField(field)}>{text(detailLabels[field])}<span aria-hidden="true">↗</span></button>)}</div> : null}
      {defaultsPending.length ? <><p>{zh ? '待核对默认值：' : 'Review defaults: '}{defaultsPending.map(field => text(detailLabels[field])).join(' · ')}</p><AppActionButton disabled={readOnly || busy} onClick={confirmDefaults}>{zh ? '确认当前默认设置' : 'Confirm current defaults'}</AppActionButton></> : null}
      <button type="button" className="event-return-to-form" onClick={() => revealField()}>↑ {zh ? '回到活动资料表单' : 'Back to event details form'}</button>
    </div>
    {currentResult ? <div className="event-assistant-assessment" aria-live="polite">
      {currentResult.adoptedFields.length ? <p>{zh ? '本轮更新：' : 'Updated: '}{currentResult.adoptedFields.map(field => text(detailLabels[field])).join(' · ')}</p> : null}
      {currentResult.issues.length ? <ul>{currentResult.issues.slice(0, 2).map((issue, index) => <li key={index}><button type="button" onClick={() => revealField(issue.field)}>{text(detailLabels[issue.field])} ↗</button> {text(issue.question)}</li>)}</ul> : null}
      <details><summary>{zh ? '查看 AI 充分性评估' : 'View AI sufficiency assessment'}</summary><p>{currentResult.assessment.sufficiencyScore}/100 · {text(currentResult.assessment.summary)}</p></details>
    </div> : result ? <p className="event-assistant-review">{zh ? '表单已更新；上轮 AI 评估已过期，请继续补充。' : 'The form changed; the previous AI assessment is out of date. Continue with the latest details.'}</p> : null}

  </section>
}
