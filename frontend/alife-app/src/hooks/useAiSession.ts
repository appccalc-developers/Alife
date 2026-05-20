import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { createAiSessionService } from '../services/aiSessionService'
import { normalizeApiError } from '../services/http'
import type { AiSessionResponse, AiSessionSsePayload, AiSessionState } from '../types/aiSession'

export const useAiSession = <TDraft, TContext = unknown>(sessionId: string, basePath: string) => {
  const service = useMemo(() => createAiSessionService<TDraft, TContext>(basePath), [basePath])
  const [state, setState] = useState<AiSessionState<TDraft, TContext> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) {
      setState(null)
      return
    }

    let isMounted = true
    const source = service.createStream(sessionId)

    const applyState = (nextState: AiSessionState<TDraft, TContext>) => {
      if (isMounted) {
        setState(nextState)
      }
    }

    source.addEventListener('snapshot', (event) => {
      applyState(JSON.parse((event as MessageEvent<string>).data) as AiSessionState<TDraft, TContext>)
    })

    source.addEventListener('message', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as AiSessionSsePayload<TDraft, TContext>
      if (payload.state) {
        applyState(payload.state)
      }
    })

    service.getState(sessionId)
      .then(applyState)
      .catch((reason) => {
        if (isMounted) {
          setError(normalizeApiError(reason).message)
        }
      })

    return () => {
      isMounted = false
      source.close()
    }
  }, [service, sessionId])

  const sendMessage = useCallback(async (message: string, inputMode: 'text' | 'voice' = 'text') => {
    setLoading(true)
    setError('')

    try {
      const response = await service.sendMessage(sessionId, message, inputMode)

      if (response.responseMode === 'result' && response.result) {
        const nextDraft = response.result
        setState((current) => current
          ? {
            ...current,
            draft: nextDraft,
            context: response.context ?? current.context ?? null,
            updatedAt: new Date().toISOString(),
          }
          : current)
      }

      return response
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(apiError.message)
      throw apiError
    } finally {
      setLoading(false)
    }
  }, [service, sessionId])

  const clearError = useCallback(() => setError(''), [])

  return {
    state,
    setState,
    loading,
    error,
    clearError,
    sendMessage,
  } as {
    state: AiSessionState<TDraft, TContext> | null
    setState: Dispatch<SetStateAction<AiSessionState<TDraft, TContext> | null>>
    loading: boolean
    error: string
    clearError: () => void
    sendMessage: (message: string, inputMode?: 'text' | 'voice') => Promise<AiSessionResponse<TDraft, TContext>>
  }
}
