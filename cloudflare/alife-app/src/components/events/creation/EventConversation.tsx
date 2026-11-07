import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowRight, CalendarDays, Check, History, MapPin, Mic, Pause, Send, Undo2, Users, Volume2, VolumeX } from 'lucide-react'
import { eventConversationText as copy } from '../../../i18n/eventConversation'
import { createAiSessionService } from '../../../services/aiSessionService'
import { normalizeApiError, sameOriginHttp } from '../../../services/http'
import type { EventActivityType } from '../../../types/eventComposition'
import { emptyActivityPlan } from '../../../types/eventActivityPlan'
import type { CreationDraft } from '../../../utils/eventCreationDraft'
import { invalidateArrangementConfirmation } from '../../../utils/eventCreationDraft'
import { detailsSnapshot } from '../../../utils/eventDetailsAssistant'
import { activityPlanAssistantForm } from '../../../utils/eventFormAssistant'
import { applyConversationDraft } from '../../../utils/eventConversationDraft'
import { detailCompletion, type Bilingual, type DetailsResult } from '../../../../../shared/eventDetails'
import { validateFormAssistantResult, type FormAssistantInput } from '../../../../../shared/eventFormAssistant'
import type { CreationProjectAssistantInput } from '../../../../../shared/eventCreationAssistant'
import { useDetailsVoiceInput } from './useDetailsVoiceInput'
import '../../../styles/eventConversation.css'

const detailsService = createAiSessionService<DetailsResult>('/api/events/details-session')
type Turn = { id: string; user: string; reply: Bilingual }

export default function EventConversation({ draft, setDraft, type, isSeries, groupId, zh, active, onBusy, onAdopt, onReview }: {
  draft: CreationDraft; setDraft: Dispatch<SetStateAction<CreationDraft>>; type: EventActivityType; isSeries: boolean
  groupId: string; zh: boolean; active: boolean; onBusy: (busy: boolean) => void; onAdopt: () => void; onReview: () => void
}) {
  const t = (key: keyof typeof copy) => copy[key][zh ? 'zh' : 'en']
  const text = (value: Bilingual) => (zh ? value.zh : value.en) || value.en || value.zh
  const [prompt, setPrompt] = useState(''), [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState<'' | 'speechError' | 'updated' | 'undone'>('')
  const [handsFree, setHandsFree] = useState(false), [speaking, setSpeaking] = useState(false), [audio, setAudio] = useState(true)
  const [history, setHistory] = useState(false), [typing, setTyping] = useState(false)
  const [undo, setUndo] = useState<{ before: CreationDraft; after: string } | null>(null)
  const promptId = useId(), session = useRef(crypto.randomUUID()), started = useRef(false), mounted = useRef(true), lock = useRef(false)
  const draftHeading = useRef<HTMLHeadingElement>(null), conversationHeading = useRef<HTMLHeadingElement>(null)
  const jumpTo = (heading: HTMLHeadingElement | null) => {
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  const generation = useRef(0), speechGeneration = useRef(0), speechTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const signature = JSON.stringify({ draft, type: type.code, isSeries, groupId })
  const latest = useRef({ signature, active, zh, handsFree, audio }); latest.current = { signature, active, zh, handsFree, audio }
  const revision = useRef(0), previous = useRef('')
  if (previous.current !== signature) { previous.current = signature; revision.current++ }
  const callbacks = useRef({ onBusy, onAdopt }); callbacks.current = { onBusy, onAdopt }
  const snapshot = detailsSnapshot(draft, type, isSeries, revision.current)
  const completion = detailCompletion(snapshot.form, snapshot.sources, isSeries)

  function cancelPlayback() {
    speechGeneration.current++
    clearTimeout(speechTimer.current)
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }
  function pause() { generation.current++; latest.current.handsFree = false; setHandsFree(false); voice.cancel(); cancelPlayback() }
  function speak(value: Bilingual, token: number) {
    if (!latest.current.audio || !latest.current.active || token !== generation.current) return
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { setHandsFree(false); setNotice('speechError'); return }
    cancelPlayback(); setSpeaking(true)
    const speechToken = speechGeneration.current
    const utterance = new SpeechSynthesisUtterance(text(value))
    utterance.lang = zh ? 'zh-CN' : 'en-NZ'; utterance.rate = .96
    const voiceChoice = window.speechSynthesis.getVoices().find(v => v.lang === utterance.lang)
    if (voiceChoice) utterance.voice = voiceChoice
    const current = () => mounted.current && latest.current.active && token === generation.current && speechToken === speechGeneration.current
    utterance.onend = () => { clearTimeout(speechTimer.current); if (current()) setSpeaking(false) }
    utterance.onerror = () => { clearTimeout(speechTimer.current); if (current()) { setSpeaking(false); setHandsFree(false); setNotice('speechError') } }
    speechTimer.current = setTimeout(() => { if (current()) { setHandsFree(false); cancelPlayback(); setNotice('speechError') } }, 45000)
    window.speechSynthesis.speak(utterance)
  }
  async function send(value: string) {
    const submitted = value.trim()
    if (!submitted || lock.current || !latest.current.active) return
    lock.current = true; setBusy(true); callbacks.current.onBusy(true); setError(''); setNotice(''); setPrompt(submitted)
    voice.cancel(); cancelPlayback()
    const sentSignature = signature, sentRevision = snapshot.revision, token = generation.current
    started.current = true
    try {
      const projectInput: CreationProjectAssistantInput = {
        groupId, revision: sentRevision, language: zh ? 'zh' : 'en', timeZone: draft.timeZone,
        message: submitted, form: activityPlanAssistantForm(draft.activityPlan ?? emptyActivityPlan()),
        context: { eventTitle: draft.title, eventDescription: draft.description },
        history: turns.slice(-4).flatMap(turn => [{ role: 'user' as const, text: turn.user }, { role: 'assistant' as const, text: text(turn.reply) }]),
      }
      // No writes: each endpoint validates its own narrow schema. Both must
      // succeed before a single latest-draft update is applied.
      const [detailsResponse, projectsResponse] = await Promise.all([
        detailsService.sendMessage(session.current, submitted, { inputMode: 'text', appContext: { language: zh ? 'zh' : 'en', knownFacts: { snapshot } } }),
        sameOriginHttp.post<unknown>('/api/events/creation-project-assistance', projectInput),
      ])
      if (!mounted.current || !latest.current.active || token !== generation.current || latest.current.signature !== sentSignature) throw new Error(t('stale'))
      const details = detailsResponse.result
      if (!details || details.revision !== sentRevision) throw new Error(t('noResult'))
      const validationInput: FormAssistantInput = { ...projectInput, eventId: groupId, scope: 'activityPlan' }
      const projects = validateFormAssistantResult(projectsResponse.data, validationInput)
      const next = applyConversationDraft(draft, details, projects, submitted)
      const nextCompletion = detailCompletion(detailsSnapshot(next, type, isSeries, sentRevision).form, next.detailSources ?? {}, isSeries)
      const reply = nextCompletion.percent < 100 ? details.assistantReply : projects.assistantReply
      setDraft(current => JSON.stringify({ draft: current, type: type.code, isSeries, groupId }) === sentSignature ? next : current)
      setUndo({ before: draft, after: JSON.stringify(next) }); callbacks.current.onAdopt()
      setTurns(current => [...current, { id: crypto.randomUUID(), user: submitted, reply }].slice(-12))
      setPrompt(''); setNotice('updated'); setHistory(false)
      speak(reply, token)
    } catch (reason) {
      if (mounted.current) { setError(normalizeApiError(reason).message.replace(/\s*\((?:POST|GET) \/api\/.*\)$/, '')); setHandsFree(false); setTyping(true) }
    } finally {
      lock.current = false
      if (mounted.current) { setBusy(false); callbacks.current.onBusy(false) }
    }
  }
  const sendRef = useRef(send); sendRef.current = send
  const voice = useDetailsVoiceInput({ value: prompt, onChange: setPrompt, enabled: active && !busy && !speaking, language: zh ? 'zh-CN' : 'en-NZ', maxLength: 8000, continuous: false,
    onComplete: value => { if (latest.current.handsFree && latest.current.active) void sendRef.current(value) },
  })
  const voiceRef = useRef(voice); voiceRef.current = voice
  useEffect(() => {
    if (voice.error) { setHandsFree(false); setTyping(true) }
  }, [voice.error])
  useEffect(() => {
    if (!handsFree || !active || busy || speaking || voice.active || voice.error) return
    const timer = setTimeout(() => voiceRef.current.start(), 500)
    return () => clearTimeout(timer)
  }, [handsFree, active, busy, speaking, voice.active, voice.error])
  useEffect(() => {
    generation.current++; setHandsFree(false); voiceRef.current.cancel(); cancelPlayback()
  }, [active, zh])
  useEffect(() => {
    const hide = () => { if (document.hidden) { generation.current++; setHandsFree(false); voiceRef.current.cancel(); cancelPlayback() } }
    document.addEventListener('visibilitychange', hide)
    const pagehide = () => { generation.current++; setHandsFree(false); voiceRef.current.cancel(); cancelPlayback() }
    window.addEventListener('pagehide', pagehide)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', pagehide) }
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current++; clearTimeout(speechTimer.current); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); callbacks.current.onBusy(false); if (started.current) void detailsService.close(session.current).catch(() => undefined) }
  }, [])
  const status = busy ? t('thinking') : speaking ? t('speaking') : voice.active ? t('listening') : t('idle')
  const last = turns.at(-1)
  return <section className="event-conversation" aria-label={t('conversation')} hidden={!active}>
    <header className="ec-heading"><div><h2 ref={conversationHeading} tabIndex={-1}>{t('headline')}</h2><p>{t('subtitle')}</p></div><span>{t('scope')}</span><button type="button" className="ec-jump" onClick={() => jumpTo(draftHeading.current)}>{t('viewDraft')}<ArrowRight size={15} /></button></header>
    <div className="ec-studio">
      <aside className="ec-character"><div className="ec-character-copy"><span>{t('name')} / {t('role')}</span><h3>{t('characterTitle')}</h3></div><img src="/event-companion/anhe.png" width={1024} height={1536} alt={t('characterAlt')} /><div className="ec-signature"><strong>{t('name')}</strong><small>{t('artwork')}</small></div></aside>
      <div className="ec-dialogue">
        <div className="ec-identity"><img src="/event-companion/anhe-portrait.png" width={44} height={44} alt="" /><div><strong>{t('name')}</strong><p role="status"><i className={busy || voice.active ? 'ec-pulse' : ''} />{status}</p></div><button type="button" onClick={() => setHistory(!history)} aria-label={t('history')} aria-expanded={history}><History size={19} /></button></div>
        <div className="ec-exchange" role="log" aria-label={t('history')} aria-live="polite">
          {history && turns.length ? turns.map(turn => <div className="ec-history-turn" key={turn.id}><small>{t('you')}</small><p>{turn.user}</p><small>{t('name')}</small><p>{text(turn.reply)}</p></div>) : <>
            {last || busy ? <div className="ec-user"><small>{t('you')}</small><p>{busy ? prompt : last?.user}</p></div> : null}
            <p className={`ec-answer ${!last && !busy ? 'ec-welcome' : ''}`}>{busy ? t('thinking') : last ? text(last.reply) : t('intro')}</p>
          </>}
          {voice.interim ? <p className="ec-interim">{voice.interim}</p> : null}
        </div>
        {notice ? <p className="ec-update" role="status"><Check size={14} />{t(notice)}</p> : null}
        {undo && undo.after === JSON.stringify(draft) ? <button type="button" className="ec-undo" disabled={busy} onClick={() => { pause(); const before = undo.before; setDraft(current => JSON.stringify(current) === undo.after ? invalidateArrangementConfirmation(before) : current); setUndo(null); setNotice('undone') }}><Undo2 size={14} />{t('undo')}</button> : null}
        <div className="ec-voice-dock"><button type="button" className="ec-mic" disabled={(busy && !handsFree) || !voice.supported} aria-label={handsFree ? t('pause') : t('start')} aria-pressed={handsFree} onClick={() => {
          if (handsFree) { pause(); return }
          if (prompt.trim()) { setTyping(true); setHandsFree(true); latest.current.handsFree = true; void sendRef.current(prompt); return }
          setHandsFree(true); latest.current.handsFree = true; setError(''); setNotice(''); voice.start()
        }}>{handsFree ? <Pause size={22} /> : <Mic size={22} />}</button><div><strong>{handsFree ? t('pause') : t('start')}</strong><span>{status}</span></div><button type="button" className="ec-audio" aria-label={audio ? t('off') : t('on')} aria-pressed={audio} onClick={() => { setAudio(!audio); if (audio) { setHandsFree(false); cancelPlayback() } }}>{audio ? <Volume2 size={19} /> : <VolumeX size={19} />}</button></div>
        {voice.active ? <button type="button" className="ec-turn-stop" disabled={voice.phase === 'stopping'} onClick={voice.stop}>{t('stopTurn')}</button> : null}
        <details className="ec-privacy"><summary>{t('voiceDisclosure')}</summary><p>{t('privacy')}</p></details>
        {!voice.supported ? <p className="ec-fallback-note">{t('unsupported')}</p> : voice.error ? <p role="alert" className="ec-error">{voice.error === 'no-speech' ? t('noSpeech') : t('voiceError')}</p> : null}
        <details className="ec-typing" open={typing} onToggle={event => setTyping(event.currentTarget.open)}><summary>{t('fallback')}</summary><label className="sr-only" htmlFor={promptId}>{t('prompt')}</label><textarea id={promptId} rows={3} maxLength={8000} value={prompt} disabled={busy || voice.active} onChange={event => setPrompt(event.target.value)} /><button type="button" className="ec-send" disabled={busy || voice.active || !prompt.trim()} onClick={() => { setHandsFree(false); void send(prompt) }}><Send size={15} />{error ? t('retry') : t('send')}</button></details>
        {error ? <p className="ec-error" role="alert">{error}</p> : null}
      </div>
      <aside className="ec-draft" aria-label={t('live')}><header><h3 ref={draftHeading} tabIndex={-1}>{t('live')}</h3><span>{t('updates')}</span><button type="button" className="ec-jump" onClick={() => jumpTo(conversationHeading.current)}>{t('backConversation')}</button></header><div className="ec-draft-body"><span className="ec-eyebrow">{t('template')} · {text(type.name)}</span><h4>{text(draft.title) || t('empty')}</h4>{text(draft.description) ? <p className="ec-description">{text(draft.description)}</p> : null}<dl>
        <div><CalendarDays size={16} /><dt>{t('date')}</dt><dd>{draft.startLocal.replace('T', ' ') || t('pending')}<br />{draft.endLocal.replace('T', ' ')}<small>{draft.timeZone}</small></dd></div>
        <div><MapPin size={16} /><dt>{t('place')}</dt><dd>{text(draft.locationName) || t('pending')}</dd></div>
        <div><Users size={16} /><dt>{t('participants')}</dt><dd>{draft.activityPlan?.participantCount ?? t('pending')}</dd></div>
      </dl><section className="ec-projects"><h5>{t('projects')}<span>{draft.activityPlan?.activities.length ?? 0}</span></h5>{draft.activityPlan?.activities.map((project, index) => <div key={project.id}><b>{String(index + 1).padStart(2, '0')}</b><div><strong>{text(project.name) || t('pending')}</strong><p>{text(project.conditions)}</p><small>{t('pending')}</small></div></div>)}</section><p className="ec-note">{t('note')}</p></div><footer><span>{completion.completed} / {completion.total} · {t('detailsTab')}</span><button type="button" disabled={busy} onClick={() => { pause(); onReview() }}>{t('review')}<ArrowRight size={16} /></button><p>{t('reviewHelp')}</p></footer></aside>
    </div>
  </section>
}
