import { eventAssistantChatText } from '../../../i18n/eventAssistantChat.ts'
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
    ? (zh ? eventAssistantChatText.voiceInputIsUnavailableInThisBrowserYouCan.zh : eventAssistantChatText.voiceInputIsUnavailableInThisBrowserYouCan.en)
    : voice.error === 'not-allowed' || voice.error === 'service-not-allowed'
      ? (zh ? eventAssistantChatText.microphoneOrSpeechServiceAccessWasDeniedCheckBrowser.zh : eventAssistantChatText.microphoneOrSpeechServiceAccessWasDeniedCheckBrowser.en)
      : voice.error === 'audio-capture'
        ? (zh ? eventAssistantChatText.theMicrophoneIsUnavailableCheckItsConnectionAndPermissions.zh : eventAssistantChatText.theMicrophoneIsUnavailableCheckItsConnectionAndPermissions.en)
        : voice.error === 'no-speech'
          ? (zh ? eventAssistantChatText.noSpeechWasDetectedTryAgainOrKeepTyping.zh : eventAssistantChatText.noSpeechWasDetectedTryAgainOrKeepTyping.en)
          : voice.error === 'network'
            ? (zh ? eventAssistantChatText.speechRecognitionCouldNotConnectCheckYourNetworkAnd.zh : eventAssistantChatText.speechRecognitionCouldNotConnectCheckYourNetworkAnd.en)
            : voice.error === 'language-not-supported'
              ? (zh ? eventAssistantChatText.theBrowserSpeechServiceDoesNotSupportThisLanguage.zh : eventAssistantChatText.theBrowserSpeechServiceDoesNotSupportThisLanguage.en)
              : voice.error === 'limit'
                ? (zh ? eventAssistantChatText.the8000CharacterLimitWasReachedAndVoice.zh : eventAssistantChatText.the8000CharacterLimitWasReachedAndVoice.en)
                : voice.error ? (zh ? eventAssistantChatText.voiceInputStoppedYourTextWasKeptTryAgain.zh : eventAssistantChatText.voiceInputStoppedYourTextWasKeptTryAgain.en) : ''

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
          ? (zh ? eventAssistantChatText.theAiReplyWasIncompleteYourFormAndMessage.zh : eventAssistantChatText.theAiReplyWasIncompleteYourFormAndMessage.en)
          : failure.message.replace(/\s*\((?:POST|GET) \/api\/.*\)$/, ''))
      }
    } finally { pending.current = false; if (alive.current) { setBusy(false); onBusy?.(false) } }
  }
  return <section ref={root} className="event-assistant-content">
    {heading}
    <div ref={conversation} role="log" tabIndex={0} aria-label={zh ? eventAssistantChatText.detailsAssistantConversationChronological.zh : eventAssistantChatText.detailsAssistantConversationChronological.en} className="event-assistant-log space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-[#2f4b42]/10 bg-[#f5f2eb] px-3 py-4 sm:px-5" style={{ backgroundImage: 'radial-gradient(rgba(47,75,66,0.08) 0.75px, transparent 0.75px)', backgroundSize: '16px 16px' }}>
      {turns.length ? turns.map(turn => <div key={turn.id} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`relative w-fit min-w-0 max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[80%] ${turn.role === 'user' ? 'rounded-tr-sm bg-[#e3f0eb]' : 'rounded-tl-sm bg-white'}`}>
          <span aria-hidden="true" className={`absolute top-0 h-2.5 w-2.5 ${turn.role === 'user' ? '-right-1.5 bg-[#e3f0eb] [clip-path:polygon(0_0,100%_0,0_100%)]' : '-left-1.5 bg-white [clip-path:polygon(0_0,100%_0,100%_100%)]'}`} />
          <strong className="text-xs font-semibold text-[#176b5a]">{turn.role === 'user' ? (zh ? eventAssistantChatText.you.zh : eventAssistantChatText.you.en) : (zh ? eventAssistantChatText.aiAssistant.zh : eventAssistantChatText.aiAssistant.en)}</strong>
          <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-[#18332d] [overflow-wrap:anywhere]">{typeof turn.text === 'string' ? turn.text : text(turn.text)}</p>
        </div>
      </div>) : <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-2 text-center text-sm text-[#475569]">
        <MessageCircle className="text-[#176b5a]" size={28} aria-hidden="true" />
        <span>{intro}</span>
      </div>}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={promptId} className="min-w-[12rem] flex-1 text-sm leading-6 text-[#66766f]">{zh ? eventAssistantChatText.addDetailsAiWillUpdateTheDraftFromWhat.zh : eventAssistantChatText.addDetailsAiWillUpdateTheDraftFromWhat.en}</label>

    </div>
    <textarea id={promptId} aria-describedby={`${promptId}-voice-help`} className={`${creationInput} py-2`} rows={3} maxLength={8000} value={prompt} disabled={readOnly || busy} onChange={e => setPrompt(e.target.value)} />
    <div className="event-assistant-actions">
      <AppActionButton variant="primary" className="min-h-11 gap-2" disabled={readOnly || busy || voice.active || !prompt.trim()} onClick={() => void send()}><Send size={16} aria-hidden="true" />{busy ? (zh ? eventAssistantChatText.organising.zh : eventAssistantChatText.organising.en) : (zh ? eventAssistantChatText.sendAndOrganiseDetails.zh : eventAssistantChatText.sendAndOrganiseDetails.en)}</AppActionButton>
      <AppActionButton className="min-h-11 gap-2" variant={voice.active ? 'primary' : 'secondary'} aria-controls={promptId} aria-pressed={voice.active} aria-describedby={`${promptId}-voice-help`} disabled={readOnly || busy || !voice.supported || voice.phase === 'stopping'} onClick={voice.active ? voice.stop : voice.start}>
        {voice.active ? <Square size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
        {voice.phase === 'stopping' ? (zh ? eventAssistantChatText.stopping.zh : eventAssistantChatText.stopping.en) : voice.active ? (zh ? eventAssistantChatText.stopVoiceInput.zh : eventAssistantChatText.stopVoiceInput.en) : (zh ? eventAssistantChatText.voiceInput.zh : eventAssistantChatText.voiceInput.en)}
      </AppActionButton>
    </div>
    <p id={`${promptId}-voice-help`} className="mt-2 text-xs leading-5 text-[#66766f]">{voice.supported ? (zh ? eventAssistantChatText.yourBrowserMayUseAnOnlineSpeechServiceReview.zh : eventAssistantChatText.yourBrowserMayUseAnOnlineSpeechServiceReview.en) : voiceError}</p>
    <div role="status" className="mt-2 text-sm text-[#176b5a]">
      {voice.active ? <p>{voice.phase === 'starting' ? (zh ? eventAssistantChatText.startingTheMicrophoneAllowMicrophoneAccessInYourBrowser.zh : eventAssistantChatText.startingTheMicrophoneAllowMicrophoneAccessInYourBrowser.en) : voice.phase === 'stopping' ? (zh ? eventAssistantChatText.finishingTheLastTranscription.zh : eventAssistantChatText.finishingTheLastTranscription.en) : (zh ? eventAssistantChatText.listeningEnglish.zh : eventAssistantChatText.listeningEnglish.en)}</p> : null}
      {voice.interim ? <p className="mt-1 whitespace-pre-wrap break-words">{zh ? eventAssistantChatText.recognising.zh : eventAssistantChatText.recognising.en}{voice.interim}</p> : null}
    </div>
    {voice.supported && voiceError ? <p role="alert" className="mt-2 text-sm text-rose-800">{voiceError}</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p> : null}
    <p className="event-assistant-review">{readOnly ? (zh ? eventAssistantChatText.theseDetailsAreReadOnlySendingAndEditingAre.zh : eventAssistantChatText.theseDetailsAreReadOnlySendingAndEditingAre.en) : (zh ? eventAssistantChatText.explicitDetailsFillTheDraftUncertainDetailsPromptA.zh : eventAssistantChatText.explicitDetailsFillTheDraftUncertainDetailsPromptA.en)}</p>
    {footer}
  </section>
}
