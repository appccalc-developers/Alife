import { useCallback, useEffect, useRef, useState } from 'react'

type RecognitionResult = ArrayLike<{ transcript: string }> & { isFinal: boolean }
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null
}
type RecognitionConstructor = new () => Recognition
type Phase = 'idle' | 'starting' | 'listening' | 'stopping'

const getRecognition = () => {
  if (typeof window === 'undefined' || !window.isSecureContext) return null
  const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null
}

export function useDetailsVoiceInput({ value, onChange, enabled, language, maxLength }: {
  value: string; onChange: (value: string) => void; enabled: boolean; language: string; maxLength: number
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [interim, setInterim] = useState(''), [error, setError] = useState('')
  const recognition = useRef<Recognition | null>(null)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ value, onChange, enabled, language })
  latest.current = { value, onChange, enabled, language }

  const release = useCallback(() => {
    const current = recognition.current
    recognition.current = null
    if (stopTimer.current) clearTimeout(stopTimer.current)
    stopTimer.current = null
    if (current) {
      current.onstart = current.onend = current.onerror = current.onresult = null
      try { current.abort() } catch { /* Already disconnected. */ }
    }
  }, [])
  const cancel = useCallback(() => {
    release()
    setPhase('idle'); setInterim('')
  }, [release])

  useEffect(() => {
    // Changing steps or languages ends dictation without restarting the microphone.
    cancel()
    return release
  }, [enabled, language, cancel, release])
  useEffect(() => {
    const hide = () => { if (document.hidden) cancel() }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', cancel)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', cancel)
      release()
    }
  }, [cancel, release])

  const start = () => {
    if (recognition.current || !latest.current.enabled || document.hidden) return
    const Constructor = getRecognition()
    if (!Constructor) { setError('unsupported'); return }
    if (latest.current.value.length >= maxLength) { setError('limit'); return }
    setError(''); setInterim(''); setPhase('starting')
    try {
      const current = new Constructor()
      recognition.current = current
      current.lang = language
      current.continuous = true
      current.interimResults = true
      const finalIndices = new Set<number>()
      const isCurrent = () => recognition.current === current && latest.current.enabled && latest.current.language === language
      current.onstart = () => { if (isCurrent()) setPhase(previous => previous === 'stopping' ? previous : 'listening') }
      current.onresult = event => {
        if (!isCurrent()) return
        const final: string[] = [], pending: string[] = []
        Array.from(event.results).forEach((result, index) => {
          const transcript = result[0]?.transcript ?? ''
          if (!result.isFinal) pending.push(transcript)
          else if (!finalIndices.has(index)) { finalIndices.add(index); final.push(transcript) }
        })
        setInterim(pending.join(' ').slice(0, maxLength))
        const transcript = final.join(' ').trim()
        if (!transcript) return
        const existing = latest.current.value
        const next = existing + (existing && !/\s$/.test(existing) ? ' ' : '') + transcript
        latest.current.value = next.slice(0, maxLength)
        latest.current.onChange(latest.current.value)
        if (next.length >= maxLength) { setError('limit'); cancel() }
      }
      current.onerror = event => {
        if (!isCurrent()) return
        setError(event.error); cancel()
      }
      current.onend = () => { if (isCurrent()) cancel() }
      current.start()
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === 'NotAllowedError' ? 'not-allowed' : 'failed')
      cancel()
    }
  }
  const stop = () => {
    const current = recognition.current
    if (!current || phase === 'stopping') return
    setPhase('stopping')
    // stop() can deliver one last final result; keep the input locked from sending until end.
    stopTimer.current = setTimeout(cancel, 3000)
    try { current.stop() } catch { setError('failed'); cancel() }
  }

  return { supported: Boolean(getRecognition()), phase, active: phase !== 'idle', interim, error, start, stop, cancel }
}
