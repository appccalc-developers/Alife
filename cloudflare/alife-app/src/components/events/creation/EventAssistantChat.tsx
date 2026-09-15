import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { MessageCircle, Mic, Send, Square } from 'lucide-react'
import AppActionButton from '../../layout/AppActionButton'
import { normalizeApiError } from '../../../services/http'
import type { Bilingual } from '../../../../../shared/eventDetails'
import { creationInput } from './CreationFields'
import { useDetailsVoiceInput } from './useDetailsVoiceInput'

export type AssistantTurn = { id: string; role: 'user' | 'assistant'; text: string | Bilingual }
export default function EventAssistantChat({ zh, active, readOnly, heading, intro, footer, onSend, onBusy }: {
  zh: boolean; active: boolean; readOnly: boolean; heading: ReactNode; intro: string; footer?: ReactNode
  onSend: (message: string, turns: AssistantTurn[]) => Promise<Bilingual>; onBusy?: (busy: boolean) => void
}) {
  const [prompt, setPrompt] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [turns, setTurns] = useState<AssistantTurn[]>([])
  const promptId = useId(), conversation = useRef<HTMLDivElement>(null), root = useRef<HTMLElement>(null)
  const alive = useRef(true), pending = useRef(false), editable = useRef(!readOnly), busyCallback = useRef(onBusy)
  editable.current = !readOnly; busyCallback.current = onBusy
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = root.current
    if (!node) return
    const measure = () => setVisible(node.getClientRects().length > 0 && node.getBoundingClientRect().height > 0)
    const observer = new ResizeObserver(measure); observer.observe(node); measure()
    return () => observer.disconnect()
  }, [])
  const voice = useDetailsVoiceInput({ value: prompt, onChange: setPrompt, enabled: active && visible && !busy && !readOnly, language: zh ? 'zh-CN' : 'en-NZ', maxLength: 8000 })
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

  const text = (value: Bilingual) => (zh ? value.zh : value.en) || value.en || value.zh
  useEffect(() => { if (conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight }, [turns, active, zh])
  useEffect(() => { alive.current = true; return () => { alive.current = false; busyCallback.current?.(false) } }, [])
  const send = async () => {
    if (pending.current || readOnly || !active || voice.active || !prompt.trim()) return
    pending.current = true; setBusy(true); onBusy?.(true); setError('')
    const submitted = prompt.trim()
    try {
      const reply = await onSend(submitted, turns)
      if (!alive.current || !editable.current) return
      setTurns(current => [...current, { id: crypto.randomUUID(), role: 'user' as const, text: submitted }, { id: crypto.randomUUID(), role: 'assistant' as const, text: reply }].slice(-24))
      setPrompt('')
    } catch (reason) {
      if (alive.current) {
        const failure = normalizeApiError(reason)
        setError(/cut off before completion/.test(failure.message)
          ? (zh ? 'AI 回复未完成，表单和输入已保留，请重试。' : 'The AI reply was incomplete. Your form and message were kept; please retry.')
          : failure.message.replace(/\s*\((?:POST|GET) \/api\/.*\)$/, ''))
      }
    } finally { pending.current = false; if (alive.current) { setBusy(false); onBusy?.(false) } }
  }
  return <section ref={root} className="event-assistant-content">
    {heading}
    <div ref={conversation} role="log" tabIndex={0} aria-label={zh ? '资料助手对话（按时间顺序）' : 'Details assistant conversation (chronological)'} className="event-assistant-log space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-[#2f4b42]/10 bg-[#f5f2eb] px-3 py-4 sm:px-5" style={{ backgroundImage: 'radial-gradient(rgba(47,75,66,0.08) 0.75px, transparent 0.75px)', backgroundSize: '16px 16px' }}>
      {turns.length ? turns.map(turn => <div key={turn.id} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`relative w-fit min-w-0 max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[80%] ${turn.role === 'user' ? 'rounded-tr-sm bg-[#e3f0eb]' : 'rounded-tl-sm bg-white'}`}>
          <span aria-hidden="true" className={`absolute top-0 h-2.5 w-2.5 ${turn.role === 'user' ? '-right-1.5 bg-[#e3f0eb] [clip-path:polygon(0_0,100%_0,0_100%)]' : '-left-1.5 bg-white [clip-path:polygon(0_0,100%_0,100%_100%)]'}`} />
          <strong className="text-xs font-semibold text-[#176b5a]">{turn.role === 'user' ? (zh ? '你' : 'You') : (zh ? 'AI 助手' : 'AI assistant')}</strong>
          <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-[#18332d] [overflow-wrap:anywhere]">{typeof turn.text === 'string' ? turn.text : text(turn.text)}</p>
        </div>
      </div>) : <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-2 text-center text-sm text-[#475569]">
        <MessageCircle className="text-[#176b5a]" size={28} aria-hidden="true" />
        <span>{intro}</span>
      </div>}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={promptId} className="min-w-[12rem] flex-1 text-sm leading-6 text-[#66766f]">{zh ? '补充资料，AI 会根据你提供的内容更新草稿。' : 'Add details; AI will update the draft from what you provide.'}</label>

    </div>
    <textarea id={promptId} aria-describedby={`${promptId}-voice-help`} className={`${creationInput} py-2`} rows={3} maxLength={8000} value={prompt} disabled={readOnly || busy} onChange={e => setPrompt(e.target.value)} />
    <div className="event-assistant-actions">
      <AppActionButton variant="primary" className="min-h-11 gap-2" disabled={readOnly || busy || voice.active || !prompt.trim()} onClick={() => void send()}><Send size={16} aria-hidden="true" />{busy ? (zh ? '整理中……' : 'Organising…') : (zh ? '发送并整理资料' : 'Send and organise details')}</AppActionButton>
      <AppActionButton className="min-h-11 gap-2" variant={voice.active ? 'primary' : 'secondary'} aria-controls={promptId} aria-pressed={voice.active} aria-describedby={`${promptId}-voice-help`} disabled={readOnly || busy || !voice.supported || voice.phase === 'stopping'} onClick={voice.active ? voice.stop : voice.start}>
        {voice.active ? <Square size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
        {voice.phase === 'stopping' ? (zh ? '正在停止……' : 'Stopping…') : voice.active ? (zh ? '停止语音输入' : 'Stop voice input') : (zh ? '语音输入' : 'Voice input')}
      </AppActionButton>
    </div>
    <p id={`${promptId}-voice-help`} className="mt-2 text-xs leading-5 text-[#66766f]">{voice.supported ? (zh ? '浏览器可能使用在线语音服务；请核对文字后发送。' : 'Your browser may use an online speech service. Review the text before sending.') : voiceError}</p>
    <div role="status" className="mt-2 text-sm text-[#176b5a]">
      {voice.active ? <p>{voice.phase === 'starting' ? (zh ? '正在启动麦克风，请允许浏览器使用麦克风。' : 'Starting the microphone. Allow microphone access in your browser.') : voice.phase === 'stopping' ? (zh ? '正在完成最后的识别……' : 'Finishing the last transcription…') : (zh ? '正在聆听（中文）……' : 'Listening (English)…')}</p> : null}
      {voice.interim ? <p className="mt-1 whitespace-pre-wrap break-words">{zh ? '正在识别：' : 'Recognising: '}{voice.interim}</p> : null}
    </div>
    {voice.supported && voiceError ? <p role="alert" className="mt-2 text-sm text-rose-800">{voiceError}</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p> : null}
    <p className="event-assistant-review">{readOnly ? (zh ? '当前资料只读，暂不能发送或修改。' : 'These details are read-only. Sending and editing are unavailable.') : (zh ? '明确资料填入草稿，不确定之处继续询问；保存或创建前请核对。' : 'Explicit details fill the draft; uncertain details prompt a follow-up. Review before saving or creating.')}</p>
    {footer}
  </section>
}
